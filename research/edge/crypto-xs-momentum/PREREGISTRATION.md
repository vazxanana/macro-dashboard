# Pre-registration: cross-sectional momentum among coins, 3-week look-back, weekly rebalance (14 Nov 2026)

Written and pushed before any trade, return or statistic of this rule was computed. Paper research only: nothing here changes a
council rule, a trade, the mirror or any live file. ICT and the gold book are not touched.

## Question

The published claim (Liu, Tsyvinski & Wu 2022, Journal of Finance, "Common risk factors in cryptocurrency"): coins that rose
most over the past few weeks, ranked AGAINST EACH OTHER, keep outperforming the coins that rose least over the next week (their
cross-sectional momentum factor, strongest at a three-week look-back and a one-week hold). Does a long-top-third / short-bottom-
third book of the council's coins make money as stop-protected CFD trades, net of the council's crypto costs and financing?

**Related, and what is not repeated.** Checked before writing (all FAIL, none ranks coins against each other):
`crypto-weekly-mom` (each coin against its OWN one-week past, long / flat and long / short), `crypto-trend-v2` / `crypto-trend-decay`
(breakouts per coin), `crypto-reversal`, `crypto-weekend`, `crypto-weekend-reversal` (calendar and reversal rules on BTC / ETH),
`eth-btc-ratio` (one pair's ratio). This study ranks up to ten coins against each other every week, which has not been tested in
this repository. A cross-sectional book is long and short in equal number, so a common rise or fall of all coins largely cancels;
mainly the spread between the week's winners and losers is measured.

## Data and universe (fixed now)

Binance spot daily klines (UTC days) from the council-data cache `research/candles/crypto1d/<SYM>USDT_1d.json.gz`, read with
`git show origin/council-data:…` (no network). Ten coins, in this list order (the order of their first candle, used to break
ties): **BTC ETH BNB LTC ADA XRP TRX LINK DOGE SOL**. First candles (file listing only, no return read): BTC and ETH 2017-08-17,
BNB 2017-11-06, LTC 2017-12-13, ADA 2018-04-17, XRP 2018-05-04, TRX 2018-06-11, LINK 2019-01-16, DOGE 2019-07-05,
SOL 2020-08-11; all end 2026-10-31. Weekend candles are real trading days (crypto trades every day; no folding).

**Survivorship, said now:** these ten are coins the council still caches in 2026, chosen with hindsight; dead coins of 2018-22
are missing, which flatters the losers' side of nothing in particular but is a known bias of any fixed modern universe.

## Rule

1. **Clock.** Every Monday 00:00 UTC. The holding week is that Monday's daily candle through the Sunday's daily candle.
2. **Eligible coin** on Monday M: at least 60 daily candles dated before M, a candle on the Sunday before M (M − 1 day) and on
   M − 22 days, and a candle on M itself.
3. **Signal** (closes up to and including Sunday M − 1 only): 3-week return = close(M − 1 day) / close(M − 22 days) − 1. Rank
   from highest to lowest; ties broken by the list order.
4. **k = floor(N / 3)** for N eligible coins. Long the top k, short the bottom k. **A week with fewer than 6 eligible coins is not
   traded** (k ≥ 2 always). With today's data N is 6-8 (k = 2) from mid-2018 and 9-10 (k = 3) from early 2019 on.
5. **Entry** at the open of Monday's candle.
6. **Size: equal risk.** 1R = 2 × ATR(20), ATR(20) = simple mean of the true range of the 20 daily candles ending on Sunday
   M − 1 (true range uses the previous candle's close).
7. **Every leg has a stop** (absolute rule 1) at 1R from the entry: below for a long, above for a short. Checked on every daily
   candle of the week from Monday's candle on; a candle that OPENS beyond the stop fills at its open, otherwise at the stop; a
   candle that touches the stop takes it (no intra-candle path assumed in the leg's favour). A stopped leg stays flat to the next
   Monday.
8. **Exit**: a leg not stopped is closed at the close of the week's last candle on file (normally Sunday's). A week whose
   holding candles are not all on file for a coin uses the coin's candles dated in the week (said in the result). Every week all
   legs are closed and opened anew (no netting: a coin that stays in its bucket pays its round trip again).
9. **R per week** = the sum of the legs' net R divided by the number of legs (2k).

## Costs (every leg, in R of that leg)

- **Round trip**: the council's crypto CFD round trip `CFD_CRYPTO` (`council/fills.mjs`, imported: 0.04 % of the entry price),
  in R = 0.0004 × entry / stop distance.
- **Financing**, as `crypto-weekly-mom` charges it: the demo broker's crypto CFD swap (council-data `ctrader/symbols.json`, swap
  type 1 = % a year): longs 15 % on BTC, ETH, SOL; shorts 7.5 % BTC, 10 % ETH, 15 % SOL. ADA, BNB, DOGE, LINK, LTC, TRX, XRP are
  not offered there: **15 % a year on both sides is assumed**. Shorts PAY (the broker charges both sides). Charged as rate / 365 ×
  entry price per night held: 7 nights for a full week, i nights for a leg stopped in the week's (i+1)-th candle (Monday = 0).
  Today's rate for every year (past rates are not known).
- Reported at **0 / base / 2 × costs** (2 × = round trip and financing both doubled).

## Windows

All traded weeks from the first week with 6 eligible coins to the last week whose Sunday is on file (Monday 2026-10-19).
**In sample = the first half of those weeks** (the first floor(W / 2) weeks), **out of sample = the rest**. The split date is
whatever falls out of that count; it is written into result.json.

## Statistics

Weekly book R. Calendar-month sums (a week belongs to the month of its Monday). **t = mean / sd × √n of the monthly sums**
(plain t on months). Also shown: weekly mean, Sharpe of weekly R × √52, worst drawdown of cumulative weekly R, win share of legs.

**Placebo**: 40 seeded runs (seeds 1-40, mulberry32) where each week's eligible coins are shuffled at random before the top k /
bottom k are taken; same entries, stops, sizes and costs; out-of-sample window, base cost.

## Pass (one judged test, all must hold)

1. Out-of-sample month-sum t ≥ 2, net of base cost;
2. in-sample mean weekly net R (base cost) > 0;
3. out-of-sample mean weekly net R at 2 × cost > 0;
4. the real out-of-sample mean weekly net R is above at least 38 of the 40 placebo means (≥ 95 %).

Anything else is **FAIL**. A FAIL is not evidence that the reverse (cross-sectional reversal) works.

## Reported only, never judged

Look-backs of 1 and 4 weeks (same rule otherwise); long legs and short legs apart; per coin; per year; an equal-weight buy-and-hold
of the eligible coins (spot, no costs) as context; legs stopped and gap fills.

## What it would and would not mean

A PASS would be one cross-sectional effect on ten survivors' daily candles with these costs: at most a proposal of a paper shadow,
owner's decision (absolute rule 3). A FAIL says this ten-coin, top-third / bottom-third weekly version did not pay here.

To repeat (once the code exists): `node research/edge/crypto-xs-momentum/run.mjs` (reads council-data with `git show`, writes
`result.json`).
