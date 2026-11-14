# Result: gold rising or falling in every major currency at once (14 Nov 2026)

**Verdict: FAIL, 0 of 3: trading gold the way its 20-day trend points in all six currencies makes +0.034R a trade net out of sample 2017-26 (n 214, month t 0.52, Holm p 0.60); it beats 29 of 40 placebos.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any candle was read). Paper research only, a
**stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here was compared with or
applied to that book (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member changed.
No proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/` `xau`, `eurusd`, `gbpusd`, `usdjpy`, `usdchf`, `audusd`
  at commit `e3dbfa18`, weekends folded into Monday with `council/fills.mjs` `foldWeekend`; 5,363 common days, 2006-03-20 to
  2026-11-06. Gold in EUR, GBP, AUD = gold / the pair; in JPY, CHF = gold x the pair.
- State on each common day: +1 when gold's L-day return is positive in all six currencies (USD, EUR, GBP, JPY, CHF, AUD), -1 when
  negative in all six, else 0. With L = 20 the state was +1 on 31 % and -1 on 24 % of in-sample days, 37 % and 21 % out of sample.
- Trade: the next gold open after the state turns to a side, out at the next open after it leaves that side (or the close of
  candle 60), stop 2 x ATR(20) before the entry (1R; mean $40 in sample, $65 out of sample, so $0.60 is about 0.01R), one at a
  time; $0.60 a round trip plus `nights` x `FIN.xau.long` x entry on buys.
- T1 (primary) L = 20 both sides; T2 L = 20 sells only; T3 L = 60 both sides. t on calendar-month sums of net R (exit month),
  Holm over the three. Placebo: each out-of-sample trade keeps its side and length, moved to a random entry day (40 seeds).

## The tests (R a trade)

| Test | Window | n (buys / sells) | gross | net | net at 2x costs | month t net (gross) | Holm p | placebo beaten | pass |
|---|---|---|---|---|---|---|---|---|---|
| T1 L 20, both sides | 2007-16 | 236 (133 / 103) | +0.006 | -0.033 | -0.071 | -0.71 (0.12) | | | |
| T1 L 20, both sides | 2017-26 | 214 (117 / 97) | +0.087 | +0.034 | -0.019 | 0.52 (1.24) | 0.60 | 29 / 40 | no |
| T2 L 20, sells | 2007-16 | 103 | -0.075 | -0.092 | -0.109 | -1.94 (-1.59) | | | |
| T2 L 20, sells | 2017-26 | 100 | -0.135 | -0.149 | -0.163 | -2.68 (-2.45) | 1.00 | 3 / 40 | no |
| T3 L 60, both sides | 2007-16 | 135 (75 / 60) | +0.059 | +0.005 | -0.049 | 0.06 (0.69) | | | |
| T3 L 60, both sides | 2017-26 | 104 (69 / 35) | +0.305 | +0.209 | +0.114 | 1.24 (1.69) | 0.32 | 33 / 40 | no |

T1 fails every check but n: out of sample t 0.52, in sample negative, negative at 2x costs, inside the placebo (its 95th
percentile is t 1.39). T3 is positive in both windows and at 2x costs but its t is 1.24 (Holm p 0.32) and it beats only 33 of
40 placebos. Most trades end by the state turning (T1: 199 of 214 out of sample; 15 stops), after about 7 candles.

## What the numbers say

- **The sell side loses in both windows** (T2: -0.092R in sample, -0.149R out of sample, month t -2.68). Gold falling in every
  currency at once did not keep falling; the 2017-26 "profit" of T1 and T3 is their buys, +0.178R (T1) and +0.367R (T3) a buy
  out of sample. That is gold's own 2017-26 rise, which the placebo (same sides, random days) also collects.
- **Year by year, T1 out of sample is 2025**: +11.58R of its +7.32R total (the other nine years sum to -4.26R). T3's +21.79R
  holds +17.90R from 2025 on 5 trades.
- **What the agreement adds over gold in USD alone** (context, the same mechanics with the state from USD gold only; a flip from
  +1 straight to -1 is not re-entered at the same open, so it trades less often): in sample +0.114R a trade (n 119, t 1.05),
  out of sample +0.022R (n 136, t 0.24). Requiring all six currencies to agree did not make the signal better in either window.

## Reading

The idea that a gold move confirmed in every currency is gold-specific demand that persists is not supported on 2007-26 daily
data: both sides together are noise, the sells lose, and the buys earn what any buy of gold earned. Not an edge, not a filter, no
proposal; nothing live changed. Not tested: other lookbacks than 20 and 60, other currency sets, weekly rebalancing, sizing by
volatility.

To repeat: `node research/edge/gold-currency-breadth/run.mjs fetch <dir>` (git show from `origin/council-data`, no network),
then `node research/edge/gold-currency-breadth/run.mjs full <dir>`. Tests: `tests/gold-currency-breadth.test.mjs`.
