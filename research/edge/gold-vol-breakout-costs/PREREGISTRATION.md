# Pre-registration: gold-vol-breakout-costs (14 Nov 2026)

Paper research only. **Cost accounting of one fixed rule; no rule is tested and no pass / fail is given on a rule.** The rule
is `gold-vol-breakout`'s T1, unchanged. It is a stand-alone intraday rule on spot gold, **not** a gate, exit, entry or size of
the live gold book (Gold trend + Gold daily engulf; owner decision 44): none of that book's records are read. Nothing live
changes and no proposal is written; a forward paper record of T1 is the owner's decision.

Written and pushed alone, before any figure of this study was computed (the harness gate below only reproduces figures that
are already published on branch `gold-vol-breakout-replicate`).

## Why

`gold-vol-breakout-replicate` passed T1 on untouched 2007-15 at a fixed $0.60 a round trip: +0.111R a trade net (n 1,657,
month t 3.19), gross +0.203R. The margin is thin: at 2x costs 2007-15 keeps +0.018R and pooled 2007 → 12 Nov 2026 is
−0.009R. Costs decide whether the rule is worth a paper record. This study asks only: **what does T1 earn under realistic
costs, and what round-trip cost a trade makes it break even?**

## The rule (unchanged)

`original.mjs` in this folder is a verbatim copy of `gold-vol-breakout`'s `run.mjs` (sha256
afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f, the same file the replicate study copied). This study's
`run.mjs` imports `buildDays`, `daySkip`, `vbTrade`, `placeboTrade`, `rng`, `monthT`, `summary`, `quantile`, `normP`, `holm`,
`TESTS.T1`, `SEEDS`, `PLACEBO` from it and changes none of them. T1: O = open of the first M5 candle from 00:00 UTC; buy stop
O + 0.5 × the previous weekend-folded UTC day's range, sell stop O − 0.5 × that range, live 00:00-20:55 UTC, first filled wins;
stop back at O; out at the 20:55 candle close. No trade crosses the 22:00 UTC rollover, so financing is 0 (`FIN.xau.long`
× `nights`, computed and reported anyway).

## Data

