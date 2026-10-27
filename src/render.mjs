// Closer card: pace chart with the headline numbers, month-to-date inputs (ending on Pacing: cash vs the
// goal for today), and Weeks Ahead (every week of the month: cash, closes and slots, target vs actual).

import { fmtMoney, PACE_LABEL } from './metrics.mjs';
import { SLOTS_TARGET } from './plan.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = (v) => (v != null && Math.abs(v) >= 1000 ? `$${Math.round(v / 1000)}K` : fmtMoney(v, true));
const delta = (a, b) => (b ? `${a >= b ? '+' : '−'}${Math.abs(Math.round(((a - b) / b) * 100))}%` : '–');
const CHIP = { hit: 'HIT', almost: 'ALMOST', missed: 'MISSED', track: 'TRACKING' };
const CHIP_TEXT = { hit: 'HIT', missed: 'MISSED', track: 'SO FAR', next: 'UPCOMING' };

const CSS = `
:root{--ink:#1d1f23;--muted:#5c6168;--line:#e3e1dc;--bg:#fafaf8;
--hit-bg:#e4f2e7;--hit:#24843a;--almost-bg:#fbf1cf;--almost:#d4a106;--almost-ink:#7d5f00;
--missed-bg:#f9e2e1;--missed:#c8423d;--track-bg:#e5ebf6;--track:#2d5bb8}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
.card{width:1080px;padding:40px 44px 40px;background:var(--bg)}
.eyebrow{font-size:15px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:500}
h1{font-size:40px;font-weight:800;letter-spacing:-.01em;margin:10px 0 0}
h2{font-size:17px;letter-spacing:.1em;color:var(--track);font-weight:700;margin:32px 0 14px}
/* pace */
.pt{margin-top:24px;background:#0f0f0e;border-radius:16px;padding:26px 26px 18px;color:#fcf6e2}
.pt-top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
.pt-caps{font-size:13px;letter-spacing:.12em;font-weight:700;text-transform:uppercase;color:#f0cd2b}
.pt-num{font-family:Fraunces,Georgia,serif;font-size:64px;font-weight:800;letter-spacing:-.02em;color:#f0cd2b;line-height:1;margin-top:12px}
.down{color:#ff7a58} .up{color:#6fd08a}
.pt-right{text-align:right}
.pill{display:inline-block;font-size:22px;font-weight:900;letter-spacing:.06em;border-radius:12px;padding:12px 22px;color:#0f0f0e}
.pill.hit{background:#6fd08a} .pill.almost{background:#f0cd2b} .pill.missed{background:#ff7a58} .pill.track{background:#9fb0ff}
.pt-stats{display:grid;grid-template-columns:repeat(2,auto);justify-content:start;column-gap:72px;margin-top:14px}
.pt-stats .pt-caps{color:rgba(252,246,226,.6)}
.pt-stats .pt-num{margin-top:8px}
.pt-stats .goal{color:#fcf6e2}
.pt-cl{font-family:Fraunces,Georgia,serif;font-size:34px;font-weight:800;color:#f0cd2b;margin-top:6px}
.pt-cl.goal{color:#fcf6e2}
.pt-cl small{font-family:Inter,sans-serif;font-size:16px;font-weight:600;color:rgba(252,246,226,.6);margin-left:8px}
.pt-chart{margin-top:4px}
.pt-chart svg{display:block}
.pt-legend{display:flex;gap:22px;font-size:14px;font-weight:600;color:rgba(252,246,226,.85);margin-top:8px}
.pt-legend i{display:inline-block;width:16px;height:3px;border-radius:2px;margin-right:8px;vertical-align:4px}
.pt-legend i.dot{width:11px;height:11px;border-radius:50%;background:#f0cd2b;vertical-align:-1px}
/* tiles */
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.tile{border-radius:12px;border-left:6px solid;padding:16px 18px 14px;display:flex;flex-direction:column;min-height:190px}
.tile.hit{background:var(--hit-bg);border-color:var(--hit)} .tile.hit .v{color:var(--hit)}
.tile.almost{background:var(--almost-bg);border-color:var(--almost)} .tile.almost .v{color:var(--almost-ink)}
.tile.missed{background:var(--missed-bg);border-color:var(--missed)} .tile.missed .v{color:var(--missed)}
.tile.track{background:var(--track-bg);border-color:var(--track)} .tile.track .v{color:var(--track)}
.tile .l{font-size:14px;letter-spacing:.08em;font-weight:700;text-transform:uppercase}
.tile .v{font-size:40px;font-weight:800;margin:8px 0 4px;letter-spacing:-.01em}
.tile .v span{font-size:24px;font-weight:700;opacity:.75}
.tile .s{font-size:15px;color:#3d4248;line-height:1.4}
.tile .s small{font-size:13px;color:var(--muted)}
.tile .foot{margin-top:auto;padding-top:12px}
.tile .foot>.chip{display:inline-block;margin-bottom:10px}
.bar{position:relative;height:8px;background:rgba(0,0,0,.07);border-radius:4px;margin-bottom:10px}
.bar i{position:absolute;left:0;top:0;bottom:0;border-radius:4px}
.bar b{position:absolute;top:-5px;width:3px;height:18px;background:var(--ink);border-radius:1px}
.hit .bar i{background:var(--hit)} .almost .bar i{background:var(--almost)} .missed .bar i{background:var(--missed)} .track .bar i{background:var(--track)}
.row{display:flex;justify-content:space-between;align-items:center;min-height:26px;font-size:14px;color:#3d4248}
.chip{font-size:12px;font-weight:700;letter-spacing:.05em;color:#fff;border-radius:999px;padding:4px 10px}
.hit .chip,.chip.hit{background:var(--hit)} .almost .chip,.chip.almost{background:var(--almost);color:#3a2c00}
.missed .chip,.chip.missed{background:var(--missed)} .track .chip,.chip.track{background:var(--track)}
/* weeks ahead */
table{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:17px}
th{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:700;text-align:left;padding:14px 18px;background:#f4f2ee;vertical-align:bottom}
th small{display:block;font-weight:500;letter-spacing:0;text-transform:none;font-size:13px}
td{padding:14px 18px;border-top:1px solid var(--line);vertical-align:top}
td b{font-size:24px;font-weight:800}
td .of{color:var(--muted);font-weight:600}
td small{display:block;font-size:13px;color:var(--muted);margin-top:4px}
td .wk{font-size:17px;font-weight:800}
td .chip{display:inline-block;margin-top:8px}
.chip.next{background:#d9d6cf;color:#3d4248}
tr.now td{background:#fffbea} tr.now td:first-child{box-shadow:inset 6px 0 0 #f0cd2b}
tr.next td{color:var(--muted)}
tr.month td{background:#f4f2ee;border-top:2px solid var(--ink)}
`;

