# A Box fade signal as the entry at a Mosha barrier, 6R target, gold 2018-2026

**Verdict: FAIL. The Box fade entry at a Mosha barrier with a 6R target made −0.003R a trade after costs on gold out of sample, 2022 to Oct 2026 (n 1294, month t -0.04). Before costs +0.065R, 18.1% winners; in sample 2018-21 −0.108R (n 994); the same signals away from a barrier −0.159R (n 318), Welch t 1.04.**

Built 2026-11-26. Pre-registered (PREREGISTRATION.md, committed alone before any run; one amendment, committed alone before any result was read: see "The amendment" below). Paper research only; nothing live changed.

## What it means

- **The idea does not make money after costs.** Out of sample the Box fade entry at a barrier with a 6R target made +0.065R a trade before costs and −0.003R after them (n 1294, month t -0.04); in sample it lost (−0.108R, n 994). At twice the cost it loses in both windows. It wins about 18.1% of the time, which is roughly what a 6R target needs just to break even after costs (about one in six).
- **"At a barrier" selects almost nothing.** 9197 of the 9981 Box fade signals (92%) are at a standing barrier of their own side that price had just come back to. The desk draws so many zones (BO, iBO and engulf boxes on five timeframes, about 17,000 a year) that price is nearly always at one. So the barrier adds little: this is close to "the Box fade with a 6R target".
- **The barrier did not pick the better trades.** At a barrier against not at one: Welch t 1.04 out of sample and -1.14 in sample (the sign flips between the two windows; C1 is small, 318 and 187 trades).
- **Against the desk's own barrier entry (C2)** the Box fade entry loses less after costs (−0.003R against −0.082R out of sample), mostly because its stop is wider, so the cost is a smaller share of the risk (0.053 against 0.097, median). Losing less is not making money.
- **The 6R target against the Box fade's own 1R exit (C3):** −0.003R against −0.053R out of sample, −0.108R against −0.075R in sample: the far target is not reliably better, and both are at or below zero after costs.
- The splits by year, timeframe and kind below are descriptive. No row is a rule: the best-looking ones are small (the M15 row, 2024, 2026) and were not chosen before the run.
- Nothing live changed. The Box fade desk and the Mosha 6R barrier demo copy are as they were.

## The pre-registered bar (out of sample, after costs)

| Check | Needed | Got | Met |
|---|---|---|---|
| Trades | n >= 100 | 1294 | yes |
| Mean R after costs | > 0 | −0.003 | no |
| t of calendar-month sums | >= 2 | -0.04 | no |
| In sample mean R after costs | > 0 | −0.108 | no |
| Mean R at twice the cost | > 0 | −0.070 | no |
| Better than C1 (Welch t, per trade) | >= 2 | 1.04 | no |

## Out of sample: fills 2022-01-01 to 2026-10-31

| Stream | n | win % | R before costs | R after costs | month t | at 2x cost | cost / risk (median) |
|---|---|---|---|---|---|---|---|
| Primary: Box fade at a barrier of its side, 6R | 1294 | 18.1 | +0.065 | −0.003 | -0.04 | −0.070 | 0.053 |
| C1: Box fade NOT at a barrier, 6R | 318 | 15.1 | −0.087 | −0.159 | -1.29 | −0.230 | 0.051 |
| C2: the desk's own 6R barrier entries (every entry) | 92504 | 14.9 | +0.036 | −0.082 | -4.61 | −0.199 | 0.097 |
| C3: Box fade at a barrier, its own 1R / 1 day exit | 2765 | 50.7 | +0.016 | −0.053 | -2.46 | −0.123 | 0.055 |
| Context: at a barrier of the opposite side only, 6R | 157 | 15.9 | −0.060 | −0.157 | -0.79 | −0.253 | 0.078 |
| Context: primary with the hours filter dropped, 6R | 1412 | 18 | −0.045 | −0.098 | -1.65 | −0.150 | 0.04 |

## In sample: fills 2018-01-01 to 2021-12-31

| Stream | n | win % | R before costs | R after costs | month t | at 2x cost | cost / risk (median) |
|---|---|---|---|---|---|---|---|
| Primary: Box fade at a barrier of its side, 6R | 994 | 17.8 | +0.011 | −0.108 | -1.69 | −0.228 | 0.1 |
| C1: Box fade NOT at a barrier, 6R | 187 | 21.9 | +0.252 | +0.122 | 0.71 | −0.007 | 0.119 |
| C2: the desk's own 6R barrier entries (every entry) | 66834 | 13.9 | −0.030 | −0.197 | -9.35 | −0.364 | 0.155 |
| C3: Box fade at a barrier, its own 1R / 1 day exit | 2136 | 52.6 | +0.050 | −0.075 | -3.46 | −0.200 | 0.106 |
| Context: at a barrier of the opposite side only, 6R | 118 | 15.3 | +0.025 | −0.133 | -0.55 | −0.291 | 0.145 |
| Context: primary with the hours filter dropped, 6R | 1018 | 20.5 | +0.093 | −0.003 | -0.05 | −0.099 | 0.079 |

