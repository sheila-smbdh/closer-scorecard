// Closer-facing targets, set by Sheila each month in data/targets/<YYYY-MM>.json. These are NOT the 2M
// tracker's numbers (those are management-facing): the card's month goal, closes target, goal-to-date,
// pace badge and weekly targets all come from this file. The tracker only supplies actual cash.
//
// File shape:
//   { "month": "2026-11",
//     "weeks": [0.12, 0.18, 0.2, 0.25, 0.25],        // share of the month per week (the tracker's weeks,
//                                                     // see monthWeeks below), must add up to 1
//     "closers": { "Owen": { "cash": 450000, "closes": 26 }, ... } }   // closes optional: cash ÷ $17,500

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Port of the tracker's computeMonthWeeks (src/lib/compute/projections.ts in smbdh-2m-tracker)
export function monthWeeks(year, monthIdx, dim) {
  const dow = (d) => new Date(Date.UTC(year, monthIdx, d)).getUTCDay();
  const mon = MONTH_ABBR[monthIdx];
  let firstSunday = 1;
  while (firstSunday <= 7 && dow(firstSunday) !== 0) firstSunday++;
  const segs = [{ start: 1, end: Math.min(firstSunday + 6, dim) }];
  for (let s = segs[0].end + 1; s <= dim; s = segs.at(-1).end + 1) segs.push({ start: s, end: Math.min(s + 6, dim) });
  return segs.map((seg, i) => {
    const days = seg.end - seg.start + 1;
    const final = i === segs.length - 1 && segs.length > 1 && days < 7;
    return {
      ...seg,
      label: final ? 'Final stretch' : `Week ${i + 1}`,
      dates: seg.start === seg.end ? `${mon} ${seg.start}` : `${mon} ${seg.start} → ${seg.end}`,
      span: final ? `${days}-day finale` : i === 0 && firstSunday > 1 ? `Sun-Sat + ${firstSunday - 1}-day lead-in` : 'Sun-Sat',
    };
  });
}

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'targets');
export const AVG_DEAL = 17500;

export function readTargets(month) {
  const file = path.join(DIR, `${month}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

// A snapshot carries the targets it was built with (`closer_targets[month]`); otherwise read the file
export const targetsFor = (data, month) => data.closer_targets?.[month] ?? readTargets(month);

export const nextMonthKey = (month) => {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};
export const daysIn = (month) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

// Problems with a month's file, for the run flags (an empty list means it is usable)
export function checkTargets(t, month) {
  if (!t) return [`no targets file for ${month} (data/targets/${month}.json)`];
  const [y, m] = month.split('-').map(Number);
  const weeks = monthWeeks(y, m - 1, daysIn(month));
  const out = [];
  if (t.weeks?.length !== weeks.length) out.push(`${month}: ${t.weeks?.length ?? 0} weekly shares for ${weeks.length} weeks`);
  const sum = (t.weeks ?? []).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 0.005) out.push(`${month}: weekly shares add up to ${Math.round(sum * 1000) / 10}%, not 100%`);
  return out;
}

// Cumulative share of the month by the end of each day: each week's share spread evenly over its days
export function dailyCurve(t, month) {
  const [y, m] = month.split('-').map(Number);
  const curve = [];
  let acc = 0;
  monthWeeks(y, m - 1, daysIn(month)).forEach((w, i) => {
    const days = w.end - w.start + 1, share = t.weeks[i] ?? 0;
    for (let d = 1; d <= days; d++) curve.push(acc + (share * d) / days);
    acc += share;
  });
  return curve;
}

// One closer's month targets, or null when the file has none for them
export function closerTargets(t, key) {
  const c = t?.closers?.[key];
  if (!c?.cash) return null;
  return { cash: c.cash, closes: c.closes ?? Math.ceil(c.cash / AVG_DEAL) };
}

// The tracker's pace bands, applied to the card's own goal to date
export function paceStatus(cash, expected) {
  if (!expected) return null;
  const r = cash / expected;
  return r >= 1.05 ? 'ahead' : r >= 0.97 ? 'on_pace' : r >= 0.9 ? 'slightly_behind' : 'behind';
}
