# Momentum acceleration on spot gold: pre-registration (14 Nov 2026)

Written and pushed **alone, before any candle is read or any trade simulated**. The rule, data, costs, windows, the three
tests, the baseline, the placebo and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. **A stand-alone rule on gold (XAU/USD)**: not a gate, exit, entry or size of the live gold book (Gold
trend, Gold daily engulf, Mosha cycle), never compared with or applied to it, and it does not use the book's 2006-17 window or
its positions (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member changes, whatever
the outcome.

## Question and reason

Gettleman and Marks ("Acceleration strategies", 2006) and Chen and Yu ("Momentum acceleration", 2014, on equities) report that
the CHANGE in momentum (the last half of the lookback against the first half) predicts returns beyond momentum itself: a trend
that is speeding up is bought by late, slow money (trend followers re-sizing, flows into funds after a strong quarter), one
that is slowing down is being abandoned. For gold, plain time-series momentum (`gold-tsmom`), one- and four-week momentum
(`gold-weekly-momentum`), frog-in-the-pan consistency (`gold-frog-momentum`), dual momentum and the 52-week-high rules all
failed. None measured acceleration. The question: does a weekly acceleration reading pick gold's next four weeks, **in both
directions, beyond what an unconditional buy (or sell) of the same week with the same stop and hold makes**? That last clause
is the point: most gold rules here "worked" only by riding gold's rise, so the primary test is the excess over the same-side
every-week baseline.

## Dedupe (read before writing this)

`ls research/edge`, every remote branch name and the shared topics list were read. Nearest: `gold-tsmom` (12-month sign),
`gold-weekly-momentum` (1 and 4-week sign, extreme-week fade), `gold-frog-momentum` (consistency of the path),
`dual-momentum`, `tsmom`, `tsmom-portfolio`, `gold-factor-residual`, `gold-autocorr-switch`, `gold-volvol-switch`,
`gold-regime-switch`. None uses the difference of two consecutive momentum windows. The untested backlog
(`research/proposals/2026-11-14-untested-backlog.md`, branch `untested-backlog`) does not list it. New.

## Data

- OANDA mid daily candles of spot gold, council-data `research/daily/xau.json` at commit `2ad23e383` (read with `git show`, no
  network, nothing cached in the repository). Weekend stubs folded into the next weekday with `council/fills.mjs`
  `foldWeekend` (imported). History starts 2006-03-20.
- Weeks: Monday-based UTC calendar weeks of the folded days; a week's close = its last day's close; the forming last week (not
  ending on a Friday) is dropped. Market set: `xau` only, fixed now.

## Signal (at the close of week k; reads weeks 0..k only)

- `m1 = ln(C[k] / C[k-13])` (the last 13 weeks), `m0 = ln(C[k-13] / C[k-26])` (the 13 before), `A = m1 - m0`.
- `s` = sample standard deviation of the 52 weekly log close-to-close returns ending at week k; `z = A / (s * sqrt(26))`
  (the standard deviation of A under a random walk). Needs k >= 52.
- `z >= 1` → long, `z <= -1` → short, otherwise no trade.

## Trade

- Entry at the open of the first day of week k+1; stop `2 x ATR(20)` (daily true range, the 20 days ending at the signal
  day) from the entry; no target; out at the close of the last day of week k+4 (four calendar weeks) or at the stop. The stop
  is checked on every daily candle from the entry day (low for a long, high for a short); a later day opening through the stop
  fills at that open (gap). **Every trade has a stop.**
- One trade at a time: the next signal is read at the close of the week the trade left (time exit: week k+4; stop exit: the
  week of the stop), entering the week after.
- 1R = the stop distance. Costs, in R: $0.60 a round trip (spread $0.30 + $0.15 slippage a side), plus on buys
  `nights(entry, exit) x FIN.xau.long x entry` (`council/fills.mjs`, imported: the demo broker's swap of 11 Nov 2026, charged
  for every year as the earlier gold studies did; shorts are charged and credited nothing). The cost share (costs / gross)
  is reported.

## Baseline (the same-side every-week buy and sell)

For every week k in the data (the same warm-up, k >= 52), one long and one short trade with the identical entry, stop and
four-week hold, overlapping, no one-at-a-time rule. `b_long(w)` / `b_short(w)` = the mean net R of those trades exiting in
window w. A rule trade's **excess R** = its net R minus the baseline mean of its own side in its own window.

## Windows

In sample: trades exiting 2007-01 to 2016-12 (the signal can first fire in 2007 after the 52-week warm-up). Out of sample:
2017-01 to 2026-10. Only the out-of-sample window decides.

## Three tests (Holm over the three, one-sided)

- **T1 (primary)**: the acceleration rule's excess R (both sides), summed by calendar month of exit over every month of the
  window, t of those monthly sums.
- **T2**: the acceleration rule's own net R (both sides), the same monthly t.
- **T3**: the slower reading (26 weeks against the 26 before, `z = A / (s * sqrt(52))`, k >= 52), excess R as in T1.

## Pass bar (for each test; the verdict is T1's)

OOS monthly mean > 0 with t >= 2 and Holm-adjusted p < 0.05; the in-sample monthly mean > 0 (same sign); the OOS monthly
mean still > 0 at 2x costs and financing (the baseline recomputed at 2x as well for excess tests); the OOS t above the 95th
percentile of the placebo.

## Placebo

40 seeds (mulberry32, seeds 1..40): each test's own trades keep their weeks, and their sides are shuffled among them (same
long / short count); stops, holds and costs recomputed; the excess (or net) monthly OOS t is recorded. Reported as p5 / p50 /
p95 / max and how many seeds fall below the real t.

## Also reported (description, not tests)

Long and short legs apart (net and excess), the baseline itself per side and window, per-year sums, median stop in dollars,
the cost share, and the share of signals that are also plain 13-week momentum signals of the same sign (how much of the
reading is just momentum).
