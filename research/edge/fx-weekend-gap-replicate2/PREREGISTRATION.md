# Forex Sunday-open gap fade, Rule G frozen: a second replication on pair-weeks neither study used. Pre-registration

Written and committed **alone, before** `frozen.mjs`, `run.mjs`, `fetch.mjs` exist and before any candle of the new data
was read (14 Nov 2026). Everything below is fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. Nothing here trades, and no live rule, size, filter, stop, config, cost constant or mirror setting
changes, whatever the outcome. Even "REPLICATES" leads at most to one written proposal for the owner (a paper shadow
stream); anything else leads to nothing.

## What this is

- `research/edge/fx-weekend-gap` (#880, branch `fx-weekend-gap`): Rule G (fade the Sunday reopen gap at the reopen candle's
  close, target Friday's close, 1R stop, out Monday 12:00 New York) on six majors (EUR/USD, GBP/USD, USD/JPY, AUD/USD,
  USD/CHF, EUR/JPY): +0.194R a trade 2020 to now (n 243, monthly t 2.14), +0.034R 2016-19. FAIL on its bar.
- `research/edge/fx-weekend-gap-replicate` (#928, branch `fx-weekend-gap-replicate`): Rule G frozen. R1, six crosses
  (EUR/GBP, GBP/JPY, AUD/JPY, EUR/AUD, GBP/AUD, EUR/CHF) 2020 to now: +0.238R (n 294, monthly t 2.99), but 228 of its
  weekends are #880's and 2026 carries much of it. R2, #880's majors 2010-15: +0.003R (n 297, t 0.03). PARTLY.

Neither tested the same rule on pair-weeks that no study has traded **in both cases at once**. This study does, twice:

- **S1**: #928's six crosses over weeks with Friday `F` from 2010-01-01 to 2019-12-31 (#928 read these crosses only from
  1 Nov 2019, the Nov-Dec 2019 candles only as ATR warm-up; no week of a cross before 2020 was traded by anyone).
- **S2**: six pairs used by **neither** study, weeks with `F` from 2016-01-01 to the end of the data.

**Calendar overlap, said before any result**: these are new pair-weeks, not new weekends. S1's 2016-19 weekends are the
weekends of #880's replication window (on majors), and S1's 2010-15 weekends those of #928's R2 (on majors); S2's
weekends are those of #880 (2016 to now, majors) and #928's R1 (2020 to now, crosses). The number of S1 / S2 trades that
fall on a weekend on which #880 or #928 also took a Rule G trade is reported for each test (not in the reading). Only
S1 2010-15 is outside both studies' decisive windows AND their crosses; no S1 weekend is in either decisive window
(2020 to now).

## S2 pairs (chosen from the OANDA keys of `api/_oanda.js` before any price was read)

Unused by both studies among the keys: NZD/USD, USD/CAD, EUR/CAD, EUR/NZD, GBP/CHF, GBP/CAD, GBP/NZD, AUD/NZD, AUD/CAD,
AUD/CHF, NZD/JPY, NZD/CAD, NZD/CHF, CAD/JPY, CAD/CHF, CHF/JPY. **Fixed: NZD/USD, USD/CAD, CAD/JPY, NZD/JPY, AUD/NZD,
AUD/CAD.** Why: the two dollar majors neither study traded come first (the most liquid, the market set closest to #880's);
then four crosses of the two currencies (CAD, NZD) that neither study traded at all, paired with currencies the studies did
trade (JPY, AUD), so the set adds currencies rather than re-weighting EUR and GBP (#928's crosses were EUR/GBP-heavy).
No EUR or GBP cross, and no CHF cross, is in S2. Pip 0.01 for the JPY pairs, 0.0001 otherwise (frozen `pipOf`).

## The frozen code (copied, as #928)

- `frozen.mjs` = #928's `research/edge/fx-weekend-gap-replicate/frozen.mjs` **byte for byte**, which is #880's
  `research/edge/fx-weekend-gap/run.mjs` byte for byte: sha256
  `3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273`, pinned by the test. Read with `git show`, never
  imported across branches, nothing edited. Rule H is not tested.
- `run.mjs` copies #928's window-selection approach: weeks from the frozen `weeks()`, eligibility
  `K.GAP_MIN ≤ gapAtr ≤ K.GAP_MAX`, a week in the window when its `F` is in `[from, to)`, trades by the frozen `ruleG()`,
  the per-pair quoted spread set through the frozen parameter `K.SPREAD_PIPS` only while that pair's trades are booked
  (`withSpread`), statistics by the frozen `stats`, `tOf`, `normP`, `mulberry`, `book`.
- **Gate (before any S1 / S2 figure is read):** the frozen `study()` run on #880's own data (OANDA mid M5 of its six
  majors, 1 Nov 2015 to 12 Nov 2026, fetched again through the same proxy and filtered at `K.DATA_FROM`) reproduces #880's
  published Rule G exactly: the 2020-to-now and 2016-19 statistics objects and the full trade list equal #880's
  `result.json`; and `run.mjs`'s own window path on those files over 2020 to now gives the same statistics. If the gate
  fails, the study stops and RESULT.md says so; no S1 / S2 figure is reported.

## Data

OANDA mid M5 through the site's keyless candle proxy (`/md/bars`, the answer must say OANDA; `fetch.mjs`, #928's), complete
candles only, rows `[time, open, high, low, close]`, kept outside git (scratchpad). File hashes go into `result.json`.

