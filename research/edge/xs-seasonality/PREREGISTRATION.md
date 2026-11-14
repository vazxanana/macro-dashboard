# Pre-registration: cross-sectional return seasonality, the same calendar month in past years (14 Nov 2026)

Written and pushed ALONE, before any signal, trade, return or statistic of this rule was computed. Paper research only:
nothing here changes a council rule, a trade, the mirror or any live file. The gold book is not touched (owner decision 44:
this is a cross-market ranking, not a gate, exit, entry or size on the gold book). ICT is not involved.

## Question

The published claim (Heston and Sadka, Journal of Financial Economics 2008, for stocks; Keloharju, Linnainmaa and Nyberg,
"Return seasonalities", Journal of Finance 2016, also across commodities, country indices and currencies; neither paper could
be opened from this sandbox, so no published number is relied on): a market's average return in the same calendar month of
past years predicts its return this month RELATIVE to the other markets of its asset class. Does a long-top-third /
short-bottom-third book, ranked within each asset group by that average, make money on the council's own OANDA daily candles,
as stop-protected trades, net of the spread and overnight financing?

## Why it is not a duplicate (checked before writing)

`ls research/edge` on main and `git branch -r | grep -iE 'season|calendar|month|xs-'` on 14 Nov:
- `seasonality` (main), `claude/seasonality`, `calendar-5m`, `calendar-shadow`, `turn-of-month`, `fx-month-end`,
  `fx-month-start`, `crypto-month-end`, `bond-month-end*`: clock windows, turns of the month and fixed calendar days on single
  markets or baskets. None ranks markets against each other.
