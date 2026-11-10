# ICT iFVG filters: which hold up out-of-sample (2018 to Oct 2026)

> **Clock correction, 10 Nov 2026.** Re-run on the corrected candle clock. The Friday filter still passes, more clearly. The second filter named below (sweep into an unfilled D1/H4 FVG) is no longer picked in-sample; "Tuesday to Thursday only" is, and passes. The text below quotes the old numbers. Details: the last section of this page.

**Verdict: PASS, but weak.** One simple filter passes every test: **don't take A-setups on Fridays (New York day)**. A second filter also passes: **only take A-setups whose sweep went into an unfilled D1/H4 FVG**. Its OOS improvement is bigger, but it halves the trade count and 2024 lost.

The two claims from the CNBC replay are **noise**:
- **"NY PM is negative"** does not survive.
- **"A-London is negative"** is not a stable effect. London was the *best* A session in-sample and the worst out-of-sample.

None of the HTF bias, premium/discount, grade, instrument or opening-gap filters improved OOS after being chosen in-sample.

## Setup

- **Model.** This is the desk's own code. Signals, grades, the A-setup rule (`isASetup`), and the exits come from `signals()` in `ict/tracker.mjs` and `simulate()` in `ict/replay.mjs`, after the #413 fixes. Exits are: a 1.5R trail from +2R, break-even at +1.5R on indices, and a 36 H1-candle time exit. Nothing is reimplemented. `driver.mjs` only builds the candles that CNBC would supply:
  - 5m bars without the 17:00 ET halt hour
  - H1 bars built from 5m
  - D1 bars per 18:00-ET trading day
- **Data.** HistData M1, 2018-01 to 2026-10-30:
  - NSXUSD (Nasdaq 100 cash) stands in for NQ
  - SPXUSD stands in for ES
  - XAUUSD (spot gold) stands in for GC
  - YM and RTY have no history before 2023, so they are left out.
- **Signals.** 6,568 graded signals (grade ≥ 3). Each is simulated independently. The filter is applied first, then one open trade per market.
- **Costs.** 2 ticks per round trip: NQ/ES 0.5 pt, GC 0.2. All figures below are net, in R per unit (A-setup sizing ignored). A 2× cost stress was also run.
- **Walk-forward.**
  - In-sample (IS) is 2018–2023, out-of-sample (OOS) is 2024 to Oct 2026.
  - A filter counts as *chosen in-sample* only if all of these hold:
    - IS n ≥ 100
    - IS expectancy is at least 0.02R/trade above the baseline
    - kept vs dropped trades differ with Welch t ≥ 1.5 in IS
  - A filter is a *candidate* if it also meets the preamble's OOS rules:
    - OOS n ≥ 100
    - OOS expectancy > 0 and above the OOS baseline
    - positive in ≥ 2/3 of OOS years
- **Multiple testing.** 31 filters × 2 populations (A-setups and all signals), plus 2 greedy combinations = **64 variants**. 7 were chosen in-sample and 3 of those passed OOS. With incremental OOS t-stats of 1.0–1.5, at least one of these passes could be luck.
- **Caveat.** The A-setup rule itself is not out-of-sample:
  - The index rule was fitted on 2023–26 cash indices.
  - The gold rule was fitted on 2019–26 spot gold.
  - On the unseen index years 2018–2022, A-setups on indices made only +0.03R/trade (3 of 5 years negative).
  - Only the filters stacked on top of the A rule are walk-forward.

## Baselines (net)

| population | IS n | IS WR | IS exp | IS R | IS maxDD | IS t | OOS n | OOS WR | OOS exp | OOS R | OOS maxDD | OOS t |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A-setups (live rule) | 910 | 38% | +0.091 | +82.8 | 33.1 | 1.76 | 411 | 40% | +0.125 | +51.3 | 16.0 | 1.72 |
| All graded signals | 2808 | 37% | +0.047 | +132 | 67.1 | 1.61 | 1328 | 39% | +0.057 | +75.4 | 34.2 | 1.44 |

A-setups by year (net R): 2018 −14.4, 2019 +20.6, 2020 +28.7, 2021 −7.1, 2022 +29.4, 2023 +25.7, 2024 +18.6, 2025 +20.3, 2026 +12.4.

Gross figures were +0.115 IS and +0.138 OOS for A-setups.

## The two claims

