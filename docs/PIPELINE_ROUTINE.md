# Friday pipeline report (routine)

Runs every Friday at 11:30am ET (`CRON_TZ=America/New_York 30 11 * * 5`), ahead of the 1pm ET review call. Posts one PNG to **#sales-strategy** (`C0C8TGWKLTD`) and DMs the flags file to Sheila (Slack `U0BM6J8KM32`).

**Read-only rule (Sheila):** never write to or change anything in Google Sheets, Close, Calendly, the tracker, Slack history or any other source. Only read. The only outputs are the report image in #sales-strategy and the flags DM to Sheila. Never message closers.

## Pods (13 closers)
1. Owen's pod: Owen, JZ (Jay Z), Adam, VeJohn
2. Jay's pod, fully ramped: Nick, Harry, Omar, Julien
3. Jay's pod, newly ramped (month 4): Kevin, Solomon, Daniel
4. Ramping: Tyler, Oliver

## Steps
1. **Dates.** `report_date` = today (ET, YYYY-MM-DD). `month` = this month's name. `as_of_label` like `Fri Oct 23`.
2. **Snapshot file.** Copy `data/pipeline-2026-10-20.json` to `data/pipeline-<report_date>.json` and replace every data block below (keep `closers`). Drop `cash_notes` unless verified this run.
3. **Pipeline Review** (`1pX0nlLTJkQ-cAzgUk0QLQrhX6xjfaviAFoQIc_NaHVc`, Composio googlesheets, read only). Tabs Owen, JZ, Adam, VeJohn, Julien, Nick, Omar, Harry, Kevin, Solomon, Daniel (Oliver and Tyler have none yet; add them when a tab appears). Rows under this month's header until the next month header, skipping blank names, as `pipeline_leads[key] = [[name, B status, D cash, F outcome, Close lead id from the C link], ...]`. For every Close-paid lead (step 4) not in this month's section, record where it sits: `pipeline_index[lead_id] = [section header, name, B status, D cash]`.
4. **Close** (Close MCP `find_opportunities`, read only): `status_type: won`, `close_at` from the 1st of the month to the 1st of next month, paginate to the end. Keep those with a "Cash Collected" custom field as `close_won = [[closer key, contact name, lead id, cash collected, "MM-DD" close date], ...]`. Map owner names: Owen Henderson -> Owen, Jordan Zadrozny -> JZ, Adam Larkins -> Adam, VeJohn Heinemann -> VeJohn, Julien Breteau -> Julien, Nick Vaughan -> Nick, Omar Kaddoura -> Omar, Harry Whyte -> Harry, Kevin Manuel -> Kevin, Solomon House -> Solomon, Daniel Jenkins -> Daniel, Oliver English -> Oliver, Tyler Johnson -> Tyler; anyone else (setters) keep their first name. Set `close_pulled_at`.
5. **Sales Tracker 2026** (`1Y7LCecej4lj2XNfVw0b_9L0KAp7Qj8WKeYM711UGsp0`, `Inputs`, read only): this month's rows (A Closer, E Date, J Close 1, W Cash Collected) with a close or cash, as `sales_tracker[key] = [["MM-DD", close1, cash], ...]` ("Jay Z" -> JZ, "Adam L" -> Adam; every closer key present, `[]` if none). This is the source of truth for the closed count and actual cash.
6. **Cash differences.** For any closer where the run flags "Sales Tracker cash vs Close", search #cash-collected (`C072K6CFXD5`, read only) for the lead and add a one-line explanation to `cash_notes[key]` (e.g. split payments across months).
7. **Render.** `node src/pipeline-report.mjs data/pipeline-<report_date>.json out` (Playwright: `ln -s "$(npm root -g)" node_modules` if missing). Look at the PNG before posting.
8. **Post.** Upload `out/pipeline-<report_date>.png` to #sales-strategy with one plain line: "Pipeline review, <month>, as of <as_of_label>." No emojis, no other text. DM Sheila `out/pipeline-<report_date>-flags.md` (as a file or pasted text).
9. **Save.** Commit `data/pipeline-<report_date>.json`, `data/pipeline-snapshots/<report_date>.json` and `out/pipeline-<report_date>*` and push to `main` (the snapshot keeps each lead's category after it closes).
10. **Fail loudly.** If Pipeline Review, Close or the Sales Tracker cannot be read, DM Sheila what failed and do not post to #sales-strategy.

## Definitions
- Labeling convention: column B = High Confidence / Soft Verbal / Working; column F = Closed / Signed / Delayed. During the switch an outcome in column B (and TRUE in F) is still read; the lead's category then comes from the last snapshot that saw it open, else "not recorded".
- "Verbal" counts as High Confidence and is flagged for relabeling.
- Closed and actual cash = Sales Tracker (Close 1, Cash Collected) for the month, so they always match. Close names the deals; Close deals dated the 1st-2nd that the Sales Tracker counted in the prior month are left out (flagged). Sub line: which Pipeline Review section each close sat in (this month, an earlier month, or not on the sheet).
- Signed, not paid yet = Closed or Signed on the sheet with no payment in Close (own column). Delayed and Lost are neither open nor closed.
- KPI: 80% of High Confidence and 50% of Soft Verbal / Reengaged closed by month end, over every lead in that category this month (open + closed). Working: no KPI.
- Cash projected vs collected on closes = column D amount vs Close cash collected for each paid lead found on the sheet; mismatches listed in flags.
- Projected cash = collected + signed-not-paid + every open HC and SV lead (column D). If KPIs hit = collected + signed + 80% of open HC + 50% of open SV. The chip under actual cash is actual ÷ projected.
