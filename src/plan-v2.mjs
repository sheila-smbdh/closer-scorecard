// Extra numbers for the v2 (simplified) card, all anchored on the month's closes target (month cash target ÷
// $17.5K): closes vs target, this month's pipeline against the closes still to go, and weekly targets.
// Weekly targets come from the 2M tracker's goal curve: what is left at the start of a week × the share of
// the rest of the month's curve that week covers. Cash works off the cash gap, closes off the closes gap.

import { category, outcome } from './pipeline-labels.mjs';
import { TARGETS, status, trackerFor } from './metrics.mjs';

export const SLOTS_TARGET = 35; // booked + open over the next 7 days

const day = (mmdd) => Number(mmdd.slice(3));

// Share of what is left at the end of day `from` that the goal curve puts in days from+1..to
function curveShare(goal, from, to) {
  const g0 = from ? goal[from - 1] : 0, g1 = goal[Math.min(to, goal.length) - 1];
  return g0 >= 1 ? 1 : (g1 - g0) / (1 - g0);
}

export function planV2(data, m) {
  const c = m.cash;
  const tr = trackerFor(data, m.ed);
  const t = tr?.closers?.[m.closer.key];
  const out = {};

  const target = c.monthTarget ? Math.ceil(c.monthTarget / TARGETS.avgRevenueFloor) : null;
  out.closes = { actual: m.closes.actual, target, toGo: target != null ? Math.max(0, target - m.closes.actual) : null };

  // This month's open pipeline by status, measured against the closes still to go
  const raw = data.pipeline_leads?.[m.closer.key];
  const leads = Array.isArray(raw) ? raw : raw?.leads;
  if (leads) {
    const n = { hc: 0, sv: 0, working: 0 };
    for (const [, b, , f] of leads) {
      if (outcome(b, f)) continue;
      const cat = category(b);
      if (cat) n[cat]++;
    }
    n.total = n.hc + n.sv + n.working;
    out.pipeline = { ...n, status: out.closes.toGo ? status(n.total, out.closes.toGo) : 'track' };
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
