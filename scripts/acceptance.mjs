import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "dist", "cli.js");
const generated = join(root, "examples", "generated");
await rm(generated, { recursive: true, force: true });

run([cli, "validate", join(root, "examples", "sunday-roast.yaml")], 0);
run([cli, "validate", join(root, "examples", "weeknight-bowls.yaml")], 0);
run(
  [
    cli,
    "plan",
    join(root, "examples", "sunday-roast.yaml"),
    "--serve-at",
    "2026-07-28T19:00:00+01:00",
    "--out",
    generated,
    "--quiet",
  ],
  0,
);
run(
  [
    cli,
    "plan",
    join(root, "examples", "impossible-one-oven.yaml"),
    "--serve-at",
    "2026-07-28T19:00:00+01:00",
    "--no-write",
    "--quiet",
  ],
  3,
);

const schedule = JSON.parse(await readFile(join(generated, "schedule.json"), "utf8"));
assertSchedule(schedule);
for (const filename of [
  "schedule.json",
  "schedule.csv",
  "schedule.ics",
  "cook-mode.html",
  "summary.txt",
]) {
  await readFile(join(generated, filename));
}

console.log(
  `Acceptance passed: ${schedule.tasks.length} scheduled steps, ${schedule.totalSpanMinutes} minute span, all outputs readable.`,
);

function run(args, expectedStatus) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  if (result.status !== expectedStatus) {
    throw new Error(
      `Command failed with ${result.status}, expected ${expectedStatus}\n${result.stdout}\n${result.stderr}`,
    );
  }
}

function assertSchedule(schedule) {
  const byId = new Map(schedule.tasks.map((task) => [task.id, task]));
  for (const task of schedule.tasks) {
    if (task.endOffset - task.startOffset !== task.duration) {
      throw new Error(`Duration mismatch for ${task.id}`);
    }
    for (const dependencyId of task.dependencies) {
      const dependency = byId.get(dependencyId);
      if (!dependency || dependency.endOffset > task.startOffset) {
        throw new Error(`Dependency violation: ${dependencyId} -> ${task.id}`);
      }
    }
  }

  for (const resource of schedule.resources) {
    for (
      let minute = -schedule.totalSpanMinutes - 60;
      minute <= Math.max(0, ...schedule.tasks.map((task) => task.endOffset));
      minute += 1
    ) {
      const units = schedule.tasks
        .filter(
          (task) =>
            task.startOffset <= minute &&
            task.endOffset > minute &&
            task.resources[resource.id] !== undefined,
        )
        .reduce((total, task) => total + task.resources[resource.id], 0);
      if (units > resource.capacity) {
        throw new Error(
          `Capacity violation for ${resource.id} at ${minute}: ${units}/${resource.capacity}`,
        );
      }
    }
  }

  for (const dish of schedule.dishes) {
    if (dish.readyOffset > dish.desiredOffset) {
      throw new Error(`Dish ${dish.id} is late.`);
    }
  }
}
