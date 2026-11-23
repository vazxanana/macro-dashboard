# Daily zone retest, entered on an H1 box break: result (23 Nov 2026)

**Verdict: FAIL, both tests.** T1 (no filter) and T2 (with the Weekly-box direction) meet none of the five lines of the pass bar.
After costs both lose a little in every window, the month t is under 1 in size everywhere, and before costs the rule is at zero
(T1 out of sample -0.012R a trade, t -0.14). The rule was run once, as pre-registered; no setting was changed after a result.
Research only: nothing live changed. Not an edge; do not test a variant of this rule on these markets and years.

Gold, EUR/USD, GBP/USD, USD/JPY, AUD/USD pooled; OANDA mid candles from the shared cache; entries 2010-01-01 to 20 Nov 2026 (the
last complete trading day). R a trade after the round-trip cost (and overnight financing on gold buys); t = t of calendar-month
sums of R after costs; p one-sided; Holm over the two tests.

| Test | Window | Trades | Mean R after costs | Month t | Mean R at 2x costs | Mean R before costs |
|---|---|---|---|---|---|---|
| T1 | Replication 2010-2019 | 1157 | -0.025 | -0.70 | -0.046 | -0.004 |
| T1 | In sample 2020-2023 | 417 | -0.008 | -0.12 | -0.027 | 0.011 |
| T1 | Out of sample 2024 on | 302 | -0.030 | -0.36 | -0.049 | -0.012 |
| T2 | Replication 2010-2019 | 488 | -0.004 | -0.08 | -0.027 | 0.019 |
| T2 | In sample 2020-2023 | 146 | -0.148 | -1.60 | -0.170 | -0.126 |
| T2 | Out of sample 2024 on | 107 | -0.067 | -0.46 | -0.091 | -0.042 |

Holm-adjusted out-of-sample p: 1.00 for both tests (both month t are negative).

## In plain words
- A Daily zone (the last two candles of a Daily box before a strong breakout candle) is revisited often: about 330 zones a market,
  1,876 trades in T1. Price coming back to it and breaking an H1 box in the zone's direction does not pick trades that win more
  than they lose: 38 % reach the target (a median 1.41R away), 59 % are stopped, 3 % run out of time.
- Agreeing with the Weekly box side (T2) keeps about 40 % of the trades and does not make them better: worse in sample, worse out
  of sample, about the same in 2010-2019.
- Reported, never judged: out of sample the buys made +0.22R a trade (n 123, month t 1.77) and the sells -0.20R (n 179, t -1.83);
  gold +0.30R (n 49, t 1.75), EUR/USD -0.24R (n 59), GBP/USD -0.15R, USD/JPY +0.20R (n 43), AUD/USD -0.08R. No market is positive
  in all three windows (gold lost in 2010-2019, -0.054R, n 213; GBP/USD was positive in 2010-2023 and lost after). Splits picked
  after the fact; never quote one as a finding. Years: 7 of 17 positive, the best 2016 (+0.28R), the worst 2017 (-0.26R).
- The owner's two examples (a harness check on picked trades, not evidence): on gold the detector reads the October 2026 Daily
  zone 4,105.0-4,155.6 and sold its retest on 5 Nov 2026 16:00 UTC at 4,084.5 (stop 4,150.7, target 3,917.6, reached, +2.52R);
  the 10 Nov re-entry from the same zone was skipped because that position was still open. On EUR/USD the detector finds no
  April 2026 zone (its sell zones of that summer date from 2 Mar, 5 Jun and 18 Jun 2026) and no late-August sell: the owner's
  zone is not what this definition draws.

## Choices made in the code where the pre-registration was silent (before any result)
A visit holds the H1 candles from the return candle up to and including the candle that ends it; "trades into" = the H1 range
overlaps the zone; only the first qualifying H1 box of a visit is used (no target, entry past the stop or an open position = no
trade for that visit); the target is the latest confirmed swing at least 1R beyond the planned entry (the next H1 open = the
fill); the time exit is the close of the 240th H1 candle (counted in candles); weekly candles group the trading days by ISO week;
a trade still open at the end of the data is left out (none were).

## What it does not show
It tests one mechanical definition of the zone, the return and the entry. It does not test a zone chosen by eye (the EUR/USD
example shows the definition and the owner's eye can differ), other timeframes, other buffers, a limit entry, or an exit other
than the swing target. Costs are today's demo figures charged on every year. Candles are OANDA mid, not broker ticks.

Files: `run.mjs` (the study; imports `research/edge/_lib/edgekit.mjs`), `result.json` (every number of the bar, per market,
per year, each window, 2x costs, before costs), `trades.json` (every T1 trade; `w` = 1 when it is also a T2 trade).
Test: `tests/daily-zone-retest.test.mjs`.
