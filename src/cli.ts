#!/usr/bin/env node

import { mkdir, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { InputValidationError, ScheduleConflictError } from "./errors.js";
import { exportCsv, exportHtml, exportIcs, exportJson, exportTable } from "./exporters/index.js";
import { loadPlan } from "./parse.js";
import { schedulePlan } from "./scheduler.js";
import { parseServeTime } from "./utils/time.js";
import { normalizePlan } from "./validate.js";
import { VERSION } from "./version.js";

interface CliIo {
  out(text: string): void;
  error(text: string): void;
  now(): Date;
}

interface ParsedArguments {
  positionals: string[];
  flags: Map<string, string | boolean>;
}

const defaultIo: CliIo = {
  out: (text) => process.stdout.write(text.endsWith("\n") ? text : `${text}\n`),
  error: (text) => process.stderr.write(text.endsWith("\n") ? text : `${text}\n`),
  now: () => new Date(),
};

export async function runCli(argv: string[], io: CliIo = defaultIo): Promise<number> {
  const [command = "help", ...rest] = argv;
  try {
    if (command === "help" || command === "--help" || command === "-h") {
      io.out(helpText());
      return 0;
    }
    if (command === "--version" || command === "-v" || command === "version") {
      io.out(VERSION);
      return 0;
    }
    if (command === "validate") {
      return await validateCommand(rest, io);
    }
    if (command === "plan") {
      return await planCommand(rest, io);
    }
    io.error(`Unknown command "${command}".\n\n${helpText()}`);
    return 2;
  } catch (error) {
    return reportError(error, io);
  }
}

async function validateCommand(argv: string[], io: CliIo): Promise<number> {
  const parsed = parseArguments(argv);
  assertKnownFlags(parsed, new Set(["json"]));
  const input = parsed.positionals[0];
  if (!input || parsed.positionals.length !== 1) {
    throw new InputValidationError([
      { path: "command", message: "validate requires exactly one plan file." },
    ]);
  }

  const plan = await loadPlan(input);
  const normalized = normalizePlan(plan);
  if (flagEnabled(parsed, "json")) {
    io.out(
      JSON.stringify(
        {
          valid: true,
          file: resolve(input),
          title: normalized.title,
          dishes: normalized.dishes.length,
          tasks: normalized.tasks.length,
          resources: Object.keys(normalized.resources).length,
        },
        null,
        2,
      ),
    );
  } else {
    io.out(
      `VALID ${basename(input)} · ${normalized.dishes.length} dishes · ${normalized.tasks.length} steps · ${Object.keys(normalized.resources).length} resources`,
    );
  }
  return 0;
}

async function planCommand(argv: string[], io: CliIo): Promise<number> {
  const parsed = parseArguments(argv);
  assertKnownFlags(
    parsed,
    new Set(["serve-at", "serve-in", "out", "horizon", "json", "no-write", "quiet"]),
  );
  const input = parsed.positionals[0];
  if (!input || parsed.positionals.length !== 1) {
    throw new InputValidationError([
      { path: "command", message: "plan requires exactly one plan file." },
    ]);
  }

  const serveAtText = stringFlag(parsed, "serve-at");
  const serveInText = stringFlag(parsed, "serve-in");
  if (Boolean(serveAtText) === Boolean(serveInText)) {
    throw new InputValidationError([
      {
        path: "command",
        message: "provide exactly one of --serve-at or --serve-in.",
        hint: '--serve-at "2026-07-28T19:00:00+09:00" or --serve-in 120',
      },
    ]);
  }

  const now = io.now();
  const serveAt = serveAtText
    ? parseServeTime(serveAtText, now)
    : new Date(
        now.getTime() + parseBoundedInteger(serveInText ?? "", "--serve-in", 1, 10_080) * 60_000,
      );
  const horizonText = stringFlag(parsed, "horizon");
  const horizonMinutes = horizonText
    ? parseBoundedInteger(horizonText, "--horizon", 30, 10_080)
    : undefined;
  const plan = await loadPlan(input);
  const schedule = schedulePlan(plan, { serveAt, horizonMinutes, version: VERSION });
  const noWrite = flagEnabled(parsed, "no-write");
  const json = flagEnabled(parsed, "json");
  const quiet = flagEnabled(parsed, "quiet");

  if (!quiet) {
    io.out(json ? exportJson(schedule) : exportTable(schedule));
  }

  if (!noWrite) {
    const outputDirectory = resolve(stringFlag(parsed, "out") ?? "simmersync-output");
    const outputs = new Map([
      ["schedule.json", exportJson(schedule)],
      ["schedule.csv", exportCsv(schedule)],
      ["schedule.ics", exportIcs(schedule)],
      ["cook-mode.html", exportHtml(schedule)],
      ["summary.txt", exportTable(schedule)],
    ]);
    await mkdir(outputDirectory, { recursive: true });
    for (const [filename, content] of outputs) {
      await writeAtomic(join(outputDirectory, filename), content);
    }
    if (!quiet) {
      io.out(`Wrote ${outputs.size} files to ${outputDirectory}`);
    }
  }
  return 0;
}

function parseArguments(argv: string[]): ParsedArguments {
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? "";
    if (!argument.startsWith("--")) {
      positionals.push(argument);
      continue;
    }
    const equals = argument.indexOf("=");
    if (equals > 2) {
      flags.set(argument.slice(2, equals), argument.slice(equals + 1));
      continue;
    }
    const name = argument.slice(2);
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--") && expectsValue(name)) {
      flags.set(name, next);
      index += 1;
    } else {
      flags.set(name, true);
    }
  }
  return { positionals, flags };
}

