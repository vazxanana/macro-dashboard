# Pre-registration: RSI divergence at gold's swing highs and lows, both sides (14 Nov 2026)

Written and pushed alone, before any trade of this study is computed.

## Question
When spot gold makes a new swing high (low) on H4 while its 14-period RSI makes a lower high (higher low), a "momentum
divergence" in the chart-reading literature, does price then reverse often enough to pay for a 2R reversal trade after costs?
The rule trades both sides with the same levels, so a pure upward drift of gold cannot carry it: half of the signals are sells.

## Scope (owner decision 44)
A **new stand-alone rule**. It is not a gate, exit, entry or size of the live gold book (Gold trend + Gold daily engulf), it
reads none of that book's positions and none of its signals. Paper research only: nothing live changes whatever the verdict; a
PASS would at most be a proposal to the owner.

## Why it is not a duplicate
No study under `research/edge/` or on a remote branch defines a signal from a disagreement between price swings and an
oscillator. Nearest: `metals-rsi2`, `rsi2-*` (RSI(2) level pullbacks, no swing comparison); `gold-dollar-divergence`,
`gold-silver-divergence` (gold against ANOTHER market); `gold-daily-turtle-soup`, `gold-key-reversal`, `gold-h4-pinbar`
(reversal from a candle pattern at a level, no oscillator); `gold-macd`, `gold-adx-trend` (oscillator as a trend follower);
`gold-hourly-shock`, `gold-shock-revert` (reversal after one large candle).

## Data
OANDA mid H1 XAU_USD (`[t, o, h, l, c]`, UTC hour start), the cache built for this desk's gold research through the site's
candle proxy, March 2006 to November 2026 (kept out of git; `run.mjs` takes its path). No other price data. H1 candles whose UTC
date is a Sunday (the 1-2 hour reopen stub) are dropped before anything is built. H4 candles = the H1 candles grouped by UTC
4-hour bucket (00, 04, 08, 12, 16, 20), open of the first, close of the last, high / low over all. Candles before 2007 are
warm-up only.

## Indicators (each value at bar i uses bars <= i only)
- RSI(14), Wilder smoothing, on closes. ATR(14), Wilder, on true range.
- **Pivot high** at bar j: high(j) > every high of bars j-3..j-1 and high(j) >= every high of bars j+1..j+3. Known only at the
  close of bar j+3 (its confirmation bar). Pivot low mirrors it.

## Signal
At the confirmation bar c = j+3 of a pivot high P2 = j: P1 = the most recent earlier pivot high k with 5 <= j - k <= 60 bars.
**Bearish divergence** when high(j) > high(k) AND RSI(j) < RSI(k) AND RSI(k) >= 60. Mirror (**bullish divergence**): pivot low
j, earlier pivot low k in the same distance range, low(j) < low(k) AND RSI(j) > RSI(k) AND RSI(k) <= 40.

## Trade (one position at a time per test; a signal while a position is open is skipped)
- Entry at the open E of bar c+1: a sell after a bearish divergence, a buy after a bullish one.
- Stop: sell high(j) + 0.25 x ATR(c); buy low(j) - 0.25 x ATR(c). Skipped (counted) when the stop is not on the losing side of E
  or 1R = |E - stop| is under $0.50.
- Target: E -/+ 2R. Time exit: close of the 30th bar counted from the entry bar.
- From the entry bar on: a stop gapped through at the open fills at the open; a stop touched fills at the stop; the target
  touched fills at the target; **stop and target in one bar = the stop**.
- R = (exit - E) x side / 1R. **Costs**: $0.60 a round trip; buys also pay `council/fills.mjs` `FIN.xau.long` (0.000148 of price
  a rollover, the demo broker's XAUUSD swap of 11 Nov 2026) x `nights(entry, exit)` x E, in R; sells are credited nothing.
  **2x costs**: $1.20 and twice the financing.

## Tests (3, Holm over all three)
- **T1 (primary)**: the rule above on H4.
- **T2**: the same rule on H1 candles (the same numbers in bars: pivots 3 a side, P1 5-60 bars back, 30-bar exit).
- **T3**: T1 with the stricter oscillator condition RSI(k) >= 70 (sell) / <= 30 (buy), its own one-at-a-time stream.

## Windows
In sample (IS) 2007-01-01 to 2016-12-31; out of sample (OOS) 2017-01-01 to 2026-10-31 (later candles unused). A trade belongs
to the window of its entry.

## Statistics
- t = one-sample t of the CALENDAR-MONTH sums of net R (months with at least one trade), per test and window.
- Holm over the 3 tests on the OOS one-sided p (normal approximation of the month t).
- **Placebo**, 40 seeds (mulberry32, seeds 1..40), per test: every OOS trade of the test is moved to a bar drawn at random
  (without replacement within a seed) from the OOS bars of the same timeframe, keeping its side and its stop distance in ATR
  units (1R / ATR at its signal); the same target, exit and costs, run one position at a time. Statistic: OOS net R a trade.
  "Beats" = the rule's OOS net R a trade above that seed's. This keeps the buy / sell mix, so gold's drift is in the placebo too.
- Also reported: by side (buys, sells), by year, OOS halves 2017-21 / 2022-26.

## Pass (all must hold, per test)
1. OOS net R a trade > 0;
2. OOS month t >= 2 AND Holm p <= 0.05;
3. IS net R a trade > 0 (same sign in sample);
4. OOS net R a trade > 0 at 2x costs;
5. beats at least 38 of the 40 placebo seeds;
6. OOS n >= 30.

**Verdict**: PASS only if T1 passes. T2 or T3 passing alone is reported as "partial, not the primary" and proposes nothing.
Whatever the verdict, nothing live changes; a PASS would be written up as a proposal for the owner only.
