# Gold's T1 breakout on the five yen crosses, 2005 → now (20 Nov 2026)

Paper research only. Markets, rule, cost, windows and pass bar fixed in `PREREGISTRATION.md` before any candle was fetched. Nothing live changed.

**Verdict: FAIL: T1 on five yen crosses pooled 2005 → now +0.021R a trade net (n 21088, month t +1.64; 2005-15 +0.013R, 2016→ +0.029R; 40 of 40 placebos); fails: t2, cost2x**

| Series | n | Net R/trade | Gross R/trade | Net 2x cost | 2005-15 net | 2016→ net | Month t | Holm p | Placebos | All checks |
|---|---|---|---|---|---|---|---|---|---|---|
| pool | 21088 | +0.021 | +0.046 | −0.004 | +0.013 | +0.029 | +1.64 | — | 40 of 40 | no |
| eurjpy | 4220 | +0.031 | +0.056 | +0.006 | +0.033 | +0.028 | +1.67 | 0.141 | 40 of 40 | no |
| gbpjpy | 4198 | +0.050 | +0.071 | +0.029 | +0.030 | +0.070 | +2.63 | 0.020 | 40 of 40 | yes |
| audjpy | 4202 | +0.020 | +0.045 | −0.005 | +0.011 | +0.029 | +1.14 | 0.254 | 40 of 40 | no |
| cadjpy | 4220 | +0.037 | +0.063 | +0.011 | +0.029 | +0.045 | +1.98 | 0.096 | 40 of 40 | no |
| chfjpy | 4248 | −0.032 | −0.004 | −0.060 | −0.040 | −0.024 | −1.79 | 0.963 | 16 of 40 | no |

Reading, as pre-registered: the pool fails, so the effect is not the yen's in general: USD/JPY's result stands alone (one market of eleven tested), which weakens that lead without ending it; its forward record is the judge.

Cost: 0.000045 of the entry + 0.005 a round trip (the crosses' real spreads are wider; 2x shown). Data: OANDA mid M5, eurjpy 2004-12-01 → 2026-11-20; gbpjpy 2004-12-01 → 2026-11-20; audjpy 2004-12-01 → 2026-11-20; cadjpy 2004-12-01 → 2026-11-20; chfjpy 2004-12-01 → 2026-11-20.
