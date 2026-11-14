# Tokyo fix every day: is the fix-minute effect special to gotobi days?

**Verdict: UNCLEAR.** T1 (the frozen 00:55 sell / 06:00 buy-back on every non-gotobi Tokyo business day, 2016-now): −0.0629R a trade net, n 1870, month t −2.37. T2 (the 00:54 -> 00:55 fix-minute move): gotobi +0.332 pips against non-gotobi +0.379 pips, difference −0.047, Welch t −0.25 (Holm p 1). Pre-registered in PREREGISTRATION.md (first commit of the branch), OANDA mid M1, frozen gotobi-timing code. Paper research only: **no live proposal**, whatever the reading.

**Gate: PASSED.** The M1 fade on gotobi days of 2016-now gives n 771 (#908: 771, ±8) and +0.1481R a trade (#908: +0.1481, ±0.010R).

## T1 and the gotobi days, the frozen fade (00:55 -> 06:00 UTC)

| Days | Window | n | Net R a trade | Gross R | Cost R | Total net R | Month t | Win % | Stopped % |
|---|---|---|---|---|---|---|---|---|---|
| non-gotobi (T1) | 2016-now | 1870 | −0.0629 | +0.0493 | 0.1122 | −117.6 | −2.37 | 42.7 | 32.3 |
| non-gotobi (T1) | 2010-15 | 1040 | +0.0085 | +0.1206 | 0.1121 | +8.9 | +0.26 | 47.8 | 29.2 |
| gotobi | 2016-now | 771 | +0.1481 | +0.2607 | 0.1126 | +114.2 | +2.74 | 51.4 | 27.6 |
| gotobi | 2010-15 | 425 | +0.1305 | +0.2426 | 0.1121 | +55.5 | +2.45 | 52.7 | 27.3 |

T1 one-sided p 0.9911, Holm-adjusted 1.

## T2, the fix minute (open 00:55 − open 00:54, pips)

| Window | Gotobi: n | mean | sd | share up | Non-gotobi: n | mean | sd | share up | Difference | Welch t |
|---|---|---|---|---|---|---|---|---|---|---|
| 2016-now | 771 | +0.332 | 4.521 | 53.2 % | 1871 | +0.379 | 4.096 | 55.2 % | −0.047 | −0.25 |
| 2010-15 | 425 | +0.198 | 2.254 | 51.5 % | 1040 | −0.070 | 2.411 | 46.6 % | +0.268 | +2.02 |

T2 one-sided p 0.5987, Holm-adjusted 1.

Descriptive, not tested:

| Window | Fix minute in R of D: gotobi | non-gotobi | Minute after the fix (00:55 -> 00:56), pips: gotobi | non-gotobi |
|---|---|---|---|---|
| 2016-now | +0.0127 | +0.0184 | −1.336 | −0.187 |
| 2010-15 | +0.0126 | −0.0082 | −0.416 | −0.205 |

## T3, gotobi against non-gotobi month by month (net R a trade per month)

| Window | Months gotobi | mean | Months non-gotobi | mean | Difference | Welch t |
|---|---|---|---|---|---|---|
| 2016-now | 131 | +0.1531 | 131 | −0.0633 | +0.2165 | +3.61 |
| 2010-15 | 72 | +0.1280 | 72 | +0.0112 | +0.1168 | +1.87 |

## Placebo (40 seeds, random 5-minute windows 00:00-05:00 UTC on non-gotobi days of 2016-now)

Each seed draws one window a day from 57 end marks (00:05 to 05:00, the marks 00:50, 00:55 and 01:00 left out), over 1874 non-gotobi days.

| Measure | Seed median | 95th pct (38th of 40) | Max | Compared |
|---|---|---|---|---|
| one-minute move into the mark, pips | +0.011 | +0.067 | +0.089 | non-gotobi fix minute +0.379 (above); gotobi fix minute +0.332 (above) |
| fade from the mark to 06:00, net R a trade | −0.1345 | −0.1205 | −0.1144 | T1 −0.0629 (above) |

## By year

| Year | Gotobi: n | net R a trade | fix minute (pips) | Non-gotobi: n | net R a trade | fix minute (pips) |
|---|---|---|---|---|---|---|
| 2010 | 71 | +0.2081 | +0.259 | 174 | +0.0172 | +0.288 |
| 2011 | 72 | +0.2197 | +0.840 | 173 | +0.1096 | +0.176 |
| 2012 | 71 | +0.1852 | −0.237 | 175 | −0.0200 | −0.177 |
| 2013 | 70 | +0.1788 | +0.029 | 173 | +0.0783 | −0.157 |
| 2014 | 70 | +0.0281 | −0.180 | 173 | −0.1665 | −0.172 |
| 2015 | 71 | −0.0389 | +0.458 | 172 | +0.0331 | −0.381 |
| 2016 | 72 | +0.2828 | +1.990 | 172 | −0.0395 | −0.699 |
| 2017 | 71 | +0.0537 | +0.128 | 175 | +0.1251 | +0.133 |
| 2018 | 71 | −0.0395 | +0.097 | 173 | −0.0855 | +0.340 |
| 2019 | 70 | +0.3080 | +0.137 | 169 | −0.1781 | +0.354 |
| 2020 | 70 | +0.2021 | +0.611 | 172 | +0.0103 | −0.278 |
| 2021 | 71 | +0.0446 | −0.499 | 174 | −0.0382 | +0.441 |
| 2022 | 72 | +0.4069 | −0.289 | 170 | −0.0968 | +0.730 |
| 2023 | 71 | −0.0113 | +0.494 | 174 | −0.0930 | +0.746 |
| 2024 | 71 | +0.2168 | +1.269 | 173 | −0.2023 | +0.954 |
| 2025 | 70 | +0.3123 | +0.119 | 172 | −0.0381 | +0.406 |
| 2026 | 62 | −0.1910 | −0.532 | 146 | −0.0599 | +1.160 |

## Notes

- Data: OANDA mid USD/JPY M1, 00:00-06:15 UTC of every Tokyo business day, first day with candles 2010-01-04, through 2026-11-11 (1497207 candles); D from #878's M5 file through the frozen stopDist. Days without a trade (missing candles or no D): gotobi 12, other 5 over both windows.
- Replication 2010-15: T1 +0.0085R a trade (opposite sign as 2016-now), T2 difference +0.268 pips, Welch t +2.02 (opposite sign), T3 +0.1168R (same sign).
- Known before the study and said in the pre-registration: #878's M5 run already showed the fade on every non-gotobi day of 2016-now at −0.0628R a trade (n 1,870, month t −2.37). The M1 figure here is −0.0629R (n 1870).
- T2 is a minute move in pips, not a trade: no cost applies. Its Welch t treats every day as independent; days are about a day apart and a one-minute move has little autocorrelation, so this is the plain reading the pre-registration fixed.
- Read after the verdict, descriptive and not tested (the pre-registration named the minute after the fix as descriptive only): in 2016-now the minute INTO the fix rises about the same on both kinds of day (gotobi +0.332 pips, other days +0.379), while the minute AFTER it falls −1.336 pips on gotobi days against −0.187 on other days. So the gotobi difference, if it is real, is in the fall after 09:55, not in the rise before it; a test of that needs its own pre-registration on other data.
- The placebo is reported, not part of the reading: it shows whether the fix minute on ordinary days stands out from ordinary minutes of the same morning (a one-minute move into a 5-minute mark), and whether the 00:55 sell on ordinary days beats a sell at an ordinary mark of the morning.
- No live proposal: this study only describes where the gotobi fade's effect comes from. Whether the gotobi fade itself is ever traded is an owner decision outside it, and the timing study (#908) already showed it needs a fill at the 00:55:00 price.