- `gold-month-of-year` (#907), `energy-seasonal` (#879), `grain-seasonality` (#934), `sell-in-may` (#851): fixed months or
  windows on single markets chosen from folklore, judged market by market. Not a cross-section and not a past-years average.
- `index-xs-momentum`, `commodity-xs-momentum`, `fx-xs-momentum`, `crypto-xs-momentum`, `fx-value`, `fx-max-effect`: ranked
  books on the past 1-60 months' return, value or skewness. None ranks on the same calendar month of past years.
The harness (calendar, ATR, stop, leg, statistics, placebo) is rewritten from `index-xs-momentum` (on a branch, not imported);
`council/fills.mjs` `foldWeekend`, `nights` and `FIN` are imported.

## Why the backlog held it, and how this handles it

`research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`), candidate 3, names its weak point: **cost**.
The three monthly cross-sectional CFD books already tested lost on financing alone (financing 0.045-0.057R a leg-month above the
gross effect, #968, #969, #974). And the history is short: the daily cache starts 2002-2006, so with five past years required
the first signals are 2008-2011. Handling, fixed now:
- The stop is 3 x ATR(20) (not 2 x), so a leg's spread and financing are a smaller share of 1R than in #974; the cost is
  still charged in full, reported apart (spread, financing) and doubled in the bar. Nothing is waived to help the rule.
- The gross result is reported beside the net one, so a gross effect eaten by cost is visible as such; it is not a pass.
- The short history is accepted, not repaired: the average uses every past year on file (an expanding window, at least 5
  years), the windows below are fixed now from the files' first dates, and n is reported for every figure. The in-sample
  window is short (about 2009-2016) and the out-of-sample one ten years.

## Universe (fixed now; four asset groups, ranked only within a group)

council-data `research/daily/<key>.json` (OANDA mid, complete UTC daily candles), read with
`git show origin/council-data:research/daily/<key>.json` (no network). Weekend stubs folded into the next weekday by
`foldWeekend`. First dates read from `_index.json` only (no price read).
- **index** (13, one per country, the list of `index-xs-momentum`): `spx500 de40 uk100 fr40 ch20 nl25 es35 jp225 au200 hk33
  cn50 sg30 in50`. (nas100, us30, us2000 are further US indices; eu50 a multi-country euro index: left out.)
- **metal** (5): `xau xag xpt xpd xcu` (the gold crosses `xaueur xaugbp xauxag` are the same metal: left out).
- **energy** (energy and agriculturals, 7): `wtico bco natgas corn wheat soybn sugar`. The brief's "energy" group has only
  three markets (two of them crude), too few for thirds; the four agriculturals join it, fixed now.
- **fx** (9 currencies against USD): `eurusd gbpusd audusd nzdusd usdjpy usdcad usdchf usdsek usdnok`. Each currency is the
  foreign currency against USD: EUR, GBP, AUD, NZD as quoted; JPY, CAD, CHF, SEK, NOK the USD-base pair inverted (a long
  currency is a short pair). Left out: pegged or managed (USD/HKD, USD/CNH, USD/SGD) and high-carry emerging currencies
  (MXN, ZAR, TRY, PLN), whose carry a flat financing charge cannot represent and which a same-month price average would rank
  low every month for their carry alone.

## Rule

1. **Monthly returns.** A market's close for calendar month M = the close of its last candle dated in M. Its return in month M
   = close(M) / close(M−1) − 1, defined only when both months have a candle (for an inverted FX pair: close(M−1) / close(M) − 1).
2. **Signal** for holding month H (signal month S = H − 1, computed from closes up to and including S's last candle only):
   the simple mean of the market's returns in the same calendar month as H in every PAST year (years before H's year) where
   that return is defined. A market is ranked only with **at least 5** such past years and a candle in S.
3. **Thirds within each group**: with N ranked markets in a group, k = floor(N / 3); **long the top k, short the bottom k**.
   A group with k = 0 (N < 3) is not traded that month. Ties are broken by the list order above.
4. **Entry**: the open of each market's first candle dated in H. A market with no candle in H is skipped (counted).
5. **Size: equal risk (inverse ATR).** 1R = 3 × ATR(20); ATR(20) = the simple mean of the true range of the 20 candles ending
   on the market's last candle of S. Every leg risks 1R.
6. **Every leg has a stop** (absolute rule 1) at 1R from the entry, below for a long, above for a short. Checked on every
   daily candle from the entry candle to the exit candle; a candle that opens beyond the stop fills at its open (gap fill),
   otherwise at the stop; a candle that touches the stop takes it. A stopped leg stays flat until the next month.
7. **Exit**: a leg not stopped is closed at the close of the market's last candle in H. Every month all legs close and open
   anew (no netting).
8. **Month value** of a book = the SUM of its legs' net R. A month with no leg counts as 0.

**Primary book** = all four groups together (the sum of the four group books' legs each month: a group-neutral pooled book).
**Secondary books**, reported separately and tested: index, metal, energy, fx alone.

## Costs (every leg, in R of that leg; in R = cost as a fraction of price × entry / (3 × ATR))

- **Round trip (spread + slippage)**: index 0.04 % of price (the brief's index-CFD figure; no measured spread for most of
  these CFDs); gold $0.30 an ounce, silver $0.03 an ounce, platinum, palladium, copper, energies and agriculturals 0.06 %
  (the figures of `commodity-xs-momentum`); FX majors 1.3 pip / price + 0.000045 (the raw-spread model measured on the demo
  account, CLAUDE.md "Forex spreads", as `fx-value` / `fx-xs-momentum`; pip 0.01 for USD/JPY); USD/SEK and USD/NOK 0.04 %
  (no measured spread; wider than the majors, assumed).
- **Financing**, per night = `council/fills.mjs` `nights(entryTime, exitTime)` (Mon-Fri 22:00 UTC rollovers, Wednesday three),
  each night `rate / 365 × entry / 1R`:
  - index: a long pays `r + 2.5 %` a year, a short `max(0, 2.5 % − r)`, r = the quote currency's approximate year-average
    policy rate (the table of `index-xs-momentum`'s pre-registration, copied into `run.mjs`; USD for spx500, jp225, cn50,
    in50; EUR de40, fr40, nl25, es35; GBP uk100; CHF ch20; AUD au200; HKD hk33; SGD sg30; years before 2007 use 2007);
  - gold long: `FIN.xau.long` (0.000148 of price a night, the demo broker's measured rate, about 5.4 % a year); every other
    metal, energy and agricultural leg, and a gold short: 3 % a year, charged on longs AND shorts (the convention of
    `commodity-xs-momentum`, conservative: a short is never credited);
  - FX: a flat 0.004 % of price a night on every leg (the assumption of `trend-breadth-h1`, `fx-xs-momentum`, `fx-value`). The
    rate differential is not modelled (stated as a limitation).
- Entry time = the entry candle's start; exit time = the end of the exit candle for a month-end close, its start for a gap
  fill, its start + 12 h for a stop inside a candle.
- Commodity CFD candles are not back-adjusted for contract rolls: no adjustment, as `commodity-xs-momentum`; a roll jump enters
  both the signal and a held leg. Dividends are not credited or charged.
- Reported at **0 / base / 2 × costs** (2 × = round trip and financing both doubled). Base decides; 2 × is part of the bar.

## Windows (fixed now, by holding month)

- **In sample (IS)**: from the first holding month in which any group trades, to 2016-12.
- **Out of sample (OOS, decisive)**: 2017-01 to 2026-10 (the last complete month; the cache ends 2026-11-06), 118 months.
A calendar month of a window with no leg counts as 0. The IS window starts where the data allows (expected about 2008-2011:
five past years of a month need at least five years of candles); its start is reported, the split does not move.

## Tests, Holm, placebo, the bar

Five tests: the primary book and the four group books. For each: t = mean / (sd / √n) of the OOS calendar-month sums of net R
at base costs (Newey-West t, 3 lags, reported beside it, not deciding); p = two-sided normal p of t; **Holm** over the five.

**Placebo** (40 seeds, mulberry32 seeds 1-40): each holding month and each group, the ranking reads the market's past-years
average of a RANDOMLY CHOSEN OTHER calendar month (one draw per month, shared by the groups, never H's own month), same
thirds, entries, stops and costs, OOS window. Run for the primary book.

**PASS** (the primary book) only when ALL hold:
1. OOS net month-sum t ≥ 2 AND its Holm-adjusted p < 0.05;
2. IS net mean month sum > 0 (the same sign);
3. OOS net mean month sum > 0 at 2 × costs;
4. the real OOS net mean beats at least 38 of the 40 placebo means.
Anything else is FAIL. Each group book's lines are reported (with its Holm p) but do not decide the verdict. A FAIL is not
evidence that the opposite works. A PASS leads only to a proposal for a paper shadow book in `research/proposals/`; given the
333 decisive tests already run in this repository it would be a lead to replicate, never an edge without a forward record.

## Reported only, never judged

- A de-drifted variant: rank on (same-month average − the market's average over all calendar months of the same past years),
  so a market's constant drift or roll cost does not set its rank.
- Per window and book: months, legs (long / short), gross / spread / financing / net R a leg, win rate, stops and gap fills,
  t of month sums gross / net / 2 × net, Sharpe, worst drawdown of cumulative month sums; by year; per market.

## What it cannot show

Price indices without dividends; each index in its own currency; approximate policy rates; assumed spreads for most CFDs; FX
without the rate differential; unadjusted commodity rolls; a cross-section of 3-13 markets a group, small next to the
published ones; at most about 8-17 past years per average.

To repeat (after the code exists): `node research/edge/xs-seasonality/run.mjs` (reads council-data with `git show`, writes
`result.json` and `RESULT.md`). Tests: `tests/xs-seasonality.test.mjs`.
