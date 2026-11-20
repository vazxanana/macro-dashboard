# Pre-registration: fx-weekend-gap-exec (20 Nov 2026)

Paper research only. The forex Sunday-open gap fade, **Rule G frozen** (`research/edge/fx-weekend-gap-replicate2/frozen.mjs`, sha256
3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273, which is #880's rule byte for byte), charged the demo broker's
**measured** quoted spread at each trade's own entry minute and exit minute, instead of the assumed 0.3 pip + 2 pips of slippage.
Nothing live changes.

Written and pushed alone, **before any broker quote at a reopen is read**. The trades themselves come from OANDA mid candles of
years the earlier studies already read (2023-26 is inside #880's, #928's and #938's decisive windows): the new information is only
the cost. The author has seen the council's own spread log (majors quoted 0.0-0.1 pip on weekday reads, 2.0 pips on USD/CAD and
USD/CHF at the 17:00 New York rollover), which is why the reopen was assumed expensive.

## Why

The backlog of 14 Nov lists the Sunday-gap fade among the leads "waiting on a measured spread". #938 S2 made +0.153R a trade after
its assumed cost (n 481, month t 3.19) but kept only +0.066R at 2 pips a side and +0.013R at twice the cost. The reopen is the
widest-spread minute of the week, and no study measured it. The demo's tick history reaches about three years (tick probe, 20 Nov).

## Trades

Rule G of `frozen.mjs`, unchanged, on OANDA mid M5 through the candle proxy, on 18 pairs pooled: #880's majors (EUR/USD,
GBP/USD, USD/JPY, AUD/USD, USD/CHF, EUR/JPY), #928's crosses (EUR/GBP, GBP/JPY, AUD/JPY, EUR/AUD, GBP/AUD, EUR/CHF) and #938's
S2 pairs (NZD/USD, USD/CAD, CAD/JPY, NZD/JPY, AUD/NZD, AUD/CAD). Weeks whose Friday falls inside the broker's history (from the
first Friday after the probe's reach start) to 13 Nov 2026. Entry at the close of the reopen candle (`filled`), exit at `exitT`
(target, stop or Monday 12:00 New York).

## The measurement

A probe run reads, for every trade, the demo's last bid and ask at or before the entry mark and the exit mark, and the median
quoted spread in ±60 s of each (the probe's `marks` part; the mark list is made from the trades above and committed with this
study's code). A pair the demo does not list is dropped (said). A trade whose entry or exit mark has no quote within 120 s is
dropped (counted).

## Cost and R

R = the frozen rule's gross R on mid. Cost in price = half the measured spread at the entry mark + half the measured spread at the
exit mark + commission 2 × 22.5e-6 × entry. Net R = R − cost / r0. Stress: plus 0.5 pip of slippage a side.

## Reading, fixed now

- **The cost**: the median measured round trip in pips at these marks, against the studies' assumed 2.3 pips + commission.
- **PASS** (one test, pooled 18 pairs): net R > 0 with calendar-month t ≥ 2, n ≥ 150, and net R > 0 under the stress cost.
  Else FAIL; with n < 150, "too few to judge".
- This is not independent evidence for the rule (the years were read before); a pass says the measured cost does not undo the
  earlier studies' result over the last three years.

## Deliverables

`research/edge/fx-weekend-gap-exec/{PREREGISTRATION.md, marks.json, run.mjs, RESULT.md, result.json}`, the probe's `marks` part,
tests.
