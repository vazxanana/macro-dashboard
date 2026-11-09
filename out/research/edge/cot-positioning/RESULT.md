# COT positioning: does large-speculator positioning predict 1- and 4-week returns?

**Verdict: FAIL. No pooled positioning signal (1-year or 3-year crowding, weekly flow, or 90/10 extremes) passed in and out of sample at 1 or 4 weeks. Two single-market cells passed the pre-registered bar (AUD/USD extremes over 4 weeks, GBP/USD extremes over 1 week); gold has no edge either way, as the prior said.**

- **Pooled, every hypothesis fails.** The pooled information coefficients (IC) are all between −0.05 and −0.01, with no |t| above 2 in or out of sample. Crowding leans the expected (contrarian) way, but too weakly to matter: 3-year crowding over 4 weeks is IC −0.017 in sample (t −0.31) and −0.051 out of sample (t −1.03).
- **Flow does not follow.** The weekly change in positioning has a slightly *negative* IC at both horizons, the opposite of the "follow the funds" hypothesis (whole sample, 4 weeks: −0.035, t −1.98).
- **Extremes** (the desk's "extreme" signal, 90th / 10th percentile of 3 years) are right 55% of the time out of sample, for +0.05% per case over 4 weeks (t 0.26).
- **Gold.** The macro skill's prior was "COT crowding had about no edge for gold (IC +0.01)". It holds, but the sign is unstable:
  - In sample, 3-year crowding over 4 weeks reads contrarian (IC −0.20, t −1.44).
  - Out of sample it flipped to momentum (IC +0.33, t 2.12). Crowded-long gold kept rising in the 2024–26 bull run.
  - Fading gold's extremes out of sample was right 26% of the time, at −2.14% per case (t −3.1).
  - Over the whole sample: 1-year crowding IC +0.04 (t 0.44), 3-year +0.16 (t 1.39), by year from −0.42 (2023) to +0.48 (2025). That is no stable edge in either direction.
- **Per market (decides the desk's `edge` flag).**
  - **AUD/USD, extremes over 4 weeks:** in sample 15 cases, 87% right, +1.84% (t 3.12); out of sample 49 cases, 71% right, +0.93% (t 2.51). This is the strongest cell, and the in-sample n sits exactly at the minimum.
  - **GBP/USD, extremes over 1 week:** in sample 31 cases, 77% right (t 2.75); out of sample 35 cases, 57% right, +0.10% (t 0.6). It passes the letter of the bar (mean > 0, hit ≥ 55%) but is weak out of sample.
  - The other eight markets: `edge: none`.
  - 80 per-market cells were run (10 markets × 4 hypotheses × 2 horizons). Both passing cells are extremes in dollar pairs, which share the dollar factor, so treat them as two looks at related things, not as two independent confirmations.
- **H5 (extremes with commercials on the other side) was NOT RUN.** The council's cache kept only the speculators' positions. `council/cot.mjs` now also parses the commercials (TFF dealers; Disaggregated producer / merchant plus swap dealers), so the next full CFTC re-fetch makes H5 runnable. Re-running `run.mjs` then fills it in, under the same bars.

Nothing live changes. The desk now shows, per market, `edge: tested` (AUD, GBP) or `edge: none`, and a COT signal counts as an edge on the desk only if this study's matching cell passed.

## Data, timing and splits

- **Positions:** CFTC COT futures-only from the Public Reporting Environment, as cached by the council (council-data `macro/cot-raw.json`, fetched 2026-11-08). The data runs 2019-01-08 to 2026-11-03: 409 weekly reports for each of the 10 markets, with no missing week and no duplicate report date.
  - Gold: Disaggregated managed money, `088691`.
  - FX and index futures: TFF leveraged funds.
- **Prices:** council OANDA daily closes, weekdays only.
- **Direction:** returns are in the futures' direction (USD/JPY, USD/CAD and USD/CHF sign-flipped).
- **Timing:** a report counts as known from 00:00 UTC of the first Monday after its as-of date. Entry is the next weekday close (normally the Tuesday). 1 week = 5 weekday closes, 4 weeks = 20.
- **Late-published weeks excluded:** as-of dates 2025-09-30 to 2026-01-27, the shutdown backlog that the CFTC published on a catch-up schedule.
- **In sample:** as-of dates 2020-01 to 2023-12. The 3-year percentile is only available from 2022-01, so it has 104 in-sample weeks.
- **Out of sample:** as-of dates 2024-01 to 2026-09-29, the last report with a full 4-week window. That is about 126–129 weeks.
- **Statistics:**
  - Spearman IC; t-stats are Newey-West with lag 2 (1 week) and 6 (4 weeks).
  - The pooled IC averages the rank products across markets within each week before the t is taken, so the shared dollar factor is not counted ten times.
  - The t for extreme events allows for overlapping forward windows.

## Primary tests (pooled over the 10 markets)

| Test | Expected | IS IC (t), weeks | OOS IC (t), weeks | Verdict |
|---|---|---|---|---|
| H1 1-year crowding, 1w | < 0 | −0.027 (−1.03), 208 | −0.019 (−0.63), 129 | FAIL |
| H1 1-year crowding, 4w | < 0 | −0.012 (−0.32), 208 | −0.050 (−0.99), 126 | FAIL |
| H2 3-year crowding, 1w | < 0 | −0.022 (−0.55), 104 | −0.015 (−0.50), 129 | FAIL |
| H2 3-year crowding, 4w | < 0 | −0.017 (−0.31), 104 | −0.051 (−1.03), 126 | FAIL |
| H3 weekly flow, 1w | > 0 | −0.028 (−0.97), 207 | −0.011 (−0.35), 129 | FAIL |
| H3 weekly flow, 4w | > 0 | −0.043 (−1.95), 207 | −0.031 (−1.06), 126 | FAIL |

Pooled extremes (H4: −1 at or above the 90th percentile of 3 years, +1 at or below the 10th):

| Test | IS events, hit, mean / week, t | OOS events, hit, mean / week, t | Verdict |
|---|---|---|---|
| H4 extremes, 1w | 228, 54%, +0.02%, 0.11 | 443, 50%, +0.01%, 0.13 | FAIL |
| H4 extremes, 4w | 228, 56%, +0.08%, 0.19 | 432, 55%, +0.05%, 0.26 | FAIL |
| H5 extremes with commercials opposite | not run (commercial positions not in the cache) | | NOT RUN |

## Per market (4-week crowding, 1-week flow, 4-week extremes)

IC (t), in sample / out of sample. Extremes: cases / hit rate / mean per case (t).

| Market | H1 1y crowding 4w | H2 3y crowding 4w | H3 flow 1w | H4 extremes 4w, IS | H4 extremes 4w, OOS | Cells passed |
|---|---|---|---|---|---|---|
| Gold | −0.12 (−1.18) / +0.18 (1.33) | −0.20 (−1.44) / +0.33 (2.12) | +0.04 (0.53) / +0.03 (0.39) | 34 / 50% / +0.15% (0.14) | 47 / 26% / −2.14% (−3.1) | none |
| EUR/USD | +0.13 (1.25) / −0.01 (−0.11) | +0.09 (0.64) / −0.07 (−0.48) | −0.04 (−0.51) / +0.04 (0.54) | 12 / 50% / −0.25% (−0.24) | 44 / 59% / +0.08% (0.22) | none |
| GBP/USD | −0.17 (−1.55) / −0.28 (−2.0) | −0.24 (−1.7) / −0.18 (−1.27) | −0.04 (−0.47) / −0.00 (−0.04) | 31 / 65% / +1.33% (1.87) | 33 / 61% / +0.43% (0.91) | H4-1w |
| USD/JPY | +0.03 (0.28) / +0.04 (0.26) | +0.12 (0.81) / −0.01 (−0.08) | −0.13 (−1.91) / +0.03 (0.36) | 20 / 30% / −1.92% (−1.91) | 61 / 48% / +0.51% (0.79) | none |
| AUD/USD | −0.08 (−0.75) / −0.34 (−2.88) | −0.18 (−1.37) / −0.29 (−2.35) | −0.03 (−0.38) / −0.03 (−0.31) | 15 / 87% / +1.84% (3.12) | 49 / 71% / +0.93% (2.51) | **H4-4w** |
| NZD/USD | +0.02 (0.19) / −0.09 (−0.64) | +0.01 (0.08) / −0.14 (−0.89) | −0.04 (−0.58) / −0.02 (−0.23) | 11 / 55% / +1.06% (0.78) | 54 / 57% / −0.02% (−0.04) | none |
| USD/CAD | −0.19 (−1.76) / −0.08 (−0.5) | −0.12 (−0.76) / −0.15 (−1.03) | −0.04 (−0.52) / −0.20 (−2.36) | 20 / 55% / +0.18% (0.35) | 52 / 48% / −0.08% (−0.3) | none |
| USD/CHF | +0.13 (1.4) / −0.10 (−0.67) | +0.07 (0.43) / −0.28 (−1.72) | +0.09 (1.26) / +0.10 (1.1) | 20 / 65% / +0.67% (1.38) | 38 / 76% / +1.53% (2.46) | none |
| Nasdaq 100 | +0.03 (0.27) / +0.05 (0.41) | +0.25 (1.61) / +0.10 (0.94) | −0.05 (−0.67) / −0.04 (−0.51) | 21 / 43% / −3.01% (−1.55) | 42 / 60% / +0.80% (0.86) | none |
| S&P 500 | +0.09 (0.73) / +0.13 (1.06) | +0.03 (0.17) / +0.17 (1.25) | −0.04 (−0.52) / −0.02 (−0.18) | 44 / 61% / +0.43% (0.37) | 12 / 50% / −0.80% (−0.49) | none |

All 80 cells, with whole-sample ICs and per-market base rates, are in `result.json` (`markets`).

- In the FX majors, crowding mostly leans contrarian out of sample: GBP, AUD, NZD, CAD and CHF all have negative 3-year ICs over 4 weeks.
- But none clears |t| ≥ 2 in sample, and only AUD clears 1.65 out of sample (t −2.35).
- In the index futures, the IC is positive in both windows (crowded long kept going), the opposite of the hypothesis.
- USD/CHF's extremes did well out of sample (76%, t 2.46) but not in sample (t 1.38), so the cell fails. This is the signal whose overlapping-window t of 3.2 had made it a desk "edge" before (see below).

## Pre-declared diagnostics (do not change a verdict)

- **Old timing and naive t (what the desk did before this change).** The old rule entered at report + 6 days for every week, counted Sunday stubs as days, kept the late weeks and used the naive t. This diagnostic uses H4 over 4 weeks, 2020+.
  - The naive t was 3.92 for GBP, 4.51 for CHF and 3.03 for AUD.
  - Under this study's timing with the overlap-robust t: 1.98, 2.73 and 3.50.
  - Gold: −2.48 → −1.90.
  - For GBP and CHF the overlap correction roughly halves t.
  - AUD rises: 9 of its cases fall in late-published weeks and are dropped (73 → 64), and the horizon is now a full 20 weekdays.
  - Both sides of this comparison use the 3-year percentile only once 156 reports exist.
- **OI-normalised 3-year percentile, 4w pooled:** IC −0.010 (t −0.17) in sample, −0.042 (t −0.87) out of sample. Scaling by open interest does not rescue it.
- **Quintiles of the 3-year percentile, pooled 4w mean return (2020–26):** 0–20: +0.17%, 20–40: +0.05%, 40–60: +0.27%, 60–80: +0.25%, 80–100: +0.39%. The pattern is not monotonic, and the most crowded-long quintile did best.
- **Gold, H2 4-week IC by year:** 2022 −0.04, 2023 −0.42, 2024 −0.00, 2025 +0.48, 2026 +0.16. The sign is regime-bound.

## Limits

- **Short history.** It runs from 2019 because that is what the council caches. The 3-year percentile has only 104 in-sample weeks. CFTC TFF and Disaggregated history go back to 2006, but CFTC does not resolve from the research sandbox. A long-history replication needs the `macro-gold` GitHub Actions pattern; this verdict does not cover it.
- **The disclosure in `preregistration.md` applies.** The desk's whole-sample hit rates for its two fixed signals were visible before this was written. No IC, split or 1-year number was.
- **The late-week window is a conservative estimate.** CFTC's backlog calendar could not be checked from the sandbox, so the window is wide by design.

## Run

`node research/edge/cot-positioning/run.mjs <council-data checkout>` writes `result.json`, which records the SHA-256 of every input file. Features, `knownAt`, `isLate`, `weekdays` and `overlapT` come from `council/cot.mjs`, so the desk and the study read the data the same way. The desk reads `result.json` `desk` for its per-market `edge`.
