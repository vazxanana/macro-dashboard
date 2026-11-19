# Result: after an extreme gold day, does the next day revert or continue? (13 Nov 2026)

**Verdict: FAIL.** Neither rule passes: reversal (R) +0.053R a trade net on 2020 → now (n 27, t 0.14), continuation (C)
+0.040R (n 28, t 0.16); both are below the n of 40 the pre-registration asks for, both lose in 2006-19 (R −0.137R, n 40;
C −0.095R, n 39), and both sit inside the placebo of random days. Not an edge; no proposal; nothing live changed.

A new stand-alone daily rule decided on 2020 → now (PREREGISTRATION.md, pushed first). It is not a test of the gold book
(Gold trend + Gold daily engulf) and adds nothing to its 2006-17 window (docs/owner-decisions.md item 44).

## Data and rule
OANDA mid daily XAU_USD, council-data `research/daily/xau.json`, 2006-03-20 to 2026-11-06, weekend candles folded into the next
weekday (`council/fills.mjs` `foldWeekend`): 5364 trading days. Event: a close-to-close move over 2.0 x ATR(20) of the 20 days
before it: 69 events (31 up, 38 down), 29 with their entry in 2020 → now. Entry at the next day's open, stop 1 x ATR, out at the
close of the third day; $0.30 a round trip and `FIN` financing on buys; one position at a time per rule.

## The test (net of costs, R a trade)
| Rule | 2020 → now n | mean | t | Holm p | 2006-19 n | mean | t | placebo 95th pct | Pass |
|---|---|---|---|---|---|---|---|---|---|
| R (against the shock) | 27 | +0.053 | 0.14 | 0.8692 | 40 | -0.137 | -0.79 | +0.369 | no |
| C (with the shock) | 28 | +0.040 | 0.16 | 0.8692 | 39 | -0.095 | -0.43 | +0.322 | no |

Before costs on 2020 → now: R +0.077R, C +0.067R a trade. Costs over the window: R 0.309R spread + 0.347R financing, C 0.299R +
0.474R. Exits on 2020 → now: R 17 stops / 10 time, C 13 / 15; no gap exits.

## Reported, not tested
- **Up vs down shocks, 2020 → now**: R +0.274R after up shocks (n 13), −0.153R after down (n 14); C +0.541R after up (n 13,
  t 1.24), −0.394R after down (n 15, t −1.96). In 2006-19 the split does not repeat (C after up +0.019R, n 17). Gold's 2020-26
  rally favours buying after an up day; this is gold's trend, not a shock effect, and 13 trades prove nothing.
- **Year by year**: R's 2020 → now total (+1.4R) is 2026 alone (+5.69R on 3 trades); without 2026 it is −4.3R.
- **Silver** (descriptive, $0.03 a round trip, no financing: no rate measured): R +0.491R a trade on 2020 → now (n 25, t 1.47)
  but −0.518R in 2006-19 (n 43, t −3.34); C −0.342R (n 24) and +0.268R (n 43). The signs flip between the windows on silver too.

## What it means
Extreme daily gold moves are too rare (about three a year) for this rule to be judged at all on 2020 → now, and on the record
there is neither reversal nor continuation worth trading after costs. Do not re-cut the threshold, hold or stop on these data.
To repeat: `node research/edge/gold-shock-revert/run.mjs fetch <dir>` then `… full <dir>`. Test: `tests/gold-shock-revert.test.mjs`.
