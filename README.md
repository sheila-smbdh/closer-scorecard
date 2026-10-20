# Closer Scorecard

Weekly scorecard image for each closer, plus a Monday leadership table.

- **Monday 8:00am ET**: last week's final numbers (Mon to Sun) to each closer, and the leadership table.
- **Wednesday 8:00am ET**: this week so far, with pace against target.

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
| Booked calls | Sched. calls in the week (Mon to Sun) | 25 a week, 5 a workday (fully ramped). New hires: their own targets (pending) | Sales Tracker 2026, `Inputs` |
| Show rate | Live calls ÷ booked calls, same week | 80% | `Inputs` |
| Open slots | Discovery start times Calendly offers over the next 7 days | 25 | Calendly, cross-checked against Messi in #sales-reports |
| Average revenue | Revenue generated ÷ closes (Close 1), month to date | Floor $17,500 (pass/fail) | `Inputs` / `Leaderboard` |
| Cash collected pace | Cash collected MTD vs monthly target × business days elapsed ÷ business days in month | $200K a month **provisional** until per-closer targets come from the tracker DB | `Inputs` |
| Projected closes | Open **High Confidence + Soft Verbal / Reengaged** leads in the closer's current-month section. Working / Good Call shown in small type, not counted | None (tracked) | Pipeline Review, closer tabs |
| Pipeline accuracy | Of last Monday's projected leads, how many are Closed or Signed by Sunday | None (tracked) | Weekly pipeline snapshot (starts first Monday after launch) |
| Revenue per call | Revenue generated ÷ booked calls, month to date | None (tracked) | `Inputs` |
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
3. Tracker Supabase URL + service-role key as environment secrets (Zain), for per-closer cash targets.
4. Direct Calendly + Google Calendar slot count (see `docs/ROUTINE_DRAFT.md`). The discovery event is a round-robin ("Discovery Call with SMB Deal Hunter Pro", Enrollment Team), so per-closer slots come from each host's availability, not the pooled event.
5. Closers clean up pipeline statuses.
