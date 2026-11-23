# Combination grid: engulf, Mosha and direction pieces on 2020 to now (pre-registration)

Written 23 Nov 2026, before any run of this grid. Owner: "find all the combinations or rules possible between them … only
focus from market 2020 till today and do the most combinations possible … just EG, Mosha, MSNR stuff, drop ICT".

## What is tested

Every combination of the pieces below, as one mechanical rule each, on OANDA mid 5-minute candles of xau, eurusd, gbpusd,
usdjpy and audusd from 2020-01-01 to the last candle on file (22 Nov 2026), through `research/edge/_lib/edgekit.mjs`. Each
piece is a reading in this repository's own words (the definitions are those already used by the desks and the studies);
none is a tested rule.

1. **Chain** (key-level timeframe → trigger timeframe): D1 → H4, H4 → H1, H4 → M15, H1 → M15, H1 → M5. D1 = 17:00 New York
   trading days (`dailyNY`).
2. **Key zone** on the first timeframe, with the side it serves:
   EG (engulf completed within 3 candles, the base candle wick to wick; `council/eg-methods.mjs` `zones`),
   EGn (the next-candle engulf), EF (a failed engulf, serving the other side for 20 days or until a close back through it),
   DOM (two candles of one colour, the second closing beyond the first's extreme; zone = the first candle's body),
   A / V level (a turn of the closes, 2 candles a side; zone = from the close to the wick),
   barrier (the candle at the origin of a structure break's leg, wick to wick),
   QM zone (head to shoulder of a QM, `edgekit.qms`),
   box (the half of a broken swing box nearest its break, `edgekit.boxesHL`).
   A zone exists from the close that completes it and ends at a close through its far side or after 120 candles.
3. **Visit**: the first touch only, or the first and second touch (a visit ends when a closed trigger-timeframe candle is wholly
   outside the zone).
4. **Direction** (read at the signal, closed candles only): none; the first timeframe's structure side (BO / ChoCh,
   `edgekit.structure`, K 3); the structure side of the timeframe above it (weekly for D1); the direction call of
   `council/eg-methods.mjs` `direction` (external break after a tapped key level of the timeframe above); the side of the last
   Daily engulf.
5. **Trigger** on the second timeframe, within 12 of its candles after the touch, while the zone stands:
   none (a limit at the zone), an engulf of the side, a failed engulf of the other side (EF), a structure break with the side
   (K 2), a QM of the side, a break against the side followed by a break with it (the VR → CF reading).
6. **Entry**: at the trigger's close (market); a limit at 50 % of the trigger zone; a limit at the trigger zone's near edge;
   with no trigger, a limit at the key zone's near edge or its 50 %. Limits live 12 trigger candles.
7. **Stop**: past the trigger zone; past the key zone; past the extreme made since the touch; each by half the round-trip
   cost. A stop is always on the losing side; a trade risking under two round-trip costs is skipped.
8. **Exit**: a fixed 1R, 2R, 3R, 4R or 6R target; the nearest opposite zone of the same kind (1R or more away, else 2R); a
   trailing stop 1R behind the best price from +1R. Time limit: 10 days (D1 chain), 5 days (H4), 2 days (H1). Stop first
   when one candle holds both; a gap through the stop exits at the open; on a limit's fill candle only the stop counts.

About 19,000 entry rules x 7 exits = about 130,000 combinations, each on the five markets pooled and on each market alone.

## Costs and statistics

R after `edgekit.COSTS` (the demo account's round trips). Each signal is its own trade (no one-at-a-time rule). Month-sum t
(calendar-month sums of R). Windows: discovery 2020-01-01 to 2023-12-31, confirmation 2024-01-01 to now.

## What counts

A combination is **confirmed** only if: discovery n >= 100 and mean R > 0 with month t >= 2; confirmation n >= 50, mean R > 0
with month t >= 2 after Holm over every combination that passed discovery; and confirmation mean R > 0 at twice the cost.
Reported: how many combinations pass discovery, how many confirm, and how many would confirm by chance (the discovery
winners' count x the one-sided rate of t >= 2 under no edge, and a placebo where every trade's side is flipped).

## Honest limits, written before the run

2020-2026 has already been read by many studies of these same pieces (desk-rigor, desk-partial, ltf-structure, the overnight
studies), so a confirmation here is weaker evidence than a pass on untouched data; it would earn a forward paper record, not
a live rule. Nothing live changes from this study.
