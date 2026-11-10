# Are the cost assumptions realistic? Which edges survive realistic execution?

## Clock re-run (9 Nov 2026)

The HistData M1 files were read as New York time. They are UTC−5, UTC−4 while Europe is on summer time, and New York time in 2018 (`council/histdata.mjs`), so the ~4 weeks a year when the US and Europe are on different clocks (2019 on) were an hour off. Not re-run in the 9 Nov clock pass. Only the 2018-26 Scalp replay (`scalp.mjs`) and the session spread multiplier read HistData; ~8%
of days (the US/EU mismatch weeks from 2019) were an hour off. Both FAILs rest on costs measured from OANDA and the 30-day replay,
not on HistData hours, so the verdict cannot move on this fix. `load.mjs` now uses the shared clock.

**Verdict: FAIL. No rule passes as a candidate, but the answer to the question is clear.**

- **The Scalp has no edge before costs on 8.8 years of data.** The live Scalp rule is −0.07R a trade gross in 2018–23 and −0.11R in 2024–26. Realistic costs make that −0.24R and −0.30R. The 30-day replay's +0.23R gross for the live rule doesn't carry over to long history.
- **The council's own cost charge is roughly right for an ECN raw account, and too low for a spread-only account.** The charge is 1 pip on forex, 0.30 on gold and 0.02% on crypto.
  - On a raw account, forex comes out about equal (EUR/USD) to 0.09R worse per trade (USD/CAD), and gold comes out about equal.
  - On an OANDA-style spread-only account, the true cost is about 2× the charge: forex +0.10 to +0.25R a trade, gold +0.10R.
  - Crypto at Kraken spot taker fees (0.8% round trip) is 40× the engine's 0.02%.
- **Latency of 1–3 minutes costs nothing measurable.** It moved expectancy by less than 0.02R in every test (Scalp limit and market orders, 30-day market entries, ICT). Spread, commission and slippage are what kill edges.
- **The ICT desk survives realistic futures execution.** Costs are 0.02–0.03R a trade because H1 sweep stops are 100–600 ticks wide. All trades: +0.139R gross → +0.111R net with 2-minute latency (t 2.06). A-setups: +0.255R → +0.230R (t 2.30).
- **Minimum stop for a scalp: about 15× the all-in round-trip cost.** Below 8× it is hopeless at any plausible edge. The engine's stop floor (5 × its own "spread": 5 pips / $1.50) lets through scalps at 3–6× real cost. 82–99% of the live-rule scalps on forex (69–89% on gold) are below 15×. The per-market table is in section 4. It works as a guard against costs, not as an edge: no stop multiple made the Scalp positive out of sample.

Scripts are all in this folder. Data: council-data HistData M1 (bid) 2018 – Oct 2026; OANDA M1 mid for 6 Oct – 6 Nov 2026 via meridianx.dev; `backtest.json` (30-day replay, 8 Oct – 7 Nov 2026); `ict/replay.json` (831 closed trades, Aug 2025 – Nov 2026).

## 1. The cost model (costs.mjs)

**There is no bid/ask history in the repo, so spreads could not be measured from the M1 data.**
- HistData M1 is bid-only.
- The OANDA bars proxy (`api/bars.js`) asks for `price: 'M'` (mid).
- Dukascopy idx files are one-sided.
- CNBC prints last trades.
- The live OANDA bid/ask stream (`/md/stream`) is the only bid/ask source, and it sent nothing on a Saturday.

So the spread levels below are approximate published typical figures (not minimums) for IC Markets Raw and the OANDA standard account. They were not re-checked online in this session; every number sits in one table in `costs.mjs` and can be changed.

The hour-of-day shape follows the retail cycle around the 17:00 New York rollover, where the gold maintenance break also falls.

All-in round trip = spread × session multiplier + commission (+ 1 market-entry slip). The table shows spread + commission:

