import type { ScheduleResult, ScheduledTask } from "../types.js";
import { escapeHtml } from "../utils/escape.js";
import { formatClock, formatDateTime } from "../utils/time.js";

export function exportHtml(schedule: ScheduleResult): string {
  const startOffset = Math.min(...schedule.tasks.map((task) => task.startOffset), 0);
  const endOffset = Math.max(...schedule.tasks.map((task) => task.endOffset), 0);
  const span = Math.max(1, endOffset - startOffset);
  const dishIds = [...new Set(schedule.tasks.map((task) => task.dishId))];
  const safeData = JSON.stringify(schedule).replaceAll("<", "\\u003c");

  const lanes = dishIds
    .map((dishId) => {
      const tasks = schedule.tasks.filter((task) => task.dishId === dishId);
      const first = tasks[0];
      if (!first) {
        return "";
      }
      return `
        <section class="lane" aria-label="${escapeHtml(first.dishName)}">
          <header><span class="dot" style="--dish:${first.dishColor}"></span>${escapeHtml(first.dishName)}</header>
          <div class="track">
            ${tasks.map((task) => timelineCard(task, startOffset, span, schedule.timezone)).join("")}
          </div>
        </section>`;
    })
    .join("");

  const agenda = schedule.tasks
    .map(
      (task) => `
        <li class="agenda-item" data-task-id="${escapeHtml(task.id)}" data-start="${escapeHtml(
          task.start,
        )}" data-end="${escapeHtml(task.end)}">
          <label>
            <input type="checkbox" data-check="${escapeHtml(task.id)}" />
            <span class="checkmark" aria-hidden="true"></span>
            <span class="agenda-time">${formatClock(new Date(task.start), schedule.timezone)}</span>
            <span class="agenda-copy">
              <strong>${escapeHtml(task.name)}</strong>
              <small><i style="--dish:${task.dishColor}"></i>${escapeHtml(task.dishName)} · ${
                task.duration
              } min · ${task.mode}</small>
              ${task.notes ? `<em>${escapeHtml(task.notes)}</em>` : ""}
            </span>
          </label>
        </li>`,
    )
    .join("");

  const warnings =
    schedule.warnings.length === 0
      ? ""
      : `<aside class="warnings" aria-label="Warnings"><strong>Heads up</strong><ul>${schedule.warnings
          .map((warning) => `<li>${escapeHtml(warning.message)}</li>`)
          .join("")}</ul></aside>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:" />
  <title>${escapeHtml(schedule.title)} · SimmerSync</title>
  <style>
    :root{color-scheme:dark;--ink:#f7f1e7;--muted:#b9b1a5;--panel:#171816;--line:#34352f;--accent:#ef7d57;--good:#78c091;--warn:#f4c95d;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    *{box-sizing:border-box}body{margin:0;background:#0e0f0d;color:var(--ink);min-height:100vh}
    body:before{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 15% 10%,rgba(239,125,87,.11),transparent 32rem),radial-gradient(circle at 85% 0,rgba(120,192,145,.08),transparent 28rem)}
    .shell{width:min(1180px,calc(100% - 32px));margin:auto;padding:42px 0 72px;position:relative}
    .top{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:end;border-bottom:1px solid var(--line);padding-bottom:28px}
    .eyebrow{margin:0 0 9px;color:var(--accent);font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:.72rem}
    h1{font-size:clamp(2.1rem,5vw,4.7rem);line-height:.95;letter-spacing:-.055em;margin:0;max-width:15ch}
    .serve{text-align:right}.serve span,.metric span{display:block;color:var(--muted);font-size:.74rem;text-transform:uppercase;letter-spacing:.1em}
    .serve strong{font-size:1.25rem}.serve time{display:block;color:var(--muted);margin-top:6px}
    .now{margin:26px 0;display:grid;grid-template-columns:1.5fr repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:18px;overflow:hidden}
    .now>div{background:var(--panel);padding:21px 22px;min-height:98px}.now-label{color:var(--accent);font-weight:800;text-transform:uppercase;font-size:.72rem;letter-spacing:.12em}
    #status-copy{display:block;font-size:1.22rem;margin-top:7px}.metric strong{display:block;font-size:1.35rem;margin-top:9px}
    h2{font-size:1.05rem;letter-spacing:-.01em;margin:36px 0 14px}.timeline{border:1px solid var(--line);border-radius:18px;padding:12px 16px;background:rgba(23,24,22,.82);overflow:auto}
    .axis{display:flex;justify-content:space-between;color:var(--muted);font-size:.72rem;padding:5px 0 12px;margin-left:150px}
    .lane{display:grid;grid-template-columns:140px minmax(700px,1fr);gap:10px;align-items:center;border-top:1px solid var(--line);min-height:82px}
    .lane header{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--dish);margin-right:9px}
    .track{height:58px;position:relative}.task{position:absolute;top:9px;height:40px;min-width:24px;border:1px solid color-mix(in srgb,var(--dish) 60%,#fff 8%);background:color-mix(in srgb,var(--dish) 19%,#171816);border-radius:8px;padding:5px 8px;overflow:hidden}
    .task.active{box-shadow:inset 3px 0 var(--dish)}.task b,.task small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.task b{font-size:.73rem}.task small{font-size:.64rem;color:var(--muted);margin-top:2px}
    .agenda{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:22px}.agenda-list{list-style:none;margin:0;padding:0;border:1px solid var(--line);border-radius:18px;overflow:hidden;background:rgba(23,24,22,.82)}
    .agenda-item+li{border-top:1px solid var(--line)}.agenda-item label{display:grid;grid-template-columns:24px 58px 1fr;align-items:start;gap:13px;padding:17px;cursor:pointer}.agenda-item input{position:absolute;opacity:0}.checkmark{width:21px;height:21px;border:1px solid #5e6058;border-radius:7px;margin-top:1px;position:relative}
    .agenda-item input:checked+.checkmark{background:var(--good);border-color:var(--good)}.agenda-item input:checked+.checkmark:after{content:"✓";position:absolute;color:#102316;font-weight:900;left:4px;top:-1px}
    .agenda-time{font-variant-numeric:tabular-nums;color:var(--muted);font-weight:750}.agenda-copy strong,.agenda-copy small,.agenda-copy em{display:block}.agenda-copy small{color:var(--muted);margin-top:3px}.agenda-copy small i{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--dish);margin-right:6px}.agenda-copy em{font-style:normal;color:#d6c9b9;font-size:.82rem;margin-top:8px}
    .agenda-item.is-now{background:rgba(239,125,87,.09);box-shadow:inset 3px 0 var(--accent)}.agenda-item.is-past:not(.is-now){opacity:.58}
    .side{display:flex;flex-direction:column;gap:14px}.card,.warnings{border:1px solid var(--line);border-radius:18px;padding:19px;background:rgba(23,24,22,.82)}.card dl{margin:0}.card div{display:flex;justify-content:space-between;gap:20px;padding:9px 0}.card div+div{border-top:1px solid var(--line)}.card dt{color:var(--muted)}.card dd{margin:0;font-weight:750}.warnings{border-color:#6b5a2a;color:#f7e4a4}.warnings strong{color:var(--warn)}.warnings ul{padding-left:19px;margin:10px 0 0}
    footer{color:var(--muted);font-size:.78rem;margin-top:28px;text-align:center}button{appearance:none;border:1px solid var(--line);background:#22231f;color:var(--ink);border-radius:10px;padding:9px 12px;font:inherit;cursor:pointer}button:hover{border-color:#77786e}
    @media(max-width:820px){.top{grid-template-columns:1fr}.serve{text-align:left}.now{grid-template-columns:1fr 1fr}.now>div:first-child{grid-column:1/-1}.agenda{grid-template-columns:1fr}.side{order:-1}.axis{margin-left:0}.lane{grid-template-columns:100px minmax(620px,1fr)}}
    @media print{body{background:#fff;color:#111}.shell{width:100%;padding:0}.top,.now,.timeline,.agenda-list,.card,.warnings{border-color:#bbb;background:#fff}.task{background:#eee;border-color:#777}button{display:none}.agenda-item.is-past{opacity:1}footer{color:#444}}
  </style>
</head>
<body>
  <main class="shell">
    <header class="top">
      <div><p class="eyebrow">SimmerSync · synchronized kitchen plan</p><h1>${escapeHtml(
        schedule.title,
      )}</h1></div>
      <div class="serve"><span>Serve at</span><strong>${formatClock(
        new Date(schedule.serveAt),
        schedule.timezone,
      )}</strong><time>${escapeHtml(
        formatDateTime(new Date(schedule.serveAt), schedule.timezone),
      )}</time></div>
    </header>
    <section class="now" aria-live="polite">
      <div><span class="now-label">Kitchen status</span><strong id="status-copy">Plan ready</strong></div>
      <div class="metric"><span>Countdown</span><strong id="countdown">—</strong></div>
      <div class="metric"><span>Total span</span><strong>${schedule.totalSpanMinutes} min</strong></div>
      <div class="metric"><span>Active work</span><strong>${schedule.totalActiveMinutes} min</strong></div>
    </section>
    <h2>One-glance timeline</h2>
    <div class="timeline">
      <div class="axis"><span>${formatClock(
        new Date(schedule.startAt),
        schedule.timezone,
      )}</span><span>${formatClock(new Date(schedule.serveAt), schedule.timezone)} serve</span></div>
      ${lanes}
    </div>
    <h2>Cook mode</h2>
    <div class="agenda">
      <ol class="agenda-list">${agenda}</ol>
      <div class="side">
        <section class="card">
          <dl>
            ${schedule.resources
              .slice(0, 5)
              .map(
                (resource) =>
                  `<div><dt>${escapeHtml(resource.label)}</dt><dd>${Math.round(
                    resource.utilization * 100,
                  )}%</dd></div>`,
              )
              .join("")}
          </dl>
        </section>
        ${warnings}
        <button id="reset" type="button">Reset completed steps</button>
      </div>
    </div>
    <footer>Generated locally by SimmerSync. No account, upload, or network request required.</footer>
  </main>
  <script type="application/json" id="schedule-data">${safeData}</script>
  <script>
    (() => {
      const data = JSON.parse(document.getElementById("schedule-data").textContent);
      const key = "simmersync:" + data.title + ":" + data.serveAt;
      const completed = new Set(JSON.parse(localStorage.getItem(key) || "[]"));
      const checks = [...document.querySelectorAll("[data-check]")];
      const rows = [...document.querySelectorAll("[data-task-id]")];
      for (const check of checks) {
        check.checked = completed.has(check.dataset.check);
        check.addEventListener("change", () => {
          check.checked ? completed.add(check.dataset.check) : completed.delete(check.dataset.check);
          localStorage.setItem(key, JSON.stringify([...completed]));
        });
      }
      document.getElementById("reset").addEventListener("click", () => {
        completed.clear(); localStorage.removeItem(key); for (const check of checks) check.checked = false;
      });
      const countdown = document.getElementById("countdown");
      const status = document.getElementById("status-copy");
      const serve = new Date(data.serveAt).getTime();
      function tick() {
        const now = Date.now();
        const minutes = Math.round((serve - now) / 60000);
        countdown.textContent = minutes > 0 ? minutes + " min" : minutes === 0 ? "Now" : Math.abs(minutes) + " min ago";
        let current = null, next = null;
        for (const row of rows) {
          const start = new Date(row.dataset.start).getTime(), end = new Date(row.dataset.end).getTime();
          row.classList.toggle("is-past", end <= now);
          row.classList.toggle("is-now", start <= now && end > now);
          if (start <= now && end > now) current = row;
          if (!next && start > now) next = row;
        }
        const chosen = current || next;
        status.textContent = chosen ? (current ? "Now · " : "Next · ") + chosen.querySelector("strong").textContent : now < serve ? "Everything is ready" : "Service complete";
      }
      tick(); setInterval(tick, 15000);
    })();
  </script>
</body>
</html>
`;
}

function timelineCard(
  task: ScheduledTask,
  startOffset: number,
  span: number,
  timezone?: string,
): string {
  const left = ((task.startOffset - startOffset) / span) * 100;
  const width = Math.max(0.8, ((task.endOffset - task.startOffset) / span) * 100);
  return `<div class="task ${task.mode}" title="${escapeHtml(
    `${task.name} · ${task.duration} min`,
  )}" style="--dish:${task.dishColor};left:${left.toFixed(3)}%;width:${width.toFixed(
    3,
  )}%"><b>${escapeHtml(task.name)}</b><small>${formatClock(
    new Date(task.start),
    timezone,
  )} · ${task.duration}m</small></div>`;
}
