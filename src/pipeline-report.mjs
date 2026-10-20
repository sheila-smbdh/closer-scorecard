// Usage: node src/pipeline-report.mjs <data.json> <outDir>
// Friday pipeline report: one PNG for #sales-strategy with every closer grouped by pod.
// Per closer, from the current-month section of their Pipeline Review tab: open High Confidence,
// Soft Verbal / Reengaged and Working leads, what has closed, projected cash, and actual cash (tracker).
// KPI: 80% of High Confidence and 50% of Soft Verbal / Reengaged leads closed by month end.

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) {
  console.error('usage: node src/pipeline-report.mjs <data.json> <outDir>');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

export const PODS = [
  { title: "Owen's pod", note: 'Owen and his trainees', keys: ['Owen', 'JZ', 'Adam', 'VeJohn'] },
  { title: "Jay's pod: fully ramped", note: "Jay's trainees", keys: ['Nick', 'Harry', 'Omar', 'Julien'] },
  { title: "Jay's pod: newly ramped", note: 'Month 4', keys: ['Kevin', 'Solomon', 'Daniel'] },
  { title: 'Ramping', note: 'Not fully ramped yet', keys: ['Tyler', 'Oliver'] },
];
export const KPI = { hc: 0.8, sv: 0.5 };

// Pipeline Review statuses. Closed = Closed or Signed (or the Closed? box ticked).
// "Verbal", blanks and personal labels are not counted until the closer picks a standard status.
export function bucket(status, closedBox) {
  const s = status.toLowerCase().trim();
  if (s === 'closed' || s === 'signed' || closedBox === 'TRUE') return 'closed';
  if (s.startsWith('high conf')) return 'hc';
  if (s.startsWith('soft verbal') || s.includes('reengag')) return 'sv';
  if (s.startsWith('working') || s.includes('good call')) return 'working';
  if (s === 'delayed') return 'delayed';
  if (s === 'lost') return 'lost';
  return 'unknown';
}
const money = (v) => {
  const n = Number(String(v).replace(/[$,\s]/g, ''));
  return String(v).trim() === '' || Number.isNaN(n) ? null : n;
};

export function closerRow(data, c) {
  const leads = data.pipeline_leads[c.key];
  const tr = data.tracker?.closers?.[c.key];
  const r = { closer: c, hasTab: !!leads, hc: 0, sv: 0, working: 0, closed: 0, delayed: 0, unknown: 0, unknownLabels: new Set(),
    cashClosed: 0, cashHc: 0, cashSv: 0, noAmount: 0, actual: tr?.cash_mtd ?? null, target: tr?.month_target ?? null };
  for (const [, status, cash, box] of leads ?? []) {
    const b = bucket(status, box);
    if (b === 'lost') continue;
    r[b]++;
    if (b === 'unknown') r.unknownLabels.add(status || '(blank)');
    const amt = money(cash);
    if (['closed', 'hc', 'sv'].includes(b) && amt == null) r.noAmount++;
    if (b === 'closed') r.cashClosed += amt ?? 0;
    if (b === 'hc') r.cashHc += amt ?? 0;
    if (b === 'sv') r.cashSv += amt ?? 0;
  }
  r.needHc = Math.ceil(r.hc * KPI.hc);
  r.needSv = Math.ceil(r.sv * KPI.sv);
  r.projected = r.cashClosed + r.cashHc + r.cashSv;
  r.atKpi = r.cashClosed + r.cashHc * KPI.hc + r.cashSv * KPI.sv;
  return r;
}

const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
const fmt$ = (n) => (n == null ? '–' : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1000)}K`);
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const CSS = `
:root{--ink:#1d1f23;--muted:#5c6168;--line:#e3e1dc;--bg:#fafaf8;--hc:#24843a;--hc-bg:#e4f2e7;
--sv:#7d5f00;--sv-bg:#fbf1cf;--wk:#2d5bb8;--wk-bg:#e5ebf6;--red:#c8423d;--red-bg:#f9e2e1}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
.card{width:1500px;padding:40px 44px 32px;background:var(--bg)}
.eyebrow{font-size:15px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:500}
h1{font-size:38px;font-weight:800;margin:8px 0 6px}
.lede{font-size:18px;color:var(--muted)}
.kpis{display:flex;gap:12px;margin:22px 0 8px}
.kpis div{flex:1;border-radius:12px;padding:14px 18px;font-size:15px;line-height:1.35}
.kpis b{display:block;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}
.k-hc{background:var(--hc-bg)} .k-hc b{color:var(--hc)} .k-sv{background:var(--sv-bg)} .k-sv b{color:var(--sv)}
.k-wk{background:var(--wk-bg)} .k-wk b{color:var(--wk)} .k-cash{background:#fff;border:1px solid var(--line)}
table{border-collapse:separate;border-spacing:0 5px;width:100%;font-size:16px}
th{font-size:12px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);text-align:right;padding:2px 12px;font-weight:700;vertical-align:bottom;line-height:1.3}
th:first-child{text-align:left}
td{padding:10px 12px;background:#fff;border-top:1px solid var(--line);border-bottom:1px solid var(--line);text-align:right;vertical-align:middle}
td:first-child{text-align:left;border-left:1px solid var(--line);border-radius:10px 0 0 10px;font-weight:700}
td:last-child{border-right:1px solid var(--line);border-radius:0 10px 10px 0}
tr.pod td{background:none;border:none;padding:18px 4px 2px;text-align:left;font-size:15px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--wk)}
tr.pod span{font-weight:500;color:var(--muted);text-transform:none;letter-spacing:0;margin-left:8px}
tr.tot td{background:#f1f0ec;font-weight:700}
.n{font-size:22px;font-weight:800} .hc{color:var(--hc)} .sv{color:var(--sv)} .wk{color:var(--wk)}
.sub{display:block;font-size:12.5px;color:var(--muted);font-weight:500;margin-top:2px}
.warn{display:block;font-size:12.5px;color:var(--red);font-weight:600;margin-top:2px}
.na{color:var(--muted);font-weight:500;font-size:14px}
.pct{display:inline-block;font-size:12.5px;font-weight:700;border-radius:999px;padding:2px 8px;margin-left:6px}
.p-hit{background:var(--hc-bg);color:var(--hc)} .p-mid{background:var(--sv-bg);color:var(--sv)} .p-low{background:var(--red-bg);color:var(--red)}
.footer{margin-top:22px;padding-top:14px;border-top:1px solid var(--line);font-size:13.5px;line-height:1.55;color:var(--muted)}
`;

function pctChip(actual, projected) {
  if (!projected || actual == null) return '';
  const p = actual / projected;
  const cls = p >= 0.8 ? 'p-hit' : p >= 0.5 ? 'p-mid' : 'p-low';
  return `<span class="pct ${cls}">${Math.round(p * 100)}%</span>`;
}

function cells(r, isTotal = false) {
  if (!r.hasTab && !isTotal) {
    return `<td colspan="5" style="text-align:left"><span class="na">No Pipeline Review tab yet</span></td>
      <td><span class="n">${fmt$(r.actual)}</span>${r.target ? `<span class="sub">target ${fmt$(r.target)}</span>` : ''}</td>`;
  }
  const flags = [];
  if (r.unknown) flags.push(`${r.unknown} need a status`);
  if (r.noAmount) flags.push(`${r.noAmount} missing $`);
  return `
    <td><span class="n hc">${r.hc}</span><span class="sub">close ${r.needHc} for 80%</span></td>
    <td><span class="n sv">${r.sv}</span><span class="sub">close ${r.needSv} for 50%</span></td>
    <td><span class="n wk">${r.working}</span><span class="sub">no KPI yet</span></td>
    <td><span class="n">${r.closed}</span><span class="sub">${r.delayed} delayed</span>${flags.length ? `<span class="warn">${flags.join(' · ')}</span>` : ''}</td>
    <td><span class="n">${fmt$(r.projected)}</span><span class="sub">at KPI ${fmt$(r.atKpi)}</span></td>
    <td><span class="n">${fmt$(r.actual)}</span>${pctChip(r.actual, r.projected)}<span class="sub">${r.target ? `target ${fmt$(r.target)}` : '&nbsp;'}</span></td>`;
}

function totalRow(label, rows) {
  const t = { hasTab: true };
  for (const k of ['hc', 'sv', 'working', 'closed', 'delayed', 'unknown', 'noAmount', 'needHc', 'needSv', 'projected', 'atKpi', 'actual', 'target']) t[k] = sum(rows, k);
  return `<tr class="tot"><td>${label}</td>${cells(t, true)}</tr>`;
}

export function reportHtml(data, rows) {
  const byKey = Object.fromEntries(rows.map((r) => [r.closer.key, r]));
  const name = (c) => (c.key === 'JZ' ? 'Jay Z (Jordan)' : c.short);
  const body = PODS.map((pod) => {
    const pr = pod.keys.map((k) => byKey[k]).filter(Boolean);
    return `<tr class="pod"><td colspan="7">${esc(pod.title)}<span>${esc(pod.note)}</span></td></tr>
      ${pr.map((r) => `<tr><td>${esc(name(r.closer))}</td>${cells(r)}</tr>`).join('')}
      ${pr.filter((r) => r.hasTab).length > 1 ? totalRow('Pod total', pr) : ''}`;
  }).join('');
  const all = rows;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="card">
  <div class="eyebrow">Pipeline review · ${esc(data.month)} · as of ${esc(data.as_of_label)}</div>
  <h1>Where every closer's ${esc(data.month)} pipeline stands</h1>
  <div class="lede">Open leads by status from each closer's ${esc(data.month)} section of Pipeline Review, with projected vs actual cash.</div>
  <div class="kpis">
    <div class="k-hc"><b>High Confidence</b>80% should close by month end</div>
    <div class="k-sv"><b>Soft Verbal / Reengaged</b>50% should close by month end</div>
    <div class="k-wk"><b>Working / Good call</b>No KPI yet. Some should close</div>
    <div class="k-cash"><b>Cash</b>Projected = closed + open HC + SV. At KPI = closed + 80% HC + 50% SV</div>
  </div>
  <table>
    <tr><th>Closer</th><th>High Confidence<br>open</th><th>Soft Verbal /<br>Reengaged open</th><th>Working<br>open</th><th>Closed or signed<br>this month</th><th>Projected cash</th><th>Actual cash<br>collected</th></tr>
    ${body}
    ${totalRow('All closers', all)}
  </table>
  <div class="footer">
    Closed counts Closed and Signed. Delayed and Lost are not open. "Need a status": blank, "Verbal" or a personal label; those leads are left out until the closer picks High Confidence, Soft Verbal / Reengaged or Working.
    Actual cash: ${esc(data.cash_label)}. The % chip is actual ÷ projected.
  </div>
  </div></body></html>`;
}

const rows = data.closers.map((c) => closerRow(data, c));
fs.mkdirSync(outDir, { recursive: true });
const html = reportHtml(data, rows);
const base = path.join(outDir, `pipeline-${data.report_date}`);
fs.writeFileSync(`${base}.html`, html);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1500, height: 900 } });
await page.setContent(html, { waitUntil: 'load' });
await page.locator('.card').screenshot({ path: `${base}.png` });
await browser.close();

// Flags for Sheila
const flags = [];
for (const r of rows) {
  if (!r.hasTab) flags.push(`${r.closer.short}: no Pipeline Review tab`);
  if (r.unknown) flags.push(`${r.closer.short}: ${r.unknown} leads need a status (${[...r.unknownLabels].join(', ')})`);
  if (r.noAmount) flags.push(`${r.closer.short}: ${r.noAmount} closed/HC/SV leads have no cash amount`);
  if (r.actual == null) flags.push(`${r.closer.short}: no tracker cash`);
}
fs.writeFileSync(`${base}-flags.md`, `# Pipeline report flags: ${data.report_date}\n\n${flags.map((f) => `- ${f}`).join('\n') || '- None'}\n`);
console.log(`wrote ${base}.png, ${flags.length} flags`);
