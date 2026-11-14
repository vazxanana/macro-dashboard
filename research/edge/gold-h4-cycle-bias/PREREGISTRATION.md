# Pre-registration: the H4 market cycle as a stand-alone directional bias on gold (14 Nov 2026)

Written and pushed alone, before any return was computed. Only event counts were read first (below). Paper research. A
stand-alone rule: never a gate, exit, entry or size of the live gold book, and the book's 2006-17 positions are not used
(owner item 44). Nothing live changes, whatever the result.

## Why this is not a repeat

The owner's market-cycle idea ("H4 tells the move, the H1 ChoCh tells the pullback started, trade when it ends") was tested
as an ENTRY rule with a small stop many times and failed every time: `mosha-retrace` (+0.02R), `mosha-cycle` (−0.22R),
`mcycle-base` (−0.574R), `cycle-gate` (as a gate on 11 systems), `gold-h4-pullback-resume` (#1066, −0.161R net, stops a few
dollars away), `gold-vol-breakout-h4-side` (#1067), the three-timeframe EMA alignment (#1081), and on indices, forex, crypto
and commodities. In all of them the stop sat a few dollars from the entry, so the $0.60 cost took 0.1-0.2R a trade and the
question "does the cycle point the right way?" was mixed with "does a tight stop survive the noise?".

Here the question is only the direction: after the H1 pullback inside an H4 move ends, does gold move further the H4 way
over the next New York day than it does from an ordinary hour? A wide stop (2 x the daily ATR, a disaster stop, rarely hit),
a fixed hold to the next 17:00 New York close, and the result judged as an EXCESS over entering on every hour of the same side
with the same exit and stop. Gold's drift and the cost structure are in the baseline, so only the signal's timing is measured.

## Data

OANDA mid H1 XAU/USD from the site's candle proxy (`/md/bars`), the same file `gold-h4-pullback-resume` used: 125,704 candles,
19 Mar 2006 to 13 Nov 2026, kept out of git. H4 candles and New York days are built from it: H4 blocks start at 17, 21, 01,
05, 09, 13 New York time, a New York day runs 17:00 to 17:00 (`council/histdata.mjs` `nyOffsetH`, daylight saving correct).
Market set: gold only (XAU/USD). No other market is read.

## The rule (one, frozen)

1. **Swings**: on a series of candles, a swing high is a candle whose high is above the highs of the 3 candles on each side;
   it is known only once the third candle after it has closed (likewise swing lows).
2. **Structure state**: +1 after a candle CLOSES above the last known swing high, −1 after a close below the last known swing
   low; each swing level is broken once; the state holds until the opposite break. Computed on H4 and on H1 separately.
3. **H4 bias** at an H1 close = the H4 state from the H4 candles closed by then; the time it last flipped is remembered.
4. **Pullback ended (signal)**: H4 state +1, the H1 state flipped to −1 AFTER the H4 state was last set to +1 (the H1
   pullback), and now an H1 close flips the H1 state back to +1 (first H1 close above the last known H1 swing high after
   the H1 break down) → BUY. Mirror for sells. One signal per pullback.
5. **Trade**: entry at the next H1 open; exit at the close of the NEXT New York day (the 17:00 New York close of the day after
   the entry's day; 24 to 47 hours); stop 2 x ATR(14) of the complete New York days before the entry's day (simple mean of
   true ranges), checked on H1 candles, a candle opening through the stop fills at its open. No target. One position at a
   time per test (a signal while a position is open is skipped).
6. **R** = side x (exit − entry) / (2 x ATR). **Costs**: $0.60 a round trip (0.30 spread + 0.15 slippage a side) divided by
   the risk, plus financing on buys = `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's
   XAUUSD long swap, `council/fills.mjs`) x entry / risk. Sells are credited nothing.

## Baselines and tests (three, Holm over the three)

- **Baseline A**: every H1 open of the sample, bought AND sold separately, with the same exit and stop rule; mean net R by
  side and calendar year. Excess of an event = its net R minus Baseline A for its side and year.
- **Baseline B**: the same, also split by the H4 state at the hour before entry (−1, 0, +1).

| Test | Events | Excess over |
|---|---|---|
| **T1 (primary)** | the pullback-end signals, both sides | Baseline A |
| T2 | the H4 state alone: the first H1 open of each New York day, on the H4 side | Baseline A |
| T3 | the pullback-end signals, both sides | Baseline B (does the pullback's end add to the H4 side alone?) |

Windows by entry time: **in sample 2007-01-01 to 2016-12-31, out of sample 2017-01-01 to 2026-10-31**. t on calendar-month
sums of excess R (months with no trade count 0). p one-sided (positive excess) from the month t, Holm over the three tests.

## Counts read before this was written (signals, before the one-position rule)

| Window | Pullback-end signals | of which buys | New York days with an H4 state (T2) |
|---|---|---|---|
| 2007-16 | 834 | 455 | 2,918 |
| 2017-26 | 759 | 413 | 2,556 |

With holds of 24-47 hours the one-position rule leaves fewer; at least 100 trades per window are expected (and are needed: a
test under 100 in a window is reported, never passed).

## Placebo and control (on T1, out of sample)

- **Placebo (40 seeds, seed 20261117 + i)**: the OOS T1 entry times kept, the sides shuffled among them (buy count kept),
  each re-simulated; mean excess over Baseline A.
- **Control (40 seeds, seed 20261117 + 1000 + i)**: each OOS T1 event moved to the same UTC hour of a random day of the same
  calendar year, side kept: drift and volatility kept, the signal's information removed; mean excess over Baseline A.

## Pass bar (all must hold, T1)

OOS mean excess > 0 with month t >= 2 and Holm p <= 0.05; in-sample mean excess > 0; at 2x costs (events AND baseline
charged twice) the OOS excess > 0 and the OOS mean net R > 0; OOS n >= 100; the real excess above at least 38 of 40 placebo
draws AND at least 38 of 40 control draws. Anything else is FAIL. T2 and T3 are reported with their Holm p; a T2 or T3 pass
alone is a lead for its own pre-registration, never a verdict.

Not done here, on purpose: other swing sizes, hold lengths or stop multiples (any of them after seeing this would be a re-fit),
other markets.
