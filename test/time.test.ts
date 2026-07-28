import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addMinutes, formatClock, parseServeTime, toUtcCalendarStamp } from "../src/utils/time.js";

describe("time helpers", () => {
  it("adds minutes and emits UTC calendar stamps", () => {
    const date = new Date("2026-07-28T18:00:00Z");
    assert.equal(addMinutes(date, -15).toISOString(), "2026-07-28T17:45:00.000Z");
    assert.equal(toUtcCalendarStamp(date), "20260728T180000Z");
    assert.equal(formatClock(date, "UTC"), "18:00");
  });

  it("parses ISO timestamps", () => {
    assert.equal(
      parseServeTime("2026-07-28T19:00:00+01:00").toISOString(),
      "2026-07-28T18:00:00.000Z",
    );
    assert.throws(() => parseServeTime("not a time"), /Invalid serve time/);
  });

  it("moves an elapsed clock-only target to tomorrow", () => {
    const now = new Date("2026-07-28T20:00:00Z");
    const result = parseServeTime("19:00", now);
    assert.equal(result.getDate(), 29);
    assert.throws(() => parseServeTime("28:90", now), /Invalid clock time/);
  });
});
