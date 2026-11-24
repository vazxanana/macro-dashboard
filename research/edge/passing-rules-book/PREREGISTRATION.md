# Pre-registration: the passing rules as one paper book, 2016 → 19 Nov 2026 (24 Nov 2026)

**This is ACCOUNTING, not a test.** No rule is tested, no pass / fail bar applies and there is no verdict. It describes what the
rules that passed their own pre-registered tests in this repository looked like, alone and together, on years that are **in
sample for at least one of them** (every year 2016-2026 was read by at least one of the five studies to find or pass its rule).
It is a description, never evidence; the forward records stay the judges. Paper research only; nothing live changes.
Written and committed alone before any figure below is computed.

## The five rules and where each series comes from (never edited)

| Key | Rule | Source of the trades | Cost in the series |
|---|---|---|---|
| `goldVB` | Gold volatility breakout T1 | `gold-vol-breakout-hourcost` code (`costs.mjs` `tradesIn`, `run.mjs` `charge`, frozen hourly profile of its `result.json`, route C1 = median hourly spread + 0.05 x M) run on the shared OANDA mid 5m cache (`_lib/edgekit.mjs`), the same as `gold-vol-breakout-forward`'s baseline | measured hourly spread (C1) |
| `jpyVB` | USD/JPY volatility breakout T1 | `usdjpy-vol-breakout-forward/baseline.json` rows (committed, 2016-01-04 → 2026-11-19) | demo commission + 0.5 pip, pre-set |
| `gotobi` | Gotobi fade T2 (sell USD/JPY 00:55 UTC, buy 06:00 UTC, gotobi days) | `gotobi/run.mjs` `runPair(bars, 'fade', …)` on the shared cache, gotobi days only | the study's own assumed ~2 pips (0.3 spread + 2 x 0.5 slip + commission) |
| `preHol` | Gold the last trading day before an NYSE holiday, T1 | `gold-pre-holiday/result.json` `tests.T1.trades` (`net`, booked on `day`) | assumed $0.60 + financing |
| `turn` | Turnaround Tuesday R2 on NAS100 | `turnaround-tuesday/result.json` `cells['nas100-r2'].trades` (R, booked on the exit day) + `turnaround-tuesday-forward/result.json` trades up to the end date (same rule and cost) | assumed 0.05 % + financing |

Sensitivity (one, fixed now): **`gotobiExec`** = the gotobi series with each day covered by `gotobi-exec/result.json` (from
24 Nov 2023) replaced by that day's broker-quote result `E`. The book is reported with it as a second line.

## Gates (run first; a gate that misses stops the run and the result says which)

- `goldVB` on the cache reproduces `gold-vol-breakout-hourcost/result.json` `grid.H['0.05']` for W3 (2016-20: n 935, +0.094R,
  t 2.41) and W4 (2021-26: n 1121, +0.105R, t 2.79), using `costs.mjs` `stats`.
- `gotobi` T2 on the cache, last day 2026-11-11, reproduces `gotobi/result.json` `tests.T2.decisive` (n 771, net +0.1481R,
  month t 2.74) through the study's own `summary`.
- `jpyVB`: the baseline's own `gate` field is reported as is.

## Window and conventions (fixed)

- Window: 2016-01-01 → **2026-11-19** (the last day of the USD/JPY baseline). Full years 2016-2025; 2026 is partial and
  reported apart from "worst year".
- R a trade after each study's own cost; 1R a trade for every rule; one trade's R is booked on one UTC day (the trade day for
  the intraday rules and the pre-holiday long, the exit day for Turnaround Tuesday).
- Daily series: every weekday (Mon-Fri, UTC) of the window, 0 when a rule did not trade. Monthly series: calendar-month sums,
  every month counted (0 when none): 131 months.
- Per rule and for the **equal-1R book** (the sum of the five daily series):
  - trades, total R, **R a year** = mean month x 12, **month t** = mean / (sd / sqrt(months));
  - **worst closed drawdown** = largest fall of the cumulative daily sum from a previous peak (the cumulative starts at 0);
  - **time under water** = the longest stretch, in calendar days, from a peak to the first day the cumulative is back at or above
    it (a stretch still open at the end date is counted to it and marked open);
  - **worst full year** (calendar-year sum, 2016-2025) and the 2026 to-date figure;
  - **correlation matrices** of the daily series (weekdays, zeros included) and of the monthly series (Pearson).
- **Month-block bootstrap of 3-year outcomes**: draw 36 months with replacement from the 131 monthly sums (whole calendar
  months are the blocks), 20,000 draws, seed 20261124 (one generator per rule, the same seed each); report p5 / p50 / p95 of the
  3-year total R, p5 / p50 / p95 of the worst drawdown on the monthly path of the draw, and the share of draws with a total
  below zero. For the book the draw takes the same months for all five rules together (the book's monthly sums).
- **At 0.25 % risk a trade**: every R figure x 0.25 as simple % of the starting account (not compounded): % a year, worst
  drawdown %, worst year %, and the bootstrap's 3-year p5 / p50 / p95 in %.

## What it will not do

No rule, cut, weight, filter or exit is chosen from these figures; no weighting other than equal 1R is computed; nothing is
called an edge. USD/JPY breakout and gotobi trade the same pair on the same mornings (two positions at once on a gotobi day):
said beside the correlations. Costs of three series are assumed, not measured (gotobi's assumed cost is higher than the measured
0.81 pip; the pre-holiday and Turnaround costs are not measured at all).

Outputs: `run.mjs`, `result.json`, `RESULT.md` (first line: "ACCOUNTING (no rule tested)"), `tests/passing-rules-book.test.mjs`,
and an owner-facing note `research/proposals/2026-11-24-passing-rules-book.md`.
