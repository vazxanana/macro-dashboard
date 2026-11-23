# The fade over time: mark-to-market and time exits (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/grid7-wide-fade` found that fading the first structure break at market has a small tilt before costs in both
2005-14 and 2015-26 on ten markets (for example **m15 none atr 2R all**: +0.054R / +0.042R a trade, month t 11.4 / 11.3), and
`research/edge/fade-new-markets` found it again on eight new markets and on HistData. After costs every cell loses. This study
asks WHEN the tilt is made: if most of it comes in the first minutes or hours, a time exit might keep it with a shorter hold;
and in pips / dollars, how big the move is beside the spread. It does not choose new entries: the entry is the grid's.

## The rule (unchanged from grid7-wide-fade, cell **m15 none atr**)

Imported unchanged from `grid7-wide-fade/run.mjs` (`signals`, `exits`, `CAP`), with `combo-grid-3` `frames`,
`dom-trade-through` `atr14` / `startIdx`, `grid7-wide-core` `MARKETS`, `ASSUMED`, `FROM`, `SPLIT`, `TO`, `NM`, `DM`, `monthOf`,
`mstat`, `p1`, `combo-grid-2` `COSTS` / `exclusions`. In words: the break = a close beyond the last confirmed swing on M15
(`edgekit` `structure`, 3 candles a side), context "none" (every break), FADED: side s = -d, market entry at the open of the
first 5-minute candle starting at or after the break candle's close. Stop = the grid's "atr" stop: 1 x ATR(14) of M15 at the
break candle, measured from the fill, on the losing side (the grid's atr stop carries no further buffer; the 0.1 ATR buffer
belongs to its "ext" stop, not used here). A fill at or past the stop, and a risk under the market's round-trip cost, are no
trade (the grid's rules); fills inside the data-quality exclusions are dropped. Trades overlap freely.

## What is recorded per trade

- **Marks** at X = 5, 15, 30, 60, 120, 240 minutes and 1 day (1,440 minutes) after the fill time: the open of the first
  5-minute candle starting at or after fill + X (clock time; over a weekend that is the reopen). R = s x (that open - fill) /
  risk, **stop first**: if any 5-minute candle from the fill candle up to the one before the mark candle reached the stop, the
  mark is the stop's R (-1R; worse if a candle opened beyond the stop, the grid's gap rule). Only candles that end by fill + X
  decide a stop; of the mark candle only its open is read.
- **Time exits** at 15, 30, 60 and 240 minutes: exactly the marks above (close at that 5-minute open, the stop before it). No
  target is used in a time exit.
- **The grid's exits** beside: 2R and swing (the grid's `exits`, unchanged: stop first in a candle that holds both, 1-day time
  limit for M15).
- A trade counts only when every mark and the 2R exit resolve on the data (the swing exit may be absent, as in the grid).
- **Gross move** at every mark in price units and pips (pip = 0.1 for gold, i.e. 10 cents, also shown in dollars; 0.01 for silver
  and the yen pairs; 0.0001 for the other pairs), and the mean risk in pips, beside the market's round-trip cost in pips.

## Windows

By fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31** (142 months),
month sums over every calendar month, an empty month as 0 (the grid's `mstat`).

## The bar (primary: the four time exits of m15 none atr, judged BEFORE costs)

A time exit passes when ALL hold:
1. n >= 300 trades in each window;
2. mean R > 0 and month-sum t >= 2 in discovery;
3. mean R > 0 and month-sum t >= 2 in confirmation;
4. Holm-adjusted one-sided p < 0.05 over the 4 confirmation tests (p from the month-sum t, df = months - 1).

Verdict: **PASS** if one time exit or more passes; **FAIL** otherwise. INCONCLUSIVE only if fewer than 8 of the 10 markets load.

## Secondary (reported, not part of the bar)

- Each time exit against the grid's 2R exit, paired by trade: the month sums of (time-exit R - 2R R), mean and month t in both
  windows. Also against the swing exit on the trades that have one.
- The curve: mean R and month t at every mark, both windows, for m15 and also for **m5 none atr** and **h1 none atr**
  (descriptive only).
- After costs beside every figure: R less (round-trip cost / risk), `combo-grid-2` `COSTS` (the demo figures for gold and the
  four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).
- Per-market rows for any passing time exit; the gross move per market in pips at every mark beside the cost in pips.
- Cut test: the grid's signal cut test on two markets, and the marks recomputed on candles cut at each mark's time equal the
  full run's on a sample of trades.

## What a result means

A pass is a before-cost tilt in both decades at a fixed holding time, nothing more: if the move in pips is smaller than the
spread it is not tradable and is said so. Never called an edge, not adopted, no live change. One run, no variants.
