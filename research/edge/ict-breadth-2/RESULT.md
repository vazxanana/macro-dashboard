# ICT breadth test, part 2: the unchanged A-setup rule on the nine markets #545 could not test

**Verdict: FAIL (pre-registered bar), for the primary set (all nine new markets pooled) and for both secondary sets (seven
indices; two metals).** The desk's A-setup rule, unchanged, has no edge on FTSE 100, Nikkei 225, ASX 200, Euro Stoxx 50, Hang
Seng, China A50, Russell 2000, platinum or palladium in either decade: **pooled −0.194R a trade after costs in 2008-17 (n 3,720,
t −8.0) and −0.137R in 2018-26 (n 3,799, t −6.3)**, with 2 of 9 and 1 of 9 markets positive. The seven indices alone are
−0.028R (t −0.95) and −0.057R (t −2.24); the two metals −0.515R (t −12.8) and −0.342R (t −8.1), where the spread eats 0.4-0.7R a
trade. Before costs the nine break even (+0.051R and +0.018R a trade).

**Answer to the question asked: #545's answer now stands on 20 markets instead of 11. There is no general ICT edge.** The desk's
own GC/NQ/ES/YM set, re-run in the same pass, reproduces #545 (window A −0.013R, n 2,235; window B +0.093R, t 2.58, with #545's
code) and stays the only market set and window where the rule is positive and significant. On every other market, in both
decades, the same rule loses or breaks even. No live rule, config, tracker, replay or site code was changed.

## How it was run

- **Pre-registration first.** `preregistration.md` and `run.mjs` were committed and pushed (0c321415; rebased onto main as 70198a19 before the PR) after the candle download
  and a timestamps-only coverage probe, before any signal or trade on these markets was generated. The test ran once. Nothing
  was changed after it.
- **Markets.** The nine the proxy did not serve in #545 (it does since #553): uk100, jp225, au200, eu50, hk33, cn50, us2000
  (index rule, the tracker's default for a market without an aRule) and xpt, xpd (gold rule, as the tracker's silver shadow
  market). OANDA 5m mid candles 2007-06 to 2026-10 (cn50 from 2011-08, the start of its history), fetched with #526's
  `fetch.mjs` unchanged into the #545 cache.
- **Harness.** #545's `research/edge/ict-breadth/run.mjs`, extended not forked: its body is now the exported `run(cfg)` (the
  CLI default is the #545 universe, unchanged); this study's `run.mjs` only defines the universe, sets and sensitivities.
  The same desk code drives it: `signals()`, `isASetup()`, `isAPlus()`, `sizeOf()`, `MIN_GRADE`, `inHalt()`, `cmeShut()`, `agg()`,
  `dailyNY()` (`ict/tracker.mjs`) and `simulate()` (`ict/replay.mjs`); the replay's busy rule; the same statistics and bar.
