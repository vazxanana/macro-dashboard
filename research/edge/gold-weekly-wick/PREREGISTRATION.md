# Pre-registration: gold after a weekly candle with a long wick (14 Nov 2026)

Written and pushed alone, before `run.mjs` exists and before any number of this study is computed. Paper research only.

## Question

Does spot gold (XAU/USD) move the way a long weekly wick points over the next one to two weeks? A week whose lower wick is
more than 60 % of its range ("buyers rejected the lows") is read as a buy; a week whose upper wick is more than 60 % of its
range is read as a sell. The primary test is **both-sided**: one book that buys after lower-wick weeks and sells after
upper-wick weeks, so gold's long upward drift cannot pass it on its own.

**Item 44**: a new stand-alone weekly rule judged on 2017-26. It is not a gate, exit, entry or size change of the live gold
book (Gold trend / Gold daily engulf), it reads none of that book's 2006-17 positions, and it says nothing about it. Nothing
live changes whatever the result; a PASS would only be written up as a proposal for the owner.

Not covered before (checked 14 Nov 2026): `gold-h4-pinbar` (H4 pin at a 20-candle extreme, held 2 days),
`gold-key-reversal` (daily key / outside reversal days, 3 days), `gold-inside-week` (inside weeks), `fx-weekly-reversal`
(cross-sectional currency weeks), `council-lone-wick` (council display). No study reads the weekly wick of gold.

## Data (named before any result)

- One market: OANDA mid H1 XAU_USD, March 2006 to 13 Nov 2026, through the site's candle proxy (`run.mjs fetch <dir>`;
  kept out of git). No other market.
- Trading days = 17:00 New York days (`research/edge/gold-drd-long` `days()`, imported unchanged). A week = the trading
  days Monday to Friday of one calendar week: open = the first day's open, high / low over the days, close = the last day's.

## Rule

- Signal week: a completed week with at least 4 trading days and a range (high - low) of at least 0.5 x the average range
  of the 20 weeks before it.
- Lower wick = min(open, close) - low; upper wick = high - max(open, close).
- Buy signal: lower wick > 0.60 x range. Sell signal: upper wick > 0.60 x range. (Both cannot hold in one week.)
- Entry: at the open of the first H1 candle of the next trading day (the next week's open), market order.
- Stop: $0.30 beyond the signal week's extreme (buy: below its low; sell: above its high). A signal whose entry opens at or
  past that stop is skipped. Every trade has a stop. Checked on every H1 candle after entry; a candle that opens through the
  stop fills at its open.
- Exit: otherwise at the close of the last H1 candle of the N-th trading day after entry (entry day = day 1).
- No target. One position at a time per test (a signal while a position is open is skipped).

## Costs

- $0.60 a round trip (a $0.30 spread plus $0.15 slippage on each of the two market orders), in R of the trade's own risk
  (|entry - stop|).
- Financing on buys: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a 22:00 UTC rollover, Wednesday three;
  `council/fills.mjs`, the demo broker's XAUUSD swap of 11 Nov 2026) x entry / risk. Sells are charged and credited nothing.
- 2x costs = both charges doubled.
- Expected cost share, stated before any run: a weekly-wick stop sits roughly 1.5-3 % of price from the entry (about
  $15 in 2007, $30 or more from 2017), so the spread costs about 0.02-0.04R a trade; a two-week buy holds about 14 nights,
  0.2 % of price, about 0.08-0.15R; a one-week buy about half that. The median stop is expected well above $10.

## Tests (three, Holm over the three)

- **T1 (primary)**: both-sided book, buys and sells, held N = 10 trading days (two weeks).
- T2: the same book held N = 5 trading days (one week).
- T3: the buy side of T1 alone (lower-wick weeks), reported against an unconditional same-side baseline (buy at every
  eligible week's next open with the same stop rule from that week's low, the same hold and the same costs, one at a
  time) as a descriptive comparison; T3's own test is its net t.

## Windows and statistics

- In sample: trades entered 2007-01-01 to 2016-12-31. Out of sample: entered 2017-01-01 to 2026-10-31.
- R a trade = side x (exit - entry) / risk; net = R - cost R - financing R.
- t on calendar-month sums of net R by exit month (every month of the window counts, 0 when nothing closed).
- Holm: two-sided p from the OOS month t (normal approximation), adjusted over T1-T3.
- Placebo: 40 seeded draws (seed 20261114). Each draw keeps T1's number of buy and sell signals in each window but places
  them on randomly chosen eligible weeks (same week filter, random side assignment held to T1's counts), then runs the
  same simulation. Reported: the placebo distribution of the OOS net month t.

## Pass bar (all required, for T1)

1. OOS net month t >= 2 and its Holm-adjusted p < 0.05;
2. in-sample net mean R a trade of the same sign (positive);
3. OOS net mean R still positive at 2x costs;
4. OOS net t above the 95th percentile of the 40 placebo draws.

Otherwise FAIL. T2 and T3 are reported with the same statistics but cannot make the verdict pass alone. Never called an edge
without n and t; a FAIL closes this reading of the weekly wick on gold.
