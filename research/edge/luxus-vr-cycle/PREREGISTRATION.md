# Luxus's VR cycle on gold (study 145): pre-registration

Written and committed on 14 Nov 2026, alone, before `run.mjs` existed and before any candle of this study was read by a
detector. Paper research for the owner only: no live rule, size, filter, stop, config, mirror setting or council file changes,
whatever this finds. Nothing is written to the Mosha desk, its lessons, its book or its teacher.

## Why

The owner, 14 Nov 2026: "Test Luxus's own rules". Luxus teaches the Mosha method on the Mosha desk. Two of his lessons ("10 nov,
sell Gold" and "11 Nov buy") describe one cycle, in his words:

- "Price were going bullish H4 and H1, and after that I noticed that price failed to make a new high and then broke the
  previous low. I entered after bo sell."
- "H4 and H1 are on bullish trend, then after impulsion price must retrace to the 50% of the range or make new confirmation.
  The reason for sell is that price made M5 VR. I consider new cycle M5 bo sell and repeat sop."
- "M5 vr bo buy formed, this is retracement for H4 and H1 bullish trend."
- "The overall trend on Daily and weekly is bullish, then after price make impulsion buy it must retrace to the 50% at origin
  or create a new cf."

His confirmed book lines, used exactly: **Level** = a prior high or low that matters on a higher timeframe (H4, H1 or M30);
**CF** = a candle that closes out of the VR (below it for a sell, above it for a buy); **BO sell** = a close below a low,
**BO buy** = a close above a high; **zone of the break** = from the broken level back to the base of the candle that broke it,
and the return to it is the entry.

## Closest prior studies, and exactly what differs (dedupe)

Read before writing this: `mosha-level`, `mosha-retrace`, `mosha-cycle`, `mosha-sweep`, `mosha-select`, `mosha-oos`,
`msnr-direction`, `msnr-entry` (main), and on branches `mcycle-base` (the live Mosha cycle rule), `cycle-gate`,
`gold-h4-cycle-bias`. All FAIL. No `luxus*` study exists.

**Closest: `mosha-sweep`** (a swept prior H1 swing, the M5 VR, the M5 CF, entry at the CF or at the zone of the NEXT break,
target the next H4 zone or H4 swing at least 2R away; both sides, no trend condition) lost −0.11R a trade (CF, n 6,260,
t −4.62) and −0.21R (zone, n 6,478, t −7.36), 2006-26, $0.30 cost. **`mosha-select`** split those candidates by the last H4
BO (with / against), never by H4 AND H1 together: the zone entry against the last H4 BO lost −0.25R / −0.32R / −0.18R in its
three periods. **`mcycle-base`** (H4 BO, then the H1 ChoCh, then an M15 / M5 BO, target the H4 50%) lost −0.756R on its
pullback leg (n 43).

What this rule holds that none of them did, each taken from Luxus's words:

1. **Both H4 and H1 bullish when the sell is taken** (the last BO on each is a BO buy). `mosha-sweep` had no trend condition;
   `mosha-select` used H4 alone; `mcycle-base` waits for H1 to have turned (the H1 ChoCh), this rule sells BEFORE H1 turns.
2. **The level is a prior H4, H1 or M30 high** (his Level), not an H1 swing only.
3. **The target is the 50% of the H1 impulsion range** ("retrace to the 50% of the range"), not an H4 zone or swing 2R or
   more away; no minimum reward:risk.
4. **The zone is the zone of the break of the VR itself** (entry on the return to the broken VR low), not of the next M5 break
   after the CF.
5. **Test 2, the buy at the end of that retracement** (an M5 VR at the 50% and its CF up, with H4 and H1 still bullish,
   target the impulsion's high). `mosha-cycle` bought at an H4 engulf barrier on an H1 BO; `mcycle-base`'s main leg waits for
   an M15 / M5 structure flip after the H1 ChoCh. Neither bought an M5 VR / CF at the 50% of an H1 impulsion that H1 never
   left.

If the run shows the rule is the same trades as a prior study, that is reported; it is not expected (points 1-4 change the
candidate set and the exits).

## Data

- Spot gold XAU/USD, OANDA mid M5 candles from 1 June 2006 to the day of the run, through the council's keyless candle proxy
  (`research/edge/mosha-sweep/run.mjs fetch`, its own fetch, imported unchanged); the file is kept in the session's
  scratchpad, never in git. M30, H1 and H4 are built from the M5 file in UTC buckets.
- Fills, stops, targets and time exits are judged on M5 candles; when one candle holds the stop and the target, the stop
  counts; a gap through the stop exits at the open.
- **In sample: orders placed 2020-01-01 to 2023-12-31. Out of sample: 2024-01-01 to 2026-10-31.** Replication: 2007-01-01 to
  2019-12-31 (reported, not part of the pass bar). Earlier candles are warm-up.

## Costs

$0.60 a round trip a unit (taken off as $0.60 / r0 in R), plus overnight financing on buys:
`council/fills.mjs` `nights(fill, exit) x FIN.xau.long (0.000148, the demo broker's XAUUSD swap.long of 11 Nov 2026) x entry / r0`
(imported, today's rate for every year). Sells pay and receive nothing overnight. Reported gross, net, and net at twice the
costs (both the $0.60 and the financing doubled).

## The rule

Structure words are his. Swings: a swing high is a candle whose high is not exceeded by the `W` candles before it and is
strictly above the `W` candles after it (lows mirrored); it exists from the close of the `W`-th candle after it.

**Trend state (his BO, made mechanical).** On a timeframe, a **BO buy** is a closed candle whose close is above the most recent
existing swing high that no earlier close has broken; a **BO sell** a close below the most recent existing unbroken swing low.
The state is the side of the last BO. **Bullish** = the last BO is a BO buy. Read on closed H4 and H1 candles only.

**Test 1: the sell, "new cycle M5 bo sell".**

1. At an M5 candle, H4 AND H1 are both bullish.
2. **Level reached**: the candle trades at or above a live Level = a prior swing high of H4, H1 or M30 that exists and that no
   close of its own timeframe has gone above, at most `LEVEL_AGE` old.
3. **The M5 VR** (desk assumption, labelled: Luxus has not confirmed the VR's drawing): from the highest high since the touch
   down to the last M5 swing low (`W5`) that existed before that high. A new high moves the extreme and the VR low with it.
4. **The CF**: an M5 close below the VR low, within `EPISODE` of the touch. At the CF's close H4 and H1 must still be bullish.
5. **Entry, his zone of the break**: the zone runs from the broken level (the VR low) up to the base of the CF candle (its
   high). A sell limit at the broken VR low (the first price of the return to the zone), placed at the CF's close, valid
   `VALID`.
6. **Stop** (desk assumption, labelled): `PAD` above the VR extreme. Every trade has its stop on the losing side.
7. **Target, his "50% of the range"**: the H1 impulsion = from its origin (the lowest H1 low between the swing high the last
   H1 BO buy broke and that BO candle) to the highest high since (through the CF candle). The target is its 50%. No order
   when the 50% is not below the entry.
8. The order is cancelled if price trades at the stop before the fill (the VR failed) and is "missed" if the target trades
   first. Out after `HOLD` from the fill at the M5 close.

**Test 2: the buy, "M5 vr bo buy formed, this is retracement for H4 and H1 bullish trend".** After every Test-1 CF (whether or
not its sell filled), within `RETRACE` of the CF:

1. price trades at or below that cycle's 50%;
2. **the buy VR**: from the lowest low since then up to the last M5 swing high before it (mirrored, same assumption);
3. **the CF up**: an M5 close above the VR high within `EPISODE` of the touch of the 50%, with H4 AND H1 still bullish at
   its close;
4. buy limit at the broken VR high (zone of the break down to the CF candle's low), valid `VALID`; stop `PAD` below the VR
   low; target the impulsion's high recorded at the sell's CF; no order when that high is not above the entry; same
   cancel / missed / `HOLD` rules.

**Test 3: tests 1 and 2 as one stream** (every trade of both, pooled).

**One at a time**: within each of tests 1 and 2, a new order is ignored while an earlier one of the same test is pending or
open. Test 3 pools the two streams as they are.

Constants: `W` = 2 for H4, H1 and M30 swings (levels and BOs), `W5` = 1 (M5 swings: a three-candle swing), `LEVEL_AGE` = 10
days, `EPISODE` = 12 h, `VALID` = 24 h, `HOLD` = 72 h, `RETRACE` = 72 h, `PAD` = $0.30.

**Choices made only to make the words mechanical (assumptions, listed):** the swing sizes `W` and `W5`; "the last BO" read on
the most recent unbroken swing; the VR's drawing; the stop past the VR extreme; the entry at the zone's near edge (the broken
level) rather than anywhere inside it; the impulsion measured on H1 (he names "H4/H1"; H1 is the lower timeframe he requires
bullish, and its 50% is the one a retracement reaches first); the four times `LEVEL_AGE`, `EPISODE`, `VALID`, `HOLD`,
`RETRACE`; the one-at-a-time rule; the Daily / Weekly trend of his fourth note is NOT used (it is in one note of four and adds
a filter).

## Statistics and the pass bar

- Per test and window: n, win rate, mean R gross / net / net at 2x, total, and **t on calendar-month sums** (every calendar
  month of the window, a month with no trade counts as 0).
- **Holm** over the three tests' out-of-sample one-sided p (from the month t, normal approximation).
- **Placebo**, 40 seeds: for each trade of a test, a uniformly random M5 candle of the same window (IS or OOS) with the
  market open, entered at its close on the same side, with the trade's own stop distance, target distance and `HOLD`, same
  costs. Reported: each seed's mean net R, and the share of seeds whose mean is at or above the real one.
- **Control keeping drift and volatility**, 40 seeds: for each trade, a random M5 candle within ±5 days of its fill, same
  side, stop and target distances scaled by the H1 ATR(14) there against the H1 ATR(14) at the real fill, same `HOLD` and
  costs. Reported the same way.
- **PASS** only if Test 1 (the primary) has: out-of-sample net t >= 2 on month sums AND Holm-adjusted p < 0.05, the same sign
  in sample, and out-of-sample mean net R still above 0 at twice the costs. Tests 2 and 3 are reported with the same lines;
  they cannot make the verdict a PASS without Test 1. Otherwise **FAIL** (or **INCONCLUSIVE** when Test 1 is positive in both
  windows but misses the t or Holm line).
- Never called an edge without n and t; a PASS here would be a backtest, not a forward record, and would be put to the owner
  as a proposal only.

## What the run must also report

The funnel (Level touches, VRs, CFs, orders, fills); exits; sides; each year; the replication window 2007-19; Luxus's own
10 and 11 Nov 2026 trades if the candle file reaches them (whether the detector finds them is reported, not tuned for).
