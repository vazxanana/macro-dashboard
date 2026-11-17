# Diversified time-series momentum, a CFD portfolio: pre-registration

Written and committed **alone, before any return, signal or portfolio figure was computed** (17 Nov 2026). Everything that
decides the verdict is fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, Trader, config, mirror, ICT or council file changes, whatever the outcome. This study
does not touch the gold book's systems (owner decision 44): it tests a different, portfolio-level rule on many markets. A
PASS would make it a candidate for a **paper shadow only**; the owner decides. A portfolio of about 38 CFDs is not something
the council trades today.

## Why

Time-series momentum across asset classes (each market long or short on the sign of its own past 12-month return, sized by
inverse volatility, held as one diversified book) is the best documented systematic return in the published literature
(managed-futures style). The repository has never tested it as a portfolio: `trend-breadth` / `trend-breadth-h1` tested the
gold breakout rule market by market (0 of 14), which is a different rule (a breakout with a trailing stop, judged one market
at a time). The published evidence is on futures (excess returns, carry inside the price) over decades; this study asks
whether it survives on the council's own OANDA CFD candles, after a CFD broker's spread and overnight financing, in the
recent years.

## What was seen before this was written

- `council-data` `research/daily/_index.json`: each key's class, row count, first and last candle date. No price was read.
- `council-data` `ctrader/symbols.json`: the demo broker's quoted spreads and commissions (gold, five forex majors, four US
  indices) of 12-17 Nov 2026, for the cost table below.
- `council-data` `macro/cache.json`: that `score.fred.DGS2` is a weekly 2-year Treasury yield series from 6 Jan 2006 to now.
- The XAU daily file's first rows (to learn the file shape: `rows` = `[t, o, h, l, c, v]`, a Sunday stub row exists).

## Data

`git show origin/council-data:research/daily/<key>.json` (OANDA mid daily candles, UTC days; no network). **Candles dated
Saturday or Sunday (UTC) are dropped** (OANDA's short weekend stubs; Monday's return then runs from Friday's close). No other
cleaning: no price is edited or removed. The ten largest absolute daily returns of every market are listed in the result.

## Universe (fixed list, 38 markets)

Rule: the six classes named below, the cache's own `group`, first candle on or before 2006-12-31, and not a cross, exotic or
duplicate.

| class | keys |
|---|---|
| metals (5) | `xau xag xcu xpt xpd` |
| indices (13) | `au200 ch20 de40 eu50 fr40 hk33 jp225 nas100 spx500 uk100 us2000 us30 sg30` |
| energies (3) | `bco wtico natgas` |
| bonds (6) | `usb02y usb05y usb10y usb30y de10yb uk10yb` |
| ags (4) | `corn wheat soybn sugar` |
| forex majors (7) | `eurusd gbpusd audusd nzdusd usdjpy usdcad usdchf` |

Left out: `xaueur xaugbp xauxag` (gold in another currency or a ratio: duplicates of gold); the 21 forex crosses (linear
combinations of the majors) and 9 exotics (their returns are dominated by interest differentials this model cannot charge,
see financing); `cn50 es35 in50 nl25` (history starts after 2006; `in50` also stops in 2022). Gold and silver start March
2006 and join the portfolio when eligible (below), like every market.

## The rule (primary spec, P12-1)

- **Rebalance day** of month m = the first date in month m on which at least one universe market has a candle (the union
  calendar). Trades are made at each market's close on that date (if a market has no candle that date, at its next close:
  its position simply takes effect then).
- **Information set:** only closes strictly before the rebalance day.
- **Signal:** `s = sign(C(end of month m-2) / C(end of month m-13) - 1)`, where `C(end of month x)` = the market's last close
  dated in month x (12-month return skipping the last month). s = 0 if the return is exactly 0.
- **Eligible** at month m: the market has a close in month m-13 and in month m-2, at least 61 closes before the rebalance day,
  and a close within the 10 calendar days before it. Otherwise its weight is 0 that month.
- **Volatility:** `σ` = standard deviation of the last 60 daily log returns (close to close, closes strictly before the
  rebalance day) × √252.
- **Market weight:** `w = s × min(0.10 / σ, 4) / N`, where N = number of eligible markets that month (equal risk across
  markets, each targeted at 10 % a year, notional capped at 4x its share).
- **Portfolio scale:** `k = clamp(0.10 / σ_p, 0.25, 8)`, where σ_p = standard deviation × √252 of the unscaled portfolio's
  daily gross returns (`Σ w_i r_i` with the weights in force each day, k = 1) over the last 252 union days before the
  rebalance day; with fewer than 126 such days, k = 1 (only at the very start). The position in market i is `k × w`
  (notional as a fraction of equity).
