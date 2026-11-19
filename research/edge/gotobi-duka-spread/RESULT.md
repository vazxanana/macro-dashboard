# Gotobi on bid and ask: the fade after the 09:55 Tokyo fix filled on the side that trades

**Verdict: NOT MEASURABLE (inconclusive: Dukascopy's datafeed host refused every connection from this build sandbox, 30 of 30 probe files failed; no bid / ask candle could be read).** The pre-registered coverage probe (step 1) asked for 30 Dukascopy minute files (BID and ASK, 5 yen pairs, 3 gotobi days) and received 0. By the pre-registration the study stops here: no spread at 00:55 or 06:00 UTC, no bid / ask trade, no feed check and no placebo was computed, and no other source was put in Dukascopy's place. The gotobi T2 result and `gotobi-cost`'s break-evens (3.73 pips a round trip at net 0, 1.95 at month t 2 on USD/JPY 2016-now; 3.20 / 1.81 on the crosses pooled) stand as they were, still on unmeasured spreads. Pre-registered in PREREGISTRATION.md (first commit of the branch); the rule is frozen.mjs, byte for byte (sha256 `645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32`). Paper research only; nothing live changed.

## Coverage probe

Run 2026-11-14T02:27:24Z from the build sandbox with `node --use-env-proxy` (node fetch through the environment's HTTPS proxy, then curl through the same proxy).

| Day | Symbol | BID | ASK |
|---|---|---|---|
| 2010-01-05 | USDJPY | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 |
| 2010-01-05 | GBPJPY | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 |
| 2010-01-05 | AUDJPY | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 |
| 2010-01-05 | CADJPY | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 |
| 2010-01-05 | CHFJPY | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 |
| 2016-02-05 | USDJPY | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 |
| 2016-02-05 | GBPJPY | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 |
| 2016-02-05 | AUDJPY | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 |
| 2016-02-05 | CADJPY | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 |
| 2016-02-05 | CHFJPY | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 |
| 2026-11-10 | USDJPY | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 |
| 2026-11-10 | GBPJPY | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 |
| 2026-11-10 | AUDJPY | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 |
| 2026-11-10 | CADJPY | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 |
| 2026-11-10 | CHFJPY | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 | failed: fetch fetch failed (Request was cancelled.); curl curl: (56) CONNECT tunnel failed, response 403 |

Distinct failures: `fetch failed (Request was cancelled.)`, `curl: (56) CONNECT tunnel failed, response 403`.

## What was not computed, and why

- Measurement A (the quoted spread at 00:55 and 06:00 UTC by pair and year, gotobi against other days, and the one-minute mid change), Test B (the frozen T2 signals on mid, filled at BID / bought back at ASK, commission USD 22.5 per million a side, plus 0.3 pip a side of extra slippage; streams USD/JPY 2016-now, USD/JPY 2010-15, crosses pooled 2010-now; Holm), the feed check against gotobi-cost/trades.json and the 40-seed placebo: none was run, because no candle could be read.
- Not substituted, on purpose: OANDA through the site's candle proxy is mid only (api/bars.js asks for price "M"; api/ was not changed); council-data's HistData USD/JPY M1 files (2018-2026) carry one side only, so no spread can be taken from them; the crosses have no minute file in council-data at all.
- The proxy's own log named the refusal for every request: "connect_rejected", the gateway answering 403 to CONNECT datafeed.dukascopy.com:443 (also www.dukascopy.com and freeserv.dukascopy.com). Dukascopy itself was never reached, so this says nothing about whether it serves these files: council-data's research/probe/cnbc2/duka.txt shows a GitHub Actions runner received a Dukascopy file (HTTP 200) earlier.
- One departure from the order in the brief, said plainly: a few reachability requests (the USDJPY BID and ASK minute files and the 00h tick file of 5 Jan 2016, and the home pages of www.dukascopy.com and freeserv.dukascopy.com) were made before PREREGISTRATION.md was written, and all were refused the same way; nothing was downloaded, so no figure could have shaped the pre-registration.
- How to run it where the host is reachable: a runner that can reach datafeed.dukascopy.com (a GitHub Actions job, as the ICT back-fills used) runs the pre-registered steps 1-5 unchanged, with the minute files cached outside git; this probe script then reports them reachable and stops without a verdict, so the measurement code must be added under this same pre-registration before any figure is read.
