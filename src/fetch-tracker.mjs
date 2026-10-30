// Usage: node src/fetch-tracker.mjs <data.json> <through YYYY-MM-DD>
// Pulls per-closer cash pace from the 2M tracker read API and writes it into the snapshot as
// `trackers["MM-DD"]` (keyed by the last day of the window, so the Monday and Wednesday editions
// each get their own). For the pace chart it also stores each closer's daily cumulative cash this
// month and last month. Targets and the goal curve are NOT taken from the tracker (management-facing):
// the card uses Sheila's closer-facing data/targets/<month>.json (src/targets.mjs).

import fs from 'node:fs';

const [dataPath, through] = process.argv.slice(2);
if (!dataPath || !/^\d{4}-\d{2}-\d{2}$/.test(through ?? '')) {
  console.error('usage: node src/fetch-tracker.mjs <data.json> <through YYYY-MM-DD>');
  process.exit(1);
}
const token = process.env.TRACKER_READ_TOKEN;
if (!token) { console.error('TRACKER_READ_TOKEN is not set'); process.exit(1); }

async function read(path) {
  const res = await fetch(`https://smbdh-2m-tracker.vercel.app/api/read/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    console.error(`tracker read failed (${path.split('?')[0]}): HTTP ${res.status} ${body?.error ?? ''}`);
    process.exit(1);
  }
  return body;
}

const month = through.slice(0, 7);
const day = Number(through.slice(8, 10));
const [y, mo] = month.split('-').map(Number);
const prevMonth = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;

const body = await read(`closers?through=${through}`);
const prev = await read(`closers?month=${prevMonth}`);
const rows = body.data.closers;
const dim = body.data.days_in_month;

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Tracker names follow the Sales Tracker ("Jay Z", "Adam L"); match on full name, short name or first name
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z ]/g, '').trim();
const ALIASES = { JZ: ['jay z', 'jordan zadrozny', 'jordan'] };
function findRow(list, c) {
  const names = [c.name, c.short, c.name.split(' ')[0], ...(ALIASES[c.key] ?? [])].map(norm);
  return list.find((r) => names.includes(norm(r.name)))
    ?? list.find((r) => names.includes(norm(r.name).split(' ')[0]));
}

const closers = {};
const unmatched = [];
for (const c of data.closers) {
  const r = findRow(rows, c);
  if (!r) { unmatched.push(c.key); continue; }
  const p = findRow(prev.data.closers, c);
  closers[c.key] = {
    tracker_name: r.name, rep_id: r.rep_id,
    month_target: r.month_target ?? null, target_source: r.target_source ?? null,
    cash: r.pace?.cash ?? null, expected_cash: r.pace?.expected_cash ?? null,
    pct_of_pace: r.pace?.pct_of_pace ?? null, status: r.pace?.status ?? null,
    through_date: r.pace?.through_date ?? through, cash_mtd: r.cash_mtd ?? null,
    daily_cash: (r.daily_cumulative_cash ?? []).slice(0, day),
    prior_daily_cash: p?.daily_cumulative_cash ?? null,
  };
}

data.trackers = { ...data.trackers, [through.slice(5)]: {
  through, generated_at: body.generated_at, data_pulled_at: body.data_pulled_at,
  all_checks_pass: body.all_checks_pass,
  failed_checks: (body.checks ?? []).filter((ch) => !ch.ok).map((ch) => `${ch.name}: ${ch.detail ?? ''}`.trim()),
  targets_note: body.data.targets_note ?? null,
  days_in_month: dim, prior_month: prevMonth, prior_days_in_month: prev.data.days_in_month,
  unmatched, closers,
} };
delete data.tracker;
fs.writeFileSync(dataPath, JSON.stringify(data, null, 1) + '\n');
console.log(`tracker pace for ${Object.keys(closers).length} closers through ${through}` +
  `${unmatched.length ? `; no tracker row for ${unmatched.join(', ')}` : ''}; all_checks_pass=${body.all_checks_pass}`);
