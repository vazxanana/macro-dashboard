# Pre-registration: gold's outside week with a strong close, followed for two weeks (14 Nov 2026)

Written and pushed alone, before any code that computes a trade exists. Paper research only: no live rule, size, filter, stop,
config, cost constant or council member changes, whatever the result.

**Item 44.** This is a new stand-alone weekly rule on spot gold, judged out of sample on 2017-26. It is not a gate, exit, entry
or size of the live gold book (Gold trend / Gold daily engulf), it reads none of that book's 2006-17 positions, and it says
nothing about that book.

## Question
When a gold week trades both above the previous week's high and below the previous week's low (an outside week) and closes in
the outer third of its own range, does price keep going the way it closed over the next two weeks, after costs?

Not a duplicate: `gold-month-engulf` tested the outside MONTH held a month (FAIL, 19 trades); `gold-inside-week` tested the
opposite pattern (a week inside the last one) as a breakout bracket (FAIL); `gold-weekly-wick` tested a long wick (FAIL);
`gold-key-reversal` is a daily pattern. No study has tested the outside week with a strong close.

## Data (fixed before any result)
- One market only: spot gold, OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (`git show`, no network),
  March 2006 to the file's last complete week. UTC days, weekend candles folded into the next weekday with
  `council/fills.mjs` `foldWeekend` (the Sunday stub belongs to Monday). The cache is kept out of git.
- Weeks: Monday to Friday by the folded day's UTC date (ISO week). A week counts only with 4 or more trading days; the
  file's last week is dropped (it may be forming).

## Rule
- **Outside week** k: high(k) > high(k-1) and low(k) < low(k-1), both weeks with 4+ days, consecutive calendar weeks.
- **Close location** = (close − low) / (high − low) of week k. Bullish: >= 2/3 → BUY. Bearish: <= 1/3 → SELL. Between: no trade.
- **Entry**: the first open of week k+1 (market). **Stop**: $0.30 past the outside week's other extreme (buy: low(k) − 0.30;
  sell: high(k) + 0.30). Every trade has this stop. A day that opens through the stop fills at that open; otherwise a day
  whose low (buy) / high (sell) reaches it fills at the stop. **Exit**: the close of the 10th trading day counted from the
  entry day (T2: the 5th, T3: the 20th) unless stopped. No target, no break-even, no trail.
- **One position at a time** per test: a signal whose entry day is not after the open trade's exit day is skipped.
- **Costs**: $0.60 a round trip on every trade, plus on buys `nights(entry, exit)` × `FIN.xau.long` (0.000148 of price a
  rollover, the demo broker's swap, `council/fills.mjs`) × entry / risk. Sells pay and receive nothing. The share of gross
  R taken by costs is reported. 2× costs = both doubled.
- R = (exit − entry) × side / (entry − stop) × side. The median stop in dollars is reported (expected well over $10).

## Tests (Holm over these three)
| Test | Hold | Sides |
|---|---|---|
| T1 (primary) | 10 trading days | both: follow the close |
| T2 | 5 trading days | both |
| T3 | 20 trading days | both |

Windows by entry month: in sample 2007-01 to 2016-12, out of sample 2017-01 to 2026-10, OOS halves 2017-21 and 2022-26.
t = mean / standard error of **calendar-month sums of net R** (every month of the window, 0 when no trade entered), one-sided
normal p; Holm over the three OOS p values.

## Pass bar (T1 decides the verdict)
All of: OOS net month t >= 2 and Holm-adjusted p <= 0.0228; the in-sample net mean of the same sign (positive); OOS net
mean positive at 2× costs; both OOS halves positive; the placebo beaten (below). Otherwise FAIL. T2 and T3 are reported
with the same checks but do not decide the verdict.

## Placebo (seeded)
40 draws, seeds 1..40 (`mulberry32`): T1's out-of-sample signals with the side drawn at random (same entry, stop rule mirrored,
exit, costs, one-at-a-time). T1 passes this check only if its OOS net mean beats at least 38 of the 40 draws.

## Baseline (descriptive, not in the Holm family)
"Strong-close weeks" without the outside condition: every 4+-day week with close location >= 2/3 (buy) or <= 1/3 (sell),
same entry, stop past the week's other extreme, 10-day hold, costs, one at a time. Reported IS / OOS with a Welch t of T1's
OOS net R against it, to show whether the outside condition adds anything. Also reported: the T1 buys against the baseline
buys and the T1 sells against the baseline sells.

## What follows
Nothing live. A PASS would be written up as a candidate for its own forward paper record and an owner decision; a FAIL ends it.
