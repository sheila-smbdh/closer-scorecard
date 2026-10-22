# Closer Scorecard routine (DRAFT, not scheduled)

Do not schedule until Sheila confirms leadership sign-off. Proposed cron: `CRON_TZ=America/New_York 0 8 * * 1,3`. Decisions behind each step are in `docs/HANDOFF.md`.

## Access

- Composio: googlesheets, calendly (org access via Sheila), slack. Close MCP. Google Calendar MCP.
- Tracker read API: `https://smbdh-2m-tracker.vercel.app/api/read/*` with `Authorization: Bearer $TRACKER_READ_TOKEN` (environment secret; never print it).

## Steps

1. **Edition.** Monday: week = last Mon to Sun, MTD through Sunday. Wednesday: week = this Mon to Tue, MTD through Tuesday. All dates ET.
2. **Booked / showed.** EOD Tracker `11PnemLh8wDT-baqbYBcW3cw0zv4vl82J7NumHTh7dCc` Sheet1, rows for the week, the month to date and the same days last month. Fill any day a closer has no EOD report from Sales Tracker `Inputs` (cols A Closer, E Date, F Sched, G Live). Merged total is the truth for the week, MTD booked calls, revenue per call and MoM booked calls. Name maps: EOD "Jordan Zadrozny" / Sales Tracker "Jay Z" -> JZ; "Adam L" -> Adam.
3. **No-show confirmations.** For each EOD no-show lead (column Y lists Close lead URLs), check Close for an outbound text or email the day before or the day of the call, before it started. Count setter (Quinn Donelan, Jose Rodriguez, Jabali Dumas) vs closer.
4. **Revenue, closes, cash.** Sales Tracker `Inputs` (Close 1, Rev. Gen., Cash Collected), or `/api/read/closers`.
5. **Cash pace.** Run `node src/fetch-tracker.mjs <snapshot> <last day of the window>`, which is pre-approved in `.claude/settings.json` (a hand-written curl with the token is not, and will stop for approval). It writes `trackers["MM-DD"]` into the snapshot: per closer `pace.cash`, `pace.expected_cash`, `pace.status`, `month_target`, `target_source`, daily cumulative cash this month and last month, plus the month's goal-pace curve (about 33 API reads). If `all_checks_pass` is false, add a flag.
6. **Pipeline.** Pipeline Review `1pX0nlLTJkQ-cAzgUk0QLQrhX6xjfaviAFoQIc_NaHVc`, each closer's tab, rows under the current month header until the next month header, written to the snapshot as `pipeline_leads[key] = [[name, B status, D cash, F outcome, Close lead id], ...]` (the same format as the Friday pipeline report; reuse its pull when it is fresh). The scorecard counts and values open High Confidence / Soft Verbal / Working leads from it with the report's labels.
7. **Pipeline snapshot.** Monday: save each closer's open HC + SV lead names to `data/pipeline-snapshots/<monday>.json` and commit. Next Monday: report how many of those are now Closed or Signed.
8. **Slots.** Messi's 8am post in #sales-reports (C0C5CGGGE1M) = open start times (`messi_slots`, one entry per post day of the week, plus `editions.<ed>.slots_post_day`). Booked: pull every Calendly scheduled event, active and canceled, for each closer (Calendly `list_events` with `user` + `organization`, read only) starting from the first post of the week through 7 days after the last, save as `{pulled_at, closers: {key: [{name, start, status, created, canceled_at}]}}` (`canceled_at` = `cancellation.created_at`), then run `node src/booked-slots.mjs <snapshot> <events.json>`. Every booked call counts (closers use personal links too). Pull Calendly (discovery host schedules + busy times) to cross-check; flag differences. Calendar close time per closer from Calendly hours, converted to ET. Apply `closer_notes` (e.g. Omar away).
9. **Render.** Write the snapshot JSON, run `node src/build.mjs <snapshot> out <edition>`.
10. **Flags.** Send `out/<edition>-flags.md` to Sheila every run.
11. **Send.** Upload each PNG to the closer's Slack DM. Monday: leadership table to Sheila and Jay. Plain English, no emojis.
12. **Fail loudly.** If a source fails, DM Sheila what failed and do not send partial cards.
