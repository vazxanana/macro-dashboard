# Gold daily engulf: entry-side variants (8 Nov 2026)

**Verdict: NOT BETTER. None of the ten pre-registered entry variants beats the live Gold daily engulf rule on the untouched 2006–17 window by return/drawdown in both halves, and the mirror sell rule FAILS (−0.02R a position 2006–17, −0.24R 2018–26). The live entry stays as it is.**

**Question.** Gold daily engulf (`geg`, live, `council/trader.mjs`) is one of three council systems with a positive honest out-of-sample edge (#530: 2006–17 +0.19R a position, t 1.9, n 256). Can its **entry** be improved robustly? Eleven one-change variants were pre-registered (`preregistration.md`, commit 9dc78c87, before any variant was run): the average length (10 / 50) and a rising-average filter, the zone candle (lowest-close red candle of the 3-candle lookback), entry at the daily close (market) or at 50% of the zone, order life 1 / 3 / 5 days, a 1 ATR minimum pullback depth, and the mirror for sells. The exit side (10R target, trail 1R behind from +2R, 240 h hold, stop 0.3 under the zone) was out of scope.

**Pre-registered bar.** A long variant beats the live rule only if, at both x1 and x2 costs: (1) 2006–17 return/drawdown higher, (2) 2006–17 total net R higher, (3) H1 2006–11 total R higher, (4) H2 2012–17 total R higher, and then (5) 2018–26 return/drawdown and total R higher (confirmation, not choice). The mirror passes only if 2006–17 mean > 0 with t ≥ 2, both halves > 0 and 2018–26 > 0.

**Calibration gate (passed before any variant was read).** The baseline under #530's flat $0.30 cost reproduces `gold-systems-oos/result.json` for `geg` to the last digit in every window at x1, x2 and gross: 2006–17 n 256, +0.186R, +47.58R, t 1.89, max DD −15.17; H1 137 / +0.292; H2 119 / +0.064; 2018–26 195 / +0.277 / +54.0.

## Key table (net R; x1 = $0.30 spread + $0.15 slippage per market order as in `council/fills.mjs`, x2 doubles; 2006–17 = fills 2006-07 to 2017-12; ratio = total R ÷ |max DD|)

| Variant | 2006–17 n | R a position x1 / x2 | Total R x1 / x2 | Max DD x1 | Ratio x1 / x2 | H1 R x1 | H2 R x1 | 2018–26 n / R a pos / total R / ratio (x1) | Tests missed | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| **Live rule** | 256 | +0.168 / +0.113 | +42.9 / +28.8 | −15.8 | 2.71 / 1.61 | +37.6 | +5.3 | 195 / +0.261 / +50.8 / 5.33 | — | baseline |
| 10-day average | 282 | +0.102 / +0.048 | +28.9 / +13.6 | −20.0 | 1.44 / 0.59 | +17.1 | +11.9 | 219 / +0.229 / +50.1 / 3.47 | 1, 2, 3, 5 | NOT BETTER |
| 50-day average | 234 | +0.169 / +0.117 | +39.6 / +27.5 | −14.4 | 2.75 / 1.66 | +40.1 | −0.5 | 182 / +0.215 / +39.2 / 3.62 | 2, 4, 5 | NOT BETTER |
| 20-day average rising | 240 | +0.174 / +0.121 | +41.8 / +29.0 | −21.1 | 1.98 / 1.25 | +42.1 | −0.3 | 177 / +0.141 / +25.0 / 2.64 | 1, 2 (x1), 4, 5 | NOT BETTER |
| Zone = lowest-close red candle | 253 | **+0.227 / +0.177** | **+57.4 / +44.7** | −13.4 | **4.28 / 3.07** | +34.3 | **+23.2** | 197 / +0.308 / +60.8 / 5.92 | **3 only** (H1 +34.3 < +37.6, both costs) | NOT BETTER |
| Entry at the daily close (market) | 320 | +0.115 / +0.076 | +36.9 / +24.5 | −16.6 | 2.23 / 1.30 | +20.4 | +16.6 | 259 / +0.287 / +74.4 / 4.70 | 1, 2, 3, 5 (x1) | NOT BETTER |
| Entry at 50% of the zone | 201 | +0.056 / −0.040 | +11.3 / −8.1 | −17.1 | 0.66 / −0.38 | +8.8 | +2.4 | 140 / −0.230 / −32.2 / −0.94 | all | NOT BETTER |
| Order life 1 day | 133 | +0.194 / +0.140 | +25.7 / +18.7 | −10.7 | 2.41 / 1.67 | +13.9 | +11.9 | 115 / +0.402 / +46.2 / 7.17 | 1 (x1), 2, 3, 5 | NOT BETTER |
| Order life 3 days | 185 | +0.179 / +0.122 | +33.2 / +22.6 | −13.1 | 2.54 / 1.47 | +27.4 | +5.8 | 152 / +0.356 / +54.0 / 6.62 | 1, 2, 3 | NOT BETTER |
| Order life 5 days | 205 | +0.187 / +0.132 | +38.4 / +27.0 | −15.4 | 2.50 / 1.44 | +33.7 | +4.7 | 169 / +0.353 / +59.7 / 7.19 | 1, 2, 3, 4 (x1) | NOT BETTER |
| Pullback depth ≥ 1 ATR | 188 | +0.154 / +0.109 | +29.0 / +20.5 | −12.5 | 2.32 / 1.49 | +20.0 | +9.0 | 146 / +0.199 / +29.1 / 2.36 | 1, 2, 3, 5 | NOT BETTER |
| **Mirror: sells** | 226 | −0.020 / −0.081 | −4.5 / −18.3 | −35.5 | −0.13 / −0.45 | −26.8 | +22.3 | 178 / −0.241 / −42.9 / −0.93 | mean > 0, t ≥ 2, H1, 2018–26 | **FAILS** |

Tests: 1 = 2006–17 return/DD, 2 = 2006–17 total R, 3 = H1 total R, 4 = H2 total R, 5 = 2018–26 return/DD and total R; a test is listed when it fails at either cost level ("(x1)" = fails at x1 only). The live rule's x1 figure here (+0.168R) is a little under #530's +0.186R because the Trader's cost model adds $0.15 slippage to every stop, trail or time exit; the median stop is $11.5 (2006–17) and $16.7 (2018–26), so a $0.45 round trip is about 4% of R.

## Reading

- **The live entry is at or near the best point of every dimension tested.** Nine of ten variants make less total R on 2006–17 than the live rule at x1 and x2; eight have a worse return/drawdown. The grid is a star around the live rule, so this is a direct test of local robustness: the live settings are not a knife-edge.
- **Average length and filter type.** A shorter average (10) lets in more and worse trades (+0.10R, DD −20R, H1 cut in half). A longer average (50) and a rising average both lose the 2012–17 half (−0.5R and −0.3R) and the rising filter also loses badly on 2018–26 (+25.0R against +50.8R, paired t −2.1). The live "close above the 20-day average" is the right filter among those tried.
- **Entry price.** Entering at the daily close (market) takes every signal (579 of 579 orders fill against 451), nearly doubles the stop ($19.9 against $11.5) and halves the R a position on 2006–17 (+0.115R); it makes more total R on 2018–26 (+74.4R, t 3.1) but with a −15.8R drawdown, so it fails tests 1–3 and the x1 confirmation. Waiting for 50% of the zone is the worst idea in the grid: 180 orders are missed as the move leaves without them, the fills are the zones that are failing (−0.23R a position on 2018–26, −32R total, paired t −3.4), and the tiny $6 stop makes costs 7% of R.
- **Order life.** Shorter lives (1 / 3 / 5 days) improve the 2018–26 return/drawdown (6.6–7.2 against 5.3) by skipping late fills, but on 2006–17 they give up total R (+25.7 / +33.2 / +38.4 against +42.9) and H1, and 5 days still has a −15.4R drawdown. The late fills that the live 20-day life allows paid, on the whole, in 2006–17 and cost a little in 2018–26: the 20-day life is not a parameter to shorten on this evidence.
- **Pullback depth.** Requiring a pullback of at least 1 ATR removes 140 orders and 36% of the profit on both windows (+29.0R and +29.1R). Shallow pullbacks are as good as deep ones.
- **Zone = lowest-close red candle is the only near miss, and the pre-registered bar says no.** It beats the live rule on the whole 2006–17 window at both cost levels (return/drawdown 4.28 against 2.71, total +57.4R against +42.9R, t 2.27 against 1.71), on H2 (+23.2R against +5.3R; the paired monthly difference has P(≤ 0) = 0.009) and on the 2018–26 confirmation (+60.8R against +50.8R, ratio 5.92 against 5.33). It misses test 3: H1 2006–11 total R is **lower**, +34.3R against +37.6R, at x1 and x2. The bar required both halves and it was set before the run, so the verdict is NOT BETTER. A post-hoc look at where its gain comes from is below; it is not the clean "better zone" story the bar would have needed.
- **Sells fail out of sample as they did in sample.** The mirror rule loses on 2006–17 (−0.02R at x1, −0.08R at x2) with a −35.5R drawdown, loses −0.27R a position in the 2006–11 bull half (t −2.1), makes +0.18R in the 2012–17 bear-and-range half, and loses −0.24R a position on 2018–26 (t −2.5). It is a bet on gold falling, positive only in the 2013–15 bear market, and it is not a council candidate. This matches the approval's "sells lose everywhere" on 2023–26; the 2006–17 window had never been tried.
- **Multiplicity.** Ten variants against one baseline: one near miss on most tests is about what a null result looks like (the pre-registration expected about one spurious 2006–17 pass). Nothing is combined with anything.

## Post-hoc diagnostics (after the results; not part of the decision)

- **Where the lowest-close zone's gain comes from (x1, positions paired by base candle).**
  - 2006–17: 235 positions share the same base candle and zone, 21 are only in the live rule (−2.5R) and 18 only in the variant (+4.2R). The variant's extra **+14.5R** splits into +6.7R from the changed zones and **+7.9R from the 235 identical-zone positions**: 10 of them end with a different R because the variant's book had a different 3-order cap state or a different placement run, so the order filled on another day (for example the 2017-04-05 zone: −1.16R live, +3.55R in the variant, same entry and stop).
  - 2018–26: 177 identical, 18 live-only (−1.4R), 20 variant-only (+3.8R); +5.2R from the changed zones and +4.7R from path effects on identical positions.
  - Over both windows, 12.6R of the variant's 24.5R advantage is path noise from the 3-order cap, not the zone choice. The zone choice itself adds about +12R over 20 years and 850 positions. That is not a signal worth a rule change.
- **Paired monthly difference against the live rule (x1, by close month; t, 95% CI of the total, P(≤ 0)).**

  | Variant | 2006–17 | 2018–26 |
  |---|---|---|
  | lowest-close zone | +14.5R (t 1.25; −7.7 to +38.9; 0.12) | +9.9R (t 0.89; −13.4 to +35.2; 0.23) |
  | market entry | −6.0R (t −0.26) | +23.6R (t 0.95; −23.1 to +66.9; 0.22) |
  | life 5 days | −4.5R (t −0.44) | +8.9R (t 1.55; −2.5 to +18.0; 0.07) |
  | 20-day average rising | −1.1R (t −0.10) | −25.8R (t −2.12; −50.8 to −5.6; 0.996) |
  | 50% of the zone | −31.6R (t −1.34) | −83.0R (t −3.37; −132 to −38; 1.00) |
  | sells | −47.4R (t −1.29) | −93.7R (t −2.94) |

  No variant's gain is significant on either window; two variants' losses are.
- **Exit mix of the live rule, 2006–17:** 215 positions stopped (the first stop or the trail), 41 timed out at 240 h, none reached the 10R target. The 10R target never fires; the trail does all the work. That is an exit-side observation and out of scope here.

## Method

- **Data.** OANDA XAU/USD mid candles through the site's free `/md/bars` proxy, fetched with #530's `fetch.mjs` (M5 1,471,794 candles, D1 6,481, 2006-03-19 to 2026-11-06), kept out of git.
- **Harness (`run.mjs`).** #530's replay loop: one run 4 minutes after every M5 close, daily candles as the live block reads them (OANDA UTC buckets with the Sunday stub, the forming candle dropped, the 24 h freshness window, so Friday closes are never traded, as live), the live base search, the "price above the entry" placement rule, the 3-order cap, the zone-failed cancel. Trade management is the Trader's own loop as a pure function, `manageLive` from `council/fills.mjs` (stop before target, 240 h time exit, trail 1R behind from +2R, gapped stops at the open, limit fill and target in one candle = missed), with `expireOrder` and `spotSkip`. Each variant runs in its own book. A market entry is the close of the M5 candle the run falls in, as the trend legs enter in #530.
- **Costs.** `fills.mjs` `tradeCost` model: $0.30 spread a round trip plus $0.15 slippage on every market order (a market entry; a stop, trailing-stop or time exit); a limit entry and a target exit pay none. x2 doubles both. Charged as cost / r0.
- **Statistics.** Positions = filled orders, dated by fill; n, win%, mean, total, t, worst drawdown on the closed-position equity curve, return/drawdown; paired month-by-month difference against the baseline with a 10,000-resample month bootstrap. `result.json` has every table, every test and every position of every variant.

## Files

- `preregistration.md`: the variants, windows, costs and bar, committed before the run (9dc78c87).
- `run.mjs`: the replay, the calibration gate, the statistics and the verdicts. `CANDLES=<dir from research/edge/gold-systems-oos/fetch.mjs> node research/edge/geg-variants/run.mjs` (about 15 s). `GATE_ONLY=1` prints the calibration gate and nothing else.
- `result.json`: the gate, every variant's windows, years, paired differences, tests and positions.

Nothing went live. No proposal to the owner comes out of this study: the live Gold daily engulf entry is the best of the twelve rules tried, on data it never saw.
