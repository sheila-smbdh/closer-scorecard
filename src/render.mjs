// HTML templates for the closer card and the Monday leadership table.
// The card is built around pacing: the pace tracker on top (cash vs pace by today vs the team
// median), then "How the week went" (the inputs a closer controls: open slots, live calls,
// average revenue, projected vs actual closes) and "Where we're headed" (upcoming slots and
// on track / off pace against the month target). Tiles: green hit, yellow 75%+, red missed, blue tracked.

import { fmtPct, fmtMoney, trackerFor } from './metrics.mjs';

const CHIP = { hit: 'HIT', almost: 'ALMOST', missed: 'MISSED', track: 'TRACKING' };
const PACE_CHIP = { hit: 'ON PACE', almost: 'SLIGHTLY BEHIND', missed: 'OFF PACE', track: 'NO TARGET YET' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const delta = (a, b) => (b ? `${a >= b ? '+' : '−'}${Math.abs(Math.round(((a - b) / b) * 100))}%` : '–');
const monthShort = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
const monthLong = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
const normDay = (day, dim, pdim) => Math.min(pdim, Math.max(1, Math.round((day * pdim) / dim)));
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
/* pace chart: same look as the 2M tracker's closer view */
.pt{margin-top:26px;background:#0f0f0e;border-radius:14px;padding:22px 24px 18px;color:#fcf6e2}
.pt-head{display:flex;justify-content:space-between;align-items:center}
.pt-caps{font-size:13px;letter-spacing:.12em;font-weight:700;text-transform:uppercase;color:#f0cd2b}
.pt-pill{font-size:12px;font-weight:800;letter-spacing:.08em;border:1.5px solid;border-radius:6px;padding:5px 10px}
.pt-pill.hit{color:#6fd08a} .pt-pill.almost{color:#f0cd2b} .pt-pill.missed{color:#ff7a58} .pt-pill.track{color:#9fb0ff}
.pt-numrow{display:flex;align-items:baseline;gap:16px;margin-top:14px}
.pt-num{font-family:Fraunces,Georgia,serif;font-size:56px;font-weight:800;letter-spacing:-.02em;color:#f0cd2b;line-height:1}
.pt-mom{font-size:20px;font-weight:700} .pt-mom.down{color:#ff7a58} .pt-mom.up{color:#6fd08a}
.pt-ctx{font-size:16px;margin-top:10px;color:rgba(252,246,226,.85)}
.pt-foot{font-size:13.5px;font-style:italic;margin-top:4px;color:rgba(252,246,226,.55)}
.pt-chart{margin-top:14px}
.pt-chart svg{display:block}
.pt-legend{display:flex;gap:22px;align-items:center;font-size:14px;font-weight:600;color:rgba(252,246,226,.85);margin-top:6px}
.pt-legend i{display:inline-block;width:16px;height:3px;border-radius:2px;margin-right:8px;vertical-align:4px}
.pt-legend i.dot{width:11px;height:11px;border-radius:50%;background:#f0cd2b;vertical-align:-1px}
.pt-day{margin-left:auto;font-size:12.5px;letter-spacing:.1em;text-transform:uppercase;color:rgba(252,246,226,.55)}
.pt-cap{font-size:15px;line-height:1.5;margin-top:12px;color:rgba(252,246,226,.9)}
/* path to target */
.path{background:#fff;border:1px solid var(--line);border-radius:14px;padding:6px 22px}
.step{display:flex;align-items:center;gap:16px;padding:14px 0;border-bottom:1px solid var(--line)}
.step:last-child{border-bottom:none}
.sn{flex:none;width:30px;height:30px;border-radius:50%;background:var(--ink);color:#fff;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center}
.sw{flex:1}
.sl{font-size:14px;letter-spacing:.08em;font-weight:700;text-transform:uppercase}
.st{font-size:15px;color:#3d4248;line-height:1.4;margin-top:3px}
.step>.sv{font-size:30px;font-weight:800;white-space:nowrap;text-align:right}
.cases{display:flex;gap:10px}
.cases>div{width:190px;background:#f4f2ee;border-radius:10px;padding:8px 12px}
.cases small{display:block;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.cases b{display:block;font-size:24px;font-weight:800;margin-top:2px}
.cases span{font-size:13.5px;color:#3d4248}
.rows{margin-top:6px}
.rows>div{display:flex;align-items:baseline;gap:12px;padding:5px 0}
.rows>div+div{border-top:1px dashed var(--line)}
.rl{flex:none;width:150px;white-space:nowrap;font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.rt{flex:1;font-size:15px;color:#3d4248}
.rows b{font-size:24px;font-weight:800;white-space:nowrap}
.warnt{color:var(--missed);font-weight:600}
.names{margin-top:6px;font-size:13.5px;color:var(--muted);line-height:1.45}
.verdict{margin-top:12px;border-radius:12px;padding:14px 18px;font-size:16px;line-height:1.45;border-left:6px solid}
.verdict.hit{background:var(--hit-bg);border-color:var(--hit)} .verdict.almost{background:var(--almost-bg);border-color:var(--almost)}
.verdict.missed{background:var(--missed-bg);border-color:var(--missed)} .verdict.track{background:var(--track-bg);border-color:var(--track)}
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
  return `<!doctype html><html><head><meta charset="utf-8"><title>Closer Scorecard</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,800&display=block"><style>${CSS}</style></head><body><div class="card ${width === 'wide' ? 'wide' : ''}">${body}</div></body></html>`;
}

// Pace chart, drawn like the 2M tracker's closer view: cumulative cash by day against the goal-pace curve
// and last month's same-day curve, scaled to the closer's month target
function paceTracker(m, month) {
  const c = m.cash;
  const ch = c.chart;
  const pill = `<span class="pt-pill ${c.status}">${PACE_CHIP[c.status]}</span>`;
  if (!ch) {
    return `<div class="pt"><div class="pt-head"><span class="pt-caps">Cash collected · ${month.label} pace</span>${pill}</div>
<div class="pt-numrow"><span class="pt-num">${fmtMoney(c.value ?? 0, true)}</span></div>
<div class="pt-ctx">${c.monthTarget ? `vs pace ${fmtMoney(c.expected, true)} (${delta(c.value ?? 0, c.expected)}) · team median ` : 'Team median '}${fmtMoney(m.team.cash, true)}</div>
<p class="pt-cap">${c.monthTarget ? 'The daily pace chart appears once the tracker has your daily cash for this month.' : 'Your month target is coming, so there is no pace line yet.'}</p></div>`;
  }
  const W = 944, H = 370, P = { l: 64, r: 30, t: 34, b: 34 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const top = Math.max(c.monthTarget, ...ch.daily, ...(ch.prior ?? []));
  const x = (d) => P.l + ((d - 1) * iw) / (ch.dim - 1);
  const y = (v) => P.t + (1 - Math.max(0, v) / top) * ih;
  const pts = (arr) => arr.map((v, i) => `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const axis = (v) => (v === 0 ? '$0' : `$${Math.round(v / 1000)}K`);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  const xDays = [...new Set([1, 5, 10, 15, 20, 25, ch.dim])];
  const weeks = [7, 14, 21, 28].filter((d) => d < ch.dim);
  const last = ch.daily.length;
  const area = `M ${x(1)},${y(0)} ${ch.daily.map((v, i) => `L ${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} L ${x(last)},${y(0)} Z`;
  const priorLabel = monthShort(ch.priorMonth);

  const svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Inter, sans-serif">
${ticks.map((v) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(252,246,226,.10)"/><text x="${P.l - 10}" y="${y(v) + 4}" text-anchor="end" font-size="13" font-weight="600" fill="rgba(252,246,226,.55)">${axis(v)}</text>`).join('')}
${weeks.map((d, i) => `<line x1="${x(d)}" x2="${x(d)}" y1="${P.t}" y2="${H - P.b}" stroke="rgba(252,246,226,.30)" stroke-dasharray="4 4"/><text x="${x(d)}" y="${P.t - 12}" text-anchor="middle" font-size="13" font-weight="700" fill="rgba(252,246,226,.55)">W${i + 1} end</text>`).join('')}
<path d="${area}" fill="rgba(252,208,64,.22)"/>
${ch.prior ? `<polyline points="${pts(ch.prior)}" fill="none" stroke="#7d92ff" stroke-width="2.5" opacity=".85"/>` : ''}
<polyline points="${pts(ch.goal)}" fill="none" stroke="#ff7a58" stroke-width="2.5" stroke-dasharray="7 5"/>
<polyline points="${pts(ch.daily)}" fill="none" stroke="#fcf6e2" stroke-width="3.5" stroke-linejoin="round"/>
<circle cx="${x(last)}" cy="${y(ch.daily[last - 1])}" r="8" fill="#f0cd2b" stroke="#0a0a0a" stroke-width="2.5"/>
${xDays.map((d) => `<text x="${x(d)}" y="${H - P.b + 22}" text-anchor="middle" font-size="13" font-weight="600" fill="rgba(252,246,226,.55)">D${d}</text>`).join('')}
</svg>`;

  const mom = ch.priorSameDay ? delta(c.value, ch.priorSameDay) : null;
  const ahead = c.value - c.expected;
  const caption = `${fmtMoney(c.value)} collected through day ${ch.day}, ${ahead >= 0 ? `${fmtMoney(ahead, true)} ahead of` : `${fmtMoney(-ahead, true)} behind`} the ${fmtMoney(c.expected, true)} goal pace${ch.priorSameDay != null ? `, against ${fmtMoney(ch.priorSameDay)} by the same day in ${monthLong(ch.priorMonth)}` : ''}. The team median is ${fmtMoney(m.team.cash, true)} (${fmtPct(m.team.pace)} of pace). At this pace ${month.label} ends near ${fmtMoney(c.projectedFinish, true)} of your ${fmtMoney(c.monthTarget, true)} target.`;

  return `<div class="pt">
<div class="pt-head"><span class="pt-caps">Cash collected · ${month.label} pace</span>${pill}</div>
<div class="pt-numrow"><span class="pt-num">${fmtMoney(c.value, true)}</span>${mom ? `<span class="pt-mom ${c.value >= ch.priorSameDay ? 'up' : 'down'}">${mom} MoM</span>` : ''}</div>
<div class="pt-ctx">vs pace ${fmtMoney(c.expected, true)} (${delta(c.value, c.expected)}) · vs MED ${fmtMoney(m.team.cash, true)} (${delta(c.value, m.team.cash)})</div>
${ch.priorSameDay != null ? `<div class="pt-foot">vs ${priorLabel} D${normDay(ch.day, ch.dim, ch.priorDim)}, same-day, normalized for month length</div>` : ''}
<div class="pt-chart">${svg}</div>
<div class="pt-legend"><span><i style="background:#ff7a58"></i>Goal pace</span>${ch.prior ? `<span><i style="background:#7d92ff"></i>${priorLabel} · same-day</span>` : ''}<span><i class="dot"></i>Actual MTD</span><span class="pt-day">Day ${ch.day} of ${ch.dim}</span></div>
<p class="pt-cap">${caption}</p>
</div>`;
}

const rangeText = (r) => {
  const v = [r.floor, r.own, r.high].filter((x) => x != null);
  const lo = Math.min(...v), hi = Math.max(...v);
  return lo === hi ? `${lo}` : `${lo} to ${hi}`;
};

// "Where we're headed": from the gap to target, through the pipeline leads to pull forward and the new calls the
// rest of the month realistically holds, to a realistic month end. Calls late in the month build next month.
function pathSection(m, month) {
  const p = m.path, c = m.cash, pl = m.closes.pipeline;
  if (!p) {
    return `<div class="section"><h2>WHERE WE'RE HEADED</h2>
<p class="key">Your month target is coming. Until then: ${m.slots.value == null ? 'get set up as a discovery host in Calendly.' : `${m.slots.booked ?? 0} calls booked and ${m.slots.open} open slots in the next 7 days.`}</p></div>`;
  }
  const $ = (v) => fmtMoney(v, true);
  const step = (n, label, value, text) => `<div class="step"><span class="sn">${n}</span><div class="sw"><div class="sl">${label}</div><div class="st">${text}</div></div>${value != null ? `<div class="sv">${value}</div>` : ''}</div>`;
  const names = (list, max = 6) => list.slice(0, max).map((l) => `${esc(l.name)}${l.cash != null ? ` ${$(l.cash)}` : ''}`).join(', ') + (list.length > max ? `, +${list.length - max} more` : '');
  const nextMonth = new Date(Date.UTC(2026, (m.ed.through_key.slice(0, 2) * 1) % 12, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const cl = p.calls, nx = p.next, cal = m.calendar;

  // 3: the pipeline, two ways
  const pipeRows = pl ? `<div class="rows">
<div><span class="rl">If they all close</span><span class="rt">${pl.hc} High Confidence ${$(pl.cash.hc)} + ${pl.sv} Soft Verbal ${$(pl.cash.sv)} + ${pl.working} Working ${$(pl.cash.working)}</span><b>${$(p.pipe.all)}</b></div>
<div><span class="rl">At usual rates</span><span class="rt">80% of High Confidence + 50% of Soft Verbal + Working not counted</span><b>${$(p.pipe.likely)}</b></div>
</div>${pl.noAmount ? `<div class="st">${pl.noAmount} leads have no amount on your pipeline tab and are counted at $17.5K: fill them in.</div>` : ''}` : '<div class="st">No pipeline tab yet.</div>';

  // 4: who to pull forward
  let pullText = 'No pipeline tab yet, so every close has to come from new calls.';
  let pullValue = null;
  if (pl) {
    const hcsv = pl.hc + pl.sv;
    const lists = [pl.hc ? `High Confidence: ${names(pl.leads.hc)}` : null, pl.sv ? `Soft Verbal: ${names(pl.leads.sv)}` : null].filter(Boolean).join('<br>');
    if (p.pull.left === 0) {
      pullValue = plural(hcsv, 'lead');
      pullText = `Your ${hcsv} High Confidence and Soft Verbal leads (${$(p.pipe.hcsv)}) cover the gap if they close this month. Get each one to a signed yes, and book the follow-up before it slips.`;
    } else {
      pullValue = pl.working ? `${hcsv} + ${p.pull.working} Working` : `${hcsv}`;
      pullText = `Closing every High Confidence and Soft Verbal lead brings ${$(p.pipe.hcsv)}, leaving ${$(p.pull.left)}. `
        + (pl.working ? `That means moving about <b>${p.pull.working} of your ${pl.working} Working leads</b> (about ${$(p.pull.avgWorking)} each) to a yes this month: pick the ones closest to a decision and book their next call now.` : '')
        + (p.pull.beyond ? (pl.working ? ` Even all of them leave ${$(p.pull.beyond)}, which has to come from new calls.` : ` You have no Working leads, so that has to come from new calls.`) : '');
    }
    if (lists) pullText += `<div class="names">${lists}</div>`;
    if (pl.nonstandard) pullText += `<div class="names warnt">${plural(pl.nonstandard, 'lead')} on your tab ${pl.nonstandard === 1 ? 'has' : 'have'} no status: tag them, they may be leads to pull forward.</div>`;
  }

  // 5: new calls to month end, and what can still close in time
  const callsValue = cl.liveLeft != null ? `~${cl.liveLeft} → ${cl.closes < 1 ? 'under 1' : `~${Math.round(cl.closes)}`}` : '–';
  const callsText = cl.liveLeft == null ? 'No live calls logged yet this month.'
    : `At your pace this month (${cl.perDay.toFixed(1)} live calls a business day) that is about <b>${cl.liveLeft} more live calls</b> by ${month.label} 31. At ${cl.ownClose ? 'your' : 'the team median'} ${fmtPct(cl.close)} close rate, about <b>${cl.closes.toFixed(1)}</b> of them close this month at most: calls this week have the best shot, since a call in the last days rarely pays before the 1st.`;

  // 6: next month's pipeline
  const nextText = cl.liveLeft == null ? `Calls you take from here on are ${nextMonth}'s pipeline.`
    : `The other ~${cl.nextMonth} calls are ${nextMonth}'s pipeline. Log each one as High Confidence, Soft Verbal or Working the same day and book the next step before you hang up, so you start ${nextMonth} with deals already in motion (this month's target takes ${m.closes.needed} closes).`;

  // 7: next 7 days
  const weekText = m.slots.value == null ? 'Not set up as a discovery host in Calendly yet.'
    : `${nx.booked != null ? `${nx.booked} calls already booked + ${nx.open} open slots` : `${nx.open} open slots`}: fill them this week, since these are the calls that can still close in ${month.label}.${cal ? ` Calendar open till ${cal.label}.` : ''}${cal?.away ? ` Away (${esc(cal.away.away)}); open evening slots when back in ${esc(cal.away.back_label)}.` : cal?.closesEarly ? ' Most days close by 5pm ET: open later slots.' : ''}`;

  const verdict = p.gap <= 0 ? 'Target reached. Everything from here is upside and next month\'s pipeline.'
    : `<b>Realistic ${month.label}:</b> ${$(c.value ?? 0)} collected + ${$(p.pipe?.likely ?? 0)} from your pipeline at usual rates + about ${(cl.closes ?? 0).toFixed(1)} new-call closes (${$((cl.closes ?? 0) * 17500)}) ≈ <b>${$(p.realistic)}</b>, ${fmtPct(p.ratio)} of ${$(c.monthTarget)}. `
      + (p.ratio >= 1 ? 'You are on track: protect the pipeline and keep the calendar full.'
        : pl ? `The biggest lever is your pipeline: every Working or Soft Verbal lead you pull forward to a close adds about ${$(p.pull.avgWorking)}.` : 'Get a pipeline tab set up so your follow-ups count.');

  return `<div class="section"><h2>WHERE WE'RE HEADED: THE PATH TO ${$(c.monthTarget)}</h2>
<p class="key">Working backwards from your month target: what is left, what your pipeline can cover, and what new calls can realistically add.</p>
<div class="path">
${step(1, 'Gap to target', $(p.gap), `${$(c.value ?? 0)} collected of ${$(c.monthTarget)}, ${plural(c.daysLeft, 'business day')} left.`)}
${step(2, 'Closes that takes', rangeText(p.range), `${p.range.floor} at $17.5K each${p.range.own ? ` · ${p.range.own} at your ${fmtMoney(m.avgRevenue.value)} average` : ''} · ${p.range.high} at $20K each.`)}
<div class="step"><span class="sn">3</span><div class="sw"><div class="sl">Your pipeline</div>${pipeRows}</div></div>
${step(4, 'Pull forward from your pipeline', pullValue, pullText)}
${step(5, 'New calls to month end', callsValue, callsText)}
${step(6, `Build ${nextMonth}'s pipeline`, cl.nextMonth != null ? `~${cl.nextMonth}` : null, nextText)}
${step(7, 'Your next 7 days', nx.booked == null ? (m.slots.value ?? '–') : `${nx.booked} + ${nx.open}`, weekText)}
</div>
<div class="verdict ${p.gap <= 0 ? 'hit' : p.status}">${verdict}</div></div>`;
}

// What to change, from the week's inputs; "nothing" when every scored input hit
function weekVerdict(m) {
  const fixes = [];
  const sw = m.slotsWeek, lv = m.live, ar = m.avgRevenue;
  if (sw.status === 'missed' || sw.status === 'almost') fixes.push(`slots averaged ${sw.value} booked + open, under 25: open more Calendly time`);
  if (lv.status === 'missed' || lv.status === 'almost') fixes.push(`${lv.value} live calls this month vs a team median of ${num(lv.target)}: book and confirm more calls`);
  if (ar.status === 'missed') fixes.push(`average revenue ${fmtMoney(ar.value)}, under $17.5K: hold price on the next closes`);
  const scored = [sw, lv, ar].filter((x) => x.status !== 'track').length;
  if (!scored) return '';
  return fixes.length
    ? `<div class="verdict missed"><b>To change:</b> ${fixes.join('; ')}.</div>`
    : '<div class="verdict hit"><b>You did the inputs right:</b> enough slots, enough live calls, average revenue at or above $17.5K. Nothing to change here; the path below is about converting.</div>';
}

// "Sunday, October 18th" from the window's last day
function longDate(m) {
  const [mm, dd] = m.ed.through_key.split('-').map(Number);
  const year = Number(m.cash.chart?.priorMonth?.slice(0, 4) ?? 2026) + (mm === 1 ? 1 : 0);
  const d = new Date(Date.UTC(year, mm - 1, dd));
  const sfx = dd % 10 === 1 && dd !== 11 ? 'st' : dd % 10 === 2 && dd !== 12 ? 'nd' : dd % 10 === 3 && dd !== 13 ? 'rd' : 'th';
  return `${d.toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' })}, ${d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${dd}${sfx}`;
}

export function closerCard(m, month) {
  const monday = m.edition === 'monday';
  const name = m.closer.short;
  const t = m.team;
  const when = monday ? 'last week' : 'this week so far';

  // How the week went: the inputs behind the pace
  const sw = m.slotsWeek;
  const slotsWeekTile = tile({
    label: 'Discovery slots', value: sw.value ?? '–', statusKey: sw.status,
    sub: sw.value == null ? 'Not set up as a discovery host in Calendly yet' : sw.booked == null
      ? `Average open discovery slots over the next 7 days, ${when}`
      : `Average day ${when}: <b>${sw.booked}</b> booked + <b>${sw.open}</b> still open over the next 7 days`,
    small: sw.value == null ? null : `Lowest day ${sw.low}${t.slotsWeek != null ? ` · team median ${Math.round(t.slotsWeek)}` : ''}`,
    bar: bar(sw.value, sw.target), targetText: 'Target 25 (booked + open)',
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
    statusKey: 'track',
    sub: pl ? `${plural(cl.actual, 'close')} so far, ${cl.projected} projected by month end` : `${plural(cl.actual, 'close')} so far. No pipeline tab yet`,
    small: pl ? `Projected = ${cl.actual} closed + 80% of ${pl.hc} High Confidence + 50% of ${pl.sv} Soft Verbal = ${num(Math.round(cl.projectedExact * 10) / 10)}. ${pl.working} Working not counted.${cl.lastWeek
      ? `<br>Last week: ${cl.lastWeek.won} of ${cl.lastWeek.projected} projected closed or signed` : ''}` : null,
    warn: pl?.nonstandard ? `${pl.nonstandard} leads need a status` : null,
    targetText: 'Tracked, no target',
  });

  const c = m.cash;
  const lede = `${c.monthTarget ? `${fmtPct(c.paceRatio)} of pace (team median ${fmtPct(t.pace)})` : `${fmtMoney(c.value, true)} collected`} · ${plural(lv.value, 'live call')} this month · ${plural(cl.actual, 'close')}${cl.projected != null ? `, ${cl.projected} projected` : ''}`;

  const body = `
<div class="eyebrow">Closer scorecard · Month-to-date roundup</div>
<h1>${esc(name)}'s month to date: ${longDate(m)}</h1>
<div class="lede">${lede}</div>
${paceTracker(m, month)}
<div class="section"><h2>HOW THE WEEK WENT</h2>
<p class="key">${monday ? m.ed.week_label : `This week so far (${m.ed.week_label})`}: the inputs you control that drive your pace. Green: on target. Yellow: close (75% of it or more). Red: below. The black line on each bar is the target; live calls are measured against the team median.</p>
<div class="grid">${slotsWeekTile}${liveTile}${avgTile}${closesTile}</div>
${weekVerdict(m)}</div>
${pathSection(m, month)}
<div class="footer">From the EOD Tracker, the Sales Tracker 2026 (Inputs tab), the Pipeline Review sheet, the 2M tracker, Close and Calendly, times in ET. ${c.source === 'tracker' ? 'Pace: cash collected vs what the 2M tracker expects by this day on its month curve, which is back-loaded (more cash lands late in the month); month end at this pace = % of pace × month target.' : 'Pace: month target × business days so far ÷ business days in the month (provisional).'} Team median: the middle value among fully ramped closers. Slots: client calls already booked in Calendly + discovery start times still open in Calendly over the next 7 days, as of each 8am post; the week figure averages each day. The 25 target is on booked + open. Live calls: calls that showed, from your EOD reports (Sales Tracker for any day without one). Average revenue: revenue generated ÷ closes, month to date. Projected closes (tracked, no target): closes so far + 80% of open High Confidence + 50% of open Soft Verbal / Reengaged leads in your current-month pipeline; Working is shown, not counted. Path to target: gap = month target − cash collected; your pipeline is open leads at their column D amounts (a lead with no amount counts as $17.5K); new calls to month end = your live calls per business day this month × business days left; close rate = closes ÷ live calls this month (team median until you have a close); realistic month end = cash + pipeline at usual rates + new-call closes at $17.5K.</div>`;
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
${cell(m.slotsWeek.status, m.slotsWeek.value ?? '–', m.slotsWeek.value == null ? 'not a host' : m.slotsWeek.booked == null ? 'open, daily avg' : `${m.slotsWeek.booked} booked + ${m.slotsWeek.open} open`)}
${cell(m.live.status, m.live.value, `${m.live.week} last week`)}
${cell(m.avgRevenue.status, m.avgRevenue.value == null ? '–' : fmtMoney(m.avgRevenue.value), `${plural(m.avgRevenue.closes, 'close')} MTD`)}
${cell(cl.status, cl.projected == null ? cl.actual : `${cl.actual} / ${cl.projected}`, pl ? `${pl.hc} HC · ${pl.sv} SV · ${pl.working} W${pl.nonstandard ? ` · ${pl.nonstandard} untagged` : ''}${cl.needed ? ` · need ${cl.needed}` : ''}` : 'no tab')}
${cell(m.path ? m.path.status : 'track', m.path ? fmtMoney(m.path.realistic, true) : '–', m.path ? `${fmtPct(m.path.ratio)} of target` : 'no target')}
${cell(m.slots.status, m.slots.value ?? '–', m.slots.value == null ? 'not a host' : `${m.slots.booked != null ? `${m.slots.booked} booked + ${m.slots.open} open` : 'open'}${m.calendar ? ` · till ${m.calendar.usualText}` : ''}`)}</tr>`;
  }).join('');

  const median = `<tr class="total"><td>Team median<small>fully ramped</small></td><td>${fmtPct(team.pace)}</td><td>–</td><td>${num(team.slotsWeek)}</td><td>${num(team.live)}</td><td>${fmtMoney(team.avgRevenue)}</td><td>${num(team.closes)}<small>closes MTD</small></td><td>–</td><td>${num(team.slots)}</td></tr>`;

  const html = `
<div class="eyebrow">Closer scorecard · Leadership view</div>
<h1>Team month to date: ${longDate(rows[0])}</h1>
<div class="lede">What each closer sees on their card, in one table. Sent ${ed.date}, 8:00am ET.</div>
<div class="legend"><span style="--c:var(--hit)">On target / on pace</span><span style="--c:var(--almost)">Close (75%+) / slightly behind</span><span style="--c:var(--missed)">Below / off pace</span><span style="--c:var(--track)">Tracked, no target</span></div>
<table><thead>
<tr><th></th><th class="grp" colspan="2">Pace</th><th class="grp" colspan="4">How the week went</th><th class="grp" colspan="2">Where we're headed</th></tr>
<tr><th>Closer</th><th>% of pace<br>cash vs pace</th><th>Month end<br>at this pace</th><th>Discovery slots<br>booked + open, target 25</th><th>Live calls MTD<br>vs team median</th><th>Avg revenue<br>target $17.5K</th><th>Closes<br>actual / projected</th><th>Realistic<br>month end</th><th>Upcoming slots<br>booked + open, target 25</th></tr></thead>
<tbody>${body}${median}</tbody></table>
<div class="footer">Week = Monday to Sunday. Month to date runs Oct 1 to ${ed.through}. ${trackerFor(data, ed) ? 'Pace comes from the 2M tracker: each closer\'s month target and expected cash by this day on its back-loaded month curve; month end at this pace = % of pace × month target.' : 'Pace uses a provisional $200K monthly target for every fully ramped closer until per-closer targets are connected from the tracker.'} Slots = client calls already booked in Calendly + discovery start times still open in Calendly over the next 7 days (open from Messi's 8am post, booked from Calendly as of that post); the week figure averages each day, upcoming is today's. Projected closes = closes so far + 80% of open High Confidence + 50% of open Soft Verbal / Reengaged leads in each closer's ${data.month.label} pipeline tab; "needed" = month target ÷ $17,500; "untagged" = open leads with a blank or non-standard status. Realistic month end = cash so far + pipeline at usual rates (80% HC, 50% SV, Working 0) + new-call closes (live calls at this month's pace to month end × close rate × $17.5K); green at target, yellow 75%+.</div>`;
  return page(html, 'wide');
}
