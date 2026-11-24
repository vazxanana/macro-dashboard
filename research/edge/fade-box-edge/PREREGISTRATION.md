# The box-close-out fade, made to pay its costs: three candidates on unread data (pre-registration)

Written 24 Nov 2026, committed and pushed ALONE before any run on sets D and E. Research only: nothing live reads it, nothing
is placed, no desk changes from it.

## Why

`fade-breaks-holdout` found one real before-cost effect: after an M5 box (swing low to swing high, 2 candles a side) closes
out, price comes back a little, so a market fade at the next 5-minute open wins about 53 % at 1R (+0.05R a trade before costs
on 2005-09, 2010-19 and 2020-26). It loses after costs everywhere, because the round trip (0.07-0.11R a trade on those small
M5 stops) is bigger than the bounce. The owner asked what is missing and to use the other strategies to complement it. This
study tests the three answers the discovery step points to, judged AFTER costs, on data the fade has never been run on.

## Discovery (already done; NOT evidence)

`discover.mjs` + `analyze.mjs`, on data the fade was already read on: five windows (2010-14 and 2015-19 on xau, eurusd,
gbpusd, usdjpy, audusd; fade-breaks-holdout set A = those markets 2005-09; set B = nzdusd, usdcad, usdchf, eurjpy, xag
2010-19; set C = the five markets 2020 to October 2026). Every faded box close-out of grid6-box-in-box (trigger `out`, chains
H4-H1-M15 and H1-M15-M5, any session), with its context at the decision, under stops of 1, 1.5 and 2 x the grid's distance and
exits 1R, 2R, trailing and the box middle, crossed with 21 conditions and their pairs: 6,096 cells (`discovery.json`). What it
showed, after costs:

1. **Timeframe**: the M5 fade (H1-M15-M5) loses after costs in every variant (-0.01R to -0.07R a trade). One step up, the
   M15 box close-out (H4-H1-M15 chain), costs about half as much in R and sits near zero.
2. **Exit**: a trailing stop (1R behind the best price from +1R) beats 1R, 2R and the box middle.
3. **Complements** (from the other strategies): a stop at least 8 round trips wide (`rc8`), price still inside the H1 box
   (`topIn`, the box-in-box reading), a choppy H1 (20-candle efficiency ratio under 0.3, `er30`, the market-cycle reading).
   13 of 6,096 cells were positive after costs in all five windows; their weakest window's month t was 0.02 to 0.35. That is
   faint, and picked from many: hence this test.

## The three candidates (exact; nothing tuned after this file)

Common to all: the signal is grid6-box-in-box's `signals()` unchanged, chain **H4-H1-M15** (`ch` 1), trigger **out** (the M15
box from swing low to swing high, 2 candles a side, closes out WITH the last H4 box close-out side), any session. The trade is
the FADE: against the close-out, market at the open of the first 5-minute candle at or after the M15 close-out candle closes.
The grid's distance `dist` = from the close-out close to the M15 box's other side plus half the round trip (signals with dist
under 2 round trips are skipped, as in the grid). Stop = the close-out close + k x dist beyond it (on the side the close-out
broke). Exit **trailing**: the stop moves to 1R behind the best price once +1R is reached (grid6-box-in-box `trade()` /
dom-trade-through `manage()`, slot `trail`); out at the close of the first 5-minute candle ending 2 days after the fill.
A trade whose filled risk is under one round trip is skipped. Data-quality exclusions dropped. Code: `discover.mjs` (rows) and
`report.mjs` (the bar).

- **E1**: k = 1; only when the filled risk is at least 8 round trips (`rc` >= 8) AND the M15 close-out candle closed inside
  the last H4 box (`topPos` = inside).
- **E2**: k = 2; only when `rc` >= 8 (risk at k = 1) AND the H1 20-candle efficiency ratio at the last closed H1 candle is
  under 0.30.
- **E3**: k = 2; no condition (the plain M15 fade with a wide stop and the trailing exit: does the timeframe step alone pay?).

## Data (OANDA mid 5-minute candles, edgekit cache; never read by any fade study)

- **Set D**: nzdusd, usdcad, usdchf, eurjpy, xag, fills 2005-01-01 to 2009-12-31 (2004 warm-up; silver from 2006).
- **Set E**: the same five markets, fills 2020-01-01 to 2026-10-31 (2019 warm-up).
Round-trip costs: combo-grid-2 `COSTS` for these markets are ASSUMED (not measured on the demo account): nzdusd, usdcad,
usdchf 0.00007, eurjpy 0.010, xag 0.03.

## The bar (AFTER costs; before-cost figures beside)

- Per candidate and set, pooled: n, mean R a trade after costs (cost / risk off each trade), calendar-month sums over every
  month of the set (empty months 0), month-sum t and its one-sided p.
- **Primary tests**: 3 candidates x sets D and E = 6. A test passes when n >= 100, mean R after costs > 0, month t >= 2 and
  the Holm-adjusted one-sided p over the 6 is under 0.05. **A candidate passes when it passes on D AND on E.**
- **Verdict**: PASS = at least one candidate passes on D and E. INCONCLUSIVE = none does, but one passes on exactly one set.
  FAIL = none passes on either.
- Beside: per-market rows; the same candidates before costs; at 2 x costs; a cut test (the signals known a day before a cut
  are the same when the candles stop at the cut).

A PASS would be a candidate for a forward paper record on the cTrader demo, never an edge by itself (costs on these markets are
assumed). No threshold, condition or rule changes after this file is pushed.