- **Daily return:** the portfolio's return on a union day = `Σ_i k w_i r_i`, `r_i` = the market's simple close-to-close
  return since its previous close (0 on a day it has no candle). The month's result is the sum of its days' returns minus
  that month's costs and financing (additive, in % of equity; months are labelled by the rebalance month m and run until the
  next rebalance day).

### Secondary specs (reported, Holm-corrected, cannot change the verdict)

- **P3:** signal = sign of the return from end of month m-4 to end of month m-1 (3 months, no skip).
- **P6:** signal = sign of the return from end of month m-7 to end of month m-1 (6 months, no skip).

Everything else identical. Holm over the three specs' out-of-sample one-sided p-values (t-distribution, n - 1 df).

## Costs (fixed, per market, round trip as a fraction of the price)

Each rebalance pays `|k w_new - k w_old| × cost / 2` (half a round trip per unit of notional traded; a market leaving or
entering the eligible set trades to or from 0). Figures are at least the demo broker's measured all-in round trip where one
exists (`ctrader/symbols.json`, 12-17 Nov 2026), else a conservative figure stated here:

| markets | round trip | basis |
|---|---|---|
| `eurusd gbpusd audusd nzdusd usdjpy usdcad usdchf` | 0.06 % | measured 0.045 % (commission; spread median 0) |
| `xau` | 0.06 % | measured about 0.04 % (median spread $0.06 + 0.0024 % commission) |
| `nas100 spx500 us30 us2000` | 0.03 % | measured 0.003-0.011 % |
| other indices | 0.06 % | not measured, assumed |
| `xag` | 0.10 % | `gold-drd-silver`'s $0.03 at about $30 |
| `xcu` | 0.15 % | not measured, assumed |
| `xpt` | 0.30 % | `gold-drd-pgm` |
| `xpd` | 0.20 % | `gold-drd-pgm` |
| `bco wtico` | 0.10 % | not measured, assumed |
| `natgas` | 0.20 % | not measured, assumed |
| bonds | 0.08 % | not measured, assumed |
| ags | 0.20 % | not measured, assumed |

Today's figures are used for every past year (said in RESULT.md: spreads were wider years ago, so the replication window's
costs are understated).

## Overnight financing (fixed, as a CFD broker charges it)

Charged daily on the notional held, for the calendar days between two union closes (weekends count, as a CFD's Wednesday
triple does), at an annual rate / 365:

- **Every class but forex:** a long pays `r + 2.5 %`; a short pays `2.5 % - r` (a credit when r > 2.5 %). `r` = FRED `DGS2`
  (2-year Treasury, weekly, from `macro/cache.json` `score.fred`) as of the last value on or before the day, floored at 0;
  before 6 Jan 2006 the first value (4.36 %) is used. The same US rate for every currency (non-USD markets would pay their
  local rate: an assumption, said in RESULT.md, and a 2-year yield is not an overnight rate).
- **Forex majors:** both sides pay a 1.0 % markup a year; the interest differential is NOT charged or credited (it is not in
  the spot price either and no foreign rate history is at hand). So forex is measured on spot moves alone, without carry:
  said in RESULT.md.
- Commodity and bond CFDs priced off futures may already contain roll steps or carry in the price; the rule above is still
  applied (stated limitation).

## Windows and statistic

- **Replication** 2005-01 → 2019-12 (180 months), **in sample** 2020-01 → 2023-12 (48), **out of sample** 2024-01 → 2026-10
  (34; November 2026 is incomplete and left out). The rule has no parameter fitted here (it is taken from the literature), so
  "in sample" only names the repository's convention; the published studies' own samples do overlap the replication years.
- Statistic: monthly net portfolio return (% of equity). Per window: n months, mean, t (mean / (sd / √n)), annualised Sharpe
  (mean / sd × √12), maximum drawdown of the cumulative (additive) monthly sum, and the same gross of costs and financing.
- **PASS** (primary spec only) = out-of-sample net mean > 0 with t ≥ 2, AND in-sample net mean > 0, AND replication net mean
  > 0, AND out-of-sample net mean > 0 at 2x costs and 2x financing markups. Otherwise **FAIL**. 34 out-of-sample months make
  t ≥ 2 a high bar (it needs an annualised Sharpe of about 1.2 in that window); this is said in RESULT.md either way.
- Reported, not part of the verdict: by asset class (each class's contribution to the portfolio's monthly net return, mean
  and t per window), cost and financing as shares of gross, average gross leverage, average N, Newey-West t (lag 3), the
  secondary specs with Holm, and the result with financing set to 0.

## Files

`run.mjs` (`node research/edge/tsmom-portfolio/run.mjs fetch <dir>` reads the 38 files and the rate series from
`origin/council-data` with `git show`; `node … run <dir>` writes `result.json` and prints the tables), `RESULT.md`,
`result.json` (`verdict`). Test: `tests/tsmom-portfolio.test.mjs` (the signal and volatility use only closes before the
rebalance day, proven by changing every later price; the report's figures equal `result.json`).
