# Pre-registration: Luxus's "retrace to the 50 % at origin, or a new CF" on gold (14 Nov 2026)

Study 144, topic `luxus-impulse-50`. Written and pushed alone, before any candle was read for this rule and before any
result exists. Paper research only: a stand-alone rule, never a gate, exit, entry or size of the live gold book; the
book's 2006-17 positions are not read (owner decision 44). Nothing live changes, nothing is written to the Mosha desk,
its lessons, its book or its teacher. The owner chose on 14 Nov 2026 to test the teacher's own rules.

## The words tested

The teacher's lesson "11 nov Gold" (his words): "The overall trend on Daily and weekly is bullish, then after price make
impulsion buy it must retrace to the 50% at origin or create a new cf."

His confirmed book lines used here (his words): **BO buy: a close above a high. BO sell: a close below a low.** **CF: a
candle that closes out of the VR. A close below it is the CF for a sell, a close above it the CF for a buy.** **Zone of
the break: from the broken level back to the base of the candle that broke it. The return to it is the entry.**

## The rule, made mechanical

Data: OANDA mid XAU/USD M5 from June 2006 through the council's keyless candle proxy (the fetch of
`research/edge/mosha-sweep/run.mjs`, cache kept out of git, in the scratchpad). H4 candles = 4-hour UTC buckets of the M5
candles; D1 = UTC days with the weekend folded into Monday (`council/fills.mjs` `foldWeekend`); W1 = weeks from Monday
00:00 UTC (weekend candles belong to the week that follows). Only CLOSED candles are read at every step.