| market | engine charges | raw: London | raw: Asia | raw: rollover (17 NY) | OANDA: London | OANDA: NY pm | OANDA: rollover |
|---|---|---|---|---|---|---|---|
| EUR/USD (pips) | 1.0 | 0.85 | 0.92 | 1.45 | 1.2 | 1.5 | 6.0 |
| GBP/USD | 1.0 | 1.05 | 1.21 | 2.45 | 1.8 | 2.25 | 9.0 |
| AUD/USD | 1.0 | 0.95 | 0.99 | 1.95 | 1.4 | 1.75 | 7.0 |
| USD/CAD | 1.0 | 1.31 | 1.47 | 2.71 | 2.0 | 2.5 | 10.0 |
| USD/CHF | 1.0 | 0.96 | 1.12 | 2.36 | 1.8 | 2.25 | 9.0 |
| XAU/USD ($) | 0.30 | 0.21 | 0.25 | 0.77 | 0.45 | 0.56 | 2.25 |

- **Slippage:** 0.1–0.15 pip / $0.05 on market entries; 0.2–0.3 pip / $0.10 on stop fills.
- **CME micros:** 1 tick spread + $1.24 round-trip commission and fees + 1 tick entry slip + 1 tick exit slip:

  | contract | round trip |
  |---|---|
  | MNQ | 1.37 pts (5.5 ticks) |
  | MES | 1.00 pt (4.0 ticks) |
  | MYM | 5.5 pts (5.5 ticks) |
  | M2K | 0.55 pt (5.5 ticks) |
  | MGC | 0.42 pt (4.2 ticks) |

- **Crypto (30-day replay only):**
  - "raw" column = CFD at 0.04% round trip.
  - "OANDA" column = Kraken Pro spot taker at 0.40% a side.

**Latency model.** The signal fires at the M1 (or H1) close and the order lands 1, 2 or 3 minutes later (ICT also 10 minutes, the CNBC feed delay).
- Market orders fill at the open of that minute, plus the spread for buys, plus slippage.
- Limit orders are live only from that minute on.
- A buy limit fills only when the ask trades through. Sell exits are checked against the ask.
- Stop and target prices stay where the signal put them. R is measured on the planned risk.

## 2. 30-day replay (backtest.json, 8 Oct – 7 Nov 2026) re-costed

The trades are re-costed exactly. The engine stores cost = engineSpread / risk, so the realistic cost is cost × realistic / engine for every trade.

Expectancy (R a trade), management "none":

| setup | n | gross | engine net | raw net | OANDA / Kraken net | survives? |
|---|---|---|---|---|---|---|
| scalp | 1,009 | +0.037 | −0.056 | −0.101 | −0.98 | no (already negative at engine cost) |
| **Scalp live rule** (vs D1, no asia/overlap, no AUD) | 243 | +0.228 | +0.146 | +0.097 | −0.90 | raw only, and only in this window (see section 3) |
| live rule: gold | 43 | +0.233 | +0.174 | +0.163 | +0.093 | yes in-window |
| live rule: forex | 98 | +0.071 | −0.045 | −0.103 | −0.271 | **vanishes** |
| live rule: crypto | 102 | +0.376 | +0.318 | +0.261 (CFD) | −1.93 (Kraken) | only at CFD cost |
| rscalp | 580 | +0.058 | −0.045 | −0.103 | −1.45 | **vanishes** |
| rscalp, forex | 242 | +0.059 | −0.087 | −0.144 | −0.318 | **vanishes** |
| sweep_m1 | 143 | +0.042 | −0.044 | −0.103 | −1.53 | **vanishes** |
| sweep_h1, forex | 23 | +0.122 | −0.010 | −0.068 | −0.247 | **vanishes** |
| rintra | 113 | +0.235 | +0.186 | +0.163 | −0.49 | yes except crypto at Kraken |
| sweep_vr / sweep_ext | 61 / 60 | +0.18 / +0.23 | +0.14 / +0.19 | +0.11 / +0.17 | −0.42 / −0.35 | yes except crypto at Kraken; n tiny, t < 1 |
| m15choch (gold) | 30 | +0.092 | +0.067 | +0.062 | +0.037 | thin |
| intraday, m15choch (all), swing, position | | negative | | | | already negative gross |

Cost per trade in R for the live scalp rule:

| | engine | raw | OANDA |
|---|---|---|---|
| forex | 0.12 | 0.18 | 0.34 |
| gold | 0.06 | 0.07 | 0.14 |
| crypto | 0.06 | 0.12 (CFD) | 2.3 (Kraken) |

**Latency (market entries, gold + forex, replayed on OANDA M1).** 2,066 trades. Gross on OANDA +0.067 vs +0.065 on the replay's own feed. Net with raw costs:

