# Result: the month-end index-extension effect in US Treasuries, out of sample (14 Nov 2026)

**Verdict: FAIL, 0 of 2 tests.** Long the 10-year note CFD from the close of the month's fourth-to-last US trading day to the
close of its last (stop 2 x ATR(20)) made +0.036R a trade after costs and financing in 2016 to October 2026 (n 130, t 0.77);
the 30-year bond made +0.015R (n 130, t 0.32). Both are positive in both windows and both beat the random-day placebo's 95th
percentile, but neither comes near t 2 and the Holm-adjusted p is 0.44 for both. Before costs the 10-year note's window does
show something (+0.107R a trade, t 2.31, the best of 18 three-day windows of the month), and the 0.07R a trade of spread and
financing takes two thirds of it. Not an edge on these CFDs; nothing live changed and no proposal is written.

Pre-registration: `PREREGISTRATION.md` (pushed alone, before any number was computed). Code: `run.mjs`. Every figure:
`result.json`.

Related: `research/edge/turn-of-month` (branch `turn-of-month`, 13 Nov 2026: the equity turn-of-the-month window on US index
CFDs, FAIL 0 of 3) and `research/edge/rebalance-flow` (branch `rebalance-flow`: the month-end stock / bond rebalancing flow
traded on equity index CFDs, FAIL 0 of 4). Those traded EQUITY indices; this study trades BOND CFDs, long only, on the
index-extension story.

## Results (R a trade; net = after spread and 3 % a year financing; t = one-sample t of the trades, one a month)

| Test | Market | 2016-26 n | gross R | net R | t | win % | stops | 2003-15 n | net R | t | Placebo 95th pct | Beaten | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | USB10Y (10-year note) | 130 | +0.107 | +0.036 | 0.77 | 56.2 | 6 | 153 | +0.008 | 0.18 | -0.037 | 40 / 40 | 0.44 | no |
| T2 | USB30Y (30-year bond) | 130 | +0.061 | +0.015 | 0.32 | 58.5 | 12 | 153 | +0.049 | 1.14 | -0.016 | 39 / 40 | 0.44 | no |

Pass needed all of: net R > 0 in 2016-26 AND in 2003-15 (both met), 2016-26 t >= 2 (not met: 0.77 and 0.32), Holm-adjusted
one-sided p < 0.05 over T1-T2 (not met: 0.44 and 0.44), and the rule's 2016-26 mean above the 95th percentile of 40
random-day placebo means (met for both). No stop was filled by a gap in either market.

## Day-of-month profile (2016-26, the same three-trading-day hold entered at TD-k; reported, not a gate)

| Entry | USB10Y n | net R | t | gross R | USB30Y net R | t | gross R |
|---|---|---|---|---|---|---|---|
| TD-1 (exit next month) | 130 | -0.060 | -1.00 | +0.019 | -0.037 | -0.60 | +0.014 |
| TD-2 | 130 | -0.015 | -0.27 | +0.063 | -0.005 | -0.09 | +0.045 |
| TD-3 | 130 | -0.027 | -0.50 | +0.050 | -0.029 | -0.54 | +0.021 |
| **TD-4 (the rule)** | 130 | +0.036 | 0.77 | +0.107 | +0.015 | 0.32 | +0.061 |
| TD-5 | 130 | +0.009 | 0.22 | +0.082 | -0.014 | -0.33 | +0.033 |
| TD-6 | 130 | +0.027 | 0.55 | +0.104 | +0.014 | 0.28 | +0.063 |
| TD-7 | 130 | -0.050 | -0.99 | +0.027 | -0.020 | -0.41 | +0.029 |
| TD-8 | 130 | -0.013 | -0.32 | +0.061 | +0.017 | 0.41 | +0.065 |
| TD-9 | 130 | -0.072 | -1.73 | -0.001 | -0.041 | -0.98 | +0.005 |
| TD-10 | 130 | -0.153 | -3.66 | -0.079 | -0.114 | -2.49 | -0.066 |
| TD-11 | 130 | -0.210 | -5.03 | -0.133 | -0.149 | -3.27 | -0.100 |
| TD-12 | 130 | -0.208 | -4.59 | -0.133 | -0.136 | -2.89 | -0.087 |
| TD-13 | 130 | -0.127 | -2.77 | -0.054 | -0.085 | -1.97 | -0.037 |
| TD-14 | 130 | -0.065 | -1.39 | +0.006 | -0.043 | -0.92 | +0.004 |
| TD-15 | 130 | -0.083 | -1.77 | -0.009 | -0.052 | -1.13 | -0.005 |
| TD-16 | 130 | -0.147 | -2.95 | -0.072 | -0.109 | -2.24 | -0.060 |
| TD-17 | 130 | -0.198 | -3.98 | -0.123 | -0.173 | -3.44 | -0.125 |
| TD-18 | 131 | -0.142 | -2.77 | -0.069 | -0.110 | -2.31 | -0.063 |

