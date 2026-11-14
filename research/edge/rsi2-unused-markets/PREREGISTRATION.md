# Pre-registration: the 2-day RSI pullback, frozen, on the OANDA index CFDs no earlier study used (14 Nov 2026)

Written and committed before any return, trade or R figure of the markets below was computed. Paper research: nothing here
is read by the council, the mirror or the page, and no live rule changes whatever the verdict. Not an ICT study.

## Why
`research/edge/rsi2-pullback` (branch `rsi2-pullback`, PR #838) tested the 2-day RSI pullback on SPX500, NAS100 and US30 and
FAILED narrowly (SPX500 +0.112R a trade net, month t 1.83; US30 +0.087R, month t 2.28; Holm p 0.065 each). Its frozen
replication on six non-US indices (`rsi2-replicate`: DE40, UK100, JP225, AU200, EU50, FR40) FAILED (+0.027R a trade, month
t 0.85). The early-years check (`rsi2-early-years`) was NOT MEASURABLE (OANDA's history starts 2003). `metals-rsi2` tested
gold and silver (another asset class: left out here). The one clean check left is the same frozen rule on the OANDA index
CFDs that neither #838 nor `rsi2-replicate` read.

## Markets already used (read from the branches, 14 Nov 2026)
- #838 (`rsi2-pullback`, commit 4e1b4e1dd): `spx500`, `nas100`, `us30`.
- `rsi2-replicate`: `de40`, `uk100`, `jp225`, `au200`, `eu50`, `fr40`.
- `rsi2-early-years`: `spx500`, `nas100`, `us30` (gate only).

## The unused set (fixed now, from candle dates only; no price change was read)
The index keys of the OANDA symbol map (CLAUDE.md) not in the lists above: `us2000`, `ch20`, `nl25`, `es35`, `hk33`, `cn50`,
`sg30`, `in50`. Source: council-data `research/daily/<key>.json` (`git show origin/council-data:…`, no network; `_index.json`
status `ok` for all eight, updated 2026-11-07).

**Qualification rule** (for the decisive window B, 2016-01-01 to the end of the data): (a) the frozen rule's first possible
signal day (the 201st weekday candle, where `simulate()` starts its loop) is on or before 2016-01-04, (b) the last candle is
within 14 days of the cache's newest (2026-11-06), (c) no hole between weekday candles over 14 calendar days inside window B.

| key | instrument | first candle | first signal day | last candle | qualifies |
|---|---|---|---|---|---|
| `us2000` | US2000_USD | 2003-03-24 | 2004-01-05 | 2026-11-06 | yes |
| `ch20` | CH20_CHF | 2003-03-24 | 2004-01-13 | 2026-11-06 | yes |
| `nl25` | NL25_EUR | 2008-01-21 | 2008-10-31 | 2026-11-06 | yes |
| `hk33` | HK33_HKD | 2003-02-04 | 2003-11-21 | 2026-11-06 | yes |
| `cn50` | CN50_USD | 2011-08-30 | 2012-06-29 | 2026-11-06 | yes |
| `sg30` | SG30_SGD | 2004-01-21 | 2004-11-04 | 2026-11-06 | yes |
| `es35` | ESPIX_EUR | 2016-12-02 | 2017-09-14 | 2026-11-06 | **no** (a: starts 21 months into window B; also a 21-day hole Oct-Nov 2021) |
| `in50` | IN50_USD | 2011-08-26 | 2012-06-22 | 2022-07-12 | **no** (b: the series ends July 2022) |

Six markets qualify (at least 3 are needed; fewer would have stopped the study as NOT MEASURABLE). In window B the
qualifying markets have only holiday closures (5-10 days: Easter, Christmas, Lunar New Year, Golden Week). Window A is
partial for two markets (nl25 signals from 2008-10-31, cn50 from 2012-06-29) and is reported only.
Note: `us2000` is a US index and will move with the three #838 markets; it is still a market neither study read.

## The rule: byte for byte the original
`frozen.mjs` = `research/edge/rsi2-pullback/run.mjs` of `origin/rsi2-pullback` (commit 4e1b4e1dd), copied byte for byte;
sha256 `edade889f2825fa71d911e039bfe5b9fdaaf5677e7b2fd55742e742830d5ab65` (the same as `rsi2-early-years/frozen.mjs`),
pinned in `tests/rsi2-unused-markets.test.mjs`, never edited; `run.mjs` imports `candles`, `sma`, `atr`, `simulate`, `net`,
`summary`, `tstat`, `monthSums`, `rng`, `placebo`, `pct`, `holm`, `study`, `P` from it. The rule therefore stays: close(i) >
SMA200(i) and Wilder RSI(2)(i) < 10 -> buy at day i+1's open; stop entry - 3 x ATR(20) at the signal close, checked from the
entry day (a gap below fills at the open); exit at the open after the first close above SMA5 (the stop wins on its day); one
position per market; weekend candles dropped; a trade open at the end is closed at the last close. No parameter changes.
The placebo is read in R through `placeboTrades`, a step-for-step copy of the frozen `placebo()` that returns its trades
(as `rsi2-replicate` did; the test checks its mean % equals the frozen `placebo()` for the same seed).

## Costs (the frozen cost model)
- **Financing**: the frozen `net` unchanged: (DGS2 + 2.5 %) / 365 x entry price per calendar night, DGS2 from council-data
  `macro/cache.json` (`score.fred.DGS2`), exactly as #838. For the CHF / EUR / HKD / SGD markets the local benchmark would
  differ (SNB and ECB lower than DGS2 for most of 2016-22: DGS2 overcharges them; HKD follows the US rate). Stated as an
  assumption; a sensitivity with the benchmark at 0 (financing 2.5 % a year only) is reported, not decisive.
- **Round trip in index points** (the frozen code has no figure for these markets; assumptions, about two quoted spreads as
  #838 used, written now from typical OANDA quotes against each index's level, not measured on a broker except `us2000`):

| key | round trip (points) | basis |
|---|---|---|
| `us2000` | 0.6 | 2 x the demo broker's measured median US2000 spread 0.3 (council-data `ctrader/symbols.json` `spreadTypical`, 12-13 Nov 2026, n 110) |
| `ch20` | 5.0 | assumed, about 0.034 % at 14,750 |
| `nl25` | 0.4 | assumed, about 0.036 % at 1,115 |
| `hk33` | 16.0 | assumed, about 0.065 % at 24,600 |
| `cn50` | 12.0 | assumed, about 0.093 % at 12,850 |
| `sg30` | 0.6 | assumed, about 0.13 % at 470 |

Fixed points on every trade, as the original (so earlier, lower index levels pay relatively more, as in #838).
The 0x / 1x / 2x cost rows scale these points; financing is kept in all three.

## Windows (by entry day)
- A: 2008-01-01 to 2015-12-31 (replication, reported).
- **B: 2016-01-01 to the end of the data (decisive).**

## Primary test (one test, window B): rsi2-replicate's bar, verbatim
From `rsi2-replicate/PREREGISTRATION.md` ("Pass (one test, window B)"), with its six markets replaced by the six above:

> The pooled six-market book, equal risk per trade (every trade weighs 1 R = its own 3 x ATR(20) risk, so markets with
> different point values and currencies add up):
> 1. Pooled net R a trade > 0.
> 2. t >= 2 on calendar-month sums of pooled net R (every month from January 2016 to the last data month counts, 0 where nothing
>    closed; a trade's month is its exit month).
> 3. At least 4 of the 6 markets have net R a trade > 0 in window B.
> 4. Placebo, 40 seeds (1..40): for each seed, every real window-B trade of each market is replaced by the original study's placebo
>    trade (random entry day with close > SMA200, same hold, same stop, same costs; the original `placebo` procedure, returning the
>    trades so they can be read in R). The pooled real net R a trade must exceed the 95th percentile of the 40 seeds' pooled means.
>
> **Verdict**: PASS only if all four hold; FAIL otherwise. It is a single pooled test, so no Holm correction is applied.

Here PASS reads **REPLICATES** and FAIL reads **DOES NOT REPLICATE**. NOT MEASURABLE only if the gate data is missing or fewer
than 3 markets qualify (not the case by the table above).

## Gate (before the test)
The frozen `study()` on today's council-data `spx500` / `nas100` / `us30` and DGS2 must reproduce #838's published figures
exactly (per market and window A / B: n, % a trade net, R a trade, total R, t on trades, t on month sums; window B: placebo
p95, one-sided p, Holm p; verdict FAIL), the same check `rsi2-early-years` ran. A gate failure is reported; the test still runs.

## Secondary (reported, never the verdict)
- Per market, window B: n, % and R a trade net, won, t trades, t months (R), one-sided p (normal, from t on trades of net %,
  the frozen convention) and Holm-adjusted p over the six; each at 0x / 1x / 2x cost; worst drawdown in R.
- Pooled book at 0x / 1x / 2x cost, both windows; window A also per market; pooled worst drawdown.
- Financing sensitivity (benchmark 0, 2.5 % a year only), window B.
- Same-day entries across markets (how much of the pooled n is shared days).

## Placebo
40 seeded runs (seeds 1..40), same markets, same holds, same stops, same costs, random eligible entry day (close > SMA200), as
the primary test's check 4 (the frozen procedure).

## Not changed after seeing results
Markets, the qualification rule, rule, costs, windows, pooling, placebo and the bar are fixed by this file. Anything looked at
afterwards is labelled as such and is not evidence. Nothing is called an edge without n and t; a REPLICATES would lead to a
paper-shadow proposal only (the owner decides), never a live change.
