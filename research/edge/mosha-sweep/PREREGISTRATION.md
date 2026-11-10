# Mosha sweep, VR and CF: pre-registration

Written and committed on 10 Nov 2026, before the detector was run on the test candles. Paper research only: no live rule,
size, filter or mirror setting is changed by this study, whatever it finds.

## Why

Three pre-registered Mosha studies ran on 10 Nov 2026 (`mosha-level`, `mosha-retrace`, `mosha-cycle`): thirteen tests on
gold 2020-26, none positive. The owner then asked to check the example trades sent on 2 Nov and 10 Nov. Five trades, five
winners on the council's candles, and they show what those tests did not hold (owner decision 27):

- the trigger is the **VR and its CF** on M5 (the owner's red "5 mn" box: from the extreme to the last swing before it; a
  close out of the box is the CF), earlier than the H1 break two of the tests waited for;
- every example starts from a **swept prior high**;
- the entry is either **at the CF** (28 Oct: sell 4048.59, stop above the high) or **on the return to the zone of the next
  break** (29 Oct and 10 Nov: a stop of a few dollars above the zone);
- the target is the next **H4 zone or H4 low**.

I put that reading to the owner ("a prior high is swept at a higher-timeframe point, the M5 VR forms, M5 CF, sell at the CF
or on the return to the zone of the break, stop above the zone, target the next higher-timeframe zone or low; buys are the
mirror") and asked whether to test it. The owner: **"Test both."** Both entries are tested, each as its own stream.

What I already know, said plainly: thirteen tests on HistData gold 2018-26 came before this one. So this test is judged on
candles none of them read (OANDA 2006-19), with 2020 to now as the second window the repo's rules ask for. The rule below
comes from the owner's examples and words, not from those results.

## Data

- Spot gold, OANDA mid candles, M5, from 1 June 2006 to the day of the run, through the council's keyless proxy
  (`/md/bars`). H1 and H4 candles are built from the M5 file in UTC buckets (the proxy's own H1 / H4 alignment).
- Fills, stops and targets are judged on M5 candles (20 years of M1 are not practical through the proxy). When one candle
  holds the stop and the target, the stop counts. This is stricter than the M1 fills of the other three studies.
- **Window A: orders placed 2006-07-01 to 2019-12-31** (untouched by the day's other tests).
  **Window B: 2020-01-01 to the end of the file.** June 2006 is warm-up.
- Cost $0.30 a round trip per unit, sensitivity at twice that.

## The rule. Written for a sell; buys are the mirror image.

Constants: `WH = 2` (H1 swing size), `W5 = 1` (M5 swing size: a three-candle swing), `LEVEL_AGE = 10` days,
`EPISODE = 12 h`, `STAGE2 = 24 h`, `BASE = 3` candles, `PAD = $0.30`, `MIN_R0 = $1.00`, `MIN_RR = 2`, `ZONE_AGE = 30` days,
`VALID = 24 h`, `HOLD = 72 h`.

1. **The prior high.** An H1 high not below the 2 highs before it and above the 2 highs after it is an H1 swing high. It
   exists from the close of the 2nd candle after it, and is live until an H1 candle closes above it or it is 10 days old.
2. **The sweep.** The first M5 candle that trades above a live swing high starts an episode on that level. The extreme is
   the highest M5 high of the episode.
3. **The VR.** From the extreme down to the most recent M5 swing low (a low not above the low before it and below the low
   after it) that existed when the extreme's candle opened. A higher high moves the extreme and re-reads that swing low.
4. **The CF.** The first M5 candle after the extreme's candle that closes below the VR's low, within 12 h of the sweep.
   No CF in 12 h: the episode ends and the level may be swept again. A level is used for one CF.
5. **Entry "CF": at the CF.** Sell at the close of the CF candle. Stop = the extreme + $0.30.
6. **Entry "ZONE": the return to the zone of the next break.** After the CF: the first M5 swing low whose candle is at or
   after the CF candle, then the first M5 close below it (within 24 h of the CF, and with no M5 high above the extreme in
   between). Sell limit at that broken low; zone top = the highest high of the break candle and the 3 M5 candles before it;
   stop = zone top + $0.30. The limit is valid 24 h and is cancelled if the target trades first.
7. **Risk.** `r0 = stop - entry`. No order when `r0 < $1.00`.
8. **Target: the next H4 structure.** Candidates: the top of every live H4 bullish engulf zone below the entry (a green H4
   candle closing above the high of the red candle before it; zone = the lower of the two lows up to the red candle's high;
   live until an H4 close below its bottom, at most 30 days) and every live H4 swing low below the entry (3 candles a
   side; live until an H4 close below it, at most 30 days). The target is the nearest candidate at least `2 x r0` away. None:
   no order.
9. **Exit.** Stop, target, or the M5 close 72 h after the fill. No break-even, no trail, no add.
10. **One at a time, per entry style.** While an order rests or a position is open in a stream, later candidates of that
    stream are dropped. (One move often sweeps several H1 highs at once; they give the same trade and count once.)
11. **Result.** `R = (entry - exit) / r0`, net `R - COST / r0`.

**Implementation check on the owner's examples, made before this file was committed** (council's OANDA candles; nothing else
was run):

- 28 Oct sell (owner: 4048.59 / stop 4076.69 / target 3971.09): entry "CF" places a sell at 4047.74 at 00:05 UTC on
  29 Oct, stop 4083.13, target 3975.65, target reached.
- 10 Nov sell (owner: 4120.42 / 4128.92 / 4072.84): entry "ZONE" places a sell limit at 4121.65, stop 4128.28, target
  4073.45, target reached. Entry "CF" for the same episode sells at 4122.51 at 00:35 UTC with the stop at 4149.01.
- The 2 Nov trades are not found: the owner read them on M1 and M30 ("M30 sweep high", "i just took entry after bo sell"
  on the M1 chart), below and above this rule's timeframes. They are outside this test.

Two settings were fixed with those examples in view and nothing else: the H1 swing is 2 a side (the examples' swept highs
are fresh H1 highs), and the target looks at H4 structure only (with H1 lows as candidates the 10 Nov target fell at
4100.59; the owner's was the H4 zone at 4072.84).

## Verdict (fixed here), separately for each entry

Net of cost, orders placed from 2006-07-01, closed trades only:

- **PASS**: 30 or more trades in each window; mean net R > 0 in window A AND in window B; at least two thirds of the calendar
  years from 2020 positive; the Holm-adjusted one-sided p (two tests) under 0.05; and mean net R > 0 at twice the cost.
- **FAIL**: mean net R <= 0 over the whole period, or <= 0 in window A.
- **INCONCLUSIVE**: anything else.

The study's headline is PASS if either entry passes, FAIL if both fail, INCONCLUSIVE otherwise. No variants are run.

Also reported, without a verdict: the funnel, sides, years, exits, win rate, the median stop distance and R:R, and how many
candidates the one-at-a-time rule dropped.

## What happens next

Nothing changes live on any outcome. On PASS the proposal to the owner is a paper shadow stream. On FAIL or INCONCLUSIVE
the result is published as it is, and the open step stays the owner's own logged trades.
