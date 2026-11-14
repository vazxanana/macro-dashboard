# Rule G on Dukascopy bid / ask, and the real Sunday-reopen spread (14 Nov 2026)

**Verdict: NOT MEASURABLE (inconclusive: Dukascopy is not reachable from this runner).** No spread measured, no test run.
The pre-registered coverage probe could not fetch a single Dukascopy bid, ask or tick file: the egress proxy refuses every
Dukascopy host, and no Dukascopy forex bid / ask file exists in the repository, in council-data or on this machine. By
the pre-registration's stop rule the study ends at the probe: no reopen spread was measured, Rule G was not rerun, and no
feed check or placebo was computed. Nothing here is a result about Rule G, for or against. Never call it an edge.

Paper research only: no rule tested, nothing live changed, no `api/`, config or council file touched. The method, the bar
and this stop rule were committed alone before any code (`PREREGISTRATION.md`, commit e815b35b). `frozen.mjs` is #880's
`research/edge/fx-weekend-gap/run.mjs` byte for byte, sha256 `3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273`
(pinned by `tests/weekend-gap-duka.test.mjs`), the file #928, #938 and #944 also copied; it was not run here (there are no
candles to run it on).

## The coverage probe

`node --use-env-proxy run.mjs probe` (14 Nov 2026), and the same requests by `curl` through the session proxy before the
pre-registration was written. One request per file, status and size only; no price decoded.

| File asked for | Answer |
|---|---|
| `datafeed.dukascopy.com/…/EURUSD/2024/02/10/BID_candles_min_1.bi5` (Sunday 10 Mar 2024) | refused by the egress proxy (CONNECT 403, `connect_rejected`) |
| the same, `ASK_candles_min_1.bi5` | refused |
| EURUSD ASK, 8 Feb 2012 | refused |
| USDJPY ASK, AUDNZD ASK (10 Mar 2024), EURGBP ASK (10 Jan 2010) | refused |
| EURUSD hour ticks `…/2024/02/10/22h_ticks.bi5` | refused |
| `www.dukascopy.com` (same path), `freeserv.dukascopy.com` (chart JSON) | refused |
| plain `http://datafeed.dukascopy.com/…` | does not resolve inside the sandbox (`ENOTFOUND`) |

The proxy's own status page names the cause: "the egress proxy refused the connection; a refusal most often means that the
host is not allowed for this session". Every row is in `result.json` (`coverage.probe`). Nothing was retried through another
route: a mirror of someone else's copy of the data would not be Dukascopy's file, and nothing was invented.

Looked for without the network: council-data holds two Dukascopy files, both NQ index candles
(`research/candles/nq-duka-dec-sep.json.gz`, `nq-duka-mar-sep.json.gz`), and two probe logs; `council/duka.mjs` fetches and
caches BID files only, and its cache folder (`DUKA_CACHE`, a GitHub Actions cache) is not on this machine.

## What is still open (from the earlier studies, not measured here)

- The reopen spread of the eighteen pairs at Rule G's entry minute (Sunday 17:05 New York) remains unmeasured for every year.
  #944's arithmetic still stands as the only guide: #880's headline keeps a monthly t of 2 only while the majors' entry
  spread averages under about 1.4 pips; #928 R1 under about 5.3 pips; #938 S2 under about 4.3 pips (exit spread taken as 0).
  Those are break-even widths, not costs.
- No second-feed check of Rule G exists: all three headline tests (#880, #928 R1, #938 S2) are OANDA mid M5 alone.

## What would make it measurable

- **A runner that can reach Dukascopy.** The backtest workflow (`backtest.yml`) is wired to read Dukascopy BID files on
  GitHub's runners through `council/duka.mjs` (whether they answer there was not checked here). A workflow or session there could fetch BID and ASK minute files
  (about 2 x 18 pairs x 17 years of Sundays and Mondays, plus the ATR warm-up weekdays) and run this pre-registration
  unchanged; its RESULT.md must say where and when the probe passed. Adding Dukascopy to this session's allowed hosts is an
  environment decision for the owner, not taken here.
- The other two routes #944 named (OANDA `price=BA` candles through the proxy, which is an `api/bars.js` change; the demo
  broker's tick history) are unchanged and not this study's.

## What was built, so the next run starts from checked code

`run.mjs` holds the probe and the pre-registered pieces as pure functions, tested offline on a small hand-made fixture
(`tests/weekend-gap-duka.test.mjs`): mid minutes from bid and ask (a one-sided minute dropped), M1 to M5 by UTC bucket, the
spread at a moment (close of the last minute at or before it), the trade on the side that fills (entry on the ask for a buy,
exits on the bid, stop first, a gapped open at the open, time exit at the exit side's close), the net R with slippage and
commission only (the spread is inside R), and Holm over three sets. The candle fetch, Measurement A, Test B, the feed check
and the placebo loops are not written: with no data they could not be checked, and an unchecked study loop is worse than
none.

## Departures from the brief

- The coverage probe ran before `PREREGISTRATION.md` was written, as the brief orders (step 2 comes before the
  measurement); it read no price. The pre-registration records it and fixes the whole method anyway.
- The brief asks for a Holm "across the three headline pair sets"; the pre-registration fixes it at one-sided adjusted
  p < 0.05 together with the monthly t ≥ 2, and a study PASS as at least one set passing.
- No `result.json` field carries a spread, a return or a placebo figure: they are `null`.
