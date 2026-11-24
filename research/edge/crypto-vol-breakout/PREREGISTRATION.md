# Pre-registration: the T1 volatility breakout on Bitcoin and Ether (24 Nov 2026)

Written and committed alone before any crypto breakout trade was computed. Paper research only; nothing live changes.

## Question

The intraday volatility breakout T1 (`gold-vol-breakout`: UTC open ± 0.5 × the previous day's range, stop at the UTC open,
out at 21:00 UTC) is the one rule of the repository that held on gold and USD/JPY (it failed on indices, forex majors other than
USD/JPY, platinum, palladium and energies). Does it hold on BTC and ETH? Not answered before: `vol-spike-crypto` and
`crypto-hour` tested other rules.

## Rule (imported, not re-written)

- `vbTrade` and `placeboTrade` are imported from `research/edge/index-vol-breakout/original.mjs` (a byte copy of
  `gold-vol-breakout/run.mjs`; sha256 `afa36e03…2276f`, checked by the run). k = 0.5, both sides, called with `cost: 0`;
  the cost below is charged afterwards.
- Days: crypto trades every day, so EVERY UTC calendar day is a trading day (no weekend fold). A day's candles = its 5-minute
  candles from 00:00 to 20:55 UTC; the previous day's range = high − low of the whole previous UTC day (all 288 candles), only
  when that day is the calendar day before. A day is skipped by the original's `daySkip` (no previous range, first candle over
  an hour after 00:00, under 200 candles).
- First breakout of the day wins (as in `vbTrade`); worst case inside the fill candle; a gap through the stop fills at the open;
  out at the close of the 20:55 candle.

## Data

Binance spot 5-minute candles BTCUSDT and ETHUSDT from council-data `research/candles/crypto5m` (1 Jan 2022 to 31 Oct 2026).
Binance and every other exchange host are refused by the sandbox's network proxy (checked 24 Nov 2026: data.binance.vision,
api.binance.com, data-api.binance.vision all 403), so 2018-21 is NOT available. Windows (the same split `crypto-hour` used for
the same file): **discovery 2022-01-01 to 2023-12-31, confirmation 2024-01-01 to 2026-10-31.**

## Cost

`council/fills.mjs` `tradeCost` for a crypto market order with a non-target exit: the CFD round trip `CFD_CRYPTO` 0.04 % of
price plus half a spread (0.02 % × 0.5) of slippage on the stop-order entry and again on the exit = **0.06 % of the entry
price a round trip**, in R = 0.0006 × entry / |entry − stop|. ASSUMED (the costs study's CFD figure; the demo broker's crypto
quotes were not measured). Financing: none (every trade is out at 21:00 UTC, before the 22:00 UTC rollover). 2x cost reported.

## Tests (3, Holm over the three)

- T1 BTC, T2 ETH, T3 the pool (both coins' trades together).
- Statistic: mean net R a trade; t of calendar-month sums of net R; p = one-sided normal p of the confirmation month t.
- Placebo (control): the original's construction, 40 seeds: on each eligible confirmation day a market entry at a random
  5-minute candle between 01:00 and 18:00 UTC, random side, stop k × previous range away, out at 21:00 or the stop, same cost;
  for the pool, both coins per seed.

## Pass bar (per test, all required)

1. Net R a trade > 0 in discovery AND in confirmation.
2. Confirmation month t ≥ 2 and Holm-adjusted p < 0.05.
3. Confirmation net at 2x cost ≥ 0.
4. Confirmation net R beats at least 38 of the 40 placebo seeds.
5. Confirmation n ≥ 200.

Verdict: PASS for a coin / the pool when all five hold; the study passes if the pool passes. Reported only (no verdict):
gross R, by year, buys / sells, weekend days apart from weekdays. One run, no variants of k, exit or stop.
