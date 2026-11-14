# Result: is gold stretched against Brent crude a signal for gold? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: trading gold back toward its one-year gold/Brent ratio lost -0.351R a trade net out of sample 2017-26 (n 14, month t -1.44), below the same-side baseline; longs and shorts fail too.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit 532844774, pushed alone before any number was computed).
Paper research only, a **stand-alone rule on spot gold**: not a gate, entry, exit or size of the live gold book, and it does
not use the book's 2006-17 window or its positions (owner decision 44). No live rule, size, filter, stop, config, cost
constant or council member changed. No proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json` and `bco.json` at commit `648d6b1e`
  (gold 2006-03-20 to 2026-11-06, Brent from 2003), weekends folded into Monday with `council/fills.mjs` `foldWeekend`,
  days matched by UTC day stamp. First z: 2007-03-08.
- Signal: z of ln(gold / Brent) over the 250 values ending at the day. Short gold when z crosses above +2, long when it
  crosses below -2; a side re-arms once |z| is back under 1. Entry at gold's next daily open, stop 3 x ATR(20), out at the
  close of the 20th candle; one position at a time.
- Costs: $0.60 a round trip plus `nights x FIN.xau.long x entry` on longs (0.000148 a night, the demo broker's swap).
- Statistic: t of calendar-month sums of net R, Holm over T1-T3; baseline = the same trade entered at every gold open of
  the window on the same side (overlapping); 40 seeded placebo draws.

## Verdict table

| Test | Window | n (long / short) | Gross R | Net R | Net at 2x costs | Same-side baseline excess | Month t (net / gross) | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|
| T1 both sides (primary) | IS 2007-16 | 12 (5 / 7) | +0.255 | +0.218 | +0.180 | +0.267 | 0.79 / 0.92 | | |
| | OOS 2017-26 | 14 (6 / 8) | −0.303 | −0.351 | −0.399 | −0.296 | −1.44 / −1.22 | 1.00 | no |
| T2 longs (gold cheap) | IS | 5 (5 / 0) | −0.023 | −0.099 | −0.176 | −0.134 | −0.27 / −0.06 | | |
| | OOS | 6 (6 / 0) | +0.193 | +0.092 | −0.010 | −0.057 | 0.24 / 0.50 | 1.00 | no |
| T3 shorts (gold dear) | IS | 7 (0 / 7) | +0.454 | +0.444 | +0.434 | +0.554 | 1.13 / 1.16 | | |
| | OOS | 8 (0 / 8) | −0.674 | −0.683 | −0.691 | −0.476 | −2.13 / −2.12 | 1.00 | no |

Every test misses the t bar, the 2x-cost bar, the baseline bar and the n >= 30 bar out of sample.

## Baseline comparison

Unconditional same-side mean net R a trade (every gold open, same stop, 20-candle exit, same costs): longs +0.034R in
2007-16 and +0.149R in 2017-26; shorts −0.110R and −0.207R. That is gold's drift. The signal's out-of-sample longs made
+0.092R, less than buying on any day (excess −0.057R); its shorts lost −0.683R, worse than shorting on any day (excess
−0.476R). The in-sample shorts looked good (+0.444R, 5 of 7 won) and then lost 7 of 8 out of sample in gold's 2018-26
rise: a short signal that only worked while gold went nowhere.

## Placebo

T1: of 40 seeded draws of 14 random out-of-sample days with the same long / short mix, 33 reached the real month t of
−1.44 or better (median −0.41, 5th-95th −2.00 to +1.71); 1 reached t >= 2. The rule's result is inside what random days give.

## Costs and stops

Median stop $79 out of sample ($69 in sample), so a trade's dollar cost is small: mean cost 0.048R a trade, 5.7 % of the
mean absolute gross R on T1 (longs 13 % with financing, shorts 1 %). The rule did not fail on costs: gross R is negative
out of sample.

## Reading

Too few signals to be anything but an anecdote (26 in twenty years), and the direction flipped between the two windows.
The gold / Brent ratio level is not a usable relative-value signal for gold at a one-month hold. Not an edge; never a
council rule or filter. No variant is proposed (a looser threshold would be a new hypothesis chosen after seeing this).

To repeat: `node research/edge/gold-brent-ratio/run.mjs fetch <dir>` (git show from `origin/council-data`, no network),
then `node research/edge/gold-brent-ratio/run.mjs full <dir>`. Test: `tests/gold-brent-ratio.test.mjs`.
