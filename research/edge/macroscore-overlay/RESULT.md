# Gold Macro Score as a sizing overlay: the skill's rule on the council's gold systems, out of sample

**Verdict: FAIL on the pre-registered rule. The calibration (H0) passes and replicates the skill almost exactly (weekly IC +0.149, Newey–West t 3.24; score > +0.25 → +2.28% over the next 4 weeks, up 68%), but the sizing rule ("full risk above +0.25, half otherwise") keeps only 65% of the fixed arm's total R on untouched 2006–17 against the 90% the pre-registration required; its higher return / drawdown (3.37 → 4.46 at ×1, 2.50 → 3.37 at ×2, both halves) is within noise (bootstrap P 0.85) and in 2012–17 is only the arithmetic of halving risk. No proposal goes live; nothing changes.**

Paper research only. No live rule, size, filter, trader, replay or site code was changed. Pre-registered in `preregistration.md` (#594, committed and merged before any score-vs-position number existed); the study ran once on GitHub Actions (`.github/workflows/macroscore-overlay.yml`, run 42460364323, 2026-11-08 07:50 UTC) and wrote council-data `research/macroscore-overlay.json`; `result.json` here is that file plus the tables below.

## Question

`council/macroscore.mjs` (#592) ports the macro-agent-demo skill's **Gold Macro Score** (fall in the 10y real yield over 4 weeks, fall in the ICE dollar index over 4 weeks, fall in the 2Y over 13 weeks, 10y–2y steepening over 13 weeks; weekly, expanding z-scores, clipped ±3, averaged). The skill's execution rule for a long-only gold swing system is *"use the score to size, not to permit: half risk normally, full planned risk when the score is above +0.25."* Does that rule help the council's honest-positive, long-only gold systems (Gold trend N20 `gtrend`, Gold trend fast N5 `gtrend5`, Gold daily engulf `geg`, Gold H4 trendline `gtl`, Mosha BO buys) on the 2006–17 positions they never saw (#530, #580)? And is the score calibrated on the council's own data at all?

## Verdict table (pre-registered bars)

| Test | Bar | Untouched 2006-07 .. 2017-12 | Result |
|---|---|---|---|
| **H0** calibration | IC > 0, Newey–West t ≥ 2, IC within ±0.05 of +0.15, > +0.25 weeks beat the rest | IC +0.149, t 3.24, +2.28% vs +0.43% | **pass** |
| **H1.1** return / drawdown, sized > fixed, ×1 **and** ×2 | both | 4.46 vs 3.37 · 3.37 vs 2.50 | pass |
| **H1.2** in both halves (×1) | both | 2006–11: 4.56 vs 3.44 · 2012–17: 1.03 vs 0.97 | pass (the second half by 0.06) |
| **H1.3** total R sized ≥ 90% of fixed (×1) | ≥ 125.6R | **+91.0R vs +139.5R (65%)** | **fail** |
| Confirmation 2018-01 .. 2026-10 (reported) | H1.1 and H1.3 | 15.66 vs 10.66 · +217.5R vs +296.2R (73%) | not confirmed (same shape) |
| Noise (reported) | paired month bootstrap P(ret-DD diff > 0) ≥ 0.95 | 0.852 (×1), 0.855 (×2) | within noise |

## Reading

- **The score replicates.** On the council's own inputs (FRED DFII10 / DGS2 / DGS10, the ICE DXY from the council's OANDA daily pairs, OANDA gold) the weekly rank IC with the next 4-week gold return is **+0.149** over 999 weeks 2007-08 to 2026-10 (the skill: +0.15 on ~1,000 weeks), Newey–West t 3.24 (skill 2.8); weeks above +0.25 (21% of weeks) made **+2.28%** over 4 weeks, up **68%** (skill +2.2%, 69%); the rest +0.43%, up 51%; weeks below −0.75 made +0.16%, up 49%: a negative score predicts no fall, as the skill says. It is positive in all three of the skill's periods (IC +0.10 / +0.15 / +0.22), but the first third (2007–14) alone has t 1.43. **This is a replication, not an out-of-sample test of the score**: the skill chose its drivers and the +0.25 cut on 2007–26, the same years. The positions below are untouched for the systems; the score itself is in sample everywhere.
- **The sizing rule fails the pre-registered bar, on total R.** Only **16%** of the untouched long entries (128 of 810) happened with a score above +0.25 (24% in 2006–11, **9%** in 2012–17), so "half risk normally" means an average size of 0.58R and a total of +91.0R against +139.5R. To keep 90% of the R, that 16% of positions would have had to earn 80% of the profit; they earned 31% (+42.6R). The pre-registered bar stands; it is a fair reading of the skill's rule as stated, which halves planned risk in most weeks and gives back the R it does not risk.
- **What the rule does buy is a lower drawdown for the R it keeps**, and that is consistent: return / drawdown rises at ×1 and ×2 in every window (untouched 3.37 → 4.46, built-on 10.66 → 15.66, recent 16.79 → 23.08), in all four halves, in all five systems on untouched data and on 2018–26. At equal average risk the sized arm's total is +157.2R against +139.5R untouched (+13%), +330R against +296R built-on (+11%), +222R against +210R recent (+6%). None of it is more than noise: the paired month bootstrap gives P(ret-DD diff > 0) 0.85 / 0.84 / 0.60, and the Sharpe-like t **falls** in the two later windows (3.65 → 3.38, 3.15 → 2.71; P(t diff > 0) 0.33 / 0.29): on the years the owner trades, the ≤ +0.25 positions made +0.60R a position (n 194) and halving them cost more than it smoothed.
- **The 2012–17 half shows where the information is not.** Positions above +0.25 made **+0.049R** (n 37) against +0.098R for the rest; the sized arm's return / drawdown of 1.03 against 0.97 is just the drawdown halving with the risk (−41.4 → −20.4R, total 40.2 → 21.0R). All the untouched improvement comes from 2006–11, when real yields were falling and gold rising: above +0.25 +0.448R (n 91) against +0.200R.
- **Per position**, the score does separate winners from the rest in the right direction everywhere: +0.333R vs +0.142R untouched (win 48% vs 40%, Welch 1.13, permutation P 0.11), +0.62R vs +0.33R built-on (Welch 1.41, P 0.057), +0.82R vs +0.60R recent (0.63). Direction right, significance absent, exactly as the skill's own numbers would predict for 128 positions.
- **Gate (H2, "permit, not size") loses most of the profit**, as expected: it keeps 16% of the untouched positions and 31% of the R (+42.6R, worst drawdown −6.8R, return / drawdown 6.3 but t 1.92 against 2.41), 47% of the R on 2018–26 and 45% on 2023–26. Whatever edge these systems have is not confined to high-score weeks; the skill's "size, not permit" is right in that sense.
- **Mosha sells (H3):** 4 sells in 20 years opened with a score above +0.25 (1 untouched, −1.0R; 3 on 2018–26, +2.8R together). Nothing can be read from four trades.
- **Book effect:** books B and C (honest-book) with the rule on their longs: untouched return / drawdown 3.21 → 4.70 (B) and 3.73 → 5.47 (C), ×2 2.07 → 3.22 and 2.70 → 3.94, t 2.19 → 2.35 and 2.45 → 2.61; built-on 9.66 → 14.49 and 10.72 → 15.78 with t falling (3.84 → 3.71, 3.66 → 3.39); recent 13.29 → 18.28 and 16.79 → 23.08 with t falling (3.57 → 3.19, 3.15 → 2.71). Total R −31% / −25% / −27%. P(ret-DD diff > 0) 0.82 / 0.70 / 0.54.
- **Now:** the score for the week to 2026-11-06 is **+0.13** (AUCTION): under the rule, every council gold long today would be at half risk.

**For the owner (no change made).** The skill's score is real as a weekly reading, and that is what #592 made it. As a sizing rule on the council's systems it is a risk dial, not an edge: it lowers the drawdown of the R it keeps and gives up a third of the R, with nothing beyond noise to show the kept R is better chosen, and nothing at all in 2012–17. No shadow stream follows (the pre-registered class is FAIL). If the owner wants a free forward tally, the paper book could log "what the sized book would have done" next to the fixed book, as a reading; that is a request, not a recommendation from this evidence.

## Results

Net R a position as the source studies recorded it (×1 = $0.30 a unit a round trip, ×2 = $0.60; adds and live sizes inside the position); sizes multiply it. Daily equity as the honest book: R booked on the close day (weekends to Monday), metrics on weekdays. "Positions" are longs with a score (entered from the first score week, 2007-08-24); the 96 longs entered 2006-07 to 2007-08 have no score and are outside both arms (sensitivity "frame from 2003" includes them). Windows by entry date.

### H0 · weekly score against the next 4-week gold return (Friday weeks)

| Window | Weeks | Spearman IC | Newey-West t | plain t | > +0.25: n / mean 4-week return / up | ≤ +0.25: mean / up | < −0.75: n / mean / up |
|---|---|---|---|---|---|---|---|
| **2007-08-24 .. 2026-10-09** | 999 | **+0.149** | **3.24** | 4.77 | 209 / **+2.28%** / **68%** | +0.43% / 51% | 106 / +0.16% / 49% |
| 2007-14 | 384 | +0.103 | 1.43 | 2.02 | 65 / +2.64% / 71% | +0.38% / 52% | | 
| 2015-21 | 366 | +0.150 | 2.01 | 2.91 | 74 / +1.81% / 62% | +0.14% / 49% | | 
| 2022-26 | 249 | +0.222 | 2.48 | 3.57 | 70 / +2.45% / 71% | +1.00% / 54% | | 
| skill, 2007–26 | ~1,000 | +0.15 | 2.8 | | +2.2% / 69% | no edge | no fall predicted |

Share of weeks above +0.25: 21% (2007–14: 17%, 2015–21: 20%, 2022–26: 28%). Newey–West: Bartlett, 3 lags, for the 4-week overlap.

### H1 / H2 · pooled longs (gtrend, gtrend5, geg, gtl, Mosha buys): fixed 1R, sized 1R / 0.5R, gate

| Window | positions (> +0.25) | arm | ×1 total R | ×1 worst DD | ×1 return / DD | ×1 t | ×2 total R | ×2 worst DD | ×2 return / DD | ×2 t | + months | + years |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **untouched 2006-07 .. 2017-12** | 810 (128, 16%) | fixed 1R | +139.5 | −41.4 | 3.37 | 2.41 | +117.1 | −46.9 | 2.50 | 2.03 | 39% | 8/13 |
|  |  | **sized 1R / 0.5R** | +91.0 | −20.4 | 4.46 | 2.56 | +78.2 | −23.2 | 3.37 | 2.21 | 40% | 9/13 |
|  |  | gate (H2) | +42.6 | −6.8 | 6.30 | 1.92 | +39.2 | −7.1 | 5.49 | 1.78 | 14% | 5/13 |
| | | sized at equal average risk (÷ 0.579) | +157.2 | | same | same | +135.0 | | same | same | | |
| **built-on 2018-01 .. 2026-10** | 704 (224, 32%) | fixed 1R | +296.2 | −27.8 | 10.66 | 3.65 | +280.6 | −29.7 | 9.43 | 3.46 | 57% | 7/9 |
|  |  | **sized 1R / 0.5R** | +217.5 | −13.9 | 15.66 | 3.38 | +207.2 | −15.1 | 13.69 | 3.23 | 53% | 7/9 |
|  |  | gate (H2) | +138.9 | −11.6 | 11.99 | 2.43 | +133.9 | −13.4 | 9.97 | 2.34 | 27% | 6/9 |
| | | sized at equal average risk (÷ 0.659) | +330.1 | | same | same | +314.4 | | same | same | | |
| **recent 2023-01 .. 2026-10** | 309 (115, 37%) | fixed 1R | +210.3 | −12.5 | 16.79 | 3.15 | +205.9 | −12.6 | 16.31 | 3.08 | 65% | 4/4 |
|  |  | **sized 1R / 0.5R** | +152.5 | −6.6 | 23.08 | 2.71 | +149.4 | −6.7 | 22.43 | 2.66 | 61% | 4/4 |
|  |  | gate (H2) | +94.6 | −7.8 | 12.11 | 1.83 | +92.9 | −8.1 | 11.42 | 1.80 | 35% | 3/4 |
| | | sized at equal average risk (÷ 0.686) | +222.2 | | same | same | +217.8 | | same | same | | |

### Halves

| Half | positions (> +0.25) | fixed ×1 total / DD / ret-DD / t | sized ×1 total / DD / ret-DD / t | ret-DD ×2 fixed → sized | gate ×1 total / ret-DD | mean R > +0.25 vs ≤ |
|---|---|---|---|---|---|---|
| 2006-07 .. 2011-12 | 383 (91) | +99.3 / −28.8 / 3.44 / 2.16 | +70.0 / −15.4 / **4.56** / 2.31 | 2.84 → 3.83 | +40.8 / 7.41 | +0.448 (n 91) vs +0.200 |
| 2012-01 .. 2017-12 | 427 (37) | +40.2 / −41.4 / 0.97 / 1.14 | +21.0 / −20.4 / **1.03** / 1.13 | 0.60 → 0.63 | +1.8 / 0.27 | +0.049 (n 37) vs +0.098 |
| 2018-01 .. 2022-12 | 395 (109) | +85.9 / −27.8 / 3.09 / 1.88 | +65.1 / −13.9 / **4.68** / 2.08 | 2.51 → 3.82 | +44.2 / 3.82 | +0.406 (n 109) vs +0.146 |
| 2023-01 .. 2026-10 | 309 (115) | +210.3 / −12.5 / 16.79 / 3.15 | +152.5 / −6.6 / **23.08** / 2.71 | 16.31 → 22.43 | +94.6 / 12.11 | +0.823 (n 115) vs +0.596 |
| 2023-01 .. 2024-11 | 154 (58) | +79.1 / −10.5 / 7.53 / 2.49 | +49.5 / −5.6 / **8.86** / 2.59 | 7.10 → 8.27 | +19.9 / 2.54 | +0.342 (n 58) vs +0.617 |
| 2024-12 .. 2026-10 | 155 (57) | +131.2 / −12.5 / 10.47 / 2.23 | +103.0 / −6.6 / **15.59** / 1.95 | 10.28 → 15.32 | +74.8 / 13.52 | +1.312 (n 57) vs +0.576 |

### Per position: entries above +0.25 against the rest

| Window | > +0.25: n / win / mean R ×1 / ×2 | ≤ +0.25: n / win / mean R ×1 / ×2 | Welch t ×1 | permutation P |
|---|---|---|---|---|
| untouched 2006-07 .. 2017-12 | 128 / 48% / **+0.333** / +0.306 | 682 / 40% / +0.142 / +0.114 | 1.13 | 0.114 |
| built-on 2018-01 .. 2026-10 | 224 / 50% / **+0.620** / +0.598 | 480 / 42% / +0.328 / +0.306 | 1.41 | 0.057 |
| recent 2023-01 .. 2026-10 | 115 / 52% / **+0.823** / +0.808 | 194 / 47% / +0.596 / +0.583 | 0.63 | 0.241 |

### Per system (tests 1 / 2 / 3 = return / drawdown ×1, return / drawdown ×2, total ≥ 90%)

| System | Window | n (> +0.25) | fixed ×1 total / DD / ret-DD | sized ×1 total / DD / ret-DD | ret-DD ×2 fixed → sized | gate total / ret-DD | mean R > +0.25 vs ≤ (Welch) | tests 1 / 2 / 3 |
|---|---|---|---|---|---|---|---|---|
| Gold trend N20 | untouched | 66 (11) | +39.5 / −5.4 / 7.35 | +26.9 / −2.9 / **9.25** | 7.05 → 8.90 | +14.2 / 7.51 | +1.295 vs +0.460 (0.75) | yes / yes / no |
|  | built-on | 59 (18) | +78.8 / −3.8 / 20.69 | +57.2 / −2.1 / **27.33** | 20.25 → 26.77 | +35.6 / 8.89 | +1.980 vs +1.054 (0.62) | yes / yes / no |
|  | recent | 27 (8) | +50.8 / −2.4 / 21.27 | +38.6 / −1.2 / **32.36** | 20.96 → 31.90 | +26.5 / 26.30 | +3.310 vs +1.280 (0.66) | yes / yes / no |
| Gold trend fast N5 | untouched | 114 (17) | +49.2 / −10.7 / 4.58 | +30.1 / −5.5 / **5.51** | 4.27 → 5.13 | +11.1 / 5.41 | +0.652 vs +0.393 (0.49) | yes / yes / no |
|  | built-on | 98 (26) | +97.8 / −7.5 / 13.03 | +69.2 / −3.8 / **18.44** | 12.68 → 17.97 | +40.6 / 13.29 | +1.562 vs +0.795 (0.72) | yes / yes / no |
|  | recent | 42 (12) | +63.9 / −2.6 / 24.59 | +46.3 / −2.1 / **21.93** | 24.29 → 21.68 | +28.6 / 17.66 | +2.384 vs +1.178 (0.57) | no / no / no |
| Gold daily engulf | untouched | 224 (41) | +40.0 / −15.2 / 2.64 | +26.0 / −9.0 / **2.88** | 1.95 → 2.24 | +12.1 / 2.58 | +0.294 vs +0.153 (0.49) | yes / yes / no |
|  | built-on | 195 (72) | +54.0 / −9.1 / 5.93 | +37.0 / −6.1 / **6.08** | 4.66 → 4.77 | +20.1 / 3.50 | +0.279 vs +0.276 (0.01) | yes / yes / no |
|  | recent | 84 (37) | +29.0 / −5.1 / 5.74 | +17.7 / −5.1 / **3.50** | 5.34 → 3.21 | +6.3 / 1.25 | +0.171 vs +0.483 (-0.77) | no / no / no |
| Gold H4 trendline | untouched | 362 (53) | +5.7 / −26.3 / 0.22 | +3.9 / −15.0 / **0.26** | -0.09 → -0.05 | +2.1 / 0.38 | +0.040 vs +0.012 (0.19) | yes / yes / no |
|  | built-on | 318 (97) | +55.7 / −12.4 / 4.50 | +45.3 / −9.3 / **4.88** | 3.69 → 3.76 | +34.9 / 3.87 | +0.360 vs +0.094 (1.62) | yes / yes / no |
|  | recent | 138 (48) | +47.8 / −9.3 / 5.13 | +37.2 / −5.0 / **7.48** | 4.92 → 7.21 | +26.5 / 4.27 | +0.552 vs +0.237 (1.29) | yes / yes / no |
| Mosha BO | untouched | 44 (6) | +5.0 / −15.1 / 0.33 | +4.1 / −8.1 / **0.51** | 0.10 → 0.24 | +3.1 / 1.19 | +0.523 vs +0.049 (0.45) | yes / yes / no |
|  | built-on | 34 (11) | +9.9 / −9.8 / 1.00 | +8.8 / −5.0 / **1.77** | 0.85 → 1.54 | +7.7 / 1.90 | +0.698 vs +0.095 (0.79) | yes / yes / no |
|  | recent | 18 (10) | +18.7 / −4.0 / 4.62 | +12.7 / −4.0 / **3.14** | 4.47 → 3.03 | +6.7 / 1.67 | +0.675 vs +1.489 (-0.65) | no / no / no |

### Noise and sensitivities (paired month-block bootstrap, 2,000 draws, seed 1; lag and frame variants)

| Window | P(ret-DD sized > fixed), 90% band ×1 | ×2 | P(t sized > fixed) ×1 | lag 2 days: ret-DD fixed → sized (n) | frame from 2003: ret-DD fixed → sized (n) |
|---|---|---|---|---|---|
| untouched 2006-07 .. 2017-12 | 0.852 [-0.57, +3.22] | 0.855 | 0.755 | 3.37 → 4.66 (810) | 3.78 → 4.41 (906) |
| built-on 2018-01 .. 2026-10 | 0.836 [-2.02, +9.79] | 0.837 | 0.329 | 10.66 → 15.90 (704) | 10.66 → 16.30 (704) |
| recent 2023-01 .. 2026-10 | 0.600 [-5.54, +9.15] | 0.596 | 0.288 | 16.79 → 22.32 (309) | 16.79 → 20.07 (309) |

The primary lag makes a week's score usable from Wednesday 00:00 UTC (24:00 UTC of the second weekday after its Friday, the macro-gold convention, so a Monday 00:04 UTC trend entry never sees Friday's H.15 value); "lag 2 days" is the looser pre-registered sensitivity (usable from Sunday 00:00 UTC). "Frame from 2003" starts the expanding windows in 2003-06 instead of 2006-06, which gives every position a score; it is not the council's reading.

