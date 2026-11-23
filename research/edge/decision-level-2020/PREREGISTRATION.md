# Decision Level after the Daily close, 18 markets, 2020 to now (pre-registration)

Written 23 Nov 2026, before any code or run of this study. The owner's notes rank this entry among the better ones they
tested on gold (a profit factor near 1.2 on about a dozen trades a year, 2012-2026, a broad version near 1.03-1.09) and say
the same entry taken BEFORE the Daily candle closed lost money. This study writes the rule down in this repository's own
words and tests it once on 18 markets, 2020 to now, after costs. Research only: nothing live changes.

## Words used here

- **Trading day**: 17:00 New York to 17:00 New York (`edgekit.dailyNY` on OANDA mid 5-minute candles; weekend candles
  folded into Monday). **H4**: UTC-aligned four-hour candles built from the same 5-minute candles.
- **Daily key level**: for every two consecutive closed trading days, the CLOSE of the first one. Every pair makes a level
  (whatever the colours). It exists from the close of the second day of the pair.
- **Fresh / used**: from the third day after its pair, each closed trading day updates a level in time order. A day whose
  BODY (open to close) reaches the level makes it fresh again. A day that reaches it with a wick only (body wholly on one
  side, the wick touching or crossing it) is a USE when the level was fresh, and leaves it unfresh. A level is retired after
  4 uses. Only levels whose pair started within the last 120 trading days are considered.
- **Daily rejection (buy)**: day j wicks a fresh Daily level L that has fewer than 4 uses (low <= L) while its whole body
  stays above it (min(open, close) > L). A sell mirrors it (high >= L, max(open, close) < L). It is known only at day j's
  close. If several levels are rejected the same day on the same side, the one the day touched first is used (the highest
  for a buy, the lowest for a sell). Buy and sell rejections of one day are separate events.
- **The touch**: the first 5-minute candle of day j whose low reaches L (high for a sell). The **touch H4 candle** is the
  H4 candle holding that moment.
- **Approach gap (H4)**: two consecutive closed H4 candles of the approach's colour (both bearish for a buy, both bullish for
  a sell); the gap level G is the close of the first one. It must lie on the far side of L (G > L for a buy), and its second
  candle must close no later than the touch H4 candle and no earlier than 11 H4 candles before it (12 candles in all).
- **The Decision Level**: the newest such approach gap (the newer replaces the older).
- **Broken**: the first H4 candle, at or after the touch H4 candle and after the pair, that CLOSES beyond G in the trade's
  direction (above G for a buy). It must close by the end of trading day j+1.

## T1, the strict version (tested)

1. A Daily rejection on day j as above.
2. Its Decision Level G, untouched until it breaks: no H4 candle after the pair and before the breaking candle traded to G
   (high >= G for a buy). The breaking candle must be at or after the touch H4 candle.
3. G broken by the end of day j+1.
4. **Order**: a buy limit at G (sell limit for a sell), placed at the later of the close of day j and the close of the
   breaking H4 candle. Stop: beyond the reversal extreme = the lowest low (highest high for a sell) of the 5-minute candles
   from the touch to the placement, plus half the round-trip cost. Target 2R from the fill. The order expires at the close of
   trading day j+2. A trade is closed after 7 calendar days at the close of the 5-minute candle that reaches it. The stop
   distance must be at least twice the round-trip cost, else no order.
5. One trade per rejection event. Fills, stops and targets are read on 5-minute candles with `edgekit.simulate` rules: a
   limit fills only on a candle starting at or after the placement that trades to it (at the open when it opens beyond the
   entry); on the fill candle only the stop can be hit; a candle that holds both stop and target is a stop; an open beyond
   the stop or target exits at that open.

## T2, the broad version (tested)

The same rejection and the same order rules, with three changes:
- every approach gap in the 12-candle window that breaks (each its own order), not only the newest, and no "untouched"
  condition;
- the order lives to the close of trading day j+5;
- after a trade on a gap ends at its target or by time, a new limit at the same gap is placed at that exit moment (the next
  retest), with the stop again beyond the lowest low (highest high) from the touch to the new placement; after a stop-out
  that gap is finished.

## Control C, entered before the Daily close (descriptive only, not tested)

The same level, touch, approach gap (T1 rules), break and order, but the order is placed at the close of the breaking H4
candle, which must come BEFORE day j closes, without knowing how the day will close. The day only has to open on the
level's right side (above it for a buy) and touch it. Reported overall, and split by whether day j did close as a rejection
of that level (the split uses the close, so it is a label, never a rule).

## Markets, costs, windows

18 markets pooled: xau, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy, xag, gbpjpy, eurgbp, audjpy, cadjpy,
euraud, nas100, spx500, de40 (the last eight have candles from 2019 only). Candles are loaded from 2019-01-01 so levels and
rejections can form; trades count when filled from 2020-01-01 to the last candle. Round trips in price units from
`research/edge/combo-grid-2/run.mjs` COSTS (several of them assumed, not measured). A trade whose fill falls in a bad
interval of `research/edge/data-quality/quality.json` is dropped. Gold is reported alone too (not a separate test).

Discovery: fills 2020-01-01 to 2023-12-31. Confirmation: fills 2024-01-01 to now. R after costs = R - cost / risk.

## The bar

A version PASSES only if, pooled: discovery n >= 100, mean R after costs > 0, month-sum t >= 2; confirmation n >= 50,
mean R > 0, month-sum t >= 2 with a one-sided Holm-adjusted p < 0.05 over the two tests (T1, T2); and the confirmation
mean R stays positive at twice the cost. Month-sum t = the t of calendar-month sums of R by fill month (empty months 0).
Verdict: PASS if T1 or T2 passes; INCONCLUSIVE if neither passes and a version falls short only on n; FAIL otherwise.

Reported, labelled descriptive: the same trades with 1R, 3R and 4R targets; per-market rows; gold alone; win rate; profit
factor; Control C and its split.

## Checks

- No look-ahead: everything an order uses is closed by its placement. A cut test rebuilds the gold orders on candles cut at
  a date and requires every order placed before the cut to be identical.
- Every trade has its stop on the losing side of its entry.

## Honest limits

2020-2026 has been read by many studies of this repository (none of them this rule). A PASS here is a hypothesis for a
forward record, not an edge. Weekly levels, the H1 / M30 refinement and the use rule for the H4 gap (wicked once is fine,
more than twice take the next level) are not written; the owner's 2012-2026 test used another feed and its own coding.
