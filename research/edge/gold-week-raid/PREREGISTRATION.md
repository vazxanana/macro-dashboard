# Pre-registration: previous-week high / low raid and reversal on gold (13 Nov 2026)

Written and committed before any candle was read for this study and before any result was computed.

## Question

When gold trades through the PREVIOUS week's high (or low) and an H1 candle then closes back inside last week's range, does
fading the move toward last week's 50 % level make money net of costs? The idea comes from the market-maker school (a raid on
the liquidity resting beyond last week's extreme, then a return into the range). It is written here as one mechanical rule in
this study's own words.

This is a NEW stand-alone rule, decided on 2020 to now. It is not a gate, exit, entry or size change of the gold book (Gold
trend + Gold daily engulf), so owner decision 44 (no further test of the book on its 2006-17 window) is not touched. The MMXM
Day-3 swing study of the same day failed and is not repeated here.

## Data

OANDA mid H1 XAU/USD through the site's keyless candle proxy (`/md/bars`), complete candles only, from 1 October 2007 to the
fetch date (the file stays outside git). `node --use-env-proxy research/edge/gold-week-raid/run.mjs fetch <dir>`, then
`node research/edge/gold-week-raid/run.mjs full <dir>`. A candle's time is its start (UTC).

## Weeks

A trading week runs from the Sunday 17:00 New York reopen to the Friday 17:00 New York close (New York time with its own
daylight saving, so 21:00 or 22:00 UTC). Each H1 candle belongs to the week in which it starts; candles starting in the
Friday 17:00 - Sunday 17:00 gap (none expected) are dropped. Last week's high, low and 50 % = the highest high, the lowest low
and their midpoint over every H1 candle of the previous week. A week is used only when the previous calendar week has at
least 48 H1 candles (otherwise skipped).

## The rule (sell side; buys mirror it below last week's low)

1. **Raid**: the first H1 candle of the week (index i) whose high is above last week's high. Only this first raid counts.
2. **Close back**: the first LATER H1 candle j with i < j <= i + 12 whose close is below last week's high. If none, no sell
   this week.
3. **Entry**: sell at the open of candle j + 1 (the next H1 candle of the same week). Raid extreme = the highest high of
   candles i .. j. **Stop** = raid extreme + $0.30. **Target** = last week's 50 %.
   No trade when j + 1 does not exist in the week, when it starts at or after Friday 16:00 New York, when the entry is at or
   above the stop, or when the entry is already at or below the target.
4. **Exit**, candle by candle from j + 1: the stop is checked first (a candle that reaches both is a stop); a stop gapped
   through fills at the candle's open; the target fills at the target. Otherwise out at the close of the last H1 candle of the
   week that starts before Friday 16:00 New York (normally the 15:00 candle: the 16:00 price).
5. **One trade per side per week** (a buy and a sell may both happen in one week; no other position limit).

Every trade has a stop. Nothing here reads a later candle than the one being decided on: the raid and the close back use
closed candles, the entry is the next candle's open.

## Variants (fixed now; three rules in all)

- **R1 base**: as above.
- **R2 Mon-Wed**: R1, only when the raid candle's New York trading day (17:00 to 17:00) is a Monday, Tuesday or Wednesday.
- **R3 far target**: R1 with the target at last week's OPPOSITE extreme (low for a sell, high for a buy).

## Costs

$0.30 a round trip in price on every trade (as the other gold studies), in R = 0.30 / risk. Buys also pay overnight financing
by `council/fills.mjs`: `nights(entry, exit)` x `FIN.xau.long` x entry / risk (imported, today's rate for every year). Sells
pay and earn nothing.

## Windows

- **Decisive**: trades entered 1 January 2020 to the end of the data.
- **Replication**: trades entered 1 January 2008 to 31 December 2019.

## Statistics

Net R a trade; t on calendar-month sums of net R booked by the exit's UTC month, every month in the window counted (a month
with no trade is 0); win rate, profit factor, worst drawdown of the trade-ordered net R; by year; buys and sells apart.
Holm over the three rules on one-sided p of the decisive month-sum t (normal approximation).

## Pass (a rule passes only when ALL hold)

1. Decisive net R a trade > 0.
2. Decisive month-sum t >= 2 and its Holm-adjusted one-sided p <= 0.05 (three rules).
3. Decisive n >= 80.
4. Replication net R a trade > 0.
5. Placebo: the rule's decisive net R a trade is above at least 38 of 40 placebo seeds.

The study passes if at least one rule passes. Anything else is FAIL.

## Placebo (40 seeds, per rule)

For every trade the rule took, a random entry in the same week and side: a uniformly drawn H1 candle of that week that starts
before Friday 16:00 New York, entry at its open, stop at the same dollar distance as the rule's trade, the rule's own target
level, the same exits, costs and financing. A draw whose entry is already at or beyond the target is redrawn (up to 50 tries,
then that trade is left out of that seed). Seeded generator (mulberry32, seeds 1-40).

## What happens after

FAIL: a report, nothing else. PASS: a proposal for a paper shadow only, for the owner; no live rule changes in this study.
Not tested here, and not to be read into the result: other markets, other raid windows, an M5 or M15 entry, partial exits,
the previous DAY's or month's extremes.
