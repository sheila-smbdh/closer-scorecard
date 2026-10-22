# Handoff: closer scorecard (state as of Oct 20, 2026)

Read this first in a new session. Owner: Sheila.

**Repo rule:** only commit and push to `sheila-smbdh/closer-scorecard`. Never push, branch or open PRs on `zain-smbdh/smbdh-2m-tracker`; it is read-only reference (use its read API instead). Nothing has been sent to closers and no routine is scheduled: Sheila is getting leadership sign-off on the samples first.

## Next step (do this first)

Switch the **Cash collected pace** tile to the tracker read API (see "Tracker read API" below). `TRACKER_READ_TOKEN` is now set in the environment and `smbdh-2m-tracker.vercel.app` is allowed. Verify with:

```bash
curl -s -H "Authorization: Bearer $TRACKER_READ_TOKEN" "https://smbdh-2m-tracker.vercel.app/api/read/closers?through=2026-10-18"
```

Then, per closer: tile value = `pace.cash`, pace line = `pace.expected_cash`, status from `pace.status` (ahead / on_pace -> green, slightly_behind -> yellow, behind -> red), small text = `month_target` + `target_source`. Drop the provisional $200K straight-line pace (`TARGETS.monthlyCash` in `src/metrics.mjs`). Show `all_checks_pass: false` as a run flag. Consider also using `/api/read/closers` for MTD cash/closes/revenue instead of the Sales Tracker. Never print the token.

**Status (Oct 20):** wired. `npm run tracker -- 2026-10-18` (`src/fetch-tracker.mjs`) pulls `/api/read/closers` into the snapshot's `tracker` block; `src/metrics.mjs` uses it for the cash tile whenever `tracker.through` matches the edition's last day, and falls back to the provisional $200K straight line (with a run flag) otherwise. Run flags also cover failed tracker checks, closers with no tracker row, and tracker vs Sales Tracker cash differences. Zain's API doc: tracker `/api/read` (endpoint list and field definitions).

## What exists

- `src/metrics.mjs`: metric definitions, statuses, Wins/Focus text, run flags.
- `src/render.mjs`: closer card + leadership table HTML. `src/build.mjs`: renders PNGs with Playwright and writes `out/<edition>-flags.md`.
- `data/sample-2026-10-19.json`: the snapshot the samples are built from (pulled Oct 20). The routine will produce one of these per run.
- `out/`: rendered samples (Monday = last week Oct 12-18; Wednesday = Oct 19-20) and flags.
- `docs/ROUTINE_DRAFT.md`: the routine plan. `README.md`: metric table.

Build: `npm run monday` / `npm run wednesday` (Playwright from the global install; `node_modules` is symlinked locally, gitignored).

## Decisions Sheila made (do not re-ask)

**Roster (13):** Owen Henderson, Adam Larkins, Jordan Zadrozny (JZ, "Jay Z" in the Sales Tracker, "Jordan" in EOD), VeJohn C Heinemann, Julien Breteau (spelled Julien), Nick Vaughan, Omar Kaddoura, Harry Whyte, Solomon House, Daniel Jenkins, Kevin Manuel, Oliver English (new hire, oliver@smbdealhunter.xyz, Slack U0C4C8J3N05), Tyler Johnson (new hire, tyler@smbdealhunter.xyz, Slack U0C4MFY6EBC). Chris Cha and EJ were fired. Quinn, Yobani, Dave Martin are setters to add later when promoted. Jay DeCristofaro gets no card.

**Delivery (not live yet):** image of each card by Slack DM, 8:00am ET. Monday = last week's final numbers (Mon-Sun) + a leadership table (one row per closer). Wednesday = this week so far.

**Layout (Oct 22 revamp, centered on pacing):** pace tracker on top (cash vs pace by today vs team median; Sheila is sharing a screenshot of the exact pace-tracker look to match), then "How the week went" (open slots, live calls MTD, average revenue, closes actual vs projected with HC / SV / Working) and "Where we're headed" (upcoming slots, monthly target on track / off pace). **Removed:** show rate, revenue per call, Wins / Focus, month over month, day-by-day.

