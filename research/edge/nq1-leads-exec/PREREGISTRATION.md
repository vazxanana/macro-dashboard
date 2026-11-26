# Pre-registration: nq1-leads-exec (26 Nov 2026)

Paper research only. Nothing live changes, nothing is placed, no rule is proposed. Written and pushed alone, **before any broker
tick of these orders is read**. Owner's request (26 Nov 2026): "re price the nasdaq leads at fusion real quotes".

## Why

The auto-researcher's NAS100 worker ran at NO cost (owner: futures), so every Nasdaq lead is a mid-candle figure before costs.
Both USD/CHF leads re-priced so far lost their result at the broker's quotes (`usdchf-blk-exec`, `usdchf-fade-exec`). This study
fills the Nasdaq leads' own orders at the demo broker's (Fusion Markets) NAS100 bid and ask. The rules were found on these same
years, out of several hundred million tries: a PASS is a candidate for a forward record, never an edge.

## The rules (unchanged)

Six rules, `orders.mjs` `LEADS`: the five frozen genomes of the NQ1 desk (`council/edge-desks-2.mjs` `NQ1_LEADS`: l1, l2, l4, l5,
l6) and l3, the rule of `nas100-brk-long-focus`. H1 candles built from the 5-minute cache, entry at the next hour's open, one
position at a time per rule. Gate, on candles before any tick: `orders()` equals the engine's `simulate` for every rule (n and
mean R identical). Window = the broker's tick history: entries 2023-12-01 to 2026-11-20; an order whose time limit runs past the
candles on file is left out. Counted on mid candles, before costs:

| Rule | Orders | Mid R a trade |
|---|---:|---:|
| l1 stretch + 10-hour breakout, long | 380 | +0.309 |
| l2 stretch + 20-hour breakout, long | 360 | +0.223 |
| l3 20-hour breakout with the trend, long | 277 | +0.243 |
| l4 double stretch with the trend, 4 h | 340 | +0.144 |
| l5 double stretch, high volatility, long | 330 | +0.311 |
| l6 big candle + stretch | 699 | +0.080 |

(gate figures include the 1-4 orders a rule loses to the cut; 2,386 orders in all, 1,317 distinct entry moments.) The rules
overlap heavily (most are long the same up-moves): they are not six independent results and their totals do not add.

## The measurement (`council/tick-probe.mjs`, the `usdchf-fade-exec` method)

Pass 1 (marks): the quote at each entry moment (looked for up to 60 s before it). A buy fills at the ask, a sell at the bid: A.
No entry quote = entry unresolved (left out, counted). Pass 2 (fills), only after A is known: stop X = A - s x D (D = the mid
risk), target T = A + s x rr x D; the first tick on the CLOSING side crossing each level, in windows of at most 1,800 s over the
5-minute candles that come within N = 3 points of a level (15 points inside 20:55-23:04 UTC, the daily break). A stop books at
the tick's closing price (a gap fills worse), a target at T. Pass 3 (marks): for orders with neither by the time limit, the quote
at the limit (up to 3,600 s before it). Exit unresolved = left out, counted.

R on ticks = s x (exit - A) / D. NAS100 pays no commission on this account. **Financing** (not in the ticks): a long pays 0.62
index points a night held over 22:00 UTC (the broker's own swap, -6.2 pips of 0.1; three nights on Friday), a short is credited
nothing. **Net R = tick R - financing / D.** Today's rate is charged for every year.

## Tests and verdict

Per rule, net R a trade over its resolved orders, t of calendar-month sums. Six tests, Holm over the six one-sided p values
(normal approximation of the month t).

- A rule **PASSES** with mean > 0, month t >= 2, Holm p < 0.05, at least 100 resolved orders, exit-unresolved at most 10 % of
  the entry-resolved. **INCONCLUSIVE** (that rule) over 10 % unresolved; **TOO FEW** under 100; **FAIL** otherwise.
- The study's verdict: the count of rules that pass, "n of 6".

Reported beside, none of it a verdict: tick R before financing; mid R; tick minus mid per order; the entry spread in R (median,
90th percentile); financing in R; each year; each side; the exit mix; orders open over the 21:00-22:59 UTC break against the rest.

Power, said now: per-trade sd is 1.4 to 2.2R, so with 280-700 orders a month t of 2 needs roughly +0.13R to +0.25R a trade. l6
(+0.08R on mid) and l4 (+0.14R) cannot pass even if filled faithfully; l1 and l5 can. What the study decides for every rule is
how much the broker's quotes and financing take from the mid figure. Expected, said now: the measured NAS100 spread is 0.8
points against a median risk of 50-70 points (about 0.013R), so unless fills at the daily break or gaps are much worse, the cost
alone should not remove these results; the open questions after this study remain that the rules are one bull market found in
six forms, picked in sample.

One run. No variant of a rule, window or allowance on these years after the result. Deliverables: `orders.mjs`, `run.mjs`, the
mark and query files, `RESULT.md`, `result.json`, `tests/nq1-leads-exec.test.mjs`.

## Amendment (26 Nov 2026, before any R on ticks was computed or read)

Pass 2 as written found no stop or target for 557 orders that the candles say were closed. Cause, measured on the entry quotes
alone: the broker's NAS100 is not on the candle feed's price basis. Broker mid minus the candle's open at the entry moment has a
median of -15.9 points (1st to 99th percentile -82.9 to +8.9), so a window chosen where the CANDLES come within 3 points of a
level misses the broker's own crossing, and the scan stopped at a candle that was "clearly through" only on the candle feed.
Only the count of unresolved orders and this basis were looked at; no tick R, mean or verdict was computed.

Changed, the measurement only (rules, levels, test, bar, financing unchanged; levels are still exact broker prices):

- Each order's basis b0 = the broker's mid at the entry quote minus the candle's entry open. A level L (a broker price) is
  looked for on candles at L - b0.
- A 5-minute candle is "near" a level within N = 10 points + 1 point for each day since the entry (the basis drifts as the
  quarter's futures premium decays; 25 + 1 a day inside 20:55-23:04 UTC). The scan ends only at a candle through a level by
  more than 3 x N.
- The pass-2 file already read (tag nq1-fills-1) is not used; the new queries are read under tags nq1-f2-<k>.
- If, after this, more than 10 % of a rule's entry-resolved orders are still unresolved, that rule is INCONCLUSIVE as already written.
