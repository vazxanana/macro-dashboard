# Pre-registration: fade-tick-exec (23 Nov 2026)

Paper research only. Nothing live changes, nothing is placed, no rule is proposed from it. Written and pushed alone, **before
any broker tick of these orders is read** (and before the query files are written).

## Why

`research/edge/grid7-wide-fade` found that fading the first M15 structure break (entering AGAINST it at market) makes a
small positive R a trade before costs on OANDA **mid** 5-minute candles, in both 2005-14 and 2015-26 (pooled over ten markets:
`m15 none atr 2R all` +0.042R a trade in 2015-26, month t 11.33; `m15 none ext swing all` +0.158R, t 15.46), and loses after the
assumed costs. A mid candle is not a fill: a market buy pays the ask, a stop is hit when the bid reaches it, a target when the
bid reaches it. On the two markets studied here the mid figures are already small (2015-26, `perMarket` of that result:
atr 2R xau +0.004R, usdjpy -0.005R; ext swing xau +0.024R, usdjpy +0.081R). This study prices the two rules at the demo broker's
own bid / ask ticks, the way `dom-tick-exec` did for a limit rule. These years (2023-26) were read by `grid7-wide-fade`: this is
a measurement of execution, not new evidence that a tilt exists, and a PASS is no reason to trade by itself.

## The rules (unchanged, imported from `grid7-wide-fade/run.mjs`, never edited)

`signals(frames(M5))` with trigger timeframe M15 (`tf` 1) and context none (`cx` 0): the first structure break on M15 (a close
beyond the last confirmed swing, 3 candles a side; closed candles only), direction d; the fade trades side s = -d, entering at
market at the open of the first 5-minute candle starting at or after the break candle's close (index `fi` = `startIdx`).

- **R-atr2**: `m15 none atr 2R all`: stop 1 x ATR(14) of M15 from the fill, target 2R.
- **R-swing**: `m15 none ext swing all`: stop past the break candle's extreme by 0.1 x ATR(14); target the opposite swing
  standing at the break (no trade when there is none, or it is not on the winning side of the fill).
- Time limit 1 day: out at the close of the first 5-minute candle ending at or after the fill candle's start + 86,400 s.
- The rule's own skips: a fill at or past the stop, a risk under the market's round-trip cost (`combo-grid-2` `COSTS`), a fill in
  a data-quality exclusion interval (`combo-grid-2` `exclusions`), a trade the mid path cannot resolve before the data ends.

On mid candles (the comparison) each order is exactly `grid7-wide-fade` `exits()` on the same fill, stop and targets (imported).

## Markets, window, sample

- Broker XAUUSD (OANDA `xau`) and USDJPY (OANDA `usdjpy`), the two markets with tick history on the demo account (about
  1,095 days back on 20 Nov 2026).
- Signals whose mid fill candle starts in **2023-11-24 00:00 to 2026-11-20 00:00 UTC**.
- **Sample**: from the M15 "none" signals of the window that give at least one of the two rules a trade, a seeded random
  sample of **1,200 signals per market** (mulberry32, seed 20261123, without replacement; all of them if fewer). Both rules are
  measured on every sampled signal (they share the entry), so each rule has up to 1,200 orders a market.
- Power, said now: with about 2,400 orders a rule and a per-trade R sd near 1.3 (R-atr2) and near 3 (R-swing), t 2 needs a tick
  tilt of about +0.055R (R-atr2) and +0.12R (R-swing). A FAIL here means "not shown at this n", not "disproved".

## The measurement (tick probe `marks` and `fills`, `council/tick-probe.mjs` unchanged)

The probe returns (marks) the last quote at or before a moment, looked for up to `marks_back` 60 s before it; and (fills) for a
window of at most 1,800 s the first tick with **ask >= level** (dir +1) or **bid <= level** (dir -1).

