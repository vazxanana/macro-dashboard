# Trendline break, retest and M15 QM on gold: pre-registration (23 Nov 2026)

Written before any code exists and before any candle of a test window was read for this rule. Research only: nothing live
changes, nothing is proposed until this has a result, and the owner decides any use.

## Question
After gold closes through an objective H1 trendline and comes back to test it, does an M15 QM (BO Structure) in the
breakout's direction give a trade that makes money after costs? No study here has tested a trendline rule.

## The rule (written once, in this repository's words)
- **Candles**: OANDA mid 5-minute gold from the shared toolkit (`research/edge/_lib/edgekit.mjs`), grouped to UTC M15 and H1
  (`resample`). Every decision uses only candles closed at that moment.
- **Swings**: the toolkit's `swings(bars, 3)` on H1 (3 candles a side), usable only from its confirmation candle `ci`.
- **Falling line (for buys)**: through the last two confirmed H1 swing highs A then B with B lower than A, 6 to 240 H1 candles
  apart; the line is the straight line through their highs, extended right. It is drawn at B's confirmation and only if no
  H1 close between B and that moment is above it. It is replaced when a newer swing high is confirmed, and dies 240 H1
  candles after B. **Rising line (for sells)**: the mirror, through the last two confirmed swing lows, B higher than A.
- **Break**: the first H1 close above the falling line's value at that candle (below the rising line, for sells).
- **Retest**: the first M15 candle after the break candle's close whose low reaches the line's value (at the H1 candle that
  holds it) plus 0.25 x the H1 ATR(14) at the break (mirror for sells), within 24 H1 candles of the break. The setup is
  cancelled if, before an entry, an H1 close is more than 1 ATR back on the wrong side of the line.
- **Confirmation**: a toolkit `qms(M15, 3)` buy (sell) whose break candle closes at or after the retest candle's close and
  within 16 M15 candles of it.
- **Entry**: market at the open of the M15 candle after the QM's break close. **Stop**: beyond the retest extreme (the lowest
  low from the retest candle to the QM break candle, for a buy) by $0.30. Skipped when the stop is under $1.00 away.
- **Target**: the most recent confirmed H1 swing high above the entry known at entry (swing low below, for sells); skipped
  when it is under 1R away or none exists. Out after 48 H1 candles. Stop first when one candle holds both (toolkit
  `simulate` on 5-minute candles). One position at a time; one entry per line. Buys and sells both.

## Data windows
In sample 2020-01-01 to 2023-12-31; out of sample 2024-01-01 to the last complete cached candle. Replication 2010-01-01 to
2019-12-31 (the rule was written today; the replication guards against rules shaped by eye on recent charts).

## Costs
Toolkit `COSTS.xau` ($0.30 a round trip) taken off each trade in R (cost / initial risk). A second run at 2x costs.

## Tests (Holm over the three, on the out-of-sample month-sum p)
- **T1 (primary)**: the rule above.
- **S1**: T1 only when the last H4 structure break (toolkit `structure` on H4, 3 a side, known at entry) is on the trade's side.
- **S2**: T1 with a fixed 2R target instead of the swing target.
- Descriptive only (no test): T1 by side, by year, and on 2010-2019.

## Statistic and pass bar
Mean R a trade after costs; t on calendar-month sums of R (toolkit `stats`). A test passes only if ALL hold: out-of-sample
mean > 0; out-of-sample month t >= 2 with Holm-adjusted p < 0.05; in-sample mean > 0; out-of-sample mean > 0 at 2x costs;
at least 30 out-of-sample trades.

## Verdicts
- **PASS**: T1 passes and its 2010-2019 mean after costs is above 0.
- **INCONCLUSIVE**: T1 has fewer than 30 out-of-sample trades; or T1 passes but 2010-2019 is not positive; or only S1 or S2
  passes (then a hypothesis for its own pre-registration on other data, never an edge).
- **FAIL**: otherwise. No variant (other swing sizes, tolerances, windows, targets) will be run after the result.

Results go in `RESULT.md` and `result.json`; this file is not edited after the first result except to add a dated note.
