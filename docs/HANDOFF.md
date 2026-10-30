# Handoff: closer scorecard (state as of Oct 20, 2026)

Read this first in a new session. Owner: Sheila.

**Repo rule:** only commit and push to `sheila-smbdh/closer-scorecard`. Never push, branch or open PRs on `zain-smbdh/smbdh-2m-tracker`; it is read-only reference (use its read API instead). The card is final (Oct 27). The routine (`docs/ROUTINE.md`) exists as a paused Claude routine, "Closer scorecard (Mon + Wed)"; Sheila turns it on when sending starts in November. Oliver and Tyler get cards from November (Sheila, Oct 30); their goals come from the monthly targets file.

## Next step (do this first)

Switch the **Cash collected pace** tile to the tracker read API (see "Tracker read API" below). `TRACKER_READ_TOKEN` is now set in the environment and `smbdh-2m-tracker.vercel.app` is allowed. Verify with:

```bash
curl -s -H "Authorization: Bearer $TRACKER_READ_TOKEN" "https://smbdh-2m-tracker.vercel.app/api/read/closers?through=2026-10-18"
```

Then, per closer: tile value = `pace.cash`, pace line = `pace.expected_cash`, status from `pace.status` (ahead / on_pace -> green, slightly_behind -> yellow, behind -> red), small text = `month_target` + `target_source`. Drop the provisional $200K straight-line pace (`TARGETS.monthlyCash` in `src/metrics.mjs`). Show `all_checks_pass: false` as a run flag. Consider also using `/api/read/closers` for MTD cash/closes/revenue instead of the Sales Tracker. Never print the token.

**Status (Oct 20):** wired. `npm run tracker -- 2026-10-18` (`src/fetch-tracker.mjs`) pulls `/api/read/closers` into the snapshot's `tracker` block; `src/metrics.mjs` uses it for the cash tile whenever `tracker.through` matches the edition's last day, and falls back to the provisional $200K straight line (with a run flag) otherwise. Run flags also cover failed tracker checks, closers with no tracker row, and tracker vs Sales Tracker cash differences. Zain's API doc: tracker `/api/read` (endpoint list and field definitions).

## What exists

- `src/metrics.mjs`: metric definitions, statuses, Wins/Focus text, run flags.
- `src/plan.mjs`: closes target, closes + pipeline, weekly targets. `src/render.mjs`: the closer card HTML. `src/build.mjs`: renders PNGs with Playwright and writes `out/<edition>-flags.md`.
- `data/sample-2026-10-19.json`: the snapshot the samples are built from (pulled Oct 20). The routine will produce one of these per run.
- `out/`: rendered samples (Monday = last week Oct 12-18; Wednesday = Oct 19-20) and flags.
- `docs/ROUTINE.md`: the routine (paused). `README.md`: metric table.

Build: `npm run monday` / `npm run wednesday` (Playwright from the global install; `node_modules` is symlinked locally, gitignored).

## Decisions Sheila made (do not re-ask)

**Roster (13):** Owen Henderson, Adam Larkins, Jordan Zadrozny (JZ, "Jay Z" in the Sales Tracker, "Jordan" in EOD), VeJohn C Heinemann, Julien Breteau (spelled Julien), Nick Vaughan, Omar Kaddoura, Harry Whyte, Solomon House, Daniel Jenkins, Kevin Manuel, Oliver English (new hire, oliver@smbdealhunter.xyz, Slack U0C4C8J3N05), Tyler Johnson (new hire, tyler@smbdealhunter.xyz, Slack U0C4MFY6EBC). Chris Cha and EJ were fired. Quinn, Yobani, Dave Martin are setters to add later when promoted. Jay DeCristofaro gets no card.