| latency | expectancy |
|---|---|
| 0 min | −0.067 |
| 1 min | −0.059 |
| 2 min | −0.058 |
| 3 min | −0.059 |
| 2 min, OANDA costs | −0.174 |

Feed fidelity: 89% of trades get the same outcome on OANDA as on Kraken/PAXG. But the live-rule gold market entries make +0.195R on the replay's PAXG feed and only +0.081R on OANDA spot, before any cost.

## 3. The live Scalp rule on 2018 – Oct 2026 (scalp.mjs, live engine, HistData M1)

The harness runs `council/engine.mjs` (msAnalyze, buildSetup 'scalp') with the backtest's plumbing:
- 5-minute steps, 720-candle views with the forming M15 candle;
- READY with the CF at most 12 minutes old;
- a 3-hour limit at the broken M1 level, or market when price is already through;
- stop first inside a candle, no break-even;
- live config buf 0.15, minRisk 1.1;
- D1 label = msAnalyze(N=6) on closed UTC days.

It covers 6 markets × 9 years: 68,141 filled scalp signals, of which 13,577 pass the live rule.

Live rule, all markets pooled:

| | n | win rate | exp R | total R | max DD | t |
|---|---|---|---|---|---|---|
| IS 2018–23 gross | 9,063 | 27.9% | −0.072 | −651 | −743 | −4.0 |
| IS engine cost | 9,063 | | −0.204 | | | −11.5 |
| **IS raw + 2-min latency (baseline)** | 9,071 | 25.5% | **−0.235** | −2,134 | −2,170 | −13.5 |
| IS OANDA + 2 min | 9,097 | 19.5% | −0.389 | −3,537 | | −24.4 |
| OOS 2024–26 gross | 4,514 | 26.5% | −0.108 | −487 | −508 | −4.2 |
| OOS engine cost | 4,514 | | −0.242 | | | −9.4 |
| **OOS raw + 2 min (baseline)** | 4,515 | 23.9% | **−0.298** | −1,344 | −1,354 | −11.9 |
| OOS OANDA + 2 min | 4,524 | 18.5% | −0.420 | −1,899 | | −18.7 |

By year (gross / raw + 2 min / OANDA + 2 min):

| year | gross | raw | OANDA |
|---|---|---|---|
| 2018 | +0.03 | −0.12 | −0.35 |
| 2019 | −0.15 | −0.36 | −0.52 |
| 2020 | −0.05 | −0.20 | −0.34 |
| 2021 | −0.04 | −0.21 | −0.36 |
| 2022 | −0.12 | −0.27 | −0.40 |
| 2023 | −0.06 | −0.21 | −0.36 |
| 2024 | −0.12 | −0.31 | −0.44 |
| 2025 | −0.11 | −0.28 | −0.37 |
| 2026 | −0.09 | −0.31 | −0.46 |

Net is negative in every year and every market.

By market (live rule, IS | OOS, gross → raw + 2 min):

| market | IS gross → raw | OOS gross → raw |
|---|---|---|
| EUR/USD | −0.01 → −0.15 | −0.11 → −0.25 |
| GBP/USD | −0.08 → −0.21 | −0.04 → −0.27 |
| USD/CAD | −0.12 → −0.32 | −0.09 → −0.35 |
| USD/CHF | −0.07 → −0.24 | −0.18 → −0.40 |
| XAU/USD | −0.07 → −0.23 | −0.12 → −0.17 |

All scalp signals (no filter) are −0.07 gross IS and −0.06 OOS. Only gold OOS is slightly positive gross (+0.024), and it is −0.055 after raw costs.

**Latency (live rule, raw):** IS −0.245 / −0.238 / −0.235 / −0.234 at 0 / 1 / 2 / 3 minutes; OOS −0.302 / −0.300 / −0.298 / −0.297. That is no cost at all. A late limit order skips a few of the worst immediate fills.

**Sessions (live rule, raw + 2 min, IS | OOS):**

| session | IS | OOS |
|---|---|---|
| london | −0.17 | −0.19 |
| newyork | −0.30 | −0.43 |
| late, all | −0.30 | −0.32 |
| late, 17:00–18:00 NY rollover hour | −0.42 | −0.58 |

