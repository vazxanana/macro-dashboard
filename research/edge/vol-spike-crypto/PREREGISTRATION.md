# Pre-registration: the frozen volatility-spike rebound on crypto (14 Nov 2026)

Written and committed (alone) before any crypto number of this study was computed. Paper research: nothing here is read by
the council, the mirror or the page, and no live rule, config, `api/` or council file changes whatever the verdict. Not an
ICT study.

## Why
`vol-spike-rebound` (#860, branch `vol-spike-rebound`) bought US index CFDs after the 5-day realised volatility exceeded twice
its prior 120-day median while price sat below its 20-day average, and held 10 days: PASS on its bar by the 10-day variant
only (2016-26 +0.151R a trade, n 165, t 2.53). Two frozen replications on other indices and years (`vol-spike-replicate`
#920, `vol-spike-replicate2`) both read DOES NOT REPLICATE while pointing the same way. All three are equity indices. Crypto
has frequent volatility spikes and its own capitulation literature; running the SAME frozen rule on crypto asks whether the
rebound is a general after-panic effect or an equity-index one.

Not a duplicate: `crypto-reversal` (13 Nov) bought after a three-day RETURN below -2 sd of its own 90-day history (no
volatility condition, no SMA20, 2.5 x ATR14 stop, 3 / 7-day exits), FAIL; `crypto-weekend-reversal` traded Monday after a
weekend move, FAIL; `crypto-mid-exit` is a trend-exit change. None tested a realised-volatility spike or this rule.

## The frozen rule
- `frozen.mjs` = #860's `research/edge/vol-spike-rebound/run.mjs` copied byte for byte (sha256
  `339077aa9b4193eed610095fd75862195cf259c7ed29f78d4a26ac8f71beb8c1`, the file both replications froze; pinned in
  `tests/vol-spike-crypto.test.mjs`). Never edited. This study's `run.mjs` imports its `simulate`, `signals`, `hold`, `atr`,
  `sma`, `tstat`, `monthSums`, `summary`, `holm`, `normP`, `rng`, `pct`, `P`.
- Unchanged: signal on the close of day i when RV5(i) > 2 x MED120(i) (the 120 RV5 values BEFORE i) AND close(i) < SMA20(i);
  fill at the open of day i+1; stop 3 x ATR(20) (ending at i) below the fill, checked from the entry day (a day opening under
  the stop exits at its open); **hold 10 days** (the hold that passed and that both replications froze), exit at the close of
  the 10th candle counting the entry day; one position per coin; a trade still open on the last candle is closed at that
  candle's close and counted. No parameter is chosen here.

### How the frozen code's "day" maps to crypto (stated before any run)
Crypto trades 24 hours a day, 7 days a week. The frozen `candles()` drops Saturday and Sunday candles (right for indices,
wrong for crypto: it would delete two of every seven trading days and join Friday to Monday). So the wrapper does NOT call
`candles()`: it builds the candle list itself from every UTC daily candle on file (`{ time, open, high, low, close }`, 00:00
UTC to 24:00 UTC, all seven days) and hands it to the frozen `simulate()`. One frozen "day" = one UTC calendar day. Hence on
crypto: RV5 = the last 5 calendar days, MED120 = the prior 120 calendar days, SMA20 and ATR(20) = 20 calendar days, the 10-day
hold = 10 calendar days. The `sqrt(252)` annualisation inside the frozen `rv()` scales RV5 and its median alike, so the
2x test is unaffected. A missing day is not invented (the list is the candles on file; missing days are counted and reported).

## Gate (checked before this file was written, on index data only; no crypto number was computed)
The frozen `study()` run on #860's own data (council-data `research/daily/{spx500,nas100,us30}.json`, unchanged since 7 Nov,
and `macro/cache.json` DGS2) must give #860's committed `result.json` (branch `vol-spike-rebound`) `holds["10"]` JSON-equal
(n 165, +0.151R, t 2.53 in window B; n 122, +0.013R in A), and `verdict` PASS. `run.mjs` repeats this check every run; if it
fails, nothing below is read and the study is reported "gate failed".

## Coins and data
- **Primary pool: BTC, ETH, SOL, XRP**: the council's four crypto markets (`council/trader.mjs` / `council/backtest.mjs`
  INSTRUMENTS) and the four coins the crypto studies tested (`crypto-reversal`).
- **Reported only (not in the verdict): ADA, BNB, DOGE, LINK, LTC, TRX**, the six other coins of the same cache, which no
  council system trades.
