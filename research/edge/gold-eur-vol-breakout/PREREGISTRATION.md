# Pre-registration: the gold volatility breakout's T1 rule, unchanged, on gold priced in euros (XAU/EUR) (14 Nov 2026)

Written and pushed alone, before any XAU/EUR trade of this rule is computed. The test runs once; nothing below is changed after
a result is seen. Paper research only: nothing live changes, no council member, page, mirror or config reads it.

## The question
The daily volatility breakout `gold-vol-breakout` T1 (UTC open ± 0.5 × the previous folded day's range, stop back at the open,
out at 21:00 UTC) passed on untouched XAU/USD 2007-15 (branch `gold-vol-breakout-replicate`: +0.111R a trade net, n 1,657,
month t 3.19), was confirmed on a second feed (`gold-vol-breakout-histdata`), holds across k (`gold-vol-breakout-k`), and failed
on NAS100 / SPX500 (`index-vol-breakout`) and on silver (`silver-vol-breakout`). **Is the effect about gold itself, or about
the dollar leg of XAU/USD?** If it is gold's, the same rule on gold priced in euros should show it too; if it lives in the
dollar, XAU/EUR (where the dollar cancels out) should not.

- **Stand-alone.** Never a gate, exit, entry or size of the live gold book (owner decision 44); no live record is read.
- **Only the market and its cost change.** The trading functions are imported unchanged from `original.mjs`, a verbatim copy
  of the `gold-vol-breakout` study's `run.mjs` (the file of branch `gold-vol-breakout-replicate`, sha256
  `afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f`, pinned in the test): `buildDays`, `daySkip`,
  `vbTrade`, `placeboTrade`, `monthT`, `normP`, `rng`, `quantile`, `summary`, `TESTS.T1`, `SEEDS`, `PLACEBO`. That file
  imports `council/fills.mjs` (`foldWeekend`, `nights`, `FIN`) read only. `run.mjs` only sets the window, the cost per day,
  runs the test, the placebo and the descriptive comparison, and writes the report.
- Dedupe (read before writing this): `gold-vol-breakout`, `-replicate`, `-histdata`, `-k`, `-costs`, `-risk`,
  `gold-weekly-vol-breakout`, `index-vol-breakout`, `silver-vol-breakout`, `nr7-breakout`, and the backlog
  `research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`). No study has run any rule on XAU/EUR.

## Data
OANDA mid XAU/EUR (`xaueur`, instrument `XAU_EUR`) M5 candles read through the keyless candle proxy
(`/md/bars?sym=xaueur&tf=5m&from=&to=`), cached out of git (`xaueur-5m.json.gz`, rows `[t, o, h, l, c, v]`). Before this file
was written only the cache's shape and span were looked at: 1,496,024 rows, the first candle 2006-03-18 20:45 UTC (OANDA serves
nothing earlier), the last 2026-11-13 21:55 UTC, 60-78 thousand rows a year. No price, range or trade was computed.
- **Window: from the first full month served, 2006-04-01, to 2026-10-31.** The forming last day is left out.
- D1 = the complete UTC day built from the M5 candles, Saturday / Sunday folded into the next weekday (`foldWeekend`), as the
  original. Day skips as the original (no previous D1, range not above 0, no M5 candle 00:00-00:55 UTC, under 200 M5 candles
  00:00-20:55 UTC).

## Rule (T1 of gold-vol-breakout, unchanged)
O = open of the day's first M5 candle at or after 00:00 UTC; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange
live 00:00-20:55 UTC, first filled wins, one trade a day; a gap fills at the candle's open; a candle reaching both: the level
nearer its open. Stop = O from the fill (1R = |fill − O|); a fill candle that also reaches the stop is booked as a stop; later a
candle opening through the stop exits at its open. Exit at the close of the last M5 candle starting before 21:00 UTC. No target.

## Costs
- **0.016 % of the price a round trip** (spread and slippage), the XAU/USD study's $0.60 a round trip scaled to price
  (0.60 / 3,700 ≈ 0.016 %). XAU/EUR's spread is wider than XAU/USD's; the repository has no measured XAU/EUR spread,
  so the cost is stated, not measured. Per day it is 0.00016 × O (the day's open, known before any order), passed
  as `vbTrade`'s `cost` argument; 1R in euros, cost / 1R taken off every trade.
- Financing: the original's `FIN.xau.long` (0.000148 of the entry price a rollover, the demo's XAU/USD swap of 11 Nov 2026) ×
  `nights` on buys, sells nothing; assumed for XAU/EUR (no measured rate). The 21:00 exit is before the 22:00 rollover, so it is
  expected to be 0; it is counted anyway.
- 2x costs: twice the cost and twice the financing, reported.

## Windows
- Pooled 2006-04-01 → 2026-10-31 decides the t. Halves (the brief's in / out of sample split): **H1 2006-04 → 2016-12** and
  **H2 2017-01 → 2026-10**. Neither was used to find this rule on XAU/EUR; all of it is out of sample for this market.

## Statistics
- Per window: n, win %, gross and net R a trade, net at 2x costs, total, worst drawdown in R, t on calendar-month sums of net R
  (and of gross R and of net at 2x costs), by year, by side.
- One test only (T1), so Holm over one test = its own p; the one-sided normal p of the pooled month t is reported.
- **Placebo** (the replicate study's design, the original's `placebo` logic), 40 seeds (seeds 1-40, the original's `rng`):
  on every day of the pooled window T1 could trade, one market entry at the open of an M5 candle drawn uniformly 01:00-18:00 UTC
  (5-minute grid), side by a fair coin, stop 0.5 × prevRange away, out at 21:00 UTC or the stop, the same cost per day. Each seed
  gives a mean net R a trade.

## Pass bar
PASS only when ALL hold:
1. pooled 2006-04 → 2026-10 month-sum t of net R ≥ 2;
2. net R a trade > 0 in H1 AND in H2;
3. pooled net R a trade > 0 at 2x costs;
4. the pooled real mean net R a trade beats at least 38 of the 40 placebo seed means;
5. n ≥ 30 in each half.

## Secondary, descriptive (no pass / fail)
- T1 on XAU/USD on the same window, from the XAU/USD M5 cache the replicate study used (`xau-5m.json.gz`, OANDA mid, out of
  git; it starts 2006-11, so the reference begins there), with the original's $0.60 cost, as the reference.
- On the days both markets took a T1 trade: the daily correlation of XAU/EUR gross R with XAU/USD gross R (and of net R), and
  the share of those days on which both trades took the same side.
- Reading: a pass with a low same-side share would say the breakout is in gold's own moves; a fail alongside a high XAU/USD
  result would say the dollar leg carries it. Either reading is descriptive.

Whatever the verdict, nothing live changes and no proposal is written here.
