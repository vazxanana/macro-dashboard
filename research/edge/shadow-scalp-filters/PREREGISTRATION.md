# Five filters on the shadow scalp / intraday setups: pre-registration

Written and committed on 12 Nov 2026, before any trade of this study was simulated. Paper research only: no live rule,
size, filter, council member, page, config or mirror setting is changed by this study, whatever it finds (absolute rule 3).
A pass becomes at most a **proposal** in `research/proposals/` for the owner to decide.

The folder is `shadow-scalp-filters` and not `scalp-filters`: `research/edge/scalp-filters/` is an earlier, published study
of the Scalp alone (8 Nov, not pre-registered, old candle clock) and is left as it is.

## Why

The owner said "yes" on 12 Nov 2026 to testing five rule ideas taken from this week's review of the shadow book (the
Trader's paper trades of setups the live rules block). The week was one week of trades in one gold downtrend; it proves
nothing. The five ideas, with the week's figures that suggested them (after costs):

1. Retire the retrace setups (`rscalp`, `rintra`): −86.6R on 131 trades; they lost before costs too.
2. Scalp only with the H4 trend: against H4 n 201, −70.9R; with H4 +25.5R.
3. A minimum stop of 8 spreads: stops of 4-8 spreads n 164, −44.4R; 8-15 spreads +16.3R.
4. No SOL / ETH trades while the expected cost is over 0.5R a trade.
5. Trade only 07:00-13:00 UTC: Asia −32.5R; 09-12 UTC +26.4R.

These figures were the reason to ask; they are not evidence and are not used below. Every filter is tested on history
from 2020 on, net of costs, in sample against out of sample, with n and t (absolute rule 4).

What I already know, said plainly.
- `research/edge/scalp-filters` (old clock) replayed the Scalp (M15 → M1) on 10 markets 2018-26: it lost after spread in
  every year, and its H4 split was flat (with H4 −0.20 → −0.22R, against −0.20 → −0.17R a trade). So I expect filter 2 to
  fail on the Scalp; this study also covers the other three setups.
- `research/edge/regime`, `scalp-exits` and `costs` found the Scalp negative in every regime cell, under every exit, and
  at realistic costs. **A filter that removes losing trades does not make what is left an edge**: this study measures the
  filters, and reports the filtered book's own result beside it without calling it anything.
- I have not run this study's replay, or any replay of `intraday`, `rscalp` or `rintra` on HistData, before writing this
  file. From the candle files I read only file names, sizes and the first and last times.

## Not the gold book (owner item 44)

Item 44 (12 Nov 2026) forbids new gate, exit, entry or size tests on the gold book's 2006-17 window. This study does not
touch the gold book: Gold trend (`gtrend`, `gtrend5`) and Gold daily engulf (`geg`) are not replayed, no window before
2019 is read, and gold appears only as one market of the engine's four short-term setups.

## The setups and the replay (the baseline)

- **Setups** (the "shadow scalp / intraday family"): the four engine setups whose entry timeframe is M1 or M5, built by the
  unchanged `council/engine.mjs` (`PAIRS` `scalp` M15 → M1, `intraday` H1 → M5 with `buildSetup`; `RETR` `rscalp`
  M15 → M1, `rintra` H1 → M5 with `buildRetrace`). Out of scope: `swing`, `position`, `rswing`, the Trader's own setups
  (sweep, M15 CHoCH, m30m1, trend, replica, Mosha, LIT, NQ, ICT).
