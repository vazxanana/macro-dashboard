# The owner's market cycle as an entry on crypto: pre-registration

Written and committed on 14 Nov 2026, before any trade of this study was computed. Paper research only: no live rule, size,
filter, stop, config or mirror setting is changed by this study, whatever it finds.

## Source of every definition

This study is the crypto twin of `research/edge/index-cycle/` (branch `index-cycle`, pre-registration commit `ab8a1b05a`, result
`748fb9c79`: FAIL) and `research/edge/fx-cycle/` (branch `fx-cycle`, result `cfd928e8d`: FAIL). The rule, its constants, the
fills, the exits, the one-at-a-time rule, the statistics, the placebo and the pass bar below are copied from the index-cycle
pre-registration. Only what crypto (and the data that can be reached) requires is changed, and every change is listed in the
section "What differs from index-cycle". The code is copied from `research/edge/fx-cycle/run.mjs` (nothing is imported from a
sibling branch).

## Why

The owner's rule, in his words: "if we are bullish on H4 and the pullback finished, focus only on buys, and vice versa". As an
ENTRY (the moment the H1 pullback against the H4 move is over, trade with the H4) it failed on US indices (index-cycle: exit A
-0.227R a trade, exit B -0.155R on 2016-26, both worse than random entries with the same H4 bias) and on five forex majors
(fx-cycle: -0.135R and -0.089R). Crypto trends differently, trades every day and is not tested yet. This study tests it once.

What I already know, said plainly: I have read both results above (and the gold studies mosha-retrace / mosha-cycle). I have NOT
computed anything of this rule on crypto candles. Nothing was tuned; the constants are index-cycle's.

## Data

