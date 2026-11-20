# Pre-registration: gotobi-exec (20 Nov 2026)

Paper research only. The gotobi study's T2 (the fade: sell USD/JPY at 00:55 UTC on a gotobi day, buy back at 06:00 UTC, stop
1.5 × the 20-business-day median move), **unchanged**, priced at the demo broker's own **executable** quotes instead of OANDA
mid plus an assumed cost. Nothing live changes: the demo job (`council/gotobi.mjs`, owner item 61) is not touched by this study.

Written and pushed alone, **before any of its data is read**: the broker's USD/JPY quotes at the gotobi minutes of past days
will come from a later run of the tick probe (`council/tick-probe.mjs`, extended for these marks in the same pull request as the
code of this study, after this file). The only USD/JPY quotes the author has seen are the council's own spread log
(`ctrader/symbols.json` `watch.USDJPY.windows`, 16-20 Nov 2026: 0 to 0.2 pip at 00:55 and 06:00), which this study does not use.

## Why

`gotobi` PASSED T2 (2016 → Nov 2026: +0.148R a trade net, n 771, month t 2.74; replicated 2010-15) with an ASSUMED cost of about
2 pips a round trip. `gotobi-cost` put break-even at 3.73 pips and "month t ≥ 2" up to 1.95 pips, and could not measure a yen
spread at the fix; `gotobi-duka-spread` could not read Dukascopy. The multiple-testing update keeps gotobi as the one hypothesis
standing, "not a net edge until the broker spread at the fix is measured". This study measures it, on every past gotobi day the
broker's tick history reaches, and prices the trade at it.

## Data

- **Broker quotes**: council-data `research/probe/ticks-USDJPY.json`, part `gotobi` (commit named in result.json): for every gotobi
  day inside the history, the last bid and ask at or before 00:55:00 and 06:00:00 UTC, and the median quoted spread in ±60 s.
- **OANDA mid M5 USD/JPY** through the candle proxy (as the gotobi study, kept out of git): D, and the path for the stop.
- Calendar, D, entry / exit times and the stop rule: `council/gotobi-calendar.mjs` and `council/gotobi.mjs`
  (`stopDistance`, `RULE`), which the demo job uses and whose tests pin them to the study.

## The trade, priced three ways on the same days

- **E (executable)**: entry = the broker BID at 00:55:00, exit = the broker ASK at 06:00:00; stop = entry bid + D. The stop is
  checked on the OANDA M5 highs (mid) from the 00:55 candle through the last candle before 06:00, the study's rule; a hit fills
  at the stop plus half that day's measured spread (the mean of its two marks' medians). Commission 2 × 22.5e-6 × price.
  R = (entry − exit) / D; net R = R − commission / D.
- **E+**: E with 0.3 pip of extra slippage a side (a fill one tick away).
- **M (mid, the study's way)**: OANDA mid, the study's cost model (0.3 pip + 2 × 0.5 pip + commission): the same days, as the
  study priced them.

A day enters only when both marks have a quote (within 60 s before the mark) and D exists (15 of 20 prior days); others are
counted.

## What is reported, and the reading fixed now

1. **The measured cost**: per day, spread at 00:55 and 06:00 (pips); median, 90th percentile, max; their round-trip cost in
   pips with commission, against the study's assumed 2.0 and the break-even 3.73.
2. **Feed agreement**: correlation of E and M gross R by day, share of days with the same sign.
3. **Net R a trade under E, E+ and M**, n, win rate, per-trade t and month-sum t.

Verdict:
- **COST MEASURED**: the median round-trip cost under E is under 1.95 pips (the study's t ≥ 2 line) → "the cost does not undo
  the study's result"; otherwise "the cost is a real threat", with the figure.
- **Return on executable quotes**: judged only if n ≥ 150; then PASS when E net R > 0 with month t ≥ 2 and E+ net R > 0.
  With n < 150: "too few to judge the return; the cost is the finding". Nothing else is concluded from the return on a short
  history (at the study's mean and spread, about 300 trades are needed for t 2).

## Deliverables

`research/edge/gotobi-exec/{PREREGISTRATION.md, run.mjs, RESULT.md, result.json}`, the probe's `gotobi` part in
`council/tick-probe.mjs`, tests.
