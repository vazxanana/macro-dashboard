# Replica: do its sells really beat its buys? Pre-registration

Written and committed on 17 Nov 2026, alone, before any trade of this study was simulated and before any historical
figure by side was computed. Paper research only: no live rule, size, filter, council member, page, config or mirror
setting is changed by this study, whatever it finds (absolute rule 3). A passing test becomes at most a **proposal** for
the owner.

## Why

The owner asked which edges can be improved, "focus like the replica". The trade review of 17 Nov 2026
(`council/trade-review.mjs`) read the replica's forward research stream (council-data `research.json`, `k: 'replica'`,
every signal of the replica rule on ten markets, recorded since 3 Nov 2026) and found:

- 1,000 closed research trades, −0.094R a trade before costs (t −2.08);
- buys −0.414R a trade (n 522, t −7.83), sells +0.256R (n 478, t 3.58), a split that passed Holm in that review;
- the Replica demo account fills 0.062R a trade worse than paper (n 157 copies, t 3.06).

That is about two weeks (3 to 17 Nov 2026) of one market regime. Looked at by market (what I have seen before writing
this file, said plainly): on EUR/USD, GBP/USD and AUD/USD the sells won and the buys lost; on USD/CAD and USD/CHF the
opposite (buys +0.44R and +0.40R, sells −0.42R and −0.45R); on the four coins the sells won; on gold buys −0.29R, sells
+0.06R. On forex, the winning side is the side of a RISING DOLLAR in every pair, which points at a regime (the dollar rose
and coins fell over these two weeks), not at a property of sells. This study asks it of history that played no part in
noticing the split.

## Data not used to pick the idea

- The side split was noticed on 3-17 Nov 2026 forward records only. No study in this repository and no entry of
  council-data `research/log.md` reports the replica's raw signal split by side on 2020-26 (the 5 Nov "replica grid"
  searched filter, stop, H4, D1, volatility, barrier, session and exit, never side; `replica-oos` split by D1 and the
  volatility gate on gold, never by side). The candle files below end on 31 Oct 2026, before the forward records start.
- What the replica's 2019-26 candles WERE used for: choosing the live gold filters (v5, D1, the volatility gate, sizing).
  None of those enters here: this study replays the raw signal, every signal, as the research stream records it.

## Not the gold book, not ICT

Item 44 (12 Nov 2026) is about Gold trend and Gold daily engulf on 2006-17; this study touches neither and reads nothing
before July 2019. ICT is not part of it.

## The trades: the replica's research stream, replayed

- **Signal**: `replicaSignals` copied VERBATIM out of `council/trader.mjs` at run time (with `platformEngulfs` and
  `goldLevels`, which it calls), as `research/edge/gold-systems/live.mjs` does. It is evaluated at every M5 close with the
  closed M5 and M15 candles of that moment (the live Trader drops the forming candle; so does the function); a signal is
  taken once, keyed by side and CHoCH candle time, as `research.json` keys it (`sig`). No filter: `pass`, `v5`, H4, D1,
  the volatility gate, the risk rules and sizing are NOT applied (the research stream records every signal).
- **Entry**: at market, the open of the first M5 candle after the decision (the live research row fills at the price of
  the run that sees the signal, a median 52 s after the CHoCH candle closes). Gold, forex: no signal while spot is shut
  (`council/fills.mjs` `spotSkip`).
