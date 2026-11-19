# Two gauges of the macro rule book and gold

**Verdict: A FAIL, B1 FAIL, B2 PASS** (pre-registered, 19 Nov 2026). "Cuts priced" passed: gold did better in the weeks the
2-year yield sat below the policy rate. It rests on about five easing cycles, so it is a tested lean, not a trading rule.

Pre-registration: `PREREGISTRATION.md` (committed before this run). FRED VIXCLS, DGS2, DFEDTARU / DFEDTAR (each value known at the
next weekday's close), gold's OANDA daily closes, 2007 to 2026.

## A: VIX at 40 or above ("gold dips in the dash for cash, then makes new highs")
9 episodes (first close at 40 or above after 20 sessions below): gold's next 60 sessions averaged +0.98 % against +1.80 % on all
days, and only 4 of 9 beat it. **FAIL.** Gold dipped in every episode (median low about −4 % within 60 sessions), but it was higher 60
sessions later in only 4 of 9 (September 2011, February and June 2020, April 2025) and lower in 2008, 2010, August 2011, 2015
and October 2020.

## B: the 2-year against the policy rate (each Friday, gold's next 20 sessions)

| Class | Weeks | Gold, next 20 sessions | Up |
|---|---|---|---|
| Hikes priced (2-year > upper target + 25 bp) | 381 | +0.44 % | 52 % |
| Neither | 379 | +0.18 % | 53 % |
| Cuts priced (2-year < upper target − 25 bp) | 241 | +1.76 % | 67 % |
| All weeks | 1,001 | +0.66 % | |

| Test | t (2007-26) | 2007-16 / 2017 on | Holm p | Pass |
|---|---|---|---|---|
| B1 hikes priced lower than the rest | −0.83 | +0.88 / −2.34 | 0.41 | no |
| B2 cuts priced higher than the rest | +3.05 | +1.56 / +2.44 | 0.005 | **yes** |

What carries B2: the cuts-priced weeks fall into 12 runs, about five separate easing cycles (2007-08, 2019, early 2020, 2023-24,
2025), each a rising stretch for gold; 9 of the 12 runs had a positive average. Read it as "gold has done better while the market
priced Fed cuts", the same family as the Gold Macro Score's falling-2-year driver, on few independent cycles. It is not a new edge
and no rule changes. On the Macro desk the gap is a live reading in "Your research, applied" with this record beside it.

To repeat: `node --use-env-proxy research/edge/rulebook-gauges/run.mjs fetch <dir>` (FRED + council-data), then `… run <dir>`.
