// Turns the raw pulls (activity windows, pipeline counts, slots) into scorecard
// metrics with a status per tile. Every definition here is mirrored in
// the README metric table; change both together.

import { category, outcome, money } from './pipeline-labels.mjs';

export const TARGETS = {
  slotsPerWeek: 25,        // discovery capacity over the next 7 days: open start times + booked discovery calls
  lateCloseHour: 17,       // calendars that close by 5pm ET most weekdays get a warning on the slots tile
  avgRevenueFloor: 17500,  // MTD revenue generated / closes
  monthlyCash: 200000,     // fallback straight-line pace, only when the snapshot has no tracker pull
};

// Activity arrays: [booked calls, live calls, offers, closes, revenue generated, cash collected]
const CALLS = 0, LIVE = 1, CLOSES = 3, REV = 4, CASH = 5;

// green: hit, yellow: 75%+ of target, red: below, blue: tracked with no target
export function status(value, target) {
  if (target == null || value == null) return 'track';
  if (value >= target) return 'hit';
  if (value >= 0.75 * target) return 'almost';
  return 'missed';
}

// Share of open pipeline leads expected to close by month end (Friday pipeline report KPI)
export const PIPELINE_KPI = { hc: 0.8, sv: 0.5 };

// Tracker pace.status -> tile color
const TRACKER_STATUS = { ahead: 'hit', on_pace: 'hit', slightly_behind: 'almost', behind: 'missed' };

// How the tracker set a closer's month target, for the cash tile's small text
export const TARGET_SOURCE = {
  hand_set: 'set by leadership', new_rep_ramp: 'new-closer ramp', roster_dollars: 'from the roster',
  auto_split: 'share of team goal', ramping_no_target: 'no target yet',
};

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
  const act = data.activity[closer.key];
  const monday = edition === 'monday';
  const mtd = monday ? act.mtd : act.mtd2;
  const bdElapsed = monday ? data.month.business_days_elapsed_mon : data.month.business_days_elapsed_wed;
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
  const slotsWeek = slotAvg(ed.week_days[0], ed.through_key);
  // Upcoming: the edition-day post, next 7 days
  const up = capacity(ed.slots_post_day) ?? (data.slots[edition][k] == null ? null : { open: data.slots[edition][k], booked: null, value: data.slots[edition][k] });
  const slots = up ? { ...up, target: TARGETS.slotsPerWeek, status: status(up.value, TARGETS.slotsPerWeek) }
    : { value: null, target: TARGETS.slotsPerWeek, status: 'track' };

  const calendar = calendarClose(data.calendar_close_et?.[k]);
  const away = data.closer_notes?.[k] ?? null;
  if (calendar && away) calendar.away = away;

  const avgRevenue = {
    value: mtd[CLOSES] ? mtd[REV] / mtd[CLOSES] : null, rev: mtd[REV], closes: mtd[CLOSES],
    target: TARGETS.avgRevenueFloor,
  };
  // A floor is pass/fail: no yellow band
  avgRevenue.status = avgRevenue.value == null ? 'track'
    : avgRevenue.value >= TARGETS.avgRevenueFloor ? 'hit' : 'missed';

  // Cash pace: the tracker read API (back-loaded month curve, per-closer targets) when the snapshot has it
  const tr = trackerFor(data, ed);
  const tp = tr?.closers?.[k] ?? null;
  let cash;
  if (tp) {
    const hasPace = tp.expected_cash != null && tp.target_source !== 'ramping_no_target';
    cash = {
      value: tp.cash, expected: hasPace ? tp.expected_cash : null, monthTarget: hasPace ? tp.month_target : null,
      targetSource: tp.target_source, source: 'tracker', salesTrackerCash: mtd[CASH],
      status: hasPace ? (TRACKER_STATUS[tp.status] ?? status(tp.cash, tp.expected_cash)) : 'track',
      paceRatio: hasPace ? tp.pct_of_pace ?? (tp.expected_cash ? tp.cash / tp.expected_cash : null) : null,
    };
  } else {
    const cashExpected = newHire ? null
      : TARGETS.monthlyCash * (bdElapsed / data.month.business_days);
    cash = {
      value: mtd[CASH], expected: cashExpected, monthTarget: newHire ? null : TARGETS.monthlyCash, source: 'provisional',
      status: status(mtd[CASH], cashExpected),
      paceRatio: cashExpected ? mtd[CASH] / cashExpected : null,
    };
  }
  // Month-end at the current pace: % of pace carries through the curve, so it lands on % of the month target
  cash.projectedFinish = cash.paceRatio != null && cash.monthTarget ? cash.paceRatio * cash.monthTarget : null;
  cash.remaining = cash.monthTarget ? Math.max(0, cash.monthTarget - (cash.value ?? 0)) : null;
  cash.daysLeft = data.month.business_days - bdElapsed;
  // Pace chart (same as the tracker's closer view): daily cumulative cash, last month's curve on this
  // month's day axis (normalized for month length), and the goal-pace curve × month target
  if (tp?.daily_cash?.length && cash.monthTarget) {
    const dim = tr.days_in_month, pdim = tr.prior_days_in_month;
    const prior = tp.prior_daily_cash?.length
      ? Array.from({ length: dim }, (_, i) => tp.prior_daily_cash[Math.min(normalizedPriorDay(i + 1, dim, pdim), tp.prior_daily_cash.length) - 1])
      : null;
    const day = tp.daily_cash.length;
    cash.chart = {
      dim, day, daily: tp.daily_cash, prior, priorMonth: tr.prior_month, priorDim: pdim,
      goal: tr.goal_shape.map((g) => g * cash.monthTarget),
      priorSameDay: prior ? prior[day - 1] : null,
    };
  }

  // Closes: actual (Close 1, month to date) vs projected month-end = actual + KPI share of open HC and SV
  const p = pipelineFor(data, k);
  const closes = {
    actual: mtd[CLOSES],
    needed: cash.monthTarget ? Math.ceil(cash.monthTarget / TARGETS.avgRevenueFloor) : null,
    pipeline: p,
    lastWeek: data.pipeline_last_week?.[k] ?? null,
  };
  closes.projected = p ? Math.round(mtd[CLOSES] + PIPELINE_KPI.hc * p.hc + PIPELINE_KPI.sv * p.sv) : null;
  // Tracked, no target: projected = closes so far + 80% of open High Confidence + 50% of open Soft Verbal
  closes.projectedExact = p ? mtd[CLOSES] + PIPELINE_KPI.hc * p.hc + PIPELINE_KPI.sv * p.sv : null;
  closes.status = 'track';

  // Month-to-date conversion: booked calls that showed, and live calls that closed
  const rates = { show: mtdBS.booked ? mtdBS.showed / mtdBS.booked : null, close: mtdBS.showed ? mtd[CLOSES] / mtdBS.showed : null };

  const wkAct = act[monday ? 'wk' : 'tw'];
  const salesTrackerWeek = { booked: wkAct[CALLS], showed: wkAct[LIVE] };
  // This past week (or this week so far on Wednesday), for the line under each month-to-date tile
  const week = { closes: wkAct[CLOSES], rev: wkAct[REV] };
  const filled = { week: wk.filled, mtd: mtdBS.filled };
  return { closer, edition, ed, salesTrackerWeek, week, filled, live, slotsMtd, slotsWeek, slots, calendar, avgRevenue, cash, closes, rates, bdElapsed, newHire };
}

