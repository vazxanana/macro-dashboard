# US index CFDs' Sunday-reopen gap: does it fill? Pre-registration

Written and committed **before** `run.mjs` exists and before any candle was read for a result (14 Nov 2026). Everything
below is fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. Nothing here trades, and no live rule, size, filter, stop, config, cost constant or mirror setting
changes, whatever the outcome. ICT is not involved (`ict/calendar.mjs` is read only, for the CME holiday calendar). A PASS
would lead at most to one written proposal (a paper shadow stream, for the owner); a FAIL to nothing.

## Why, and what is already known

A widely repeated idea: the Sunday-evening reopen of the US index futures / CFDs is thin, so a large gap against Friday's
close is an overreaction that partly fills before New York opens on Monday. The same idea was tested this week on other
markets, each with its own pre-registration:

- `gold-weekend-gap` (branch `gold-weekend-gap`, 13 Nov): gold's Sunday-open gap, FAIL (Rule G −0.109R a trade, n 41).
- `fx-weekend-gap` (branch `fx-weekend-gap`, 14 Nov): six forex majors, the same two rules.
- `gap-fill` (branch `gap-fill`, 13 Nov): the 16:00 → 09:30 cash-session gap on NAS100 / SPX500 (a different gap: the
  overnight one, not the weekend reopen).
- `crypto-weekend` / `crypto-weekend-reversal`: crypto, which has no weekend close.

None tests the US index CFDs' Friday 17:00 → Sunday 18:00 New York gap. This study does, with its own rule (written from the
brief, not copied from the gold / forex rules): a size filter in ATR units, a full-fill target and a fixed 1-ATR stop.
Nothing is imported from those branches.

## Data

OANDA mid M5 candles of **US500** (`spx500`), **NAS100** (`nas100`) and **US30** (`us30`) through the site's keyless candle
proxy (`/md/bars`), 1 Oct 2007 to 14 Nov 2026, complete candles only, rows `[time, open, high, low, close]` (time = candle
start, unix UTC): `node --use-env-proxy research/edge/index-weekend-gap/fetch.mjs <dir>` (files `<market>-5m.json.gz`, kept
out of git). The whole series is fetched (the ATR needs whole days and the placebo needs weekday evenings), so the weekend
windows are a subset of it.

## Calendar

- **New York time with US daylight saving** (`council/histdata.mjs` `nyOffsetH`): UTC−4 from the second Sunday of March to
  the first Sunday of November, else UTC−5.
- **CME holidays and early closes**: `ict/calendar.mjs` `cmeShut(t)` (read only). A week is **skipped** (counted
  `skipped.holiday`) when `cmeShut` is true at the start of any M5 slot from Friday 12:00 to 16:55 New York (Good Friday, a
  Friday early close, a Friday Christmas / New Year), or from Sunday 18:00 to Monday 09:25 New York (a Monday full holiday:
  Christmas or New Year on a Monday, the Sunday evening before it).

## Definitions

- **Friday close** `fc` = the close of the last M5 candle that STARTS before Friday 17:00 New York. The week is used only when
  that candle starts on that Friday (New York date) at or after 12:00 New York; otherwise skipped (`skipped.friday`).
- **Reopen candle** = the first M5 candle starting at or after Sunday 18:00 New York (stray prints before it are never
  used). The week is used only when it starts before Sunday 21:00 New York; otherwise skipped (`skipped.reopen`).