The rule's window ranks **1 of 18** on USB10Y and **2 of 18** on USB30Y (TD-8 is +0.002R higher). The whole last week and a
half of the month (TD-4 to TD-8) is near flat or slightly positive and the middle of the month clearly negative, in a decade
in which these CFDs fell (the 10-year note from about 127 in January 2016 to about 107, through a 140 high in 2020, most of the fall in 2022). Read as a shape it is consistent
with the claim, but the month-end gain itself is small: about 0.1R a trade before costs, about 0.2 of a daily ATR over three
days. The mid-month weakness was not a pre-registered question (it was not the hypothesis and was read after the fact): it is
not a finding, and testing it would need its own pre-registration on data not used here.

## Random-day placebo (40 seeds, 2016-26: per year as many trades as the rule took, entry on a random US trading day of that year, three-day hold, same stop, costs and financing)

| Market | Rule mean | Placebo median | Placebo 95th percentile | Seeds beaten |
|---|---|---|---|---|
| USB10Y | +0.036 | -0.090 | -0.037 | 40 of 40 |
| USB30Y | +0.015 | -0.078 | -0.016 | 39 of 40 |

The placebo means are negative because any three-day long pays the same costs and financing and the decade drifted down; the
rule does beat a random day, which is the gross shape above, not a profit after costs.

## Cost sensitivity (net R a trade, t)

| Market | Window | 0 x costs | 1 x (base) | 2 x |
|---|---|---|---|---|
| USB10Y | 2016-26 | +0.107, t 2.31 | +0.036, t 0.77 | -0.035, t -0.75 |
| USB10Y | 2003-15 | +0.067, t 1.49 | +0.008, t 0.18 | -0.051, t -1.13 |
| USB30Y | 2016-26 | +0.061, t 1.28 | +0.015, t 0.32 | -0.031, t -0.65 |
| USB30Y | 2003-15 | +0.095, t 2.19 | +0.049, t 1.14 | +0.004, t 0.08 |

Base costs per trade: USB10Y spread 0.034R + financing 0.036R (2016-26); USB30Y 0.028R + 0.018R. Even with no cost at all
only one of the four rows reaches t 2, and the two markets disagree on which window (the 10-year note in 2016-26, the bond in
2003-15). The 3 % a year financing is a conservative assumption (no broker rate history exists); at 0 x financing and 1 x
spread the 10-year note would sit about halfway between the 0 x and 1 x columns, still under t 2.

## Contract rolls (pre-registered treatment)

The candles were used as they are. The gap check (an open more than 1 x ATR(20) from the previous close) lists 11 candles on
USB10Y and 6 on USB30Y over 23 years; 10 and 4 of them are Sunday reopen candles after news weekends (September 2008, Greece
June 2015, March 2020, February 2022, April 2025), and none forms a step at the end of February, May, August or November, where
the futures roll. The one near a roll date (Sunday 27 February 2022) is the weekend of the invasion of Ukraine. These OANDA bond
CFDs show no quarterly roll step in the daily candles. Two rule trades per market contain a listed gap (June 2015, February
2022).

| Robustness row (roll-month trades and gap trades removed) | 2016-26 n | net R | t | 2003-15 n | net R | t |
|---|---|---|---|---|---|---|
| USB10Y | 87 | +0.018 | 0.33 | 101 | +0.009 | 0.16 |
| USB30Y | 87 | -0.003 | -0.05 | 101 | +0.038 | 0.71 |

