// Numbers for the card beyond src/metrics.mjs: closes vs the month's closes target (month cash target ÷
// $17.5K) and the Weeks Ahead table. Weeks follow the 2M tracker (Sun-Sat, leading partial days folded
// into Week 1, a trailing remnant under 7 days is the "Final stretch"). Each week's cash and closes target
// is the slice of the month target that the tracker's goal curve puts in that week, so the weeks add up
// to the month target and match the Pacing tile.

import { TARGETS, trackerFor } from './metrics.mjs';

export const SLOTS_TARGET = TARGETS.slotsPerWeek; // booked + open over the next 7 days

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (mmdd) => Number(mmdd.slice(3));
const mmdd = (mo, d) => `${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

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

export function plan(data, m) {
  const c = m.cash;
  const out = {};

  const target = c.monthTarget ? Math.ceil(c.monthTarget / TARGETS.avgRevenueFloor) : null;
  out.closes = { actual: m.closes.actual, target };

  // Weeks Ahead: every week of the month, target vs actual for cash, closes and slots
  const tr = trackerFor(data, m.ed);
  if (!c.chart || target == null) return out;
  const goal = tr.goal_shape, dim = tr.days_in_month;
  const [year, mo] = tr.through.split('-').map(Number);
  const through = day(m.ed.through_key);
  const curveAt = (d) => (d > 0 ? goal[d - 1] : 0);
  const cashAt = (d) => (d > 0 ? c.chart.daily[Math.min(d, through) - 1] ?? 0 : 0);
  const dailyCloses = data.daily_closes?.[m.closer.key] ?? {};
  const closesIn = (from, to) => Object.entries(dailyCloses)
    .filter(([d]) => day(d) >= from && day(d) <= Math.min(to, through)).reduce((a, [, n]) => a + n, 0);

  let slotsRowSet = false;
  out.weeks = monthWeeks(year, mo - 1, dim).map((w) => {
    const phase = w.end <= through ? 'done' : w.start <= through ? 'now' : 'next';
    const tgt = {
      cash: c.monthTarget * (curveAt(w.end) - curveAt(w.start - 1)),
      // cumulative rounding so the weeks add up to the month's closes target
      closes: Math.round(target * curveAt(w.end)) - Math.round(target * curveAt(w.start - 1)),
      slots: SLOTS_TARGET,
    };
    const row = { ...w, phase, target: tgt };
    if (phase !== 'next') {
      row.actual = { cash: cashAt(w.end) - cashAt(w.start - 1), closes: closesIn(w.start, w.end) };
      if (phase === 'done') {
        row.actual.slots = m.slotAvg(mmdd(mo, w.start), mmdd(mo, w.end)).value;
        row.hit = {
          cash: row.actual.cash >= tgt.cash, closes: row.actual.closes >= tgt.closes,
          slots: row.actual.slots == null ? null : row.actual.slots >= tgt.slots,
        };
      }
    }
    // The first week not yet finished shows the next 7 days of slots (latest Messi post) against the target
    if (phase !== 'done' && !slotsRowSet) {
      slotsRowSet = true;
      const s = m.slots;
      row.next7 = s.value == null ? null : { ...s, toOpen: Math.max(0, SLOTS_TARGET - s.value) };
    }
    return row;
  });
  return out;
}
