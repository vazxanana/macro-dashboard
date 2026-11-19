# Result: cross-sectional 1-week reversal in G10 FX (13 Nov 2026)

**Verdict: FAIL, 0 of 4 checks.** On 2016 to 6 Nov 2026 (decisive) the reversal book lost 19.08 % net (566 weeks, annualised
Sharpe -0.509, month-sum t -1.60); on 2008-2015 it lost 1.07 % (417 weeks, Sharpe -0.024). Before any cost it is flat in the
decisive window (+0.32 %, Sharpe 0.009, month-sum t 0.03) and only mildly positive in 2008-15 (+13.31 %, Sharpe 0.303, month-sum
t 0.91). The random-ranking placebo's 95th percentile is -0.168; the rule's -0.509 beats 29 of 40 seeds, not the bar.

Rule as pre-registered: each week at the close of the last Monday-Friday OANDA daily candle (00:00 UTC, about two hours after
the 17:00 New York close, because the council's daily cache is in UTC days), rank EUR, GBP, JPY, AUD, CAD, CHF, NZD against
the dollar by their past-week return; buy the 2 lowest, sell the 2 highest at the next candle's open; equal 60-day volatility
weights; a 3 x ATR(20) stop on every leg; out at the next week's decision close.

| Window | Weeks | Mean a week, net | Sharpe (ann.) | Month-sum t | Total net | Worst drawdown | Total gross | Costs | Financing | Legs stopped |
|---|---|---|---|---|---|---|---|---|---|---|
| 2008-2015 (check) | 417 | -0.0026 % | -0.024 | -0.07 | -1.07 % | -9.36 % | +13.31 % | 7.49 % | 6.90 % | 4.4 % |
| 2016 to Nov 2026 (decisive) | 566 | -0.0337 % | -0.509 | -1.60 | -19.08 % | -23.54 % | +0.32 % | 10.31 % | 9.10 % | 5.2 % |

| Check | Bar | Result |
|---|---|---|
| Decisive Sharpe | > 0.4 | -0.509: no |
| Decisive month-sum t | >= 2 | -1.60: no |
| 2008-2015 total | > 0 | -1.07 %: no |
| Placebo, 40 random rankings | above its 95th percentile (-0.168) | -0.509: no (median -0.666, best 0.240) |

- **Where the return goes**: the gross reversal premium, if there is one on these seven majors at this horizon, is about zero
  since 2016 and about 1.7 % a year in 2008-15, against a weekly round trip on four legs (about 1 % a year) plus the stated
  1 % a year financing against every leg (about 0.9 % a year). Nothing is left after costs.
- **By year (net, % of book)**: 2008 -2.32, 2009 +1.16, 2010 +2.61, 2011 +3.16, 2012 -4.08, 2013 -0.79, 2014 +0.91, 2015 -1.72,
  2016 -0.29, 2017 +0.68, 2018 -4.14, 2019 +0.31, 2020 +4.52, 2021 -3.28, 2022 -7.54, 2023 -0.68, 2024 -5.04, 2025 -0.31,
  2026 -3.31 (to 6 Nov). 2022 and 2024, the strong-dollar trend years, lost most: a trend against the reversal bet.
- **Costs used**: the measured raw-spread model (`council/fills.mjs` `costModel` on `tests/fixtures/ctrader/symbols-raw-12nov.json`):
  EUR/USD, GBP/USD, AUD/USD, USD/CAD, USD/CHF quoted at a median spread of 0 with a 0.0045 % round-trip commission and 1 pip of
  slippage; USD/JPY and NZD/USD (not in the fixture) on the default basis, 2 pips + 0.0045 %. The 1 % a year financing against
  every leg is the pre-registration's stated, conservative assumption (no carry credited); the real swap on a raw account is
  pair- and side-dependent and was not measured here.
- Placebo note: its median (-0.666) is below the rule's, because a random book pays the same costs with no signal at all; the
  rule is a little better than random and still loses money.

What it means: a short-horizon cross-sectional reversal on the seven USD majors is not an edge at these costs; it is not a
council rule and no proposal was written. Nothing live changed. The literature's effect is reported on wider currency sets
(including emerging and higher-cost currencies) and before the costs a retail CFD account pays; this test does not judge
those. Any variant (another horizon, more legs, crosses, no financing assumption) needs its own pre-registration.

To repeat: `node research/edge/fx-reversal/fetch.mjs <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/fx-reversal/run.mjs <dir>` (writes `result.json`, about 4 s). Tests: `tests/fx-reversal.test.mjs`.
