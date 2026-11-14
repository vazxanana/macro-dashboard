# Gotobi replication: the fade after the 09:55 Tokyo fix on four other yen crosses, and on USD/JPY before 2010

**Verdict: REPLICATES.** All four R1 conditions hold: pooled GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY 2010-01-01 to 2026-11-11, n 4784, +0.099R a trade net, month t +2.75, 4 of 4 crosses positive, placebo 95th percentile −0.016R. R2 (USD/JPY 2005-01-31 to 2009-12-31, supporting only): n 355, +0.261R, month t +3.80, passes its bar (net R > 0 and t >= 1.5). The rule is the gotobi study's T2, frozen byte for byte (frozen.mjs); pre-registered in PREREGISTRATION.md (first commit of the branch). Paper research only; nothing live changed.

## Results

| Market | Window | n | Net R a trade | Gross R | Cost R | Total net R | Month t | Months | Win % | Stopped % | Median stop (pips) | Net R at 2 x cost | Month t at 2 x cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GBP/JPY | 2010-now | 1196 | +0.136 | +0.217 | 0.081 | +162.2 | +2.97 | 203 | 48.8 | 28.3 | 27.5 | +0.055 | +1.19 |
| AUD/JPY | 2010-now | 1196 | +0.030 | +0.105 | 0.076 | +35.6 | +0.91 | 203 | 45.6 | 29.2 | 24.1 | −0.046 | −1.38 |
| CAD/JPY | 2010-now | 1196 | +0.090 | +0.203 | 0.114 | +107.6 | +2.28 | 203 | 47.3 | 27.7 | 17 | −0.024 | −0.59 |
| CHF/JPY | 2010-now | 1196 | +0.142 | +0.247 | 0.106 | +169.6 | +3.39 | 203 | 51.5 | 27.8 | 19.3 | +0.036 | +0.85 |
| **R1 pooled** | 2010-now | 4784 | +0.099 | +0.193 | 0.094 | +475.0 | +2.75 | 203 | 48.3 | 28.2 | 21.8 | +0.005 | +0.15 |
| R1 pooled | 2016-now | 3084 | +0.069 | +0.168 | 0.099 | +211.8 | +1.46 | 131 | 46.5 | 28.5 | 20.9 | −0.031 | −0.64 |
| R1 pooled | 2010-15 | 1700 | +0.155 | +0.239 | 0.084 | +263.2 | +2.85 | 72 | 51.6 | 27.8 | 23.6 | +0.070 | +1.28 |
| **R2 USD/JPY** | 2005-01 to 2009 | 355 | +0.261 | +0.357 | 0.096 | +92.5 | +3.80 | 60 | 56.6 | 24.2 | 19.5 | +0.164 | +2.36 |
| Original T2 USD/JPY (gate) | 2016-now | 771 | +0.148 | +0.261 | 0.113 | +114.2 | +2.74 | 131 | 51.4 | 27.6 | 19.5 | +0.035 | +0.65 |
| Original T2 USD/JPY (gate) | 2010-15 | 425 | +0.131 | +0.243 | 0.112 | +55.5 | +2.45 | 72 | 52.7 | 27.3 | 17.5 | +0.018 | +0.35 |

## The pre-registered conditions

| R1 condition | Value | Holds |
|---|---|---|
| Pooled net R a trade > 0 | +0.099 | yes |
| Pooled month t >= 2 | +2.75 | yes |
| At least 3 of 4 crosses positive | 4 of 4 | yes |
| Above the placebo's 95th percentile (38th of 40) | −0.016 (above 40 of 40) | yes |
| R2: net R > 0 and month t >= 1.5 | +0.261, t +3.80 | yes |

## Placebo and every other day

Each seed draws, from each market's non-gotobi Tokyo business days of the same window, as many days as that market has gotobi trades and runs the identical leg (the original's design). "Every other day" is the leg on all of them.

| Market | Placebo median net R | Placebo 95th pct | Beats | Every non-gotobi day: n | net R | month t |
|---|---|---|---|---|---|---|
| GBP/JPY | −0.035 | +0.012 | 40 of 40 | 2910 | −0.042 | −1.92 |
| AUD/JPY | −0.047 | −0.003 | 39 of 40 | 2910 | −0.051 | −2.77 |
| CAD/JPY | −0.087 | −0.054 | 40 of 40 | 2909 | −0.088 | −4.07 |
| CHF/JPY | −0.054 | −0.015 | 40 of 40 | 2910 | −0.056 | −2.75 |
| R1 pooled | −0.056 | −0.016 | 40 of 40 | | | |
| R2 USD/JPY | +0.059 | +0.105 | 40 of 40 | 856 | +0.047 | +1.07 |

