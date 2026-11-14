# Pre-registration: cross-sectional momentum across national stock indices, 12-1 months, monthly rebalance (14 Nov 2026)

Written and pushed before any signal, trade, return or statistic of this rule was computed. Paper research only: nothing here
changes a council rule, a trade, the mirror or any live file, and the gold book is not touched (owner decision 44: this is a
cross-market study, not a gate, exit, entry or size on the gold book). ICT is not involved.

## Question

The published claim (Asness, Moskowitz & Pedersen 2013, "Value and momentum everywhere", country equity index futures): the
country stock indices that rose most over the past 12 months, skipping the most recent month, keep outperforming those that
rose least over the next month. Does a long-top-third / short-bottom-third book of national index CFDs make money on the
council's own OANDA daily candles, as stop-protected trades, net of the spread and the overnight financing?

**Related studies, read first, and why this one is not a repeat.**
- `high52-rotation` (branch `high52-rotation`, FAIL): ranks eleven index CFDs by nearness to their 52-week high, LONG ONLY,
  top 3 against an equal-weight book of all. Different signal (52-week-high proximity, not the 12-1 return), no short leg,
  and its universe holds four US indices and three euro-area ones (not one per country).
- `dual-momentum` (branch `dual-momentum`, FAIL): gold against SPX500 against cash; two assets, not a cross-section.
- `tsmom`, `tsmom-portfolio` (branches, FAIL): time-series momentum, each market against its OWN past (the sign of its 12-1
  return). This study ranks the indices AGAINST EACH OTHER.
- `commodity-xs-momentum` and `fx-xs-momentum` (branches, FAIL): the same cross-sectional 12-1 rule on commodities and on dollar
  pairs. No branch or main study ranks national stock indices by their 12-1 return (checked: `git log --all` for every
  `research/edge/*` path and every branch name with momentum / rotation / xs in it). The harness (month calendar, leg, stop,
  statistics, placebo) is that of `commodity-xs-momentum`, rewritten here (not imported: that study lives on a branch).
- `index-overnight` (branch, FAIL): intraday timing on US500 / NAS100; its index cost (0.03 % a round trip) is reused.

What I expect, said plainly: the published effect is weaker after 2010 and the cross-section here is small; I expect little.

## Universe (fixed now: one index per country)

`spx500 de40 uk100 fr40 ch20 nl25 es35 jp225 au200 hk33 cn50 sg30 in50` (13 keys), from council-data
`research/daily/<key>.json` (OANDA mid, complete UTC daily candles), read with `git show origin/council-data:research/daily/<key>.json`
(no network). All have `status: ok` in `_index.json` (group `index`).
- Left out, fixed now: `nas100`, `us30`, `us2000` (second, third and fourth US index: the S&P 500 is the country's broad
  index) and `eu50` (a multi-country euro-area index whose members are already in the list as Germany, France, the
  Netherlands and Spain). `hk33` (Hong Kong) and `cn50` (mainland China A-shares) are different markets with different
  listings and both stay.
- Read from `_index.json` only (no price read): `es35` starts 2016-12, `cn50` and `in50` 2011-08, `nl25` 2008-01, `sg30`
  2004-01, `au200` 2004-03, the rest 2003-02 / 03; `in50` ENDS 2022-07-12. A market enters the ranking when it has the
  history the rule needs and leaves it when its file ends (no fill, no substitute).
- Saturday / Sunday stub candles are folded into the next weekday by `council/fills.mjs` `foldWeekend` (imported). Each market
  keeps its own calendar (every leg is simulated on its own candles).

## Rule

1. **Month ends.** A market's month-end close for calendar month M = the close of its last candle dated in M. A market is
   RANKED at signal month M only if it has a candle in each of M, M−1 and M−12.
