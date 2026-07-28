import type { ConflictDetail, ValidationIssue } from "./types.js";

export class InputValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(
      issues.length === 1
        ? `Invalid plan: ${issues[0]?.path} ${issues[0]?.message}`
        : `Invalid plan: ${issues.length} problems found`,
    );
    this.name = "InputValidationError";
    this.issues = issues;
  }
}

export class ScheduleConflictError extends Error {
  readonly detail: ConflictDetail;

  constructor(detail: ConflictDetail) {
    super(
      `Could not place ${detail.taskId} (${detail.duration} min) before its deadline within the ${detail.horizonMinutes}-minute horizon.`,
    );
    this.name = "ScheduleConflictError";
    this.detail = detail;
  }
}
