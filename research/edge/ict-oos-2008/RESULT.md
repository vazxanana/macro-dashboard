# ICT A-setups on 2008-2017: a clean out-of-sample test of the live rule

**Verdict: FAILS (pre-registered bar).** On ten years the rule had never seen, the unchanged live A-setup rule made
**−0.013R a trade after costs** (n 2,235, t −0.45). It fails all three tests: the pooled result is not positive, the
2008-12 half is negative, and only 2 of 4 markets are positive. Before costs it made +0.047R a trade (t 1.62), so it fails
even with zero costs. At 2x costs it loses −0.073R a trade (t −2.51).

On the same OANDA data, 2018-26 made **+0.093R a trade net (n 1,786, t 2.58)**, which matches the HistData studies. So the
2018-26 edge is real in that sample, and the data source is not what changed. The edge just does not carry back to 2008-17.
Over 2008-26 as a whole the rule makes +0.034R a trade (n 4,021, t 1.50).

**What this means for "taking the edge to the maximum": don't.** The robustness audit called the desk fragile. On clean
data it is not an edge we can size up. At best it is a small edge that depends on the regime. No live rule was changed.

## How it was run

- **Pre-registration first.** `preregistration.md` and `fetch.mjs` were committed and pushed (9b4a94c6) after the candle
  download and before any 2008-17 signal or trade was generated. The test ran once. Nothing was changed after it.
