# Equity exposure timed by the VIX term structure: pre-registration

Written and committed **before** any number below was computed (13 Nov 2026). The rule, the data, the costs, the windows
and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. Nothing live changes whatever the outcome: no council member, rule, size, filter, stop or config. A
PASS leads at most to a proposal for a **paper shadow** for the owner to approve (absolute rule 3). Not an ICT study and not
a test of the pre-FOMC drift or the turn of the month (other studies).

## Why

Published work (Simon & Campasano 2014, "The VIX futures basis: evidence and trading strategies"; Fassas & Hourvouliades;
practitioner notes on VIX / VIX3M) reports that equity returns per unit of risk are better while implied volatility is in
contango (VIX below VIX3M) than in backwardation. The council's macro strategist (`council/macro.mjs`, driver `vixts`)
reads the same ratio the other way (backwardation → a positive next day), as context with no weight. This study tests the
simplest timing rule built on the published claim, out of sample, net of costs.

## Data

- **VIX and VIX3M closes**: Cboe's own daily history files, the same URLs `council/macro.mjs` `CBOE` uses
  (`cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv` and `VIX3M_History.csv`), parsed by that file's
  `parseCboeCsv` (imported, not copied). Fetched once with `node --use-env-proxy run.mjs fetch <dir>`; the files stay
  outside git. **No other source is substituted**: if Cboe cannot be reached, the study stops with INCONCLUSIVE "data not
  reachable", and no number is reported. The strategist's cache (`macro/cache.json`, about 300 recent days of `VIXCLS` /
  `VXVCLS`) covers neither window and is not used.
- **SPX500 and NAS100 daily candles**: OANDA mid, UTC-aligned, council-data `research/daily/spx500.json` and
  `nas100.json` (`git show origin/council-data:…`, no network).
- **2-year Treasury yield** for the financing rate: council-data `macro/cache.json` `score.fred.DGS2` (weekly since 2006)
  and `fred.DGS2` (daily, recent), the last value dated before each night.

## The rule (one variant, no parameters tuned)

- Day D = an OANDA SPX500 daily candle (UTC day). Ratio(d) = VIX close / VIX3M close on Cboe date d (16:15 New York, before
  the end of UTC day d).
- **Signal for day D** = long when the ratio of the **last Cboe date strictly before D** is under 1 (contango), else flat
  (a missing ratio = flat). The decision uses yesterday's close only: no price of day D is read.
- **Entry**: a flat-to-long day enters at day D's open (the OANDA candle open, which follows the prior close).
- **Stop** (every position has one): entry − 2 × ATR(20) of the 20 daily candles before D (Wilder-free simple mean of true
  range), fixed for the life of that position. A day whose low reaches the stop exits at the stop, or at the open when the
  open is already below it (a gap). A stopped position is flat for the rest of that day and re-enters at the next day's
  open if the signal still says long (a new entry, a new stop, a new cost).
- **Exit on the signal**: a long position whose next day's signal is flat exits at day D's close.
- Fully invested, 1× notional while long, no leverage, no compounding inside a day; returns are daily simple returns of
  the account; a flat day earns 0 (no cash interest for either strategy).

## Costs

- **Spread and slippage**: 1.0 index point a side (2.0 points a round trip) on SPX500 and 4.0 points a side on NAS100,
  charged on every entry and every exit (signal or stop). Retail CFD spreads on these are about 0.4-0.6 and 1-2 points:
  this is conservative on purpose.
- **Financing** while long: notional × (2-year Treasury yield + 2.5 %) / 365 for every calendar night between the close
  of a held day and the next candle (a weekend counts its nights), not charged on a night the position does not hold.

## Benchmark

Buy-and-hold SPX500 over the same window with the same financing and one entry cost, no stop and no exit.

## Windows

- **W1** 2008-01-01 to 2015-12-31 (VIX3M history begins in December 2007; the first days wait for ATR warm-up).
- **W2** 2016-01-01 to the last day the three series share (**decisive**).

## Statistics

- Sharpe = mean daily return / sd of daily return × √252, on every SPX500 candle day of the window (flat days are 0).
- Maximum drawdown on the compounded equity curve, in %.
- Paired block bootstrap: calendar months of the window resampled with replacement (the same months for both series),
  2,000 draws, seed 20261113; P = share of draws in which the timed Sharpe exceeds buy-and-hold's.
- Also reported: CAGR, time in market, number of entries, stops, cost and financing paid.

## Pass bar (all must hold)

1. W2: timed Sharpe > buy-and-hold Sharpe, AND timed max drawdown smaller, AND bootstrap P ≥ 0.9.
2. W1: timed Sharpe > buy-and-hold Sharpe AND timed max drawdown smaller (P reported).

Otherwise FAIL. NAS100 is reported descriptively only (the same rule on the same signal), never a pass criterion.
Data that cannot be fetched → INCONCLUSIVE "data not reachable".

## Outputs

`run.mjs`, `result.json`, `RESULT.md` (verdict first), `tests/vix-term.test.mjs` (offline: the signal lag, the stop, the
costs, RESULT.md = result.json). A proposal (`research/proposals/2026-11-13-vix-term.md`, paper shadow) only on a PASS.
