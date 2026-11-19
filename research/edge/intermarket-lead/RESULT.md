# Gradual information diffusion across markets: monthly leader signals: result

**Verdict: FAIL, 0 of 3 families: US500's past month does not lead the other indices next month after costs (OOS -1.1273R a month, t -1.79); copper and the dollar fail too.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any number). Built 2026-11-14; last candle 2026-11-06. Each follower is traded for the next month in its leader's direction, 1R = stop = 3 x ATR(20), net of spread and overnight financing; the control is the follower's own past month traded the same way. Paper research only: nothing live changed, and no proposal is written.

## The six tests (OOS 2017-01 to 2026-10, calendar-month sums, base costs; Holm over all six)

| Test | What | t | p (one-sided) | Holm p |
|---|---|---|---|---|
| F1 | US500 leads the non-US indices | -1.79 | 0.9633 | 1 |
| F2 | Copper leads DE40, AU200, HK33 | -1.63 | 0.9484 | 1 |
| F3 | The dollar (inverted) leads the metals | +0.27 | 0.3936 | 1 |
| D1 | US500 leads the non-US indices: leader minus own past month | +0.93 | 0.1762 | 1 |
| D2 | Copper leads DE40, AU200, HK33: leader minus own past month | 0 | 0.5 | 1 |
| D3 | The dollar (inverted) leads the metals: leader minus own past month | +0.23 | 0.409 | 1 |

| Family | OOS t >= 2 and Holm p < 0.05 | IS net > 0 | OOS net > 0 at 2x costs | Beats own momentum (Holm) | Pass |
|---|---|---|---|---|---|
| F1 (primary) | no | no | no | no | no |
| F2 | no | no | no | no | no |
| F3 | no | no | no | no | no |

## F1: US500 leads the non-US indices

Leader `spx500`; followers `de40`, `uk100`, `eu50`, `fr40`, `ch20`, `nl25`, `jp225`, `au200`, `hk33`, `sg30`.

| Signal | Window | Legs (long / short) | Win % | Gross R a leg | Spread R | Financing R | Net R a leg | Stops (gap) | Mean R a month gross | net | 2x | t gross | t net | NW t net | Total net R | Worst DD R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Leader | IS 2004-01 to 2016-12 | 1491 (909 / 582) | 45.7 | -0.052 | 0.0097 | 0.0565 | -0.1181 | 503 (62) | -0.4969 | -1.129 | -1.761 | -0.91 | -2.11 | -2.3 | -176.12 | -187.84 |
| Leader | OOS 2017-01 to 2026-10 | 1170 (810 / 360) | 42.4 | -0.0474 | 0.0105 | 0.0558 | -0.1137 | 388 (18) | -0.4696 | -1.1273 | -1.7849 | -0.73 | -1.79 | -1.73 | -133.02 | -204.05 |
| Own (control) | IS 2004-01 to 2016-12 | 1501 (885 / 616) | 45.6 | -0.035 | 0.0097 | 0.0575 | -0.1022 | 488 (55) | -0.3368 | -0.9833 | -1.6297 | -0.77 | -2.31 | -2.43 | -153.39 | -158.27 |
| Own (control) | OOS 2017-01 to 2026-10 | 1180 (699 / 481) | 39.3 | -0.0909 | 0.0105 | 0.051 | -0.1524 | 420 (20) | -0.9092 | -1.5243 | -2.1394 | -1.78 | -3.05 | -3.35 | -179.86 | -193.02 |

Leader minus own, net R a month: IS -0.1457 (t -0.41), OOS +0.397 (t +0.93). The two signals agree on 78.9 % of legs IS and 76.2 % OOS (where both trade).
Placebo (40 seeds, one random sign per family-month, same legs and costs, OOS): real -1.1273R a month beats 11 of 40; 5th / 50th / 95th percentile -1.8115 / -0.7244 / +0.4289.

| Follower | IS legs | IS gross R | IS net R | OOS legs | OOS gross R | OOS net R |
|---|---|---|---|---|---|---|
| de40 | 155 | +2.16 | -7.06 | 117 | -14.77 | -21.65 |
| uk100 | 155 | -24.04 | -36.79 | 117 | -7.03 | -16.95 |
| eu50 | 155 | -12.43 | -22.63 | 117 | -12.41 | -19.31 |
| fr40 | 155 | -12.47 | -21.59 | 117 | -11.9 | -18.71 |
| ch20 | 155 | -12.25 | -22.17 | 117 | -3.99 | -11.8 |
| nl25 | 105 | -10.38 | -15.3 | 117 | -6.97 | -14.57 |
| jp225 | 155 | +12.79 | +3.45 | 117 | +7.86 | +0.58 |
| au200 | 151 | -7.69 | -22.07 | 117 | -5.5 | -15.16 |
| hk33 | 155 | -7.7 | -17.12 | 117 | +4.57 | -1.85 |
| sg30 | 150 | -5.51 | -14.84 | 117 | -5.27 | -13.6 |

