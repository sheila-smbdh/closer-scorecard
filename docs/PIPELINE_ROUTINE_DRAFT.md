# Friday pipeline report (DRAFT, not scheduled)

Sample: `out/pipeline-2026-10-20.png`. Proposed cron: `CRON_TZ=America/New_York 0 13 * * 5`. Destination: #sales-strategy (channel link pending from Sheila).

## Pods
1. Owen's pod: Owen, JZ (Jay Z), Adam, VeJohn
2. Jay's pod, fully ramped: Nick, Harry, Omar, Julien
3. Jay's pod, newly ramped (month 4): Kevin, Solomon, Daniel
4. Ramping: Tyler, Oliver

## Steps
1. Pipeline Review `1pX0nlLTJkQ-cAzgUk0QLQrhX6xjfaviAFoQIc_NaHVc`: each closer's tab, rows under the current month header until the next month header, as `[name, status (B), expected cash (D), Closed? (F)]` into `pipeline_leads`.
2. Actual cash: `node src/fetch-tracker.mjs <data.json> <report date>` (cash_mtd, month_target).
3. Render: `node src/pipeline-report.mjs <data.json> out`.
4. Post the PNG to #sales-strategy; send `out/pipeline-<date>-flags.md` to Sheila.
5. Save that Friday's lead statuses to `data/pipeline-snapshots/<date>.json` so month-end KPIs can tell which closed leads were High Confidence vs Soft Verbal (the sheet overwrites the status with Closed).

## Definitions
- Closed = status Closed or Signed, or the Closed? box ticked. Delayed and Lost are not open.
- KPI: 80% of High Confidence and 50% of Soft Verbal / Reengaged closed by month end. Working: no KPI.
- Projected cash = closed + open HC + open SV (column D). At KPI = closed + 80% HC + 50% SV.
- Blank, "Verbal" or personal statuses are flagged as "need a status" and not counted.
