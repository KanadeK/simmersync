export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function toUtcCalendarStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function formatClock(date: Date, timezone?: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(date);
}

export function formatDateTime(date: Date, timezone?: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
    timeZoneName: "short",
  }).format(date);
}

export function parseServeTime(value: string, now = new Date()): Date {
  const trimmed = value.trim();
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [hoursText, minutesText] = trimmed.split(":");
    const hours = Number(hoursText);
    const minutes = Number(minutesText);
    if (hours > 23 || minutes > 59) {
      throw new Error(`Invalid clock time "${value}".`);
    }
    const result = new Date(now);
    result.setSeconds(0, 0);
    result.setHours(hours, minutes, 0, 0);
    if (result.getTime() <= now.getTime()) {
      result.setDate(result.getDate() + 1);
    }
    return result;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `Invalid serve time "${value}". Use ISO 8601 with an offset, for example 2026-07-28T19:00:00+09:00.`,
    );
  }
  return parsed;
}