**Targets:** open slots 25 / 7 days; booked calls 20 a week (4 a workday) for ramped closers, Oliver/Tyler have new-hire targets (still pending from Sheila); show rate 80%; average revenue floor $17,500 (MTD revenue generated / closes, pass/fail); revenue per call and pipeline are tracking only (blue).

**Sources of truth:**
- Booked / showed / no-show / cancel / reschedule: **EOD Tracker** (`11PnemLh8wDT-baqbYBcW3cw0zv4vl82J7NumHTh7dCc`, Sheet1: report_date, closer_name, scheduled, showed, no_showed, cancelled, rescheduled ... no_showed_leads, cancelled_leads, rescheduled_leads in X:AA). Any day a closer has no EOD report is filled from the Sales Tracker; the merged total is the source of truth, also for MTD booked calls, revenue per call and MoM booked calls. Blank EOD counts are filled from the lead lists; blank "showed" = scheduled - no-show - cancel - reschedule (VeJohn always leaves it blank) and flagged.
- Sales Tracker 2026 (`1Y7LCecej4lj2XNfVw0b_9L0KAp7Qj8WKeYM711UGsp0`, `Inputs`): cross-check and fill only; also revenue generated, cash, closes (Close 1). Revenue generated != cash collected; never mix them.
- Open slots: Messi's 8am post in #sales-reports (C0C5CGGGE1M) = Calendly discovery start times next 7 days. Pull Calendly/Google Calendar directly and cross-check against Messi; flag conflicts to Sheila every run. Google Calendar alone undercounts badly (see flags history), so do not use it as the number.
- Pipeline: Pipeline Review (`1pX0nlLTJkQ-cAzgUk0QLQrhX6xjfaviAFoQIc_NaHVc`), each closer's tab, **current month section only**. Projected closes = count of open **High Confidence + Soft Verbal / Reengaged**; **WIP** (Working / Good Call) shown small, not counted. The Numbers tab is a reference check only. Accuracy = of last Monday's projected leads, how many are Closed/Signed by Sunday; needs a saved Monday snapshot (starts the first Monday after launch). A separate pipeline-review routine will come later with its own brief.

**Show rate tile (removed Oct 22; kept for reference if it comes back)** small text:
```
No-show: 8 · 6 pre-call confirmation sent by closer
Cancel: 2
Rescheduled: 1
```
With a setter: "No-show: 3 · 2 pre-call confirmation sent by setter, 1 by closer". Confirmation = a text or email to the no-show lead the day before or the day of the call, before it started (Close). Setter if any setter (Quinn Donelan, Jose Rodriguez, Jabali Dumas) sent one, else closer. Responsibility sits with setters; the card only reports it.

**Calendar close time** on the slots tile ("Calendar open till 6pm ET (5pm Thu, Fri)") from each closer's Calendly discovery hours. If most weekdays close by 5pm ET, Focus says to open slots after 5pm. **Exception:** Omar is in Dubai until about early November; show "Open evening slots when back" instead of the Focus item (`closer_notes` in the data file).

## Open items

1. Cash pace via tracker read API (above).
2. Oliver / Tyler new-hire targets (ask Sheila).
3. Oliver and Tyler: no Pipeline Review tab, no EOD reports, "not a discovery host" per Messi (Tyler has Calendly hours on the round-robin event though).
4. Pipeline statuses not standard for Nick (own labels), Kevin, Solomon, Daniel ("Verbal"/blank), Harry (3 blank). Shown as "N leads need a status".
5. Julien's discovery hours taken from his "Sales Calls" Calendly schedule (8am-1pm ET); confirm.
6. Leadership sign-off, then schedule the routine (do not schedule before Sheila says so).
