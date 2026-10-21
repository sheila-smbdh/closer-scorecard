# Friday pipeline report (DRAFT, not scheduled)

**Read-only rule (Sheila):** never write to or change anything in Google Sheets, Close, Calendly, the tracker or any other source. Only read. The only output is the weekly report image posted for the team (plus the flags file to Sheila).

Sample: `out/pipeline-2026-10-20.png`. Proposed cron: `CRON_TZ=America/New_York 0 13 * * 5`. Destination: #sales-strategy (channel link pending from Sheila).

## Pods
1. Owen's pod: Owen, JZ (Jay Z), Adam, VeJohn
2. Jay's pod, fully ramped: Nick, Harry, Omar, Julien
3. Jay's pod, newly ramped (month 4): Kevin, Solomon, Daniel
4. Ramping: Tyler, Oliver

## Steps
1. Pipeline Review `1pX0nlLTJkQ-cAzgUk0QLQrhX6xjfaviAFoQIc_NaHVc`: each closer's tab, rows under the current month header until the next month header, as `[name, status (B), expected cash (D), outcome (F), Close lead id (from the C link)]` into `pipeline_leads`. Also note where any Close-paid lead sits outside that section (`pipeline_index`).
2. Close: `find_opportunities` status won, close date in the month (paginate). Keep those with a Cash Collected value as `close_won` `[closer, contact, lead id, cash, paid date]`. Opportunities owned by setters are listed in the flags only.
3. Sales Tracker 2026 (`1Y7LCecej4lj2XNfVw0b_9L0KAp7Qj8WKeYM711UGsp0`) `Inputs`: this month's rows (A Closer, E Date, J Close 1, W Cash Collected) into `sales_tracker` as `[date, Close 1, cash]` per closer ("Jay Z" -> JZ, "Adam L" -> Adam).
4. Render: `node src/pipeline-report.mjs <data.json> out`. Writes the PNG, `out/pipeline-<date>-flags.md`, `out/pipeline-<date>-leads.md` (every lead's bucket) and `data/pipeline-snapshots/<date>.json`. Commit the snapshot.
5. Post the PNG to #sales-strategy; send the flags file to Sheila.
6. If Pipeline Review, Close or the Sales Tracker fails, DM Sheila and do not post.

## Definitions
- Labeling convention: column B = High Confidence / Soft Verbal / Working; column F = Closed / Signed / Delayed. During the switch an outcome in column B (and TRUE in F) is still read; the lead's category then comes from the last snapshot that saw it open, else "not recorded".
- Closed column and actual cash = Sales Tracker (Close 1, Cash Collected) for the month, so they always match. Close names the deals; Close deals dated the 1st-2nd that the Sales Tracker counted in the prior month are left out (flagged). Count or cash differences between the Sales Tracker and Close are flagged. Sub line: which Pipeline Review section each close sat in (this month, an earlier month, or not on the sheet).
- Signed, not paid yet = Closed or Signed on the sheet with no payment in Close (own column). Delayed and Lost are neither open nor closed.
- Cash projected vs collected on closes = column D amount vs Close cash collected for each paid lead found on the sheet (any section); mismatches listed in flags. "Verbal" counts as High Confidence and is flagged for relabeling.
- KPI: 80% of High Confidence and 50% of Soft Verbal / Reengaged closed by month end, over every lead in that category this month (open + closed). Working: no KPI.
- Projected cash = collected + signed-not-paid + every open HC and SV lead (column D). If KPIs hit = collected + signed + 80% of open HC + 50% of open SV.
- Close check: every Closed/Signed lead must have a paid, won Close opportunity; amounts that differ from column D, Close payments still marked open on the sheet, and Close payments missing from the month's section are flagged.
