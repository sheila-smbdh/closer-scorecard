# Closer Scorecard routine

Runs at 7:14am ET on the 1st of every month and every Monday and Wednesday (`CRON_TZ=America/New_York 14 7 1 * 1,3`: day-of-month and day-of-week together fire on either), after Messi's 6am slot post. **Paused until Sheila turns it on (sending starts in November).** Decisions behind each step are in `docs/HANDOFF.md`; metric definitions are in `README.md`.

**Which run (ET date):**
- **1st of the month: monthly edition.** The whole previous month (through its last day), every fully ramped closer's card posted to **#sales-reports** (`C0C5CGGGE1M`) for Jay's 1:1s. The card adds a **<New month> plan** table: the new month's weeks with each week's share of the month and its cash, closes and slots targets, so Jay can set the month's goal with the closer. It uses the tracker's target for the new month when the tracker already has a fresh one, otherwise the month just ended's target as the starting point (the card says which). No DMs from this edition.
- **Monday: Monday edition**, month to date through Sunday, one DM per closer.
- **Wednesday: Wednesday edition**, month to date through Tuesday, one DM per closer.
- When the 1st is a Monday or Wednesday, run the monthly edition first, then that day's edition. A Monday 1st's DM covers the same days as the monthly card, so send it too: closers get their own copy. A Wednesday 1st's window (this Monday and Tuesday) can sit in the previous month; it still runs as written.

**Read-only rule:** never write to or change anything in Google Sheets, Calendly, the tracker, Slack history or any other source. The only outputs are the #sales-reports post on the 1st, one DM per closer on Monday and Wednesday, the flags DM to Sheila (Slack `U0BM6J8KM32`), and the run's snapshot committed to this repo.

**Who gets a card:** the 11 fully ramped closers in `closers` (Owen, Adam, JZ, VeJohn, Julien, Nick, Omar, Harry, Solomon, Daniel, Kevin), each by Slack DM to the `slack` id in the roster. **Oliver and Tyler are skipped** until Sheila sets their ramp targets; list them in the flags as "not sent: ramp target not set".

## Access

- Google Sheets (read only): EOD Tracker `11PnemLh8wDT-baqbYBcW3cw0zv4vl82J7NumHTh7dCc`, Sales Tracker 2026 `1Y7LCecej4lj2XNfVw0b_9L0KAp7Qj8WKeYM711UGsp0` (tab `Inputs`). The Drive read tool only returns a few rows of `Inputs`; export the workbook as .xlsx and parse it locally.
- Slack: read #sales-reports (`C0C5CGGGE1M`), send DMs.
- Calendly: `list_events` per closer, read only.
- Tracker read API via `node src/fetch-tracker.mjs` (pre-approved in `.claude/settings.json`; it reads `TRACKER_READ_TOKEN`, never print it).
- Playwright: `ln -s "$(npm root -g)" node_modules` if `node_modules` is missing.

## Steps

1. **Edition and dates (ET).** Monday: month to date through Sunday; the snapshot's `editions.monday.week_days` = last Mon..Sun. Wednesday: month to date through Tuesday; `editions.wednesday.week_days` = this Mon..Sun. Monthly (the 1st): through the last day of the previous month; `editions.monthly.week_days` = the last 7 days of that month; it reads the Monday-style blocks (`mtd`, `wk`, `business_days_elapsed_mon`, `days_mon`). `through_key` = the last day of the window ("MM-DD"), `slots_post_day` = today. When the window is in the previous month, use that month throughout (its sheets rows, tracker month and Messi posts).
2. **Snapshot.** Start from `data/sample-2026-10-19.json` for the shape (keep `closers`), write `data/scorecard-<today>.json`, and replace every data block for this run's edition: `month` (label, prev_label, business_days, business_days_elapsed_<mon|wed>, days_<mon|wed>), `editions.<edition>`, `activity`, `slots` (keyed by edition), `messi_slots`, `slots_booked`, `daily_eod`, `daily_st`, `eod_inferred`, `daily_closes`. Drop blocks the card no longer reads (`pipeline_leads`, `pipeline_last_week`, `noshow_confirm`).
3. **Booked / showed.** EOD Tracker Sheet1 rows for the month to date as `daily_eod[key]["MM-DD"] = [scheduled, showed, no-show, cancelled, rescheduled]`; Sales Tracker `Inputs` (A Closer, E Date, F Sched, G Live) as `daily_st[key]["MM-DD"] = [sched, live]`. A blank EOD "showed" = scheduled − no-show − cancel − reschedule, listed in `eod_inferred[key]`. Name maps: EOD "Jordan Zadrozny" / Sales Tracker "Jay Z" → JZ; "Adam L" → Adam.
4. **Revenue, closes, cash.** Sales Tracker `Inputs` (J Close 1, V Rev. Gen., W Cash Collected) into `activity[key]` arrays `[booked calls, live calls, offers, closes, revenue generated, cash collected]` for `mtd` (Monday, monthly) or `mtd2` (Wednesday), and `wk` (Monday, monthly) or `tw` (Wednesday) for the edition week. Per-day Close 1 as `daily_closes[key]["MM-DD"] = n` (days with closes only) through `through_key`; it must add up to the month-to-date closes.
5. **Cash pace.** `node src/fetch-tracker.mjs data/scorecard-<today>.json <YYYY-MM-DD of through_key>`; for the monthly edition add `--next-month` (stores the new month's curve and targets for the planning table). If `all_checks_pass` is false it becomes a flag.
6. **Slots.** Every Messi 6am post in #sales-reports this month → `messi_slots["MM-DD"][key]` (set `messi_post_hour_et: 6`) (open start times, next 7 days; today's post included) and `slots.<edition>[key]` = today's numbers. Booked: pull every Calendly scheduled event, active and canceled, for each closer from the first post of the month through 7 days after today, save as `{pulled_at, closers: {key: [{name, start, status, created, canceled_at}]}}` (`canceled_at` = `cancellation.created_at`), then `node src/booked-slots.mjs data/scorecard-<today>.json <events.json>`.
7. **Render.** `node src/build.mjs data/scorecard-<today>.json out <edition>`. Look at two or three PNGs before sending: title date, weekly rows add up (closes in the rows = closes in the month row), no blank tiles.
8. **Send.**
   - Monday / Wednesday: for each fully ramped closer, upload `out/<edition>-<key>.png` to their DM with one plain line: "Your scorecard, month to date through <Weekday, Month Dth>." No emojis, no other text.
   - Monthly: post to #sales-reports (`C0C5CGGGE1M`) one plain line, "Closer scorecards for <Month>, final (for 1:1s).", then upload each fully ramped closer's `out/monthly-<key>.png` in roster order with the closer's full name as the comment. Nothing else in the channel.
9. **Flags.** DM Sheila `out/<edition>-flags.md` every run, with Oliver and Tyler listed as not sent.
10. **Save.** Commit `data/scorecard-<today>.json` and push to `main`. Do not commit `out/` (the images go out by Slack).
11. **Fail loudly.** If any source fails (sheet, Slack history, Calendly, tracker), DM Sheila what failed and send no cards that run (no channel post, no DMs). Never send partial cards.
