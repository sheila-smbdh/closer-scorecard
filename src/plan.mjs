// Numbers for the card beyond src/metrics.mjs: closes vs the month's closes target and the Weekly
// Scorecard table. Targets and the month curve come from Sheila's closer-facing targets file
// (src/targets.mjs), not the 2M tracker. Weeks follow the 2M tracker (Sun-Sat, leading partial days folded
// into Week 1, a trailing remnant under 7 days is the "Final stretch"). Targets carry misses forward like
// the tracker's week cards: a week's target is the goal curve at the week's end minus what was banked
// before the week started, so a finished week is hit only if the closer is back on the pace line by its
// end. The first unfinished week carries any deficit; weeks after it show their plain slice of the curve.

import { TARGETS, trackerFor } from './metrics.mjs';
import { targetsFor, closerTargets, checkTargets, dailyCurve, nextMonthKey, daysIn, monthWeeks } from './targets.mjs';

export { monthWeeks };

export const SLOTS_TARGET = TARGETS.slotsPerWeek; // booked + open over the next 7 days

const day = (mmdd) => Number(mmdd.slice(3));
const mmdd = (mo, d) => `${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function plan(data, m) {
  const c = m.cash;
  const out = {};

  const target = c.closesTarget;
  out.closes = { actual: m.closes.actual, target };

  // Weekly Scorecard: every week of the month, target vs actual for cash, closes and slots
  const tr = trackerFor(data, m.ed);
  // 1st-of-month edition: next month's week-by-week plan for Jay's 1:1, from next month's targets file
  // (no plan without one; the run flags say so). Built before the checks below so a closer with no goal
  // this month (a new hire's first month) still gets next month's plan.
  const nk = tr && nextMonthKey(tr.through.slice(0, 7));
  const nf = nk ? targetsFor(data, nk) : null, nt = closerTargets(nf, m.closer.key);
  if (m.edition === 'monthly' && nt && !checkTargets(nf, nk).length) {
    const g = dailyCurve(nf, nk), at = (d) => (d > 0 ? g[d - 1] : 0);
    const [ny, nm] = nk.split('-').map(Number);
    out.next = {
      month: nk, cash: nt.cash, closes: nt.closes,
      weeks: monthWeeks(ny, nm - 1, daysIn(nk)).map((w, i) => ({
        ...w, share: nf.weeks[i],
        cash: nt.cash * nf.weeks[i],
        closes: Math.round(nt.closes * at(w.end)) - Math.round(nt.closes * at(w.start - 1)),
        slots: SLOTS_TARGET,
      })),
    };
  }
  if (!c.chart || target == null) return out;
  const goal = c.chart.curve, dim = tr.days_in_month;
  const [year, mo] = tr.through.split('-').map(Number);
  const through = day(m.ed.through_key);
  const curveAt = (d) => (d > 0 ? goal[d - 1] : 0);
  const cashAt = (d) => (d > 0 ? c.chart.daily[Math.min(d, through) - 1] ?? 0 : 0);
  const dailyCloses = data.daily_closes?.[m.closer.key] ?? {};
  const closesIn = (from, to) => Object.entries(dailyCloses)
    .filter(([d]) => day(d) >= from && day(d) <= Math.min(to, through)).reduce((a, [, n]) => a + n, 0);

  const closesBefore = (d) => closesIn(1, d - 1);
  let carried = false;
  out.weeks = monthWeeks(year, mo - 1, dim).map((w) => {
    const phase = w.end <= through ? 'done' : w.start <= through ? 'now' : 'next';
    const cashLine = (d) => c.monthTarget * curveAt(d), closesLine = (d) => Math.round(target * curveAt(d));
    // Finished weeks and the first unfinished one start from what was actually banked; later weeks
    // start from the pace line
    const fromActual = phase === 'done' || !carried;
    const tgt = {
      cash: Math.max(0, cashLine(w.end) - (fromActual ? cashAt(w.start - 1) : cashLine(w.start - 1))),
      closes: Math.max(0, closesLine(w.end) - (fromActual ? closesBefore(w.start) : closesLine(w.start - 1))),
      slots: SLOTS_TARGET,
    };
    const row = { ...w, phase, target: tgt };
    if (phase !== 'done' && !carried) {
      carried = true;
      row.carried = Math.max(0, cashLine(w.start - 1) - cashAt(w.start - 1));
      // The next 7 days of slots (latest Messi post) against the target
      const s = m.slots;
      row.next7 = s.value == null ? null : { ...s, toOpen: Math.max(0, SLOTS_TARGET - s.value) };
    }
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
    return row;
  });
  // Month row: month to date against the month's targets
  out.month = {
    target: { cash: c.monthTarget, closes: target, slots: SLOTS_TARGET },
    actual: { cash: c.value ?? 0, closes: m.closes.actual, slots: m.slotsMtd.value },
  };
  return out;
}
