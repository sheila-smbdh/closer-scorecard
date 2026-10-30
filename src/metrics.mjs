// Turns the raw pulls (tracker pace, activity windows, slots) into scorecard metrics with a
// status per tile. Every definition here is mirrored in the README metric table; change both together.

export const TARGETS = {
  slotsPerWeek: 35,        // capacity over the next 7 days: open discovery start times + booked client calls
  avgRevenueFloor: 17500,  // MTD revenue generated / closes
};

import { targetsFor, closerTargets, checkTargets, dailyCurve, paceStatus, nextMonthKey } from './targets.mjs';

// Activity arrays: [booked calls, live calls, offers, closes, revenue generated, cash collected]
const CALLS = 0, LIVE = 1, CLOSES = 3, REV = 4, CASH = 5;

// green: hit, yellow: 75%+ of target, red: below, blue: tracked with no target
export function status(value, target) {
  if (target == null || value == null) return 'track';
  if (value >= target) return 'hit';
  if (value >= 0.75 * target) return 'almost';
  return 'missed';
}

// Tracker pace.status -> tile color
const TRACKER_STATUS = { ahead: 'hit', on_pace: 'hit', slightly_behind: 'almost', behind: 'missed' };
// The 2M tracker's pace words (pace_label / week pills), used for the badge and the Pacing tile
export const PACE_LABEL = { ahead: 'Ahead of pace', on_pace: 'On pace', slightly_behind: 'Slightly behind', behind: 'Behind pace' };

// Booked/showed for one closer over [from, to] ("MM-DD"). EOD Tracker is the source of truth; a day the
// closer has no EOD report for is filled from the Sales Tracker. No-show/cancel/reschedule only exist in EOD.
export function bookedShowed(data, key, from, to) {
  const eod = data.daily_eod?.[key] ?? {};
  const st = data.daily_st?.[key] ?? {};
  const t = { booked: 0, showed: 0, noShow: 0, cancel: 0, resched: 0, filled: [], hasEod: Object.keys(eod).length > 0 };
  const days = new Set([...Object.keys(eod), ...Object.keys(st)].filter((d) => d >= from && d <= to));
  for (const d of [...days].sort()) {
    if (eod[d]) {
      const [b, s, ns, cx, rs] = eod[d];
      t.booked += b; t.showed += s; t.noShow += ns; t.cancel += cx; t.resched += rs;
    } else if (st[d] && (st[d][0] || st[d][1])) {
      t.booked += st[d][0]; t.showed += st[d][1];
      t.filled.push(d);
    }
  }
  return t;
}

