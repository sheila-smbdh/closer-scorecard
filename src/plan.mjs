// Numbers for the card beyond src/metrics.mjs, all anchored on the month's closes target (month cash target ÷
// $17.5K): closes vs target, closes + open pipeline against that target, and weekly targets.
// Weekly targets come from the 2M tracker's goal curve: what is left at the start of a week × the share of
// the rest of the month's curve that week covers. Cash works off the cash gap, closes off the closes gap.

import { TARGETS, status, trackerFor } from './metrics.mjs';

export const SLOTS_TARGET = TARGETS.slotsPerWeek; // booked + open over the next 7 days

const day = (mmdd) => Number(mmdd.slice(3));

// Share of what is left at the end of day `from` that the goal curve puts in days from+1..to
function curveShare(goal, from, to) {
  const g0 = from ? goal[from - 1] : 0, g1 = goal[Math.min(to, goal.length) - 1];
  return g0 >= 1 ? 1 : (g1 - g0) / (1 - g0);
}

export function plan(data, m) {
  const c = m.cash;
  const tr = trackerFor(data, m.ed);
  const t = tr?.closers?.[m.closer.key];
  const out = {};

  const target = c.monthTarget ? Math.ceil(c.monthTarget / TARGETS.avgRevenueFloor) : null;
  out.closes = { actual: m.closes.actual, target, toGo: target != null ? Math.max(0, target - m.closes.actual) : null };

  // Closed so far + this month's open pipeline (High Confidence, Soft Verbal, Working), against the month's
  // closes target: if every lead closed, would it be enough?
  const pl = m.closes.pipeline;
  if (pl) {
    const total = pl.hc + pl.sv + pl.working, reach = m.closes.actual + total;
    out.pipeline = { hc: pl.hc, sv: pl.sv, working: pl.working, total, reach, status: target ? status(reach, target) : 'track' };
  }

  // Weekly targets: last week (set at its start) vs actual, and this coming week
  if (t?.daily_cash?.length && c.monthTarget) {
    const goal = tr.goal_shape, dim = tr.days_in_month;
    const start = day(m.ed.week_days[0]) - 1, end = day(m.ed.through_key);
    const cashAt = (d) => (d > 0 ? t.daily_cash[d - 1] ?? 0 : 0);
    const wkAct = data.activity[m.closer.key][m.edition === 'monday' ? 'wk' : 'tw'];
    const closesAtStart = m.closes.actual - wkAct[3];
    const week = (cashSoFar, closesSoFar, from, to) => {
      const share = curveShare(goal, from, to);
      return {
        cash: Math.max(0, c.monthTarget - cashSoFar) * share,
        closes: Math.round(Math.max(0, target - closesSoFar) * share),
        slots: SLOTS_TARGET,
      };
    };
    const last = week(cashAt(start), closesAtStart, start, end);
    const actual = { cash: cashAt(end) - cashAt(start), closes: wkAct[3], slots: m.slotsWeek.value };
    const nextEnd = Math.min(dim, end + 7);
    out.weeks = {
      last: { target: last, actual, hit: {
        slots: actual.slots == null ? null : actual.slots >= last.slots,
        closes: actual.closes >= last.closes, cash: actual.cash >= last.cash } },
      next: { ...week(c.value ?? 0, m.closes.actual, end, nextEnd), toEnd: nextEnd === dim },
    };
    out.gap = { cash: c.remaining, closes: out.closes.toGo };
  }
  return out;
}
