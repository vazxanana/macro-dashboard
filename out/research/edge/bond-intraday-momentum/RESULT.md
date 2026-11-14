# Intraday momentum in US Treasury CFDs: result

**Verdict: FAIL** (the pooled 10-year + 30-year primary meets 1 of the 4 pre-registered lines). Primary, usb10y + usb30y pooled, 2016 → now: n 4983, −0.547R a trade net of CFD costs (before costs +0.038R), month-sum t −23.81 over 131 months; at 2× cost −1.131R; sign hit rate 53.3 % against a placebo 95th percentile of 51.4 %. 2010-2015: n 2864, −0.430R a trade net (before costs +0.045R), month-sum t −14.04.

Pre-registered in `PREREGISTRATION.md` (committed and pushed alone before any return was computed). Claim from Gao, Han, Li and Zhou (2018), Journal of Financial Economics, "Market intraday momentum" (S&P 500); here on OANDA bond CFDs with the Treasury session. Rule: signal = previous 15:00 New York price to 08:50; at 14:30 long if > 0, short if < 0; exit 15:00; stop 1.5 x the 20-day mean |15:00 - 14:30| move (Bund / Gilt: their own session, see sessions). Costs: `bond-month-end`'s CFD round trip (share of price: usb02y 0.02 %, usb05y 0.03 %, usb10y 0.03 %, usb30y 0.05 %, Bund 0.03 %, Gilt 0.04 %), no financing (intraday); Treasury futures cost from `bond-month-end-futures` reported (ZN 0.019325 pt, ZB 0.03495 pt). `signalOf` and `trade` are `intraday-momentum`'s, byte for byte. Data: OANDA mid M5 candles through the candle proxy.

A stand-alone study: not a gate, exit, entry or size on the live gold book (owner decision 44). Nothing live changes.

## Primary test (decides)

| window | span | trades | months | gross R | net R | t (trades) | month-sum t | net R at 2× cost | hit rate | placebo hit mean | placebo hit 95th pct | hit beats seeds | placebo net mean | rule beats seeds (net) | futures net R | futures month t |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2010-2015 | 2010-01-05 → 2015-12-30 | 2864 | 72 | +0.045 | −0.430 | −26.07 | −14.04 | −0.906 | 53.2 % | 50.5 % | 51.7 % | 40 / 40 | −0.454 | 39 / 40 | −0.195 | −7.67 |
| 2016 → now | 2016-01-05 → 2026-11-10 | 4983 | 131 | +0.038 | −0.547 | −41.09 | −23.81 | −1.131 | 53.3 % | 50.3 % | 51.4 % | 40 / 40 | −0.586 | 40 / 40 | −0.263 | −14.50 |

Bar: (1) net R > 0 in both windows: **no**; (2) 2016 → now month-sum t ≥ 2: **no**; (3) 2016 → now net R at 2× cost > 0: **no**; (4) hit rate above the placebo 95th percentile: **yes**. Primary passes: **no**.

## Per market (secondary; decides nothing)

