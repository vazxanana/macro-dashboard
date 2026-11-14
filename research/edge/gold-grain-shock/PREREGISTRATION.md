# Spot gold after a grain-price shock day: pre-registration

Written and committed **before** any gold outcome below was computed (14 Nov 2026). The data, the markets, the trigger, the
trade, the costs, the statistics and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. **A stand-alone rule on gold (XAU/USD)**: not a gate, filter, size step, entry or exit for the live gold
book (Gold trend, Gold daily engulf, Mosha cycle), never compared with or applied to it, and it does not use the book's
2006-17 positions (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member changes,
whatever the outcome.

## The claim

Food is the part of headline inflation that moves fastest after a supply shock (droughts, export bans, war in the Black Sea),
and it weighs far more in the price indices of the large gold-buying countries (India, China, the Middle East) than in the
US. A day on which wheat, corn and soybeans jump together is a food-supply shock that raises inflation expectations and
geopolitical worry at once; gold, the usual hedge for both, may reprice over the following days rather than the same day.
The test: **after a grain up-shock day, does a gold buy make more over the next 5 (or 20) days than the same buy after an
ordinary day of the same year?** The mirror (a grain down-shock, a disinflation impulse, followed by a 5-day gold sell) is
the third test.

## Dedupe (read before writing this)

- `gold-commodity-inflation` (branch, FAIL 0 of 3): gold the way of an eight-commodity basket's past MONTH (energies, grains,
  softs, copper), monthly rebalanced. Here a one-day shock in the three grains alone, a 5 / 20-day hold, an event study
  against a same-year baseline.
- `gold-oil-lead` (branch, FAIL): a big WTI / copper DAY leading gold 3 days. Oil and copper, never the grains.
- `grain-seasonality`, `soybean-short-robust`, `commodity-xs-momentum`, `commodity-cycle`, `commodity-skewness`: trade the
  grains themselves, never gold on a grain signal.
- `gold-em-fx-stress`, `gold-yuan-hedge`, `gold-hk-stress`, `gold-haven-shock`, `gold-yield-shock`, `gold-carry-crash`:
  other trigger markets (currencies, equities, rates). This study's code is adapted from `gold-em-fx-stress` (same trade,
  baseline and statistics; only the trigger markets and the tests differ).
- No study in `research/edge/`, no remote branch, the shared topics list and `research/proposals/2026-11-14-untested-backlog.md`
  (branch `untested-backlog`) reads `wheat`, `corn` or `soybn` as a trigger for a gold trade. New.

## Data and markets (named before any result)

- council-data `research/daily/{xau,wheat,corn,soybn}.json` (OANDA mid daily candles, UTC days, read with `git show
  origin/council-data:…` at commit `b7d716ad7`), weekend candles folded into the next weekday (`council/fills.mjs`
  `foldWeekend`). Gold starts 2006-03-20, the grains 2003-03-17: the windows below are covered by all four.
- **Gold (XAU/USD) is the only market traded**; wheat, corn and soybeans (CBOT-based CFDs) are the trigger only. No other
  market is added after a result.

## The trigger

- Day d's grain move = the mean of the three daily log changes ln(C_d / C_{d-1}) (all three must exist that day).
- z_d = grain move / standard deviation of the 60 grain moves before d (days d-60 … d-1; none of d or later).
- **Up-shock: z_d >= 1.5; down-shock: z_d <= -1.5.** A shock is a signal only on a day gold also has a candle.
- Counted from the grain files alone, before any gold price was read (`countByWindow`): 2007-16 154 up-shocks and 160
  down-shocks of 2,537 scored days; 2017 to 2026-10 185 up and 148 down of 2,476. At least 100 a window, as required.

## The trade (every trade has a stop)

- Entry at the **open of the next gold candle** after the shock day (known at d's close, nothing later used).
- Stop 2 x ATR(20) of the daily gold candles up to and including d, checked on daily candles from the entry candle on: an
  open beyond the stop fills at that open, otherwise a touch fills at the stop (stop first). Otherwise out at the close of
  the H-th candle (the entry candle is candle 1).
- One position at a time per test: a shock day whose entry falls before the open trade's exit candle has closed is skipped.
- Cost $0.60 an ounce round trip; financing on buys only: `nights(entry, exit) x FIN.xau.long (0.000148 of price a
  rollover, the demo broker's XAUUSD swap of 11 Nov 2026, the constant in council/fills.mjs) x entry`; sells pay and are
  credited nothing. R = net move / (2 x ATR).

## The tests (Holm over these three, on the out-of-sample p)

| Test | Trigger | Side | Hold H | Reading |
|---|---|---|---|---|
| **T1 (primary)** | up-shock | buy | 5 candles | the inflation / supply-shock bid comes over the week |
| T2 | up-shock | buy | 20 candles | a slower repricing over the month |
| T3 | down-shock | sell | 5 candles | the mirror: a disinflation impulse |

## The measure that separates signal from drift

- **Excess R** of a trade = its net R minus the mean net R of the **same trade (side, H, stop, cost) entered after every
  ordinary day** of the same calendar year (ordinary = a scored day that is not a shock in the test's direction; every such
  day, overlapping holds allowed). This is the same-side trade on every day of the same year, the baseline asked for; it
  removes gold's drift of that year and the average cost of a hold of that length.
- t = t of the **calendar-month sums** of excess R (months with at least one trade), df = months - 1.
- Windows by the entry's year: **in sample 2007-2016, out of sample 2017 to 2026-10** (entries after 31 Oct 2026 dropped).
- Placebo: 40 seeds (seeded generator); each seed draws, per out-of-sample year, as many ordinary entry days as the test took
  trades that year, runs the same trade on them and computes the same month-sum t of excess. Reported as the number of seeds
  whose t the real out-of-sample t beats.

## Pass bar (per test; the study PASSES only if T1 passes; T2 / T3 passing alone are reported as hypotheses)

1. Out-of-sample excess month-sum t >= 2 and Holm-adjusted p < 0.05 (two-sided, three tests).
2. In-sample excess R of the same sign (positive).
3. At 2x costs ($1.20 and 2x financing) out-of-sample mean net R > 0 and excess R > 0.
4. The real out-of-sample t beats at least 38 of the 40 placebo seeds.

Also reported, not judged: gross R and gross t (trade-level), net R and net t on month sums, stop count, the number of shock
days skipped by the one-position rule.

## What a result means

A FAIL means the effect is not shown at this power, not that it is absent. A PASS is a hypothesis for the owner, never a
rule; it would need its own forward record. Nothing here is called an edge without its n and t.

## Files

`run.mjs` (`fetch <dir>`: the four files by `git show`, kept out of git; `full <dir>`: writes `result.json` and
`RESULT.md`), `tests/gold-grain-shock.test.mjs` (offline: the trigger, the trade and the stop on hand-made candles, no
look-ahead, the report against `result.json`).
