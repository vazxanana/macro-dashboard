# Pre-registration: fade-condition-stack (24 Nov 2026)

Paper research only. Nothing live changes, nothing is placed, no rule is proposed from it. Written and pushed alone, before the
code that stacks the conditions on the three fade rules is written or run.

## Why

`fade-conditions` split the M15 break fade by fixed conditions and found, before costs, that it lives in the evening (break
candle 20-23 UTC beats 08-11 UTC by +0.153R a trade in 2015-26, Welch t 12.47), in a low volatility regime (low minus high
+0.055R, t 6.23) and on Mondays (Mon minus Tue +0.033R, t 3.34); daily trend and body did not pass on the M15 rule.
`fade-hour-check` showed the evening tilt survives with the rollover fills (21:00-22:59 UTC) left out; `evening-methods` found
the faded M15 box close-out also lives in the evening. `fade-late-hourcost` charged the 20 / 23 UTC fills of the plain M15 fade
at the demo broker's measured hourly spreads and found -0.071R a trade (n 3,179, month t -2.65). The open question: does
STACKING those named conditions lift any of the three Equinox fade rules above its measured evening cost?

**These years and conditions were already read** by the studies that named them: this is a test of a combination of
conditions chosen on the same history, so even a PASS is a hypothesis for a forward paper record only, never evidence of an edge.

## The three rules (imported, never edited)

Exactly the Equinox desks' readings, from `council/edge-desks-2.mjs` (which runs each study's own exported signal code):

- **Fade** `fadeTrades`: grid7-wide-fade cell `m15 none atr 2R all` (fade the first M15 structure break at the next 5-minute
  open, stop 1 x ATR(14) of M15, target 2R, out after a day).
- **Big** `bigTrades`: big-candle-fade cell `m15 k1.5 nobreak half` (an M15 candle with a body over 1.5 x ATR(14) and no break
  the same way, faded to its 50 %, stop past its extreme + 0.1 ATR; only when the 50 % is 1R or more away).
- **Box** `boxTrades`: fade-breaks-holdout rule F1 (an M5 box close-out of the H1-M15-M5 box chain outside 07-17 UTC, faded,
  1R).

Each record's fill, stop, exit time, exit kind and R come from the adapter's `walk` (the studies' order of checks). Unfinished
trades are dropped. Fills inside a `combo-grid-2` data-quality exclusion are dropped. The adapters' own skip (risk under the flat
`combo-grid-2` round trip) stays as part of each rule.

## Markets and cost

Judged (primary) = the markets whose hourly spread is MEASURED at the demo broker:

- **xau** and **usdjpy**: median (ask - bid) / mid by UTC hour from `research/edge/fade-late-hourcost/profile.json` (the
  broker's own quotes at this fade's fills and exits, council-data commit 3e30f22b6), commission 0.000024 (gold) and 0.000045
  (USD/JPY) of price a round trip (the broker's commissionRT, as `fade-late-hourcost`).
- **xag**: the `hourProfile` of council-data `research/probe/ticks-XAGUSD.json` (commit 19c2477d5b; first two minutes of each
  UTC hour, 44 days); commission **ASSUMED** 0.000024 (gold's; silver's is not on file).

Cost of a trade, as a share of price (`fade-late-hourcost` `costFrac`, imported): half the spread of the fill's UTC hour + half
the spread of the exit's UTC hour + the commission + another half spread of the exit hour on a stop exit; in R = that x fill /
risk. Today's measured spreads are charged on every year (the past spreads are not known).

Reported, not judged: the other seven Equinox fade markets (eurusd, gbpusd, audusd, nzdusd, usdcad, usdchf, eurjpy), which have
NO measured hourly spread on file (every forex probe file carries an empty `hourProfile`): charged one flat round trip
(`combo-grid-2` `COSTS`: demo figures for the three majors, **ASSUMED** for nzdusd, usdcad, usdchf, eurjpy).

## The stacks (fixed now; at most three)

Hour = the UTC hour the SIGNAL candle starts (the M15 break / big candle; the M5 box candle). Volatility level = `fade-conditions`
`volLevel` on the M15 ATR(14) of the last M15 candle closed by the signal time (low < 0.8 x its 100-candle median). Day =
`fade-conditions` `dowLevel` of the signal candle (Sunday counts as Monday). Fill hour = the UTC hour of the fill.

- **S1 evening, no rollover**: signal hour 20-23 AND fill not in 21:00-22:59 UTC.
- **S2** = S1 AND volatility level low.
- **S3** = S2 AND Monday.

Control (beside each test): the same rule with no stack. Placebo (reported): S1's shape in the day block (signal hour 08-11).

## Windows and tests

Discovery 2005-01 to 2014-12 (the window in which `fade-conditions` picked the levels); confirmation 2015-01 to 2026-10 (the
parent studies' windows). Pooled over the three judged markets. Nine tests: 3 rules x 3 stacks.

A test PASSES only if, AFTER the measured costs: (1) mean R a trade > 0 in discovery AND in confirmation; (2) in confirmation
n >= 200 and the month-sum t (calendar months 2015-01..2026-10, empty months 0) has a one-sided p that stays under 0.05 after Holm
over the nine tests, i.e. roughly t >= 2 after Holm; (3) its confirmation mean after costs is above the unstacked control's.

Verdict: PASS if at least one test passes, FAIL if none does; INCONCLUSIVE if the gate fails. Every figure is also shown before
costs; a before-cost tilt is not an edge.

## Gate and checks

- The fade rule's xau and usdjpy trade counts 2005-26 (no stack) within 5 trades of `fade-late-hourcost`'s gate (35,212 /
  38,596); else INCONCLUSIVE.
- Every trade has its stop on the losing side (the run throws otherwise).
- Cut test: the S1-S3 tags of signals known by a date equal on candles cut at that date.

One run, no variants.
