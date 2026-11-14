# Result: index CFD longs over the quarterly futures roll window and expiry week (14 Nov 2026)

**Verdict: FAIL: the roll-window long on SPX500 lost -0.114R a trade net out of sample (2017-26, n 39, t -1.08), -0.012R in sample, and beat 5 of 40 placebos.**

The primary test (T1: buy SPX500 at the close three trading days before the roll Thursday, the Thursday 8 days before the
quarterly third Friday; sell at the close of the next trading day; stop 2 x ATR(20)) fails all four pre-registered checks. None
of the eight tests passes (every Holm-adjusted p is 1.00). Not an edge; nothing live changed and no proposal is written.

Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure, commit `bad6816c7`). Code: `run.mjs`. Every figure:
`result.json`.

**n is thin**: one trade a quarter, 36 in sample (2008-16) and 39 out of sample (2017-03 to 2026-09) a test. With the observed
spread (about 0.65R a trade) t 2 out of sample needs about +0.21R a trade.

## Results (net R a trade after spread and financing; t on calendar-month sums, one trade a month that holds one)

| Test | Rule | OOS n | OOS net | t | OOS gross | t gross | OOS net 2x cost | IS n | IS net | t | IS gross | Placebo beaten | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 (primary) | SPX500, roll window W1 | 39 | -0.114 | -1.08 | -0.070 | -0.66 | -0.158 | 36 | -0.012 | -0.10 | +0.018 | 5 / 40 | 1.00 | no |
| T2 | SPX500, expiry week W2 | 39 | -0.036 | -0.34 | +0.005 | 0.05 | -0.077 | 36 | +0.192 | 1.62 | +0.222 | 15 / 40 | 1.00 | no |
| T3 | NAS100, W1 | 39 | -0.085 | -0.78 | -0.053 | -0.48 | -0.118 | 36 | -0.022 | -0.19 | +0.005 | 5 / 40 | 1.00 | no |
| T4 | NAS100, W2 | 39 | +0.028 | 0.28 | +0.058 | 0.57 | -0.002 | 36 | +0.189 | 1.81 | +0.215 | 19 / 40 | 1.00 | no |
| T5 | US30, W1 | 39 | -0.186 | -1.80 | -0.141 | -1.36 | -0.231 | 36 | +0.008 | 0.06 | +0.040 | 2 / 40 | 1.00 | no |
| T6 | US30, W2 | 39 | -0.024 | -0.20 | +0.017 | 0.15 | -0.065 | 36 | +0.214 | 1.83 | +0.246 | 17 / 40 | 1.00 | no |
| T7 | DE40, W1 (reported market) | 38 | -0.038 | -0.37 | -0.002 | -0.02 | -0.074 | 36 | +0.003 | 0.02 | +0.024 | 16 / 40 | 1.00 | no |
| T8 | DE40, W2 (reported market) | 39 | -0.064 | -0.67 | -0.026 | -0.27 | -0.101 | 36 | +0.151 | 1.48 | +0.173 | 17 / 40 | 1.00 | no |

Pass needed (T1, the verdict): out-of-sample net > 0 with t >= 2 and Holm-adjusted p < 0.05 over the eight tests, in-sample net
> 0, out-of-sample net > 0 at 2x costs, and the rule's mean above at least 38 of the 40 placebo means.

| Check (T1) | Needed | Result | Met |
|---|---|---|---|
| Out-of-sample net t, Holm | t >= 2, p < 0.05 | -1.08, p 1.00 | no |
| In-sample net mean | > 0 | -0.012 | no |
| Out-of-sample net at 2x cost | > 0 | -0.158 | no |
| Placebo seeds beaten | >= 38 of 40 | 5 | no |

## Placebo and the quarter's other windows
Placebo (40 seeds; per out-of-sample quarter one long over a random other four-trading-day window of the same quarter, same stop
and costs): rule mean against the placebo median and 95th percentile: T1 -0.114 / -0.001 / +0.161; T3 -0.085 / +0.018 / +0.202;
T5 -0.186 / +0.001 / +0.156; T2 -0.036 / -0.008 / +0.163; T4 +0.028 / +0.035 / +0.191; T6 -0.024 / -0.005 / +0.164; T7 -0.038 /
-0.017 / +0.155; T8 -0.064 / -0.034 / +0.091.

