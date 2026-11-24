# Pre-registration: vb-calendar-days (24 Nov 2026)

Written and committed alone, before any trade of this study was computed. Paper research only: nothing live reads or changes.

## Question

Do the two volatility breakouts that passed their own studies (gold T1 and USD/JPY T1: UTC open ± 0.5 × the previous folded
day's range, both sides, stop back at the open, out at 21:00 UTC) behave differently by calendar position?
(a) the turn of the month (TOM) against other days; (b) the weekday (Monday to Friday).

Already answered elsewhere, and NOT this question: `gold-turn-of-month` and `gold-weekday` (buy-and-hold gold by calendar
position), `fx-weekday` (the dollar basket by weekday). None split the breakout's own trades by calendar position (checked by
grep of every vol-breakout RESULT.md, 24 Nov 2026).

## Rules and data (imported, never edited)

- Gold: `gold-vol-breakout-hourcost/original.mjs` (`buildDays`, `daySkip`, `vbTrade`) through `costs.mjs` `tradesIn`, charged
  with `gold-vol-breakout-hourcost/run.mjs` `charge` under route **C1** (the demo broker's measured hourly spread profile and
  commission frozen in `gold-vol-breakout-hourcost/result.json`, plus 0.05 × the fill candle's median range of stop slippage),
  the cost the gold forward record uses. Today's measured relative cost is charged on every year.
- USD/JPY: `index-vol-breakout/original.mjs` (`buildDays`, `daySkip`, `vbTrade`) with `fx-vol-breakout/run.mjs` `charge`
  (0.000045 of the entry + 0.5 pip a round trip, the demo's cost), as `usdjpy-vol-breakout-early` builds its trades.
- Candles: OANDA mid M5 from the shared toolkit's cache (`research/edge/_lib/edgekit.mjs` `load`), rows passed to each rule's
  own `buildDays`.

## Calendar labels (known before the day opens)

- Trading days of a month = the rule's own built days (UTC weekdays with candles; weekends folded) of that calendar month,
  whether or not the day traded. **TOM** = the last trading day of a month and the first three trading days of the next.
  For the last month on file only complete months count as having a "last day" (the last built day of an incomplete month is
  never labelled TOM-last).
- **Weekday** = the UTC weekday of the trade's day (Monday includes the folded Sunday open).

## Windows

- Discovery: 2005-01-01 → 2014-12-31 (gold from its first buildable day in 2006; the gold cache starts 2006-03-19).
- Confirmation: 2015-01-01 → the last complete day on file.

## Tests (four, Holm over the four confirmation p values)

- **T1 gold TOM**, **T2 USD/JPY TOM**: statistic = for each calendar month with at least one TOM trade and one other trade,
  mean net R of its TOM trades minus mean net R of its other trades; month t of that series (two-sided p from t, df = months-1).
- **T3 gold weekday**, **T4 USD/JPY weekday**: Kruskal-Wallis H on per-trade net R across the five weekdays; p by 2,000 label
  permutations (seed 20261124), two-sided by construction. Descriptive only (not part of the verdict): mean net R per weekday,
  and month t of (best weekday minus the rest) on the window's months.

## Pass bar (per test, all needed)

1. The effect has the same direction in both windows (TOM: sign of the mean difference; weekday: the same best weekday by
   mean net R).
2. Confirmation: |month t| >= 2 (TOM) / permutation p < 0.05 (weekday), Holm-adjusted p < 0.05 over the four tests.
3. Discovery: the same test at p < 0.05 unadjusted (replication in the other window).
4. The better subset (TOM or the rest; the best weekday) is positive after costs in BOTH windows, with n >= 200 in
   confirmation.
5. Control: TOM against 40 placebo labelings (each month, 4 of its trading days drawn at random, seeds 1-40): the real
   |confirmation difference| beats at least 38 of 40. Weekday: the permutation p is itself the control.

A pass would only say the breakout's result is uneven across the calendar; it would not be a new rule and would need its own
forward record. Under-powered tests are reported as such; no variant (other TOM windows, other weekdays sets, other k) is run.
