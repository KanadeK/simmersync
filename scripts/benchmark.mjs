import { performance } from "node:perf_hooks";
import { schedulePlan } from "../dist/scheduler.js";

const dishes = Array.from({ length: 20 }, (_, dishIndex) => ({
  id: `dish-${dishIndex + 1}`,
  name: `Benchmark dish ${dishIndex + 1}`,
  maxHold: 1440,
  steps: Array.from({ length: 10 }, (_, stepIndex) => ({
    id: `step-${stepIndex + 1}`,
    name: `Step ${stepIndex + 1}`,
    duration: stepIndex % 2 === 0 ? 3 : 12,
    mode: stepIndex % 2 === 0 ? "active" : "passive",
    resources: stepIndex % 2 === 0 ? { counter: 1 } : { oven: 1 },
  })),
}));

const plan = {
  version: 1,
  title: "Synthetic 200-step dinner",
  resources: {
    cook: { capacity: 4 },
    counter: { capacity: 8 },
    oven: { capacity: 16 },
  },
  defaults: {
    attentionResource: "cook",
    horizonMinutes: 10_080,
  },
  dishes,
};

const serveAt = new Date("2026-07-28T18:00:00Z");
const runs = [];
for (let index = 0; index < 10; index += 1) {
  const start = performance.now();
  const schedule = schedulePlan(plan, { serveAt });
  runs.push(performance.now() - start);
  if (schedule.tasks.length !== 200) {
    throw new Error(`Expected 200 tasks, got ${schedule.tasks.length}`);
  }
}

runs.sort((left, right) => left - right);
const median = runs[Math.floor(runs.length / 2)];
const slowest = Math.max(...runs);
if (slowest > 2500) {
  throw new Error(`Scheduler benchmark exceeded 2500 ms: ${slowest.toFixed(1)} ms`);
}
console.log(
  `Benchmark passed: 200 steps · median ${median.toFixed(1)} ms · slowest ${slowest.toFixed(1)} ms`,
);