Allowances: **W** (basis between the broker and OANDA mid, plus half a spread): XAUUSD $0.50, USDJPY 0.05 yen (the `-exec`
studies' NEAR); **c** (spread allowance): XAUUSD $0.20, USDJPY 0.006 yen (`dom-tick-exec`'s C).

1. **Entry** (marks): the quote at the mid fill candle's start (the next 5-minute open). Buy at the ask, sell at the bid. A
   mark with no quote in the 60 s before it is **entry unresolved**: the order is left out of every test (tick and mid alike)
   and counted.
2. **Levels from the tick fill A** (the rule's distances): D = the mid risk = s x (mid fill - mid stop); stop X = A - s x D;
   target T = A + s x k x D with k = 2 (R-atr2) or the swing's R on mid, s x (opposite swing - mid fill) / D (R-swing). R on
   ticks = s x (exit - A) / D. A sell's target is below its entry (T - A carries the side through s; the `dom-tick-exec` bug is
   tested both ways offline).
3. The query files are written before A is known, so each level is **bracketed** by the mid-scale level Xm (or Tm) +- W:
   - Stop (closing side crosses: buy bid <= X, sell ask >= X; probe dir = -s): an EARLY query at Xm + s x W and a LATE query at
     Xm - s x W. The early answer is the **exact** first crossing of X when its own closing-side price is past X (no earlier
     tick can cross X); then the exit price is that tick's closing side (a gap fills worse). Else the crossing lies in
     (early tick, late tick] and is booked at X (no gap).
   - Target (buy needs bid >= T, sell ask <= T; the probe can only ask the opposite side, dir = s): an EARLY query at Tm - s x W
     (exact when the returned tick's closing side is past T) and a LATE query at Tm + s x (W + c) (an upper time bound when its
     tick's closing side is past T); booked at T.
   - Windows: every 5-minute candle from the fill candle to the earlier of the deadline candle and one hour after the mid exit
     candle, whose mid low (buy stop / sell target) or high came within 2 x W of the level; merged into windows of at most
     1,800 s. A crossing at or after the entry mark only counts.
4. **Exit** = the earlier of the stop and target crossings. When their time intervals overlap, or a crossing's interval reaches
   past the deadline candle's end, the order is **exit unresolved**.
5. **Time exit** (marks): when neither level crossed by the deadline candle's end, the quote at that candle's end (buy at the
   bid, sell at the ask). No crossing found but the windows stopped before the deadline (the one-hour cut), or no quote at the
   deadline mark: **exit unresolved**.
6. Unresolved orders are left out of both tests (paired) and reported. If more than 10 % of a market's entry-resolved orders of
   a rule are exit-unresolved, that market and rule is INCONCLUSIVE and a second query pass for them is the next step.

## R and costs

Tick R pays the spread (bid / ask fills); "before commission" leaves only the commission out. After commission: minus
2 x k x A / D, k = 0.000024 (XAUUSD), 0.0000225 (USDJPY), the demo's commission a side. Mid R = `exits()` on mid; mid after
costs = mid R - `COSTS` / D (`grid7-wide-fade`'s cost basis) beside.

## Tests (per rule, pooled XAUUSD + USDJPY; each market reported)

- **T1 (paired)**: per order, tick R minus mid R: mean and the t of its calendar-month sums. Read: real fills take part of the
  tilt when the mean is below 0 with month t <= -2.
- **T2 (the bar)**: tick R a trade (before commission) > 0, month-sum t >= 2, n >= 300 resolved orders, and Holm-adjusted
  one-sided p < 0.05 over the two rules (p from the month-sum t, df = months - 1). **PASS** if a rule clears all; **FAIL**
  otherwise; INCONCLUSIVE per item 6. The same figures after commission are reported beside; that is the line that would matter
  for money.

Also reported: by year, by side, entry slippage (A against the mid open, in R), the exit mix (stop / target / time; exact vs
bracket), the unresolved counts. Deliverables: `run.mjs` (`queries`, `report`), the query batch files, `RESULT.md`,
`result.json`. One run of the sample; no variants of the rules on these years.