- **Replay**: the `council/backtest.mjs` loop, copied into `run.mjs` (backtest.mjs is a CLI with a 30-day window and cannot
  be imported); every function that decides a trade is imported unchanged: `msAnalyze`, `buildSetup`, `buildRetrace`,
  `CFG`, `PAIRS`, `RETR`, `setMarket` (engine.mjs), `cleanBars`, `LTF_CLEAN` (clean.mjs), `replayBar`, `spotSkip`,
  `tradeCost`, `costOf`, `spreadOf` (fills.mjs), `histStampUtc` (histdata.mjs). A 5-minute step; at each step the
  Trader's view of every timeframe = its last 719 closed candles plus the forming one built from the entry feed; a signal
  = state `READY`, a signature not seen before, a confirming lower-timeframe break no older than 12 candles of that
  timeframe, and no open trade of the same setup, side and target. Limit order at the engine entry, or a fill at market
  when price is already through it; a resting order expires after `WAIT` (15m → 3 h, 1h → 12 h, as backtest.mjs) or is
  missed when the target trades first or fills with the target in one candle; candles while spot is shut fill and stop
  nothing (gold, forex). Management: `replayBar` exit variant `none` (the engine's target T1, no break-even), the live
  exit the backtest calls `R_none`. Live Coach stop settings from council-data `config.json` of 12 Nov: `buf` 0.15,
  `minRisk` 1.1. No minimum reward:risk, market, session or D1 filter is applied: the baseline is every signal the
  engine gives, as backtest.mjs records it and as the shadow book records the setups the live rules block.
- **D1 trend**: daily candles built from the same feed (New York 17:00 days); not used by any filter, recorded only.

## Data and windows

- **Gold and forex**: HistData M1 from council-data `research/candles/` (`xau-histdata`, `EURUSD`, `GBPUSD`, `AUDUSD`,
  `USDCAD`, `USDCHF`: the Trader's five forex markets), read with `git show origin/council-data:…` (no network), clock
  converted only by `council/histdata.mjs`. M5, M15, H1, H4 and D1 are built from M1 and cleaned as backtest.mjs does
  (forex lower timeframes with the wick rule). Candles from 1 Jul 2019 are warm-up; **trades from 1 Jan 2020 to 31 Oct
  2026** (the files' end). All four setups.
- **Crypto**: council-data `research/candles/crypto5m` Binance 5-minute candles of BTC, ETH, SOL, XRP (the Trader's four
  coins), 1 Jan 2022 to 31 Oct 2026; H1, H4, D1 built from them. There is no M1 history of the coins in the repository and
  Binance is not reachable from the build sandbox, so **only the M5-entry setups (`intraday`, `rintra`) are replayed on
  crypto**, trades from 1 Mar 2022 (two months of warm-up). Filter 4 is therefore tested on those two setups only, and the
  report says so.
- **In sample (IS) = trades opened 2020-01-01 to 2023-12-31** (crypto from 2022-03-01). **Out of sample (OOS) = 2024-01-01
  to 2026-10-31.** A trade belongs to the month of its signal (`opened`). OOS is the window the verdict is read on; IS must
  agree in sign. Nothing is fitted: every number in the filters below is fixed here.

## Costs

Per closed trade, in R of its opening risk `r0 = |entry - stop|` at the fill: `council/fills.mjs` `tradeCost` (imported),
which is `costOf` (one spread round trip: forex 0.0001, gold $0.30, crypto 0.02 % of price plus the CFD crypto round trip
`CFD_CRYPTO` 0.04 %), plus half a spread of slippage on a market entry and on any exit that is not the target, plus
overnight financing on gold buys (`financing`, `FIN.xau.long` x rollovers). Net R = R − costR. Stress: 2x costs (2 x costR)
and 0.5x costs (a raw-spread account). Gross (no cost) is reported, never judged.

## The five filters (each computable at the signal, no later data)

Each filter **removes** trades from the baseline family; everything is decided at the signal time `t` (`opened`), from
the views the Trader has at `t` and the order's own levels.

1. **F1, no retrace**: remove every trade of `rscalp` and `rintra`.
2. **F2, with H4**: remove a trade when the H4 trend (`msAnalyze(view 4h at t, 6).trend`, closed candles plus the forming
   one, as the Trader's `h4` feature) is opposite to the trade's side. A trade with no H4 trend (0) is kept.
3. **F3, stop of 8 spreads or more**: remove a trade when `r0 < 8 x spreadOf(M, entry)` (`r0` and `entry` as the order is
   placed: the limit price, or the market price when filled at the signal).
4. **F4, SOL / ETH cost cap**: remove a trade on `sol` or `eth` when its expected cost at entry is over 0.5R: `tradeCost`
   of the order as placed with the exit taken as a stop exit (the worst case known at entry), no financing. Other markets
   are never removed.
5. **F5, 07:00-13:00 UTC**: remove a trade whose signal hour (UTC) is before 07 or from 13 on.

Each filter is tested alone against the same unfiltered baseline (all four setups, all markets); no combination is tested.

## The statistic

For filter f, month m: `D_f,m = − Σ net R of the trades f removes, opened in month m` (one unit per trade). `D` is the
R a month the filter saves (positive = the filter helps). Every calendar month of the window counts, a month with nothing
removed as 0 (OOS 34 months; IS 48). `t_f = mean(D) / (sd(D) / sqrt(months))`, one-sided p from Student t with
months − 1 degrees of freedom. Reported per filter and window: n removed / kept, removed net R a trade, the improvement
in R a trade of the whole family (kept mean − baseline mean), total D, t, and the same at 0x, 0.5x, 1x and 2x costs;
splits by setup and by market are descriptive.

## Pass bar (all must hold, per filter)

1. **OOS, 1x costs: t ≥ 2 and Holm-adjusted p ≤ 0.05** (one-sided, Holm over the five filters).
2. Total D > 0 in IS and in OOS (1x costs).
3. OOS total D > 0 at 0.5x and at 2x costs (the filter must not hold only at one cost level).

## What a pass or a fail means

- **Pass**: the filter removes trades that lose, out of sample and robust to costs. It is written as a proposal in
  `research/proposals/` (applying the filter to the shadow paper stream, which changes no live trade). It does not make the
  filtered setups an edge: the kept book's own net R a trade and its monthly t are reported beside it, and any talk of
  live trading would need the kept book itself to pass its own pre-registered test.
- **Fail**: no proposal. The week's figures are not a reason to change anything.
- Whatever the result, nothing live changes in this branch, and the result is never mixed with ICT.

## Files

`PREREGISTRATION.md` (this file, committed alone first), then `run.mjs` (`fetch <dir>` extracts the candles from
council-data with git, no network; `market <key> <dir> <outDir>` replays one market; `report <outDir>` writes
`result.json` and the tables), `RESULT.md`, `result.json`, and `tests/shadow-scalp-filters.test.mjs`. Candles and trade
rows stay out of git.
