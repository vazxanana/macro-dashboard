# Pre-registration: the Japanese fiscal year-end yen seasonal (14 Nov 2026)

Written and pushed before any number of this study is computed. Paper only: nothing live changes, whatever the verdict. No
council rule, filter, size, stop or trade reads this study.

## Why
Market folklore and some published flow studies of Japanese investors say: Japanese institutions bring foreign gains home
before their fiscal year ends on 31 March, so **the yen strengthens (USD/JPY falls) in March**; in the first weeks of the new
fiscal year (April) new outward investment **weakens the yen (USD/JPY rises)**. No study in this repository tests either. This
one tests both on USD/JPY as positions with a stop, costs and financing, and reports EUR/JPY and AUD/JPY as a cross check.

## Data
- council-data `research/daily/usdjpy.json`, `eurjpy.json`, `audjpy.json` (OANDA mid daily candles, UTC days), copied outside
  git by `run.mjs fetch <dir>` (`git show`, no network); each file's sha256 goes into result.json.
- **Used from 1 January 2005.** The rows of 2002-2004 carry a volume of 1-2 a day (placeholder prices), so they are not used,
  not even for the ATR.
- Saturday / Sunday candles are folded into the next weekday with `council/fills.mjs` `foldWeekend` (imported). A "trading
  day" is one folded weekday candle; its date is the UTC date of the candle's time. Each pair uses its own days.

## The windows (calendar dates are UTC dates of the daily candles)
- **T1 (March, short USD/JPY)**: entry at the OPEN of the first trading day on or after 1 March; exit at the CLOSE of the last
  trading day on or before **29 March**. 29 March is the last day whose spot trades settle (T+2) on or before the year-end; the
  days that settle after it, and 31 March itself, are left out on purpose. N1(y) = the number of trading days in the window.
- **T2 (April, long USD/JPY)**: entry at the OPEN of the first trading day on or after 1 April; exit at the CLOSE of the 10th
  trading day of the window (N2 = 10).
- A window counts only when complete in the data (a candle exists at or after its last day) and with 20 candles before its
  first day.

## One position (claimed, comparison and placebo windows are all built this way)
- Side: T1 short, T2 long (the pair; the cross checks EUR/JPY and AUD/JPY take the same side: yen strength in March, yen
  weakness in April).
- **Stop: 3 x ATR(20)** from the entry price, ATR = mean true range of the 20 folded candles before the entry candle. A day
  whose high (short) / low (long) reaches the stop ends the position at the stop, or at that day's open when the day opens
  through it (`fills.mjs` `stopFill`, imported). Once stopped, the position is flat until the next year (one position per rule
  per year). No position without a stop.
- **R** = signed move / stop distance: side x (exit - entry) / (3 x ATR). Net R = gross R - cost / stop distance + financing /
  stop distance.
- **Costs** (the repository's raw-spread model, CLAUDE.md "Forex spreads"): 0.3 pip spread a round trip, half a spread (0.15
  pip) of slippage at the entry and at the exit, a commission of 22.5 USD per million a side (2 x 22.5e-6 of the entry price,
  in the pair's quote currency, for each of the three pairs). Pip = 0.01 for the three yen pairs.
- **Financing**: council-data `ctrader/symbols.json` holds no yen pair (checked before writing this: XAUUSD, EURUSD, GBPUSD,
  AUDUSD, USDCAD, USDCHF, crypto, indices), so the demo broker's swap cannot be used. **Assumed rate**: the policy-rate
  differential of the fx-carry study's `rates.json` (branch `fx-carry`, `monthEnd`, the rates in force at the end of the month
  before the entry; copied by `fetch`, not imported), (base rate - quote rate) / 100 / 365 a night for a long, the negative for
  a short, **minus an assumed broker markup of 0.5 % a year on every position** (both sides pay it). Nights = `fills.mjs`
  `nights(entry candle time, exit time)` (Monday-Friday 22:00 UTC, Wednesday three; imported); exit time = the exit candle's
  time + 21 h on a Friday, + 23 h otherwise. A short USD/JPY in 2023-2026 is therefore charged several percent a year: this
  is the carry the trade really pays and it is part of the test.
- Cost levels reported: **0** (no cost, no financing), **base**, **2x** (costs and financing both doubled). The verdict is on
  base.

## Statistic and permutation test (per test, decisive window)
- S = mean net R of the claimed window over the decisive years.
- Comparison set of a year, C(y): the windows of the same length (N1(y) or 10) and the same side, built as above, **starting
  on every other trading day of the same calendar year**, complete in the data, sharing no trading day with that year's
  claimed window.
- **Permutation p (the test)**: 20,000 draws (seeded, mulberry32, seed 20261114); a draw picks, for every decisive year
  independently, one window of C(y) uniformly and takes the mean of their net R. p = (1 + draws with mean >= S) / (1 + 20,000).
  One-sided in the claimed direction.
- **Rank (reported)**: for each start offset k (the k-th trading day of the year, the same k every year), S_k = mean over the
  decisive years of the window starting on day k (offsets where a year's window is not in C(y) are left out); the claimed
  window's rank among {S} and every S_k (1 = best). And each year's rank of the claimed window within C(y).
- **Holm** over T1 and T2 (two tests).

## Windows of years
- **Decisive: 2016 to 2026** (T1 March 2016 - March 2026, T2 April 2016 - April 2026: 11 years each).
- **Replication: 2005 to 2015** (11 years each; March 2005 has more than 20 candles before it after 1 Jan 2005).
  Comparison windows of 2026 are the ones complete by the data's last candle (6 Nov 2026).

## Pass bar (per test, on USD/JPY at base cost)
1. Mean net R > 0 in the decisive AND the replication window.
2. Holm-adjusted permutation p < 0.05 (decisive).

**Verdict:** PASS if both tests pass; PARTIAL if one (named); FAIL if none. EUR/JPY and AUD/JPY are reported with the same
statistics as a cross check and are not judged.

## Placebo (reported, not a pass condition)
40 seeds (mulberry32, seeds 1..40). Seed i draws one calendar start date (day of year uniform over 1 January - 1 December,
not inside 1 March - 15 April) and runs a T1-like test (short, length N1(y)) and a T2-like test (long, length 10) from the
first trading day on or after that date each year, through the same statistic and permutation (2,000 draws) and the same pass
bar 1-2 without Holm. Reported: how many of the 40 placebo rules of each kind would pass, and where the claimed S sits among
the 40 placebo S values.

## Also reported
The per-year table (gross R, net R, stopped or not, rank in C(y), years won), mean gross / net R and t of the yearly net R in
both windows, and the three cost levels.

## Power, said before the run
One trade per rule per year: 11 decisive observations per test. A one-month yen seasonal must be large and regular to clear a
Holm-adjusted p of 0.05 on 11 years. A FAIL here is weak evidence against the claim, not proof that it is absent; a PASS on 11
years would still be a small sample. Whatever the verdict, nothing in the council changes.
