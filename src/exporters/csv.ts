import type { ScheduleResult } from "../types.js";
import { escapeCsv } from "../utils/escape.js";

export function exportCsv(schedule: ScheduleResult): string {
  const rows: Array<Array<string | number>> = [
    [
      "id",
      "dish",
      "step",
      "mode",
      "duration_minutes",
      "start",
      "end",
      "start_offset_minutes",
      "end_offset_minutes",
      "resources",
      "notes",
    ],
  ];

  for (const task of schedule.tasks) {
    rows.push([
      task.id,
      task.dishName,
      task.name,
      task.mode,
      task.duration,
      task.start,
      task.end,
      task.startOffset,
      task.endOffset,
      Object.entries(task.resources)
        .map(([id, units]) => `${id}:${units}`)
        .join(" "),
      task.notes ?? "",
    ]);
  }

  return `${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}\n`;
}