### By year (×1 total R, pooled longs)

| Year (untouched) | fixed | sized | | Year (built-on) | fixed | sized |
|---|---|---|---|---|---|---|
| 2007 | +22.2 | +22.2 | | 2018 | -17.4 | -8.7 |
| 2008 | -2.6 | +1.5 | | 2019 | +42.5 | +17.1 |
| 2009 | +23.6 | +9.7 | | 2020 | +45.8 | +38.8 |
| 2010 | +8.8 | +13.1 | | 2021 | +17.9 | +19.2 |
| 2011 | +46.7 | +23.2 | | 2022 | -8.4 | -4.0 |
| 2012 | +14.9 | +8.8 | | 2023 | +34.5 | +20.5 |
| 2013 | -18.2 | -6.3 | | 2024 | +60.0 | +36.6 |
| 2014 | -6.7 | -3.3 | | 2025 | +104.8 | +90.7 |
| 2015 | -11.2 | -7.9 | | 2026 | +16.5 | +7.4 |
| 2016 | +46.6 | +22.7 | |  |  |  |
| 2017 | +4.9 | +2.0 | |  |  |  |
| 2018 (Dec-2017 entries) | +10.5 | +5.3 | |  |  |  |

### H3 · Mosha BO sells by the score at entry

| Window | sells with a score | > +0.25: n / win / mean R ×1 / total | ≤ +0.25: n / win / mean R ×1 / total | Welch t |
|---|---|---|---|---|
| untouched 2006-07 .. 2017-12 | 13 | 1 / 0% / -1.021 / -1.0 | 12 / 58% / +0.550 / +6.6 | — |
| built-on 2018-01 .. 2026-10 | 12 | 3 / 33% / +0.948 / +2.8 | 9 / 33% / -0.120 / -1.1 | 0.52 |
| all 2006–26 | 25 | 4 / 25% / +0.455 / +1.8 | 21 / 48% / +0.262 / +5.5 | 0.13 |

