# Does the H1 dominant-zone limit survive a stricter fill? (pre-registration)

Written 23 Nov 2026, committed and pushed ALONE before any code of this study runs. Research only: nothing live changes,
nothing is placed, no council file is read.

## Why

`dom-zone-holdout` found the H1 dominant-zone limit (combo-grid-3 `buildZones('dom')`, no trigger, a limit at the zone's near
edge, stop past the far edge by half the round trip + 0.25 x ATR(14) of H1, 'zedge / zatr') at about +0.05R a trade before
costs on OANDA mid 5-minute candles, 2010-2019. `dom-placebo` then found a random recent same-colour candle body does better
(+0.080R). Both count a limit as FILLED as soon as a 5-minute mid candle reaches it (`multi`: `low <= entry`). The suspicion
tested here: a limit that is only touched often does not fill in a real order book (touch and go), and the touches that turn
at once are exactly the winners. If so, the tilt is a fill artefact.

## Data and trades (fixed)

- OANDA mid 5-minute candles from the edgekit cache, xau, eurusd, gbpusd, usdjpy, audusd; trades whose fill is in
  2010-01-01 .. 2019-12-31; H1 and the other frames from `frames(M5)`; quality exclusions of `combo-grid-3` `exclusions`.
- Signals: exactly the trade of `dom-placebo` `tradesOf` for the DOM zones: `signalsFor(F, '1h', '5m', 'dom')`, trigger NONE,
  the order from the start of the first touching 5-minute candle, alive 12 five-minute candles; entry = the zone's near edge;
  stop = far edge -/+ (COSTS/2 + 0.25 x ATR14 of the last closed H1 candle); the planned risk at least 2 x cost; a 2-day cap.
  A candle closing past the stop before a fill cancels the order (as `multi`). Costs: combo-grid-2 `COSTS`.
- Exits (unchanged from `multi`): trailing stop 1R behind the best price from +1R (primary) and a fixed 2R target (reported).
  On a limit's fill candle only the stop counts. Every trade has its stop on the losing side; a run that finds one that does
  not throws.

## Fill rules compared (same signals)

- F0 touch: a 5-minute candle whose low (buy) / high (sell) reaches the limit fills it (the grids' rule; must reproduce
  `dom-placebo`'s DOM stream exactly: same n and same R, else the study is void).
- F1 trade-through by 0.1 x ATR(14) of M5 (the ATR of the 5-minute candles closed before the order starts): the low must reach
  entry - 0.1 x ATR (buy). Fill price = the limit (or the open, when the candle opens beyond it).
- F2 trade-through by half the round trip (COSTS/2), same fill price rule.
- F3 (a conservative bound): the order fills only when a 5-minute candle CLOSES beyond the limit (below it for a buy); the
  fill is at the limit (or that candle's open when it opened beyond), managed from that candle as a limit fill.
- MKT (reported): a market entry at the CLOSE of the first touching candle (F0's fill candle), managed from the next candle,
  same stop; no trade when that close is already past the stop or the risk is under the cost.

## Tests (judged before costs; after costs reported beside)

- T1: F1, trailing exit, pooled: mean R a trade before costs > 0 AND month-sum t >= 2 in BOTH 2010-2014 and 2015-2019.
- T2: F2, the same.
- Each test's p = the larger of its two halves' one-sided month-sum p values; Holm over the two tests; a test passes when
  its two halves pass and its Holm p < 0.05. Verdict: PASS = both pass; FAIL = neither passes; INCONCLUSIVE = one passes.
- Reported, not tested: the share of F0 fills that F1 / F2 drop and those dropped trades' own F0 R; F3 and MKT; per market;
  the 2R exit.

## No look-ahead

The fill decision of each rule at a 5-minute candle depends only on that candle and earlier ones (a cut test in
`tests/dom-trade-through.test.mjs`: cutting or changing every candle after the fill leaves the fill unchanged).

Never call any result an edge without its n and t; this is a test of the fill assumption, not a trading rule.
