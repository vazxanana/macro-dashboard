# Pre-registration: does gold catch up with a large crude-oil move it has not followed? (14 Nov 2026)

Written and pushed ALONE before any outcome (any gold price after a signal) was computed. Paper research only, a
**stand-alone rule on spot gold**: not a gate, entry, exit or size of the live gold book, and none of that book's 2006-17
positions is read (owner decision 44). Nothing live changes and no proposal follows from this file.

## Hypothesis

Crude oil is the largest single input of headline inflation. When oil has made a large multi-day move (a 10-day return in
its own top or bottom decile) while gold has barely moved over the same 10 days, an "inflation impulse" story says gold
catches up with oil in the next days: up after an oil surge, down after an oil collapse. The null: gold's next days carry
nothing beyond gold's own drift for that side.

## Why it is not a duplicate

- `gold-oil-lead` (branch, FAIL 0 of 3): a single big ONE-day WTI / copper return (beyond 2 sd), gold followed or faded for 3
  days, with no condition on what gold did. Here the signal is a 10-DAY oil move in its decile AND gold's own 10-day move
  small (gold has NOT followed): the divergence is the signal, not the oil day.
- `gold-commodity-inflation` (branch, FAIL 0 of 3): an equal-weight eight-commodity WEEKLY basket over 4 / 13 weeks, gold
  held 20 days; its T2 used the basket's regression residual on gold. Here: oil alone, daily signal, decile extremes of
  oil's own trailing distribution, gold's own small move as the divergence condition, 3- and 10-day holds, measured as an
  excess over the same-side every-day baseline.
- `brent-wti-spread`, `energy-seasonal`, `oil-wednesday`, `commodity-*`: trade oil or the commodities, not gold.
- None of the near misses (Nikkei drop, carry crash, euro divergence, low-vol hold, AUD haven day, rates shrug) is re-tested.

## Data

- OANDA mid daily candles (UTC) from council-data `research/daily/xau.json`, `wtico.json`, `bco.json` at commit
  `f2370a084483abe2c04963c8fab6da75a0bdc197`, weekends folded into Monday with `council/fills.mjs` `foldWeekend`. Oil and
  gold are matched by the same UTC day stamp (a gold day with no oil close is not a signal day). Market set fixed here:
  gold traded, WTI (T1, T3) and Brent (T2) as the signal; nothing else.
- Candles are copied by `run.mjs fetch <dir>` from the local git object store (no network) into a scratch folder, kept out
  of git and deleted at the end.

## Rule (`run.mjs`)

- At the close of gold day i: oil's 10-day log return `ln(C_i / C_{i-10})` on the aligned series. Signal `s = +1` when it is
  at or above the 90th percentile of oil's previous 500 ten-day returns (days i-500 to i-1, never day i), `s = -1` at or
  under the 10th; AND gold's |10-day log return| at or under the median of its previous 500 |10-day returns|. Otherwise no
  signal. Everything read is a close at or before day i. The first signal needs 510 aligned days, so the in-sample window
  starts in practice in early 2008.
- Entry at the open of gold candle i+1, side = s (gold the way of oil). Stop 3 x ATR(20) of gold (the 20 true ranges before
  the entry candle) from the entry; a gap through the stop fills at the open; exit at the close of the hold-th candle (entry
  candle = 1). One position at a time per test (a signal while a position is open is skipped).
- Costs: $0.60 a round trip ($0.30 spread + $0.15 slippage on each of the two market orders) plus, on buys only,
  `nights(entry, exit) x FIN.xau.long x entry price` (`FIN.xau.long` = 0.000148 of price a rollover, the demo broker's
  XAUUSD long swap of 11 Nov 2026, `council/fills.mjs`); sells pay and earn nothing. R = (exit - entry) x side / stop
  distance; net R = gross R - costs / stop distance.

## Baseline and the measured quantity

- Same-side every-day baseline: a long and a short opened at EVERY gold open of the window (overlapping), same stop, hold
  and costs; its mean net R per side.
- Excess of a trade = its net R minus the baseline mean of its side in its window. The test statistic is the t of the
  calendar-month sums of excess R (by exit month; every month of the window counts, empty months as 0).

## Tests (three, Holm over the three one-sided OOS p)

| Test | Signal market | Hold | |
|---|---|---|---|
| T1 (primary) | WTI | 3 candles | |
| T2 | Brent | 3 candles | |
| T3 | WTI | 10 candles | |

Counts, computed before this file (signal days and the positions they open, no outcome read):

| Test | IS signal days | IS positions | OOS signal days | OOS positions |
|---|---|---|---|---|
| T1 | 225 | 120 | 224 | 116 |
| T2 | 225 | 114 | 220 | 123 |
| T3 | 225 | 73 | 224 | 69 |

Every window holds over 100 events (signal days); T1 and T2 open over 100 positions in each window. T3's 10-day hold opens
fewer (69-73) and is reported as such.

## Windows

In sample 2007-01-01 to 2016-12-31 (signals from early 2008, see above); out of sample 2017-01-01 to 2026-10-31.

## Placebo and control (40 seeds each, OOS and IS reported)

- Placebo (seeds 1-40): the real signal days, each given a seeded random side (removes oil's direction).
- Control (seeds 1001-1040): each real signal moved to a random gold day of the SAME calendar year, keeping its side (keeps
  each year's drift and volatility and the long / short mix, removes the timing the oil move gives).
- Each draw is run through the same simulator and baseline; its month-sum excess t is recorded.

## Pass bar (a test passes only on all of them)

1. OOS month-sum excess t >= 2 and Holm-adjusted p < 0.05.
2. In-sample mean excess > 0 (same sign).
3. OOS at twice the costs: mean net R > 0 and mean excess (against the baseline at twice the costs) > 0.
4. The real OOS excess t above at least 38 of the 40 placebo draws, and above at least 38 of the 40 control draws.

Verdict: PASS if T1 passes; PARTIAL if only T2 or T3 passes; FAIL otherwise. Even a pass is a lead to be replicated on
other years or markets, never an edge, and never a rule for the live book.
