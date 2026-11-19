# Pre-registration: gold follows its own FOMC-day reaction for two weeks (14 Nov 2026)

Written and pushed alone, before any candle was read for this study. Paper research only: a **stand-alone rule on gold**,
not a gate, entry, exit or size of the live gold book; the book's 2006-17 window and positions are not used (owner decision
44). Nothing live changes, nothing of ICT is touched, no proposal is written whatever the result.

## Hypothesis

On a scheduled FOMC statement day gold re-prices the policy news. If the market under-reacts, gold keeps moving the way the
statement day moved over the following two weeks (a post-announcement drift). The rule follows that direction on both
sides, so a long and a short are taken from the same kind of day: the test separates the reaction's direction from gold's
general rise.

Nearest studies and why this is not one of them: `gold-fomc-cycle` (fixed long weeks 2/4/6, short weeks 1/3/5, no
condition on the reaction), `pre-fomc-gold-usd` / `pre-fomc-drift` (the hours BEFORE the statement), `fomc-follow` (the
first 30 minutes after the statement, out the same day, indices and gold), `bond-fomc-drift` (Treasury CFDs). None trades
gold for days in the direction of the statement day's own move.

## Data (named before any result)

- One market: XAU/USD, council-data `research/daily/xau.json` (OANDA mid, UTC daily candles), weekends folded into Monday
  with `council/fills.mjs` `foldWeekend`. Read with `git show origin/council-data:…`; no cache kept in git.
- Meetings: scheduled FOMC statement days 2007 to now, the list `gold-fomc-cycle` used (branch `gold-fomc-cycle`,
  `dates.mjs`: 2007 written there from the Federal Reserve's meeting calendars; 2008-2021 as in `fomc-even-week`; 2022 on
  from `council/events.mjs`), copied into this study. Unscheduled announcements 2007-08-10, 2007-08-17, 2008-01-22,
  2008-10-08, 2010-05-09, 2020-03-03, 2020-03-15 never give a signal, and a meeting whose window D-1 .. D+11 contains one
  is dropped.

## Rule

- D = the UTC daily candle of the statement day (the statement is at 14:00 New York, inside that candle). Reaction
  r = close(D) / close(D-1) - 1. Side = sign(r); r = 0 gives no trade. No threshold.
- Entry at the open of the next candle (D+1). Stop 2 x ATR(20) from the entry, ATR from candles up to D (true range with
  the previous close). Out at the close of the 10th candle from entry (D+10), or at the stop (a gap through it fills at the
  open). Every trade has a stop. One trade per meeting; meetings are about six weeks apart, so trades never overlap.
- Costs: $0.60 a round trip, plus `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's
  rate of 11 Nov 2026, charged for every year) x entry on buys; sells pay and receive nothing. R = (price move x side -
  costs) / stop distance. The cost share (gross minus net over |gross|) is reported.

## Windows and tests

- In sample: entries 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to the last complete month (October 2026).
- **T1 (primary) Follow, both sides**: net R of the follow stream, t on calendar-month sums of net R (months with no trade
  count as 0).
- **T2 Follow minus the same-side baseline**: for every follow trade, excess = its net R minus the mean net R of the trade
  of the SAME side taken after EVERY meeting of the same window (long after every meeting, short after every meeting:
  the unconditional same-side baselines, same entry, stop and exit). t on calendar-month sums of the excess.
- Holm over T1 and T2 (one-sided p from the t, normal approximation).
- Placebo: 40 seeded draws (mulberry32, seeds 1-40) giving every meeting a random side, long with the follow stream's
  share of longs; the out-of-sample mean net R of each draw. T1 must beat at least 38 of 40.

## Pass bar (all required)

T1: out-of-sample net R a trade > 0, month t >= 2, Holm p < 0.05, out-of-sample n >= 30, in-sample net R > 0, out-of-sample
net R > 0 at twice the costs, at least 38 of 40 placebos beaten. **And** T2: out-of-sample excess > 0 with t > 0 (the
result must not be gold's drift). PASS only when both hold; anything else is FAIL. A pass would be a lead, not an edge.

## Reported only, never judged

Holds of 5 and 20 candles; the reaction read to close(D+1) with entry at D+2; the fade stream; by year; long and short
halves of the follow stream; median stop in dollars (expected over $10).
