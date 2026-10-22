// HTML templates for the closer card and the Monday leadership table.
// The card is built around pacing: the pace tracker on top (cash vs pace by today vs the team
// median), then "How the week went" (the inputs a closer controls: open slots, live calls,
// average revenue, projected vs actual closes) and "Where we're headed" (upcoming slots and
// on track / off pace against the month target). Tiles: green hit, yellow 75%+, red missed, blue tracked.

import { fmtPct, fmtMoney } from './metrics.mjs';

const CHIP = { hit: 'HIT', almost: 'ALMOST', missed: 'MISSED', track: 'TRACKING' };
const PACE_CHIP = { hit: 'ON PACE', almost: 'SLIGHTLY BEHIND', missed: 'OFF PACE', track: 'NO TARGET YET' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const num = (v) => (v == null ? '–' : Number.isInteger(v) ? String(v) : v.toFixed(1));

const CSS = `
:root{--ink:#1d1f23;--muted:#5c6168;--line:#e3e1dc;--bg:#fafaf8;
--hit-bg:#e4f2e7;--hit:#24843a;--almost-bg:#fbf1cf;--almost:#d4a106;--almost-ink:#7d5f00;
--missed-bg:#f9e2e1;--missed:#c8423d;--track-bg:#e5ebf6;--track:#2d5bb8}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
.card{width:1080px;padding:40px 44px 36px;background:var(--bg)}
.eyebrow{font-size:15px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:500}
h1{font-size:40px;font-weight:800;letter-spacing:-.01em;margin:10px 0 8px}
.lede{font-size:19px;color:var(--muted)}
.section{margin-top:30px}
.section h2{font-size:17px;letter-spacing:.1em;color:var(--track);font-weight:700;margin-bottom:6px}
.section p.key{font-size:16px;color:var(--muted);line-height:1.45;margin-bottom:14px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.grid.two{grid-template-columns:repeat(2,1fr)}
.tile{border-radius:12px;border-left:6px solid;padding:16px 18px 14px;display:flex;flex-direction:column;min-height:228px}
.grid.two .tile{min-height:190px}
.tile.hit{background:var(--hit-bg);border-color:var(--hit)} .tile.hit .v{color:var(--hit)}
.tile.almost{background:var(--almost-bg);border-color:var(--almost)} .tile.almost .v{color:var(--almost-ink)}
.tile.missed{background:var(--missed-bg);border-color:var(--missed)} .tile.missed .v{color:var(--missed)}
.tile.track{background:var(--track-bg);border-color:var(--track)} .tile.track .v{color:var(--track)}
.tile .l{font-size:14px;letter-spacing:.08em;font-weight:700;text-transform:uppercase}
.tile .v{font-size:38px;font-weight:800;margin:6px 0 4px;letter-spacing:-.01em}
.tile .v .of{font-size:24px;font-weight:700;opacity:.75}
.tile .s{font-size:15px;color:#3d4248;line-height:1.35}
.tile .small{font-size:13px;color:var(--muted);line-height:1.35;margin-top:6px}
.tile .warn{font-size:13px;color:var(--missed);font-weight:600;margin-top:6px}
.tile .foot{margin-top:auto;padding-top:10px}
.bar{position:relative;height:8px;background:rgba(0,0,0,.07);border-radius:4px;margin-bottom:10px}
.bar i{position:absolute;left:0;top:0;bottom:0;border-radius:4px}
.bar b{position:absolute;top:-5px;width:3px;height:18px;background:var(--ink);border-radius:1px}
.hit .bar i{background:var(--hit)} .almost .bar i{background:var(--almost)} .missed .bar i{background:var(--missed)} .track .bar i{background:var(--track)}
.row{display:flex;justify-content:space-between;align-items:center;font-size:14px;color:#3d4248}
.chip{font-size:12px;font-weight:700;letter-spacing:.05em;color:#fff;border-radius:999px;padding:4px 10px;white-space:nowrap}
.hit .chip{background:var(--hit)} .almost .chip{background:var(--almost);color:#3a2c00} .missed .chip{background:var(--missed)} .track .chip{background:var(--track)}
/* pace tracker */
.pace{margin-top:26px;background:#fff;border:1px solid var(--line);border-top:6px solid;border-radius:14px;padding:22px 26px 20px}
.pace.hit{border-top-color:var(--hit)} .pace.almost{border-top-color:var(--almost)} .pace.missed{border-top-color:var(--missed)} .pace.track{border-top-color:var(--track)}
.pace-head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
.pace .l{font-size:14px;letter-spacing:.08em;font-weight:700;text-transform:uppercase;color:var(--muted)}
.pace .big{font-size:52px;font-weight:800;letter-spacing:-.02em;margin:4px 0 2px}
.pace .big span{font-size:22px;font-weight:700;color:var(--muted)}
.pace.hit .big{color:var(--hit)} .pace.almost .big{color:var(--almost-ink)} .pace.missed .big{color:var(--missed)} .pace.track .big{color:var(--track)}
.pace .s{font-size:16px;color:#3d4248;line-height:1.4;max-width:720px}
.pace .chip{font-size:14px;padding:6px 14px;margin-top:4px}
.ptrack{position:relative;height:22px;background:#eeece7;border-radius:11px;margin:26px 0 0}
.ptrack i{position:absolute;left:0;top:0;bottom:0;border-radius:11px}
.pace.hit .ptrack i{background:var(--hit)} .pace.almost .ptrack i{background:var(--almost)} .pace.missed .ptrack i{background:var(--missed)} .pace.track .ptrack i{background:var(--track)}
.ptrack b{position:absolute;top:-7px;width:4px;height:36px;margin-left:-2px;border-radius:2px}
.ptrack b.mk-pace{background:var(--ink)} .ptrack b.mk-team{background:var(--track)}
.plabels{position:relative;height:46px;margin-top:6px;font-size:13px;color:var(--muted)}
.plabels span{position:absolute;transform:translateX(-50%);text-align:center;white-space:nowrap;line-height:1.3}
.plabels span b{display:block;font-size:15px;color:var(--ink)}
.plabels span.mk-team b{color:var(--track)}
.plabels span.end{right:0;transform:none;text-align:right}
.pstats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:14px;padding-top:16px;border-top:1px solid var(--line)}
.pstats .l{font-size:12.5px}
.pstats .v{font-size:28px;font-weight:800;margin:4px 0 2px}
.pstats .s{font-size:14px;color:var(--muted)}
.footer{margin-top:28px;padding-top:16px;border-top:1px solid var(--line);font-size:13.5px;line-height:1.55;color:var(--muted)}
/* leadership table */
.wide{width:1500px}
table{border-collapse:separate;border-spacing:0 6px;width:100%;font-size:15px}
th{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-align:left;padding:4px 10px;font-weight:700;vertical-align:bottom}
th.grp{color:var(--track);border-bottom:2px solid var(--track);padding-bottom:6px}
td{padding:11px 10px;background:#fff;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
td:first-child{border-left:1px solid var(--line);border-radius:10px 0 0 10px;font-weight:700}
td:last-child{border-right:1px solid var(--line);border-radius:0 10px 10px 0}
td.hit{background:var(--hit-bg);color:var(--hit);font-weight:700}
td.almost{background:var(--almost-bg);color:var(--almost-ink);font-weight:700}
td.missed{background:var(--missed-bg);color:var(--missed);font-weight:700}
td.track{background:var(--track-bg);color:var(--track);font-weight:600}
td small{display:block;font-size:12px;font-weight:500;color:var(--muted)}
tr.total td{background:#f1efea;font-weight:800}
.legend{display:flex;gap:18px;font-size:14px;color:var(--muted);margin:14px 0 4px}
.legend span::before{content:"";display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px;background:var(--c)}
`;

function bar(value, target) {
  if (target == null || value == null) return '';
  const max = Math.max(target, value) / 0.85;
  return `<div class="bar"><i style="width:${Math.min(100, (value / max) * 100)}%"></i><b style="left:${(target / max) * 100}%"></b></div>`;
}

function tile({ label, value, sub, small, warn, statusKey, bar: barHtml = '', targetText, chip }) {
  return `<div class="tile ${statusKey}">
  <div class="l">${label}</div><div class="v">${value}</div>
  ${sub ? `<div class="s">${sub}</div>` : ''}${small ? `<div class="small">${small}</div>` : ''}${warn ? `<div class="warn">${warn}</div>` : ''}
  <div class="foot">${barHtml}<div class="row"><span>${targetText}</span><span class="chip">${chip ?? CHIP[statusKey]}</span></div></div>
</div>`;
}

function page(body, width) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Closer Scorecard</title><style>${CSS}</style></head><body><div class="card ${width === 'wide' ? 'wide' : ''}">${body}</div></body></html>`;
}

// Month track from $0 to the month target: cash so far (fill), pace by today and the team median (markers)
function paceTracker(m, month) {
  const c = m.cash;
  if (!c.monthTarget) {
    return `<div class="pace track"><div class="pace-head"><div><div class="l">Pace tracker · ${month.label} cash collected</div>
<div class="big">${fmtMoney(c.value, true)}</div><div class="s">Collected this month. Your month target is coming.</div></div>
<span class="chip">${PACE_CHIP.track}</span></div></div>`;
  }
  const max = Math.max(c.monthTarget, c.value ?? 0);
  const at = (v) => `${Math.min(100, (v / max) * 100).toFixed(2)}%`;
  // Team median as cash on this closer's curve: median % of pace × this closer's pace by today
  const teamCash = m.team.pace != null ? m.team.pace * c.expected : null;
  const marks = [
    [c.expected, 'mk-pace', `Pace by ${m.ed.through}<b>${fmtMoney(c.expected, true)}</b>`],
    teamCash != null ? [teamCash, 'mk-team', `Team median<b>${fmtMoney(teamCash, true)}</b>`] : null,
  ].filter(Boolean);
  const gap = (c.value ?? 0) - c.expected;
  return `<div class="pace ${c.status}">
<div class="pace-head">
  <div><div class="l">Pace tracker · ${month.label} cash collected</div>
  <div class="big">${fmtPct(c.paceRatio)} <span>of pace</span></div>
  <div class="s">${fmtMoney(c.value, true)} collected vs ${fmtMoney(c.expected, true)} expected by ${m.ed.through}: ${gap >= 0 ? `${fmtMoney(gap, true)} ahead` : `${fmtMoney(-gap, true)} behind`}. The team median is ${fmtPct(m.team.pace)} of pace.</div></div>
  <span class="chip">${PACE_CHIP[c.status]}</span>
</div>
<div class="ptrack"><i style="width:${at(c.value ?? 0)}"></i>${marks.map(([v, cls]) => `<b class="${cls}" style="left:${at(v)}"></b>`).join('')}</div>
<div class="plabels">${marks.map(([v, cls, t]) => `<span class="${cls}" style="left:${at(v)}">${t}</span>`).join('')}<span class="end">Month target<b>${fmtMoney(c.monthTarget, true)}</b></span></div>
<div class="pstats">
  <div><div class="l">Where you are</div><div class="v">${fmtMoney(c.value, true)}</div><div class="s">${fmtPct((c.value ?? 0) / c.monthTarget)} of your month target</div></div>
  <div><div class="l">Where you should be</div><div class="v">${fmtMoney(c.expected, true)}</div><div class="s">Expected by ${m.ed.through}</div></div>
  <div><div class="l">Team median</div><div class="v">${fmtPct(m.team.pace)}</div><div class="s">of pace, fully ramped closers</div></div>
  <div><div class="l">Month end at this pace</div><div class="v">${fmtMoney(c.projectedFinish, true)}</div><div class="s">${fmtPct(c.projectedFinish / c.monthTarget)} of ${fmtMoney(c.monthTarget, true)}</div></div>
</div></div>`;
}

export function closerCard(m, month) {
  const monday = m.edition === 'monday';
  const name = m.closer.short;
  const t = m.team;
  const when = monday ? 'last week' : 'this week so far';

  // How the week went: the inputs behind the pace
  const sw = m.slotsWeek;
  const slotsWeekTile = tile({
    label: 'Open slots', value: sw.value ?? '–', statusKey: sw.status,
    sub: sw.value == null ? 'Not set up as a discovery host in Calendly yet' : `Average open discovery slots ${when} (lowest day ${sw.low})`,
    small: t.slotsWeek != null ? `Team median ${Math.round(t.slotsWeek)}` : null,
    bar: bar(sw.value, sw.target), targetText: 'Target 25',
  });
  const lv = m.live;
  const liveTile = tile({
    label: 'Live calls, month to date', value: lv.value, statusKey: lv.status,
    sub: `${plural(lv.week, 'live call')} ${when}, out of ${lv.booked} booked`,
    small: m.newHire ? 'Compared with the team once you are ramped' : null,
    bar: bar(lv.value, lv.target), targetText: lv.target == null ? 'No target yet' : `Team median ${num(lv.target)}`,
  });
  const ar = m.avgRevenue;
  const avgTile = tile({
    label: 'Average revenue', value: ar.value == null ? '–' : fmtMoney(ar.value), statusKey: ar.status,
    sub: ar.closes ? `${fmtMoney(ar.rev)} revenue generated over ${plural(ar.closes, 'close')} this month` : 'No closes yet this month',
    small: t.avgRevenue != null ? `Team median ${fmtMoney(t.avgRevenue)}` : null,
    bar: bar(ar.value, ar.target), targetText: 'Target $17,500',
  });
  const cl = m.closes;
  const pl = cl.pipeline;
  const closesTile = tile({
    label: 'Closes: actual vs projected', value: cl.projected == null ? `${cl.actual}` : `${cl.actual} <span class="of">/ ${cl.projected}</span>`,
    statusKey: cl.status,
    sub: pl ? `${plural(cl.actual, 'close')} so far, ${cl.projected} projected by month end` : `${plural(cl.actual, 'close')} so far. No pipeline tab yet`,
    small: pl ? `Pipeline: <b>${pl.hc}</b> High Confidence · <b>${pl.sv}</b> Soft Verbal · <b>${pl.working}</b> Working${cl.lastWeek
      ? `<br>Last week: ${cl.lastWeek.won} of ${cl.lastWeek.projected} projected closed or signed` : ''}` : null,
    warn: pl?.nonstandard ? `${pl.nonstandard} leads need a status` : null,
    bar: bar(cl.projected, cl.needed),
    targetText: cl.needed == null ? 'No target yet' : `${cl.needed} needed for target`,
  });

  // Where we're headed: next 7 days of slots, and on track / off pace against the month target
  const sl = m.slots;
  const cal = m.calendar;
  const upcomingTile = tile({
    label: 'Upcoming slot availability', value: sl.value ?? '–', statusKey: sl.status,
    sub: sl.value == null ? 'Not set up as a discovery host in Calendly yet' : 'Open discovery slots in Calendly over the next 7 days',
    small: cal ? `Calendar open till <b>${cal.label}</b>${cal.away ? `<br>Away (${esc(cal.away.away)}). Open evening slots when back in ${esc(cal.away.back_label)}.` : ''}` : null,
    warn: cal?.closesEarly && !cal.away ? 'Closes by 5pm ET most days: open later slots' : null,
    bar: bar(sl.value, sl.target), targetText: 'Target 25',
  });
  const c = m.cash;
  const targetTile = !c.monthTarget ? tile({
    label: 'Monthly target', value: '–', statusKey: 'track', sub: 'Your month target is coming', targetText: '', chip: PACE_CHIP.track,
  }) : tile({
    label: 'Monthly target', value: fmtMoney(c.monthTarget, true), statusKey: c.status,
    sub: c.remaining ? `${fmtMoney(c.remaining, true)} to go in ${plural(c.daysLeft, 'business day')}` : 'Target reached',
    small: c.remaining ? `About <b>${cl.stillNeeded}</b> more closes at $17.5K each. ${pl
      ? `Your pipeline has <b>${pl.hc + pl.sv}</b> High Confidence + Soft Verbal leads; at 80% / 50% that is about <b>${cl.projected - cl.actual}</b> closes.`
      : 'No pipeline tab yet.'}` : null,
    targetText: `Month end at this pace: ${fmtMoney(c.projectedFinish, true)}`, chip: PACE_CHIP[c.status],
  });

  const lede = `${c.monthTarget ? `${fmtPct(c.paceRatio)} of pace (team median ${fmtPct(t.pace)})` : `${fmtMoney(c.value, true)} collected`} · ${plural(lv.value, 'live call')} this month · ${plural(cl.actual, 'close')}${cl.projected != null ? `, ${cl.projected} projected` : ''}`;

  const body = `
<div class="eyebrow">Closer scorecard · ${monday ? 'Week in review' : 'Midweek check-in'}</div>
<h1>${esc(name)}'s ${monday ? 'week' : 'week so far'}: ${m.ed.week_label}</h1>
<div class="lede">${lede}</div>
${paceTracker(m, month)}
<div class="section"><h2>HOW THE WEEK WENT</h2>
<p class="key">The inputs you control that drive your pace. Green: on target. Yellow: close (75% of it or more). Red: below. The black line on each bar is the target; live calls are measured against the team median.</p>
<div class="grid">${slotsWeekTile}${liveTile}${avgTile}${closesTile}</div></div>
<div class="section"><h2>WHERE WE'RE HEADED</h2>
<p class="key">What the rest of ${month.label} needs from you.</p>
<div class="grid two">${upcomingTile}${targetTile}</div></div>
<div class="footer">From the EOD Tracker, the Sales Tracker 2026 (Inputs tab), the Pipeline Review sheet, the 2M tracker, Close and Calendly, times in ET. ${c.source === 'tracker' ? 'Pace: cash collected vs what the 2M tracker expects by this day on its month curve, which is back-loaded (more cash lands late in the month); month end at this pace = % of pace × month target.' : 'Pace: month target × business days so far ÷ business days in the month (provisional).'} Team median: the middle value among fully ramped closers. Open slots: discovery start times Calendly offers over the next 7 days; the week figure averages each day's count. Live calls: calls that showed, from your EOD reports (Sales Tracker for any day without one). Average revenue: revenue generated ÷ closes, month to date. Projected closes: closes so far + 80% of open High Confidence + 50% of open Soft Verbal / Reengaged leads in your current-month pipeline; Working is shown, not counted. Closes needed: month target ÷ $17,500.</div>`;
  return page(body);
}

