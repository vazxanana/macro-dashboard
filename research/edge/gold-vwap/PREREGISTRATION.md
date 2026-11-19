# Gold session VWAP: fade, follow or pull back? Pre-registration (14 Nov 2026)

Written and pushed alone, before any trade or statistic is computed. Paper research only.

## Question

Does spot gold revert to, or trend away from, its session VWAP (anchored at the 18:00 New York daily open, weighted by OANDA
tick volume) in a way that is tradeable after costs?

**Dedupe.** No study in `research/edge/` or on any remote branch computes a VWAP. Read and not the same rule:
`gold-squeeze` (Bollinger-in-Keltner breakout on H4 / D1, FAIL), `gold-shock-revert` (daily 2 x ATR move, next-day reversal or
continuation, FAIL), `metals-rsi2` (2-day RSI pullback on daily candles, FAIL), `gold-session-drift` (fixed clock windows,
FAIL), `metals-intraday-momentum` (first half hour predicts the last, FAIL), `audnzd-revert` (a forex pair spread). None anchors
to the session's volume-weighted price or bands, so the three tests below are new. The untested backlog
(`research/proposals/2026-11-14-untested-backlog.md`) names no VWAP rule.

This is a NEW stand-alone intraday rule. It is not a gate, exit, entry or size of the live gold book (Gold trend + Gold daily
engulf); it reads none of that book's trades and uses no candle before 2016 (docs/owner-decisions.md item 44). Nothing live
changes whatever the verdict.

## Data (fixed before any result)

- One market: spot gold, OANDA mid XAU/USD M5 candles with OANDA tick volume, through the site's keyless candle proxy
  (`fetch.mjs`, kept out of git), 1 Dec 2015 (warm-up) to 13 Nov 2026. Complete candles only.
- New York clock: `council/histdata.mjs` `nyOffsetH`. CME calendar: `ict/calendar.mjs` `cmeShut` (read only).
- **Trading day** D = from 18:00 New York on the calendar day before D (Sunday 18:00 for a Monday) to 16:00 New York on D.
  A day is skipped when any M5 candle start in that span is `cmeShut` (holidays, early closes, the day after a full holiday
  whose reopen is late), when D is a Saturday or Sunday, or when fewer than 150 candles exist in the span (feed holes).
- Windows: **in sample 2016-01-01 to 2020-12-31, out of sample 2021-01-01 to 2026-11-13** (by trading day D).

## VWAP and bands (per trading day, recomputed at each M5 close, using only candles closed at or before it)

- Typical price p = (high + low + close) / 3 of each M5 candle, weight v = its OANDA tick volume (a candle with volume 0 has
  no weight).
- VWAP_t = sum(v p) / sum(v) over the day's candles from the 18:00 anchor through candle t.
- Volume-weighted standard deviation sd_t = sqrt(sum(v (p - VWAP_t)^2) / sum(v)) over the same candles.
- Band k: VWAP_t + k sd_t (upper), VWAP_t - k sd_t (lower).

## Common execution rules

- Signals are read on M5 closes whose candle ENDS between 03:00 and 15:00 New York (London and New York hours); nothing is
  entered after 15:00. Every open trade is closed at the close of the candle ending 16:00 New York (time exit, market).
- **At most one trade a day per test: the first signal of the day.**
- Every trade has a stop, fixed at entry. A candle that opens beyond the stop exits at its open (gap); a candle that touches
  the stop exits at the stop; stop and target in one candle = stop first. The entry candle itself is checked for the stop
  after the fill; a target is only taken from the candle after a limit fill (for a market fill at the open, the same candle).
- A trade whose stop distance is under $1.00 is not taken (the day's signal is spent).
- R = side x (exit - entry) / |entry - stop|.
- **Costs** (price units, per trade): $0.30 spread round trip on every trade (the repository's standing gold round trip,
  `gold-systems-oos`, `supported-book`) **plus half a spread ($0.15) of slippage per market order**: a market entry, a stop
  exit and a time exit each pay $0.15; a limit entry and a limit target pay none. No financing: every trade is closed by
  16:00 New York, before the 17:00 rollover. "2x costs" doubles the spread and the slippage.

## The three tests

- **T1 Fade (primary).** Signal: a close above the +2 sd band (sell) or below the -2 sd band (buy). Market entry at the next
  candle's open. Stop at the 3 sd band on the signal's side (VWAP_s +/- 3 sd_s of the signal close s). Target: a limit at
  VWAP_s. If the entry open is already at or beyond the target, or at or beyond the stop, no trade (the signal is spent).
- **T2 Follow.** Signal: the same 2 sd close, traded WITH it (buy above +2 sd, sell below -2 sd). Market entry at the next
  open. Stop at the 1 sd band on the same side (VWAP_s + 1 sd_s for a buy, VWAP_s - 1 sd_s for a sell). No target: out at
  the stop or at the 16:00 New York close. If the entry open is at or beyond the stop, no trade.
- **T3 Pullback to VWAP.** Excursion: a close above +1.5 sd (up) or below -1.5 sd (down), on a candle ending 03:00-15:00 New
  York. After it, a limit order in the direction of the excursion rests at the VWAP of the last closed candle (re-placed at
  each new close): an up excursion buys when a later candle's low reaches it (fill at the lower of its open and the level),
  a down excursion sells when a high reaches it (the higher of open and level). Fills only on candles starting at or after
  the excursion close and ending by 15:00 New York; no fill by then = no trade. Stop: level - 1 sd (buy) / level + 1 sd
  (sell), sd of the same closed candle as the level. Target: a limit at level + 1.5 sd (buy) / level - 1.5 sd (sell). The
  first excursion of the day arms the order; a later excursion does not re-arm it.

## Statistics and pass bar

- Per test and window: n, gross and net R a trade, total, win rate, exits by kind; **t on calendar-month sums of net R**
  (the month of the trading day D), one-sided p from the normal tail.
- Holm over the three tests' out-of-sample p values.
- **Placebo (40 seeds, random sign on the same bars).** For each test, each traded signal keeps its entry candle, entry price
  and fill, stop distance and target distance; seed s (mulberry32, s = 1..40) draws the side; when it differs from the rule's,
  stop and target are mirrored around the actual entry price (same distances) and the trade is simulated forward on the same
  candles with the same cost model. Statistic: the out-of-sample mean net R a trade. Chosen instead of a random-anchor moving
  average because it holds entry timing, cost and distances fixed and asks only whether the VWAP's side carries information.
- **A test passes only if all hold:** (1) out-of-sample net month-sum t >= 2 and Holm-adjusted one-sided p <= 0.05;
  (2) in-sample net mean R a trade > 0 (same sign); (3) out-of-sample net mean still > 0 at 2x costs; (4) the out-of-sample
  mean net R beats the 95th percentile of its 40 placebo means; (5) out-of-sample n >= 100.
- Verdict: PASS if T1 passes (T2 or T3 passing alone is reported as a candidate for its own pre-registration on other data,
  not an edge). FAIL otherwise.
- Reported, not tested: by-year net R, exit mix, the same numbers before costs.

## Deliverables

`run.mjs`, `RESULT.md`, `result.json` in this folder; `tests/gold-vwap.test.mjs` (offline: VWAP / sd on hand-made candles, no
look-ahead, the rules, the report against result.json). No proposal is written whatever the result; any follow-up needs its own
pre-registration.
