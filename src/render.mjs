// HTML templates for the closer card and the Monday leadership table.
// Layout follows the setter "day card" sample: header, Wins / Fixes, a grid of
// target tiles (green hit, yellow 75%+, red missed, blue tracked), then pace,
// month over month and a definitions footer.

import { winsAndFixes, fmtPct, fmtMoney, TARGETS } from './metrics.mjs';

const CHIP = { hit: 'HIT', almost: 'ALMOST', missed: 'MISSED', track: 'TRACKING' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
.wf{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:28px}
.box{border-radius:14px;padding:22px 24px}
.box h3{font-size:15px;letter-spacing:.1em;font-weight:700;margin-bottom:12px}
.wins{background:var(--hit-bg)} .wins h3{color:var(--hit)}
.fixes{background:var(--missed-bg)} .fixes h3{color:var(--missed)}
.box ol{padding-left:22px;font-size:17px;line-height:1.45} .box li{margin-bottom:8px}
.box .none{font-size:17px;color:var(--muted)}
.section{margin-top:30px}
.section h2{font-size:17px;letter-spacing:.1em;color:var(--track);font-weight:700;margin-bottom:6px}
.section p.key{font-size:16px;color:var(--muted);line-height:1.45;margin-bottom:14px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.tile{border-radius:12px;border-left:6px solid;padding:16px 18px 14px;display:flex;flex-direction:column;min-height:228px}
.tile.hit{background:var(--hit-bg);border-color:var(--hit)} .tile.hit .v{color:var(--hit)}
.tile.almost{background:var(--almost-bg);border-color:var(--almost)} .tile.almost .v{color:var(--almost-ink)}
.tile.missed{background:var(--missed-bg);border-color:var(--missed)} .tile.missed .v{color:var(--missed)}
.tile.track{background:var(--track-bg);border-color:var(--track)} .tile.track .v{color:var(--track)}
.tile .l{font-size:14px;letter-spacing:.08em;font-weight:700;text-transform:uppercase}
.tile .v{font-size:38px;font-weight:800;margin:6px 0 4px;letter-spacing:-.01em}
.tile .s{font-size:15px;color:#3d4248;line-height:1.35}
.tile .small{font-size:13px;color:var(--muted);line-height:1.35;margin-top:6px}
.tile .warn{font-size:13px;color:var(--missed);font-weight:600;margin-top:6px}
.tile .foot{margin-top:auto;padding-top:10px}
.bar{position:relative;height:8px;background:rgba(0,0,0,.07);border-radius:4px;margin-bottom:10px}
.bar i{position:absolute;left:0;top:0;bottom:0;border-radius:4px}
.bar b{position:absolute;top:-5px;width:3px;height:18px;background:var(--ink);border-radius:1px}
.hit .bar i{background:var(--hit)} .almost .bar i{background:var(--almost)} .missed .bar i{background:var(--missed)}
.row{display:flex;justify-content:space-between;align-items:center;font-size:14px;color:#3d4248}
.chip{font-size:12px;font-weight:700;letter-spacing:.05em;color:#fff;border-radius:999px;padding:4px 10px}
.hit .chip{background:var(--hit)} .almost .chip{background:var(--almost);color:#3a2c00} .missed .chip{background:var(--missed)} .track .chip{background:var(--track)}
.pace{display:grid;grid-template-columns:repeat(7,1fr);gap:10px;align-items:end;height:190px;position:relative;
  border-bottom:1px solid var(--line);margin-top:6px}
.pace .col{position:relative;height:100%}
.pace .slotbox{position:absolute;bottom:0;left:16%;right:16%;border:2.5px dashed #8a8f96;border-bottom:none;border-radius:6px 6px 0 0}
.pace .slotbox.future{border-color:#c9ccd0}
.pace .booked{position:absolute;bottom:0;left:26%;right:26%;border-radius:4px 4px 0 0;opacity:.45}
.pace .showed{position:absolute;bottom:0;left:26%;right:26%;border-radius:4px 4px 0 0}
.pace .hit .booked,.pace .hit .showed{background:var(--hit)} .pace .almost .booked,.pace .almost .showed{background:var(--almost)}
.pace .missed .booked,.pace .missed .showed{background:var(--missed)} .pace .track .booked,.pace .track .showed{background:var(--track)}
.daykey{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--muted);margin-bottom:10px}
.daykey span{display:inline-block;width:16px;height:12px;border-radius:2px;margin-left:10px}
.daykey .kbox{border:2px dashed #8a8f96;margin-left:0} .daykey .kbook{background:#999;opacity:.45} .daykey .kshow{background:#555}
.days .dn{font-size:14px;color:var(--muted)} .days .dv{font-size:14px;font-weight:700;color:var(--ink);margin-top:2px}
.k-s{color:#6b7076} .k-b{color:var(--ink)} .k-w{color:var(--ink)}
.days{display:grid;grid-template-columns:repeat(7,1fr);gap:10px;text-align:center;font-size:14px;color:var(--muted);margin-top:6px}
.verdict{display:flex;gap:16px;align-items:center;margin-bottom:12px;font-size:17px}
.mom{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.mom>div{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.mom .l{font-size:14px;color:var(--muted);font-weight:600}
.mom .v{font-size:26px;font-weight:800;margin:4px 0}
.mom .d{font-size:14px;font-weight:700} .up{color:var(--hit)} .down{color:var(--missed)} .flat{color:var(--muted)}
.footer{margin-top:28px;padding-top:16px;border-top:1px solid var(--line);font-size:13.5px;line-height:1.55;color:var(--muted)}
/* leadership table */
.wide{width:1500px}
table{border-collapse:separate;border-spacing:0 6px;width:100%;font-size:15px}
th{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-align:left;padding:4px 10px;font-weight:700;vertical-align:bottom}
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

function tile({ label, value, sub, small, warn, statusKey, bar: barHtml = '', targetText }) {
  return `<div class="tile ${statusKey}">
  <div class="l">${label}</div><div class="v">${value}</div>
  ${sub ? `<div class="s">${sub}</div>` : ''}${small ? `<div class="small">${small}</div>` : ''}${warn ? `<div class="warn">${warn}</div>` : ''}
  <div class="foot">${barHtml}<div class="row"><span>${targetText}</span><span class="chip">${CHIP[statusKey]}</span></div></div>
</div>`;
}

function page(body, width) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Closer Scorecard</title><style>${CSS}</style></head><body><div class="card ${width === 'wide' ? 'wide' : ''}">${body}</div></body></html>`;
}

export function closerCard(m, month) {
  const monday = m.edition === 'monday';
  const name = m.closer.short;
  const { wins, fixes } = winsAndFixes(m);
  const ol = (items, empty) => (items.length
    ? `<ol>${items.map(([k, t]) => `<li><b>${esc(k)}:</b> ${esc(t)}</li>`).join('')}</ol>`
    : `<div class="none">${empty}</div>`);

  const calls = m.calls;
  const callsTile = tile({
    label: 'Booked calls', value: calls.value, statusKey: calls.status,
    sub: monday ? `${calls.value} calls booked on your calendar last week` : `${calls.value} booked so far this week`,
    small: monday ? null : (calls.weekTarget ? `On pace for about ${calls.projected} by Friday (target ${calls.weekTarget})` : null),
    bar: bar(calls.value, calls.target),
    targetText: calls.target == null ? 'New-hire target coming' : monday ? `Target ${calls.target}` : `Pace by today ${calls.target}`,
  });
  const sr = m.showRate;
  const showTile = tile({
    label: 'Show rate', value: fmtPct(sr.value), statusKey: sr.status,
    sub: `${sr.live} of ${sr.booked} booked calls showed up`, bar: bar(sr.value, sr.target), targetText: 'Target 80%',
  });
  const sl = m.slots;
  const cal = m.calendar;
  const slotTile = tile({
    label: 'Open slots', value: sl.value ?? '–', statusKey: sl.status,
    sub: sl.value == null ? 'Not set up as a discovery host in Calendly yet' : 'Discovery start times open in Calendly over the next 7 days',
    small: cal ? `Calendar open till <b>${cal.label}</b>` : null,
    warn: cal?.closesEarly ? 'Closes by 5pm ET most days' : null,
    bar: bar(sl.value, sl.target), targetText: 'Target 25',
  });
  const ar = m.avgRevenue;
  const avgTile = tile({
    label: 'Average revenue', value: ar.value == null ? '–' : fmtMoney(ar.value), statusKey: ar.status,
    sub: ar.closes ? `${fmtMoney(ar.rev)} revenue generated over ${ar.closes} close${ar.closes > 1 ? 's' : ''} this month` : 'No closes yet this month',
    bar: bar(ar.value, ar.target), targetText: 'Floor $17,500',
  });
  const c = m.cash;
  const cashTile = tile({
    label: 'Cash collected pace', value: fmtMoney(c.value, true), statusKey: c.status,
    sub: c.expected ? `Pace by ${m.ed.through} is ${fmtMoney(c.expected, true)} (${fmtPct(c.paceRatio)} of pace)` : 'Collected this month',
    small: c.monthTarget ? `Month target ${fmtMoney(c.monthTarget, true)} (provisional)` : null,
    bar: bar(c.value, c.expected), targetText: c.expected ? `Pace ${fmtMoney(c.expected, true)}` : 'New-hire target coming',
  });
  const p = m.pipeline;
  const pipeTile = p ? tile({
    label: 'Projected closes', value: p.projected, statusKey: 'track',
    sub: `${p.hc} High Confidence + ${p.sv} Soft Verbal / Reengaged in your ${month.label} pipeline`,
    small: `${p.working} WIP (not counted)<br>${p.lastWeek
      ? `Last week: ${p.lastWeek.won} of ${p.lastWeek.projected} projected closed or signed`
      : 'Hit rate on last week’s projections starts Mon Oct 26'}`,
    warn: p.nonstandard ? `${p.nonstandard} leads need a status` : null,
    targetText: 'No target',
  }) : tile({ label: 'Projected closes', value: '–', statusKey: 'track', sub: 'No pipeline tab yet', targetText: 'No target' });
  const rpc = m.revPerCall;
  const rpcTile = tile({
    label: 'Revenue per call', value: rpc.value == null ? '–' : fmtMoney(rpc.value), statusKey: 'track',
    sub: `${fmtMoney(rpc.rev, true)} revenue generated over ${rpc.calls} booked calls this month`, targetText: 'No target',
  });
  const closesTile = tile({
    label: monday ? 'Closes last week' : 'Closes this week', value: m.closes.value, statusKey: 'track',
    sub: m.closes.value ? `${fmtMoney(m.closes.rev)} revenue generated` : 'No closes logged yet',
    targetText: 'No target',
  });

  // Day by day: dotted box = open slots offered, solid = booked, dark = showed
  const maxDay = Math.max(8, ...m.days.map((d) => Math.max(d.slots ?? 0, d.booked ?? 0)));
  const h = (v) => `${((v ?? 0) / maxDay) * 100}%`;
  const dayTone = (d) => (d.weekend ? 'track' : d.booked >= TARGETS.callsPerWorkday ? 'hit' : d.booked >= TARGETS.callsPerWorkday - 1 ? 'almost' : 'missed');
  const dayCols = m.days.map((d) => {
    if (d.future) {
      return `<div class="col">${d.slots != null ? `<div class="slotbox future" style="height:${h(d.slots)}"></div>` : ''}</div>`;
    }
    return `<div class="col ${dayTone(d)}">
      ${d.slots != null ? `<div class="slotbox" style="height:${h(d.slots)}"></div>` : ''}
      <div class="booked" style="height:${h(d.booked)}"></div>
      <div class="showed" style="height:${h(d.showed)}"></div></div>`;
  }).join('');
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayNums = m.days.map((d, i) => `<div><div class="dn">${dayNames[i]}</div>${d.future
    ? `<div class="dv">${d.slots != null ? `${d.slots} open` : ''}</div>`
    : `<div class="dv"><span class="k-s">${d.slots ?? '–'}</span> · <span class="k-b">${d.booked}</span> · <span class="k-w">${d.showed}</span></div>`}</div>`).join('');
  const behind = m.calls.target != null && m.calls.value < m.calls.target;
  const wk = TARGETS.callsPerWeek;
  const verdict = m.calls.target == null ? `<span class="chip" style="background:var(--track)">TRACKING</span> ${m.calls.value} booked so far`
    : monday
      ? `<span class="chip" style="background:${behind ? 'var(--missed)' : 'var(--hit)'}">${behind ? 'FINISHED BEHIND' : 'FINISHED ON TARGET'}</span> ${m.calls.value} of ${wk} booked calls for the week`
      : `<span class="chip" style="background:${behind ? 'var(--missed)' : 'var(--hit)'}">${behind ? 'TRENDING BEHIND' : 'ON PACE'}</span> ${m.calls.value} booked vs ${m.calls.target} pace by today · on track for ${m.calls.projected} of ${wk}`;

  const momCells = m.mom.map((r) => {
    const d = r.delta;
    const cls = d == null ? 'flat' : d > 0.02 ? 'up' : d < -0.02 ? 'down' : 'flat';
    const arrow = d == null ? 'no September data' : `${d > 0 ? '▲' : d < 0 ? '▼' : '■'} ${Math.abs(Math.round(d * 100))}% vs ${r.kind === '$' ? fmtMoney(r.prev, true) : r.prev}`;
    return `<div><div class="l">${r.label}</div><div class="v">${r.kind === '$' ? fmtMoney(r.now, true) : r.now}</div><div class="d ${cls}">${arrow}</div></div>`;
  }).join('');

  const t = m.tally;
  const lede = `You hit ${t.hit} of ${t.total} targets${t.almost ? `, ${t.almost} almost` : ''} · ${m.calls.value} booked calls · ${m.closes.value} close${m.closes.value === 1 ? '' : 's'} · ${fmtMoney(m.closes.rev, true)} revenue`;

  const body = `
<div class="eyebrow">Closer scorecard · ${monday ? 'Week in review' : 'Midweek check-in'}</div>
<h1>${esc(name)}'s ${monday ? 'week' : 'week so far'}: ${m.ed.week_label}</h1>
<div class="lede">${lede}</div>
<div class="wf">
  <div class="box wins"><h3>WINS ${monday ? 'LAST WEEK' : 'SO FAR'}</h3>${ol(wins, 'No targets hit yet. Let’s change that this week.')}</div>
  <div class="box fixes"><h3>FOCUS ${monday ? 'THIS WEEK' : 'FOR THE REST OF THE WEEK'}</h3>${ol(fixes, 'Nothing flagged. Keep it going.')}</div>
</div>
<div class="section"><h2>YOUR NUMBERS VS TARGET</h2>
<p class="key">Green: you hit the target. Yellow: almost there (75% of the target or more). Red: you missed it. Blue: a number we track, with no target. The black line on each bar is the target.</p>
<div class="grid">${slotTile}${callsTile}${showTile}${avgTile}${cashTile}${pipeTile}${rpcTile}${closesTile}</div></div>
<div class="section"><h2>${monday ? 'LAST WEEK, DAY BY DAY' : 'THIS WEEK’S PACE'}</h2>
<div class="verdict">${verdict}</div>
<div class="daykey"><span class="kbox"></span>Open slots (goal 5 a day) <span class="kbook"></span>Booked calls (goal 4) <span class="kshow"></span>Showed (goal 3) <em style="margin-left:auto;font-style:normal">Numbers under each day: open · booked · showed</em></div>
<div class="pace">${dayCols}</div>
<div class="days">${dayNums}</div></div>
<div class="section"><h2>MONTH OVER MONTH</h2>
<p class="key">${month.label} 1 to ${m.ed.through.split(' ')[1]} compared with the same days in ${month.prev_label}.</p>
<div class="mom">${momCells}</div></div>
<div class="footer">From the Sales Tracker 2026 (Inputs tab), the Pipeline Review sheet and Calendly, times in ET. Booked calls: calls scheduled on your calendar (Sched. calls). Show rate: live calls ÷ booked calls. Open slots: discovery start times Calendly offers over the next 7 days; day by day, slots offered inside your Calendly hours that your Google Calendar left free (booked discovery calls count as slots). Calendar open till: the latest end of your Calendly discovery hours, in ET. Average revenue: revenue generated ÷ closes, month to date; revenue generated is the contract value at close, cash collected is money received. Cash pace: month target × business days so far ÷ business days in the month. Projected closes: open High Confidence + Soft Verbal / Reengaged leads in your current-month pipeline tab; WIP (Working / Good Call) is shown but not counted. Revenue per call: revenue generated ÷ booked calls, month to date.</div>`;
  return page(body);
}

export function leadershipTable(rows, data) {
  const ed = data.editions.monday;
  const cell = (st, main, sub) => `<td class="${st}">${main}${sub ? `<small>${sub}</small>` : ''}</td>`;
  const body = rows.map((m) => {
    const p = m.pipeline;
    const mom = m.mom.find((r) => r.label === 'Revenue generated');
    const momTxt = mom.delta == null ? '–' : `${mom.delta > 0 ? '▲' : '▼'} ${Math.abs(Math.round(mom.delta * 100))}%`;
    return `<tr><td>${esc(m.closer.short)}${m.newHire ? '<small>new hire</small>' : ''}</td>
${cell(m.slots.status, m.slots.value ?? '–', m.slots.value == null ? 'not a host' : m.calendar ? `till ${m.calendar.usualText}` : 'next 7 days')}
${cell(m.calls.status, m.calls.value, m.calls.target ? `of ${m.calls.target}` : 'target pending')}
${cell(m.showRate.status, fmtPct(m.showRate.value), `${m.showRate.live}/${m.showRate.booked}`)}
${cell('track', m.closes.value, fmtMoney(m.closes.rev, true))}
${cell('track', p ? p.projected : '–', p ? `${p.hc} HC · ${p.sv} SV · ${p.working} W${p.nonstandard ? ` · ${p.nonstandard} untagged` : ''}` : 'no tab')}
${cell(m.cash.status, fmtMoney(m.cash.value, true), m.cash.expected ? `${fmtPct(m.cash.paceRatio)} of pace` : 'target pending')}
${cell(m.avgRevenue.status, m.avgRevenue.value == null ? '–' : fmtMoney(m.avgRevenue.value), `${m.avgRevenue.closes} closes MTD`)}
${cell('track', m.revPerCall.value == null ? '–' : fmtMoney(m.revPerCall.value), 'MTD')}
${cell('track', momTxt, `${fmtMoney(mom.now, true)} vs ${fmtMoney(mom.prev, true)}`)}</tr>`;
  }).join('');

  const sum = (f) => rows.reduce((a, m) => a + (f(m) || 0), 0);
  const tCalls = sum((m) => m.calls.value), tLive = sum((m) => m.showRate.live), tBooked = sum((m) => m.showRate.booked);
  const tCloses = sum((m) => m.closes.value), tRevWk = sum((m) => m.closes.rev);
  const tProj = sum((m) => m.pipeline?.projected), tCash = sum((m) => m.cash.value);
  const tRev = sum((m) => m.avgRevenue.rev), tMtdCloses = sum((m) => m.avgRevenue.closes);
  const hitCalls = rows.filter((m) => m.calls.status === 'hit').length, scoredCalls = rows.filter((m) => m.calls.target != null).length;
  const total = `<tr class="total"><td>Team</td><td>–</td><td>${tCalls}<small>${hitCalls} of ${scoredCalls} hit 20</small></td><td>${fmtPct(tLive / tBooked)}<small>${tLive}/${tBooked}</small></td><td>${tCloses}<small>${fmtMoney(tRevWk, true)}</small></td><td>${tProj}</td><td>${fmtMoney(tCash, true)}</td><td>${fmtMoney(tRev / tMtdCloses)}<small>${tMtdCloses} closes MTD</small></td><td>–</td><td>–</td></tr>`;

  const html = `
<div class="eyebrow">Closer scorecard · Leadership view</div>
<h1>Team week: ${ed.week_label}</h1>
<div class="lede">What each closer sees on their card, in one table. Sent ${ed.date}, 8:00am ET.</div>
<div class="legend"><span style="--c:var(--hit)">Hit</span><span style="--c:var(--almost)">Almost (75%+)</span><span style="--c:var(--missed)">Missed</span><span style="--c:var(--track)">Tracked, no target</span></div>
<table><thead><tr><th>Closer</th><th>Open slots<br>target 25</th><th>Booked calls<br>target 20</th><th>Show rate<br>target 80%</th><th>Closes<br>last week</th><th>Projected closes<br>HC + SV</th><th>Cash MTD<br>vs pace</th><th>Avg revenue<br>floor $17.5K</th><th>Revenue<br>per call</th><th>Revenue MoM<br>same days</th></tr></thead>
<tbody>${body}${total}</tbody></table>
<div class="footer">Week = Monday to Sunday. Month to date runs Oct 1 to ${ed.through}; month over month compares with the same days in September. Cash pace uses a provisional $200K monthly target for every fully ramped closer until per-closer targets are connected from the tracker. Slots are Calendly discovery start times over the next 7 days, with the time each closer's calendar closes (ET). Projected closes count open High Confidence and Soft Verbal / Reengaged leads in each closer's October pipeline tab; "untagged" = open leads with a blank or non-standard status.</div>`;
  return page(html, 'wide');
}
