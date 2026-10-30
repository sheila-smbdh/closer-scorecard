# Closer Scorecard

Month-to-date scorecard image for each closer.

**Friday pipeline report (live):** every Friday 11:30am ET, one image of all 13 closers by pod to #sales-strategy. See `docs/PIPELINE_ROUTINE.md`; build with `node src/pipeline-report.mjs data/pipeline-<date>.json out`. All sources are read-only.

- **1st of the month, 7:14am ET**: the whole previous month, every closer's card in a thread under one "<Month> closer scorecards are in @Jay" message in #sales-reports, for Jay's 1:1s. On a Monday or Wednesday 1st only this goes out (no DMs).
- **Monday 7:14am ET**: month to date through Sunday, by DM.
- **Wednesday 7:14am ET**: month to date through Tuesday, by DM.

Start with `docs/HANDOFF.md` for decisions and next steps.

Status: **final card, routine paused.** The Monday and Wednesday routine (`docs/ROUTINE.md`) is set up but paused until sending starts in November. Oliver and Tyler are skipped until their ramp targets are set.

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

1. **Pace chart**: cash collected and closes month to date (headline), % vs goal pace and % vs last month on the same day, a pace badge (Ahead of pace / On pace / Slightly behind / Behind pace, the tracker's words and bands), and the month goal (cash and closes). Three lines: goal (the closer-facing curve × month target), last month on the same normalized day, this month to date.
2. **Your inputs, month to date**: average weekly slots (booked · open), live calls, average revenue, Pacing (cash collected month to date / the goal for today on the closer-facing curve, with the pace badge).
3. **Weekly Scorecard**: one table, one row per week of the month (the 2M tracker's weeks: Sun-Sat, leading partial days folded into Week 1, a trailing remnant under 7 days is the "Final stretch"). Cash collected, closes and slots per week: actual / target with Hit / Missed for finished weeks, "so far" for the week in progress, target only for upcoming weeks. Misses carry forward like the tracker's week cards (see Weekly Scorecard below). The first unfinished week's slots cell shows the next 7 days (booked + open) against 35 and how many more slots to open. A last row gives the month: month to date vs the month goal.

4. **<Month> plan** (1st-of-month edition only, `node src/build.mjs <snapshot> out monthly`): the new month's weeks with share of the month, cash, closes and slots targets, for Jay to set the month's goal with each closer. Goal and weekly split from the new month's targets file; left off (and flagged) when that file is missing.

No pipeline on the card: pipeline is self-reported by closers, so it stays out of the targets.

Everything about closes is anchored on the month's closes target = month cash target ÷ $17,500 (Owen: $417K → 24).

## Closer targets (set by Sheila each month)

`data/targets/<YYYY-MM>.json` holds the closer-facing numbers; the 2M tracker's targets and curve are management-facing and are not used on the card.

```json
{ "month": "2026-11",
  "weeks": [0.12, 0.18, 0.2, 0.25, 0.25],
  "closers": { "Owen": { "cash": 450000 }, "Nick": { "cash": 300000, "closes": 18 } } }
```

- `weeks`: each week's share of the month, one per week of the tracker's calendar (Sun-Sat, lead-in folded into Week 1, a trailing remnant under 7 days is its own "Final stretch"), adding up to 1. November 2026 has 5: Nov 1-7, 8-14, 15-21, 22-28, 29-30.
- `closers[key].cash`: month goal; `closes` is optional (default cash ÷ $17,500).
- `data/targets/2026-10.json` is a sample built from the tracker so the October samples render.

## Metrics

| Metric | Definition | Target | Source |
|---|---|---|---|
| Pace / Pacing tile | Cash collected MTD vs goal to date = month goal × the closer-facing curve at the last day of the window (each week's share spread evenly over its days). Badge, with the tracker's bands: Ahead of pace (≥ +5%), On pace (≥ −3%), Slightly behind (≥ −10%), Behind pace. Chart: `daily_cumulative_cash` this month and last month (`/api/read/closers`, `?month=<prior>`) | Closer-facing month goal (`data/targets/<YYYY-MM>.json`) | Actual cash: tracker read API (`TRACKER_READ_TOKEN`) via `npm run tracker -- <through>`; goals: Sheila's targets file, never the tracker's (management-facing) targets |
| Closes | Close 1 month to date vs month target ÷ $17,500 | Closes target | Sales Tracker `Inputs` |
| Average weekly slots | Every Messi post this month (6am ET; 8am before late Oct 2026) (his count starts Oct 9): open discovery start times over the next 7 days + client calls already booked in those 7 days (as Calendly stood at the post), averaged. Shown as booked · open | 35 (booked + open) | Messi in #sales-reports (`messi_slots`) + Calendly (`slots_booked`, via `node src/booked-slots.mjs <snapshot> <calendly-events.json>`) |
| Live calls | Calls that showed, month to date (EOD reports; Sales Tracker for any day without one) | Team median of fully ramped closers, until a real target is set | EOD Tracker + Sales Tracker `Inputs` |
| Average revenue | Revenue generated ÷ closes (Close 1), month to date | $17,500 (pass/fail) | `Inputs` |
| Weekly Scorecard | Cash target: month target × the goal curve at the week's end, minus cash banked before the week (so a finished week is hit only if the closer is back on the pace line, and the first unfinished week carries any deficit); weeks after that get their plain slice of the curve. Closes: the same with the closes target (curve × closes target, rounded). Slots: 35. Actuals: cash from `daily_cash`, closes from `daily_closes`, slots = average of that week's Messi posts; next 7 days = the edition-day post | – | Closer-facing targets file; Sales Tracker `Inputs` column J (Close 1) per day (`daily_closes`) |

Colors: green hit, yellow 75%+ of target, red below, blue tracked with no target.
Revenue generated is contract value booked at close; cash collected is money actually received (installments included). They are never mixed.

## Known data issues (found while building the samples)

- **Oliver and Tyler** are "not a discovery host" in Calendly yet and have no cash target, so they get no Pacing goal or Weekly Scorecard table.
- `daily_closes` has to be pulled from the Sales Tracker `Inputs` tab (column J by date); the tracker read API's `closes_mtd` ignores `through`.
- Messi's Calendly counts are a rolling next-7-days view, starting Oct 9, 2026; slots before that day cannot be reconstructed.

## Open items before launch

1. Oliver and Tyler ramp targets (Sheila to send).
2. Turn the routine on in November.
3. A real live-calls target (the team median stands in).
4. Revisit the month targets (closes targets are derived from them).
5. Direct Calendly slot count to cross-check Messi (the discovery event is a round-robin, so per-closer slots come from each host's availability).

## Run flags

Every build writes `out/<edition>-flags.md` for Sheila only: days filled from the Sales Tracker, EOD vs Sales Tracker totals, blank EOD "showed" values that were inferred, closers with no EOD reports.
