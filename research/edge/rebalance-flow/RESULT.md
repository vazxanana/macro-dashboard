# Result: the month-end rebalancing flow on US indices, out of sample (13 Nov 2026)

**Verdict: FAIL, 0 of 4 tests.** The rule (rank the month's SPX500-minus-10-year-note return at the fifth-to-last NYSE trading
day against the 36 prior months; sell the top third, buy the bottom third, exit at the month's last close, stop 2.5 x ATR(20))
makes +0.013R a trade net on SPX500 in 2016 to October 2026 (n 93, t 0.24) and +0.006R on NAS100 (n 93, t 0.11); the
quarter-end months alone lose (SPX500 -0.021R, n 30, t -0.22; NAS100 -0.027R, n 30, t -0.29). No test comes near t 2, every
Holm-adjusted p is 1.00, and the rule's mean is near the middle of 40 random-sign placebos on the same dates (it beats 20, 14, 19
and 12 of 40; 38 needed). Not an edge; nothing live changed and no proposal is written.

Pre-registration: `PREREGISTRATION.md` (pushed before any result). Code: `run.mjs`. Every figure: `result.json`.

## Results (net R a trade after spread and financing; t = one-sample t of the trades)

| Test | Market | Months | 2016-26 n | net R | t | gross R | win % | 2008-15 n | net R | t | Placebo beaten | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | SPX500 | all | 93 | +0.013 | 0.24 | +0.032 | 49.5 | 63 | +0.077 | 1.39 | 20 / 40 | 1.00 | no |
| B | SPX500 | quarter-end | 30 | -0.021 | -0.22 | -0.001 | 46.7 | 20 | -0.037 | -0.38 | 14 / 40 | 1.00 | no |
| C | NAS100 | all | 93 | +0.006 | 0.11 | +0.022 | 53.8 | 63 | +0.011 | 0.17 | 19 / 40 | 1.00 | no |
| D | NAS100 | quarter-end | 30 | -0.027 | -0.29 | -0.010 | 46.7 | 20 | -0.104 | -0.87 | 12 / 40 | 1.00 | no |

Pass needs: 2016-26 net R > 0, t >= 2, 2008-15 net R > 0, Holm-adjusted one-sided p < 0.05 over the four tests, and the rule's
mean above at least 38 of the 40 placebo means. A and C clear only the two signs; B and D clear nothing.

## Placebo (40 seeds, a random side on each of the rule's own 2016-26 entry dates, same stop, exit, costs and financing)

| Test | Rule mean | Placebo median | Placebo 95th percentile | Beaten |
|---|---|---|---|---|
| A | +0.013 | +0.013 | +0.073 | 20 |
| B | -0.021 | +0.010 | +0.122 | 14 |
| C | +0.006 | +0.013 | +0.069 | 19 |
| D | -0.027 | +0.010 | +0.145 | 12 |

Choosing the side by the rebalancing signal does no better than a coin on the same days.

## What is in the numbers (reported, not judged)
- **By side, 2016-26**: the buys (bonds beat stocks) made +0.110R on SPX500 (n 45, t 1.36) and +0.114R on NAS100 (n 45,
  t 1.35); the sells (stocks beat bonds) lost -0.079R (n 48, t -1.18) and -0.095R (n 48, t -1.39). That is the shape of the
  indices' upward drift over 2016-26 (a long held four days earns it, a short pays it), not of a rebalancing flow: the sells,
  which are the rebalancing story's main case after strong equity months, lose.
- **Costs are small here**: spread 0.01R a trade on SPX500 (1 point on a 2.5 x ATR stop of 27 to 563 points, median 135), financing
  about -0.01R (four to six nights). The rule fails before costs too (A gross +0.032R, t 0.61).
- **Stops**: 4 of 93 SPX500 trades and 5 of 93 NAS100 trades in 2016-26 were stopped, none by a gap (February 2020 and September 2021 on both).
- **By year** (SPX500, all months, total net R): 2016 +1.80, 2017 +0.99, 2018 +3.10, 2019 -1.27, 2020 -2.23, 2021 -1.08,
  2022 +0.36, 2023 +0.16, 2024 +1.49, 2025 -0.97, 2026 (to October) -1.19.
- **Months traded**: 156 of 226 from 2008-01 to 2026-10 (70 in the middle third, none without history or candles).

## Limits
- The close is OANDA's 00:00 UTC daily close, three to four hours after the NYSE cash close; the published effect is measured
  on cash closes and on the last days' flows, which may sit inside the day of the cash close. An intraday version (entry at the
  cash close, H1 candles) would be a new pre-registration, not a re-reading of this one.
- The bond leg is the 10-year note CFD price, not a total-return bond index; the equity leg is the price index, not total return.
- Financing uses today's assumed formula (2-year yield +/- 2.5 %) for every year; no broker rate history is known.
- Only the pre-registered rule and its quarter-end variant were run; no other threshold, lookback, entry day or stop was tried.
