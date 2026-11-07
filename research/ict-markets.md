# ICT desk: market expansion (7 Nov 2026)

**Question.** The ICT desk's A-rule (H1 iFVG reversal, A-setups) trades NQ, ES, YM, RTY and GC: +0.30R a trade gross over 253
trades in the replay (1 Aug 2025 - 7 Nov 2026), +0.275R after futures costs. Does the same rule, unchanged, hold on markets the
desk does not trade yet?

**Verdict.**
- **One market passes the gate: spot silver (XAG/USD) under gold's rule.** n 82, +0.41R a trade after costs, t 2.02, positive
  in both halves (+28.3R / +5.4R). It is now a **paper-only shadow stream** (`silver`). It is not live, sends no alerts and is
  not mirrored to cTrader. The owner decides on anything more.
- **Treat the silver pass with care.** t 2.02 only just clears the bar, and 16 cells were tested. On HistData's silver feed it
  is t 1.91. Over 2018-23 the same rule lost heavily on silver (−79.5R, t −3.3, research/edge/ict-universe). The second half is
  much weaker than the first (+0.16R vs +0.58R a trade). In its favour: random silver buys with the same stop and exit made
  only +0.11R in this window, so the signal adds about +0.30R a trade beyond simply being long silver.
- **Every other market fails.** Spot gold works (+0.20R) but adds nothing beyond random gold buys and repeats GC. FX, the DAX
  and crypto fail (details below). **No market was added to the live A-stream.**

