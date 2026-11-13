# Diversified time-series momentum portfolio: pre-registration

Written and committed **before** any return below was computed (13 Nov 2026). The rule, the costs, the windows and the pass
bar are fixed here; nothing in them changes after the results are seen. Anything added later is labelled a post-hoc
diagnostic in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes. This is a new stand-alone portfolio
rule, not a change to the gold book (docs/owner-decisions.md item 44 concerns the gold book's 2006-17 window and is not
touched). A pass makes a candidate for a **paper shadow book** that the owner decides on; it is never a live change. A
parallel study of gold-only time-series momentum is on another branch; this one is the multi-market portfolio.

## Why this study

Moskowitz, Ooi & Pedersen (2012, "Time series momentum", JFE) and Hurst, Ooi & Pedersen (2017, "A century of evidence on
trend-following investing", JPM) document that a diversified portfolio holding each futures market long when its trailing
12-month return is positive and short when negative, each position scaled to a constant volatility, earned a positive
risk-adjusted return across asset classes and decades. Earlier studies in this repository found that the Gold trend rule (a
20-day breakout) is not a general trend rule (`trend-breadth-h1`, 0 of 14). That is a different rule. This study tests the
published textbook rule, unchanged, on the OANDA markets the council's daily cache holds.

**What "out of sample" means here.** Moskowitz-Ooi-Pedersen's sample ends in 2009 and Hurst-Ooi-Pedersen's in 2016, so the
confirmation window 2008-17 overlaps the published samples (it is out of THIS repository's sample: no parameter is fitted
here). The window 2018 onward is after both publications and is the only truly post-publication evidence. Both are
reported; the pass bar uses both (below).

## Data

The council's daily candle cache, council-data `research/daily/<key>.json` (complete OANDA mid daily candles in UTC
buckets, full history), copied out of the `council-data` branch with `git show` (`node run.mjs fetch <dir>`, no network;
files stay out of git). Candles dated Saturday or Sunday (the reopen stubs) are folded into the next weekday candle with
`council/fills.mjs` `foldWeekend` (imported).

### Universe (fixed now)

| Class | Keys |
|---|---|
| Metals | xau, xag |
| Equity indices | nas100, spx500, us30, de40, uk100, jp225 |
| Energies | wtico, bco, natgas |
| Bonds | usb10y, de10yb, uk10yb |
| Forex majors | eurusd, gbpusd, usdjpy, audusd, usdcad, usdchf |

20 markets. The rule drops any key whose history starts after 2008-01-01: checked on the files before writing this, every
one of the 20 starts in 2002-2006 (latest: xau and xag, 2006-03-20), so **no key is dropped**. The cache's last candle is
2026-11-06, so the last full month is October 2026.

## The rule (fixed now)

- **Rebalance**: monthly. The decision is made on the **last daily close of each calendar month** (UTC) and executed at the
  **open of the first daily candle of the next month**. Nothing at the decision reads a candle after the month-end close.
- **Signal**: s = sign(C_m / C_{m-12} − 1), with C_m the market's month-end close and C_{m-12} its close at the end of the
  month twelve months earlier (price return of the OANDA mid; no interest is subtracted, see Financing). s = 0 (flat) when
  the return is exactly 0 or either close is missing.
- **Volatility**: an exponentially weighted variance of daily close-to-close simple returns with centre of mass 60 days
  (δ = 60/61, weights (1 − δ) δ^i), around the exponentially weighted mean, annualised with 261; σ = its square root, read at
  the month-end close. A market needs at least 260 daily returns before its first position.
- **Size**: the Moskowitz-Ooi-Pedersen scaling, each market's position targets **40 % annualised volatility** and the
  portfolio is the equal-weight average over the N markets that hold a valid signal that month:
  w_i = s_i × min(0.40 / σ_i, L) / N, as a fraction of equity in notional. **Leverage caps**: per market L = 10 (0.40 / σ
  capped, i.e. σ floored at 4 %); and if Σ|w_i| exceeds 3 (gross notional 3 × equity) every weight is scaled down
  proportionally. No portfolio-level volatility target is added (the published rule has none; with 20 partly correlated
  markets it gives roughly 10-15 % a year; the realised figure is reported).
- **Catastrophe stop (every position has a stop)**: at each month's entry, stop = entry − s × 3 × ATR(20), ATR on daily
  candles up to the month-end close (true range, simple 20-day mean). Checked on every daily candle of the month: an open at
  or past the stop exits at the open (gap), else a low (long) or high (short) at or past the stop exits at the stop. The stop
  never moves within the month. A stopped market is flat until the next rebalance, where it is decided afresh.
- **Stale data**: a market whose last candle is more than 5 calendar days before the month-end decision is flat that month.

