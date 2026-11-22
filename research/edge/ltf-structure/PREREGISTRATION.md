# Pre-registration: lower-timeframe structure as an entry permission, 2020-2025 (22 Nov 2026)

Written and committed alone, before any result of this test is computed. Before this file only the shape of the trade files
and the count of trades per reading group and window were looked at; no R figure split by the condition below exists for
these years. One run, no variants. Paper research only: nothing live changes, and no council member, mirror, config, page or
desk reads the result.

## Why
The owner (22 Nov 2026): "you are not marking market structure on the lower timeframe". The belief: the paper desks lose
because their entries ignore the structure of the timeframes under the one the setup is read on. On the desks' own 2026 paper
records (in sample, before costs, split after the fact) one condition looked best: +0.070R a trade pooled (n 1,835) and
+0.123R on the Mosha barrier entries (n 856). That is a split found on the year it is measured on. This file fixes that one
condition and asks whether it holds on years nobody has looked at under it.

## The question
On the desks' own trades of 2020-2025, does a trade taken while the H1, M15 and M5 structure all agree with its side
(condition P below) make money after costs, and does it make more than the same reading's trades without P?

## Condition P (fixed; nothing here is tuned)
Market structure is read with the page's own function `msAnalyze(bars, 6)` (through `loadFns()` of
`council/mosha-desk.mjs`; not edited). It returns `events`; each has `dir` (+1 up, -1 down), `breakIdx` (the index of the
candle whose close made the break) and `structure` (true = a structure shift, false = a continuation break). An event of a
timeframe is KNOWN at `bars[breakIdx].time + the timeframe's seconds` (the close of that candle). For a trade with side s
entered at time t, only events known at or before t are read. P holds when ALL three are true:
- **H1**: the last event known by t has `dir` = s;
- **M15**: the last event known by t has `dir` = s, `structure === true`, and became known at most 6 hours (21,600 s) before t;
- **M5**: the last event known by t has `dir` = s.
A timeframe with no event known by t makes P false. t is the trade's recorded entry (fill) time.

**Candles**: OANDA mid 5-minute candles from June 2019 (the files the trades were built on); M15 and H1 are built from them
by grouping on the candle's UTC time (time minus time modulo 900 / 3,600), as the trade builder did.

**No look-ahead**: `msAnalyze` is run once over each whole series only if, on at least 200 random cut points a timeframe,
the events (dir, breakIdx, structure) known by the cut are identical to those of the series cut there; that check is kept
as a test. If it fails, P is computed instead on the last 1,500 candles closed by t, per trade. Which of the two was used
is stated in the result.

## Data and windows
- **Trades**: the desks' own code run on gold, EUR/USD and GBP/USD for 2020-2025 by `research/edge/desk-partial/run.mjs`
  (files `partial-<market>.json`, kept outside git): per trade its reading (`kind`), market, side, entry time, entry, opening
  stop, the R the desk's own exit booked (`booked`) and its cost in R (`costR`). No trade is added, removed or re-run.
- **In sample** 2020-01-01 to 2023-12-31, **out of sample** 2024-01-01 to 2025-12-31 (UTC, by entry time). 2026 is excluded:
  it is the year the idea came from.
- **Costs**: the desk-rigor cost model, a round trip of 0.000045 x price + 0.5 pip on EUR/USD and GBP/USD and 0.00005 x price
  on gold, divided by the opening risk (the stored `costR`). Net R = booked R - costR. Every figure of the verdict is after
  costs.

## Groups
Every reading group present in the files with at least 100 out-of-sample trades (all trades, with and without P), each its
own group, plus the POOL of every trade in the files (small groups included). From the counts: Mosha sequence, Mosha barrier
entry, Engulf H1, Engulf H4, Engulf D1, Engulf plan, Engulf short method, MSNR with the direction 12-16 UTC, MSNR other
hours, MSNR gold plan, MSNR gold plan QM entry, LIT loose limit: 12 groups and the pool, 13 in all. (Engulf direct entry,
LIT rule and LIT market on the break have under 100 and are only in the pool.)

## Tests (per group and window)
- **(a) with P**: mean net R a trade of the trades with P; t = the t of calendar-month sums of their net R against zero.
- **(b) with P minus without P**: the difference of mean net R a trade (trade level), its Welch t on trades, and the paired
  month difference (per calendar month holding both kinds: mean net R with P minus mean without; its mean and t).
- p values are two-sided from a normal on the t (test a: the month-sum t; test b: the paired month t), out of sample.
  **Holm** across all 26 out-of-sample tests (13 groups x 2).

## Pass bar (a group passes only with ALL of)
1. out of sample, mean net R with P > 0, month-sum t >= 2, and Holm p of test (a) < 0.05;
2. in sample, mean net R with P > 0;
3. the with-minus-without difference of mean net R > 0 in sample AND out of sample;
4. at least 30 out-of-sample trades with P (fewer = too few to judge = not a pass).

## Placebo
The same condition computed for the OPPOSITE side (P with s replaced by -s: H1, M15 with a fresh structure shift, and M5 all
AGAINST the trade), on the same trades, same groups, same bar. It must not pass. A group whose placebo passes is not counted
as a pass (the result would not be about agreeing with the structure).

## Verdict
**PASS** if at least one group or the pool passes its bar and its placebo does not; otherwise **FAIL**. Each group's own
PASS / FAIL is listed. Also reported, with no verdict: the share of trades P keeps per group and window, figures before
costs, and the trade-level Welch t.

A pass would be a candidate for its own forward paper record, never a live rule without the owner. A fail closes the
question on these years: no variant of P (other timeframes, other look-backs, other freshness windows) is run on 2020-2025.

## Limits known in advance
- The trades are each desk's reading as its code stood on 21 Nov 2026; the desks have changed since.
- Each trade is taken as booked, alone; a desk that skipped the trades without P would have held other positions.
- Months and markets overlap between groups, and the pool is dominated by the Mosha barrier entries (about 59 % of trades).
- Three markets, OANDA mid candles; costs are today's model charged on every year.
