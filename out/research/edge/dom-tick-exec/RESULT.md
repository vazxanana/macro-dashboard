# DOM zone limit on the broker's own bid / ask (result)

**Verdict: FAIL. On the demo broker's own ticks the H1 DOM zone limit made -0.111R a filled trade before costs (n 1,706, month t -3.73), against -0.028R on mid candles for the same orders.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, with its amendment of 23 Nov 18:00 UTC: a sell target placed on
the wrong side by the first query files, fixed before any verdict). Research only: nothing live changed.

## What was run

1,200 orders a market (gold, USD/JPY), sampled with a fixed seed from the H1 DOM zone limit of `combo-grid-3` (1h > 5m dom,
zone edge, 2R) between 24 Nov 2023 and 20 Nov 2026, each judged on the demo broker's own bid / ask ticks read by the tick
probe: a buy fills only when the ASK reaches the limit, a sell only when the BID does; the exit is the first stop tick or the
first target tick after the fill, else the time-exit quote. Probe batches dom-b1, c1, c2 and the retry r1 (the queries c1 and c2
lost to the broker's per-account request limit, asked again one run at a time: 0 errors).

## Result (before costs; after commission beside)

| | n | R a filled trade | month t | after commission |
|---|---:|---:|---:|---:|
| Pooled, tick fills (T2) | 1,706 | -0.111 | -3.73 | -0.157 (t -5.15) |
| Pooled, tick minus mid, paired (T1) | 2,324 | -0.054 | -2.58 | -0.038 |
| Gold, tick fills | 821 | -0.100 | -2.13 | -0.131 |
| USD/JPY, tick fills | 885 | -0.121 | -3.56 | -0.181 |
| Mid candles, the same orders | 2,284 | -0.028 | | -0.078 |

605 orders the mid candles filled were not filled by the broker's prices (the ask or bid never reached the limit), and 196 of
those were mid-candle winners: the limit is filled less often on real prices and the fills it gets are the worse ones.
Exits: 1,182 stops, 453 targets, 71 time exits.

## What it says

The dominant-zone limit's small tilt on mid candles (research/edge/dom-zone-holdout, +0.05R) was already absent in this
window on mid candles (-0.028R), and on the broker's real bid / ask it loses clearly. With `dom-placebo` (a random body does
as well) and `dom-trade-through` (+0.011R with a stricter fill), the DOM zone limit is closed: not an edge. The forward demo
record of `council/dom-demo.mjs` stays a record only.

Files: `run.mjs`, `result.json` (per market, year and side), the query files and the probe outputs on council-data
`research/probe/ticks-*-dom-*.json`.
