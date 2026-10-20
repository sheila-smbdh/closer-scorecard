// Usage: node src/fetch-tracker.mjs <data.json> <through YYYY-MM-DD>
// Pulls per-closer cash pace from the 2M tracker read API (/api/read/closers) and writes it into the
// snapshot as `tracker`, keyed by closer key. Needs TRACKER_READ_TOKEN; the token is never printed.

import fs from 'node:fs';

const [dataPath, through] = process.argv.slice(2);
if (!dataPath || !/^\d{4}-\d{2}-\d{2}$/.test(through ?? '')) {
  console.error('usage: node src/fetch-tracker.mjs <data.json> <through YYYY-MM-DD>');
  process.exit(1);
}
const token = process.env.TRACKER_READ_TOKEN;
if (!token) { console.error('TRACKER_READ_TOKEN is not set'); process.exit(1); }

const url = `https://smbdh-2m-tracker.vercel.app/api/read/closers?through=${through}`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const body = await res.json().catch(() => null);
if (!res.ok || !body?.ok) {
  console.error(`tracker read failed: HTTP ${res.status} ${body?.error ?? ''}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const rows = Array.isArray(body.data) ? body.data : body.data.closers ?? Object.values(body.data);

// Tracker names follow the Sales Tracker ("Jay Z", "Adam L"); match on full name, short name or first name
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z ]/g, '').trim();
const ALIASES = { JZ: ['jay z', 'jordan zadrozny', 'jordan'] };
function findRow(c) {
  const names = [c.name, c.short, c.name.split(' ')[0], ...(ALIASES[c.key] ?? [])].map(norm);
  return rows.find((r) => names.includes(norm(r.name)))
    ?? rows.find((r) => names.includes(norm(r.name).split(' ')[0]));
}

const closers = {};
const unmatched = [];
for (const c of data.closers) {
  const r = findRow(c);
  if (!r) { unmatched.push(c.key); continue; }
  closers[c.key] = {
    tracker_name: r.name, rep_id: r.rep_id,
    month_target: r.month_target ?? null, target_source: r.target_source ?? null,
    cash: r.pace?.cash ?? null, expected_cash: r.pace?.expected_cash ?? null,
    pct_of_pace: r.pace?.pct_of_pace ?? null, status: r.pace?.status ?? null,
    through_date: r.pace?.through_date ?? through, cash_mtd: r.cash_mtd ?? null,
  };
}

data.tracker = {
  through, generated_at: body.generated_at, data_pulled_at: body.data_pulled_at,
  all_checks_pass: body.all_checks_pass,
  failed_checks: (body.checks ?? []).filter((ch) => !ch.ok).map((ch) => `${ch.name}: ${ch.detail ?? ''}`.trim()),
  targets_note: body.targets_note ?? null,
  unmatched, closers,
};
fs.writeFileSync(dataPath, JSON.stringify(data, null, 1) + '\n');
console.log(`tracker pace for ${Object.keys(closers).length} closers through ${through}` +
  `${unmatched.length ? `; no tracker row for ${unmatched.join(', ')}` : ''}; all_checks_pass=${body.all_checks_pass}`);
