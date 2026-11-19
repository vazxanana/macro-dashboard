# The US 10-year regime table and gold

**Verdict: FAIL, 0 of 3** (pre-registered, 19 Nov 2026). The rule book's regime table leans the right way in most classes, but no
class moves gold's next 20 sessions by enough to call it a forecast.

Pre-registration: `PREREGISTRATION.md` (committed before this run). Weekly Friday values of the 10-year and 2-year (council-data
`macro/cache.json`), gold's OANDA daily closes; outcome from the next weekday's close (the yields are known by then) to 20
sessions later; 1,033 weeks, 2007 to 2026.

| Class (the rule book's thresholds) | Weeks | Gold, next 20 sessions | Up | Rule book says |
|---|---|---|---|---|
| Rising fast (2 weeks >= +25 bp or 4 weeks >= +50 bp) | 82 | +0.40 % | 52 % | bearish |
| Rising slowly (6 weeks >= +25 bp) | 134 | +0.15 % | 47 % | mild headwind |
| Flat | 620 | +0.42 % | 54 % | no regime |
| Falling slowly | 131 | +0.96 % | 63 % | bullish |
| Falling fast | 66 | +1.45 % | 67 % | bullish after liquidation |
| All weeks | 1,033 | +0.52 % | 55 % | |
| Rising, led by the 2-year | 40 | −0.02 % | 42 % | bearish |
| Rising, 2-year lagging (term premium) | 80 | +0.14 % | 47 % | bullish |

| Test | t (2007-26) | 2007-16 / 2017 on | Holm p | Pass |
|---|---|---|---|---|
| T1 rising fast lower than the rest | −0.23 | +0.24 / −0.57 | 1.00 | no |
| T2 falling slowly higher than the rest | +1.07 | +0.88 / +0.88 | 0.85 | no |
| T3 term premium higher than 2-year-led | +0.18 | −1.90 / +1.69 | 1.00 | no |

Falling yields go with a better month for gold in both halves, which is the table's direction, but at t near 1. A fast rise is
not bearish on this record (+0.40 %, about the average), and the "why is the 10-year moving" split flips sign between the halves.
On the Macro desk the table is a live reading in "Your research, applied" with each class's record beside it; it changes no
score, call or trade.

To repeat: `node research/edge/yield-regime/run.mjs fetch <dir>` (git, no network), then `… run <dir>`.