| market | window | days | trades | gross R | net R | t (trades) | month-sum t | cost R | net 2× | win | stops | hit rate | placebo hit 95th | futures net R | futures month t |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| US 10-year (`usb10y`) | 2010-2015 | 1433 | 1432 | +0.033 | −0.495 | −20.52 | −14.84 | 0.528 | −1.023 | 25.9 % | 303 | 52.9 % | 52.1 % | −0.233 | −8.39 |
| US 10-year (`usb10y`) | 2016 → now | 2564 | 2557 | +0.060 | −0.575 | −29.62 | −21.39 | 0.635 | −1.210 | 20.0 % | 504 | 54.2 % | 52.1 % | −0.276 | −12.99 |
| US 30-year (`usb30y`) | 2010-2015 | 1432 | 1432 | +0.058 | −0.366 | −16.31 | −11.46 | 0.423 | −0.789 | 31.5 % | 290 | 53.5 % | 52.2 % | −0.156 | −5.77 |
| US 30-year (`usb30y`) | 2016 → now | 2428 | 2426 | +0.014 | −0.517 | −28.55 | −21.80 | 0.531 | −1.047 | 25.6 % | 532 | 52.3 % | 51.8 % | −0.249 | −12.84 |
| US 2-year (`usb02y`) | 2010-2015 | 938 | 885 | −0.058 | −2.226 | −41.33 | −10.59 | 2.169 | −4.395 | 5.0 % | 254 | 56.5 % | 57.2 % | — | — |
| US 2-year (`usb02y`) | 2016 → now | 1907 | 1894 | +0.062 | −1.377 | −45.81 | −19.22 | 1.439 | −2.817 | 6.9 % | 361 | 52.9 % | 51.9 % | — | — |
| US 5-year (`usb05y`) | 2010-2015 | 1429 | 1428 | +0.044 | −0.885 | −31.69 | −16.50 | 0.929 | −1.814 | 15.6 % | 316 | 51.7 % | 51.4 % | — | — |
| US 5-year (`usb05y`) | 2016 → now | 2443 | 2439 | +0.065 | −0.889 | −40.93 | −24.18 | 0.954 | −1.842 | 13.3 % | 467 | 53.4 % | 52.2 % | — | — |
| Bund (`de10yb`) | 2010-2015 | 1522 | 1516 | +0.073 | −0.335 | −14.78 | −11.68 | 0.408 | −0.743 | 33.1 % | 336 | 54.5 % | 51.7 % | — | — |
| Bund (`de10yb`) | 2016 → now | 2753 | 2741 | +0.021 | −0.424 | −26.13 | −19.82 | 0.445 | −0.870 | 30.5 % | 588 | 50.8 % | 51.9 % | — | — |
| Gilt (`uk10yb`) | 2010-2015 | 1490 | 1489 | +0.025 | −0.434 | −19.43 | −15.25 | 0.459 | −0.893 | 29.8 % | 356 | 51.9 % | 52.4 % | — | — |
| Gilt (`uk10yb`) | 2016 → now | 2704 | 2696 | +0.008 | −0.400 | −23.86 | −17.90 | 0.408 | −0.807 | 30.8 % | 648 | 51.0 % | 51.7 % | — | — |

| market | lines 1 / 2 / 3 / 4 | p (one-sided, B month t) | Holm p (four US) | passes |
|---|---|---|---|---|
| US 10-year | no / no / no / yes | 1.000 | 1.000 | no |
| US 30-year | no / no / no / yes | 1.000 | 1.000 | no |
| US 2-year | no / no / no / yes | 1.000 | 1.000 | no |
| US 5-year | no / no / no / yes | 1.000 | 1.000 | no |
| Bund | no / no / no / no | — | — (not in Holm) | no (reported only) |
| Gilt | no / no / no / no | — | — (not in Holm) | no (reported only) |

## The paper's regression (descriptive)

OLS of the last half-hour return on the first (previous close to signal end), both in %, every eligible day with prices.

| market | window | n | slope | t (OLS) | t (White) | R² |
|---|---|---|---|---|---|---|
| US 10-year | 2010-2015 | 1433 | +0.0233 | +3.15 | +2.77 | 0.69 % |
| US 10-year | 2016 → now | 2564 | +0.0239 | +5.23 | +3.90 | 1.05 % |
| US 30-year | 2010-2015 | 1432 | +0.0338 | +4.05 | +3.64 | 1.13 % |
| US 30-year | 2016 → now | 2428 | +0.0120 | +2.67 | +1.82 | 0.29 % |
| US 2-year | 2010-2015 | 938 | +0.0216 | +2.13 | +2.19 | 0.48 % |
| US 2-year | 2016 → now | 1907 | +0.0308 | +5.21 | +2.58 | 1.40 % |
| US 5-year | 2010-2015 | 1429 | +0.0211 | +2.80 | +2.61 | 0.54 % |
| US 5-year | 2016 → now | 2443 | +0.0268 | +5.44 | +4.05 | 1.20 % |
| Bund | 2010-2015 | 1522 | +0.0348 | +3.42 | +2.71 | 0.76 % |
| Bund | 2016 → now | 2753 | −0.0006 | −0.09 | −0.06 | 0.00 % |
| Gilt | 2010-2015 | 1490 | +0.0280 | +3.19 | +2.81 | 0.68 % |
| Gilt | 2016 → now | 2704 | −0.0134 | −2.00 | −0.96 | 0.15 % |

## Net R by year, CFD cost (descriptive)

