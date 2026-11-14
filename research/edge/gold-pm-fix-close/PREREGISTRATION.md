# Pre-registration: gold's close against the 15:00 London (PM auction) price as a next-day signal (14 Nov 2026)

Written and pushed ALONE, before any candle of this study is read for a result. Paper research only. A **stand-alone** rule on
XAU/USD: not a gate, exit, entry or size of the live gold book (Gold trend / Gold daily engulf), and it reads none of that
book's positions (owner item 44). Nothing live changes, whatever the result.

## Question

Gold's afternoon price auction in London (the LBMA PM price, set from 15:00 London) is the reference many physical and
fund flows settle against. Does the way gold trades AFTER that hour, into the 17:00 New York close, say anything about the
next 17:00-New-York day? Momentum reading: a day that closes above its 15:00 London price is followed by a rising next day
(and below by a falling one). Reversal reading: the late move away from the auction price is flow that is undone the next
day.

## Nearest studies, and why this is not one of them

- `gold-lbma-fix` (branch, FAIL): the run INTO the PM auction (13:30 -> 14:55, trade 14:55 -> 15:05) and the fade 15:00 ->
  16:30, same day, minutes to 90 minutes. Never the next day.
- `gold-intraday-momentum` (FAIL): early-day moves (prior close -> 10:00 NY, 08:30 -> 10:00) traded into 16:55 the same day.
- `gold-late-ny` (FAIL): the 13:30-16:30 New York move traded 18:00 -> 02:00 (the Asian session only).
- `gold-tsmom`, `gold-weekly-momentum`, `gold-streak`: close-to-close returns, no intraday anchor.
None of them conditions a full next-day hold on the close's position against the auction price.

## Data (named before any result)

- OANDA mid XAU/USD M5 candles, November 2006 to November 2026 (a local cache, kept out of git; `run.mjs fetch <file>`
  rebuilds it from the candle proxy `/md/bars`, 4,999 candles a request).
- Market: gold only. No other market is read.
- Times: New York wall clock from `council/histdata.mjs` `nyOffsetH`; London wall clock from `euSummer` (UTC+1 from the last
  Sunday of March 01:00 UTC to the last Sunday of October 01:00 UTC, else UTC).

## Definitions

- Trading day D = a Monday-Friday New York date; its window runs from 17:00 New York of the previous trading day to 17:00
  New York of D (the council's daily candle).
- P(X) = the close of the M5 candle ending at instant X (else of the last candle ending within the 15 minutes before X; none ->
  the day is skipped and counted).
- Fix price F_D = P(15:00 London on date D). Close C_D = P(17:00 New York on date D).
- Signal s_D = C_D / F_D - 1 (sign and size of the move from the auction hour to the close).
- ATR_D = ATR(14) of the 14 daily candles (17:00 New York days) up to and including D: all known at the entry.
- Trade on day D+1 (the next trading day): entry at the OPEN of the first M5 candle starting at or after 17:00 New York of D
  (normally the 18:00 New York reopen; Sunday's reopen after a Friday), exit at P(17:00 New York of D+1), stop entry -/+ 1.0 x
  ATR_D (every trade has a stop). Stops checked on every M5 candle from the entry candle on; a candle opening beyond the stop
  fills at its open, one reaching it fills at the stop. R = (exit - entry) x side / ATR_D.
- One trade a day at most; no overlap is possible (each trade closes at the end of the day it is taken in).

## Tests (three, Holm over the three)

- **T1 (primary, both sides): follow.** side = sign(s_D) on every signal day with s_D != 0.
- **T2: follow, large signals.** As T1, only when |s_D| is above the median |s| of the 250 PREVIOUS signal days.
- **T3: fade, large signals.** The same days as T2, side = -sign(s_D).

## Costs

- $0.60 a round trip on every trade (judged), reported also at $1.20 (2 x) and at the demo's $0.16.
- Financing on buys: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, `council/fills.mjs`, the cTrader
  demo's XAUUSD swap of 11 Nov 2026) x entry / ATR_D, in R. Sells pay and earn nothing. (The hold is about 23 hours across the
  17:00 New York break, so most trades cross no 22:00 UTC rollover; whatever `nights` counts is charged.)

## Windows and statistics

- In sample (IS): signal dates 2007-01-01 to 2016-12-31. Out of sample (OOS): 2017-01-01 to 2026-10-31.
- t on calendar-month sums of net R (by the signal date's month). One-sided p from the OOS month t; Holm over T1-T3.
- Placebo: 40 seeded random side draws (mulberry32, seeds 1-40) on each test's own trade days, same stops, costs and hold.

## Pass bar (all, per test)

1. Net R a trade > 0 in IS and in OOS.
2. OOS month t >= 2 AND Holm-adjusted p < 0.05.
3. OOS n >= 200.
4. OOS net beats at least 38 of the 40 placebos.
5. OOS net R a trade > 0 at 2 x costs.

The study passes if T1 passes; T2 / T3 passing alone is a lead for a new pre-registration on other data, never an edge.
Reported but never judged: by-year net R, the median stop in dollars, the share of trades stopped, a regression of the next
day's return on s_D (IS and OOS).

## What will not be done

No other hour, threshold, stop, hold or market is tried after the results are seen. If the data show something else, it is
written down as a hypothesis for its own pre-registration.