The live rule's "late" session (21–24 UTC) contains the rollover hour, where OANDA-type spreads cost about 1R a trade (−1.09 IS, −1.07 OOS).

Why the 30-day number misled: the engine is feed-sensitive. Only ~20–25% of the harness's October 2026 signals coincide with the replay's (Kraken FX, PAXG gold), and 30 days of one regime say little against 9 years.

## 4. Minimum stop in multiples of the all-in cost

The live rule's trades were bucketed by stop ÷ all-in round-trip cost at that hour. Mean R, IS | OOS, gross / raw net:

| stop ÷ cost | IS n | IS gross / net | OOS n | OOS gross / net |
|---|---|---|---|---|
| 0–5× | 2,517 | −0.16 / −0.44 | 1,538 | −0.13 / −0.47 |
| 5–8× | 2,717 | −0.07 / −0.24 | 1,233 | −0.16 / −0.32 |
| 8–12× | 1,856 | −0.04 / −0.12 | 762 | −0.10 / −0.22 |
| 12–16× | 920 | +0.03 / −0.07 | 364 | −0.04 / −0.13 |
| 16–20× | 484 | −0.02 / −0.09 | 199 | +0.17 / +0.12 |
| 20–30× | 404 | +0.05 / +0.02 | 197 | −0.12 / −0.16 |

The cost drag is about 1.1/m R at m× (slippage on stops adds a little): 0.28R at under 5×, 0.17R at 5–8×, 0.11R at 8–12×, 0.07R at 12–16×.

Candidate rules ("take the live-rule scalp only if stop ≥ m × all-in cost", m picked on 2018–23 from {0, 5, 8, 10, 12, 15, 20, 25, 30, 40}, 20 variants over the two accounts):

| rule | IS n / exp / t | OOS n / exp / t | OOS years positive | verdict |
|---|---|---|---|---|
| baseline, raw | 9,063 / −0.236 / −13.5 | 4,514 / −0.297 / −11.9 | 0/3 | |
| m = 20, raw | 569 / −0.062 / −1.0 | 418 / −0.081 / −1.0 | 1/3 (2025 +0.01) | **FAIL** |
| baseline, OANDA | 9,063 / −0.388 | 4,514 / −0.421 | 0/3 | |
| m = 12, OANDA | 587 / −0.054 / −0.9 | 390 / −0.040 / −0.5 | 1/3 | **FAIL** |

The filter removes most of the cost, but what is left has no gross edge. Expectancy improves a lot (from −0.30 to −0.08R) and stays negative.

**Per-market minimum stop.** Use 15× the all-in round trip, so that cost is at most about 7% of the risk. Below 8× nothing is economic at any plausible gross edge; the break-even rule is stop ≥ cost ÷ gross edge.

| market | all-in raw | min stop, raw (15×) | all-in OANDA | min stop, OANDA (15×) | median live-rule stop | live-rule scalps below 15× (raw / OANDA) |
|---|---|---|---|---|---|---|
| EUR/USD | 0.95 pip | **14 pips** | 1.3 pip | **20 pips** | 7.7 pips | 84% / 94% |
| GBP/USD | 1.2 pip | **18 pips** | 1.95 pip | **29 pips** | 10.4 pips | 82% / 95% |
| AUD/USD | 1.05 pip | **16 pips** | 1.5 pip | **23 pips** | – | 93% / 98% |
| USD/CAD | 1.46 pip | **22 pips** | 2.15 pip | **32 pips** | 7.9 pips | 95% / 99% |
| USD/CHF | 1.11 pip | **17 pips** | 1.95 pip | **29 pips** | 6.8 pips | 94% / 99% |
| USD/JPY | 1.34 pip | **20 pips** | 1.4 pip | **21 pips** | – (not traded) | – |
| XAU/USD | $0.26 | **$3.9** | $0.50 | **$7.5** | $2.78 | 69% / 89% |
| MNQ | 5.5 ticks | **21 pts** (82 ticks) | | | ICT median 157 pts | |
| MES | 4.0 ticks | **15 pts** | | | ICT median 29 pts | |
| MYM | 5.5 ticks | **82 pts** | | | ICT median 208 pts | |
| M2K | 5.5 ticks | **8.2 pts** | | | ICT median 18 pts | |
| MGC | 4.2 ticks | **6.3 pts** | | | ICT median 33 pts | |

