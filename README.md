# Closer Scorecard

Month-to-date scorecard image for each closer.

**Friday pipeline report (live):** every Friday 11:30am ET, one image of all 13 closers by pod to #sales-strategy. See `docs/PIPELINE_ROUTINE.md`; build with `node src/pipeline-report.mjs data/pipeline-<date>.json out`. All sources are read-only.

- **Monday 8:00am ET**: month to date through Sunday.
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

1. **Pace chart**: cash collected and closes month to date (headline), % vs goal pace and % vs last month on the same day, the 2M tracker's pace badge (Ahead of pace / On pace / Slightly behind / Behind pace), and the month goal (cash and closes). Three lines: goal (the 2M tracker's curve × month target), last month on the same normalized day, this month to date.
2. **Your inputs, month to date**: average weekly slots (booked · open), live calls, average revenue, Pacing (cash collected month to date / the goal for today on the 2M tracker's curve, with the tracker's pace badge).
3. **Weekly Scorecard**: one table, one row per week of the month (the 2M tracker's weeks: Sun-Sat, leading partial days folded into Week 1, a trailing remnant under 7 days is the "Final stretch"). Cash collected, closes and slots per week: actual / target with Hit / Missed for finished weeks, "so far" for the week in progress, target only for upcoming weeks. Misses carry forward like the tracker's week cards (see Weekly Scorecard below). The first unfinished week's slots cell shows the next 7 days (booked + open) against 35 and how many more slots to open. A last row gives the month: month to date vs the month goal.

No pipeline on the card: pipeline is self-reported by closers, so it stays out of the targets.

Everything about closes is anchored on the month's closes target = month cash target ÷ $17,500 (Owen: $417K → 24).

## Metrics

| Metric | Definition | Target | Source |
|---|---|---|---|
| Pace / Pacing tile | Cash collected MTD vs the tracker's `expected_cash` by the last day of the window (back-loaded month curve). Badge from `pace.status`: On pace (ahead / on_pace), Slightly behind, Off pace. Chart: `daily_cumulative_cash` this month and last month (`/api/read/closers`, `?month=<prior>`); goal curve = `/api/read/month?through=<each day>` `pace.expected_cash` ÷ `goal`, × month target | Per-closer `month_target` | Tracker read API (`TRACKER_READ_TOKEN`) via `npm run tracker -- <through>` into `trackers["MM-DD"]`; provisional $200K straight line if there is no pull |
| Closes | Close 1 month to date vs month target ÷ $17,500 | Closes target | Sales Tracker `Inputs` |
| Average weekly slots | Every 8am Messi post this month (his count starts Oct 9): open discovery start times over the next 7 days + client calls already booked in those 7 days (as Calendly stood at 8am), averaged. Shown as booked · open | 35 (booked + open) | Messi in #sales-reports (`messi_slots`) + Calendly (`slots_booked`, via `node src/booked-slots.mjs <snapshot> <calendly-events.json>`) |
| Live calls | Calls that showed, month to date (EOD reports; Sales Tracker for any day without one) | Team median of fully ramped closers, until a real target is set | EOD Tracker + Sales Tracker `Inputs` |
| Average revenue | Revenue generated ÷ closes (Close 1), month to date | $17,500 (pass/fail) | `Inputs` |
| Weekly Scorecard | Cash target: month target × the goal curve at the week's end, minus cash banked before the week (so a finished week is hit only if the closer is back on the pace line, and the first unfinished week carries any deficit); weeks after that get their plain slice of the curve. Closes: the same with the closes target (curve × closes target, rounded). Slots: 35. Actuals: cash from `daily_cash`, closes from `daily_closes`, slots = average of that week's Messi posts; next 7 days = the edition-day post | – | Tracker goal curve; Sales Tracker `Inputs` column J (Close 1) per day (`daily_closes`) |

Colors: green hit, yellow 75%+ of target, red below, blue tracked with no target.
Revenue generated is contract value booked at close; cash collected is money actually received (installments included). They are never mixed.

## Known data issues (found while building the samples)

- **Oliver and Tyler** are "not a discovery host" in Calendly yet and have no cash target, so they get no Pacing goal or Weekly Scorecard table.
- `daily_closes` has to be pulled from the Sales Tracker `Inputs` tab (column J by date); the tracker read API's `closes_mtd` ignores `through`.
- Messi's Calendly counts are a rolling next-7-days view, starting Oct 9, 2026; slots before that day cannot be reconstructed.

## Open items before launch

1. Leadership sign-off on layout and definitions.
2. Oliver and Tyler new-hire targets.
3. A real live-calls target (the team median stands in).
4. Revisit the month targets (closes targets are derived from them).
5. Direct Calendly slot count to cross-check Messi (the discovery event is a round-robin, so per-closer slots come from each host's availability).

## Run flags

Every build writes `out/<edition>-flags.md` for Sheila only: days filled from the Sales Tracker, EOD vs Sales Tracker totals, blank EOD "showed" values that were inferred, closers with no EOD reports.
