# Pre-registration: silver after an AUD/JPY carry crash day (14 Nov 2026)

Written and pushed alone, before any silver outcome of this study was computed. Only the number of signal days in each window
was counted first (below), from AUD/JPY closes alone; they are the same counts as the gold study's, because the signal and the
data commit are the same.

## Why this study

`gold-carry-crash` (branch, FAIL 0 of 3) was a near miss on gold: buying gold for 5 days after an AUD/JPY carry crash day beat
the same year's every-day gold buy by +0.117R a trade out of sample 2017-26 (n 141, month t 1.42, Holm p 0.23), positive in
sample too (+0.047R) and above 39 of its 40 placebos. A near miss on the market it was found on cannot be confirmed on that
market again. This study asks whether the SAME rule, unchanged, holds on a market it was not found on: silver, the other
precious metal, which also has a haven leg but a larger industrial (risk-on) leg. Nothing in the rule is changed or tuned; only
the traded market and the two price-scaled cost numbers differ.

**Scope.** A stand-alone rule on silver. Silver is not traded by any live system; nothing here is a gate, exit, entry or size
of the live gold book (docs/owner-decisions.md item 44), and that book's records are not read. Paper research only: no live
rule, size, filter, stop, config, cost constant or council member changes, whatever the verdict. No proposal is written.

## What is already known (dedupe, read before this was written)

- `gold-carry-crash`: the rule on gold (above). Its signal, thresholds, hold, stop, baseline, placebo and statistics are
  copied here one for one (its `run.mjs` is the base of this study's `run.mjs`; only the market key, the cost and the
  financing differ).
- `silver-rates-shrug`, `silver-vol-breakout`, `gold-drd-silver`, the `gold-silver-*` branches: other signals on silver or on
  the gold / silver pair. None uses an AUD/JPY carry-unwind day as the signal for a silver trade.
- `gold-yen-surge`, `risk-spill-jpy`, `risk-cross`, `fx-carry`: yen or carry signals traded on gold or on currencies, not on
  silver. The research topic list and `git branch -r` have no `silver-carry-crash` topic.

## Data (named before any result)

- OANDA mid complete UTC daily candles from council-data `research/daily/<key>.json` at commit
  `d8d68407bae5e7df75e54d57e4877dea340cc705` (the gold study's commit; read with `git show`, no network): `xag` (the trade,
  from 2006-03-20) and `audjpy` (the signal). Weekend candles folded into Monday with `council/fills.mjs` `foldWeekend`.
- Market set: silver only (the trade), AUD/JPY only (the signal). No other market.
- Cache kept outside git.

## Signal (unchanged from gold-carry-crash)

- Daily close-to-close returns `y` of AUD/JPY on its folded candles; a gap of more than 5 calendar days between two candles
  restarts the history.
- `sd` = sample standard deviation of the 20 previous daily returns (the signal day itself excluded); `z = y / sd`.
- Carry crash day: `z < −1.5`. Carry rally day: `z > +1.5`.
- The trade enters at silver's next daily open, after the signal day's close. No later data is read.
- Events counted before this file (AUD/JPY only): in sample 2007-16 216 crash and 182 rally days of 2,605; out of sample
  2017 to Oct 2026 191 crash and 177 rally days of 2,563. Every test has at least 100 signal days in each window (trades are
  fewer after the one-at-a-time rule, as on gold).

## Tests (three, Holm over all three)

| Test | Signal | Side | Hold |
|---|---|---|---|
| T1 (primary; the gold study's primary rule) | carry crash day | buy silver | 5 silver candles |
| T2 | carry rally day | sell silver | 5 silver candles |
| T3 | carry crash day | buy silver | 10 silver candles |

## Trade

- Entry at the open of silver's first daily candle whose UTC day is after the signal day; exit at the close of the hold's
  last candle.
- Stop 1.5 x ATR(14) of silver's 14 candles before the entry, on the losing side (1R). Every trade has a stop. A candle that
  opens through the stop fills at its open; a candle that touches it fills at the stop.
- One position at a time per test (a signal while a trade of that test is open is skipped).
- **Costs: $0.05 a round trip.** Scaled the way `gold-drd-silver` scaled gold's costs to silver: there gold's $0.35 a round
  trip became $0.03 on silver (the ICT lab's silver cost); the gold study's $0.60 times that ratio (0.03 / 0.35) is $0.051,
  rounded to $0.05.
- **Financing: none.** `council/fills.mjs` `FIN` holds a gold rate only; there is no measured silver rate in the repository,
  so silver buys are charged nothing (sells pay and are credited nothing, as on gold). This understates the cost of a held
  silver buy. As a DESCRIPTIVE sensitivity only (not in the pass bar), the net of each test is also shown with gold's rate per
  unit of price (`FIN.xau.long` 0.000148 a rollover, `nights`) charged on silver buys.
- 2x costs = the round trip doubled.

## Baseline (control): the same-side trade on every day of the same year

For each test and each calendar year, the baseline is the mean net R of the same trade (same side, same hold, same stop and
costs) entered after EVERY AUD/JPY signal-eligible day of that year (no one-at-a-time rule). A signal trade's **excess** =
its net R minus its entry year's baseline mean. The test statistic is the excess.

## Windows and statistics

- In sample: signals of 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.
- t on calendar-month sums of excess R (by exit month, empty months count as 0); one-sided p from the normal; Holm over the
  three tests' out-of-sample p.
- Placebo: 40 seeded draws (seeds 1-40) of as many random eligible days of the out-of-sample window as the test has
  signals, run through the same trade and excess; the real excess month t must beat at least 38 of 40.

## Pass bar (per test; the study passes only if T1 passes)

1. Out of sample excess month t >= 2 and Holm p < 0.05.
2. Out of sample net R a trade > 0, and still > 0 at 2x costs.
3. In sample excess R a trade > 0 (same sign).
4. Placebo beaten at least 38 of 40.
5. Out of sample n >= 30 trades.

Verdict PASS (T1 passes), PARTIAL (only T2 or T3 passes), else FAIL. A PASS on silver would replicate the direction of the
gold near miss on another market; it would still not make the gold rule an edge, and nothing is called an edge without n and
t. Whatever the verdict, nothing live changes and no proposal is written by this study.