`xau-5m.json.gz`: OANDA mid XAU/USD M5, 2006-11-01 → 2026-11-13 (the replicate study's cache, kept out of git), loaded with
the replicate's loader (sort, drop the forming last day). Data end 2026-11-12.

## Harness gate (must pass before anything else is reported)

With `vbTrade`'s own $0.60 cost, the 2007-15 window, its halves 2007-11 / 2012-15 and the pooled 2007 → data end must
reproduce the replicate's `result.json` **exactly** (n, net R, gross R, month t, gross t, net at 2x, total R): 1,657 /
+0.111 / +0.203 / 3.19 / 5.96 / +0.018 / +183.68; 929 / +0.120 / +0.217 / 2.83; 728 / +0.100 / +0.186 / 1.70; 3,713 / +0.073
/ +0.155 / 3.35. In addition, this study's own net (gross R − cost / r) under route S with no extra slippage must equal
`vbTrade`'s net trade by trade. If either fails, the study stops and reports that.

## Windows

W1 2007-01-01 → 2011-12-31, W2 2012-01-01 → 2015-12-31, W3 2016-01-01 → 2020-12-31, W4 2021-01-01 → data end, and
POOLED 2007-01-01 → data end. (The desk's usual in-sample / out-of-sample split does not apply: the rule is fixed and no
parameter is chosen here.)

## 1. Break-even cost

Per window, with the trades as they are (no extra slippage):

- **Break-even $ cost**: the constant round-trip $ cost a trade (per ounce) at which the mean net R is 0, i.e.
  mean(R) / mean(1/r) (r = |entry − stop| in $).
- **t-2 $ cost**: the constant round-trip $ cost at which the month t of net R (calendar-month sums, the original's `monthT`)
  falls to 2; found by bisection on [0, break-even]. "none" when the gross month t is already under 2.
- The same two figures as a cost proportional to the entry price (cost = f × entry), stated in basis points of price
  (because gold rose from about $600 to about $4,000 over the sample, a fixed $ cost means more in the early years).

## 2. Cost routes (round trip a trade, per ounce)

- **D, demo measured** (council-data `ctrader/symbols.json` at commit 4400129e, read 14 Nov 2026, `XAUUSD`): median quoted
  spread `spreadTypical.median` $0.07 over 110 quotes 2026-11-12 23:08 → 2026-11-13 21:58 UTC (outside the rollover), at a
  gold price of $3,884.75 (`impliedPrice`), plus `commissionRT` 0.000024 of price (USD 12 a million a side). Applied
  **proportional to the entry price**: cost = (0.07 / 3,884.75 + 0.000024) × entry = 0.0042 % of price. No slippage is in
  it (the "Forex spreads" measurement: demo fills sit 0-0.1 pip from the council's, but that was forex; gold stop-order
  slippage is not measured). One day of quotes on one demo account: a snapshot, not a history.
- **D$, demo measured in today's dollars** (descriptive): $0.07 + 0.000024 × entry, not scaled for the price.
- **S, the studies' model** (`council/fills.mjs` `spreadOf` for spot gold $0.30, plus `SLIP_SPREADS` 0.5 spread of slippage
  on each market order: the stop entry and the stop / time exit): $0.30 + $0.15 + $0.15 = **$0.60**, the replicate's figure.
- **P, pessimistic by era (ASSUMPTIONS, not measurements)**: spread $0.50 before 2012, $0.35 in 2012-19, $0.30 from 2020,
  with the same half spread of slippage on entry and exit: round trip **$1.00 / $0.70 / $0.60**. No historical gold spread
  is measured in this repository; the era figures are a deliberately pessimistic guess for a retail CFD, not a source.

## 3. Stop-entry slippage

T1 enters on a stop order, which fills worse than its level when price runs. An extra adverse slippage of s × M,
s ∈ {0, 0.05, 0.10, 0.20}, is charged on the entry on top of each route's cost, where M = the median high − low of the 12 M5
candles ending with the fill candle (the fill candle included; fewer at the start of the day). In R: net = R − (cost +
s × M) / r. The R unit stays the planned risk r. Every route × slippage pair is reported for every window (month t, n,
mean net, gross).

## 4. Time of fill (descriptive)

Fills by UTC hour of the fill candle: Asia 00:00-06:55, London 07:00-11:55, New York 12:00-20:55; per session n, gross R,
net R under D and under P + 0.10, mean r. Spreads are wider in Asia; no session cost is assumed beyond the routes.

## 5. Placebo

The original's placebo (40 seeds: one market entry a day at a random 5-minute mark 01:00-18:00 UTC, coin-flip side, stop
0.5 × previous range away, out at 21:00 or the stop) on the same days, charged the SAME route and slippage (the market entry
slippage s × M taken on its entry candle), for the two verdict conditions, pooled and per window: how many of 40 seeds the
real mean net R beats.

## Statistics and reading

- Month t on calendar-month sums. For the two verdict conditions, one-sided p from the month t (`normP`) and Holm over the
  2 conditions × 5 windows (10 p-values), reported beside the plain t.
- **No pass / fail on the rule.** The verdict states plainly, for the pooled 2007 → data end window (the headline) and per
  window, whether T1 stays positive with month t ≥ 2 under:
  1. **D** (measured demo costs, no extra slippage), and
  2. **P + 0.10** (pessimistic historical costs with 0.10 × M stop-entry slippage).
- Every figure is a cost assumption applied to the same trades. Picking the route that "works" after seeing the table proves
  nothing; the two conditions above are fixed here.

## Deliverables

`research/edge/gold-vol-breakout-costs/{PREREGISTRATION.md, original.mjs, run.mjs, RESULT.md, result.json}`,
`tests/gold-vol-breakout-costs.test.mjs` (offline: the cost arithmetic, the slippage window with no look-ahead past the fill
candle, the break-even solver, and the report against result.json), and `out/` rebuilt. To repeat:
`node research/edge/gold-vol-breakout-costs/run.mjs <dir>` with `<dir>/xau-5m.json.gz` (out of git).
