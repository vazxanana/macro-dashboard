# Result: risk spillover into the yen after a strong S&P 500 cash session (13 Nov 2026)

**Verdict: FAIL, 0 of 2 pairs.** USD/JPY −0.093R a trade net on 2016-26 (n 725, t −2.36, fails: net R not above 0, t under 2, Holm p over 0.05, negative on 2008-15, placebo not beaten); AUD/JPY +0.011R a trade net on 2016-26 (n 725, t +0.25, fails: t under 2, Holm p over 0.05, negative on 2008-15). Not an edge; no proposal, nothing live changed.

OANDA mid candles: S&P 500 cash session from the 09:30 to the 16:00 New York M30 candle on 4763 full NYSE days (Oct 2007 to 2026-11-12); 1286 signal days beyond ±1 × the previous 60 days' standard deviation (658 up). Each trade: the pair's H1 open at 18:00 New York (Friday signals on Sunday), with the S&P day, stop 1.5 × ATR(24 H1), out at the 03:00 New York open. Costs: commission 0.0045 % of price a round trip (measured) plus 0.8 pip USD/JPY / 1.2 pip AUD/JPY (assumed); no rollover crossed.

| Pair | window | n | net R a trade | t | gross R | x2 costs | cost R | hit | stopped |
|---|---|---|---|---|---|---|---|---|---|
| usdjpy | 2016-26 (decisive) | 725 | −0.093 | −2.36 | −0.037 | −0.150 | +0.057 | 42.9 % | 40.6 % |
| usdjpy | 2008-15 | 555 | −0.091 | −1.99 | −0.033 | −0.149 | +0.058 | 41.6 % | 38.2 % |
| audjpy | 2016-26 (decisive) | 725 | +0.011 | +0.25 | +0.074 | −0.052 | +0.063 | 46.6 % | 41.2 % |
| audjpy | 2008-15 | 555 | −0.149 | −3.19 | −0.098 | −0.200 | +0.051 | 38.4 % | 45.8 % |

## The bar, check by check (decisive window)

| Pair | net > 0 | t ≥ 2 | Holm p | n ≥ 150 | 2008-15 > 0 | placebo beaten (of 40, need 38) | pass |
|---|---|---|---|---|---|---|---|
| usdjpy | no | no (−2.36) | 0.991 | yes | no | 10 | no |
| audjpy | yes | no (+0.25) | 0.799 | yes | no | 39 | no |

## Descriptive (not part of the bar)

- **usdjpy**: after up days −0.057R (n 386, t −1.07), after down days −0.135R (n 339, t −2.30); Friday signals −0.162R (n 159), the rest −0.074R (n 566). Placebo means −0.181 to +0.011R. By year (net R a trade, n): 2008 −0.05 (88), 2009 +0.04 (53), 2010 −0.14 (68), 2011 −0.30 (82), 2012 +0.12 (62), 2013 −0.26 (61), 2014 −0.12 (69), 2015 +0.03 (72), 2016 −0.18 (57), 2017 +0.22 (62), 2018 −0.19 (73), 2019 −0.15 (50), 2020 −0.22 (63), 2021 −0.10 (85), 2022 −0.13 (75), 2023 −0.19 (77), 2024 +0.13 (60), 2025 −0.12 (68), 2026 −0.06 (55). Trades crossing a rollover: 0.
- **audjpy**: after up days +0.048R (n 386, t +0.84), after down days −0.031R (n 339, t −0.47); Friday signals −0.034R (n 159), the rest +0.024R (n 566). Placebo means −0.123 to +0.026R. By year (net R a trade, n): 2008 −0.02 (88), 2009 −0.13 (53), 2010 −0.31 (68), 2011 −0.26 (82), 2012 +0.03 (62), 2013 −0.12 (61), 2014 −0.24 (69), 2015 −0.12 (72), 2016 −0.09 (57), 2017 +0.14 (62), 2018 −0.31 (73), 2019 −0.33 (50), 2020 −0.13 (63), 2021 +0.03 (85), 2022 +0.31 (75), 2023 +0.06 (77), 2024 +0.22 (60), 2025 +0.01 (68), 2026 +0.15 (55). Trades crossing a rollover: 0.

Post hoc, not part of the bar: usdjpy lost in the decisive window with t ≤ −2 (and in 2008-15). Fading the signal was not pre-registered; it is not a finding and would need its own pre-registration on other data. Before costs the loss is small (gross R a trade above), so most of it is the cost of a 9-hour trade with a 1.5 ATR stop.

To repeat: `node --use-env-proxy research/edge/risk-spill-jpy/run.mjs fetch <dir>` (candles outside git), then `node research/edge/risk-spill-jpy/run.mjs full <dir>`. Tests: `tests/risk-spill-jpy.test.mjs`.
