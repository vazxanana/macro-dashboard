# What a Sunday-reopen fade really costs: the spread at Rule G's entry and exit (14 Nov 2026)

**Verdict: NOT MEASURABLE (inconclusive: a cost that could not be measured, not a failed rule).** No real spread source covers the Sunday reopen for the pairs and years Rule G trades.
The site's candle proxy serves OANDA mid prices only; the demo broker's quotes on file cover **one** Sunday
reopen (8 Nov 2026) and **five** pairs (EUR/USD, GBP/USD, AUD/USD, USD/CAD, USD/CHF), against the pre-registered 20 reopens a
pair. Not one of the three headline tests has all its pairs measured, so none was re-costed. The question stays open: Rule G's
results rest on assumed reopen spreads, and the arithmetic below shows how little room they leave. Never call it an edge.

Cost measurement only: no rule tested, nothing live changed, no API or cost constant touched. The sources, the measurement,
the coverage rule, the re-costing rule and this verdict's wording were committed alone before any code existed
(`PREREGISTRATION.md`, commit 594dd755). `frozen.mjs` is #880's `research/edge/fx-weekend-gap/run.mjs` byte for byte, sha256
`3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273` (pinned by the test), the file #928 and #938 also copied.

## When Rule G trades (from the frozen code)

Entry at the **close of the reopen candle**: the first OANDA mid M5 candle starting at or after Sunday 17:00 New York, so
**Sunday 17:05 New York** (22:05 UTC in winter, 21:05 UTC in summer). Exit at the stop or the target on a later M5 candle
(stop first), else at the close of the last M5 candle ending by Monday 12:00 New York. The entry is the widest-spread minute of
the forex week; the exits fall anywhere from Sunday evening to Monday noon New York.

## The sources

| Source | Covers the reopen? | Why |
|---|---|---|
| (a) site candle proxy `/md/bars` | **No** | `api/bars.js` asks OANDA for `price: 'M'` and keeps `c.mid`: mid candles only. Not modified. |
| (b) demo broker quotes, council-data `ctrader/symbols.json` and its 906-commit history (from 7 Nov 2026) | **One reopen, five pairs** | Bid / ask per council round (every 5-10 min). Forex symbols: EUR/USD, GBP/USD, AUD/USD, USD/CAD, USD/CHF; no JPY pair, no cross, no NZD/USD. Only Sunday in the history: 8 Nov 2026. 3,164 forex reads, 8 Nov 22:09 to 13 Nov 21:58 UTC. |
| (c) anything else in council-data | **No** | HistData M1 and Kraken candles carry one price; `trades.json` carries the model's `costR`, not a quote; snapshot / config mention spreads as model figures. |

## The gate (passed)

For every trade of the six tests, the frozen formula with the study's own spread gives its published base net R (largest
difference 0.000095, inside the published rounding), and the frozen `stats()` on the published trade lists reproduces each
study's published n, gross R, base net R, stress net R, trade t and monthly t exactly.

| Study | Test | n | net R a trade | monthly t | gate |
|---|---|---|---|---|---|
| #880 | Rule G 2020 to now (headline) | 243 | +0.194 | 2.14 | passed |
| #928 | R1, crosses 2020 to now (headline) | 294 | +0.238 | 2.99 | passed |
| #938 | S2, new pairs 2016 to now (headline) | 481 | +0.153 | 3.19 | passed |
| #880 | Rule G 2016-19 | 173 | +0.034 | 0.39 | passed |
| #928 | R2, majors 2010-15 | 297 | +0.003 | 0.03 | passed |
| #938 | S1, crosses 2010-19 | 588 | +0.061 | 1.02 | passed |

## Measured against assumed, per pair

| Pair | Reopens with an entry read (need 20) | Measured? | Assumed quoted spread (round trip) | Studies that trade it |
|---|---|---|---|---|
| EUR/USD | 1 | no | 0.3 | #880, #928 R2 |
| GBP/USD | 1 | no | 0.3 | #880, #928 R2 |
| AUD/USD | 1 | no | 0.3 | #880, #928 R2 |
| USD/CHF | 1 | no | 0.3 | #880, #928 R2 |
| USD/CAD | 1 | no | 0.3 | #938 S2 |
| USD/JPY, EUR/JPY | 0 | no | 0.3 | #880, #928 R2 |
| the six crosses of #928 | 0 | no | 0.4-1.3 | #928 R1, #938 S1 |
| NZD/USD, CAD/JPY, NZD/JPY, AUD/NZD, AUD/CAD | 0 | no | 0.4-1.0 | #938 S2 |

