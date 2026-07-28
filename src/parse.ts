import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { parse as parseYaml } from "yaml";
import { InputValidationError } from "./errors.js";
import type { PlanInput } from "./types.js";
import { normalizePlan } from "./validate.js";

export function parsePlan(text: string, formatHint = "yaml"): PlanInput {
  let value: unknown;

  try {
    value =
      formatHint.toLowerCase() === "json" || formatHint.toLowerCase().endsWith(".json")
        ? JSON.parse(text)
        : parseYaml(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new InputValidationError([
      {
        path: "$",
        message: `could not be parsed: ${message}`,
        hint: "Check indentation, quotes, commas, and list markers.",
      },
    ]);
  }

  normalizePlan(value);
  return value as PlanInput;
}

export async function loadPlan(path: string): Promise<PlanInput> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new InputValidationError([
      {
        path,
        message: `could not be read: ${message}`,
        hint: "Confirm the path exists and is readable.",
      },
    ]);
  }

  return parsePlan(text, extname(path));
}
