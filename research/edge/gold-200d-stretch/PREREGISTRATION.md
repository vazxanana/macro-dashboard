# Pre-registration: gold stretched far from its 200-day average, does it snap back? (14 Nov 2026)

Written, committed and pushed alone before any number of this study was computed. Paper research: nothing here is read by
the council, the mirror or the page, and no live rule changes whatever the verdict. Not an ICT study.

**Item 44 (docs/owner-decisions.md).** This is a NEW stand-alone daily rule on spot gold. It is not a gate, an exit, an entry or
a size of the gold book (Gold trend / Gold daily engulf), reads none of that book's positions or trades, and its verdict says
nothing about that book. It is decided on 2017 to October 2026; 2007-16 is the in-sample window.

## Why, and why not a duplicate
Nearest tested topics: `gold-daily-bollinger` (20-day, 2-sd band, fade and follow: FAIL), `gold-premium-discount` (20-day
range quarter: FAIL), `gold-shock-revert` (one extreme day: FAIL), `gold-13w-low`, `gold-tsmom` (12-month sign), `crypto-sma200`
(the 200-day average as a trend switch on crypto). None reads gold's distance from its 200-day average as a z-score and fades
it on both sides over weeks. The idea is a long-horizon stretch (an overextended market reverting toward its slow average); the
published evidence for mean reversion at this horizon in commodities is weak and mixed (no source opened), so the test is two
sided and judged against a same-side trade on any day.

## Data
- OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (`git show origin/council-data:…`, no network), cache kept out
  of git. Weekend stubs folded into the next weekday with `council/fills.mjs` `foldWeekend` before anything is computed.
- Market set fixed now: gold (XAU/USD) only.

## The rule (everything at the signal close of day i; nothing later is read)
- SMA200 = mean of the closes of days i-199..i; SD200 = population standard deviation of the same 200 closes;
  z(i) = (close(i) - SMA200) / SD200. ATR(14) = mean true range of days i-13..i.
- Low stretch: z(i) < -2. High stretch: z(i) > +2. Every such day is a signal (one position at a time per test, so a signal
  while that test's trade is open is skipped; the next stretched day after the exit may enter again).
- Entry: the open of day i+1. Stop: 2 x ATR(14) from the entry on the losing side, checked from the entry day; a later day that
  opens past the stop exits at its open, else the stop fills at the stop. Every trade has a stop.
- Exit: the close of the first day (entry day included) whose own z is back toward the average (buy: z >= -1; sell: z <= +1),
  else the close of the 20th day held. The stop wins on its day.

## Tests (Holm over these three)
- **T1 buy the low stretch**: z < -2 -> BUY.
- **T2 sell the high stretch**: z > +2 -> SELL.
- **T3 both sides (primary)**: the T1 and T2 signals as one stream (one position at a time across the two).

## Costs
$0.60 a round trip on every trade, and on buys overnight financing `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a
rollover, the demo broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry price; sells pay and earn nothing. R = move
/ (2 x ATR). "2x costs" doubles both the spread and the financing.

## Windows and statistics
- IS = trades entered 2007-01-01 to 2016-12-31; OOS = 2017-01-01 to 2026-10-31. OOS halves 2017-21 and 2022-26 reported only.
- t = mean / standard error of calendar-month sums of net R (every month of the window counts, an empty one as 0), one-sided p
  from the normal. Holm over T1-T3 on the OOS p.
- **Unconditional baseline** (reported, and checked): the same side (buy for T1, sell for T2, each trade's own side for T3)
  entered at every OOS day's open, same 2 x ATR stop, held a fixed number of days = the test's OOS mean hold rounded, overlapping
  trades allowed. The rule's OOS net R a trade must exceed the baseline's.
- **Placebo, 40 seeds** (mulberry32 seeds 1..40): each OOS rule trade is moved to an entry day drawn uniformly from all OOS days,
  keeping its side and its number of days held, same stop rule (overlap allowed); the rule's OOS net R a trade must beat at
  least 38 of the 40 placebo means.

## Pass bar (all needed, per test)
OOS n >= 20; OOS net R a trade > 0 with month-sum t >= 2 and Holm-adjusted p <= 0.0228; IS net R a trade > 0 (same sign); OOS
net > 0 at 2x costs; above the unconditional baseline; beats >= 38 of 40 placebos. The verdict follows T3 (primary): PASS if T3
passes; a T1 or T2 pass alone is reported as a one-sided lead, not a pass. Either way a pass would be a lead to replicate on
silver and other years, not an edge to trade; no proposal follows.
