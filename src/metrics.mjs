// Turns the raw pulls (activity windows, pipeline counts, slots) into scorecard
// metrics with a status per tile. Every definition here is mirrored in
// docs/METRICS.md; change both together.

export const TARGETS = {
  callsPerWorkday: 4,      // booked calls, fully ramped closers
  callsPerWeek: 20,
  slotsPerWeek: 25,        // open discovery start times, next 7 days
  lateCloseHour: 17,       // calendars that close by 5pm ET most weekdays get a Focus item
  showRate: 0.8,
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

const pct = (a, b) => (b ? a / b : null);

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

// Same day-of-month last month: "10-18" -> "09-18"
const prevMonth = (d) => `${String(Number(d.slice(0, 2)) - 1).padStart(2, '0')}${d.slice(2)}`;

export function closerMetrics(data, closer, edition) {
  const ed = data.editions[edition];
  const act = data.activity[closer.key];
  const monday = edition === 'monday';
  const week = monday ? act.wk : act.tw;
  const mtd = monday ? act.mtd : act.mtd2;
  const prevSameDay = monday ? act.sep_sd : act.sep_sd2;
  const bdElapsed = monday ? data.month.business_days_elapsed_mon : data.month.business_days_elapsed_wed;
  const newHire = closer.new_hire;

  const k = closer.key;
  const wk = bookedShowed(data, k, ed.week_days[0], ed.through_key);
  const monthStart = `${ed.through_key.slice(0, 2)}-01`;
  const mtdBS = bookedShowed(data, k, monthStart, ed.through_key);
  const prevBS = bookedShowed(data, k, prevMonth(monthStart), prevMonth(ed.through_key));
  const booked = wk.booked, showed = wk.showed;
  const source = wk.hasEod ? 'eod' : 'sales_tracker';

  // Booked calls: full week target on Monday, pace-to-date target on Wednesday
  const callsTarget = newHire ? null
    : monday ? TARGETS.callsPerWeek : TARGETS.callsPerWorkday * ed.workdays_elapsed;
  const calls = {
    value: booked, target: callsTarget, weekTarget: newHire ? null : TARGETS.callsPerWeek,
    status: status(booked, callsTarget), source,
    projected: monday ? null : Math.round((booked / ed.workdays_elapsed) * 5),
  };

  const showRate = {
    value: pct(showed, booked), live: showed, booked, target: TARGETS.showRate,
    noShow: wk.hasEod ? wk.noShow : null, cancel: wk.hasEod ? wk.cancel : null, resched: wk.hasEod ? wk.resched : null,
    filled: wk.filled,
    confirm: data.noshow_confirm?.[edition]?.[closer.key] ?? null,
  };
  showRate.status = booked ? status(showRate.value, TARGETS.showRate) : 'track';

  const slotCount = data.slots[edition][closer.key];
  const slots = {
    value: slotCount, target: TARGETS.slotsPerWeek,
    status: slotCount == null ? 'track' : status(slotCount, TARGETS.slotsPerWeek),
  };

  const calendar = calendarClose(data.calendar_close_et?.[closer.key]);
  const away = data.closer_notes?.[closer.key] ?? null;
  if (calendar && away) calendar.away = away;

  const avgRevenue = {
    value: mtd[CLOSES] ? mtd[REV] / mtd[CLOSES] : null, rev: mtd[REV], closes: mtd[CLOSES],
    target: TARGETS.avgRevenueFloor,
  };
  // A floor is pass/fail: no yellow band
  avgRevenue.status = avgRevenue.value == null ? 'track'
    : avgRevenue.value >= TARGETS.avgRevenueFloor ? 'hit' : 'missed';

  // Cash pace: the tracker read API (back-loaded month curve, per-closer targets) when the snapshot has it
  const tp = data.tracker?.through?.slice(5) === ed.through_key ? data.tracker.closers?.[closer.key] : null;
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

  const revPerCall = { value: mtdBS.booked ? mtd[REV] / mtdBS.booked : null, rev: mtd[REV], calls: mtdBS.booked, status: 'track' };

  // Pipeline: the live pull (with targeted cash) when the snapshot has it, else the Monday counts
  const live = data.pipeline_live?.[closer.key];
  const p = live?.open ? live : data.pipeline[closer.key];
  const pipeline = p ? {
    projected: p.hc + p.sv, hc: p.hc, sv: p.sv, working: p.working, nonstandard: p.nonstandard ?? 0,
    projCash: live?.open ? live.proj_cash : null, amountEstimated: live?.amount_estimated ?? 0,
    lastWeek: data.pipeline_last_week?.[closer.key] ?? null, status: 'track',
  } : null;

  // Speed to lead and touches from Close (tracked against the team median, no target yet)
  const ca = data.close_activity?.closers?.[closer.key];
  const team = data.close_activity?.team;
  const speed = ca ? {
    biz: ca.reply.biz, after: ca.reply.after, teamBiz: team.reply_biz_median, teamAfter: team.reply_after_median, status: 'track',
  } : null;
  const touches = ca?.touches ? { ...ca.touches, team: team.touches_per_lead_median, status: 'track' } : null;

  const closes = { value: week[CLOSES], rev: week[REV], status: 'track' };
  const salesTrackerWeek = { booked: week[CALLS], showed: week[LIVE] };

  const mom = [
    ['Booked calls', mtdBS.booked, prevBS.booked, 'n'],
    ['Closes', mtd[CLOSES], prevSameDay[CLOSES], 'n'],
    ['Revenue generated', mtd[REV], prevSameDay[REV], '$'],
    ['Cash collected', mtd[CASH], prevSameDay[CASH], '$'],
  ].map(([label, now, prev, kind]) => ({ label, now, prev, kind, delta: prev ? (now - prev) / prev : null }));

  const scored = [calls, showRate, slots, avgRevenue, cash].filter((m) => m.status !== 'track');
  const tally = {
    hit: scored.filter((m) => m.status === 'hit').length,
    almost: scored.filter((m) => m.status === 'almost').length,
    total: scored.length,
  };

  const filled = { week: wk.filled, mtd: mtdBS.filled, prev: prevBS.filled };
  return { closer, edition, ed, salesTrackerWeek, filled, calls, showRate, slots, calendar, avgRevenue, cash, revPerCall, pipeline, speed, touches, closes, mom, tally, newHire };
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

// One or two short bullets each, most important first
export function winsAndFixes(m) {
  const wins = [], fixes = [];
  const money = (v) => fmtMoney(v, true);
  const monday = m.edition === 'monday';

  if (m.slots.status === 'hit') wins.push(['Open slots', `${m.slots.value} open, target 25.`]);
  else if (m.slots.status !== 'track') fixes.push(['Open slots', `${m.slots.value} of 25. Open more Calendly time.`]);

  if (m.calls.status === 'hit') wins.push(['Booked calls', `${m.calls.value}, target ${m.calls.target}.`]);
  else if (m.calls.target != null) fixes.push(['Booked calls', monday ? `${m.calls.value} of ${m.calls.target}.` : `${m.calls.value} vs ${m.calls.target} pace by today.`]);

  if (m.showRate.status === 'hit') wins.push(['Show rate', `${fmtPct(m.showRate.value)}, target 80%.`]);
  else if (m.showRate.status !== 'track') fixes.push(['Show rate', m.showRate.confirm?.total
    ? `${fmtPct(m.showRate.value)}. ${m.showRate.confirm.confirmed} of ${m.showRate.noShow} no-shows were confirmed.`
    : `${fmtPct(m.showRate.value)}, target 80%.`]);

  if (m.calendar?.closesEarly && !m.calendar.away) fixes.push(['Later slots', `Calendar closes ${m.calendar.usualText}. Open slots after 5pm ET.`]);

  if (m.avgRevenue.status === 'hit') wins.push(['Average revenue', `${money(m.avgRevenue.value)}, above the $17.5K floor.`]);
  else if (m.avgRevenue.status === 'missed') fixes.push(['Average revenue', `${money(m.avgRevenue.value)}, below the $17.5K floor.`]);

  if (m.cash.status === 'hit') wins.push(['Cash', `${money(m.cash.value)}, ahead of pace.`]);
  else if (m.cash.status !== 'track') fixes.push(['Cash', `${money(m.cash.value)} vs ${money(m.cash.expected)} pace.`]);

  if (m.pipeline?.nonstandard) fixes.push(['Pipeline sheet', `Tag ${m.pipeline.nonstandard} leads with a status.`]);

  return { wins: wins.slice(0, 2), fixes: fixes.slice(0, 2) };
}

// Things Sheila should see on every run; never shown to closers
export function runFlags(data, metrics, edition) {
  const flags = [];
  const ed = data.editions[edition];
  for (const m of metrics) {
    const k = m.closer.key;
    const st = m.salesTrackerWeek;
    if (m.calls.source === 'sales_tracker') flags.push(`${k}: no EOD reports at all, booked/showed taken from the Sales Tracker.`);
    else if (m.filled.week.length) flags.push(`${k}: no EOD report for ${m.filled.week.join(', ')}; filled from the Sales Tracker.`);
    if (m.calls.source === 'eod' && (st.booked !== m.calls.value || st.showed !== m.showRate.live)) {
      flags.push(`${k}: week totals (EOD + fills) ${m.calls.value} booked / ${m.showRate.live} showed, Sales Tracker alone ${st.booked} / ${st.showed}.`);
    }
    const mtdFills = m.filled.mtd.filter((d) => !m.filled.week.includes(d));
    if (m.calls.source === 'eod' && mtdFills.length) flags.push(`${k}: month to date also filled from the Sales Tracker on ${mtdFills.join(', ')}.`);
    const inferred = (data.eod_inferred?.[k] ?? []).filter((d) => d >= ed.week_days[0] && d <= ed.through_key);
    if (inferred.length) flags.push(`${k}: EOD "showed" left blank on ${inferred.join(', ')}; filled in as booked minus no-shows, cancels and reschedules.`);
    if (m.pipeline?.nonstandard) flags.push(`${k}: ${m.pipeline.nonstandard} open pipeline leads have no standard status.`);
    if (!m.pipeline) flags.push(`${k}: no Pipeline Review tab.`);
    if (m.pipeline?.amountEstimated) flags.push(`${k}: ${m.pipeline.amountEstimated} projected leads have no cash amount in Pipeline Review; targeted cash uses their median deal.`);
    const ca = data.close_activity?.closers?.[k];
    if (ca) {
      const un = ca.reply.biz.unanswered + ca.reply.after.unanswered;
      if (un) flags.push(`${k}: ${un} inbound texts/emails last week got no reply within 3 days (many are replies to sequence blasts such as "who is this" or "thanks").`);
      if (ca.touches?.leads === 0 && data.pipeline_live?.[k]?.open) flags.push(`${k}: open pipeline leads have no Close link, so touches per lead can't be counted.`);
    }
    if (m.cash.source === 'tracker' && m.cash.salesTrackerCash !== m.cash.value) {
      flags.push(`${k}: cash through ${ed.through} is $${m.cash.value?.toLocaleString('en-US')} in the tracker, $${m.cash.salesTrackerCash?.toLocaleString('en-US')} in the Sales Tracker snapshot.`);
    }
    if (m.cash.source === 'tracker' && m.cash.status === 'track' && !m.newHire) flags.push(`${k}: tracker has no cash target (${m.cash.targetSource ?? 'unknown'}).`);
  }
  const t = data.tracker;
  if (!t || t.through?.slice(5) !== ed.through_key) flags.push(`Cash pace: no tracker pull through ${ed.through}; used the provisional $200K straight-line pace.`);
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
