# Pre-registration: the ICT "optimal trade entry" retracement limit on gold (14 Nov 2026)

Written and pushed alone, before any trade of this rule is computed.

## Question
After a displacement leg that breaks structure, does a limit order at the 0.62-0.79 retracement of that leg (ICT's "optimal trade
entry", taken here at its middle, 0.705) make money on gold, net of costs?

**This is a stand-alone rule.** It is never a gate, exit, entry or size of the live gold book (Gold trend, Gold daily engulf), and
it does not touch that book's 2006-17 window (path to live, docs/owner-decisions.md item 44). Nothing live changes whatever the
result; a PASS would only be a proposal to the owner.

## Dedupe (done before writing this)
No study on `main` or on any remote branch tests a fibonacci-retracement limit after a structure break. Closest:
`mosha-retrace` (limit at the broken H1 level, not a fraction of the leg; FAIL), `mosha-cycle` (FAIL), `ict-concepts` (turtle
soup, liquidity-based highs / lows, NWOG / NDOG gaps; no retracement entry), `rsi2-pullback` (an oscillator pullback, no leg),
`gold-drd-long` (a daily close rule).

## Data
OANDA mid M5 XAU/USD from 2015-12-01 to the last complete candle of 13 Nov 2026 (776,427 candles, no gap over 4 days), read from
the site's candle proxy (`/md/bars`) and cached outside git. H1 candles = M5 candles grouped by UTC hour (open of the first, close
of the last, high / low over the hour). D1 candles = UTC days, a Saturday or Sunday candle folded into the following Monday
(`council/fills.mjs` `foldWeekend`). December 2015 serves only to warm up ATR and swings; no signal before 2016-01-01.

## Rule (one direction is described; the other mirrors it)
- **Swings**: an H1 swing high at candle i = its high is strictly above the highs of the 3 candles before and the 3 after; it is
  known only from the close of candle i+3 (no look-ahead). Swing lows mirror.
- **Impulse (bullish)**: candle j closes above the most recent confirmed swing high (confirmed at or before candle j-1) that no
  earlier close has broken; each swing is broken once. Origin = the lowest low of candles i+1..j (the leg's start after that swing
  high); extreme = high of candle j; leg = extreme - origin. The impulse counts only if leg >= 1.5 x ATR(14) of H1 (Wilder,
  through candle j).
- **Entry**: a buy limit at extreme - 0.705 x leg, placed at the close of candle j, valid for the next 24 H1 candles. Fills are
  checked on the M5 candles inside each H1 candle: filled when an M5 low reaches the limit, at the limit, or at that M5 candle's
  open if it opens below the limit. An order is cancelled unfilled if an M5 candle opens at or below the stop before the fill.
- **Stop**: origin - $0.30 (the 1.0 level plus $0.30). Always below a buy's entry (sells: above).
- **Targets** (three tests):
  - **T1** target = the extreme (the 0.0 level). **Primary test.**
  - **T2** target = extreme + 0.27 x leg (the -0.27 extension).
  - **T3** = T1, taken only when the last completed D1 close before candle j is above its 50-day simple average (longs) / below
    it (shorts). An impulse before 50 completed days exist gives no T3 signal.
- **Management**: checked on M5 from the M5 candle after the fill (in the fill candle itself only the stop is checked). Stop and
  target inside one M5 candle = the stop. A stop gapped through fills at that M5 open; a target fills at the target. Out at the
  close of the 72nd H1 candle counted from the fill candle (the fill candle is the first).
- **One position at a time per test**: while a test has an order pending or a position open, its new impulses are ignored. Each
  test runs as its own stream; signals are evaluated in time order. Both sides trade.

## Costs
$0.60 a round trip on every trade, plus overnight financing on buys: `nights(fill, exit)` x `FIN.xau.long` (0.000148 of price a
rollover, the cTrader demo XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry / risk. Sells are charged and credited nothing.
R = (exit - entry) / (entry - stop) for a buy, mirrored for a sell; net R = R - 0.60 / risk - financing.

## Windows and statistics
- In sample: fills in 2016-01-01 to 2020-12-31. Out of sample: fills from 2021-01-01 to the end of the data.
- t = mean / (sd / sqrt(m)) over the calendar-month sums of net R by fill month, every month of the window counted (a month with
  no trade is 0). One-sided p from the normal approximation; Holm over the three tests on the out-of-sample p.
- **Placebo**: 40 seeded draws (seed 1..40). Each keeps every filled trade of that test's stream (same fill time and entry price,
  same stop and target distances) and gives it a random side (probability 1/2), levels mirrored around the entry, managed and
  costed the same way. Compared on out-of-sample mean net R a trade.
- **2x costs**: $1.20 a round trip and twice the financing.

## Pass bar (per test; all must hold)
1. Out-of-sample mean net R a trade > 0;
2. out-of-sample month t >= 2 after Holm (Holm-adjusted one-sided p <= 0.02275, the p of t = 2);
3. in-sample mean net R a trade > 0 (positive in both halves);
4. out-of-sample mean net R > 0 at 2x costs;
5. out-of-sample mean beats at least 38 of the 40 placebo draws;
6. out-of-sample n >= 30.

**Verdict**: PASS if any test passes all six (T1 is the primary; Holm covers the three); else FAIL. Reported but not tested: gross
R, year by year, win rate, profit factor, worst drawdown, by side, and how many impulses were ignored, cancelled or never filled.
