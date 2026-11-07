# Portfolio v2: walk-forward weighting of every council stream with a long history (pre-registration)

Paper research only. Nothing here changes a live rule, a size, a filter or the cTrader mirror. The owner decides.

Written and committed **before** any portfolio number is computed. The single-stream results below are already public
(#508, #511, #512, #526, #530); what has not been computed is any monthly series, correlation, weight or portfolio.

## Question

The council now runs (live or as paper shadows) a dozen streams. Every one that has been tested on long, untouched history
turned out regime-bound. Does putting them together help?

1. Does any walk-forward weighting (weights set only from data before each year) beat plain equal risk?
2. Is the combined book an edge on its own (t ≥ 2 on monthly R, both halves positive, survives 2x costs)?
3. How much of the book is just long gold / long Nasdaq beta?

## Streams (one row each, net R per position at the stream's live sizing, 1R = one unit of risk)

| id | stream | status | source of the per-trade history | coverage used |
|---|---|---|---|---|
| `ict_a` | ICT A-setups (GC, NQ, ES, YM; no RTY: no free history) | live | `ict/tracker.mjs` signals + `ict/replay.mjs simulate`, unchanged, over OANDA 5m mid (the #526 harness and cache), net = size × (R − cost/risk), #526 costs | 2007-07 .. 2026-10 |
| `ict_dip` | ICT shadow 'dip' (NQ/ES gold-rule buys after a 20-day fall) | shadow | same harness, `isDip`, size 1, gold exit, own one-open rule (as `ict/replay.mjs`) | same |
| `ict_nofri` | ICT shadow 'nofri' (A-setups, no NY Friday) | shadow | same harness, `variantRule('nofri')` | same |
| `ict_h1opp` | ICT shadow 'h1opp' (A-setups when Meridian H1 trend is not with the trade) | shadow | same harness, `variantRule('h1opp')` with `council/engine.mjs msAnalyze` | same |
| `ict_strail` | ICT shadow 'strail' (A-setups, structure-trail exit) | shadow | same harness, `simulate(..., { strail: [2, 2] })` | same |
| `nq_open` | NQ New York open run (nyflip) | live | `research/edge/nq-open-oos/result.json` `trades` (OANDA NAS100, 1 point round trip) | 2004-01 .. 2026-10 |
| `replica` | Gold replica | live | `research/edge/replica-oos/positions.json` (live config incl. sizing/adds), 0.30 a unit round trip | 2017-01 .. 2026-10 |
| `gtrend` | Gold trend N20 + add | live | `research/edge/gold-systems-oos/result.json` `positions` (`n` = x1, `n2` = x2) | 2006-07 .. 2026-10 |
| `gtrend5` | Gold trend fast N5 + add | shadow | same | same |
| `gtl` | Gold H4 trendline | live | same | same |
| `geg` | Gold daily engulf | live | same | same |
| `crypto` | Crypto trend v3 (BTC/ETH/SOL/XRP) | shadow | `research/edge/crypto-trend-decay/result.json` `trades` (`R` net, `gross`, `cost`) | 2017-09 .. 2026-10 |

Not included: ICT paper market silver (no long history in the repo or cache), Mosha BO and gold momentum pullback (only a
2018-26 rebuild exists, and neither was asked for), the Meridian scalp sleeve (retired from live; 30-150 days of replay only).

**Monthly R.** A position's net R is booked in the calendar month (UTC) it closes. The replica's committed positions carry
only the entry time, so the replica books on its entry month (its positions last hours to days). NQ open trades book on the
trade day. A month inside a stream's coverage with no closed position counts as 0R. Outside coverage the stream does not
exist (it is not in the universe and gets no weight). The common end is 2026-10 (the last full month in every source).

**Costs.** x1 as each source study charged it. x2: ICT 2 × costR; NQ R − (gross − R); replica 0.60 a unit; gold systems
`n2`; crypto gross − 2 × cost.

## Universes

- **All** (primary): the 12 streams above.
- **Distinct** (secondary): one stream per idea, dropping the four ICT shadow filters/exits that are subsets or near-copies of
  `ict_a`: `ict_a`, `nq_open`, `replica`, `gtrend`, `gtrend5`, `gtl`, `geg`, `crypto` (8 streams).

## Walk-forward weighting (fixed in advance)

Weights for calendar year Y are set on 1 January of Y from monthly data up to December of Y−1 only, then held for the year.

- **Eligibility:** a stream is in the year-Y universe if it has at least 24 months of coverage before Y.
- **Estimation window:** the trailing 36 months before Y (fewer if the stream's coverage is shorter, minimum 24).
- σ_i = sample SD of the stream's monthly R in the window, floored at 0.25R.

| scheme | weights |
|---|---|
| **EQ** equal risk | w_i = 1/N over the eligible streams |
| **IV** inverse volatility (risk parity, no correlations) | w_i ∝ 1/σ_i, summing to 1 |
| **MC** minimum correlation | w_i ∝ max(0, 1 − ρ̄_i) / σ_i, summing to 1; ρ̄_i = mean Pearson correlation of stream i with every other eligible stream over their overlapping months in the window (pairs with < 12 overlapping months count as 0) |
| **TK** top-k by trailing t | rank eligible streams by t = mean / (SD / √24) of their last 24 monthly R; take the top k = 3 with t > 0; each gets 1/3; an unfilled slot stays in cash (0) |

Sensitivity only (not used for any verdict): TK with k = 2 and k = 5; x2 costs for every scheme.

Portfolio monthly R = Σ w_i × R_i (a 1R total budget split across streams). Return/drawdown, Sharpe and t are scale-free, so
the schemes compare at any overall size.

## Evaluation window

**2009-01 .. 2026-10**, the first year with at least two eligible streams (NQ open from 2006, gold systems from 2009; ICT
joins in 2010, the replica and crypto in 2019/2020). Data before 2009 is used only to set weights.

Halves: **2009-2017** (before the design window of every stream: the ICT rules were built on 2019-26, the gold systems on
2018-26, the replica and NQ open on 2023-26, crypto trend on 2017-26 but it does not exist before 2017) and **2018-2026** (in-sample for most stream rules). The 2009-17 half is the clean one.

## Reported for every portfolio

Yearly R, total R, monthly mean / SD, annualised Sharpe (mean/SD × √12), t of monthly R, max drawdown on the cumulative
monthly R curve, return/drawdown, worst month, positive years, halves, x2 costs. Plus the average weights by year.

Also: the full pairwise correlation matrix of monthly stream R (overlapping months), each stream's and each portfolio's
correlation with **gold** (OANDA XAU_USD month-end close, % change) and **Nasdaq 100** (OANDA NAS100_USD, % change), an
OLS of monthly R on [gold %, NQ %] (betas, R², alpha and its t), the diversification ratio Σ w_i σ_i / σ_p, and the
effective number of bets (DR²).

## Pass bars (decided now)

- **Q1, weighting beats equal risk:** a scheme beats EQ only if its return/maxDD **and** its Sharpe are higher than EQ's
  over 2009-26 **and** in both halves (All universe). Otherwise "no better than equal risk".
- **Q2, the book is an edge:** for the primary EQ-All and each scheme: monthly t ≥ 2 over 2009-26 at x1, total R > 0 in both
  halves, and total R > 0 at x2 costs over 2009-26. All three, or it is not an edge.
- **Q3, beta:** a portfolio is "mostly beta" if, after regressing its monthly R on gold % and NQ %, the alpha's t is < 2
  while the book's own t is ≥ 2; "beta-heavy" if R² ≥ 0.25. Correlations are reported regardless.
- **Q4, diversification:** reported, no bar: DR, effective bets, and the portfolio Sharpe against the average and the best
  single eligible stream's walk-forward-period Sharpe.

## Multiple testing

4 schemes × 2 universes = 8 primary portfolios, plus 2 TK k-sensitivities × 2 universes and x2 costs. One verdict per pass
bar above. No parameter (36/24 months, k = 3, σ floor, ρ̄ rule) will be changed after the run.

## What the older study (#492, `research/portfolio.*`) did, for the record

Daily R of ICT A-setups (15-month desk replay) and the Meridian scalp sleeve (30 days), sizing schemes inside a trade
stream (fixed, `sizeOf`, grade, caps, vol target, Kelly) and a Monte Carlo risk budget for the demo mirror. No long history,
no walk-forward, no gold or NQ beta, and the streams in it are mostly not the ones live today. RESULT.md will say what
changed.
