**Verdict: REGIME-BOUND on the pre-registered rule, and in substance a null result. The live Mosha BO combination makes +0.14R a position at ×1 costs and +0.06R at ×2 on 62 untouched positions (2006-07 to 2017-12), t 0.55, bootstrap 95% CI −0.31 to +0.59, P(mean ≤ 0) 0.32; the bull half loses (−0.05R, n 38), the bear-and-range half wins (+0.43R, n 24); without its best 5 positions the window loses −16.5R. It is not a FAIL only because both cost levels end above zero. The decay monitor's current "decaying" flag would have fired on 2 of 62 trade points over 2006–17 (January 2011) and never over 2018–26 on this harness; the flag rests on a rebuild whose trade list shares 12 positions with this one, so it is a statement about the baseline, not about the rule.**

Paper research only. No live rule, size, filter or mirror setting was changed. One live-code finding is reported below (the generic add is written `shadow: false`); it is a proposal, not a change.

# Mosha BO: out-of-sample test on 2006–2017

**Question.** Mosha BO (`k: mosha-bo`) is a LIVE Meridian gold system. The parameter-drift audit (#550) found it was the one live system never tested on untouched data in its live form: weekly filter picked on 2019–26, add / run exits and the slow-arrival rule on 2023–26, 18 out-of-sample trades in the HistData study, and a robustness rebuild in which the weekly filter hurts. Does the live combination, unchanged, make money on 11.5 years of gold it never saw? The criteria were pre-registered and committed before any 2006–17 number was computed (`preregistration.md`, commit eee6419f); the bar is #530's, unchanged.

## Verdict table (pre-registered rule, out of sample = fills 2006-07 to 2017-12)

| System | OOS n | R a position (×1 / ×2 cost) | t | 95% CI (positions, ×1) | H1 2006–11 / H2 2012–17 | Max DD | Verdict | Tests missed |
|---|---|---|---|---|---|---|---|---|
| Mosha BO (live: weekly + slow 12 + BE 1.5 / add 1.5 / run [3, 1], cap 2, ±0.3, r0 > 0.5, 24 h / 72 h) | 62 | +0.137 / +0.063 | 0.55 | −0.307 to +0.585 | **−0.045** / +0.425 | −16.2R | **regime-bound** | t ≥ 2; CI lower > 0; both halves > 0 |

What the pre-registered tests say:

- `x1 mean > 0` and `x2 mean > 0`: pass (+0.137 and +0.063), so it is not a FAIL.
- Test 1, t ≥ 2.0: **fails** (0.55).
- Test 2, bootstrap CI lower bound > 0: **fails** (−0.307; P(mean ≤ 0) = 0.32 at ×1, 0.45 at ×2; month blocks −0.395 to +0.687).
- Test 3, both halves > 0: **fails**. H1 (the $600 → $1,900 bull) −0.045R over 38; H2 (the 2013–15 bear and the 2016–17 range) +0.425R over 24. The pre-registered reading "H1 positive and H2 ≤ 0 = long-gold exposure" does not apply; the pattern is the reverse, and the system trades both sides (44 buys, 18 sells; yearly correlation with gold's yearly change −0.22).
- Test 4, half the years positive: pass, 6 of 10 years with a position (2007 and 2014 had none).
- Test 5, drawdown within 2× calibration: pass (−16.2R against 2 × −11.4R).

**Reading.** The out-of-sample total is +8.5R over 11.5 years, 5.4 positions a year. The best 5 positions make +25.0R; without them the window is −16.5R. The first unit alone makes +0.05R a position (−0.00 at ×2): the out-of-sample profit is the add on a handful of runners. The 2010 year alone loses −14.0R over 14 positions. Nothing here distinguishes the rule from zero, and nothing supports the +0.37R / +0.35R a trade claimed for the weekly filter when it was approved.

## Results

Net R a position: the first unit plus its add, × size. ×1 charges $0.30 per unit per round trip, ×2 $0.60. The OOS window is positions filled 2006-07-01 to 2017-12-31; calibration 2018-01-01 to 2026-11-06.

### Periods (n / win% / R a position / total R / t / max DD)

| Window | ×1 | ×2 | gross |
|---|---|---|---|
| **OOS 2006–17** | 62 / 35% / **+0.137** / +8.5 / 0.55 / −16.2 | +0.063 / +3.9 / 0.26 / −17.5 | +0.211 / +13.1 |
| H1 2006–11 | 38 / 32% / −0.045 / −1.7 / −0.16 / −16.2 | −0.123 / −4.7 / −0.43 | +0.034 / +1.3 |
| H2 2012–17 | 24 / 42% / +0.425 / +10.2 / 0.92 / −5.8 | +0.359 / +8.6 / 0.80 | +0.491 / +11.8 |
| Calibration 2018–26 | 46 / 41% / +0.253 / +11.6 / 0.85 / −11.4 | +0.212 / +9.7 / 0.71 | +0.294 / +13.5 |
| 2019–22 | 24 / 33% / −0.115 / −2.8 / −0.36 / −10.3 | −0.165 / −4.0 | −0.065 / −1.6 |
| 2023–24 | 9 / 89% / +1.894 / +17.1 / 1.93 / −1.0 | +1.861 / +16.8 | +1.927 / +17.3 |
| 2025–26 | 9 / 33% / +0.179 / +1.6 / 0.30 / −4.0 | +0.165 / +1.5 | +0.193 / +1.7 |

Median stop: $8.55 out of sample, $15.14 in calibration, so the ×1 cost is about 0.035R a unit out of sample. 21 of the 62 OOS positions reached the add; 16 of 46 in calibration.

### By year (net R ×1, positions in brackets; gold's calendar-year change from OANDA daily closes)

| Year | Mosha BO | Gold | | Year | Mosha BO | Gold |
|---|---|---|---|---|---|---|
| 2006 (Jul–) | −2.1 (5) | +15% | | 2018 | −4.3 (4) | −2% |
| 2007 | – (0) | +31% | | 2019 | +6.5 (4) | +18% |
| 2008 | +6.0 (7) | +6% | | 2020 | −2.9 (10) | +25% |
| 2009 | +7.6 (5) | +24% | | 2021 | – (0) | −4% |
| 2010 | **−14.0 (14)** | +30% | | 2022 | −6.4 (10) | 0% |
| 2011 | +0.8 (7) | +10% | | 2023 | +6.0 (4) | +13% |
| 2012 | +2.3 (6) | +7% | | 2024 | +11.0 (5) | +27% |
| 2013 | −2.1 (2) | −28% | | 2025 | −0.3 (7) | +65% |
| 2014 | – (0) | −2% | | 2026 (to 6 Nov) | +1.9 (2) | −6% |
| 2015 | +5.2 (4) | −10% | | | | |
| 2016 | +6.9 (10) | +9% | | | | |
| 2017 | −2.1 (2) | +13% | | | | |
| **2006–17 positive years** | **6/10** | | | **2018–26** | 4/8 | |

### Exits, out of sample (positions by the first unit's exit)

| Exit | n | R a position | Total |
|---|---|---|---|
| Stop | 32 | −1.07 | −34.1 |
| Trailing stop (after +3R) | 9 | +3.79 | +34.1 |
| 72 h time exit | 18 | +0.74 | +13.3 |
| Break-even stop | 3 | −1.62 | −4.9 |

The break-even positions lose because the add (stop at the first entry, size 1.5) is triggered at the same +1.5R as the break-even move: a return to the entry costs the position 1.5R plus costs. That is the live rule's design, not a harness artefact.

### Bootstrap, 95% CI of R a position (10,000 resamples)

| | Positions ×1 | P(≤0) | Positions ×2 | P(≤0) | Month blocks ×1 | P(≤0) | Month blocks ×2 |
|---|---|---|---|---|---|---|---|
| OOS 2006–17 | −0.307 to +0.585 | 0.317 | −0.377 to +0.495 | 0.448 | −0.395 to +0.687 | 0.314 | −0.462 to +0.606 |
| Calibration 2018–26 | −0.296 to +0.884 | 0.234 | | | | | |

## The decay monitor over 2006–17 (pre-declared diagnostic)

`council/decay.mjs` `assess()` with the live baseline (`council/decay-base.json` `mosha-bo`: ref +0.009R, sd 2.04, k 0.1, limit h 5.6, W 18, drawdown limit 39.17R, from the robustness rebuild), walked forward over this harness's positions at ×1 costs in close order.

| Record | Points | `decaying` at | `watch` at | First `decaying` | Worst CUSUM (limit 5.6) | Reading at the end |
|---|---|---|---|---|---|---|
| OOS 2006–17 | 62 | 2 (3%) | 9 | 2011-01-19 | 6.43 | healthy (CUSUM 0.83, last 18 +0.44R) |
| H1 2006–11 alone | 38 | 2 | 6 | 2011-01-19 | 6.43 | watch (CUSUM 4.47, drawdown 13.2R) |
| H2 2012–17 alone | 24 | 0 | 0 | – | 2.25 | healthy |
| Calibration 2018–26 | 46 | 0 | 0 | – | 3.60 | healthy (CUSUM 0, last 18 +1.04R) |

- Over 2006–17 the monitor would have said **decaying** twice, in January 2011 after the −14R year of 2010, and **watch** at 9 of 62 points (2010–12). It would have been **healthy** for the whole of 2012–17 and, on this harness's record, for the whole of 2018–26.
- Today it says **decaying** (council-data `coach.json`, 7 Nov 2026 21:48 UTC: CUSUM 8.54 past 5.6, CUSUM vs zero 8.46, on the last 48 trades of the robustness rebuild, no forward trade). That reading comes from the robustness rebuild's 2024–26 (−0.14R a trade; 2026 −20.7R over 17), which this harness does not reproduce (2025–26 +1.6R over 9). The two rebuilds disagree on the record that drives the flag (next section), so the flag measures the baseline's choice, not a change in the rule. The monitor's own RESULT already says the two rebuilds disagree; this study adds a third, closer to the live code path, that disagrees with both.

## Calibration: three rebuilds of the same live rule do not agree

| Rebuild | Data / events | 2018–26 | 2018–22 | 2023–26 |
|---|---|---|---|---|
| This harness | OANDA M5–D1, 720-candle windows at every run (live code path) | 46 positions, +0.25R, +11.6R | 28, **−7.0R** | 18, **+18.7R** |
| HistData study (`gold-systems/mosha.json`, `live`) | HistData M1, events on the full history | 64, +0.53R, +34.0R | 40, +17.2R | 24, +16.8R |
| Robustness rebuild (`robustness/out/mosha.json`, `live`; the decay baseline) | HistData M1, causal 720-bar windows, every event when first seen | 147, +0.01R, +1.4R | 94, +11.3R | 53, −10.0R |

- On the 2023–26 window the components were picked on, this harness reproduces the HistData study: +18.7R over 18 positions against +16.8R over 24 (the study's "OOS n 18" is the same 2024–26 count: 18 here too). 2023–24 is +17.1R here against the claim of the add / run approval. The harness therefore reproduces the in-sample edge; the out-of-sample weakness comes from the period.
- On 2018–22 the three rebuilds give −7.0, +17.2 and +11.3R. Only **12 of this harness's 46** calibration positions fall within 6 h of any of the robustness rebuild's 147 trades (20 within 72 h). The robustness rebuild takes every M15 event when it first appears in a window; live takes only the newest M15 event of the current window, at most 1 h old (`E3.at(-1)`, `now − e3.t ≤ 3600`), and this harness follows live. The HistData study used events computed on the whole history, which the live 720-candle windows never see.
- The lesson is about the rule, not the harnesses: a chain of three structure engines on sliding windows produces a trade list that changes with the feed, the window and the run timing. A system whose trade list is this unstable cannot be judged by any one replay, and its forward record is the only record that counts.
- Live overlap: council-data `trades.json` (7 Nov 2026 22:40 UTC) has no `mosha-bo` record and no add of any system, so there is nothing to check the harness against yet.

## Diagnostics (not part of the verdict)

**The blocked chains (the live shadow book).** Live keeps every chain that fails a filter as a shadow trade. The harness manages them the same way (no cap on the shadow book). Positions of the shadow book, ×1:

| Blocked by | OOS 2006–17: all with the tag | OOS: that tag alone | Calibration 2018–26: all | Calibration: alone |
|---|---|---|---|---|
| any | 642 / +0.14R / +92.6R (t 1.62, DD −83) | | 457 / −0.07R / −32.9R | |
| weekly against | 397 / −0.06R | 96 / **−0.23R** (t −1.08) | 274 / −0.27R (t −2.5) | 93 / **−0.35R** (t −2.26) |
| momentum (pull < 12 H1 bars) | 536 / +0.19R | 230 / **+0.44R** (t 2.78) | 349 / +0.03R | 159 / **+0.20R** (t 1.26) |
| cap (2 open or pending) | 15 / +0.99R | 9 / +1.68R | 24 / +0.43R | 15 / −0.70R |
| price on the wrong side | 1 | 0 | 0 | 0 |

- The weekly filter removed losing chains in both windows (−0.23R and −0.35R a position for chains blocked by it alone). Here it helps, unlike in the robustness rebuild.
- The slow-arrival rule removed **winning** chains in both windows: +0.44R a position (230 positions, t 2.78) out of sample and +0.20R (159) in calibration. That agrees with the HistData study (fast arrivals +0.15 / +0.47R in 2023–24 / 2025–26) and the drift audit's "not supported". The rule is a filter that costs money on every window outside the one it was picked on. This is a diagnostic, not a verdict, and no rule is changed; it goes to the owner as a proposal (below).
- 1,362 chains were evaluated in 20 years; the live book took 119 of them (108 filled). The live rule trades about 5 times a year.

**Sides.** OOS buys 44 at +0.11R, sells 18 at +0.19R; calibration buys 34 at +0.29R, sells 12 at +0.15R.

**First unit only.** OOS +0.054R (×2 −0.001), H1 −0.047, H2 +0.215; calibration +0.172R.

**Live-code finding: the generic add is recorded `shadow: false`.** In `council/trader.mjs` the "Manage open trades" loop writes every pyramid add with `shadow: false, blockedBy: []`, whatever its parent's status (the gold trend and crypto adds propagate `!!open.shadow`; the generic one, used by the replica and Mosha BO, does not). A blocked (shadow) Mosha chain that reaches +1.5R therefore spawns an add that enters the **live** record, counts toward the 2-open cap (`openBo` counts non-shadow open or pending Mosha trades) and, in the decay monitor's `fold()`, becomes a stand-alone live point without its parent. On this harness, over 2006–17, 221 such adds would have entered the live record (+34.9R, t 1.5) and 148 over 2018–26 (−13.4R). Nothing has leaked yet: council-data `trades.json` holds no add of any system at 7 Nov. The harness follows the pre-registered rule (an add inherits its parent's shadow status) and does not replicate the leak. **Proposal (not applied; it is a live code path):** `shadow: !!tr.shadow, blockedBy: tr.blockedBy || []` on the generic add, so a shadow parent's add stays shadow. It affects the replica's shadow trades the same way.

## Recommendation to the owner (no live rule was changed)

1. **Read Mosha BO's forward record as the only evidence.** Three rebuilds of the live rule give +0.01, +0.25 and +0.53R a position on 2018–26 and share a minority of their trades; on 11.5 untouched years the live combination is +0.14R with a CI that spans zero. There is no backtest a decision can rest on. The system trades about 5 times a year live, so the forward record will take years to say anything: at this trade rate, a forward sample of 60 positions (the size of this test) arrives around 2037.
2. **The decay monitor cannot judge Mosha BO yet.** Its flag flips from `decaying` to `healthy` with the choice of baseline rebuild. Options for the owner: (a) show the monitor's Mosha line as "no baseline" until the forward record reaches the minimum (10 trades) and judge it against zero only; or (b) rebuild its baseline from this harness (46 positions, ref +0.25R), which would read healthy today, with the caveat that it is one more rebuild. The honest choice is (a).
3. **The slow-arrival rule (`moshaSlow 12`) is the component with the clearest evidence against it:** the chains it blocks made +0.44R a position out of sample (230, t 2.78) and +0.20R in calibration, while the live trades made +0.14 and +0.25. Proposal: run "weekly, no slow rule" as a paper shadow variant on the same chains (the shadow book already records the blocked chains with `blockedBy: momentum`, so the comparison exists forward without any change), and let the owner decide after a forward sample. Not changed here.
4. **Fix the add's shadow flag** (finding above) before any shadow Mosha or replica chain reaches +1.5R, or the live record and the cap will carry shadow adds.
5. **Mirror budget:** nothing in this study supports giving Mosha BO any.

## Method

- **Data.** OANDA XAU/USD mid candles through the site's `/md/bars` proxy: M5, H4 and D1 from the #530 cache (2006-03-19/20 to 2026-11-06), M15 (493,907 candles) and H1 (125,589) fetched the same way for the same span (`run.mjs fetch`). The M15 candles equal the M5 aggregates on every bucket. The candles are kept out of git.
- **Same rule as live (`run.mjs replay`).** The live Mosha block line for line: `msAnalyze` (N 6) from `council/engine.mjs` on the last 720 candles of each timeframe at the run (the last one forming; `msAnalyze` is causal by index, checked on 300 windows, so closed events are those of the 719 closed candles), events with `breakIdx < bars.length − 1`, `e3 = E3.at(-1)` within 1 h, `before(E2 / E1, e3.t)`, the chain test, entry at the M15 level, stop ±0.3 past the M15 Origin, `r0 > 0.5`, price on the right side of the stop, the H1 `pull` count from the 720-bar H1 window with the forming bar included, the weekly structure from Monday weeks of the 720-candle daily window (swing 3, closed weeks only), the cap on open or pending live Mosha trades including adds, id `xau-moshabo-<e3.t>`. Config of 7 Nov 2026 (council-data `config.json`, read 22:40 UTC): `moshaBo true, moshaBoWeekly true, moshaSlow 12, moshaBeR 1.5, moshaAdd {atR 1.5, size 1}, moshaRun {atR 3, trail 1}`.
- **Runs.** One run 4 minutes after every M5 close (1.47 M runs); the Mosha block from 2006-03-20 with at least 40 daily candles, entries counted from 2006-07-01.
- **Management.** The live "Manage open trades" loop on M5 candles in the live order: pending fill (`fillBarAmbiguous` → missed; 10R target first → missed; 24 h expiry), stop (`stopFill`, gapped at the open; `trail && trailMoved` or `beMoved` → `exitR`, else −1), target, 72 h time exit, MFE / MAE, trail `[3, 1]`, break-even at +1.5R, add at +1.5R (entry + 1.5 r0, stop at the first entry, trail `[1, 0.667]`, size 1.5, time exit with the first unit, managed from its creation candle as live). `spotSkip` candles fill and stop nothing.
- **Departures.** The current price is the close of the M5 candle the run falls in (live: the last 1-minute close); fills and stops on M5 candles (live: M1); the forming H1 bar of the pull count is built from the M5 candles closed by the run; the weekly filter reads OANDA daily candles (live: CNBC XAU= first, OANDA as the fallback); adds inherit the parent's shadow flag (live writes `shadow: false`, see the finding).
- **Costs, statistics and verdict rules:** as pre-registered. `run.mjs analyze` applies them mechanically and writes `result.json`, including the decay-monitor walk (`assess` imported from `council/decay.mjs`, baseline from `council/decay-base.json`).

## Files

- `preregistration.md`: the criteria, committed before the results (eee6419f).
- `run.mjs`: `fetch` (the candles), `replay` (every leg, live and blocked chains), `analyze` (statistics, verdict, diagnostics, decay walk).
- `result.json`: every table above, the verdict tests, the diagnostics, the decay walk by year, and every live position (fill, close, gross / ×1 / ×2 R, add, stop size, exit).

## Reproduce

```
export SCR=<scratch dir>
node research/edge/mosha-oos/run.mjs fetch $SCR/candles <#530 candle cache dir>      # M15 and H1 ~5 min; M5/H4/D1 reused
CANDLES=$SCR/candles OUT_DIR=$SCR/out node research/edge/mosha-oos/run.mjs replay      # ~3 min
CANDLES=$SCR/candles node research/edge/mosha-oos/run.mjs analyze $SCR/out/trades.json > research/edge/mosha-oos/result.json
```
