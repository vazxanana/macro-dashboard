# Pre-registration: usdjpy-vb-manage (24 Nov 2026)

Paper research only. Does managing the open position help the USD/JPY T1 volatility breakout (UTC open ± 0.5 × the previous
day's range, stop back at the open, out at 21:00 UTC), which passed after costs in `usdjpy-vol-breakout-early` (2005-15),
`fx-vol-breakout` (2016 → now), `usdjpy-vol-breakout-exec` (the demo broker's own ticks) and was BROAD in `usdjpy-vb-k` and
`usdjpy-vb-exit`? Three ways of managing the SAME trades are compared with the rule's own exit.

Written and pushed alone, before any managed figure was computed. Before writing it, only the harness gate below was run (it
re-computes the two published figures of the rule from the candle cache named under Data, and reproduced them exactly:
early n 2,089 +0.079R, late n 2,079 +0.063R); no figure of any management variant was computed.

## What this study is NOT

- It does not change the rule's entry, side, order window, day, k or exit time. **No variant ever moves the stop further from
  the entry than the rule's own stop (the open)**: the stop only moves towards the trade, never away (a test checks every
  stop move).
- Nothing is adopted. A variant that looks better is a candidate for the owner, never a live change, and every year here has
  already been read for this rule (in sample for the rule itself).
- No council member, desk, page or config reads this study.

## The rule (imported, unchanged)

`research/edge/index-vol-breakout/original.mjs` (sha256 afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f):
`buildDays`, `daySkip`, `vbTrade`, `placeboTrade`, `rng`, `normP`, `holm`, `summary`. Cost: `research/edge/fx-vol-breakout/run.mjs`
`charge` (commission 0.000045 of the entry + 0.5 pip a round trip, the cost every USD/JPY study used; 2x reported). The day loop
is `usdjpy-vb-exit`'s `tradesExit` (imported). No financing (nothing is held over the 17:00 New York rollover).

## Data and windows

OANDA mid USD/JPY M5 from the shared candle cache read by `research/edge/_lib/edgekit.mjs` `load('usdjpy', '5m')` (rows
`[t, o, h, l, c]`, out of git). Windows as the parent studies, so the gate is exact: **discovery 2005-01-04 → 2015-12-31**
(the years of `usdjpy-vol-breakout-early`), **confirmation 2016-01-01 → 2026-11-19** (the years of `fx-vol-breakout`, as
`usdjpy-vb-exit` cut them). These are the parent studies' windows rather than 2005-14 / 2015 → now, so that the gate reproduces
published figures exactly.

## Harness gates (each must hold before any variant figure is read; else the study stops and reports)

1. The rule from these candles: early n 2,089, net +0.079R; late n 2,079, net +0.063R (3-decimal figures as published).
2. The management walker with no management ("rule") gives, trade for trade, the same exit, exit time and R as `vbTrade`.

## Management (applied to each rule trade from the candle AFTER its fill candle)

The fill candle is handled as the rule handles it (if it reaches the stop, the trade is stopped there, worst case) and never
moves a stop or takes a partial: its favourable extreme may have printed before the fill. From the next candle, in this order
on each candle: (a) an open beyond the current stop exits at the open; (b) a touch of the current stop exits at the stop;
(c) PH1 only: a touch of entry + 1R (side-signed) closes half at exactly entry + 1R (stop first when one candle holds both);
(d) the best price is updated with the candle's favourable extreme and the stop for the NEXT candle is set (never within the
same candle). The last candle of the day (ending 21:00 UTC) closes what is left at its close, as the rule does.
1R = |entry − open| (the rule's risk). R is per unit of the original position.

- **BE1**: once the best price has reached entry + 1R, the stop is moved to the entry.
- **TR1**: once the best price has reached entry + 1R, the stop trails 1R behind the best price (stop = best − 1R for a buy,
  best + 1R for a sell), moved only towards the trade.
- **PH1**: half closed at entry + 1R; the other half keeps the rule's own stop and 21:00 exit.

The cost per trade is the same as the rule's (it depends on entry and r only), so a variant's difference with the rule is the
same before and after costs; net, gross and 2x cost are all reported.

## Tests (three, Holm over the three)

For each variant V, per trade d = net(V) − net(rule) on the same trade. Primary statistic: the t of the calendar-month sums of
d in the confirmation window (2016 → 2026-11-19), one-sided p from the normal tail (`normP`), Holm over BE1, TR1, PH1.

A variant **IMPROVES** the rule only if all hold:
1. mean d > 0 in discovery AND in confirmation;
2. confirmation month-sum t of d ≥ 2 and its Holm-adjusted one-sided p < 0.05;
3. the variant's own net R a trade > 0 in both windows, and its confirmation month-sum t of net ≥ 2;
4. n ≥ 200 in each window.

A variant whose confirmation month t of d is ≤ −2 is called **WORSE**; otherwise **NO BETTER**. The study verdict is PASS if
at least one variant IMPROVES, else FAIL.

## Control (reported, not part of the verdict)

The same three managements applied to the parent studies' placebo trades (the original's `placeboTrade`: a random 5-minute
start 01:00-18:00 UTC and a random side on every tradable day, stop 0.5 × the previous range away, out at 21:00 UTC; 40 seeds,
`rng` seeds 1-40 in `usdjpy-vol-breakout-early`'s order), with the same walker and the same cost. Reported: the mean d of each
management on the placebo trades (median and 5-95 % over seeds) against T1's d. If T1's d is inside the placebo's 5-95 %
band, the change is said to be what this management does to any USD/JPY intraday trade, not something particular to the
breakout.

## Also reported

Per variant and window: n, win rate, gross / net / 2x-cost net R a trade, month t, max drawdown, how many trades reached
+1R, and by year net R.

## Files

`run.mjs`, `RESULT.md` (verdict line first), `result.json` (sha256 of this file), `tests/usdjpy-vb-manage.test.mjs`
(walker unit tests, stop never moved away, gate figures, result.json figures).
