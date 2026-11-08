# Gold daily systems: weekend handling, current rule against the intended rule

## Question

The live gold daily systems treat the weekend differently from what was intended. The intended rule has three parts:

- act on each real trading day's close;
- a Friday-close breakout buys at the Sunday reopen;
- the OANDA Sunday 22:00–24:00 UTC "stub" candle is folded into Monday.

Does the intended rule do better or worse than the current one?

The current rule has two quirks:

1. **A Friday close is never traded.** The blocks drop the last daily candle and use a 24 h window from the day's UTC end, and that window expires before the Sunday reopen.
2. **The stub is a day.** It counts in the lookbacks and in ATR(14), and from Monday 00:00 it can be the signal candle.

The criteria were pre-registered and committed before the variant was run (`preregistration.md`, commit 5b9f35d8).

## Verdict

| System | Verdict (pre-registered bar) | Why |
|---|---|---|
| **Gold trend N20 (`gtrend`, live)** | **KEEP the current rule** | 2006–17 R a position is lower: +0.42 against +0.49. Total R is lower: +90.1 against +115.5. |
| **Gold daily engulf (`geg`, live)** | **ADOPT the intended rule**, but the gain is within noise | It is better on every test: +0.21 against +0.19 (2006–17), +0.33 against +0.28 (2018–26), and +108.6 against +101.6 total R. The month-by-month difference has t ≈ 0.2. |
| Gold trend fast N5 (`gtrend5`, shadow) | reference only | Worse on every test: 2006–17 +0.32 against +0.37, 2018–26 +0.86 against +0.99, total +108.0 against +145.7. |

Read the two verdicts like this:

- **Gold trend should stay as it is.** The intended rule is worse for both trend legs.
  - It is worse in 2006–17, and worse in total, for N20 as well as N5.
  - The main reason is mechanical. Without the small Sunday stub in ATR(14), the 2 ATR stop is about 20% wider: median $33 against $27 in 2006–17, and $51 against $42 in 2018–26.
  - The chandelier then gives back more, and fewer positions are taken: 110 against 134.
  - The 19 Friday-close breakouts the intended rule adds net only +9.5R (+0.50 a position). The 18 stub-signal positions it removes had netted +12.8R.
- **Gold daily engulf passes the pre-registered bar, but the evidence for an improvement is weak.**
  - The gain is +7.1R over 20 years: +3.6R in 2006–17 and +3.4R in 2018–26.
  - The monthly bootstrap gives P(no gain) of 0.44 in each window (post-hoc).
  - The 2012–17 half got worse: +0.064 to +0.008R a position, and −0.015 at x2.
  - Its Friday-close signals add nothing: 85 positions, +2.7R.
  - The case for adopting it is "correct by construction and **not worse**", not "better". The proposed code change is below. It is for the owner to decide; no live code was changed.

## Key table (net R a position, x1 / x2 costs; n; total R at x1)

| System | Rule | 2006–17 | 2018–26 | Total 2006–26 (x1) | Friday-close share of signals |
|---|---|---|---|---|---|
| gtrend | current | +0.489 / +0.472 (75) | +1.336 / +1.325 (59) | **+115.5** (134) | 0% (stub signals 13%) |
| gtrend | intended | +0.423 / +0.409 (63) | +1.350 / +1.341 (47) | +90.1 (110) | **17%** (19 of 110) |
| geg | current | +0.186 / +0.149 (256) | +0.277 / +0.244 (195) | +101.6 (451) | 0% (stub signals 14%) |
| geg | intended | **+0.207 / +0.184** (247) | **+0.326 / +0.309** (176) | **+108.6** (423) | **20%** (85 of 423) |
| gtrend5 (ref.) | current | +0.372 / +0.357 (129) | +0.986 / +0.977 (99) | +145.7 (228) | 0% (stub signals 7%) |
| gtrend5 (ref.) | intended | +0.317 / +0.304 (112) | +0.863 / +0.854 (84) | +108.0 (196) | 17% (34 of 196) |

