# When MERIDIAN and ICT agree, is the edge larger?

## Clock re-run (9 Nov 2026)

The HistData M1 files were read with a fixed +5 h ("EST without DST"). They are UTC−5, UTC−4 while Europe is on summer time, and New York time in 2018 (`council/histdata.mjs`; release spikes and Sunday opens), so every European summer was an hour late. All 27 Meridian market-years, the three ICT replays and `analyze.mjs` were re-run (result.json,
tables.json and analysis.txt are the re-run; the prose below is the original run). **The verdict stands: FAIL.** The mechanical
flags reshuffle as expected with 102 variants: 9 rows now carry a plain CANDIDATE flag (13 before), and they still point both
ways across markets. The one observation the original run singled out, ICT A-setups gold + NAS with the Meridian H1 structure
opposed, is now a plain CANDIDATE: OOS +0.365R a trade vs +0.221R, 63.8R vs 63.5R in total, in-sample +0.154R vs +0.034R for the
aligned ones, but R per R of drawdown 5.19 vs 6.41. Still a forward-test idea, not an edge; skill §11 still forbids council filters on ICT.

**Short answer: no.** We tested agreement both ways on spot gold, NAS100 and EUR/USD, 2018 to Oct 2026, with in-sample 2018–2023 and out-of-sample 2024–2026. No confluence filter both holds up out of sample and justifies taking fewer trades.

- **(a) Meridian Scalp / Intraday with an ICT setup in the same direction.** This does not help. In-sample, Meridian trades that follow a same-side ICT signal do *worse* than the rest on every market and setup except NAS Intraday, where they are equal. Meridian Scalp and Intraday lose money after costs on all three markets in this replay, and ICT confluence does not change that.
- **(b) ICT iFVG trades aligned or opposed to the Meridian H1/H4/D1 structure trend and the Malaysian SnR (msnr) direction.** Several filters raise R per trade out of sample, but almost all of them give up total R. The best one (keep ICT trades whose msnr direction agrees, gold + NAS) earns +0.142R a trade against +0.096R, but makes 56R against 89R in total. Its R per R of drawdown is about the same (4.4 vs 4.0), and in-sample it barely separated (+0.064 vs +0.044, and the sign was reversed on gold). The direction that helps is also inconsistent across markets: alignment helps gold, hurts NAS A-setups, and hurts EUR/USD. With 102 variants tried, a few out-of-sample "passes" are expected by chance.
- **Verdict: FAIL** (no robust edge from confluence). We wrote no proposal. Separately, the owner's ICT skill §11 says council rules must not filter ICT, so even a pass would need the owner to change that rule first.

## Data and method

- **Candles.** HistData M1 from council-data `research/candles/` (XAUUSD spot gold, NSXUSD NAS100 cash, EURUSD). The files are in EST without DST and were converted to UTC (+5 h). Every timeframe was built from M1. The daily candle rolls over at 22:00 UTC.
- **Meridian.** The replay (`meridian.mjs`) uses the live `council/engine.mjs` (`buildSetup` and `msAnalyze`, N = 6) and the `clean.mjs` cleaner, and follows `council/backtest.mjs` step for step:
  - a 5-minute step, using the last 720 closed candles of each timeframe plus the forming one;
  - READY state with a fresh confirming break (CF) only;
  - a resting order at the setup entry, filled at market when price is already through it;
  - the WAIT expiry, with an order dropped as missed if the target trades first;
  - M1 management with no break-even (R_none);
  - the live Coach stop settings (buf 0.15, minRisk 1.1);
  - cost per round trip from `spreadOf`: 0.3 on gold, 1 pip on EUR/USD, 0.02 % of price on NAS100 (about 3–5 points).

  Only the Scalp (M15→M1, up H1) and Intraday (H1→M5, up H4) setups were built. Orders that never filled are dropped. There is no PAXG→spot basis, because the data is already spot.
- **ICT.** The replay (`ict.mjs`) uses `ict/tracker.mjs` `signals()` and `ict/replay.mjs` `simulate()` unchanged:
  - H1 iFVG reversal at grade ≥ 3;
  - one open trade per market, except that an A-setup is blocked only by another open A-setup;
  - stop 2 ticks beyond the sweep;
  - trail from +2R, staying 1.5R behind;
  - break-even at +1.5R on NAS and EUR/USD, none on gold;
  - exit after 36 H1 candles at most;
  - exits managed on M5;
  - A-setup rules as in the tracker: the gold rule for XAU and the index rule for NAS and EUR/USD.

  R is per unit, with no A-setup sizing. Cost per trade is 0.4 on gold, 1.25 points on NAS and 1.1 pips on EUR/USD (spread plus 1 tick), divided by the risk.
