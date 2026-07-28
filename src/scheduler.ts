import { ScheduleConflictError } from "./errors.js";
import { topologicalOrder } from "./graph.js";
import type {
  DishSummary,
  NormalizedPlan,
  NormalizedTask,
  PlanInput,
  ResourceSummary,
  ScheduleOptions,
  ScheduleResult,
  ScheduledTask,
  ScheduleWarning,
} from "./types.js";
import { addMinutes } from "./utils/time.js";
import { normalizePlan } from "./validate.js";

type UsageTimeline = Map<number, number>;

interface Placement {
  start: number;
  end: number;
  requestedEnd: number;
}

export function schedulePlan(
  planInput: PlanInput | NormalizedPlan,
  options: ScheduleOptions,
): ScheduleResult {
  if (Number.isNaN(options.serveAt.getTime())) {
    throw new TypeError("serveAt must be a valid Date.");
  }

  const plan = isNormalizedPlan(planInput) ? planInput : normalizePlan(planInput);
  const horizonMinutes = options.horizonMinutes ?? plan.horizonMinutes;
  if (!Number.isInteger(horizonMinutes) || horizonMinutes < 30 || horizonMinutes > 10_080) {
    throw new RangeError("horizonMinutes must be an integer from 30 to 10080.");
  }

  if (!topologicalOrder(plan.tasks)) {
    throw new TypeError("The normalized plan contains a dependency cycle.");
  }

  const finalDeadlines = new Map(
    plan.dishes.map((dish) => [dish.finalTaskId, dish.serveOffset] as const),
  );
  const usage = new Map<string, UsageTimeline>(
    Object.keys(plan.resources).map((resourceId) => [resourceId, new Map<number, number>()]),
  );
  const placements = new Map<string, Placement>();
  const remaining = new Set(plan.tasks.map((task) => task.id));
  const holdTolerance = new Map(plan.dishes.map((dish) => [dish.id, dish.maxHold] as const));

  while (remaining.size > 0) {
    const candidates = plan.tasks
      .filter(
        (task) =>
          remaining.has(task.id) &&
          task.successors.every((successorId) => placements.has(successorId)),
      )
      .map((task) => ({
        task,
        deadline: resolveDeadline(task, placements, finalDeadlines),
      }))
      .sort(
        (left, right) =>
          right.deadline - left.deadline ||
          (holdTolerance.get(left.task.dishId) ?? 15) -
            (holdTolerance.get(right.task.dishId) ?? 15) ||
          right.task.duration - left.task.duration ||
          left.task.order - right.task.order ||
          left.task.id.localeCompare(right.task.id),
      );
    const candidate = candidates[0];
    if (!candidate) {
      throw new TypeError("No schedulable task remained; the plan may contain a dependency cycle.");
    }
    const placement = placeTask(candidate.task, candidate.deadline, horizonMinutes, usage, plan);
    placements.set(candidate.task.id, placement);
    reserve(candidate.task, placement, usage);
    remaining.delete(candidate.task.id);
  }

  const tasks = plan.tasks
    .map((task) => toScheduledTask(task, placements, options.serveAt))
    .sort(
      (a, b) =>
        a.startOffset - b.startOffset || a.endOffset - b.endOffset || a.id.localeCompare(b.id),
    );

  const earliest = tasks[0]?.startOffset ?? 0;
  const latest = tasks.reduce((maximum, task) => Math.max(maximum, task.endOffset), 0);
  const span = Math.max(1, latest - earliest);
  const dishes = summarizeDishes(plan, placements, options.serveAt);
  const warnings = buildWarnings(plan, tasks, dishes);

  return {
    schemaVersion: 1,
    generator: {
      name: "SimmerSync",
      version: options.version ?? "0.1.0",
    },
    title: plan.title,
    timezone: plan.timezone,
    serveAt: options.serveAt.toISOString(),
    startAt: addMinutes(options.serveAt, earliest).toISOString(),
    totalSpanMinutes: latest - earliest,
    totalActiveMinutes: tasks
      .filter((task) => task.mode === "active")
      .reduce((total, task) => total + task.duration, 0),
    tasks,
    dishes,
    resources: summarizeResources(plan, usage, span),
    warnings,
  };
}

function resolveDeadline(
  task: NormalizedTask,
  placements: Map<string, Placement>,
  finalDeadlines: Map<string, number>,
): number {
  const candidates: number[] = [];
  const finalDeadline = finalDeadlines.get(task.id);
  if (finalDeadline !== undefined) {
    candidates.push(finalDeadline);
  }
  for (const successorId of task.successors) {
    const successor = placements.get(successorId);
    if (successor) {
      candidates.push(successor.start);
    }
  }
  if (candidates.length === 0) {
    throw new TypeError(`Task ${task.id} has no successor and is not a final dish step.`);
  }
  return Math.min(...candidates);
}

function placeTask(
  task: NormalizedTask,
  deadline: number,
  horizonMinutes: number,
  usage: Map<string, UsageTimeline>,
  plan: NormalizedPlan,
): Placement {
  for (let end = deadline; end - task.duration >= -horizonMinutes; end -= 1) {
    const start = end - task.duration;
    if (fits(task, start, end, usage, plan)) {
      return { start, end, requestedEnd: deadline };
    }
  }

  const likelyResources = Object.keys(task.resources).sort((left, right) => {
    const leftUse = totalUsage(usage.get(left));
    const rightUse = totalUsage(usage.get(right));
    return rightUse - leftUse || left.localeCompare(right);
  });
  throw new ScheduleConflictError({
    taskId: task.id,
    taskName: task.name,
    duration: task.duration,
    deadlineOffset: deadline,
    horizonMinutes,
    likelyResources,
    suggestions: [
      likelyResources.length > 0
        ? `Increase capacity for ${likelyResources.join(", ")} or remove that resource from steps that do not occupy it continuously.`
        : "Add a larger scheduling horizon.",
      `Raise defaults.horizonMinutes above ${horizonMinutes} if prep may begin earlier.`,
      "Split long active work into smaller steps so passive gaps can be used by another dish.",
    ],
  });
}

