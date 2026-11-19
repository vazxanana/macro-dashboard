# Forex Sunday-open gap fade, Rule G frozen: a replication on data the first study did not use. Pre-registration

Written and committed **before** `frozen.mjs`, `run.mjs` and any candle of the new data were read for a result
(14 Nov 2026). Everything below is fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. Nothing here trades, and no live rule, size, filter, stop, config, cost constant or mirror setting
changes, whatever the outcome. Even "REPLICATES" leads at most to one written proposal for the owner (a paper shadow
stream); anything else leads to nothing.

## What this is

`research/edge/fx-weekend-gap` (branch `fx-weekend-gap`, #880, not on main; 14 Nov 2026) tested two rules on six forex
majors and failed its bar. Its Rule G (fade the Sunday reopen gap at the reopen candle's close, target Friday's close, 1R
stop, out Monday 12:00 New York) made +0.194R a trade after costs on 2020 to now (n 243, t 2.14 on calendar-month sums),
missing Holm over its two rules (needed about 2.28). Its own report says two thirds of that came from 2026 and that 2016-19
was about zero, and names the next test: "other pairs, or 2010-15". This is that test, with Rule G frozen.

## The frozen code

- `frozen.mjs` = #880's `research/edge/fx-weekend-gap/run.mjs`, **the whole file, byte for byte** (read with
  `git show origin/fx-weekend-gap:research/edge/fx-weekend-gap/run.mjs`, never imported across branches). Its sha256 is
  `3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273`; the test pins it. Nothing in it is edited: the week
  and gap detection (`weeks`, `nyDays`, `atrAt`), Rule G (`ruleG`), the trade (`book`, `simTrade`), the costs
  (`costPx`), the statistics (`stats`, `tOf`, `normP`, `holm`, `mulberry`) are used as they are. Rule H is not tested.
- `run.mjs` only loads candles, chooses the weeks of each window, sets the one cost parameter per pair (below), pools,
  and reports. Its window filter replaces #880's hard-coded 2016-19 / 2020-on windows (its `pairStudy` / `study` only
  look at weeks from 2016): weeks are produced by the frozen `weeks()`, eligibility is #880's
  `K.GAP_MIN ≤ gapAtr ≤ K.GAP_MAX`, and trades by the frozen `ruleG()`.
- **Gate (must hold before any replication figure is read):** the frozen `study()` run on #880's own candle files
  (OANDA mid M5 of its six majors, 1 Nov 2015 to 12 Nov 2026, filtered at `K.DATA_FROM` as its run mode does) reproduces
  #880's published Rule G exactly: n, mean gross / base net / stress net R, trade t and monthly t for 2020 to now
  (243, +0.292, +0.194, +0.123, 3.42, 2.14) and 2016-19 (173, +0.147, +0.034, −0.047, 0.49, 0.39), and the same trade
  list. Also: `run.mjs`'s own window path, run on those files over 2020 to now, gives the same Rule G trades. If the gate
  fails, the study stops and RESULT.md says so; no replication figure is reported.

## Data (none of it used by #880)

OANDA mid M5, the same feed and timeframe as #880, read through the site's keyless candle proxy (`/md/bars`, the source
must say OANDA; `fetch.mjs` in this folder), kept outside git. Rows `[time, open, high, low, close]`.

- **#880 used**: EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CHF, EUR/JPY, candles from 1 Nov 2015 to 12 Nov 2026; its traded
  weeks were those whose Friday `F` is in 2016-01-01 to 2026-11-12 (replication 2016-2019, decisive 2020 to now). The
  candles of Nov-Dec 2015 were read only to warm up the ATR; no week before 2016 was traded or reported.
- **R1, six crosses, 2020 to now** (the years of #880's decisive window: weeks with `F` from 2020-01-01 to the end of the
  data, 12 Nov 2026 as in #880): **EUR/GBP, GBP/JPY, AUD/JPY, EUR/AUD, GBP/AUD, EUR/CHF**. Candles from 1 Nov 2019 (ATR
  warm-up). **One deviation from the request, fixed here before any data:** the request listed EUR/JPY, but EUR/JPY on
  2020 to now is #880's own data (it was one of #880's six pairs), so it cannot replicate anything. It is replaced by
  EUR/CHF, chosen as the remaining cross with the narrowest typical quote (no result was looked at).
- **R2, #880's six majors, 2010 to 2015** (weeks with `F` from 2010-01-01 to 2015-12-31: six years #880 never traded).
  Candles from 1 Nov 2009 (ATR warm-up) to 10 Jan 2016 (the Monday after the last Friday).
