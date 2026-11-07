# Futures rolls in the ICT desk's CNBC candles (data integrity, 7 Nov 2026)

**Verdict: real, but not where #505 suspected it.** The H1 / 5m candles the desk uses never jump at a roll, so no roll step
faked a gap, an FVG or a sweep, and no replay exit crossed a step. Three related data problems are real, and all three are fixed in
the data layer:

1. **The daily candles step at every roll.** CNBC's `@ND.1` daily series is a plain splice of front months. On the switch day it
   jumps by the calendar spread: NQ +222 to +308, ES +53 to +71, YM +314 to +433, RTY +15 to +24, GC +24 to +61 (0.6–1.7 %). That
   is 5–7× the 95th-percentile H1 gap. The jump moved the 50-day bias, and with it the A-status, of **8 replay signals**.
2. **Live, a trade open across a switch was managed against the wrong prices.** Every tracker run re-reads 24 days of the
   current contract. On the first run after a switch, the stored entry and stop are therefore one spread away from the candles.
   One replay A-trade was open across a switch (gold buy, 29 Jul 2026). The live tracker would have booked it **+1.47R instead of
   +0.40R**.
3. **The "4 Jun 2026 glitch" is the replay reading a deferred contract.** CNBC's intraday history for `.1` is the *current*
   contract's own candles (Dec 2026 on 7 Nov). Before 14 Sep (indices) or 31 Jul (gold), that contract was a back month:
   - it traded 0.01–3 % of the front month's volume;
   - H1 ranges were 0–0.8× the market's;
   - up to 100 % of H1 candles were one-print (flat), and NQ hours were missing on 4 Jun.

   **91 of the replay's 251 A-trades** were built on these candles.

Pre-registered in `preregistration.md` (pushed before any candle around a roll was looked at). Part 3 was **not** pre-registered. It
was added after the dump showed what CNBC's intraday history is (see "Stage 2" below).

## What CNBC serves (the evidence)

Data:
- **CNBC.** The raw dump `council-data research/futures-roll/cnbc.json.gz` holds 1H/5M/1D for `.1` adjusted and unadjusted, plus
  `.2`. The workflow `futures-roll-data.yml` fetched it, because CNBC refuses the sandbox. `probe.json.gz` adds the cash indices
  `.NDX .SPX .DJI .RUT`, spot `XAU=`, and the single contracts `NQZ26 ESZ26 GCZ26 GCG27`.
- **OANDA.** Mid H1 for NAS100, SPX500, US30 and XAU.

| Question | Answer | Evidence |
|---|---|---|
| Does `adjusted` back-adjust? | No: `adjusted` = `unadjusted` | 2 of ~3,000 H1 closes differ, by 1 tick. Every daily candle is identical. |
| What is the 1H/5M `.1` history? | The current contract's own candles | NQ basis to OANDA cash decays smoothly from 630 (Mar) to 96 (Nov) with no quarterly jump. `NQZ26 − @ND.1` = 0 from 14 Sep. |
| What is the 1D `.1` history? | Unadjusted front months | The basis to `.NDX` is a saw-tooth: down to ~20 points before expiry, then +200–300. `NQZ26 − @ND.1` is constant within each quarter and drops to 0 at each switch. |
| When does CNBC switch? | Indices: the Monday of the expiry week (Mon after expiry in June 2026; YM 18 Jun). Gold: the last business day before the delivery month (Oct skipped). | Daily candles vs cash-index closes and vs `NQZ26` / `GCZ26`. |
| Is the history thin before the switch? | Yes, until the switch week | Weekly hourly volume vs the front: NQ 0.02–1.6 % (Mar–Sep 7), then 62 %. YM/RTY 15–35 % flat candles in Aug. H1 range vs cash: NQ 0 (Mar–May), 0.61–0.81 (Jun–Aug), 1.00 (Sep on). |

**Daily roll steps, 2025–26** (spread in points, % of price; `result.json` `dailyRolls2025_26`). The next switches are gold about
27–30 Nov 2026 (Dec → Feb) and the indices on Mon 14 Dec 2026.

