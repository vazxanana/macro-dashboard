# Pre-registration: event risk manager. Does skipping or flattening trades around CPI, NFP and FOMC help?

Written on 7 Nov 2026, before any trade below was tagged with a release, before any flatten price was read, and before any
result was computed. It is committed and pushed on its own, first. Nothing in this file may change after the first
computation. The tests run once, and the result is reported whatever it is.

## Why

The Macro strategist (`council/macro.mjs`) has no next-day direction edge, and no volatility model beat a naive 20-day
average (#515). What it does know is the calendar: CPI, NFP and FOMC days move more. The job proposed for it is **event risk
manager**: tell the desks not to open trades just around a release, or to be flat just before one. This file tests whether
that job adds R, on the ICT desk's A-setups and on the Meridian systems, before anything is built.

## What was already seen (declared, not hidden)

- `research/edge/news-filter` (#488) tagged the ICT replay (Aug 2025 to Nov 2026) and the Meridian dumps (`backtest.json`,
  `research/replay-90d.json`, `research/replay-2w.json` from Aug 2025, `trades.json`) with **symmetric** windows (±30, ±60,
  ±120 minutes, same day, held through) over a wider event set (CPI, NFP, FOMC, PCE, ISM, claims, ECB, BoJ). Its tables are
  public in the repo. So the 2025-26 parts of the samples below are **not untouched**: their ±30 and ±60 cells were seen.
  The asymmetric window [−30, +60], the CPI/NFP/FOMC-only set, the flatten test and the samples before Aug 2025 were not.
- For that reason the ICT HistData part (2022-01 to 2025-07) and the Meridian main-system replay before Aug 2025 are also
  reported on their own. That is the part no earlier study tagged. It is a reported cell, not an extra pass route.

## Events

- **Types:** CPI, NFP and FOMC only (no PCE, ISM, claims, ECB or BoJ).
- **Times:** `council/events.mjs`, imported unchanged: `HISTORY` (Jan 2022 to Jul 2025) and `EVENTS` (Aug 2025 to Dec 2026)
  filtered to those three types. CPI and NFP at 08:30 New York, FOMC statement at 14:00 New York, DST handled by the module.
  Only releases up to 7 Nov 2026 can matter (no trade is later).
- **Coverage:** releases exist from 1 Jan 2022. A trade before that date cannot be tagged, so every sample starts on
  **1 Jan 2022** (trades before it are not used at all, in either group).

## Trades

Entry time `e` and exit time `x` in UTC. Net R includes costs (one round trip each trade).

1. **ICT A-setups (one family, pooled).**
   - *HistData part, 2022-01-01 to 2025-07-31 (signal candle close).* Built with the ict-universe code exactly as
     `research/edge/ict-smile/build.mjs` (#516) did: the desk's own `signals()`, `isASetup()`, `sizeOf()`, `MIN_GRADE`
     (`ict/tracker.mjs`) and `simulate()` (`ict/replay.mjs`) on council-data `research/candles` HistData M1 (EST without
     DST, +5 h), 5m exits, the replay's busy rule, primary rule set per market: GC = XAUUSD under the gold A-rule, NQ =
     NAS100 cash and ES = SPX500 cash under the index A-rule. A new script also keeps each trade's entry price and risk (r0),
     which the flatten test needs; its R must match `research/edge/ict-smile/trades.json` for the same ids.
     Cost: ict-universe's (GC 0.50, NAS/SPX 0.02% of price + 0.25, in price, divided by r0). Net R = size x (Rraw − cost/r0).
   - *Replay part, 2025-08-01 to 2026-11-07.* council-data `ict/replay.json`, closed trades with `aset` true (NQ, ES, YM, RTY,
     GC futures). Cost: `research/edge/costs/costs.mjs` `futCost()` per market (1 tick spread + commission + 1 tick entry
     slip + 1 tick stop slip, charged on every trade). Net R = size x (Rraw − cost/r0).
   - `e` = the signal candle close (the replay's entry time, `signalAt`); `x` = `closed`.
2. **Meridian main systems** (the live systems' replay): council-data `research/replay-2w.json`, closed trades (win, loss,
   be) from 2022-01-01, excluding shadow / test records (`shadow: true`, i.e. `gmp`). Systems: `nq-open`, `replica`,
   `gtrend`, `gtrend5`, `trend` (crypto), `gtl`, `geg`. R as stored (costs included). `e` = `filled` or `opened`;
   `x` = `closed`.
3. **Meridian setups:** council-data `research/replay-90d.json` (9 Aug to 7 Nov 2026), closed trades, `@mkt` twins left
   out, net R = `R_none` − `cost` (the news-filter loader). `e` = `filled` or `opened`. These dumps carry no exit time, so
   only H1 can be tested on them.
4. **Reported only (no pass route):** `backtest.json` (30 days, same loader as 3) and the live `trades.json` (live and
   live shadow, closed).

## Hypotheses (the only ones tested)

**H1 (skip).** Trades whose entry is within **[−30, +60] minutes** of a CPI, NFP or FOMC release (−30 ≤ (e − T) / 60 ≤ +60,
both ends included, T = the nearest such release) have lower net R than the rest. The rule: do not open them.

**H2 (flatten).** Trades still open 5 minutes before a release (e ≤ T − 5 min < x) do worse held than closed at T − 5 min.
The rule: close at market at T − 5 min (the first release crossed, if more than one), no re-entry.
- Flatten price: the close of the last candle that ends at or before T − 5 min, not older than 30 minutes (else the trade
  is left out and counted).
  - ICT HistData part: the 5m candle [T − 10, T − 5) from the same 5m series the simulation used.
  - ICT replay part (futures): HistData cash/spot M1 scaled to the futures level by the ratio at entry (futures entry /
    cash close of the M1 candle ending at `e`): NQ from NSXUSD, ES from SPXUSD, GC from XAUUSD. YM and RTY have no M1
    file, and trades after the last M1 month have no data: left out of H2 and counted.
  - Meridian: XAUUSD M1 for gold, NSXUSD M1 scaled the same way for `nq-open`.
- Flatten R per unit = side x (flatten price − entry) / r0; net = size x that − the same cost the held trade paid (one
  round trip either way, so net held − net flat = gross held − gross flat). r0 = |t1 − entry| / rr when the record has
  t1 and rr, else |entry − stop|.
- Scope of H2: intraday systems only, because closing a multi-week trend trade before every release and never re-entering
  is a different system, not a risk overlay. ICT A-setups (36 H1 candles max) and the Meridian systems with a median hold
  under 24 h (`nq-open`, `replica`). Records with an add-on unit (`addOf`, or size > 1 on a Meridian record) are left out
  of the Meridian H2 and counted.
- The statistic is the paired difference d = net R held − net R flattened, one per trade.

Confirmatory tests, five in all: **H1-ICT, H2-ICT, H1-MSYS, H2-MSYS, H1-MSET** (families 1, 2 and 3 above).

## The bar to adopt (all must hold, per test, pooled over markets)

H1 (skip), on the dropped group (in the window) against the kept group (everything else in the same sample):
1. n ≥ 30 dropped trades;
2. t ≤ −2 on **both** the dropped group's own mean net R and the Welch t of (dropped − kept);
3. the dropped group's mean net R is negative in **both halves** (the group's trades sorted by entry time, split by count);
4. net effect positive after costs: the dropped trades' total net R is below 0, so skipping them adds R;
5. the dropped trades come from at least 10 different releases (guard against one release carrying the result; added here,
   stricter than the bar given in the task).

H2 (flatten), on the trades open at T − 5 min:
1. n ≥ 30 such trades;
2. paired t of d (held − flattened) ≤ −2;
3. mean d < 0 in **both halves** (sorted by entry time, split by count);
4. net effect positive after costs: the sum of (flattened − held) net R is above 0;
5. at least 10 different releases.

Five tests at t ≤ −2 (one-sided p ≈ 0.023 each) give roughly an 11% chance that at least one passes by luck. That is
accepted only because a pass leads to a paper shadow, not a live rule, and the forward record has to confirm it.

## Reported, none of it a pass route

- Every test by market and by half, with n, mean net R, win rate, t, Welch t, and gross R beside net.
- The unseen parts on their own: ICT HistData 2022-01 to 2025-07; Meridian main systems before Aug 2025.
- By release type (CPI, NFP, FOMC) and by side of the window (before the release vs after it).
- The number of releases and a cluster t (one mean per release).
- `backtest.json` 30d and live `trades.json` cells for H1.
- H2 on ICT also as a Welch t between held and flattened R (the pass uses the paired t).

## No tuning

Window, event types, flatten time, costs, samples and the bar are fixed above. No other window (±15, ±120, the whole day),
no other event set and no per-market rule is tried for a decision. If a cell looks interesting after the fact, it is written
up as a new idea for a new pre-registered test, not adopted.

## What follows

- **Pass (any test):** that rule becomes a **paper shadow only**: a new shadow variant of the ICT A-rule in
  `ict/tracker.mjs` / `ict/replay.mjs` (`shadow: true`, own stream in `shadow.json .variants` and `replay.json
  .shadowByVariant`, like `nofri`), or for Meridian a research tag that no rule reads. The live A-stream and every live
  Meridian rule stay byte-identical. The owner decides on anything live.
- **Fail (all tests):** a null result goes to `RESULT.md` and `result.json`, and no code changes.
