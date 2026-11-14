# Pre-registration: the gold volatility breakout's T1 rule, unchanged, on platinum and palladium (14 Nov 2026)

Written and pushed alone, before any platinum or palladium candle of this study is fetched or any trade computed. The test runs
once; nothing below is changed after a result is seen. Paper research only: nothing live changes, no council member, page,
mirror or config reads it.

## The question
The daily volatility breakout `gold-vol-breakout` T1 (UTC open ± 0.5 × the previous folded day's range, stop back at the open,
out at 21:00 UTC) passed on untouched XAU/USD 2007-15 (branch `gold-vol-breakout-replicate`: +0.111R a trade net, n 1,657,
month t 3.19), held on a second feed (`gold-vol-breakout-histdata`) and on gold in euros (`gold-eur-vol-breakout`: +0.067R,
t 3.50); it failed on silver (`silver-vol-breakout`: gross month t 3.37, costs larger than the gross) and on NAS100 / SPX500
(`index-vol-breakout`). **Is the gold result a precious-metals effect, or is it gold's alone?** This is a supporting robustness
check for the gold rule, not a candidate rule for these markets: the same rule on the other two precious metals, platinum
(`xpt`) and palladium (`xpd`).

- **Stand-alone.** Never a gate, exit, entry or size of the live gold book (owner decision 44); no live record is read.
- **Only the market and its cost change.** The trading functions are imported unchanged from `original.mjs`, a verbatim copy
  of the `gold-vol-breakout` study's `run.mjs` (the file of branch `gold-vol-breakout-replicate`, sha256
  `afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f`, pinned in the test): `buildDays`, `daySkip`, `vbTrade`,
  `placeboTrade`, `monthT`, `normP`, `holm`, `rng`, `quantile`, `summary`, `TESTS.T1`, `SEEDS`, `PLACEBO`. That file imports
  `council/fills.mjs` (`foldWeekend`, `nights`, `FIN`) read only. `run.mjs` only sets the windows and the cost per day, runs the
  two tests, the placebos and the descriptive comparison, and writes the report.
- Dedupe (read before writing this): `gold-vol-breakout`, `-replicate`, `-histdata`, `-k`, `-costs`, `-risk`, `-reverse`,
  `-h4-side`, `gold-weekly-vol-breakout`, `gold-eur-vol-breakout`, `silver-vol-breakout`, `index-vol-breakout`,
  `metals-intraday-momentum`, `gold-platinum-ratio`, `drd-metals-book`, `ict-breadth-2` (the ICT rule on platinum and
  palladium, not this one), and the backlog `research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`).
  No study has run this breakout on platinum or palladium.

## Market set (fixed now)
Exactly two markets: **platinum `xpt` (OANDA `XPT_USD`)** and **palladium `xpd` (OANDA `XPD_USD`)**. No other market is added
or swapped after a result is seen.

## Data
OANDA mid M5 candles of each market through the keyless candle proxy (`/md/bars?sym=xpt|xpd&tf=5m&from=&to=`), fetched in
windows with `node --use-env-proxy`, cached out of git (`<dir>/xpt-5m.json.gz`, `<dir>/xpd-5m.json.gz`, rows `[t,o,h,l,c,v]`).
The first candle OANDA serves is not known to me when this is written.
- **Window, per market: from the first full calendar month served to 2026-10-31.** (If the first candle falls on the 1st of a
  month at 00:00 UTC, that month counts as full.) The forming last day is never used.
- D1 = the complete UTC day built from the M5 candles, Saturday / Sunday folded into the next weekday (`foldWeekend`), as the
  original. Day skips as the original (no previous D1, range not above 0, no M5 candle 00:00-00:55 UTC, under 200 M5 candles
  00:00-20:55 UTC). These CFDs were quoted only part of the day in the early years (`ict-breadth-2`: 5-14 hours a day in
  2008-13), so many early days are expected to be skipped by the original's `thin` / `noopen` rules; the skips are reported,
  not changed.

