# MSNR direction call: result (11 Nov 2026)

**Verdict: FAIL, 0 of 6 tests: the direction call says nothing measurable about gold's next 1, 5 or 20 daily closes beyond the base rate (largest t in 2020-26 +1.35; every test changes sign between 2007-19 and 2020-26). Computed by fixed rules with no look-ahead, and used as a mechanical filter, it is not an edge on gold.**

Paper research only. No live rule, size, filter, council member or page was changed. The call, the two ladders, the three
horizons, the statistic and the verdict were fixed in `PREREGISTRATION.md` (commit c7416612) before the detector read a candle.
This is a direction filter test: no entry, stop or exit was simulated, so nothing here is a trade or an R figure.

## What was tested

The owner's direction procedure, in my words (the skill itself is the owner's private material and is not in this repository):

1. On the working timeframe, the structure is the side of the last close beyond a swing level (two candles each side).
2. One timeframe above, four kinds of key level are kept as price zones: a swing level (wick to body), an engulfing zone, a
   failed engulfing zone, a dominant zone (two same-colour candles, the second closing beyond the first). A zone is known
   only once its candle has closed, and lives until a close through its far side (60 candles at most).
3. When price first reaches a support zone while the structure is down, the last swing high that already existed is frozen
   as the external level. Swing highs made after the tap are internal and change nothing. The first close above the frozen
   level (within 10 higher-timeframe candles, the zone still live) sets the call to **buy**. Sell is the mirror image. The
   call stays until the opposite sequence completes; a breakout with no key level tapped changes nothing.

Two ladders: **L1** = working H4, key levels on the Daily; **L2** = working Daily, key levels on the Weekly. Data: OANDA spot
gold H4, 1 June 2006 to 10 Nov 2026 (33,298 candles, 5,313 days); Daily and Weekly candles built from the same H4 candles.

