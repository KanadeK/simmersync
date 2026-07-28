import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InputValidationError } from "../src/errors.js";
import { parsePlan } from "../src/parse.js";
import { normalizePlan, validatePlan } from "../src/validate.js";
import { simplePlan } from "./helpers.js";

describe("plan validation", () => {
  it("normalizes implicit dependencies and active attention", () => {
    const normalized = normalizePlan(simplePlan());
    assert.equal(normalized.tasks.length, 5);
    assert.deepEqual(normalized.tasks[0]?.resources, { cook: 1 });
    assert.deepEqual(normalized.tasks[1]?.dependencies, ["main.prep"]);
    assert.deepEqual(normalized.tasks[0]?.successors, ["main.bake"]);
    assert.equal(normalized.dishes[0]?.finalTaskId, "main.plate");
  });

  it("collects structural issues instead of stopping at the first one", () => {
    const issues = validatePlan({
      version: 2,
      title: "",
      resources: {},
      dishes: [],
    });
    assert.ok(issues.length >= 4);
    assert.ok(issues.some((issue) => issue.path === "version"));
    assert.ok(issues.some((issue) => issue.path === "resources"));
  });

  it("rejects unknown resources and excessive demand", () => {
    const plan = simplePlan();
    const step = plan.dishes[0]?.steps[0];
    assert.ok(step);
    step.resources = { missing: 1, oven: 2 };
    const issues = validatePlan(plan);
    assert.ok(issues.some((issue) => issue.message.includes('unknown resource "missing"')));
    assert.ok(issues.some((issue) => issue.path.endsWith("resources.oven")));
  });

  it("rejects duplicate ids and bad references", () => {
    const plan = simplePlan();
    const firstDish = plan.dishes[0];
    assert.ok(firstDish);
    firstDish.steps[1] = {
      id: "prep",
      name: "Duplicate",
      duration: 2,
      mode: "active",
      after: ["not-there"],
    };
    const issues = validatePlan(plan);
    assert.ok(issues.some((issue) => issue.message.includes("duplicates step id")));
    assert.ok(issues.some((issue) => issue.message.includes("unknown step")));
  });

  it("detects explicit dependency cycles", () => {
    const plan = simplePlan();
    const steps = plan.dishes[0]?.steps;
    assert.ok(steps);
    const firstStep = steps[0];
    assert.ok(firstStep);
    steps[0] = { ...firstStep, after: ["plate"] };
    assert.throws(
      () => normalizePlan(plan),
      (error: unknown) =>
        error instanceof InputValidationError &&
        error.issues.some((issue) => issue.message.includes("dependency cycle")),
    );
  });

  it("accepts YAML and JSON", () => {
    const yaml = `
version: 1
title: Tea
resources:
  kettle: { capacity: 1 }
dishes:
  - id: tea
    name: Tea
    steps:
      - id: steep
        name: Steep
        duration: 4
        mode: passive
        resources: { kettle: 1 }
`;
    assert.equal(parsePlan(yaml).title, "Tea");
    assert.equal(parsePlan(JSON.stringify(simplePlan()), ".json").title, "Test dinner");
  });

  it("returns actionable syntax errors", () => {
    assert.throws(
      () => parsePlan("title: [unterminated"),
      (error: unknown) =>
        error instanceof InputValidationError &&
        error.issues[0]?.hint?.includes("indentation") === true,
    );
  });

  it("validates timezone and id formats", () => {
    const plan = simplePlan();
    plan.timezone = "Mars/Olympus";
    const firstDish = plan.dishes[0];
    assert.ok(firstDish);
    plan.dishes[0] = { ...firstDish, id: "Bad ID" };
    const issues = validatePlan(plan);
    assert.ok(issues.some((issue) => issue.path === "timezone"));
    assert.ok(issues.some((issue) => issue.path === "dishes[0].id"));
  });
});