### Pre-registered tests

| Test | gtrend | geg | gtrend5 (ref.) |
|---|---|---|---|
| 2006–17 R a position not lower, x1 | no | yes | no |
| 2006–17 R a position not lower, x2 | no | yes | no |
| 2018–26 R a position not lower, x1 | yes | yes | no |
| 2018–26 R a position not lower, x2 | yes | yes | no |
| Total x1 R 2006–26 higher | no | yes | no |
| **Verdict** | **KEEP** | **ADOPT** | — |

### More detail (x1)

| System | Rule | t 2006–17 | Max DD 2006–17 | H1 2006–11 | H2 2012–17 | t 2018–26 | Max DD 2018–26 |
|---|---|---|---|---|---|---|---|
| gtrend | current | 1.77 | −5.4 | +0.574 | +0.353 | 2.48 | −3.8 |
| gtrend | intended | 1.63 | −6.4 | +0.646 | +0.162 | 2.41 | −4.7 |
| geg | current | 1.89 | −15.2 | +0.292 | +0.064 | 2.21 | −9.1 |
| geg | intended | 2.06 | −17.6 | +0.393 | +0.008 | 2.38 | −9.2 |
| gtrend5 | current | 1.92 | −10.8 | +0.544 | +0.187 | 2.64 | −7.5 |
| gtrend5 | intended | 1.68 | −10.8 | +0.497 | +0.138 | 2.48 | −6.6 |

## Where the difference comes from (paired, positions 2006-07 to 2026-11-06, net R x1)

- **gtrend**
  - No position keeps the same setup: every entry gets a different 2 ATR stop.
  - **72 positions share their id**, the same signal day. They net +79.1R under the current rule and +61.9R under the intended rule. The wider stop costs about 17R.
  - **62 positions are only in the current rule**, netting +36.4R:
    - 18 of them are stub signals, at +12.8R;
    - the rest are path effects of one-position-at-a-time.
  - **38 positions are only in the intended rule**, netting +28.2R. 19 of them are Friday closes, at +9.5R.
- **geg**
  - **256 positions are identical in setup** (zone and stop), with +85.9R against +85.0R. Three of them end with a different R.
  - **30 positions share their id but have a different zone**, netting +12.6R under the current rule against +0.8R under the intended rule. Folding the stub changes Monday's open and range.
  - **165 positions are only in the current rule**, netting +3.0R. 13 of them are stub signals, at −0.9R.
  - **137 positions are only in the intended rule**, netting +22.8R. 49 of them are Friday closes, at −2.8R.
  - The engulf's gain does not come from Friday closes. It comes from the positions only one rule has: the 88 intended-only positions that are not Friday closes net +25.6R, against +3.9R for the 152 current-only positions that are not stub signals. The 30 re-zoned positions lose 11.8R of that.
- **Stray weekend quotes.**
  - These are 58 Saturday candles and pre-reopen Sunday prints in 2006–13 OANDA data.
  - Only one current-rule position was entered on such a quote: a `gtrend5` entry on a Saturday in 2011, at +0.04R. The third change in the intended rule (no entry while spot is shut) therefore matters for almost nothing.

## Post-hoc diagnostics (added after the results; not part of the decision)

- **Is the difference more than noise?**
  - Method: the month-by-month difference in net R (x1, by close month) between the two rules, with its t and a bootstrap of 10,000 resamples of months.

  | System | 2006–17 difference (t, 95% CI, P ≤ 0) | 2018–26 difference (t, 95% CI, P ≤ 0) |
  |---|---|---|
  | gtrend | −10.0R (t −0.68; −36.5 to +18.1; 0.77) | −15.4R (t −1.35; −36.7 to +10.9; 0.91) |
  | geg | +3.6R (t 0.18; −30.8 to +45.4; 0.44) | +3.4R (t 0.20; −30.1 to +36.1; 0.45) |
  | gtrend5 | −12.5R (t −0.76; −44.7 to +18.4; 0.78) | −25.2R (t −1.87; −50.9 to +2.4; 0.97) |

  - None of the differences is significant.
  - The trend legs lean consistently worse under the intended rule: in both windows, for both N. For gtrend the intended rule is better in only 7 of 21 years.
  - The engulf is a coin flip that happens to land on the right side in both windows.
