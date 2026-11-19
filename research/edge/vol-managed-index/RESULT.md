# Result: volatility-managed exposure on equity index CFDs (14 Nov 2026)

**Verdict: FAIL, 0 of 3 tests pass: net of CFD costs, volatility scaling lowers the Sharpe ratio on the S&P 500 and on the four indices pooled.**

The bar is the pre-registered one (PREREGISTRATION.md, committed alone before any number was computed). After CFD costs, scaling a long index position by 1 / sigma20² (B) or 1 / sigma20 (C) gives a LOWER Sharpe ratio
than holding 1x (A), in both windows, on the S&P 500 and on the four indices pooled. It does cut the worst drawdown by about a
third. The one exception is the Nasdaq 100, where C is slightly ahead of A net (0.64 against 0.61 decisive, 0.45 against
0.41 replication). It is not tested, and the DAX and Dow go the other way.

Paper research only. Nothing live changed. Gold was not read; this is not a test on the gold book (owner decision 44). The
positions are portfolio weights from one daily close to the next, not trades with a stop. A stop rule does not apply to this
comparison, and any live use would need a stopped execution and the owner's approval. This study proposes none.

## The tests (decisive window 1 Jan 2016 to 6 Nov 2026, net of 0.04 % a unit of weight change and financing at DGS2 + 2.5 %)

| Test | Sharpe gain, decisive | Sharpe gain, replication | Gain at 2x cost | p (block bootstrap) | p Holm | p (Jobson-Korkie, Memmel) | Max drawdown, managed vs A | Pass |
|---|---|---|---|---|---|---|---|---|
| T1 spx500 B − A | −0.163 | −0.139 | −0.206 | 0.749 | 1.000 | 0.753 | −22.3 % vs −33.6 % | no |
| T2 spx500 C − A | −0.097 | −0.049 | −0.128 | 0.716 | 1.000 | 0.721 | −19.9 % vs −33.6 % | no |
| T3 pooled B − A | −0.142 | −0.098 | −0.187 | 0.730 | 1.000 | 0.739 | −23.0 % vs −33.8 % | no |

The p-values are one-sided (H1: the managed strategy has the higher Sharpe ratio). The bootstrap is paired and circular, with
21-day blocks, 5,000 draws and a fixed seed. Only the drawdown check passes on all three tests. The Sharpe gain is negative in
both windows and stays negative at 2x cost.

**Placebo** (spx500, decisive window, sigma20 shuffled in 21-day blocks, 40 seeds, c refitted). B's placebo gains averaged
−0.136 (range −0.511 to +0.324), and 21 of 40 were at least the real −0.163. C's averaged −0.091 (range −0.388 to +0.254), and
21 of 40 were at least the real −0.097. So the real volatility series does no better than a shuffled one. The timing of
exposure by volatility carries no information here beyond what any reshuffling of the same weights does.

## Per market, strategy and window (net of costs)

Annual return is compound over the window. The B-oos and C-oos rows use the c fitted on the replication window and applied
unchanged to the decisive window; the w column gives their average decisive weight.

