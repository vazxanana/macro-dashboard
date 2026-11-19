# Result: a gold 20-day breakout confirmed by silver, platinum and palladium (14 Nov 2026)

**Verdict: FAIL, 0 of 3: confirmed gold breakouts made -0.063R a trade less than gold's every-day same-side trade out of sample 2017-26 (n 100, month t -0.55), and -0.066R in 2007-16.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any candle was read). Paper research only, a
**stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here reads that book's positions
or uses its 2006-17 window as a book test (owner decision 44). No live rule, size, filter, stop, config, cost constant or council
member changed. No proposal is written. Not an edge; never a council rule or filter.

## What was tested
- Data: OANDA mid daily candles (UTC), council-data `research/daily/` `xau`, `xag`, `xpt`, `xpd` (commit `0448a3d7`), weekend
  candles folded into the next weekday (`foldWeekend`); 5,330 common days, 20 Mar 2006 to 6 Nov 2026.
- Signal: gold closes beyond its 20-day close extreme; **confirmed** when at least 2 of silver, platinum and palladium broke out the
  same side on that day or the two days before. Entry next gold open, stop 2 x ATR(20), out at the close of the 15th candle, one at
  a time, both sides. Costs $0.60 a round trip plus `nights` x `FIN.xau.long` x entry on buys.
- Baseline: the same trade entered after every day of the window, per side. **Excess** = net R minus that baseline.
- Median stop $37.71 (2007-16) and $46.47 (2017-26), above the $10 floor. Cost share (mean cost / mean |gross R|) 6.3 % in sample,
  7.9 % out of sample: costs are not the reason it fails.

## The three tests (Holm over three, one-sided p from the month-sum t)

| Test | Window | n | Mean R a trade | Month-sum t | 2x costs | p | Holm p |
|---|---|---|---|---|---|---|---|
| T1 confirmed, excess over baseline (primary) | 2007-16 | 107 | -0.066 | -0.64 | -0.067 | | |
| T1 | 2017-26 | 100 | -0.063 | -0.55 | -0.065 | 0.709 | 1 |
| T2 confirmed minus unconfirmed (monthly excess) | 2007-16 | 107 / 94 | -0.130 a month | -1.12 | | | |
| T2 | 2017-26 | 100 / 100 | -0.085 a month | -0.73 | | 0.767 | 1 |
| T3 confirmed, raw net R | 2007-16 | 107 | -0.091 (gross -0.028) | -0.88 | -0.155 | | |
| T3 | 2017-26 | 100 | -0.048 (gross +0.026) | -0.42 | -0.123 | 0.663 | 1 |

Placebo (T1, 40 seeded draws of the same number of plain gold breakouts per side, 2017-26): the real t -0.55 beats 4 of 40;
placebo median t -0.21, 95th percentile +0.53. The confirmation does not select better breakouts than chance.

## The baseline and the comparison
| Window | Every-day long, net R | Every-day short, net R | Confirmed longs: net / excess | Confirmed shorts: net / excess |
|---|---|---|---|---|
| 2007-16 | +0.036 (n 2,588) | -0.113 | -0.093 / -0.128 (n 63) | -0.089 / +0.024 (n 44) |
| 2017-26 | +0.175 (n 2,523) | -0.216 | +0.061 / -0.114 (n 59) | -0.206 / +0.011 (n 41) |

The every-day baseline shows gold's drift: a 15-day long made +0.175R net out of sample and a short lost -0.216R. The confirmed
longs earned less than an ordinary long day (-0.114R excess); the confirmed shorts were indistinguishable from an ordinary short
(+0.011R). Unconfirmed breakouts did better than confirmed ones in both windows (excess +0.092R and +0.038R, t 0.70 and 0.28),
the opposite of the hypothesis and not significant either. All gold breakouts together: +0.110R excess in sample (t 1.11), -0.029R
out of sample (t -0.30).

Signals: 626 gold breakout days in sample, 599 out of sample; confirmation counts 0/1/2/3 = 97/148/183/198 and 104/159/198/138.
Worst drawdown of the confirmed stream -11.1R (2007-16) and -15.5R (2017-26). Exits: 56 time / 51 stop and 59 / 41.

## Pass bar, line by line (T1)
OOS t >= 2 with Holm p < 0.05: no (t -0.55). In-sample excess > 0: no (-0.066). OOS excess > 0 at 2x costs: no (-0.065). Above 38 of
40 placebos: no (4). Median stop >= $10: yes. T2 and T3 are not leads either (both negative in both windows).

## To repeat
`node research/edge/gold-metals-confirm/run.mjs fetch <dir>` (git show from `origin/council-data`, no network, kept out of git),
then `node research/edge/gold-metals-confirm/run.mjs full <dir>`. Test: `tests/gold-metals-confirm.test.mjs`.