| Year | Legs | Gross R | Net R |
|---|---|---|---|
| 2004 | 102 | +4.5 | -6.4 |
| 2005 | 108 | -11.8 | -24.76 |
| 2006 | 105 | +12.4 | -2.11 |
| 2007 | 108 | +12.81 | +3.13 |
| 2008 | 118 | +9.21 | +6.82 |
| 2009 | 120 | +3.05 | -1.44 |
| 2010 | 120 | -51.49 | -57.07 |
| 2011 | 110 | +11.26 | +6.45 |
| 2012 | 120 | +37.7 | +29.53 |
| 2013 | 120 | -31.88 | -38.9 |
| 2014 | 120 | -33.31 | -41.19 |
| 2015 | 120 | -44.2 | -48.92 |
| 2016 | 120 | +4.23 | -1.25 |
| 2017 | 120 | +28.85 | +17.63 |
| 2018 | 120 | -40.35 | -46.9 |
| 2019 | 120 | -30.1 | -37.09 |
| 2020 | 120 | +12.86 | +8.2 |
| 2021 | 120 | -24.72 | -31.56 |
| 2022 | 120 | -25.54 | -30.19 |
| 2023 | 120 | -10.47 | -18.84 |
| 2024 | 120 | -20.08 | -32.3 |
| 2025 | 120 | +31.44 | +21.36 |
| 2026 | 90 | +22.71 | +16.66 |

## F2: Copper leads DE40, AU200, HK33

Leader `xcu`; followers `de40`, `au200`, `hk33`.

| Signal | Window | Legs (long / short) | Win % | Gross R a leg | Spread R | Financing R | Net R a leg | Stops (gap) | Mean R a month gross | net | 2x | t gross | t net | NW t net | Total net R | Worst DD R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Leader | IS 2004-01 to 2016-12 | 464 (266 / 198) | 49.6 | +0.0511 | 0.0095 | 0.0571 | -0.0156 | 137 (17) | +0.1519 | -0.0463 | -0.2445 | +0.83 | -0.26 | -0.24 | -7.22 | -31.22 |
| Leader | OOS 2017-01 to 2026-10 | 354 (192 / 162) | 39.8 | -0.0466 | 0.0099 | 0.0484 | -0.105 | 114 (6) | -0.1398 | -0.3149 | -0.4899 | -0.71 | -1.63 | -1.79 | -37.16 | -40.57 |
| Own (control) | IS 2004-01 to 2016-12 | 464 (282 / 182) | 46.6 | +0.0018 | 0.0095 | 0.0645 | -0.0723 | 158 (23) | +0.0052 | -0.2149 | -0.435 | +0.03 | -1.42 | -1.47 | -33.52 | -36.13 |
| Own (control) | OOS 2017-01 to 2026-10 | 354 (209 / 145) | 41.8 | -0.0449 | 0.0099 | 0.0502 | -0.105 | 123 (5) | -0.1346 | -0.3151 | -0.4956 | -0.77 | -1.83 | -2.03 | -37.19 | -41.37 |

Leader minus own, net R a month: IS +0.1686 (t +0.83), OOS +0.0003 (t 0). The two signals agree on 58.2 % of legs IS and 66.4 % OOS (where both trade).
Placebo (40 seeds, one random sign per family-month, same legs and costs, OOS): real -0.3149R a month beats 15 of 40; 5th / 50th / 95th percentile -0.5441 / -0.2218 / +0.0081.

| Follower | IS legs | IS gross R | IS net R | OOS legs | OOS gross R | OOS net R |
|---|---|---|---|---|---|---|
| de40 | 156 | +8.23 | -0.52 | 118 | -11.05 | -17.63 |
| au200 | 152 | +8.84 | -4.4 | 118 | -6.66 | -15.13 |
| hk33 | 156 | +6.62 | -2.3 | 118 | +1.21 | -4.4 |

| Year | Legs | Gross R | Net R |
|---|---|---|---|
| 2004 | 32 | +0.69 | -2.9 |
| 2005 | 36 | -5.59 | -10.56 |
| 2006 | 36 | -7.48 | -10.41 |
| 2007 | 36 | +2.96 | +0.48 |
| 2008 | 36 | +15.03 | +14.13 |
| 2009 | 36 | +18.18 | +16.49 |
| 2010 | 36 | +1.87 | -0.59 |
| 2011 | 36 | -11.31 | -12.87 |
| 2012 | 36 | +2.86 | +0.45 |
| 2013 | 36 | +0.26 | -2.16 |
| 2014 | 36 | -7.21 | -9.47 |
| 2015 | 36 | +8.98 | +7.5 |
| 2016 | 36 | +4.45 | +2.67 |
| 2017 | 36 | -2.05 | -4.74 |
| 2018 | 36 | +1.18 | -0.71 |
| 2019 | 36 | -1.73 | -3.73 |
| 2020 | 36 | +2.27 | +0.9 |
| 2021 | 36 | +3.77 | +1.66 |
| 2022 | 36 | -0.3 | -1.41 |
| 2023 | 36 | +6.64 | +4.64 |
| 2024 | 36 | -11.41 | -13.83 |
| 2025 | 36 | -7.7 | -10.58 |
| 2026 | 30 | -7.18 | -9.35 |

