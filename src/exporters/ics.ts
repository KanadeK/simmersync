import { createHash } from "node:crypto";
import type { ScheduleResult } from "../types.js";
import { escapeIcs } from "../utils/escape.js";
import { toUtcCalendarStamp } from "../utils/time.js";

export function exportIcs(schedule: ScheduleResult): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SimmerSync//Kitchen Schedule 0.1//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(schedule.title)}`,
  ];

  for (const task of schedule.tasks) {
    const resources = Object.keys(task.resources);
    const description = [
      `${task.mode === "active" ? "Active work" : "Passive time"} · ${task.duration} minutes`,
      resources.length > 0 ? `Resources: ${resources.join(", ")}` : "",
      task.notes ?? "",
    ]
      .filter(Boolean)
      .join("\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${eventUid(schedule, task.id, task.start)}`,
      `DTSTAMP:${toUtcCalendarStamp(new Date(schedule.serveAt))}`,
      `DTSTART:${toUtcCalendarStamp(new Date(task.start))}`,
      `DTEND:${toUtcCalendarStamp(new Date(task.end))}`,
      `SUMMARY:${escapeIcs(`${task.dishName}: ${task.name}`)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      `CATEGORIES:${task.mode.toUpperCase()},COOKING`,
    );

    if (task.mode === "active") {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "TRIGGER:-PT1M",
        `DESCRIPTION:${escapeIcs(`Next: ${task.name}`)}`,
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

function eventUid(schedule: ScheduleResult, taskId: string, start: string): string {
  const digest = createHash("sha256")
    .update(`${schedule.title}\0${schedule.serveAt}\0${taskId}\0${start}`)
    .digest("hex")
    .slice(0, 24);
  return `${digest}@simmersync.local`;
}

function foldLine(line: string): string {
  if (line.length <= 73) {
    return line;
  }
  const chunks: string[] = [];
  for (let index = 0; index < line.length; index += 73) {
    chunks.push(`${index === 0 ? "" : " "}${line.slice(index, index + 73)}`);
  }
  return chunks.join("\r\n");
}
