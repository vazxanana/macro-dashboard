# The London 16:00 WM/Reuters fix: fading the hour into it (result)

Pre-registered in `PREREGISTRATION.md` (pushed alone on 14 Nov 2026 before any trade was computed); `run.mjs`, `result.json`.
Paper research only: nothing live changed.

**Verdict: FAIL.** None of the three tests is positive after costs in either window: the fade loses about 0.08R a trade in
2016-26 and 0.06-0.10R in 2010-15, t −5 to −7 on month sums. Before costs the pooled fade is slightly positive (+0.04R a
trade, month-sum t 2.99 in 2016-26 and 2.80 in 2010-15), so a small reversal after the fix is visible on OANDA prices, but the
raw-spread round trip (0.12R a trade at this stop) is three times its size.

## What was run

Six USD pairs (EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CHF, USD/CAD), OANDA mid **M5** candles through the site's proxy,
1 Nov 2009 to 30 Oct 2026 (`fetch.mjs`; files outside git). London clock (UTC in winter, BST in summer, `euSummer`). Move M =
close of the 15:55 candle − open of the 15:00 candle; ref = median |M| of the 20 earlier weekdays with a move; event |M| >
0.5 × ref (about 72 % of days); a market order against M at the open of the 16:00 candle, stop 1 × ref, out at the close of the
16:55 candle (T1, T2) or the 16:25 candle (T3). Costs: 0.3 pip spread + 0.3 pip slippage (half a spread on entry and exit) +
45 USD a million a round trip, in R; no financing (never held over 17:00 New York). Days with no candles: 29-30 a pair (holidays).

## Results

R a trade; t = t of calendar-month sums of net R. Decisive = entries 2016-01-01 to 2026-10-31; replication = 2010-2015.

| Test | Window | n | Gross R a trade | Gross R total | Cost R a trade | Net R a trade | Net R total | Month t (net) | Month t (gross) | Net at 2x cost |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 pooled, 17:00 | 2016-26 | 12,272 | +0.041 | +502.6 | 0.124 | −0.083 | −1,020.2 | −6.01 | 2.99 | −0.207 |
| T1 pooled, 17:00 | 2010-15 | 6,742 | +0.050 | +337.1 | 0.112 | −0.062 | −417.1 | −3.51 | 2.80 | −0.174 |
| T2 EUR/USD, 17:00 | 2016-26 | 2,049 | +0.016 | +32.0 | 0.137 | −0.121 | −247.7 | −5.17 | 0.67 | −0.257 |
| T2 EUR/USD, 17:00 | 2010-15 | 1,109 | +0.004 | +4.0 | 0.102 | −0.099 | −109.6 | −3.21 | 0.12 | −0.201 |
| T3 pooled, 16:30 | 2016-26 | 12,272 | +0.044 | +538.3 | 0.124 | −0.080 | −984.5 | −6.72 | 3.87 | −0.204 |
| T3 pooled, 16:30 | 2010-15 | 6,742 | +0.030 | +204.3 | 0.112 | −0.082 | −549.9 | −5.59 | 2.04 | −0.193 |

Holm over T1-T3 (one-sided p of the decisive net t): p = 1, 1, 1; Holm-adjusted 1, 1, 1. No test meets condition 1 (net > 0 in
both windows) or condition 2 (t ≥ 2 after Holm); all meet n ≥ 100. No near miss (no test has net > 0 and t ≥ 2 in 2016-26).

**Each pair under T1, 2016-26 net R a trade (n, t)**: EUR/USD −0.121 (2,049, −5.17), GBP/USD −0.063 (2,054, −2.77), USD/JPY
−0.08 (2,043, −3.14), AUD/USD −0.073 (2,021, −2.93), USD/CHF −0.085 (2,046, −3.26), USD/CAD −0.076 (2,059, −2.83). Every pair is
negative in both windows under T1 and T3.

**Years (T1)**: net positive in 1 of 17 years (2016, +0.030R); gross positive in 13 of 17. The gross reversal was largest in
2014-2017 (+0.11 to +0.13R a trade) and is near zero from 2019 (2022, 2023, 2025 below zero), after the fix window was widened
from one to five minutes in February 2015 (a reading of the years, not a test).

**Summer against winter (2016-26 net, T1)**: summer −0.087 (n 7,334, t −5.16), winter −0.078 (n 4,938, t −3.11).

## Placebo (40 seeds, the same rule at random other London hours 0-13 and 17-19)

| Test | Rule, 2016-26 net | Placebo 5th / 50th / 95th percentile | Seeds beaten |
|---|---|---|---|
| T1 | −0.083 | −0.248 / −0.221 / −0.206 | 40 of 40 |
| T2 | −0.121 | −0.278 / −0.229 / −0.185 | 40 of 40 |
| T3 | −0.080 | −0.246 / −0.225 / −0.213 | 40 of 40 |

The fix hour loses less than any random hour. Read with care: the stop is the hour's own 20-day median move, and the other
hours are quieter (Asia, the London morning before New York, the evening), so the same pip cost is a larger share of R there;
the placebo mixes "the reversal is stronger at the fix" with "costs are smaller in R at a busy hour". It cannot rescue a test
that fails the bar, and none is "robust" (that word was reserved for a passing test).

## What this means

- The published effect is visible before costs on OANDA mid prices (pooled gross month-sum t 2.8-3.9 in both windows), and has
  faded since about 2018. Taken as a mechanical fade at 16:00 with a 1 × median stop, it does not pay after the raw-spread
  costs of the council's demo broker on any pair or exit tested. Not a council rule, not a forward-test candidate.
- Not tested, and not to be inferred from this: trading inside the five-minute fix window itself (M5 candles cannot resolve
  it), month-end fix days alone (branch `fx-month-end`), and the earlier `london-fix` branch's other parameters (same candles,
  not independent evidence).
- Any variant (a wider stop that lowers cost in R, a larger event threshold, summer-only) was chosen after seeing this result
  and would need its own pre-registration on other data.

To repeat: `node --use-env-proxy research/edge/wmr-fix-reversal/fetch.mjs <dir> [seedDir]`, then
`node research/edge/wmr-fix-reversal/run.mjs run <dir>`. Tests: `tests/wmr-fix-reversal.test.mjs`.