- **Gap** `g` = the reopen candle's OPEN − `fc`.
- **ATR20** = the simple mean of the true ranges of the last 20 complete CFD days (17:00 New York to 17:00 New York; Sunday
  evening candles belong to Monday's day; a day needs at least 100 M5 candles) ending with the day that closed at Friday
  17:00. Only candles before the reopen are read: known before the entry. Fewer than 21 days on file → skipped (`atr`).
- **Eligible week**: `|g| > 0.5 × ATR20`.

## The rule (one trade per eligible week per market; fixed, not tuned)

1. **Side**: against the gap. Gap up → sell; gap down → buy.
2. **Entry** = the CLOSE of the reopen candle (the first M5 bar). If that close is already at or beyond `fc` on the
   target side (the gap filled inside the first candle), no trade (counted `filled`).
3. **Target** = `fc` (full fill). **Stop** = entry ∓ 1 × ATR20 on the losing side (a sell's stop above the entry, a buy's
   below). Risk `r0` = ATR20.
4. **Exit**: the M5 candles after the entry candle, in order, up to the last candle ENDING at or before Monday 09:30 New
   York. A candle that OPENS at or beyond the stop exits at its open; a candle whose range reaches the stop exits at the
   stop; else a candle whose range reaches the target exits at the target. **The stop is checked first** when one candle
   holds both. Not out by then: exit at the close of that last candle (time exit). Missing candles are not checked. Every
   trade has its stop (absolute rule 1).
5. **R** = side × (exit − entry) / r0 (gross).

## Costs

- **Spread and slippage**: `0.0003 × entry` a round trip, the index cost of `research/edge/trend-breadth` and
  `trend-breadth-h1` (`COST.index`), also used by `index-overnight`. In R: `0.0003 × entry / r0`. **Stress**: twice that
  (`0.0006 × entry`), stated because the reopen is the widest-spread minute of the week.
- **Financing**: one night charged on every trade, as the brief asks (the hold Sunday 18:00 → Monday 09:30 crosses no
  weekday 17:00 rollover, so this is a conservative charge). Long: `(US 2Y + 2.5 %) / 365 × entry`; short:
  `max(0, 2.5 % − US 2Y) / 365 × entry`; in R divided by `r0`. US 2Y = FRED DGS2 weekly, the table copied into `rates.json`
  of this folder from `research/edge/index-overnight/rates.json` (branch `index-overnight`; itself a copy of
  `research/edge/gold-carry/rates.json`): the last value dated on or before the entry date; before its first value
  (6 Jan 2006) the first value.
- **Net R** = R − spread − financing (base); **net2** = R − 2 × spread − financing (stress).

## Windows

- **Decisive**: weeks whose Friday is in 2016-01-01 to the end of the data (2016 to now).
- **Replication**: weeks whose Friday is in 2008-01-01 to 2015-12-31.

## Tests and statistics

- **T1** US500, **T2** NAS100, **T3** US30, each its own stream; **P** = the three pooled (one stream).
- Per test and window: n, fill rate (share of trades that reached the target), win rate, mean gross R, mean spread and
  financing in R, mean net R at base and stress cost, trade t, **t on calendar-month sums** of base net R (the month of the
  Friday; months with at least one trade), the exit mix, the worst closed drawdown.
- One-sided p of each decisive month-sum t from the normal distribution. **Holm over T1-T3** at the one-sided level of
  t = 2 (α = 0.02275: the smallest p ≤ α / 3, the next ≤ α / 2, the last ≤ α). **P** is judged alone at p ≤ α (t ≥ 2).

**A test PASSES only if, on the decisive window, all hold:**

1. mean net R a trade > 0 at base cost, **and** > 0 at stress cost;
2. its month-sum t passes (Holm for T1-T3; alone for P);
3. n ≥ 30 (T1-T3) / n ≥ 60 (P);
4. its replication mean net R at base cost (2008-15) is positive.

The study PASSES if at least one of T1, T2, T3, P passes; otherwise FAIL.

## Placebo (40 seeds)

The same trade on random **weekday evenings** instead of the weekend reopen. Pool, per market and window: every Monday to
Thursday (New York) evening whose 17:00-18:00 halt is regular (not `cmeShut` outside 17:00-18:00 between 14:00 and the next
day's 09:25). For a pool evening: `ref` = the close of the last M5 candle starting before 14:00 New York; the entry candle =
the first M5 candle starting at or after 18:00 New York (before 21:00, else not in the pool); the "move" = its open − `ref`;
ATR20 = the same definition, ending with the day that closed at 17:00 that evening. Only evenings with
`|move| > 0.5 × ATR20` are in the pool (the same size filter). The trade: against the move, entry at the entry candle's
close (no trade when already at or beyond `ref`), target `ref`, stop 1 × ATR20 beyond the entry, exit as above up to the
next day's 09:30 New York, the same costs (one night). Seed s (1-40) draws, per market and window, as many pool evenings as
the real rule has trades (without replacement; with replacement if the pool is smaller), with a seeded generator
(mulberry32). Reported: per seed, the pooled decisive mean base net R; its 5th, 50th and 95th percentiles; and where P's
real decisive mean sits. If a test passes but P's decisive mean does not exceed the placebo's 95th percentile, RESULT.md says
the pass is not robust.

## Also reported (not in the bar)

- The plain fill rate of every used week (any candle from the reopen candle up to Monday 09:30 touching `fc`), by
  `|g| / ATR20` bin (under 0.25, 0.25-0.5, 0.5-1.0, over 1.0) and up / down, per window, pooled.
- Results by year; how many trades were stopped, filled, timed out.

## Files

`fetch.mjs`, `run.mjs` (`node run.mjs full <dir>` → `result.json` + `RESULT.md`), `rates.json`, `RESULT.md` (verdict
first), `result.json`, `tests/index-weekend-gap.test.mjs` (offline: DST-correct reopen, the gap reads only pre-entry
candles, stop on the losing side, target = Friday's close, holiday weekends skipped, RESULT.md against result.json).
