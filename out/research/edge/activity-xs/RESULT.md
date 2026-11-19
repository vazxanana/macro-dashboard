# Activity and relative return across index CFDs (weekly cross-section, quote-count proxy): result

**Verdict: FAIL. Primary (abnormal activity) OOS -1.1263R a month net, t -5.26, the wrong sign (bar t >= 2), gross t -1.69; Amihud -0.8515R, t -4.28.**

Pre-registered bar for the primary (PREREGISTRATION.md, pushed alone first): OOS net month-sum t >= 2 with Holm p <= 0.05 missed; in-sample net mean positive missed; OOS net positive at 2x costs missed.

**T1 (primary, abnormal activity).** Out of sample 2017-01 to 2026-10 (118 months, 513 weeks, 3956 legs): -1.1263R a month net (gross -0.356R), t -5.26 (Newey-West -5.17), total -132.91R; at 2x costs -1.8966R a month. In sample 2004-07 to 2016-12 (150 months, 4428 legs): -0.6115R a month net, t -4.51. Placebo (40 seeds, random order of the same ranked indices each week): the real OOS mean beats 4 of 40; 5th / 50th / 95th percentile -1.1454 / -0.7863 / -0.5467R a month.

**T2 (secondary, Amihud illiquidity).** Out of sample 2017-01 to 2026-10 (118 months, 513 weeks, 3956 legs): -0.8515R a month net (gross -0.0977R), t -4.28 (Newey-West -5), total -100.48R; at 2x costs -1.6053R a month. In sample 2004-07 to 2016-12 (150 months, 4431 legs): -0.8747R a month net, t -5.78. Placebo (40 seeds, random order of the same ranked indices each week): the real OOS mean beats 14 of 40; 5th / 50th / 95th percentile -1.0549 / -0.8189 / -0.4878R a month.

