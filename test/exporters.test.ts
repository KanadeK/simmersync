import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { exportCsv } from "../src/exporters/csv.js";
import { exportHtml } from "../src/exporters/html.js";
import { exportIcs } from "../src/exporters/ics.js";
import { exportJson } from "../src/exporters/json.js";
import { exportTable } from "../src/exporters/table.js";
import { schedulePlan } from "../src/scheduler.js";
import { simplePlan } from "./helpers.js";

const serveAt = new Date("2026-07-28T18:00:00Z");

describe("schedule exporters", () => {
  it("exports machine-readable JSON", () => {
    const schedule = schedulePlan(simplePlan(), { serveAt });
    const parsed = JSON.parse(exportJson(schedule));
    assert.equal(parsed.title, "Test dinner");
    assert.equal(parsed.tasks.length, 5);
  });

  it("quotes CSV fields safely", () => {
    const plan = simplePlan();
    const step = plan.dishes[0]?.steps[0];
    assert.ok(step);
    step.name = 'Prep, "carefully"';
    const csv = exportCsv(schedulePlan(plan, { serveAt }));
    assert.match(csv, /"Prep, ""carefully"""/);
    assert.equal(csv.trim().split("\n").length, 6);
  });

  it("creates calendar events and reminders", () => {
    const ics = exportIcs(schedulePlan(simplePlan(), { serveAt }));
    assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
    assert.match(ics, /BEGIN:VEVENT/);
    assert.match(ics, /BEGIN:VALARM/);
    assert.match(ics, /DTSTART:20260728T/);
    assert.match(ics, /END:VCALENDAR\r\n$/);
  });

  it("renders a readable terminal plan", () => {
    const table = exportTable(schedulePlan(simplePlan(), { serveAt }));
    assert.match(table, /Test dinner/);
    assert.match(table, /TIME\s+│\s+MODE/);
    assert.match(table, /Main dish/);
    assert.match(table, /Bottleneck:/);
  });

  it("renders an offline cook mode without executable user markup", () => {
    const plan = simplePlan();
    plan.title = "</script><script>alert(1)</script>";
    const step = plan.dishes[0]?.steps[0];
    assert.ok(step);
    step.name = "<img src=x onerror=alert(1)>";
    const html = exportHtml(schedulePlan(plan, { serveAt }));
    assert.match(html, /<!doctype html>/);
    assert.match(html, /Cook mode/);
    assert.ok(!html.includes("</script><script>alert(1)</script>"));
    assert.ok(!html.includes("<img src=x onerror=alert(1)>"));
    assert.ok(!/https?:\/\//.test(html.replace("http-equiv", "")));
  });
});
