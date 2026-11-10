# Mosha sweep, VR and CF: result (10 Nov 2026)

**Verdict: FAIL, both entries. Selling (or buying) at the CF lost −0.11R a trade after costs over 6,260 trades (t −4.62); entering on the return to the zone of the next break lost −0.21R a trade over 6,478 trades (t −7.36). Both lose on 2006-19, the candles no earlier test had read, and on 2020 to now. Taken every time by fixed rules, the sweep, VR and CF pattern is not an edge on gold.**

Paper research only. No live rule, size, filter or mirror setting was changed. The rule, both entries and the verdict were
fixed in `PREREGISTRATION.md` (commit 025e6e29) before the detector read the test candles.

## What was tested

The reading the owner's own example trades point to, confirmed by the owner with "Test both" (both ways of entering):

1. A prior H1 swing high is swept (an M5 candle trades above it).
2. The M5 VR: from the highest high down to the last M5 swing low before it (the owner's red "5 mn" box).
3. The M5 CF: a close below the VR's low, within 12 hours.
4. **Entry "CF"**: sell at the close of the CF candle, stop $0.30 above the high.
   **Entry "ZONE"**: sell limit at the next M5 low broken after the CF, stop $0.30 above that break's zone.
5. Target: the nearest H4 engulf zone or H4 swing low at least 2R away. Out after 72 hours. One trade at a time per entry
   style. Buys are the mirror image. Cost $0.30 a round trip.

Data: OANDA spot gold M5, 1 June 2006 to 9 Nov 2026 (1,458,888 candles). Fills on M5, stop first when one candle holds
both.

**The detector finds the owner's trades it can see.** 28 Oct sell (owner: 4048.59 / 4076.69 / 3971.09): entry "CF" sells
4047.74, stop 4083.13, target 3975.65, target reached. 10 Nov sell (owner: 4120.42 / 4128.92 / 4072.84): entry "ZONE" sells
4121.65, stop 4128.28, target 4073.45, target reached. The 2 Nov trades were read on M1 and M30 and are outside this rule.

## Result (net of cost)

| Entry | Window | Trades | Win rate | R a trade | Total R | t |
|---|---|---|---|---|---|---|
| **At the CF** | whole period | 6,260 | 25.7 % | **−0.109** | −681.7 | −4.62 |
| | 2006-19 (untouched) | 3,991 | 26.8 % | −0.104 | −414.9 | −3.52 |
| | 2020 to now | 2,269 | 23.8 % | −0.118 | −266.8 | −3.01 |
| | before costs | 6,260 | 25.8 % | −0.031 | −191.7 | −1.30 |
| | at twice the cost | 6,260 | | −0.187 | | |
| **At the zone** | whole period | 6,478 | 18.0 % | **−0.214** | −1,385.5 | −7.36 |
| | 2006-19 (untouched) | 4,059 | 18.7 % | −0.232 | −942.8 | −6.58 |
| | 2020 to now | 2,419 | 16.7 % | −0.183 | −442.7 | −3.63 |
| | before costs | 6,478 | 18.0 % | −0.068 | −442.4 | −2.35 |
| | at twice the cost | 6,478 | | −0.359 | | |

Every pre-registered test fails for both entries except the trade count.

- **Years.** At the CF: 2 of 21 calendar years end above zero (2011 +0.01R a trade, 2019 +0.07R). At the zone: 1 of 21
  (2026, +0.07R).
- **Sides.** At the CF: sells −0.16R (3,387), buys −0.05R (2,873). At the zone: sells −0.27R (3,392), buys −0.15R (3,086).
  Gold rose over the period, so sells do worse, but buys lose too.
- **Exits.** At the CF: 4,525 stops, 1,069 targets, 666 on time; a winner pays 2.7R, a loser costs 1.07R, break-even needs
  28.6 % winners and the rule gets 25.7 %. At the zone: 5,299 stops, 1,026 targets, 153 on time; a winner pays 4.1R, a loser
  1.15R, break-even needs 22.1 % and the rule gets 18.0 %.
- **Stops and costs.** The median stop is $4.63 at the CF and $2.15 at the zone. Before costs the CF entry is about zero
  (−0.03R, t −1.30) and the zone entry slightly negative (−0.07R, t −2.35); the $0.30 cost does the rest. The M5 fills
  count the stop first when a candle holds both, which is hard on $2 stops; the same zone entry judged on M1 fills in
  `mosha-level` lost −0.35R, so the loss is not made by the coarser candles.

## Funnel (whole file)

34,189 H1 swing levels → 30,578 sweeps → 27,387 CFs. At the CF: 25,027 candidate orders (2,188 with no target 2R away,
172 with a stop under $1), 6,260 taken, 18,741 dropped because a trade of that stream was already open (one move usually
sweeps several H1 highs at once, giving the same trade). At the zone: 18,811 further breaks → 16,135 candidates, 6,988
orders placed, 6,478 filled, 431 missed (the target traded first), 79 expired.

## What this says, with the day's other three studies

- Four pre-registered readings of the owner's Mosha trading, fifteen tests, two data sources, twenty years: the level tap
  (−0.35R), the retracement chain (+0.02R), the buy at the barrier (−0.22R), and now the sweep with its VR and CF (−0.11R
  and −0.21R). The retracement chain breaks even; the rest lose. None is an edge as a fixed rule.
- The pattern is real in the sense that it happens constantly: an H1 high or low is swept and M5 confirms about five times a
  trading day. That is the difficulty. The owner's five examples are five winners out of thousands of look-alikes, and what makes
  those five different is not in any rule written so far.
- It still says nothing about the owner's own results. The owner chooses which sweeps to trade, reads M1 and M30 as well,
  and manages the exit by hand. The honest measurement left is the owner's own logged trades.

## Reproduce

```sh
node research/edge/mosha-sweep/run.mjs fetch /tmp/oanda            # about 440 requests through the candle proxy, 18 MB
CANDLES=/tmp/oanda node research/edge/mosha-sweep/run.mjs run      # writes result.json
node research/edge/mosha-sweep/run.mjs example                     # the owner's trades on the last three weeks
```
