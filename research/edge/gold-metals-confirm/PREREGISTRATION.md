# Pre-registration: a gold 20-day breakout confirmed by the other precious metals (14 Nov 2026)

Written and pushed alone, before any candle of this study was read or any number computed. Paper research only: a
**stand-alone rule on gold**, not a gate, entry, exit or size of the live gold book (Gold trend + Gold daily engulf); it reads
none of that book's positions and does not use its 2006-17 window as a book test (docs/owner-decisions.md item 44). Nothing live
changes.

## Hypothesis and why
A gold breakout to a new 20-day closing high (low) can be a move of gold alone (a dollar move, one gold-specific flow) or part
of a move of the whole precious-metals complex (silver, platinum, palladium also breaking out the same way). A breakout the
complex confirms reflects broad investment demand (or liquidation) for metals, which arrives over weeks; an unconfirmed one is
more often a one-off. So: **confirmed gold breakouts should follow through more than gold does on an ordinary day of the same
side**, and more than unconfirmed breakouts. Precedent: intermarket confirmation in technical practice (Dow's rule that one
average must confirm the other; Murphy, Intermarket Analysis, 2004) and time-series momentum (Moskowitz, Ooi and Pedersen
2012). Neither was opened from this sandbox; no figure of theirs is relied on.

**Separating the signal from gold's drift.** Gold rose over most of 2007-26, so a long-heavy rule can look good by riding that
rise. The primary test is measured **against the unconditional same-side baseline**: every trade's net R minus the mean net R
of the same trade (same side, stop and hold) entered on **every** gold day of the same window. Both sides are traded. The
placebo draws the same number of breakouts at random from all gold breakouts of the same side, so it measures whether the
confirmation adds anything over a plain breakout.

Dedupe (checked 14 Nov against `research/edge`, every remote branch and the untested-backlog proposal): not tested before.
Closest: `gold-silver-divergence` (H1, a 24-hour gold extreme that silver does NOT confirm, fade and follow, held 12 hours),
`gold-currency-breadth` (gold's trend agreeing across six currencies), `pgm-vol-breakout`, `silver-vol-breakout`,
`gold-vol-breakout` (range breakouts), `gold-tsmom`, `gold-adx-trend`, `drd-metals-book`. None conditions a daily gold breakout
on the breakouts of silver, platinum and palladium, holds for weeks, and measures it against the same-side every-day baseline.

## Data (named before any result)
council-data `research/daily/<key>.json` (OANDA mid, UTC days) at the commit of `origin/council-data` when the study runs:
`xau`, `xag`, `xpt`, `xpd`. Weekend candles folded into the next weekday with `council/fills.mjs` `foldWeekend`. A common day =
a UTC day with all four closes. Trades are on XAU/USD only. The market set is these four keys and nothing else.

## Rule
- **Breakout** on common day d (needs 20 earlier common days; a hole over 5 calendar days restarts the count): gold's close
  above the highest gold close of the 20 common days before d = up (+1); below the lowest = down (-1). The same definition per
  metal gives each metal's own breakout days.
- **Confirmation count** of a gold breakout on day d: how many of xag, xpt, xpd had a breakout of the SAME side on d or on one of
  the two common days before d (3-day window). **Confirmed** = 2 or 3; **unconfirmed** = 0 or 1. Only day d and earlier days
  are read.
- **Entry**: the next gold candle's open after day d, in the breakout's direction; one position at a time per stream (a signal
  while that stream's position is open is ignored).
- **Stop**: 2 x ATR(20) of the 20 gold candles before the entry candle = 1R. A candle opening through the stop exits at its
  open, otherwise a touch exits at the stop (stop checked first).
- **Exit**: the close of the 15th gold candle of the trade (entry candle = 1), unless stopped first. No target.
- **Costs**: $0.60 a round trip, plus `nights(entry, exit)` x `FIN.xau.long` x entry price on buys (council/fills.mjs; sells are
  charged and credited nothing). R net = (gross move - costs) / 1R. The cost share (mean costs / mean |gross R|) is reported.
- **Baseline** (per side, per window, per cost multiple): the same trade (side, stop, 15-candle hold, costs) entered at the open
  of EVERY gold candle whose previous common day lies in the window, overlapping, not one at a time; its mean net R = the
  baseline. A trade's **excess** = its net R minus the baseline of its side and window (at the same cost multiple).

## Windows
In sample: signal days 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31. Earlier candles only warm up the
20-day and ATR windows. A trade belongs to the window of its signal day; month sums use its exit month.

## Tests (three, Holm over all three; one-sided normal p from the month-sum t)
- **T1 (primary, decides the verdict)**: confirmed breakouts, both sides, one stream: OOS mean of the calendar-month sums of
  **excess** net R, t on those month sums (months with no trade count as 0).
- **T2**: confirmed minus unconfirmed: month by month, the confirmed stream's excess sum minus the unconfirmed stream's excess
  sum (each its own one-at-a-time stream); t on that monthly difference, OOS.
- **T3**: confirmed breakouts, both sides, raw net R (no baseline): OOS month-sum t.

## Pass bar (T1)
OOS month-sum t >= 2 with Holm-adjusted p < 0.05; in-sample mean excess > 0; OOS mean excess > 0 with costs and financing doubled
(baseline recomputed at 2x); OOS t above at least 38 of the 40 placebo draws. Anything less is FAIL. T2 and T3 are reported with
their Holm p; a pass of T2 or T3 alone is a lead, never a pass of the study.

## Placebo (seeded, 40 draws, seeds 1-40, a fixed linear congruential generator)
For each draw: from all gold breakout days of each side in the OOS window (confirmed or not), draw at random without replacement
as many days as the confirmed stream has signal days of that side; run them through the same one-at-a-time simulation and
baseline; record the OOS T1 t.

## Also reported (not tests)
n, mean gross / net / excess R, win rate, worst drawdown (net R), median stop in dollars (must be $10 or more, else the study says
so), longs and shorts apart, by year, the baselines themselves, and the confirmation counts.
