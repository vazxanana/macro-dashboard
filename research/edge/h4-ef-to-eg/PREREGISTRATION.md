# H4 engulf failed (EF) to the next H4 engulf (EG): pre-registration (23 Nov 2026)

Written and committed alone, before any trade of this rule is computed and before any candle of a test window is read for it.
Research only: nothing live changes, and no proposal follows unless the owner asks. The rule was shaped on ONE gold example the
owner showed on 20-23 Nov 2026 (an H4 sell engulf that failed, price back into it, an M15 break up, the retest of the zone, a
target at the next H4 sell engulf above). The example's trade is not written here (public repository): the harness check below
only asks that the code finds its two H4 zones. Every entry placed from 2026-11-16 00:00 UTC on is left out of every window.

## The rule (written once, not tuned). A buy is described; a sell mirrors it exactly.
1. **H4 candles**: UTC-aligned 4-hour candles built from the toolkit's 5-minute cache (`edgekit.resample(m5, 14400)`, the desk's
   midnight-UTC H4). **M15 candles** the same way (900 s).
2. **Engulf zones**: `council/eg-methods.mjs` `zones(H4, '4h')`, imported unchanged: the desk's one engulf definition (`engulfAt`,
   EG_SPAN 3: the base = the last candle of the other colour; the 1st, 2nd or 3rd candle after it closing beyond its high (buy) /
   low (sell) completes it; a close through the base's other side first cancels it). Zone = the base candle wick to wick, known
   at the close of the completing candle (`at`). `fail` = the close time of the first H4 candle that closes through the zone's
   far side within the desk's life of 120 H4 candles; `end` = `fail`, else the close of the 120th H4 candle after it.
3. **The barrier (EF)**: an H4 SELL engulf zone that FAILED (an H4 close above its top, `fail` set). From that close it is a BUY
   barrier between the zone's bottom and top. (Sell side: a failed BUY engulf zone, an H4 close below its bottom, is a SELL
   barrier.) Known only at `fail`; nothing about it is used before.
4. **The return**: the first M15 candle that starts at or after `fail` and trades into the barrier (low at or under its top),
   within 120 H4 candles of the fail (the desk's zone life). No return in that time: the barrier is spent, no trade.
5. **The break with the barrier**: from the return candle on (the return candle included), the first M15 candle that closes
   above the last confirmed M15 swing high not yet broken (`edgekit.structure(M15, 3)` event, up, BO or ChoCh alike). Ends the
   setup with no trade: an M15 close below the barrier's bottom first (from the return candle on), or no such break within 48
   M15 candles (12 hours of candles) of the return candle. ONE setup per barrier (the first return only).
6. **The order**: at the close of that M15 break candle, a BUY LIMIT at the barrier's TOP (the retest of the zone). If the break
   candle closed at or under the top, the limit is above the market and fills at the next candle's open (a buy limit above the
   price fills at once): said so, not changed.
   - **Stop**: under the barrier's bottom by 10 % of the zone's height (risk = 1.1 x the height from the top).
   - **Target**: the near side (bottom) of the NEAREST H4 SELL engulf zone that is still alive at the order's time (its `at`
     at or before the order, not failed by then, its life not over, `end` after the order) and lies wholly above the entry
     (bottom above the top of the barrier). No such zone, or that nearest zone under 2R away: no order (skip; a farther zone is
     never taken instead).
   - **Smallest stop**: no order when the risk is under 4 x the market's round trip (`edgekit.COSTS`), so cost is at most 0.25R.
   - **Order life**: 24 H4 candles from the order (cancelled at the start of the 25th H4 candle after the one holding it); also
     cancelled at the close of an M15 candle that closes below the stop, and when the target trades before the fill.
7. **Fills and exits** by `edgekit.simulate` on the 5-minute candles (type limit: fills on a touch of the entry, at the open
   when a candle opens past it; on the fill candle only the stop counts; a candle that opens past the stop exits at its open;
   stop first when one candle holds both). **Time exit** at the close of the 120th H4 candle after the fill candle.
8. **One position at a time per market**: setups in order of their order time; a new order only when no order rests and no
   position is open in that market. A trade still open on the last candle on file is not booked (counted apart).

## Markets, data, costs
- Markets: `edgekit.MARKETS` = xau, eurusd, gbpusd, usdjpy, audusd (OANDA mid 5-minute candles, the toolkit cache, from
  2010-01-01; H4 / M15 built from them). The holdout years 2005-2009 are not read.
- Windows by FILL time: replication 2010-01-01 to 2019-12-31; in sample 2020-01-01 to 2023-12-31; out of sample 2024-01-01 to
  the end of the cache (entries placed from 2026-11-16 left out).
- Costs: `edgekit.COSTS` round trip per trade in R of its own risk; gold BUYS also pay overnight financing
  (`council/fills.mjs` `financing`, the demo's measured rate; gold sells and forex pay none: no rate measured). A second run at
  2 x costs (round trip and financing doubled). Before-costs figures are reported beside.

## Harness check (before any result is read)
On the gold H4 candles of November 2026 the code must find the example's two H4 sell engulf zones (the one the owner treated as
the failed zone and the one he took as the target). If it does not, the harness is wrong and is fixed before anything is run.

## Tests (Holm over the six out-of-sample p values)
- **P (primary)**: the five markets pooled.
- **M1-M5**: each market alone (gold, EUR/USD, GBP/USD, USD/JPY, AUD/USD). They get their own verdicts and cannot rescue P.
Reported only, no verdict: buys and sells apart, exits by reason, the target's R at the order, the year table, the counts of
each step (barriers, returns, breaks, skips by reason, orders, fills, open).

## Statistic and pass bar
Mean R a trade after costs; t on calendar-month sums of R by fill month, zero months included; two-sided p from that t,
Holm-adjusted over the six tests. A test **PASSES** only if all hold: OOS mean > 0; OOS month t >= 2 and Holm p < 0.05; IS mean
> 0; OOS mean > 0 at 2 x costs; at least 30 OOS trades; replication (2010-2019) mean > 0; AND the placebo: its OOS mean is
above the OOS mean of at least 38 of 40 placebo runs.
- **Placebo** (random time, same geometry): for each real filled trade and each of 40 seeds, a trade in the same market and on
  the same side, entered at market at the open of a random M15 candle of the same calendar month (uniform over that month's
  M15 candles), with the same risk distance, the same target in R and the same allowed hold, the same costs; simulated by the
  same function. It asks whether the barrier timing beats a random entry with the same stop and target.
- **FAIL**: OOS mean <= 0, or IS mean <= 0, or OOS mean <= 0 at 2 x costs, or replication mean <= 0.
- **INCONCLUSIVE**: positive on every one of those but a t, Holm or placebo bar missed, or fewer than 30 OOS trades.
The study's verdict is P's. No other buffer, order life, return window, break window, target rule, minimum R, swing size,
timeframe, market or filter is tried after the result; a follow-up needs its own pre-registration on other data (the 2005-2009
holdout and the holdout markets stay untouched). A pass is "passed its pre-registered test" and earns a forward paper record
only; it is never called an edge beyond its n and t.

## What earlier work says (why the prior is weak)
The desks' engulf readings sit at about zero before costs on 2020-26 (`desk-slices`, `desk-rigor`, `h4-zone-trail`), the
barrier entries of the Mosha desk lost out of sample (`desk-rigor`), and a barrier + QM rule on gold failed (`barrier-qm-janda`).
What is new here: the zone is an EF (a failed engulf), the confirmation is one M15 break, and the target is the next opposite
H4 engulf zone at 2R or more (median targets of the earlier box rules were under 1R).
