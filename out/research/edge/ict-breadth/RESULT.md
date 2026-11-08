# ICT breadth test: the unchanged A-setup rule on markets the desk was never tuned on

**Verdict: FAIL (pre-registered bar), for the primary set and for the secondary set.** The desk's A-setup rule, unchanged, has
no edge on the DAX and silver (the only index/metal markets the free data path serves beyond the desk's own) in either decade:
**−0.135R a trade after costs in 2008-17 (n 960, t −2.97) and −0.116R in 2018-26 (n 934, t −2.61).** It fails even before costs
(gross +0.006R and +0.014R a trade). On nine FX pairs it also fails: −0.051R (t −2.77) and −0.014R (t −0.67), with only 2 of 9
pairs positive in each window.

**Answer to the question asked: there is no general ICT edge.** What the desk has is at best a 2018+ edge on its own markets
(US indices and gold). That set, re-run in the same pass as a reference, reproduces #526 exactly: 2018-26 +0.093R (t 2.58,
4 of 4 markets positive) and 2008-17 −0.013R (t −0.45). On every other market and window tested here, the same rule loses or
breaks even. No live rule, config, tracker, replay or site code was changed.

## How it was run

- **Pre-registration first.** `preregistration.md` and `run.mjs` were committed and pushed (7c7468e6) after the candle download
  and a coverage probe, before any signal or trade on these markets was generated. The test ran once. Nothing was changed after it.
- **Which markets exist.** The keyless OANDA proxy (`meridianx.dev/md/bars`, `api/_oanda.js`) was probed for every candidate.
  de30, uk100, jp225, au200, eu50, xpt, xpd, xcu, hk33, cn50 and us2000 all return `unknown sym or tf`. The proxy serves only
  de40 (OANDA DE30_EUR, the DAX CFD; 1d from 2004, 5m from 2005), xag (XAG_USD; from 2007-01), nine FX pairs (from 2004),
  and the desk's own xau/nas100/spx500/us30. Adding FTSE/Nikkei/ASX/Euro Stoxx/platinum would need a site deploy, so they are
  not in this test.
