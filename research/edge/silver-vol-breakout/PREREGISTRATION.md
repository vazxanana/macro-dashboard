# Pre-registration: the gold volatility breakout's T1 rule, unchanged, on silver (14 Nov 2026)

Written and pushed alone, before any silver trade of this rule is computed. The test runs once; nothing below is changed after a
result is seen. Paper research only: nothing live changes, no council member, page, mirror or config reads it.

## What this is, and what it is not
- **A robustness check of `gold-vol-breakout` (branch `gold-vol-breakout`), not a new rule.** That study's primary rule T1
  (UTC open ± 0.5 × the previous day's range, stop back at the open, out at 21:00 UTC) failed narrowly on gold: 2021 → now
  +0.072R a trade net (n 1,121, month t 1.86, Holm p 0.094); before costs month t 2.87 in 2016-20 and 3.21 in 2021-26. The
  question here: does the same breakout effect show in a closely related market the rule was not found on, spot silver?
- **Stand-alone. It is never a gate, exit, entry or size of the live gold book** (owner decision 44), and not a rule for any
  live book. No live record is read.
- The rule is T1 exactly as `gold-vol-breakout` registered it; only the market and its cost change. T2 and T3 of that study
  are not run here. A replication of T1 on gold 2007-15 is a separate study and is not touched.
- Dedupe (read before writing this): `gold-drd-silver` (a daily rejection long, other rule), `gold-silver-divergence`,
  `gold-silver-ratio`, `gold-silver-lead-intraday`, `metals-rsi2`, `nr7-breakout`, `ict-silver-bullet-gold`,
  `drd-metals-book`, `post-holiday-metals`. None places stop orders at the UTC open ± a multiple of the previous day's range on
  silver.

## Data
OANDA mid XAG/USD M5 candles read through the keyless candle proxy (a cache file kept out of git: `xag-5m.json.gz`, rows
`[t, o, h, l, c, v]`, 2016-01-01 04:10 UTC to 2026-11-13 21:55 UTC, 756,433 rows; only its shape and span were looked at).
Every fill and exit is walked on M5. The forming last day is left out.
- **D1** = the complete UTC day built from the M5 candles, Saturday / Sunday folded into the next weekday with
  `council/fills.mjs` `foldWeekend`, as in `gold-vol-breakout`.
- **Trading days** = UTC Monday to Friday from 2016-01-01 to the last complete day. A day is skipped when it has no previous
  folded D1, when that range is not above 0, when no M5 candle starts 00:00-00:55 UTC, or when fewer than 200 M5 candles
  start 00:00-20:55 UTC (the same skips as the gold study).

## Rule (T1 of gold-vol-breakout, unchanged)
- O = the open of the day's first M5 candle at or after 00:00 UTC; prevRange = high − low of the previous folded D1.
- Buy stop at O + 0.5 × prevRange and sell stop at O − 0.5 × prevRange, live on every M5 candle starting 00:00-20:55 UTC; the
  first reached fills, the other is cancelled; one trade a day at most. A gap fills at the candle's open; one candle reaching
  both: the level nearer its open (equal: the buy).
- Stop = O (every trade has it from the fill); 1R = |fill − O|. A reach of the stop inside the fill candle counts as stopped;
  later a candle opening through the stop exits at its open, a touch at the stop.
- Exit at the close of the last M5 candle starting before 21:00 UTC unless stopped first. No target.
- Code: `gold-vol-breakout/run.mjs`'s functions `buildDays`, `daySkip`, `vbTrade`, `placeboTrade`, `monthT`, `normP`, `rng`,
  `quantile` are copied into this study's `run.mjs` unchanged in logic (that study is not on main, so it cannot be imported);
  only the cost constant and the financing key differ.

## Costs
- **$0.03 a round trip per ounce of silver** (spread and slippage together), the silver figure the repository already uses:
  `api/_ictlab.js` `COST.xag` 0.03 and `research/edge/gold-drd-silver` (cost $0.03 a round trip, scaled from gold). Taken off
  every trade in R (0.03 / 1R).
- Financing: the repository has no measured silver rate (`council/fills.mjs` `FIN` holds gold only). Assumed: gold's
  `FIN.xau.long` (0.000148 of the entry price a rollover, the cTrader demo's XAUUSD swap of 11 Nov 2026) × `nights` on buys,
  sells nothing. With the 21:00 exit no trade crosses the 22:00 rollover, so it is expected to be 0; it is counted anyway.
- 2x costs: $0.06 a round trip and twice the financing.

## Windows
- 2016-01-01 to 2020-12-31 and 2021-01-01 to the end of the data (2026-11), as in `gold-vol-breakout`. Neither window was used
  to find this rule on silver; both are out of sample for silver. The pooled 2016 → now series decides the t.

## Statistics
- Per window and pooled: n, win %, gross and net R a trade, total, worst drawdown in R, t on calendar-month sums of net R (and
  of gross R and of net at 2x costs, reported), by year, by side.
- One test only, so no Holm correction; the one-sided p of the pooled month t (normal) is reported.
- **Placebo**, 40 seeds (seeded generator, seeds 1-40), pooled 2016 → now: on every day the rule could trade, one market entry
  at the open of an M5 candle drawn uniformly from 01:00-18:00 UTC (5-minute grid), side by a fair coin, stop 0.5 × prevRange
  away, out at 21:00 UTC or the stop, the same costs. Each seed gives a mean net R a trade.

## Pass bar
The study PASSES only when ALL hold:
1. net R a trade > 0 in 2016-20 AND in 2021 → now;
2. pooled 2016 → now month-sum t of net R ≥ 2;
3. pooled net R a trade > 0 at 2x costs;
4. the pooled real mean net R a trade beats at least 38 of the 40 placebo seed means;
5. n ≥ 30 in each window.

Whatever the verdict, nothing live changes and no proposal is written here. A pass would say only that the breakout effect seen
before costs on gold also appears after costs on silver; it would not make either an edge to trade without its own forward
paper record and the owner's decision.
