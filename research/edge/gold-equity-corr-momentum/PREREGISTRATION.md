# Pre-registration: gold's 10-day momentum split by its correlation with the S&P 500 (14 Nov 2026)

Written and pushed alone, before any trade is simulated or any regime is counted. Paper research only: a stand-alone rule,
never a gate, exit, entry or size change of the live gold book, and none of the book's 2006-17 positions is read
(owner decision 44). Nothing live changes.

## Idea

Gold is sometimes priced as a haven (its daily returns move against equities) and sometimes as a risk asset (they move
with equities). The hypothesis: in the haven regime gold's moves are driven by persistent flows (de-risking, hedging
demand), so a 10-day move tends to continue; in the risk-asset regime it is a passenger of equity sentiment and its
moves persist less. The idea is new here: `gold-tsmom` tested momentum unconditionally, `gold-autocorr-switch` split
5-day momentum by gold's own autocorrelation, `gold-haven-shock` / `gold-equity-bear` bought gold after equity shocks
or in equity bear markets, `stock-bond-corr` held equities by the stock-bond correlation. None conditions gold's
momentum on the gold-equity correlation.

The test is both-sided (it buys after a 10-day rise and sells after a 10-day fall), and its placebo replaces each
trade's signal day with a random day of the same side, so gold's upward drift is measured against itself.

## Data (named before any result)

- Gold: council-data `research/daily/xau.json` (OANDA XAU/USD mid, UTC daily candles, weekend stubs folded into the next
  weekday with `council/fills.mjs` `foldWeekend`), at council-data commit `67bac79eb`.
- Equities: council-data `research/daily/spx500.json` (OANDA SPX500_USD mid), same commit, same fold.
- Market set: gold only is traded. The S&P 500 CFD is read only for the correlation. No other market is read.

## Rule

At the UTC close of gold day i (computed from closes up to and including day i, never later):
- `M` = gold's 10-day return, close(i) / close(i-10) - 1.
- `C` = Pearson correlation of the 60 latest daily log returns of gold and of the S&P 500, on the days both have a close
  (each return close-to-close of that market's previous common day), ending at day i. The S&P close used for a date is its
  own UTC daily candle of that date; a gold day with no S&P candle of the same date carries no signal.
- Signal side = sign(M); no signal when M = 0 or C cannot be computed (fewer than 60 common returns).
- Entry at the open of day i+1. Stop 2 x ATR(20) of gold (true range, days i-19..i) from the entry; every trade has a stop.
  Out at the close of day i+10 (10 trading days) or at the stop (a gap through the stop fills at the open). One position
  at a time per test.
- Costs: $0.60 a round trip (the $0.30 spread plus $0.15 slippage each side, as `gold-autocorr-switch`), plus on buys
  `nights(entry, exit) x FIN.xau.long x entry` (council/fills.mjs: the demo broker's 11 Nov 2026 XAUUSD swap.long, today's
  rate charged for every year). Sells are credited nothing. R = 1 x the stop distance.

## Tests (three, Holm over the three; the verdict follows T1)

- **T1 (primary): haven-regime momentum.** Trade sign(M) on days with C < 0.
- T2: risk-regime momentum. Trade sign(M) on days with C >= 0.
- T3: does the regime matter: the calendar-month series of T1 net R minus T2 net R (both from their own one-at-a-time
  streams), t on that difference, one-sided (T1 better).

Windows by exit month: in sample 2007-01 to 2016-12, out of sample 2017-01 to 2026-10.

Statistics: t on calendar-month sums of net R (every calendar month of the window, empty months 0), one-sided p, Holm over
the three tests.

Pass bar for each test: OOS net month mean > 0 with t >= 2 and Holm p < 0.05; the in-sample mean > 0 (same sign); the OOS
mean still > 0 at 2x costs and financing; the OOS t above the placebo's 95th percentile (more than 38 of 40 seeds below it).
For T3 the 2x-cost check uses the difference at 2x costs and the placebo is the T1 placebo minus the real T2 series.

Placebo: 40 seeds (mulberry32, seeds 1-40). Each real trade's signal day is replaced by a random day whose trade (same side,
same stop and hold rule) exits in the same window; OOS net month t of each seed.

Reported beside the tests (not tests): unconditional 10-day momentum on every day (both sides, one at a time), long every
10th day and short every 10th day (the same-side baselines), share of signal days in each regime, gross and net R, cost share
(cost + financing over gross per trade), median stop in dollars, per-year sums.

Expected: a median stop well above $10 (2 x ATR(20) of gold has been $15-$120 over 2007-26). If T1 fails, nothing is
proposed. If T1 passes, it is a lead to be replicated on other data, never a council rule without the owner.