## By year (net R total, gotobi trades)

| Market | 2010 | 2011 | 2012 | 2013 | 2014 | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GBP/JPY | +9.4 | +22.4 | +9.4 | +10.3 | +0.9 | +18.1 | +37.4 | −9.3 | −8.5 | +11.1 | +3.3 | −1.7 | +18.6 | +4.8 | +24.0 | +17.0 | −5.1 |
| AUD/JPY | +17.4 | +21.9 | −7.3 | +16.7 | +2.7 | −2.3 | +5.4 | −14.2 | −3.6 | −8.2 | +0.3 | −4.9 | +10.7 | +3.2 | +4.5 | −1.8 | −4.7 |
| CAD/JPY | +7.2 | +23.8 | −1.1 | +19.1 | +4.8 | +1.6 | +14.8 | −9.6 | −0.3 | +2.8 | +1.0 | −0.7 | +20.5 | +2.2 | +18.6 | +13.3 | −10.6 |
| CHF/JPY | +7.6 | +27.0 | +11.6 | +20.2 | +4.5 | +17.3 | +26.9 | −15.8 | −5.6 | +6.6 | +8.8 | −3.7 | +24.6 | +0.2 | +20.2 | +20.5 | −1.5 |
| Pooled | +41.6 | +95.1 | +12.6 | +66.3 | +12.8 | +34.8 | +84.5 | −48.8 | −18.0 | +12.3 | +13.5 | −11.0 | +74.4 | +10.5 | +67.3 | +49.0 | −21.9 |

R2 USD/JPY by year: 2005 +14.9R (n 67), 2006 +31.5R (n 72), 2007 +0.6R (n 72), 2008 +25.5R (n 72), 2009 +19.9R (n 72).

## Notes

- Data: OANDA mid M5 through the /md/bars proxy, only candles starting 00:00-06:55 UTC kept. Crosses from GBP/JPY 2009-11-02, AUD/JPY 2009-11-02, CAD/JPY 2009-11-02, CHF/JPY 2009-11-02; USD/JPY before 2009-11 from 2005-01-03, joined to the gotobi study's file for the lookback; through 2026-11-11. Gotobi days lost to missing candles: GBP/JPY 12 of 1208, AUD/JPY 12 of 1208, CAD/JPY 12 of 1208, CHF/JPY 12 of 1208, USD/JPY R2 5 of 360.
- Gate: the frozen file's own loop on the gotobi study's USD/JPY file gives T2 2016-now n 771, +0.1481R, month t +2.74 and 2010-15 n 425, +0.1306R, t +2.45 (the original's RESULT.md: n 771, +0.148R, t 2.74; +0.131R, t 2.45).
- Costs: the frozen formula on every cross (0.3 pip spread + 2 x 0.5 pip slippage + 2 x USD 22.5 per million). The 0.3 pip spread on the four crosses is ASSUMED, not measured; crosses usually quote wider on a raw-spread account, so the 2 x cost columns are the more cautious reading. They are reported, not a condition.
- Costs decide it: before costs the pooled fade makes +0.193R a trade, the assumed cost takes 0.094R, and at twice the cost the pooled figure is +0.005R (month t +0.15); per cross at 2 x cost: GBP/JPY +0.055, AUD/JPY −0.046, CAD/JPY −0.024, CHF/JPY +0.036. The 0.3 pip cross spread is not measured, so whether the crosses keep a net edge at a real broker's cross spreads is open.
- Read after the verdict, not part of it: the crosses are not independent evidence of USD/JPY's flow. Correlation of a gotobi day's net R with USD/JPY's own T2 trade the same day (2010-now): GBP/JPY 0.73 (1196 days), AUD/JPY 0.51 (1196 days), CAD/JPY 0.77 (1196 days), CHF/JPY 0.71 (1196 days). What replicates is the yen leg on the same days, as the hypothesis said; it is not four more markets' worth of independent days. Pooled halves: 2016-now +0.069R (n 3084, t +1.46), 2010-15 +0.155R (n 1700, t +2.85).
- R2 caveat, read after the verdict: on USD/JPY 2005-09 the same fade on every NON-gotobi day also made +0.047R a trade (n 856, month t +1.07; the yen rose through 2007-09), so part of R2's +0.261R is the yen's trend of those years; the gotobi days still beat all 40 placebo draws (95th percentile +0.105R).
- The month t is on calendar-month sums of net R (pooled: the four crosses' trades of a month summed); the trades of a gotobi day on four yen crosses are strongly correlated (one yen flow), so the pooled n overstates the independent evidence; the month sums carry that correlation.
