# Pre-registration: the breakout of gold's multi-day consolidation box (14 Nov 2026)

Written and pushed alone, before any trade of this rule was computed. A new stand-alone rule on spot gold: it is not a gate,
exit, entry or size change of the live gold book (Gold trend / Gold daily engulf), and none of that book's positions (2006-17 or
later) is read (docs/owner-decisions.md item 44). Paper research only: nothing live changes and no proposal is written whatever
the result.

## Hypothesis

When gold's last five trading days have traded in an unusually narrow box (a five-day range well under its usual five-day
range), the break of that box starts a move that carries further than its stop: a buy-stop above the box and a sell-stop under
it, stop at the box's other side, earns more than costs, both sides together.

## Why not a duplicate

Nearest studies (each read before choosing): `gold-squeeze` (Bollinger inside Keltner, release by a close beyond a band, stop
1.5 ATR, exit at the middle line), `nr7-breakout` (one narrowest day of seven, pooled over six markets), `gold-inside-week`
(a weekly inside bar, NR4 week, Monday range), `gold-range-expansion` (follow a wide day), `gold-vol-breakout` (open ± k x the
prior range, intraday). None trades a five-day box chosen by its height against the market's own usual five-day range, with
resting orders at the box edges and the stop at the opposite edge. No line of the shared topics list names a box or
consolidation breakout.

## Data (named before any result)

- One market: spot gold, OANDA mid XAU/USD H1 candles through the council's candle proxy (cache kept outside git, March 2006 to
  13 Nov 2026). Days are UTC days built from the H1 candles; hours on a Saturday or Sunday belong to the next Monday (the
  Sunday reopen stub is part of Monday, as `council/fills.mjs` `foldWeekend` does on daily candles).
- Entries from 2007-01-01 (the first 65 days are warm-up) to 2026-10-31. In sample: entries 2007-01-01 to 2016-12-31. Out of
  sample (decisive): entries 2017-01-01 to 2026-10-31.

## Rule

At the close of each completed day d (no candle of day d+1 or later is read for the signal):

- Box: Hb = the highest high and Lb = the lowest low of days d-4 .. d (five days); h = Hb - Lb.
- Usual five-day range: U = the mean of the five-day range (high - low over five days) for the 60 windows ending on days
  d-60 .. d-1.
- Signal when h < 0.6 x U (T1, T2) and no order of the same test is resting and no position of it is open.
- Orders: a buy-stop at Hb and a sell-stop at Lb, valid for the next 5 days (d+1 .. d+5), read hour by hour on H1. The first
  touch fills (buy: the first hour with high >= Hb, fill at max(Hb, that hour's open); sell mirrored) and cancels the other
  order. If one hour touches both levels, it is booked as a full loss: -1R (worst case, no order of touches is known).
- Stop: the box's other side (buys Lb, sells Hb). Every trade has it. 1R = |fill - stop|. A stop gapped through fills at the
  hour's open.
- Exits: T1 a target 2R from the fill; T2 no target. Both: a time exit at the last H1 close of the 20th day after the fill day.
  When an hour holds the stop and the target, the stop is taken first.
- One test at a time: each test is its own one-position stream.

## Tests (three, Holm over the three)

- **T1 (primary)**: the five-day box, both sides pooled, stop at the other side, 2R target, 20 days.
- **T2**: the same box and orders, no target (stop or 20 days).
- **T3**: a ten-day box (days d-9 .. d, against the mean ten-day range of the 60 windows ending d-60 .. d-1, h < 0.6 x U), T1's
  orders and exits.

Both sides are always traded, so every test is both-sided; buys and sells are also reported apart (not tested).

## Costs

- $0.30 spread + $0.15 slippage on the entry (a stop order) + $0.15 on the exit = $0.60 a round trip, taken off each trade in R
  of its own risk: 0.60 / r0. A target exit pays the same $0.15 (conservative).
- Financing on buys only: `nights(fill, exit)` x `FIN.xau.long` (0.000148 a rollover, the demo broker's XAUUSD swap of 11 Nov
  2026, `council/fills.mjs`; today's rate charged for every year) x fill / r0. Sells are charged and credited nothing.
- 2x costs doubles the $0.60 and the financing.
- Cost share reported up front: the median r0 in dollars and the median cost in R of each test.

## Statistics and the pass bar

- Net R a trade, n, win rate, total, worst drawdown; t on calendar-month sums of net R (exit month; months with no trade count
  as 0 between the first and last month of the window), gross t the same way.
- p two-sided from the normal approximation of the month t; Holm over T1-T3 on the out-of-sample p.
- Placebo, 40 seeded draws (seed 1..40): for each draw, signal days are drawn at random from all eligible days of the window
  (same count as the test's signals in that window, one stream at a time as the rule), the box is the five days before as in T1
  but with no height condition, T1's orders and exits. The placebo statistic is the out-of-sample net R a trade.
- **Pass** (T1 decides; T2 / T3 can only be reported as passing or not): out-of-sample net month t >= 2 with Holm p <= 0.05,
  in-sample net R a trade > 0, out-of-sample net R a trade > 0 at 2x costs, and T1 above at least 38 of the 40 placebos.
  Anything less is FAIL. Even a pass is a lead, not an edge, until replicated on data it did not use.

## Deliverables

`run.mjs` (pure functions exported for the test; `node run.mjs fetch <dir>` / `node run.mjs full <dir>`), RESULT.md and
result.json written from the run, `tests/gold-box-breakout.test.mjs` (hand-made candles, no look-ahead, report against
result.json), `out/` rebuilt. Nothing outside `research/edge/gold-box-breakout/`, its test and `out/` is touched.
