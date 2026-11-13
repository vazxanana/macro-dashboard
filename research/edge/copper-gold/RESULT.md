**Verdict:** FAIL: in the decisive window (2016 to 23 Oct 2026, 565 weeks) the equal-weight SPX500 / NAS100 index rose LESS in the weeks after a rising 13-week copper / gold ratio than after a falling one: −0.20 % a week difference, Welch t −0.92 (Newey-West t −0.88), against the bar of a positive difference with t ≥ 2. The rule's Sharpe after costs and financing was 0.14 against 0.62 for the always-long benchmark. 2008-15 had the expected sign (+0.27 % a week, t 0.99), not significant.

# The copper / gold ratio as a risk-on signal for US indices (13 Nov 2026)

Pre-registered in `PREREGISTRATION.md` (committed alone before any return was computed). Paper research only: a stand-alone
weekly long / flat rule on SPX500 and NAS100, **not** a gate, size or exit of the gold book (owner decision 44 untouched). No
live rule, size, filter, stop, config, cost constant or mirror setting changed, and no proposal is written (the rule failed).

**The rule**: at each week end (the week's last daily candle, normally Friday), R = copper close / gold close (OANDA `xcu` /
`xau`). Long the index from the next open while R is above its value 13 weeks earlier, else flat. Every position has a stop at
week-end close − 3 × ATR(20) daily, raised (never lowered) at each kept week end; a stopped market stays flat to the next week
end. Costs: SPX500 0.5 and NAS100 1.5 points on every entry and exit, financing every night held at DGS2 + 2.5 % a year
(`council/fills.mjs` `nights`). Benchmark: always long, the same stop rule and costs. Data: council-data `research/daily/`
(`xcu`, `xau`, `spx500`, `nas100`; none missing), weekends folded.

## Signal test (next-week open-to-open return, no cost, no stop)

| window | series | weeks | ON share | mean ON | mean OFF | difference | Welch t | Newey-West t | Holm p (one-sided) |
|---|---|---|---|---|---|---|---|---|---|
| 2016 to now (decisive) | equal-weight | 565 | 44.25 % | 0.20 % | 0.40 % | −0.20 % | −0.92 | −0.88 | |
| | SPX500 | 565 | | 0.19 % | 0.32 % | −0.13 % | −0.66 | −0.62 | 1.00 |
| | NAS100 | 565 | | 0.22 % | 0.49 % | −0.27 % | −1.10 | −1.07 | 1.00 |
| 2008-15 (check) | equal-weight | 417 | 53.48 % | 0.31 % | 0.04 % | +0.27 % | 0.99 | 1.09 | |
| | SPX500 | 417 | | 0.25 % | −0.02 % | +0.28 % | 0.99 | 1.11 | 0.32 |
| | NAS100 | 417 | | 0.37 % | 0.10 % | +0.27 % | 0.94 | 1.02 | 0.32 |

Placebo (40 seeds, random ON / OFF over the 2016-26 weeks with the same 44.25 % ON share): Welch t from −1.45 to 1.75
(median 0.15); 34 of 40 placebos scored at or above the real −0.92. The real signal did worse than most coin flips.

## Rule against the always-long benchmark (after costs, stop and financing; equal-weight book)

| window | | CAGR | volatility | Sharpe | worst drawdown |
|---|---|---|---|---|---|
| 2016 to now (decisive) | rule | 0.99 % | 10.56 % | 0.14 | 24.99 % |
| | benchmark | 10.02 % | 17.47 % | 0.62 | 31.31 % |
| 2008-15 (check) | rule | 4.10 % | 10.98 % | 0.41 | 23.22 % |
| | benchmark | 0.32 % | 21.00 % | 0.12 | 57.28 % |

In the market 41 % of days in 2016-26 (SPX500 103 switches, 33 stops; NAS100 97 switches, 29 stops), 49-50 % in 2008-15.

## The pass bar, check by check

| check | result |
|---|---|
| 1. 2016-26 difference > 0 with Welch t ≥ 2 | **no** (−0.20 % a week, t −0.92) |
| 2. 2008-15 difference > 0 | yes (+0.27 %, t 0.99) |
| 3. 2016-26 rule Sharpe ≥ benchmark Sharpe | **no** (0.14 against 0.62) |

## Reading

The 2008-15 result has the expected sign and the rule's drawdown was far smaller, but it is
not significant, and it reversed in the decisive decade: the indices did better after a FALLING copper / gold ratio (not
significant either). Not an edge, not a filter, not a regime switch for any
council system; no proposal. To repeat: `node research/edge/copper-gold/run.mjs fetch <dir>`, then `… full <dir>`.
Tests: `tests/copper-gold.test.mjs`.