function bar(value, target) {
  if (target == null || value == null) return '';
  const max = Math.max(target, value) / 0.85;
  return `<div class="bar"><i style="width:${Math.min(100, (value / max) * 100)}%"></i><b style="left:${(target / max) * 100}%"></b></div>`;
}

// chipAbove: the chip sits above the bar (for a long chip label), leaving the bottom row to the target
function tile({ label, value, sub, statusKey, target, barHtml = '', chipText = CHIP[statusKey], chipAbove = false }) {
  const chip = `<span class="chip">${chipText}</span>`;
  return `<div class="tile ${statusKey}"><div class="l">${label}</div><div class="v">${value}</div>${sub ? `<div class="s">${sub}</div>` : ''}
<div class="foot">${chipAbove ? chip : ''}${barHtml}<div class="row"><span>${target}</span>${chipAbove ? '' : chip}</div></div></div>`;
}

// Today's marker: a vertical line at the last day with data, and the % vs goal and vs last month written
// next to where those lines cross it, so they read as month-to-date numbers
function todayMarker(ch, x, y, top, bottom, value, mo) {
  const xt = x(ch.day), right = xt < 640;
  const tx = right ? xt + 16 : xt - 16, anchor = right ? 'start' : 'end';
  const labels = [{ v: ch.goal[ch.day - 1], color: '#ff7a58', text: 'vs goal' }];
  if (ch.priorSameDay != null) labels.push({ v: ch.priorSameDay, color: '#9fb0ff', text: `vs ${monthShort(ch.priorMonth)} same day` });
  for (const l of labels) l.y = y(l.v);
  // keep the two labels at least 40px apart
  if (labels.length === 2 && Math.abs(labels[0].y - labels[1].y) < 40) {
    const mid = (labels[0].y + labels[1].y) / 2, up = labels[0].y <= labels[1].y ? 0 : 1;
    labels[up].y = mid - 20; labels[1 - up].y = mid + 20;
  }
  const txt = (l) => `<text x="${tx}" y="${(l.y + 7).toFixed(1)}" text-anchor="${anchor}" font-size="20" font-weight="800" fill="${l.color}" paint-order="stroke" stroke="#0f0f0e" stroke-width="8" stroke-linejoin="round">${delta(value, l.v)}<tspan font-size="14" font-weight="600" fill="rgba(252,246,226,.75)" dx="6">${l.text} ${$(l.v)}</tspan></text>`;
  return `<line x1="${xt}" x2="${xt}" y1="${top}" y2="${bottom}" stroke="#ffffff" stroke-width="2" stroke-dasharray="4 4"/>
<text x="${xt}" y="${top - 2}" text-anchor="middle" font-size="13" font-weight="700" fill="#f0cd2b">TODAY · ${mo} ${ch.day}</text>
${labels.map((l) => `<circle cx="${xt}" cy="${y(l.v).toFixed(1)}" r="5" fill="${l.color}" stroke="#0f0f0e" stroke-width="2"/>`).join('')}
${labels.map(txt).join('')}`;
}