export function closerMetrics(data, closer, edition) {
  const ed = data.editions[edition];
  // A closer with no Sales Tracker rows yet (a newly promoted setter) reads as all zeros
  const zero = [0, 0, 0, 0, 0, 0];
  const act = data.activity[closer.key] ?? { mtd: zero, mtd2: zero, wk: zero, tw: zero };
  // Monday and the 1st-of-month edition both cover full weeks: they read the Monday-style windows
  // (mtd, wk, business_days_elapsed_mon). Wednesday reads mtd2 / tw.
  const monday = edition !== 'wednesday';
  const mtd = monday ? act.mtd : act.mtd2;
  const newHire = closer.new_hire;

  const k = closer.key;
  const wk = bookedShowed(data, k, ed.week_days[0], ed.through_key);
  const monthStart = `${ed.through_key.slice(0, 2)}-01`;
  const mtdBS = bookedShowed(data, k, monthStart, ed.through_key);
  const source = wk.hasEod ? 'eod' : 'sales_tracker';

  // Live calls: showed, month to date (EOD + Sales Tracker fills). Scored against the team median in withTeam().
  const live = { value: mtdBS.showed, mtdBooked: mtdBS.booked, week: wk.showed, booked: wk.booked, source, status: 'track' };

  // Slots = discovery capacity: open start times (Messi's next-7-days count) + discovery calls already
  // booked in those 7 days (Calendly, as of the post). The 25 target is on the sum.
  const capacity = (day) => {
    const open = data.messi_slots?.[day]?.[k];
    if (open == null) return null;
    const booked = data.slots_booked?.[day]?.[k] ?? null;
    return { open, booked, value: open + (booked ?? 0) };
  };
  // Average over Messi's daily posts in a window (his count starts Oct 9, so month to date = since then)
  const slotAvg = (from, to) => {
    const posts = Object.keys(data.messi_slots ?? {}).filter((d) => d >= from && d <= to).sort().map(capacity).filter(Boolean);
    if (!posts.length) return { value: null, target: TARGETS.slotsPerWeek, status: 'track' };
    const avg = (f) => Math.round(posts.reduce((a, p) => a + f(p), 0) / posts.length);
    const hasBooked = posts.every((p) => p.booked != null);
    const value = avg((p) => p.value);
    return { value, open: avg((p) => p.open), booked: hasBooked ? avg((p) => p.booked) : null,
      low: Math.min(...posts.map((p) => p.value)), posts: posts.length, target: TARGETS.slotsPerWeek,
      status: status(value, TARGETS.slotsPerWeek) };
  };
  const slotsMtd = slotAvg(monthStart, ed.through_key);
  slotsMtd.since = Object.keys(data.messi_slots ?? {}).filter((d) => d >= monthStart).sort()[0] ?? null;
  // Upcoming: the edition-day post, next 7 days
  const up = capacity(ed.slots_post_day) ?? (data.slots?.[edition]?.[k] == null ? null : { open: data.slots[edition][k], booked: null, value: data.slots[edition][k] });
  const slots = up ? { ...up, target: TARGETS.slotsPerWeek, status: status(up.value, TARGETS.slotsPerWeek) }
    : { value: null, target: TARGETS.slotsPerWeek, status: 'track' };

  const avgRevenue = {
    value: mtd[CLOSES] ? mtd[REV] / mtd[CLOSES] : null, rev: mtd[REV], closes: mtd[CLOSES],
    target: TARGETS.avgRevenueFloor,
  };
  // A floor is pass/fail: no yellow band
  avgRevenue.status = avgRevenue.value == null ? 'track'
    : avgRevenue.value >= TARGETS.avgRevenueFloor ? 'hit' : 'missed';

  // Cash pace: actual cash from the tracker read API; the goal (month target, curve, goal to date, pace
  // badge) from Sheila's closer-facing targets file for the month (src/targets.mjs), never the tracker's
  const tr = trackerFor(data, ed);
  const tp = tr?.closers?.[k] ?? null;
  const monthKey = tr?.through?.slice(0, 7);
  const tf = monthKey ? targetsFor(data, monthKey) : null;
  const ct = closerTargets(tf, k);
  const usable = ct && !checkTargets(tf, monthKey).length;
  const curve = usable ? dailyCurve(tf, monthKey) : null;
  const cashValue = tp ? tp.cash : mtd[CASH];
  const dayNow = tp?.daily_cash?.length ?? null;
  const expected = usable && dayNow ? ct.cash * curve[dayNow - 1] : null;
  const pace = expected ? paceStatus(cashValue ?? 0, expected) : null;
  const cash = {
    value: cashValue, expected, monthTarget: usable ? ct.cash : null, closesTarget: usable ? ct.closes : null,
    source: tp ? 'tracker' : 'sales_tracker', salesTrackerCash: mtd[CASH], targetsMonth: monthKey,
    status: pace ? TRACKER_STATUS[pace] : 'track', pace,
    paceRatio: expected ? (cashValue ?? 0) / expected : null,
  };
  // Pace chart: daily cumulative cash, last month's curve on this month's day axis (normalized for month
  // length), and the goal curve × month target
  if (tp?.daily_cash?.length && cash.monthTarget) {
    const dim = tr.days_in_month, pdim = tr.prior_days_in_month;
    const prior = tp.prior_daily_cash?.length
      ? Array.from({ length: dim }, (_, i) => tp.prior_daily_cash[Math.min(normalizedPriorDay(i + 1, dim, pdim), tp.prior_daily_cash.length) - 1])
      : null;
    const day = tp.daily_cash.length;
    cash.chart = {
      dim, day, daily: tp.daily_cash, prior, priorMonth: tr.prior_month, priorDim: pdim,
      curve, goal: curve.map((g) => g * cash.monthTarget),
      priorSameDay: prior ? prior[day - 1] : null,
    };
  }

  // Closes this month (Close 1)
  const closes = { actual: mtd[CLOSES] };

  const wkAct = act[monday ? 'wk' : 'tw'];
  const salesTrackerWeek = { booked: wkAct[CALLS], showed: wkAct[LIVE] };
  // This past week (or this week so far on Wednesday), for the line under each month-to-date tile
  const week = { closes: wkAct[CLOSES], rev: wkAct[REV] };
  const filled = { week: wk.filled, mtd: mtdBS.filled };
  // slotAvg is kept for the Weekly Scorecard table (each week's average slots)
  return { closer, edition, ed, salesTrackerWeek, week, filled, live, slotsMtd, slotAvg, slots, avgRevenue, cash, closes, newHire };
}