2. **Signal** (at the close of month M, closes up to and including that day only): 12-1 return = close(M−1) / close(M−12) − 1
   (each in the index's own currency). Rank from highest to lowest; ties broken by the order of the list above.
3. **Thirds**: with N ranked markets, k = floor(N / 3). **Long the top k, short the bottom k.** A month with N < 9 is not
   traded (k would be under 3).
4. **Entry**: the open of each market's first candle dated in month M+1 (the holding month). A market with no candle in M+1
   is skipped for that month (the leg is left out and counted).
5. **Size: equal risk.** 1R = 2 × ATR(20); ATR(20) = the simple mean of the true range (high − low, or the gap from the previous
   close when larger) of the 20 candles ending on the signal day (the market's last candle of M).
6. **Every leg has a stop** (absolute rule 1) at 1R from the entry: below for a long, above for a short. Checked on every daily
   candle from the entry candle to the exit candle; a candle that OPENS beyond the stop fills at its open (gap fill, never a
   better price), otherwise at the stop; a candle that touches the stop takes it (no path in the leg's favour is assumed).
   A stopped leg stays flat until the next rebalance.
7. **Exit**: a leg not stopped is closed at the close of the market's last candle in the holding month. Every month all legs
   close and open anew (no netting: a market staying in its bucket pays its costs again).
8. **Month value** = the SUM of that month's legs' net R (a calendar-month sum). A calendar month in a window with no trade
   (fewer than 9 ranked, or every leg missing) counts as 0.

## Costs (every leg, in R of that leg)

- **Spread and slippage**: 0.03 % of the entry price a round trip, the index cost of `research/edge/trend-breadth`
  (`COST.index`), also used by `tsmom` and `index-overnight`. In R = 0.0003 × entry / (2 × ATR).
- **Financing** on the entry notional, per night held = `council/fills.mjs` `nights(entryTime, exitTime)` (Mon-Fri 22:00 UTC
  rollovers, Wednesday three), each night `rate / 365 × entry / 1R`:
  - a long pays `r + 2.5 %` a year; a short pays `max(0, 2.5 % − r)` (never credited), the convention of `tsmom`;
  - `r` = the quote currency's approximate year-average policy rate of the entry's calendar year, floored at 0. Currency:
    USD for spx500, jp225, cn50, in50 (OANDA quotes these three in USD); EUR de40, fr40, nl25, es35; GBP uk100; CHF ch20;
    AUD au200; HKD hk33; SGD sg30. USD, EUR, GBP, AUD, HKD: the table of `high52-rotation`'s pre-registration (copied below);
    CHF: the table of `tsmom`'s pre-registration; SGD: written here from memory (approximate three-month rates), stated, not
    fetched. A year before 2007 uses 2007; after 2026, 2026.

| Year | USD | EUR | GBP | AUD | HKD | CHF | SGD |
|---|---|---|---|---|---|---|---|
| 2007 | 5.0 | 3.9 | 5.5 | 6.5 | 5.0 | 2.5 | 2.4 |
| 2008 | 2.0 | 3.9 | 4.7 | 6.7 | 2.0 | 2.1 | 1.0 |
| 2009 | 0.2 | 1.3 | 0.6 | 3.3 | 0.2 | 0.25 | 0.7 |
| 2010 | 0.2 | 1.0 | 0.5 | 4.4 | 0.2 | 0.25 | 0.4 |
| 2011 | 0.1 | 1.3 | 0.5 | 4.7 | 0.2 | 0.05 | 0.4 |
| 2012 | 0.1 | 0.9 | 0.5 | 3.7 | 0.2 | 0 | 0.4 |
| 2013 | 0.1 | 0.6 | 0.5 | 2.8 | 0.2 | 0 | 0.4 |
| 2014 | 0.1 | 0.2 | 0.5 | 2.5 | 0.2 | 0 | 0.5 |
| 2015 | 0.1 | 0.05 | 0.5 | 2.1 | 0.2 | -0.75 | 1.0 |
| 2016 | 0.4 | 0 | 0.4 | 1.6 | 0.4 | -0.75 | 1.0 |
| 2017 | 1.0 | 0 | 0.3 | 1.5 | 1.0 | -0.75 | 1.1 |
| 2018 | 1.8 | 0 | 0.6 | 1.5 | 1.8 | -0.75 | 1.7 |
| 2019 | 2.2 | 0 | 0.75 | 1.1 | 2.2 | -0.75 | 1.8 |
| 2020 | 0.4 | 0 | 0.2 | 0.3 | 0.5 | -0.75 | 0.6 |
| 2021 | 0.1 | 0 | 0.1 | 0.1 | 0.1 | -0.75 | 0.4 |
| 2022 | 1.7 | 0.3 | 1.5 | 1.3 | 1.8 | 0 | 2.0 |
| 2023 | 5.0 | 3.3 | 4.7 | 3.9 | 4.6 | 1.5 | 3.9 |
| 2024 | 5.1 | 3.9 | 5.1 | 4.35 | 5.0 | 1.25 | 3.6 |
| 2025 | 4.2 | 2.3 | 4.3 | 4.0 | 4.0 | 0.25 | 2.3 |
| 2026 | 3.7 | 2.0 | 3.8 | 3.6 | 3.6 | 0 | 1.6 |

- Entry time = the entry candle's start; exit time = the end of the exit candle for a month-end close, its start for a gap
  fill, its start + 12 h for a stop inside a candle.
- Dividends are not credited or charged (the OANDA mid is a price index). A CFD long is credited the dividend and a short pays
  it; this is left out on both sides and said in RESULT.md.
- Reported at **0 / base / 2 × costs** (2 × = spread and financing both doubled). Base decides; 2 × is part of the bar.

## Windows (fixed now, from the first dates in `_index.json`, before any price was read)

The 9th market to have 13 months of history is `au200` (first candle 2004-03), so the first holding month with N ≥ 9 is
**2005-04**; the last complete month on file is 2026-10 (the cache ends 2026-11-06). That is 259 holding months, split in half:
- **In sample (IS)**: 2005-04 to 2015-12 (129 months).
- **Out of sample (OOS, decisive)**: 2016-01 to 2026-10 (130 months).
If the candles turn out to leave a month untraded, it counts as 0 (rule 8); the windows do not move.

## The one judged test (no Holm: one test)

PASS only when ALL hold:
1. **OOS t ≥ 2**: t = mean / (sd / √n) of the 130 OOS calendar-month sums of net R at base costs (a Newey-West t with 3 lags
   is reported beside it, not deciding).
2. **IS net positive**: mean IS calendar-month sum of net R at base costs > 0.
3. **2 × costs**: mean OOS calendar-month sum of net R at 2 × costs > 0.
4. **Placebo**: 40 seeded runs (seeds 1-40, mulberry32) that shuffle the ranked markets each month (top k long, bottom k short;
   same entries, stops, costs), OOS window. The real OOS mean month sum must be ABOVE at least 38 of the 40 placebo means
   (beats ≥ 95 %).

Anything else is FAIL. A FAIL is not evidence that the opposite (short winners, long losers) works. A PASS leads only to a
proposal for a paper shadow book in `research/proposals/`; never a live change without the owner.

## Reported only, never judged

- Variants **6-1** (close(M−1) / close(M−6)) and **3-1** (close(M−1) / close(M−3)), each needing a candle in M, M−1 and M−6
  (M−3).
- Per window: months, legs (long / short), mean gross / cost / financing / net R a leg, win rate, stops and gap fills, mean and
  t of month sums gross / net / 2 × net, Newey-West t, Sharpe of month sums, positive months, worst drawdown of the cumulative
  month sums; by year; per market (legs long / short, net R contributed); missing legs.

## What it cannot show

- A price index without dividends; currencies left unconverted (each index earns in its own currency, as a CFD in that
  currency books it); approximate policy rates; an assumed spread, not measured on the demo broker for most of these CFDs.
- Thirteen national indices (fewer early on, ten to twelve most months) is a small cross-section next to the published one.

To repeat (after the code exists): `node research/edge/index-xs-momentum/run.mjs` (reads council-data with `git show`, writes
`result.json` and `RESULT.md`).