- **Median stop (first unit, price units):**
  - gtrend: $27.2 to $33.0 (2006–17) and $42.2 to $51.3 (2018–26).
  - geg: $11.5 to $13.8, and $16.7 to $21.0.
  - Wider engulf zones also make the $0.30–0.60 cost a smaller share of R. That is part of why the engulf's x2 numbers improve more than its x1 numbers.

## Proposal for the owner: Gold daily engulf only (not applied)

If the owner adopts the intended weekend rule for `geg`, these are the exact changes to `council/trader.mjs` (as of c4d26900). They match `replay-intended.mjs`.

The Gold trend legs stay as they are. With this change, the engulf and the trend legs read the daily candles differently. That is deliberate: the trend legs failed the bar.

1. **Import `spotClosed`.** It is already exported by `council/fills.mjs`. Line 19:

```diff
-import { costModel, annotateCosts, costSummary, driftR, backfillDrift, staleStats, stopFill, exitR, fillBarAmbiguous, spotSkip } from './fills.mjs';
+import { costModel, annotateCosts, costSummary, driftR, backfillDrift, staleStats, stopFill, exitR, fillBarAmbiguous, spotSkip, spotClosed } from './fills.mjs';
```

2. **In the Gold daily engulf block** (`if (key === 'xau' && config.goldEG)`, line ~764), read trading days and use the reopen window:

```diff
     if (key === 'xau' && config.goldEG) {
       try {
-        const EG = config.goldEG, D = src['1d'].bars.slice(0, -1), n = D.length, last = D[n - 1], dp = Math.max(2, (M.dec ?? 2) + 1);
+        // gold-weekend (owner, research/edge/gold-weekend): the engulf reads trading days. The closed candles are those whose UTC day has
+        // ended (on Saturday and Sunday: up to Friday); Saturday / Sunday candles (OANDA's 22:00-24:00 UTC Sunday stub) fold into the next
+        // weekday's candle (its time and close, the first weekend open, the high / low over all); a weekend candle with no closed weekday
+        // after it belongs to the forming Monday and is left out.
+        const foldWeekend = (bars) => { const out = []; let w = null;
+          for (const b of bars) { const wd = new Date(b.time * 1000).getUTCDay();
+            if (wd === 0 || wd === 6) { w = w ? { open: w.open, high: Math.max(w.high, b.high), low: Math.min(w.low, b.low) } : { open: b.open, high: b.high, low: b.low }; continue; }
+            out.push(w ? { ...b, open: w.open, high: Math.max(w.high, b.high), low: Math.min(w.low, b.low) } : b); w = null; }
+          return out; };
+        const EG = config.goldEG, D = foldWeekend(src['1d'].bars.filter((b) => b.time + 86400 <= now)), n = D.length, last = D[n - 1], dp = Math.max(2, (M.dec ?? 2) + 1);
+        // a signal is fresh for 24 h from the reopen after its day (Monday-Thursday: the day's end; Friday: the Sunday reopen); no new order while spot is shut
+        let reopen = last.time + 86400; while (spotClosed(reopen)) reopen += 300;
+        const fresh = !spotClosed(now) && now - reopen < 86400;
```

and in the same block:

```diff
-          if (base && up && !trades.some((x) => x.id === id) && now - (last.time + 86400) < 86400 && openCnt < EG.maxOpen) {
+          if (base && up && !trades.some((x) => x.id === id) && fresh && openCnt < EG.maxOpen) {
```

