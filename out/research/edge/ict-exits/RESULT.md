# ICT iFVG exits: what to do after entry (edge research, ict-exits)

> **Clock correction, 10 Nov 2026.** Re-run on the corrected candle clock (`detail.json`, `table.txt`). The first run's summary in `result.json` and the text below are on the old clock. No exit variant is chosen in either run. Details: the last section of this page.

**Verdict: FAIL. The live exit stays.** No exit variant beat the current one in-sample by more than noise. The variants that did best out-of-sample (fixed 4R target, half off at 2R and hold the rest) lost to the live exit in-sample, so picking them would be hindsight.

## Setup
- **Entries.** The live tracker's own `signals()`, `isASetup()` and `sizeOf()` from `ict/tracker.mjs` (post-#413), imported unchanged. Grade F was dropped (`MIN_GRADE`). Every signal is its own trade, and every exit variant uses the same entries.
- **Data.** HistData M1 from Jan 2018 to Oct 2026. This is the longest history we have:
  - NSXUSD (Nasdaq 100 cash) stands in for NQ.
  - SPXUSD (S&P 500 cash) stands in for ES.
  - XAUUSD spot stands in for GC.
- **Bars.** H1 and D1 are built from M1. The H1 candle in the 17:00 ET halt is dropped, as the tracker does, and the day rolls at 22:00 UTC.
- **Exit simulation.** Exits run on M1 candles. The stop is checked before a candle's own extreme moves the MFE, break-even or trail, as the replay does. When one candle hits both the stop and a target, the stop counts.
- **Costs.**

  | Market | Cost per trade |
  |---|---|
  | Nasdaq 100 | 1.0 pt |
  | S&P 500 | 0.5 pt |
  | Gold | 0.30 |

  The median cost is about 0.02R. All numbers below are **net**; gross is in `detail.json`.
- **Walk-forward.**
  - In-sample (IS) is 2018–2023. Out-of-sample (OOS) is 2024 to Oct 2026.
  - The exit was chosen on IS only.
  - R is 1R per trade (unit size), so only the exit differs. Results with live sizing (§25/§27) are in `detail.json`.
- **Live exit (baseline).**
  - The stop sits 2 ticks beyond the sweep.
  - Index markets move the stop to break-even (BE) at +1.5R. Gold has no BE.
  - From +2R the stop trails 1.5R behind the best price.
  - The trade closes after 36 closed H1 candles.
- **Variants tried: 24 exits × 4 entry groups = 96 comparisons.**
  - Time exit after 12, 24 or 48 bars.
  - BE none, +1R or +1.5R with the trail.
  - Fixed 2R, 3R or 4R targets, each with BE none, +1R or +1.5R.
  - Half off at 2R, then the runner either trails, aims for 4R, or is held to the time exit (BE after the partial in all three).
  - Opposing-liquidity targets: the previous-day high/low (PDH/PDL), the last 3 sessions' highs/lows, and the next H1 swing (the draw on liquidity, DOL). Each must be untaken and at least 1R away; otherwise the live trail applies.
  - Stop placement: a mid stop (halfway from the sweep to the iFVG), a tight stop (beyond the iFVG) and a fail stop (an H1 body closes back through the iFVG, with the hard stop at the swing).