// The tracker pull for an edition's window (keyed by its last day, "MM-DD")
export function trackerFor(data, ed) {
  return data.trackers?.[ed.through_key] ?? null;
}

// Last month's day that matches `day` this month, scaled for month length (the tracker's same-day MoM)
const normalizedPriorDay = (day, dim, pdim) => Math.min(pdim, Math.max(1, Math.round((day * pdim) / dim)));

// Team medians over fully ramped closers; live calls are scored against the median (no fixed target)
export function withTeam(metrics) {
  const ramped = metrics.filter((m) => !m.newHire);
  const team = {
    pace: median(ramped.map((m) => m.cash.paceRatio)),
    cash: median(ramped.map((m) => m.cash.value)),
    live: median(ramped.map((m) => m.live.value)),
    slotsMtd: median(ramped.map((m) => m.slotsMtd.value)),
    slots: median(ramped.map((m) => m.slots.value)),
    avgRevenue: median(ramped.map((m) => m.avgRevenue.value)),
    closes: median(ramped.map((m) => m.closes.actual)),
  };
  for (const m of metrics) {
    m.team = team;
    m.live.target = m.newHire ? null : team.live;
    m.live.status = status(m.live.value, m.live.target);
  }
  return team;
}

export function median(values) {
  const v = values.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
}

// Things Sheila should see on every run; never shown to closers
export function runFlags(data, metrics, edition) {
  const flags = [];
  const ed = data.editions[edition];
  for (const m of metrics) {
    const k = m.closer.key;
    const st = m.salesTrackerWeek;
    if (m.live.source === 'sales_tracker') flags.push(`${k}: no EOD reports at all, booked/showed taken from the Sales Tracker.`);
    else if (m.filled.week.length) flags.push(`${k}: no EOD report for ${m.filled.week.join(', ')}; filled from the Sales Tracker.`);
    if (m.live.source === 'eod' && (st.booked !== m.live.booked || st.showed !== m.live.week)) {
      flags.push(`${k}: week totals (EOD + fills) ${m.live.booked} booked / ${m.live.week} showed, Sales Tracker alone ${st.booked} / ${st.showed}.`);
    }
    const mtdFills = m.filled.mtd.filter((d) => !m.filled.week.includes(d));
    if (m.live.source === 'eod' && mtdFills.length) flags.push(`${k}: month to date also filled from the Sales Tracker on ${mtdFills.join(', ')}.`);
    const inferred = (data.eod_inferred?.[k] ?? []).filter((d) => d >= ed.week_days[0] && d <= ed.through_key);
    if (inferred.length) flags.push(`${k}: EOD "showed" left blank on ${inferred.join(', ')}; filled in as booked minus no-shows, cancels and reschedules.`);
    if (m.slots.value != null && m.slots.booked == null) flags.push(`${k}: no Calendly booked-call count for ${ed.slots_post_day}; slots show open start times only.`);
    if (m.cash.source === 'tracker' && m.cash.salesTrackerCash !== m.cash.value) {
      flags.push(`${k}: cash through ${ed.through} is $${m.cash.value?.toLocaleString('en-US')} in the tracker, $${m.cash.salesTrackerCash?.toLocaleString('en-US')} in the Sales Tracker snapshot.`);
    }
    if (!m.cash.monthTarget && !m.newHire) flags.push(`${k}: no closer target for ${m.cash.targetsMonth ?? 'this month'} in data/targets; card shows no goal.`);
  }
  const t = trackerFor(data, ed);
  if (!t) flags.push(`Cash: no tracker pull through ${ed.through}; cash taken from the Sales Tracker and the pace chart left out.`);
  else {
    if (t.all_checks_pass === false) flags.push(`Tracker checks failed: ${t.failed_checks.join('; ') || 'see /api/read/closers'}.`);
    if (t.unmatched?.length) flags.push(`Tracker has no row for ${t.unmatched.join(', ')}; their cash comes from the Sales Tracker.`);
    const mk = t.through.slice(0, 7);
    for (const problem of checkTargets(targetsFor(data, mk), mk)) flags.push(`Closer targets: ${problem}.`);
    if (edition === 'monthly') for (const problem of checkTargets(targetsFor(data, nextMonthKey(mk)), nextMonthKey(mk))) flags.push(`Next month's plan left off the cards: ${problem}.`);
  }
  return flags;
}

export const fmtPct = (v) => (v == null ? '–' : `${Math.round(v * 100)}%`);
export const fmtMoney = (v, short = false) => {
  if (v == null) return '–';
  if (short && Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 || v >= 100000 ? 0 : 1)}K`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
};
