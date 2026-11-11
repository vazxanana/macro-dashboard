**Verdict:** FAIL: the Gold trend rule does not carry to other markets: 0 of 14 tests pass; pooled over thirteen markets −0.059R a position net on 2020-26 (n 827, monthly t −0.89) and −0.028R on 2005-19 (n 1,690, t −0.52), and +0.04R before any cost. The hourly harness passed its parity gate on gold in both windows, so this time the answer can be read.

# Trend breadth on hourly candles (11 Nov 2026)

Paper research only. No live rule, size, filter, stop, config or council member was changed. The harness, the gate, the
market list, the costs and the pass bar were committed before the harness ran on any market (`PREREGISTRATION.md`, commit
18c71f53).

**The question.** Gold trend is one of the two systems in the owner's paper book and trades about six times a year. Does
the same rule, unchanged (close above the prior 20 daily highs, 2 ATR stop lifted on daily closes, one add, bought again
inside the day after a stop-out), earn on other liquid markets? If it did, that would be more trades from a rule with some
evidence. `research/edge/trend-breadth` could not answer with daily candles. Hourly candles can.

## The parity gate: passed

Gold on the hourly harness against the committed M5 record (`gold-systems-oos`, `gtrend`), positions by entry:

| window | positions, M5 record | positions, hourly harness | gross R a position, M5 record | hourly harness | within the gate (15 %, 0.15R) |
|---|---|---|---|---|---|
| 2006-07 to 2017-12 | 75 | 75 | +0.506 | +0.526 | **yes** |
| 2018-01 to 2026-10 | 59 | 59 | +1.347 | +1.286 | **yes** |

The harness places the same number of positions in both windows, including the re-entries the daily harness missed (5 and
9 of them), and its mean is within 0.06R. It was not adjusted after the gate was read. For reference, gold on this harness
after its own $0.30 a unit and financing on every unit: +0.379R a position on 2006-17 (n 75, per-position t 1.45) and
+1.100R on 2018-26 (n 59, t 2.14; built-on years).

## The fourteen tests (x1 costs with financing; windows by close date)

Candles: OANDA mid H1 and D1 from the first candle served (January 2004; silver March 2006) to October 2026. For every
market here both windows are data the rule never saw (its two numbers were chosen on gold).

| market | sides | 2005-19: n | net R a position | monthly t | **2020-26: n** | **net R a position** | per-position t | **monthly t** | at x2 costs | without financing | before all costs | p | Holm p | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Silver (from 2007) | long | 88 | +0.195 | 0.84 | 50 | +0.375 | 0.91 | 0.95 | +0.343 | +0.439 | +0.471 | 0.171 | 1 | no |
| Nasdaq 100 | long | 113 | +0.028 | 0.21 | 65 | −0.086 | −0.54 | −0.56 | −0.103 | +0.013 | +0.030 | 0.712 | 1 | no |
| S&P 500 | long | 114 | −0.070 | −0.56 | 60 | −0.028 | −0.17 | −0.17 | −0.047 | +0.110 | +0.130 | 0.567 | 1 | no |
| Dow 30 | long | 103 | +0.145 | 0.75 | 54 | −0.138 | −0.69 | −0.69 | −0.157 | −0.006 | +0.014 | 0.755 | 1 | no |
| DAX 40 | long | 90 | +0.031 | 0.21 | 45 | −0.032 | −0.14 | −0.14 | −0.046 | +0.086 | +0.099 | 0.556 | 1 | no |
| Nikkei 225 | long | 97 | +0.069 | 0.38 | 53 | −0.057 | −0.22 | −0.23 | −0.071 | +0.031 | +0.045 | 0.591 | 1 | no |
| EUR/USD | both | 175 | +0.055 | 0.32 | 84 | −0.119 | −0.88 | −0.88 | −0.138 | −0.049 | −0.030 | 0.811 | 1 | no |
| GBP/USD | both | 190 | −0.131 | −1.05 | 91 | −0.398 | −3.85 | −3.56 | −0.414 | −0.347 | −0.330 | 1 | 1 | no |
| USD/JPY | both | 176 | −0.095 | −0.84 | 88 | −0.109 | −0.67 | −0.67 | −0.126 | −0.053 | −0.035 | 0.749 | 1 | no |
| AUD/USD | both | 181 | −0.074 | −0.62 | 79 | −0.325 | −3.18 | −3.06 | −0.339 | −0.282 | −0.268 | 0.999 | 1 | no |
| USD/CAD | both | 174 | −0.157 | −1.32 | 80 | −0.042 | −0.23 | −0.23 | −0.065 | +0.036 | +0.059 | 0.591 | 1 | no |
| WTI crude | long | 95 | +0.003 | 0.02 | 39 | +0.357 | 1.07 | 1.14 | +0.326 | +0.414 | +0.445 | 0.127 | 1 | no |
| Brent crude | long | 88 | −0.128 | −1.15 | 39 | +0.586 | 1.56 | 1.64 | +0.556 | +0.653 | +0.683 | 0.0505 | 0.707 | no |
| **All thirteen, pooled** | | 1,690 | −0.028 | −0.52 | **827** | **−0.059** | −1.05 | **−0.89** | −0.078 | +0.020 | +0.040 | 0.813 | 1 | **no** |

