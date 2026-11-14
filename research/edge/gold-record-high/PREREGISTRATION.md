# Pre-registration: gold after a new record closing high, continuation or reversal (14 Nov 2026)

Written and pushed alone, before any trade of this study is simulated. The only figures computed before this file are signal
COUNTS per year (how many record closes the data holds; no price after a signal was read), given below so the reader can see
how small some samples are.

## Question
What does spot gold do after a daily close at a new all-time high, or at a new 52-week high? Stocks show continuation near
records (George and Hwang 2004, "The 52-week high and momentum investing", Journal of Finance; the anchoring / attention
reading). Is gold the same, or does it revert?

## Dedupe
- `high52-cmdfx` (FAIL, 0 of 4): a monthly CROSS-SECTIONAL ranking of 12 commodity CFDs (gold one of them) and 35 currency
  pairs by close / 252-day closing high, long the top third and short the bottom third. It never asks what gold itself does
  after its own record; this study is a time-series event study on gold alone.
- `high52-rotation`, `index-52w-high`: the same ranking on equity indices (FAIL). Not gold.
- `gold-tsmom` (FAIL): the sign of gold's 12-month return, monthly. Not an event at a record.
- `trend-breadth-h1` (FAIL, 0 of 14): the live Gold trend rule on 13 other markets, not gold, not records.
- The gold-systems studies (`gold-systems`, `gold-systems-oos`, `supported-book`, `book-sizing`): the live Gold trend rule
  and the engulf. See "How this differs" below.
- The untested backlog (`research/proposals/2026-11-14-untested-backlog.md`) has no record-high event study.
Not a duplicate.

## How this differs from Gold trend (owner decision 44)
Gold trend buys a break of the prior 20 daily HIGHS (intraday), keeps an ATR trailing stop with no fixed end, and adds a second
unit. This rule buys only after a daily CLOSE at a new all-time (T1) or 252-day (T2) closing high, holds a FIXED 20 trading days
with a fixed catastrophe stop, never trails and never adds. A record close is always above the 20-day high, so the entry days
are a subset of days on which Gold trend may already hold a position: the two are related bets on gold rising. This study is a
stand-alone event study. It is NOT a gate, exit, entry or size of the gold book and does not read the book's records or
`legs.json`; it changes nothing live. A PASS would only be a proposal for a paper shadow that the owner may approve.

Item 44 ("no further gate, exit, entry or size is tested on this book's 2006-17 window") binds tests ON THE BOOK. This study
tests none of those on the book, so the common windows below are used (in sample to 2016, out of sample 2017 to Oct 2026).
Said plainly: the 2008-16 daily gold path has been read by many earlier studies; the in-sample half is a check of sign, the
decision rests on 2017-26.

## Data
OANDA mid XAU_USD daily candles (UTC days), council-data `research/daily/xau.json` at commit `389931b46`, read with
`git show` (no network). Weekend stubs folded into Monday with `council/fills.mjs` `foldWeekend`.

## Signals (closes up to and including the signal day only)
- **All-time closing high (T1)**: close above every earlier close in the file AND above $850, gold's prior record (the London PM
  fix of 21 Jan 1980; the file starts in March 2006, below it). The first such close is in January 2008.
- **52-week closing high (T2, T3)**: close above the highest of the previous 252 trading-day closes (needs 252 closes before it).
- **First record after a gap (descriptive only)**: an all-time closing high with more than 60 trading days since the previous one.
  Counted before any outcome: 9 in the whole file (2008-11: 5, 2020: 1, 2023: 1, 2025: 2), too few for a monthly t, so it is
  reported, not tested, and is not in the Holm family.
Signal counts (days, not trades): all-time highs 2008-11: 107, 2020: 6, 2023: 2, 2024: 42, 2025: 50, 2026: 10; 52-week highs
in every year but 2012-15 and 2021.

## Trades (fixed here)
- Entry at the OPEN of the next daily candle after the signal close, market order.
- **Stop** (every trade has one): 3 x ATR(20) from the entry; ATR = simple mean of the 20 true ranges up to and including the
  signal candle. Checked on every candle from the entry candle on: low (long) / high (short) through the stop exits at the stop,
  or at the candle's open when it opened through it (not on the entry candle's open, which is the entry).
- **Time exit**: at the CLOSE of the 20th candle counted from the entry candle (the entry candle is the first).
- **One position at a time per test**: a signal while that test's position is open is ignored; the next signal after the exit
  (its close at or after the exit candle) can open the next.
- 1R = the stop distance. Result per trade in R.
- **Costs**: spread $0.30 an ounce a round trip, plus half a spread ($0.15) of slippage on each market order (entry, and the
  exit: stop or time exit are both market orders): $0.60 a trade, / stop distance in R. **Financing** on longs:
  `nights(entry time, exit time)` x `FIN.xau.long` (0.000148 a night, the demo broker's XAUUSD swap of 11 Nov 2026, charged for
  every year) x entry / stop distance. Shorts are charged and credited nothing. Entry time = the entry candle's start; exit time
  = the exit candle's start (stop) or its end (time exit).

## Tests (three, Holm over the three)
- **T1 (primary)**: long after an all-time closing high.
- **T2**: long after a 52-week closing high.
- **T3**: short (fade) after a 52-week closing high.

## Windows and statistics
- A trade belongs to the calendar month of its EXIT. Monthly sum of net R; every calendar month of the window counts, a month
  with no exit is 0.
- **In sample**: January 2008 to December 2016. **Out of sample**: January 2017 to October 2026 (the data's last complete month).
- t = mean / (sd / sqrt n) of the monthly sums; one-sided p from the normal tail in the test's own direction; Holm over T1-T3.
- **Pass bar** (judged on T1; T2 / T3 reported against the same bar as secondary findings that would need their own
  replication): OOS net mean > 0 with monthly t >= 2 and Holm p < 0.05; the in-sample net mean of the same sign; OOS net mean
  still > 0 at 2x costs and financing.
- Also reported: n trades, win rate, R a trade gross and net, stopped share, worst drawdown, per year.

## Placebo (40 seeds, fixed: seeds 1..40, mulberry32)
For each test and seed, every real trade's entry day is replaced by a uniformly drawn weekday candle of the same calendar year
(with at least 21 candles after it in the file), traded with the same side, stop, hold and costs; placebo trades are not made
one at a time (each stands alone). Reported: the distribution of the OOS net monthly t, and how many seeds reach the real t.
This asks whether the record-day timing adds anything over owning gold for 20 days at random in the same years (gold rose
strongly in 2024-26, so a long almost anywhere then made money).

## What is not done
No parameter (hold, stop, gap length, lookback) is varied after seeing results. Nothing live changes.
