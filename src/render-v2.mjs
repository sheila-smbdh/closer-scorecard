// v2 (simplified) closer card, for review: pace chart with the headline numbers, month-to-date inputs, and
// weekly targets (last week's target vs actual, and this week's target). Nothing else.

import { fmtPct, fmtMoney } from './metrics.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = (v) => (v != null && Math.abs(v) >= 1000 ? `$${Math.round(v / 1000)}K` : fmtMoney(v, true));
const delta = (a, b) => (b ? `${a >= b ? '+' : '−'}${Math.abs(Math.round(((a - b) / b) * 100))}%` : '–');
const PACE = { hit: 'ON PACE', almost: 'SLIGHTLY BEHIND', missed: 'OFF PACE', track: 'NO TARGET YET' };
const CHIP = { hit: 'HIT', almost: 'ALMOST', missed: 'MISSED', track: 'TRACKING' };

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
.pt-deltas{display:flex;gap:18px;margin-top:12px;font-size:19px;font-weight:700}
.down{color:#ff7a58} .up{color:#6fd08a}
.pt-deltas span small{font-size:14px;font-weight:600;color:rgba(252,246,226,.6);margin-left:4px}
.pt-right{text-align:right}
.pill{display:inline-block;font-size:22px;font-weight:900;letter-spacing:.06em;border-radius:12px;padding:12px 22px;color:#0f0f0e}
.pill.hit{background:#6fd08a} .pill.almost{background:#f0cd2b} .pill.missed{background:#ff7a58} .pill.track{background:#9fb0ff}
.pt-closes{margin-top:16px;font-size:15px;color:rgba(252,246,226,.7)}
.pt-closes b{display:block;font-family:Fraunces,Georgia,serif;font-size:40px;font-weight:800;color:#fcf6e2;line-height:1.1}
.pt-closes b span{font-size:22px;color:rgba(252,246,226,.6)}
.pt-chart{margin-top:18px}
.pt-chart svg{display:block}
.pt-legend{display:flex;gap:22px;font-size:14px;font-weight:600;color:rgba(252,246,226,.85);margin-top:8px}
.pt-legend i{display:inline-block;width:16px;height:3px;border-radius:2px;margin-right:8px;vertical-align:4px}
.pt-legend i.dot{width:11px;height:11px;border-radius:50%;background:#f0cd2b;vertical-align:-1px}
/* tiles */
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.tile{border-radius:12px;border-left:6px solid;padding:16px 18px 14px;display:flex;flex-direction:column;min-height:190px}
.tile.hit{background:var(--hit-bg);border-color:var(--hit)} .tile.hit .v{color:var(--hit)}
.tile.almost{background:var(--almost-bg);border-color:var(--almost)} .tile.almost .v{color:var(--almost-ink)}
.tile.missed{background:var(--missed-bg);border-color:var(--missed)} .tile.missed .v{color:var(--missed)}
.tile.track{background:var(--track-bg);border-color:var(--track)} .tile.track .v{color:var(--track)}
.tile .l{font-size:14px;letter-spacing:.08em;font-weight:700;text-transform:uppercase}
.tile .v{font-size:40px;font-weight:800;margin:8px 0 4px;letter-spacing:-.01em}
.tile .v span{font-size:24px;font-weight:700;opacity:.75}
.tile .s{font-size:15px;color:#3d4248}
.tile .foot{margin-top:auto;padding-top:12px}
.bar{position:relative;height:8px;background:rgba(0,0,0,.07);border-radius:4px;margin-bottom:10px}
.bar i{position:absolute;left:0;top:0;bottom:0;border-radius:4px}
.bar b{position:absolute;top:-5px;width:3px;height:18px;background:var(--ink);border-radius:1px}
.hit .bar i{background:var(--hit)} .almost .bar i{background:var(--almost)} .missed .bar i{background:var(--missed)} .track .bar i{background:var(--track)}
.row{display:flex;justify-content:space-between;align-items:center;font-size:14px;color:#3d4248}
.chip{font-size:12px;font-weight:700;letter-spacing:.05em;color:#fff;border-radius:999px;padding:4px 10px}
.hit .chip,.chip.hit{background:var(--hit)} .almost .chip,.chip.almost{background:var(--almost);color:#3a2c00}
.missed .chip,.chip.missed{background:var(--missed)} .track .chip,.chip.track{background:var(--track)}
/* weekly targets */
.gap{display:flex;gap:12px;margin-bottom:12px}
.gap div{flex:1;background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 18px}
.gap small{display:block;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.gap b{font-size:30px;font-weight:800}
table{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:17px}
th{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:700;text-align:left;padding:14px 18px;background:#f4f2ee;vertical-align:bottom}
th small{display:block;font-weight:500;letter-spacing:0;text-transform:none;font-size:13px}
td{padding:14px 18px;border-top:1px solid var(--line)}
td:first-child{font-weight:700}
td.next{background:#fffbea;font-size:22px;font-weight:800}
th.next{background:#f0cd2b;color:#1d1f23}
td .chip{margin-left:10px;vertical-align:2px}
`;

function bar(value, target) {
  if (target == null || value == null) return '';
  const max = Math.max(target, value) / 0.85;
  return `<div class="bar"><i style="width:${Math.min(100, (value / max) * 100)}%"></i><b style="left:${(target / max) * 100}%"></b></div>`;
}

function tile({ label, value, sub, statusKey, target, barHtml = '' }) {
  return `<div class="tile ${statusKey}"><div class="l">${label}</div><div class="v">${value}</div>${sub ? `<div class="s">${sub}</div>` : ''}
<div class="foot">${barHtml}<div class="row"><span>${target}</span><span class="chip">${CHIP[statusKey]}</span></div></div></div>`;
}

function chart(ch, target) {
  const W = 940, H = 340, P = { l: 60, r: 30, t: 14, b: 30 };
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
<circle cx="${x(last)}" cy="${y(ch.daily[last - 1])}" r="8" fill="#f0cd2b" stroke="#0a0a0a" stroke-width="2.5"/>
${days.map((d) => `<text x="${x(d)}" y="${H - 8}" text-anchor="middle" font-size="13" font-weight="600" fill="${axis}">D${d}</text>`).join('')}
</svg>`;
}

const monthShort = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });

export function closerCardV2(m, p, month, title) {
  const c = m.cash, ch = c.chart;
  const goalNow = ch ? ch.goal[ch.day - 1] : c.expected;

  const pace = `<div class="pt">
<div class="pt-top">
  <div><div class="pt-caps">Cash collected · ${month.label}</div>
  <div class="pt-num">${$(c.value ?? 0)}</div>
  ${c.monthTarget ? `<div class="pt-deltas"><span class="${c.value >= goalNow ? 'up' : 'down'}">${delta(c.value ?? 0, goalNow)}<small>vs goal ${$(goalNow)}</small></span>${ch?.priorSameDay
    ? `<span class="${c.value >= ch.priorSameDay ? 'up' : 'down'}">${delta(c.value ?? 0, ch.priorSameDay)}<small>vs ${monthShort(ch.priorMonth)} same day</small></span>` : ''}</div>` : ''}</div>
  <div class="pt-right"><span class="pill ${c.status}">${PACE[c.status]}</span>
  ${p.closes.target ? `<div class="pt-closes">Closes this month<b>${p.closes.actual} <span>/ ${p.closes.target} target</span></b></div>` : ''}</div>
</div>
${ch ? `<div class="pt-chart">${chart(ch, c.monthTarget)}</div>
<div class="pt-legend"><span><i style="background:#ff7a58"></i>Goal</span>${ch.prior ? `<span><i style="background:#7d92ff"></i>${monthShort(ch.priorMonth)}, same day</span>` : ''}<span><i class="dot"></i>${month.label} to date</span></div>` : ''}
</div>`;

  const sm = m.slotsMtd, lv = m.live, ar = m.avgRevenue, cm = p.commit;
  const tiles = [
    tile({ label: 'Average weekly slots', value: sm.value ?? '–', statusKey: sm.status,
      sub: sm.booked != null ? `${sm.booked} booked · ${sm.open} open` : sm.value == null ? 'Not a Calendly host yet' : `${sm.open} open`,
      target: 'Target 25', barHtml: bar(sm.value, 25) }),
    tile({ label: 'Live calls', value: lv.value, statusKey: lv.status,
      target: lv.target == null ? 'No target yet' : `Target ${Math.round(lv.target)}`, barHtml: bar(lv.value, lv.target) }),
    tile({ label: 'Average revenue', value: ar.value == null ? '–' : fmtMoney(ar.value), statusKey: ar.status,
      target: 'Target $17,500', barHtml: bar(ar.value, ar.target) }),
    cm ? tile({ label: 'Commitments closed', value: `${cm.kept} <span>/ ${cm.committed}</span>`, statusKey: cm.status,
      sub: `${fmtPct(cm.rate)} of High Confidence + Soft Verbal`,
      target: `On track: ${fmtPct(cm.expectedShare)}`, barHtml: bar(cm.kept, cm.committed * cm.expectedShare) })
      : tile({ label: 'Commitments closed', value: '–', statusKey: 'track', sub: 'No pipeline tab yet', target: '' }),
  ].join('');

  let weekly = '';
  if (p.weeks) {
    const w = p.weeks, l = w.last;
    const res = (hit) => (hit == null ? '' : `<span class="chip ${hit ? 'hit' : 'missed'}">${hit ? 'HIT' : 'MISSED'}</span>`);
    const d0 = Number(m.ed.week_days[0].slice(3)), d1 = Number(m.ed.through_key.slice(3));
    const mo = month.label.slice(0, 3);
    weekly = `<h2>WEEKLY TARGETS</h2>
<div class="gap"><div><small>Gap to target</small><b>${$(p.gap.cash)}</b></div><div><small>Closes to go</small><b>${p.gap.closes}</b></div><div><small>Business days left</small><b>${c.daysLeft}</b></div></div>
<table><thead><tr><th></th><th>Last week target<small>${mo} ${d0} to ${d1}</small></th><th>Last week actual</th><th class="next">This week target<small>${mo} ${d1 + 1} to ${w.next.toEnd ? 'month end' : d1 + 7}</small></th></tr></thead><tbody>
<tr><td>Closes</td><td>${l.target.closes}</td><td>${l.actual.closes}${res(l.hit.closes)}</td><td class="next">${w.next.closes}</td></tr>
<tr><td>Cash collected</td><td>${$(l.target.cash)}</td><td>${$(l.actual.cash)}${res(l.hit.cash)}</td><td class="next">${$(w.next.cash)}</td></tr>
<tr><td>Slots (booked + open)</td><td>${l.target.slots}</td><td>${l.actual.slots ?? '–'}${res(l.hit.slots)}</td><td class="next">${w.next.slots}</td></tr>
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
