# ICT index A-setups: sells only below the 200-day average (pre-registered test on 2018-26)

> **Clock correction, 10 Nov 2026.** Only the HistData cross-check was affected, and it was re-run on the corrected candle clock. Its answer is the same: FAIL. The OANDA runs, which carry the verdict, never read those files. Details: the last section of this page.

**Verdict: FAILS.** The filter came from the 2008-17 observation that the index rule's sells lost in the bull market. On
2018-26, data the observation did not come from, the sells it drops made money: **+0.062R a trade net (n 801)**. Removing
them cut the index stream's total from +85.6R to +35.6R. The filter fails three of the four pre-registered conditions. Both
checks (HistData 2019-26 and the live desk replay) say the same. **Nothing was built. No live rule, tracker or replay code
changed.**

## The rule that was tested (pre-registered in `preregistration.md`, commit de836e4f, pushed before any 2018-26 result)

- **Index A-setups (NQ, ES, YM, RTY).** A **sell** is taken only when the last closed daily candle closed **below the simple
  average of the last 200 daily closes** (that candle included). It is the same daily candle `signals()` reads for the 50-day
  bias. With fewer than 200 closes, the sell is not taken.
- **Buys are unchanged.** **GC is unchanged** (its gold rule takes buys only).
- The filtered stream has its own one-open-trade rule. A dropped sell no longer blocks later A-setups.
- Everything else is the live code: `signals()`, `isASetup()`, `sizeOf()` and the exits from `ict/tracker.mjs` / `ict/replay.mjs`.
- Costs are #526's: NQ/ES 0.02% + 0.25, YM 0.02% + 1, per round trip.

## Primary test: OANDA 5m, signals 2018-01-01 to 2026-10-31, NQ / ES / YM, net costs x1

The unfiltered stream U reproduces #526's 2018-26 stream exactly (NQ n 424 +0.103, ES n 422 +0.040, YM n 407 +0.061).

| stream | n | WR | net exp | R | max DD | t | x2 costs | gross |
|---|---|---|---|---|---|---|---|---|
| U (live A-setups) | 1,253 | 37% | +0.068 | +85.6 | 26.9 | 1.62 | +0.025 | +0.112 |
| F (filtered) | 453 | 36% | +0.079 | +35.6 | 25.1 | 1.08 | +0.051 | +0.106 |
| **dropped** (sells at or above the 200-day average) | **801** | 37% | **+0.062** | **+49.7** | 23.8 | 1.20 | +0.010 | +0.114 |
| added (unblocked by a dropped sell) | 1 | 0% | −0.275 | −0.3 | | | | |

| condition | result | pass |
|---|---|---|
| C1: F beats U (exp higher **and** total R not lower) | exp +0.079 vs +0.068, but R +35.6 vs +85.6 | **no** |
| C2: dropped n ≥ 30 and mean ≤ 0 | n 801, **+0.062** | **no** |
| C3: F > 0 in 2018-21 and 2022-26 | +0.069 (n 149) / +0.083 (n 304) | yes |
| C4: F > 0 on all 3 index markets | NQ +0.235, ES +0.038, **YM −0.018** | **no** |

By market (net exp, n):

| market | U | F | dropped |
|---|---|---|---|
| NQ | +0.103 (424) | +0.235 (141) | +0.037 (283) |
| ES | +0.040 (422) | +0.038 (145) | +0.042 (277) |
| YM | +0.061 (407) | −0.018 (167) | +0.115 (241) |

By year (net exp / R):

| year | U | F | dropped |
|---|---|---|---|
| 2018 | +0.075 / +9.9 | +0.037 / +2.1 | +0.103 / +7.9 |
| 2019 | −0.114 / −15.6 | +0.025 / +0.7 | −0.151 / −16.3 |
| 2020 | +0.178 / +23.8 | +0.188 / +6.4 | +0.174 / +17.4 |
| 2021 | +0.038 / +5.7 | +0.036 / +1.1 | +0.038 / +4.7 |
| 2022 | +0.129 / +21.9 | +0.008 / +1.2 | +0.830 / +20.7 |
| 2023 | −0.029 / −4.4 | +0.130 / +7.0 | −0.117 / −11.7 |
| 2024 | +0.058 / +7.8 | +0.120 / +3.4 | +0.041 / +4.4 |
| 2025 | +0.140 / +16.6 | +0.287 / +9.2 | +0.086 / +7.4 |
| 2026 | +0.163 / +19.7 | +0.103 / +4.6 | +0.199 / +15.1 |

- The dropped sells lost in only 2 of 9 years (2019, 2023).
- The 65 sells the filter **keeps** (below the 200-day average) made **−0.042R** a trade. So the filter keeps the worse sells
  and drops the better ones.
- 2022 shows the reverse of the idea. In that bear market the filter kept 145 of the 170 trades, and they made +0.008R a
  trade. The 25 sells it dropped that year made +0.830R a trade.

## Check 1: HistData cash, 2019-01-01 to 2026-10-31 (NAS100 under NQ's rule, SPX under ES's rule)