### Book effect (honest-book books B and C; Mosha sells unchanged at 1R)

| Book | Window | positions | fixed ×1 total / DD / ret-DD / t | longs sized ×1 total / DD / ret-DD / t | ×2 ret-DD fixed → sized | P(ret-DD diff > 0) |
|---|---|---|---|---|---|---|
| B (gtrend, geg, mosha-bo, gtl) | untouched 2006-07 .. 2017-12 | 714 | +93.7 / −29.2 / 3.21 / 2.19 | +64.4 / −13.7 / **4.70** / 2.35 | 2.07 → 3.22 | 0.820 |
| B (gtrend, geg, mosha-bo, gtl) | built-on 2018-01 .. 2026-10 | 618 | +200.1 / −20.7 / 9.66 / 3.84 | +150.1 / −10.4 / **14.49** / 3.71 | 8.21 → 12.32 | 0.700 |
| B (gtrend, geg, mosha-bo, gtl) | recent 2023-01 .. 2026-10 | 267 | +146.3 / −11.0 / 13.29 / 3.57 | +106.2 / −5.8 / **18.28** / 3.19 | 12.83 → 17.67 | 0.537 |
| C (gtrend, geg, mosha-bo, gtl, gtrend5) | untouched 2006-07 .. 2017-12 | 828 | +142.9 / −38.3 / 3.73 / 2.45 | +94.5 / −17.3 / **5.47** / 2.61 | 2.70 → 3.94 | 0.845 |
| C (gtrend, geg, mosha-bo, gtl, gtrend5) | built-on 2018-01 .. 2026-10 | 716 | +298.0 / −27.8 / 10.72 / 3.66 | +219.3 / −13.9 / **15.78** / 3.39 | 9.46 → 13.75 | 0.743 |
| C (gtrend, geg, mosha-bo, gtl, gtrend5) | recent 2023-01 .. 2026-10 | 309 | +210.3 / −12.5 / 16.79 / 3.15 | +152.5 / −6.6 / **23.08** / 2.71 | 16.31 → 22.43 | 0.600 |