### Daily accounting

Equity is a constant 1 (returns are summed, not compounded; leverage is fixed by the weights each month). For a market held
with weight w from the rebalance open: the first day earns w × (close / open − 1); later days w × (close / previous close −
1); a stop day w × (exit / previous close − 1) (or / open on the first day); the last day before the next rebalance ends at
that day's close and the change of position happens at the next open (the gap close → open is earned by the OLD position:
w × (next open / last close − 1) is booked on the rebalance day before the new weight starts). Returns are booked on the
UTC day they happen; a month's return is the sum of its days.

## Costs (fixed now; conservative)

**Trading**: a one-way cost of half the round trip below, charged on every change of notional |Δw| (at each rebalance,
at a stop exit, at the re-entry after a stop). Round trips as a fraction of price, set conservatively above the demo broker's
measured quotes in council-data `ctrader/symbols.json` of 12-13 Nov 2026 (EUR/USD quoted spread about 0 plus commission
0.45 bp; NAS100 0.8 points ≈ 0.3 bp; XAUUSD median spread $0.07 plus commission ≈ 0.4 bp) and at the levels the earlier
breadth studies used (`trend-breadth` `COST`):

| Class | Round trip |
|---|---|
| Forex majors | 2 bp (0.0002) |
| Equity indices | 3 bp (0.0003) |
| Gold | 3 bp (0.0003) |
| Silver | 10 bp (0.001) |
| WTI, Brent | 10 bp (0.001) |
| Natural gas | 20 bp (0.002) |
| Bonds (OANDA bond CFDs) | 10 bp (0.001) |

**Financing**:

- **Gold longs**: `council/fills.mjs` `FIN.xau.long` (0.000148 of price a rollover, the demo broker's measured rate, imported)
  times the rollovers `nights` (imported: Monday-Friday 22:00 UTC, Wednesday three) inside each day held, on the notional
  |w|. **Gold shorts**: `FIN.xau.short` = 0 (the broker credits a short; nothing is credited here).
- **Every other market, both sides (assumed, not measured)**: a broker markup of **2.5 % a year** on notional, charged per
  rollover at 0.025 / 365 = 0.0000685 of notional (same `nights` count). This stands for the markup a CFD broker adds over
  the interest it passes through. **Not modelled**: the interest differential itself (forex carry, the cash rate charged on a
  long index or commodity CFD and credited on a short, index dividends). A futures-based TSMOM earns an excess return in
  which carry is embedded; the OANDA mid price is spot, so this study's return is "spot price return less a markup", which
  is the futures excess return plus the carry the positions would have paid or earned. Said plainly in the result; the
  verdict is decided on the figures with the costs above.
- Sensitivities reported, never deciding: costs × 2 (trading and financing), and no financing at all.

## Windows and statistics

- **Confirmation**: months 2008-01 to 2017-12 (120 months).
- **Post-publication**: months 2018-01 to 2026-10, reported apart.
- Statistics on **monthly portfolio returns** (sum of daily): mean, sd, **Sharpe = mean / sd × √12**, **t = mean / (sd / √n)**,
  annualised return and volatility, worst drawdown of the cumulative monthly sum (and of the cumulative daily sum),
  share of positive months, gross leverage mean, the number of stop exits.
- **Per asset class**: each class's contribution (the sum of its markets' daily returns inside the portfolio, same weights),
  its mean a month, total, and its own Sharpe and t, in both windows. Descriptive.
- **Crisis months**, descriptive: 2008-09 to 2008-12, 2020-02 to 2020-04, and every month of 2022, portfolio and per class.

## Verdict (fixed now)

**PASS** only when all three hold:

1. Confirmation 2008-17: annualised Sharpe of monthly returns **> 0.4**, and
2. Confirmation 2008-17: **t ≥ 2** (on 120 months this needs Sharpe ≥ about 0.63), and
3. Post-publication 2018-01 to 2026-10: total return **> 0**.

Otherwise **FAIL**. One test, no multiple-test correction. A FAIL means the textbook rule on these markets, with these costs,
did not meet the bar; it does not say trend following never works anywhere. A PASS is not called an edge in the council
until it has a forward paper record, and would be offered to the owner only as a paper shadow book (proposal in
`research/proposals/`), never live.

## Tests

`tests/tsmom-portfolio.test.mjs` (offline, hand-made candles): the signal, the EWMA volatility, the scaling and caps, the
catastrophe stop (gap and touch), the monthly rebalance and the no-look-ahead property (changing every candle after a
decision leaves the decision unchanged), and that RESULT.md quotes result.json.

## To repeat

`node research/edge/tsmom-portfolio/run.mjs fetch <dir>` then `node research/edge/tsmom-portfolio/run.mjs full <dir>`.