function fits(
  task: NormalizedTask,
  start: number,
  end: number,
  usage: Map<string, UsageTimeline>,
  plan: NormalizedPlan,
): boolean {
  for (const [resourceId, demand] of Object.entries(task.resources)) {
    const capacity = plan.resources[resourceId]?.capacity;
    if (capacity === undefined) {
      return false;
    }
    const resourceUsage = usage.get(resourceId);
    for (let minute = start; minute < end; minute += 1) {
      if ((resourceUsage?.get(minute) ?? 0) + demand > capacity) {
        return false;
      }
    }
  }
  return true;
}

function reserve(
  task: NormalizedTask,
  placement: Placement,
  usage: Map<string, UsageTimeline>,
): void {
  for (const [resourceId, demand] of Object.entries(task.resources)) {
    const resourceUsage = usage.get(resourceId);
    if (!resourceUsage) {
      continue;
    }
    for (let minute = placement.start; minute < placement.end; minute += 1) {
      resourceUsage.set(minute, (resourceUsage.get(minute) ?? 0) + demand);
    }
  }
}

function toScheduledTask(
  task: NormalizedTask,
  placements: Map<string, Placement>,
  serveAt: Date,
): ScheduledTask {
  const placement = placements.get(task.id);
  if (!placement) {
    throw new TypeError(`Missing placement for ${task.id}.`);
  }
  const dependencySlack = placement.requestedEnd - placement.end;
  return {
    id: task.id,
    dishId: task.dishId,
    dishName: task.dishName,
    dishColor: task.dishColor,
    name: task.name,
    mode: task.mode,
    duration: task.duration,
    resources: task.resources,
    dependencies: task.dependencies,
    notes: task.notes,
    startOffset: placement.start,
    endOffset: placement.end,
    start: addMinutes(serveAt, placement.start).toISOString(),
    end: addMinutes(serveAt, placement.end).toISOString(),
    dependencySlack,
    critical: dependencySlack === 0,
  };
}

function summarizeDishes(
  plan: NormalizedPlan,
  placements: Map<string, Placement>,
  serveAt: Date,
): DishSummary[] {
  return plan.dishes.map((dish) => {
    const final = placements.get(dish.finalTaskId);
    if (!final) {
      throw new TypeError(`Missing final placement for ${dish.id}.`);
    }
    return {
      id: dish.id,
      name: dish.name,
      readyOffset: final.end,
      readyAt: addMinutes(serveAt, final.end).toISOString(),
      desiredOffset: dish.serveOffset,
      holdMinutes: dish.serveOffset - final.end,
      maxHold: dish.maxHold,
    };
  });
}

function summarizeResources(
  plan: NormalizedPlan,
  usage: Map<string, UsageTimeline>,
  span: number,
): ResourceSummary[] {
  return Object.values(plan.resources)
    .map((resource) => {
      const resourceUsage = usage.get(resource.id);
      const values = resourceUsage ? [...resourceUsage.values()] : [];
      const usedUnitMinutes = values.reduce((total, units) => total + units, 0);
      return {
        id: resource.id,
        label: resource.label,
        capacity: resource.capacity,
        usedUnitMinutes,
        peakUnits: values.length > 0 ? Math.max(...values) : 0,
        utilization: round(usedUnitMinutes / (resource.capacity * span), 4),
      };
    })
    .sort((a, b) => b.utilization - a.utilization || a.id.localeCompare(b.id));
}

function buildWarnings(
  plan: NormalizedPlan,
  tasks: ScheduledTask[],
  dishes: DishSummary[],
): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];
  for (const dish of dishes) {
    if (dish.holdMinutes > dish.maxHold) {
      warnings.push({
        code: "LONG_HOLD",
        dishId: dish.id,
        message: `${dish.name} finishes ${dish.holdMinutes} minutes before its desired time; its maxHold is ${dish.maxHold}.`,
      });
    }
  }

  const byId = new Map(plan.tasks.map((task) => [task.id, task]));
  for (const task of tasks) {
    const source = byId.get(task.id);
    const hasCrossDishSuccessor =
      source?.successors.some((successorId) => byId.get(successorId)?.dishId !== source.dishId) ??
      false;
    if (
      task.mode === "active" &&
      task.dependencySlack !== null &&
      task.dependencySlack <= 1 &&
      hasCrossDishSuccessor
    ) {
      warnings.push({
        code: "TIGHT_HANDOFF",
        taskId: task.id,
        message: `${task.name} has ${task.dependencySlack} minute of slack before the next dependent step.`,
      });
    }
  }
  return warnings;
}

function totalUsage(timeline: UsageTimeline | undefined): number {
  if (!timeline) {
    return 0;
  }
  return [...timeline.values()].reduce((total, value) => total + value, 0);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isNormalizedPlan(value: PlanInput | NormalizedPlan): value is NormalizedPlan {
  return Array.isArray((value as NormalizedPlan).tasks);
}