**Delivery (not live yet):** image of each card by Slack DM, 7:14am ET Monday and Wednesday (Messi's slot post moved to 6am); on the 1st of each month the previous month's final cards for every closer (with next month's plan) go to #sales-reports for Jay's 1:1s, in a thread under one "<Month> closer scorecards are in @Jay" message; no DMs on a Monday or Wednesday 1st. Monday = month to date through Sunday. Wednesday = month to date through Tuesday. No leadership table (removed Oct 27).

**Layout (Oct 27, second round):** pace chart headline = cash + closes MTD, the tracker's pace words on the badge (Ahead of pace / On pace / Slightly behind / Behind pace), month goal (cash + closes) shown large; "Your inputs, month to date" = average weekly slots, live calls, average revenue, **Pacing** (cash MTD / goal for today on the 2M curve, no small text); **Weekly Scorecard** = one table, a row per tracker week (Sun-Sat + lead-in), cash / closes / slots target vs actual with hit or missed, misses carried forward like the tracker's week cards, a month total row, plus next 7 days of slots vs 35 and how many more to open. Pipeline removed entirely (closers can move it, so it stays out of targets). Gap to target, closes to go and business days left removed. Oliver and Tyler: cards from November, goals in the monthly targets file.

**Layout (Oct 27, first round, superseded):** pace chart (cash MTD headline, % vs goal and vs last month same day, big On pace / Off pace badge, closes vs closes target; three lines: goal, last month same day, this month), then "Your inputs, month to date" (average weekly slots booked · open, live calls, average revenue, closes + pipeline HC / SV / Working), then "Weekly targets" (gap to target, closes to go, business days left; closes, cash and slots: last week target vs actual, this week target). Closes target = month cash target ÷ $17,500, used everywhere. The longer card (path to target, how the week went) and the leadership table were removed Oct 27.

**Targets:** slots 35 booked + open over the next 7 days; average revenue $17,500 (pass/fail); live calls = team median until a real target is set; closes = month target ÷ $17,500; month goals and the week-by-week curve come from Sheila every month in `data/targets/<YYYY-MM>.json` (Oct 30: the tracker's targets and curve are management-facing; the closer card uses its own). Weekly targets, goal to date and the pace badge are built from that file (`src/targets.mjs`, `src/plan.mjs`); the tracker supplies actual cash only.

**Sources of truth:**
- Booked / showed / no-show / cancel / reschedule: **EOD Tracker** (`11PnemLh8wDT-baqbYBcW3cw0zv4vl82J7NumHTh7dCc`, Sheet1: report_date, closer_name, scheduled, showed, no_showed, cancelled, rescheduled ... no_showed_leads, cancelled_leads, rescheduled_leads in X:AA). Any day a closer has no EOD report is filled from the Sales Tracker; the merged total is the source of truth, also for MTD booked calls, revenue per call and MoM booked calls. Blank EOD counts are filled from the lead lists; blank "showed" = scheduled - no-show - cancel - reschedule (VeJohn always leaves it blank) and flagged.
- Sales Tracker 2026 (`1Y7LCecej4lj2XNfVw0b_9L0KAp7Qj8WKeYM711UGsp0`, `Inputs`): cross-check and fill only; also revenue generated, cash, closes (Close 1). Revenue generated != cash collected; never mix them.
- Open slots: Messi's daily post (6am ET) in #sales-reports (C0C5CGGGE1M) = Calendly discovery start times next 7 days. Pull Calendly/Google Calendar directly and cross-check against Messi; flag conflicts to Sheila every run. Google Calendar alone undercounts badly (see flags history), so do not use it as the number.
- Pipeline: Pipeline Review (`1pX0nlLTJkQ-cAzgUk0QLQrhX6xjfaviAFoQIc_NaHVc`), each closer's tab, **current month section only**. Projected closes = count of open **High Confidence + Soft Verbal / Reengaged**; **WIP** (Working / Good Call) shown small, not counted. The Numbers tab is a reference check only. Accuracy = of last Monday's projected leads, how many are Closed/Signed by Sunday; needs a saved Monday snapshot (starts the first Monday after launch). A separate pipeline-review routine will come later with its own brief.

## Open items

1. Turn the routine on before Nov 1 (paused; Sheila decides).
2. Each month: Sheila sends closer-facing goals and the week-by-week split; save as `data/targets/<YYYY-MM>.json` before the 1st.
3. Oliver and Tyler: no EOD reports yet and "not a discovery host" per Messi, so their slot tiles stay empty until they host.
4. Julien's discovery hours taken from his "Sales Calls" Calendly schedule (8am-1pm ET); confirm.
5. Yobani and Quinn have November goals in the targets file; add them to the roster when Sheila says they are closers.