| segment | IS n | IS exp | OOS n | OOS exp | OOS years (R) |
|---|---|---|---|---|---|
| A-setups, London | 193 | **+0.243** | 101 | **−0.184** | 2024 −12.4, 2025 +11.0, 2026 −17.2 |
| A-setups, NY PM | 186 | +0.075 | 95 | +0.178 | 2024 +5.0, 2025 +8.1, 2026 +3.8 |
| All signals, NY PM | 860 | −0.003 | 394 | +0.045 | 2024 +22.8, 2025 −9.4, 2026 +4.5 |
| A London, Aug 2025 – Oct 2026 only | – | – | 48 | −0.270 | (matches the CNBC replay's −0.15) |
| A NY PM, Aug 2025 – Oct 2026 only | – | – | 39 | +0.361 | (the CNBC replay said −0.08) |

- **NY PM negative: noise.**
  - On this data NY PM is flat for all signals and positive for A-setups, both in- and out-of-sample.
  - Dropping NY PM changes A-setup OOS from +0.125 to +0.118, which is worse.
  - The A+ tier's "not NY PM" condition and the tight-stop rule's NY-PM exclusion are not supported by the long history.
- **A-London negative: not a stable effect.**
  - The sign flipped: London was +0.243R/trade over 2018–23, the strongest session, and −0.184 OOS.
  - By market, A-London ES went from +0.49 IS to −0.45 OOS, and gold from +0.16 to −0.24.
  - A rule chosen in-sample would never drop London. Dropping it OOS (+0.217) is hindsight.
  - The recent negative run is real in the data (2024 and 2026), but a 6-year history says the opposite. Treat it as regime or noise, not a rule.

## Filters (A-setups, net, chosen in-sample → reported OOS)

| filter | IS n | IS exp | OOS n | OOS exp | OOS maxDD | dropped part IS / OOS | chosen IS | OOS verdict |
|---|---|---|---|---|---|---|---|---|
| **baseline** | 910 | +0.091 | 411 | +0.125 | 16.0 | | | |
| **drop Friday** | 772 | +0.142 | 354 | **+0.156** | 11.3 | −0.141 / −0.091 | yes | **PASS** |
| Tue–Thu only | 583 | +0.169 | 269 | +0.217 | 14.0 | −0.038 / −0.002 | yes | PASS (adds "drop Mon", which does nothing alone) |
| **sweep into unfilled D1/H4 FVG** (`feat.htfFvg`) | 225 | +0.276 | 124 | **+0.237** | 11.9 | +0.055 / +0.074 | yes | **PASS** (2024 −4.3R) |
| D1 bias with | 178 | +0.292 | 120 | +0.106 | 5.6 | | yes | FAIL |
| drop Asia | 757 | +0.132 | 342 | +0.086 | 16.5 | | yes | FAIL |
| greedy IS combo: D1 with + drop Friday | 154 | +0.363 | 109 | +0.116 | 7.6 | | yes | FAIL |
| drop NY PM | 745 | +0.095 | 325 | +0.118 | | +0.075 / +0.178 | no | FAIL |
| drop London | 734 | +0.050 | 317 | +0.217 | | +0.243 / −0.184 | no (IS says keep it) | hindsight only |
| grade ≥ 8 (A grades only) | 433 | −0.022 | 201 | +0.033 | | | no | worse |
| grade ≥ 5 (A+B) | 865 | +0.081 | 390 | +0.136 | | | no | ≈ baseline |
| gold only | 361 | +0.168 | 165 | +0.117 | | | no | FAIL |
| indices only | 549 | +0.040 | 246 | +0.130 | | | no | ≈ baseline |
| PD right half (buy discount / sell premium) | 345 | +0.120 | 127 | +0.316 | | | no (t 0.4 IS) | good OOS, not chosen IS |
| PD deep (< 0.3) | 217 | +0.102 | 73 | +0.325 | | | no | n too small |
| H4 bias with / against | 249 / 677 | +0.141 / +0.065 | 119 / 299 | +0.082 / +0.143 | | | no | flips |
| D1 candle-closure aligned | 451 | +0.057 | 178 | +0.110 | | | no | worse |
| sweep at NDOG/NWOG | 178 | +0.078 | 80 | +0.190 | | | no | n too small |
| sweep took prior-day extreme | 577 | +0.132 | 253 | +0.204 | | | no (t 0.9 IS) | good OOS, not chosen IS |
| sweep took ≥ 2 pivots (pool/EQL) | 813 | +0.091 | 368 | +0.107 | | | no | nothing |
| V-shape ≤ 2 candles | 386 | +0.067 | 177 | −0.013 | | | no | worse |

**All graded signals.**
- Chosen in-sample were "sweep into HTF FVG" (IS +0.135, OOS +0.024) and "valid" (IS +0.074, OOS +0.056). Both fail OOS.
- Drop Friday also helps here (+0.047 → +0.066 IS, +0.057 → +0.066 OOS), but the in-sample t-stat was 1.99 and the IS gain was not 0.02R, so it was not selected.
- "D1 bias with" is +0.078 IS and −0.007 OOS, a clear example of a filter that overfits.

**Instrument (GC vs indices).**
- A-setups: gold IS +0.168, OOS +0.117; indices IS +0.040, OOS +0.130. No OOS preference.
- All signals: gold +0.033 / +0.039; indices +0.053 / +0.065.
- Gold's A rule carried 2018–23. Indices caught up from 2023, which is also the period the index rule was fitted on.

## Candidate details

**A-setups, drop Friday (New York weekday of the signal close).**
- Year by year, net R with the filter: 2018 −7.9, 2019 +29.9, 2020 +34.3, 2021 +2.9, 2022 +28.4, 2023 +22.1, 2024 +24.0, 2025 +15.1, 2026 +16.2. That is 8/9 years positive (baseline: 7/9). All 3 OOS years are positive.
- The Friday A-setups taken on their own, by year: −4.0, −9.3, −5.5, −12.3, +2.9, +2.6, −6.4, +5.2, −3.8.
- The Friday loss shows up in every market in-sample: NQ −0.13, ES −0.16, GC −0.22. Out-of-sample it is NQ −0.22, ES −0.03, GC −0.03.
- Kept vs dropped Welch t: IS 2.42, OOS 1.40.
- At 2× cost: OOS +0.143 vs baseline +0.112. Still passes.
- Gain: OOS expectancy +0.03R/trade and max drawdown 16.0 → 11.3R, giving up 57 trades in about 3 years.

**A-setups, sweep into an unfilled D1/H4 FVG** (the tracker's existing `feat.htfFvg` forward feature, skill §29).
- OOS +0.237 (n 124) vs +0.125. Years 2024 −4.3, 2025 +15.0, 2026 +18.7.
- Positive in every market OOS: NQ +0.49, ES +0.30, GC +0.09. In-sample 5 of 6 years positive.
- Kept vs dropped t: IS 1.65, OOS 1.01. Most of the OOS gain could be noise.
- It keeps only 30% of the trades. Total OOS R falls from 51 to 29.
- Better used as a **tier** (A+ / sizing) than as a gate.

**Post-hoc only, not a candidate:** drop Friday + HTF FVG gives IS +0.367 (n 185) and OOS +0.280 (n 109). It was not chosen by the IS procedure; the greedy combination picked "D1 bias with" first, and that combination failed OOS.

## Files

- `driver.mjs`: replays the desk model on HistData.
- `analyse.mjs`: filters, walk-forward, stats. Run with `STRESS=2` for the cost stress.
- `build-result.mjs`: writes `result.json`.
- `result.json`: machine-readable results.
- `proposal.md`: the Friday rule.

Re-run:

```
git archive -o d.tar origin/council-data research/candles/{xau,nsxusd,spxusd}-histdata && tar xf d.tar -C <dir>
node research/edge/ict-filters/driver.mjs <dir>/research/candles trades.json
node research/edge/ict-filters/analyse.mjs trades.json out && STRESS=2 node research/edge/ict-filters/analyse.mjs trades.json out
node research/edge/ict-filters/build-result.mjs out/analysis.json out/analysis-stress2.json research/edge/ict-filters/result.json
```

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`. This study used the documented "EST, no daylight saving" reading (label + 5 hours all year), which is one hour late for the whole of Europe's summer, about seven months a year.

**Re-run on the corrected clock on 10 Nov 2026. No rule, parameter, filter or cost was changed.** A control run of the old loader on the same day, with today's code, reproduced the published file exactly, so every change below is the clock and nothing else. ICT stays a separate, paper-only edge; nothing on the desk, the tracker or the replay was changed. `result.json` holds the new numbers.

| A-setups (net) | Before: in-sample n, R a trade, t; out-of-sample n, R a trade, t | After |
|---|---|---|
| Unfiltered baseline | 910, +0.091, 1.76; 411, +0.125, 1.72 | 922, +0.107, 2.09; 424, +0.170, 2.27 |
| Drop Friday | 772, +0.142, 2.46; 354, +0.156, 1.96: PASS (weak) | 786, +0.166, 2.91; 364, +0.205, 2.50: PASS (weak) |
| Tuesday to Thursday only | 583, +0.169, 2.50; 269, +0.217, 2.25: PASS (weak) | 590, +0.177, 2.69; 281, +0.234, 2.43: PASS (weak) |
| Sweep into an unfilled D1/H4 FVG | PASS (weak) | not picked in-sample any more |
| Drop Asia; D1 bias with | picked in-sample, FAIL out-of-sample | not picked in-sample any more |
| Greedy in-sample combination | [D1 bias with + drop Friday]: FAIL out-of-sample | [Tuesday to Thursday only]: PASS (590, +0.177, 2.69; 281, +0.234, 2.43) |
| All graded signals: valid (break-even point not taken) | FAIL out-of-sample | PASS (weak): 2,694, +0.094, 3.02; 1,259, +0.050, 1.24 |

**The verdict stays "PASS, but weak", for the Friday filter.** What changes is the second sentence of the verdict above: the FVG filter no longer comes out of the in-sample selection, so it is not a result of this study on the corrected clock. Which filters the selection picks moved with a one-hour change of the clock; that is a reason to treat every filter here as weak.