- **Stop, target, exit**: as the research rows: stop past the leg's extreme by `max(0.1 × M15 ATR, 0.30)` on gold, `0.1 ×
  M15 ATR` elsewhere; on gold the round-number move (a stop within $2 in front of a $10 level goes $0.50 past it); a signal
  whose entry is on the wrong side of the first stop is dropped (as live). Target 2R. Out at the close of the first M5
  candle 48 h or more after the fill. Managed on M5 candles: stop before target inside a candle, a stop gapped through
  fills at the open (`stopFill`); gold and forex candles while spot is shut are skipped (`spotSkip`). One position per
  signal, no limit on how many are open (the research stream has none).
- **Costs**: `council/fills.mjs` `tradeCost`, unchanged, with the cost model the Trader computed from council-data of
  17 Nov 2026 (`costModel` over `ctrader/symbols.json` and every mirror file), pinned in `run.mjs`: gold spread $0.06 +
  commission 0.0024 % of price, demo entry fills (no entry slippage charged); forex spread 0 + commission 0.0045 % of
  price + half a default spread (0.5 pip) on non-target exits; BTC / ETH / SOL the measured CFD spread as a share of the
  17 Nov price (0.027 %, 0.165 %, 0.270 %), XRP the default (no quotes on file), half a spread of slippage on entry and on
  non-target exits; overnight financing on gold buys. A 2x cost column is reported, not judged.
- **Candles** (council-data `research/candles/`, `git show origin/council-data:…`, no network, kept out of git):
  HistData M1 for `xau`, `eurusd`, `gbpusd`, `audusd`, `usdcad`, `usdchf` (UTC through `council/histdata.mjs`), built
  into M5 and M15; Binance 5-minute candles for `btc`, `eth`, `sol`, `xrp`, built into M15. Different feeds from live
  (OANDA, Kraken): said in the result.

## Windows

- **In sample (IS)**: signals 2020-01-01 to 2023-12-31 (coins 2022-03-01 to 2023-12-31; their files start in 2022).
- **Out of sample (OOS)**: signals 2024-01-01 to 2026-10-31, 34 calendar months.
- Warm-up from July 2019 (coins January 2022); no trade is counted from it. Nothing is fitted.

## The three tests (all counted in the correction)

Every test is on the pool of the ten markets, net R per trade (1x costs), a trade belonging to the calendar month (UTC)
of its signal.

1. **T1 sells**: the stream of every sell signal. Statistic: the net R summed by calendar month; t = mean / (sd / √k)
   over the k months of the window (a month with no trade counts as 0).
2. **T2 sells minus buys**: per calendar month with at least 5 sells and 5 buys, D = mean net R of the month's sells −
   mean net R of its buys; t over those months.
3. **T3 with the market's 20-day move**: a signal is "with the move" when its side agrees with the sign of the
   market's close of the last completed UTC day minus the close 20 completed days (days with candles) earlier, both
   known at the signal; the stream of every such signal (both sides, all markets). Statistic as T1. This is the
   regime reading of the forward split (in those two weeks the winning side was the side of the dollar's and the coins'
   move), written as a rule that could have been followed at the time.

**Pass**, for each test, all of:
- OOS t ≥ 2;
- Holm-adjusted one-sided p ≤ 0.05, p = P(T ≥ t), Student t with k − 1 degrees of freedom, Holm over the **3 tests**;
- the statistic's mean > 0 in IS AND in OOS (for T1 / T3 the net R a trade, for T2 the mean D).

## Reported, not judged

- Every signal (both sides), buys alone, by market × side, by year × side, IS and OOS, gross and net, the 2x cost column.
- The per-market cost a trade (R), and the share of trades whose stop is under 5 spreads (the cost driver on the coins).
- For forex, the "dollar side" (EUR/GBP/AUD sells and CAD/CHF buys) against the other side, by window.
- Per market and month, whether the side that won the month (by mean net R) is the side of that month's own move:
  share of months, to say how often the side split simply follows the month's direction.
- The forward stream of 3-17 Nov 2026 beside the history (descriptive; it is what raised the question).

## What the answer means

- **T1 or T2 passes**: sells beat buys on data that did not suggest it; the side split may be structural. At most a
  proposal: a replica research stream of sells only, recorded as its own shadow stream for a forward check; nothing
  live (the replica is a paper shadow since 11 Nov).
- **T1 and T2 fail**: the forward split is a regime artefact of two weeks; no side rule is proposed.
- **T3 passes**: "with the 20-day move" is worth a forward shadow check of its own; T3 alone says nothing about sides.
- Nothing here is ever called an edge without its n and t.

## Files

`run.mjs` (`fetch <dir>`, `market <key> <dir> <out>`, `report <out>`), `result.json`, `RESULT.md`,
`tests/replica-sides.test.mjs` (pins the result).
