# Pre-registration: the gold volatility breakout's T1 rule, unchanged, on NAS100 and SPX500 (14 Nov 2026)

Written and pushed alone, before any index trade of this rule is computed. The test runs once; nothing below is changed after a
result is seen. Paper research only: nothing live changes, no council member, page, mirror or config reads it. Not part of the
ICT edge (nothing under `ict/` is read or touched, and no ICT record or rule is used).

## What this is, and what it is not
- **A robustness check of `gold-vol-breakout` (branch `gold-vol-breakout`), not a new rule.** Its primary rule T1 (UTC open ±
  0.5 × the previous day's range, stop back at the open, out at 21:00 UTC) failed narrowly on gold 2021 → now (+0.072R a trade
  net, n 1,121, month t 1.86), then passed on untouched gold 2007-15 (`gold-vol-breakout-replicate`: +0.111R net, n 1,657,
  month t 3.19) and was run on an independent gold feed (`gold-vol-breakout-histdata`). On silver it was positive before costs
  and negative after (`silver-vol-breakout`: 2016 → now −0.084R net, gross +0.086R, n 2,015).
- **The question:** is this a gold-specific effect, or a general intraday volatility-breakout effect? The same rule, unchanged,
  on two US index CFDs the rule was not found on.
- Stand-alone. Never a gate, exit, entry or size of the live gold book (owner decision 44) or of any live book.
- Dedupe (read before writing this): `orb-nas100`, `intl-index-orb` (opening-range breakouts at the cash open, other rule),
  `nr7-breakout` (bracket orders after a narrowest-of-seven day, other trigger), `index-low-vol`, `vol-managed-index`
  (volatility sizing, no breakout), `index-overnight`, `index-midday-turn`, the `gold-vol-breakout*` and
  `silver-vol-breakout` branches (gold and silver only), and the 14 Nov untested backlog. None places stop orders at the UTC
  open ± a multiple of the previous day's range on an index.

## Data (named before any result)
- Markets, fixed now and not changed: **NAS100 (Nasdaq 100 CFD) and SPX500 (S&P 500 CFD)**, OANDA mid M5, read through the
  keyless candle proxy into cache files kept out of git (`nas100-5m.json.gz`, 770,832 rows; `spx500-5m.json.gz`, 753,827
  rows; rows `[t, o, h, l, c]`, 2015-12-01 00:00 UTC to 2026-11-13 21:55 UTC). Only their shape, span and which UTC hours
  carry candles were looked at.