| Market | Mar 25 | Jun 25 | Sep 25 | Dec 25 | Mar 26 | Jun 26 | Sep 26 |
|---|---|---|---|---|---|---|---|
| NQ | +223 (1.11 %) | +222 (1.00) | +240 (0.98) | +263 (1.04) | +226 (0.91) | +298 (0.97, 22 Jun) | +308 (1.05) |
| ES | +57 (0.99) | +55 (0.91) | +61 (0.91) | +62 (0.90) | +53 (0.79) | +62 (0.82, 22 Jun) | +71 (0.93) |
| YM | +367 (0.87) | +345 (0.80) | +364 (0.79) | +411 (0.84) | +314 (0.66) | +376 (0.72, 18 Jun) | +433 (0.82) |
| RTY | +17.8 (0.86) | +17.1 (0.80) | +19.9 (0.82) | +21.7 (0.85) | +15.4 (0.61) | +18.6 (0.62, 22 Jun) | +23.7 (0.81) |

GC: 31 Jan 25 +24 (0.84 %), 28 Mar +30 (0.95), 4 Jun +28 (0.81), 31 Jul +56 (1.67, Aug→Dec), 28 Nov +36 (0.83),
30 Jan 26 +55 (1.17), 31 Mar +30 (0.64), 29 May +31 (0.68), 31 Jul +61 (1.47).

Non-roll H1 close-to-next-open gaps, 95th / 99th percentile: NQ 44.8 / 85, ES 6.75 / 18, YM 55 / 109, RTY 4.6 / 10, GC 8.5 / 19.9.

### The pre-registered H1 scan, and why it found no CNBC roll

`rolls.mjs` ran the pre-registered basis-step scan (CNBC H1 − OANDA H1). The steps it flagged are not CNBC rolls:
- **Thin hours.** Most flags fall in the deferred-contract months: NQ Apr–May, ES Jan–Apr 2026, with 2–17 H1 candles a day.
- **One step on 15 Sep 2026, 15–17 UTC** (ES −14, NQ −40, YM −60). This is OANDA re-basing its index CFDs. On CNBC that day,
  `ESZ26 − .SPX` reads 72.8 / 70.3 / 71.2 and the hourly ES candles are smooth.

`.2` exists but is too sparse to time a switch.

## Which replay A-setups a roll touched (`touch.mjs`)

**Signal touched: 19 A-setups.** The switch moment fell inside their signal candles (sweep − 96 H1 … inversion).
- In the replay the step is not there, because the intraday data is one contract.
- Live it cannot be there either, because each run reads one contract.

**Exit touched: 1 A-setup.** The switch fell between signal and close: gc buy 29 Jul 2026 18:00, switch 30 Jul 22:00 UTC, +54.3
points. Live, the old tracker books it +1.47R. The fixed tracker and the replay book it +0.40R / +0.45R.

**Daily bias touched: 212 of 253 A-setups.** A switch day sits inside the 50 daily candles the bias reads. 8 of these change
status (stage 1 below).

## The fix (data layer only: signals, the A-rule, sizing and exits are unchanged)

1. **`rollAdjust` (ict/tracker.mjs, live + replay).** Back-adjusts the index daily candles (Panama method).
   - A switch is a day where the futures-minus-cash basis rises by at least 0.4 % of the price and at least 8× its median daily
     change, within 10 days of a Mar/Jun/Sep/Dec expiry. Steps up to 5 days apart are summed. The cash basis comes from CNBC's own
     `.NDX .SPX .DJI .RUT` daily closes, one extra request per market per run.
   - Every candle before a switch moves up by that switch's spread, so highs minus lows (the daily ATR) are unchanged.
   - On 2024–26 it finds exactly one switch per quarter per index and nothing else.
   - Two edge cases:
     - June 2026: CNBC kept the expiring contract's thin settlement candle on 18 Jun (a lone −155 step). Merging rejects it on 18–19
       Jun, while the switch is not printed yet, and absorbs it into the switch on 22 Jun.
     - Gold has no cash series, so its daily candles stay as CNBC prints them. The gold A-rule reads only the daily ATR, which a
       roll does not move.
   - If the cash request fails, the daily candles are left unadjusted, as before.
2. **`contractShift` / `shiftTrade` (ict/tracker.mjs main, live only).** Each run compares its H1 candles with the last run's
   `bars.json` (same CNBC symbol).
   - A near-constant offset of at least 0.2 % on at least 80 % of the last 48 shared candles is a contract switch.
   - Every open trade on that market (live, `dip` and variants) moves its levels by the offset: entry, stop, stop0, t1/t2,
     signalPx, sweep, fvg, ih, dol. R is unchanged, and the trade records `rolled: [{at, by}]`.
   - The snapshot shows `switched` and the last daily roll (`d1Roll`).
