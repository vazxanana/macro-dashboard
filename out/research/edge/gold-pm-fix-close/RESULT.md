# Gold's close against the 15:00 London (PM auction) price as a next-day signal: result

**Verdict: FAIL, 0 of 3: following the close's side of the 15:00 London price lost −0.031R a trade net 2017-26 (n 2369, month t −2.14); gross ≈ 0 in both windows.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any candle was read for a result). Built 2026-11-14. Paper
research only: a **stand-alone** rule on XAU/USD, not a gate, exit, entry or size of the live gold book, and it reads none of
that book's positions (owner item 44). Nothing live changed.

## What was tested

- Data: OANDA mid XAU/USD M5, November 2006 to November 2026 (1,431,423 candles, a local cache out of git; `run.mjs fetch`
  rebuilds it from `/md/bars`). New York time from `council/histdata.mjs` `nyOffsetH`, London time from `euSummer`.
- Signal on trading day D: s = P(17:00 New York) / P(15:00 London) − 1. Trade day D+1 from the open of its first M5 candle
  (the 18:00 New York reopen) to its 17:00 New York close, stop 1 x ATR(14) of 17:00-New-York daily candles up to and
  including D (median stop $18.47 in sample, $23.98 out of sample). Gaps fill at the open, a candle reaching the stop takes it.
- T1 (primary): follow, both sides, every day. T2: follow when |s| is above the median |s| of the 250 previous signal days.
  T3: fade on the same days as T2.
- Costs: $0.60 a round trip (judged), plus `nights` x `FIN.xau.long` financing on buys (0.004R a buy in sample, 0 out of
  sample: the hold almost never crosses a 22:00 UTC rollover). Reported at 2 x ($1.20) too.
- t on calendar-month sums of net R; Holm over the three tests; 40 seeded random-side placebos on each test's own days.
- Days skipped: 206 signal days without a 15:00 London or 17:00 New York price (holidays, early closes), 170 with no next-day
  candle or close.

## Results

| Test | Window | n | Gross R | Net R | Net at 2 x | Month t gross | Month t net | Win % | Stopped % | Median stop |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 follow | IS 2007-16 | 2433 | +0.009 | −0.028 | −0.066 | 0.68 | −1.99 | 45.79 | 12.08 | $18.47 |
| T1 follow | OOS 2017-26 | 2369 | −0.003 | −0.031 | −0.059 | −0.20 | −2.14 | 46.56 | 12.28 | $23.98 |
| T2 follow, large | IS 2007-16 | 1108 | +0.036 | +0.003 | −0.030 | 1.75 | 0.13 | 48.47 | 9.75 | $20.23 |
| T2 follow, large | OOS 2017-26 | 1214 | −0.008 | −0.035 | −0.061 | −0.38 | −1.64 | 45.06 | 12.19 | $25.06 |
| T3 fade, large | IS 2007-16 | 1108 | −0.028 | −0.061 | −0.093 | −1.54 | −3.29 | 46.66 | 12.55 | $20.23 |
| T3 fade, large | OOS 2017-26 | 1214 | +0.013 | −0.013 | −0.040 | 0.65 | −0.64 | 50.33 | 13.26 | $25.06 |

| Test | OOS one-sided p | Holm p | Placebo OOS mean | Placebo 95th pct | Beats (of 40) | Pass |
|---|---|---|---|---|---|---|
| T1 | 0.984 | 1 | −0.024 | −0.002 | 12 | **no** |
| T2 | 0.949 | 1 | −0.026 | +0.001 | 14 | **no** |
| T3 | 0.739 | 1 | −0.026 | +0.001 | 33 | **no** |

Checks failed: every test fails net > 0 in both windows, OOS t >= 2 after Holm, the placebo (38 of 40) and net > 0 at 2 x
costs; OOS n >= 200 holds for all three.

## Reading

- Before costs every stream is within 0.04R of zero; the $0.60 cost (about 0.03R on a one-day ATR stop) makes all of them
  lose. T1 does worse than random sides (12 of 40 placebos beaten): where the close sits against the auction price carries
  no next-day information here.
- The one positive gross figure, T2 in sample (+0.036R, t 1.75 gross), reversed out of sample (−0.008R), and the fade of the
  same days, T3, lost in sample and is only gross-positive out of sample: the sign flips between windows, which is noise.
- Regression of the next day's return on s (reported only): slope +0.035 (t 1.07) in sample, −0.026 (t −0.69) out of sample.
- By year (T1 net R a trade): positive in 4 of 20 years (2011, 2013, 2016, 2026), none above +0.04R.

Not an edge; never a council rule, filter or bias. No other hour, threshold, stop or hold was tried after the results.

## Files

`PREREGISTRATION.md`, `run.mjs` (`node research/edge/gold-pm-fix-close/run.mjs <xau-5m.json.gz>`; `run.mjs fetch <file>`
first), `result.json`, test `tests/gold-pm-fix-close.test.mjs`.
