# Asian range breakout into London on gold: result

**Verdict: FAIL**, neither rule passes the pre-registered bar. Research only: no live rule, size, filter, stop or config changed.

Pre-registered in `PREREGISTRATION.md` (pushed before any number was computed). A new stand-alone intraday rule decided on 2020 to now, not a test of the gold book (item 44); it does not repeat `seasonality` H5 (a long hold from 18:00 New York to 08:00 London, no range).

Data: OANDA mid M5 XAU/USD, 2007-11-01 00:00 to 2026-11-12 23:55 (1,358,347 candles). Range = 00:00-06:59 London local (23:00-05:59 UTC in British summer time), break window 07:00-10:59 London, out at 12:00 New York; $0.30 a round trip; financing on buys over 17:00 New York (zero: every trade ends by noon New York, +0.000R charged). Days used 4,513; skipped: 60 short of candles, 372 range over 2x its 20-day median, 20 warm-up.

| Rule | Window | n | Net R a trade | Gross R | Win % | Month-sum t | Total R | Worst drawdown R | Exits stop / target / time |
|---|---|---|---|---|---|---|---|---|---|
| B breakout | 2020-now (decisive) | 1169 | +0.015 | +0.048 | 45.1 | 0.53 | +17.081 | −32.935 | 458 / 300 / 411 |
| B breakout | 2010-19 (replication) | 1833 | −0.028 | +0.034 | 44.5 | -1.09 | −52.022 | −55.196 | 787 / 510 / 536 |
| F fade | 2020-now (decisive) | 484 | −0.012 | +0.095 | 30.2 | -0.14 | −5.810 | −48.657 | 333 / 135 / 16 |
| F fade | 2010-19 (replication) | 723 | −0.145 | +0.034 | 31.5 | -2.55 | −104.626 | −113.676 | 488 / 208 / 27 |

## The pre-registered checks

| Check | B breakout | F fade |
|---|---|---|
| 1. decisive net R a trade > 0 | yes (+0.015) | **no** (−0.012) |
| 2. month-sum t >= 2 and Holm p < 0.05 | **no** (t 0.53, Holm p 0.599) | **no** (t -0.14, Holm p 0.599) |
| 3. decisive n >= 300 | yes (1169) | yes (484) |
| 4. 2010-19 net R a trade > 0 | **no** (−0.028) | **no** (−0.145) |
| 5. beats >= 38 of 40 random-direction placebos | **no** (35; placebo −0.075 to +0.047) | **no** (30; placebo −0.210 to +0.051) |
| **Rule passes** | **no** | **no** |

## Reported, not tested

- Rule B, 2020-now: 621 buys / 548 sells, median range $9.34, median 1R $9.34, per-trade t 0.484.
  Year by year (n, net R a trade; 2007-09 warm-up, never judged): 2007 20 +0.463; 2008 200 −0.003; 2009 193 +0.042; 2010 205 −0.136; 2011 194 −0.020; 2012 189 +0.071; 2013 178 +0.056; 2014 179 −0.111; 2015 171 +0.078; 2016 163 −0.026; 2017 169 −0.030; 2018 194 +0.017; 2019 191 −0.163; 2020 161 +0.056; 2021 196 −0.056; 2022 191 +0.025; 2023 185 −0.006; 2024 178 +0.055; 2025 158 −0.070; 2026 100 +0.165.
- Rule F, 2020-now: 233 buys / 251 sells, median range $9.175, median 1R $3.209, per-trade t -0.134.
  Year by year (n, net R a trade; 2007-09 warm-up, never judged): 2007 8 −0.642; 2008 65 +0.218; 2009 84 −0.314; 2010 82 −0.132; 2011 81 −0.210; 2012 83 −0.133; 2013 67 −0.185; 2014 73 +0.029; 2015 61 −0.170; 2016 67 −0.246; 2017 67 +0.010; 2018 71 −0.280; 2019 71 −0.133; 2020 69 +0.247; 2021 85 +0.128; 2022 78 −0.081; 2023 81 +0.051; 2024 66 −0.357; 2025 61 +0.137; 2026 44 −0.372.

Not an edge; no proposal is written and nothing live changes.

To repeat: `node --use-env-proxy research/edge/gold-asia-break/run.mjs fetch <dir>`, then `node research/edge/gold-asia-break/run.mjs full <dir>`. Tests: `tests/gold-asia-break.test.mjs`.
