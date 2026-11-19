# Result: a daily three-candle swing failure on gold (13 Nov 2026)

**Verdict: FAIL, 0 of 3 tests.** The model (T1): n 262 trades, -0.001R a trade net of costs (PF 1.00), month-sum t -0.01 over 83
months; first half 2020-23 +0.092R (n 157, t 0.93), second half 2024-26 -0.140R (n 105, t -1.30). Not an edge; nothing live
changed and no proposal is written.

Pre-registration: `PREREGISTRATION.md` (committed alone, first). Data: OANDA mid M15 XAU_USD and XAG_USD, 2 Jan 2020 to 13 Nov
2026 (1,774 trading days of 17:00 New York, 162,519 gold M15 candles), cost $0.30 a round trip, financing on buys (0.00R in total:
every trade opens and closes inside one trading day).

## The tests

| Test | What | n | Mean net R | t | p (Holm) | Pass |
|---|---|---|---|---|---|---|
| T1 | the model | 262 | -0.001 | -0.01 (month sums) | 1.00 | no |
| T2 | silver agreement (SMT) vs the rest | 67 / 195 | -0.093 / +0.031 | -0.69 (difference) | 1.00 | no |
| T3 | entry beyond the 00:00 New York open vs the rest | 7 / 255 | -0.139 / +0.003 | -0.30 (difference) | 1.00 | no |

- **T1** by half: 2020-23 n 157, +0.092R, PF 1.21, t 0.93; 2024-26 n 105, -0.140R, PF 0.74, t -1.30. Before costs +0.024R a
  trade. Worst drawdown -26.0R. Years: 2020 +0.331R (n 37), 2021 +0.163R (45), 2022 +0.017R (40), 2023 -0.166R (35), 2024
  -0.245R (38), 2025 -0.071R (32), 2026 -0.091R (35): positive early, negative since 2023.
- **Placebo** (40 seeds, same side, stop and target distances and entry minute on random days of the same half): the real mean
  -0.001R beats 28 of 40 placebo means (median -0.028R, range -0.201R to +0.125R); the bar was 38.
- **T2, SMT**: trades where silver did NOT take its own Day 1 extreme did WORSE, not better: SMT minus rest -0.165R (2020-23,
  t -0.73) and -0.090R (2024-26, t -0.30). Same sign, far from t 2.
- **T3, midnight open**: only 7 of 262 entries came after 00:00 New York at a price beyond its open (most breaks come in the
  first hours of the day, before midnight); the split cannot say anything.

## The funnel and the splits (reported, not tested)
566 swing-failure setups (Day 2 took one side of Day 1 and closed back inside); 262 reached an entry: 217 dropped because the
target was under 1R from the entry, 74 because the stop level was traded before the M15 break, 12 because the target was, 1 had
no break. Buys n 119 -0.023R (PF 0.95), sells n 143 +0.017R (PF 1.03). Exits: 107 stop, 33 target, 122 at the day's close.

## The previous day's high or low, taken the next day (descriptive)
On 1,651 pairs of full trading days: the next day traded above the previous high 51.9 % of the time, below the previous low
44.6 %, **either 85.8 %**, both 10.7 %. The course's "about 90 %" for either is close, and says little by itself: a day's range
nearly always reaches one of the prior day's extremes.

## Reading
Taking the far side of yesterday's range after a failed sweep paid its costs on gold 2020-22 and has lost since; the whole
window is flat, random days with the same distances do as well in 12 of 40 seeds, and neither silver agreement nor the midnight
open picks better trades. Consistent with the owner's own sweep tests (Asia range PF 0.64 / 0.71, London range 1.20 / 1.09).
Not a filter, not a rule. Nothing under `ict/` was touched.

To repeat: `node --use-env-proxy research/edge/swing-day3/run.mjs fetch <dir>` (candles outside git), then
`node research/edge/swing-day3/run.mjs full <dir>`. Tests: `tests/swing-day3.test.mjs`.
