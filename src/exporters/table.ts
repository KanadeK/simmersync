import type { ScheduleResult } from "../types.js";
import { formatClock, formatDateTime } from "../utils/time.js";

export function exportTable(schedule: ScheduleResult): string {
  const rows = schedule.tasks.map((task) => [
    `${formatClock(new Date(task.start), schedule.timezone)}–${formatClock(
      new Date(task.end),
      schedule.timezone,
    )}`,
    task.mode === "active" ? "ACTIVE" : "wait",
    task.dishName,
    task.name,
    Object.keys(task.resources).join(", ") || "—",
  ]);
  const headers = ["TIME", "MODE", "DISH", "STEP", "RESOURCES"];
  const widths = headers.map((header, column) =>
    Math.min(34, Math.max(header.length, ...rows.map((row) => visibleLength(row[column] ?? "")))),
  );
  const divider = widths.map((width) => "─".repeat(width)).join("─┼─");
  const render = (row: string[]) =>
    row
      .map((cell, column) => pad(truncate(cell, widths[column] ?? 10), widths[column] ?? 10))
      .join(" │ ");

  const warnings =
    schedule.warnings.length > 0
      ? ["", "Warnings:", ...schedule.warnings.map((warning) => `  - ${warning.message}`)]
      : [];
  const busiest = schedule.resources[0];

  return [
    schedule.title,
    `Serve: ${formatDateTime(new Date(schedule.serveAt), schedule.timezone)} · Start: ${formatClock(
      new Date(schedule.startAt),
      schedule.timezone,
    )} · Span: ${schedule.totalSpanMinutes} min`,
    busiest
      ? `Bottleneck: ${busiest.label} ${(busiest.utilization * 100).toFixed(0)}% utilized`
      : "",
    "",
    render(headers),
    divider,
    ...rows.map(render),
    ...warnings,
    "",
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n");
}

function truncate(value: string, width: number): string {
  return visibleLength(value) <= width ? value : `${value.slice(0, Math.max(0, width - 1))}…`;
}

function pad(value: string, width: number): string {
  return `${value}${" ".repeat(Math.max(0, width - visibleLength(value)))}`;
}

function visibleLength(value: string): number {
  return [...value].length;
}