| year | US 10-year n / net R | US 30-year n / net R | US 2-year n / net R | US 5-year n / net R | Bund n / net R | Gilt n / net R |
|---|---|---|---|---|---|---|
| 2009 | 15 / −0.248 | 15 / −0.298 | 15 / −0.714 | 15 / −0.452 | 20 / −0.083 | 18 / −0.211 |
| 2010 | 242 / −0.345 | 242 / −0.115 | 240 / −1.662 | 241 / −0.600 | 255 / −0.339 | 250 / −0.427 |
| 2011 | 243 / −0.344 | 243 / −0.160 | 226 / −2.408 | 243 / −0.717 | 256 / −0.289 | 242 / −0.480 |
| 2012 | 237 / −0.656 | 237 / −0.522 | 177 / −3.282 | 234 / −1.277 | 251 / −0.269 | 247 / −0.386 |
| 2013 | 237 / −0.681 | 238 / −0.593 | 22 / −3.156 | 237 / −1.141 | 253 / −0.430 | 250 / −0.506 |
| 2014 | 233 / −0.505 | 232 / −0.437 | 63 / −2.214 | 233 / −0.903 | 252 / −0.550 | 250 / −0.554 |
| 2015 | 240 / −0.445 | 240 / −0.377 | 157 / −1.513 | 240 / −0.690 | 249 / −0.133 | 250 / −0.252 |
| 2016 | 242 / −0.620 | 242 / −0.537 | 139 / −1.672 | 243 / −0.948 | 252 / −0.411 | 249 / −0.406 |
| 2017 | 230 / −0.857 | 239 / −0.722 | 71 / −1.908 | 230 / −1.233 | 245 / −0.335 | 248 / −0.415 |
| 2018 | 228 / −0.631 | 214 / −0.475 | 76 / −2.004 | 215 / −1.128 | 249 / −0.489 | 248 / −0.523 |
| 2019 | 232 / −0.547 | 227 / −0.536 | 231 / −1.403 | 231 / −0.843 | 251 / −0.629 | 250 / −0.534 |
| 2020 | 237 / −0.631 | 239 / −0.416 | 134 / −2.355 | 199 / −1.152 | 254 / −0.392 | 248 / −0.399 |
| 2021 | 236 / −0.774 | 237 / −0.619 | 83 / −2.519 | 225 / −1.152 | 253 / −0.607 | 249 / −0.682 |
| 2022 | 240 / −0.303 | 240 / −0.364 | 240 / −0.728 | 240 / −0.429 | 256 / −0.190 | 242 / −0.296 |
| 2023 | 241 / −0.351 | 238 / −0.408 | 240 / −0.660 | 240 / −0.496 | 255 / −0.252 | 243 / −0.182 |
| 2024 | 236 / −0.473 | 194 / −0.434 | 234 / −1.090 | 220 / −0.705 | 253 / −0.469 | 251 / −0.358 |
| 2025 | 225 / −0.498 | 194 / −0.589 | 235 / −1.310 | 203 / −0.740 | 252 / −0.516 | 247 / −0.395 |
| 2026 | 210 / −0.663 | 162 / −0.609 | 211 / −1.630 | 193 / −1.042 | 221 / −0.377 | 221 / −0.176 |

## Days left out

- US 10-year: 60 eligible days without a price at one of the four times, 20 warm-up days, 8 zero signals.
- US 30-year: 197 eligible days without a price at one of the four times, 20 warm-up days, 2 zero signals.
- US 2-year: 1212 eligible days without a price at one of the four times, 20 warm-up days, 66 zero signals.
- US 5-year: 185 eligible days without a price at one of the four times, 20 warm-up days, 5 zero signals.
- Bund: 24 eligible days without a price at one of the four times, 20 warm-up days, 18 zero signals.
- Gilt: 68 eligible days without a price at one of the four times, 20 warm-up days, 9 zero signals.

## Reading

The pooled primary did not meet the pre-registered bar. Not an edge on these CFD feeds; no proposal is written and nothing live changes. Never call it an edge.

Descriptive, decides nothing (post hoc reading of the tables above): the sign does carry over on the US curve. The pooled hit rate is 53.3 % in 2016 → now and 53.2 % in 2010-2015, above every one of the 40 placebo seeds in both windows, and the paper's regression slope is positive on all four US maturities in both windows (10-year White t +3.90 after 2015, 30-year +1.82). But the half-hour move it predicts is tiny: +0.038R a trade before costs against about 0.58R of CFD round trip, and still −0.263R a trade at Treasury futures cost (0.30R). The Bund and the Gilt show no sign after 2015. A tradable version would need a cost near zero relative to a half-hour move, which neither route here has.

To repeat: `node --use-env-proxy research/edge/bond-intraday-momentum/fetch.mjs <dir>`, then `node research/edge/bond-intraday-momentum/run.mjs <dir>`. Test: `tests/bond-intraday-momentum.test.mjs`.
