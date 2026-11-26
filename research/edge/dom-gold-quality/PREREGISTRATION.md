# Pre-registration: dom-gold-quality (26 Nov 2026)

Paper research only. Nothing live changes, no rule is proposed. Written and pushed alone, before any figure of this study is
computed. Owner's request (26 Nov 2026): "DOM ZONE gold is good after costs but we need to improve it or filter the good trades".

## What is already known (so this is not run blind)

- `dom-gold-hourcost`: the H1 dominant-zone limit on gold, 4R exit, at the demo broker's measured costs (C1) made -0.015R a
  trade in 2021-23 (n 8,850, month t -0.48) and +0.072R in 2024-now (n 8,911, t 3.33). FAIL as a rule: good in one half only.
- `dom-filters` (2010-19, five markets, before costs): 0 of 13 single filters picked better trades in both halves; the nearest
  was `sideways` (the two H1 candles after the zone formed did not touch it).
- `dom-placebo`: a random earlier same-colour body does as well as the DOM zone. `dom-tick-exec`: at the broker's own ticks the
  limit fills worse than on mid candles (all markets pooled).
- The desk's 2026 record on gold: +0.069R a trade after a flat cost (n 1,043), sells +0.155R, buys -0.011R, in a year gold fell.

So the honest prior: the 2024-now result may be a regime, and single filters have failed. This study asks one narrower question:
can what is known when the order fills, taken together, separate the better gold trades from the worse ones on years the
selection did not see.

## Trades

Exactly `dom-gold-hourcost`'s gold trade list (`trades(M5)` of its `run.mjs`, imported, not edited; OANDA mid 5-minute candles,
the shared cache; gates G1 and G3 of that study must hold again), 4R exit, net R = R - `costR(row, '4R', prof, 'C1')` with the
same probe profile (council-data `research/probe/ticks-XAUUSD.json`). Window A (fit) = fills 2021-01-01 to 2023-12-31; window B
(judge) = fills from 2024-01-01 to the end of the cache.

## Features (each known at the fill, from candles closed before it or from the order itself)

1. side: buy / sell
2. session of the fill hour (UTC): Asia 22-06, London 07-11, New York 12-16, late 17-21
3. ex-ante cost share: ((spread share of the fill hour + commission) x fill + 0.05 x M) / risk; terciles, cuts from A
4. stop size: risk / ATR(14) of H1 at the last closed H1 candle; terciles, cuts from A
5. sideways: the two H1 candles after the zone formed did not touch it (combo-grid-3's definition): yes / no
6. H1 trend: last closed H1 close against the mean of the last 200 H1 closes, read against the side: with / against
7. 20-day move: last closed UTC daily close against the close 20 daily candles earlier, against the side: with / against
8. 20-day efficiency ratio of daily closes: terciles, cuts from A
9. zone age: closed H1 candles from the zone's second candle to the fill: 0-3 / 4-12 / over 12
10. weekday of the fill (UTC): Monday / Tuesday-Thursday / Friday

## Score (fitted on A only)

For each level of each feature: (mean net R of A trades at that level - mean net R of all A trades) x n / (n + 200). A trade's
score = the sum over the ten features. Cuts = the terciles of the A scores. On B, with those level values and cuts unchanged:
KEEP = top third, AVOID = bottom third, MID = the rest.

## Test (one) and verdict

On window B, net R after C1:

- **PASS** needs all of: (a) KEEP mean > the mean of all B trades and KEEP minus (MID + AVOID) has Welch t >= 2; (b) KEEP's
  month-sum t >= 2 and mean > 0; (c) placebo: the A outcomes shuffled among A trades and the score refitted, 40 seeds; the real
  KEEP mean on B beats at least 38 of the 40 shuffled ones.
- **USEFUL TO AVOID** (if not PASS): AVOID minus (KEEP + MID) has Welch t <= -2 and AVOID's mean < 0.
- **FAIL** otherwise.

Even a PASS is a hypothesis from in-sample years for the forward demo record (`council/dom-demo.mjs --variant gold4r`), never an
edge: 2020-26 has been read by the grids that chose this family.

Reported beside, none a verdict: each feature's level table on A and on B; KEEP / MID / AVOID on A (in sample) and per year;
the same three groups before costs; a cut test (features of trades before a cut date are identical when later candles are removed).

One run. No feature, level, shrinkage or cut changes after the result; no variant on these years.
Deliverables: `run.mjs`, `RESULT.md`, `result.json`, `tests/dom-gold-quality.test.mjs`.