- **The daily halt.** OANDA's US index CFDs follow the CME session: they stop for one hour at 17:00 New York, which is
  21:00-22:00 UTC while the US is on daylight time and 22:00-23:00 UTC otherwise (no candles in those hours in the files), and
  for the weekend from Friday 21:00 / 22:00 UTC to Sunday 22:00 / 23:00 UTC. So:
  - **00:00 UTC is inside the continuous session** every weekday (Monday's 00:00 is one or two hours after the Sunday reopen):
    the rule's "open" O = the open of the 00:00 UTC M5 candle, well defined. The rule's times are not changed.
  - **The rule's day 00:00-20:55 UTC never contains the halt**, and the 21:00 exit falls at or before the halt's start, so the
    last candle starting before 21:00 UTC (20:55) exists on a normal day.
  - **D1** = the complete UTC calendar day built from its M5 candles (high − low over every candle of that UTC day), exactly as
    in `gold-vol-breakout`: the halt hour simply has no candles; Saturday / Sunday candles (the Sunday reopen stub) are folded
    into the next weekday with `council/fills.mjs` `foldWeekend`, so Monday's previous range is Friday's.
  - US exchange holidays: an early close (about 17:00-18:00 UTC) leaves about 216 candles before 21:00 and the trade exits at
    the close of the last candle on file before 21:00 (the rule's own "last candle" handling); a day with fewer than 200 M5
    candles starting 00:00-20:55 UTC, or no candle starting 00:00-00:55 UTC, is skipped (the gold study's skips, unchanged).
- Trading days = UTC Monday to Friday from 2016-01-01 to the last complete day; the forming last day is left out.

## Rule (T1 of gold-vol-breakout, unchanged)
- O = the open of the day's first M5 candle at or after 00:00 UTC; prevRange = high − low of the previous folded D1.
- Buy stop at O + 0.5 × prevRange and sell stop at O − 0.5 × prevRange, live on every M5 candle starting 00:00-20:55 UTC; the
  first reached fills, the other is cancelled; one trade a day at most. A gap fills at the candle's open; one candle reaching
  both: the level nearer its open (equal: the buy).
- Stop = O (every trade has it from the fill); 1R = |fill − O|. A reach of the stop inside the fill candle counts as stopped;
  later a candle opening through the stop exits at its open, a touch at the stop.
- Exit at the close of the last M5 candle starting before 21:00 UTC unless stopped first. No target.
- **Code:** `original.mjs` in this folder is a byte-for-byte copy of `research/edge/gold-vol-breakout/run.mjs` (branch
  `gold-vol-breakout`; identical to `gold-vol-breakout-replicate/original.mjs`; sha256
  afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f), copied because main does not have it. `run.mjs` imports
  its `buildDays`, `daySkip`, `vbTrade`, `placeboTrade`, `monthT`, `normP`, `holm`, `rng`, `quantile`; only the market, the
  cost and the financing key change (net R is recomputed from the trade's own R, 1R, side, entry and nights).

## Costs
- **Round trip, spread and slippage together: NAS100 3 index points, SPX500 1 index point** — the repository's index figures
  from `research/edge/nr7-breakout` (RESULT.md "Costs": "round-trip spread (gold $0.30, NAS100 3 points, SPX500 1 point …)").
  Taken off every trade in R (cost / 1R).
- **Financing**, the nr7-breakout formula, per 22:00 UTC rollover counted with `council/fills.mjs` `nights`: longs
  (DGS2 + 2.5 %) / 365 of the entry price a night, shorts max(0, 2.5 % − DGS2) / 365. DGS2 is not read: an assumed 5 %
  (above every 2016-26 value, so an upper bound for longs). With the 21:00 UTC exit no trade crosses the 22:00 UTC rollover,
  so it is expected to be 0 for every trade; it is counted anyway and reported.
- 2x costs: twice the point cost and twice the financing.

## Windows
- 2016-01-01 to 2020-12-31 and 2021-01-01 to the end of the data (2026-11). Both are out of sample for these markets (the rule
  was found on gold). The whole 2016 → now series per market decides the t (as in `silver-vol-breakout`).

## Statistics
- Per market and pooled (both markets' trades together), per window and 2016 → now: n, win %, gross and net R a trade, net at
  2x costs, total, worst drawdown in R, t on calendar-month sums of net R, of gross R and of net at 2x costs, by year, by side.
- **Two tests (NAS100, SPX500)**: one-sided p of each market's 2016 → now month t of net R (normal), Holm over the two. The
  pooled series is reported (its month t too) but is not one of the two tests.
- **Placebo**, 40 seeds (seeded generator, seeds 1-40), per market, 2016 → now: on every day the rule could trade, one market
  entry at the open of an M5 candle drawn uniformly from 01:00-18:00 UTC (5-minute grid), side by a fair coin, stop 0.5 ×
  prevRange away, out at 21:00 UTC or the stop, the same costs. Each seed gives a mean net R a trade.

## Pass bar
A market PASSES only when ALL hold:
1. net R a trade > 0 in 2016-20 AND in 2021 → now;
2. 2016 → now month-sum t of net R ≥ 2 AND its Holm-adjusted p < 0.05 (over the two markets);
3. 2016 → now net R a trade > 0 at 2x costs;
4. the 2016 → now real mean net R a trade beats at least 38 of the 40 placebo seed means;
5. n ≥ 30 in each window.

**"The effect generalises" only when BOTH markets pass.** One market passing: "partial", a hypothesis for its own
pre-registration on other data, not an edge. Neither: the effect is not general (read with gold's own record: gold-specific or
not shown beyond gold). Gross R and gross month t are reported for every market and window, because silver showed gross and
net can split.

Whatever the verdict, nothing live changes and no proposal is written here.
