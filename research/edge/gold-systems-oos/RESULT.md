# Gold systems: out-of-sample test on 2006–2017

**Question.** Meridian runs four simpler paper gold systems besides the replica, which failed out of sample (#512):

- Gold trend (`gtrend`)
- Gold trend fast (`gtrend5`)
- Gold H4 trendline (`gtl`)
- Gold daily engulf (`geg`)

Each was built and tuned on 2018–26 spot gold. Their approval stats show the same recency pattern as the replica. For example, `gtrend` claimed +0.31 / +1.07 / +2.42R a trade in 2019–22 / 2023–24 / 2025–26. Do they make money, **unchanged**, on 11.5 years of gold they never saw? And which one deserves the cTrader mirror budget?

The criteria were pre-registered and committed before any 2006–17 number was computed (`preregistration.md`, commit 599af7b3).

## Verdicts (pre-registered rules, out of sample = entries 2006-07 to 2017-12)

| System | OOS n | R a position (x1 / x2 cost) | t | 95% CI (positions) | H1 2006–11 / H2 2012–17 | Max DD | Verdict | Tests missed |
|---|---|---|---|---|---|---|---|---|
| Gold trend (`gtrend`, N20 + add) | 75 | **+0.49 / +0.47** | 1.77 | +0.01 to +1.09 | +0.57 / +0.35 | −5.4R | **regime-bound** | t ≥ 2 only |
| Gold trend fast (`gtrend5`, N5 + add) | 129 | **+0.37 / +0.36** | 1.92 | +0.05 to +0.79 | +0.54 / +0.19 | −10.8R | **regime-bound** | t ≥ 2 only |
| Gold H4 trendline (`gtl`) | 402 | +0.05 / +0.02 | 0.83 | −0.07 to +0.16 | +0.09 / +0.01 | −26.3R | **regime-bound** (at the edge of fails) | t, CI, years, drawdown |
| Gold daily engulf (`geg`) | 256 | +0.19 / +0.15 | 1.89 | −0.01 to +0.32 | +0.29 / +0.06 | −15.2R | **regime-bound** | t, CI |

**None of the four is robust, and none fails outright.** All four stay positive after doubled costs, so none meets the "fails" rule. All four are weaker out of sample than in the 2018–26 period they were built on.

- **The trend legs hold up best.**
  - Each misses robust only on t: 1.77 and 1.92, against the 2.0 required.
  - Both halves are positive and 8 of 12 years are positive.
  - Their drawdowns are small: −5.4R and −10.8R.
  - Each keeps about 37% of its 2018–26 edge: +0.49R out of sample against +1.34R in sample for `gtrend`, and +0.37R against +0.99R for `gtrend5`.
- **The random-entry control (pre-declared diagnostic) shows the trend legs' timing is not proven.**
  - Same exit, same add, random entry days, matched trade count, 1,000 seeds. Random long entries already make +0.28R a position.
  - The real breakout entries sit at the **84th** (`gtrend`) and **82nd** (`gtrend5`) percentile of that distribution, not beyond the 95th.
  - Most of the out-of-sample profit therefore comes from being long gold with a 2 ATR chandelier exit and a pyramid add, in a period when gold rose from $600 to $1,300. The breakout timing adds a little on top, and that extra is not significant.
- **Gold daily engulf (`geg`) keeps the largest share of its in-sample edge: 67%** (+0.19R out of sample against +0.28R in 2018–26).
  - Its H2 is close to zero (+0.06R; +0.03R at x2), and its bootstrap CI touches zero (P(mean ≤ 0) = 0.035).
  - Its bull half alone reaches t 2.09.
- **Gold H4 trendline (`gtl`) is regime-bound only on the letter of the rule.**
  - +0.048R a position, and +0.023R at x2 costs: a coin flip (P(mean ≤ 0) = 0.51 at x2).
  - H2 is negative at x2.
  - Its worst drawdown is −26R, against −12R in sample.
  - Without one year (2016, +24.8R) it loses money: the 2006–17 total is +19.3R.

**Recommendation to the owner (no live rule was changed).**

- **Mirror budget, first:**
  - Gold trend, **one leg only**. Prefer N20 (`gtrend`): return per drawdown 6.8 against 4.5 for N5, with a shallower drawdown. The two legs correlate **0.92** month by month, so running both doubles the bet rather than diversifying it.
  - Size it as a long-gold trend sleeve, not as a proven timing edge.
  - Plan for about **+0.4 to +0.5R a position**, not the +1 to +2.4R of 2023–26. Plan for a drawdown of about −5R (−11R for N5).
- **Second, if the budget allows:** Gold daily engulf (`geg`).
  - It correlates 0.22 with Gold trend.
  - The 50/50 book of `gtrend` + `geg` has a monthly t of 2.24 out of sample, against 1.71 for `gtrend` alone, with a −16.9R drawdown.
  - Expect about +0.15 to +0.2R a position, and near zero when gold is not rising.
- **Do not mirror** Gold H4 trendline (`gtl`). It adds a −26R drawdown for about zero out-of-sample return. The 4-system book has a −39R worst drawdown, largely from `gtl`.
- **All four are long-only gold, and their yearly results follow gold's yearly change** (correlation 0.31–0.65). In 2013, the −28% gold year, every system lost: −1.9, −6.6, −4.8 and −4.9R. A cTrader sleeve of these systems is a bet that gold keeps trending up. Treat it as one bet, not four.

## Results

All figures are net R a position: the first unit plus its add (trend legs), as live.

- **x1** charges $0.30 per unit per round trip, as in #512. **x2** charges $0.60.
- The out-of-sample window is positions entered from 2006-07-01 to 2017-12-31.
- The calibration window is 2018-01-01 to 2026-11-06, the period the rules were built on.

### By year (net R x1, positions in brackets; gold's own calendar-year change from OANDA daily closes)

| Year | gtrend | gtrend5 | gtl | geg | Gold |
|---|---|---|---|---|---|
| 2006 (Jul–) | −2.3 (5) | −3.6 (9) | +6.3 (17) | +0.2 (14) | +15% |
| 2007 | +10.4 (8) | +14.2 (10) | +12.2 (36) | +9.2 (27) | +31% |
| 2008 | −2.1 (7) | −0.7 (12) | −3.0 (36) | −5.1 (19) | +6% |
| 2009 | +3.5 (8) | +6.7 (11) | −0.1 (43) | +5.5 (23) | +24% |
| 2010 | +3.0 (8) | +3.9 (12) | −7.8 (37) | +23.3 (34) | +30% |
| 2011 | +13.9 (10) | +16.0 (13) | +10.1 (32) | +6.9 (20) | +10% |
| 2012 | +6.4 (4) | +5.4 (11) | −4.8 (40) | +5.0 (18) | +7% |
| 2013 | −1.9 (3) | −6.6 (13) | −4.8 (28) | −4.9 (21) | −28% |
| 2014 | +1.5 (5) | +0.5 (12) | −5.8 (39) | −3.1 (25) | −2% |
| 2015 | −1.7 (5) | −2.9 (7) | −8.4 (32) | +1.9 (19) | −10% |
| 2016 | +2.8 (5) | +3.3 (12) | +24.8 (33) | +10.4 (16) | +9% |
| 2017 | +3.0 (7) | +11.8 (7) | +0.7 (29) | −1.8 (20) | +13% |
| **2006–17 positive years** | **8/12** | **8/12** | 5/12 | **8/12** | |
| 2018 | +5.9 (3) | −0.3 (11) | +1.7 (32) | −6.0 (18) | −2% |
| 2019 | +13.6 (7) | +16.4 (10) | +1.0 (44) | +9.8 (27) | +18% |
| 2020 | +6.9 (9) | +9.5 (14) | +8.2 (36) | +11.5 (23) | +25% |
| 2021 | +1.1 (5) | +1.0 (10) | +0.8 (38) | +12.0 (20) | −4% |
| 2022 | +0.6 (8) | +7.2 (11) | −3.9 (30) | −2.4 (23) | 0% |
| 2023 | +4.2 (8) | +5.4 (12) | +3.4 (35) | +9.9 (18) | +13% |
| 2024 | +8.9 (6) | +13.4 (11) | +16.0 (38) | +10.8 (24) | +27% |
| 2025 | +30.4 (9) | +34.2 (12) | +28.9 (32) | +11.6 (30) | +65% |
| 2026 (to 6 Nov) | +7.3 (4) | +10.7 (8) | −0.4 (33) | −3.2 (12) | −6% |

Correlation of each system's yearly R with gold's yearly change, 2006–17: gtrend 0.48, gtrend5 0.63, gtl 0.31, geg 0.65.

### Periods (n / win% / R a position / total R / t / max DD; x1 costs unless marked)

| System | OOS 2006–17 | H1 2006–11 | H2 2012–17 | OOS at x2 | OOS gross | Calibration 2018–26 |
|---|---|---|---|---|---|---|
| gtrend | 75 / 36% / +0.489 / +36.7 / 1.77 / −5.4 | 46 / +0.574 / +26.4 / 1.47 | 29 / +0.353 / +10.2 / 0.99 | +0.472 / +35.4 / 1.72 | +0.506 | 59 / 41% / +1.336 / +78.8 / 2.48 / −3.8 |
| gtrend5 | 129 / 36% / +0.372 / +48.0 / 1.92 / −10.8 | 67 / +0.544 / +36.5 / 1.73 | 62 / +0.187 / +11.6 / 0.86 | +0.357 / +46.1 / 1.85 | +0.387 | 99 / 33% / +0.986 / +97.6 / 2.64 / −7.5 |
| gtl | 402 / 48% / +0.048 / +19.3 / 0.83 / −26.3 | 201 / +0.088 / +17.6 / 1.13 | 201 / +0.008 / +1.7 / 0.10 | +0.023 / +9.1 / 0.39 | +0.073 | 318 / 50% / +0.175 / +55.7 / 2.51 / −12.4 |
| geg | 256 / 41% / +0.186 / +47.6 / 1.89 / −15.2 | 137 / +0.292 / +40.0 / 2.09 | 119 / +0.064 / +7.6 / 0.47 | +0.149 / +38.2 / 1.52 | +0.222 | 195 / 43% / +0.277 / +54.0 / 2.21 / −9.1 |

At x2 costs, H2 is +0.34 for gtrend, +0.17 for gtrend5, **−0.02 for gtl** and +0.03 for geg.

Median stop, OOS against calibration: gtrend $27 vs $42; gtrend5 $31 vs $44; gtl $15 vs $20; geg $12 vs $17. Costs matter most for gtl and geg.

### Bootstrap, 95% CI of R a position (10,000 resamples)

| System | Positions, x1 | P(≤0) | Positions, x2 | P(≤0) | Month blocks, x1 | P(≤0) | Month blocks, x2 |
|---|---|---|---|---|---|---|---|
| gtrend | **+0.011 to +1.088** | 0.021 | −0.005 to +1.070 | 0.027 | −0.007 to +0.962 | 0.028 | −0.022 to +0.945 |
| gtrend5 | **+0.049 to +0.785** | 0.011 | +0.035 to +0.771 | 0.013 | +0.037 to +0.728 | 0.008 | +0.022 to +0.712 |
| gtl | −0.065 to +0.160 | 0.316 | −0.090 to +0.135 | 0.509 | −0.064 to +0.161 | 0.189 | −0.087 to +0.135 |
| geg | −0.014 to +0.323 | 0.035 | −0.050 to +0.286 | 0.090 | −0.011 to +0.386 | 0.033 | −0.047 to +0.351 |

### Do they diversify? Monthly net R correlation, 138 OOS months

| | gtrend5 | gtl | geg |
|---|---|---|---|
| **gtrend** | **0.92** | 0.18 | 0.22 |
| **gtrend5** | | 0.14 | 0.25 |
| **gtl** | | | 0.17 |

- The two trend legs are one system.
  - Every `gtrend` entry came while `gtrend5` already had a position open: the 5-day high always breaks before the 20-day high.
- The trendline and the engulf are close to uncorrelated with the trend legs and with each other.

Equal-weight books, 1R per position, OOS 2006-07 to 2017-12, monthly:

| Book | Total R | t (monthly) | Max DD | Return / DD |
|---|---|---|---|---|
| gtrend | +36.7 | 1.71 | −5.4 | 6.8 |
| gtrend5 | +48.0 | 1.87 | −10.8 | 4.5 |
| gtl | +19.3 | 0.86 | −25.9 | 0.7 |
| geg | +47.6 | 1.79 | −14.1 | 3.4 |
| gtrend + gtrend5 | +84.7 | 1.83 | −14.0 | 6.1 |
| **gtrend + geg** | **+84.2** | **2.24** | −16.9 | 5.0 |
| gtrend + gtl | +55.9 | 1.66 | −24.0 | 2.3 |
| all four | +151.6 | 2.27 | −39.1 | 3.9 |

### Diagnostics (not part of the verdicts)

- **Random-entry control (pre-declared), trend legs, OOS.**
  - Setup: the same run loop, stop, daily ratchet and +1R add, with entries on random days at a rate tuned to match the real trade count. 1,000 seeds.
  - The control's real-rule path reproduces `replay.mjs` exactly (`checkedAgainstReplay`).

  | Leg | Real R a position | Random entries: p5 / median / p95 | Real percentile |
  |---|---|---|---|
  | gtrend | +0.489 | −0.019 / +0.280 / +0.604 | 84th |
  | gtrend5 | +0.372 | +0.098 / +0.280 / +0.453 | 82nd |

- **The trend legs without the add (first unit only).**
  - `gtrend`: +0.36R (t 2.09, DD −3.4); H1 +0.44, H2 +0.24; calibration +0.77.
  - `gtrend5`: +0.25R (t 2.09, DD −10.1); H1 +0.40, H2 +0.09; calibration +0.52.
  - The add raises R a position, but it raises the variance about as much: t barely moves, from 2.09 to 1.77–1.92.
- **Concentration.** Without its best 5 positions, out of sample: gtrend −2.3R, gtrend5 +4.8R, gtl −3.3R, geg +24.0R. The engulf's profit is the least dependent on a few trades.

## Verification

- **Against the council's own record.**
  - Source: council-data `trades.json`, `snapshot.json` and `config.json`, read 7 Nov 2026 about 21:30 UTC (`check.json`).
  - Since each rule went live, the council recorded:
    - no Gold trend trade (live since 5 Nov 23:32);
    - no Gold trend fast trade (since 7 Nov 01:14);
    - no Gold H4 trendline trade (since 6 Nov 00:13);
    - one Gold daily engulf order, `xau-geg-1793664000`, placed 6 Nov 09:15 and still pending.
  - The replay has the same set:
    - no trend or trendline trade alive in that window;
    - the same engulf order, with the same id (base candle 3 Nov), still pending at the end of the data.
  - The prices differ by +8.0 (entry) and +12.3 (stop). The live order was placed on Kraken PAXG candles plus the basis, before the OANDA feed took over on 7 Nov.
  - The values the live Trader now shows on OANDA match the replay **to the cent**:
    - 20-day high 4200.63;
    - 5-day high 4071.67;
    - last close 4085.945;
    - 20-day average 4047.51;
    - engulf zone 3895.57–3971.355.
  - The weekend window rule matches too: on Saturday the last daily candle read is Thursday's.
- **Against the claims and the HistData study (calibration 2018–26, same harness).**
  - Gold trend fast, 2019–22 / 2023–24 / 2025–26:
    - claimed +35.2R (n43) / +24.9R (n22) / +45.2R (n18);
    - here +34.2R (n45) / +18.8R (n23) / +45.0R (n20).
  - Gold trend and the engulf track the HistData study year by year within a few R. OANDA gives a few more trend entries because of its Sunday daily stub.
  - The trendline comes out a little weaker on OANDA than claimed: 2023–24 / 2025–26 +0.27 / +0.44R against the claimed +0.44 / +0.67R.
  - The harness therefore reproduces the in-sample edge. The out-of-sample weakness comes from the period, not from the harness.

## Method

- **Data.**
  - OANDA XAU/USD mid candles, the live Trader's gold feed since 7 Nov, read through the site's free `/md/bars` proxy (`fetch.mjs`): M5, H4 and D1 from 2006-03-19/20, the first candle served, to 2026-11-06.
  - The data has 1.47 M M5 candles. Most of 2017–26 was reused from the #512 cache, and 2006–17 was fetched.
  - The candles are kept out of git.
- **Same rules as live (`replay.mjs`).**
  - Live config of 7 Nov 2026: `goldTrend {n:20,k:2}`, `goldTrendFast {n:5,k:2}`, `goldTrendAdd {atR:1}`, `goldTL {n:3,span:120,n4:2,pad:0.3,hold:96}`, `goldEG {k:3,life:20,hold:240,sma:20,pad:0.3,maxOpen:3}`.
  - Each system block is the live block line for line.
  - `msnrDirection` is copied verbatim out of `council/trader.mjs` at run time.
  - `stopFill`, `exitR`, `fillBarAmbiguous` and `spotSkip` are imported from `council/fills.mjs`.
- **Runs.**
  - One run 4 minutes after every M5 close, on 719 closed candles per timeframe.
  - The live 24 h freshness window applies to daily signals, and the 1 h window to H4 trendline signals.
  - The order inside a run is live's: manage, expire, trend legs, trendline, engulf.
  - Trades are managed on M5 candles in the live order.
  - Gapped stops fill at the open. Shut-market and rollover candles fill and stop nothing. A limit fill and the target in one candle count as missed.
- **Departures.**
  - A market entry is the close of the M5 candle the run falls in, about 1 minute after live.
  - A run with no M5 candle in progress places no new entry.
  - Positions still open on 6 Nov 2026 are marked at the last close (calibration only).
- **Costs, statistics and verdict rules:** as pre-registered (`preregistration.md`). `analyze.mjs` applies them mechanically and writes `result.json`.

## Files

- `preregistration.md`: the criteria, committed before the results.
- `fetch.mjs`: the OANDA candles.
- `replay.mjs`: the replay. Writes every trade leg.
- `check.mjs` and `check.json`: the verification against council-data.
- `control.mjs`: the random-entry control.
- `analyze.mjs`: the statistics.
- `result.json`: every table above, the verdict tests, the control, and every position (entry, close, gross / x1 / x2 R, stop size).

## Reproduce

```
export SCR=<scratch dir>
CANDLES_IN=<optional #512 candle cache> node research/edge/gold-systems-oos/fetch.mjs $SCR/candles          # ~3 min
CANDLES=$SCR/candles OUT_DIR=$SCR/out node research/edge/gold-systems-oos/replay.mjs                           # ~20 s
CANDLES=$SCR/candles node research/edge/gold-systems-oos/control.mjs $SCR/out/trades.json 1000 > $SCR/out/control.json   # ~8 min
CANDLES=$SCR/candles node research/edge/gold-systems-oos/analyze.mjs $SCR/out/trades.json $SCR/out/control.json > research/edge/gold-systems-oos/result.json
git show origin/council-data:trades.json > $SCR/trades.json   # likewise snapshot.json, config.json
CANDLES=$SCR/candles node research/edge/gold-systems-oos/check.mjs $SCR/out/trades.json $SCR/trades.json $SCR/snapshot.json $SCR/config.json > research/edge/gold-systems-oos/check.json
```