- S1: the six crosses from 1 Nov 2009 (ATR warm-up) to 11 Jan 2020.
- S2: the six pairs from 1 Nov 2015 (ATR warm-up) to 14 Nov 2026 (weeks are the frozen `weeks()`'s: a week needs its
  Monday 12:00 New York in the data).
- Gate: #880's six majors from 1 Nov 2015 to 13 Nov 2026 00:00 UTC.

## Costs (#880's formula, per pair, fixed here)

Round trip in price = pip x (quoted spread + 2 x slippage) + 2 x 22.5 per million x entry (frozen `costPx`). Base
slippage 1 pip a side, stress 2 pips a side (frozen). Financing none (as #880; `nights` reported).

| Pair | Quoted spread (pips) | Source |
|---|---|---|
| EUR/GBP | 0.4 | #928's table (same pair) |
| EUR/CHF | 0.5 | #928's table |
| AUD/JPY | 0.6 | #928's table |
| GBP/JPY | 0.9 | #928's table |
| EUR/AUD | 0.9 | #928's table |
| GBP/AUD | 1.3 | #928's table |
| USD/CAD | 0.3 | #880's majors (USD/CAD is in the demo broker's measured symbol file with the majors) |
| NZD/USD | 0.4 | assumed (not measured in the repository; a less liquid dollar major) |
| AUD/CAD | 0.8 | assumed |
| CAD/JPY | 0.8 | assumed |
| AUD/NZD | 1.0 | assumed |
| NZD/JPY | 1.0 | assumed |

Also reported, not in the reading: every pair at #880's flat 0.3 pip, and the 2x cost (every trade's base cost doubled).

## Statistics

Per test: n, win rate, mean gross R, mean net R at base, stress and 2x cost, trade t, **t on calendar-month sums of base net
R** (frozen `stats`), total, worst closed drawdown, exits, per pair, per year. One-sided p of each test's monthly-sum t (frozen
`normP`). **Holm over S1 and S2** (adjusted p: smaller p x 2, the larger max(that, its own p)).

## Pre-registered reading

A test **holds** when all four: mean net R a trade > 0 at base cost; monthly-sum t ≥ 2; Holm-adjusted p < 0.05; n ≥ 150.

- **"REPLICATES"**: S1 and S2 both hold.
- **"PARTLY"**: exactly one holds.
- **"DOES NOT REPLICATE"**: neither holds.

## Also reported (not in the reading)

- Weekend overlap: per test, how many trades (and distinct Fridays) fall on a Friday on which #880 took a Rule G trade, on
  which #928 took one, and on either; their net R against the rest.
- Per-year table (n, net R a trade, total) and **the best year's share** of each test's total (best year total / test total,
  when the total is positive), and the test without its best year.
- **Placebo**: 40 seeded runs (seeds 1-40, frozen `mulberry`) per test on its own Rule G trades, each direction drawn at
  random (target `entry + side x r0`, stop `entry − side x r0`, frozen `book`, same costs): 5th / 50th / 95th percentile and
  how many runs did as well as Rule G. If a test holds but its mean does not exceed its placebo 95th percentile, RESULT.md
  says that result is not robust.
- S1 + S2 pooled (outside the Holm family). Weeks used / skipped per pair, Rule G's no-trade counts.

## Files

`frozen.mjs` (byte copy, pinned), `fetch.mjs` (`node --use-env-proxy fetch.mjs <dir>`), `run.mjs`
(`CANDLES=<dir> GATE=<dir> GATE_RESULT=<#880 result.json> R880=<#880 result.json> R928=<#928 result.json> node run.mjs run`
→ `result.json`), `RESULT.md` (verdict line first), `result.json`, `tests/fx-weekend-gap-replicate2.test.mjs` (offline: the
frozen hash, the window selection, the per-pair cost, Holm, the reading, RESULT.md against result.json).