The same rule written as a maximum spread: skip if (live spread + commission) × 15 > stop. Because the multiplier is 5× at 17:00 NY, the rule also shuts scalping in the rollover hour on its own.

The engine's minimum stop (5 × its 1-pip / $0.30 "spread") is 3–6× the real cost, which is exactly the 0–8× zone where scalps lose 0.24–0.44R a trade net.

## 5. ICT desk (ict/replay.json) under micro-futures costs and latency

Latency comes from cash-index / spot-gold M1 drift (NSX for NQ, SPX for ES, XAU for GC). YM, RTY and November trades take the matched mean (307 of 831).

| slice | n | gross | net (costs) | net + 2 min | net + 10 min | cost R | t (net + 2 min) |
|---|---|---|---|---|---|---|---|
| all | 831 | +0.139 | +0.111 | +0.111 | +0.122 | 0.028 | 2.06 |
| **A-setups** | 256 | +0.255 | +0.234 | +0.230 | +0.235 | 0.020 | 2.30 |
| not A | 575 | +0.087 | +0.056 | +0.059 | +0.072 | 0.031 | 0.91 |
| NQ (MNQ) | 171 | +0.093 | +0.083 | +0.073 | +0.079 | 0.010 | 0.63 |
| ES (MES) | 212 | +0.061 | +0.021 | +0.029 | +0.044 | 0.040 | 0.28 |
| YM (MYM) | 188 | +0.146 | +0.111 | +0.112 | +0.122 | 0.035 | 0.91 |
| RTY (M2K) | 80 | +0.182 | +0.143 | +0.145 | +0.155 | 0.039 | 0.78 |
| GC (MGC) | 180 | +0.248 | +0.232 | +0.228 | +0.240 | 0.016 | 2.05 |
| NY PM, all | 155 | −0.084 | −0.106 | −0.109 | −0.098 | 0.022 | −1.11 |
| A London | 60 | −0.144 | −0.166 | −0.162 | −0.143 | 0.022 | −0.95 |
| A gold | 63 | +0.035 | +0.024 | +0.003 | −0.009 | 0.012 | 0.02 |

By stop size: stops under 40 ticks (n16) lose 0.14R a trade to costs and are −0.13R net. At 40–80 ticks costs are 0.07R; above 160 ticks they are under 0.02R. **Costs don't change any ICT conclusion.** What was negative stays negative (NY PM, A-London). What was positive stays positive. ES and A-gold are close to zero either way. Mean entry drift after the H1 close is −0.002R at 1–3 minutes and −0.012R at 10 minutes (slightly in the trade's favour).

## 6. What this means for the owner

1. **Don't trade the Scalp, on any account.** It is negative before costs over 8.8 years. On a spread-only account it loses about 0.4R a trade. The 30-day +0.10R after raw costs is a window artefact.
2. **Which edges vanish under realistic costs (30-day replay):**
   - scalp on forex, rscalp, sweep_m1 and sweep_h1 on forex vanish under realistic costs;
   - every crypto engine setup vanishes at Kraken spot fees (0.8%);
   - rintra and sweep_vr/ext survive in-window but have n < 120 and t < 1.5;
   - gold setups lose only 0.01–0.07R a trade more than at the engine's 0.30, because gold stops are wide relative to the gold spread. The gold scalp itself is still negative on long history.
3. **The ICT desk is robust to execution costs.** About 0.02–0.03R a trade. Its weak slices are weak gross.
4. **Latency is not the problem.** A 1–3 minute delay (and the 10-minute CNBC delay on ICT) changes results by under 0.02R. Choosing the account type matters about 10 times more: raw vs spread-only is a 0.10–0.25R per trade difference on forex scalps.
5. **Cost guard for any future scalp:** stop ≥ 15× the all-in round trip at the hour of entry (table in section 4), and no entries in the 17:00–18:00 New York hour. If the council keeps a 5-spread floor, the "spread" should be the real all-in cost: 1.5–2 pips for an OANDA-type account, not 1 pip.

**Multiple testing:** 20 rule variants (the m grid × 2 accounts), plus 5 session splits and 4 latency settings that were looked at but not selected. Nothing passed.