## Gate
A market qualifies as a paper candidate only with **n ≥ 30, t ≥ 2 and positive total R in both halves**. The halves are
1 Aug 2025 - 20 Mar 2026 and 20 Mar - 7 Nov 2026 (the window's midpoint). Everything is net of costs.

## Results (net of costs, 1 Aug 2025 - 7 Nov 2026)

Primary rule set = the one the desk would use: GC's gold rule for the metals, the index default for everything else.

| market | rule | n | win% | R / trade | total R | max DD | t | 1st half (n, R) | 2nd half (n, R) | verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| **XAG/USD (silver)** | gold | 82 | 45% | **+0.41** | +33.6 | −7.3 | **2.02** | 49, +28.3 | 33, +5.4 | **PASS → paper shadow** |
| XAU/USD (spot gold) | gold | 75 | 41% | +0.20 | +14.8 | −8.5 | 1.00 | 42, +11.9 | 33, +2.8 | fail: t < 2; no edge beyond random buys; same market as GC |
| EUR/USD | index | 59 | 39% | −0.16 | −9.3 | −10.8 | −1.24 | 34, −7.2 | 25, −2.1 | fail: negative |
| GBP/USD | index | 63 | 33% | +0.03 | +2.0 | −8.7 | 0.19 | 32, −1.6 | 31, +3.6 | fail: no edge |
| USD/JPY | index | 55 | 36% | −0.14 | −7.7 | −9.9 | −1.02 | 28, −6.0 | 27, −1.6 | fail: negative |
| DAX (DE40) | index | 62 | 44% | +0.08 | +4.7 | −12.1 | 0.49 | 37, +8.7 | 25, −4.0 | fail: t < 1, 2nd half negative |
| BTC | index | 76 | 21% | −0.64 | −48.6 | −48.6 | −5.17 | 32, −21.8 | 44, −26.8 | fail: Kraken fees eat the edge |
| ETH | index | 65 | 26% | −0.32 | −20.7 | −23.9 | −2.18 | 33, −13.9 | 32, −6.8 | fail: Kraken fees eat the edge |
| *baseline: live A-stream* | *live* | *253* | *39%* | *+0.275* | *+69.7* | *−13.0* | *2.58* | *80, +30.9* | *173, +38.8* | *(NQ ES YM RTY GC)* |

Max DD is the deepest peak-to-trough fall of cumulative net R. t = mean / (sd / √n).

The other rule set, for completeness (8 more cells, none passes):

| market | rule | n | R / trade | total R | t | 1st / 2nd half R |
|---|---|---|---|---|---|---|
| XAG/USD | index | 61 | −0.16 | −9.9 | −0.98 | −10.8 / +1.0 |
| XAU/USD | index | 38 | −0.20 | −7.4 | −0.93 | −6.9 / −0.6 |
| EUR/USD | gold | 79 | −0.22 | −17.7 | −1.55 | −7.4 / −10.3 |
| GBP/USD | gold | 85 | −0.30 | −25.5 | −2.11 | −13.3 / −12.2 |
| USD/JPY | gold | 69 | +0.07 | +5.0 | 0.44 | +4.0 / +1.0 |
| DAX | gold | 95 | +0.08 | +7.7 | 0.56 | −1.1 / +8.8 |
| BTC | gold | 106 | −0.68 | −71.7 | −5.51 | −35.6 / −36.0 |
| ETH | gold | 102 | −0.38 | −38.9 | −2.90 | −19.6 / −19.3 |

Drift control: random H1-close buys with the gold rule's stop band and exit, the same costs. Each value is the gold-rule R a
trade minus the control's:

| | XAU | XAG | EUR | GBP | JPY | DAX | BTC | ETH |
|---|---|---|---|---|---|---|---|---|
| random buys, R / trade | +0.18 | +0.11 | −0.02 | +0.02 | +0.02 | −0.02 | −0.53 | −0.31 |
| gold rule minus random | +0.02 | **+0.30** | −0.20 | −0.32 | +0.05 | +0.11 | −0.15 | −0.07 |

## Why each failed market failed
- **Spot gold (XAU/USD):** +0.20R a trade but t 1.0, and the 2nd half is only +2.8R. Random gold buys made +0.18R, so the rule
  adds +0.02R: the profit is gold's uptrend (the same finding as research/edge/ict-universe). It is also the same market as GC,
  which the desk already trades, so it would double the gold exposure.
- **EUR/USD, USD/JPY:** negative in both halves under both rule sets.
- **GBP/USD:** about zero under the index rule (+0.03R, t 0.2), and clearly negative under the gold rule.
- **DAX (OANDA DE30_EUR CFD):** small and unstable. Index rule +0.08R (t 0.5) with a losing 2nd half; gold rule +0.08R (t 0.6)
  with a losing 1st half.
- **BTC, ETH:** the gross R is about zero (−0.08 to +0.05R a trade). Kraken spot fees (0.40% a side) cost 0.4-0.6R a trade
  on an H1 stop, so the result is −0.3 to −0.7R. Even at a 0.06% CFD cost they are only −0.12 to +0.03R. No edge to keep.
- **Not tested:** the demo broker's AUD/USD, USD/CAD and USD/CHF (research/edge/ict-universe: all fail over 2018-26), and other
  indices: the OANDA proxy serves only NAS100, SPX500, US30 (the desk's own NQ/ES/YM) and DE30.

## Method
- **The desk's own code, unchanged.** `signals()`, `isASetup()`, `sizeOf()`, `MIN_GRADE` and `inHalt()` come from
  `ict/tracker.mjs`; `simulate()` comes from `ict/replay.mjs`. The busy rule is the replay's: an A-setup is blocked only by an
  open A-setup.
  - *Index rule* (a market without `aRule`): against the daily bias, grade ≥ 7, stop 0.3-0.75x the daily ATR, plus the tight
    A+ at half size. DOL sizing; break-even at +1.5R.
  - *Gold rule* (GC's `aRule: 'gold'`): buys only, stop 0.3-0.75x the daily ATR, size 1, no break-even.
  - Both rule sets use the same trail (from +2R, 1.5R behind) and the same 36-H1 time exit.
- **Data.**
  - OANDA mid candles through the site's proxy (`meridianx.dev/md/bars`, `api/bars.js`) for XAU, XAG, EUR/USD, GBP/USD,
    USD/JPY and DE40. H1 runs from Oct 2024 (signals and D1); 5m from 15 Jun 2025 (exits).
  - The 17:00 New York hour is dropped, as in the tracker's feed. D1 = the 17:00 New York day built from H1.
  - BTC/ETH: Binance 5m from council-data `research/candles/crypto5m` up to 31 Oct 2026, then Kraken 1h/5m (through the same
    proxy, `src=kraken`) for the last week. Crypto runs 24/7 on UTC days, with no halt hour.
  - Cross-check: silver on HistData M1 (council-data `research/candles/XAGUSD`, to 30 Oct) gives n 81, +0.39R, t 1.91,
    halves +22.4 / +9.0R.
- **Costs** (round trip in R on each trade's own risk, times its size). Each charge = spread × session multiplier, plus market
  slip on entry, plus stop slip (or market slip on a time exit). The levels are in `research/edge/costs/costs.mjs`.
  - XAU, EUR, GBP, JPY: OANDA spread-only levels.
  - XAG: 3.5¢ spread.
  - DE40: 1.4 pt in Xetra hours, about 4 pt outside them.
  - Crypto: Kraken taker 0.40% a side + 0.02%.
  - Baseline (the live A-stream): CME micro costs, as in research/edge/costs.
  - The median cost is about 0.02-0.09R on spot and the DAX, and 0.4-0.6R on crypto. The ECN/CFD sensitivity (`netRaw` in
    result.json) changes no verdict.
- **Multiple testing.** 8 markets × 2 rule sets = 16 cells. At about 5% each, about one false pass is expected from noise
  alone. That is why silver goes to paper, not live, and why its caveats are listed above.

## What shipped (paper only)
- `ict/tracker.mjs` `SHADOW_MARKETS.xag` (variant `silver`) uses the same mechanism as the `nofri`/`h1opp` shadows (#467).
  - Its records are flagged `shadow: true`, `variant: 'silver'` and `paperMarket: true`, and live in `shadow.json`
    `.variants.silver`. A new step 6 runs after every live market, with its own feed (OANDA through the proxy) and its own
    `try`.
  - Silver is not in `MARKETS`, so it never reaches `trades.json`, the snapshot, `bars.json`, alerts or the cTrader mirror. The
    demo broker's SYMBOLS list has no silver either.
- `ict/replay.mjs` adds `replay.json` `.shadowByVariant.silver` and `.totalsByVariant.silver`, plus `.shadowSrc` and
  `.paperVariants`. The silver stream run through the replay code reproduces this study exactly: 82 trades, +0.479R a trade
  gross.
- The Coach (`council/proposals.mjs`) skips paper-market streams. They are other markets, not filters of the A-setups. For the
  same reason, `variantTags()` (the `vr` tags on replay A-setups) leaves them out (`PAPER_VARIANTS`), so the live records do not change.
- On the desk, the "Candidate rules (paper comparison)" card has a Silver row: live forward and replay.

**Live stream unchanged (before/after proof).** Old and new code ran on the same stubbed feed and clock. The feed was OANDA
candles standing in for CNBC.
- Tracker: 557 chained runs, every hour from 12 Oct to 7 Nov 2026 (Saturdays skipped), in two chains. They opened 77 live
  records (27 A-setups) and 7 silver shadow trades. `trades.json`, `snapshot.json` and `bars.json` were byte-identical after
  every run, with 0 diffs. `shadow.json` without `.variants.silver` was also identical.
- Replay: `replay.json` was identical (1,081 live trades) once the four new silver fields were removed.

## Reproduce
```
node research/edge/ict-markets/fetch.mjs <dir> xau xag eurusd gbpusd usdjpy de40     # OANDA via the proxy
# crypto: council-data research/candles/crypto5m/{BTC,ETH}USDT_5m.json.gz -> <dir>/{btc,eth}5m.json.gz,
#         and <dir>/kr-{btc,eth}-{5m,1h}.json from https://meridianx.dev/md/bars?src=kraken&sym=btc&tf=5m
node research/edge/ict-markets/markets.mjs <dir> <council-data ict/replay.json> research/edge/ict-markets/result.json
```
`result.json` holds the per-cell summary (`summary`: n, wr, exp, R, maxDD, t, both halves, gross, netRaw, costR, driftAdj, pass)
and every trade (`cols` / `trades`). The before/after proof is in `research/edge/ict-markets/proof/`: `stub.mjs` serves CNBC/proxy
requests from cached OANDA candles; `chain.mjs <old tracker> <new tracker> <stubDir> <from> <to> <stepMin> <work>` and
`replay-cmp.mjs <old replay> <new replay> <stubDir> <now> <work>`.
