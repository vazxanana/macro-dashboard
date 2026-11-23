# MSNR direction call on ten markets (result)

**Verdict: FAIL. 0 of 9 primary tests pass; the strongest in confirmation, L4-s (switch event study, h 5), +0.039 (n 3,158, month t +1.92; discovery +0.057, t +3.02).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. A direction test: no entry, stop, exit or cost was simulated, so no figure here is an R or a
trade. One run, no variants.

## What was run

The desk's own direction call (`council/eg-methods.mjs` `direction()`, imported unchanged: key levels one timeframe up, a
switch only after a tapped level and a close beyond the external A / V level that stood before the tap) on three ladders:
**LH** working H1 with H4 levels, **L4** working H4 with Daily levels, **LD** working Daily (17:00 New York) with Weekly
levels. Ten markets: xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy. Discovery 2005-2014, confirmation 2015 to October 2026.

At each close with a call, three measures over the next h working candles: the **call-weighted excess** (call x (forward
log return − the window's mean forward return), divided by the market's own 100-candle volatility x √h), the same at
each **switch** only, and the **hit rate** against its base (the share of up / down windows). Pooled over the ten markets
by calendar-month sums; t over every month of the window.

## The nine primary tests (h = 5, pooled)

| Test | Measure | Discovery n | mean | month t | Confirmation n | mean | month t | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|
| LH-x | call-weighted excess (vol units) | 626,889 | +0.0045 | +1.21 | 727,218 | −0.0006 | −0.18 | 1.000 | no |
| LH-s | switch event study (vol units) | 11,804 | +0.0033 | +0.28 | 14,410 | +0.0110 | +0.99 | 1.000 | no |
| LH-g | hit rate minus base | 626,889 | −0.0044 | −2.08 | 727,218 | −0.0038 | −2.84 | 1.000 | no |
| L4-x | call-weighted excess (vol units) | 163,233 | +0.0136 | +1.59 | 189,062 | −0.0099 | −1.45 | 1.000 | no |
| L4-s | switch event study (vol units) | 2,423 | +0.0569 | +3.02 | 3,158 | +0.0389 | +1.92 | 0.247 | no |
| L4-g | hit rate minus base | 163,233 | +0.0028 | +0.74 | 189,062 | −0.0066 | −2.33 | 1.000 | no |
| LD-x | call-weighted excess (vol units) | 24,800 | +0.0015 | +0.09 | 29,994 | −0.0175 | −1.17 | 1.000 | no |
| LD-s | switch event study (vol units) | 446 | +0.0031 | +0.07 | 570 | −0.0290 | −0.62 | 1.000 | no |
| LD-g | hit rate minus base | 24,800 | −0.0009 | −0.14 | 29,994 | −0.0081 | −1.24 | 1.000 | no |

The bar: positive with month t >= 2 in BOTH windows and Holm p < 0.05 over the nine (one-sided, from the
confirmation t). 0 of 9 pass.

## Hit rate against base, every horizon (pooled)

| Ladder | h | Discovery calls | hit | base | Confirmation calls | hit | base | Excess, % (confirmation) | Switches (conf.) | After a switch, % in the call's direction |
|---|---|---|---|---|---|---|---|---|---|---|
| LH | 1 | 627,465 | 48.0% | 48.5% | 727,726 | 49.5% | 49.7% | +0.0000 | 14,415 | +0.0026 |
| LH | 5 | 626,889 | 48.9% | 49.3% | 727,218 | 49.5% | 49.9% | −0.0003 | 14,410 | +0.0031 |
| LH | 20 | 624,996 | 49.4% | 49.9% | 725,328 | 49.6% | 50.0% | −0.0045 | 14,365 | +0.0100 |
| L4 | 1 | 163,726 | 48.7% | 48.5% | 189,566 | 49.8% | 49.9% | −0.0010 | 3,168 | +0.0045 |
| L4 | 5 | 163,233 | 49.7% | 49.4% | 189,062 | 49.4% | 50.1% | −0.0066 | 3,158 | +0.0168 |
| L4 | 20 | 161,820 | 50.6% | 50.1% | 187,212 | 49.4% | 50.1% | −0.0237 | 3,121 | −0.0047 |
| LD | 1 | 25,092 | 50.7% | 50.1% | 30,471 | 49.7% | 50.1% | −0.0031 | 578 | +0.0698 |
| LD | 5 | 24,800 | 50.2% | 50.3% | 29,994 | 49.4% | 50.2% | −0.0208 | 570 | −0.0374 |
| LD | 20 | 23,813 | 50.3% | 50.4% | 28,472 | 49.0% | 50.4% | +0.0026 | 549 | −0.1571 |

## Every measure and horizon, pooled (month t; descriptive except h = 5)

| Ladder | Measure | h 1 disc. | h 1 conf. | h 5 disc. | h 5 conf. | h 20 disc. | h 20 conf. |
|---|---|---|---|---|---|---|---|
| LH | x | +1.36 | +0.36 | +1.21 | −0.18 | +0.46 | −0.56 |
| LH | s | +1.46 | +2.23 | +0.28 | +0.99 | +3.08 | +0.58 |
| LH | g | −2.19 | −2.84 | −2.08 | −2.84 | −1.89 | −1.75 |
| L4 | x | +1.76 | −1.00 | +1.59 | −1.45 | +1.01 | −1.68 |
| L4 | s | −0.78 | +1.34 | +3.02 | +1.92 | +1.60 | +0.12 |
| L4 | g | +0.54 | −1.19 | +0.74 | −2.33 | +0.77 | −1.50 |
| LD | x | +0.12 | −1.03 | +0.09 | −1.17 | +0.09 | −0.69 |
| LD | s | +0.62 | +1.25 | +0.07 | −0.62 | +0.17 | −0.62 |
| LD | g | +1.65 | −1.16 | −0.14 | −1.24 | −0.11 | −1.31 |

## Per market, h = 5 (confirmation 2015-26; discovery in brackets)

| Market | Ladder | Calls | Buy / sell | Hit | Base | Excess, % | Excess t (month / NW) | Switches | Switch t | Hit t |
|---|---|---|---|---|---|---|---|---|---|---|
| xau | LH | 70,029 | 36,915 / 33,114 | 50.0% (48.3%) | 50.1% (49.4%) | +0.0023 (−0.0004) | +1.25 / +1.34 (+0.60) | 1411 | +0.07 (+1.65) | −0.16 (−2.86) |
| xau | L4 | 18,862 | 12,022 / 6,840 | 50.0% (49.5%) | 50.6% (49.6%) | −0.0067 (+0.0158) | −0.02 / −0.03 (+1.15) | 290 | +2.15 (+0.44) | −0.97 (−0.07) |
| xau | LD | 3,001 | 1,731 / 1,270 | 51.7% (50.8%) | 50.8% (50.9%) | +0.0554 (−0.0003) | +0.92 / +0.94 (+0.50) | 54 | −0.70 (+1.77) | +0.55 (−0.06) |
| xag | LH | 69,734 | 36,784 / 32,950 | 49.8% (49.3%) | 50.0% (49.2%) | +0.0055 (+0.0239) | +0.68 / +0.79 (+3.09) | 1496 | −0.95 (−0.63) | −0.59 (+0.40) |
| xag | L4 | 18,757 | 10,723 / 8,034 | 49.9% (49.4%) | 50.2% (49.2%) | −0.0055 (−0.0332) | −0.06 / −0.07 (+0.20) | 314 | +0.06 (+0.00) | −0.45 (+0.32) |
| xag | LD | 2,972 | 1,433 / 1,539 | 48.1% (53.0%) | 49.9% (50.2%) | −0.0829 (+0.2685) | −0.75 / −0.80 (+1.51) | 60 | −0.37 (+0.56) | −1.03 (+1.36) |
| eurusd | LH | 73,450 | 35,955 / 37,495 | 49.3% (48.6%) | 49.8% (49.4%) | +0.0010 (−0.0014) | +0.95 / +1.08 (−0.61) | 1470 | +0.36 (+0.28) | −1.60 (−1.95) |
| eurusd | L4 | 18,946 | 9,392 / 9,554 | 48.7% (50.0%) | 50.0% (49.4%) | −0.0033 (+0.0091) | −0.34 / −0.37 (+1.31) | 317 | −1.90 (+0.38) | −1.85 (+0.76) |
| eurusd | LD | 3,015 | 1,628 / 1,387 | 50.0% (51.3%) | 49.9% (50.0%) | +0.0356 (+0.0282) | +0.85 / +0.80 (+0.71) | 52 | −0.78 (−1.15) | +0.08 (+0.70) |
| gbpusd | LH | 73,371 | 35,647 / 37,724 | 49.0% (49.0%) | 49.9% (49.3%) | −0.0018 (+0.0006) | −0.30 / −0.35 (+1.02) | 1435 | +0.59 (−0.34) | −2.64 (−0.72) |
| gbpusd | L4 | 18,910 | 9,337 / 9,573 | 48.3% (49.8%) | 50.0% (49.4%) | −0.0154 (+0.0127) | −1.60 / −1.69 (+1.58) | 323 | +0.38 (+0.45) | −2.54 (+0.49) |
| gbpusd | LD | 2,997 | 1,521 / 1,476 | 47.9% (48.4%) | 50.0% (50.0%) | −0.0580 (+0.0298) | −1.36 / −1.35 (+0.07) | 56 | −1.22 (+0.96) | −1.28 (−0.85) |
| usdjpy | LH | 73,401 | 40,433 / 32,968 | 50.0% (49.0%) | 50.1% (49.3%) | +0.0005 (+0.0000) | +0.56 / +0.65 (+0.34) | 1398 | +1.35 (+0.31) | −0.20 (−0.69) |
| usdjpy | L4 | 18,912 | 9,924 / 8,988 | 49.8% (49.2%) | 50.1% (49.3%) | +0.0001 (+0.0124) | −0.28 / −0.29 (+1.34) | 311 | +0.39 (−0.33) | −0.33 (−0.12) |
| usdjpy | LD | 2,993 | 1,622 / 1,371 | 52.5% (49.3%) | 50.4% (50.4%) | +0.0574 (−0.0544) | +1.19 / +1.26 (−0.33) | 48 | +0.46 (−0.67) | +1.27 (−0.59) |
| audusd | LH | 73,397 | 36,166 / 37,231 | 49.2% (49.2%) | 49.8% (49.2%) | −0.0040 (+0.0003) | −1.47 / −1.88 (+0.51) | 1453 | +0.77 (−0.41) | −1.59 (−0.06) |
| audusd | L4 | 18,917 | 9,832 / 9,085 | 49.0% (49.5%) | 50.0% (49.4%) | −0.0128 (−0.0010) | −1.65 / −1.62 (−0.05) | 304 | +0.65 (+1.82) | −1.48 (+0.20) |
| audusd | LD | 2,992 | 1,486 / 1,506 | 47.7% (50.4%) | 50.0% (50.6%) | −0.0510 (−0.0356) | −0.87 / −0.91 (−0.72) | 65 | +0.76 (−0.13) | −1.34 (−0.15) |
| nzdusd | LH | 73,559 | 36,327 / 37,232 | 49.5% (48.9%) | 49.8% (49.2%) | −0.0012 (−0.0012) | −0.48 / −0.46 (+0.94) | 1463 | +1.47 (+0.27) | −1.06 (−0.93) |
| nzdusd | L4 | 18,984 | 9,571 / 9,413 | 49.6% (49.8%) | 49.9% (49.6%) | −0.0057 (+0.0025) | −0.46 / −0.50 (−0.05) | 329 | +1.28 (+3.08) | −0.35 (+0.25) |
| nzdusd | LD | 3,030 | 1,148 / 1,882 | 46.8% (48.0%) | 50.3% (50.4%) | −0.1159 (−0.0881) | −1.99 / −2.22 (−1.51) | 74 | +1.18 (−1.26) | −1.94 (−1.23) |
| usdcad | LH | 73,388 | 38,890 / 34,498 | 49.2% (48.5%) | 49.9% (49.1%) | −0.0023 (+0.0013) | −0.89 / −0.99 (+0.24) | 1441 | +0.05 (−1.54) | −2.01 (−1.78) |
| usdcad | L4 | 18,905 | 9,809 / 9,096 | 50.2% (49.5%) | 50.0% (49.2%) | −0.0023 (−0.0069) | −0.04 / −0.04 (−0.13) | 323 | +2.18 (+3.07) | +0.26 (+0.29) |
| usdcad | LD | 2,991 | 1,940 / 1,051 | 49.3% (50.0%) | 50.5% (50.4%) | +0.0072 (−0.0255) | −0.36 / −0.37 (+0.07) | 51 | −0.56 (+0.13) | −0.68 (−0.23) |
| usdchf | LH | 73,343 | 36,611 / 36,732 | 49.6% (48.0%) | 49.8% (49.2%) | −0.0003 (−0.0046) | −0.45 / −0.47 (−1.92) | 1412 | −0.85 (−0.23) | −0.77 (−3.42) |
| usdchf | L4 | 18,883 | 9,686 / 9,197 | 50.1% (49.8%) | 50.0% (49.3%) | −0.0005 (+0.0079) | −0.15 / −0.15 (+0.92) | 314 | +1.10 (−0.05) | +0.17 (+0.73) |
| usdchf | LD | 2,970 | 1,367 / 1,603 | 50.0% (51.9%) | 49.9% (50.0%) | −0.0275 (+0.0166) | −1.19 / −1.18 (+0.84) | 61 | −1.35 (+1.21) | +0.05 (+1.00) |
| eurjpy | LH | 73,546 | 38,525 / 35,021 | 49.7% (49.6%) | 50.0% (49.5%) | −0.0023 (+0.0048) | −0.52 / −0.54 (+1.19) | 1431 | +0.87 (+1.77) | −0.76 (+0.22) |
| eurjpy | L4 | 18,986 | 10,167 / 8,819 | 48.7% (50.2%) | 50.1% (49.6%) | −0.0139 (+0.0141) | −1.74 / −1.76 (+1.12) | 333 | +0.70 (+0.81) | −2.21 (+0.86) |
| eurjpy | LD | 3,033 | 1,784 / 1,249 | 49.7% (50.2%) | 50.3% (50.6%) | −0.0282 (−0.0619) | −0.68 / −0.72 (−0.46) | 49 | +0.81 (−0.40) | −0.34 (−0.19) |

## Data and checks

- OANDA mid candles through the site's candle proxy, cache files outside git. xau 2006-03-19 to 2026-11-23; xag 2006-03-19 to 2026-11-23; eurusd 2004-01-01 to 2026-11-23; gbpusd 2004-01-01 to 2026-11-23; usdjpy 2004-01-01 to 2026-11-23; audusd 2004-01-01 to 2026-11-23; nzdusd 2004-01-01 to 2026-11-23; usdcad 2004-01-01 to 2026-11-23; usdchf 2004-01-01 to 2026-11-23; eurjpy 2004-01-01 to 2026-11-23.
- **Declared deviation**: the H1 candles were fetched directly from OANDA (`run.mjs fetch`) instead of being resampled from
  5-minute candles (the 5-minute fetch would have taken about two hours). H4 (UTC 4-hour buckets) and the 17:00 New York
  Daily are built from them as pre-registered; both boundaries fall on whole hours, so the buckets are the same. Where a
  5-minute file existed (gbpusd 2004, a thin year: 315 hours on file) the H1 candles resampled from it equalled the fetched
  ones exactly.
- **Cut test** (no look-ahead): 100 cuts, 9,277,388 calls of closed candles compared, 0 mismatches.
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`); an observation whose span touches one is dropped.
- The Daily ladder has few switches per market (a few a year); its switch test is thin by nature and its call-weighted
  test carries most of its weight.

## What it means

The call, computed by fixed rules with no look-ahead, does not predict the next 5 candles' direction on these ten
markets beyond what the market does anyway, on any of the three ladders, in either decade. It extends
`research/edge/msnr-direction` (gold alone, 0 of 6) to ten markets: as a mechanical direction filter it carries no
measurable direction. It does not judge a person reading the same levels by eye. Never call it an edge or use it as a
filter on the strength of the desks' records; do not re-test variants on these years.

Two readings worth naming, neither evidence: the nearest miss is L4-s, the H4 switch (discovery t +3.02, confirmation
t +1.92, Holm p 0.25), a tilt of a few hundredths of a volatility unit over five H4 candles; and the call's
side is right slightly LESS often than the base rate on H1 (month t −2.08 and −2.84) and on H4 in confirmation
(−2.33), by about half a percentage point: if anything a small tilt against the call, never toward it.
