# Result: classic daily candlestick reversal patterns on 28 CFD markets (14 Nov 2026)

**Verdict: FAIL, 0 of 14: the six patterns pooled at a 10-day extreme lose after costs (OOS −0.048R a trade, n 3,231, t −2.09) and match random-direction entries.**

Pre-registered in `PREREGISTRATION.md` (pushed alone, before `run.mjs` existed). Paper research only; nothing live changed.

Six textbook patterns (bullish / bearish engulfing, hammer, shooting star, morning / evening star; exact OHLC rules in the
pre-registration) on OANDA mid daily candles of 28 CFD markets (14 equity indices, silver, copper, palladium, platinum,
Brent, WTI, natural gas, 7 currency majors; gold excluded under item 44), weekends folded, from 2005. Entry at the next
open in the pattern's direction, stop past the pattern's extreme by 0.1 × ATR(20), out at 2R or after 5 candles, one
position at a time per market. Net of the CFD round trip (0.04 % indices, 0.015 % currencies, 0.10 % silver / copper /
energies, 0.20 % platinum / palladium) and financing (0.015 % a night on a long, 0.004 % on a currency position; the
`trend-breadth` assumption). t on calendar-month sums, Holm over the 14 tests on the out-of-sample net p.

| Test | IS n | IS R a trade gross / net | IS t gross / net | OOS n | OOS R gross / net | OOS t gross / net | OOS net x2 | Holm p |
|---|---|---|---|---|---|---|---|---|
| T1 All six, at a 10-day extreme | 3633 | -0.011 / -0.061 | -0.45 / -2.40 | 3231 | +0.001 / -0.048 | -0.00 / -2.09 | -0.080 | 0.415 |
| T2 Bullish engulfing, at a 10-day extreme | 1151 | -0.017 / -0.068 | -0.46 / -1.70 | 1029 | +0.005 / -0.049 | +0.13 / -1.33 | -0.075 | 1.000 |
| T3 Bearish engulfing, at a 10-day extreme | 1476 | -0.023 / -0.067 | -0.58 / -1.65 | 1312 | -0.021 / -0.058 | -0.56 / -1.47 | -0.090 | 1.000 |
| T4 Hammer, at a 10-day extreme | 581 | +0.052 / -0.010 | +0.78 / -0.16 | 578 | +0.026 / -0.039 | +0.34 / -0.51 | -0.072 | 1.000 |
| T5 Shooting star, at a 10-day extreme | 502 | +0.029 / -0.030 | +0.45 / -0.40 | 478 | -0.029 / -0.079 | -0.41 / -1.13 | -0.124 | 1.000 |
| T6 Morning star, at a 10-day extreme | 116 | -0.036 / -0.082 | -0.30 / -0.71 | 84 | +0.105 / +0.056 | +0.91 / +0.49 | +0.035 | 1.000 |
| T7 Evening star, at a 10-day extreme | 141 | -0.107 / -0.141 | -0.97 / -1.26 | 114 | -0.096 / -0.127 | -1.03 / -1.35 | -0.153 | 1.000 |
| T8 All six, no context filter | 9887 | +0.003 / -0.053 | +0.30 / -4.08 | 8411 | +0.025 / -0.032 | +1.68 / -2.11 | -0.068 | 0.415 |
| T9 Bullish engulfing, no context filter | 4404 | +0.009 / -0.063 | +0.35 / -2.59 | 3810 | +0.048 / -0.018 | +1.82 / -0.67 | -0.052 | 1.000 |
| T10 Bearish engulfing, no context filter | 4331 | -0.019 / -0.059 | -0.77 / -2.50 | 3746 | -0.035 / -0.074 | -1.36 / -2.84 | -0.107 | 0.062 |
| T11 Hammer, no context filter | 2320 | +0.076 / -0.005 | +2.32 / -0.16 | 1987 | +0.070 / -0.010 | +1.64 / -0.22 | -0.054 | 1.000 |
| T12 Shooting star, no context filter | 1471 | +0.014 / -0.043 | +0.35 / -0.95 | 1285 | -0.046 / -0.099 | -1.04 / -2.20 | -0.147 | 0.363 |
| T13 Morning star, no context filter | 221 | -0.057 / -0.107 | -0.73 / -1.38 | 167 | +0.037 / -0.015 | +0.43 / -0.17 | -0.039 | 1.000 |
| T14 Evening star, no context filter | 231 | +0.046 / +0.015 | +0.54 / +0.18 | 187 | -0.006 / -0.037 | -0.08 / -0.49 | -0.064 | 1.000 |

IS = trades entered 2005-01 to 2016-12 (144 months), OOS = 2017-01 to 2026-10 (118 months).

- **The bar, T1:** OOS net t −2.09 (needs >= +2), in-sample net −0.061R (needs > 0), OOS net at x2 costs −0.080R (needs > 0):
  all three fail. Before costs T1 is zero in both windows (−0.011R / +0.001R a trade); the loss is the cost (0.032R a trade
  OOS) and financing (0.017R).
- **Placebo** (40 seeded draws, seed 20261114: the same markets, the same signal candles and the same stop distance, a random
  direction): OOS net −0.047R a trade in the median draw (5th-95th percentile −0.079 to −0.031R), t −2.52 (−3.98 to −1.63);
  12 of 40 draws have an OOS t at or above T1's. Taking the pattern's direction is worth nothing over a coin flip.
- **No pattern stands out.** Every secondary test is negative after costs in at least one window; the only positive OOS net
  figures are the morning star at a 10-day low (+0.056R, n 84, t 0.49; −0.082R in sample) and the unfiltered evening star in
  sample. The unfiltered hammer is the one positive gross figure in both windows (+0.076R, t 2.32 IS; +0.070R, t 1.64 OOS)
  and gives it all to costs (−0.005R / −0.010R net). The context filter (retail lore: "at the extremes") does not help: T1 is
  no better than T8 before costs (−0.011 / +0.001R against +0.003 / +0.025R).
- **By group, T1 OOS net:** indices −0.049R (n 1,501, t −1.38), metals −0.027R (466, t −0.57), energies −0.126R (363, t
  −2.05), currencies −0.026R (901, t −0.66). Longs −0.027R (1,490), shorts −0.066R (1,741). T1 lost in 17 of 22 years.
- 44 % of T1 trades stop out, 15 % reach 2R, the rest leave after five candles; OOS win rate 41 %.

**Reading.** Marshall, Young and Rose (2006) found no value in these patterns on US stocks; on index, metal, energy and
currency CFDs, 2005-2026, the same holds after costs, with or without the "only at a range extreme" filter. Not an edge, not
a filter, not a grade point for any council system. Nothing here judges the repository's gold engulf rules (excluded).

To repeat: `node research/edge/candle-patterns/run.mjs fetch <dir>` (git show from `origin/council-data`, no network),
then `node research/edge/candle-patterns/run.mjs full <dir>`. Tests: `tests/candle-patterns.test.mjs`.