// Open leads in the closer's current-month Pipeline Review section, counted and valued (column D cash;
// a lead with no amount is valued at the $17.5K average and counted in noAmount). Same labels as the
// Friday pipeline report.
export function pipelineFor(data, k) {
  const raw = data.pipeline_leads?.[k];
  const leads = Array.isArray(raw) ? raw : raw?.leads;
  if (!leads) return null;
  const p = { hc: 0, sv: 0, working: 0, cash: { hc: 0, sv: 0, working: 0 }, leads: { hc: [], sv: [], working: [] }, noAmount: 0, nonstandard: 0 };
  for (const [name, b, amount, f] of leads) {
    const out = outcome(b, f);
    if (out) continue; // closed, signed, delayed or lost
    const cat = category(b);
    if (!cat) { p.nonstandard++; continue; }
    const v = money(amount);
    if (v == null) p.noAmount++;
    p[cat]++;
    p.cash[cat] += v ?? TARGETS.avgRevenueFloor;
    p.leads[cat].push({ name: name.trim(), cash: v });
  }
  for (const list of Object.values(p.leads)) list.sort((x, y) => (y.cash ?? 0) - (x.cash ?? 0));
  return p;
}

// Working backwards from the month target: the gap and the closes it takes, what the pipeline is worth
// (every lead closes / usual rates), which leads have to be pulled forward, how many new calls the rest of
// the month realistically holds and how many of those can still pay this month (the rest are next month's
// pipeline), and a realistic month end.
function pathToTarget(m, team) {
  const c = m.cash, pl = m.closes.pipeline;
  if (!c.monthTarget) return null;
  const per = TARGETS.avgRevenueFloor, gap = c.remaining;
  const own = m.avgRevenue.value;
  const range = { floor: Math.ceil(gap / per), own: own ? Math.ceil(gap / own) : null, high: Math.ceil(gap / 20000) };
  const pipe = pl ? {
    n: pl.hc + pl.sv + pl.working, all: pl.cash.hc + pl.cash.sv + pl.cash.working,
    likely: PIPELINE_KPI.hc * pl.cash.hc + PIPELINE_KPI.sv * pl.cash.sv,
    hcsv: pl.cash.hc + pl.cash.sv,
  } : null;
  // Pull forward: every High Confidence and Soft Verbal lead, then as many Working leads as the rest needs
  let pull = null;
  if (pl) {
    const left = Math.max(0, gap - pipe.hcsv);
    const avgWorking = pl.working ? pl.cash.working / pl.working : per;
    pull = { left, avgWorking, working: Math.min(pl.working, Math.ceil(left / avgWorking)), beyond: Math.max(0, left - pl.cash.working) };
  }
  // New calls to month end at this month's live-call pace; the close rate is closes ÷ live calls month to date
  // (team median until the closer has a close). Most calls late in the month close next month.
  const ownClose = m.rates.close > 0;
  const close = ownClose ? m.rates.close : team.close;
  const perDay = m.bdElapsed ? m.live.value / m.bdElapsed : null;
  const liveLeft = perDay != null ? Math.round(perDay * c.daysLeft) : null;
  const closes = liveLeft != null && close ? liveLeft * close : null;
  const calls = { perDay, liveLeft, close, ownClose, closes, nextMonth: liveLeft != null ? liveLeft - Math.round(closes ?? 0) : null };
  const next = { booked: m.slots.booked, open: m.slots.open };
  // Realistic month end: cash so far + pipeline at usual rates + new-call closes at $17.5K each
  const realistic = (c.value ?? 0) + (pipe?.likely ?? 0) + (closes ?? 0) * per;
  return { gap, range, pipe, pull, calls, next, realistic, ratio: realistic / c.monthTarget,
    status: status(realistic, c.monthTarget) };
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
    show: median(ramped.map((m) => m.rates.show)),
    close: median(ramped.map((m) => m.rates.close)),
  };
  for (const m of metrics) {
    m.team = team;
    m.live.target = m.newHire ? null : team.live;
    m.live.status = status(m.live.value, m.live.target);
    m.path = pathToTarget(m, team);
  }
  return team;
}

