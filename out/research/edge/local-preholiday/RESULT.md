# Result: the pre-holiday effect on nine non-US indices, each on its own exchange's holidays (14 Nov 2026)

**Verdict: FAIL: the day before a local holiday beats an ordinary day by +0.022R pooled out of sample 2017-26 (230 dates, Welch t 1.01) and loses at 2x costs.**

Judged on the pre-registered bar (PREREGISTRATION.md, pushed alone before any return was computed). Long one local session
into the last trading day before the market's own exchange holiday, stop 2 x ATR(20), net of 0.04 % a round trip and 6 % a
year financing per night. Of the four conditions, (1) pooled out-of-sample Welch t >= 2 after Holm is not met (t 1.01, Holm p
1.00), (2) the in-sample difference is positive (+0.009R, t 0.45: met), (3) the pooled pre-holiday trade at 2x costs is
negative (-0.018R: not met), (4) the placebo is met (above 38 of 40 seeds; placebo median -0.016R against the rule's +0.005R).
All four were required. No market's own test survives Holm. Nothing live changed and no proposal follows.

## Out of sample, 2017-01-01 to 6 Nov 2026 (decisive)

R a trade; "other" = the same one-day trade on every other local trading day; Welch t of pre minus other on net R; Holm over
the ten tests (one-sided).

| Market | n pre | gross R | t gross | net R | t net | other net R | diff net | Welch t | Holm p |
|---|---|---|---|---|---|---|---|---|---|
| DAX (DE40) | 35 | +0.039 | 0.88 | +0.016 | 0.35 | -0.014 | +0.030 | 0.65 | 1.00 |
| Euro Stoxx 50 (EU50) | 35 | +0.022 | 0.47 | -0.001 | -0.03 | -0.018 | +0.017 | 0.35 | 1.00 |
| CAC 40 (FR40) | 33 | +0.014 | 0.35 | -0.009 | -0.23 | -0.020 | +0.011 | 0.25 | 1.00 |
| AEX (NL25) | 33 | +0.059 | 1.12 | +0.034 | 0.64 | -0.016 | +0.049 | 0.93 | 1.00 |
| FTSE 100 (UK100) | 60 | +0.047 | 1.42 | +0.021 | 0.65 | -0.026 | +0.047 | 1.40 | 0.73 |
| SMI (CH20) | 63 | +0.032 | 0.80 | +0.004 | 0.10 | -0.022 | +0.026 | 0.64 | 1.00 |
| Nikkei 225 (JP225) | 107 | +0.016 | 0.46 | -0.003 | -0.10 | -0.006 | +0.003 | 0.07 | 1.00 |
| ASX 200 (AU200) | 55 | -0.044 | -1.08 | -0.071 | -1.74 | -0.023 | -0.048 | -1.16 | 1.00 |
| Hang Seng (HK33) | 28 | +0.082 | 2.28 | +0.064 | 1.80 | -0.013 | +0.077 | 2.10 | 0.18 |
| **Pooled, one observation a date** | 230 | +0.028 | 1.33 | +0.005 | 0.24 | -0.017 | +0.022 | 1.01 | 1.00 |

## In sample, file start (2003-2008) to 2016

| Market | n pre | gross R | t gross | net R | t net | other net R | diff net | Welch t |
|---|---|---|---|---|---|---|---|---|
| DAX (DE40) | 47 | +0.035 | 0.91 | +0.014 | 0.38 | -0.007 | +0.021 | 0.56 |
| Euro Stoxx 50 (EU50) | 46 | +0.013 | 0.30 | -0.009 | -0.20 | -0.018 | +0.009 | 0.21 |
| CAC 40 (FR40) | 39 | +0.022 | 0.65 | +0.002 | 0.04 | -0.015 | +0.016 | 0.48 |
| AEX (NL25) | 28 | +0.066 | 1.50 | +0.045 | 1.04 | -0.022 | +0.067 | 1.51 |
| FTSE 100 (UK100) | 83 | +0.045 | 1.56 | +0.021 | 0.73 | -0.022 | +0.043 | 1.44 |
| SMI (CH20) | 87 | -0.002 | -0.05 | -0.026 | -0.72 | -0.018 | -0.007 | -0.20 |
| Nikkei 225 (JP225) | 120 | +0.029 | 0.90 | +0.012 | 0.37 | -0.006 | +0.018 | 0.55 |
| ASX 200 (AU200) | 61 | -0.044 | -1.29 | -0.067 | -1.95 | -0.017 | -0.050 | -1.43 |
| Hang Seng (HK33) | 45 | +0.059 | 1.23 | +0.040 | 0.83 | -0.005 | +0.045 | 0.92 |
| **Pooled, one observation a date** | 292 | +0.015 | 0.80 | -0.006 | -0.31 | -0.014 | +0.009 | 0.45 |

## Reading
- **The sign of the published effect is there, small**: in eight of nine markets out of sample the pre-holiday day earns more
  than an ordinary day before costs, about +0.02R pooled (+0.028R against +0.009R gross). It is not apart from noise (Welch t
  0.89 gross, 1.01 net), and the spread plus one night of financing (about 0.02R a trade) leaves +0.005R pooled, negative at
  twice those costs. Same picture as the US version (`pre-holiday`: +0.023R a holiday, t 1.02).
- **The placebo passes** (38 of 40) only because ordinary days lose after costs (-0.017R) and the pre-holiday day loses less:
  being better than a random day is not the same as making money, and condition (3) fails.
- **Hang Seng** is the one market at Welch t 2.10 out of sample (n 28, +0.064R net), Holm p 0.18: not a claim. Its ordinary-day
  sample is contaminated by the dropped lunar holidays (below), and in sample it was +0.040R, t 0.83. Do not trade it from this.
- **ASX 200** goes the wrong way in both windows (-0.07R net, t -1.74 / -1.95), the only market to do so.
- Descriptive only, never a filter: the FTSE (+0.047R, t 1.40) and AEX (+0.049R, t 0.93) differences are positive in both
  windows; all are chosen after the fact.

## Data, calendars, what was dropped
- OANDA mid UTC daily candles from council-data `research/daily/<key>.json` (git show, no network). For Tokyo, Sydney and Hong
  Kong the UTC close is the next Asian morning, so the measured day also holds that evening's futures trading (a limit, said in
  the pre-registration).