function expectsValue(name: string): boolean {
  return ["serve-at", "serve-in", "out", "horizon"].includes(name);
}

function assertKnownFlags(parsed: ParsedArguments, known: Set<string>): void {
  for (const flag of parsed.flags.keys()) {
    if (!known.has(flag)) {
      throw new InputValidationError([{ path: "command", message: `unknown flag --${flag}.` }]);
    }
  }
}

function stringFlag(parsed: ParsedArguments, name: string): string | undefined {
  const value = parsed.flags.get(name);
  if (value === true) {
    throw new InputValidationError([{ path: "command", message: `--${name} requires a value.` }]);
  }
  return typeof value === "string" ? value : undefined;
}

function flagEnabled(parsed: ParsedArguments, name: string): boolean {
  return parsed.flags.get(name) === true;
}

function parseBoundedInteger(
  value: string,
  name: string,
  minimum: number,
  maximum: number,
): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new InputValidationError([
      { path: "command", message: `${name} must be an integer from ${minimum} to ${maximum}.` },
    ]);
  }
  return number;
}

async function writeAtomic(path: string, content: string): Promise<void> {
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  await writeFile(temporary, content, "utf8");
  await rename(temporary, path);
}

function reportError(error: unknown, io: CliIo): number {
  if (error instanceof InputValidationError) {
    io.error("PLAN INVALID");
    for (const issue of error.issues) {
      io.error(`  ${issue.path}: ${issue.message}${issue.hint ? `\n    Fix: ${issue.hint}` : ""}`);
    }
    return 2;
  }
  if (error instanceof ScheduleConflictError) {
    io.error(`SCHEDULE CONFLICT\n  ${error.message}`);
    if (error.detail.likelyResources.length > 0) {
      io.error(`  Likely bottlenecks: ${error.detail.likelyResources.join(", ")}`);
    }
    for (const suggestion of error.detail.suggestions) {
      io.error(`  Fix: ${suggestion}`);
    }
    return 3;
  }
  const message = error instanceof Error ? error.message : String(error);
  io.error(`ERROR ${message}`);
  return 1;
}

function helpText(): string {
  return `SimmerSync ${VERSION} — make every dish land hot

Usage:
  simmersync validate <plan.yaml> [--json]
  simmersync plan <plan.yaml> --serve-at <ISO-8601> [options]
  simmersync plan <plan.yaml> --serve-in <minutes> [options]

Plan options:
  --serve-at <time>  Target service time. Prefer ISO 8601 with a UTC offset.
  --serve-in <mins>  Target service time relative to now.
  --out <directory>  Output directory (default: simmersync-output).
  --horizon <mins>   Maximum look-back window (30–10080).
  --json             Print the schedule as JSON.
  --no-write         Print only; do not write artifacts.
  --quiet            Write artifacts without terminal output.

Outputs:
  schedule.json, schedule.csv, schedule.ics, cook-mode.html, summary.txt

Exit codes:
  0 success · 1 unexpected error · 2 invalid input · 3 no feasible schedule

Examples:
  simmersync validate examples/sunday-roast.yaml
  simmersync plan examples/sunday-roast.yaml \\
    --serve-at "2026-07-28T19:00:00+09:00" --out demo
`;
}

const invokedAs = process.argv[1] ?? "";
const directModule = import.meta.url === new URL(invokedAs, "file:").href;
const packageShim = ["simmersync", "simmersync.cmd"].includes(basename(invokedAs));
if (directModule || packageShim) {
  process.exitCode = await runCli(process.argv.slice(2));
}
