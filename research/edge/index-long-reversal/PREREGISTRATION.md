# Long-term reversal across national stock indices: pre-registration

Written and committed **before** any return below was computed (14 Nov 2026). The universe, the rule, the costs, the windows
and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`. Seen before this file: only the
first and last date of each candle file (council-data `research/daily/_index.json`).

Paper research only. Whatever the outcome, no live rule, size, filter, stop, config, cost constant or mirror setting
changes; a pass would at most lead to a written proposal for a paper shadow, for the owner. Not a test of the gold book
(owner decision 44 untouched); ICT is not involved.

## The claim

Balvers, Wu and Gilliland (2000), "Mean reversion across national stock markets and parametric contrarian investment
strategies", *Journal of Finance* 55(2); Richards (1997), "Winner-loser reversals in national stock market indices: can they
be explained?", *Journal of Finance* 52(5): the national indices that did worst over the past three years tend to beat the
ones that did best over the following year. Their samples (dollar total-return MSCI indices) end in the 1990s, so every
month tested here is after the papers.

Related, not the same question: `dual-momentum` (branch `dual-momentum`, FAIL) and `index-spread-momentum` (branch
`index-spread-momentum`, FAIL) tested MOMENTUM (following a past move); this tests the opposite, LONG-TERM REVERSAL (fading a
three-year move) across many national indices at once. Code that is needed (ATR, the DGS2 as-of lookup, financing per
rollover night) is copied, not imported across branches.

## Universe (fixed now)

Every key of `_index.json` with `group: "index"` and `status: "ok"`, 17 markets: `au200` (AU200_AUD, from 2004-03),
`ch20` (CH20_CHF, 2003-03), `cn50` (CN50_USD, 2011-08), `de40` (DE30_EUR, 2003-03), `es35` (ESPIX_EUR, 2016-12), `eu50`
(EU50_EUR, 2003-09), `fr40` (FR40_EUR, 2003-02), `hk33` (HK33_HKD, 2003-02), `in50` (IN50_USD, 2011-08 to **2022-07-12**:
the file stops there), `jp225` (JP225_USD, 2003-03), `nas100`, `spx500`, `us2000`, `us30` (USD, 2003-03), `nl25`
(NL25_EUR, 2008-01), `sg30` (SG30_SGD, 2004-01), `uk100` (UK100_GBP, 2003-03). All end 2026-11-06 except in50.
Read with `git show origin/council-data:research/daily/<key>.json` (no network). OANDA mid daily candles; Saturday / Sunday
candles folded into the next weekday with `council/fills.mjs` `foldWeekend`.

Stated now: these are CFD **price** series (no dividends), each quoted in its own currency as OANDA quotes it (JP225, CN50,
IN50 in US dollars; the others in the local currency). **Currency moves are not hedged and not converted**: each leg's R is
its price move divided by its own 1R distance (3 x ATR(20) of the same series), so R is a unitless risk multiple in that
leg's own currency and legs are comparable in R. Several indices overlap (US30 / SPX500 / NAS100; EU50 / DE40 / FR40 / NL25
/ ES35), so the cross-section has fewer independent markets than 17.

## The rule

- **Month end** of a market = its last candle of the calendar month. A market is **ranked** at the end of month m only if
  (a) its last candle of month m is within the last 7 calendar days of the month (else stale), and (b) it has month-end
  closes at month m-1 and month m-37.
- **Score** (primary lookback L = 36 months, skipping the last month): `close(m-1) / close(m-37) - 1`, month-end closes
  only, so nothing after the end of month m is read.
- **Rank** the ranked markets by score (ties by key name). **Long the bottom 3, short the top 3.** A month with fewer than
  6 ranked markets forms no cohort.
- **Entry** of each leg at the OPEN of that market's first candle after the end of month m (never at the signal close). A
  selected market with no later candle is not entered (counted).
- **1R** = 3 x ATR(20) of that market's daily candles (mean true range of the 20 candles ending at its month-m candle).
  **Every leg has a stop** at 1R from the entry (long: entry - 1R; short: entry + 1R). Each day from the entry candle on: if
  the open is beyond the stop the leg exits at the open (gap fill; on the entry candle the open is the entry), else if the
  candle's low (long) / high (short) reaches the stop it exits at the stop. A stopped leg is **flat for the rest of its
  cohort**. No target.
- **Hold 12 months**: a leg not stopped exits at the close of that market's last candle of month m+12. A market whose file
  ends before that (in50) exits at its last close (counted as "data end").
- **Overlapping cohorts** (Jegadeesh-Titman): a new cohort each month end, each live for 12 months, so up to 12 cohorts are
  live in a month. A leg's monthly R = its marked-to-market R over the month (from its entry or from the previous month-end
  close of that market, to the month-end close or the exit), less its costs booked that month. A cohort's monthly R = the
  mean of its entered legs' monthly R (a stopped leg counts 0 after its stop). **The book's monthly R = the mean of the
  live cohorts' monthly R**, i.e. R per 1R leg per month (each live cohort weighted 1/12 when 12 are live).

## Costs

- **CFD round trip 0.04 % of price per leg**: 0.02 % of the entry price at the entry and 0.02 % of the exit price at the
  exit, in R of that leg.
- **Overnight financing on every leg, longs and shorts alike (conservative: a short is not credited)**, per rollover night
  (`council/fills.mjs` `nights`: Mon-Fri 22:00 UTC, Wednesday three): `(max(0, DGS2) + 2.5 %) / 365` of that day's close,
  in R. DGS2 = council-data `macro/cache.json` `score.fred.DGS2` (weekly, from 2006-01), as-of the night's day; before its
  first value a fixed 4 %. The same US rate is used for every market (a simplification; local rates are not modelled).
- Reported at 0 x, base (1 x) and 2 x costs; the verdict is read at 1 x.

## Windows

- **Decisive**: book months 2016-01 to the last complete month (2026-10).
- **Replication**: from the first book month after the first month end with 10 or more ranked markets, to 2015-12.

## Pass bar (one judged test; all must hold)

1. Mean net book R a month > 0 in the decisive window AND in the replication window.
2. Decisive Newey-West t (Bartlett, 12 lags, because of the 12-month overlap) of the monthly net book R >= 2.
3. **Placebo**: 40 seeded draws (seed 20261114), each month the ranked markets put in random order instead of by score, the
   same bottom-3 / top-3 legs, construction, stops and costs; the real decisive mean net book R a month must be above the
   95th percentile of the 40 draws' decisive means.

## Reported only (named variants, not judged)

- Lookback **12 months** (close(m-1) / close(m-13) - 1) and **60 months** (close(m-1) / close(m-61) - 1), each needing that
  history, same everything else.
- Per year, worst drawdown of the cumulative book R, cost sensitivity, legs by market and side, stop / time / data-end
  counts, and the number of independent 12-month periods in each window.

Repeat: `node research/edge/index-long-reversal/run.mjs fetch <dir>` (git show, no network; candles outside git), then
`node research/edge/index-long-reversal/run.mjs full <dir>`.
