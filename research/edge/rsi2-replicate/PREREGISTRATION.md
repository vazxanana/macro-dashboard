# Pre-registration: the 2-day RSI pullback, frozen, on six indices it was never tested on (13 Nov 2026)

Written and committed before any number of this study was computed on the markets below. Paper research: nothing here is read
by the council, the mirror or the page, and no live rule changes whatever the verdict. Not an ICT study.

## Why
`research/edge/rsi2-pullback` (branch `rsi2-pullback`, PR #838, not merged into `main` when this file was written) tested the
2-day RSI pullback on SPX500 / NAS100 / US30, 2016 to Nov 2026, and FAILED narrowly: SPX500 +0.112R a trade net (month t 1.83),
US30 +0.087R (month t 2.28), Holm p 0.065 each. Those three US indices move together (about half their entries fall on the same
day), so the near miss is close to one observation. The honest next step is not to tune it but to run the SAME rule, unchanged,
on markets that study never read. A pass here would support the US near miss; a fail says the near miss was not a general
property of the rule.

## Markets (fixed now)
OANDA mid daily candles, council-data `research/daily/<key>.json` (the council's weekly cache, `git show origin/council-data:…`,
no network). All six files exist (checked in `_index.json` before writing this; first candle 2003-2004, last 6 Nov 2026), so
none is dropped:

| key | instrument | round-trip cost (index points) | financing benchmark |
|---|---|---|---|
| `de40` | DE30_EUR | 2.5 | ECB deposit facility rate |
| `uk100` | UK100_GBP | 2.0 | Bank of England Bank Rate |
| `jp225` | JP225_USD | 14.0 | Bank of Japan policy rate |
| `au200` | AU200_AUD | 2.0 | RBA cash rate target |
| `eu50` | EU50_EUR | 2.5 | ECB deposit facility rate |
| `fr40` | FR40_EUR | 2.0 | ECB deposit facility rate |

Round-trip cost = a typical CFD quoted spread plus half a spread of slippage on each fill (about two quoted spreads), as the
original study did for the US indices. Stated, not measured on a broker. JP225_USD is the Nikkei quoted in USD per point; its
benchmark is the Bank of Japan's rate as this task fixes it (a USD benchmark would charge more: reported beside it, not
decisive).

## The rule: byte for byte the original
The functions `candles`, `sma`, `rsi`, `atr`, `simulate`, `net`, `nights`, `rateAt`, `summary`, `tstat`, `monthSums`, `rng`,
`placebo` and `pct` are taken from `research/edge/rsi2-pullback/run.mjs` of the `rsi2-pullback` branch. Since that branch is not
merged, the file is COPIED unchanged into this folder as `rsi2-pullback.mjs` (its sha256 is pinned in the test); nothing in it is
edited. The rule therefore stays: close(i) > SMA200(i) and Wilder RSI(2)(i) < 10 -> buy at day i+1's open; stop entry - 3 x
ATR(20) taken at the signal close, checked from the entry day (a gap below fills at the open); exit at the open after the first
close above SMA5 (the stop wins on its day); one position per market; weekend candles dropped; a trade open at the end is closed
at the last close. No parameter (10, 200, 5, 2, 3 x ATR20) is changed.