**Pre-registered verdict: FAIL.** No market and not the pool has a monthly t of 2 on 2020-26; the best is Brent crude
(+0.586R, n 39, t 1.64, Holm-corrected p 0.71), and Brent **lost** on 2005-19 (−0.128R, n 88, t −1.15), so it fails the
replication line as well. Three of thirteen markets are positive on 2020-26 (silver and the two oils) and seven on
2005-19; only silver and WTI are positive in both windows, neither near the bar (silver t 0.84 and 0.95; WTI 0.02 and
1.14).

By group (reported): equity indices +0.038R (n 517, t 0.40) then −0.069R (n 277, t −0.69); currency majors −0.081R
(n 896, t −1.06) then −0.201R (n 422, t −2.91); energy −0.060R (n 183, t −0.54) then +0.471R (n 78, t 1.51).

## What this says

- **The rule is not a general trend rule.** On 2,517 positions in thirteen liquid markets over twenty-two years it made
  nothing before costs (+0.04R a position on 2020-26) and lost a little after them. On the currencies it loses clearly on
  both sides (GBP/USD and AUD/USD, t below −3).
- **So the gold record is a gold record.** Gold trend's +0.4R to +0.5R a position on untouched data is best read as "long
  gold with a trailing exit in years gold rose", which is what the random-entry control of `gold-systems-oos` already
  suggested (the real entries sat at the 84th percentile of random long entries with the same exit). It should be sized as
  one bet on gold, and it cannot be multiplied by running it on more markets.
- **The costs matter but do not decide it.** On the indices the assumed financing (about 5.5 % a year) takes 0.09R to
  0.14R a position and turns four small positive figures negative; but without financing the indices are −0.01R to +0.11R
  a position with no t above 1. There is no hidden pass under the financing assumption.
- **Silver and oil** are the only positive rows. They are 50 and 39 positions with t under 2, on seven years, and Brent does not replicate. Under the pre-registration nothing here
  is a candidate for a shadow stream, and none is proposed.

## What this does not say

- Nothing about gold itself: Gold trend stays as it is in the owner's book.
- Nothing about other trend rules (other look-backs, exits, or a long-and-short portfolio with volatility sizing); only
  the live rule, unchanged, was tested.
- The financing rates for markets other than gold are the `trend-breadth` assumptions, not measured broker rates; the
  no-financing column is shown beside them.

## To repeat

`node --use-env-proxy research/edge/trend-breadth-h1/fetch.mjs <dir>` (about 600 candle requests, 26 MB, kept out of git),
then `node research/edge/trend-breadth-h1/run.mjs full <dir>`. Tests: `tests/trend-breadth-h1.test.mjs`.
