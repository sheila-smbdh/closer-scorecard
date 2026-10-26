// Extra numbers for the v2 (simplified) card: closes vs target, pipeline commitments kept, and weekly
// targets. Weekly cash targets come from the 2M tracker's goal curve: the gap to target at the start of a
// week × the share of the rest of the month's curve that week covers. Closes = cash ÷ $17.5K.

import { category, outcome } from './pipeline-labels.mjs';
import { TARGETS, status, trackerFor } from './metrics.mjs';

const day = (mmdd) => Number(mmdd.slice(3));

// Weekly targets set at the start of a week (day `from` = the last day before it) for the week ending `to`
function weekTarget(goal, monthTarget, cashAtStart, from, to) {
  const g0 = from ? goal[from - 1] : 0, g1 = goal[Math.min(to, goal.length) - 1];
  const gap = Math.max(0, monthTarget - cashAtStart);
  const cash = g0 >= 1 ? gap : gap * ((g1 - g0) / (1 - g0));
  return { cash, closes: Math.ceil(cash / TARGETS.avgRevenueFloor), slots: TARGETS.slotsPerWeek };
}

export function planV2(data, m) {
  const c = m.cash;
  const tr = trackerFor(data, m.ed);
  const t = tr?.closers?.[m.closer.key];
  const out = {};

  // Closes this month vs the closes the month target takes
  out.closes = { actual: m.closes.actual, target: c.monthTarget ? Math.ceil(c.monthTarget / TARGETS.avgRevenueFloor) : null };

  // Commitments: every lead the closer put on this month's pipeline as High Confidence or Soft Verbal (open
  // now, or already closed off the list), and how many of them closed. On track = at least the share of the
  // month the goal curve expects done by today.
  const raw = data.pipeline_leads?.[m.closer.key];
  const leads = Array.isArray(raw) ? raw : raw?.leads;
  if (leads) {
    let kept = 0, open = 0;
    for (const [, b, , f] of leads) {
      const o = outcome(b, f);
      if (o === 'closed') kept++;
      else if (!o && ['hc', 'sv'].includes(category(b))) open++;
    }
    const committed = kept + open;
    const expectedShare = tr ? tr.goal_shape[day(m.ed.through_key) - 1] : null;
    out.commit = { committed, kept, rate: committed ? kept / committed : null, expectedShare,
      status: committed && expectedShare != null ? status(kept, committed * expectedShare) : 'track' };
  }

  // Weekly targets: last week (set at its start) vs actual, and this coming week
  if (t?.daily_cash?.length && c.monthTarget) {
    const goal = tr.goal_shape, dim = tr.days_in_month;
    const start = day(m.ed.week_days[0]) - 1, end = day(m.ed.through_key);
    const cashAt = (d) => (d > 0 ? t.daily_cash[d - 1] ?? 0 : 0);
    const last = weekTarget(goal, c.monthTarget, cashAt(start), start, end);
    const wkAct = data.activity[m.closer.key][m.edition === 'monday' ? 'wk' : 'tw'];
    const actual = { cash: cashAt(end) - cashAt(start), closes: wkAct[3], slots: m.slotsWeek.value };
    const nextEnd = Math.min(dim, end + 7);
    const next = weekTarget(goal, c.monthTarget, c.value ?? 0, end, nextEnd);
    out.weeks = {
      last: { target: last, actual, hit: {
        slots: actual.slots == null ? null : actual.slots >= last.slots,
        closes: actual.closes >= last.closes, cash: actual.cash >= last.cash } },
      next: { ...next, toEnd: nextEnd === dim },
    };
    out.gap = { cash: c.remaining, closes: Math.ceil(c.remaining / TARGETS.avgRevenueFloor) };
  }
  return out;
}
