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

## Metrics

| Metric | Definition | Target | Source |
|---|---|---|---|
| Open slots | Discovery start times Calendly offers over the next 7 days. Tile also shows "Calendar open till X" (latest end of the closer's Calendly discovery hours, ET); if most weekdays close by 5pm ET, Focus says to open later slots | 25 | Calendly, cross-checked against Messi in #sales-reports |
| Booked calls | Scheduled calls in the week (Mon to Sun) | 20 a week, 4 a workday (fully ramped). New hires: their own targets (pending) | EOD Tracker; any day without an EOD report is filled from Sales Tracker `Inputs`, and that merged total is the source of truth (also for month to date, revenue per call and month over month) |
| Show rate | Showed ÷ booked, same week. Small text: No-show (with how many got a text/email confirmation the day before or same day, split setter vs closer), Cancel, Rescheduled | 80% | EOD Tracker (+ Sales Tracker fills); confirmations from Close |
| Average revenue | Revenue generated ÷ closes (Close 1), month to date | Floor $17,500 (pass/fail) | `Inputs` / `Leaderboard` |
| Cash collected pace | Samples: cash MTD vs $200K × business days elapsed ÷ business days (provisional). Next: tracker read API `pace.expected_cash` on the tracker's back-loaded curve and each closer's real `month_target` | Per-closer target from the tracker | `/api/read/closers` (`TRACKER_READ_TOKEN`) |
| Projected closes | Open **High Confidence + Soft Verbal / Reengaged** leads in the closer's current-month section. WIP (Working / Good Call) shown in small type, not counted | None (tracked) | Pipeline Review, closer tabs |
| Pipeline accuracy | Of last Monday's projected leads, how many are Closed or Signed by Sunday | None (tracked) | Weekly pipeline snapshot (starts first Monday after launch) |
| Revenue per call | Revenue generated ÷ booked calls (EOD + fills), month to date | None (tracked) | `Inputs` + EOD Tracker |
| Closes | Close 1 in the week, with revenue generated | None (tracked) | `Inputs` |
| Month over month | MTD booked calls, closes, revenue generated, cash vs the same days last month | None | `Inputs` |

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
