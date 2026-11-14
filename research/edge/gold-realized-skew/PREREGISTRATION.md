# Pre-registration: gold's intraday realized skewness and the next week's return (14 Nov 2026)

Written and pushed alone, before any skewness, position or return of this study is computed.

## Why
A published equity finding (realized skewness from intraday returns, measured over a week, predicts the next week's return with
the opposite sign: the most negatively skewed weeks are followed by the highest returns) has never been tested here on gold. The
nearest study, `commodity-skewness` (branch, FAIL), ranked twelve commodities across each other by the skewness of 12 months of
DAILY returns; this one is a time-series rule on one market, from 5-minute returns over five days. Nothing in `research/edge/`
or the scratchpad topic list computes intraday realized skewness. It is a stand-alone rule: not a gate, exit, entry or size of the
live gold book (Gold trend / Gold daily engulf), and it reads none of the book's positions (owner item 44).

## Data
OANDA mid XAU/USD 5-minute candles (the mosha-sweep fetch, `[t, o, h, l, c]`, October 2006 to November 2026, kept out of git;
`node run.mjs <file.json.gz>`). One market: gold. No other data.

## Days
17:00 New York trading days (a candle belongs to the day whose label is the New York date of its start + 7 hours; daylight time
by `council/histdata.mjs` `nyOffsetH`). A day with fewer than 120 candles (a holiday stub, a stray weekend print) is dropped.

## Signal
- Daily realized skewness of day d: r = log returns between consecutive candles of day d (only pairs exactly 5 minutes apart),
  RSK = sqrt(N) x sum(r^3) / (sum(r^2))^1.5. Days with N < 100 returns are dropped.
- Weekly skewness WS(d) = the mean of RSK over days d-4 .. d (five kept days).
- Rank: the share of the previous 250 values of WS (days d-250 .. d-1) that are below WS(d); at least 200 earlier values needed.
- **Buy** when the rank is under 0.20 (the week was unusually negatively skewed); **sell** when it is over 0.80.

## Trade
- Entry at the open of the first candle of day d+1 (the signal is known at the close of day d: no look-ahead).
- Stop (every trade has one): 1.5 x ATR(20) of the 17:00 New York daily candles up to and including day d, from the entry. 1R =
  that distance. A candle that opens beyond the stop fills at its open; else a touch fills at the stop. Checked on 5-minute candles.
- Exit at the close of the last candle of the 5th trading day counted from the entry day (entry day = day 1). No target.
- One position at a time: a signal on a day while a trade is open is ignored.
- Costs: $0.60 a round trip a unit (in R: 0.60 / risk); buys also pay `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long`
  (0.000148 of price a rollover, the demo broker's measured rate of 11 Nov 2026) x entry / risk; sells are credited nothing.
  Reported gross, net, and net at 2x costs (spread doubled, financing doubled).

## Windows
In sample: trades entered 2007-01-01 to 2016-12-31 (the rank needs about a year of history, so the first trades come in 2007).
Out of sample: entries 2017-01-01 to 2026-10-31. Trades entered after 2026-10-31 are left out.

## Tests (three, Holm over the three)
t = the plain t of calendar-month sums of net R (every calendar month of the window, a month with no closed trade counts 0;
a trade belongs to the month of its exit).
- **T1 (primary)**: both sides as one stream (the rule above).
- T2: buys only (sells ignored, own one-at-a-time stream).
- T3: sells only (own stream).

## Pass bar
**PASS** only if T1 out of sample has net t >= 2 with Holm-adjusted p < 0.05 (one-sided normal p of the t, x3, x2, x1 by rank),
the in-sample net mean has the same sign, and T1 out of sample stays positive at 2x costs. Otherwise **FAIL**. T2 / T3 are reported
with their Holm p; neither can pass the study alone. A PASS is a proposal to the owner, never a live change.

## Placebo
40 draws, seeded (mulberry32, seeds 1..40): for each draw, the same number of out-of-sample T1 entries placed on random kept days
(uniform without replacement over the OOS window's days, the same buy / sell count), each managed by the same stop, exit and
costs (overlaps allowed in the placebo). Reported: the real OOS net R a trade against the placebo's 95th percentile and its rank.

## Reported, not tested
Year by year; the thresholds 0.10 / 0.90; win rate, worst drawdown (summed R in exit order), average holding nights.
