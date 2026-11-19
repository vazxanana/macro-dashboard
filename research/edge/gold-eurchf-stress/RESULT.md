# Result: does European stress, read in EUR/CHF, lead spot gold over the next four weeks? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: the both-sided EUR/CHF stress rule loses −0.285R a trade net out of sample 2017-26 (n 33, month t −1.34), below the unconditional long.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit c1f23205a, pushed alone before any price was read). Paper
research only, a **stand-alone cross-market rule**: not a gate, entry, exit or size of the live gold book, and nothing here was
compared with or applied to that book (owner decision 44). No live rule, size, filter, stop, config, cost constant or council
member changed. No proposal is written. Not an edge.

## What was tested (as pre-registered)

- Data: council-data `research/daily/xau.json` and `eurchf.json` (OANDA mid, UTC days) at commit `9fe2c7ac`, weekends folded
  into Monday (`council/fills.mjs` `foldWeekend`). Gold 2006-03-20 to 2026-11-06.
- Signal once a week at gold's last candle of each Monday week: EUR/CHF's return over its last 20 daily closes up to that same
  UTC day. Down 2 % or more (the franc bid, European stress rising) → long gold; up 2 % or more (stress unwinding) → short gold.
- Entry at the next gold open on a later day (the Sunday reopen), stop 2 x ATR(20) of gold's earlier candles (gaps fill at the
  open), out at the close of the 20th gold candle held; one position at a time. Every trade has a stop.
- Costs: $0.60 a round trip on every trade, plus `nights()` x `FIN.xau.long` (0.000148 of price a rollover, today's demo rate,
  every year) on buys. Median stop $40 in sample, $50 out of sample. **Cost share** (mean cost / mean absolute gross R): T1 6 %
  in sample, 8 % out of sample; the long leg 8-13 % (financing over 20 nights), the short leg 2 %.
- t on calendar-month sums of net R (every month counts, empty months 0), Holm over T1-T3 on the one-sided OOS p. In sample
  2007-2016, out of sample 2017 to 2026-10. Placebo: 40 seeded draws of the same number of trades and sides on random eligible
  weeks of the OOS window.

## Verdict table

| Test | Window | n (long / short) | Gross R a trade | Net R a trade | Net at 2x costs | Month t net (gross) | Win | p / Holm | Placebo below real |
|---|---|---|---|---|---|---|---|---|---|
| **T1 both-sided (primary)** | IS 2007-16 | 44 (28 / 16) | −0.000 | −0.069 | −0.138 | −0.33 (−0.00) | 39 % | | |
| | **OOS 2017-26** | **33 (18 / 15)** | **−0.211** | **−0.285** | −0.358 | **−1.34 (−0.98)** | 27 % | 0.91 / 1.00 | 8 of 40 |
| T2 long leg | IS | 28 | −0.029 | −0.128 | −0.228 | −0.46 (−0.10) | 32 % | | |
| | OOS | 18 | +0.163 | +0.041 | −0.080 | +0.12 (+0.48) | 39 % | 0.45 / 1.00 | 18 of 40 |
| T3 short leg | IS | 16 | +0.140 | +0.124 | +0.109 | +0.43 (+0.48) | 56 % | | |
| | OOS | 15 | −0.661 | −0.676 | −0.692 | −2.63 (−2.61) | 13 % | 1.00 / 1.00 | 2 of 40 |

Every test fails every pre-registered condition but one or two: T1 has n 33 >= 30 and nothing else (OOS t negative, in sample
negative, negative at 2x costs, 8 of 40 placebos below it, 38 needed); T2 has too few trades and no t; T3 is positive in sample
only and then loses heavily out of sample.

## Baselines (reported, not tested)

| Stream (same hold, stop, costs, one at a time) | IS net (month t) | OOS net (month t) | OOS n |
|---|---|---|---|
| Unconditional long every week | +0.030 (+0.29) | +0.148 (+1.25) | 160 |
| Unconditional short every week | −0.132 (−1.48) | −0.294 (−3.25) | 181 |
| Gold's own 20-day sign, both sides | −0.015 (−0.15) | +0.124 (+1.08) | 156 |
| **T2 long leg (EUR/CHF stress)** | −0.128 | +0.041 | 18 |
| **T3 short leg (stress unwinding)** | +0.124 | −0.676 | 15 |

Against its own side's baseline the rule adds nothing: the stress longs made less than buying gold on any week (+0.041R against
+0.148R out of sample, −0.128R against +0.030R in sample), and the unwind shorts lost more than shorting on any week out of sample
(−0.676R against −0.294R). Gold's own four-week sign beats the EUR/CHF stream in both windows. EUR/CHF's sharp moves carry no
information about gold's next four weeks that gold's general drift does not already hold.

## Notes

- Signals by year (weeks over the threshold, long / short): concentrated in the euro crisis (2008 12 / 7, 2010 18 / 5, 2011
  15 / 12); none in 2012 and 2014 (the Swiss National Bank's 1.20 floor) and 2019; few since 2017 (49 signal weeks, 33 trades).
  The out-of-sample sample is small; the result is a clean null, not a measured loss rate.
- The SNB's January 2015 removal of the floor (EUR/CHF −15 % in a day) gives four in-sample long signal weeks (16 Jan - 6 Feb)
  and then four short weeks as the franc gave some of it back; with one position at a time they are at most two trades of 44.
- Not tested, said: other stress gauges (sovereign spreads, bank equities), other thresholds or holds. Any of these chosen after
  reading this table would be a re-fit and needs its own pre-registration on other data.

## Files

- `run.mjs` (`fetch <dir>` copies the two caches from `origin/council-data`, no network; `full <dir>` writes `result.json`).
- `result.json`: every figure above, the OOS trade list per test, the placebo draws, signals by year.
- Test: `tests/gold-eurchf-stress.test.mjs`.
