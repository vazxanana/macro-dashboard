# Wider stops on the two Equinox fades (result)

**Verdict: FAIL. 0 of 8 wider-stop tests are positive after costs in either window; the least bad, break fade with a 3 x ATR stop and 2R, made -0.029R a trade after costs in 2015-26 (n 201,750, month t -9.34; +0.025R before costs).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants. A before-cost tilt is not an edge.

## What was run

The SAME trades as the two parent cells (break fade = `grid7-wide-fade` `m15 none atr`; big-candle fade = `big-candle-fade`
`m15 k1.5 nobreak`, its "half" cell's trades), the same market entry at the next 5-minute open, with the stop moved: parent stop
(`p`), 1.5 / 2 / 3 x the parent's M15 ATR(14) (`a15`, `a2`, `a3`), or 1 x the H1 ATR(14) of the last closed H1 candle (`h1`).
Target 2R (1R beside), 1-day time limit, stop first in a candle that holds both. Ten markets pooled, OANDA mid 5-minute candles;
discovery = fills 2005-2014, confirmation = 2015 to October 2026; judged AFTER costs on calendar-month sums, Holm over the 8 tests.
Costs: `combo-grid-2` `COSTS`, the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad,
usdchf, eurjpy.

## Gate

- Break fade, parent stop, 2R: 2005-14 n 171,470, +0.0545R (parent n 171,523, +0.054); 2015-26 n 201,750, +0.0423R (parent
  n 201,769, +0.042). Means equal to the published three decimals; 53 / 19 trades fewer.
- Big-candle fade, parent stop, "half": 2005-14 n 47,320, +0.3073R (parent n 47,354, +0.307); 2015-26 n 54,429, +0.1930R (parent
  n 54,443, +0.193); 34 / 14 trades fewer.
- The shortfall (not exact, unlike the pre-registration's wording): trades dropped because the H1 ATR was not available
  (42 break, 34 big-candle signals, warm-up and data holes) or a wider-stop variant was still open at the data's end; every
  variant is run on the same reduced set.

## Primary tests (2R, after costs)

R a trade after costs (month-sum t); before costs beside; cost R = mean round trip / risk in 2015-26; mirror = the same trade WITH
the signal, after costs, 2015-26.

| Test | Rule, stop | n 05-14 | net 05-14 (t) | n 15-26 | gross 15-26 (t) | net 15-26 (t) | cost R | Holm | Mirror net 15-26 | Pass |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| T1 | break a15 | 171,470 | -0.055 (-10.76) | 201,750 | +0.031 (8.16) | -0.076 (-18.91) | 0.107 | 1.000 | -0.155 | no |
| T2 | break a2 | 171,470 | -0.037 (-8.20) | 201,750 | +0.025 (8.21) | -0.055 (-16.70) | 0.080 | 1.000 | -0.118 | no |
| T3 | break a3 | 171,470 | -0.022 (-6.26) | 201,750 | +0.025 (8.22) | -0.029 (-9.34) | 0.054 | 1.000 | -0.078 | no |
| T4 | break h1 | 171,470 | -0.048 (-10.88) | 201,750 | +0.024 (7.04) | -0.050 (-13.53) | 0.074 | 1.000 | -0.104 | no |
| T5 | big a15 | 47,320 | -0.037 (-4.48) | 54,429 | +0.019 (2.63) | -0.072 (-10.07) | 0.091 | 1.000 | -0.107 | no |
| T6 | big a2 | 47,320 | -0.030 (-4.27) | 54,429 | +0.010 (1.53) | -0.058 (-8.97) | 0.068 | 1.000 | -0.075 | no |
| T7 | big a3 | 47,320 | -0.016 (-2.39) | 54,429 | +0.002 (0.25) | -0.044 (-6.74) | 0.045 | 1.000 | -0.032 | no |
| T8 | big h1 | 47,320 | -0.039 (-4.82) | 54,429 | +0.010 (1.37) | -0.051 (-7.39) | 0.061 | 1.000 | -0.066 | no |

Every test is negative after costs in both windows; no mirror is positive either.

## Why a wider stop does not rescue it

A wider stop cuts cost in R (break fade 0.160R -> 0.054R at 3 ATR) but the before-cost tilt shrinks in R about as fast, because in
money it barely grows. In units of the M15 ATR (R x risk / ATR), 2015-26, 2R:

| Rule, stop | risk (ATR) | gross a trade (ATR) | cost a trade (ATR) |
|---|---:|---:|---:|
| break p | 1.00 | 0.042 | 0.160 |
| break a15 | 1.50 | 0.046 | 0.160 |
| break a2 | 2.00 | 0.051 | 0.160 |
| break a3 | 3.00 | 0.074 | 0.161 |
| break h1 | 2.32 | 0.056 | 0.171 |
| big p | 0.37 | 0.015 | 0.164 |
| big a15 | 1.50 | 0.028 | 0.136 |
| big a2 | 2.00 | 0.020 | 0.136 |
| big a3 | 3.00 | 0.005 | 0.136 |
| big h1 | 2.34 | 0.022 | 0.143 |

The round trip is at least twice the before-cost move the fade captures, whatever the stop (2.2x at best, break a3). The big-candle fade's tilt lived in
its "back to the 50 %" exit with a tight stop (+0.193R before costs); with a 2R target and a wider stop it is +0.002R to +0.019R
before costs in 2015-26 (month t 0.25 to 2.63).

## Paired: wider stop minus parent stop, 2R, after costs (per trade, month t)

| Pair | 2005-14 | 2015-26 |
|---|---:|---:|
| break a15 - p | +0.033 (10.17) | +0.042 (14.25) |
| break a2 - p | +0.051 (12.19) | +0.063 (18.41) |
| break a3 - p | +0.066 (14.02) | +0.089 (21.96) |
| break h1 - p | +0.041 (8.50) | +0.069 (19.39) |
| big a15 - p | +0.220 (24.17) | +0.327 (31.67) |
| big a2 - p | +0.227 (23.72) | +0.340 (32.68) |
| big a3 - p | +0.241 (22.31) | +0.355 (32.21) |
| big h1 - p | +0.218 (19.75) | +0.347 (31.47) |

Wider stops lose less per trade in R (mostly the smaller cost share), never enough to be positive.

## 1R target (descriptive, 2015-26)

Break fade net: p -0.124, a15 -0.075, a2 -0.054, a3 -0.034, h1 -0.050. Big-candle fade net: p -0.574, a15 -0.070, a2 -0.057,
a3 -0.044, h1 -0.047. All negative in both windows.

## Stopped either way (2R, both windows pooled)

| Rule, stop | stopped at parent stop | stopped at this stop | of parent stop-outs, also stopped here | stopped under both (share of all) |
|---|---:|---:|---:|---:|
| break a15 | 64.4% | 63.8% | 87.8% | 56.5% |
| break a2 | 64.4% | 62.4% | 80.8% | 52.0% |
| break a3 | 64.4% | 57.5% | 70.3% | 45.3% |
| break h1 | 64.4% | 63.1% | 81.2% | 52.3% |
| big a15 | 64.2% | 64.9% | 75.0% | 48.1% |
| big a2 | 64.2% | 64.1% | 71.9% | 46.2% |
| big a3 | 64.2% | 60.2% | 65.7% | 42.2% |
| big h1 | 64.2% | 64.5% | 72.0% | 46.2% |

Most trades stopped at the tight stop are stopped at the wide one too (70-88 % of the break fade's, 66-75 % of the big-candle
fade's): the faded move usually keeps going. With a 3 x ATR stop and 2R, 15 % (break) and 11 % (big-candle) of 2015-26 trades end
at the 1-day time limit.

## Caveats

- Mid candles, the demo's costs for five markets and assumed costs for five; no slippage beyond the cost.
- The years are the parents' (they already read these signals); only the stop is new.
- The gate is short by 72 / 48 trades (above), with the means equal to the published three decimals.
- Not tested, by the pre-registration: other targets, other time limits, other markets or the late-hour subset.

To repeat: `EDGE_DATA=<cache> node research/edge/fade-wide-stop/run.mjs market <m> <outDir>` for the ten markets, then
`node research/edge/fade-wide-stop/run.mjs report <outDir>` (writes result.json). Test: `tests/fade-wide-stop.test.mjs`.
