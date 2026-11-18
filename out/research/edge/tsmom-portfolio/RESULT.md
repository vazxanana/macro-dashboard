# Diversified time-series momentum, a 38-market CFD portfolio: result

Built 17 Nov 2026 from `PREREGISTRATION.md` (committed alone first), on council-data `9b01f2c1` (OANDA mid daily candles,
`research/daily/<key>.json`; FRED DGS2 from `macro/cache.json`). Paper research only: no live rule, Trader, config, mirror or
ICT file changed.

**Verdict: FAIL.** Not one of the five pre-registered checks passes. After a CFD broker's spread and overnight financing the
portfolio lost money in every window: out of sample (2024-01 to 2026-10) −0.34 % a month, t −0.70; in sample (2020-23)
−0.23 %, t −0.51; replication (2005-19) −0.13 %, t −0.61. Before any cost it made money in every window but never with t 2
(replication +0.41 % a month, t 1.85, Sharpe 0.48; out of sample +0.40 %, t 0.85). Do not call this an edge; do not propose
it as a paper shadow.

## The rule, in one paragraph

Each month, at the first daily close of the month, every one of 38 markets (5 metals, 13 indices, 3 energies, 6 bond CFDs,
4 ags, 7 forex majors) is held long if its return from 13 months ago to 2 months ago (closes strictly before that day) is
positive, short if negative, sized to 10 % annualised volatility from its last 60 daily returns (notional capped at 4x its
share), equal risk across markets, and the whole book scaled to 10 % volatility from the last 252 days of its own unscaled
returns. Costs: a pre-registered round trip per market on every change of position. Financing: a long pays the US 2-year
yield + 2.5 % a year, a short pays 2.5 % − that yield (forex: 1 % a year either side), per calendar day held.

## Primary spec (P12-1), % of equity a month

| window | n | net mean | t | Sharpe | max DD (sum) | gross mean | gross t | gross Sharpe |
|---|---|---|---|---|---|---|---|---|
| replication 2005-19 | 180 | −0.134 % | −0.61 | −0.16 | −49.1 % | +0.415 % | 1.85 | 0.48 |
| in sample 2020-23 | 48 | −0.226 % | −0.51 | −0.26 | −18.0 % | +0.145 % | 0.33 | 0.17 |
| out of sample 2024-01 → 2026-10 | 34 | −0.341 % | −0.70 | −0.42 | −25.9 % | +0.400 % | 0.85 | 0.50 |
| out of sample, 2x costs and markups | 34 | −0.914 % | −1.88 | −1.12 | −38.4 % | | | |

Monthly volatility of the net book was 2.8-3.0 % (about 10 % a year, as targeted). Newey-West t (lag 3) out of sample −0.66.
34 out-of-sample months make t ≥ 2 a high bar (it needs a Sharpe of about 1.2 in that window); the book did not come near it
even before costs.

## Where the gross return went (sums over the window, % of equity)

| window | gross | spread costs | financing | net | costs ÷ gross | financing ÷ gross | avg gross leverage |
|---|---|---|---|---|---|---|---|
| replication | +74.6 | 6.6 | 92.1 | −24.1 | 9 % | 123 % | 2.6x |
| in sample | +7.0 | 1.4 | 16.4 | −10.8 | 21 % | 235 % | 2.3x |
| out of sample | +13.6 | 1.8 | 23.4 | −11.6 | 13 % | 172 % | 3.0x |

Spreads are a small cost (monthly rebalancing turns over little). **Overnight financing is what kills it**: at 2.3-3.0x gross
notional, a 2.5 % markup alone costs about 0.5 % of equity a month, more than the gross return. Bond CFDs are the worst case
(their low volatility gives them the largest notionals: 30.8 % of financing in the replication window against +8.0 % gross).

Post hoc (not pre-registered, reported only): with financing at the rate alone and no broker markup (close to a futures
excess return), the book makes +0.33 % a month on 2005-19 (t 1.49), +0.18 % in 2020-23 (t 0.40) and +0.18 % out of sample
(t 0.37). Even on a futures account the rule would not have passed on this data. With no financing at all (spread only):
replication +0.38 % (t 1.69), out of sample +0.35 % (t 0.73).

## By asset class (each class's contribution to the portfolio's monthly net return)

| class | replication mean / t | in sample mean / t | out of sample mean / t |
|---|---|---|---|
| metals | +0.03 % / 0.59 | −0.05 % / −0.56 | +0.14 % / 1.12 |
| indices | +0.12 % / 0.91 | −0.57 % / −1.78 | +0.19 % / 0.68 |
| energies | +0.04 % / 0.99 | +0.04 % / 0.34 | −0.12 % / −1.11 |
| bonds | −0.14 % / −2.30 | +0.13 % / 0.77 | −0.17 % / −0.90 |
| ags | −0.07 % / −1.64 | +0.07 % / 0.84 | −0.08 % / −0.95 |
| forex | −0.11 % / −1.67 | +0.16 % / 1.06 | −0.29 % / −1.50 |

No class is positive in all three windows with any weight of evidence; the best out-of-sample slice (metals, t 1.12) was
negative in 2020-23.

## Secondary specs (Holm over the three, out of sample, one-sided)

| spec | OOS net mean | t | Sharpe | Holm p | replication net t | replication gross t |
|---|---|---|---|---|---|---|
| P12-1 (primary) | −0.34 % | −0.70 | −0.42 | 1.00 | −0.61 | 1.85 |
| P3 (3 months, no skip) | −0.90 % | −2.13 | −1.26 | 1.00 | −2.14 | 0.55 |
| P6 (6 months, no skip) | −0.62 % | −1.42 | −0.85 | 1.00 | −1.22 | 1.35 |

The shorter look-backs are worse (more turnover, more whipsaw).

## What this means in practice

- This would have been a portfolio of about 38 CFDs held all the time, rebalanced monthly: nothing the council trades or
  could mirror today. On these candles, and charged what a CFD broker charges to hold positions overnight, it lost money
  2005-2026. The published futures results are not contradicted (the gross figures are positive, a Sharpe near 0.5 on
  2005-19, the weak post-2010 period the literature also reports), but the edge is too small to survive CFD financing, and
  even without any markup it is not distinguishable from zero after 2019.
- **No paper shadow is proposed; no owner decision is needed.** A futures account (financing at the rate, no markup) is the
  only venue where the gross figures could matter, and even there the post-hoc figure has t 0.37 out of sample.

## Assumptions and limits (said plainly)

- Prices are OANDA CFD mid closes, not futures: index CFDs carry no dividends and commodity / bond CFDs may contain roll steps.
  Weekend-dated candles were dropped; nothing else was cleaned (the ten largest daily moves of every market are in
  `result.json` `bigMoves`; e.g. natgas +38 % on 24 Feb 2003, silver −27.6 % on 30 Jan 2026).
- One US rate (2-year Treasury, weekly, a proxy for an overnight rate) is used for every currency; non-USD markets would pay
  their local rate. Forex is measured on spot moves without its interest differential (no foreign rate history at hand).
- Costs are today's (spreads were wider in the 2000s, so replication costs are understated). Gold and silver join in April
  2007 (their history starts March 2006), platinum and palladium in February 2006, every other market by April 2005.
- Months are additive (no compounding); drawdowns are of the cumulative sum.

To repeat: `node research/edge/tsmom-portfolio/run.mjs fetch <dir>` (git, no network), then `… run <dir>` (about 2 s).
Test: `tests/tsmom-portfolio.test.mjs`.
