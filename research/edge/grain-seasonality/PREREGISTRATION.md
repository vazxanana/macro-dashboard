# Grain seasonality (pre-harvest decline): pre-registration

Written and committed **before** any price of corn, wheat, soybeans or sugar was read for this study (14 Nov 2026). Only the
candle cache's index (`research/daily/_index.json`: row counts and first / last dates) was looked at. The windows, the stop,
the costs, the tests and the pass bar below decide the verdicts; nothing in them changes after the results are seen. Anything
added later is labelled a post-hoc diagnostic in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config, market list or council member changes. A pass would be a
candidate for a paper shadow that the owner decides on; it is never a live change, and no market is added to any trading rule.

## The claim

Commodity trading texts and agricultural-economics work on seasonal price patterns describe a pre-harvest decline: grain
prices carry a crop-risk premium in late spring and early summer (the crop can still fail) and tend to fall into harvest as
the size of the crop becomes known and the premium leaves the price. If that holds on the CFD prices the council could trade,
a short held over the window should earn more than the same short held over any other three months of the same years.

## Data

- The council's daily candle cache: council-data `research/daily/<key>.json` (OANDA mid daily candles in UTC buckets),
  keys `corn` (CORN_USD), `soybn` (SOYBN_USD), `wheat` (WHEAT_USD), `sugar` (SUGAR_USD). The index gives first candles in
  March 2003 (sugar a few days earlier) and the last on 6 Nov 2026. `node run.mjs fetch <dir>` copies them out of the
  `council-data` branch with `git show` (no network); the files stay out of git.
- **Weekend candles** (a UTC Saturday or Sunday bucket) are folded into the next weekday candle (its open, the high / low over
  both), the same fold as `council/fills.mjs` `foldWeekend`, so a "trading day" is a weekday candle.
- **Contract rolls.** OANDA's commodity CFDs follow a futures contract and switch to the next one; the mid series may show a
  gap at a switch. Treatment, fixed now: **the candles are used as they are**. A gap inside a hold counts as price movement;
  a stop gapped through fills at that candle's open, never at the stop. No fill is ever placed better than the candles allow.
  Diagnostic, reported but not used to change any number: every candle whose open differs from the previous close by more
  than 3 % or by more than 2 x ATR(20) is listed with its date, and the result is shown with and without the years whose
  test window holds such a gap.

## The rule (each test)

- **Entry:** sell at the **open** of the first trading day (weekday candle) of the window's first month.
- **Stop:** fixed at entry + 3 x ATR(20). ATR(20) = the mean true range of the **20 weekday candles closed before the entry
  candle** (no candle at or after the entry is read). The stop never moves. Every position has it (absolute rule 1).
- **Stop check:** on every candle from the entry candle on: an open at or above the stop exits at the open; otherwise a high
  at or above the stop exits at the stop. When stopped, the market is flat until the next year's window.
- **Exit:** otherwise at the **close** of the last trading day of the window's last month.
- **R** = (entry - exit) / (stop - entry). One trade per market per year.
- A year counts only when the data holds the 20 candles before the entry and every month of the window.

## The three tests (windows fixed now, never tuned)

| test | market | window |
|---|---|---|
| T1 | corn (`corn`) | short from the first trading day of **July** to the last trading day of **September** |
| T2 | soybeans (`soybn`) | short from the first trading day of **July** to the last trading day of **September** |
| T3 | wheat (`wheat`) | short from the first trading day of **June** to the last trading day of **August** (winter-wheat harvest) |
| control | sugar (`sugar`) | short July to September, the same rule; **reported, never judged** (no harvest hypothesis is pre-registered for sugar) |

## Costs (charged in R of the trade's own stop distance)

- **Spread and slippage:** 0.20 % of the entry price a round trip on every market (no measured spread exists for these CFDs;
  0.20 % is the grains-and-sugar figure of `research/edge/trend-breadth`, deliberately conservative). Cost R = 0.0020 x entry
  / (stop - entry).
- **Financing:** a CFD short on a commodity may pay or earn financing and roll; the broker's rate is not known here, so a
  short is **charged 3 % of the entry price a year** as a cost (conservative), per rollover night: the nights between entry
  and exit counted as `council/fills.mjs` `nights` (Monday to Friday 22:00 UTC, Wednesday three), each night 3 % / 365.
  Financing R = nights x 0.03 / 365 x entry / (stop - entry).
- **Base** = both as above. Also reported: **0** (no cost, no financing) and **2x** (0.40 % and 6 % a year). The verdict is read
  on base.

## Samples

- **Decisive:** every year **2016 to 2026** (11 windows a market, all complete before the data ends).
- **Replication:** every year before 2016 the data covers (2003 to 2015 where the 20 candles before entry exist).

## Statistics

- **Permutation null (start months).** For every year of a sample, the same rule (same stop, same costs) is also run on the
  three-month window starting on each of the **other eleven months** (first trading day of month m to the last trading day of
  month m+2; a window may run into the next year; a window that ends after the last candle is left out for that year). The
  null distribution of the sample's mean net R is built by drawing, independently for every year, one of that year's
  available start months (the real one included) uniformly; **200,000 draws**, seeded (seed 20261114). One-sided
  p = (1 + draws with mean >= the real mean) / (1 + draws). Also reported: the real window's **rank** among the twelve
  start-month means of the sample (1 = highest).
- **Holm** over the three decisive p values (T1, T2, T3) at 0.05.
- **Placebo, 40 seeds:** for every seed and every year, one random start candle among the weekday candles of that year
  (a window of the same number of trading days as that year's real window, fully inside the data), the same rule; the
  sample's mean net R per seed. Reported: the 40 means and how many are at or above the real mean. Not part of the verdict.
- Also reported per test: the per-year table (entry, exit, stopped or not, gross R, cost R, financing R, net R), years won,
  mean gross and net R, the t of the per-year net R (descriptive; about 11 values).

## Pass bar (per test)

A test PASSES only if all hold:
1. mean net R (base) above 0 in the **decisive** sample;
2. mean net R (base) above 0 in the **replication** sample;
3. decisive permutation p, **Holm-corrected over the three tests**, under 0.05.

Otherwise it FAILS. **Overall verdict:** PASS if at least one of T1-T3 passes, else FAIL.

## What a result may be used for

- n is about 11 years in the decisive window and about 13 in the replication: one trade a year. Even a pass is a small
  sample; it would be a candidate for a paper shadow with its n and p beside it, proposed to the owner, never called an edge
  on its own.
- A FAIL says the published pre-harvest decline does not show, net of these costs, as a better short than any other three
  months on these CFD prices over 2016-26. It does not say grain prices have no seasonal pattern in physical or futures
  markets with other costs.