- **Sets.**
  - H1, primary: DAX (index rule) and silver (gold rule, the mapping the tracker's own silver shadow market uses).
  - H2, secondary: EUR/USD, GBP/USD, AUD/USD, NZD/USD, USD/CAD, USD/CHF, USD/JPY, EUR/JPY, GBP/JPY (index rule = the tracker's
    default for a market without an aRule).
  - Reference: GC, NQ, ES, YM exactly as #526, re-run in the same pass.
- **Code.** #526's harness, generalised: the desk's own `signals()`, `isASetup()`, `isAPlus()`, `sizeOf()`, `MIN_GRADE`,
  `MARKETS`, `SHADOW_MARKETS`, `inHalt()`, `cmeShut()`, `agg()`, `dailyNY()` (`ict/tracker.mjs`) and `simulate()`
  (`ict/replay.mjs`), unchanged; the replay's busy rule; OANDA 5m mid candles 2007-06 to 2026-10 from #526's cache and
  `fetch.mjs`.
- **Costs** (one round trip, spread + slippage, in price units; x2 and gross reported):
  - DAX: 0.02% of price + 1.0 pt (about 0.05R a trade).
  - Silver: 0.04 (about 0.19R a trade: silver's spread is wide relative to its stop, about 4x gold's 0.05-0.06R).
  - FX: EUR/USD, AUD/USD 1.5 pips; GBP/USD, NZD/USD, USD/CAD, USD/CHF 2 pips; USD/JPY 1.5 pips; EUR/JPY 2 pips; GBP/JPY 3 pips.
- **DAX data.** OANDA quoted the DAX CFD 14 hours a day until late 2018 (168 5m candles a day). As pre-registered, a complete
  DAX day for 5m exits is ≥ 150 candles. With #526's unchanged 200-candle test (H1 exits for 2008-18) the DAX result is the
  same: 2008-17 −0.002R (n 306), 2018-26 −0.156R (n 392).
- **Windows.** A = 2008-01-01 to 2017-12-31, untouched for all these markets. B = 2018-01-01 to 2026-10-31, run before on
  silver and FX (ict-universe) and on the DAX for Oct 2024 onward (ict-markets), but never tuned on.

## The pre-registered test (A-setups, net, costs x1)

Bar per set: pooled net > 0 with t ≥ 2 in **both** windows, and ≥ 60% of markets positive in both (H1: 2 of 2; H2: 6 of 9).

| set | window | n | net exp | t | x2 exp | gross exp | markets > 0 | monthly t | pass |
|---|---|---|---|---|---|---|---|---|---|
| **H1 DAX + silver** | 2008-17 | 960 | **−0.135** | −2.97 | −0.276 | +0.006 | 1 of 2 | −2.78 | no |
| **H1 DAX + silver** | 2018-26 | 934 | **−0.116** | −2.61 | −0.246 | +0.014 | 0 of 2 | −2.33 | no |
| H2 nine FX pairs | 2008-17 | 4,233 | −0.051 | −2.77 | −0.094 | −0.009 | 2 of 9 | −2.35 | no |
| H2 nine FX pairs | 2018-26 | 3,895 | −0.014 | −0.67 | −0.070 | +0.042 | 2 of 9 | −0.58 | no |
| all 11 new markets | 2008-17 | 5,193 | −0.067 | −3.86 | −0.127 | −0.006 | 3 of 11 | −3.17 | (reported) |
| all 11 new markets | 2018-26 | 4,829 | −0.034 | −1.78 | −0.104 | +0.037 | 2 of 11 | −1.51 | (reported) |
| *reference: desk GC/NQ/ES/YM* | *2008-17* | *2,235* | *−0.013* | *−0.45* | *−0.073* | *+0.047* | *2 of 4* | *−0.38* | *no* |
| *reference: desk GC/NQ/ES/YM* | *2018-26* | *1,786* | *+0.093* | *2.58* | *+0.047* | *+0.138* | *4 of 4* | *2.42* | *yes* |

**H1: FAIL. H2: FAIL.** Neither is "positive but not significant": both are negative in both windows. The reference set is
2018+-ONLY under the same bar, which is #526's finding.

## By market

Net R a trade at costs x1 (t), A-setups.

| market | rule | 2008-17 n | 2008-17 exp (t) | x2 | gross | 2008-12 / 2013-17 | 2018-26 n | 2018-26 exp (t) | x2 | gross | 2018-21 / 2022-26 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DAX | index | 306 | +0.003 (0.03) | −0.042 | +0.047 | +0.133 / −0.143 | 392 | **−0.156 (−2.54)** | −0.201 | −0.110 | −0.202 / −0.127 |
| Silver | gold | 654 | **−0.199 (−3.84)** | −0.386 | −0.013 | −0.029 / −0.388 | 542 | −0.087 (−1.40) | −0.280 | +0.105 | −0.320 / +0.110 |
| EUR/USD | index | 458 | −0.073 (−1.37) | −0.105 | −0.040 | −0.002 / −0.153 | 443 | −0.014 (−0.24) | −0.063 | +0.035 | +0.043 / −0.066 |
| GBP/USD | index | 482 | +0.059 (1.05) | +0.022 | +0.095 | +0.031 / +0.087 | 426 | −0.024 (−0.36) | −0.073 | +0.025 | −0.025 / −0.023 |
| AUD/USD | index | 526 | −0.104 (−2.01) | −0.140 | −0.067 | −0.104 / −0.104 | 460 | −0.046 (−0.81) | −0.101 | +0.009 | −0.017 / −0.070 |
| NZD/USD | index | 473 | −0.070 (−1.28) | −0.124 | −0.016 | −0.117 / −0.031 | 439 | −0.007 (−0.10) | −0.084 | +0.070 | −0.031 / +0.012 |
| USD/CAD | index | 527 | −0.038 (−0.64) | −0.090 | +0.015 | −0.027 / −0.049 | 500 | −0.047 (−0.80) | −0.109 | +0.014 | −0.091 / −0.016 |
| USD/CHF | index | 448 | −0.093 (−1.74) | −0.146 | −0.040 | −0.020 / −0.163 | 455 | **−0.169 (−3.18)** | −0.244 | −0.094 | −0.148 / −0.190 |
| USD/JPY | index | 386 | +0.033 (0.54) | −0.008 | +0.074 | +0.034 / +0.031 | 360 | +0.060 (0.87) | +0.021 | +0.099 | +0.115 / +0.016 |
| EUR/JPY | index | 468 | −0.069 (−1.19) | −0.104 | −0.035 | −0.019 / −0.120 | 389 | −0.008 (−0.13) | −0.052 | +0.036 | −0.077 / +0.050 |
| GBP/JPY | index | 465 | −0.094 (−1.72) | −0.133 | −0.054 | −0.170 / −0.019 | 423 | +0.162 (2.30) | +0.116 | +0.207 | +0.101 / +0.213 |
| *GC (ref)* | *gold* | *617* | *+0.034 (0.58)* | | | *+0.141 / −0.080* | *533* | *+0.150 (2.20)* | | | *+0.087 / +0.204* |
| *NQ (ref)* | *index* | *541* | *−0.073 (−1.35)* | | | | *424* | *+0.103 (1.32)* | | | |
| *ES (ref)* | *index* | *534* | *−0.068 (−1.16)* | | | | *422* | *+0.040 (0.55)* | | | |
| *YM (ref)* | *index* | *543* | *+0.047 (0.79)* | | | | *407* | *+0.061 (0.90)* | | | |

- Only USD/JPY is positive in both windows, and only weakly (t 0.5 and 0.9).
- GBP/JPY 2018-26 (+0.162, t 2.3) is the only new market-window with t ≥ 2 on the positive side. It lost in 2008-17 (−0.094).
  With 22 market-windows tested, one such cell is expected by chance. It is not a candidate.

## Primary set by year (net R)

| year | n | exp | DAX R | silver R | | year | n | exp | DAX R | silver R |
|---|---|---|---|---|---|---|---|---|---|---|
| 2008 | 98 | −0.110 | −1.4 | −9.4 | | 2018 | 91 | −0.290 | +3.4 | −29.8 |
| 2009 | 100 | +0.033 | +11.2 | −8.0 | | 2019 | 103 | −0.277 | −10.7 | −17.8 |
| 2010 | 114 | +0.089 | +3.4 | +6.7 | | 2020 | 103 | −0.084 | −9.3 | +0.7 |
| 2011 | 96 | +0.227 | +5.8 | +16.0 | | 2021 | 100 | −0.460 | −13.3 | −32.7 |
| 2012 | 97 | −0.133 | +2.3 | −15.2 | | 2022 | 103 | −0.122 | −12.6 | 0.0 |
| 2013 | 91 | −0.280 | −4.9 | −20.5 | | 2023 | 104 | −0.040 | −5.2 | +1.0 |
| 2014 | 91 | −0.437 | −3.4 | −36.4 | | 2024 | 113 | −0.021 | −4.1 | +1.7 |
| 2015 | 93 | −0.146 | −0.2 | −13.3 | | 2025 | 130 | +0.091 | −2.2 | +14.0 |
| 2016 | 97 | −0.389 | −5.2 | −32.5 | | 2026 | 87 | +0.097 | −7.0 | +15.5 |
| 2017 | 83 | −0.296 | −6.8 | −17.8 | | | | | | |

- 5 of 19 years are positive for the pair. The DAX lost in 8 of 9 years from 2018.
- Silver's positive years are 2010-11 and 2025-26: the two silver bull runs.

## Silver: is the gold rule more than being long silver?

- **No.** Random silver buys with the same stop band, exit and costs: −0.103R a trade in 2008-17 and −0.106R in 2018-26 (silver
  pays about 0.19R a trade in costs). Silver A-setups minus that control, same year: **−0.102R a trade in 2008-17 (t −1.99)** and
  **+0.019R in 2018-26 (t 0.31)**. The rule's timing adds nothing over random buys on silver, and in 2008-17 it was worse.
- That repeats #526's gold finding (gold drift-adjusted +0.022R in 2008-17) and ict-universe's silver finding (positive only in
  the 2025-26 rally). The paper silver shadow's positive 2025-26 record fits a silver bull run, not a timing edge.
