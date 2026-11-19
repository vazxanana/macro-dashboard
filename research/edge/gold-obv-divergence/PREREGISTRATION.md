# Pre-registration: gold's On-Balance-Volume divergence at a new 20-day closing extreme, both sides (14 Nov 2026)

Written and pushed ALONE before any result was computed. Nothing below changes after the run.

**Item 44**: a new stand-alone daily rule, judged on 2017-26. It is not a gate, exit, entry or size of the live gold book
(Gold trend / Gold daily engulf), reads none of its 2006-17 positions, is never read as one and says nothing about it. Paper
research only: nothing live changes, and a PASS would only be written up as a proposal for the owner (absolute rule 3).

## Dedupe
No committed or branch study computes On-Balance-Volume. Closest, read first: `gold-rsi-divergence` (price against a momentum
oscillator, not volume), `gold-volume-spike`, `volume-reversal`, `volume-premium` (the size of one day's volume, not a cumulative
signed flow), `gold-silver-divergence` and `gold-dollar-divergence` (against another market), `gold-daily-turtle-soup` (a failed
breakout of price itself). OBV divergence asks whether a new 20-day closing extreme that the signed volume flow does NOT confirm
reverses more often than one it does confirm. No remote branch has "obv" in its name, the 14 Nov untested backlog does not list
it, and the scratchpad topic list had no such slug when `gold-obv-divergence` was claimed.

## Data (one market, fixed now: spot gold only)
OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (`git show origin/council-data:research/daily/xau.json`, no
network; the copy is kept out of the repository). Column `v` is OANDA's count of price updates (not traded volume); it grows
over the years, which does not matter here because every comparison is between OBV values at most 20 days apart. Complete UTC
days; Saturday / Sunday candles folded into the next weekday with `council/fills.mjs` `foldWeekend`, their volume added to that
weekday's.

## Indicator, known at the close of each day
OBV(0) = 0; OBV(i) = OBV(i-1) + v(i) when close(i) > close(i-1), - v(i) when lower, unchanged when equal.

## Rule (N = 20 for T1 and T3, N = 40 for T2)
- **Bearish divergence on day i**: close(i) > every close of days i-N..i-1 (a new N-day closing high) AND OBV(i) < the highest
  OBV of days i-N..i-1 (the flow does not confirm). Signal: SELL.
- **Bullish divergence on day i**: close(i) < every close of days i-N..i-1 AND OBV(i) > the lowest OBV of days i-N..i-1. BUY.
- **Confirmed extreme** (for T3 only): the new N-day closing high with OBV(i) >= that highest OBV (or the new low with OBV(i) <=
  that lowest OBV). It is traded the same way as a divergence of that day (SELL at a new high, BUY at a new low).
- Entry at the open of day i+1. Stop fixed at 1.5 x ATR(14) from the entry (ATR = mean true range of days i-13..i), never moved.
  Exit at the stop (at the open when a day opens beyond it), else at the close of the 10th day held (the entry day is day 1).
  The stop is checked first on every day, including the entry day. Every trade has a stop.
- One position at a time per stream (a signal while a trade of that stream is open is skipped).
- **T1 (primary)**: N = 20, divergence trades, both sides pooled.
- **T2**: N = 40, divergence trades, both sides pooled.
- **T3 (signal against its own condition)**: N = 20, the per-trade OOS net R of the divergence trades minus that of the
  confirmed-extreme trades (each its own one-at-a-time stream), side-matched reversal in both; Welch t on per-trade net R. It
  asks whether the volume condition adds anything over fading any new 20-day extreme.
- Baselines (comparison, reported beside T1/T2, not part of the bar): unconditional same-side trades, BUY at every day's open and
  SELL at every day's open, the same 1.5 x ATR(14) stop and 10-day hold, one at a time. Each divergence side is compared with its
  same-side baseline (difference in net R a trade and Welch t).

## Costs, and the cost share of R (stated before the run)
$0.60 a round trip ($0.30 spread + $0.15 slippage on each market order). Buys pay financing: `council/fills.mjs`
`nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a 22:00 UTC rollover, Wednesday three; the demo broker's XAUUSD swap of
11 Nov 2026) x entry / risk. Sells pay and earn nothing. Today's rate for every year. 2x costs = both doubled.
Expected size: daily ATR(14) of gold was about $10-20 in 2007-16 and $15-60 in 2017-26, so a median stop of roughly $20-50 (over
the $10 required). The round trip is then about 0.015-0.03R; a buy held 10 trading days pays about 14 nights x 0.000148 x price
/ (1.5 ATR), about 0.08-0.12R. Total cost share expected at about 0.05-0.08R a trade averaged over both sides; measured and
reported (mean costR, finR and their sum on OOS trades).

## Windows
In sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31 (by entry date). OOS halves 2017-2021 and 2022-2026-10
reported.

## Statistics
t = mean / standard error of CALENDAR-MONTH sums of net R (every month of the window counts, 0 when nothing was entered; a trade
is dated by its entry). One-sided p from that t (normal). T3's p comes from its Welch t. Holm over the three tests (T1-T3).
Placebo (T1 and T2): 40 seeds (1..40); each keeps the test's own OOS trades (entry day, risk in dollars, exit day) and draws the
side at random (buy or sell, 50/50): stop fixed at entry -/+ the same risk, exit at that stop (gap at the open) or at the
original exit day's open; financing on buys. Statistic: OOS net R a trade.

## Pass bar (the verdict is T1's)
1. T1 OOS net R a trade > 0;
2. T1 OOS month t >= 2 AND Holm-adjusted one-sided p <= 0.0228;
3. T1 in-sample net R a trade > 0 (same sign);
4. T1 OOS net R a trade > 0 at 2x costs;
5. T1 OOS beats at least 38 of the 40 placebo draws.
PASS only if all five hold. T2 is judged by the same five checks, T3 by checks 1-3 on its difference (OOS > 0, Welch t >= 2 with
Holm, IS difference > 0); they are reported, and a T2 / T3 pass without T1 is "a lead for its own pre-registration", not a verdict.
The verdict line names the reason. Never called an edge without n and t.

## Deliverables
`run.mjs` (`fetch <dir>` copies the candles, `full <dir>` writes result.json), RESULT.md, result.json,
`tests/gold-obv-divergence.test.mjs` (hand-made candles: OBV, the divergence and confirmed conditions, no look-ahead, the trade,
costs and the report against result.json), and `out/` rebuilt.
