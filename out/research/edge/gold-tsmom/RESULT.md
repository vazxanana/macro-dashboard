# Result: published time-series momentum on gold, out of sample (13 Nov 2026)

**Verdict: FAIL** on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). On the untouched
confirmation window (holding months April 2007 to December 2017, n 129 months) neither variant has a monthly t of 2:
long / short Sharpe 0.26, t 0.84, worst drawdown -29.1%; long / flat Sharpe 0.31, t 1.03, worst drawdown -21.3%
(Holm-adjusted p 0.303 for both). Neither beats buy-and-hold gold's return per unit of drawdown (0.94 and 1.30 against 1.79).
Both are positive on 2018 to October 2026. Not an edge; no proposal; nothing live changed.

The rule is the textbook one (Moskowitz, Ooi and Pedersen 2012; Hurst, Ooi and Pedersen): at each month end, the sign of gold's
12-month return; size to 10 % annualised volatility (60-day centre-of-mass exponentially weighted daily volatility, leverage
capped at 3); a catastrophe stop 3 x ATR(20) from the month's entry; $0.30 an ounce a round trip every month and overnight
financing on longs at `council/fills.mjs` `FIN.xau.long` (shorts charged and credited nothing). Simple monthly returns as a
fraction of capital, no compounding. OANDA mid gold daily candles, council-data `research/daily/xau.json`, weekend stubs dropped.
A stand-alone rule: it is not a gate, exit, entry or size of the gold book and reads nothing of it.

| Holding months, after costs and financing | n | Sharpe | t | % a year | Sum | Worst drawdown | Sum / drawdown |
|---|---|---|---|---|---|---|---|
| Long / short, Apr 2007 - Dec 2017 (judged) | 129 | 0.26 | 0.84 | +2.55 | +27.4% | -29.1% | 0.94 |
| Long / flat, Apr 2007 - Dec 2017 (judged) | 129 | 0.31 | 1.03 | +2.58 | +27.7% | -21.3% | 1.30 |
| Buy-and-hold 1x, Apr 2007 - Dec 2017, before costs (the hurdle) | 129 | 0.43 | 1.41 | +7.98 | +85.7% | -47.9% | 1.79 |
| Long / short, Jan 2018 - Oct 2026 | 106 | 0.25 | 0.74 | +2.40 | +21.2% | -28.8% | 0.74 |
| Long / flat, Jan 2018 - Oct 2026 | 106 | 0.45 | 1.33 | +3.99 | +35.3% | -19.9% | 1.77 |
| Buy-and-hold 1x, Jan 2018 - Oct 2026, before costs | 106 | 0.84 | 2.51 | +13.78 | +121.7% | -29.8% | 4.08 |

- **Checks** (all required, each variant on its own): Sharpe > 0.3: long / short not met (0.26), long / flat met (0.31);
  t >= 2 and Holm at 0.05: not met for either (t 0.84 and 1.03, Holm p 0.303); beats buy-and-hold's 1.79 per unit of
  drawdown: not met (0.94, 1.30); 2018 to now positive: met for both (+21.2%, +35.3%).
- **Where the return goes**: before costs and financing the two variants make Sharpe 0.44 (t 1.45) and 0.53 (t 1.74) on the
  confirmation window; financing on the long months takes 18.8 % of capital there (83 long months at an average weight of about
  0.6) and the monthly $0.30 round trips 1.3-2.0 %. Even before any cost neither reaches t 2.
- **The stop**: 3 x ATR(20) is hit in 39 of 129 months (long / short) and 23 of 129 (long / flat). Without it: Sharpe 0.27,
  t 0.88 (long / short) and 0.32, t 1.05 (long / flat) on 2007-17: the stop is not what fails the rule.
- **Buy-and-hold after the same financing** (a 1x long CFD held every month) is worse than either variant: Sharpe 0.12 on
  2007-17 and 0.50 on 2018-26. Before financing (the pre-registered hurdle, spot gold held) it is better.

Shorter lookbacks (reported, not judged; same sizing, stop and costs), Sharpe 2007-17 | 2018-26:

| Lookback | Long / short | Long / flat |
|---|---|---|
| 1 month | -0.26 \| 0.40 | 0.09 \| 0.60 |
| 3 months | -0.35 \| 0.43 | -0.03 \| 0.54 |
| 6 months | 0.20 \| 0.26 | 0.38 \| 0.42 |
| 12 months (judged) | 0.26 \| 0.25 | 0.31 \| 0.45 |

None has a t of 2 in either window (largest 1.79, the 1-month long / flat on 2018-26, chosen after the fact: not evidence).

Year by year, % of capital (long / short, long / flat, buy-and-hold before costs): the rule loses in 2008, 2012, 2014, 2016-18,
2021-23 and gains with gold's long rises (2007, 2009-11, 2019, 2024-25); the short months helped only in 2013 (+17.2 % against
gold's -31.0 %). Full table in result.json `years`.

## What this means
On gold alone, 2007-17, the published 12-month time-series momentum rule does not separate from noise after costs: about 2.5 %
a year at a 10 % volatility target, t under 1.1. The published evidence rests on a diversified portfolio of dozens of futures;
one market does not carry it here. Do not propose it as a gold system. Nothing live changed.

To repeat: `node research/edge/gold-tsmom/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-tsmom/run.mjs full <dir>`. Tests: `tests/gold-tsmom.test.mjs`.
