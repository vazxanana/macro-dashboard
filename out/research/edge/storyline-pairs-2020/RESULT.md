# Storyline pairs on 18 markets, 2020 to now: Daily level + H1 break, Weekly level + H4 break, three setups

**Verdict: INCONCLUSIVE. 0 of 6 tests pass after costs; the best in confirmation, D-gap, made +0.333R a trade (n 26, month-sum t 0.82).**

Second verdict, before costs (owner's request of 23 Nov 2026, made after the pre-registration): **INCONCLUSIVE, 0 of 6** on the same bar applied to R before costs (the twice-the-cost line dropped). The pre-registered verdict above is the after-cost one and stands.

Pre-registration: `PREREGISTRATION.md` (committed alone first). Code: `run.mjs`. Every figure below is in `result.json`; `tests/storyline-pairs-2020.test.mjs` pins them.

## Every test before costs (M5 QM confirmation, 18 markets pooled)

Discovery = fills 2020-2023, confirmation = 2024 to 2026-11-23. R a trade before costs; t = calendar-month sums (empty months 0). Holm over the six on the confirmation one-sided p.

| Test | Disc. n | Disc. R before | Disc. t | Conf. n | Conf. R before | Conf. t | Holm p | Before-cost bar |
|---|---|---|---|---|---|---|---|---|
| D-qm before | 22 | +0.273 | 0.64 | 24 | −0.167 | −0.53 | 1 | fail |
| D-rbs before | 29 | +0.050 | 0.11 | 20 | +0.000 | 0.00 | 1 | fail |
| D-gap before | 24 | +0.000 | 0.00 | 26 | +0.538 | 1.21 | 0.7057 | fail |
| W-qm before | 5 | −0.200 | −0.33 | 4 | −1.000 | −1.67 | 1 | fail |
| W-rbs before | 10 | −0.600 | −1.29 | 11 | +0.091 | 0.18 | 1 | fail |
| W-gap before | 6 | +0.333 | 0.42 | 7 | −1.000 | −2.92 | 1 | fail |

## The same tests after costs (the pre-registered verdict)

| Test | Disc. n | Disc. R after costs | Disc. t | Conf. n | Conf. R after costs | Conf. t | Holm p | Disc. / conf. R at 2x cost | Bar |
|---|---|---|---|---|---|---|---|---|---|
| D-qm | 22 | +0.094 | 0.23 | 24 | −0.385 | −1.27 | 1 | −0.086 / −0.603 | fail |
| D-rbs | 29 | −0.140 | −0.32 | 20 | −0.183 | −0.46 | 1 | −0.329 / −0.366 | fail |
| D-gap | 24 | −0.181 | −0.49 | 26 | +0.333 | 0.82 | 1 | −0.362 / +0.128 | fail |
| W-qm | 5 | −0.281 | −0.47 | 4 | −1.214 | −1.73 | 1 | −0.361 / −1.428 | fail |
| W-rbs | 10 | −0.759 | −1.51 | 11 | −0.090 | −0.18 | 1 | −0.918 / −0.270 | fail |
| W-gap | 6 | +0.169 | 0.22 | 7 | −1.174 | −2.89 | 1 | +0.004 / −1.347 | fail |

Trades counted (all streams, 2020 on): 4452. Test names: D = Daily level, H1 break; W = Weekly level, H4 break; qm / rbs / gap = the setup level.

## Gold alone (reported, not tested; M5 confirmation)

| Test | Disc. n | Disc. R before / after | Conf. n | Conf. R before / after | Conf. t after |
|---|---|---|---|---|---|
| D-qm | 1 | −1.000 / −1.017 | 3 | +0.333 / +0.197 | 0.18 |
| D-rbs | 1 | −1.000 / −1.132 | 0 | n/a / n/a | n/a |
| D-gap | 1 | −1.000 / −1.097 | 1 | +3.000 / +2.824 | 1.00 |
| W-qm | 1 | +3.000 / +2.924 | 1 | −1.000 / −1.465 | −1.00 |
| W-rbs | 0 | n/a / n/a | 1 | −1.000 / −1.465 | −1.00 |
| W-gap | 0 | n/a / n/a | 1 | −1.000 / −1.465 | −1.00 |

## Reported only: the other two confirmations and the sides (pooled, whole 2020-now, after costs; before costs in brackets)

| Stream | n (2020-now) | R after costs | R before costs | Confirmation month t after costs |
|---|---|---|---|---|
| D-qm-m5 | 46 | −0.156 | +0.043 | −1.27 |
| D-qm-m15 | 468 | −0.111 | +0.045 | −1.33 |
| D-qm-none | 636 | −0.059 | +0.022 | −1.70 |
| D-rbs-m5 | 49 | −0.157 | +0.029 | −0.46 |
| D-rbs-m15 | 545 | −0.133 | +0.028 | −1.98 |
| D-rbs-none | 830 | +0.094 | +0.131 | −0.26 |
| D-gap-m5 | 50 | +0.086 | +0.280 | 0.82 |
| D-gap-m15 | 471 | −0.099 | +0.059 | −1.88 |
| D-gap-none | 646 | +0.056 | +0.095 | −1.58 |
| W-qm-m5 | 9 | −0.695 | −0.556 | −1.73 |
| W-qm-m15 | 89 | −0.417 | −0.289 | −2.55 |
| W-qm-none | 118 | +0.056 | +0.101 | 1.06 |
| W-rbs-m5 | 21 | −0.408 | −0.238 | −0.18 |
| W-rbs-m15 | 98 | −0.064 | +0.086 | −2.38 |
| W-rbs-none | 152 | +0.180 | +0.198 | 0.84 |
| W-gap-m5 | 13 | −0.554 | −0.385 | −2.89 |
| W-gap-m15 | 90 | −0.139 | +0.017 | −0.88 |
| W-gap-none | 121 | +0.081 | +0.096 | 1.47 |

Buys / sells (M5 confirmation, whole window, after costs):

- D-qm: buys n 21, +0.319R; sells n 25, −0.555R
- D-rbs: buys n 23, +0.330R; sells n 26, −0.589R
- D-gap: buys n 28, +0.257R; sells n 22, −0.131R
- W-qm: buys n 7, −0.564R; sells n 2, −1.156R
- W-rbs: buys n 8, −1.159R; sells n 13, +0.053R
- W-gap: buys n 5, −1.201R; sells n 8, −0.150R

## Counts and checks

- Storylines starting 2020 on, 18 markets: 1024 Daily, 192 Weekly. Dropped by the data-quality exclusions: 1 trade(s).
- No-look-ahead check (orders placed before 2022-06-15 with every later candle removed; xau, eurusd, nas100): xau 205 compared, 0 different; eurusd 140 compared, 0 different; nas100 158 compared, 0 different. Run before the windows were read.
- No 1-minute candles exist in the cache: the M1 confirmations were not tested (said in the pre-registration).
- **Bugs fixed before the reported run** (said here as the pre-registration asks): the first full run had the storyline side inverted (a rejected resistance gave a buy) and three sign errors (the QM shoulder, the Gap level and the next-level end were looked for on the wrong side). Found because no Gap setup was ever built; fixed, the no-look-ahead check run again, the whole study run again. The first run's figures are not used anywhere; no number of the rule was changed.
- Readings where the pre-registration is silent are listed in `result.json` `readings`; none was chosen after a result.

## What it means

No test reaches the sample bar: the M5 QM confirmation is rare (4 to 29 trades a test and window across 18 markets, against the 100 / 50 needed), so the six tests cannot be judged; none is positive with a month t near 2 either way. The two reported-only confirmations trade far more often and sit near zero before costs and below zero after them on the M15 rejection candle. None of the six storyline setups clears the bar. Nothing live changed and no rule is proposed. Never quote a single market or a reported-only stream from these tables as an edge.