function chart(ch, target, value, mo) {
  const W = 940, H = 360, P = { l: 60, r: 30, t: 34, b: 30 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const top = Math.max(target, ...ch.daily, ...(ch.prior ?? []));
  const x = (d) => P.l + ((d - 1) * iw) / (ch.dim - 1);
  const y = (v) => P.t + (1 - Math.max(0, v) / top) * ih;
  const pts = (arr) => arr.map((v, i) => `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = ch.daily.length;
  const area = `M ${x(1)},${y(0)} ${ch.daily.map((v, i) => `L ${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} L ${x(last)},${y(0)} Z`;
  const ticks = [0, 0.5, 1].map((f) => f * top);
  const days = [...new Set([1, 8, 15, 22, ch.dim])];
  const axis = 'rgba(252,246,226,.5)';
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Inter, sans-serif">
${ticks.map((v) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(252,246,226,.10)"/><text x="${P.l - 10}" y="${y(v) + 4}" text-anchor="end" font-size="13" font-weight="600" fill="${axis}">${v ? $(v) : '$0'}</text>`).join('')}
<path d="${area}" fill="rgba(252,208,64,.20)"/>
${ch.prior ? `<polyline points="${pts(ch.prior)}" fill="none" stroke="#7d92ff" stroke-width="2.5" opacity=".85"/>` : ''}
<polyline points="${pts(ch.goal)}" fill="none" stroke="#ff7a58" stroke-width="2.5" stroke-dasharray="7 5"/>
<polyline points="${pts(ch.daily)}" fill="none" stroke="#fcf6e2" stroke-width="3.5" stroke-linejoin="round"/>
${todayMarker(ch, x, y, P.t, H - P.b, value, mo)}
<circle cx="${x(last)}" cy="${y(ch.daily[last - 1])}" r="8" fill="#f0cd2b" stroke="#0a0a0a" stroke-width="2.5"/>
${days.map((d) => `<text x="${x(d)}" y="${H - 8}" text-anchor="middle" font-size="13" font-weight="600" fill="${axis}">D${d}</text>`).join('')}
</svg>`;
}

const monthShort = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });

export function closerCard(m, p, month, title) {
  const c = m.cash, ch = c.chart;
  const goalNow = ch ? ch.goal[ch.day - 1] : c.expected;

  const pace = `<div class="pt">
<div class="pt-top">
  <div><div class="pt-caps">Cash collected · ${month.label}</div>
  <div class="pt-stats">
    <div class="pt-caps">Month to date</div>${c.monthTarget ? `<div class="pt-caps">Goal for the whole month</div>` : '<div></div>'}
    <div class="pt-num">${$(c.value ?? 0)}</div>${c.monthTarget ? `<div class="pt-num goal">${$(c.monthTarget)}</div>` : '<div></div>'}
    <div class="pt-cl">${p.closes.actual}<small>close${p.closes.actual === 1 ? '' : 's'}</small></div>${p.closes.target ? `<div class="pt-cl goal">${p.closes.target}<small>closes</small></div>` : '<div></div>'}
  </div>
  </div>
  <div class="pt-right"><span class="pill ${c.status}">${c.pace ? PACE_LABEL[c.pace].toUpperCase() : 'NO TARGET YET'}</span></div>
</div>
${ch ? `<div class="pt-chart">${chart(ch, c.monthTarget, c.value ?? 0, month.label.slice(0, 3))}</div>
<div class="pt-legend"><span><i style="background:#ff7a58"></i>Goal</span>${ch.prior ? `<span><i style="background:#7d92ff"></i>${monthShort(ch.priorMonth)}, same day</span>` : ''}<span><i class="dot"></i>${month.label} to date</span></div>` : ''}
</div>`;

  const sm = m.slotsMtd, lv = m.live, ar = m.avgRevenue;
  const tiles = [
    tile({ label: 'Average weekly slots', value: sm.value ?? '–', statusKey: sm.status,
      sub: sm.booked != null ? `${sm.booked} booked · ${sm.open} open` : sm.value == null ? 'Not a Calendly host yet' : `${sm.open} open`,
      target: `Target ${SLOTS_TARGET}`, barHtml: bar(sm.value, SLOTS_TARGET) }),
    tile({ label: 'Live calls', value: lv.value, statusKey: lv.status,
      target: lv.target == null ? 'No target yet' : `Target ${Math.round(lv.target)}`, barHtml: bar(lv.value, lv.target) }),
    tile({ label: 'Average revenue', value: ar.value == null ? '–' : fmtMoney(ar.value), statusKey: ar.status,
      target: 'Target $17,500', barHtml: bar(ar.value, ar.target) }),
    // Pacing: cash collected month to date vs where the 2M tracker's curve says it should be today
    c.monthTarget ? tile({ label: 'Pacing', value: $(c.value ?? 0), statusKey: c.status,
      target: `Goal to date ${$(goalNow)}`, barHtml: bar(c.value ?? 0, goalNow), chipText: PACE_LABEL[c.pace].toUpperCase(), chipAbove: true })
      : tile({ label: 'Pacing', value: $(c.value ?? 0), statusKey: 'track', target: 'No target yet' }),
  ].join('');

  let weekly = '';
  if (p.weeks) {
    const chip = (key) => `<span class="chip ${key}">${CHIP_TEXT[key]}</span>`;
    const cell = (w, k, fmt) => {
      if (w.phase === 'next') return `<span class="of">Target ${fmt(w.target[k])}</span><br>${chip('next')}`;
      const v = w.actual[k];
      const key = w.phase === 'now' ? 'track' : w.hit[k] == null ? 'track' : w.hit[k] ? 'hit' : 'missed';
      return `<b>${v == null ? '–' : fmt(v)}</b> <span class="of">/ ${fmt(w.target[k])}</span><br>${chip(key)}`;
    };
    const slotCell = (w) => {
      const n = w.next7;
      if (n === undefined) return cell(w, 'slots', String);
      if (n === null) return `<span class="of">Target ${SLOTS_TARGET}</span><small>No Calendly slots yet</small>`;
      return `<b>${n.value}</b> <span class="of">/ ${SLOTS_TARGET}</span><small>Next 7 days${n.booked != null ? `: ${n.booked} booked · ${n.open} open` : ''}</small>`
        + (n.toOpen ? `<span class="chip missed">OPEN ${n.toOpen} MORE</span>` : chip('hit'));
    };
    weekly = `<h2>WEEKS AHEAD</h2>
<table><thead><tr><th>Week</th><th>Cash collected<small>actual / target</small></th><th>Closes<small>actual / target</small></th><th>Slots (booked + open)<small>weekly average / target</small></th></tr></thead><tbody>
${p.weeks.map((w) => `<tr class="${w.phase}"><td><div class="wk">${w.label}</div><small>${w.dates} · ${w.span}</small></td><td>${cell(w, 'cash', $)}${w.carried ? `<small>Includes ${$(w.carried)} carried from earlier weeks</small>` : ''}</td><td>${cell(w, 'closes', String)}</td><td>${slotCell(w)}</td></tr>`).join('\n')}
<tr class="month"><td><div class="wk">${month.label} total</div><small>Month to date vs month goal</small></td>${['cash', 'closes', 'slots'].map((k) => {
      const fmt = k === 'cash' ? $ : String, v = p.month.actual[k];
      return `<td><b>${v == null ? '–' : fmt(v)}</b> <span class="of">/ ${fmt(p.month.target[k])}</span>${k === 'slots' ? '<small>Average per week</small>' : ''}</td>`;
    }).join('')}</tr>
</tbody></table>`;
  }

  const body = `<div class="eyebrow">Closer scorecard · Month to date</div>
<h1>${esc(title)}</h1>
${pace}
<h2>YOUR INPUTS, MONTH TO DATE</h2>
<div class="grid">${tiles}</div>
${weekly}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Closer Scorecard</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,800&display=block"><style>${CSS}</style></head><body><div class="card">${body}</div></body></html>`;
}
