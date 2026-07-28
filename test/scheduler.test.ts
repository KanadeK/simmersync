import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ScheduleConflictError } from "../src/errors.js";
import { schedulePlan } from "../src/scheduler.js";
import type { PlanInput } from "../src/types.js";
import { simplePlan } from "./helpers.js";

const serveAt = new Date("2026-07-28T18:00:00Z");

describe("backward scheduler", () => {
  it("finishes dishes no later than their requested serve offsets", () => {
    const schedule = schedulePlan(simplePlan(), { serveAt });
    assert.equal(schedule.tasks.length, 5);
    assert.ok(schedule.dishes.every((dish) => dish.readyOffset <= dish.desiredOffset));
    assert.equal(schedule.serveAt, serveAt.toISOString());
    assert.equal(
      new Date(schedule.startAt).getTime(),
      serveAt.getTime() + Math.min(...schedule.tasks.map((task) => task.startOffset)) * 60_000,
    );
  });

  it("preserves dependencies and durations", () => {
    const schedule = schedulePlan(simplePlan(), { serveAt });
    const byId = new Map(schedule.tasks.map((task) => [task.id, task]));
    for (const task of schedule.tasks) {
      assert.equal(task.endOffset - task.startOffset, task.duration);
      for (const dependencyId of task.dependencies) {
        assert.ok(
          (byId.get(dependencyId)?.endOffset ?? Number.POSITIVE_INFINITY) <= task.startOffset,
        );
      }
    }
  });

  it("does not overlap capacity-one resources", () => {
    const schedule = schedulePlan(simplePlan(), { serveAt });
    for (const resourceId of ["cook", "oven"]) {
      const users = schedule.tasks.filter((task) => task.resources[resourceId]);
      for (let left = 0; left < users.length; left += 1) {
        for (let right = left + 1; right < users.length; right += 1) {
          const a = users[left];
          const b = users[right];
          assert.ok(a && b);
          assert.ok(a.endOffset <= b.startOffset || b.endOffset <= a.startOffset);
        }
      }
    }
  });

  it("uses capacity greater than one for parallel passive work", () => {
    const plan = simplePlan();
    plan.resources.oven = { capacity: 2, label: "Two shelves" };
    const schedule = schedulePlan(plan, { serveAt });
    const bake = schedule.tasks.find((task) => task.id === "main.bake");
    const roast = schedule.tasks.find((task) => task.id === "side.roast");
    assert.ok(bake && roast);
    assert.ok(bake.startOffset < roast.endOffset && roast.startOffset < bake.endOffset);
    assert.equal(schedule.resources.find((resource) => resource.id === "oven")?.peakUnits, 2);
  });

  it("honors cross-dish dependencies", () => {
    const plan = simplePlan();
    const sideStep = plan.dishes[1]?.steps[0];
    assert.ok(sideStep);
    sideStep.after = ["main.bake"];
    const schedule = schedulePlan(plan, { serveAt });
    const bake = schedule.tasks.find((task) => task.id === "main.bake");
    const chop = schedule.tasks.find((task) => task.id === "side.chop");
    assert.ok(bake && chop);
    assert.ok(bake.endOffset <= chop.startOffset);
  });

  it("supports dishes intended to finish early", () => {
    const plan = simplePlan();
    const side = plan.dishes[1];
    assert.ok(side);
    side.serveOffset = -15;
    const schedule = schedulePlan(plan, { serveAt });
    const summary = schedule.dishes.find((dish) => dish.id === "side");
    assert.ok(summary);
    assert.ok(summary.readyOffset <= -15);
  });

  it("emits a long-hold warning when contention pushes a dish too early", () => {
    const plan: PlanInput = {
      version: 1,
      title: "Two last-minute plates",
      resources: { cook: { capacity: 1 } },
      defaults: { attentionResource: "cook", horizonMinutes: 60 },
      dishes: [
        {
          id: "one",
          name: "One",
          maxHold: 0,
          steps: [{ id: "finish", name: "Finish one", duration: 10, mode: "active" }],
        },
        {
          id: "two",
          name: "Two",
          maxHold: 0,
          steps: [{ id: "finish", name: "Finish two", duration: 10, mode: "active" }],
        },
      ],
    };
    const schedule = schedulePlan(plan, { serveAt });
    assert.ok(schedule.warnings.some((warning) => warning.code === "LONG_HOLD"));
  });

  it("reports an infeasible horizon with likely resources and fixes", () => {
    const plan = simplePlan();
    plan.defaults = { ...plan.defaults, horizonMinutes: 30 };
    assert.throws(
      () => schedulePlan(plan, { serveAt }),
      (error: unknown) =>
        error instanceof ScheduleConflictError &&
        error.detail.horizonMinutes === 30 &&
        error.detail.suggestions.length >= 2,
    );
  });

  it("is deterministic", () => {
    const first = schedulePlan(simplePlan(), { serveAt });
    const second = schedulePlan(simplePlan(), { serveAt });
    assert.deepEqual(first, second);
  });

  it("validates runtime options", () => {
    assert.throws(
      () => schedulePlan(simplePlan(), { serveAt, horizonMinutes: 1 }),
      /horizonMinutes/,
    );
    assert.throws(
      () => schedulePlan(simplePlan(), { serveAt: new Date(Number.NaN) }),
      /valid Date/,
    );
  });
});
