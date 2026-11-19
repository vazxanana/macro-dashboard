# Pre-registration: the internal bar strength (IBS) daily reversal on spot gold (14 Nov 2026)

Written, committed and pushed alone before any number of this study was computed. Paper research: nothing here is read by
the council, the mirror or the page, and no live rule changes whatever the verdict. Not an ICT study.

**Item 44 (docs/owner-decisions.md) and what this study is not.** This is a NEW stand-alone daily rule on gold. It is not a
gate, an exit, an entry or a size of the gold book (Gold trend / Gold daily engulf), reads none of that book's trades or
signals, and its verdict says nothing about that book. The decisive window is 2017 to the end of October 2026; 2008-16 is the
in-sample / replication window. Reading of item 44: the item forbids more tests of the book's own rules on its 2006-17 window;
a different rule judged on its own out-of-sample years is the "anything new" the item leaves open (as `metals-rsi2`,
`gold-shock-revert` and `gold-drd-long` were).

## Why, and what is already tested (dedupe)
IBS = (close - low) / (high - low) of a day. A low IBS (close near the day's low) is a known next-day mean-reversion signal on
US equity indices. Here:
- `index-ibs` (branch, #895): IBS < 0.2 on SPX500 / NAS100 / US30 New York sessions, buy the close, out next close, stop 1 x
  ATR(20): FAIL (pooled 2016-now +0.020R net, month t 0.64; the gross effect exists, costs take it). Mirror short lost.
- `ibs-replicate` (branch, #924): the same frozen rule on seven other indices: does not replicate (-0.041R, t -1.97).
- Neither tested gold, silver or any metal. `metals-rsi2` (#873) tested the 2-day RSI pullback (RSI(2) < 10 above SMA200) on
  gold and silver: FAIL (gold -0.017R, n 78, 2016-26). That signal is two-day close-to-close momentum, not where the close sits
  inside one day's range; T3 below shares its trend filter, so the two overlap in spirit, and that is said here in advance.
- `gold-drd-long` (main, #763): buys after a 17:00 New York day closing in the TOP 30 % of its range (a HIGH IBS) inside a
  bullish weekly structure, stop under the day's low, 3R target, 10 days: a trend-continuation trade. This study is the
  opposite reading (a LOW close bought for a bounce of a day or two, no weekly filter, ATR stop, IBS exit). Its T2 (the short
  after IBS > 0.8) is the mirror of a high-IBS day, held for a day or two.
- `gold-shock-revert` (#850): reversal after a close-to-close move over 2 x ATR(20); a range-position signal on every day was not
  tested.
So gold IBS is untested; this is new.

## Data and the day
- OANDA mid H1 XAU_USD through the site's keyless candle proxy (`fetch.mjs`, from 2006-03 to the end of the data; cache kept out
  of git). Complete candles only.
- **Days are 17:00 New York trading days** built from H1 with `research/edge/gold-drd-long/run.mjs` `days` / `nyDay` (imported,
  unchanged; weekend hours dropped). Why not UTC days: a UTC day ends at 19:00-20:00 New York, so it holds the first one to two
  hours of the NEXT trading session and carries the Sunday stub; IBS is a statement about where the market's own daily close
  sits, and gold's daily close is 17:00 New York.
- A day with high == low has no IBS and gives no signal.

## The rule (three tests, fixed now)
Signal on the close of day i. Entry at the open of the first H1 candle of day i+1 (market order). Stop = entry -/+ 2 x ATR(20),
ATR(20) = the simple mean of the true ranges of the 20 days ending at day i (true range uses the previous day's close). The
stop is checked on H1 candles from the entry candle on; a candle that opens through the stop fills at its open, else at the
stop; a candle holding the stop is a stop. Exit otherwise at the close of the first day d >= i+1 whose own IBS crosses the exit
level, or at the close of day i+5 (the fifth day held), whichever comes first. One position at a time per test (a signal while
a trade is open is skipped).
- **T1 (primary), long**: IBS(i) < 0.2 -> buy; exit at the first close with IBS > 0.5.
- **T2, short**: IBS(i) > 0.8 -> sell; stop above; exit at the first close with IBS < 0.5.
- **T3, long with trend**: as T1, and close(i) > SMA200 of the 17:00 closes ending at day i.
Nothing is computed from data after the signal close except the trade's own path (a test checks this on hand-made candles).

## Costs (every trade, in price)
- Spread **$0.30** a round trip, plus slippage of **half a spread ($0.15) per market order**: entry and exit are market
  orders (the stop and the close exit alike), so $0.30 + $0.15 + $0.15 = **$0.60** a round trip.
- Financing on longs only: `council/fills.mjs` `nights(entryTime, exitTime)` (Mon-Fri 22:00 UTC rollovers strictly between,
  Wednesday three) x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's XAUUSD swap of 11 Nov 2026) x entry price.
  Today's rate is used for every year. Shorts are charged and credited nothing (`FIN.xau.short` 0).
- R a trade = side x (exit - entry) / (2 x ATR) minus costs and financing in R. Gross R is reported beside it.
- **2x costs**: spread, slippage and financing all doubled.

## Windows (by entry day)
- **Out of sample (decisive): 2017-01-01 to 2026-10-31.**
- In sample (replication): 2008-01-01 to 2016-12-31 (2006-07 is warm-up for SMA200 / ATR and is not reported as a window).

## Statistics
- t on calendar-month sums of net R: every calendar month of the window counts, 0 where no trade closed; a trade belongs to its
  exit month. t = mean / (sd / sqrt(months)); one-sided p from the normal distribution. Holm over the three tests (T1-T3).
- Placebo, 40 seeds (fixed seeded generator): each real out-of-sample trade of a test is replaced by an entry at the open of a
  random trading day of the same calendar year, same side, same stop (2 x ATR(20) of the 20 days before), held the same number
  of days as the real trade (out at that day's close or the stop), same costs; no one-at-a-time rule. The rule's mean net R a
  trade is compared with the 40 seed means.

## Pass bar (per test; all needed)
1. Out of sample n >= 100.
2. Out of sample mean net R a trade > 0 and month-sum t >= 2 with Holm-adjusted p < 0.05.
3. In sample mean net R a trade > 0 (same sign).
4. Out of sample mean net R a trade still > 0 at 2x costs.
5. Beats the placebo: the rule's mean above at least 38 of the 40 seed means.

**Verdict**: PASS if T1 passes. If T1 fails, the study FAILS whatever T2 / T3 do; a T2 or T3 that passes alone is reported by
name as "passes alone, not an edge until replicated on other data". Never called an edge without n and t. Reported besides,
deciding nothing: gross R, by year, the win rate, stops hit, average hold, and the before-cost next-day return after a low-IBS
day against every day.

## Deliverables
`fetch.mjs`, `run.mjs`, `RESULT.md`, `result.json` in this folder; `tests/gold-ibs.test.mjs` (offline, hand-made candles).