3. **`liquidFrom` (ict/replay.mjs, replay only).** CNBC intraday is used only from the start of its last stretch with a daily
   median hourly volume of at least 20 % of the last 20 days'. That is 13 Sep 2026 for the indices and 27 Jul for gold.
   - The threshold hardly matters, because the weekly share jumps from ≤ 6 % to ≥ 50 % in the switch week. Any threshold from 5 %
     to 50 % cuts between the CME roll Thursday (10 Sep) and the CNBC switch (13–14 Sep) for the indices, and between 20 and 28 Jul
     for gold (`liqsens.mjs`).
   - Earlier hours go to the existing back-fill: Dukascopy for NQ/ES/YM, spot gold for GC. Where a file ends before CNBC starts,
     OANDA mid 5m (the paper markets' source) fills the gap. Today that is gold from 7 Jun, and after the December roll it will be
     the indices.
   - **RTY has no fill source, so its replay now starts 13 Sep 2026.**

## Proof: the live A stream changes only where a roll did it

**Chained tracker runs.** 2,052 runs, every 2 h from 20 May to 6 Nov 2026. Old = origin/main 632370d4, new = this branch. The
stubbed CNBC feed (`stub-live.mjs`) serves what a live run at that clock would have read:
- intraday: the dumped contract shifted to the then-front contract (`mkshifts.mjs`);
- daily: the front-month splice up to the clock;
- cash: the indices' daily closes.

There were 0 errors.

| What the desk sees | Runs that differ (of 2,052) |
|---|---|
| bars.json H1 + 5m candles | **0** |
| bars.json daily candles | all (the adjustment, by design) |
| trades.json | 1,652 (feature fields: `pd`, `pdSweep`, `htfFvg`, `cc`; plus the records below) |
| Snapshot without `d1Roll`/`switched`/`pdh`/`pdl` | 1,292 (all after 21 Jul, when the first trade record differs: totals and open counts) |

**Trade records that differ, 8 of 359.** Everything else differs only in recorded features (106 records).

| Record | Old | New | Cause |
|---|---|---|---|
| es buy 21 Jul 00:00 | non-A, 1.25R | A-setup ×0.75, 0.94R | bias with → against (roll step) |
| gc buy 29 Jul 18:00 | +1.47R | **+0.40R** | open across the 30 Jul gold switch; levels shifted +54.3 |
| es buy 3 Aug 14:00 | – | A-setup, +1.31R | bias flip |
| ym buy 21 Oct 16:00 | – | A-setup, −0.10R | bias flip |
| ym sell 22 Oct 00:00 | A-setup, 0R | – | blocked by the new 21 Oct trade |
| ym sell 27 Oct 14:00 | A-setup ×0.5 | non-A | bias against → with |
| es buy 30 Oct 20:00 | non-A, −1R | A-setup ×0.5, −0.5R | bias flip |
| rty sell 5 Nov 13:00 | A-setup, +1.68R | – | bias against → with |

- **Totals.** A: 121 trades +28.02R → 122 trades +26.92R. All: +87.44R → +86.09R.
- **Switches detected live.** gc 28 May (+50.9), nq/es 21 Jun (+246.25 / +51.75), gc 30 Jul (+54.3), nq/es/ym/rty 13 Sep (+296.75 /
  +67 / +418 / +22.4). Each matches the stubbed spread exactly.
- **Final code.** The run of the final code (with the replay-only cut and the bar volume field) is `result.json` `benchFinalCode`
  and must equal the new run above.
- **Unadjusted fallback.** New code without any cash data is identical to the old replay: all 814 trades, 0 differences.

### Replay: every historical A-setup that changes (`replay-a-changes.txt`)

Base: council-data `ict/replay.json` at 475f6bc3 (7 Nov 21:16), reproduced exactly from the dump (251 A-trades, +61.87R, 0 diffs).

**Stage 1, daily roll adjustment.** 251 A-trades, +61.87R → 251, +64.47R. All 8 changes are 50-day-bias flips:
- **Removed:** ym sell 4 Aug 2025 (cash, −0.75), ym sell 22 Oct 2026 (−0.5), ym sell 27 Oct (−0.5), rty sell 5 Nov (+2.67).
- **Added:** es buy 21 Jul 2026 (+1.05), es buy 3 Aug (+2.33), ym buy 21 Oct (+0.14), es buy 30 Oct (0).

The step tilted the bias "with" for buys and "against" for sells for about 50 days after every roll. So unadjusted candles
favoured sells.

**Stage 2, deferred-contract cut.** 251 A-trades, +64.47R → **225, +52.84R**. 124 rows are listed in the file. The others keep their R
and only move their prices by the new fill scale (NQ ×1.0084 instead of ×1.0221). In the re-sourced window:

| Market | Window | Before (deferred contract) | After (liquid back-fill) | Same signal (±1 h) |
|---|---|---|---|---|
| NQ | 4 May – 22 Sep 2026 | 18 trades, +8.22R (+0.457) | 19, +3.48R (+0.183) | 8 |
| ES | 6 May – 14 Sep | 21, +11.18R (+0.532) | 11, +3.72R (+0.338) | 6 |
| YM | 1 Jul – 14 Sep | 14, +5.44R (+0.389) | 6, +1.51R (+0.252) | 3 |
| RTY | 22 Jun – 15 Sep | 14, +7.15R (+0.511) | 0 (no fill source) | 0 |
| GC | 2 Mar – 28 Jul | 24, −0.93R (−0.039) | 21, +9.39R (+0.447) | 12 |

The deferred-contract candles made the index A-setups look better than the liquid market shows, and gold worse. Whole replay
afterwards: NQ +7.79R (48), ES +21.28 (56), YM +10.68 (53), RTY +1.66 (11), GC +11.43 (57).

Paper shadow streams in the replay, closed n and R, before → after stage 1:

| Stream | Before | After stage 1 | Cause |
|---|---|---|---|
| dip | 62, +37.6R | 68, +31.6R | the 20-day gate also reads daily closes |
| nofri | 219, +66.4R | 218, +69.0R | |
| h1opp | 176, +62.9R | 174, +59.5R | |
| strail | 253, +66.9R | 253, +69.7R | |

## Caveats

- **Stage 2 was not pre-registered.** Its threshold was set once, and any value from 5 % to 50 % moves the cut by at most a week (indices 3 days, gold 8). It replaces thin
  futures candles with liquid cash-CFD candles, which the replay already used for older months. Futures and cash give different H1
  signals anyway (~40 % of signal times match, skill §20). So the stage-2 numbers measure the data swap, not an edge.
- **The proof does not cover the YM/RTY June switch.** The dump has no then-front intraday for YM/RTY before July. Those markets
  fell back to the (unreachable) Yahoo feed in both trees until July. Their September switch is covered.
- **The back-adjusted daily series is Panama, not the current contract.** Far back it sits within ~150 NQ points (≤ 2.2 %) of the
  contract's own closes. That affects only the recorded `pd` / `pdSweep` / `htfFvg` features. In the replay's cash-fill months the
  H1 (cash × fill scale) and the daily candles still differ by a slowly drifting basis, as they did before, again features only.
- **A short unadjusted window remains each roll.** From the Sunday 18:00 switch until the cash index prints its Monday candle
  (09:30 ET), the daily candles are not yet adjusted. That is about 15 hours per roll, and signals in it read the previous day's
  bias as before.
- **Gold's daily candles are not adjusted.** Their bias, `pd` and `cc` features carry the step. The gold A-rule does not read them.

## Files

- `preregistration.md`
- Data:
  - `fetch-cnbc.mjs`, `probe-cnbc.mjs` + `.github/workflows/futures-roll-data.yml` (dumps)
  - `fetch-oanda.mjs`
- Analysis:
  - `rolls.mjs` (the pre-registered H1 scan)
  - `d1frame.mjs`, `check-adjust.mjs`, `liquidity.mjs`, `liqsens.mjs`, `ranges.mjs`, `touch.mjs`
- Proof:
  - `stub.mjs`, `stub-live.mjs`, `mkshifts.mjs`
  - `bench.mjs` + `benchdiff.mjs` (chained tracker runs)
  - `cmp.mjs`, `why.mjs`, `deferred.mjs`, `shadowdiff.mjs`, `changes.mjs`
- Results: `summary.mjs` → `result.json`, and `replay-a-changes.txt`.
- Tests: `tests/ict-roll.test.mjs`, with real CNBC NQ/NDX/NQZ26 daily candles of Aug–Oct 2026 in `tests/fixtures/`.
