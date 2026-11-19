# Forex Sunday-gap fade entered later, after the reopen spread settles. Pre-registration

Written and committed **alone, before** `frozen.mjs`, `run.mjs` and `fetch.mjs` exist and before any late-entry trade was
computed (14 Nov 2026). Everything below is fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. Nothing here trades, and no live rule, size, filter, stop, config, cost constant or mirror setting
changes, whatever the outcome. A PASS leads at most to one written proposal for the owner (a paper shadow stream); a FAIL
to nothing. Never called an edge without n and t.

## Why

Rule G of `research/edge/fx-weekend-gap` (#880, branch `fx-weekend-gap`) fades the Sunday reopen gap at the close of the
first OANDA mid M5 candle at or after Sunday 17:00 New York (17:05 New York), target Friday's close, 1R stop, out Monday
12:00 New York. Frozen and replicated (#928 `fx-weekend-gap-replicate`, #938 `fx-weekend-gap-replicate2`) it held on new
pairs from 2016 / 2020 (monthly t about 3) but not out of time, and it is cost-fragile. `weekend-reopen-cost` (#944) found the
real reopen spread not measurable from our sources; its one Sunday (8 Nov 2026) read USD/CHF 14.5 pips and USD/CAD 4.6 pips
at the first read after the reopen, and 0-0.6 pip on every pair it reads from about an hour later. Question: does the fade
still pay when entered later, once the reopen spread has normally settled?

## The frozen code

- `frozen.mjs` = #880's `research/edge/fx-weekend-gap/run.mjs` **byte for byte** (`git show
  origin/fx-weekend-gap:research/edge/fx-weekend-gap/run.mjs`), sha256
  `3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273` (the file #928, #938 and #944 also copied), pinned by
  the test. Never edited, never imported across branches.
- `run.mjs` imports it. Used as they are: `weeks` (Friday's close, the reopen, the gap, the ATR), the eligibility band
  `K.GAP_MIN ≤ |gap| / ATR ≤ K.GAP_MAX`, `ruleG` (side, target, stop, its own no-trade cases), `simTrade` (the exit: stop
  checked first, a gapped stop at the open, target, else the close of the last candle ending by Monday 12:00 New York),
  `costPx` (the round-trip cost formula), `tOf`, `normP`, `mulberry`, `lowerT`, `stats` (for the gate).
- The frozen file cannot take an entry time (`ruleG` enters at the reopen candle's close, hard-coded), so `run.mjs` adds the
  smallest wrapper: it takes the trade `ruleG` returns and only moves its entry later (below). At a delay of 0 the wrapper
  is, by construction, `ruleG`'s own trade (a gate checks it trade by trade).

## The late entry (the one thing changed)

For each eligible week on which the frozen `ruleG` returns a trade (its skips stay: no trade when the reopen candle already
closed through Friday's close, or its risk is under 0.1 x ATR), with `iR` = the reopen candle, side `s`, target `fc`
(Friday's close) and stop `S` = **Rule G's own stop level** (its 17:05 entry minus `s` x its 17:05 risk), unchanged:

- **Entry candle** = the first M5 candle starting at or after `start(iR) + delay`. Entry = its close. With the reopen candle
  at 17:00 New York, delay 60 min enters at the 18:00 candle's close, **18:05 New York**.
- **No trade** (counted) when, on the candles after the reopen candle up to and including the entry candle:
  - the target was touched (`filled`: a buy's high ≥ `fc`, a sell's low ≤ `fc`): the gap has closed;
  - the stop was touched (`stopped`: a buy's low ≤ `S`, a sell's high ≥ `S`); when one candle holds both, `stopped`
    (the frozen stop-first order); otherwise the first in time;
  - the entry candle ends after Monday 12:00 New York, or the data ends (`late`);
  - the new risk `|entry − S|` is under 0.1 x ATR (`small`, the frozen floor applied to the new risk).
- **Trade**: side, target `fc` and stop `S` as frozen; risk `r = |entry − S|` (so the reward : risk is no longer 1 : 1 and
  is reported); exit by the frozen `simTrade` from the entry candle, out by Monday 12:00 New York.
  `R = s x (exit − entry) / r`. Every trade has its stop.

## Pairs, windows, data

- **Pairs (18)** = the union of the pairs of the three studies' headline tests: #880's six (EUR/USD, GBP/USD, USD/JPY,
  AUD/USD, USD/CHF, EUR/JPY), #928's six crosses (EUR/GBP, GBP/JPY, AUD/JPY, EUR/AUD, GBP/AUD, EUR/CHF) and #938's six
  (NZD/USD, USD/CAD, CAD/JPY, NZD/JPY, AUD/NZD, AUD/CAD). Pooled into one stream; per pair and per group reported, not in
  the bar.
- **Decisive window**: weeks whose Friday `F` is from 2016-01-01 to the end of the data. **Replication window**: `F` from
  2010-01-01 to 2015-12-31.
- **Data**: OANDA mid M5 through the site's keyless candle proxy (`/md/bars`, answer must say OANDA), rows
  `[t, o, h, l, c]`, kept outside git, file hashes in `result.json`. Already on disk from #928 / #938 (same proxy, same
  `fetch.mjs`): #880's majors 1 Nov 2009 - 10 Jan 2016 (#928 R2) and 1 Nov 2015 - 12 Nov 2026 (#938 GATE); the crosses
  1 Nov 2009 - 10 Jan 2020 (#938 S1) and 1 Nov 2019 - 12 Nov 2026 (#928 R1); #938's six 1 Nov 2015 - 13 Nov 2026 (#938 S2).
  Fetched here with #938's `fetch.mjs` (sets changed only): #938's six from 1 Nov 2009 to 11 Jan 2016. **Joining**: per
  pair, the later file is used from its first candle on, the earlier file before it; candles where both files exist are
  compared and the number that differ is reported. Every series is cut at 13 Nov 2026 00:00 UTC (the end of #880's data),
  so the last week is Friday 6 Nov 2026. If any data cannot be fetched, the study stops and says so.

## Costs

`net R = R − cost / r`, cost a round trip in price:

- **The frozen model, per pair**: `costPx` = pip x (quoted spread + 2 x 1 pip slippage) + 2 x 22.5 per million x entry, with
  the quoted spread of the studies' own tables, set through the frozen parameter `K.SPREAD_PIPS` only while that pair's
  trade is costed: 0.3 pip for #880's six and USD/CAD; NZD/USD 0.4, EUR/GBP 0.4, EUR/CHF 0.5, AUD/JPY 0.6, GBP/JPY 0.9,
  EUR/AUD 0.9, GBP/AUD 1.3, AUD/CAD 0.8, CAD/JPY 0.8, AUD/NZD 1.0, NZD/JPY 1.0.
- **Plus an entry spread** (stated as assumed: the settled reads of 8 Nov 2026, one Sunday): **0.6 pip** on the seven pairs
  with the US dollar (EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CHF, USD/CAD, NZD/USD), **1.0 pip** on the eleven others
  (EUR/JPY counts as a cross here).
- **Base** = the two together. **0 cost** = gross R. **2x** = twice the base cost. No financing (a Sunday-to-Monday-noon hold
  crosses no weekday 22:00 UTC rollover; `council/fills.mjs` `nights` via the frozen code is reported).

## Gate (must pass before any late-entry figure is read)

1. The frozen `study()` on #880's own candle files (the #938 GATE files, filtered at `K.DATA_FROM` as #880's run mode does)
   reproduces #880's published Rule G exactly: the 2020-to-now and 2016-19 statistics objects (n 243, gross +0.292, net
   +0.194, monthly t 2.14; n 173, +0.147, +0.034, 0.39) and the trade list equal #880's `result.json`.
2. On the joined files, the wrapper at delay 0 with no entry spread gives, on #880's six pairs, #880's same two statistics
   objects (net at #880's flat 0.3 pip), and its trades equal the frozen `ruleG` trades one by one (side, entry, risk, exit,
   R) on all 18 pairs and both windows.
3. On the joined files, delay 0 with no entry spread reproduces the published n, net R and monthly t (to the published
   four decimals) of #928 R1 and R2 and #938 S1 and S2 at their own spreads.

No gate, no result: RESULT.md then says so and reports nothing else.

## The tests

- **Primary (one)**: delay **60 min** (entry 18:05 New York).
- **Secondary (reported)**: delay **30 min** (17:35) and **120 min** (19:05).
- **Reference (not a test)**: delay 0 (Rule G as frozen) on the same 18 pairs and windows, at base cost (entry spread included)
  and without the entry spread.

For each test and window, at 0 / base / 2x cost: n, win rate, mean R, trade t, t on calendar-month sums (month of `F`, all
pairs' trades of a month summed), total, worst closed drawdown (cumulative R, trades in fill order); plus the exit mix, the
no-trade counts, median risk in pips, median base cost in R, mean reward : risk, per group (#880 / #928 / #938 pairs), per
pair, per year.

One-sided p of each test's decisive monthly t at base cost (frozen `normP`); **Holm over the three tests** (adjusted p:
step-down, monotone), reported for all three.

## Pass bar (primary only)

**PASS** when all four hold, else **FAIL**:

1. mean net R a trade at base cost > 0 on 2016 to now;
2. mean net R a trade at base cost > 0 on 2010-15;
3. monthly-sum t at base cost ≥ 2 on 2016 to now;
4. mean net R a trade at 2x cost > 0 on 2016 to now.

The secondaries are read only through their Holm-adjusted p (reported, not a verdict). If the primary passes but its
Holm-adjusted p is 0.05 or more, or its decisive mean does not exceed its placebo's 95th percentile, RESULT.md says the pass
is not robust.

## Placebo (what the delay alone does)

Per delay (30, 60, 120 min), 40 seeded runs (seeds 1-40, frozen `mulberry`): for each of the test's trades, in pair and fill
order, one week is drawn (with replacement, `floor(rnd() x n)`) from the same pair's **non-gap weeks** of the same window
(weeks the frozen `weeks()` uses with `|gap| < 0.25 x ATR`), then a side (`rnd() < 0.5` → sell, else buy). Entry at the close
of the first M5 candle at or after that week's reopen candle start + the delay; stop and target at the trade's own stop and
target distances in ATR units times that week's ATR; exit by the frozen `simTrade` by Monday 12:00 New York; the same pair's
base cost. Reported per delay and window: the placebo distribution of mean base net R (min, 5th, median, 95th percentile,
max) and how many runs did as well as the test.

## Files

`frozen.mjs` (byte copy, pinned), `fetch.mjs` (`node --use-env-proxy fetch.mjs <dir>`), `run.mjs`
(`CANDLES=<dir> GATE=<dir> R880=… R928=… R938=… node run.mjs run` → `result.json`), `RESULT.md` (verdict first),
`result.json`, `tests/weekend-gap-late-entry.test.mjs` (offline: the frozen hash, the late-entry wrapper on hand-made candles
including the filled / stopped / small cases, delay 0 = `ruleG`, costs, Holm, the bar, RESULT.md against result.json).