- **Context features**, all causal (computed from data available at the signal):
  - Meridian structure trend from `msAnalyze` on the last 720 closed H1 / H4 / D1 candles.
  - msnr = the live `trader.mjs` `msnrDirection` (H4 working timeframe, Daily key levels, external breakout gated by a Daily tap). It is copied verbatim into `ict.mjs` because `trader.mjs` does not export it, and turned into a per-H4-candle series.
  - ICT features on each Meridian trade:
    - `after`: a same-side ICT signal in the previous 24 h;
    - `inside`: the entry is inside a same-side iFVG zone that is still alive, meaning no H1 body has closed back through it, within 7 days;
    - `pd`: a buy in the discount half (or a sell in the premium half) of the last 20 daily candles' range;
    - `anyIct` = `after` or `inside`;
    - `ictpd` = (`after` or `inside`) and `pd`;
    - `opp`: an opposite-side ICT signal in the previous 24 h.
- **Walk-forward.** In-sample 2018–2023 decides which side of each yes/no filter to keep. Out-of-sample 2024 to Oct 2026 was never used to choose. All figures are R per trade net of cost unless marked gross.
- **Pass test.** We applied the preamble test: out-of-sample n ≥ 100 (≥ 50 for ICT), out-of-sample R/t > 0 and above the baseline, and ≥ 2/3 of out-of-sample years positive. On top of that, a filter must *either* keep the baseline's out-of-sample total R *or* improve total R per R of drawdown; otherwise taking fewer trades is not worth it. Filters that pass the preamble test but fail this extra check are marked "R/t only".
- **Variants tried: 102.** That is 6 ICT features × 8 Meridian books, plus 6 Meridian-context features × 8 ICT books, plus the owner's live Scalp rule book.

## Baselines

R/t, total R and drawdown (DD) are in R, net of cost. The last column is out-of-sample R/t before costs.

| Book | IS n | IS wr | IS R/t | IS R | IS DD | OOS n | OOS wr | OOS R/t | OOS R | OOS DD | OOS gross R/t |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Meridian Scalp, all 3 markets | 21109 | 0.281 | -0.179 | -3788 | -3809 | 10329 | 0.288 | -0.128 | -1320 | -1353 | -0.009 |
| Scalp gold | 6276 | 0.278 | -0.203 | -1274 | -1285 | 3311 | 0.295 | -0.032 | -107 | -146 | +0.040 |
| Scalp NAS100 | 7345 | 0.282 | -0.166 | -1217 | -1265 | 3521 | 0.292 | -0.156 | -550 | -635 | -0.021 |
| Scalp EUR/USD | 7488 | 0.283 | -0.173 | -1297 | -1316 | 3497 | 0.279 | -0.190 | -664 | -684 | -0.042 |
| Scalp, owner's live rule (against D1, not Asia/overlap) | 5674 | 0.280 | -0.173 | -983 | -1037 | 2457 | 0.252 | -0.204 | -501 | -530 | -0.085 |
| Meridian Intraday, all 3 | 4757 | 0.294 | -0.113 | -540 | -549 | 2319 | 0.303 | -0.067 | -155 | -212 | -0.006 |
| Intraday gold | 1327 | 0.309 | -0.068 | -91 | -128 | 728 | 0.312 | -0.005 | -4 | -55 | +0.025 |
| Intraday NAS100 | 1693 | 0.306 | -0.089 | -150 | -174 | 833 | 0.309 | -0.064 | -53 | -112 | +0.008 |
| Intraday EUR/USD | 1737 | 0.270 | -0.172 | -299 | -307 | 758 | 0.288 | -0.130 | -98 | -139 | -0.052 |
| ICT iFVG all, gold | 941 | 0.412 | +0.046 | 43.5 | -36.2 | 443 | 0.418 | +0.063 | 28.0 | -19.0 | +0.088 |
| ICT A-setups, gold | 362 | 0.448 | +0.161 | 58.2 | -17.4 | 167 | 0.455 | +0.207 | 34.6 | -6.2 | +0.228 |
| ICT all, NAS100 | 1094 | 0.356 | +0.059 | 64.1 | -28.1 | 484 | 0.407 | +0.126 | 60.9 | -17.7 | +0.139 |
| ICT A-setups, NAS100 | 287 | 0.348 | +0.044 | 12.6 | -21.6 | 119 | 0.403 | +0.245 | 29.2 | -10.3 | +0.256 |
| ICT all, EUR/USD | 1108 | 0.347 | -0.044 | -48.9 | -69.2 | 506 | 0.377 | +0.026 | 13.2 | -33.5 | +0.083 |
| ICT all, gold + NAS | 2035 | 0.382 | +0.053 | 107.6 | -50.3 | 927 | 0.412 | +0.096 | 88.9 | -22.1 | +0.115 |
| ICT A-setups, gold + NAS | 649 | 0.404 | +0.109 | 70.8 | -24.0 | 286 | 0.434 | +0.223 | 63.8 | -10.9 | +0.240 |