- Even before costs, silver A-setups made −0.013R a trade in 2008-17.

## DAX: the same side split as the US indices (descriptive)

| DAX | buys (against a daily downtrend) | sells (against a daily uptrend) |
|---|---|---|
| 2008-17 | n 122, +0.110 | n 184, −0.068 |
| 2018-26 | n 117, +0.139 | n 275, **−0.281** |

The losses come from the sells: fading H1 sweeps of highs while the daily trend is up. #526 found the same on NQ/ES/YM in
2008-17 (index sells −0.110, t −2.8). This was not pre-registered and is not a filter proposal. It resembles the existing
paper variant 'dip' (`research/edge/ict-index-longonly`) and the failed trend-side filter (#533), so it is no new evidence.

## Honest reading

- **The ICT A-setup rule is not a general edge.** On every market it was never tuned on, in both decades, it loses after costs.
  It also roughly breaks even before costs (H1 gross +0.006R / +0.014R; FX gross −0.009R / +0.042R). There is nothing here to
  scale or carry to new markets.
- **The desk's own 2018-26 result stands as an exception, not a pattern.** The reference set reproduces exactly (+0.093R,
  t 2.58), but nothing else tested by this harness shows the edge: not the desk's own markets in 2008-17 (#526), and not the
  11 new markets in either window.
  That points to the desk's 2018-26 figure being partly selection (the index rule was built on 2023-26, the gold rule on 2019-26)
  plus a gold bull market, rather than a structural ICT edge.
