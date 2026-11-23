# vb-retest-limit: the volatility breakout entered on a limit at the retest (pre-registration, 23 Nov 2026)

Paper research only. Written and pushed alone, before any candle of this study is run through the variants. Nothing live
changes whatever the result.

## Question

The two rules of the repository that pass on untouched data are the volatility breakout T1 on gold and on USD/JPY (buy STOP at
the UTC day's open O + 0.5 x the previous day's range, sell STOP at O − 0.5 x it, stop back at O, out at the 20:55 UTC candle's
close). Separately, the 23 Nov dominant-zone studies found a before-cost tilt for a resting LIMIT order near the market on mid
candles. Does entering the breakout on a LIMIT at the breakout level AFTER it was first broken (a retest), instead of the stop
order, improve the R of a signal day?

## Years read before

Neither market's 2010-2019 is untouched by the rule itself: gold 2007-2015 was read by `gold-vol-breakout-replicate` (and
`-costs`, `-hourcost`) and 2016-2026 by `gold-vol-breakout`; USD/JPY 2005-2015 by `usdjpy-vol-breakout-early` (plus `-k`, `-exit`)
and 2016-2026 by `fx-vol-breakout`. The VARIANTS below were never computed on any year. So this tests the entry change on years
where V0 is in sample; 2020 → now is reported beside it, also in sample, and judges nothing.

## Rule pieces (imported, never edited)

- Days, levels, the touch, V0: `research/edge/gold-vol-breakout-hourcost/original.mjs` (`buildDays`, `daySkip`, `vbTrade`, k 0.5,
  both sides; the same file as `index-vol-breakout/original.mjs`), loaded through `gold-vol-breakout-hourcost/costs.mjs` `daysOf`
  (sorts, drops the forming last day, folds weekends with `council/fills.mjs` `foldWeekend`).
- Candles: OANDA mid M5 XAU/USD and USD/JPY through the site's candle proxy (`research/edge/_lib/fetch-cache.mjs`,
  `$EDGE_DATA/<market>/5m-<year>.json.gz`, out of git), 2009 → now (2009 only feeds the first previous ranges).

## Signal day and the three entries

A signal day = a tradable day (`daySkip` null) on which V0 fills: the first M5 candle i whose high reaches `up` or whose low
reaches `dn` (vbTrade's rule; both in one candle: the level nearer the candle's open). Its side s (+1 buy at `up`, −1 sell at
`dn`) is V0's side. The stop is O for every variant. Out at the close of the last candle before 21:00 UTC.

- **V0**: the rule as published (`vbTrade`): stop entry at the level, or the candle's open if it gapped through; worst case in
  the fill candle.
- **V1**: from candle i+1 (never in the touch candle: the order of prices inside it is unknown) a LIMIT at the level L = `up`
  (buy) / `dn` (sell) rests until 20:55. It fills on the first later candle that trades back to L (buy: low <= L; sell: high
  >= L), at L, or at the candle's open when the open is already beyond L on the favourable side (buy: open < L). If price first
  reaches the stop O before the limit fills (buy: a candle's low <= O while the limit has not filled), the order is cancelled.
  A candle that OPENS at or beyond O (buy: open <= O) cancels it too (no fill on the losing side of the stop). In the fill
  candle, if its low (buy) also reaches O, the trade is stopped in that candle (worst case; when the open is above L, price must
  pass L before O). Then the position is walked like V0 (stop at O, a gap through the stop exits at the open, else 20:55 close).
- **V2**: as V1 with the limit deeper: L = `up` − 0.1 x prevRange (buy), `dn` + 0.1 x prevRange (sell); stop O, so the risk
  is 0.4 x prevRange.
- A V1 / V2 order that never fills is no trade: 0 R on that signal day.

Every trade has its stop on the losing side of its entry (the cancel rules guarantee it; the code refuses a trade otherwise).
No look-ahead: an order exists only from the candle after the touch, and each candle is read open, then range, then close.

## Costs (the published studies' own models; costs judge nothing here, they are reported)

- Gold: `gold-vol-breakout-hourcost`'s condition C1 = half the demo's median quoted spread of the fill hour + half of hour 20 +
  the commission (its committed result.json `profile` and `commission`), as a share of the entry, + 0.05 x M (M = `costs.mjs`
  `medRange` of the fill candle). The same charge for limit fills (no entry slippage credit), financing by `council/fills.mjs`
  `nights` x `FIN.xau.long` on buys (zero for intraday holds).
- USD/JPY: `fx-vol-breakout` `costPx` = 0.000045 x entry + 0.5 pip a round trip.

## Tests (four, Holm)

Per market m and variant v in {V1, V2}: per signal day d = R_v (gross, 0 if no fill) − R_V0 (gross). Statistic: the t of the
calendar-month SUMS of d over 2010-01-01 → 2019-12-31 (as `original.mjs` `monthT`); p = one-sided normal p of that t
(`normP`). Holm over the four p values.

- **T1** = V1 minus V0 (gold, USD/JPY); **T2** = V2 minus V0 (gold, USD/JPY).
- A test PASSES when its month t >= 2, its Holm p < 0.05, and the mean d per signal day is above 0 in both halves 2010-2014
  and 2015-2019.
- Verdict: PASS if at least one test passes; FAIL if none passes; INCONCLUSIVE if any market has under 500 signal days in
  2010-2019 (not expected).

## Reported, judging nothing

Fill rates of V1 / V2 (share of signal days), R a trade of filled trades before and after costs, per signal day before and after
costs, the paired difference after costs, cancels by the stop, and the same table for 2020-01-01 → now (in sample).

## What a PASS would and would not mean

A PASS says the retest limit improved the signal day's R on years where the rule itself was already read; a candidate for its
own forward record next to the running breakout records, never a live change without the owner. A FAIL leaves both breakouts
as they are.