**Measure.** At each daily close, the call as known at that close, against gold's log return over the next 1, 5 and 20 daily
closes. *Excess* = call x (forward return minus the window's average forward return), averaged over the days with a call:
following "buy" in a rising market earns nothing here unless the buy days rose by more than the average day. t is
Newey-West; the plain t on non-overlapping days is the check. *Hit* = share of call days that went the call's way; *base* =
what the same number of buy and sell days would have hit knowing nothing.

Window 2020-26 (1 Jan 2020 to 31 Oct 2026) is the confirmation window; 2007-19 the replication window (the sign must agree).
No parameter was chosen from either.

## Result

| Test | Window | Call days | Buy / sell days | All days, mean | After buy | After sell | Excess | t | t, no overlap (n) | Hit | Base | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L1-h1 | 2007-19 | 3,380 | 1847 / 1533 | +0.03% | +0.03% | +0.02% | +0.00% | +0.24 | +0.24 (3380) | 50.2% | 50.2% | |
| L1-h1 | 2020-26 | 1,772 | 1147 / 625 | +0.05% | +0.02% | +0.11% | −0.04% | −1.49 | −1.46 (1772) | 48.4% | 51.0% | 1.00 |
| L1-h5 | 2007-19 | 3,376 | 1843 / 1533 | +0.13% | +0.20% | +0.05% | +0.07% | +0.93 | +1.01 (676) | 50.0% | 50.4% | |
| L1-h5 | 2020-26 | 1,768 | 1147 / 621 | +0.27% | +0.19% | +0.42% | −0.10% | −0.95 | −0.68 (354) | 48.7% | 51.8% | 1.00 |
| L1-h20 | 2007-19 | 3,361 | 1828 / 1533 | +0.51% | +0.52% | +0.50% | +0.01% | +0.04 | −0.09 (169) | 49.0% | 50.4% | |
| L1-h20 | 2020-26 | 1,753 | 1137 / 616 | +1.10% | +0.91% | +1.46% | −0.25% | −0.74 | −0.52 (88) | 50.7% | 52.5% | 1.00 |
| L2-h1 | 2007-19 | 3,380 | 1551 / 1829 | +0.03% | +0.02% | +0.03% | −0.01% | −0.47 | −0.47 (3380) | 48.4% | 49.7% | |
| L2-h1 | 2020-26 | 1,772 | 992 / 780 | +0.05% | +0.08% | +0.02% | +0.03% | +1.16 | +1.10 (1772) | 52.3% | 50.4% | 0.62 |
| L2-h5 | 2007-19 | 3,376 | 1547 / 1829 | +0.13% | +0.08% | +0.17% | −0.04% | −0.49 | −0.73 (676) | 48.6% | 49.6% | |
| L2-h5 | 2020-26 | 1,768 | 992 / 776 | +0.27% | +0.40% | +0.10% | +0.15% | +1.35 | +1.19 (354) | 53.1% | 50.7% | 0.54 |
| L2-h20 | 2007-19 | 3,361 | 1545 / 1816 | +0.51% | +0.44% | +0.57% | −0.07% | −0.21 | −0.35 (169) | 48.5% | 49.7% | |
| L2-h20 | 2020-26 | 1,753 | 992 / 761 | +1.10% | +1.46% | +0.64% | +0.40% | +0.98 | +0.76 (88) | 54.0% | 51.1% | 0.66 |

The pre-registered bar (t >= 2.0 in 2020-26, the same sign in 2007-19, Holm p < 0.05 over the six): **0 of 6 pass; none
meets even the first two conditions, so the verdict is FAIL, not inconclusive.**

How to read it:

- **H4 / Daily (L1), the ladder of the skill's own examples.** In 2020-26 gold rose *more* after a sell call than after a buy
  call at every horizon (after sell +0.42% a week, after buy +0.19%; all days +0.27%), and the hit rate is 2 to 3 points
  below its base. In 2007-19 the excess is a few hundredths of a percent, t under 1, the hit rate at or under its base.
- **Daily / Weekly (L2).** Mildly positive in 2020-26 (hit 52 to 54% against a base near 51%, t 1.0 to 1.35) and mildly
  negative in 2007-19 (hit 48.5% against 49.7%). Opposite signs, both inside noise.
- With 1,750 to 3,380 days a cell, a one-day excess of about 0.05% would have reached t 2 (the standard error of the
  one-day cells is 0.02 to 0.03%). The test is not short of data.

## Described, not tested

| | 2007-19 | 2020-26 |
|---|---|---|
| L1: share of days buy / sell | 54.7% / 45.3% | 64.7% / 35.3% |
| L1: switches (by key level: swing, dominant, engulfing, failed engulfing) | 172 (89, 57, 18, 8) | 89 (42, 26, 17, 4) |
| L2: share of days buy / sell | 45.9% / 54.1% | 56.0% / 44.0% |
| L2: switches (same order) | 40 (15, 15, 6, 4) | 19 (8, 3, 6, 2) |

L1 switches about 13 times a year, L2 about 3 times a year. In 2020-26, while gold went from about 1,517 to about 3,876, the
call said "sell" on 35% (L1) and 44% (L2) of days.

The **breakout-only** call (the structure of step 1 alone, no key level, no external rule), excess and Newey-West t:

| Cell | 2007-19 | 2020-26 |
|---|---|---|
| L1-h1 | −0.00% (−0.26) | +0.03% (+1.19) |
| L1-h5 | +0.01% (+0.15) | +0.06% (+0.80) |
| L1-h20 | −0.03% (−0.27) | −0.03% (−0.16) |
| L2-h1 | −0.01% (−0.44) | −0.01% (−0.37) |
| L2-h5 | −0.06% (−0.82) | −0.06% (−0.52) |
| L2-h20 | −0.32% (−1.45) | −0.15% (−0.44) |

Also noise. So neither the plain break of swing nor the key-level and external-breakout conditions on top of it carry
direction information here, and there is no sign that the extra conditions add any.

## What this does and does not say

- It says: **this mechanical reading** of the direction procedure, used alone as a buy / sell label on gold, does not
  beat the base rate. It should not become a council filter, a size rule or a "bias" gate, and a system should not be
  switched off because the call disagrees with it.
- It does not say the owner's own chart reading is wrong. Three things in the test are mine, not the skill's: the engulfing
  and failed-engulfing zones (the skill's direction session does not define them), the numbers (2-candle swings, 60-candle
  zone life, 10-candle wait), and reading "the last swing level before the tap" as the most recent existing level, used only
  if no candle has yet closed beyond it. A person marking charts also chooses which level matters; no rule here holds that
  choice. The same was found for the Mosha rules on 10 Nov.
- It does not test the procedure as the gate in front of an entry method (the skill's later sessions). A direction label can
  be useless for the next daily closes and still be a sensible way to organise entries; that would be a different,
  pre-registered test of the whole system, net of costs.
- Gold only. The skill's watchlist also has six forex pairs; none was tested.
- The mildly positive Daily / Weekly cells of 2020-26 are not a lead: the same cells are negative in 2007-19.

## Implementation notes

- Unit tests (`tests/msnr-direction.test.mjs`) were written and passing on hand-made candles before the run on real candles:
  each kind of key level, the tap, the frozen level, internal against external, the expiry cases, the mirror image, and
  no look-ahead (the call at t is identical on the candles up to t and when every later candle is altered).
- No bug was found after the run and nothing was re-run or changed after the first result.
- `result.json` carries every cell (`tests`, `breakoutOnly`, `states`). Its `candidates` carry no in-sample / out-of-sample R
  statistics on purpose: the Edge lab reads those as R a trade, and nothing here is a trade.

Re-run: `node run.mjs fetch <dir>` (seven or eight paced requests to the candle proxy), then `CANDLES=<dir> node run.mjs run`.
