# Big US equity sessions into crypto overnight: pre-registration

Written and committed **before** any NAS100 intraday candle was fetched for this study and before any part of the rule was run
(13 Nov 2026). The signal, the trades, the costs, the windows, the tests and the pass bar are fixed here; nothing in them changes
after the results are seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes. A pass would be a hypothesis for a
forward paper shadow that the owner decides on; it is never a live rule.

## Question

After a big NAS100 cash session (09:30 to 16:00 New York), does crypto (BTC, ETH) carry the move overnight, until the next
cash open? Two variants: **Follow** (trade with the session's direction) and **Fade** (trade against it).

## What is already known (seen before this was written)

- `research/edge/risk-spill-jpy` (branch `risk-spill-jpy`, not merged): the same question for the S&P 500 into USD/JPY and
  AUD/JPY failed, 0 of 2. Its structure (New York clock through `council/histdata.mjs`, the NYSE calendar, the placebo, Holm)
  is copied here; nothing is imported from that branch.
- Only the first and last rows of the data files were read: the council-data Binance 5-minute files start 2022-01-01 00:00 UTC
  and end 2026-10-31 23:55 UTC; the proxy serves NAS100 M15 from at least November 2017.

## Data, and a departure from the brief that the data forces

- **NAS100**: OANDA mid **M15** through the site's keyless proxy (`/md/bars?sym=nas100&tf=15m`), complete candles, from
  1 November 2021. `node --use-env-proxy run.mjs fetch <dir>`; files stay out of git.
- **BTC, ETH**: Binance spot `BTCUSDT` / `ETHUSDT` **5-minute** candles from council-data
  (`research/candles/crypto5m/*_5m.json.gz`, read with `git show`, no network). H1 candles for the ATR are built from them by
  UTC hour (open of the first 5-minute candle in the hour, high / low over the hour, close of the last).
- **Departure (stated before any result)**: the brief asks for a decisive window from January 2021 and a replication on
  2018-2020. From this sandbox no crypto intraday source before 2022 is reachable (Binance, its data mirror, Kraken history,
  Coinbase, Bitfinex and the rest are refused by the network proxy; the council-data files start 1 January 2022, the only crypto
  intraday history in the repository). So:
  - **Decisive window**: signal days 2022-01-03 to the last signal day whose exit candle is on file (end of October 2026).
  - **Replication 2018-2020: not available.** The "same sign in 2018-20" check is recorded as *not run*. Because the bar needs
    every check, **no variant can PASS in this run**: a variant that clears every other check is reported as
    **INCONCLUSIVE (replication pending)**, never as an edge; one that misses any other check FAILS. The replication can be run
    later with the same `run.mjs` on 2018-2020 crypto 5-minute candles (fetched where Binance is reachable), and only then can
    the verdict become PASS.
  - Reported as well, NOT part of the bar: the two halves 2022-23 and 2024-26 of the decisive window.

## Clock and calendar

- New York time through `council/histdata.mjs` `nyOffsetH` (US daylight time from the 2nd Sunday of March to the 1st Sunday of
  November).
- NYSE (= Nasdaq) calendar: weekends, the full holidays (New Year with the NYSE's observance and no Saturday observance, MLK,
  Presidents', Good Friday, Memorial, Juneteenth from 2022, Independence, Labor, Thanksgiving, Christmas), the special closure
  of 9 Jan 2025. **Half days** (3 July, the day after Thanksgiving, 24 December when weekdays) close at 13:00: they have no 16:00
  close, so they are **never signal days**; they do open at 09:30, so they **can be exit days**.

## Signal (known at 16:00 New York)

- Session move of a full trading day d: r_d = close of the M15 candle that starts 15:45 New York / open of the M15 candle that
  starts 09:30 New York − 1. Both candles must be on file, else the day has no move.
- m20 = median of |r| over the 20 previous days that have a move (day d excluded). Fewer than 20 → no signal.
- **Signal**: |r_d| > 1.5 × m20. Direction s = sign(r_d).

## Trades (BTC and ETH, each alone, same rule)

- **Entry**: the open of the 5-minute candle that starts at 16:00 New York on day d (the moment the session's close is known).
  Follow: side = s. Fade: side = −s. No candle starting exactly then → no trade for that coin.
- **Stop**: 1.5 × ATR(24) of the coin's H1 candles: the 24 complete UTC hours that ended at or before the entry (true range,
  previous H1 close, simple mean). 16:00 New York is always on a UTC hour, so no hour straddles the entry. Every trade has its
  stop from the entry; 1R = that distance.
- **Exit**: the open of the 5-minute candle that starts 09:30 New York on the next NYSE trading day after d (a half day counts;
  a weekend or holiday is skipped, crypto trades through it). Missing → the last close before 09:30 (`time-last`).
- **Stop on the 5-minute candles** from the entry candle to the last before the exit: a candle after the first that opens
  beyond the stop exits at its open (gap); otherwise a low (long) / high (short) at or through the stop exits at the stop.
  No target, no break-even, no trail. Trades of one coin never overlap (each ends before the next 16:00).

## Costs (net R, every trade)

- CFD round trip 0.04 % of the entry price (`council/fills.mjs` `CFD_CRYPTO`, of which 0.02 % is the spread).
- Slippage: half a spread on each market order, entry and exit (time, gap or stop), = one spread = 0.02 % of the entry price.
- **Swap** (the demo broker's crypto CFD financing, council-data `ctrader/symbols.json` of 13 Nov 2026, `type 1` = % a year of
  the position's value): longs pay **15 %** a year on both coins; shorts pay **7.5 %** (BTC) and **10 %** (ETH). The measured
  file differs from the brief's "shorts the same", so the file is used. Charged per 17:00 New York rollover strictly after the
  entry and at or before the exit, Monday to Friday only, **Friday's counted three times** (`rollover3Days 5`), at rate / 365
  of the entry price. A Monday-Thursday signal crosses one rollover, a Friday signal three, more around holidays.
- net R = gross R − (0.0006 × entry + swap) / risk. A x2 cost line is reported, not part of the bar.

## Tests and pass bar (decisive window)

Two tests, one per variant, each **pooled over BTC and ETH** (every trade of both coins). A variant passes only if all hold:

1. pooled net R a trade > 0;
2. t ≥ 2 on calendar-month sums: the pooled net R summed by the calendar month of entry, every month of the window counted
   (a month with no trade is 0), t = mean / (sd / √months);
3. Holm over the two variants at 5 % on the one-sided normal p of that t;
4. the same sign on 2018-2020 (**not available here**, see above);
5. placebo: 40 seeded draws (seeds 1-40). Each draws, from the full trading days of the decisive window on which both coins
   have an entry and an exit, as many days as the variant has signal days with a trade, and gives them the variant's number
   of long signal days at random; both coins are traded on each drawn day with the same entry, exit, stop and costs. The real
   pooled net R a trade must be above the placebo's 95th percentile (linear interpolation of the 40 means at 0.95).

**Verdict**: as above (PASS impossible in this run; INCONCLUSIVE if a variant clears checks 1, 2, 3 and 5; else FAIL).
Reported, not part of the bar: per coin, gross R, swap R, x2 costs, by year, the two halves, up vs down sessions, Friday
signals apart, stop-out share, hit rate.

## Not done here

No other threshold, window, stop, coin, entry or exit time is tested; a variation needs its own pre-registration.