Welch t of the primary against C1, per-trade R after costs: out of sample 1.04, in sample -1.14.

## Primary by year (both windows)

| | n | win % | R before costs | R after costs | month t |
|---|---|---|---|---|---|
| 2018 | 228 | 17.5 | −0.061 | −0.207 | -1.39 |
| 2019 | 257 | 18.7 | +0.059 | −0.096 | -0.7 |
| 2020 | 263 | 17.1 | +0.065 | −0.020 | -0.17 |
| 2021 | 246 | 17.9 | −0.030 | −0.124 | -1.02 |
| 2022 | 291 | 15.8 | +0.004 | −0.089 | -0.67 |
| 2023 | 254 | 19.3 | +0.080 | −0.019 | -0.1 |
| 2024 | 264 | 18.6 | +0.142 | +0.070 | 0.45 |
| 2025 | 259 | 16.6 | −0.002 | −0.044 | -0.31 |
| 2026 | 226 | 20.8 | +0.110 | +0.088 | 0.55 |

## C1 by year (both windows)

| | n | win % | R before costs | R after costs | month t |
|---|---|---|---|---|---|
| 2018 | 30 | 30 | +0.700 | +0.523 | 1.02 |
| 2019 | 47 | 17 | −0.030 | −0.202 | -0.58 |
| 2020 | 67 | 22.4 | +0.414 | +0.325 | 1.22 |
| 2021 | 43 | 20.9 | −0.004 | −0.118 | -0.33 |
| 2022 | 43 | 20.9 | +0.314 | +0.190 | 0.39 |
| 2023 | 41 | 19.5 | +0.179 | +0.053 | 0.16 |
| 2024 | 80 | 12.5 | −0.282 | −0.365 | -1.63 |
| 2025 | 110 | 12.7 | −0.192 | −0.232 | -1.22 |
| 2026 | 44 | 15.9 | −0.115 | −0.137 | -0.44 |

## Primary by the barrier's timeframe (both windows; the highest timeframe when several zones qualify)

| | n | win % | R before costs | R after costs | month t |
|---|---|---|---|---|---|
| 1d | 1025 | 18.9 | +0.038 | −0.047 | -0.6 |
| 4h | 588 | 18.2 | +0.037 | −0.055 | -0.52 |
| 1h | 327 | 15.9 | −0.023 | −0.112 | -0.88 |
| 30m | 239 | 15.9 | +0.074 | −0.028 | -0.18 |
| 15m | 109 | 18.3 | +0.220 | +0.116 | 0.48 |

## Primary by the barrier's kind (both windows)

| | n | win % | R before costs | R after costs | month t |
|---|---|---|---|---|---|
| bo | 672 | 19.2 | +0.086 | −0.001 | -0.01 |
| ibo | 323 | 18.9 | +0.140 | +0.050 | 0.41 |
| eg | 1293 | 17.1 | −0.007 | −0.098 | -1.45 |

## The amendment

As first written, a zone counted for as long as it stood unbroken (up to 1,500 days for a daily zone). A first run of one year counted the signals that qualified, and nothing else (no result of any trade was printed or read): 1,995 of 2,009. The condition was tightened, in a commit of its own before any result was read, to the desk's own use of a barrier: price must have come back to the zone within the desk's watch (60 candles of the barrier's confirmation timeframe: D1 60 hours, H4 15 hours, H1 and M30 5 hours, M15 1 hour). Even so about nine signals in ten qualify. No further change was made.

## Counts and notes

- Box fade signals 2018 to Oct 2026 after the skips: 9981 in the rule's own hours (18814 at any hour); 9197 at a standing barrier of their side, 784 not.
- One position at a time: the primary skipped 6909 at-barrier signals that came while its trade was open (C1 279, C3 4296). Still open at the end of the candles and left out: primary 0, C1 0, C3 0.
- A stop on the wrong side of its fill: 0 (such a trade does not exist).
- Cost: $0.30 a round trip, R − 0.30 / filled risk; a trade whose filled risk is under $0.60 is skipped.
- C2 counts every desk entry (several open at once), as mosha-6r-quality did; the Box fade streams hold one position at a time.
- Cut test: 2020 at 2020-04-30: 670 trades closed before the cut (617 at a barrier), identical with the later candles removed; 2024 at 2024-04-30: 673 trades closed before the cut (604 at a barrier), identical with the later candles removed.
- Not built, as the pre-registration says: the swept-swing barriers and the CF / VR zones the sequence hands over (no "broken" moment of their own in the desk's code). The barriers here are the BO / iBO origin boxes and the engulf boxes of D1, H4, H1, M30 and M15.
- No variant is tested on these years after this run.