- **R3** = the trades of R1 and R2 pooled.

## Costs (#880's model, per pair)

#880's cost, unchanged in form (`frozen.mjs` `costPx`): a round trip in price = pip x (quoted spread + 2 x slippage) +
2 x 22.5 per million x entry. Base slippage 1 pip a side, stress 2 pips a side (`K.SLIP_PIPS`, `K.SLIP2_PIPS`, frozen).
Pip 0.01 for the JPY pairs, 0.0001 otherwise (`pipOf`, frozen). Financing none (as #880; `nights` is computed and reported).

- **Commission**: 22.5 USD per million a side, the demo broker's forex rate (council-data `ctrader/symbols.json`
  `commissionRT` 0.000045 on every forex symbol it lists); the same fraction of price for every pair.
- **Quoted spread** (the raw-spread model of CLAUDE.md "Forex spreads"): for the majors #880's 0.3 pip, unchanged. The
  repository has no measured quote for any cross (`symbols.json` lists no cross), so the crosses' quoted spreads are
  **stated assumptions**, wider than the majors, at a raw-spread account's typical outside-rollover quotes:

  | Pair | Quoted spread (pips) | Base round trip, pips + commission | Stress round trip |
  |---|---|---|---|
  | EUR/GBP | 0.4 | 2.4 + 45e-6 x entry | 4.4 + 45e-6 x entry |
  | EUR/CHF | 0.5 | 2.5 + … | 4.5 + … |
  | AUD/JPY | 0.6 | 2.6 + … | 4.6 + … |
  | GBP/JPY | 0.9 | 2.9 + … | 4.9 + … |
  | EUR/AUD | 0.9 | 2.9 + … | 4.9 + … |
  | GBP/AUD | 1.3 | 3.3 + … | 5.3 + … |
  | the six majors (R2) | 0.3 | 2.3 + … | 4.3 + … |

  The only way `run.mjs` applies them is by setting the frozen parameter `K.SPREAD_PIPS` to the pair's figure while that
  pair's trades are booked (and back to 0.3 after); the formula is the frozen one.
- **2x-cost check**: every trade's base cost doubled (`R − 2 x cost / r0`), reported for R1, R2, R3 (not in the reading).

## Statistics

Per test: n, win rate, mean gross R, mean net R at base cost, at stress cost and at 2x cost, trade t, **t on
calendar-month sums of base net R** (the month of `F`, all pairs' trades in a month summed; the frozen `stats`), total,
worst closed drawdown, exit mix, per pair and per year (not in the reading). One-sided p of each test's monthly-sum t from
the normal distribution (the frozen `normP`), as #880. **Holm over R1 and R2**: with p(1) ≤ p(2), adjusted
p(1)' = min(1, 2 p(1)), p(2)' = max(p(1)', p(2)). R3 gets its own t and p, outside the Holm family.

## Pre-registered reading

- **"REPLICATES"**: R1 and R2 both have mean net R > 0 at base cost and Holm-adjusted p < 0.05.
- **"PARTLY"**: otherwise, if either R1 or R2 has mean net R > 0 at base cost with monthly-sum t ≥ 1.
- **"DOES NOT REPLICATE"**: otherwise.

## Also reported (not in the reading)

- **Placebo**: 40 seeded runs (seeds 1-40, the frozen `mulberry`) on each test's own Rule G trades (same entry, `r0`, exit
  window, costs), each trade's direction drawn at random (target `entry + side x r0`, stop `entry − side x r0`), booked by
  the frozen `book`. Reported: the placebo's 5th / 50th / 95th percentile of mean base net R for R1, R2, R3 and how many
  runs did as well as Rule G. If the reading is REPLICATES or PARTLY and the test's mean does not exceed its placebo 95th
  percentile, RESULT.md says the result is not robust.
- The same trades at #880's flat 0.3-pip spread for the crosses (a sensitivity of the stated assumption).
- Weeks used / skipped per pair; Rule G's no-trade counts.

## Files

`frozen.mjs` (byte copy, pinned), `fetch.mjs` (`node --use-env-proxy fetch.mjs <dir>`), `run.mjs`
(`CANDLES=<dir> GATE=<dir of #880's files> node run.mjs run` → `result.json`), `RESULT.md` (Verdict line first, in the
reading's words), `result.json`, `tests/fx-weekend-gap-replicate.test.mjs` (offline: the frozen file's hash, the window
filter, the per-pair cost, Holm, the reading, RESULT.md against result.json).