- **Data.** OANDA 5-minute mid candles from 2007-06 (warm-up) to 2026-10, fetched through the site's own keyless proxy
  `meridianx.dev/md/bars`. This is the same path the NQ open OOS study (#511) used. It has no monthly cost. The cache is in
  the scratchpad, not in git.
  - GC = XAU_USD spot gold.
  - NQ = NAS100_USD.
  - ES = SPX500_USD.
  - YM = US30_USD.
  - Coverage is even across years: about 5,900 H1 candles a year in every market, and about 80% of days have 5m exits
    (the rest are weekend UTC days).
- **RTY could not be had for free.**
  - The proxy has no Russell 2000 (`us2000` returns "unknown sym", because OANDA's US2000_USD is not in `api/_oanda.js`).
  - Dukascopy's datafeed is not reachable from the sandbox ("fetch failed").
  - HistData has no Russell instrument.
  - council-data `research/candles/` has no RTY at all, and YM (Dukascopy cash) only from 2023.
  - So 4 markets were tested.
- **Code.** The desk's own code, imported and unchanged:
  - From `ict/tracker.mjs`: `signals()`, `isASetup()`, `isAPlus()`, `sizeOf()`, `MIN_GRADE`, `MARKETS`, `inHalt()`,
    `cmeShut()`, `agg()`, `dailyNY()`.
  - From `ict/replay.mjs`: `simulate()`.
  - The busy rule is the replay's.
  - Bars in the halt hour or a CME closure are dropped, as the live futures feed does.
  - H1 is built from 5m, and D1 uses the 17:00 New York rollover.
- **Cash/spot vs futures** (declared, not corrected):
  - The candles are OANDA mid quotes; costs are added separately.
  - CFDs carry a basis to the futures and have no contract roll.
  - The historical CME session layout differed: only the 17:00 ET hour is dropped, as it is live, and the old 16:15-16:30
    equity halt is not modelled.
  - The NFP-morning filter uses the tracker's first-Friday fallback, which is what live code does outside the event calendar.
- **Costs.** One round trip:
  - GC: 0.50.
  - NQ/ES: 0.02% of price + 0.25.
  - YM: 0.02% of price + 1.
  - Net R = size × (R − cost/risk).

## The pre-registered test (2008-01-01 to 2017-12-31, net, costs x1)

| test | result | needed | pass |
|---|---|---|---|
| P1 pooled | n 2,235, **−0.013R a trade, t −0.45** | > 0 and t ≥ 2 | no |
| P2 halves | 2008-12: −0.028 (n 1,179, t −0.71); 2013-17: +0.004 (n 1,056, t 0.09) | both > 0 | no |
| P3 markets | GC +0.034, YM +0.047 positive; NQ −0.073, ES −0.068 negative | ≥ 3 of 4 > 0 | no (2 of 4) |
| Regime-bound? | Neither half has t ≥ 2, and P1 fails | one half > 0 with t ≥ 2 and the other ≤ 0, or P1 passes | no |

**FAILS.** Win rate 35%, max drawdown 82.8R, worst losing streak 21 trades. The dependence check gives the same answer:
the t of the monthly sums is −0.38.

## By market: test window vs the 2018-26 reference

Net R a trade at costs x1 unless the column says otherwise.

| market | rule | 2008-17 n | WR | net exp | R | max DD | t | x2 costs | gross | 2008-12 | 2013-17 | 2018-26 OANDA (n, exp, t) | 2018-26 HistData (ict-universe) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GC | gold | 617 | 42% | **+0.034** | +21.1 | 32.1 | 0.58 | −0.029 | +0.098 | +0.141 | −0.080 | 533, **+0.150**, 2.20 | 527, +0.12 |
| NQ | index | 541 | 31% | **−0.073** | −39.6 | 63.6 | −1.35 | −0.121 | −0.025 | −0.186 (t −2.65) | +0.059 | 424, **+0.103**, 1.32 | 393, +0.10 |
| ES | index | 534 | 32% | **−0.068** | −36.1 | 47.8 | −1.16 | −0.138 | +0.003 | −0.085 | −0.050 | 422, **+0.040**, 0.55 | 404, +0.03 |
| YM | index | 543 | 34% | **+0.047** | +25.8 | 27.9 | 0.79 | −0.010 | +0.105 | −0.001 | +0.105 | 407, **+0.061**, 0.90 | (no data) |
| **pooled** | | **2,235** | 35% | **−0.013** | −28.9 | 82.8 | −0.45 | −0.073 (t −2.51) | +0.047 (t 1.62) | −0.028 | +0.004 | 1,786, **+0.093**, 2.58 | ~1,320, ≈ +0.09 |

In 2018-26, the OANDA and HistData runs agree market by market. Using OANDA does not change the 2018-26 picture.

## By year (pooled net R, costs x1)

| year | n | exp | R | t | x2 exp | GC R | NQ R | ES R | YM R |
|---|---|---|---|---|---|---|---|---|---|
| 2008 | 258 | −0.082 | −21.2 | −1.09 | −0.120 | +4.4 | −27.2 | −5.1 | +6.7 |
| 2009 | 223 | −0.103 | −23.0 | −1.22 | −0.150 | +7.5 | −12.7 | −9.7 | −8.1 |
| 2010 | 224 | +0.035 | +7.8 | 0.37 | −0.020 | +13.2 | −2.1 | −4.4 | +1.1 |
| 2011 | 245 | +0.075 | +18.3 | 0.77 | +0.023 | +12.9 | −0.8 | +4.0 | +2.3 |
| 2012 | 229 | −0.064 | −14.6 | −0.73 | −0.123 | +7.1 | −11.4 | −8.1 | −2.2 |
| 2013 | 227 | −0.196 | −44.4 | −2.80 | −0.263 | −11.6 | −4.4 | −16.4 | −12.1 |
| 2014 | 202 | +0.127 | +25.6 | 1.12 | +0.053 | +6.9 | −0.5 | −3.9 | +23.0 |
| 2015 | 182 | +0.074 | +13.4 | 0.76 | +0.016 | −11.9 | +7.0 | +6.5 | +11.8 |
| 2016 | 239 | +0.048 | +11.5 | 0.56 | −0.015 | −4.7 | +10.0 | −5.9 | +12.1 |
| 2017 | 206 | −0.011 | −2.2 | −0.09 | −0.107 | −2.6 | +2.6 | +6.8 | −8.9 |
| *2018-26 (ref)* | *1,786* | *+0.093* | *+165.3* | *2.58* | *+0.047* | *+79.7* | *+43.6* | *+17.1* | *+25.0* |

- 5 of 10 test years are positive.
- In 2018-26, 8 of 9 years are positive (only 2019 lost: −4.0R).

## Grade, side and session (2008-17, net)

| slice | n | exp | t | 2018-26 exp (n) |
|---|---|---|---|---|
| Index A+ (body ≥ 60%, not NY PM; includes the tight half-size A+) | 1,230 | −0.009 | −0.23 | +0.067 (939) |
| Index plain A | 388 | −0.101 | −1.52 | +0.074 (314) |
| Index tight A+ only (size 0.25/0.75) | 570 | −0.022 | −0.47 | +0.006 (445) |
| GC (no A+ tier) | 617 | +0.034 | 0.58 | +0.150 (533) |
| Index buys (against a daily downtrend) | 567 | +0.116 | 1.90 | NQ +0.203, ES +0.112, YM 0.000 |
| Index sells (against a daily uptrend) | 1,051 | **−0.110** | **−2.84** | +0.054 pooled sells (866) |
| NY AM session (all markets) | 777 | −0.131 | −2.87 | +0.085 (604) |

- **The A+ tier does not separate winners from losers in 2008-17.** It is only slightly less bad than plain A.
- **The losses come from index sells.** The index rule takes signals *against* the daily bias. In the 2009-17 bull market
  that mostly meant shorting H1 sweeps of highs in an uptrend, and those lost (t −2.8). Index buys taken against a daily
  downtrend made money (+0.116, t 1.9).
- These slices were not pre-registered. They are descriptive, and with this many slices one or two |t| ≈ 2-3 cells are
  expected by chance. They are not filter proposals.

## Gold: is the gold rule more than being long gold?

- **Not in 2008-17.** GC A-setups made +0.034R a trade net. Random gold buys with the same stop band, exit and costs made
  +0.008R a trade (n 2,643). Drift-adjusted, that leaves **+0.022R a trade (t 0.37)**.
- It was positive in the 2008-12 gold bull (+0.141; drift-adjusted +0.086, t 1.07) and negative in the 2013-17 bear
  (−0.080; drift-adjusted −0.048).
- Year by year (control / GC-A / drift-adjusted exp):

  | year | control | GC-A | drift-adj |
  |---|---|---|---|
  | 2008 | +0.12 | +0.06 | −0.06 |
  | 2009 | +0.01 | +0.13 | +0.12 |
  | 2010 | +0.09 | +0.22 | +0.14 |
  | 2011 | +0.11 | +0.19 | +0.08 |
  | 2012 | −0.06 | +0.11 | +0.17 |
  | 2013 | −0.16 | −0.21 | −0.05 |
  | 2014 | −0.04 | +0.11 | +0.15 |
  | 2015 | −0.19 | −0.23 | −0.03 |
  | 2016 | +0.01 | −0.07 | −0.08 |
  | 2017 | +0.19 | −0.04 | −0.23 |

- For comparison, 2018-26 on the same data: control +0.051, GC-A +0.150, drift-adjusted +0.104 (t 1.53).
- The fixed 0.50 gold cost weighs more when gold was $900-1,300 (0.064R a trade, against 0.051R in 2018-26). But even
  before costs GC made only +0.098R a trade (t 1.67).

## Honest reading

- **The live A-setup rule has no demonstrable edge on 2008-2017.** That is the only window that was clean for both rule
  sets: the index rule was built on 2023-26, and the gold rule on 2019-26.
- 2018-26 stays positive (t 2.6 on OANDA). So either:
  - the edge belongs to the post-2018 market regime (possibly more reversal after H1 liquidity sweeps, and a stronger
    gold uptrend); or
  - 2018-26 was partly selected. The rules were tuned on parts of it.
  - Either way, it is not a structural edge across regimes.
- The index loss is concentrated in fading H1 highs during a steady bull market. That fits the regime explanation. Expect
  the index A-setups to struggle in a long, low-volatility grind higher.
- The gold rule is mainly a long-gold rule. In 2008-17 its timing added about nothing over random buys.
- **Implications:**
  - Do not increase ICT risk or size on the strength of 2018-26.
  - Keep the desk at its current small size as a forward test. Its own replay since Aug 2025 is the ongoing evidence.
  - The robustness audit's "fragile" label stands. This test moves it toward "not established".
  - No live rule, config, tracker or replay code changed.

## Multiple testing

- One pre-registered hypothesis, and it failed.
- Everything in the grade, side, session and drift sections is descriptive.
- The index-buys-only observation is similar to the existing paper variant 'dip' (`research/edge/ict-index-longonly`).
  It was found after looking, so it is not evidence for that variant.

## Files

- `preregistration.md`: the bar, committed before the run.
- `fetch.mjs`: OANDA 5m candles through the site proxy, cached in a scratch directory (not committed).
- `run.mjs`: the desk's code over the candles, plus the GC random-buy control.
- `analyse.mjs`: the statistics and the pre-registered verdict. It writes `result.json`.
- `result.json`: every table above, plus coverage per market and year, gross figures, and the monthly-sum t.

Re-run:

```
node research/edge/ict-oos-2008/fetch.mjs <cache>
node research/edge/ict-oos-2008/run.mjs <cache> <cache>/trades.json
node research/edge/ict-oos-2008/analyse.mjs <cache>/trades.json
```
