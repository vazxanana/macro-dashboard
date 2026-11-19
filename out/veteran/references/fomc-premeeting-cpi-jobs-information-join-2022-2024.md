# CPI and jobs information available before 2022–24 FOMC statements

The [24-meeting join](fomc-premeeting-cpi-jobs-context-2022-2024.csv) links each scheduled FOMC statement clock to the most recent **earlier scheduled** BLS CPI and Employment Situation release clocks. Values come from the dated archived releases: headline/core CPI month-on-month and year-on-year, current payroll first print, unemployment and hourly-earnings month-on-month where printed. The [builder](../work/build_fomc_premeeting_macro_context_2022_2024.py) uses the [CPI first-print ledger](cpi-first-print-release-ledger-2022-2024.json), [jobs first-print ledger](employment-situation-multifield-with-hours-2022-2024.csv), and [FOMC statement join](fomc-stage-join-gate-2022-2024.csv). Release clocks are scheduled official clocks; exact first market dissemination was not independently authenticated. The archived web copies were captured in 2026.

## Bounded findings

- All 24 meetings have a prior CPI and jobs release in the 2022–24 ledgers. Twelve meetings have SEP materials.
- Between each pair of FOMC meetings in this cohort, there were one or two CPI releases and one or two jobs releases (23 intervals each).
- Four CPI releases were within two days before an FOMC statement, all at SEP meetings: 14 December 2022, 14 June 2023, 13 December 2023, and 12 June 2024. The 12 June 2024 CPI scheduled clock was 08:30 ET, about **5.5 hours before** the 14:00 ET FOMC statement. The other three were the preceding day.
- No latest jobs release was within two days of these 24 FOMC statements.

This is a **time-ordering join**, not evidence that CPI or jobs surprises predicted the decision, dot plot, or gold. The same-day 2024 CPI release preceded the public statement, but this join does not establish when individual SEP projections were finalized or revised. It also has no pre-release consensus or pre-FOMC futures-implied path; first-print levels alone do not measure news. Announced target-rate changes are observed outcomes, not expectation-adjusted surprises.

## Demo research design

For each upcoming FOMC meeting, freeze the macro state immediately before a relevant CPI or jobs release, including the then-current consensus and policy-path pricing with a source receipt. After the macro release, measure the change in futures-implied policy path using quotes available at the chosen signal time. Freeze a second state immediately before the FOMC statement. On meeting day, evaluate the statement and press conference in separate windows. Avoid attributing a gold move to the statement if it occurred around a same-day CPI release or a later press conference. Test a conditional rule only after the pre-event snapshots and executable cTrader **demo** bid/ask are available, with spread, latency and skip cases. Compare against no trade and simple one-event baselines.

Primary calendars and statement source: [Federal Reserve FOMC meeting calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm). CPI and jobs values and clocks have the individual BLS archived source URLs in the CSV. No live trading is authorized.
