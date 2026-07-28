import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { runCli } from "../src/cli.js";

const temporaryDirectories: string[] = [];
after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("CLI", () => {
  it("validates an example", async () => {
    const capture = io();
    const status = await runCli(["validate", resolve("examples/sunday-roast.yaml")], capture);
    assert.equal(status, 0);
    assert.match(capture.stdout.join(""), /VALID sunday-roast.yaml/);
  });

  it("writes all five artifacts", async () => {
    const output = await mkdtemp(join(tmpdir(), "simmersync-test-"));
    temporaryDirectories.push(output);
    const capture = io();
    const status = await runCli(
      [
        "plan",
        resolve("examples/sunday-roast.yaml"),
        "--serve-at",
        "2026-07-28T19:00:00+01:00",
        "--out",
        output,
        "--quiet",
      ],
      capture,
    );
    assert.equal(status, 0);
    const schedule = JSON.parse(await readFile(join(output, "schedule.json"), "utf8"));
    assert.equal(schedule.title, "Sunday roast for four");
    await Promise.all(
      ["schedule.csv", "schedule.ics", "cook-mode.html", "summary.txt"].map((filename) =>
        readFile(join(output, filename)),
      ),
    );
  });

  it("returns stable error codes for invalid and infeasible plans", async () => {
    const invalid = io();
    assert.equal(await runCli(["plan"], invalid), 2);
    assert.match(invalid.stderr.join(""), /PLAN INVALID/);

    const conflict = io();
    assert.equal(
      await runCli(
        [
          "plan",
          resolve("examples/impossible-one-oven.yaml"),
          "--serve-in",
          "60",
          "--no-write",
          "--quiet",
        ],
        conflict,
      ),
      3,
    );
    assert.match(conflict.stderr.join(""), /SCHEDULE CONFLICT/);
  });

  it("prints help, version, and JSON validation", async () => {
    const help = io();
    assert.equal(await runCli(["help"], help), 0);
    assert.match(help.stdout.join(""), /Usage:/);

    const version = io();
    assert.equal(await runCli(["--version"], version), 0);
    assert.match(version.stdout.join(""), /^0\.1\.0/);

    const json = io();
    assert.equal(
      await runCli(["validate", resolve("examples/weeknight-bowls.yaml"), "--json"], json),
      0,
    );
    assert.equal(JSON.parse(json.stdout.join("")).valid, true);
  });
});

function io() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    out: (text: string) => stdout.push(text.endsWith("\n") ? text : `${text}\n`),
    error: (text: string) => stderr.push(text.endsWith("\n") ? text : `${text}\n`),
    now: () => new Date("2026-07-28T09:00:00Z"),
  };
}
