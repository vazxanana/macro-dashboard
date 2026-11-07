# Macro gold rule: can real yields, known the day before, time gold?

**Verdict: no. Both pre-registered rules FAIL on untouched 2006–2017 gold. There is no candidate and no shadow stream.**

- **Rule A** (long gold while the 10-year real yield has fallen over 20 observations, flat otherwise) **FAILS** every out-of-sample test.
  - Out of sample its Sharpe is 0.33, below plain long gold's 0.44 and below gold's own 20-day trend (0.50).
  - Gold returned +0.76 bp a day more on its long days than on its flat days, which is noise (block-bootstrap p 0.43).
  - It also fails in 2018–26: Sharpe 0.68 against long gold's 0.82.
- **Rule B** (take a live Gold trend N20 position only when real yields are falling) **FAILS**.
  - Out of sample, the kept positions did better than the skipped ones: +0.76R against +0.12R a position, and the return per drawdown doubles.
  - But the gap is not significant (permutation p 0.13). All of it comes from 2006–11, and it reverses in 2012–17.
  - It holds in 2018–26 (+1.54R kept against +1.13R skipped), again not significantly (p 0.37).
  - Mechanically, this is the "recent only" form of fail.
- **Why it fails.** The driver is real but already priced.
  - Gold's daily return correlates −0.20 (2006–17) and −0.31 (2018–26) with the **same day's** real-yield change.
  - With the change that was **known at the prior close**, the correlation is −0.015 and +0.019.
  - Once the yield data is public, gold has already moved. Real yields explain gold; with a publication lag they do not forecast it.
- **No live rule was changed.** Gold trend N20 stays as it is. The Macro strategist's real-yield driver remains context, which is how `macro.mjs` already treats any driver without forward evidence.

