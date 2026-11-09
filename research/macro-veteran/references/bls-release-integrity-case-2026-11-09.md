# BLS release integrity: schedules, access and corrected archives

The May 2024 CPI timing flag now has stronger official evidence. The DOL inspector general's report, issued 26 June 2026, says CPI/Real Earnings tables reached the public website at **07:59**, 31 minutes before the announced time; it reports access from **72 unique Internet Service Providers**. That is not a count of traders or proof of profitable use. See PDF page 8, printed page 5. [OIG report](https://www.oig.dol.gov/public/reports/oa/2026/17-26-001-11-001.pdf)

The report labels all times **Eastern Standard Time**, although May is daylight time in New York. Preserve its wall-clock labels and the 31-minute interval; do not silently convert 07:59 to UTC. The precise first availability of each selected CPI field remains unverified. BLS's original notice described a subset of files posted approximately 30 minutes early. [BLS notice](https://www.bls.gov/cpi/notices/2024/early-data-release-05152024.htm)

The audit also documents selective delivery during the August 2024 employment-benchmark publication delay and nonpublic/inaccurate CPI-methodology emails. A scheduled time, public posting and restricted delivery can differ. This is evidence about access, not a measured market response. [OIG report](https://www.oig.dol.gov/public/reports/oa/2026/17-26-001-11-001.pdf)

## Consequence for this study

Retain 15 May in the daily release-calendar cohort with its timing flag and a declared exclusion sensitivity. A future narrow-window study must establish field-specific availability and cannot assume all participants first learned the figures at 08:30. Record first-publication fields as missing where evidence does not resolve them.

The [36-release numerical ledger](cpi-first-print-release-ledger-2022-2024.json) also retains explicit reissue notes for June and July 2024. Its [validation](cpi-first-print-validation-2022-2024.json) corrects the independent review's notice-scan failure. An archived release's current-month column is a defensible release-vintage route, but present bytes are not independently authenticated original-day bytes.

Official raw captures and request/receipt hashes are in `work/raw/cpi-source-integrity-2026-11-09/`. No feed timestamp was used to infer early posting, and no return or event-study statistic was calculated here.
