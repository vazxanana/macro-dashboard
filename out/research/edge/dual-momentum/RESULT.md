# Dual momentum, gold against US stocks against cash: result

**Verdict: FAIL.** Neither lookback passes the pre-registered bar. On the decisive window (2016 to 6 Nov 2026, 131 months)
the 12-month rule's Sharpe is 0.36 against the 50/50's 0.65; the paired 6-month block bootstrap puts the rule ahead in
11.3 % of draws (P 0.1125, bar 0.9); its worst drawdown is 28.5 % against 21.3 %. The 6-month variant: Sharpe 0.41, P 0.095,
drawdown 23.1 %. Both beat the 50/50 on the 2008-15 check (Sharpe 0.28 and 0.44 against 0.08), so the sign flips between the
windows. Not an edge; no proposal is written; nothing live changed.

Paper research only. This is a stand-alone monthly allocation rule (SPX500 / gold / flat), **not** a test, gate, size or exit
of the gold book: owner decision 44 is untouched. Pre-registration: `PREREGISTRATION.md` (committed alone, before any return
was computed). Source: G. Antonacci (2014), *Dual Momentum Investing*. Fifth monthly timing rule of 13 Nov 2026; the other
four (`sma10-timing`, `gold-tsmom`, `tsmom-portfolio`, `vol-managed`) also failed, and their cost and financing conventions
are copied here.

## Data

OANDA mid daily candles (council-data `research/daily/spx500.json`, `xau.json`, weekends folded with `foldWeekend`), put on
the 5,348 dates both markets have (2006-03-20 to 2026-11-06); 2Y yield from `macro/cache.json` `score.fred.DGS2`. Costs as
pre-registered: a full spread each side (SPX500 0.5, gold $0.30), financing every rollover night (gold `FIN.xau.long`,
SPX500 DGS2 + 2.5 % a year), cash while flat earns 0.

## Results (after every cost)

| Window | Series | CAGR | Sharpe | Max drawdown |
|---|---|---|---|---|
| W2 2016-now (decisive) | Dual momentum, 12 months | 4.17 % | 0.36 | 28.5 % |
| | Dual momentum, 6 months | 4.86 % | 0.41 | 23.1 % |
| | 50/50 rebalanced monthly | 7.73 % | 0.65 | 21.3 % |
| | SPX500 buy-and-hold | 7.09 % | 0.48 | 33.6 % |
| | Gold buy-and-hold | 7.19 % | 0.50 | 32.5 % |
| W1 2008-15 (check) | Dual momentum, 12 months | 3.14 % | 0.28 | 38.5 % |
| | Dual momentum, 6 months | 5.35 % | 0.44 | 21.6 % |
| | 50/50 rebalanced monthly | 0.07 % | 0.08 | 36.0 % |
| | SPX500 buy-and-hold | 0.97 % | 0.15 | 56.3 % |
| | Gold buy-and-hold | -2.37 % | -0.02 | 56.4 % |

Pass checks (W2 Sharpe above the 50/50; Holm over the two lookbacks, p = 1 - P at a family level of 0.10; W2 drawdown not
deeper; W1 Sharpe above the 50/50):

| Lookback | W2 Sharpe | P (bootstrap) | Holm | W2 drawdown | W1 Sharpe | Pass |
|---|---|---|---|---|---|---|
| 12 months | no | 0.1125 | no (p 0.8875) | no | yes | no |
| 6 months | no | 0.095 | no (p 0.905) | no | yes | no |

n and t: W2, 12 months: 41 positions (19 SPX500, 22 gold), 34 ended by the catastrophe stop, in SPX500 34.5 % / gold 40.3 % /
flat 25.2 % of days; monthly return minus the 50/50's -0.26 % a month, t -0.95 over 131 months. 6 months: 48 positions,
-0.20 % a month, t -0.76. W1, 12 months: 33 positions, +0.28 % a month, t 0.86 (96 months).

## Reading

- On 2016-now both assets rose about as much as each other (CAGR 7.1-7.2 % after financing) with a low correlation, so
  holding both beat picking one: the 50/50 had the best Sharpe and the shallowest drawdown of every series. The rule spent a
  quarter of the days in cash earning nothing, and its 3 x ATR(20) stop, checked daily, ended most positions early (34 of 41).
- On 2008-15 the rule looked better than the 50/50, but that window is where the 50/50 itself made almost nothing; the
  advantage did not carry into the decisive window.
- Dividend sensitivity (1.8 % a year credited while long SPX500, to every series): W2 Sharpe 0.40 (12 months) and 0.47
  (6 months) against 0.73 for the 50/50; the verdict does not change.
- The `cash = 0` choice understates the rule in flat months; crediting the 2Y yield in those months (about a quarter of
  the time, mean yield near 2 %) would add roughly 0.5 % a year, far short of the 3.6 % gap to the 50/50 (post hoc remark,
  not computed).

To repeat: `node research/edge/dual-momentum/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/dual-momentum/run.mjs full <dir>`. Tests: `tests/dual-momentum.test.mjs`.
