# Pre-registration: the Asian range breakout into London on gold (13 Nov 2026)

Written and pushed before any number of this study is computed. Research only: no live rule, size, filter, stop, config or
council member changes, whatever the verdict.

## Why, and what this is not
A widely taught intraday idea: gold's Asian session builds a range, London breaks it, and the break runs. This is a NEW
stand-alone intraday rule, decided on 2020 to now. It is not a gate, exit, entry or size of the gold BOOK (Gold trend + Gold
daily engulf), and it never reads the book's 2006-17 window as evidence (docs/owner-decisions.md item 44 holds). It does not
duplicate `research/edge/seasonality`: that study's H5 held gold LONG from 18:00 New York to 08:00 London (a directional clock
drift, FAIL); nothing there trades a range or a break of it.

## Clock
- **London open = 07:00 London local time** (07:00 UTC in winter, 06:00 UTC in British summer time; UK summer time from the
  last Sunday of March 01:00 UTC to the last Sunday of October 01:00 UTC).
- **Asian range** = the high and low of every M5 candle from 00:00 to 06:59 London local time, i.e. the 7 hours before the
  London open: 00:00-06:59 UTC in winter, 23:00 (previous UTC day)-05:59 UTC in summer.
- **Break window** = the M15 candles that START from the London open to London open + 4 h (07:00-10:59 London local).
- **Time exit** = 12:00 New York local time (US daylight time by the US rule, which differs from the UK's for a few weeks a
  year): a trade still open is closed at the close of the last M5 candle that ends at or before 12:00 New York.
- Days = London weekdays Monday to Friday. A day is used only if its range has at least 70 of its 84 M5 candles (holidays,
  data holes); otherwise no trade that day for either rule.
- M15 candles are built from M5 candles on the UTC quarter-hour grid (all clocks above fall on it).

## Data
OANDA mid M5 XAU_USD through the site's keyless candle proxy (`https://meridianx.dev/md/bars`), November 2007 to now, the cache
an earlier study of this repository fetched (kept out of git; `run.mjs fetch <dir>` re-fetches it the same way). No other data.

## Skip filter (both rules)
Skip the day when its range (high - low) is more than 2 x the median of the previous 20 used days' ranges (fewer than 20
previous used days: skip). Known at the London open.

## Rule B (breakout)
The first M15 candle of the break window that CLOSES above the range high (buy) or below the range low (sell). Enter at the open
of the next M15 candle (the next M5 candle's open) in that direction.
- Stop: the range's opposite side, or 1 x range from the entry, whichever is NEARER the entry.
- Target: 1.5 x range from the entry.
- If the entry price is already at or beyond the stop (or the target), no trade.
- Out at 12:00 New York at the latest. One trade a day.

## Rule F (fade, the pre-stated alternative)
The same first break (the first M15 close beyond the range in the break window). If one of the next 2 M15 candles closes back
INSIDE the range, sell (after a break up) or buy (after a break down) at the open of the following M15 candle.
- Stop: $0.30 beyond the break's extreme (the highest high, or lowest low, from the break candle to the candle that closed back
  inside).
- Target: the range's opposite side.
- If the entry price is already at or beyond the stop or the target, no trade. If the first break does not come back inside
  within 2 candles, no F trade that day (later breaks are not read). Out at 12:00 New York at the latest. One trade a day.

## Fills and costs (both rules)
On M5 candles from the entry candle on: a stop gapped through fills at the candle's open; a target fills at the target price;
**stop first when one candle holds both**. 1R = |entry - stop| at entry. Cost: $0.30 a round trip on every trade, taken off
as $0.30 / 1R. Financing: `council/fills.mjs` `nights` x `FIN` on buys held over 17:00 New York; every trade ends by 12:00
New York the same day, so it is zero by construction (the code still computes it).

## Windows
- **Decisive**: 2020-01-01 to the end of the data.
- **Replication**: 2010-01-01 to 2019-12-31.
- 2007-09 only warms up the range median; never judged.

## Test (two rules, Holm)
For each rule, on the decisive window: mean net R a trade, and t of the calendar-month sums of net R (months with no trade
count as 0, from the window's first month to its last). One-sided p from that t (normal approximation), Holm over the 2 rules.
**PASS** for a rule only if all hold:
1. decisive mean net R a trade > 0;
2. month-sum t >= 2 AND Holm-adjusted one-sided p < 0.05;
3. decisive n >= 300;
4. replication (2010-19) mean net R a trade > 0;
5. placebo: 40 seeds (1-40), the same days and entry times, the direction chosen at random, the rule's own stop and target
   distances mirrored for that side, the same exits and costs; the rule's decisive mean net R must beat at least 38 of the 40
   placebo means.

Verdict PASS if at least one rule passes; a PASS is a proposal for a paper shadow, never a live change. Otherwise FAIL.

## Reported, not tested
Year by year; gross R; win rate; exits (stop / target / time); breaks up vs down; median range; the days the skip filter
removed.