## A-setups (all three markets, the desk's default view)
| Exit | IS n | IS exp | IS R | IS DD | IS t | OOS n | OOS exp | OOS R | OOS DD | OOS t | OOS years + |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Live (baseline)** | 971 | +0.088 | +85.1 | 34.5 | 1.77 | 440 | **+0.145** | +63.7 | 16.5 | 2.05 | 3/3 |
| BE +1.5R everywhere (IS pick) | 971 | +0.090 | +87.6 | 33.8 | 1.84 | 440 | +0.129 | +56.8 | 16.5 | 1.84 | 3/3 |
| Trail, no BE | 971 | +0.085 | +82.9 | 37.8 | 1.68 | 440 | +0.141 | +61.8 | 15.7 | 1.98 | 3/3 |
| Trail, BE +1R | 971 | +0.067 | +65.5 | 25.9 | 1.53 | 440 | +0.060 | +26.6 | 17.2 | 0.94 | 3/3 |
| Time 12 bars | 971 | +0.005 | +5.2 | 39.1 | 0.16 | 440 | +0.052 | +22.7 | 17.8 | 0.96 | 3/3 |
| Time 24 bars | 971 | +0.055 | +53.3 | 29.9 | 1.27 | 440 | +0.126 | +55.6 | 16.5 | 1.89 | 3/3 |
| Time 48 bars | 971 | +0.063 | +61.5 | 32.8 | 1.25 | 440 | +0.152 | +67.0 | 17.9 | 2.04 | 3/3 |
| Fixed 2R | 971 | +0.047 | +46.0 | 28.4 | 1.12 | 440 | +0.139 | +61.0 | 14.4 | 2.15 | 3/3 |
| Fixed 3R | 971 | +0.040 | +38.5 | 31.3 | 0.83 | 440 | +0.170 | +74.9 | 14.7 | 2.29 | 3/3 |
| Fixed 4R | 971 | +0.068 | +65.9 | 34.6 | 1.30 | 440 | +0.196 | +86.5 | 13.7 | 2.44 | 3/3 |
| Fixed 4R, BE +1.5R | 971 | +0.066 | +64.6 | 29.0 | 1.36 | 440 | +0.193 | +84.9 | 15.2 | 2.49 | 3/3 |
| Half at 2R, runner trails | 971 | +0.072 | +70.3 | 30.1 | 1.65 | 440 | +0.138 | +60.7 | 16.4 | 2.11 | 3/3 |
| Half at 2R, runner held to 36 bars | 971 | +0.071 | +68.5 | 27.6 | 1.55 | 440 | +0.180 | +79.1 | 15.8 | 2.51 | 3/3 |
| Target PDH/PDL | 971 | +0.041 | +40.2 | 27.7 | 0.91 | 440 | +0.159 | +70.2 | 17.8 | 2.19 | 3/3 |
| Target session high/low | 971 | +0.074 | +71.7 | 36.7 | 1.62 | 440 | +0.123 | +54.0 | 18.9 | 1.89 | 3/3 |
| Target DOL (next H1 swing) | 971 | +0.040 | +38.6 | 26.6 | 0.91 | 440 | +0.136 | +59.6 | 17.1 | 2.04 | 3/3 |
| Mid stop | 971 | −0.022 | −21.5 | 57.4 | −0.45 | 440 | +0.113 | +49.7 | 17.2 | 1.47 | 3/3 |
| Tight stop (beyond iFVG) | 971 | −0.020 | −19.7 | 74.6 | −0.37 | 440 | +0.107 | +47.0 | 21.1 | 1.25 | 3/3 |
| Fail stop | 971 | +0.008 | +7.3 | 38.0 | 0.19 | 440 | +0.104 | +45.9 | 16.3 | 1.71 | 3/3 |

Live exit by year (net R): 2018 −10, 2019 +15, 2020 +26, 2021 −8, 2022 +32, 2023 +30, 2024 +22, 2025 +28, 2026 +14.

### Walk-forward picks (chosen on IS only)
| Group | IS pick (by exp and by R/DD) | IS vs live | OOS exp, pick vs live |
|---|---|---|---|
| A, all markets | BE +1.5R on gold too | +0.003R/trade (t 0.4) | +0.129 vs **+0.145** |
| A, index only | half at 2R, runner held to 36 bars | +0.002R/trade (t 0.07) | +0.187 vs +0.141 (DD 18.6 vs 18.0) |
| A, gold | BE +1.5R / fixed 4R with BE +1R | +0.006 / −0.03 | +0.111 / +0.122 vs **+0.150** |
| All signals | trail, no BE | +0.010 (t 1.9) | +0.040 vs +0.036 |

- **Index-only pick (half at 2R, hold the rest).** It meets the letter of the candidate rule: OOS n 263, 3 of 3 OOS years positive, and better OOS. It is still **not a candidate**:
  - its in-sample edge over the live exit is zero (t 0.07);
  - its OOS gain is +0.045R per trade with t 1.0;
  - its drawdown is not smaller;
  - the same rule is worse in-sample on gold and on all markets pooled.
- With 96 comparisons, that is what noise looks like.

## What the data says about each exit idea
- **Time exit.** 36 bars is at the top or tied in-sample.
  - 12 bars is clearly worse (−0.08R per trade, t −2.4 IS and −2.2 OOS).
  - 24 bars is worse.
  - 48 bars is slightly worse IS and equal OOS.