## Rule (T1 of gold-vol-breakout, unchanged)
O = open of the day's first M5 candle at or after 00:00 UTC; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange
live 00:00-20:55 UTC, first filled wins, one trade a day; a gap fills at the candle's open; a candle reaching both: the level
nearer its open. Stop = O from the fill (1R = |fill − O|); a fill candle that also reaches the stop is booked as a stop; later a
candle opening through the stop exits at its open. Exit at the close of the last M5 candle starting before 21:00 UTC. No target.

## Costs (a share of price, fixed now)
- **Platinum 0.30 % of price a round trip; palladium 0.80 % of price a round trip** (spread and slippage). Source: the
  repository's own cost model for these two CFDs in `research/edge/ict-breadth-2/preregistration.md` (silver's model, spread +
  a third of it as slippage, on OANDA's typical spreads of about 0.22 % of price for platinum and 0.6 % for palladium). These
  are wide: the spreads are stated there as typical, not measured on a demo account; the repository has no measured XPT / XPD
  spread. Per day the cost is pct × O (the day's open, known before any order), passed as `vbTrade`'s `cost` argument; 1R in
  dollars, cost / 1R taken off every trade.
- Reported at **0.5x, 1x and 2x** that cost. The decision uses 1x (and the 2x check below).
- Financing: the original's `FIN.xau.long` (0.000148 of the entry price a rollover, the demo's XAU/USD swap of 11 Nov 2026) ×
  `nights` on buys, sells nothing; assumed for these metals (no measured rate). The 21:00 exit is before the 22:00 rollover, so
  it is expected to be 0; it is counted anyway (doubled at 2x, as the original's `net2`).

## Windows
- Per market, **pooled** (first full month → 2026-10-31) decides. Halves (the brief's split): **IS = first full month →
  2016-12-31**, **OOS = 2017-01-01 → 2026-10-31**. All of it is out of sample for this rule on these markets.

## Statistics
- Per market and window: n, win %, gross and net R a trade, net at 0.5x and 2x costs, total, worst drawdown in R, t on
  calendar-month sums of net R (and of gross R and of net at 2x), by year, by side, days skipped by reason.
- **Two tests** (T1 on xpt, T1 on xpd). One-sided normal p of each pooled net month t (`normP`), **Holm over the two**.
- **Placebo** (the original's design), 40 seeds (1-40, the original's `rng`), per market: on every day of the pooled window
  T1 could trade, one market entry at the open of an M5 candle drawn uniformly 01:00-18:00 UTC (5-minute grid), side by a fair
  coin, stop 0.5 × prevRange away, out at 21:00 UTC or the stop, the same cost per day. Each seed gives a mean net R a trade.

## Pass bar (per market)
A market PASSES only when ALL hold:
1. pooled month-sum t of net R ≥ 2 **and** its Holm-adjusted one-sided p < 0.05;
2. net R a trade > 0 in IS AND in OOS;
3. pooled net R a trade > 0 at 2x costs;
4. the pooled real mean net R a trade beats at least 38 of the 40 placebo seed means;
5. n ≥ 30 in each half.

## Secondary, descriptive (no pass / fail)
- Gross R and gross month t per market and window: whether the mechanism exists before costs.
- T1 on XAU/USD (OANDA mid M5, the replicate study's cache `xau-5m.json.gz`, out of git) with the original's $0.60 cost on the
  same windows. On the days both a metal and XAU/USD took a T1 trade: the daily correlation of gross R (and of net R) and the
  share of those days with the same side.

## Reading, fixed now
- Both metals pass, or a metal's gross month t ≥ 2 in both halves although costs take it: the breakout is a precious-metals
  mechanism, of which gold is the cheapest to trade.
- Neither metal shows it before costs (gross pooled month t < 2): the gold result is gold's alone (with silver's gross result,
  read as "gold and silver, not the platinum group").
- Anything else is described as it is. Whatever the verdict, nothing live changes and no proposal is written here.
