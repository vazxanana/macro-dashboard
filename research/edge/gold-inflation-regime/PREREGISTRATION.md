# Pre-registration: long gold while stocks and bonds move together (14 Nov 2026)

Written and pushed alone, before any trade is simulated or any regime day is counted. Paper research only: a stand-alone
rule on spot gold (XAU/USD), never a gate, exit, entry or size change of the live gold book, and none of the book's
positions is read (owner decision 44). Nothing live changes, whatever the outcome.

## Idea and economic reason

The sign of the correlation between stock and government-bond returns marks the macro regime. When it is negative (as in
most of 2000-2021) bonds hedge equities: shocks are growth shocks and the central bank can cut. When it is positive
(stocks and bonds fall and rise together, as in 2022-23 and before 2000) the dominant shock is inflation or the policy
rate itself (Campbell, Pflueger and Viceira, "Macroeconomic drivers of bond and equity risks", Journal of Political
Economy 128(8), 2020; Baele, Bekaert and Inghelbrecht, Review of Financial Studies 23(6), 2010). In that regime the
usual 60/40 hedge fails and investors look for another diversifier; gold is the classic inflation and "neither stocks
nor bonds" asset. The hypothesis: **a long gold position earns more than gold's ordinary drift while the stock-bond
correlation is positive.**

The test is built to separate this from gold's upward drift (gold rose about fivefold 2007-26, so any long looks good):
the primary statistic is each long's net R **minus the mean net R of the same long taken on every eligible day of the same
window** (in sample or out of sample), and the placebo replaces each trade's day by a random eligible long day.

## Dedupe (read before writing this)

- `stock-bond-corr` (branch): held the S&P 500 / Nasdaq / Dow only while the 60-day stock-bond correlation was negative.
  FAIL. Equity indices, not gold, and the other regime.
- `gold-equity-corr-momentum` (branch): gold's 10-day momentum split by the GOLD-equity correlation. FAIL. Another
  correlation (gold's own with equities) and a momentum trade.
- `gold-bond-lead`, `macro-gold`, `gold-curve-slope`, `gold-rate-spread`, `gold-commodity-inflation`, `gold-equity-bear`,
  `gold-haven-shock`, `gold-autocorr-switch`, `gold-regime-switch`, `regime`, `regime-switch`: bond moves or rate levels as
  a lead, equity bear markets or shocks, gold's own regimes. None conditions gold on the sign of the STOCK-BOND correlation.
- The untested backlog (`research/proposals/2026-11-14-untested-backlog.md`, branch `untested-backlog`) does not list it;
  `ls research/edge`, every remote branch name and the shared topics list read. New.

## Data (named before any result)

- Gold (traded): council-data `research/daily/xau.json` (OANDA XAU/USD mid, UTC daily candles), at council-data commit
  `fff1565f5`, weekend stubs folded into the next weekday with `council/fills.mjs` `foldWeekend`.
- Read only for the signal: `research/daily/spx500.json` (OANDA SPX500_USD mid) and `research/daily/usb10y.json` (OANDA
  USB10Y_USD mid, the price of a US 10-year note CFD: up = yields down), same commit, same fold.
- Market set: gold only is traded. No other market is read.

## Rule

At the UTC close of gold day i (from closes up to and including day i, never later):
- `C` = Pearson correlation of the 63 latest daily log returns of the S&P 500 and of the 10-year note, on the days all three
  markets (gold, S&P 500, note) have a candle of that date, each return close-to-close from the previous common day,
  ending at day i. A gold day without both other candles carries no signal; fewer than 63 common returns, no signal.
- Trade: entry at the open of day i+1; stop 2 x ATR(20) of gold (true range, days i-19..i) from the entry, every trade has
  a stop; out at the close of day i+10 (10 trading days) or at the stop (a gap through the stop fills at the open). One
  position at a time per test.
- Costs: $0.60 a round trip (a $0.30 spread plus $0.15 slippage each side, as `gold-equity-corr-momentum`), plus on buys
  `nights(entry, exit) x FIN.xau.long x entry` (`council/fills.mjs`: 0.000148 of price a rollover, the demo broker's
  11 Nov 2026 XAUUSD swap.long, today's rate charged for every year). Sells pay and are credited nothing. R = 1 x the stop
  distance.

## Tests (three, Holm over the three; the verdict follows T1)

- **T1 (primary): long gold when C > 0.**
- T2: long gold when C > +0.3 (a clearly positive correlation).
- T3: short gold when C < 0 (the hedging regime: the same story says gold is least needed there).

Same-side baseline for each test: the same trade (same side, stop, hold, costs) started on **every** gold day with a
computable C whose trade exits in the window (overlapping, all days). **Excess** of a trade = its net R minus the mean net R
of that baseline in the trade's window (in sample or out of sample); at 2x costs, the 2x net R minus the 2x baseline mean.

Windows by exit month: in sample 2007-01 to 2016-12, out of sample 2017-01 to 2026-10.

Statistics: t on calendar-month sums of excess R (every calendar month of the window, empty months 0), one-sided p (excess
> 0), Holm over the three tests.

Pass bar for each test: OOS month mean of excess > 0 with t >= 2 and Holm p < 0.05; the in-sample excess mean > 0 (same
sign); the OOS mean of plain net R > 0 AND the OOS excess > 0 at 2x costs and financing; the OOS excess t above the
placebo's 95th percentile (more than 38 of 40 seeds below it).

Placebo: 40 seeds (mulberry32, seeds 1-40). Each real trade is replaced by a random baseline trade of the same side that
exits in the same window; the OOS month t of the seed's excess.

Reported beside the tests (not tests): plain net R and its month t per test and window, gross R, cost share, median stop,
share of days with C > 0 and C > 0.3 in each window, the baselines' own net R, per-year sums.

Expected: few in-regime days in 2007-16 (the correlation was mostly negative before 2021), so T1's in-sample n will be
small; that is accepted and will be reported. If T1 fails, nothing is proposed. If it passes, it is a lead to replicate on
other data, never a council rule without the owner.
