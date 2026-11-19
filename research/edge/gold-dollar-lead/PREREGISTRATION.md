# Does the US dollar lead spot gold when gold lags it? Pre-registration

Written and committed **before** any number below was computed (14 Nov 2026). The data, the markets, the signal, the trade,
the costs, the statistics and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. **This is a standalone cross-asset signal study, the dollar counterpart of `gold-bond-lead`** (same
design, same trade, same costs, same windows and bar; the signal market is a dollar index instead of a Treasury bond). It is
not a gate, filter, size step, entry or exit for the live gold book (Gold trend, Gold daily engulf, Mosha cycle) and must
never be read as one. Owner decision 44 (docs/owner-decisions.md) stopped further tests of gates, exits, entries or sizes on
that book's 2006-17 window; this study tests no lever of that book, takes none of its trades, and is judged on its own
out-of-sample window (2017 on). The years before 2017 are only the in-sample half of this signal. No live rule, size,
filter, stop, config, cost constant or council member changes, whatever the outcome.

## Question

Gold and the US dollar usually move against each other (the macro stack's DXY momentum and Dollar Smile drivers). When the
dollar index falls strongly in a week but gold rises less than its usual co-move with the dollar (gold "lags" the dollar's
fall), does gold catch up over the following week, by enough to trade after costs? The mirror: the dollar rises strongly
while gold falls less than its co-move. And the daily form of the same catch-up.

## Dedupe (read before writing this)

- `gold-bond-lead` (branch, 14 Nov): the same design with Treasury bond CFD prices (10-year weekly, 2-year daily). FAIL, 0
  of 3 (T1 OOS +0.088R net, n 30, month t 0.46). Not the dollar.
- `intermarket-lead` (branch) F3 "the dollar (inverted) leads the metals": the dollar's past MONTH as a monthly
  time-series-momentum leader for gold / silver / platinum, held a month, no lag condition. FAIL (OOS +0.022R a leg, t
  0.27). Here the horizon is a week / a day, the signal is a one-period shock beyond 1 sd, and it is conditioned on gold
  having lagged its own co-move.
- `macro-gold` (main): its dollar diagnostic is long / flat gold on the 20-observation fall of FRED's broad dollar with a
  10-day publication lag (Sharpe 0.09). A slow momentum on a lagged series, not a weekly / daily shock on market prices with
  gold lagging.
- `macroscore-overlay` (main): the Gold Macro Score (one input is the 4-week dollar fall) as a size step on the gold
  systems; a slow 4-input score, not a trade on a dollar shock.
- `pre-fomc-gold-usd` (branch): gold and a USD basket before FOMC days (calendar, not a dollar move). `gold-haven-shock`
  (branch): equity shock days into gold. `yield-fx-weekly` (branch): 2-year weekly moves into the dollar (the dollar is the
  follower there). `gold-oil-lead` (branch): oil / copper days into gold. `event-reaction` (main): the dollar's first
  5-minute read on CPI days into gold's next hour. None tests a weekly or daily dollar-index shock with gold lagging it as a
  lead for gold.
- The untested backlog (`research/proposals/2026-11-14-untested-backlog.md`, branch `untested-backlog`) lists no such study.
  This is new.

## Data (no network)

- OANDA mid daily candles, UTC alignment, from the council's research cache on the `council-data` branch
  (`research/daily/<key>.json`, read with `git show origin/council-data:<path>`; the commit is recorded in `result.json`).
  From `_index.json` (no prices read): xau 2006-03-20, eurusd / usdjpy / gbpusd / usdchf 2002-05-07, usdcad 2002-05-08,
  usdsek 2004-06-01, all to 2026-11-06. Gold limits the study to 2006 on.
  `node run.mjs fetch <dir>` copies them out of git (kept out of the repository); `node run.mjs full <dir>` runs it.
- Weekend candles are folded into the next weekday with `council/fills.mjs` `foldWeekend` (imported), the same way for every
  market. Days are matched by their UTC day stamp, never by row number.
- **Dollar index (fixed now)**: the ICE DXY formula, as `council/macro.mjs` `dxySeries` / `council/macroscore.mjs` `dxyDaily`
  write it, on the folded daily CLOSES: `50.14348112 × EURUSD^−0.576 × USDJPY^0.136 × GBPUSD^−0.119 × USDCAD^0.091 ×
  USDSEK^0.042 × USDCHF^0.036`, a value only on a UTC day on which all six pairs have a folded candle. Difference from the
  council's build, stated: the council has no USD/SEK on its live feed and uses `11.2 / EURUSD` in its place; the research
  cache has USD/SEK, so the real pair is used here. The council's proxy form is run once as an informational replication of
  T1 (I3 below).
- **Market set, fixed now**: signal market the dollar index above (T1-T3); traded market: `xau` only.

## Signal, weekly (T1, T2)

- A week = Monday-Sunday UTC. Its **week-end day** = gold's last folded candle of the week (normally Friday). A week counts
  only when the dollar index has a value on that SAME day stamp (else the week is skipped as unaligned).
- Weekly returns over consecutive counted weeks (a gap of more than 14 days between week-end days breaks the chain and the
  history restarts): `d_w = dxy_w / dxy_{w−1} − 1`, `g_w = goldClose_w / goldClose_{w−1} − 1`, at the same week-end stamps.
- Using only the **52 weekly pairs before week w** (w itself not in them): `sd_w` = sample sd of the 52 dollar returns,
  `z_w = d_w / sd_w`; `beta_w` = least-squares slope (with intercept) of gold's on the dollar's weekly returns (normally
  negative); co-move gold "should" have made = `beta_w × d_w`; **lag** `e_w = g_w − beta_w × d_w`.
- **T1 (primary), buy the lag**: `z_w < −1` (dollar down more than 1 sd) **and** `e_w < 0` (gold rose less than its co-move,
  or fell) → **long gold**.
- **T2, the mirror short**: `z_w > +1` (dollar up more than 1 sd) **and** `e_w > 0` (gold fell less than its co-move, or
  rose) → **short gold**.
- Known at 00:00 UTC after the week-end day. **Entry = the open of gold's first folded candle whose day is later than the
  week-end day** (the Monday candle, the Sunday reopen). Nothing of that candle or later is used by the signal, the ATR or
  the stop. **Exit at the close of the 5th gold candle** (the entry candle is the 1st).

## Signal, daily (T3)

- Common days = days on which gold and the dollar index both have a value. Daily returns between consecutive common days
  (a gap over 5 calendar days breaks the chain).
- Using only the **250 daily pairs before day d**: `sd_d`, `z_d = d_d / sd_d`, `beta_d`, `e_d = g_d − beta_d × d_d`.
- **T3**: `z_d < −1` and `e_d < 0` → long gold; `z_d > +1` and `e_d > 0` → short gold (both sides in one test).
- Entry at the open of gold's first folded candle whose day is later than d; **exit at the close of that same candle**.

## Trade (every trade has a stop) — identical to gold-bond-lead

- **Stop** = 2 × gold's ATR(20) from the entry (below a long, above a short). ATR(20) = simple mean of the 20 true ranges of
  the folded gold candles before the entry candle. 1R = the stop distance.
- On the entry candle a low (long) / high (short) through the stop exits at the stop; on a later candle an open through the
  stop exits at that open (gap), else a low / high through it exits at the stop; else the time exit. A trade whose gold
  candles end before its exit is left out.
- **One position at a time** per test.
- **Costs**: $0.30 spread a round trip plus half a spread ($0.15) of slippage per market order (entry and exit): **$0.60 a
  trade**, ÷ risk. Financing on **longs only** by `council/fills.mjs` `nights` x `FIN.xau.long` (imported; the demo broker's
  XAUUSD long swap, 0.000148 of price a rollover, Wednesday three, today's rate for every year) x entry ÷ risk; shorts pay
  and earn nothing. Entry stamp = entry candle's day 00:00 UTC; exit stamp = exit candle's day end (23:59:59 UTC, 21:59:59 on
  a Friday). **2x costs**: both doubled.
- Gross R = side × (exit − entry) ÷ risk.

## Windows

- **In sample (IS)**: signal days from the first eligible one to 2016-12-31.
- **Out of sample (OOS)**: signal days from 2017-01-01 to 2026-10-31.

## Statistics

- Per test and window: n (long / short), win rate, mean gross R, mean net R, total net R, stops, mean net R at 2x costs,
  **t on calendar-month sums of net R** (months by exit stamp; every calendar month of the window counts, empty ones as 0),
  gross month t, per-trade t.
- **p** = one-sided normal upper tail of the OOS month-sum t of net R. **Holm** over T1, T2, T3.
- **Placebo**: 40 seeds (1-40, mulberry32): from the OOS window's eligible signal weeks / days of that test, draw as many as
  the test has real signals, give them the real sides in a random order (same long / short mix), run the identical trade.
  Reported: each seed's OOS month t, how many reach t ≥ 2, how many reach the real t, the median. Informational.
- Informational, no test, not in Holm, not in the verdict: I1 / I2 = T1 / T2 **without** the lag condition (every dollar
  week beyond ±1 sd, gold against the dollar), to show whether gold's lag adds anything; I3 = the T1 rule on the council's
  own DXY build (USD/SEK replaced by 11.2 / EURUSD).

## Pass bar (per test)

1. OOS month-sum t of net R ≥ 2 **and** Holm-adjusted p < 0.05;
2. IS mean net R a trade > 0 (the same sign);
3. OOS mean net R at 2x costs > 0;
4. OOS n ≥ 30.

Verdict: **PASS** if T1 (the primary) passes; **PARTIAL** if T2 or T3 passes but T1 does not; **FAIL** if none passes. A
pass makes this a paper lead worth a forward record with its own proposal, nothing more: no live change follows from it.

## What is not tested

Other thresholds, look-backs, betas or holds; the broad trade-weighted dollar (FRED); single pairs (EUR/USD alone);
intraday timing; gold leading the dollar; any use inside the gold book. A changed rule after seeing results is post hoc
and must say so.