- Holidays are computed from each exchange's rules in `holidays.mjs` (Easter by the anonymous Gregorian algorithm; Japanese
  equinoxes by the standard 1980-2099 formula; substitute and citizens' holidays), never read from the candles.
- **Dropped holidays**: Hong Kong's Lunar New Year, Ching Ming, Buddha's Birthday, Tuen Ng, the day after Mid-Autumn and Chung
  Yeung, and typhoon closures; Xetra's early-2000s closures that later ended (Whit Monday, 3 October in some years); every
  unscheduled closure. sg30, cn50, in50 (lunar or state-announced calendars) and es35 (no in-sample years) were left out.
- **Skipped trades** (a missing candle on the entry or exit day, or in the 20 days of the ATR, as pre-registered): de40 240
  (0 pre-holiday), eu50 176 (0), fr40 513 (5; OANDA's FR40 file has gaps in 2003-04), nl25 66 (1), uk100 6 (0), ch20 22 (0),
  jp225 951 (61), au200 387 (10; gaps in 2011-13), hk33 2,758 (56). The OANDA CFD has no candle on Hong Kong's lunar holidays
  (7-9 a year) and on Good Friday / Christmas for JP225, and each such day voids the ATR of the next 20 trades.
- **Sensitivity, reported only, not pre-registered and not judged** (`result.json` `sensitivity`): with the ATR over the last
  20 days that HAVE a candle, the pooled out-of-sample difference is +0.029R, Welch t 1.40 (252 dates), in sample -0.002R
  (t -0.12), net at 2x costs -0.011R: still a FAIL on three of the four conditions. Hang Seng then reads n 51, +0.047R, t 2.04.
- Costs: 0.04 % of the entry price a round trip and 6 % a year financing per calendar night (one, or three over a weekend), the
  same for every market and year (assumed rates, PREREGISTRATION.md).

To repeat: `node research/edge/local-preholiday/run.mjs` (reads `origin/council-data` with git show; writes `result.json`).
Tests: `tests/local-preholiday.test.mjs`.