The pre-registration (`preregistration.md`) was committed and pushed (4ef92658, rebased as 94bb8562, merged in #537) before any real-yield number was computed. The test ran once on GitHub Actions (`.github/workflows/macro-gold.yml`), because FRED is blocked from the sandbox. Its output is council-data `research/macro-gold.json`, copied here as `result.json`.

## Rule A: real-yield regime, long or flat

- At each weekday close, long gold to the next close if the DFII10 change over its last 20 observations is below zero.
- A DFII10 value counts as known only from 24:00 UTC on the second weekday after its date.
- Costs as #530: $0.30 a round trip, ×2 = $0.60. Half a round trip is charged on each switch.

Sharpe is net, annualised, with no risk-free rate. Max DD is on the compounded curve.

| Period | Rule A ×1 / ×2 Sharpe | Long gold Sharpe | Price twin ×1 | Rule A ann. return / max DD | Long gold ann. return / max DD | Time in market, entries | Spread long − flat days (bp/day), p |
|---|---|---|---|---|---|---|---|
| **OOS 2006-07 to 2017** | **0.33 / 0.31** | **0.44** | 0.50 | +4.4% / −29% | +8.0% / −45% | 54%, 154 | +0.76, p 0.43 |
| H1 2006-07 to 2011 | 0.71 / 0.68 | 0.88 | 0.97 | +10.8% / −17% | +18.7% / −29% | 57%, 73 | +1.00, p 0.45 |
| H2 2012–17 | −0.13 / −0.16 | −0.12 | −0.21 | −1.5% / −28% | −1.8% / −41% | 51%, 82 | −0.35, p 0.54 |
| Confirm 2018 to Nov 2026 | 0.68 / 0.67 | 0.82 | 0.61 | +8.0% / −16% | +13.9% / −30% | 48%, 103 | +2.31, p 0.28 |

Tests:

- **A1** Sharpe above long gold at ×1 and ×2: ✗
- **A2** spread > 0 with p < 0.05: ✗ (p 0.43)
- **A3** both halves: ✗ (H1 Sharpe 0.71 < 0.88; H2 spread < 0)
- **A4** beats the price twin: ✗ (0.33 < 0.50)
- **C1** confirmation spread > 0: ✓
- **C2** confirmation ×2 Sharpe ≥ long gold: ✗ (0.67 < 0.82)

Rule A has a shallower drawdown only because it is out of the market half the time. It earns less than half of long gold's return, at a lower Sharpe.

## Rule B: Gold trend N20, taken only when real yields are falling

The positions are #530's replay of the live rule: the first unit plus the add, net R. A position is kept if the 20-observation DFII10 change, as known at the entry minute, is below zero.

| Period | All Gold trend: n / R a position / total / max DD / return per DD | Kept: n / R / total / max DD / return per DD | Skipped: n / R / total | Kept − skipped, permutation p |
|---|---|---|---|---|
| **OOS 2006-07 to 2017** | 75 / +0.49 / +36.7 / −5.4 / 6.8 | **43 / +0.76 / +32.7 / −2.7 / 12.2** (×2: +0.75) | 32 / +0.12 / +4.0 | +0.64R, **p 0.13** |
| H1 2006-07 to 2011 | 46 / +0.57 / +26.4 | 25 / +1.11 / +27.8 | 21 / −0.06 / −1.3 | +1.18R, p 0.07 |
| H2 2012–17 | 29 / +0.35 / +10.2 | 18 / +0.27 / +4.9 | 11 / +0.48 / +5.3 | **−0.21R**, p 0.62 |
| Confirm 2018 to Nov 2026 | 59 / +1.34 / +78.8 / −3.8 / 20.7 | 30 / +1.54 / +46.1 / −4.7 / 9.8 | 29 / +1.13 / +32.7 | +0.41R, p 0.37 |

Tests:

- **B1** kept positions positive at ×1 and ×2: ✓
- **B2** kept − skipped with p < 0.05: ✗ (p 0.13)
- **B3** kept > skipped in both halves: ✗ (H2 reversed)
- **B4** return per drawdown ≥ unfiltered: ✓ (12.2 ≥ 6.8)
- **C1** confirmation kept > skipped: ✓
- **C2** confirmation kept positive at ×2: ✓

The filter halves the drawdown out of sample, but it does so by skipping 43% of the positions, and its edge rests on 2006–11. In 2018–26 it raises R a position (+1.54 against +1.34), but it gives up 33R of the 79R, and its drawdown is worse (−4.7R against −3.8R). By year the skipped positions beat the kept ones in 2012, 2017, 2022, 2023, 2024 and 2026.

## Pre-declared diagnostics (do not change a verdict)

- **The same-day link is real, and the lagged one is absent.** Correlation of gold's daily return with the DFII10 change:

  | Period | Same day | Known at the prior close |
  |---|---|---|
  | OOS 2006–17 | −0.20 | −0.015 |
  | H1 | −0.14 | +0.009 |
  | H2 | −0.32 | −0.06 |
  | 2018–26 | −0.31 | +0.019 |

- **Lag.** With one weekday less of publication margin, Rule A's OOS Sharpe is 0.53 against 0.44 for long gold, and the spread is +4.8 bp with p 0.12. That is still not significant, and it falls short of long gold in H1 (0.86 vs 0.88) and in 2018–26 (0.78 vs 0.82).
  - The improvement from one fresher day fits the same reading: whatever information real yields carry about gold is used up within a day or two.
  - The one-day lag is also not safe on holidays. Rule B with that lag: kept +0.77R against skipped +0.18R OOS, with H2 reversed again.
- **Lookback.**
  - Δ5 (the strategist's own momentum window): OOS Sharpe 0.50 at ×1 but 0.44 at ×2, which is long gold's level. It does worse in 2018–26: 0.31 against 0.82, with 226 entries.
  - Δ60: OOS 0.54 against 0.44, p 0.13; 2018–26 0.55 against 0.82.
  - None is significant, and none holds in 2018–26.
- **Dollar.** Long gold while the broad dollar (DTWEXBGS, 10-day lag) has fallen over 20 observations: OOS Sharpe 0.09, spread −4.4 bp. With real yields and the dollar both falling: 0.12. Worse than either alone. 2018–26: 0.81 and 0.58 against 0.82.
- **Price twin 2×2 (OOS).** Within the days gold's own trend is up, Rule A's spread is +2.4 bp (p 0.33). Within the days it is down, the spread is −3.8 bp (p 0.74). The real-yield signal adds nothing to gold's own trend.
- **Against Gold trend.** Monthly t-statistics, OOS:

  | Stream | Monthly t |
  |---|---|
  | Rule A | 1.20 |
  | Long gold | 1.51 |
  | Gold trend net R | 1.71 |

  Rule A's monthly returns correlate 0.37 with Gold trend's monthly R. In 2018–26 the t-statistics are 2.29, 2.62 and 2.50.

### By year (Rule A and long gold: net return ×1; Gold trend kept / skipped: net R, positions)

| Year | Rule A | Long gold | Price twin | Time in market | Gold trend kept | Gold trend skipped |
|---|---|---|---|---|---|---|
| 2006 (Jul–) | −2.9% | +3.3% | +2.1% | 59% | −1.5 (2) | −0.8 (3) |
| 2007 | +16.9% | +30.9% | +18.7% | 54% | +7.8 (3) | +2.7 (5) |
| 2008 | +6.4% | +5.8% | +18.4% | 48% | −1.6 (2) | −0.5 (5) |
| 2009 | +11.4% | +24.4% | +11.5% | 64% | +2.6 (7) | +0.9 (1) |
| 2010 | +15.8% | +29.5% | +16.4% | 53% | +6.7 (4) | −3.7 (4) |
| 2011 | +10.8% | +10.1% | +22.1% | 63% | +13.9 (7) | +0.1 (3) |
| 2012 | −1.9% | +7.1% | +3.5% | 70% | +0.1 (3) | +6.3 (1) |
| 2013 | −8.9% | −28.1% | −16.4% | 32% | −0.7 (1) | −1.2 (2) |
| 2014 | −7.9% | −1.9% | −3.2% | 59% | +2.4 (3) | −0.8 (2) |
| 2015 | −2.5% | −10.4% | −6.0% | 39% | +1.0 (2) | −2.7 (3) |
| 2016 | +11.6% | +8.5% | +6.0% | 56% | +3.3 (4) | −0.4 (1) |
| 2017 | −1.7% | +13.3% | +3.1% | 49% | −1.1 (5) | +4.2 (2) |
| 2018 | +0.1% | −1.7% | −1.6% | 40% | +6.2 (2) | −0.3 (1) |
| 2019 | +15.4% | +18.3% | +15.6% | 72% | +8.0 (5) | +5.5 (2) |
| 2020 | +12.8% | +25.1% | +7.3% | 66% | +8.6 (6) | −1.7 (3) |
| 2021 | −0.3% | −3.7% | −2.7% | 48% | +1.6 (4) | −0.5 (1) |
| 2022 | +2.7% | −0.3% | +5.9% | 32% | −1.2 (2) | +1.8 (6) |
| 2023 | +2.2% | +13.1% | +9.8% | 38% | −0.4 (3) | +4.5 (5) |
| 2024 | +10.2% | +27.2% | +5.4% | 52% | +0.6 (3) | +8.4 (3) |
| 2025 | +25.5% | +64.7% | +29.3% | 54% | +24.9 (3) | +5.5 (6) |
| 2026 (to 6 Nov) | +3.2% | −5.8% | +3.7% | 30% | −2.1 (2) | +9.4 (2) |

The one consistent property of Rule A is that it sidesteps part of the bad gold years: 2013 −9% against −28%, and 2015 −2.5% against −10%. It gives up more in the good years, and gold's own trend does the same job at least as well.

## What this means

- Add this to the regime-bound list with a twist: here even the hindsight-friendly part is weak. The macro story ("gold follows real yields") is true on the same day and useless with a publication lag.
- This matches the deep-research note behind `macro.mjs`: next-day direction is barely forecastable, and most macro drivers describe today.
- No shadow stream or variant is proposed. Gold trend N20 stays live, unchanged. A real-yield filter on it would rest on one half of the untouched sample.
- The signal today (close of 6 Nov 2026) is falling real yields (Δ20 −0.27), so Rule A would be long. That is recorded only for completeness.

## Method notes and caveats

- **Data.**
  - OANDA XAU/USD mid daily candles from `/md/bars`; weekend-dated candles, including the Sunday stub, are dropped. That gives 5,364 weekday closes, 2006-03-20 to 2026-11-06.
  - FRED DFII10: 5,966 observations, 2003-01-02 to 2026-11-05.
  - FRED DTWEXBGS: 2006-01-02 to 2026-10-30.
  - The Gold trend positions are from #530's `result.json`. The unfiltered OOS row reproduces #530 exactly: 75 positions, +0.489R, t 1.77, drawdown −5.4R, monthly t 1.71.
- **No look-ahead.** A DFII10 value dated *d* is used only from 24:00 UTC on the second weekday after *d*; H.15 posts it around 16:15 New York on the next business day. DFII10 is not revised. DTWEXBGS is revised slightly in later vintages; it is used only as a diagnostic.
- **Costs** are as #530. No financing charge was applied. It would lower long gold and Rule A roughly in proportion to their time in the market, so it does not change the comparison.
- **Bootstrap.** A circular block bootstrap of (return, signal) pairs, 20-day blocks, 10,000 resamples (2,000 for diagnostics). The Rule B permutation test uses 10,000 shuffles. Seeds are fixed.

## Files

- `preregistration.md`: rules, windows, costs and pass bars, committed before the run.
- `run.mjs`: fetch, rules, statistics and mechanical verdicts. For an offline run: `FRED_DIR=<dir with DFII10.csv, DTWEXBGS.csv> CANDLES=<xau-1d.json.gz> node run.mjs out.json`.
- `result.json`: the Actions output (council-data `research/macro-gold.json`, run of 2026-11-07 22:14 UTC). It holds every table above, all diagnostics, and each Gold trend position with its real-yield change and keep flag.
- `.github/workflows/macro-gold.yml`: the free, run-once Actions job. It skips once a complete result exists.
