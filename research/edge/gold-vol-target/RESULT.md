# Result: volatility targeting on a passive gold holding (14 Nov 2026)

**Verdict: FAIL, 0 of 3 tests pass: vol-targeted gold beats a matched constant holding out of sample (Sharpe +0.07, t 0.59) but lost to it in 2008-16; no test near Holm p 0.05.**

The bar is the pre-registered one (PREREGISTRATION.md, pushed alone before any number was computed). Paper research only:
nothing live changed and no proposal is written. A stand-alone allocation study of the gold price: it reads no trade record
of the gold book and is not a gate, exit, entry or size of it (owner decision 44: read in PREREGISTRATION.md; windows 2008-16
and 2017-26 kept apart from the book's 2006-17 window by calendar, as other gold calendar studies did). The positions are
portfolio weights rebalanced weekly, not trades with a stop; any live use would need a stopped execution and the owner.

Data: OANDA mid XAU/USD daily candles (council-data `research/daily/xau.json`, 20 Mar 2006 to 6 Nov 2026, 5,364 weekday
closes after `foldWeekend`). Capital fixed at 1, no compounding. Costs: $0.45 an ounce traded at each weekly rebalance
(`|u_new - u_old| x 0.45`: a full $0.30 spread plus half a spread of slippage on every one-way trade) and overnight financing
`u x C x 0.000148 x nights` (`council/fills.mjs` `FIN.xau.long`, today's demo rate charged for every year: the broker's past
rates are not known). 2x costs doubles both. M = `min(2, 0.15 / sigmaN)` set each Friday close; K = the same holding at a
constant weight equal to M's average weight in that window.

## The tests (OOS = Jan 2017 - Oct 2026, 118 months; IS = 2008-16, 108 months; net of costs)

| Test | OOS | IS | OOS at 2x costs | Bootstrap p | Holm p | Memmel z | Pass |
|---|---|---|---|---|---|---|---|
| T1 Sharpe(M20) - Sharpe(K20) | +0.075 | -0.120 | +0.054 | 0.236 | 0.588 | 0.59 | no |
| T2 Sharpe(M60) - Sharpe(K60) | +0.097 | -0.039 | +0.074 | 0.203 | 0.588 | 0.81 | no |
| T3 maxDD(K20) - maxDD(M20) | +0.070 | -0.225 | +0.002 | 0.196 | 0.588 | | no |

p one-sided (the managed holding better), paired circular block bootstrap of the monthly net returns, 6-month blocks, 5,000
draws, fixed seed; Holm over the three. Every test fails two of its three checks (the OOS significance and the in-sample
sign); only the 2x-cost check passes.

## The holdings (net of costs, fractions of starting capital)

| Series | Window | Months | Avg weight | Sharpe | t | Return a year | Max drawdown | Worst year | Financing a year | Trading cost a year |
|---|---|---|---|---|---|---|---|---|---|---|
| M20 | 2008-16 | 108 | 1.006 | -0.12 | -0.37 | -2.45 % | 94.9 % | 2013 -40.7 % | 5.44 % | 0.22 % |
| K20 | 2008-16 | 108 | 1.006 | -0.01 | -0.01 | -0.09 % | 72.3 % | 2013 -36.7 % | 5.44 % | 0.04 % |
| M60 | 2008-16 | 108 | 0.941 | -0.04 | -0.13 | -0.77 % | 77.7 % | 2013 -36.5 % | 5.09 % | 0.08 % |
| K60 | 2008-16 | 108 | 0.941 | -0.01 | -0.01 | -0.09 % | 67.7 % | 2013 -34.4 % | 5.09 % | 0.04 % |
| M20 | 2017-26 | 118 | 1.207 | 0.61 | 1.90 | +10.77 % | 32.5 % | 2021 -11.2 % | 6.53 % | 0.19 % |
| K20 | 2017-26 | 118 | 1.207 | 0.53 | 1.67 | +9.78 % | 39.5 % | 2026 -15.8 % | 6.53 % | 0.02 % |
| M60 | 2017-26 | 118 | 1.141 | 0.63 | 1.97 | +10.32 % | 27.9 % | 2018 -12.1 % | 6.17 % | 0.06 % |
| K60 | 2017-26 | 118 | 1.141 | 0.53 | 1.67 | +9.24 % | 37.3 % | 2026 -14.9 % | 6.17 % | 0.02 % |

Drawdowns are in fractions of a fixed starting capital (no compounding), so a holding near 1x of gold bought in 2011 and held
through 2013-15 shows a drawdown near its whole capital. The cap of 2x was hit at 1.1 % (IS) and 3.3 % (OOS) of M20's
rebalances, never by M60.

## Question 2: does cutting exposure after volatility spikes lower the drawdown without giving up return?

Out of sample, yes in the sample's numbers: M20's worst drawdown is 7.0 points of capital shallower than K20's and its return
is +0.99 % a year higher (monthly difference t 0.43); M60's drawdown 9.4 points shallower, return +1.07 % a year (t 0.53).
In 2008-16 the opposite: M20's drawdown 22.5 points DEEPER and its return 2.4 % a year lower. Neither the gain nor the loss is
apart from noise (T3 bootstrap p 0.196), and the 2x-cost drawdown gain is close to zero (+0.2 points).

## Placebo (40 seeds: M20's OOS weights shuffled across calendar months, applied to the real prices against the same K20)

T1: placebo Sharpe gains mean -0.040 (range -0.227 to +0.192); 5 of 40 reach the real +0.075. T3: placebo drawdown gains mean
-0.032 (range -0.228 to +0.094); 3 of 40 reach the real +0.070. The real timing does better than most shuffles (about the
top eighth), but not enough to separate it from them, and the in-sample window goes the other way.

## Reading

As on the index CFDs (`vol-managed`, `vol-managed-index`), volatility targeting on gold is not a risk-adjusted improvement
that survives both windows: it helped in 2017-26 and hurt in 2008-16, by amounts the bootstrap and the placebo cannot tell
from luck. Financing (5-6.5 % of capital a year at today's rate) costs both holdings
alike and dominates the trading cost (0.02-0.22 %).

Not tested (fixed in the pre-registration): any other target, cap, lookback, rebalance frequency, market or window; a short
side. Nothing live changed.
