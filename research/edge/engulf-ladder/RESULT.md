# Engulf ladder on gold (Daily → H4 → H1): result

**Verdict: FAIL.** T1, the ladder (limit at the 50 % of the H1 engulf, stop $0.30 past the H4 zone, 2R, 5 days), made
**-0.068R a trade after costs (n 140, t -0.57)**: -0.006R in 2020-23 (n 76) and -0.142R in 2024-on (n 64); calendar-month
sums t -0.59 over 83 months; Holm p 1.00. It is no better than random entries matched in month, side and stop distance:
the ladder's mean beats **20 of 40** placebo means (the bar was 38). T2 and T3 fail too. Not an edge; no proposal; nothing
live changed (the live Gold daily engulf `geg` was not read or touched).

Pre-registration: `PREREGISTRATION.md` (committed alone, before any candle was read). Data: OANDA mid H1 XAU/USD through the
site's candle proxy, 2019-07-01 to 2026-11-13 (43,651 candles; Daily and H4 built from them on the 17:00 New York trading
day; trades from 1 Jan 2020). Costs: $0.30 a round trip and overnight financing on buys (`council/fills.mjs` `nights`, `FIN`).

## T1: the ladder

| | n | net R a trade | win % | PF | total R | worst drawdown |
|---|---|---|---|---|---|---|
| 2020-23 | 76 | -0.006 | 35.5 | 0.99 | -0.5 | -8.3 |
| 2024-on | 64 | -0.142 | 29.7 | 0.81 | -9.1 | -13.0 |
| All | 140 | -0.068 | 32.9 | 0.9 | -9.5 | -15.8 |
| Buys | 62 | -0.095 | 32.3 | 0.87 | -5.9 | |
| Sells | 78 | -0.046 | 33.3 | 0.93 | -3.6 | |

Month-sum t -0.59 (p 0.56, Holm 1.00). Placebo (40 seeds): median -0.059R a trade, range -0.368 to +0.102; the ladder is
above 20 of them. By year: 2020 -0.1R, 2021 +1.9R, 2022 -2.0R, 2023 -0.2R, 2024 -10.1R, 2025 +9.4R, 2026 -8.4R. Exits: 94
stops, 46 targets, no time exit (median hold 9 hours; median risk $9.58).

Funnel (Daily zones → touched → H4 engulf inside → H1 engulf inside): buys 306 → 280 → 193 → 106, sells 281 → 279 → 229 → 115.
Orders from 2020: 208 signals, 28 skipped while another order or trade was on, 40 expired unfilled, 140 filled.

## T2: sideways vs momentum approach (H4 efficiency ratio of 12 candles before the touch, cut 0.30)

Sideways -0.002R a trade (n 69), momentum -0.132R (n 71): difference +0.13R, Welch t 0.55 (+0.053 in 2020-23, +0.21 in
2024-on), Holm p 1.00. Same direction as the course says, far from the bar (t 2); the sideways trades break even, they do
not make money.

## T3: entry at the 50 % vs at the zone's near edge (same 180 signals)

50 %: -0.068R a trade (n 140); near edge: -0.14R (n 159): difference +0.072R, Welch t 0.45 (+0.063 and +0.088 in the halves),
Holm p 1.00. Per signal (unfilled = 0): -0.053R against -0.124R.

## Reading

This agrees with the owner's own 14-year tests (an H4 engulf confirmed by an H1 engulf did worse, raw engulf zones about
PF 1.0) and with `msnr-entry`: stacking engulfs across timeframes does not select better trades on gold 2020-26. Putting a
Daily zone on top and the stop under the H4 zone does not change that. Before costs the stream is close to zero as well
(-0.014R a trade; spread and financing take about 0.054R a trade). Do not propose this rule; a further variant (zone grades, failed
engulfs, sessions, hand-chosen zones) needs its own pre-registration on other data.

To repeat: `node --use-env-proxy research/edge/engulf-ladder/run.mjs fetch <dir>` (candles outside git), then
`node research/edge/engulf-ladder/run.mjs full <dir>`. Tests: `tests/engulf-ladder.test.mjs`.

Implementation details fixed in code, not in the pre-registration (neither favours the rule): a fill candle that also
reaches the target counts the target only when the order filled at that candle's open (the order inside a candle is
unknown); an order whose next candle opens beyond the stop is cancelled (none happened).