- **Costs** (one round trip, spread + slippage, in price units; x2 and gross reported): indices 0.02% of price + 1 point
  (#545's DAX model; about 0.08R a trade here); platinum 0.30% of price and palladium 0.80% of price (silver's model, spread +
  a third of it as slippage, scaled to each metal's typical OANDA spread; about 0.39R and 0.74R a trade). The metal costs are a
  share of price because platinum and palladium ranged 3-15x over 2008-26.
- **5m exits.** These CFDs were quoted 5-14 hours a day in 2008-13 and 20-23 hours now, so the complete-day test for 5m exits
  is adaptive: a UTC day counts when it has >= min(200, 0.9 x that year's median candles a day); other days get H1 exits as
  #526. Every market was also run with the unchanged 200-candle test (H1 exits on the short days): no cell changes sign; the
  largest move is Hang Seng 2008-17 (+0.229 -> +0.266, both n 175, t 1.4 -> 1.5), the rest move by <= 0.004R or not at all.
- **Reference, read first.** #561 (merged after #545) wired the CME holiday/early-close calendar into `cmeShut()`, so today's
  desk code drops a few more candles than #545's. The desk set was therefore reproduced two ways before any new-market number
  was read: #545's `run.mjs` at its own commit (ade8489a) over the same cache gives #545's figures exactly (A −0.013R, n 2,235,
  t −0.45; B +0.093R, n 1,786, t 2.58); the extended harness with today's code gives A −0.009R (n 2,224, t −0.30) and B +0.090R
  (n 1,789, t 2.51). The new markets use today's code.
- **Windows.** A = 2008-01-01 to 2017-12-31; B = 2018-01-01 to 2026-10-31. Both untouched for all nine markets.

## The pre-registered test (A-setups, net, costs x1)

Bar per set: pooled net > 0 with t >= 2 in **both** windows, and >= 60% of markets positive in both (all: 6 of 9; indices: 5
of 7; metals: 2 of 2).

| set | window | n | net exp | t | x2 exp | gross exp | markets > 0 | monthly t | pass |
|---|---|---|---|---|---|---|---|---|---|
| **all nine (primary)** | 2008-17 | 3,720 | **−0.194** | −8.01 | −0.439 | +0.051 | 2 of 9 | −6.92 | no |
| **all nine (primary)** | 2018-26 | 3,799 | **−0.137** | −6.27 | −0.293 | +0.018 | 1 of 9 | −5.84 | no |
| H1 seven indices | 2008-17 | 2,454 | −0.028 | −0.95 | −0.110 | +0.053 | 2 of 7 | −0.83 | no |
| H1 seven indices | 2018-26 | 2,727 | −0.057 | −2.24 | −0.113 | −0.001 | 1 of 7 | −1.98 | no |
| H2 platinum + palladium | 2008-17 | 1,266 | −0.515 | −12.82 | −1.076 | +0.046 | 0 of 2 | −9.81 | no |
| H2 platinum + palladium | 2018-26 | 1,072 | −0.342 | −8.12 | −0.749 | +0.065 | 0 of 2 | −6.99 | no |
| *reference: desk GC/NQ/ES/YM (today's code)* | *2008-17* | *2,224* | *−0.009* | *−0.30* | *−0.069* | *+0.051* | *2 of 4* | *−0.25* | *no* |
| *reference: desk GC/NQ/ES/YM (today's code)* | *2018-26* | *1,789* | *+0.090* | *2.51* | *+0.044* | *+0.136* | *4 of 4* | *2.35* | *yes* |
| *reference, #545's code (ade8489a)* | *2008-17* | *2,235* | *−0.013* | *−0.45* | *−0.073* | *+0.047* | *2 of 4* | | |
| *reference, #545's code (ade8489a)* | *2018-26* | *1,786* | *+0.093* | *2.58* | *+0.047* | *+0.138* | *4 of 4* | | |

**Primary: FAIL. H1: FAIL. H2: FAIL.** None is "positive but not significant": every new-market set is negative in both
windows. The reference set is 2018+-ONLY under the same bar, as in #526 and #545.

## By market

Net R a trade at costs x1 (t), A-setups. Drift-adjusted = minus the random-entry control's mean net R for the same year
(two-sided random entries with the index exit for the indices; random buys with the gold exit for the metals; same stop band and
costs).

| market | rule | 2008-17 n | 2008-17 exp (t) | x2 | gross | drift-adj (t) | 2018-26 n | 2018-26 exp (t) | x2 | gross | drift-adj (t) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| FTSE 100 | index | 348 | −0.027 (−0.39) | −0.087 | +0.032 | +0.006 (0.09) | 436 | −0.002 (−0.03) | −0.063 | +0.059 | +0.079 (1.16) |
| Nikkei 225 | index | 489 | +0.118 (1.65) | +0.081 | +0.155 | +0.075 (1.05) | 438 | −0.085 (−1.41) | −0.118 | −0.053 | −0.085 (−1.40) |
| ASX 200 | index | 406 | −0.011 (−0.15) | −0.078 | +0.056 | +0.035 (0.47) | 455 | **−0.116 (−2.08)** | −0.175 | −0.057 | −0.061 (−1.09) |
| Euro Stoxx 50 | index | 343 | **−0.156 (−2.15)** | −0.237 | −0.076 | −0.094 (−1.28) | 382 | −0.072 (−0.93) | −0.144 | +0.001 | −0.030 (−0.39) |
| Hang Seng | index | 175 | +0.229 (1.36) | +0.187 | +0.271 | +0.086 (0.51) | 291 | −0.006 (−0.07) | −0.034 | +0.023 | −0.046 (−0.52) |
| China A50 (from 2011-08) | index | 190 | −0.064 (−0.72) | −0.105 | −0.024 | −0.094 (−1.04) | 305 | +0.039 (0.61) | +0.008 | +0.071 | +0.048 (0.75) |
| Russell 2000 | index | 503 | **−0.173 (−3.02)** | −0.356 | +0.009 | −0.082 (−1.43) | 420 | −0.113 (−1.78) | −0.208 | −0.018 | −0.065 (−1.03) |
| Platinum | gold | 651 | **−0.431 (−8.07)** | −0.820 | −0.043 | −0.077 (−1.46) | 584 | **−0.205 (−3.63)** | −0.481 | +0.071 | +0.007 (0.12) |
| Palladium | gold | 615 | **−0.604 (−10.03)** | −1.348 | +0.140 | −0.035 (−0.59) | 488 | **−0.506 (−8.08)** | −1.071 | +0.058 | −0.013 (−0.21) |
| *GC (ref)* | *gold* | *610* | *+0.047 (0.80)* | | | *+0.096 (1.63)* | *531* | *+0.143 (2.11)* | | | *+0.103 (1.52)* |
| *NQ (ref)* | *index* | *538* | *−0.075 (−1.37)* | | | | *423* | *+0.106 (1.35)* | | | |
| *ES (ref)* | *index* | *534* | *−0.069 (−1.18)* | | | | *425* | *+0.039 (0.54)* | | | |
| *YM (ref)* | *index* | *542* | *+0.053 (0.88)* | | | | *410* | *+0.057 (0.85)* | | | |

- **No market is positive in both windows.** The three positive cells (Nikkei 2008-17 +0.118, Hang Seng 2008-17 +0.229, China
  A50 2018-26 +0.039) all have t < 1.7 and all reverse or vanish in the other window: Nikkei −0.085 in 2018-26, Hang Seng
  −0.006, China A50 −0.064 in 2011-17. With 18 market-windows, three weak positives are what chance gives.
- **Drift-adjusted, the positive cells shrink.** Nikkei 2008-17 +0.118 -> +0.075 (t 1.05; random two-sided entries on the Nikkei
  made +0.051 that decade). Hang Seng 2008-17 +0.229 -> +0.086 (t 0.51; the random control made +0.114, t 2.1, on a CFD quoted
  5 hours a day in 2008-13, so most of that cell is the data, not the rule). China A50 2018-26 +0.039 -> +0.048 (t 0.75). Nothing
  reaches t 2 either way.
- **Metals: the gold rule's timing is worth nothing on platinum and palladium.** Random buys with the same stop band, exit and
  costs lose −0.352R / −0.221R (platinum) and −0.568R / −0.481R (palladium); the A-setups minus that are −0.077 / +0.007 and
  −0.035 / −0.013. Gross, the A-setups are about flat (−0.043 to +0.140). That repeats #526's gold and #545's silver finding:
  the gold rule is being long a metal, with the spread subtracted.
- **Halves.** All-nine net: 2008-12 −0.154, 2013-17 −0.231, 2018-21 −0.126, 2022-26 −0.146. Indices: −0.042 / −0.016 / −0.034 /
  −0.075. Metals: −0.360 / −0.672 / −0.368 / −0.322. Every half negative.
- **Sides (indices).** As on the DAX (#545) and the US indices 2008-17 (#526), the sells (fading sweeps of highs while the daily
  trend is up) carry the loss: 2008-17 buys +0.016 (n 953) vs sells −0.056 (n 1,501); 2018-26 buys +0.023 (n 1,079) vs sells
  −0.110 (n 1,648). Descriptive, not pre-registered, no filter proposal: it is the same picture as the failed trend-side filter
  (#533) and the 'dip' paper variant.

## By year (all nine, net R)

| year | n | exp | R | | year | n | exp | R |
|---|---|---|---|---|---|---|---|---|
| 2008 | 308 | −0.150 | −46 | | 2018 | 426 | −0.206 | −88 |
| 2009 | 380 | −0.134 | −51 | | 2019 | 419 | −0.123 | −52 |
| 2010 | 362 | −0.068 | −25 | | 2020 | 414 | −0.134 | −55 |
| 2011 | 387 | −0.135 | −52 | | 2021 | 395 | −0.034 | −14 |
| 2012 | 363 | −0.286 | −104 | | 2022 | 437 | −0.118 | −51 |
| 2013 | 377 | −0.265 | −100 | | 2023 | 444 | −0.193 | −86 |
| 2014 | 369 | −0.404 | −149 | | 2024 | 426 | −0.176 | −75 |
| 2015 | 362 | −0.182 | −66 | | 2025 | 445 | −0.079 | −35 |
| 2016 | 414 | −0.196 | −81 | | 2026 | 393 | −0.169 | −67 |
| 2017 | 398 | −0.120 | −48 | | | | | |

0 of 19 years positive for the nine pooled; the indices alone are positive in 6 of 19 years (none above +0.08R a trade).

## Honest reading

- **The ICT A-setup rule is not a general edge.** Twenty markets have now been tested with the desk's own code: it is positive
  and significant only on its own four (GC/NQ/ES/YM) and only in 2018-26, the period the rules were built on. On the other 16
  (DAX, silver, nine FX pairs, seven more indices, platinum, palladium) it loses after costs in both decades and roughly breaks
  even before costs. There is nothing here to carry to new markets.
- **The reference figure is reproducible and stands as an exception.** It is the same number under #545's code and within last
  digits under today's calendar module.
- **Implications (for the owner; nothing changed here):**
  - Do not add any of these nine markets to the ICT desk. Platinum and palladium are the worst case: the CFD spread alone is
    0.4-0.7R a trade against a 0.3-0.75x daily-ATR stop.
  - Keep the ICT desk at its current small size as a forward test, with the robustness label "no demonstrated edge outside
    2018-26 on its own markets" (#526, #545, this).
- Paper research only; no live rule, config, tracker, replay or site code changed. The only code change is the #545 harness
  exposing `run()` (its CLI output is unchanged).

## Multiple testing

- One primary and two secondary pre-registered hypotheses. All failed.
- The per-market, per-year, side, drift and sensitivity sections are descriptive.

## Files

- `preregistration.md`: markets, coverage probe, rule mapping, costs, windows and bar, committed before the run (0c321415, rebased as 70198a19).
- `run.mjs`: this study's universe handed to #545's harness (`research/edge/ict-breadth/run.mjs`, `run()`).
- `result.json`: every table above for every set and window, per-market years, sides, every-signal figures, drift controls,
  coverage per market and year (with the adaptive threshold), the cost functions, the sensitivities and the verdicts.

Re-run (about 6 minutes once the candles are cached):

```
node research/edge/ict-oos-2008/fetch.mjs <cache> 2007-06-01 2026-11-01 uk100,jp225,au200,eu50,hk33,cn50,us2000,xpt,xpd
node research/edge/ict-oos-2008/fetch.mjs <cache>          # the desk's own markets (reference set)
node research/edge/ict-breadth-2/run.mjs <cache> research/edge/ict-breadth-2/result.json
```
