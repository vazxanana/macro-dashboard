# Pre-registration: the 2-day RSI pullback on US index CFDs, the years before the original study (14 Nov 2026)

Written and committed before any return of the years studied here was computed. Paper research: nothing here is read by the
council, the mirror or the page, and no live rule changes whatever the verdict. Not an ICT study.

## The question
`research/edge/rsi2-pullback` (branch `rsi2-pullback`, 13 Nov 2026) tested the 2-day RSI pullback on SPX500, NAS100 and US30
(OANDA mid daily candles) on entries from 2008-01-01 (window A, reported) and from 2016-01-01 (window B, decisive). Its
frozen replications (`rsi2-replicate`: six non-US indices; `metals-rsi2`: gold and silver) used the SAME calendar years, so
the multiple-testing ledger (`multiple-testing-update`) lists it with "none on other years". This study asks: does the same
rule, frozen, make money net of costs on the same three index CFDs in the years BEFORE 2008, which the original never used?

## What the data allows (an inventory of candle dates only; no price change was read)
- The only sources this repository allows for these markets are OANDA mid daily candles: council-data
  `research/daily/<key>.json` (`spx500`, `nas100`, `us30`; the weekly cache, "full OANDA history") and the site's candle
  proxy `/md/bars`. Both start on **2003-03-24** for all three markets: a proxy request for 2000-01-01 to 2003-06-01 returns
  its first candle on 2003-03-24 (checked 14 Nov 2026). OANDA serves nothing earlier.
- The rule needs 200 weekday closes before its first signal (SMA200). After dropping Saturday / Sunday candles as the
  original does, the first day a signal can occur is **2004-01-02** (SPX500, NAS100) and **2004-01-07** (US30).
- So the only pre-2008 stretch is entries from 2004-01-02 to 2007-12-31: **4.00 years** (US30 3.98). No calendar gap over
  4 days in it for any market.
- Two further limits, stated now: (1) the financing benchmark the original uses (FRED `DGS2` in council-data
  `macro/cache.json`) starts on 2006-01-06, so the original cost model has no rate for 2004-05 (its `rateAt` would return
  null and charge 2.5 % only); (2) the rule was published in 2009 on data up to 2008 (the original pre-registration says
  so), so 2004-07 lies inside the rule's own development sample: a result there is not independent of how the rule was
  chosen, even though the original study never read those years.
- At the original's own trade rate (window A: 67-75 trades a market in 8 years) four years give about 35 trades a market,
  and the original found about half of the entries fall on the same day across the three markets.

## Measurability rule (fixed here, before any 2004-07 return)
The study's brief requires about 5 years of replication data. Fixed here as: **at least 5.0 years of entry window per
market**. Under it the verdict is **NOT MEASURABLE** and the study stops: `run.mjs` does not compute any trade, return,
t, placebo or Fisher figure for 2004-07, and nothing for those years is reported. With 4.00 years available the
expected verdict is "NOT MEASURABLE (inconclusive: …)". This is decided from the dates above, not from any result.

## What is still run
1. `frozen.mjs` = the original `research/edge/rsi2-pullback/run.mjs`, copied byte for byte from `origin/rsi2-pullback`
   (commit 4e1b4e1dd), sha256 pinned in `tests/rsi2-early-years.test.mjs`, never edited; `run.mjs` imports it.
2. **Gate**: the frozen code on today's council-data candles and `DGS2` must reproduce the original's published figures
   exactly (per market and window A / B: n, % a trade net, R a trade, total R, t on trades, t on month sums; window B:
   placebo p95, one-sided p, Holm p; the verdict FAIL). A gate failure is reported and changes nothing else.
3. The inventory above, recomputed by `run.mjs` from the candle times (first candle, first signal day, years to
   2007-12-31, gaps), so the measurability decision is reproducible.

## What would have been run (recorded so the decision is visible, not run)
Had 5 years been available: the frozen rule and frozen cost model (spread 1.0 / 3.0 / 4.0 points, financing DGS2 + 2.5 %)
on a pooled book of the three markets in the early window; pass = net % a trade > 0, calendar-month t >= 2, still
positive at 2x spread cost; the same at the demo broker's measured index cost read as `cost-floor-map` read it
(`ctrader/symbols.json`); per market with Holm at 0 / base / 2x cost and worst drawdown; a placebo of 40 seeded random
entries (the original's placebo); and Fisher's combination −2 Σ ln p on 2k df of the original's p (#838 spx500, one-sided
0.0217) and this study's pooled one-sided p, as `multiple-testing-update` defines it. None of this is computed.

## Verdict words
REPLICATES / DOES NOT REPLICATE / NOT MEASURABLE (with "(inconclusive: …)" after NOT MEASURABLE). Nothing here is
called an edge; the original remains a FAIL on its own bar and has no replication on other years.
