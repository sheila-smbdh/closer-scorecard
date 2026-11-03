// Usage: node src/management.mjs <data.json> <outDir> [edition]
// Management view: every closer's card numbers on one page (same metrics and closer-facing targets as
// the cards, via closerMetrics + plan), team totals, and next month's plan. For Jay and Sheila, not closers.
// Writes out/<edition>-management.html + .png.

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { closerMetrics, withTeam, trackerFor, fmtMoney, PACE_LABEL } from './metrics.mjs';
import { plan } from './plan.mjs';
import { targetsFor, closerTargets, nextMonthKey, monthWeeks, daysIn } from './targets.mjs';

const [dataPath, outDir, edition = 'monthly'] = process.argv.slice(2);
if (!dataPath || !outDir) {
  console.error('usage: node src/management.mjs <data.json> <outDir> [monthly|monday|wednesday]');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const all = data.closers.map((c) => closerMetrics(data, c, edition));
const team = withTeam(all);
const rows = all.map((m) => ({ m, p: plan(data, m) }));
const ed = data.editions[edition];
const tr = trackerFor(data, ed);
const monthKey = tr.through.slice(0, 7);
const nk = nextMonthKey(monthKey);
const nShort = new Date(`${nk}-01T12:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const K = (v) => (v == null ? '–' : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : Math.abs(v) >= 1000 ? `$${Math.round(v / 1000)}K` : fmtMoney(v));
const pct = (v) => (v == null ? '–' : `${Math.round(v * 100)}%`);
const BAND = { ahead: 'hit', on_pace: 'hit', slightly_behind: 'almost', behind: 'missed' };

// Carded closers with a goal this month vs those without (new hires / promoted setters)
const goaled = rows.filter((r) => r.m.cash.monthTarget).sort((a, b) => b.m.cash.paceRatio - a.m.cash.paceRatio);
const noGoal = rows.filter((r) => !r.m.cash.monthTarget);
const sum = (xs, f) => xs.reduce((a, x) => a + (f(x) ?? 0), 0);
const teamCash = sum(goaled, (r) => r.m.cash.value);
const teamExpected = sum(goaled, (r) => r.m.cash.expected);
const teamGoal = sum(goaled, (r) => r.m.cash.monthTarget);
const teamCloses = sum(goaled, (r) => r.m.closes.actual);
const teamClosesTarget = sum(goaled, (r) => r.m.cash.closesTarget);
const allCash = sum(rows, (r) => r.m.cash.value);
const allCloses = sum(rows, (r) => r.m.closes.actual);
const counts = Object.fromEntries(Object.keys(PACE_LABEL).map((k) => [k, goaled.filter((r) => r.m.cash.pace === k).length]));
const final = edition === 'monthly';
const art = /^[AEIOU]/.test(data.month.label) ? 'an' : 'a';

const weeksHit = (p) => {
  const done = (p.weeks ?? []).filter((w) => w.phase === 'done');
  return { cash: done.filter((w) => w.hit.cash).length, closes: done.filter((w) => w.hit.closes).length, n: done.length };
};

const closerRow = (r) => {
  const { m, p } = r, c = m.cash, wh = weeksHit(p);
  const band = BAND[c.pace] ?? 'track';
  const nt = closerTargets(targetsFor(data, nk), m.closer.key);
  const s = m.slotsMtd;
  return `<tr>
  <td><div class="nm">${esc(m.closer.name ?? m.closer.short)}</div></td>
  <td class="num"><b>${K(c.value)}</b> <span class="of">/ ${K(final ? c.monthTarget : c.expected)}</span></td>
  <td><span class="chip ${band}">${pct(c.paceRatio)} · ${esc(PACE_LABEL[c.pace] ?? '–')}</span></td>
  <td class="num ${m.closes.actual >= c.closesTarget ? 'g' : ''}"><b>${m.closes.actual}</b> <span class="of">/ ${c.closesTarget}</span></td>
  <td class="num">${wh.n ? `${wh.cash}<span class="of">/${wh.n}</span>` : '–'}</td>
  <td class="num ${m.live.status}">${m.live.value}</td>
  <td class="num ${m.avgRevenue.status}">${K(m.avgRevenue.value)}</td>
  <td class="num ${s.status}">${s.value ?? '–'}${s.booked != null ? `<small>${s.booked} booked · ${s.open} open</small>` : ''}</td>
  <td class="num">${K(nt?.cash)}</td>
</tr>`;
};

const noGoalRow = (r) => {
  const { m } = r;
  const nt = closerTargets(targetsFor(data, nk), m.closer.key);
  return `<tr>
  <td><div class="nm">${esc(m.closer.name ?? m.closer.short)}</div></td>
  <td class="num"><b>${K(m.cash.value)}</b></td>
  <td class="num">${m.closes.actual}</td>
  <td class="num">${m.live.value}</td>
  <td class="num">${K(m.avgRevenue.value)}</td>
  <td class="num">${m.slotsMtd.value ?? '–'}</td>
  <td class="num">${K(nt?.cash)}</td>
</tr>`;
};

// Next month's plan, team level: sum of every closer's goal, split by the weekly shares
const nf = targetsFor(data, nk);
let nextHtml = '';
if (nf) {
  const [ny, nm] = nk.split('-').map(Number);
  const goals = Object.keys(nf.closers).map((k) => closerTargets(nf, k)).filter(Boolean);
  const nCash = sum(goals, (g) => g.cash), nCloses = sum(goals, (g) => g.closes);
  const weeks = monthWeeks(ny, nm - 1, daysIn(nk));
  const nLabel = new Date(Date.UTC(ny, nm - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  nextHtml = `<h2>${nLabel.toUpperCase()} PLAN · TEAM</h2>
<p class="note">${goals.length} closers, ${K(nCash)} cash goal, ${nCloses} closes. Each week's share comes from the closer-facing targets.</p>
<table class="plan"><tr><th>Week</th>${weeks.map((w) => `<th>${esc(w.label)}<small>${esc(w.dates)}</small></th>`).join('')}<th>Month</th></tr>
<tr><td class="lbl">Share</td>${weeks.map((_, i) => `<td class="num">${pct(nf.weeks[i])}</td>`).join('')}<td class="num">100%</td></tr>
<tr><td class="lbl">Cash</td>${weeks.map((_, i) => `<td class="num"><b>${K(nCash * nf.weeks[i])}</b></td>`).join('')}<td class="num"><b>${K(nCash)}</b></td></tr>
</table>`;
}

const throughDate = new Date(`${tr.through}T12:00:00Z`).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const teamBand = BAND[teamExpected ? (teamCash / teamExpected >= 1.05 ? 'ahead' : teamCash / teamExpected >= 0.97 ? 'on_pace' : teamCash / teamExpected >= 0.9 ? 'slightly_behind' : 'behind') : null] ?? 'track';

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
:root{--ink:#1d1f23;--muted:#5c6168;--line:#e3e1dc;--bg:#fafaf8;
--hit-bg:#e4f2e7;--hit:#24843a;--almost-bg:#fbf1cf;--almost:#d4a106;--almost-ink:#7d5f00;
--missed-bg:#f9e2e1;--missed:#c8423d;--track-bg:#e5ebf6;--track:#2d5bb8}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
.card{width:1280px;padding:40px 44px;background:var(--bg)}
.eyebrow{font-size:15px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:500}
h1{font-size:40px;font-weight:800;letter-spacing:-.01em;margin:10px 0 0}
h1 .thru{display:block;font-size:22px;font-weight:600;color:var(--muted);margin-top:6px}
h2{font-size:17px;letter-spacing:.1em;color:var(--track);font-weight:700;margin:32px 0 14px}
.hero{margin-top:24px;background:#0f0f0e;border-radius:16px;padding:26px;color:#fcf6e2;display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.caps{font-size:13px;letter-spacing:.12em;font-weight:700;text-transform:uppercase;color:rgba(252,246,226,.6)}
.big{font-family:Fraunces,Georgia,serif;font-size:48px;font-weight:800;color:#f0cd2b;line-height:1;margin-top:10px}
.big small{font-family:Inter,sans-serif;font-size:18px;font-weight:600;color:rgba(252,246,226,.6);margin-left:6px}
.sub{font-size:14px;color:rgba(252,246,226,.75);margin-top:8px;line-height:1.4}
.dist{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.chip{display:inline-block;font-size:13px;font-weight:700;letter-spacing:.03em;color:#fff;border-radius:999px;padding:5px 11px;white-space:nowrap}
.chip.hit{background:var(--hit)} .chip.almost{background:var(--almost);color:#3a2c00} .chip.missed{background:var(--missed)} .chip.track{background:var(--track)}
table{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:16px}
th{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:700;text-align:left;padding:12px 14px;background:#f4f2ee;vertical-align:bottom}
th small{display:block;font-weight:500;letter-spacing:0;text-transform:none;font-size:12px}
td{padding:11px 14px;border-top:1px solid var(--line);vertical-align:middle}
td.num{font-variant-numeric:tabular-nums;white-space:nowrap}
td b{font-size:19px;font-weight:800}
td .of{color:var(--muted);font-weight:600}
td small{display:block;font-size:12px;color:var(--muted);margin-top:2px}
td.hit,td.g{color:var(--hit);font-weight:700} td.almost{color:var(--almost-ink);font-weight:700} td.missed{color:var(--missed);font-weight:700}
.nm{font-weight:700}
tr.tot td{background:#f4f2ee;border-top:2px solid var(--ink);font-weight:700}
td.lbl{font-weight:700;color:var(--muted);text-transform:uppercase;font-size:12px;letter-spacing:.08em}
.note{font-size:15px;color:#3d4248;margin:-4px 0 12px}
.foot{font-size:13px;color:var(--muted);margin-top:22px;line-height:1.5}
</style></head><body><div class="card">
<div class="eyebrow">Management view · not sent to closers</div>
<h1>${esc(data.month.label)} closer scorecards${final ? ', final' : ''}<span class="thru">through ${esc(throughDate)}</span></h1>

<h2>CLOSERS WITH ${art.toUpperCase()} ${esc(data.month.label.toUpperCase())} GOAL · RANKED BY % OF ${final ? 'GOAL' : 'PACE'}</h2>
<table>
<tr><th>Closer</th><th>Cash<small>collected / ${final ? 'month goal' : 'goal to date'}</small></th><th>% of ${final ? 'goal' : 'pace'}</th><th>Closes<small>/ target</small></th><th>Cash weeks hit<small>misses carried forward</small></th><th>Live calls<small>vs median ${team.live}</small></th><th>Avg revenue<small>floor $17.5K</small></th><th>Avg weekly slots<small>target 35</small></th><th>${esc(nShort)} goal</th></tr>
${goaled.map(closerRow).join('\n')}
<tr class="tot"><td>Team</td><td class="num"><b>${K(teamCash)}</b> <span class="of">/ ${K(final ? teamGoal : teamExpected)}</span></td><td>${pct(teamExpected ? teamCash / teamExpected : null)}</td><td class="num"><b>${teamCloses}</b> <span class="of">/ ${teamClosesTarget}</span></td><td></td><td class="num">${sum(goaled, (r) => r.m.live.value)}</td><td class="num">${K(sum(goaled, (r) => r.m.avgRevenue.rev) / (teamCloses || 1))}</td><td></td><td class="num">${K(sum(goaled, (r) => closerTargets(nf, r.m.closer.key)?.cash))}</td></tr>
</table>

${noGoal.length ? `<h2>NEW HIRES AND PROMOTED SETTERS · NO ${esc(data.month.label.toUpperCase())} GOAL</h2>
<table>
<tr><th>Closer</th><th>Cash collected</th><th>Closes</th><th>Live calls</th><th>Avg revenue</th><th>Avg weekly slots</th><th>Next month goal</th></tr>
${noGoal.map(noGoalRow).join('\n')}
</table>` : ''}

${final ? nextHtml : ''}

<div class="foot">Same numbers as the closer cards: cash from the 2M tracker read API (pulled ${esc(tr.data_pulled_at?.slice(0, 16).replace('T', ' '))} UTC, all checks ${tr.all_checks_pass ? 'pass' : 'FAILED'}); goals and weekly split from Sheila's closer-facing targets (${esc(monthKey)} goals = ${esc(nk)} goals), not the tracker's management targets. Closes = Close 1 from the Sales Tracker; closes target = goal ÷ $17,500. Live calls = showed, EOD Tracker with Sales Tracker fills. Slots = Messi's next-7-days post + Calendly booked calls, averaged over the month's posts${data.messi_slots_from ? ` from ${esc(data.messi_slots_from)}` : ''}.</div>
</div></body></html>`;

fs.mkdirSync(outDir, { recursive: true });
const name = `${edition}-management`;
fs.writeFileSync(path.join(outDir, `${name}.html`), html);
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1280, height: 900 } });
await page.setContent(html, { waitUntil: 'load' });
await page.locator('.card').screenshot({ path: path.join(outDir, `${name}.png`) });
await browser.close();
console.log('wrote', name);
