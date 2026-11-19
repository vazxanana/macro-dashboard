# Result: the monthly options-expiry week on US indices, out of sample (14 Nov 2026)

**Verdict: FAIL, 0 of 4 tests.** Buying the week that ends on the monthly options expiration (the third Friday) made -0.016R a
trade net on SPX500 in 2016 to October 2026 (n 130, t -0.32) and +0.026R on NAS100 (n 130, t 0.50); shorting the week after lost
-0.111R on SPX500 (n 130, t -2.04) and -0.150R on NAS100 (n 130, t -2.92). Every Holm-adjusted p is 1.00, and against 40 placebos
of a random other week of the same month on the same side the rule beat 3, 8, 10 and 3 seeds (38 needed). Not an edge; nothing
live changed and no proposal is written.

Pre-registration: `PREREGISTRATION.md` (pushed before any result). Code: `run.mjs`. Every figure: `result.json`.

## Results (net R a trade after spread and financing; t = one-sample t of the trades)

| Test | Rule | 2016-26 n | net R | t | gross R | win % | stops | 2008-15 n | net R | t | Placebo beaten | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | SPX500 long, expiry week | 130 | -0.016 | -0.32 | +0.028 | 48.46 | 13 | 96 | +0.050 | 0.81 | 3 / 40 | 1.00 | no |
| T2 | SPX500 short, week after | 130 | -0.111 | -2.04 | -0.095 | 36.15 | 6 | 96 | -0.049 | -0.95 | 8 / 40 | 1.00 | no |
| T3 | NAS100 long, expiry week | 130 | +0.026 | 0.50 | +0.059 | 51.54 | 11 | 96 | +0.024 | 0.38 | 10 / 40 | 1.00 | no |
| T4 | NAS100 short, week after | 130 | -0.150 | -2.92 | -0.138 | 37.69 | 15 | 96 | -0.149 | -2.79 | 3 / 40 | 1.00 | no |

Pass needs: 2016-26 net R > 0, t >= 2, 2008-15 net R > 0, Holm-adjusted one-sided p < 0.05 over the four tests, and the rule's
mean above at least 38 of the 40 placebo means. T3 clears the two signs only; T1 clears the 2008-15 sign only; T2 and T4 clear
nothing.

## Placebo (40 seeds: per rule trade, the same side over a random other week of the same month, same stop, costs and financing)

| Test | Rule mean | Placebo median | Placebo 95th percentile | Beaten |
|---|---|---|---|---|
| T1 | -0.016 | +0.027 | +0.106 | 3 |
| T2 | -0.111 | -0.063 | -0.011 | 8 |
| T3 | +0.026 | +0.062 | +0.132 | 10 |
| T4 | -0.150 | -0.069 | -0.031 | 3 |

The expiry week was a little weaker than the month's other weeks for a long (T1 and T3 below the placebo median), and the week
after a little stronger (a short over it lost more than a short over another week). Both are the opposite of the published
direction, and neither is a finding: no test reaches its bar, and that reading was not pre-registered.

## What is in the numbers (reported, not judged)
- **The shorts lose because the indices rise**: a short over a random week of the month lost -0.06 to -0.07R a trade (placebo
  median) on 2016-26; the week after expiry lost a further -0.05 to -0.08R. On NAS100 the same shape holds in 2008-15 (-0.149R,
  t -2.79). A long over the week after is NOT a tested rule here and would need its own pre-registration on other data.
- **Costs are small**: spread 0.009-0.011R a trade on 2016-26 (0.02-0.03R on 2008-15, when the ATR was smaller), financing
  0.024-0.033R a long and 0.004-0.005R a short (a short pays only while the 2-year yield is under 2.5 %). Gross figures are in the
  table; none of the four is a positive t >= 2 before costs either.
- **By year, 2016-26, net R a trade**: T1 +0.101, +0.133, -0.009, +0.164, +0.002, -0.304, -0.333, +0.114, -0.117, +0.174, -0.119;
  T4 -0.264, -0.431, +0.031, -0.108, +0.044, -0.225, -0.018, -0.244, -0.257, -0.159, +0.005. No run of years carries the effect.
- **Stops**: 6 to 15 of 130 trades a test were stopped at 2.5 x ATR(20) inside the week; none gapped through the stop.
- **Holiday expiries**: the third Friday was an NYSE holiday in April 2014, 2019, 2022 and 2025 (Good Friday) and June 2026
  (Juneteenth): the Thursday before was the expiry close. When the Friday before the expiry week was a holiday (April 2017,
  2020), T1 entered at the Thursday close. Every month of both windows had its candles (`noCandle` 0 in every test).

## Data and conventions
- OANDA mid daily candles SPX500_USD and NAS100_USD from council-data `research/daily/` at `b10aea762` (first 24 Mar 2003, last
  6 Nov 2026), read with `git show`, no network; weekend stubs folded into the next weekday with `council/fills.mjs`
  `foldWeekend`. A daily candle closes at 00:00 UTC, three to four hours after the NYSE close and after the 17:00 New York futures
  close: that is this study's "close" (the cache has no candle closing at the NYSE close; the rebalance-flow study did the same).
  So the Friday entry and exit are the CFD's last price of the Friday session, not the cash index's 16:00 close.
- Costs: SPX500 1 and NAS100 3 index points a round trip. Financing per calendar night on the entry price: a long pays the 2-year
  yield + 2.5 % a year, a short pays max(0, 2.5 % - 2-year yield); the yield is FRED DGS2 weekly from council-data
  `macro/cache.json` (copied into `rates.json`). Today's formula is used for every year.
- The NYSE calendar is copied from the turn-of-month study (holidays from `ict/calendar.mjs` `cmeYear`, read only).

## What this does not test
The cash index or futures at their own close, single stocks (the published study used S&P 100 stocks), the quarterly ("triple
witching") months alone, weekly options expiries, or a long over the week after expiry.

Nothing live changed and no proposal is written. To repeat: copy `research/daily/spx500.json` and `nas100.json` from
`origin/council-data` into a directory (`git show origin/council-data:research/daily/spx500.json > <dir>/spx500.json`), then
`node research/edge/opex-week/run.mjs <dir>`. Tests: `tests/opex-week.test.mjs`.
