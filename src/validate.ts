import { InputValidationError } from "./errors.js";
import { topologicalOrder } from "./graph.js";
import {
  PLAN_VERSION,
  type NormalizedDish,
  type NormalizedPlan,
  type NormalizedTask,
  type PlanInput,
  type ValidationIssue,
} from "./types.js";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const DEFAULT_COLORS = [
  "#e76f51",
  "#2a9d8f",
  "#e9c46a",
  "#457b9d",
  "#9b5de5",
  "#f15bb5",
  "#00b4d8",
  "#6a994e",
];

type UnknownRecord = Record<string, unknown>;

export function validatePlan(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return [{ path: "$", message: "must be an object." }];
  }

  if (value.version !== PLAN_VERSION) {
    issues.push({
      path: "version",
      message: `must be ${PLAN_VERSION}.`,
      hint: "Set `version: 1` at the top of the plan.",
    });
  }
  validateText(value.title, "title", issues, 1, 120);

  if (value.timezone !== undefined) {
    validateText(value.timezone, "timezone", issues, 1, 80);
    if (typeof value.timezone === "string") {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value.timezone }).format();
      } catch {
        issues.push({
          path: "timezone",
          message: "must be a valid IANA timezone, such as Europe/London or Asia/Tokyo.",
        });
      }
    }
  }

  const resources = value.resources;
  if (!isRecord(resources) || Object.keys(resources).length === 0) {
    issues.push({ path: "resources", message: "must define at least one resource." });
  } else {
    if (Object.keys(resources).length > 32) {
      issues.push({ path: "resources", message: "cannot contain more than 32 resources." });
    }
    for (const [resourceId, resourceValue] of Object.entries(resources)) {
      validateId(resourceId, `resources.${resourceId}`, issues);
      if (!isRecord(resourceValue)) {
        issues.push({ path: `resources.${resourceId}`, message: "must be an object." });
        continue;
      }
      validateInteger(resourceValue.capacity, `resources.${resourceId}.capacity`, issues, 1, 16);
      if (resourceValue.label !== undefined) {
        validateText(resourceValue.label, `resources.${resourceId}.label`, issues, 1, 80);
      }
    }
  }

  if (value.defaults !== undefined) {
    if (!isRecord(value.defaults)) {
      issues.push({ path: "defaults", message: "must be an object." });
    } else {
      const attention = value.defaults.attentionResource;
      if (attention !== undefined) {
        validateText(attention, "defaults.attentionResource", issues, 1, 80);
        if (typeof attention === "string" && isRecord(resources) && !(attention in resources)) {
          issues.push({
            path: "defaults.attentionResource",
            message: `references unknown resource "${attention}".`,
          });
        }
      }
      if (value.defaults.horizonMinutes !== undefined) {
        validateInteger(
          value.defaults.horizonMinutes,
          "defaults.horizonMinutes",
          issues,
          30,
          10_080,
        );
      }
    }
  }

  const dishes = value.dishes;
  if (!Array.isArray(dishes) || dishes.length === 0) {
    issues.push({ path: "dishes", message: "must contain at least one dish." });
    return issues;
  }
  if (dishes.length > 50) {
    issues.push({ path: "dishes", message: "cannot contain more than 50 dishes." });
  }

  const dishIds = new Set<string>();
  const allTaskIds = new Set<string>();
  const pendingDependencies: Array<{ taskId: string; path: string; reference: string }> = [];

  dishes.forEach((dishValue, dishIndex) => {
    const dishPath = `dishes[${dishIndex}]`;
    if (!isRecord(dishValue)) {
      issues.push({ path: dishPath, message: "must be an object." });
      return;
    }
    const dishId = dishValue.id;
    validateId(dishId, `${dishPath}.id`, issues);
    if (typeof dishId === "string") {
      if (dishIds.has(dishId)) {
        issues.push({ path: `${dishPath}.id`, message: `duplicates dish id "${dishId}".` });
      }
      dishIds.add(dishId);
    }
    validateText(dishValue.name, `${dishPath}.name`, issues, 1, 100);
    if (dishValue.color !== undefined) {
      if (typeof dishValue.color !== "string" || !COLOR_PATTERN.test(dishValue.color)) {
        issues.push({ path: `${dishPath}.color`, message: "must be a six-digit hex color." });
      }
    }
    if (dishValue.serveOffset !== undefined) {
      validateInteger(dishValue.serveOffset, `${dishPath}.serveOffset`, issues, -1440, 1440);
    }
    if (dishValue.maxHold !== undefined) {
      validateInteger(dishValue.maxHold, `${dishPath}.maxHold`, issues, 0, 1440);
    }

    const steps = dishValue.steps;
    if (!Array.isArray(steps) || steps.length === 0) {
      issues.push({ path: `${dishPath}.steps`, message: "must contain at least one step." });
      return;
    }
    if (steps.length > 200) {
      issues.push({ path: `${dishPath}.steps`, message: "cannot contain more than 200 steps." });
    }

    const localStepIds = new Set<string>();
    steps.forEach((stepValue, stepIndex) => {
      const stepPath = `${dishPath}.steps[${stepIndex}]`;
      if (!isRecord(stepValue)) {
        issues.push({ path: stepPath, message: "must be an object." });
        return;
      }
      const stepId = stepValue.id;
      validateId(stepId, `${stepPath}.id`, issues);
      if (typeof stepId === "string") {
        if (localStepIds.has(stepId)) {
          issues.push({ path: `${stepPath}.id`, message: `duplicates step id "${stepId}".` });
        }
        localStepIds.add(stepId);
        if (typeof dishId === "string") {
          allTaskIds.add(`${dishId}.${stepId}`);
        }
      }
      validateText(stepValue.name, `${stepPath}.name`, issues, 1, 120);
      validateInteger(stepValue.duration, `${stepPath}.duration`, issues, 1, 1440);
      if (stepValue.mode !== "active" && stepValue.mode !== "passive") {
        issues.push({ path: `${stepPath}.mode`, message: 'must be "active" or "passive".' });
      }
      if (stepValue.notes !== undefined) {
        validateText(stepValue.notes, `${stepPath}.notes`, issues, 1, 500);
      }

      if (stepValue.resources !== undefined) {
        if (!isRecord(stepValue.resources)) {
          issues.push({ path: `${stepPath}.resources`, message: "must be an object." });
        } else {
          for (const [resourceId, demand] of Object.entries(stepValue.resources)) {
            if (!isRecord(resources) || !(resourceId in resources)) {
              issues.push({
                path: `${stepPath}.resources.${resourceId}`,
                message: `references unknown resource "${resourceId}".`,
              });
              continue;
            }
            const capacityValue = resources[resourceId];
            const capacity =
              isRecord(capacityValue) && Number.isInteger(capacityValue.capacity)
                ? Number(capacityValue.capacity)
                : 16;
            validateInteger(demand, `${stepPath}.resources.${resourceId}`, issues, 1, capacity);
          }
        }
      }

      if (stepValue.after !== undefined) {
        if (!Array.isArray(stepValue.after)) {
          issues.push({ path: `${stepPath}.after`, message: "must be an array of step ids." });
        } else {
          stepValue.after.forEach((reference, referenceIndex) => {
            validateText(reference, `${stepPath}.after[${referenceIndex}]`, issues, 1, 160);
            if (
              typeof dishId === "string" &&
              typeof stepId === "string" &&
              typeof reference === "string"
            ) {
              pendingDependencies.push({
                taskId: `${dishId}.${stepId}`,
                path: `${stepPath}.after[${referenceIndex}]`,
                reference: resolveReference(dishId, reference),
              });
            }
          });
        }
      }
    });
  });

  for (const pending of pendingDependencies) {
    if (pending.taskId === pending.reference) {
      issues.push({ path: pending.path, message: "cannot reference the step itself." });
    } else if (!allTaskIds.has(pending.reference)) {
      issues.push({
        path: pending.path,
        message: `references unknown step "${pending.reference}".`,
        hint: "Use a local step id or a fully qualified dish-id.step-id reference.",
      });
    }
  }

  return issues;
}

