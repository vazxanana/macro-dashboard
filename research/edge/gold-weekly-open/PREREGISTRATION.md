# Pre-registration: the weekly open as a level on gold (14 Nov 2026)

Written and committed alone, before any candle was fetched for this study and before any result was computed.

## Question

The weekly-profile idea of the owner's ICT / market-maker material: in a bullish week the low of the week tends to form below
the weekly open early in the week (Monday to Wednesday) before price expands up; in a bearish week the mirror. A second reading:
the weekly open acts as a magnet, so an early-week excursion away from it tends to come back. Are either of these tradeable on
spot gold, net of costs? The rules below are this study's own mechanical wording of the idea.

This is a NEW stand-alone rule, decided on 2021 to now with 2016-20 as the in-sample check. It is not a gate, exit, entry or
size change of the gold book (Gold trend + Gold daily engulf), and no candle before 1 January 2016 is read (owner decision 44).

**Dedupe** (read before writing this): `gold-week-raid` (previous week's high / low raid, FAIL), `gold-weekend` (the Sunday stub
candle in the daily systems), `gold-weekend-gap` (fading the Sunday reopen gap to Friday's close, FAIL), `fx-weekly-reversal`
(cross-sectional weekly reversal in currencies, FAIL), `mmxm-pdhl-raid-gold` (previous DAY's high / low raid, FAIL),
`swing-day3` (a daily three-candle swing failure, FAIL), `ict-mmxm` (a skill cross-check, no study), `seasonality` (clock and
calendar windows, no weekly-open level). None anchors a trade to the weekly open price. Not tested before in this repository.

## Data

OANDA mid H1 XAU/USD through the site's keyless candle proxy (`https://meridianx.dev/md/bars?sym=xau&tf=1h`), complete
candles only, from Sunday 3 January 2016 to the fetch date; the cache stays outside git.
`node --use-env-proxy research/edge/gold-weekly-open/fetch.mjs <dir>`, then `node research/edge/gold-weekly-open/run.mjs <dir>`.
A candle's time is its start (UTC). New York time and the CME calendar come from `ict/calendar.mjs` (`nyParts`, `cmeShut`;
read only): every H1 candle that STARTS while `cmeShut` is true (the weekend, full holidays, early-close afternoons) is dropped.

## Weeks, the weekly open, the weekly ATR

- A trading week runs from Sunday 18:00 New York to Friday 17:00 New York. A candle belongs to the week whose Monday (New York
  date) follows or contains it: Sunday from 18:00, Monday to Thursday, Friday before 17:00.
- **Weekly open W0** = the open of the week's first candle (after the CME filter: normally the Sunday 18:00 New York candle;
  after a holiday Sunday, the first candle there is). A week whose first candle starts after Monday 18:00 New York is skipped.
- Weekly bar: open W0, high / low over the week's candles, close C = the close of the week's last candle.
- **Prior week up** = the immediately previous week (its Monday exactly 7 days earlier) has C > W0; **down** = C < W0.
- **A** = the weekly ATR: the mean of the true ranges of the 14 completed weeks before this one (TR = max(H, previous C) -
  min(L, previous C)); a week with fewer than 14 such weeks before it is skipped. Only 2016-on candles are used.
- **Exit time** = the close of the week's last candle that starts before Friday 16:00 New York (out before the weekend).

## The tests (three, all fixed here)

**T1, bullish-week long (primary).** Only weeks whose prior week closed up. A buy limit at L = W0 - 0.25 x A is working from
the first candle whose New York date is Tuesday through the last candle whose New York date is Wednesday. Fill: the first
candle in that window whose low reaches L, at min(its open, L) (an order already above the price fills at the open). Stop =
fill - 0.5 x A. No target. Exit: the stop (a stop gapped through fills at that candle's open; on the fill candle itself, the
stop counts if that candle's low reaches it), else the close at the exit time. One trade a week at most.

**T2, bearish-week short.** The mirror: weeks whose prior week closed down; a sell limit at W0 + 0.25 x A on Tuesday-Wednesday,
stop fill + 0.5 x A, out at the exit time.

**T3, back to the weekly open.** Every week (no prior-week condition). From the week's first candle through the last candle
whose New York date is Wednesday, a buy limit at W0 - 0.5 x A and a sell limit at W0 + 0.5 x A rest together; the first to
fill is the week's trade and the other is cancelled. If one candle reaches both before either has filled, the week is skipped
(order unknown). Stop 0.5 x A beyond the fill; target W0. On the fill candle only the stop is checked; from the next candle the
stop first, then the target; else out at the exit time. One trade a week at most.

Every trade has a stop on the losing side of its entry. 1R = |fill - stop| = 0.5 x A.

## Costs

- Spread: $0.30 a round trip on every trade.
- Slippage: half a spread ($0.15) on every market order: a stop exit and a time exit. A limit entry and a target exit pay none.
- Financing: buys pay `council/fills.mjs` `FIN.xau.long` x entry price per rollover counted by `nights(entry, exit)` (Monday to
  Friday 22:00 UTC, Wednesday three), today's demo rate for every year; sells pay and earn nothing.
- "2x costs" doubles all three.

## Windows and statistics

- In sample: trades entered 1 January 2016 to 31 December 2020 (the first trade can only come after the 14-week ATR warm-up).
  Out of sample (decisive): 1 January 2021 to the last complete week before the fetch.
- Per test and window: n, mean net R a trade, gross R, win rate, PF, total, worst drawdown, and t on CALENDAR-MONTH sums of net
  R (booked by the exit's UTC month, every month of the window counted, empty months as 0). One-sided p from the normal
  approximation; Holm over the three tests (out of sample).
- **Placebo**, 40 seeds (1-40, mulberry32): the same rule anchored to the open of a RANDOM candle of the same week instead of W0
  (same A, same prior-week condition, same windows, stops, exits and costs). T1 / T2: the anchor is drawn uniformly among the
  week's candles that start before the Tuesday window opens; T3: among the candles that start before Wednesday (New York), and
  the two limits rest from that candle through Wednesday with the anchor as the target. Statistic: out-of-sample mean net R a
  trade.

## Pass bar (per test; all required)

1. Out of sample mean net R > 0 and month-sum t >= 2 with Holm-adjusted p <= 0.05.
2. In sample mean net R > 0 (same sign).
3. Out of sample mean net R > 0 at 2x costs.
4. Out of sample n >= 60.
5. Out-of-sample mean net R above at least 38 of the 40 placebo means.

Verdict: PASS if T1 (primary) passes; PARTLY if only T2 or T3 passes; FAIL if none does. The rules, numbers and bar above are
not changed after a result is seen. Paper research only: no live rule, size, filter, stop or config changes, whatever the
result; a pass would be written as a proposal for the owner.
