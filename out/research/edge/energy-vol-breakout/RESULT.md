# Gold's T1 breakout on oil and gas, 2016 → now (20 Nov 2026)

Paper research only. Markets, rule, cost, windows and pass bar fixed in `PREREGISTRATION.md` before any candle was fetched. Nothing live changed.

**Verdict: FAIL: T1 on WTI, Brent and natural gas pooled 2016 → now −0.014R a trade net (n 5221, month t −0.85; 2016-20 −0.021R, 2021→ −0.010R; 40 of 40 placebos); fails: bothWindows, t2, cost2x**

| Series | n | Net R/trade | Gross R/trade | Net 2x cost | 2016-20 net | 2021→ net | Month t | Holm p | Placebos | All checks |
|---|---|---|---|---|---|---|---|---|---|---|
| pool | 5221 | −0.014 | +0.059 | −0.088 | −0.021 | −0.010 | −0.85 | — | 40 of 40 | no |
| wtico | 2098 | −0.021 | +0.061 | −0.104 | −0.020 | −0.022 | −0.91 | 1.000 | 40 of 40 | no |
| bco | 1452 | −0.007 | +0.078 | −0.093 | −0.017 | +0.000 | −0.27 | 1.000 | 40 of 40 | no |
| natgas | 1671 | −0.012 | +0.039 | −0.062 | −0.026 | −0.005 | −0.44 | 1.000 | 36 of 40 | no |

Reading, as pre-registered: the pool fails: energies join the markets where the breakout does not hold.

Said with it (not a test): before costs the pool is +0.059R a trade, so the verdict rests on the assumed 0.1 % round trip; the demo broker's energy spreads have not been measured (a tick probe of WTICO / BRENT would settle it, as `index-vol-breakout-hourcost` did for the indices, where a measured cost did not change the verdict).

Cost: 0.1 % of the entry a round trip (2x shown; the demo's energy spreads are not measured). Data: OANDA mid M5, wtico 2015-12-01 → 2026-11-20; bco 2015-12-01 → 2026-11-20; natgas 2015-12-01 → 2026-11-20.