## F3: The dollar (inverted) leads the metals

Leader `usd` (sign inverted); followers `xau`, `xag`, `xpt`.

| Signal | Window | Legs (long / short) | Win % | Gross R a leg | Spread R | Financing R | Net R a leg | Stops (gap) | Mean R a month gross | net | 2x | t gross | t net | NW t net | Total net R | Worst DD R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Leader | IS 2004-01 to 2016-12 | 398 (199 / 199) | 43 | +0.0394 | 0.0194 | 0.0331 | -0.013 | 130 (0) | +0.1006 | -0.0333 | -0.1672 | +0.5 | -0.17 | -0.18 | -5.19 | -28.53 |
| Leader | OOS 2017-01 to 2026-10 | 354 (168 / 186) | 46.3 | +0.0719 | 0.0157 | 0.0343 | +0.022 | 106 (0) | +0.2157 | +0.0659 | -0.084 | +0.88 | +0.27 | +0.29 | +7.77 | -34.27 |
| Own (control) | IS 2004-01 to 2016-12 | 398 (210 / 188) | 44 | +0.0337 | 0.0194 | 0.0349 | -0.0207 | 132 (0) | +0.0859 | -0.0528 | -0.1915 | +0.5 | -0.31 | -0.36 | -8.24 | -17.21 |
| Own (control) | OOS 2017-01 to 2026-10 | 354 (189 / 165) | 46.6 | +0.0604 | 0.0157 | 0.0385 | +0.0062 | 106 (0) | +0.1811 | +0.0185 | -0.144 | +0.87 | +0.09 | +0.09 | +2.19 | -24.12 |

Leader minus own, net R a month: IS +0.0195 (t +0.09), OOS +0.0473 (t +0.23). The two signals agree on 66.6 % of legs IS and 70.9 % OOS (where both trade).
Placebo (40 seeds, one random sign per family-month, same legs and costs, OOS): real +0.0659R a month beats 39 of 40; 5th / 50th / 95th percentile -0.5064 / -0.2505 / +0.0196.

| Follower | IS legs | IS gross R | IS net R | OOS legs | OOS gross R | OOS net R |
|---|---|---|---|---|---|---|
| xau | 128 | -4.18 | -10.05 | 118 | +12.3 | +5.71 |
| xag | 128 | +10.82 | +6.3 | 118 | +11 | +6.23 |
| xpt | 142 | +9.06 | -1.44 | 118 | +2.16 | -4.17 |

| Year | Legs | Gross R | Net R |
|---|---|---|---|
| 2004 | 0 | 0 | 0 |
| 2005 | 10 | -2.6 | -3.69 |
| 2006 | 28 | -5.75 | -7.65 |
| 2007 | 36 | -11.06 | -14.1 |
| 2008 | 36 | +8.08 | +7.11 |
| 2009 | 36 | +9.12 | +7.61 |
| 2010 | 36 | +0.78 | -0.97 |
| 2011 | 36 | +18.82 | +17.22 |
| 2012 | 36 | +1.45 | -0.36 |
| 2013 | 36 | +11.69 | +9.98 |
| 2014 | 36 | -0.41 | -2.77 |
| 2015 | 36 | -9.2 | -10.83 |
| 2016 | 36 | -5.21 | -6.74 |
| 2017 | 36 | -0.69 | -2.95 |
| 2018 | 36 | +10.43 | +8.19 |
| 2019 | 36 | -11.83 | -13.33 |
| 2020 | 36 | +17.87 | +16.42 |
| 2021 | 36 | -8.09 | -9.48 |
| 2022 | 36 | -1.57 | -3.18 |
| 2023 | 36 | -4.01 | -6.15 |
| 2024 | 36 | -5.27 | -7.11 |
| 2025 | 36 | +10.68 | +8.34 |
| 2026 | 30 | +17.93 | +17.02 |

## Reading

- The pre-registered bar was not met for the primary family: no proposal is written and nothing changes. A FAIL is not evidence that the opposite works; another look-back, follower set or weighting would be a new study with its own pre-registration on data it was not chosen on.
- The own-momentum control is the follower's own past month: where the leader and the follower moved together last month the two signals give the same trade, so "leader minus own" isolates the months they disagree.

## What this cannot show

- Price indices without dividends; each index earns in its own currency; approximate year-average policy rates; spreads assumed (0.04 % index CFDs, $0.30 gold, 0.10 % silver, 0.20 % platinum), not measured on the demo broker.
- Ten non-US followers (the brief asked for twelve; only ten keys start in 2008 or earlier). OANDA index candles close at 21:00-22:00 UTC, so a non-US month-end close already holds part of the US session (this can only weaken a US lead).

To repeat: `node research/edge/intermarket-lead/run.mjs` (reads council-data with `git show`, no network). Tests: `tests/intermarket-lead.test.mjs`.
