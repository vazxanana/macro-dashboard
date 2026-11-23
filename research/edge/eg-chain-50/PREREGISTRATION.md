# Engulf chain with an entry at the confirming engulf's middle: pre-registration

Written 23 Nov 2026, before any code for this study exists and before any candle of its windows is read for it. Research
only: nothing live reads it, it places nothing, and no rule changes on its result without the owner.

## Why
The engulf-zone readings tested here so far (engulf-ladder, geg-variants, desk-rigor's plan / short method / direct entry,
desk-slices, h4-zone-trail) failed or sat at zero before costs. Three parts of the three-timeframe chain were never tested
together: the entry at the MIDDLE of the last engulf, a cut on a CLOSE (not a fixed stop), and a target at the next opposite
zone in the way (the "roadblock") instead of a fixed multiple of risk. This study tests that combination once. The desk's
`eg-sop3` reading (22 Nov 2026, stop past the second zone, 2R) was looked at on 2026 data only; it is not reused.

## The rule (one reading, fixed here)
- **Engulf (EG)**: the base is the last candle of the other colour (a doji, open = close, is never a base). A BUY engulf is
  completed by the first of the next three candles whose body closes above the base's HIGH; a SELL engulf by a close below the
  base's LOW. A newer candle of the base's colour before completion replaces the base; a close through the base's other side
  cancels it. Wicks never complete an engulf. **Zone** = the base candle, high to low. Known from the completing close only.
- **Alive**: a zone dies at the first close of its own timeframe beyond its far side (below a buy zone's low, above a sell
  zone's high). No freshness requirement beyond that.
- **Chain** (TF1 marks the zone, TF2 engulfs at it, TF3 confirms):
  1. An alive TF1 zone gives the side (buy zone = buys).
  2. A TF2 candle trades into the TF1 zone; after that touch a TF2 engulf of the same side completes whose zone overlaps the
     TF1 zone.
  3. Within 12 TF2 candles of that, a TF3 engulf of the same side completes whose zone overlaps the TF2 zone, with the TF1
     and TF2 zones still alive.
- **Entry**: a limit at the middle (50 %) of the TF3 zone, placed at the completing close, alive 12 TF3 candles; cancelled
  earlier by a TF3 close beyond the TF3 zone's far side or by price reaching the target before a fill.
- **Risk (1R)** = entry to the TF3 zone's far side. A setup with 1R under $1.00 is skipped (never widened).
- **Cut (close-based)**: out at the close of the first TF3 candle that closes beyond the TF3 zone's far side (can be worse
  than -1R). **Hard stop** (rule 1, a stop always): the TF2 zone's far side; a candle trading through it exits there (at the
  open on a gap).
- **Target (roadblock)**: the near edge of the nearest alive OPPOSITE engulf zone of TF1 or TF2 ahead of the entry at the
  moment the order is placed. Under 1R away: no trade. None: the trade runs to the time limit.
- **Time limit**: 24 hours from the fill (primary), 5 trading days (secondary D chain); out at that candle's close.
- **Fills** on 5-minute candles; the fill candle can only cut or stop the trade, never reach the target. One position at a
  time per chain. Stop and target never move.

## Market, timeframes, data
- Gold (XAU/USD) only, OANDA mid candles from the shared toolkit (`research/edge/_lib/edgekit.mjs`, cache outside git).
  M15 / H1 / H4 by `resample` (UTC-aligned buckets, as the desks); D1 = `dailyNY` (17:00 New York trading days).
- **Primary chain**: H1 zone -> M15 engulf -> M5 confirmation.
- Windows: in sample 2020-01-01 to 2023-12-31; out of sample 2024-01-01 to the last candle on file; **replication**
  2010-01-01 to 2019-12-31 (required: the chain's shape was settled on 2020-26 data on 22 Nov 2026). A trade belongs to the
  window of its fill.

## Costs and statistic
- Cost = toolkit `COSTS.xau` ($0.30) a round trip, charged in R (cost / 1R) on every trade; a 2x-cost run ($0.60) as a check.
- Statistic: mean R a trade after costs, and t of the calendar-month sums of R by exit month (toolkit `stats().tMonth`).

## Tests (Holm over these three, on the out-of-sample month-t p values)
- **P (primary)**: the H1 -> M15 -> M5 chain as written.
- S1: the D1 -> H4 -> H1 chain, same rule (5-trading-day limit; fills still on 5-minute candles).
- S2: the primary with the engulf completed by the NEXT candle only (the desks' second reading).

## Pass bar (each test, all must hold)
1. Out-of-sample mean R after costs > 0, with at least 30 out-of-sample trades.
2. Out-of-sample month t >= 2 and Holm-adjusted p < 0.05.
3. In-sample mean R after costs > 0.
4. Replication 2010-2019 mean R after costs > 0 (at least 30 trades).
5. Out-of-sample mean R still > 0 at 2x costs.

**PASS** = P meets all five (a secondary that passes alone is a hypothesis for its own test on other data, never an edge).
**FAIL** = P has 30+ out-of-sample trades and misses any of 1-5. **INCONCLUSIVE** = P has under 30 out-of-sample or
replication trades. Reported only, no verdict: by year, buy / sell, cut against hard stop against target against time exits,
how many setups had no roadblock.

## What will not be done
One run. No change of timeframes, buffer, order life, time limit, minimum risk or target rule after a result; no other market.
A pass would mean a forward paper record first (its own pre-registration), never a live rule without the owner.
