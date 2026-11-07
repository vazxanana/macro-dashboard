# Regime switch: can a simple causal indicator tell in advance when the council's edges work?

Paper research only. No live rule, config or tracker was changed. Anything here is at most a proposal; the owner decides.

**Question.** Every live edge so far is regime-bound (#511, #512, #526, #530). If a simple indicator, known before each
trade, could say "this edge is in season", the desk could trade only in season. Three indicators were fixed in advance
(`preregistration.md`, commit 039ec953, first pushed as 75458a96 before a rebase, pushed before any indicator met any trade):

- **VOL**: trailing 12-month realised volatility of the traded market, as a percentile of its first-half readings.
- **TREND**: 6-month trend strength, ln(C / C 126 days ago) / (6-month daily sd x sqrt 126). Signed for the long-only gold
  systems, |TS| for the two-sided ones.
- **META**: the system's own net R over its trades closed in the last 365 days. ON unless negative. Not fitted.

VOL and TREND cuts were chosen on the first half of each history (best first-half ON-minus-OFF Welch t over 14 candidate
cuts) and frozen; everything was judged on the second half. 7 systems x 3 indicators = 21 tests.

## Verdict

**By the pre-registered letter: YES, for two of 21 cells.** META passes and survives the Bonferroni bar (t >= 2.83) for the
**NQ New York open run** (second-half t 3.08) and the **gold replica** (t 3.01). TREND passes nominally for the same two
systems (t 2.73 and 2.12). **Nothing works for the ICT A-setups or for any of the four gold daily systems.**

**On inspection, neither META survivor is a dependable regime detector, and I would not trade on it:**

- **Each rests on 3-4 decisions.** NQ META was OFF in 4 separate spells in the second half; the gain is skipping 2015-16 (after a
  losing 2014) and 2021. The replica's is skipping most of 2022 and 2023 (after a losing 2022). Trade-level t treats hundreds
  of trades as independent; the evidence is really a handful of yearly calls.
- **It is not stable.** META is unfitted, so its whole history is out of sample. Over the full history it gives t **1.14**
  (NQ) and **1.41** (replica). In the first half it pointed the wrong way: NQ 2004-15 t **-1.97**, replica 2017-21 t -0.65.
  #511's "trade only if the previous 2 years were positive" switch on the same NQ data also failed.
- **It never had to call the turn that matters.** For NQ, 2022 was slightly positive, so META was already ON when the
  2023-26 run began, and it never switched off after that. Nothing measured here turned on *because* the 2023 regime began.

**The most consistent result is NQ/TREND, and it is a loss filter, not a regime detector.** Skip the NQ open run when NQ's
last 6 months were trendless (|TS| < 0.295, about the lowest 20% of first-half readings):

- Second half (2015-06 to 2026-11): OFF trades **-0.200R** a trade (n 150), ON **+0.119R** (n 802), Welch t 2.73,
  month-block bootstrap P(ON <= OFF) 0.002, 44 separate OFF spells. Still holds at 2x costs (+0.32R a trade gap).
  Nominal pass only: 2.73 misses the 2.83 bar.
- It holds by era too: OFF -0.23R (2004-13), **-0.37R (2014-22, t -3.6)**. But in the good 2023-26 era OFF trades made
  +0.23R (n 41): it would have cost a little there.
- It does **not** find the edge in the dead era: ON trades in 2014-22 made +0.007R a trade. It avoids the worst trades of a bad
  regime; it does not say when the good regime starts.

**Proposal (owner decides, nothing changed):** record |TS 6m| and META on every NQ open trade as a paper tag, and if wanted run
a paper shadow stream "NQ open, trend-on only" next to the live rule. Do not gate the live rule on it: the evidence is
nominal, and in the current regime the trades it would skip have been winners. Today (data to 3 Nov 2026) NQ's |TS| is
0.25, so this switch is **OFF**; META is ON (+30R last 12 months).

## Main table: second half, per system x indicator (net R, costs x1)

DD = max drawdown of the closed-trade equity in R. "yrs" = calendar years of the second half positive / flat / negative.

| System | Ind. | Rule (frozen on 1st half) | 1st-half t | 2nd ON n / R a trade | 2nd OFF n / R a trade | Welch t | x2 ON-OFF | Switched: R / DD / yrs | Always on: R / DD / yrs | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| ict | VOL | ON if VOL < 80.1 | +2.17 | 1628 / +0.099 | 282 / +0.020 | +0.83 | +0.056 | +160.5 / 27.4 / 9/0/1 | +166.1 / 31.3 / 9/0/1 | fail |
| ict | TREND | ON if \|TS\| < 1.08 | +1.61 | 1205 / +0.067 | 705 / +0.121 | -0.75 | -0.046 | +80.5 / 39.7 / 7/0/3 | +166.1 / 31.3 / 9/0/1 | fail |
| ict | META | ON if >= 0 (fixed) | +0.33 | 1243 / +0.065 | 667 / +0.127 | -0.84 | -0.043 | +81.4 / 34.8 / 7/0/3 | +166.1 / 31.3 / 9/0/1 | fail |
| nqopen | VOL | ON if VOL < 71.5 | +1.45 | 563 / +0.074 | 389 / +0.061 | +0.13 | -0.013 | +41.7 / 42.9 / 7/0/5 | +65.5 / 49.1 / 7/0/5 | fail |
| nqopen | TREND | ON if \|TS\| >= 0.295 | +2.87 | 802 / +0.119 | 150 / -0.200 | **+2.73** | +0.322 | **+95.5 / 30.6** / 7/0/5 | +65.5 / 49.1 / 7/0/5 | pass (nominal) |
| nqopen | META | ON if >= 0 (fixed) | -1.97 | 532 / +0.196 | 420 / -0.092 | **+3.08** | +0.315 | **+104.1 / 24.5** / 6/3/3 | +65.5 / 49.1 / 7/0/5 | **PASS (survives)** |
| gtrend | VOL | ON if VOL < 25.1 | +1.08 | 40 / +0.818 | 27 / +1.804 | -0.91 | -0.992 | +32.7 / 4.2 / 6/3/2 | +81.4 / 3.8 / 10/0/1 | fail |
| gtrend | TREND | ON if TS >= 0.17 | +0.85 | 55 / +1.291 | 12 / +0.871 | +0.46 | +0.422 | +71.0 / 3.3 / 7/0/4 | +81.4 / 3.8 / 10/0/1 | fail |
| gtrend | META | ON if >= 0 (fixed) | -0.78 | 58 / +1.283 | 9 / +0.779 | +0.57 | +0.511 | +74.4 / 3.8 / 9/1/1 | +81.4 / 3.8 / 10/0/1 | fail |
| gtrend5 | VOL | ON if VOL < 52.3 | +0.81 | 87 / +1.079 | 22 / +0.702 | +0.51 | +0.371 | +93.9 / 7.5 / 8/1/2 | +109.4 / 7.5 / 9/0/2 | fail |
| gtrend5 | TREND | ON if TS >= 0.96 | +1.40 | 47 / +1.185 | 62 / +0.865 | +0.44 | +0.325 | +55.7 / 3.5 / 5/4/2 | +109.4 / 7.5 / 9/0/2 | fail |
| gtrend5 | META | ON if >= 0 (fixed) | -0.62 | 102 / +0.936 | 7 / +1.989 | -0.90 | -1.047 | +95.4 / 8.4 / 9/0/2 | +109.4 / 7.5 / 9/0/2 | fail |
| gtl | VOL | ON if VOL < 53.0 | +1.39 | 301 / +0.229 | 57 / -0.054 | +1.75 | +0.266 | +69.0 / 12.4 / 9/1/1 | +65.9 / 12.4 / 9/0/2 | fail |
| gtl | TREND | ON if TS >= 0.14 | +1.79 | 253 / +0.219 | 105 / +0.100 | +0.87 | +0.117 | +55.5 / 13.9 / 8/0/3 | +65.9 / 12.4 / 9/0/2 | fail |
| gtl | META | ON if >= 0 (fixed) | -0.03 | 279 / +0.198 | 79 / +0.134 | +0.40 | +0.070 | +55.3 / 15.5 / 7/0/4 | +65.9 / 12.4 / 9/0/2 | fail |
| geg | VOL | ON if VOL < 48.7 | +1.42 | 169 / +0.277 | 50 / +0.136 | +0.56 | +0.121 | +46.8 / 13.6 / 7/1/3 | +53.6 / 13.6 / 7/0/4 | fail |
| geg | TREND | ON if TS >= 0.28 | +2.41 | 157 / +0.335 | 62 / +0.015 | +1.43 | +0.332 | +52.6 / 9.6 / 8/0/3 | +53.6 / 13.6 / 7/0/4 | fail |
| geg | META | ON if >= 0 (fixed) | +0.23 | 180 / +0.268 | 39 / +0.137 | +0.44 | +0.164 | +48.2 / 9.1 / 7/1/3 | +53.6 / 13.6 / 7/0/4 | fail |
| replica | VOL | ON if VOL < 89.9 | +1.52 | 175 / +0.345 | 101 / +0.570 | -0.57 | -0.278 | +60.3 / 27.6 / 2/1/2 | +117.9 / 27.6 / 3/0/2 | fail |
| replica | TREND | ON if \|TS\| >= 0.96 | +1.96 | 208 / +0.611 | 68 / -0.136 | +2.12 | +0.741 | +127.2 / 20.0 / 3/0/2 | +117.9 / 27.6 / 3/0/2 | pass (nominal) |
| replica | META | ON if >= 0 (fixed) | -0.65 | 199 / +0.690 | 77 / -0.252 | **+3.01** | +0.971 | **+137.3 / 20.0** / 3/1/1 | +117.9 / 27.6 / 3/0/2 | **PASS (survives)** |

Halves: ICT split 2017-06-01, NQ 2015-06-01, gold systems 2016-09-01, replica 2022-01-01 (calendar midpoints, fixed in
advance). The replica's first half is thin: 65 trades in 9 months, so its cuts were chosen on very little.

### What a "trade only in regime" switch did, in plain terms (second half)

- **ICT:** every switch made it worse. VOL (skip the top-20% vol readings) kept almost everything: +160R vs +166R. TREND and
  META halved the result (+80R) and added losing years. Per market nothing separates either (largest |t| 1.36).
- **NQ open run:** META +104R vs +66R, drawdown 24.5R vs 49.1R, but 3 flat years and 3 negative vs 5 negative. TREND +96R,
  drawdown 30.6R. Both gains come from the dead 2015-22 stretch; 2023-26 is the same as always-on (META) or slightly lower
  (TREND, -9R over 2023-26).
- **Gold daily systems:** all four were positive in nearly every second-half year (gold 2016-26), so there was little to
  switch off. All switches but one lowered total R (gtl/VOL: +69R vs +66R, t 1.75, not a pass). A few lowered drawdown
  (geg/TREND 9.6R vs 13.6R), but none separated ON from OFF at t >= 2. In two cells (gtrend/VOL, gtrend5/META) the skipped
  trades earned more than the kept ones.
- **Gold replica:** META +137R vs +118R, drawdown 20R vs 27.6R (skipped most of 2022's -13R and all of 2023's -9.7R).
  VOL hurt (the replica's own vol gate already does this job).

## Is the split real? (descriptive, not pre-registered tests)

Trades inside one regime spell are not independent. Month-block bootstrap (10,000 draws, whole calendar months resampled)
and the count of separate OFF spells, second half:

| System | Ind. | trade Welch t | month-block P(ON <= OFF) | months (all OFF / mixed) | OFF spells | 1st-half t |
|---|---|---|---|---|---|---|
| nqopen | TREND | +2.73 | 0.002 | 138 (4 / 39) | 44 | +2.87 |
| nqopen | META | +3.08 | 0.000 | 138 (58 / 5) | **4** | **-1.97** |
| replica | TREND | +2.12 | 0.078 | 21 (3 / 2) | 4 | +1.96 |
| replica | META | +3.01 | 0.003 | 21 (4 / 2) | **3** | -0.65 |
| gtl | VOL | +1.75 | 0.044 | 120 (19 / 2) | 3 | +1.39 |
| geg | TREND | +1.43 | 0.098 | 106 (28 / 6) | 14 | +2.41 |

The month bootstrap still treats a 12-month OFF spell as 12 independent months, so for META it flatters. Every other cell:
`result.json` -> `systems.<k>.indicators.<i>.robustness`.

### ON vs OFF by the earlier studies' eras (full study, cut as frozen)

| System | Ind. | era 1 | era 2 | era 3 |
|---|---|---|---|---|
| nqopen | TREND | 2004-13: ON +0.079 (605) / OFF -0.230 (178), t +2.90 | 2014-22: ON +0.007 (644) / OFF -0.366 (110), t +3.20 | 2023-26: ON +0.332 (268) / OFF +0.225 (41), t +0.39 |
| nqopen | META | 2004-13: ON -0.084 / OFF +0.070, t **-1.64** | 2014-22: ON -0.014 / OFF -0.068, t +0.52 | 2023-26: all 309 ON (+0.318) |
| replica | TREND | 2017-22: ON +0.321 (65) / OFF -0.536 (50), t +1.54 | 2023-26: ON +0.703 (188) / OFF -0.037 (38), t +1.56 | |
| replica | META | 2017-22: ON -0.216 (56) / OFF +0.104 (59), t -0.53 | 2023-26: ON +0.740 (190) / OFF -0.270 (36), t +2.53 | |
| ict | VOL | 2008-17: ON +0.015 / OFF -0.131, t +2.18 | 2018-26: ON +0.106 / OFF +0.020, t +0.91 | |
| geg | TREND | 2006-17: ON +0.365 / OFF -0.088, t +2.24 | 2018-26: ON +0.372 / OFF +0.002, t +1.52 | |

(Era 1 is largely the first half, where the cut was chosen, so its t is in-sample for VOL and TREND.)

- TREND has the right sign in both eras for every system except ICT. That is the one pattern worth watching. It is too weak
  to switch on except in the NQ open run, and there only as a filter for bad regimes.
- META (full history, all out of sample): ICT t 0.05, NQ 1.14, gtrend 0.04, gtrend5 -0.30, gtl 1.11, geg 0.50, replica
  1.41. "Trade it only while its own last year was positive" does not work as a general rule. Yearly R lag-1 correlation is
  near zero for ICT (0.13) and the gold systems (0.03-0.16), 0.35 for NQ, and 0.60 for the replica on 8 active years.

## Always on, for reference (net R a trade, x1)

| System | study trades (from) | warm-up excluded | 1st half n / R a trade / t | 2nd half n / R a trade / t / DD |
|---|---|---|---|---|
| ict | 4,021 (2008-01-02) | 0 | 2,111 / -0.014 / -0.48 | 1,910 / +0.087 / 2.49 / 31.3 |
| nqopen | 1,846 (2004-03-30) | 23 | 894 / +0.004 / 0.09 | 952 / +0.069 / 1.46 / 49.1 |
| gtrend | 127 (2007-04-05) | 7 | 60 / +0.599 / 1.80 | 67 / +1.216 / 2.53 / 3.8 |
| gtrend5 | 216 (2007-03-21) | 11 | 107 / +0.360 / 1.62 | 109 / +1.003 / 2.91 / 7.5 |
| gtl | 696 (2007-03-16) | 24 | 338 / -0.008 / -0.14 | 358 / +0.184 / 2.73 / 12.4 |
| geg | 428 (2007-03-28) | 23 | 209 / +0.203 / 1.83 | 219 / +0.245 / 2.12 / 13.6 |
| replica | 341 (2018-02-08) | 0 | 65 / +0.108 / 0.21 | 276 / +0.427 / 2.30 / 27.6 |

The inputs reproduce the source studies exactly: ICT 2008-17 n 2,235 -0.013R and 2018-26 n 1,786 +0.093R; NQ n 1,869
+70.6R; gtrend 2006-17 n 75 +0.489R; replica 2017-22 n 115 -0.052R and 2023-26 n 226 +0.579R.

## Where each switch stands now (end of data, for the record; nothing reads it)

- NQ open (3 Nov): VOL 70 ON, **|TS| 0.25 OFF**, META +30R ON.
- ICT: GC VOL 91 OFF and |TS| 1.13 OFF; NQ/ES/YM all ON.
- Gold daily systems (6 Nov): VOL 91 OFF, signed TS -0.76 OFF; META ON except geg (-0.75R).
- Replica: VOL 100 OFF, |TS| 0.76 OFF, META +45R ON.

These are what failed or nominal switches say; they are not recommendations.

## Method

- **Trades:** unchanged outputs of the earlier studies (`inputs.json`, built by `run.mjs build`):
  - ICT A-setups from the ict-oos-2008 OANDA run (cached `trades.json`), net = size x (Rraw - costR), signal close
    2008-01 .. 2026-10; 2007 trades only as META history.
  - NQ open run from `nq-open-oos/result.json` (1 point cost; x2 = 2 points).
  - Gold systems from `gold-systems-oos/result.json` positions (open-at-end positions left out).
  - Replica from the replica-oos replay cache (positions with leg close times; 0.30 / 0.60 per unit).
- **Daily data:** OANDA D1 mid closes through the site proxy (`/md/bars?tf=1d`), indices from 2003-03-24, gold from
  2006-03-20; Saturday/Sunday-start candles (OANDA's Sunday stub) dropped. A trade sees only daily candles closed before it
  (start + 24 h <= entry). Trades before VOL had 253 closes are left out (warm-up column above).
- **Causality:** META counts only trades closed before the entry. VOL percentiles are against the first-half distribution,
  so second-half values use only earlier data. Nothing is fitted on the second half.
- **Tests and bar:** as pre-registered. S1 Welch t >= 2 (both sides n >= 10), S2 switched R a trade >= always-on and
  drawdown <= always-on, S3 positive ON-OFF gap at 2x costs; survives = t >= 2.83 (Bonferroni, 21 tests).
- **Added after the verdict (descriptive only):** the month-block bootstrap, OFF spell counts, the era table and the
  end-of-data states.

## Files

- `preregistration.md`: the indicators, halves, threshold rule and pass bar, committed before the run.
- `run.mjs`: `build` makes `inputs.json` from the caches; with no argument it computes `result.json` and prints every table
  above from `inputs.json` alone.
- `inputs.json`: compact trades (entry, exit, net, net x2, market) and daily closes (about 0.8 MB).
- `result.json`: every cell with its rule, candidate cuts, first/second-half and full-history splits, x2, year-by-year
  switched vs always-on, robustness, eras, ICT per market, and the end-of-data states.

Re-run:

```
node research/edge/regime-switch/run.mjs build <ict-oos-2008 trades.json> <replica-oos trades.json> <d1 cache dir>   # optional
node research/edge/regime-switch/run.mjs
```