Against the mean of EVERY other four-day long window of the same quarter (reported, not a pass condition), the roll window was
a little worse out of sample: excess T1 -0.133R (t -1.28), T3 -0.139R (t -1.23), T5 -0.195R (t -1.96), T7 -0.011R (t -0.11); in
sample it was flat (T1 +0.005R, t 0.04). The expiry week: in sample +0.21R, +0.18R, +0.23R, +0.16R over the quarter (t 1.46 to
1.98) on SPX500, NAS100, US30 and DE40, out of sample -0.05R, -0.02R, -0.03R, -0.04R (t -0.25 to -0.54).

## What is in the numbers (reported, not judged)
- **The expiry week looked good in 2008-16 and did not repeat.** On all four markets the W2 long won 67 % of quarters in sample
  with t 1.5 to 1.8 net; out of sample the same windows made -0.06R to +0.03R a trade. Nothing here was chosen after seeing it:
  the windows were fixed in the pre-registration. It is the same direction the monthly `opex-week` study found nothing in.
- **The roll window was weak, not strong**: out of sample every US W1 test is negative and below the placebo median (beaten 2 to
  5 times in 40). A short over the roll window is NOT tested here (the published effect is a long); it would need its own
  pre-registration on other data.
- **By year, T1 net R summed over the year**: 2017 -0.40, 2018 +1.25, 2019 -0.05, 2020 -3.42, 2021 +0.76, 2022 -0.61, 2023 -0.81,
  2024 +1.41, 2025 +0.26, 2026 -2.85. 2020 (March and June) carries much of the loss; without it T1 is still negative.
- **Costs are small**: spread 0.013-0.018R and financing 0.017-0.027R a trade out of sample; the gross figures are in the table
  and no test reaches a positive t of 2 before costs either (the best gross OOS t is 0.57).
- **Stops**: 4 to 9 out-of-sample trades a test were stopped at 2 x ATR(20) inside the window.
- **Skipped**: DE40 W1 of June 2017 (its entry, Whit Monday 5 June 2017, has no OANDA candle); no other window was missing.
- Holiday handling as pre-registered: March 2008's expiry Friday was Good Friday (expiry Thursday 20 March); the September 2026
  roll window steps over Labor Day.

## Data and conventions
- OANDA mid daily candles SPX500_USD, NAS100_USD, US30_USD and DE30_EUR (the cache key `de40`) from council-data
  `research/daily/` at `6279e8bd5` (first 24-25 Mar 2003, last 6 Nov 2026), read with `git show`, no network; weekend stubs
  folded into the next weekday with `council/fills.mjs` `foldWeekend`. A daily candle closes at 00:00 UTC, after the US futures
  close and well after the Eurex close: that is this study's "close", not the cash index's own.
- Costs: 0.04 % of the entry price a round trip. Financing per calendar night on the entry notional: FRED DGS2 (weekly, from
  council-data `macro/cache.json`, copied in `rates.json`) + 2.5 % a year, the formula of `opex-week` / `turn-of-month`; DE40 is
  charged the same (no euro rate on file). Today's formula is used for every year.
- Calendars: the NYSE calendar copied from `opex-week` (holidays from `ict/calendar.mjs` `cmeYear`, read only); Eurex days for
  DE40 = weekdays except 1 Jan, Good Friday, Easter Monday, 1 May, 24-26 and 31 Dec.

## What this does not test
The cash index or the futures at their own close, the futures calendar spread itself, a short over the roll window, intraday
timing around the roll or the expiry settlement, single stocks, or the monthly expiries (`opex-week`).

Nothing live changed and no proposal is written. To repeat: copy `research/daily/spx500.json`, `nas100.json`, `us30.json` and
`de40.json` from `origin/council-data` into a directory, then `node research/edge/index-roll-week/run.mjs <dir>`. Tests:
`tests/index-roll-week.test.mjs`.
