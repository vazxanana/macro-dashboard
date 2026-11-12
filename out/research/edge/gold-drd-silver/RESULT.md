# Result: the playbook's weekly-bull daily rejection long and its two Daily-regime cuts, on silver (12 Nov 2026)

**Verdict: PASS on the pre-registered bar, and not robust.** All three tests pass as registered (mean net R > 0, Holm-adjusted
p < 0.05, PF > 1 in both 2006-19 and 2020-now). But the bar's t treats overlapping trades as independent, which the
pre-registration named as a caveat: counted once a month, t falls to 1.15-1.43, and without 2025 alone each stream's t is
about 1. Read it as "the rule carries over to silver in sign, and the two cuts help there too", not as a proven edge.

OANDA mid H1 XAG/USD, 20 March 2006 to 12 November 2026, buffer $0.004 under the signal day's low, $0.03 a round trip, 3R,
10 days, each signal its own trade.

| Silver | n | R a trade, net | PF | t | Worst drawdown | 2006-19 PF | 2020-now PF | Holm p | Monthly-sum t | Without 2025 |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 every signal | 1146 | +0.097 | 1.14 | 1.90 | -107.4R | 1.07 | 1.27 | 0.029 | 1.15 | +0.039R, t 0.75 |
| T2 ER20 >= 0.3 | 450 | +0.176 | 1.28 | 2.24 | -49.3R | 1.16 | 1.48 | 0.025 | 1.29 | +0.089R, t 1.11 |
| T3 ER20 >= 0.2 and up over 20 days | 531 | +0.186 | 1.29 | 2.52 | -54.1R | 1.19 | 1.46 | 0.018 | 1.43 | +0.097R, t 1.30 |

- **The selection does more on silver than on gold**: every bullish-week day loses -0.254R a trade on silver (3,261 trades),
  so the closing-strength condition is worth +0.35R a trade there (lift t 2.96; on gold +0.10R, t 1.58). Part of that is cost:
  with a smaller buffer the baseline's stops are tighter and $0.03 weighs more.
- **The cuts halve the drawdown again**: -107R every signal, -49R with ER20 >= 0.3, -54R with the signed cut, as on gold.
- **The profit is concentrated**: 2025 gave +69.6R of T1's +110.7R and +43.4R of T2's +79.3R. 2013-15, 2017-19, 2021 and 2023
  lost, as gold's same rule did in its sideways years.
- Not tested, reported: ER20 >= 0.2 (661 trades, +0.130R, PF 1.20, t 1.90, -76.7R).

What it means: the two cuts chosen on gold behave the same way on a market they were not chosen on, which is evidence they are
not pure curve-fit; the size of the edge is small and rests on overlapping trades and one strong year. It is not a council rule
and nothing live changed. A next step, if the owner wants one, would be its own pre-registration with one position at a time
(no overlap) on gold and silver together, judged on monthly sums.

To repeat: `node --use-env-proxy research/edge/gold-drd-silver/run.mjs fetch <dir>` (about 125,000 H1 candles, kept out of git),
then `node research/edge/gold-drd-silver/run.mjs full <dir>`. Tests: `tests/gold-drd-silver.test.mjs`.
