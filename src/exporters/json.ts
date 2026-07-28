import type { ScheduleResult } from "../types.js";

export function exportJson(schedule: ScheduleResult): string {
  return `${JSON.stringify(schedule, null, 2)}\n`;
}
