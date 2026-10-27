# Closer Scorecard

Month-to-date scorecard image for each closer.

**Friday pipeline report (live):** every Friday 11:30am ET, one image of all 13 closers by pod to #sales-strategy. See `docs/PIPELINE_ROUTINE.md`; build with `node src/pipeline-report.mjs data/pipeline-<date>.json out`. All sources are read-only.

- **Monday 8:00am ET**: month to date through Sunday, last week's targets vs actual, and this week's targets.
- **Wednesday 8:00am ET**: month to date through Tuesday.

Start with `docs/HANDOFF.md` for decisions and next steps.

Status: **samples only, awaiting leadership sign-off.** Nothing is scheduled and nothing is sent to closers yet.

## Build the samples

```bash
npm run monday      # out/monday-<closer>.png + out/monday-flags.md
npm run wednesday   # out/wednesday-<closer>.png + out/wednesday-flags.md
node src/build.mjs data/sample-2026-10-19.json out monday Owen   # one closer
```

`src/build.mjs` reads a data snapshot (`data/sample-2026-10-19.json`), computes metrics (`src/metrics.mjs`) and the closes and weekly targets (`src/plan.mjs`), renders HTML (`src/render.mjs`) and screenshots each card with Playwright.

## Roster (13)

Owen Henderson, Adam Larkins, Jordan Zadrozny (JZ), VeJohn C Heinemann, Julien Breteau, Nick Vaughan, Omar Kaddoura, Harry Whyte, Solomon House, Daniel Jenkins, Kevin Manuel, Oliver English (new hire), Tyler Johnson (new hire).
Not carded: Jay DeCristofaro (manages closers). Quinn, Yobani and Dave Martin are setters on track for promotion: add them when promoted.

## Layout

Title: "<Closer>'s month to date: Sunday, October 18th" (the last day of the window).

1. **Pace chart**: cash collected month to date (headline), % vs goal pace and % vs last month on the same day, a large On pace / Slightly behind / Off pace badge, and closes this month vs the closes target. Three lines: goal (the 2M tracker's curve × month target), last month on the same normalized day, this month to date.
2. **Your inputs, month to date**: average weekly slots (booked · open), live calls, average revenue, closes + pipeline (closed + open High Confidence / Soft Verbal / Working leads) against the closes target.
3. **Weekly targets**: gap to target, closes to go, business days left; then closes, cash collected and slots: last week's target, last week's actual (hit / missed) and this week's target.

Everything about closes is anchored on the month's closes target = month cash target ÷ $17,500 (Owen: $417K → 24).

## Metrics

| Metric | Definition | Target | Source |
|---|---|---|---|
| Pace | Cash collected MTD vs the tracker's `expected_cash` by the last day of the window (back-loaded month curve). Badge from `pace.status`: On pace (ahead / on_pace), Slightly behind, Off pace. Chart: `daily_cumulative_cash` this month and last month (`/api/read/closers`, `?month=<prior>`); goal curve = `/api/read/month?through=<each day>` `pace.expected_cash` ÷ `goal`, × month target | Per-closer `month_target` | Tracker read API (`TRACKER_READ_TOKEN`) via `npm run tracker -- <through>` into `trackers["MM-DD"]`; provisional $200K straight line if there is no pull |
| Closes | Close 1 month to date vs month target ÷ $17,500 | Closes target | Sales Tracker `Inputs` |
| Average weekly slots | Every 8am Messi post this month (his count starts Oct 9): open discovery start times over the next 7 days + client calls already booked in those 7 days (as Calendly stood at 8am), averaged. Shown as booked · open | 35 (booked + open) | Messi in #sales-reports (`messi_slots`) + Calendly (`slots_booked`, via `node src/booked-slots.mjs <snapshot> <calendly-events.json>`) |
| Live calls | Calls that showed, month to date (EOD reports; Sales Tracker for any day without one) | Team median of fully ramped closers, until a real target is set | EOD Tracker + Sales Tracker `Inputs` |
| Average revenue | Revenue generated ÷ closes (Close 1), month to date | $17,500 (pass/fail) | `Inputs` |
| Closes + pipeline | Closes so far + open High Confidence, Soft Verbal and Working leads in this month's Pipeline Review section (labels shared with the Friday report, `src/pipeline-labels.mjs`) | Closes target | `Inputs`, Pipeline Review closer tabs (`pipeline_leads`) |
| Weekly targets | Cash: (month target − cash at the start of the week) × that week's share of the rest of the month on the goal curve. Closes: (closes target − closes at the start of the week) × the same share, rounded. Slots: 35. Last week = the target as set at its start vs actual | – | Tracker goal curve + the above |

Colors: green hit, yellow 75%+ of target, red below, blue tracked with no target.
Revenue generated is contract value booked at close; cash collected is money actually received (installments included). They are never mixed.

## Known data issues (found while building the samples)

- **Pipeline statuses are not standard on every tab.** Nick uses his own labels ("Responsive - Luke Warm", "Warm - Reviewing info."); Kevin, Solomon and Daniel use "Verbal" or leave Status blank; Harry has 3 blank rows and a "Reengagd" typo. Leads with no standard status are left out of the pipeline count and listed in the run flags until the tabs are fixed.
- **Oliver and Tyler have no Pipeline Review tab** and are "not a discovery host" in Calendly yet.
- Messi's Calendly counts are a rolling next-7-days view, starting Oct 9, 2026; slots before that day cannot be reconstructed.

## Open items before launch

1. Leadership sign-off on layout and definitions.
2. Oliver and Tyler new-hire targets.
3. A real live-calls target (the team median stands in).
4. Weekly targets: keep the tracker's back-loaded curve, or split what is left evenly across the remaining weeks.
5. Revisit the month targets (closes targets are derived from them).
6. Direct Calendly slot count to cross-check Messi (the discovery event is a round-robin, so per-closer slots come from each host's availability).
7. Closers clean up pipeline statuses and fill in lead amounts.

## Run flags

Every build writes `out/<edition>-flags.md` for Sheila only: days filled from the Sales Tracker, EOD vs Sales Tracker totals, blank EOD "showed" values that were inferred, untagged pipeline leads, closers with no pipeline tab or EOD reports.
