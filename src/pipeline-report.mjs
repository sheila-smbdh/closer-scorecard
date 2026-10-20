// Usage: node src/pipeline-report.mjs <data.json> <outDir>
// Friday pipeline report: one PNG for #sales-strategy with every closer grouped by pod.
// Per closer, from the current-month section of their Pipeline Review tab: open High Confidence,
// Soft Verbal / Reengaged and Working leads, what has closed (confirmed against Close), projected
// cash, and actual cash collected (Close "Cash Collected" on won opportunities this month).
// KPI: 80% of High Confidence and 50% of Soft Verbal / Reengaged leads closed by month end.
//
// Labeling convention (from Oct 2026): column B = category (High Confidence / Soft Verbal /
// Working), column F = outcome (Closed / Signed / Delayed). Until every tab has switched, an
// outcome written in column B is still read, and the lead's category comes from the last
// snapshot that saw it open. Every run writes a snapshot of each lead's bucket for that reason.

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) {
  console.error('usage: node src/pipeline-report.mjs <data.json> <outDir>');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const SNAP_DIR = path.join(path.dirname(dataPath), 'pipeline-snapshots');

export const PODS = [
  { title: "Owen's pod", note: 'Owen and his trainees', keys: ['Owen', 'JZ', 'Adam', 'VeJohn'] },
  { title: "Jay's pod: fully ramped", note: "Jay's trainees", keys: ['Nick', 'Harry', 'Omar', 'Julien'] },
  { title: "Jay's pod: newly ramped", note: 'Month 4', keys: ['Kevin', 'Solomon', 'Daniel'] },
  { title: 'Ramping', note: 'Not fully ramped yet', keys: ['Tyler', 'Oliver'] },
];
export const KPI = { hc: 0.8, sv: 0.5 };
const CAT_LABEL = { hc: 'High Confidence', sv: 'Soft Verbal / Reengaged', working: 'Working', unknown: 'not recorded' };

// Column B: the lead's category. "Verbal" counts as High Confidence (flagged so the label gets fixed).
export function category(b) {
  const s = b.toLowerCase().trim();
  if (s.startsWith('high conf')) return 'hc';
  if (s === 'verbal') return 'hc';
  if (s.startsWith('soft verbal') || s.includes('reengag')) return 'sv';
  if (s.startsWith('working') || s.includes('good call')) return 'working';
  return null;
}
// Outcome from column F (new convention) or column B (old). Only Closed and Signed count as closed.
export function outcome(b, f) {
  const fs_ = f.toLowerCase().trim(), bs = b.toLowerCase().trim();
  if (['closed', 'signed'].includes(fs_) || fs_ === 'true') return 'closed';
  if (fs_ === 'delayed') return 'delayed';
  if (['closed', 'signed'].includes(bs)) return 'closed';
  if (bs === 'delayed') return 'delayed';
  if (bs === 'lost' || fs_ === 'lost') return 'lost';
  return null;
}
const money = (v) => {
  const n = Number(String(v).replace(/[$,\s]/g, ''));
  return String(v).trim() === '' || Number.isNaN(n) ? null : n;
};
const norm = (s) => s.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
// Same person if one first name starts the other and last initials match ("Josh" = "Joshua", "Gee Vee" = "Gee Varughese")
const sameName = (a, b) => {
  const x = norm(a), y = norm(b);
  return x.length && y.length && (x[0].startsWith(y[0]) || y[0].startsWith(x[0])) && x.at(-1)[0] === y.at(-1)[0];
};

// Category each lead was last seen open under, from earlier snapshots (by Close lead id, then name)
function priorCategories() {
  const seen = {};
  if (!fs.existsSync(SNAP_DIR)) return seen;
  for (const f of fs.readdirSync(SNAP_DIR).filter((f) => f.endsWith('.json') && f.slice(0, 10) < data.report_date).sort()) {
    const snap = JSON.parse(fs.readFileSync(path.join(SNAP_DIR, f), 'utf8'));
    for (const [key, leads] of Object.entries(snap.closers)) {
      for (const l of leads) if (l.category && l.category !== 'unknown') seen[`${key}|${l.lead_id || l.name.toLowerCase()}`] = l.category;
    }
  }
  return seen;
}
const prior = priorCategories();

export function closerRow(data, c) {
  const raw = data.pipeline_leads[c.key];
  const leads = Array.isArray(raw) ? raw : raw?.leads;
  const paid = data.close_won.filter(([k]) => k === c.key).map(([, contact, lead_id, cash, date]) => ({ contact, lead_id, cash, date, used: false }));
  const r = { closer: c, hasTab: !!leads, leads: [], flags: [],
    open: { hc: 0, sv: 0, working: 0 }, won: { hc: 0, sv: 0, working: 0, unknown: 0 }, delayed: 0, closed: 0, confirmed: 0,
    cashClosed: 0, cashHc: 0, cashSv: 0, noAmount: 0, labels: new Set(),
    actual: paid.reduce((a, p) => a + p.cash, 0), deals: paid.length };

  for (const [name, b, cash, f, lead_id] of leads ?? []) {
    const out = outcome(b, f);
    let cat = category(b);
    if (b.trim().toLowerCase() === 'verbal') r.labels.add('"Verbal" (counted as High Confidence)');
    if (!cat) cat = prior[`${c.key}|${lead_id || name.toLowerCase()}`] ?? (out ? 'unknown' : null);
    if (!cat && !out) r.labels.add(b ? `"${b}"` : 'blank status');
    const amt = money(cash);
    const p = paid.find((x) => !x.used && ((lead_id && x.lead_id === lead_id) || (x.contact && sameName(x.contact, name))));
    if (p) p.used = true;
    const lead = { name, lead_id, status_b: b, outcome_f: f, category: cat ?? 'none', outcome: out ?? 'open', cash: amt, close_paid: p?.cash ?? null, close_paid_date: p?.date ?? null };
    r.leads.push(lead);

    if (out === 'lost') continue;
    if (out === 'delayed') { r.delayed++; continue; }
    if (out === 'closed') {
      r.closed++; r.won[cat]++; r.cashClosed += p?.cash ?? amt ?? 0;
      if (p) {
        r.confirmed++;
        if (amt != null && amt !== p.cash) r.flags.push(`${name}: sheet $${amt.toLocaleString()} vs Close cash collected $${p.cash.toLocaleString()}`);
        if (amt == null) r.flags.push(`${name}: no cash amount on the sheet; Close shows $${p.cash.toLocaleString()}`);
      } else r.flags.push(`${name}: ${b || f} on the sheet but no paid, won opportunity in Close this month`);
      continue;
    }
    if (!cat) continue; // open with no usable status: listed in flags via labels
    r.open[cat]++;
    if (cat === 'hc' || cat === 'sv') {
      if (amt == null) r.noAmount++;
      if (cat === 'hc') r.cashHc += amt ?? 0; else r.cashSv += amt ?? 0;
    }
    if (p) r.flags.push(`${name}: paid $${p.cash.toLocaleString()} in Close on ${p.date}, sheet still says ${b || 'blank'}`);
  }
  for (const p of paid.filter((x) => !x.used)) {
    const where = data.pipeline_index?.[p.lead_id];
    r.flags.push(`${p.contact || where?.[1] || p.lead_id}: paid $${p.cash.toLocaleString()} in Close on ${p.date}, ` +
      (where ? `listed in the ${where[0]} section as ${where[2] || 'blank'}` : 'not on Pipeline Review'));
  }
  if (r.labels.size) r.flags.unshift(`status labels to fix: ${[...r.labels].join(', ')}`);
  if (r.noAmount) r.flags.push(`${r.noAmount} open High Confidence / Soft Verbal leads have no cash amount`);

  const goal = (cat, rate) => {
    const total = r.open[cat] + r.won[cat];
    return { total, need: Math.max(0, Math.ceil(total * rate) - r.won[cat]) };
  };
  r.hcGoal = goal('hc', KPI.hc);
  r.svGoal = goal('sv', KPI.sv);
  r.projected = r.cashClosed + r.cashHc + r.cashSv;
  r.ifKpi = r.cashClosed + r.cashHc * KPI.hc + r.cashSv * KPI.sv;
  return r;
}

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
.ok{display:block;font-size:12.5px;color:var(--hc);font-weight:600;margin-top:2px}
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

const goalText = (g, won, pct) => (g.total ? `${won} closed · ${g.need ? `${g.need} more for ${pct}` : `${pct} hit`}` : '&nbsp;');

function cells(r) {
  if (!r.hasTab) {
    return `<td colspan="5" style="text-align:left"><span class="na">No Pipeline Review tab yet</span></td>
      <td><span class="n">${fmt$(r.actual)}</span><span class="sub">${r.deals} paid in Close</span></td>`;
  }
  const unpaid = r.closed - r.confirmed;
  return `
    <td><span class="n hc">${r.open.hc}</span><span class="sub">${goalText(r.hcGoal, r.won.hc, '80%')}</span></td>
    <td><span class="n sv">${r.open.sv}</span><span class="sub">${goalText(r.svGoal, r.won.sv, '50%')}</span></td>
    <td><span class="n wk">${r.open.working}</span><span class="sub">${r.won.working} closed</span></td>
    <td><span class="n">${r.closed}</span><span class="sub">${r.delayed} delayed</span>${unpaid ? `<span class="warn">${unpaid} not paid in Close</span>` : r.closed ? '<span class="ok">all paid in Close</span>' : ''}</td>
    <td><span class="n">${fmt$(r.projected)}</span><span class="sub">if KPIs hit ${fmt$(r.ifKpi)}</span></td>
    <td><span class="n">${fmt$(r.actual)}</span>${pctChip(r.actual, r.projected)}<span class="sub">${r.deals} paid in Close</span></td>`;
}

function total(rows) {
  const t = { hasTab: true, open: { hc: 0, sv: 0, working: 0 }, won: { hc: 0, sv: 0, working: 0 }, hcGoal: { total: 0, need: 0 }, svGoal: { total: 0, need: 0 } };
  for (const k of ['closed', 'confirmed', 'delayed', 'projected', 'ifKpi', 'actual', 'deals']) t[k] = rows.reduce((a, r) => a + r[k], 0);
  for (const r of rows.filter((r) => r.hasTab)) {
    for (const c of ['hc', 'sv', 'working']) { t.open[c] += r.open[c]; t.won[c] += r.won[c]; }
    for (const g of ['hcGoal', 'svGoal']) { t[g].total += r[g].total; t[g].need += r[g].need; }
  }
  return t;
}

export function reportHtml(data, rows) {
  const byKey = Object.fromEntries(rows.map((r) => [r.closer.key, r]));
  const name = (c) => (c.key === 'JZ' ? 'Jay Z (Jordan)' : c.short);
  const body = PODS.map((pod) => {
    const pr = pod.keys.map((k) => byKey[k]).filter(Boolean);
    return `<tr class="pod"><td colspan="7">${esc(pod.title)}<span>${esc(pod.note)}</span></td></tr>
      ${pr.map((r) => `<tr><td>${esc(name(r.closer))}</td>${cells(r)}</tr>`).join('')}
      ${pr.filter((r) => r.hasTab).length > 1 ? `<tr class="tot"><td>Pod total</td>${cells(total(pr))}</tr>` : ''}`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="card">
  <div class="eyebrow">Pipeline review · ${esc(data.month)} · as of ${esc(data.as_of_label)}</div>
  <h1>Where every closer's ${esc(data.month)} pipeline stands</h1>
  <div class="lede">Open leads by status from each closer's ${esc(data.month)} section of Pipeline Review. Closes and cash checked against Close.</div>
  <div class="kpis">
    <div class="k-hc"><b>High Confidence</b>80% should close by month end</div>
    <div class="k-sv"><b>Soft Verbal / Reengaged</b>50% should close by month end</div>
    <div class="k-wk"><b>Working / Good call</b>Some should close</div>
    <div class="k-cash"><b>Cash</b>Projected = closed + every open HC and SV lead. If KPIs hit = closed + 80% of HC + 50% of SV</div>
  </div>
  <table>
    <tr><th>Closer</th><th>High Confidence<br>open</th><th>Soft Verbal /<br>Reengaged open</th><th>Working<br>open</th><th>Closed or signed<br>this month</th><th>Projected cash</th><th>Actual cash<br>collected</th></tr>
    ${body}
    <tr class="tot"><td>All closers</td>${cells(total(rows))}</tr>
  </table>
  <div class="footer">
    Closed = Closed or Signed. Delayed and Lost are not open and not closed. Projected cash uses each lead's amount in column D.
    Actual cash = Cash Collected on won Close opportunities closed this month (pulled ${esc(data.close_pulled_at)}). The % chip is actual ÷ projected.
    "N closed" under each category counts closes whose category was recorded on an earlier run.
  </div>
  </div></body></html>`;
}

const rows = data.closers.map((c) => closerRow(data, c));
fs.mkdirSync(outDir, { recursive: true });
const base = path.join(outDir, `pipeline-${data.report_date}`);
const html = reportHtml(data, rows);
fs.writeFileSync(`${base}.html`, html);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1500, height: 900 } });
await page.setContent(html, { waitUntil: 'load' });
await page.locator('.card').screenshot({ path: `${base}.png` });
await browser.close();

// Snapshot of every lead's bucket, so a lead's category survives its status changing to Closed
fs.mkdirSync(SNAP_DIR, { recursive: true });
const snap = { report_date: data.report_date, month: data.month, closers: Object.fromEntries(rows.filter((r) => r.hasTab).map((r) => [r.closer.key, r.leads])) };
fs.writeFileSync(path.join(SNAP_DIR, `${data.report_date}.json`), JSON.stringify(snap, null, 1) + '\n');

// Lead notes and flags for Sheila
const notes = rows.filter((r) => r.hasTab).map((r) => {
  const line = (l) => `| ${l.name} | ${l.status_b || '(blank)'} | ${l.outcome_f || ''} | ${CAT_LABEL[l.category] ?? '–'} | ${l.outcome} | ${l.close_paid ? `$${l.close_paid.toLocaleString()} on ${l.close_paid_date}` : ''} |`;
  return `## ${r.closer.short}\n\n| Lead | Column B | Column F | Bucket | Outcome | Paid in Close |\n|---|---|---|---|---|---|\n${r.leads.map(line).join('\n')}\n`;
}).join('\n');
fs.writeFileSync(`${base}-leads.md`, `# Lead buckets: ${data.month}, as of ${data.report_date}\n\n${notes}`);

const flags = rows.flatMap((r) => [
  ...(r.hasTab ? [] : [`${r.closer.short}: no Pipeline Review tab`]),
  ...r.flags.map((f) => `${r.closer.short}: ${f}`),
]);
const setterPaid = data.close_won.filter(([k]) => !data.closers.some((c) => c.key === k));
for (const [k, contact, , cash, date] of setterPaid) flags.push(`${k} (not a closer): paid $${cash.toLocaleString()} in Close on ${date}${contact ? ` (${contact})` : ''}`);
fs.writeFileSync(`${base}-flags.md`, `# Pipeline report flags: ${data.report_date}\n\n${flags.map((f) => `- ${f}`).join('\n') || '- None'}\n`);
console.log(`wrote ${base}.png, ${flags.length} flags`);