- **Break-even.** BE at +1R hurts: OOS −0.084R per trade, t −2.9; on gold −0.11R per trade. BE at +1.5R is neutral, within ±0.02R.
  - The live split stays: BE on index markets, none on gold.
- **Fixed targets.** 2R, 3R and 4R lose to the trail in-sample: −0.02 to −0.05R per trade, with t down to −2.5.
  - All three beat it in 2024–26, a trending stretch. 4R is the best OOS exit (+0.196 vs +0.145).
  - This is a regime effect, not a rule we can choose ahead of time.
- **Partial at 2R plus runner.** It costs R in-sample and smooths drawdown only slightly (index IS DD 22.8 vs 29.2 with the runner trailing). Out-of-sample it is about even or a little better. Not robust.
- **Opposing-liquidity targets.** The previous-day high/low, session high/low and DOL targets are all at or below the trail in-sample.
  - The DOL target loses most on gold (IS −0.10R per trade, t −2.3).
  - This agrees with §27: a target at liquidity cuts the right tail that pays for the model.
- **Stop placement.** A tighter stop (mid, iFVG, or the fail stop) is clearly worse in-sample (−0.08 to −0.11R per trade, t −1.9 to −2.9), with larger drawdowns.
  - The sweep-extreme stop stays. This repeats the "tight stops get hunted" lesson (§20/§22).

## MFE / MAE (A-setups, swing stop, 36 H1 bars, n 1411)
- **Reach before the stop.** Share of trades that touch each level before the stop is hit:

  | Level | Share |
  |---|---|
  | 1R | 52% |
  | 1.5R | 37% |
  | 2R | 28% |
  | 3R | 14% |
  | 4R | 8.6% |

  Median MFE before the stop is 1.05R (p75 2.16R, p90 3.73R).
- **Stopped out.** 58% of A-setups hit the full swing stop within 36 bars.
- **Live-exit winners** (n 553). Median MAE −0.37R (p10 −0.84R); median MFE 2.36R.
- **Live-exit losers** (n 858). Median MFE 0.46R. 23% of them were +1R at some point. That is why BE at +1R looks tempting, but it hurts: it stops out too many trades that later win.
- **Index A-setups versus gold A-setups.** Index trades have fatter tails (10% reach 4R) and gold thinner ones (6.8%). That fits gold preferring the trail with no BE.

## Caveats
- Cash CFDs and spot gold stand in for futures. H1 signals depend on the data feed (§19).
- Index A-setups are weak in 2018–23 on this data (+0.041R per trade, t 0.65). The entry edge, not the exit, is the main uncertainty.
- Every signal is its own trade. The live one-open-per-market rule is not applied, because it would make the entry sets differ between exits.

## Files
- `sim.mjs`: signals and exit engine. Run with `node sim.mjs <candles dir> nas|spx|xau out.json`. Input is council-data `research/candles/{nsxusd,spxusd,xau}-histdata`.
- `analyse.mjs`: statistics, walk-forward picks, paired differences against the live exit, MFE/MAE.
- `table.txt`: full output for the 4 groups × 24 variants.
- `detail.json`: every statistic, including gross, per year, paired tests and live sizing.
- `result.json`: summary in the standard format.

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`. This study used the documented "EST, no daylight saving" reading (label + 5 hours all year), which is one hour late for the whole of Europe's summer, about seven months a year.

**Re-run on the corrected clock on 10 Nov 2026. No rule, parameter, filter or cost was changed.** A control run of the old loader on the same day, with today's code, reproduced `detail.json` and `table.txt` exactly. ICT stays a separate, paper-only edge; nothing on the desk, the tracker or the replay was changed. `detail.json` and `table.txt` hold the new numbers. `result.json` is the first run's hand-written summary and was left as it is: read its numbers as old-clock numbers.

| All A-setups, net | Before: in-sample n, R a trade, t; out-of-sample n, R a trade, t | After |
|---|---|---|
| Live exit | 971, +0.088, 1.77; 440, +0.145, 2.05 | 986, +0.097, 1.97; 449, +0.179, 2.45 |
| The in-sample pick (`trail_be15`) | 971, +0.090, 1.84; 440, +0.129, 1.84 | 986, +0.100, 2.05; 449, +0.161, 2.23 |

The in-sample pick is the same variant as before and again loses to the live exit out-of-sample (−0.017R a trade, t −2.07). On the index book alone the in-sample pick is now the live exit itself. **The verdict is unchanged: FAIL, the live exit stays.**