The Meridian Scalp and Intraday books are close to zero before costs and clearly negative after costs on all three markets, including the owner's live Scalp rule. That is also true over these 8.8 years of spot data. The ICT model is positive on gold and NAS, and flat on EUR/USD (negative in-sample).

## (a) Meridian signals with ICT confluence (all three markets pooled)

Each row compares the trades where the feature is "yes" with those where it is "no".

| Book | Feature | IS R/t (yes / no) | OOS yes: n, R/t, R | OOS no: n, R/t, R |
|---|---|---|---|---|
| Scalp | ICT same-side signal in the last 24 h (`after`) | **-0.208** / -0.161 | 4037, -0.140, -564R | 6292, -0.120, -756R |
| Scalp | inside a live iFVG zone (`inside`) | -0.136 / -0.180 | 66, +0.123, +8R | 10263, -0.129, -1328R |
| Scalp | ICT premium/discount agrees (`pd`) | **-0.201** / -0.166 | 3913, -0.159, -623R | 6416, -0.109, -697R |
| Scalp | ICT signal or zone, and premium/discount (`ictpd`) | **-0.242** / -0.166 | 1642, -0.149, -245R | 8687, -0.124, -1075R |
| Intraday | `after` | **-0.151** / -0.093 | 810, +0.007, +6R | 1509, -0.107, -161R |
| Intraday | `pd` | **-0.139** / -0.104 | 660, -0.075, -49R | 1659, -0.064, -106R |
| Intraday | `ictpd` | **-0.156** / -0.108 | 263, +0.026, +7R | 2056, -0.079, -162R |
| Scalp (live rule) | `ictpd` | **-0.283** / -0.142 | 520, -0.167, -87R | 1937, -0.214, -414R |

- In-sample, a same-side ICT signal (`after` / `anyIct`) is worse for both Meridian setups on every market. The only exception is NAS Intraday, where yes and no are equal (-0.083 vs -0.093). Pooled, the gap is about 0.05R a trade for Scalp (-0.208 vs -0.161) and 0.06R for Intraday.
- The ICT premium/discount filter is worse on gold and NAS. On EUR/USD it is better (Scalp -0.142 vs -0.193), but the kept trades still lose.
- A plausible reading is timing. An ICT iFVG fires *after* a sweep and a reversal leg. A Meridian M1/M5 break in the same direction during the next hours enters late in that leg, with a wide stop and a target that has already been half used.
- Out of sample, the Intraday "yes" groups are near zero (+0.007 and +0.026R a trade, n 263–810). That reverses the in-sample sign and is within noise.
- "Inside an iFVG zone" is too rare to matter: 156 in-sample and 66 out-of-sample Scalp trades out of 31,000.
- Two per-market filters pass the strict test numerically. Neither is an edge, because the kept book loses in-sample:
  - Intraday gold, *excluding* `ictpd`: out-of-sample +0.030R a trade (n 657), but -0.041R in-sample.
  - Intraday EUR/USD, *only* `ictpd`: out-of-sample +0.128R (n 111), but -0.125R in-sample.

**(a) verdict: FAIL.** ICT confluence does not raise Meridian expectancy. If anything, it marks worse entries.

## (b) ICT trades aligned vs opposed to Meridian structure / msnr

`mH1`/`mH4`/`mD1` = the Meridian structure trend on that timeframe agrees with the ICT trade. `h1h4` = both H1 and H4 agree. `msnr` = the Malaysian SnR H4 direction agrees. `all` = H1, H4 and msnr all agree.

