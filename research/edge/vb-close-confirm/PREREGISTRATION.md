# Pre-registration: the volatility breakouts entered on a close beyond the trigger (vb-close-confirm, 24 Nov 2026)

Paper research only. Nothing live changes and nothing is adopted by this study. Written and pushed alone before any
close-confirmed figure is computed.

## Question

The gold and USD/JPY volatility breakouts (T1: k 0.5, both sides, trigger = the 00:00 UTC open ± 0.5 x the previous
trading day's range, stop at the open, out at 21:00 UTC) fill on a stop order the moment price touches the trigger. Does
waiting for a candle to CLOSE beyond the trigger do better?

Already answered nearby, and not repeated here: `vb-retest-limit` (a limit at the retest: no better), `vb-stop-place`
(other stop places: none better), `gold-vb-exit` / `usdjpy-vb-exit` (exits). No study in `research/edge/` (main or the
research branch) enters on a close beyond the trigger.

## Rule and variants

The rule's own functions come unchanged from `research/edge/index-vol-breakout/original.mjs` (`buildDays`, `daySkip`,
`vbTrade`, `monthT`, `normP`, `holm`, `rng`, `quantile`; sha256 pinned in run.mjs). OANDA mid M5 candles from the shared
cache (`research/edge/_lib/edgekit.mjs` `load`).

- **V0 (touch, the rule):** `vbTrade` as it is: the first touch of either trigger, fill at the trigger (or the gapped open),
  worst case inside the fill candle.
- **V1 (M15 close):** the side is the side V0 takes that day (the first trigger touched). From the 15-minute candle
  (UTC-aligned, built from the day's M5 candles) that holds the touch on, the first 15-minute candle whose CLOSE is beyond
  that trigger (above the upper trigger for a buy, below the lower for a sell) is the entry, at that close. The candle must
  end before 21:00 UTC (a candle ending at 21:00 is no entry). No cancellation: a later close beyond the trigger still
  enters even if price went back to the open in between (the stop only applies once in the trade).
- **V2 (H1 close):** the same with 60-minute UTC candles.
- For V1 / V2: stop at the day's open (as the rule), the rule's own management from the first M5 candle starting at or after
  the entry time (an open beyond the stop exits at that open, a touch at the stop, else the 20:55 candle's close). R is on the
  variant's own risk |entry − open|. A day with no confirming close is "no trade" (0R for the variant on that signal day).
  An entry with |entry − open| = 0 cannot occur (the close is beyond the trigger, which is k x range away).

## Costs (after costs is what is judged)

- Gold: `gold-vol-breakout-hourcost` route C1, frozen from its result.json (half the measured spread of the entry hour + half
  of the 20:00 hour's, commission, + 0.05 x M stop slippage), and overnight financing on longs (council/fills.mjs `nights`,
  `FIN`), as `vb-stop-place` charges it. The entry hour is the confirming candle's close hour for V1 / V2.
- USD/JPY: `fx-vol-breakout` `costPx` (0.000045 x entry + 0.5 pip), MEASURED commission, the 0.5-pip part ASSUMED.
- Cost in R = cost / the variant's own risk (a later entry farther from the open is cheaper in R).

## Windows

Discovery: gold 2007-01-01 → 2014-12-31 (the gold cache starts March 2006; 2007 is the first full year the parent studies
use), USD/JPY 2005-01-04 → 2014-12-31. Confirmation: 2015-01-01 → 2026-11-20. Both windows were read before for the rule
itself; only the variants are new.

## Tests (four, Holm over the four one-sided p)

T1 gold V1, T2 gold V2, T3 USD/JPY V1, T4 USD/JPY V2. Statistic: per signal day (a day V0 trades),
d = variant net R (0 with no entry) − V0 net R; mean d and the t of calendar-month sums of d (`monthT`).

A variant **improves** only if all hold:
1. mean d > 0 in discovery AND in confirmation;
2. confirmation month t of d ≥ 2, and its one-sided p (normal) survives Holm over the four tests (< 0.05);
3. the variant's own net R a trade > 0 in both windows and its confirmation month t ≥ 2;
4. n ≥ 200 variant trades in each window.

Otherwise "no better" (month t of d ≤ −2 is reported as "worse"). Passing would make a candidate for a forward record only,
on years already read for the rule.

## Gate (before any reading)

V0 must reproduce `vb-stop-place`'s O rows (that study dropped 0 days for its ATR history, so its rows are every T1 day):
gold 2007-14 n 1467 +0.205R, 2015 → 2026-11-20 n 2250 +0.098R; USD/JPY 2005-14 n 1894 +0.092R, 2015 → 2026-11-20 n 2275
+0.055R; and `gold-vol-breakout-hourcost` C1 POOLED 2007-01-01 → 2026-11-12 n 3713 +0.139R. A failed gate stops the run.

## Control (reported, not in the verdict)

The same delay on random entries: 40 seeds of the parent placebo (`rng`, a random start time 01:00-18:00 UTC and side, as
`vb-stop-place`'s `placeboOf`); the "trigger" is that candle's open P, stop at P − side x 0.5 x the previous range; touch
entry at P against an entry at the first M15 / H1 close beyond P. Reported: the median and 5-95 % band of mean d over seeds,
and whether the T1 d lies inside it.

## Reporting

Per market, variant and window: n, fill share of signal days, win rate, gross R, net R, net at 2x cost, cost in R, month t,
mean delay from touch to entry, mean d and its month t. Verdict line first. Never "edge"; a before-cost tilt is not an edge.