## Costs
- The round-trip points above, on every trade.
- Financing on the long: (local policy rate + 2.5 %) / 365 x entry price per calendar night held (the original's `net`, with the
  local rate in place of DGS2). Rates as step series, each the rate in force from that date (public central-bank decisions;
  the last value is held to the end of the data):
  - ECB deposit facility: 2007-06-13 3.00, 2008-07-09 3.25, 2008-11-12 2.75, 2008-12-10 2.00, 2009-01-21 1.00, 2009-03-11 0.50,
    2009-04-08 0.25, 2011-04-13 0.50, 2011-07-13 0.75, 2011-11-09 0.50, 2011-12-14 0.25, 2012-07-11 0.00, 2014-06-11 -0.10,
    2014-09-10 -0.20, 2015-12-09 -0.30, 2016-03-16 -0.40, 2019-09-18 -0.50, 2022-07-27 0.00, 2022-09-14 0.75, 2022-11-02 1.50,
    2022-12-21 2.00, 2023-02-08 2.50, 2023-03-22 3.00, 2023-05-10 3.25, 2023-06-21 3.50, 2023-08-02 3.75, 2023-09-20 4.00,
    2024-06-12 3.75, 2024-09-18 3.50, 2024-10-23 3.25, 2024-12-18 3.00, 2025-02-05 2.75, 2025-03-12 2.50, 2025-04-23 2.25,
    2025-06-11 2.00.
  - Bank of England Bank Rate: 2007-07-05 5.75, 2007-12-06 5.50, 2008-02-07 5.25, 2008-04-10 5.00, 2008-10-08 4.50,
    2008-11-06 3.00, 2008-12-04 2.00, 2009-01-08 1.50, 2009-02-05 1.00, 2009-03-05 0.50, 2016-08-04 0.25, 2017-11-02 0.50,
    2018-08-02 0.75, 2020-03-11 0.25, 2020-03-19 0.10, 2021-12-16 0.25, 2022-02-03 0.50, 2022-03-17 0.75, 2022-05-05 1.00,
    2022-06-16 1.25, 2022-08-04 1.75, 2022-09-22 2.25, 2022-11-03 3.00, 2022-12-15 3.50, 2023-02-02 4.00, 2023-03-23 4.25,
    2023-05-11 4.50, 2023-06-22 5.00, 2023-08-03 5.25, 2024-08-01 5.00, 2024-11-07 4.75, 2025-02-06 4.50, 2025-05-08 4.25,
    2025-08-07 4.00.
  - Bank of Japan: 2007-02-21 0.50, 2008-10-31 0.30, 2008-12-19 0.10, 2010-10-05 0.05, 2016-02-16 -0.10, 2024-03-19 0.05,
    2024-07-31 0.25, 2025-01-24 0.50.
  - RBA cash rate: 2007-08-08 6.50, 2007-11-07 6.75, 2008-02-06 7.00, 2008-03-05 7.25, 2008-09-03 7.00, 2008-10-08 6.00,
    2008-11-05 5.25, 2008-12-03 4.25, 2009-02-04 3.25, 2009-04-08 3.00, 2009-10-07 3.25, 2009-11-04 3.50, 2009-12-02 3.75,
    2010-03-03 4.00, 2010-04-07 4.25, 2010-05-05 4.50, 2010-11-03 4.75, 2011-11-02 4.50, 2011-12-07 4.25, 2012-05-02 3.75,
    2012-06-06 3.50, 2012-10-03 3.25, 2012-12-05 3.00, 2013-05-08 2.75, 2013-08-07 2.50, 2015-02-04 2.25, 2015-05-06 2.00,
    2016-05-04 1.75, 2016-08-03 1.50, 2019-06-05 1.25, 2019-07-03 1.00, 2019-10-02 0.75, 2020-03-04 0.50, 2020-03-20 0.25,
    2020-11-04 0.10, 2022-05-04 0.35, 2022-06-08 0.85, 2022-07-06 1.35, 2022-08-03 1.85, 2022-09-07 2.35, 2022-10-05 2.60,
    2022-11-02 2.85, 2022-12-07 3.10, 2023-02-08 3.35, 2023-03-08 3.60, 2023-05-03 3.85, 2023-06-07 4.10, 2023-11-08 4.35,
    2025-02-19 4.10, 2025-05-21 3.85, 2025-08-13 3.60.
  These were written from the published decision histories without a live source (central-bank hosts are not reachable from the
  build sandbox): a date may be off by a meeting. At about 4 nights a trade, one meeting's 0.25 % is about 0.0003 % a trade.

## Windows (by entry day)
- A: 2008-01-01 to 2015-12-31 (reported).
- **B: 2016-01-01 to the end of the data (decisive).**

## Pass (one test, window B)
The pooled six-market book, equal risk per trade (every trade weighs 1 R = its own 3 x ATR(20) risk, so markets with different
point values and currencies add up):
1. Pooled net R a trade > 0.
2. t >= 2 on calendar-month sums of pooled net R (every month from January 2016 to the last data month counts, 0 where nothing
   closed; a trade's month is its exit month).
3. At least 4 of the 6 markets have net R a trade > 0 in window B.
4. Placebo, 40 seeds (1..40): for each seed, every real window-B trade of each market is replaced by the original study's placebo
   trade (random entry day with close > SMA200, same hold, same stop, same costs; the original `placebo` procedure, returning the
   trades so they can be read in R). The pooled real net R a trade must exceed the 95th percentile of the 40 seeds' pooled means.

**Verdict**: PASS only if all four hold; FAIL otherwise. It is a single pooled test, so no Holm correction is applied (a test per
market is reported only, never as the verdict). Window A is reported beside it; a PASS that loses in window A is said so. A PASS
leads to a paper-shadow proposal only (the owner decides); never a live change. A FAIL needs no proposal.

## Not changed after seeing results
Markets, rule, costs, rates, windows, the pooling, the placebo and the pass bar are fixed by this file. Anything looked at
afterwards is labelled as such and is not evidence.
