# Result: gold's On-Balance-Volume divergence at a new 20-day closing extreme, both sides (14 Nov 2026)

**Verdict: FAIL: fading a gold 20-day closing extreme that OBV does not confirm lost -0.127R a trade net in 2017-26 (n 135, t -1.35) and -0.159R in 2007-16; 0 of 3 tests pass.**

Pre-registered in PREREGISTRATION.md (pushed alone first, commit 104817e5c). The test ran once; nothing was changed after the
result. Paper research: nothing live changed and no proposal follows. **Item 44**: a new stand-alone daily rule judged on
2017-26; it is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf), reads none of its positions and
says nothing about it.

## Data and rule
OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (`git show`, no network), 2006-03-20 to 2026-11-06, weekend
candles folded into the next weekday (`council/fills.mjs` `foldWeekend`, their volume added): 5,364 trading days. OBV = the
cumulative volume signed by the day's close against the previous close (OANDA's volume is a count of price updates). A new N-day
closing high whose OBV stays under its highest of the previous N days is a bearish divergence (SELL next open); a new N-day
closing low whose OBV stays above its lowest is a bullish one (BUY). Stop fixed at 1.5 x ATR(14), out at the stop or the close
of the 10th day; one position at a time. T1 N = 20 (primary), T2 N = 40, T3 = T1's trades minus the same fade on a confirmed
20-day extreme (OBV at its own new extreme). Costs: $0.60 a round trip and `FIN.xau.long` financing on buys. t = calendar-month
sums of net R, one-sided, Holm over three. Placebo: the same OOS entry days, risk and exit days, side drawn at random, 40 seeds.

## Tests (R a trade; IS 2007-16, OOS 2017-01 to 2026-10)
| Test | IS n | IS gross | IS net | IS month t | OOS n | OOS gross | OOS net | OOS month t | Holm p | OOS 2x costs | OOS 2017-21 | OOS 2022-26 | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 divergence, 20 days (primary) | 116 | -0.110 | -0.159 | -1.58 | 135 | -0.072 | -0.127 | -1.35 | 1.0000 | -0.182 | -0.057 | -0.206 | 2 of 40 | no |
| T2 divergence, 40 days | 91 | -0.190 | -0.240 | -2.10 | 104 | -0.108 | -0.159 | -1.47 | 1.0000 | -0.209 | -0.103 | -0.219 | 6 of 40 | no |

T3, the volume condition against its own fade (Welch t on per-trade net R):

| | IS n | IS net | OOS n | OOS net | OOS gross |
|---|---|---|---|---|---|
| Divergence (T1's trades) | 116 | -0.159 | 135 | -0.127 | -0.072 |
| Confirmed 20-day extreme, faded | 194 | -0.257 | 199 | -0.099 | -0.058 |
| Difference | | +0.098 (t 0.77) | | -0.028 (t -0.22, Holm p 1.00) | |

Every test fails. T1 fails all five checks: negative out of sample, negative in sample, negative at 2x costs, and it beats 2 of
40 placebo draws (median placebo -0.070R, best +0.105R), so a random side on the same days and exits did better 38 times in 40.
T3 is positive in sample (+0.098R) and reverses out of sample (-0.028R): the volume condition adds nothing measurable to fading
any new 20-day extreme, which itself loses.

## Against the same-side every-day baseline (OOS, net)
| Side | Divergence n | Divergence net | Baseline n | Baseline net | Difference | Welch t |
|---|---|---|---|---|---|---|
| Buy (bullish divergence at a 20-day low) | 53 | +0.015 | 329 | +0.099 | -0.084 | -0.59 |
| Sell (bearish divergence at a 20-day high) | 82 | -0.220 | 363 | -0.204 | -0.015 | -0.11 |

The buys' small plus is gold's drift: a buy on any day with the same stop and hold made more (+0.099R). The sells lose what any
gold sell lost in 2017-26. Separated from drift, the signal is zero or negative on both sides. T2 against its baselines: buys
-0.177R (t -1.09), sells +0.001R (t 0.01).

## Costs, stops, exits (T1, OOS)
Median stop $36.03 (smallest $14.24); median hold 10 days; exits 60 stops, 1 gap, 74 time. Cost share 0.055R a trade: the round
trip 0.020R, financing on the buys 0.036R averaged over all trades. Gross is already negative (-0.072R), so costs are not the
reason it fails.

## What this says
An OBV divergence at a new 20- or 40-day closing extreme of gold is no reversal signal, before or after costs, in either window.
Not an edge; never a council filter, gate or exit. Nothing live changed.

## To repeat
`node research/edge/gold-obv-divergence/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-obv-divergence/run.mjs full <dir>`. Tests: `tests/gold-obv-divergence.test.mjs`.