export function normalizePlan(value: unknown): NormalizedPlan {
  const issues = validatePlan(value);
  if (issues.length > 0) {
    throw new InputValidationError(issues);
  }

  const plan = value as PlanInput;
  const attentionResource = plan.defaults?.attentionResource;
  const tasks: NormalizedTask[] = [];
  const dishes: NormalizedDish[] = [];

  plan.dishes.forEach((dish, dishIndex) => {
    const dishColor = dish.color ?? DEFAULT_COLORS[dishIndex % DEFAULT_COLORS.length] ?? "#457b9d";
    const serveOffset = dish.serveOffset ?? 0;
    const maxHold = dish.maxHold ?? 15;
    const finalStep = dish.steps.at(-1);
    if (!finalStep) {
      throw new InputValidationError([
        { path: `dishes[${dishIndex}].steps`, message: "is empty." },
      ]);
    }

    dishes.push({
      id: dish.id,
      name: dish.name,
      color: dishColor,
      serveOffset,
      maxHold,
      finalTaskId: `${dish.id}.${finalStep.id}`,
    });

    dish.steps.forEach((step, stepIndex) => {
      const dependencies: string[] = [];
      const previous = dish.steps[stepIndex - 1];
      if (previous) {
        dependencies.push(`${dish.id}.${previous.id}`);
      }
      for (const reference of step.after ?? []) {
        dependencies.push(resolveReference(dish.id, reference));
      }

      const resources = { ...(step.resources ?? {}) };
      if (
        step.mode === "active" &&
        attentionResource &&
        resources[attentionResource] === undefined
      ) {
        resources[attentionResource] = 1;
      }

      tasks.push({
        id: `${dish.id}.${step.id}`,
        localId: step.id,
        dishId: dish.id,
        dishName: dish.name,
        dishColor,
        name: step.name,
        duration: step.duration,
        mode: step.mode,
        resources,
        dependencies: [...new Set(dependencies)],
        successors: [],
        notes: step.notes,
        order: tasks.length,
        deadlineOffset: stepIndex === dish.steps.length - 1 ? serveOffset : 0,
      });
    });
  });

  const byId = new Map(tasks.map((task) => [task.id, task]));
  for (const task of tasks) {
    for (const dependencyId of task.dependencies) {
      byId.get(dependencyId)?.successors.push(task.id);
    }
  }
  for (const task of tasks) {
    task.successors.sort((a, b) => {
      const left = byId.get(a)?.order ?? 0;
      const right = byId.get(b)?.order ?? 0;
      return left - right || a.localeCompare(b);
    });
  }

  if (!topologicalOrder(tasks)) {
    throw new InputValidationError([
      {
        path: "dishes",
        message: "contains a dependency cycle.",
        hint: "Remove one of the `after` links that makes steps depend on each other.",
      },
    ]);
  }

  return {
    title: plan.title,
    timezone: plan.timezone,
    resources: Object.fromEntries(
      Object.entries(plan.resources).map(([id, resource]) => [
        id,
        { id, label: resource.label ?? id, capacity: resource.capacity },
      ]),
    ),
    dishes,
    tasks,
    horizonMinutes: plan.defaults?.horizonMinutes ?? 24 * 60,
    attentionResource,
  };
}

function resolveReference(dishId: string, reference: string): string {
  return reference.includes(".") ? reference : `${dishId}.${reference}`;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateId(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    issues.push({
      path,
      message: "must use lowercase letters, numbers, and single hyphens.",
      hint: "Example: roast-chicken",
    });
  }
}

function validateText(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  minimum: number,
  maximum: number,
): void {
  if (typeof value !== "string" || value.trim().length < minimum || value.length > maximum) {
    issues.push({
      path,
      message: `must be text between ${minimum} and ${maximum} characters.`,
    });
  }
}

function validateInteger(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  minimum: number,
  maximum: number,
): void {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    issues.push({ path, message: `must be an integer from ${minimum} to ${maximum}.` });
  }
}
