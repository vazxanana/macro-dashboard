# Result: gold-driven days against dollar-driven days (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold after a day it rose in USD, EUR and GBP makes +0.092R a trade net in 2017-26 but only +0.048R over buying every day (n 359, excess month t 1.09, Holm p 0.276); in sample -0.013R.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any number was computed). Paper research only,
a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here was compared with or
applied to that book (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member changed. No
proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json`, `xaueur.json`, `xaugbp.json` at commit
  `7caa6a36` (gold 2006-03-20 to 2026-11-13), weekends folded into the next weekday with
  `council/fills.mjs` `foldWeekend`.
- Signal: each series' close-to-close return divided by the sd of its own 20 previous daily returns (the day excluded).
  Gold-driven up day: all three above +0.5; gold-driven down day: all three below -0.5; dollar-driven up day: USD above +0.5,
  EUR and GBP below 0. Days: 483 / 431 / 21 of 2602 in 2007-16, 512 / 397 / 33 of 2551 in 2017-26.
  **A dollar-driven up day is rare** (about 3 a year): gold's daily move is mostly larger than the dollar's against the euro and
  the pound, so most strong gold days in dollars show in all three currencies (512 of 822 strong up days out of sample).
- Trade: entry at the next UTC daily open, stop 1.5 x ATR(14) of the 14 candles before it (1R), gaps through the stop fill at
  the open, out at the close of the 3rd candle, one position at a time per test. Costs $0.60 a round trip plus financing on
  buys by `nights()` x `FIN.xau.long` (0.000148 of price a rollover, today's demo rate for every year). Mean cost
  0.047R a T1 trade out of sample, 0.017R a T2 trade.
- Baseline: the same trade on every eligible day of the window (no one-at-a-time rule). **Excess** = net R minus the baseline's
  mean net R. t on calendar-month sums (empty months count as 0); Holm over T1-T3 on the one-sided OOS p of the excess t.

## The three tests

| Test | Window | Signals | n | Win % | Gross R a trade | Net R a trade | Baseline net | Excess R | Net at 2x costs | Total net R | Month t gross | Month t net | Month t excess | Stops |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 gold-driven up, buy (primary) | IS 2007-16 | 483 | 354 | 48.0 | +0.023 | -0.025 | -0.012 | -0.013 | -0.072 | -8.74 | 0.61 | -0.66 | **-0.34** | 58 |
|  | OOS 2017-26 | 512 | 359 | 53.5 | +0.139 | +0.092 | +0.044 | +0.048 | +0.044 | +32.90 | 3.06 | 2.05 | **1.09** | 54 |
| T2 gold-driven down, sell | IS 2007-16 | 431 | 329 | 42.2 | -0.046 | -0.068 | -0.044 | -0.025 | -0.091 | -22.51 | -1.00 | -1.48 | **-0.53** | 56 |
|  | OOS 2017-26 | 397 | 316 | 46.2 | -0.015 | -0.033 | -0.087 | +0.055 | -0.050 | -10.28 | -0.39 | -0.84 | **1.43** | 51 |
| T3 dollar-driven up, sell | IS 2007-16 | 21 | 21 | 28.6 | -0.199 | -0.225 | -0.044 | -0.181 | -0.251 | -4.72 | -1.41 | -1.58 | **-1.30** | 5 |
|  | OOS 2017-26 | 33 | 32 | 46.9 | -0.014 | -0.038 | -0.087 | +0.049 | -0.063 | -1.23 | -0.12 | -0.34 | **0.43** | 5 |

Failed checks: T1 oosExcessTAndHolm, isExcessPositive, placebo38; T2 oosExcessTAndHolm, oosNetPositive, isExcessPositive, x2Positive; T3 oosExcessTAndHolm, oosNetPositive, isExcessPositive, x2Positive, placebo38.

## Placebo (out of sample)

Each draw takes the real number of signal days at random from the out-of-sample days with the same dollar-gold condition (USD
z above +0.5 for T1 and T3, below -0.5 for T2) but without the euro / pound condition, so it keeps one-day momentum in dollar
gold and removes only the cross-currency split.

| Test | Real excess month t | Placebos beaten (of 40) | Pool days | Days drawn | Placebo median t | Placebo 95th pct | One-sided p | Holm p |
|---|---|---|---|---|---|---|---|---|
| T1 | 1.09 | 31 | 822 | 512 | 0.77 | 1.99 | 0.138 | 0.276 |
| T2 | 1.43 | 39 | 660 | 397 | 0.35 | 1.41 | 0.076 | 0.229 |
| T3 | 0.43 | 30 | 822 | 33 | -0.11 | 1.31 | 0.334 | 0.334 |

For T1 the draw takes 512 of 822 pool days, so a placebo shares most of its days with the real signal:
the placebo is weak there, and the decision rests on the excess t and the in-sample sign, both of which fail.

## Reading

- **T1 (primary).** Out of sample the gold-driven buy made +0.092R a trade net (month t 2.05), but buying on every
  day made +0.044R the same way: gold's 2017-26 rise, not the signal. The excess, +0.048R, has month t 1.09 (Holm p
  0.276); in 2007-16 the excess was -0.013R (t -0.34). The cross-currency split adds nothing measurable to a strong up day.
- **T2.** Selling after a gold-driven down day lost -0.033R net out of sample; it lost less than selling every day
  (excess +0.055R, t 1.43), and the in-sample excess was negative (-0.025R).
- **T3.** Fading a dollar-driven rise: 32 trades out of sample, -0.038R net, excess +0.049R (t 0.43);
  -0.181R in sample on 21. Too rare and of the wrong sign in sample.
- Nothing here is an edge. The split of a gold day by currency does not carry information for the next three days on this data.

## Repeat

`node research/edge/gold-driven-day/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-driven-day/run.mjs full <dir>`. Tests: `tests/gold-driven-day.test.mjs`.
