# Gold's T1 breakout on platinum and palladium, 2016 → now (20 Nov 2026)

Paper research only. Markets, rule, cost, windows and pass bar fixed in `PREREGISTRATION.md` before any candle was fetched. Nothing live changed.

**Verdict: FAIL: T1 on platinum and palladium pooled 2016 → now −0.181R a trade net (n 4082, month t −8.67; 2016-20 −0.242R, 2021→ −0.131R; 38 of 40 placebos); fails: bothWindows, t2, cost2x**

| Series | n | Net R/trade | Gross R/trade | Net 2x cost | 2016-20 net | 2021→ net | Month t | Holm p | Placebos | All checks |
|---|---|---|---|---|---|---|---|---|---|---|
| pool | 4082 | −0.181 | +0.060 | −0.421 | −0.242 | −0.131 | −8.67 | — | 38 of 40 | no |
| xpt | 2086 | −0.262 | +0.048 | −0.573 | −0.376 | −0.168 | −9.53 | 1.000 | 31 of 40 | no |
| xpd | 1996 | −0.095 | +0.072 | −0.262 | −0.095 | −0.095 | −3.59 | 1.000 | 39 of 40 | no |

Reading, as pre-registered: the pool fails: platinum and palladium join the markets where the breakout does not hold.

Cost: platinum 0.30 %, palladium 0.20 % of the entry a round trip (2x shown; the demo's quotes of either are not measured). Data: OANDA mid M5, xpt 2015-12-01 → 2026-11-20; xpd 2015-12-01 → 2026-11-20.
Before costs the pool makes +0.060R a trade (palladium +0.072R, 39 of 40 placebos), so, as on the energies, the verdict rests on
an assumed cost (0.30 % / 0.20 % of price, from `gold-drd-pgm`). No demo quote of either metal has been read; a re-cost at
measured spreads (as `energy-vol-breakout-hourcost`) is the only follow-up that could change it.