Re-costable: none. #880's headline lacks all six pairs as measured (four have one reopen, two none); #928 R1 and #938 S2 have
no measured pair at all (USD/CAD, S2's only pair with a read, has one reopen).

## What one weekend shows (8 Nov 2026; descriptive, n = 1 reopen, not in the verdict)

Rule G's entry minute that Sunday was 22:05 UTC. The demo broker's first read came 4-5 minutes later.

| Pair | Read nearest the entry (spread, pips) | Reads in the first hour (pips) | Exit window, Sun 17:10 to Mon 12:00 New York: n, median, 90th pct, share at 0 |
|---|---|---|---|
| EUR/USD | 22:10, **0.6** | 0.6 throughout | 109, 0.0, 0.0, 92 % |
| GBP/USD | 22:10, **1.0** | 1.0 (one 2.3 at 22:30) | 109, 0.0, 0.1, 89 % |
| AUD/USD | 22:10, **0.6** | 0.6 (one 1.2 at 22:30) | 109, 0.0, 0.0, 92 % |
| USD/CAD | 22:10, **4.6** | 2.0, then 3.0 at 22:55 | 109, 0.0, 0.0, 93 % |
| USD/CHF | 22:09, **14.5** | 2.0 from 22:17 | 108, 0.0, 0.0, 94 % |

Seen in the same reads: at 23:00 UTC (Sunday 18:00 New York) USD/CAD showed 8.2 pips and USD/CHF 11.5, then every pair
fell to 0-0.6 pips from 23:05 and stayed near 0 (the raw-spread account's normal state). One Sunday cannot give a median for
2016 to now, nor a year-by-year figure, and it holds no JPY pair or cross.

## How wide the reopen spread may be (arithmetic, not a measurement)

`C` = the round-trip spread cost in pips, (entry spread + exit spread) / 2, the same for every pair of a test, in place of the
assumed quoted spread; slippage (1 pip a side) and commission unchanged. With the exit at the raw account's usual 0, the entry
spread at break-even is `2 C`.

| Test | assumed C (mean) | median risk, pips | C at monthly t = 2 | entry spread at t = 2 (exit 0) | C at net R = 0 | entry spread at net 0 (exit 0) |
|---|---|---|---|---|---|---|
| #880 Rule G 2020 to now | 0.30 | 33.0 | **0.69** | **1.38** | 5.79 | 11.58 |
| #928 R1 | 0.76 | 33.8 | **2.66** | **5.32** | 6.56 | 13.12 |
| #938 S2 | 0.77 | 25.2 | **2.13** | **4.26** | 4.28 | 8.56 |
| #880 Rule G 2016-19 | 0.30 | 27.1 | under 2 at C = 0 | — | 1.15 | 2.30 |
| #928 R2 | 0.30 | 37.8 | under 2 at C = 0 | — | 0.38 | 0.76 |
| #938 S1 | 0.78 | 36.4 | under 2 at C = 0 | — | 2.30 | 4.60 |

Read with the one weekend above (not a test): #880's headline keeps t 2 only while the majors' entry spread averages under
about 1.4 pips; on 8 Nov EUR/USD (0.6), GBP/USD (1.0) and AUD/USD (0.6) read under that, USD/CHF (14.5) far over it. These
figures say how much room there is, not how much the reopen costs.

## What would make it measurable

- **Bid / ask candles from OANDA**: OANDA's API serves `price=BA` candles back to 2005 for every pair of the three studies;
  the site's proxy fixes `price: 'M'`. Passing the price component through (an owner decision about `api/bars.js`, not done
  here) would give the spread at 17:05 New York on every Sunday since 2010, at OANDA's own spread (not the demo broker's).
- **The demo broker's tick history**: cTrader's Open API can return historical bid and ask ticks per symbol; the read-only
  session the council already uses could fetch the reopen minutes of past Sundays for the symbols the account lists (the
  broker's own cost). Credentials are not reachable from this sandbox.
- **Waiting**: the council keeps reading the broker's quotes every round; 20 more Sundays (about April 2027) would meet the
  pre-registered coverage for the five symbols the file lists, still with no JPY pair or cross, and reads land 0-10 minutes
  from the entry minute, not at it.

## Not done, said

- No pair was given a guessed or borrowed spread; no figure of the re-costed headline tests is reported, because none was
  re-costable.
- The trade lists carry no exit time, so the per-trade exit read of the measurement section could not be used; the re-costing
  rule's exit-window median (0 on the one weekend, for these five pairs) is what a measured re-cost would have charged.
- The verdict's words are the pre-registered "NOT MEASURABLE"; the parenthesis after them was added after the result so the
  Edge lab does not list a cost that could not be measured as a failed rule.