| Book | Filter (side chosen in-sample) | IS R/t (yes / no) | OOS kept: n, R/t, total R vs baseline | OOS R/DD (kept vs baseline) | OOS years | Result |
|---|---|---|---|---|---|---|
| ICT all, gold + NAS | keep msnr agrees | 0.064 / 0.044 | 394, **+0.142**, 56.0R vs 88.9R | 4.41 vs 4.02 | +20.1 / +20.6 / +15.4 | passes strict test, but loses 33R; in-sample gap small and reversed on gold (0.029 vs 0.061) |
| ICT all, gold + NAS | keep D1 agrees | 0.086 / 0.026 | 452, +0.127, 57.5R vs 88.9R | 2.56 vs 4.02 | +26.9 / +43.7 / -13.1 | R/t only |
| ICT all, gold + NAS | keep H4 agrees | 0.110 / 0.005 | 439, +0.068, 29.9R vs 88.9R | 1.23 vs 4.02 | -6.5 / +23.4 / +13.0 | FAIL (in-sample did not hold) |
| ICT all, gold + NAS | keep H1+H4+msnr agree | 0.058 / 0.051 | 181, +0.171, 31.0R vs 88.9R | 2.79 vs 4.02 | -1.9 / +23.9 / +9.0 | R/t only |
| ICT A-setups, gold + NAS | keep H1 **opposed** | 0.144 / 0.048 | 175, **+0.361**, 63.1R vs 63.8R | 5.13 vs 5.85 | +14.5 / +31.4 / +17.2 | R/t only: same total R from 61 % of the trades, drawdown a little worse |
| ICT A-setups, gold + NAS | keep H4 agrees | 0.298 / -0.008 | 107, +0.337, 36.1R vs 63.8R | 3.17 vs 5.85 | +13.1 / +15.3 / +7.7 | R/t only |
| ICT all, gold | keep D1 agrees | 0.051 / 0.042 | 221, +0.125, 27.7R vs 28.0R | 2.86 vs 1.47 | +13.5 / +18.2 / -4.0 | passes; in-sample gap 0.009R (noise) |
| ICT A-setups, NAS | keep H1 opposed | 0.126 / -0.142 | 77, +0.393, 30.3R vs 29.2R | 2.57 vs 2.83 | +6.5 / +13.8 / +10.1 | passes strict test; n = 77, total R the same |
| ICT all, EUR/USD | keep H4 **opposed** | 0.004 / -0.106 | 281, +0.070, 19.6R vs 13.2R | 1.16 vs 0.39 | +13.8 / +1.2 / +4.6 | passes; kept book is flat in-sample |

What holds and what does not:

- **Alignment does not work the same way across markets.**
  - On gold, agreement with the Meridian H4 or D1 trend helps the ICT reversal trades.
  - On NAS, ICT trades whose Meridian **H1** trend already agrees are the weak ones: A-setups -0.142R in-sample and -0.027R out-of-sample.
  - On EUR/USD, every kind of alignment is worse in-sample (-0.08 to -0.18R a trade).
  - A single "agree = bigger edge" rule is therefore false.
- **Filters that make sense pay for it in trade count.** The book loses roughly as much total R as the trades it removes would have earned.
  - The pooled ICT book keeps 41–49 % of its trades and its R per trade rises by about 50 %, but total R falls 31–33R.
  - Only the **A-setups, Meridian H1 opposed** filter keeps total R (63.1R vs 63.8R from 61 % of the trades). This is the one observation worth forward-testing. The idea: an ICT reversal is late if the H1 structure has already turned its way. It does not improve R per R of drawdown (5.13 vs 5.85), and it would contradict skill §11.
- **Multiple testing.** 102 variants were tried. Most of the out-of-sample "passes" have tiny in-sample separation (gold D1: 0.009R; msnr pooled: 0.020R) or a kept book that is flat in-sample (EUR/USD).

**(b) verdict: FAIL / INCONCLUSIVE.** Meridian agreement does not reliably make ICT trades better. Where R per trade rises, total R falls by about the same amount, and the direction of the effect differs by market.

## Caveats

- The Meridian books were replayed on HistData spot/cash M1, not on the live Kraken/OANDA feeds. Small entry and stop differences on M1 can matter for Scalp.
- NAS100 cost uses the engine's 0.02 % spread (about 3–5 points). A real NAS CFD spread is about 1–2 points, but the books are already below zero before costs.
- The ICT figures here are spot gold and NAS cash at unit size. They differ from the desk's futures replay (`ict/replay.json`).
- In the yes/no splits for (b), the one-trade-at-a-time rule ran *before* the filter. A live filter would free some slots for other trades.

## Files

- `fetch.mjs` copies the candles out of council-data.
- `lib.mjs` loads, aggregates and computes the statistics.
- `meridian.mjs` and `run-all.mjs` run the Meridian replay for each market and year.
- `ict.mjs` runs the ICT replay with Meridian and msnr context, and writes the zones and D1 candles.
- `analyze.mjs` does the join and the walk-forward tests, and writes `tables.json`, `result.json` and `analysis.txt` (every filter, with in-sample/out-of-sample yes and no and per-year figures).

To reproduce, from the repo root:

```
node research/edge/confluence/fetch.mjs <raw> research/candles/xau-histdata research/candles/nsxusd-histdata research/candles/EURUSD
CONFL_RAW=<raw> node research/edge/confluence/run-all.mjs <out>
CONFL_RAW=<raw> node research/edge/confluence/ict.mjs xau <out>
CONFL_RAW=<raw> node research/edge/confluence/ict.mjs nas <out>
CONFL_RAW=<raw> node research/edge/confluence/ict.mjs eurusd <out>
node research/edge/confluence/analyze.mjs <out> research/edge/confluence
```

The Meridian replay takes about 4–13 minutes per market-year on one core.
