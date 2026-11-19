# Result: month-end rebalancing flow between equities and gold (14 Nov 2026)

**Verdict: FAIL, 0 of 3: trading gold's last three days against the month's gold-vs-S&P lead made -0.055R a trade against the same-side month end out of sample (n 118, month t -0.79).**

PREREGISTRATION.md was committed and pushed alone (ee05e4dd3) before any candle was read; the study ran once and nothing was
changed after the result. A new stand-alone rule on spot gold: not a gate, exit, entry or size of the gold book, and none of its
positions were read (owner item 44). Nothing live changes and no proposal is written.

## What was tested
Spot gold traded, the S&P 500 CFD as the signal only (council-data `research/daily/xau.json` and `spx500.json`, OANDA mid, UTC
days, gold's weekend folded with `foldWeekend`). D = gold's month-to-date log return minus the S&P's, both to the close of the
fourth-last gold day of the month. Side = against D (equities ahead: buy gold; gold ahead: sell gold), from the third-last day's
open to the month's last close, stop 1.5 ATR(20) checked on daily candles (a gap fills at the open). Each trade is scored against
the **same-side baseline**: the identical month-end trade taken in every eligible month of the window. Costs: $0.60 a round trip
and, on buys, `nights` x `FIN.xau.long` x entry (today's demo rate for every year). t on calendar-month sums (every month
counts), Holm over three tests, 40 seeded placebos.

## The tests (excess = net R minus the window's same-side baseline)

| Test | Window | n | Gross R | Net R | Excess R | Month t (net) | Month t (excess) | Cost share |
|---|---|---|---|---|---|---|---|---|
| T1 against the month's lead, both sides | 2007-16 | 120 | -0.037 | -0.070 | -0.041 | -1.18 | -0.69 | 0.86 |
| T1 against the month's lead, both sides | 2017-26 | 118 | -0.055 | -0.086 | -0.055 | -1.25 | -0.79 | 0.56 |
| T2 large gaps only, abs(D) >= 4 % | 2007-16 | 59 | -0.038 | -0.067 | -0.038 | -1.03 | -0.58 | 0.77 |
| T2 large gaps only, abs(D) >= 4 % | 2017-26 | 54 | +0.052 | +0.026 | +0.053 | 0.25 | 0.51 | 0.49 |
| T3 buy side only (equities ahead) | 2007-16 | 60 | -0.081 | -0.122 | -0.048 | -1.53 | -0.60 | 0.52 |
| T3 buy side only (equities ahead) | 2017-26 | 63 | -0.095 | -0.138 | -0.065 | -1.78 | -0.85 | 0.45 |

Baselines (net R a trade, every eligible month): 2007-16 buy -0.075 / sell +0.017 (120 months); 2017-26 buy -0.073 / sell
+0.016 (118 months). Holm-adjusted p (out of sample, excess): T1 1.00, T2 1.00, T3 1.00. Median stop $28.33 in sample, $36.65
out of sample. At 2x costs T1 nets -0.102R (in sample) and -0.117R (out of sample) a trade.

## Placebo
40 draws keeping every out-of-sample month and the same buy / sell split, sides shuffled: the real T1 excess t (-0.79) beats 6 of 40
(placebo t from -1.95 to +1.40). The rule sits in the lower part of the noise.

## Reading
- The rebalancing direction does not show: buying gold after equities led the month did worse than buying gold at every month
  end, in both windows, and selling after gold led did no better than selling at every month end. The large-gap months (T2) are
  slightly positive out of sample and negative in sample, on about 55 trades each: noise.
- Seen beside the test, not tested: gold's last three days of the month were weak in both windows (the buy baseline -0.07R a
  trade net, before the signal). That was not the question here and is not a finding; `gold-turn-of-month` is the calendar study.
- Pass checks: out-of-sample t >= 2 after Holm no; same sign in sample yes (both negative); positive at 2x costs no; placebo 38
  of 40 no.
- Not an edge, never a filter for the gold book. No variant (threshold, window, stop, exit) was tried and none should be.

To repeat: `node research/edge/gold-rebalance-flow/run.mjs` (reads `origin/council-data` through git, no network). Test:
`tests/gold-rebalance-flow.test.mjs`.
