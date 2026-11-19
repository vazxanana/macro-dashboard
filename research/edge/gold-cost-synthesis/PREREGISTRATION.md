# Pre-registration: gold cost synthesis (descriptive, no rule tested)

Written 2026-11-14, pushed alone before `run.mjs`, `result.json` or `RESULT.md` exist.

## What this is

A **descriptive synthesis** of the result files of 44 gold studies run on 13-14 Nov 2026. It re-runs nothing, fetches no
candle, tests no rule and makes no pass / fail claim. No live rule, size, filter, stop, config or council member changes, and
no proposal follows. It complements `cost-floor-map` (branch `cost-floor-map`, studies #815-#943, which does not cover these
44 and does not look at stop size).

The question it describes: across these studies, do the rules that lean the right way before costs lose after costs because
their stops are small in dollars (so a fixed dollar round trip is a large fraction of 1R), and does the one rule that passed a
replication (`gold-vol-breakout`, `gold-vol-breakout-replicate`) differ by having wider stops? Or is that a story?

Honesty about order: to write this plan I opened the 44 `result.json` files to learn their key names (each study uses its own
shape), and the request that started this work already quoted some figures (gross t 1.5-3.3, a $13.5 median stop). The plan
below (fields, bins, statistics, wording) is fixed now, before any table is built.

## Sources (fixed list)

`research/edge/<topic>/result.json` and `RESULT.md` read with `git show origin/<topic>:…` (or `origin/main` if the study is
already merged there), for exactly these topics:

gold-comex-calendar gold-china-holidays ict-silver-bullet-gold mmxm-pdhl-raid-gold gold-squeeze gold-round-numbers
gold-record-high gold-late-ny gold-turn-of-month gold-comex-orb gold-oil-lead gold-weekly-open gold-inside-week gold-bond-lead
gold-vwap gold-ibs gold-platinum-ratio gold-vol-target gold-dollar-lead gold-london-reversal gold-key-reversal
gold-daily-turtle-soup gold-regime-switch gold-pre-cpi gold-weekly-momentum gold-volume-spike gold-gap-open gold-streak
gold-pre-nfp-replicate gold-dollar-divergence gold-floor-pivots gold-measured-move gold-ote-retrace gold-pdhl-break
gold-month-levels gold-premium-discount gold-vol-breakout gold-h4-pinbar gold-macd gold-vol-breakout-replicate gold-ichimoku
gold-silver-lead-intraday gold-hourly-shock gold-london-orb

The commit of each branch read is recorded in `result.json`. The values used are copied into `collected.json` with the JSON
path they came from, so the tables can be checked offline.

## What is tabulated (per study, per pre-registered test, per window)

- n, gross R a trade, net R a trade, gross t, net t, the study's verdict (its own words, and whether that test passed);
- the stop: the median stop in $ where the study reports one; a mean stop in $ (labelled "mean") where only that is reported;
  otherwise the stop rule in words (e.g. "1.5 x ATR(14)") and no number;
- the holding period (in words, from the study's own rule);
- cost in R a trade = gross minus net (spread, slippage and, where the study charged it, financing), and the study's own
  stored cost figure where it has one;
- the cost assumption of the study ($ a round trip, financing or not).

Windows: in sample and out of sample as each study defined them (they differ: 2016-20 / 2021-now for the intraday M5 studies,
2008-16 / 2017-26 for most daily ones). A study with one window only (the replications, the CPI study) is shown as "single
window". The t is the study's own (calendar-month sums of net R for nearly all); where a study gives only a trade t or no t,
that is said. **Where a field is missing, the table says "not reported". No missing figure is estimated.** Tests whose units
are not R a trade (a portfolio-weight study) are listed and left out of the stop / cost description, with the reason.

## How it is described (fixed now)

1. **Bins by median stop in $** (rows with a reported median stop only): under $3, $3-6, $6-10, $10-20, $20 and over. Per bin:
   number of rows, median gross R, median cost R, median net R, how many rows are gross-positive, how many have gross t >= 2.
2. **Rank correlation** (Spearman, ties averaged) between median stop $ and cost R, and between median stop $ and gross R,
   over the same rows; repeated with the mean-stop rows added (labelled). No p-value is attached: the rows are not independent.
3. **Counts**: rows with gross t >= 2; tests with gross t >= 2 in BOTH windows (and gross positive in both); rows with gross
   t >= 1.5 whose net t is under 2; rows whose cost R is larger than their gross R while gross R is positive.
4. **The replicated rule against the rest**: `gold-vol-breakout` T1 (both windows) and `gold-vol-breakout-replicate` placed in
   the same table, with their stop, gross R and cost R beside the bin medians.

## What will and will not be concluded

- Will: say in words whether the table supports the description "positive before costs, lost to costs, small stops", for how
  many rows, and where it does not hold (rules with no gross effect at any stop size; wide-stop rules that still lose).
- Will note that a fixed dollar cost divided by the stop makes cost R fall as the stop widens **by construction**, so a strong
  stop-cost rank correlation is arithmetic, not a finding; the informative part is how gross R behaves with stop size.
- Will not: make any pass / fail claim, call anything an edge, rank rules for trading, or propose a rule, filter or stop size.
- Limits stated in the result: the studies used different windows, costs ($0.30 or $0.60 a round trip, financing or not) and
  definitions of 1R; their tests share data and are not independent; the bins and the correlation are descriptions of 44
  studies chosen as "today's gold studies", not a sample. **Picking "wide stops" after seeing this table is itself data
  mining**: any rule built on it needs its own pre-registration on data none of these studies used, and little untouched gold
  history is left.

## Deliverables

`run.mjs` (reads the branches, writes `collected.json` and `result.json`; no network beyond `git show`), `RESULT.md`,
`result.json`, `tests/gold-cost-synthesis.test.mjs` (every figure of RESULT.md equals result.json; result.json equals the
source files for spot rows when those commits are available, else equals `collected.json`), and the rebuilt `out/`.
