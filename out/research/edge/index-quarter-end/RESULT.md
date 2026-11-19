# Result: quarter-end rebalancing flow on US500, by the quarter's stock-minus-bond return (14 Nov 2026)

**Verdict: FAIL: on US500 out of sample (2015-26) the rule lost -0.101R a trade net (n 47, t -0.89), -0.119R at 2x cost, and beat only 24 of 40 random-window placebos (38 needed).**

The rule (at the close of the quarter's sixth-to-last NYSE trading day, sell the US500 CFD when SPX500 beat the 10-year note CFD
over the quarter so far, buy when it lagged; exit at the quarter's last close; stop 1.5 x ATR(20) daily) fails three of the four
pre-registered checks. Only the in-sample sign holds (+0.020R a trade, t 0.18). Not an edge; nothing live changed and no proposal
is written. It confirms `rebalance-flow` (branch `rebalance-flow`), whose quarter-end variant with a monthly, ranked signal also
failed (-0.021R, t -0.22).

Pre-registration: `PREREGISTRATION.md` (pushed alone before any result, commit `ed9a22218`). Code: `run.mjs`. Every figure:
`result.json`.

## The primary test (US500 = SPX500; net R a trade after spread 0.0003 x entry and financing; event t)

| Window | Quarters | n | net R | t | gross R | net R at 2x cost | win % | stops | buys / sells | net R needed for t 2 |
|---|---|---|---|---|---|---|---|---|---|---|
| In sample | 2003-Q2 to 2014-Q4 | 47 | +0.020 | 0.18 | +0.054 | +0.003 | 55.32 | 8 | 16 / 31 | 0.223 |
| Out of sample | 2015-Q1 to 2026-Q3 | 47 | -0.101 | -0.89 | -0.079 | -0.119 | 42.55 | 11 | 8 / 39 | 0.227 |

| Check | Needed | Result | Met |
|---|---|---|---|
| 1. Out-of-sample t, base cost | >= 2 | -0.89 | no |
| 2. In-sample mean net R | > 0 | +0.020 | yes |
| 3. Out-of-sample mean net R at 2x cost | > 0 | -0.119 | no |
| 4. Placebo seeds beaten (base cost) | >= 38 of 40 | 24 | no |

**n is small**: about four events a year, 47 out of sample. With the observed spread of results (sd 0.777R a trade) t 2 would
need a mean of about +0.23R a trade, roughly a quarter of the 1.5 x ATR stop over five days; the rule's out-of-sample mean is on
the other side of zero.

## Placebo (40 seeds; out-of-sample quarters; a random 5-trading-day window inside the quarter, ending at or before the rule's entry; side by the same stock-minus-bond rule)

| Cost | Rule mean | Placebo median | Placebo 95th percentile | Seeds beaten |
|---|---|---|---|---|
| 0 (gross, no financing) | -0.079 | -0.090 | +0.125 | 22 |
| Base | -0.101 | -0.121 | +0.097 | 24 |
| 2x spread | -0.119 | -0.139 | +0.080 | 24 |

The quarter-end days do no better than any other five days of the quarter traded with the same rule. Both lose for one reason:
in 2015-26 stocks beat bonds in most quarters, so the rule is short 39 times of 47, against an index that rose.

## What is in the numbers (reported, not judged)
- **By side, out of sample**: sells (stocks beat bonds, the main rebalancing case) -0.015R (n 39, t -0.12); buys -0.520R (n 8,
  t -2.05). In sample: sells -0.023R (n 31), buys +0.103R (n 16). The sells, which the rebalancing story is mostly about, made
  nothing in either half.
- **Costs are small**: spread 0.018R and financing about -0.005R a trade out of sample; the rule fails before costs too (gross
  -0.079R, t -0.69). 11 of 47 out-of-sample trades were stopped, none by a gap.
- **By year** (US500 total net R): 2003 +1.19, 2004 +2.11, 2005 +0.23, 2006 +0.28, 2007 +0.06, 2008 -0.21, 2009 -1.19, 2010 -2.56,
  2011 +0.51, 2012 +1.44, 2013 -1.75, 2014 +0.84, 2015 +0.07, 2016 +1.85, 2017 -0.44, 2018 +0.11, 2019 -0.67, 2020 -1.44,
  2021 -0.44, 2022 +0.36, 2023 -1.88, 2024 +0.75, 2025 -1.56, 2026 (Q1-Q3) -1.47.
- **Other indices, the same rule** (signal still SPX500 vs USB10Y):

| Market | IS n | IS net R | IS t | OOS n | OOS net R | OOS t | OOS at 2x | Placebo beaten |
|---|---|---|---|---|---|---|---|---|
| NAS100 | 47 | -0.204 | -1.75 | 47 | -0.052 | -0.43 | -0.065 | 24 |
| US30 | 47 | +0.063 | 0.51 | 47 | -0.080 | -0.75 | -0.098 | 23 |
| DE40 | 37 | +0.013 | 0.10 | 40 | -0.086 | -0.61 | -0.100 | 13 |

  DE40 has 17 quarters without the candles the trade needs (gaps in the DE30_EUR daily file); it is financed at the US rate and
  traded on the NYSE calendar (both stated in the pre-registration).
- **First 3 trading days of the next quarter** (entry at the quarter's last close, exit at the next quarter's third, side by the
  full quarter's sign):

| Market | IS n | IS net R | IS t | OOS n | OOS net R | OOS t |
|---|---|---|---|---|---|---|
| US500 | 47 | +0.148 | 1.09 | 47 | -0.200 | -2.05 |
| NAS100 | 47 | +0.118 | 0.83 | 47 | -0.127 | -1.18 |
| US30 | 47 | +0.107 | 0.84 | 47 | -0.264 | -2.69 |
| DE40 | 37 | +0.090 | 0.64 | 37 | -0.235 | -1.71 |

  Positive in sample, negative out of sample on every index: the sign flips between halves. The out-of-sample losses are the
  same shorts (37 of 47) paying the new quarter's opening rally; this is not a finding and not a reversed rule (reading it
  backwards after seeing it would be a new test on the same data).

## Limits
- The close is OANDA's 00:00 UTC daily close, three to four hours after the NYSE cash close; the published effect is measured on
  cash closes. An intraday version would be a new pre-registration.
- Both legs of the signal are price returns (the 10-year note CFD price, the index price), not total returns.
- Financing uses one assumed formula (2-year yield +/- 2.5 %) for every year; the 2-year yield on file starts in January 2006
  and earlier dates use its first value. Over five nights this is under 0.05R a trade.
- Only the pre-registered rule and the reported variants were run; no other lookback, entry day, threshold or stop was tried.
