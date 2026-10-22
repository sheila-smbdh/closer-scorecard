# Closer Scorecard

Weekly scorecard image for each closer, plus a Monday leadership table.

**Friday pipeline report (live):** every Friday 1:00pm ET, one image of all 13 closers by pod to #sales-strategy. See `docs/PIPELINE_ROUTINE.md`; build with `node src/pipeline-report.mjs data/pipeline-<date>.json out`. All sources are read-only.

- **Monday 8:00am ET**: last week's final numbers (Mon to Sun) to each closer, and the leadership table.
- **Wednesday 8:00am ET**: this week so far, with pace against target.

Start with `docs/HANDOFF.md` for decisions and next steps.

Status: **samples only, awaiting leadership sign-off.** Nothing is scheduled and nothing is sent to closers yet.

## Build the samples

```bash
npm run monday      # out/monday-<closer>.png + out/monday-leadership.png
npm run wednesday   # out/wednesday-<closer>.png
```

`src/build.mjs` reads a data snapshot (`data/sample-2026-10-19.json`), computes metrics (`src/metrics.mjs`), renders HTML (`src/render.mjs`) and screenshots each card with Playwright.

## Roster (13)

Owen Henderson, Adam Larkins, Jordan Zadrozny (JZ), VeJohn C Heinemann, Julien Breteau, Nick Vaughan, Omar Kaddoura, Harry Whyte, Solomon House, Daniel Jenkins, Kevin Manuel, Oliver English (new hire), Tyler Johnson (new hire).
Not carded: Jay DeCristofaro (manages closers). Quinn, Yobani and Dave Martin are setters on track for promotion: add them when promoted.

## Layout (pacing first)

1. **Pace chart** (top), drawn like the 2M tracker's closer view: cumulative cash by day (actual MTD, gold dot today), the goal-pace curve × month target (dashed), and last month's curve on the same normalized day (blue), with W1-W4 end lines. Header: cash MTD, same-day MoM %, vs pace and vs the team median (MED); caption ends with month end at this pace.
2. **How the week went** (the inputs a closer controls): open slots, live calls month to date, average revenue, closes actual vs projected (High Confidence / Soft Verbal / Working).
3. **Where we're headed**: upcoming slot availability (next 7 days) and the monthly target, on track or off pace, with what is left and how many closes that takes.

Removed in the Oct 22 revamp: show rate, revenue per call, the Wins / Focus boxes, month over month.

## Metrics

| Metric | Definition | Target | Source |
|---|---|---|---|
| Pace chart data | `daily_cumulative_cash` per closer this month and last month (`/api/read/closers`, `/api/read/closers?month=<prior>`); goal-pace curve = `/api/read/month?through=<each day>` `pace.expected_cash` ÷ `goal`, × the closer's month target | – | Tracker read API, written to `trackers["MM-DD"]` by `npm run tracker -- <through>` |
| Pace | Cash collected MTD ÷ the tracker's `expected_cash` by the last day of the window (back-loaded month curve). Month end at this pace = % of pace × month target. Chip: On pace (ahead / on_pace), Slightly behind, Off pace | Per-closer `month_target` | `/api/read/closers` (`TRACKER_READ_TOKEN`); provisional $200K straight line if the snapshot has no tracker pull |
| Team median | Middle value across fully ramped closers (new hires excluded) for pace, live calls, slots, average revenue | – | Computed per run |
| Discovery slots (week) | For each of Messi's daily posts that week: open start times over the next 7 days + client calls already booked in those 7 days (as Calendly stood at 8am). Card shows the daily average, its booked / open split and the lowest day | 25 on booked + open | Messi in #sales-reports (`messi_slots`) + Calendly (`slots_booked`, via `node src/booked-slots.mjs <snapshot> <calendly-events.json>`) |
| Live calls | Showed calls month to date (EOD + Sales Tracker fills), with the week's live / booked | Team median | EOD Tracker + Sales Tracker `Inputs` |
| Average revenue | Revenue generated ÷ closes (Close 1), month to date | $17,500 (pass/fail) | `Inputs` |
| Closes: actual vs projected | Actual = Close 1 MTD. Projected month end = actual + 80% of open High Confidence + 50% of open Soft Verbal / Reengaged (Friday pipeline KPI). Working shown, not counted. Needed = month target ÷ $17,500, shown as "Need 24 for $417K" | Needed for target | `Inputs`, Pipeline Review closer tabs |
| Upcoming slots | Same as above for the edition day's post: booked + open over the next 7 days, shown as "N already booked, M real openings left", plus "Calendar open till X" (ET); warns if most weekdays close by 5pm ET | 25 on booked + open | Messi + Calendly |
| Monthly target | Month target, what is left, business days left, closes still needed at $17.5K vs what the pipeline should yield | – | Tracker + Pipeline Review |

Colors: green hit, yellow 75%+ of target, red below, blue tracked with no target.
Revenue generated is contract value booked at close; cash collected is money actually received (installments included). They are never mixed.

## Known data issues (found while building the samples)

- **Pipeline statuses are not standard on every tab.** Nick uses his own labels ("Responsive - Luke Warm", "Warm - Reviewing info."); Kevin, Solomon and Daniel use "Verbal" or leave Status blank; Harry has 3 blank rows and a "Reengagd" typo. Those closers show 0 projected with an "N leads need a status" flag until the tabs are fixed.
- **Oliver and Tyler have no Pipeline Review tab** and are "not a discovery host" in Calendly yet.
- **Julien logged 1 live call with 0 booked** in the week of Oct 12, so show rate is blank.
- Messi's Calendly counts are a rolling next-7-days view. Calendly cannot report last week's availability, so the Monday card shows the slots open for the coming week.

## Open items before launch

1. Leadership sign-off on layout and definitions.
2. Oliver and Tyler new-hire targets.
3. Switch cash pace to the tracker read API (`TRACKER_READ_TOKEN` is set; see `docs/HANDOFF.md`).
4. Direct Calendly slot count to cross-check Messi (the discovery event is a round-robin, so per-closer slots come from each host's availability).
5. Closers clean up pipeline statuses.

## Run flags

Every build writes `out/<edition>-flags.md` for Sheila only: days filled from the Sales Tracker, EOD vs Sales Tracker totals, blank EOD "showed" values that were inferred, untagged pipeline leads, closers with no pipeline tab or EOD reports.
