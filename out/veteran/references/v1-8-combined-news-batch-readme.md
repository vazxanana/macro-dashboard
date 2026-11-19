# GPTMacro V1.8 combined news batch for the assistant

This ZIP consolidates **V1.6, V1.7, and all later work through this handoff**. It is the complete *news-research increment after V1.5*, so the assistant can use this single ZIP instead of separately importing V1.6 and V1.7. Keep the already shared V1.5 base and its corrections. Nothing here enables cTrader live trading or contains credentials.

## Contents and current files

- Inflation release sequencing, dated CPI/PPI/PCE values, expanding-window forecast checks, and ten demo news hypotheses from V1.6. The broad aggregate PPI signal did **not** demonstrate robust added PCE forecast skill.
- `outputs/employment-situation-multifield-with-hours-2022-2024.csv`: the current 36-event BLS jobs ledger with payroll, unemployment, wages, hours and prior-two-month revisions. The other labor CSVs document extraction stages. `work/validate_employment_headline_2022_2024.py` checks the preserved source excerpts.
- `outputs/news-expectation-source-and-timing-gates-2026-11-19.md` and `outputs/employment-pre-release-expectation-gate-2022-2024.csv`: candidate expectation feeds and 36 deliberately **empty** pre-release consensus fields. `Forecast` from a later historical calendar row is not evidence of the consensus visible before the event.
- `outputs/employment-regular-release-date-overlap-audit-2022-2024.json` and `outputs/ism-jobs-same-day-verified-2022-2024.json`: zero matches in seven bounded regular/partial inventories, but **seven verified same-day ISM Manufacturing or Services reports** outside those inventories. The ISM list is evidence of overlaps, not a complete absence check. Rebuild the join with `work/audit_jobs_regular_release_overlap_2022_2024.py`.

## Required interpretation

Archived BLS pages were captured later; exact original web bytes and market receipt times are unauthenticated. Never compute a wage/hours change across separate release vintages. January 2022 has no standard two-month payroll revision statement in the extraction; blanks mean missing. Do not turn the 36-event panel into a surprise study until a verified pre-release consensus snapshot exists. Do not turn a release-day price path into an executable trade result without timestamped bid/ask, spread, latency, slippage and no-trade cases. Separate jobs response before a later ISM release from any longer combined-event window.

Private research and cTrader **demo only**. No live orders or credential changes are authorized.