- Candles: council-data `research/candles/crypto1d/<COIN>USDT_1d.json.gz` (Binance spot UTC daily candles, the cache the
  crypto studies read; read with `git show origin/council-data:…`, no network; copies kept outside git in a directory given
  on the command line). On file: BTC and ETH from 2017-08-17, XRP from 2018-05-04, SOL from 2020-08-11, all to 2026-10-31.
  The council's live crypto feed is Kraken, the 30-day replay Kraken or Binance (`council/backtest.mjs`); this daily cache is
  Binance, the longer history. Exchange APIs are not reachable from the sandbox, so nothing newer is fetched.
- Per-coin start: a signal needs RV5 and 120 earlier RV5 values (index >= 125) and ATR(20); so BTC and ETH can first signal
  around 20 Dec 2017, XRP around 6 Sep 2018, SOL around 14 Dec 2020 (exact first signal-ready days reported).

## Windows
- **Decisive D: entries 2020-01-01 to the last candle (2026-10-31).**
- **Replication W: entries 2017-01-01 to 2019-12-31** (in practice from each coin's first signal-ready day; SOL has none).
- A trade belongs to the window of its entry day (UTC). Indicators run continuously over all candles on file.

## Costs (long only; R = (exit - entry - costs) / (3 x ATR20))
- **CFD round trip** `CFD_CRYPTO` of `council/fills.mjs` (imported) = 0.04 % of the entry price, once a trade (the owner's
  cTrader CFD route).
- **Financing, as `crypto-reversal` charged it**: the demo broker's crypto CFD long swap, council-data `ctrader/symbols.json`
  (BTCUSD, ETHUSD, SOLUSD `swap.long` -15, type 1 = percent a year, `rollover3Days` 5 = Friday counts three). XRP and the six
  reported coins are not listed at the broker: the same 15 % is charged (assumption). Charge = 15 % / 365 x nights x entry
  price; nights = the 17:00 New York rollover of each held UTC day (from the entry day to the exit day), a Friday's counting 3;
  an exit by a gap at a day's open counts no night that day; the day of an intraday stop counts (the costlier reading; a
  daily candle does not hold the stop's time). Today's rate for every year (past rates are not on file).
- **2x cost** = CFD round trip and financing both doubled; **0 cost** = before any cost.

## Primary test (decides the verdict)
Pool = the frozen rule's 10-day trades of BTC, ETH, SOL, XRP (each coin one stream), entries in D.
- Month sums = the frozen `monthSums`: net R summed by exit month over every calendar month 2020-01 to 2026-10 (zero where
  none closed); t = mean / (sd / sqrt(months)).
- **PASS** if all: pooled mean net R a trade > 0 in D; month-sum t >= 2 in D; pooled mean net R a trade > 0 in W (replication,
  same sign); pooled mean net R a trade in D still > 0 at 2x cost.
- **FAIL** otherwise.
- **NOT MEASURABLE (inconclusive: …)** if D has fewer than 40 trades (the frozen `MIN_N`) or W fewer than 10.

## Secondary (reported, never part of the verdict)
- Per coin (primary four): n, mean net R, trade t, one-sided normal p, month t, win rate, stops; Holm over the coins with
  n >= 10 in D.
- The 5-day hold (the frozen primary of #860): the same pooled figures.
- 0 / base / 2x cost: pooled mean R and month t; worst drawdown in R (closed trades in exit order) at each.
- Trade t of the pool beside the month t; by entry year; the six other coins (each, and pooled), labelled "not in the verdict".

## Placebo (reported beside the verdict)
40 seeds `rng(7001)` … `rng(7040)` (the frozen generator). Per coin, the same number of trades as the rule took in D, on
signal days drawn uniformly (with replacement, as the frozen `randomTrades` draws) from the days whose fill falls in D, whose
close is below SMA20, and which are NOT signal days (RV5 <= 2 x MED120, indicators standing): "below the 20-day average without
a spike". Fill at the next open, the frozen `hold` (10 days, 3 x ATR(20) stop), the same costs. Reported: the seeds' pooled
mean net R, their 95th percentile, how many seeds the rule beats. If the rule meets the bar but sits under the placebo's 95th
percentile, RESULT.md says so plainly.

## What a result means
None of these readings changes anything live. PASS would be evidence the rebound is a general after-panic effect, written up
beside #860's paper-shadow proposal (owner decision); no crypto proposal follows from one study. FAIL is written up as such.
The rule is not tuned on these data: no other multiple, median length, SMA, stop, hold, coin set or window after the first run.