**Structure (BO).** A swing high of a timeframe is a candle whose high is strictly above the `P` candles on each side; a
swing low the mirror; it exists from the close of the `P`-th candle after it. A **BO buy** is a closed candle that closes
above the most recent swing high not yet closed above; a **BO sell** a close below the most recent swing low not yet
closed below. Every swing a close goes through is used up. `P` = 3 on H4 (the earlier Mosha studies' H4 swing), 2 on D1
and W1 (assumption A1).

**Overall trend (his "Daily and weekly bullish").** At a time t, the Daily trend is the side of the last D1 BO whose
candle closed at or before t; the same for W1. Bullish = both last BOs are BO buys; bearish = both BO sells.

**Impulsion buy.** An H4 BO buy while the overall trend is bullish at that H4 close. Its leg runs from the **origin** = the
lowest low of the H4 candles from the broken swing high to the BO candle, to the **leg high** = the highest high since
the origin. While the order waits, the leg high follows new highs (M5 highs, known at each M5 close), so the 50 % is the
50 % of the impulsion as it stands (assumption A2: he says the 50 % comes "after" the impulsion, so the impulsion is
allowed to finish).

### Test 1 (primary): the 50 % at origin, buy

- Buy limit at origin + 0.5 x (leg high - origin), re-set after each M5 close while unfilled; a fill when an M5 low
  reaches it (at the limit, or at the candle's open when it opens below it).
- **Stop $0.30 below the origin** (assumption A3: he names the origin, the buffer is the earlier Mosha studies' $0.30).
  Every trade has a stop on the losing side; an order whose risk is under $1.00 is not placed (assumption A4, the Mosha
  studies' floor, kept for comparability).
- **Target: the leg high** at the fill (his "impulsion" high; assumption A5).
- The order is cancelled when an M5 candle closes below the origin unfilled, by the next H4 BO (a BO sell cancels; a new
  BO buy replaces it with its own leg if the trend is still bullish), or when the overall trend stops being bullish at an
  H4 close (assumption A6).
- Out after 10 calendar days in the trade at the M5 close (assumption A7: he gives no time exit). Stop first when one
  M5 candle holds both stop and target; a gap through the stop exits at the open.
- One order or position at a time per test.

### Test 2: "or create a new CF", buy

The same impulsion buy, but instead of the 50 % limit:

- After the H4 BO, track the pullback from the leg high: its extreme = the lowest M5 low since the latest leg high.
  **The VR (assumption A8, the desk's guess, NOT confirmed by him)** = from that extreme up to the last M5 swing high
  (1 a side, as `mosha-sweep`) made after the leg high and before the extreme. A new leg high resets it.
- **CF buy** = the first M5 close above the VR top, provided the 50 % of the leg (as it stands) has not been touched since
  the H4 BO. One CF per H4 BO.
- **Entry at the return to the zone of the break**: buy limit at the broken level (the VR top); the zone runs down to the
  low of the M5 candle that broke it; **stop $0.30 below that low** (assumption A9). Valid 24 hours (assumption A10, the
  Mosha studies' order life), cancelled by an M5 close below the zone base or by an H4 BO sell.
- Same target (the leg high at the CF), placed only if the target is at least 1R above the entry (assumption A11: T1's
  structure gives about 1R; a CF near the high leaves nothing to take), risk at least $1.00, same 10-day exit.

### Test 3: the bearish mirror of Test 1

Overall trend bearish (last D1 and W1 BO both BO sells), an H4 BO sell, sell limit at the 50 % of the leg from the origin
(the highest high from the broken swing low to the BO candle) to the leg low, stop $0.30 above the origin, target the
leg low; everything else mirrored. He teaches the bullish case; the mirror is the obvious symmetric reading, tested
under the same Holm family.

## Costs

$0.60 a round trip on every trade, plus overnight financing on buys: `nights(fill, exit)` x `FIN.xau.long` x entry / risk
(`council/fills.mjs`; FIN = 0.000148 of price a rollover, the demo broker's XAUUSD swap of 11 Nov 2026, charged for every
year). Sells pay and receive nothing. Reported gross, net and net at 2x costs (both parts doubled).

## Windows

By fill time: **in sample 2020-01 to 2023-12; out of sample 2024-01 to 2026-10-31**; replication 2007-01 to 2019-12
(reported, not part of the pass bar). Trades still open at 2026-10-31 are marked at the data's end and left out.

## Statistics and the pass bar

- R = side x (exit - entry) / (entry - stop distance at the fill). t on **calendar-month sums** of net R (every month of
  the window counted, empty months as 0), one-sided p from the normal tail.
- Holm over the three tests on the out-of-sample one-sided p.
- **Pass (per test)**: OOS net month t >= 2 with Holm p < 0.05, IS net mean of the same sign (positive), OOS net mean
  still positive at 2x costs, at least 30 OOS trades. **The study passes only if Test 1 (primary) passes.** Tests 2 and 3
  are read as the same family; a pass of one of them alone is reported, not adopted.
- **Placebo, 40 seeds** (mulberry32, seeds 1-40): per test and window, the same number of market entries at random M5
  candle opens of the window, each with the side, stop distance, target distance and 10-day exit of a randomly drawn real
  trade of that test and window, costed the same. Reported: the count of draws the real net mean beats, and the median.
- **Control keeping drift and volatility**: same side, a market entry at every H4 candle open of the window, stop and
  target distances = the test's median stop / H4-ATR(14) and target / H4-ATR(14) multiples times the ATR at entry, same
  10-day exit and costs (one entry per H4 candle, overlapping, read as a baseline mean, not a stream). Reported: the
  control's net mean and the test minus the control.

## Closest prior studies, and exactly what differs

Read before writing this: `mosha-level`, `mosha-retrace`, `mosha-cycle`, `mosha-sweep`, `mosha-select`, `mosha-oos`,
`msnr-direction`, `msnr-entry` (main), and the branches `gold-ote-retrace`, `mcycle-base-study`, `gold-h4-cycle-bias`,
`cycle-gate-study`, `gold-ny-impulse-pullback`; the untested backlog of 14 Nov.

- **Closest: `gold-ote-retrace`** (FAIL, T1 OOS 2021-26 -0.230R a trade net, n 740, month t -3.42): a limit in the
  retracement of a structure-break leg, stop past the origin, target the leg's extreme. Differences held here from his
  words: (1) the impulsion is an **H4** BO (there: H1, leg >= 1.5 ATR); (2) the limit is at the **50 %** at origin (there:
  0.705); (3) the condition **"the overall trend on Daily and weekly is bullish"** = the last D1 AND the last W1 BO were BO
  buys (there: none in T1, a D1 50-day average in T3; never the weekly, never structure); (4) **the "new CF" branch** (none
  there).
- `mosha-retrace` trades the opposite side (sells the H1 retracement against the H4 BO). `mosha-cycle` and the live Mosha
  cycle (`mcycle-base`) buy after an H1 BO back with the H4 at a barrier, or target the H4 50 % from the other side; neither
  holds the Daily / Weekly condition or a limit at the 50 %. `mosha-sweep` / `mosha-select`: a swept H1 level, no H4
  impulsion, no D1/W1 condition. `gold-h4-cycle-bias` / `cycle-gate`: direction or a gate, no 50 % entry.
  `gold-ny-impulse-pullback`: the 50 % of the 08:30 New York impulse, not a structure break. `msnr-direction`: a
  direction call from key-level taps, no entry. None tests this rule: not a duplicate.

## Assumptions (mine, not his), listed

A1 swing size 3 on H4, 2 on D1 / W1. A2 the leg high follows new highs while the order waits. A3 the $0.30 stop buffer.
A4 risk floor $1.00. A5 the target is the leg high. A6 the cancels. A7 the 10-day time exit. A8 the VR (the desk's
unconfirmed guess). A9 the zone's stop at the break candle's low less $0.30. A10 the 24-hour order life of the CF
limit. A11 target at least 1R for the CF entry. No other filter is added.

## What a result will and will not mean

A pass would make this a candidate for the owner's own pre-registered forward paper test, nothing more (owner decision
44 stands; nothing live changes). A fail says this mechanical reading does not make money on gold 2020-26; it does not
judge his discretionary reading of a chart.
