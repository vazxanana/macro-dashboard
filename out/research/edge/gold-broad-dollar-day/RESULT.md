# Result: a broad dollar day and gold over the next five days (study 120, 14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold after a broad dollar-up day beats the every-day buy by +0.022R a trade out of sample 2017-26 (n 185, excess month t 0.35, Holm p 1.000), -0.030R in sample.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit 4a8631dd7, pushed alone; only the signal counts were read
before it). Paper research only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and
no position of that book's 2006-17 window was read (owner decision 44). No live rule, size, filter, stop, config, cost
constant or council member changed. No proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/` at commit `338cfb45` (`xau`, `eurusd`, `gbpusd`,
  `audusd`, `usdjpy`, `usdcad`, `usdchf`), weekends folded into Monday with `council/fills.mjs` `foldWeekend`. Dollar index =
  the council's ICE DXY build (`council/macro.mjs` `dxySeries`).
- **Broad dollar-up day**: all six majors moved the dollar's way (EURUSD, GBPUSD, AUDUSD down; USDJPY, USDCAD, USDCHF up) and
  the index return was above +1 sd of its 20 previous daily returns; down day = the mirror. Up days were 6.8 % of in-sample
  and 9.3 % of out-of-sample eligible days; down days 6.9 % and 10.0 %.
- T1 (primary) broad up day, buy gold; T2 broad down day, sell gold; T3 broad up day on which gold also fell > 0.5 sd, buy.
- Trade: next gold UTC open, stop 2.0 x ATR(14) of the 14 candles before (1R; a gap through it fills at the open), out at
  the close of the 5th daily candle, one position at a time per test. Costs $0.60 a round trip plus `nights()` x
  `FIN.xau.long` x entry / risk on buys (today's demo rate for every year): about 0.05R a buy, 0.015R a sell.
- Baseline = the same-side trade entered after every eligible day of the window (overlaps allowed), its mean net R per
  calendar year; **excess** = a trade's net R minus its entry year's baseline mean. t on calendar-month sums (empty months
  count 0). Holm over T1-T3 on the one-sided OOS p of the excess t.

## The three tests

| Test | Window | Signals | n | Win % | Gross R | Net R | Net at 2x costs | Excess R | Month t excess | Month t net | Total net R | Stops |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 broad up, buy (primary) | IS 2007-16 | 176 | 140 | 45.0 | -0.009 | -0.055 | -0.100 | -0.030 | -0.54 | -0.94 | -7.64 | 23 |
| | OOS 2017-26 | 237 | 185 | 55.1 | +0.121 | +0.070 | +0.019 | +0.022 | **0.35** | 1.03 | +12.95 | 35 |
| T2 broad down, sell | IS 2007-16 | 179 | 139 | 43.2 | -0.044 | -0.061 | -0.079 | +0.009 | 0.13 | -0.90 | -8.52 | 21 |
| | OOS 2017-26 | 256 | 190 | 40.0 | -0.129 | -0.143 | -0.157 | -0.034 | **-0.64** | -2.63 | -27.23 | 42 |
| T3 broad up + gold down, buy | IS 2007-16 | 110 | 95 | 43.2 | +0.001 | -0.045 | -0.091 | -0.020 | -0.32 | -0.69 | -4.26 | 13 |
| | OOS 2017-26 | 155 | 133 | 54.1 | +0.126 | +0.076 | +0.026 | +0.028 | **0.39** | 1.00 | +10.12 | 25 |

Every-day baseline, net R a trade (gross in brackets): buy IS -0.001 (+0.047), OOS +0.061 (+0.113), n 2,601 / 2,552;
sell IS -0.062 (-0.045), OOS -0.108 (-0.094).

| Test | OOS p (one-sided) | Holm p | Excess t >= 2 and Holm < 0.05 | IS excess > 0 | OOS net > 0 | 2x > 0 | Placebo beaten | Control beaten | >= 100 signals | Pass |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 0.363 | 1.000 | no | no | yes | yes | 26 | 28 | yes | no |
| T2 | 0.739 | 1.000 | no | yes | no | no | 8 | 7 | yes | no |
| T3 | 0.348 | 1.000 | no | no | yes | yes | 27 | 25 | yes | no |

Placebo (seeds 1-40: as many random eligible OOS days as signals) and control (seeds 1001-1040: random days drawn within each
calendar year, as many per year as the signal had, which keeps the year's drift and volatility), OOS month-sum excess t:

| Test | Real excess t | Placebo below real | Placebo median / 5th / 95th | Control below real | Control median / 5th / 95th |
|---|---|---|---|---|---|
| T1 | 0.35 | 26 | 0.21 / -1.69 / 1.27 | 28 | -0.07 / -1.84 / 1.26 |
| T2 | -0.64 | 8 | -0.19 / -1.75 / 1.37 | 7 | 0.39 / -1.18 / 1.81 |
| T3 | 0.39 | 27 | -0.02 / -1.99 / 2.22 | 25 | -0.04 / -1.19 / 1.63 |

## Reading

- Not an edge, and no proposal. A uniform dollar rally does not mark a gold low worth buying: the buy after it is +0.070R a
  trade net out of sample only because buying gold on ANY day of 2017-26 made +0.061R; over that baseline it adds +0.022R
  (t 0.35), and in 2007-16 it was below the baseline (-0.030R). Random days of the same years do as well as the signal (28 of
  40 below it, a median near 0).
- Gold sold WITH the dollar (T3, the "sold for dollars" day) is no different from T1 (+0.028R excess, t 0.39).
- The sell after a uniform dollar fall loses in both windows and is below its own sell-every-day baseline out of sample; its
  -2.63 month t on net R is gold's rise in 2017-26, not the signal (excess t -0.64).
- Broad dollar days, as a five-day gold signal in either direction, are closed on the council's data.

## What was not tested

Other breadth counts (five of six), thresholds, holds or stops; intraday entry on the signal day; other metals; any use
inside the gold book.

## To repeat

`node research/edge/gold-broad-dollar-day/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`… count <dir>` and `… full <dir>`. Tests: `tests/gold-broad-dollar-day.test.mjs`.