Every leg has a stop at 1R = 3 x ATR(20) from its entry and is sized to risk 1R (equal risk by inverse ATR). Net of a 0.04 % round trip and overnight financing (long: the quote currency's policy rate + 2.5 % a year; short: max(0, 2.5 % - rate); assumed, the table of `index-xs-momentum`). The activity is OANDA's daily quote count, a proxy for trading volume, not volume itself. Paper research: no live rule, size, filter, stop or council member changed.

## Setup

Universe (every council-data index key with candles from 2008 or earlier): spx500, nas100, us30, us2000, de40, uk100, fr40, eu50, ch20, nl25, jp225, au200, hk33, sg30. Data: council-data `research/daily/<key>.json` (OANDA mid daily candles, weekend stubs folded into Monday with their quote count), last candle 2026-11-06. At least 9 indices ranked a week; thirds = floor(N / 3) a side.

| Index | First candle | Last candle | Candles | Currency |
|---|---|---|---|---|
| spx500 | 2003-03-24 | 2026-11-06 | 6124 | USD |
| nas100 | 2003-03-24 | 2026-11-06 | 6124 | USD |
| us30 | 2003-03-24 | 2026-11-06 | 6101 | USD |
| us2000 | 2003-03-24 | 2026-11-06 | 6114 | USD |
| de40 | 2003-03-25 | 2026-11-06 | 6010 | EUR |
| uk100 | 2003-03-24 | 2026-11-06 | 5975 | GBP |
| fr40 | 2003-02-03 | 2026-11-06 | 5949 | EUR |
| eu50 | 2003-09-22 | 2026-11-06 | 5885 | EUR |
| ch20 | 2003-03-24 | 2026-11-06 | 5939 | CHF |
| nl25 | 2008-01-21 | 2026-11-06 | 4812 | EUR |
| jp225 | 2003-03-14 | 2026-11-06 | 6115 | USD |
| au200 | 2004-03-18 | 2026-11-06 | 5781 | AUD |
| hk33 | 2003-02-04 | 2026-11-06 | 5867 | HKD |
| sg30 | 2004-01-21 | 2026-11-06 | 5834 | SGD |

## The two tests (calendar-month sums of weekly net R)

| Test | Window | Costs | Mean R a month | t | Newey-West t | Positive months % | Total R | Worst drawdown R |
|---|---|---|---|---|---|---|---|---|
| T1 | IS | 0 | +0.0207 | +0.15 | +0.18 | 46.7 | +3.11 | -18.74 |
| T1 | IS | base | -0.6115 | -4.51 | -5.11 | 32.7 | -91.73 | -93 |
| T1 | IS | 2x | -1.2438 | -8.78 | -8.98 | 21.3 | -186.56 | -186.56 |
| T1 | OOS | 0 | -0.356 | -1.69 | -1.74 | 40.7 | -42.01 | -53.03 |
| T1 | OOS | base | -1.1263 | -5.26 | -5.17 | 30.5 | -132.91 | -136.72 |
| T1 | OOS | 2x | -1.8966 | -8.59 | -7.98 | 19.5 | -223.8 | -225.15 |
| T2 | IS | 0 | -0.2113 | -1.39 | -1.63 | 40 | -31.7 | -34.82 |
| T2 | IS | base | -0.8747 | -5.78 | -6.33 | 28 | -131.21 | -131.87 |
| T2 | IS | 2x | -1.5381 | -9.88 | -9.61 | 14 | -230.72 | -230.72 |
| T2 | OOS | 0 | -0.0977 | -0.5 | -0.59 | 50 | -11.53 | -22.44 |
| T2 | OOS | base | -0.8515 | -4.28 | -5 | 32.2 | -100.48 | -100.48 |
| T2 | OOS | 2x | -1.6053 | -7.84 | -8.67 | 22.9 | -189.43 | -189.43 |

| Test | OOS t | p | Holm p | t >= 2 after Holm | IS same sign | OOS 2x > 0 | Passes |
|---|---|---|---|---|---|---|---|
| T1 | -5.26 | < 0.0001 | < 0.0001 | missed | missed | missed | no |
| T2 | -4.28 | < 0.0001 | < 0.0001 | missed | missed | missed | no |

## Legs

| Test | Window | Legs (long / short) | Win % | Gross R a leg | Spread R | Financing R | Net R a leg | Net 2x R a leg | Stops (gap) | Long legs net R | Short legs net R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | IS | 4428 (2216 / 2212) | 48.4 | +0.0007 | 0.0092 | 0.0122 | -0.0207 | -0.0421 | 188 (11) | -28.97 | -62.75 |
| T1 | OOS | 3956 (1978 / 1978) | 46.9 | -0.0106 | 0.0103 | 0.0127 | -0.0336 | -0.0566 | 223 (4) | -8.21 | -124.69 |
| T2 | IS | 4431 (2215 / 2216) | 47.4 | -0.0072 | 0.0094 | 0.0131 | -0.0296 | -0.0521 | 199 (6) | -62.77 | -68.44 |
| T2 | OOS | 3956 (1978 / 1978) | 47.7 | -0.0029 | 0.0103 | 0.0122 | -0.0254 | -0.0479 | 238 (5) | +2.46 | -102.94 |

## How static the rankings are (reported only)

Weeks whose long or short set differs from the previous week: T1 991 of 1113 (89 %), T2 862 of 1113 (77.4 %).

| Index | T1 OOS weeks long / short | T2 OOS weeks long / short |
|---|---|---|
| spx500 | 122 / 180 | 74 / 111 |
| nas100 | 197 / 121 | 0 / 503 |
| us30 | 116 / 172 | 0 / 382 |
| us2000 | 163 / 162 | 36 / 201 |
| de40 | 171 / 136 | 0 / 382 |
| uk100 | 118 / 113 | 42 / 66 |
| fr40 | 89 / 141 | 129 / 9 |
| eu50 | 151 / 205 | 510 / 0 |
| ch20 | 117 / 139 | 298 / 7 |
| nl25 | 86 / 140 | 104 / 4 |
| jp225 | 169 / 150 | 216 / 6 |
| au200 | 153 / 132 | 189 / 3 |
| hk33 | 138 / 84 | 0 / 302 |
| sg30 | 188 / 103 | 380 / 2 |

## By year (net R, base costs)

| Year | T1 weeks | T1 gross R | T1 net R | T2 net R |
|---|---|---|---|---|
| 2004 | 25 | +4.55 | -0.25 | -10.65 |
| 2005 | 52 | +3.35 | -7.81 | -11.3 |
| 2006 | 52 | +2.04 | -8.65 | -16.21 |
| 2007 | 53 | +8.96 | -1.74 | -8.39 |
| 2008 | 52 | -1.97 | -6.88 | -15.86 |
| 2009 | 52 | +3.36 | -2.05 | -3.1 |
| 2010 | 52 | -2.64 | -10.44 | -16.01 |
| 2011 | 52 | +3.37 | -3.73 | -18.91 |
| 2012 | 52 | -3.62 | -11.42 | -0.19 |
| 2013 | 2 | -1.3 | -1.72 | -1.23 |
| 2014 | 52 | -1.22 | -11.74 | -3.96 |
| 2015 | 52 | -6.07 | -13.97 | -15.38 |
| 2016 | 52 | -5.71 | -11.34 | -10.03 |
| 2017 | 52 | -0.18 | -14.34 | -18.08 |
| 2018 | 53 | -6.03 | -15.51 | -4.92 |
| 2019 | 52 | -6.11 | -15.9 | -12.73 |
| 2020 | 52 | -5.28 | -11.45 | -6.19 |
| 2021 | 52 | -10.09 | -18.91 | +1.28 |
| 2022 | 52 | +11.27 | +6.78 | -6.45 |
| 2023 | 52 | -8.98 | -18.4 | -20.56 |
| 2024 | 53 | -4.96 | -17.13 | -17.79 |
| 2025 | 52 | -12.81 | -21.89 | -8.41 |
| 2026 | 43 | +1.17 | -6.16 | -6.62 |

## Reading

- The pre-registered bar was not met: no proposal is written and nothing changes. A FAIL is not evidence that the opposite works; any other window, holding period or universe would be a new study with its own pre-registration.
- The `volume-premium` line that motivated this (high-activity days on index CFDs followed by higher returns than other days of the same market, OOS t 3.52) was a non-primary, after-the-fact reading; this cross-section does not confirm it as a long-short book: before any cost the primary book made +0.0207R a month in sample (t +0.15) and -0.356R out of sample (t -1.69), and it beat 4 of 40 random-order books.
- Measure (a) ranks OANDA's quoting rate of each CFD more than the underlying market's liquidity, so some indices sit on the same side almost every week (the table above): it is partly a fixed long-short pair of index groups, not a clean test of Amihud's effect.

## What this cannot show

- The quote count is not traded volume; price indices without dividends (a CFD long is credited the dividend, a short pays it; left out on both sides); policy rates are approximate year averages, 2004-06 take the 2007 row; the 0.04 % spread is assumed, not measured.
- Fourteen indices, four or five a side, several of them the same economy (four US, four euro area): a small and correlated cross-section next to the published stock samples.

To repeat: `node research/edge/activity-xs/run.mjs` (reads council-data with `git show`, no network). Tests: `tests/activity-xs.test.mjs`.
