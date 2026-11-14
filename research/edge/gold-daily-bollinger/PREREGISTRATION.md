# Pre-registration: gold's daily close outside its Bollinger band, fade or follow? (14 Nov 2026)

Written, committed and pushed alone before any number of this study was computed. Paper research: nothing here is read by
the council, the mirror or the page, and no live rule changes whatever the verdict. Not an ICT study.

**Item 44 (docs/owner-decisions.md).** This is a NEW stand-alone daily rule on spot gold. It is not a gate, an exit, an entry or
a size of the gold book (Gold trend / Gold daily engulf), reads none of that book's trades, and its verdict says nothing about
that book. It is decided on 2017 to October 2026; 2007-16 is the in-sample window.

## Why, and why not a duplicate
The 14 Nov backlog (`research/proposals/2026-11-14-untested-backlog.md`, branch `untested-backlog`) ranks seven candidates; none
is a stand-alone gold rule (they are index, bond and cross-sectional books; gold's FOMC cycle and Chinese New Year are already
taken or left out). So this is a rule of our own, said so. Nearest tested topics: `gold-h1-bb-fade` (the Bollinger fade on H1
candles in a quiet ADX regime, 12-hour holds: FAIL), `gold-streak`, `metals-rsi2`, `gold-ibs`, `gold-shock-revert` (daily
reversal signals of other shapes: FAIL), `gold-vol-breakout` (open +/- k x range breakouts), `gold-tsmom` (12-month sign). No
study has read gold's DAILY close against its 20-day, 2-sd band, either as a fade back to the middle band or as a breakout to
follow. Prior: Bollinger bands are among the most used chart tools; the published evidence on them (e.g. Lento, Gradojevic
and Wright 2007, not opened) is mixed, so both directions are tested.

## Data
- OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (`git show origin/council-data:…`, no network), cache kept out
  of git. Weekend stubs folded into the next weekday with `council/fills.mjs` `foldWeekend` before anything is computed.
- Market set fixed now: gold (XAU/USD) only.

## The rule (everything at the signal close of day i; nothing later is read)
- Band: SMA20 of the closes of days i-19..i, sd = population standard deviation of the same 20 closes, upper = SMA + 2 sd,
  lower = SMA - 2 sd. ATR(14) = mean true range of days i-13..i.
- Signal: close(i) above the upper band (up signal) or below the lower band (down signal).
- Entry: the open of day i+1. Stop: 1.5 x ATR(14) from the entry on the losing side, checked from the entry day; a later day
  that opens past the stop exits at its open, else the stop fills at the stop. Every trade has a stop.
- Exit: the close of the first day (the entry day included) whose close is back on the target side of THAT day's middle band
  (SMA20 of the 20 closes ending that day), see per test; otherwise the close of the 10th day held. The stop wins on its day.
- One position at a time per test (a signal while a trade of that test is open is skipped).

## Tests (Holm over these three)
- **T1 fade the low**: down signal -> BUY; exit at the first close at or above the middle band, or day 10.
- **T2 fade the high**: up signal -> SELL; exit at the first close at or below the middle band, or day 10.
- **T3 follow the high**: up signal -> BUY; exit at the first close at or below the middle band, or day 10.

## Costs
$0.60 a round trip on every trade, and on buys overnight financing `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a
rollover, the demo broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry price; sells pay and earn nothing. R = move
/ (1.5 x ATR). "2x costs" doubles both the spread and the financing.

## Windows and statistics
- IS = trades entered 2007-01-01 to 2016-12-31; OOS = 2017-01-01 to 2026-10-31. OOS halves 2017-21 and 2022-26 reported only.
- t = mean / standard error of calendar-month sums of net R (every month of the window counts, an empty one as 0), one-sided p
  from the normal. Holm over T1-T3 on the OOS p.
- Placebo, 40 seeds (mulberry32 seeds 1..40): the same OOS entry days and the same number of days held as the rule's trades,
  the same stop, the side drawn at random per trade; the rule's OOS net R a trade must beat at least 38 of the 40.
- Baseline reported: a buy at every day's open, same stop, held one day.

## Pass bar (all needed, per test)
OOS net R a trade > 0 with month-sum t >= 2 and Holm-adjusted p <= 0.0228; IS net R a trade > 0 (same sign); OOS net > 0 at 2x
costs; beats >= 38 of 40 placebos. Verdict PASS if any test passes, else FAIL. A pass would be a lead to replicate on silver
and on years it did not use, not an edge to trade; no proposal follows either way.