| stream | n | net exp | R | t |
|---|---|---|---|---|
| U | 719 | +0.085 | +61.0 | 1.47 |
| F | 246 | +0.171 | +42.1 | 1.74 |
| dropped | 474 | **+0.041** | +19.3 | 0.57 |

- C1 fails: total R is lower.
- C2 fails: the dropped trades are positive.
- C3 passes: F made +0.134 / +0.184.
- C4 passes: F made NQ +0.246, ES +0.087.
- **Does not confirm.** The kept sells again lost (−0.108R, n 42).

## Check 2: live desk replay, A-setups of NQ / ES / YM, 2025-08-01 to 2026-10-30

This uses council-data `ict/replay.json` (commit 475f6bc3). The 200-day average comes from OANDA cash daily closes, because
CNBC is not reachable from the sandbox. RTY (23 trades) is left out because no daily history is reachable. GC is unchanged.

| stream | n | net exp | R |
|---|---|---|---|
| U | 161 | +0.195 | +31.3 |
| F (= the buys: every index stayed above its 200-day average, so no sell survives) | 49 | +0.207 | +10.1 |
| dropped (every sell) | 112 | **+0.189** | +21.2 |

- By market, the dropped trades made NQ +0.373 (25), ES +0.256 (45) and YM +0.008 (42).
- **Not consistent with the filter:** the dropped trades made money. Over the live window the filter would have made the desk
  buys-only and lost two-thirds of its index R.

## Honest reading

- **The 2008-17 trend-side pattern does not carry forward.**
  - In 2009-17, shorting H1 sweeps of highs above the 200-day average lost (in-sample, −0.127R on the dropped set).
  - In 2018-26 the same trades made +0.062R on OANDA and +0.041R on HistData, and +0.189R in the live replay window.
  - The pattern looks like a feature of the 2009-17 low-volatility grind higher, not a lasting property of the rule. It is
    another sign that the desk's edge depends on the regime (#526).
- **Per-trade expectancy rose slightly** (+0.079 vs +0.068 on OANDA). That is only because index buys did a little better
  than sells. Dropping 64% of the trades for that is not an improvement, and the pre-registered bar treats it as a failure.
- **The in-sample result was a warning.** On 2008-17 itself, the filtered stream was negative in 2008-12 (−0.015). The
  filter only "worked" across the slice it was written to remove.
- **What this leaves:**
  - No live change.
  - No new shadow variant.
  - The existing paper variant 'dip' (index buys in a dip) stays as it was. This test is no evidence for or against it.
  - Treat the 2008-17 by-side tables in #526 as description only, as #526 already said.

## How it was run

- **Order of steps.** `preregistration.md`, `gate.mjs`, `run.mjs`, `analyse.mjs` and `replaycheck.mjs` were committed and
  pushed as de836e4f. The only run before that was the 2008-17 discovery run (`run.mjs ... 2018-01-01`: no 2018+ signal was
  simulated). Then the 2018-26 run, the HistData run and the replay check ran once each. Nothing was changed after them.
- **Data.**
  - OANDA: #526's 5m cache (scratchpad, not committed; `research/edge/ict-oos-2008/fetch.mjs`).
  - HistData: council-data `research/candles/` M1.
  - Replay: council-data `ict/replay.json`.
- **Re-run:**

```
node research/edge/ict-trend-side/run.mjs oanda <oanda5m cache> <cache>/oanda.json
node research/edge/ict-trend-side/analyse.mjs <cache>/oanda.json 2018-01-01 2026-11-01 2022
node research/edge/ict-trend-side/run.mjs histdata <dir with research/candles> <cache>/hist.json
node research/edge/ict-trend-side/analyse.mjs <cache>/hist.json 2019-01-01 2026-11-01 2022
node research/edge/ict-trend-side/replaycheck.mjs <replay.json> <oanda5m cache> 2025-08-01 2026-10-31
```

## Files

- `preregistration.md`: the rule and the bar, committed before the test.
- `gate.mjs`: the gate.
- `run.mjs`: U and F streams on OANDA or HistData, using the desk's own code.
- `analyse.mjs`: the statistics and the verdict.
- `replaycheck.mjs`: the replay-window check.
- `result.json`: the discovery run, the primary test and both checks.

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`. This study used the documented "EST, no daylight saving" reading (label + 5 hours all year), which is one hour late for the whole of Europe's summer, about seven months a year.

**Re-run on the corrected clock on 10 Nov 2026. No rule, parameter, filter or cost was changed.** A control run of the old loader on the same day, with today's code, reproduced the published cross-check block exactly. ICT stays a separate, paper-only edge; nothing on the desk, the tracker or the replay was changed. `result.json` block `check_histdata_2019_26` holds the new numbers; every other block is untouched.

| HistData 2019-26, pooled, net | Before: n, R a trade, t | After |
|---|---|---|
| Unfiltered | 719, +0.085, 1.47 | 743, +0.091, 1.66 |
| With the trend-side filter | 246, +0.171, 1.74 | 244, +0.203, 2.00 |

The cross-check's own verdict fields are identical (FAIL: the filter does not beat the unfiltered rule by the pre-registered margin). **The verdict is unchanged: FAILS.**
