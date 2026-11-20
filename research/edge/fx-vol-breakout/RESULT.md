# Gold's T1 volatility breakout on six forex majors at the demo's cost (20 Nov 2026)

Paper research only. Rule, markets, cost, windows and pass bar were fixed in `PREREGISTRATION.md` (pushed before any forex candle was fetched). Nothing live changed.

**Verdict: FAIL: T1 on six forex majors pooled −0.022R a trade net (n 12664, month t −1.59; gross +0.012R; 2016-20 −0.031R, 2021→ −0.014R; 28 of 40 placebos beaten); markets passing: usdjpy**

| Series | n | Win | Net R/trade | Gross R/trade | Net 2x cost | 2016-20 net | 2021→ net | Month t | Holm p | Placebos beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| pool | 12664 | 42.6 % | −0.022 | +0.012 | −0.056 | −0.031 | −0.014 | −1.59 | 1.000 | 28 of 40 | no |
| eurusd | 2115 | 41.9 % | −0.030 | +0.006 | −0.066 | −0.021 | −0.038 | −1.23 | 1.000 | 20 of 40 | no |
| gbpusd | 2132 | 43.1 % | −0.006 | +0.022 | −0.034 | −0.010 | −0.003 | −0.27 | 1.000 | 32 of 40 | no |
| usdjpy | 2079 | 44.4 % | +0.063 | +0.096 | +0.031 | +0.036 | +0.087 | +2.50 | 0.043 | 40 of 40 | yes |
| audusd | 2104 | 43.0 % | −0.034 | −0.001 | −0.068 | −0.039 | −0.030 | −1.56 | 1.000 | 16 of 40 | no |
| usdcad | 2087 | 42.0 % | −0.074 | −0.038 | −0.110 | −0.062 | −0.084 | −3.20 | 1.000 | 0 of 40 | no |
| usdchf | 2147 | 41.2 % | −0.051 | −0.014 | −0.088 | −0.092 | −0.016 | −1.92 | 1.000 | 2 of 40 | no |

Cost: commission 0.000045 of the entry price + 0.5 pip a round trip (2x reported). Financing: none (every trade is out at 21:00 UTC, before the 22:00 rollover; nights counted: 0).
**Reading, as pre-registered.** The pool fails, so the rule does not work on forex. One market passing alone (USD/JPY) is a hypothesis for its own pre-registration on data not used here (for example the demo broker's own ticks, or years before 2016), not an edge: with six markets, one clearing Holm on 2016-26 is the kind of result that needs a second, independent look. Gross R is near zero or negative on five of six pairs, so the cost is not what sinks them.

Data: OANDA mid M5, eurusd 2015-12-01 → 2026-11-20 (817243); gbpusd 2015-12-01 → 2026-11-20 (816724); usdjpy 2015-12-01 → 2026-11-20 (817614); audusd 2015-12-01 → 2026-11-20 (814049); usdcad 2015-12-01 → 2026-11-20 (817018); usdchf 2015-12-01 → 2026-11-20 (809058).