**Notes for the owner**
- The "zone failed" cancel and the `lastD` bookkeeping use the same `last`, so they move to trading days with no further change. The id stays `xau-geg-<base candle time>`.
- A Friday-close order is placed at the first run after the Sunday reopen. It is a resting limit at the zone high, so the wide reopen spread does not set its fill price.
- **Holidays.** `spotClosed` covers only the weekend. After a weekday holiday closure, the live window still counts from the day's end. The replay counted from the first quote after it. This touches a handful of days a year at most.
- **Kraken PAXG fallback.** If the feed falls back to PAXG, which trades all weekend, the full Saturday and Sunday candles fold into Monday.
- **Expectation.** About the same results as today: +0.2 to +0.3R a position, with a slightly wider median zone. Not a measurable improvement.

## Reproduction of #530 (baseline)

- #530's `replay.mjs`, run unchanged on its candle cache, writes a `trades.json` that is **byte-identical** to #530's run.
- #530's `analyze.mjs`, run unchanged on it, reproduces #530's committed `result.json` exactly for every system: every period, every year and every position (`result.json` → `reproduction`).
- Gold H4 trendline is untouched by the variant. Its 720 legs are identical in both runs (`gtlIdenticalInVariant`).

## Method

- **Data.** #530's OANDA XAU/USD M5 / H4 / D1 cache: 2006-03-20 to 2026-11-06, UTC buckets, with the Sunday stub. It is kept out of git.
- **Baseline.** `research/edge/gold-systems-oos/replay.mjs` (#530), unchanged.
- **Variant.** `replay-intended.mjs` is a copy of it. Every change is marked `WEEKEND`:
  1. Saturday and Sunday daily candles fold into the next weekday, for the trend legs and the engulf.
  2. A signal is fresh for 24 h from the reopen after its day's UTC end. The reopen is the first M5 candle that is not `spotClosed`.
  3. No market entry or add is placed on a spot-shut M5 candle.
- **Unchanged from the baseline:**
  - run times, entry prices, stops, the add, the trail, the hold;
  - the 20-day limit life, the cap of 3 open engulf orders;
  - management, and Gold H4 trendline.
- **Scoring.** `research/edge/gold-systems-oos/analyze.mjs`, unchanged, on both trade files.
  - Positions are the first unit plus its add.
  - x1 costs $0.30 per unit per round trip and x2 costs $0.60, each charged as cost / r0.
  - Positions are dated by entry. The windows are 2006-07-01 to 2017-12-31 and 2018-01-01 to 2026-11-06.
- **Comparison.** `compare.mjs` applies the pre-registered bar, the signal-day shares and the paired breakdown, plus the post-hoc diagnostics, which are labelled as such. It writes `result.json`.
- **Signal day.** The last closed daily candle at the entry run: raw UTC candles for the current rule, trading days for the intended rule.

## Files

- `preregistration.md`: the variant, the windows and the decision bar, committed before the run.
- `replay-intended.mjs`: the intended-rule replay, a copy of #530's `replay.mjs` with only the weekend handling changed.
- `compare.mjs`: the decision and the diagnostics.
- `result.json`: every number above.

## Reproduce

```
export SCR=<scratch dir>; export CANDLES=<#530 candle cache: research/edge/gold-systems-oos/fetch.mjs output>
OUT_DIR=$SCR/base node research/edge/gold-systems-oos/replay.mjs
OUT_DIR=$SCR/var  node research/edge/gold-weekend/replay-intended.mjs
node research/edge/gold-systems-oos/analyze.mjs $SCR/base/trades.json > $SCR/base/result.json
node research/edge/gold-systems-oos/analyze.mjs $SCR/var/trades.json  > $SCR/var/result.json
node research/edge/gold-weekend/compare.mjs $SCR/base/trades.json $SCR/base/result.json $SCR/var/trades.json $SCR/var/result.json \
  research/edge/gold-systems-oos/result.json > research/edge/gold-weekend/result.json
```