export function leadershipTable(rows, data, team) {
  const ed = data.editions.monday;
  const cell = (st, main, sub) => `<td class="${st}">${main}${sub ? `<small>${sub}</small>` : ''}</td>`;
  const body = rows.map((m) => {
    const c = m.cash, cl = m.closes, pl = cl.pipeline;
    return `<tr><td>${esc(m.closer.short)}${m.newHire ? '<small>new hire</small>' : ''}</td>
${cell(c.status, c.monthTarget ? fmtPct(c.paceRatio) : '–', c.monthTarget ? `${fmtMoney(c.value, true)} vs ${fmtMoney(c.expected, true)}` : 'no target yet')}
${cell(c.status, c.monthTarget ? fmtMoney(c.projectedFinish, true) : '–', c.monthTarget ? `of ${fmtMoney(c.monthTarget, true)}` : '')}
${cell(m.slotsWeek.status, m.slotsWeek.value ?? '–', m.slotsWeek.value == null ? 'not a host' : 'daily avg last week')}
${cell(m.live.status, m.live.value, `${m.live.week} last week`)}
${cell(m.avgRevenue.status, m.avgRevenue.value == null ? '–' : fmtMoney(m.avgRevenue.value), `${plural(m.avgRevenue.closes, 'close')} MTD`)}
${cell(cl.status, cl.projected == null ? cl.actual : `${cl.actual} / ${cl.projected}`, pl ? `${pl.hc} HC · ${pl.sv} SV · ${pl.working} W${pl.nonstandard ? ` · ${pl.nonstandard} untagged` : ''}${cl.needed ? ` · ${cl.needed} needed` : ''}` : 'no tab')}
${cell(m.slots.status, m.slots.value ?? '–', m.slots.value == null ? 'not a host' : m.calendar ? `till ${m.calendar.usualText}` : 'next 7 days')}</tr>`;
  }).join('');

  const median = `<tr class="total"><td>Team median<small>fully ramped</small></td><td>${fmtPct(team.pace)}</td><td>–</td><td>${num(team.slotsWeek)}</td><td>${num(team.live)}</td><td>${fmtMoney(team.avgRevenue)}</td><td>${num(team.closes)}<small>closes MTD</small></td><td>${num(team.slots)}</td></tr>`;

  const html = `
<div class="eyebrow">Closer scorecard · Leadership view</div>
<h1>Team pace: ${ed.week_label}</h1>
<div class="lede">What each closer sees on their card, in one table. Sent ${ed.date}, 8:00am ET.</div>
<div class="legend"><span style="--c:var(--hit)">On target / on pace</span><span style="--c:var(--almost)">Close (75%+) / slightly behind</span><span style="--c:var(--missed)">Below / off pace</span><span style="--c:var(--track)">Tracked, no target</span></div>
<table><thead>
<tr><th></th><th class="grp" colspan="2">Pace</th><th class="grp" colspan="4">How the week went</th><th class="grp">Where we're headed</th></tr>
<tr><th>Closer</th><th>% of pace<br>cash vs pace</th><th>Month end<br>at this pace</th><th>Open slots<br>target 25</th><th>Live calls MTD<br>vs team median</th><th>Avg revenue<br>target $17.5K</th><th>Closes<br>actual / projected</th><th>Upcoming slots<br>next 7 days</th></tr></thead>
<tbody>${body}${median}</tbody></table>
<div class="footer">Week = Monday to Sunday. Month to date runs Oct 1 to ${ed.through}. ${data.tracker?.through?.slice(5) === ed.through_key ? 'Pace comes from the 2M tracker: each closer\'s month target and expected cash by this day on its back-loaded month curve; month end at this pace = % of pace × month target.' : 'Pace uses a provisional $200K monthly target for every fully ramped closer until per-closer targets are connected from the tracker.'} Open slots (week) average Messi's daily next-7-days Calendly counts posted that week; upcoming slots are today's count. Projected closes = closes so far + 80% of open High Confidence + 50% of open Soft Verbal / Reengaged leads in each closer's ${data.month.label} pipeline tab; "needed" = month target ÷ $17,500; "untagged" = open leads with a blank or non-standard status.</div>`;
  return page(html, 'wide');
}