- **Implications:**
  - Do not add the DAX, silver or any FX pair to the ICT desk.
  - The silver shadow stream (`SHADOW_MARKETS.xag`) has no long-history support: its rule loses on silver in 2008-17 and
    2018-24, and adds nothing over random silver buys. This is a reason for the owner to treat it as a silver-trend record,
    not as evidence for ICT. It is not changed here (paper only; the owner decides).
  - Keep the ICT desk at its current small size as a forward test. The robustness label moves from "fragile" toward
    "no demonstrated edge outside 2018-26 on its own markets".
- No live rule, config, tracker, replay or site code changed.

## Multiple testing

- Two pre-registered hypotheses (H1 primary, H2 secondary). Both failed.
- The per-market, per-year, side and drift sections are descriptive.

## Files

- `preregistration.md`: the market list, rule mapping, costs, windows and bar, committed before the run (7c7468e6).
- `run.mjs`: the harness (the desk's code over the candles, the silver drift control, the DAX sensitivity) and the statistics.
- `result.json`: every table above for every set and window, per-market years, sides, every-signal figures, coverage per market
  and year, the cost functions, and the verdicts.

Re-run (about 3 minutes once the candles are cached):

```
node research/edge/ict-oos-2008/fetch.mjs <cache> 2007-06-01 2026-11-01 de40,xag,eurusd,gbpusd,usdjpy,audusd,usdcad,usdchf,nzdusd,eurjpy,gbpjpy
node research/edge/ict-oos-2008/fetch.mjs <cache>          # the desk's own markets (reference set)
node research/edge/ict-breadth/run.mjs <cache> research/edge/ict-breadth/result.json
```
