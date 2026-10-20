# Closer Scorecard routine (DRAFT, not scheduled)

Do not schedule until leadership signs off. Proposed cron: `CRON_TZ=America/New_York 0 8 * * 1,3`.

## Connectors

Composio: googlesheets (Sheila), calendly (org access via Sheila), slack. Google Calendar for the cross-check. Supabase secrets once Zain provides them.

## Steps

1. **Edition.** Monday: week = last Mon to Sun, MTD through Sunday. Wednesday: week = this Mon to Tue, MTD through Tuesday. All dates ET.
2. **Activity.** Read `Inputs!A2:Y` (unbounded rows) from Sales Tracker 2026 `1Y7LCecej4lj2XNfVw0b_9L0KAp7Qj8WKeYM711UGsp0`, unformatted, dates as serials. Columns: 0 Closer, 4 Date, 5 Sched, 6 Live, 7 Offers, 9 Close 1, 21 Rev Gen, 22 Cash. Map sheet names: `Adam L`→Adam, `Jay Z`→JZ, `Tyler `→Tyler (trim). Never match on first name alone across tabs. Cross-check MTD totals against `Leaderboard!B11:N` (stop at first blank name; a "Previous Month" block sits below).
3. **Pipeline.** Pipeline Review `1pX0nlLTJkQ-cAzgUk0QLQrhX6xjfaviAFoQIc_NaHVc`, one tab per closer. Take rows under the current month's header (e.g. "October", case-insensitive) until the next month header. Count Status: High Confidence, Soft Verbal / Reengaged (accept the "Reengagd" typo), Working / Good Call; Closed and Signed are won; anything else open (blank, "Verbal", custom labels) is "needs a status". The Numbers tab is a reference check only, never the source.
4. **Pipeline snapshot.** On Monday, save each closer's open HC + SV lead names to `data/pipeline-snapshots/<monday>.json` and commit. On the next Monday, report how many of last week's leads are now Closed or Signed. The sheet only holds current status, so without the snapshot accuracy cannot be measured.
5. **Slots.** For each closer: the hosts of the discovery event types (round-robin "Discovery Call with SMB Deal Hunter Pro" and S2C, plus personal discovery events), their availability schedule, and Calendly busy times, giving bookable start times over the next 7 days. Compare with Messi's 8:00am post in #sales-reports (C0C5CGGGE1M); flag any closer whose counts differ by more than 2 in the leadership footer.
6. **Targets.** Fully ramped: 25 booked calls a week (5 a workday), 25 slots, 80% show rate, $17,500 average revenue floor, cash target from `tracker_live_state.overrides` / ramp targets (fallback $200K, labelled provisional). New hires (Oliver, Tyler): their new-hire targets.
7. **Render.** Write the snapshot JSON and run `node src/build.mjs <snapshot> out <edition>`.
8. **Send.** Upload each PNG to the closer's Slack DM (IDs in the data file). Monday: also send the leadership table to Sheila and Jay. House style: plain English, no emojis, no dashes as punctuation.
9. **Fail loudly.** If any source fails, DM Sheila what failed and do not send partial cards.
