# Pre-registration: gold's T1 volatility breakout on USD/CNH (24 Nov 2026)

Written and pushed alone, before any USD/CNH 5-minute candle was fetched for this study and before any trade was computed.
Paper research only: nothing live changes.

## Question

Does the T1 volatility breakout that passed on gold and on USD/JPY hold on USD/CNH (offshore yuan)? Checked first: no study in
`research/edge/` runs T1 on USD/CNH (`fx-vol-breakout` ran six majors, `yen-crosses-vol-breakout` the yen crosses; `cnh-fix`
tested the 01:15 UTC fix window, `gold-yuan-hedge` gold after yuan moves). Prior: low. T1 failed on five of six majors, on the
yen crosses pooled, on indices, metals other than gold and energies; and `cnh-fix` found the assumed USD/CNH round trip several
times larger than what a clock rule earns.

## Rule (unchanged)

`vbTrade`, `buildDays`, `daySkip`, `placeboTrade`, `summary`, `rng` imported from `research/edge/index-vol-breakout/original.mjs`
(sha256 `afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f`, checked at run time; the run stops if it differs).
k 0.5, both sides: on each UTC weekday, a buy stop at the 00:00 UTC open + 0.5 x the previous trading day's range, a sell stop at
the open − 0.5 x it; the first touched fills (gap fills at the candle's open); stop = the UTC open (every trade has one); out at
21:00 UTC or the stop; one trade a day. Days the original skips (no previous day, a flat previous day, no candle in the first
hour, fewer than 200 candles before 21:00) are skipped. No financing is charged (out before the 22:00 UTC rollover; the
original only charges gold longs held overnight).

## Data

OANDA mid USD/CNH (`usdcnh`) M5 candles through the site's candle proxy, from 2011-02-01 to the run, kept outside git in the
scratchpad. Only complete days: the last calendar day on file is dropped.

## Cost (ASSUMED, not measured)

Commission 0.000045 of the entry price + 3 pips (0.0003) a round trip, charged in R as cost / risk. The demo broker's file has no
USDCNH (as `cnh-fix` found), so this is an assumption, not a measurement. A 2x-cost line is reported and is part of the bar.

## Windows

- Discovery: from the first complete month with candles (USD/CNH M5 starts 5 Feb 2011; the original's 200-candle rule drops the
  sparse early days by itself) to 2017-12-31.
- Confirmation: 2018-01-01 to the last complete day.

## The test (one)

T1 on USD/CNH, net of the cost above, t on calendar-month sums (`summary`). One test, so Holm over all tests is the test itself.

**Pass bar (all must hold):**
1. Net R a trade > 0 in discovery AND in confirmation.
2. Confirmation month-sum t >= 2.
3. Confirmation net R a trade > 0 at 2x cost.
4. Confirmation n >= 200.
5. Placebo: 40 seeded placebos (the original's construction: a market entry at a random 5-minute candle 01:00-18:00 UTC, random
   side, stop 0.5 x the previous range, same exit and cost) on the confirmation window; the rule's confirmation net R a trade
   must beat at least 38 of 40.

Verdict words: PASS if all hold, else FAIL with the checks that failed; TOO FEW TO JUDGE if confirmation n < 200.

## Reported, descriptive only (no verdict)

- Gross R, net at 2x cost, by year, buys / sells.
- Correlation of monthly net R with USD/JPY T1 (same functions, the `fx-vol-breakout` cost: 0.000045 of the entry + 0.5 pip;
  USD/JPY M5 from the shared research candle cache), over common months, whole span and confirmation.

A pass would be a hypothesis for a forward paper record with a measured cost, never a live rule and never called an edge.
