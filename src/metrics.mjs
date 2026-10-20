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

  // Booked calls: full week target on Monday, pace-to-date target on Wednesday
  const callsTarget = newHire ? null
    : monday ? TARGETS.callsPerWeek : TARGETS.callsPerWorkday * ed.workdays_elapsed;
  const calls = {
    value: week[CALLS], target: callsTarget, weekTarget: newHire ? null : TARGETS.callsPerWeek,
    status: status(week[CALLS], callsTarget),
    projected: monday ? null : Math.round((week[CALLS] / ed.workdays_elapsed) * 5),
  };

  const showRate = {
    value: pct(week[LIVE], week[CALLS]), live: week[LIVE], booked: week[CALLS],
    target: TARGETS.showRate,
  };
  showRate.status = week[CALLS] ? status(showRate.value, TARGETS.showRate) : 'track';

  const slotCount = data.slots[edition][closer.key];
  const slots = {
    value: slotCount, target: TARGETS.slotsPerWeek,
    status: slotCount == null ? 'track' : status(slotCount, TARGETS.slotsPerWeek),
  };

  const calendar = calendarClose(data.calendar_close_et?.[closer.key]);

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

  const mom = [
    ['Booked calls', mtd[CALLS], prevSameDay[CALLS], 'n'],
    ['Closes', mtd[CLOSES], prevSameDay[CLOSES], 'n'],
    ['Revenue generated', mtd[REV], prevSameDay[REV], '$'],
    ['Cash collected', mtd[CASH], prevSameDay[CASH], '$'],
  ].map(([label, now, prev, kind]) => ({ label, now, prev, kind, delta: prev ? (now - prev) / prev : null }));

  const daily = data.slots_daily?.[closer.key] ?? {};
  const days = ed.week_days.map((d, i) => {
    const a = act.days[d] ?? { booked: 0, showed: 0 };
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

  return { closer, edition, ed, calls, showRate, slots, calendar, avgRevenue, cash, revPerCall, pipeline, closes, mom, days, tally, newHire };
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

export function winsAndFixes(m) {
  const wins = [], fixes = [];
  const money = (v) => `$${Math.round(v).toLocaleString('en-US')}`;
  const monday = m.edition === 'monday';
  const when = monday ? 'last week' : 'so far this week';

  if (m.slots.status === 'hit') wins.push(['Open slots', `${m.slots.value} discovery slots open for the next 7 days.`]);
  else if (m.slots.status !== 'track') fixes.push(['Open slots', `Only ${m.slots.value} discovery slots open for the next 7 days. Target is 25. Open more time in Calendly.`]);

  if (m.calendar?.closesEarly) fixes.push(['Later slots', `Your calendar closes at ${m.calendar.usualText} most days. Try to open up slots later, after 5pm ET, when more prospects can book.`]);

  if (m.calls.status === 'hit') wins.push(['Booked calls', `${m.calls.value} ${when} against a target of ${m.calls.target}.`]);
  else if (m.calls.target != null) fixes.push(['Booked calls', monday
    ? `${m.calls.value} of ${m.calls.target} last week. Open more discovery time and work your follow-up list.`
    : `${m.calls.value} so far, pace is ${m.calls.target} by today. You're on track for about ${m.calls.projected} by Friday.`]);

  if (m.showRate.status === 'hit') wins.push(['Show rate', `${fmtPct(m.showRate.value)} of booked calls showed. Target is 80%.`]);
  else if (m.showRate.status !== 'track') fixes.push(['Show rate', `${m.showRate.live} of ${m.showRate.booked} booked calls showed (${fmtPct(m.showRate.value)}). Confirm every call the day before and the hour before.`]);

  if (m.avgRevenue.status === 'hit') wins.push(['Average revenue', `${money(m.avgRevenue.value)} per close this month, above the $17,500 floor.`]);
  else if (m.avgRevenue.status === 'missed') fixes.push(['Average revenue', `${money(m.avgRevenue.value)} per close this month, below the $17,500 floor. Hold price before discounting.`]);

  if (m.cash.status === 'hit') wins.push(['Cash pace', `${money(m.cash.value)} collected this month, ahead of pace.`]);
  else if (m.cash.status !== 'track') fixes.push(['Cash pace', `${money(m.cash.value)} collected, pace is ${money(m.cash.expected)} by now. Push your High Confidence deals to sign and pay.`]);

  if (m.pipeline?.nonstandard) fixes.push(['Pipeline sheet', `${m.pipeline.nonstandard} open leads in your October tab have no standard status. Tag each one High Confidence, Soft Verbal / Reengaged or WIP (Working / Good Call).`]);

  return { wins: wins.slice(0, 4), fixes: fixes.slice(0, 4) };
}

export const fmtPct = (v) => (v == null ? '–' : `${Math.round(v * 100)}%`);
export const fmtMoney = (v, short = false) => {
  if (v == null) return '–';
  if (short && Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 || v >= 100000 ? 0 : 1)}K`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
};
