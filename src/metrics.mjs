// Turns the raw pulls (activity windows, pipeline counts, slots) into scorecard
// metrics with a status per tile. Every definition here is mirrored in
// docs/METRICS.md; change both together.

export const TARGETS = {
  callsPerWorkday: 4,      // booked calls, fully ramped closers
  callsPerWeek: 20,
  slotsPerWeek: 25,        // open discovery start times, next 7 days
  slotsPerDay: 5,          // day-by-day chart guides
  showsPerDay: 3,
  lateCloseHour: 17,       // calendars that close by 5pm ET most weekdays get a Focus item
  showRate: 0.8,
  avgRevenueFloor: 17500,  // MTD revenue generated / closes
  monthlyCash: 200000,     // PROVISIONAL until per-closer targets come from the tracker DB
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

export function closerMetrics(data, closer, edition) {
  const ed = data.editions[edition];
  const act = data.activity[closer.key];
  const monday = edition === 'monday';
  const week = monday ? act.wk : act.tw;
  const mtd = monday ? act.mtd : act.mtd2;
  const prevSameDay = monday ? act.sep_sd : act.sep_sd2;
  const bdElapsed = monday ? data.month.business_days_elapsed_mon : data.month.business_days_elapsed_wed;
  const newHire = closer.new_hire;

  // Booked / showed / no-show / cancel / reschedule come from the EOD Tracker (source of truth).
  // The Sales Tracker is only a cross-check; it is used here when a closer has no EOD rows at all.
  const eod = data.eod?.[closer.key];
  const weekDays = ed.week_days.filter((d) => d <= ed.through_key);
  const eodWeek = [0, 0, 0, 0, 0];
  if (eod) weekDays.forEach((d) => (eod[d] || [0, 0, 0, 0, 0]).forEach((v, i) => { eodWeek[i] += v; }));
  const booked = eod ? eodWeek[0] : week[CALLS];
  const showed = eod ? eodWeek[1] : week[LIVE];
  const source = eod ? 'eod' : 'sales_tracker';

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
    noShow: eod ? eodWeek[2] : null, cancel: eod ? eodWeek[3] : null, resched: eod ? eodWeek[4] : null,
    confirm: data.confirmations?.[edition]?.[closer.key] ?? null,
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

  const cashExpected = newHire ? null
    : TARGETS.monthlyCash * (bdElapsed / data.month.business_days);
  const cash = {
    value: mtd[CASH], expected: cashExpected, monthTarget: newHire ? null : TARGETS.monthlyCash,
    status: status(mtd[CASH], cashExpected),
    paceRatio: cashExpected ? mtd[CASH] / cashExpected : null,
  };

  const revPerCall = { value: mtd[CALLS] ? mtd[REV] / mtd[CALLS] : null, rev: mtd[REV], calls: mtd[CALLS], status: 'track' };

  const p = data.pipeline[closer.key];
  const pipeline = p ? {
    projected: p.hc + p.sv, hc: p.hc, sv: p.sv, working: p.working, nonstandard: p.nonstandard,
    lastWeek: data.pipeline_last_week?.[closer.key] ?? null, status: 'track',
  } : null;

  const closes = { value: week[CLOSES], rev: week[REV], status: 'track' };
  const salesTrackerWeek = { booked: week[CALLS], showed: week[LIVE] };

  const mom = [
    ['Booked calls', mtd[CALLS], prevSameDay[CALLS], 'n'],
    ['Closes', mtd[CLOSES], prevSameDay[CLOSES], 'n'],
    ['Revenue generated', mtd[REV], prevSameDay[REV], '$'],
    ['Cash collected', mtd[CASH], prevSameDay[CASH], '$'],
  ].map(([label, now, prev, kind]) => ({ label, now, prev, kind, delta: prev ? (now - prev) / prev : null }));

  const daily = data.slots_daily?.[closer.key] ?? {};
  const days = ed.week_days.map((d, i) => {
    const e = eod?.[d];
    const a = e ? { booked: e[0], showed: e[1] } : (eod ? { booked: 0, showed: 0 } : (act.days[d] ?? { booked: 0, showed: 0 }));
    const future = !monday && d > ed.through_key;
    // Slots offered contain the booked calls, so never draw fewer slots than bookings
    const slotsOffered = daily[d] == null ? null : Math.max(daily[d], a.booked);
    return { d, weekend: i >= 5, future, slots: slotsOffered, booked: future ? null : a.booked, showed: future ? null : a.showed };
  });

  const scored = [calls, showRate, slots, avgRevenue, cash].filter((m) => m.status !== 'track');
  const tally = {
    hit: scored.filter((m) => m.status === 'hit').length,
    almost: scored.filter((m) => m.status === 'almost').length,
    total: scored.length,
  };

  return { closer, edition, ed, salesTrackerWeek, calls, showRate, slots, calendar, avgRevenue, cash, revPerCall, pipeline, closes, mom, days, tally, newHire };
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
    ? `${fmtPct(m.showRate.value)}. ${m.showRate.confirm.texted} of ${m.showRate.confirm.total} misses got a same-day text.`
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
    if (m.calls.source === 'sales_tracker') flags.push(`${k}: no EOD reports, booked/showed taken from the Sales Tracker.`);
    else if (st.booked !== m.calls.value || st.showed !== m.showRate.live) {
      flags.push(`${k}: EOD says ${m.calls.value} booked / ${m.showRate.live} showed, Sales Tracker says ${st.booked} / ${st.showed}.`);
    }
    const eod = data.eod?.[k];
    if (eod) {
      const missing = ed.week_days.slice(0, 5).filter((d) => d <= ed.through_key && !eod[d] && (data.activity[k].days[d]?.booked ?? 0) > 0);
      if (missing.length) flags.push(`${k}: no EOD report for ${missing.join(', ')} although the Sales Tracker logged calls.`);
    }
    const mine = slotEstimate(data, k, ed.slot_check_date);
    const messi = data.messi_slots?.[ed.slot_check_date]?.[k];
    if (mine != null && messi != null && Math.abs(messi - mine) > Math.max(5, 0.3 * messi)) {
      flags.push(`${k}: Messi shows ${messi} open slots for ${ed.slot_check_date} + 7 days, Google Calendar estimate is ${mine}.`);
    }
    const inferred = (data.eod_inferred?.[k] ?? []).filter((d) => ed.week_days.includes(d) && d <= ed.through_key);
    if (inferred.length) flags.push(`${k}: EOD "showed" left blank on ${inferred.join(', ')}; filled in as booked minus no-shows, cancels and reschedules.`);
    if (m.pipeline?.nonstandard) flags.push(`${k}: ${m.pipeline.nonstandard} open pipeline leads have no standard status.`);
    if (!m.pipeline) flags.push(`${k}: no Pipeline Review tab.`);
  }
  return flags;
}

// Unbooked slots over the 7 days from `start`, from the Google Calendar rebuild
function slotEstimate(data, key, start) {
  const days = data.slots_daily?.[key];
  const booked = data.slots_daily_booked?.[key];
  if (!days || !booked || !start) return null;
  const keys = Object.keys(days).sort();
  const i = keys.indexOf(start);
  if (i < 0) return null;
  return keys.slice(i, i + 7).reduce((a, d) => a + Math.max(days[d] - (booked[d] ?? 0), 0), 0);
}

export const fmtPct = (v) => (v == null ? '–' : `${Math.round(v * 100)}%`);
export const fmtMoney = (v, short = false) => {
  if (v == null) return '–';
  if (short && Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 || v >= 100000 ? 0 : 1)}K`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
};