| Market | Window | Strategy | Sharpe | Sortino | Max drawdown | Annual return | Calmar |
|---|---|---|---|---|---|---|---|
| spx500 | decisive | A | 0.47 | 0.66 | −33.6 % | +7.1 % | 0.21 |
| spx500 | decisive | B | 0.31 | 0.40 | −22.3 % | +3.3 % | 0.15 |
| spx500 | decisive | C | 0.37 | 0.49 | −19.9 % | +4.2 % | 0.21 |
| spx500 | decisive | B-oos (w 1.07) | 0.31 | | −23.8 % | +3.5 % | |
| spx500 | decisive | C-oos (w 1.06) | 0.38 | | −21.2 % | +4.5 % | |
| spx500 | replication | A | 0.19 | 0.27 | −59.8 % | +1.9 % | 0.03 |
| spx500 | replication | B | 0.05 | 0.07 | −33.8 % | −0.2 % | −0.01 |
| spx500 | replication | C | 0.14 | 0.19 | −39.8 % | +1.0 % | 0.03 |
| nas100 | decisive | A | 0.61 | 0.86 | −39.1 % | +12.0 % | 0.31 |
| nas100 | decisive | B | 0.61 | 0.82 | −21.5 % | +10.0 % | 0.47 |
| nas100 | decisive | C | 0.64 | 0.87 | −27.4 % | +10.7 % | 0.39 |
| nas100 | decisive | B-oos (w 0.93) | 0.61 | | −20.1 % | +9.4 % | |
| nas100 | decisive | C-oos (w 0.96) | 0.64 | | −26.3 % | +10.4 % | |
| nas100 | replication | A | 0.41 | 0.59 | −56.0 % | +6.9 % | 0.12 |
| nas100 | replication | B | 0.34 | 0.47 | −34.3 % | +4.5 % | 0.13 |
| nas100 | replication | C | 0.45 | 0.62 | −35.4 % | +6.4 % | 0.18 |
| us30 | decisive | A | 0.37 | 0.52 | −36.1 % | +5.1 % | 0.14 |
| us30 | decisive | B | 0.21 | 0.28 | −38.4 % | +1.9 % | 0.05 |
| us30 | decisive | C | 0.30 | 0.41 | −29.9 % | +3.2 % | 0.11 |
| us30 | decisive | B-oos (w 1.05) | 0.20 | | −39.6 % | +1.9 % | |
| us30 | decisive | C-oos (w 1.03) | 0.30 | | −30.7 % | +3.2 % | |
| us30 | replication | A | 0.16 | 0.23 | −56.8 % | +1.3 % | 0.02 |
| us30 | replication | B | −0.03 | −0.03 | −34.8 % | −1.1 % | −0.03 |
| us30 | replication | C | 0.07 | 0.09 | −39.5 % | 0.0 % | 0.00 |
| de40 | decisive | A | 0.26 | 0.35 | −43.9 % | +3.2 % | 0.07 |
| de40 | decisive | B | −0.03 | −0.04 | −49.4 % | −1.7 % | −0.03 |
| de40 | decisive | C | 0.07 | 0.09 | −40.7 % | −0.1 % | 0.00 |
| de40 | decisive | B-oos (w 1.28) | 0.03 | | −52.9 % | −1.3 % | |
| de40 | decisive | C-oos (w 1.18) | 0.09 | | −44.6 % | 0.0 % | |
| de40 | replication | A | 0.36 | 0.51 | −58.6 % | +5.8 % | 0.10 |
| de40 | replication | B | 0.29 | 0.40 | −37.7 % | +3.7 % | 0.10 |
| de40 | replication | C | 0.33 | 0.45 | −43.0 % | +4.5 % | 0.10 |
| pooled | decisive | A | 0.47 | 0.66 | −33.8 % | +7.1 % | 0.21 |
| pooled | decisive | B | 0.33 | 0.44 | −23.0 % | +3.6 % | 0.16 |
| pooled | decisive | C | 0.40 | 0.54 | −24.1 % | +4.7 % | 0.19 |
| pooled | replication | A | 0.30 | 0.43 | −56.9 % | +4.2 % | 0.07 |
| pooled | replication | B | 0.21 | 0.28 | −27.6 % | +1.9 % | 0.07 |
| pooled | replication | C | 0.29 | 0.39 | −36.1 % | +3.2 % | 0.09 |

The windows are: replication from 25 Apr 2003 (the first day with a 20-return sigma) to 31 Dec 2015; decisive from 1 Jan 2016
to 6 Nov 2026.

## Where the Sharpe goes

- **Costs and financing.** B changes its weight about 14-16 units a year, which costs about 0.6 % a year at 0.04 %. C changes
  about 10 units, about 0.4 % a year. Financing costs all three about 4.5-5.2 % a year on an average weight of 1. Because B
  and C have a lower volatility than A for the same financing drag, the same drag costs them more Sharpe.
- **Before any cost** (post hoc, not part of the bar), the gain is small and not consistent. These are Sharpe ratios of the
  gross return; A is gross of financing too, so they are not excess returns.

  | Window | Market | A | B | C |
  |---|---|---|---|---|
  | decisive | spx500 | 0.75 | 0.72 | 0.77 |
  | decisive | nas100 | 0.83 | 0.91 | 0.93 |
  | decisive | us30 | 0.66 | 0.64 | 0.72 |
  | decisive | de40 | 0.52 | 0.35 | 0.42 |
  | replication | spx500 | 0.42 | 0.46 | 0.52 |
  | replication | nas100 | 0.62 | 0.64 | 0.73 |
  | replication | us30 | 0.41 | 0.40 | 0.46 |
  | replication | de40 | 0.55 | 0.59 | 0.61 |

  C is ahead of A gross on seven of eight market-windows, by 0.02-0.11 Sharpe. A CFD's spread and daily financing take
  that away.
- **The 2x cap binds.** B sits at 2x on 12-19 % of days and C on 2-4 %. The average weight is held at 1, so B is levered in
  calm stretches and cut in volatile ones. On the DAX that lost money in both windows.
- **What the papers would predict.** The result matches Harvey et al. (2018): for equities, volatility scaling mainly cuts
  drawdowns and tails, and the Sharpe gain is small and sensitive to costs. It does not reproduce Moreira and Muir's Sharpe
  gain on these CFD prices net of CFD costs.

## Caveats, said plainly

- **Rate history.** Financing uses the weekly US 2-year yield (`DGS2` from council-data `macro/cache.json`) as a stand-in for
  an overnight rate. It is a 2-year yield, not an overnight rate. Before 6 Jan 2006 there is no value, so a fixed 4 % stands
  in: 699 return days of the spx500 replication window (682 on us30, 693 on de40). The DAX is financed at the same US rate,
  though a euro CFD is financed at a euro rate. That overstates its financing in the years of near-zero or negative euro rates.
- **Cost charging.** The full round-trip cost is charged on every change of weight, which is conservative. Even before any
  cost the gain is not significant: it is small, mixed in sign and not tested.
- Only the pre-registered lookback (20 days), cap (2x) and markets were run. Nothing else was tried.

To repeat: `node research/edge/vol-managed-index/run.mjs` (reads council-data with `git show`, no network; writes
`result.json`). Tests: `tests/vol-managed-index.test.mjs`.
