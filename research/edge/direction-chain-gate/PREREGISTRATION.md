# Timeframe-chain direction gate: pre-registration (23 Nov 2026)

Written before any trade of this study is computed and before any candle of a test window is read for it. Research only:
nothing live changes, no rule is proposed unless the owner asks. The idea (setups that follow the chain of timeframes do
better) comes from the owner looking at charts of 2026, and the neutral entry below was written today, so 2020-now is not
untouched for it: 2010-2019 is a replication it must also pass. Related earlier results, respected here and not repeated:
`ltf-structure` (agreeing with the LOWER timeframes' structure picked nothing, FAIL), `msnr-direction` (the external-break
call as a forecast, 0 of 6) and `msnr-entry` (that call as a gate on one gold engulf entry, FAIL). This study asks the other
question: does agreement of the HIGHER timeframes (Daily, H4, H1) gate a plain H1 entry, on five markets.

## The entry (the same for every stream, written once, not tuned)
- **Candles**: the toolkit cache (`research/edge/_lib/edgekit.mjs`, OANDA mid 5m); H1 and H4 by `resample` (UTC-aligned),
  the Daily by `dailyNY` (17:00 New York trading days). Closed candles only, everywhere.
- **H1 box** (`edgekit.boxesHL(H1, 3)`): the range between a confirmed swing low and swing high (3 candles a side), ended by
  the first H1 candle that CLOSES above its high (break up) or below its low (break down).
- **Signal**: a box break whose direction equals the H1 structure side (`edgekit.structure(H1, 3).side`) after the breaking
  candle has closed. A side of 0 gives no signal.
- **Order**: market, filled at the open of the first 5m candle after the breaking candle's close (`edgekit.simulate`).
  **Stop**: the box's far edge (the low for a buy, the high for a sell). **Target**: 2R. **Time exit**: 48 hours after the fill.
  Entries Monday to Friday only. **Size filter**: no trade when the stop is under 5 x the market's round-trip cost.
- One open position at a time per market and per stream, in order of fill time (each stream below applies it on its own list).

## The two gates (sides read at the breaking candle's close, from candles closed by then)
- **Gate A, plain chain**: the Daily and H4 structure sides (`edgekit.structure(bars, 3)` on each) equal the trade's side
  (H1 already does by construction). "Agree" = both equal; "disagree" = every other signal.
- **Gate B, the direction procedure**: on each of Daily, H4 and H1 a side changes ONLY on an external break after a tapped
  higher-timeframe key level, else it stays. Key levels of the timeframe above (Weekly for the Daily, built from the Daily
  candles, Monday weeks; Daily for H4; H4 for H1): its confirmed swing highs and lows (3 a side), and its two-candle engulf
  zones (the first candle of a pair whose second closes beyond the first's high for a buy zone / low for a sell zone, wick to
  wick, alive until a close through its far side), each usable once it is known. A **tap** = a working candle trading into a
  support level (swing low, buy zone) or a resistance level (swing high, sell zone). The side turns up when, within 20 working
  candles after a support tap, a candle closes above the last working-timeframe swing high confirmed BEFORE the tap candle
  (a sell mirrors it). The first side of each timeframe is 0 until its first such switch. "Agree" = all three sides equal the
  trade's side; "disagree" = every other signal.

## Markets, windows, costs
- Markets: xau, eurusd, gbpusd, usdjpy, audusd, pooled (each market also reported alone, no verdict).
- In sample 2020-01-01 to 2023-12-31; out of sample 2024-01-01 to 2026-11-13 (entries; the week the idea was named is left
  out). Replication 2010-01-01 to 2019-12-31. Warm-up candles before each window are read for structure only.
- Costs: `edgekit.COSTS` round trip, in R of each trade's own risk; gold buys also pay overnight financing by
  `council/fills.mjs` `nights` x `FIN.xau.long`. A second run at 2 x costs.

## Tests (Holm over these four out-of-sample p values)
1. **T1 (primary)**: the Gate A "agree" stream is profitable.
2. **T2**: Gate A "agree" beats "disagree" (difference of means, Welch t on trades, with the same sign on calendar-month sums).
3. **T3**: the Gate B "agree" stream is profitable.
4. **T4**: Gate B "agree" beats "disagree" (as T2).
Reported only, no verdict: the ungated stream, gated minus ungated, buys and sells apart, before costs, exits by reason, the
year table, each market alone.

## Statistic and pass bar
Mean R a trade after costs; t on calendar-month sums (by exit month); Holm-adjusted p. T1 / T3 PASS only if all hold: OOS mean
> 0; OOS month t >= 2 with Holm p < 0.05; IS mean > 0; OOS mean > 0 at 2 x costs; at least 30 OOS trades. T2 / T4 PASS only if
the OOS difference is > 0 with Welch t >= 2 and Holm p < 0.05, the month-sum difference > 0, the IS difference > 0, and both
streams have at least 30 OOS trades. A passing test whose 2010-2019 figure (mean for T1 / T3, difference for T2 / T4) is not > 0
is **INCONCLUSIVE**, not a pass.

**PASS** = at least one test passes with its replication. **FAIL** = no test passes. **INCONCLUSIVE** = a test meets the bar
but not its replication, or a stream has under 30 OOS trades. Nothing is tuned after a result (no other swing size, box, target,
hold, timeframe set or tap window); any change needs its own pre-registration on other data. Not an edge unless n and t say so.