Removed: 43 trades in 2016-26 and 52 in 2003-15 per market. The roll months alone made +0.072R (USB10Y, n 43, t 0.83) and
+0.051R (USB30Y, n 43, t 0.61) in 2016-26: if anything the months with a roll did a little better, not worse.

## Cross-checks (same rule, reported and not judged)

| Market | 2016-26 n | gross R | net R | t | 2003-15 net R | t | Day-of-month rank |
|---|---|---|---|---|---|---|---|
| USB05Y (5-year note) | 130 | +0.149 | +0.035 | 0.76 | -0.005 | -0.12 | 1 of 18 |
| USB02Y (2-year note) | 130 | +0.180 | -0.140 | -2.68 | -0.183 | -3.90 | 1 of 18 |
| DE10YB (Bund; weekdays with a candle, no local holidays) | 131 | +0.063 | -0.004 | -0.08 | +0.045 | 1.07 | 3 of 18 |
| UK10YB (Gilt; same) | 131 | +0.044 | -0.017 | -0.37 | +0.044 | 1.01 | 3 of 18 |

Every US maturity's window is the best of the 18 before costs (5-year gross t 3.27, 2-year gross t 3.66 in 2016-26); on the
2-year note the stop is so close in price that the fixed spread and financing cost 0.32R a trade and the rule loses. The Bund
and Gilt show a weaker version of the same gross shape. A consistent gross month-end tilt across the curve, too small to pay
for a three-day CFD position.

## By year (rule, total net R of the year)

- USB10Y: 2003 -3.51, 2004 -1.86, 2005 -0.16, 2006 +0.37, 2007 +1.05, 2008 +1.61, 2009 -0.89, 2010 +1.96, 2011 +0.57,
  2012 +2.10, 2013 -0.83, 2014 +1.12, 2015 -0.27, 2016 +2.18, 2017 -2.21, 2018 +1.65, 2019 +1.49, 2020 +2.54, 2021 -1.33,
  2022 +0.83, 2023 -0.26, 2024 +0.99, 2025 +0.24, 2026 (to October) -1.45.
- USB30Y: 2003 -2.64, 2004 -0.65, 2005 +1.39, 2006 +0.52, 2007 +1.85, 2008 +0.90, 2009 -0.32, 2010 +2.59, 2011 +0.22,
  2012 +1.83, 2013 -0.60, 2014 +1.75, 2015 +0.68, 2016 +1.18, 2017 -1.30, 2018 +2.50, 2019 +2.14, 2020 +0.65, 2021 -1.05,
  2022 +0.39, 2023 -1.46, 2024 +1.52, 2025 +0.30, 2026 (to October) -2.91.

## Data and method notes

- OANDA mid daily CFD candles (USB10Y_USD, USB30Y_USD; cross-checks USB05Y_USD, USB02Y_USD, DE10YB_EUR, UK10YB_GBP) from
  council-data `research/daily/`, March 2003 to 6 November 2026; read with `git show`, no network.
- US trading days: weekdays minus `council/datacheck.mjs` `usHolidays` full holidays (its two half days are trading days,
  Juneteenth only from 2022, Christmas observed on 24 December when the 25th is a Saturday), plus Columbus and Veterans Day and
  the NYSE special closures listed in the pre-registration. Weekend and holiday candles fold into the next trading day's bar.
- One rule trade per market was skipped (the first month, no 20-day ATR yet); November 2026 is not on file yet and is not counted.
- What this does NOT test: the cash or futures market at the New York close (OANDA's daily close is 00:00 UTC), other entry
  days or holds as findings, a short side, a total-return position (coupon accrual is not in a CFD price), or the size of each
  month's index extension (a month with a large extension might differ; no extension figures were read).
- Literature: the claim follows the month-end Treasury return and index-extension literature (Hartley and Schwarz,
  "Predictable End-of-Month Treasury Returns", working paper; dealer notes on the Treasury index's monthly duration
  extension). Cited from memory: none of these was opened from the build sandbox, and no figure here comes from them.

Nothing live changed and no proposal is written. To repeat: `node research/edge/bond-month-end/run.mjs fetch <dir>`, then
`node research/edge/bond-month-end/run.mjs full <dir>`. Tests: `tests/bond-month-end.test.mjs`.
