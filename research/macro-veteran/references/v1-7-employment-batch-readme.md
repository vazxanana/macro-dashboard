# GPTMacro V1.7: Employment Situation increment for the assistant

This is an **increment after V1.6**, for MeridianX private research and cTrader **demo only**. It contains dated BLS Employment Situation release data for 36 reference months, December 2021 through November 2024. Import the included CSV, evidence JSON, validation script, and research note alongside the V1.6 material. The ZIP is deliberately small and contains no credentials.

Use `outputs/employment-situation-multifield-with-hours-2022-2024.csv` as the current combined ledger. Earlier, narrower labor CSVs are included as extraction stages. Run `work/validate_employment_headline_2022_2024.py` to check the preserved excerpts and 36 monthly rows.

The ledger records first *archived-release* payroll change, unemployment rate, hourly earnings, weekly hours, and prior-two-month payroll revisions. It is **not authenticated as the exact first web-posted bytes or market-received feed**. Do not mix previous and current levels from separate release vintages. The January 2022 annual benchmark release lacks a standard two-month revision statement in this extraction; blanks are missing, not zero. Hours changes marked `explicit_stability_words` are zero inferred from the release's own stable/unchanged wording.

Do not label a data figure a surprise without a frozen pre-release consensus for that field. Do not present an executable trading result without timestamped receipt, bid/ask quotes, spread, latency, slippage, and an explicit no-trade baseline. No live routing or order placement is authorized.
