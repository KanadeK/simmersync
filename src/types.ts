export const PLAN_VERSION = 1 as const;

export type StepMode = "active" | "passive";

export interface ResourceInput {
  capacity: number;
  label?: string;
}

export interface StepInput {
  id: string;
  name: string;
  duration: number;
  mode: StepMode;
  resources?: Record<string, number>;
  after?: string[];
  notes?: string;
}

export interface DishInput {
  id: string;
  name: string;
  color?: string;
  serveOffset?: number;
  maxHold?: number;
  steps: StepInput[];
}

export interface PlanDefaults {
  attentionResource?: string;
  horizonMinutes?: number;
}

export interface PlanInput {
  version: typeof PLAN_VERSION;
  title: string;
  timezone?: string;
  resources: Record<string, ResourceInput>;
  defaults?: PlanDefaults;
  dishes: DishInput[];
}

export interface NormalizedResource {
  id: string;
  label: string;
  capacity: number;
}

export interface NormalizedTask {
  id: string;
  localId: string;
  dishId: string;
  dishName: string;
  dishColor: string;
  name: string;
  duration: number;
  mode: StepMode;
  resources: Record<string, number>;
  dependencies: string[];
  successors: string[];
  notes?: string;
  order: number;
  deadlineOffset: number;
}

export interface NormalizedDish {
  id: string;
  name: string;
  color: string;
  serveOffset: number;
  maxHold: number;
  finalTaskId: string;
}

export interface NormalizedPlan {
  title: string;
  timezone?: string;
  resources: Record<string, NormalizedResource>;
  dishes: NormalizedDish[];
  tasks: NormalizedTask[];
  horizonMinutes: number;
  attentionResource?: string;
}

export interface ScheduledTask {
  id: string;
  dishId: string;
  dishName: string;
  dishColor: string;
  name: string;
  mode: StepMode;
  duration: number;
  resources: Record<string, number>;
  dependencies: string[];
  notes?: string;
  startOffset: number;
  endOffset: number;
  start: string;
  end: string;
  dependencySlack: number | null;
  critical: boolean;
}

export interface DishSummary {
  id: string;
  name: string;
  readyOffset: number;
  readyAt: string;
  desiredOffset: number;
  holdMinutes: number;
  maxHold: number;
}

export interface ResourceSummary {
  id: string;
  label: string;
  capacity: number;
  usedUnitMinutes: number;
  peakUnits: number;
  utilization: number;
}

export interface ScheduleWarning {
  code: "LONG_HOLD" | "TIGHT_HANDOFF";
  message: string;
  taskId?: string;
  dishId?: string;
}

export interface ScheduleResult {
  schemaVersion: 1;
  generator: {
    name: "SimmerSync";
    version: string;
  };
  title: string;
  timezone?: string;
  serveAt: string;
  startAt: string;
  totalSpanMinutes: number;
  totalActiveMinutes: number;
  tasks: ScheduledTask[];
  dishes: DishSummary[];
  resources: ResourceSummary[];
  warnings: ScheduleWarning[];
}

export interface ScheduleOptions {
  serveAt: Date;
  horizonMinutes?: number;
  version?: string;
}

export interface ValidationIssue {
  path: string;
  message: string;
  hint?: string;
}

export interface ConflictDetail {
  taskId: string;
  taskName: string;
  duration: number;
  deadlineOffset: number;
  horizonMinutes: number;
  likelyResources: string[];
  suggestions: string[];
}
