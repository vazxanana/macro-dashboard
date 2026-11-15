# Silver at a 20-day high in euros but not in dollars: pre-registration

Written and committed **before** any trade result below was computed (14 Nov 2026). Only the number of signal days per
window was counted first (to check the 100-event floor; numbers below). The data, the market set, the signal, the trade, the
costs, the statistics and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. **A stand-alone rule on silver (XAG/USD)**: never a gate, filter, size step, entry or exit of anything
live. No live rule, size, filter, stop, config, cost constant or council member changes, whatever the outcome.

## Question: a replication on a market the rule was not found on

`gold-euro-divergence` (branch, study of 14 Nov 2026) tested: gold in euros at a 20-day closing high (low) while gold in
dollars is not → buy (sell) gold in dollars. Verdict FAIL, 0 of 3, but a near miss: T1 out of sample +0.103R a trade net
(n 121, month t +1.38, Holm p 0.168), beating 39 of 40 placebos; in sample +0.027R (n 147, t +0.41). This study asks whether
the SAME rule, unchanged, holds on silver. The economic reason carries over: when silver priced in euros makes a new 20-day
high while silver in dollars does not, silver's strength is hidden by a strong dollar, and silver in dollars may catch up
(the low is the mirror). Nothing of the rule is re-tuned: the look-back, the holds, the stops, the measure, the placebo and
the control are gold-euro-divergence's; only the traded market, the signal's metal and the cost change.

## Dedupe (read before writing this)

- `gold-euro-divergence` (branch): the original on gold, read in full (PREREGISTRATION.md, run.mjs, RESULT.md).
- `gold-eur-vol-breakout`, `gold-dollar-lead`, `gold-dollar-divergence`, `gold-factor-residual`, `gold-haven-catchup`,
  `gold-eurchf-stress` (branches): as listed in the gold study's dedupe, none reads a price level of a metal in another
  currency.
- The silver replications of the day (`silver-rates-shrug`, `silver-ny-range-share`, `silver-carry-crash`,
  `silver-nikkei-drop`; branches) replicate other gold near misses. `gold-drd-silver` (main) tests a daily-rejection long.
- `research/edge/` on main, every remote branch name (`git branch -r`), the shared topics list and
  `research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`): no silver-in-euros divergence. New.

## Data (no network)

- OANDA mid daily candles, UTC days, from council-data `research/daily/xag.json` (XAG/USD, from 2006-03-20) and
  `research/daily/eurusd.json` (EUR/USD), read with `git show origin/council-data:<path>` (commit recorded in `result.json`).
  `node run.mjs fetch <dir>` copies them out of git (kept out of the repository); `node run.mjs full <dir>` runs the study.
- **Silver in euros is BUILT, not read**: council-data has no XAG/EUR file, so silver in euros on a day = the XAG/USD close
  divided by the EUR/USD close of the same UTC day (the gold study read OANDA's own XAU/EUR series; on gold the two are the
  same price up to the two mid quotes' timing).
- Weekend candles folded into the next weekday with `council/fills.mjs` `foldWeekend` (imported) on both series; a day counts
  only when both have a folded candle.
- **Market set, fixed now:** signal = XAG/USD / EUR/USD against XAG/USD; traded market XAG/USD only.

## Signal (daily, only closes at or before the signal day) — gold-euro-divergence's, on silver

- `eHigh` = silver in euros closes above the highest silver-in-euros close of the 20 matched days before it; `gHigh` the same
  for XAG/USD; `eLow` / `gLow` = below the lowest close of the 20 days before. A gap of more than 5 calendar days between
  matched days restarts the 20-day history.
- **Long signal:** `eHigh` and not `gHigh`. **Short signal:** `eLow` and not `gLow`.
- Events counted before writing this (signal days, not trades): in sample 2007-16 93 long + 59 short = 152; out of sample
  2017-01 to 2026-10 62 long + 52 short = 114. The both-sided tests have at least 100 events in each window. **The long side
  alone does not (93 / 62)**, so the gold study's T2 (long only) cannot be judged here: it is run and reported descriptively,
  outside Holm and outside the verdict. The short side alone is never tested (as on gold). The rule is not loosened.

## Tests

- **T1 (primary, judged):** both sides, entry at XAG/USD's next daily open, out at the close of the 5th candle, stop
  2 x ATR(20).
- T2 (descriptive only, under 100 events a window): long signals only, otherwise as T1.
- T3 (judged): both sides, out at the close of the 10th candle, stop 3 x ATR(20).
- Holm over the two judged tests, T1 and T3.

## The trade (every trade has a stop)

- 1R = the stop distance from the ATR(20) (true range) of the 20 silver candles before the entry candle. Checked on each
  daily candle: an open beyond the stop (after the entry candle) fills at that open; a candle that touches the stop fills at
  the stop; otherwise out at the close of the last held candle. One position at a time per test (a signal while a trade is
  open is skipped).
- Costs: **$0.06 a round trip** on silver, as `silver-rates-shrug` fixed it ($0.03 spread, gold-drd-silver's scaling of gold's
  cost, plus $0.015 slippage on each of the two market orders; the structure of gold's $0.60). Net R = gross R - $0.06 / risk.
- **Financing: none.** `council/fills.mjs` `FIN` holds a gold long rate only; no silver rate is measured, so silver buys are
  charged nothing overnight (this flatters the long side a little, mostly in T3's 10-day hold). Sells are charged nothing, as
  on gold.

## Baseline (control: the same-side trade on every day of the same year)

For each calendar year and side, the same trade (same hold, stop, costs) entered after EVERY eligible day of that year
(overlapping, not one at a time). A signal trade's **excess** = its net R minus the mean net R of its own side's baseline in
its signal year. Mean excess and its month-sum t are reported per window.

## Windows, statistics, bar

- In sample: signal days 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.
- t = mean / standard error of **calendar-month sums** of net R by exit month (months with no trade count as 0), per window.
  One-sided p from the normal; **Holm over T1 and T3** on the out-of-sample p.
- Placebo, per test, 40 seeds (1..40): the test's out-of-sample signal sides kept in order, put on the same number of eligible
  out-of-sample days drawn at random (seeded), same trade, costs and one-at-a-time; the real month-sum t is compared with the
  40.
- **A judged test passes** when all hold: OOS net month-sum t >= 2 and Holm p < 0.05; in-sample net mean R a trade > 0; OOS
  net mean > 0 at 2 x costs; OOS mean excess over the same-side same-year baseline > 0; real OOS t above at least 38 of the 40
  placebo t; OOS trades >= 30.
- **Verdict:** PASS if T1 passes; PARTIAL if only T3 passes; FAIL otherwise. No re-run with other look-backs, holds, stops or
  markets; any such look is labelled post hoc and cannot change the verdict.

## Reported, not judged

T2 in full; long and short sides apart for T1 and T3, gross R and gross month t, stops hit, mean cost, median risk in dollars.
