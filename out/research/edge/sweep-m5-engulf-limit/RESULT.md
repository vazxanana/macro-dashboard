# M15 sweep of the Asia range or the previous day, limit at an M5 engulf back inside (result)

**Verdict: FAIL. 0 of 8 cells pass; the best, day london far, made -0.121R a trade after costs in 2015-26 (n 3,152, month t -2.56; before costs -0.017R; discovery -0.146R after costs, n 2,548, month t -2.96).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed, no rule is
proposed. Five markets pooled (xau, eurusd, gbpusd, usdjpy, audusd), OANDA mid 5-minute candles, windows by fill time: discovery
2005-01-01 to 2014-12-31, confirmation 2015-01-01 to 2026-10-31. R a trade; t = the t of calendar-month sums (every month of the
window, empty months 0). Costs: the shared round trips of `edgekit` `COSTS`, charged as cost / risk.

## Cells

| cell | disc n | disc before | disc after | disc t after | conf n | conf win | conf before | conf after | conf t before | conf t after | Holm p | pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| asia london 2R | 6,303 | +0.073 | -0.024 | -1.23 | 7,652 | 35 % | +0.031 | -0.075 | 1.92 | -4.71 | 1.000 | no |
| asia london far | 5,664 | +0.079 | -0.024 | -0.87 | 6,883 | 26 % | +0.042 | -0.071 | 1.65 | -2.84 | 1.000 | no |
| asia ny 2R | 5,130 | +0.025 | -0.055 | -2.95 | 6,158 | 35 % | +0.001 | -0.087 | 0.07 | -4.98 | 1.000 | no |
| asia ny far | 4,164 | -0.026 | -0.113 | -4.07 | 5,014 | 27 % | -0.021 | -0.121 | -0.77 | -4.37 | 1.000 | no |
| day london 2R | 2,569 | -0.001 | -0.087 | -3.00 | 3,187 | 33 % | -0.021 | -0.124 | -0.90 | -5.14 | 1.000 | no |
| day london far | 2,548 | -0.059 | -0.146 | -2.96 | 3,152 | 18 % | -0.017 | -0.121 | -0.37 | -2.56 | 1.000 | no |
| day ny 2R | 2,889 | +0.020 | -0.052 | -2.10 | 3,677 | 34 % | -0.031 | -0.113 | -1.34 | -4.90 | 1.000 | no |
| day ny far | 2,819 | +0.030 | -0.043 | -0.93 | 3,564 | 23 % | -0.034 | -0.118 | -0.92 | -3.20 | 1.000 | no |

The bar: n >= 300 in each window, mean R after costs > 0 with month t >= 2 in both windows, Holm p < 0.05 over the 8 cells.

## Funnel (orders with their stop on the losing side, all dates loaded)

| market | first candle | orders | risk under the cost | 2R trades filled in the windows |
|---|---|---:|---:|---:|
| xau | 2006-03-19 | 8,960 | 9 | 7,540 |
| eurusd | 2005-01-02 | 9,982 | 0 | 8,298 |
| gbpusd | 2005-01-02 | 10,132 | 0 | 8,432 |
| usdjpy | 2005-01-02 | 7,780 | 0 | 6,542 |
| audusd | 2005-01-02 | 8,063 | 1 | 6,753 |

## The best cell by market (day london far)

| market | disc n | disc after | conf n | conf before | conf after | conf t after |
|---|---:|---:|---:|---:|---:|---:|
| xau | 380 | -0.166 | 531 | -0.077 | -0.248 | -2.40 |
| eurusd | 588 | -0.068 | 710 | -0.159 | -0.236 | -3.00 |
| gbpusd | 611 | -0.192 | 794 | +0.062 | -0.013 | -0.15 |
| usdjpy | 493 | -0.261 | 529 | -0.020 | -0.135 | -1.16 |
| audusd | 476 | -0.047 | 588 | +0.102 | -0.000 | -0.00 |

## Planned reward of the `far` cells (median, in R)

- asia london far: 3.19R (n 12,547)
- asia ny far: 2.87R (n 9,178)
- day london far: 7.54R (n 5,700)
- day ny far: 6.12R (n 6,383)

## Reading

Before costs 3 of 8 cells are above zero in 2015-26 and after costs 0 of 8. The best cell by its confirmation month t after costs is day london far: -0.017R before and -0.121R after costs (n 3,152, month t -2.56, Holm p 1.000); in discovery -0.059R before and -0.146R after costs (n 2,548, month t -2.96). No cell clears the pre-registered bar. The limit at the engulf zone does not turn the sweep into a rule that survives costs in both windows. Nothing is tuned after this result.

## Limits

- OANDA mid candles: a limit is filled when the mid trades to it; a real fill needs the bid / ask to reach it, so the fill rate is
  flattered. Costs are today's round trips charged on every year.
- No data-quality exclusion list is applied (pre-registered).
- Five markets pooled; trades of one sweep in the `2R` and `far` cells, and of the Asia and day levels when they coincide, are not independent.
- One run, no variants. A paper study: never an edge by itself.
