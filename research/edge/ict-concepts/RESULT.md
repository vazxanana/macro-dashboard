# New ICT entry concepts: turtle soup at equal highs/lows, "lows that broke highs", NWOG/NDOG fill (edge research, ict-concepts)

> **Clock correction, 10 Nov 2026.** Re-run on the corrected candle clock. The verdict is unchanged: no concept becomes a paper candidate. The live A-rule row improved a little (2018-26: 1,129 trades at +0.101R, t 2.21, became 1,150 at +0.122R, t 2.74). Details: the last section of this page.

**Verdict: FAIL. No concept becomes a paper candidate.** Nothing on the desk changes. The live A-stream, the tracker and the replay are untouched: this study adds files under `research/edge/ict-concepts/` only.

The paper-candidate bar was n ≥ 30, |t| ≥ 2 and positive in both halves, over the replay window (1 Aug 2025 – Nov 2026). In that window every concept is flat or negative. Two of them, the stop-floor versions of the two turtle soups, clear the bar on 2018 – Jul 2025 history and then lose in the window. They are worth a re-test once the window is longer. They are not a candidate now.

## Concepts (fixed from the ICT skill before any result was seen)
All three run on closed H1 candles, with daily candles for context. Every stop is 2 ticks beyond the sweep extreme, with risk capped at 0.75× the daily ATR (the A-rule's cap). Sells mirror buys.

- **eqts: turtle soup at relative equal lows/highs** (skill §1, §5).
  - Two or more unswept confirmed H1 pivot lows (3 bars each side, last 96 H1 candles) within 0.1× the daily ATR form a pool.
  - An H1 candle trades below the whole pool. Within 3 candles, an H1 candle closes back above it: buy at that close.
- **lbh: "the low that broke the high"** (skill §5).
  - An H1 candle closes above the last confirmed H1 swing high. The lowest low from that swing high to the break is the stop pool, live for 96 H1 candles.
  - An H1 candle trades below it, and within 3 candles one closes back above it: buy at that close.
- **gap: NWOG / NDOG fill** (skill §1).
  - The first H1 candle after a session break of ≥ 2 h (the weekend = NWOG; the 17:00 ET halt = NDOG) opens ≥ 0.1× the daily ATR from the prior close.
  - If that candle has not filled the gap, enter at its close toward the fill. The stop goes beyond the candle's extreme and the target is the prior close.
- **Filters**, each its own stream:
  - `raw`: no filter.
  - `ict`: the skill's LTP filter (§5, §12). The daily bias must be with the trade (prior close vs its 50-day average), and the entry must sit in the discount half for buys (premium half for sells) of the last 20 daily candles.
  - `floor`: the A-rule's stop band, 0.3–0.75× the daily ATR. This was added after the first run, which showed NDOG "winners" with 0.005× ATR stops on stub candles. Treat it as a secondary check.
- **Exits.**
  - eqts and lbh use the desk's live exit through `replay.mjs simulate()`, unchanged: break-even at +1.5R on indices, a 1.5R trail from +2R, and out after 36 H1 candles.
  - gap uses target / stop / 36 H1 candles, stop first on a tie.
- **Sizing and trade count.** Unit size. One open trade per market per stream.
- **Costs** per round trip: NQ 1 pt, ES 0.5, YM 2, GC 0.30. All R below is net.

## Data
CNBC and Yahoo, the replay's sources, are not reachable from the research sandbox. The candles are therefore the replay's own fill files in council-data `research/candles/`:
- HistData M1: NSXUSD for NQ, SPXUSD for ES, XAUUSD for GC, up to 30 Oct 2026.
- Dukascopy 5m: USA30 for YM, up to 5 Nov 2026. It has a hole from 1 to 28 Jan 2026.

RTY has no history there before Sep 2026, so it is not tested.

Bars are built as the replay sees them: 5m without the 17:00 ET halt, H1 from 5m, D1 per 18:00-ET day.

**Calibration.** The live A-rule on these candles makes **+0.205R a trade (n 234, t 2.05, both halves +)**. The CNBC replay shows +0.296R (n 253). Cash proxies are close enough to judge the concepts, but they are not futures. Opening gaps in particular differ between cash CFDs and futures.

## Window: 1 Aug 2025 – Nov 2026 (halves split 21 Mar 2026), net R

| stream | n | win% | R/trade | total R | max DD | t | 1st half n / R/tr / R | 2nd half n / R/tr / R | NQ | ES | YM | GC | bar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A (live rule, sized) | 234 | 42% | +0.205 | +48.0 | 9.4 | 2.05 | 123 / +0.220 / +27.0 | 111 / +0.189 / +21.0 | 54 / +0.304 / +16.4 | 62 / +0.167 / +10.4 | 47 / +0.353 / +16.6 | 71 / +0.065 / +4.6 | (baseline) |
| eqts-raw | 329 | 30% | +0.006 | +1.9 | 34.6 | 0.05 | 162 / +0.023 / +3.8 | 167 / -0.011 / -1.8 | 75 / +0.219 / +16.4 | 76 / -0.109 / -8.3 | 74 / +0.221 / +16.4 | 104 / -0.217 / -22.5 | fail |
| eqts-ict | 40 | 20% | -0.476 | -19.0 | 19.0 | -2.77 | 16 / -0.680 / -10.9 | 24 / -0.340 / -8.2 | 8 / -0.702 / -5.6 | 10 / -0.748 / -7.5 | 3 / -0.121 / -0.4 | 19 / -0.294 / -5.6 | fail |
| eqts-floor | 72 | 24% | -0.296 | -21.3 | 21.3 | -1.99 | 39 / -0.393 / -15.3 | 33 / -0.181 / -6.0 | 17 / -0.337 / -5.7 | 16 / -0.796 / -12.7 | 18 / -0.287 / -5.2 | 21 / +0.112 / +2.4 | fail |
| lbh-raw | 757 | 33% | +0.067 | +50.9 | 36.3 | 0.98 | 370 / +0.135 / +50.0 | 387 / +0.002 / +0.9 | 207 / -0.025 / -5.2 | 201 / +0.099 / +19.9 | 151 / +0.170 / +25.7 | 198 / +0.053 / +10.4 | fail |
| lbh-ict | 92 | 32% | -0.005 | -0.4 | 15.4 | -0.03 | 43 / +0.170 / +7.3 | 49 / -0.158 / -7.7 | 30 / +0.176 / +5.3 | 25 / -0.101 / -2.5 | 10 / +0.309 / +3.1 | 27 / -0.233 / -6.3 | fail |
| lbh-floor | 162 | 33% | -0.065 | -10.5 | 26.4 | -0.59 | 87 / +0.026 / +2.2 | 75 / -0.170 / -12.8 | 47 / -0.087 / -4.1 | 45 / -0.471 / -21.2 | 35 / +0.301 / +10.5 | 35 / +0.121 / +4.2 | fail |
| gap-nwog | 121 | 31% | -0.229 | -27.7 | 38.1 | -1.67 | 54 / -0.586 / -31.7 | 67 / +0.059 / +3.9 | 30 / -0.443 / -13.3 | 34 / -0.046 / -1.6 | 32 / -0.009 / -0.3 | 25 / -0.503 / -12.6 | fail |
| gap-ndog | 131 | 34% | +0.453 | +59.3 | 28.1 | 1.06 | 50 / +1.598 / +79.9 | 81 / -0.254 / -20.6 | 43 / +1.029 / +44.2 | 49 / +0.176 / +8.6 | 19 / +0.168 / +3.2 | 20 / +0.163 / +3.3 | fail |

The `ict+floor` streams and the gap `floor` streams have n < 30 in the window (6, 16, 9 and 1 trades). They are in `result.json`.

**gap-ndog** looks positive only because of stub-candle artifacts:
- The three biggest trades (+37R, +33R, +20R) had stops of 0.005–0.009× the daily ATR, on the first, nearly flat CFD candle after the daily break.
- Without its 5 biggest trades it is **−41.1R over 126 trades**, with a median of −1R.
- With the A-rule's stop floor it leaves one trade in the window, and loses −0.39R a trade over 2018–25 (n 46).

## Out-of-window check: 2018 – Jul 2025 (NQ, ES, GC), net R

| stream | n | win% | R/trade | total R | max DD | t | halves (R) | bar |
|---|---|---|---|---|---|---|---|---|
| A (live rule, sized) | 1129 | 38% | +0.101 | +113.7 | 35.3 | 2.21 | +11.4 / +102.3 | (baseline) |
| eqts-raw | 1622 | 31% | -0.023 | -37.0 | 81.2 | -0.52 | -18.4 / -18.6 | fail |
| eqts-ict | 160 | 36% | +0.294 | +47.0 | 12.4 | 1.80 | +38.0 / +9.0 | fail |
| **eqts-floor** | 296 | 42% | +0.243 | +71.9 | 14.5 | 2.48 | +30.4 / +41.5 | pass here, **fails the window (−0.296R, t −1.99)** |
| lbh-raw | 3427 | 33% | -0.010 | -34.7 | 122.8 | -0.35 | -59.0 / +24.4 | fail |
| lbh-ict | 361 | 32% | +0.040 | +14.3 | 24.3 | 0.40 | -1.3 / +15.6 | fail |
| **lbh-floor** | 765 | 40% | +0.147 | +112.4 | 21.0 | 2.57 | +51.5 / +60.9 | pass here, **fails the window (−0.065R, t −0.59)** |
| gap-nwog | 396 | 32% | -0.242 | -96.0 | 104.4 | -2.99 | -38.3 / -57.6 | fail (fading the weekend gap loses) |
| gap-ndog | 1235 | 30% | +0.168 | +207.6 | 96.5 | 1.43 | -12.6 / +220.2 | fail (stub-candle artifacts) |

## Reading
- **Tight-stop sweeps lose; the A-rule's stop band (0.3–0.75× ATR) is what made the turtle soups work over 2018–25.** This is the same lesson as the A-rule's own skill §20. Raw, both turtle soups are noise.
- **The skill's "with the bias + right half of the range" filter did not help.** It cut the trades to a handful and turned eqts negative in the window (−0.476R, t −2.77). The desk's A-rule takes iFVGs *against* the daily bias, so the filter may run the wrong way for H1 sweeps on indices.
- **Fading the NWOG loses in both periods.** The weekend gap tends to extend, not fill, within 36 H1 candles.
- eqts-floor and lbh-floor are the only ideas worth another look. They held for 7 years on NQ/ES/GC and failed the last 15 months. A re-run of `run.mjs` with a longer window (or on CNBC candles) can re-test them. Until then they stay off the desk.
- Multiple testing: 3 concepts × up to 4 filters = 13 streams were looked at per period. A single |t| ≈ 2 pass would be expected by chance.

## Reproduce
```
node research/edge/ict-concepts/run.mjs <council-data research/candles> window window.json
node research/edge/ict-concepts/run.mjs <council-data research/candles> long long.json   # --max-old-space-size=12000
node research/edge/ict-concepts/report.mjs window.json long.json   # writes result.json, prints the tables
```

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`. This study used the documented "EST, no daylight saving" reading (label + 5 hours all year), which is one hour late for the whole of Europe's summer, about seven months a year.

**Re-run on the corrected clock on 10 Nov 2026. No rule, parameter, filter or cost was changed.** A control run of the old loader on the same day, with today's code, reproduced every pass / fail field of the published file (20 of 1,366 numbers differ slightly: the code moved a little since the first run). ICT stays a separate, paper-only edge; nothing on the desk, the tracker or the replay was changed. `result.json` holds the new numbers.

| Row | Before: n, R a trade, t | After |
|---|---|---|
| Live A-rule, replay window | 235, +0.201, 2.02 | 239, +0.238, 2.35 |
| Live A-rule, 2018-26 | 1,129, +0.101, 2.21 | 1,150, +0.122, 2.74 |
| gap-ndog, 2018-26 | 1,235, +0.168, 1.43 | 916, +0.180, 1.57 |
| lbh-floor, 2018-26 | 765, +0.147, 2.57 | 767, +0.128, 2.22 |
| eqts-floor, 2018-26 | 296, +0.243, 2.48 | 301, +0.250, 2.48 |

No pass / fail field changed. The day-open gap concepts (NDOG, NWOG) lose the most trades, as they should: they are defined by the 17:00 and 18:00 New York hours, which the old clock put an hour late in summer. **The verdict is unchanged: FAIL.**