export function median(values) {
  const v = values.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
}

// "18:00" -> 18, and a short label like "6pm ET (5pm Thu to Fri)"
function calendarClose(byDay) {
  if (!byDay) return null;
  const toH = (t) => { const [h, mm] = t.split(':').map(Number); return h + mm / 60; };
  const fmt = (h) => { const hr = Math.floor(h), mi = Math.round((h - hr) * 60); const h12 = ((hr + 11) % 12) + 1;
    return `${h12}${mi ? `:${String(mi).padStart(2, '0')}` : ''}${hr >= 12 ? 'pm' : 'am'}`; };
  const order = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const names = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri' };
  const hours = order.map((d) => toH(byDay[d]));
  const counts = {};
  hours.forEach((h) => { counts[h] = (counts[h] || 0) + 1; });
  const usual = Number(Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]);
  const odd = order.filter((d, i) => hours[i] !== usual);
  const oddText = odd.length ? ` (${fmt(toH(byDay[odd[0]]))} ${odd.map((d) => names[d]).join(', ')})` : '';
  const earlyDays = hours.filter((h) => h <= TARGETS.lateCloseHour).length;
  return { usual, label: `${fmt(usual)} ET${oddText}`, usualText: `${fmt(usual)} ET`, closesEarly: earlyDays >= 3 };
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
    if (m.closes.pipeline?.noAmount) flags.push(`${k}: ${m.closes.pipeline.noAmount} open pipeline leads have no cash amount (column D); valued at $17,500 each.`);
    if (m.closes.pipeline?.nonstandard) flags.push(`${k}: ${m.closes.pipeline.nonstandard} open pipeline leads have no standard status.`);
    if (!m.closes.pipeline) flags.push(`${k}: no Pipeline Review tab.`);
    if (m.cash.source === 'tracker' && m.cash.salesTrackerCash !== m.cash.value) {
      flags.push(`${k}: cash through ${ed.through} is $${m.cash.value?.toLocaleString('en-US')} in the tracker, $${m.cash.salesTrackerCash?.toLocaleString('en-US')} in the Sales Tracker snapshot.`);
    }
    if (m.cash.source === 'tracker' && m.cash.status === 'track' && !m.newHire) flags.push(`${k}: tracker has no cash target (${m.cash.targetSource ?? 'unknown'}).`);
  }
  const t = trackerFor(data, ed);
  if (!t) flags.push(`Cash pace: no tracker pull through ${ed.through}; used the provisional $200K straight-line pace.`);
  else {
    if (t.all_checks_pass === false) flags.push(`Tracker checks failed: ${t.failed_checks.join('; ') || 'see /api/read/closers'}.`);
    if (t.unmatched?.length) flags.push(`Tracker has no row for ${t.unmatched.join(', ')}; their cash pace is provisional.`);
  }
  return flags;
}

export const fmtPct = (v) => (v == null ? '–' : `${Math.round(v * 100)}%`);
export const fmtMoney = (v, short = false) => {
  if (v == null) return '–';
  if (short && Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 || v >= 100000 ? 0 : 1)}K`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
};