### Shares of entries above +0.25

| Window | pooled | gtrend | gtrend5 | geg | gtl | Mosha buys |
|---|---|---|---|---|---|---|
| untouched 2006-07 .. 2017-12 | 128 / 810 (16%) | 11 / 66 | 17 / 114 | 41 / 224 | 53 / 362 | 6 / 44 |
| built-on 2018-01 .. 2026-10 | 224 / 704 (32%) | 18 / 59 | 26 / 98 | 72 / 195 | 97 / 318 | 11 / 34 |
| recent 2023-01 .. 2026-10 | 115 / 309 (37%) | 8 / 27 | 12 / 42 | 37 / 84 | 48 / 138 | 10 / 18 |

## Post hoc (not pre-registered, labelled)

- The 90% total-R bar was the right reading of the skill's rule but a hard one for any rule that halves risk 84% of the time: a sizing rule with no information at all would keep 58% of the R here. An equal-average-risk bar (compare total R at the same mean size) was pre-registered only as a reported figure; on it the rule is +13% / +11% / +6%, within noise. Any new bar would now be in sample on these positions, and gold daily history before 2006 is not available to the council, so there is no untouched slice left to test it on.
- The untouched by-year row for 2018 (+10.5R fixed / +5.3R sized) holds positions entered in December 2017 that closed in January 2018 (booked on the close day).

