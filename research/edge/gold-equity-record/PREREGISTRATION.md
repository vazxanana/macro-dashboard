# Pre-registration: spot gold sold for five days after a US equity index closes at a 52-week high (14 Nov 2026)

Written and pushed ALONE, before any gold return after an event was computed (only event dates were counted). Paper
research only: a **stand-alone rule on gold**, never a gate, entry, exit or size of the live gold book, and none of the
book's 2006-17 positions is read (docs/owner-decisions.md item 44). No live rule, size, filter, stop, config, cost
constant or council member changes. No oscillator is used.

## Question

When a US equity index closes at its highest close of the last 52 weeks, does spot gold do worse over the next five
trading days than on an ordinary day? The story: a record close in equities is the moment risk appetite is strongest and
the demand for a haven is weakest, so gold lags. The test is one-sided: a gold SELL, judged by its excess over the same
sell entered on every day of the window.

## Why this is not a duplicate

- `gold-equity-new-depth` (branch, 14 Nov): the day an index drawdown reaches a new depth (3 % or more below the 52-week
  high), a one-day gold BUY. The opposite end of the equity path, the opposite side, a different hold. That study counted
  "new 52-week highs after a 5-day gap" (53 and 65 a window) and did not test them; every record close counts here.
- `gold-equity-bear` (a 10 % / 20 % drawdown state, a 20-day buy), `gold-spx-rs` (gold / S&P 3-month relative strength),
  `gold-equity-corr-momentum` (gold momentum split by its correlation with the S&P), `gold-haven-shock` and
  `gold-liquidation-day` (large index or cross-asset down days): none conditions on an equity RECORD.
- `gold-record-high` is gold's own record; `index-52w-high` trades the index itself, not gold.

## Data (named before any result)

council-data `research/daily/` (OANDA mid, UTC daily candles, Saturday / Sunday candles folded into the next weekday by
`council/fills.mjs` `foldWeekend`): `xau` (gold, traded), `spx500` (S&P 500 CFD), `nas100` (Nasdaq 100 CFD), `us30` (Dow
Jones 30 CFD). Read with `git show origin/council-data:research/daily/<key>.json` into a cache outside git, deleted at the
end. No other market is read.

## The event

Index day D (a closed index candle, from the 252nd candle of the file on) is a **record day** when its close is at or
above every close of the 251 index candles before it. Only candles at or before D are read.

| test | index |
|---|---|
| T1 (primary) | S&P 500 (`spx500`) |
| T2 | Nasdaq 100 (`nas100`) |
| T3 | Dow Jones 30 (`us30`) |

Counts (dates only, made before this file was written; "entries" = one trade at a time, each 5 gold candles long, so a
trade ended early by its stop can let a few more in):

| test | 2007-16 record days | entries | months | 2017 - Oct 2026 record days | entries | months |
|---|---|---|---|---|---|---|
| T1 | 270 | 106 | 51 | 377 | 139 | 65 |
| T2 | 318 | 118 | 58 | 392 | 138 | 63 |
| T3 | 281 | 102 | 47 | 282 | 108 | 56 |

A joint "all three indices the same day" test was counted (49 and 58 entries) and dropped for being under 100.

## The trade

Sell gold at the open of the first gold candle whose day is after D; out at the close of the 5th gold candle from the
entry (the Friday candle ends at 21:59:59 UTC), or at a stop of 2 x ATR(20) ABOVE the entry (ATR of the 20 gold candles
before the entry; the stop is 1R; touched inside a candle it fills at the stop, a later candle opening beyond it fills at
that open). One position at a time. Every trade has a stop.

**Costs**: $0.60 a round trip. Financing per `council/fills.mjs`: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of
price a rollover, the demo broker's XAUUSD swap of 11 Nov 2026) x entry price on BUYS only; a sell pays nothing and is
credited nothing (the rule the Trader and every backtest here use). So the tested sells carry the spread only; the
every-day baseline is the same sell and carries the same. R = (entry - exit) / stop distance; net = gross minus costs in R.
At twice the costs the round trip doubles.

## Baseline, excess

Baseline = the same 5-day sell entered on EVERY gold candle of the same window (same side, stop and costs; overlapping
allowed). **Excess** = a trade's net R minus the baseline's mean net R of the window. This takes out gold's drift (a
falling-gold year makes every sell look good).

## Windows and statistics

In sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31 (signal date D in the window). t = mean / se of
the calendar-month sums of the excess (months by exit; every month of the window counts, an empty month is 0). One-sided
normal p of the out-of-sample month t, Holm over the three tests.

## Placebo and control

- **Placebo** (40 seeds, mulberry32 1-40): the same number of days drawn at random from every gold-tradeable index day of
  the out-of-sample window, traded the same way; the real T1 month t must beat at least 38 of the 40.
- **Control that keeps drift and volatility** (40 seeds, 101-140): every event day is replaced by a random NON-event index
  day of the SAME calendar month. Same months, so the same gold drift and volatility; the record-day information is
  removed. The real T1 out-of-sample excess must beat at least 38 of the 40 control excesses (each against the same
  baseline); the mean control excess is reported.

## Pass bar (T1 decides; T2, T3 are reported)

All of: T1 out-of-sample month t of the excess >= 2 with Holm p < 0.05; T1 in-sample excess > 0; T1 out-of-sample net R a
trade > 0 and excess > 0 at twice the costs; placebo beaten >= 38 of 40; control beaten >= 38 of 40. Else FAIL. A pass
would be a lead to replicate, never an edge.

## Deliverables

`run.mjs` (`fetch <dir>`, `count <dir>`, `full <dir>`), `result.json`, `RESULT.md`, `tests/gold-equity-record.test.mjs`.
