# Result: Turnaround Tuesday on the years neither study used (14 Nov 2026)

**Verdict: NOT MEASURABLE (inconclusive: about 4.7 years of candles before 2008, under the 5-year floor).** As
pre-registered (PREREGISTRATION.md, pushed alone first), the study stops here: the candle proxy serves no index candle before
March 2003, both earlier studies' windows start with entries in January 2008, so the years never used run from the first
possible entry (22 April 2003 on the US markets) to 31 December 2007: 4.69 years at most. **No trade of the frozen rule on
2003-2007 was computed and no return of those years was read.** The Turnaround Tuesday hypothesis (#857 NAS100 R2: +0.098R a
trade net, t 2.33, n 81) therefore still has **no replication on years the original never used**; the multiple-testing
ledger's reading ("none on other years"; its "all cells" Fisher p 0.0039 counts the same years again) stands unchanged, and no
calendar-disjoint Fisher p can be formed. Never call the cell an edge. Nothing live changed and no proposal follows.

## Gate: passed exactly
The frozen code (`frozen.mjs`, the #857 run file, sha256 `74527d36…3871`; `replicate.mjs`, the #862 run file, sha256
`61cb6424…4b18`; both byte for byte, pinned in the test) on this study's candles cut to start 1 Oct 2007:

| | n | net R a trade | trade t | month-sum t (months) |
|---|---|---|---|---|
| #862 pool, 2016-now, published | 411 | +0.052 | 2.63 | 1.69 (131) |
| #862 pool, reproduced here | 411 | +0.052 | 2.63 | 1.69 (131) |
| #857 NAS100 R2, 2016-now, published | 81 | +0.098 | 2.33 | |
| #857 NAS100 R2, reproduced here | 81 | +0.098 | 2.33 | |

Each of #862's six markets' 2016-now n and net R is reproduced too (US30 55 / +0.018, US2000 93 / +0.061, DE40 64 / +0.054,
EU50 74 / +0.024, UK100 50 / +0.036, JP225 75 / +0.103).

## What the years before 2008 hold (counts only, no prices)

| Market | first candle | first possible entry | years to 31 Dec 2007 | local trading days 2003-07 | with a close candle |
|---|---|---|---|---|---|
| S&P 500 (SPX500) | 21 Mar 2003 | 22 Apr 2003 | 4.69 | 1,206 | 1,202 |
| Nasdaq 100 (NAS100) | 21 Mar 2003 | 22 Apr 2003 | 4.69 | 1,206 | 1,202 |
| Dow 30 (US30) | 21 Mar 2003 | 22 Apr 2003 | 4.69 | 1,206 | 1,200 |
| Russell 2000 (US2000) | 21 Mar 2003 | 22 Apr 2003 | 4.69 | 1,206 | 1,202 |
| Germany 40 (DE40) | 24 Mar 2003 | 24 Apr 2003 | 4.69 | 1,218 | 1,212 |
| Euro Stoxx 50 (EU50) | 19 Sep 2003 | 20 Oct 2003 | 4.20 | 1,092 | 1,089 |
| UK 100 (UK100) | 21 Mar 2003 | 2 May 2003 | 4.67 | 1,208 | 1,202 |
| Japan 225 (JP225) | 13 Mar 2003 | none | 0 | 1,182 | 0 (no Tokyo-hours candle) |

The longest span is 4.69 years, under the 5-year floor the brief set and the pre-registration fixed. At the rule's rate (about
8 trades a year a market on NAS100), 4.7 years would give some 35-40 trades a market: a single market could not have reached
the frozen study's own n of 30-plus with any power, which is why the floor exists.

## Not done, and departures
- Not done, by the pre-registered stop: the pooled test, 2x cost, the demo-cost check, per-market Holm, drawdown, the 40-seed
  placebo and the Fisher combination (no p exists on years the original never used).
- Data note against the pre-registration: EU50's first candle is 19 Sep 2003, not 2 Jan 2004 (the pre-registration's probe
  asked one 4,999-hour window from 1 Jan 2003, which ends before September). It changes no decision (4.2 years either way).
- The 2003-2005 financing rates (DGS2 in council-data starts 6 Jan 2006) and the pre-2007 European rates would have needed
  stated yearly values; not needed, since nothing was run.
- No other data host was searched (the coordinator's instruction and absolute rule 5): a longer test would need index candles
  before 2003 from a keyless source, with the close at the cash close, and its own pre-registration.

## To repeat
`node --use-env-proxy research/edge/turnaround-early-years/fetch.mjs <dir>` (candles outside git), then
`node research/edge/turnaround-early-years/run.mjs <dir>`. Tests: `tests/turnaround-early-years.test.mjs`.