- Binance spot 5-minute candles of `BTCUSDT`, `ETHUSDT`, `SOLUSDT` from council-data `research/candles/crypto5m/*_5m.json.gz`
  (rows `[t, o, h, l, c]`, `t` = the candle's UTC start), read with `git show origin/council-data:…` (no network). They run from
  1 Jan 2022 00:00 to 31 Oct 2026 23:55 UTC. The candles are kept out of git (`fetch.mjs <dir>` copies them out of the
  council-data branch).
- H1 candles are built from the 5-minute candles in UTC hour buckets (open of the first, close of the last, high / low over all);
  an hour with no 5-minute candle has no H1 candle. H4 candles are built from the H1 candles in UTC buckets
  (`floor(t / 14400)`); an H4 candle's close time is its bucket end.
- The USDT-quoted spot price stands for the USD CFD price (the council's crypto CFDs follow spot).
- **No intraday crypto history before 2022 can be reached from this sandbox**: council-data holds 5-minute candles from 2022
  only, and Binance (api, data-api and data.binance.vision), Binance US, Kraken, Coinbase, Bitstamp, Bitfinex and CryptoCompare
  are refused by the network proxy; the site's candle proxy (`/md/bars`, OANDA) serves no crypto. So the 2018-2021 replication
  the brief asked for cannot be run. It is replaced by the halves line below, fixed here before any trade is computed.

## Windows

A trade belongs to a window by its EXIT time (as `trend-breadth-h1`). **Decisive: 1 Jan 2022 to the last candle (31 Oct 2026).**
The first weeks of 2022 are also the swings' warm-up (a BO needs swings that exist), so a trade can only appear once they do.
**Halves (in place of the replication):** 1 Jan 2022 to 31 Dec 2023, and 1 Jan 2024 to the last candle.

## The rule. Written for a bullish H4 move (a BUY); a bearish one is the mirror image.

Constants: `W4 = 3` (H4 swing: 3 candles a side), `W1 = 1` (H1 swing: 1 candle a side, a three-candle swing, as mosha-retrace and
mosha-cycle), `ATR_N = 14`, `BUF = 0.1` x ATR, `MIN_R = 1`, `FIXED_R = 2`, `HOLD = 48` H1 candles.

1. **Swings** (as `research/edge/mosha-level/run.mjs` `swings`): a swing high at candle j is a high not below the `w` highs
   before it and strictly above the `w` highs after it; a swing low the mirror image. It exists from the close of candle `j + w`.
2. **BO** (as `research/edge/mosha-retrace/run.mjs` `boEvents`): a candle that closes above the most recent swing high that
   existed when the candle opened is a BO up; below the most recent swing low a BO down. Each level is broken once. The BO's
   time is the candle's close. Closed candles only.
3. **H4 bias:** the direction of the latest H4 BO (W4 = 3) whose time is at or before the moment considered.
4. **Pullback start (the H1 ChoCh):** after that H4 BO (H1 BO time strictly later than the H4 BO time), the first H1 BO
   (W1 = 1) against the bias.
5. **Pullback finished:** after the ChoCh, the first H1 BO back with the bias. If a newer H4 BO happened at or before this
   moment, the cycle belongs to the newer H4 BO and starts over (the older one gives no trade). Each H4 BO gives at most one
   signal.
6. **Entry:** at the open of the next H1 candle in the data after the "pullback finished" candle, in the bias direction only.
   **Crypto trades 24/7: there is no skip window**; no entry more than 72 hours after the signal (a data hole). A skipped
   signal gives no trade.
7. **Stop:** for a buy, the lowest low of the H1 candles from the ChoCh candle through the "pullback finished" candle, minus
   0.1 x ATR(14) H1 (the mean true range of the 14 H1 candles ending with the "pullback finished" candle). Sell: the highest
   high plus the same. Risk `r0 = entry - stop`. **No trade when the stop is not strictly on the losing side of the entry**
   (a gap past it).
8. **The H4 move's extreme** (as `cycleState`): the highest high (buy) of the H1 candles from the start of the H4 BO candle to
   the ChoCh candle, inclusive.
9. **Exit A:** target = the H4 move's extreme, only if it is at least 1R above the entry; otherwise no trade in this stream.
   **Exit B:** target = entry + 2R (always). Both: out at the close of the 48th H1 candle (the entry candle is the first).
10. **Fills on H1:** from the entry candle on, a candle that holds both the stop and the target is a stop (stop first); a candle
    that opens past the stop exits at its open; a candle that opens past the target exits at the target. No break-even, trail,
    partial or add.
11. **One trade at a time per market and per exit stream:** a signal whose entry is before the open trade's exit is skipped.

## Costs (per trade, in price units, then divided by r0)

- **Round trip:** `CFD_CRYPTO` = 0.04 % of the entry price (`council/fills.mjs`, the costs study's CFD round trip, of which
  0.02 % is the spread), imported, not copied. No separate slippage is added (the brief fixes the cost as this figure).
- **Financing:** for every 22:00 UTC passed while the trade is open (entry before it, exit at or after it), every calendar day
  including weekends (crypto CFDs roll every night; no Wednesday triple): `rate / 365 x entry price`. Long: 15 % a year
  (BTC, ETH, SOL). Short: 7.5 % a year on BTC, 10 % on ETH and SOL. No credit is ever given.
- `net R = gross R - (round trip + financing) / r0`.
- Twice-the-costs line: every cost x2; reported, never decisive.

## Statistics

- Per exit stream, the three markets pooled (one row per trade). Per trade: n, mean net R, t of the trade means. **t used for
  the verdict: on calendar-month sums** of net R (months by exit, every calendar month of the window counted, empty months 0),
  t = mean / (sd / sqrt(months)).
- p = two-sided normal p of the monthly t. Holm over the 2 exits (A and B) in the decisive window (the pooled test: this is the
  verdict's test).
- Per market (reported, never decisive): the same figures per market, with a Holm p over the 6 market x exit tests.

## Placebo (40 seeds)

For each exit and each seed (seeded generator, seeds 1-40): every real trade of the decisive window is replaced by a random
one on the same market, in the same direction, entered at the open of a random H1 candle of the decisive window (uniform over
the candles whose H4 bias at that open equals the trade's direction and that have 48 candles of data after them), with the
same stop distance r0 in price, the same target in R (Exit A: the real trade's planned R multiple; Exit B: 2R), the same
48-candle exit, fills, costs and financing. The placebo trades are independent (no one-at-a-time). The seed's statistic is the
mean net R a trade; the 95th percentile of the 40 (linear between ranks) is the bar. This asks whether waiting for "the
pullback finished" adds anything over simply trading with the H4 bias. Percentiles 5 / 50 / 95 are reported.

## Pass bar (per exit)

All of: decisive pooled mean net R a trade > 0; monthly t >= 2; Holm-adjusted p < 0.05 (over the 2 exits); **both halves
(2022-2023 and 2024-now) pooled mean net R a trade > 0** (in place of the 2010-2015 replication of index-cycle, which the data
cannot give); decisive mean net R a trade above the placebo's 95th percentile.
**Verdict: PASS if at least one exit passes every line, else FAIL.** Per market figures, per exit-reason figures and the
twice-the-costs line are reported, never decisive. A PASS here would still be unreplicated on independent years: it would need
a replication on other data before any proposal is written.

## What differs from index-cycle

| | index-cycle | crypto-cycle |
|---|---|---|
| Markets | nas100, spx500, us30 (OANDA mid H1) | BTC, ETH, SOL (Binance spot 5m → H1, council-data cache) |
| Data | Oct 2007 - Nov 2026 | Jan 2022 - Oct 2026 |
| Decisive window | 2016 - now | 2022 - now |
| Replication | 2010-2015 net R > 0 | not reachable; both halves 2022-23 and 2024-now net R > 0 |
| Skip window | 17:00-18:00 New York | none (24/7) |
| Costs | index points: spread + 1 point slippage | 0.04 % of price a round trip (`CFD_CRYPTO`) |
| Financing | DGS2-based, every calendar 22:00 UTC | long 15 %, short 7.5 % (BTC) / 10 % (ETH, SOL) a year, every calendar 22:00 UTC |
| Pooled over | 3 markets | 3 markets; per-market Holm over 6 tests reported |

Everything else (the rule's eleven steps, the statistics, the placebo, the pass bar's other four lines) is unchanged.

## What follows

A PASS is not yet a proposal (unreplicated, above). A FAIL ends this reading on crypto: no parameter will be varied after
seeing the result.