## Method notes

- Score: `scoreSeries` in `run.mjs` uses `weeklyFrame` and `expandingZ` from `council/macroscore.mjs` with the same raw drivers as `goldMacroScore`; every one of the 1,003 weekly values was checked equal (to 2 decimals) to `goldMacroScore({ asOf: friday })`: 0 mismatches. First score week 2007-08-24 (FROM 2006-06 + 13 + 52 weeks), 1,067 weeks to 2026-11-06.
- Data: FRED DFII10 / DGS2 / DGS10 (5,966 observations each, to 2026-11-05); DXY 7,674 days 2002-05 to 2026-11 from the council daily cache; gold 6,481 days from 2006-03-20; positions 1,533 (gold-systems-oos) + 108 (mosha-oos), none re-run, no candles refetched.
- Coverage: 1,611 longs, 1,515 with a score, 96 without (all 2006-07 to 2007-08), 30 Mosha sells (25 with a score).
- Files: council-data `research/macroscore-overlay.json` (served at `/cdata/research/macroscore-overlay.json`); `result.json` here = that file + `tables` + the verdict line; `positions` carries each position's score at entry (`s` primary lag, `s2d` 2-day lag, `sS2` frame from 2003) for re-analysis without a refetch.
- Reproduce: `node research/edge/macroscore-overlay/run.mjs out.json` with `FRED_DIR` (the three fredgraph CSVs) and `DAILY_DIR` (the six daily cache files) set; the workflow does the same on GitHub Actions and skips once a complete result exists.
