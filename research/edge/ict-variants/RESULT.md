# Five ICT A-setup variants from the skill, 2020 → Nov 2026, IS / OOS (pre-registered, 9 Nov 2026)

**Verdict: FAIL. None of the nine variant × book verdicts passes the pre-registered bar; the live A-rule stays and no proposal is made.**
Four are inconclusive (better out of sample, short of the bar): HTF FVG confluence and premium/discount on the indices,
premium/discount and kill zones on gold. Five fail outright. Break-even at +1R is clearly worse than the live +1.5R (paired t −2.05).

- Pre-registered in `PLAN.md` before the first run (sha256 `f35ea303…dc449`, recorded in `result.json` as `planSha256`).
  The test ran once; nothing in the plan changed after it.
- Engine: the research MCP's ICT lab (`api/_ictlab.js` `runMarket`, PR #689) = the desk's own `signals()`, `isASetup()`,
  `sizeOf()`, `P` (ict/tracker.mjs) and `simulate()` (ict/replay.mjs), one open trade per market, live sizing, the lab's costs.
  Only the candle download was replaced by the repo's research candles.
- Paper research only. No file outside `research/edge/ict-variants/` changes: no edit to `ict/*.mjs`, the skill, the replay or the desk.

## Verdicts

Net R a trade after costs, live sizing. IS = 2020-2023, OOS = 2024-01-01 → end of the data. Index book = NQ + ES + YM pooled.

| variant | book | IS n | IS avg R | OOS n | OOS WR | OOS avg R | OOS R | OOS PF | OOS DD | OOS t | Δ avg R vs live IS / OOS | OOS yrs + | checks failed | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **live A-rule (baseline)** | index | 406 | +0.128 | 344 | 40% | +0.184 | +63.3 | 1.43 | 15.7 | 2.18 | | 3/3 | | |
| **live A-rule (baseline)** | gold | 230 | +0.156 | 165 | 44% | +0.136 | +22.4 | 1.24 | 7.4 | 1.16 | | 3/3 | | |
| V1 stop cap 0.5× ATR | index | 340 | +0.132 | 275 | 39% | +0.180 | +49.5 | 1.40 | 12.6 | 1.88 | +0.004 / −0.004 | 3/3 | +0.05, ret/DD, markets | **FAIL** |
| V1 stop cap 0.5× ATR | gold | 164 | +0.143 | 118 | 41% | +0.132 | +15.6 | 1.22 | 9.8 | 0.89 | −0.013 / −0.004 | 3/3 | +0.05, IS, ret/DD | **FAIL** |
| V2 kill zones only | index | 190 | +0.168 | 159 | 31% | +0.052 | +8.3 | 1.10 | 20.4 | 0.40 | +0.040 / −0.132 | 2/3 | +0.05, ret/DD, markets | **FAIL** |
| V2 kill zones only | gold | 119 | +0.265 | 78 | 42% | +0.218 | +17.0 | 1.39 | 7.8 | 1.17 | +0.109 / +0.082 | 3/3 | ret/DD | **INCONCLUSIVE** |
| V3 HTF FVG confluence | index | 76 | +0.225 | 91 | 44% | +0.325 | +29.6 | 1.83 | 8.5 | 1.85 | +0.097 / +0.141 | 2/3 | ret/DD | **INCONCLUSIVE** |
| V3 HTF FVG confluence | gold | 78 | +0.336 | 60 | 40% | +0.054 | +3.2 | 1.09 | 11.7 | 0.27 | +0.180 / −0.082 | 1/3 | +0.05, ret/DD, years | **FAIL** |
| V4 premium / discount | index | 360 | +0.156 | 303 | 40% | +0.215 | +65.2 | 1.49 | 14.9 | 2.31 | +0.028 / +0.031 | 3/3 | +0.05 | **INCONCLUSIVE** |
| V4 premium / discount | gold | 104 | +0.148 | 60 | 53% | +0.272 | +16.3 | 1.57 | 8.1 | 1.56 | −0.008 / +0.136 | 2/3 | IS, ret/DD | **INCONCLUSIVE** |
| V5 break-even at +1R | index | 409 | +0.092 | 350 | 33% | +0.102 | +35.5 | 1.26 | 15.8 | 1.40 | −0.036 / −0.082 | 3/3 | +0.05, IS, ret/DD, markets | **FAIL** |

Checks (PLAN.md "The bar"): OOS n ≥ 30; OOS avg R > 0 and ≥ live + 0.05R ("+0.05"); IS avg R above live ("IS"); OOS net R / max DD
at least live's ("ret/DD"); ≥ 2 of 3 OOS years positive ("years"); index book: better than live on ≥ 2 of 3 markets ("markets").

### Reading

- **V3 HTF FVG confluence, index (closest to a pass).** +0.141R a trade better out of sample and +0.097R in sample, better on NQ
  and ES, worse on YM; it keeps only ~22% of the trades (91 of 344 OOS), so OOS total R falls from +63.3R to +29.6R and return /
  drawdown is 3.5 vs 4.0: it fails that check. Kept vs dropped OOS Welch t 0.98: most of the gain could be noise. This was also
  the result of `research/edge/ict-filters` (OOS +0.237 vs +0.125, 2024 negative), which overlaps this data and was known before the
  plan (declared there). On gold the same filter fails (OOS +0.054, 1 of 3 years positive). Already recorded on every signal as the
  forward feature `feat.htfFvg` (skill §29); the desk's "What works" split is the right place to watch it.
- **V4 premium / discount, index.** Small, steady gain (+0.028 IS, +0.031 OOS; OOS t 2.31 vs 2.18 for the live rule; the 42
  dropped OOS trades averaged −0.051R, kept vs dropped t 1.5), better on all three markets, but under the +0.05R bar. On gold it is
  better out of sample (+0.272 vs +0.136) but not in sample (−0.008) and drops 64% of the trades. Inconclusive both ways.
- **V2 kill zones.** Gold improves in both windows (+0.109 / +0.082) but the drawdown per R is worse (keeps 47% of the trades).
  On the indices it is a clear FAIL: the trades outside the kill zones made +0.272R a trade OOS (195 trades) against +0.052R
  inside; the 2024 kill-zone index trades lost −9.9R.
- **V1 stop cap 0.5× ATR.** No change in R a trade on either book (±0.004R), fewer trades, less total R. Better on NQ (+0.416 vs
  +0.254 OOS), worse on ES and YM. The live 0.75× cap stays.
- **V5 break-even at +1R.** Worse in sample and out of sample, on NQ and ES and YM; on the same trades the R difference averages
  −0.086R (paired t −2.05, n 344). Confirms skill §32: the +1.5R break-even stays.
- Nine verdicts were given; with that many tries a single pass by luck would have been plausible. None came.

## Per market (n / win rate / avg R / net R / PF / max DD / t)

### NQ (HistData NSXUSD)

| rule | IS n | WR | avg R | R | PF | DD | t | OOS n | WR | avg R | R | PF | DD | t |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| live | 191 | 40% | +0.157 | +30.0 | 1.37 | 10.8 | 1.39 | 114 | 40% | +0.254 | +28.9 | 1.55 | 9.0 | 1.50 |
| V1 atr50 | 157 | 39% | +0.212 | +33.2 | 1.48 | 9.3 | 1.58 | 86 | 43% | +0.416 | +35.8 | 1.93 | 8.3 | 1.93 |
| V2 killzone | 87 | 36% | +0.113 | +9.9 | 1.26 | 14.4 | 0.71 | 55 | 31% | +0.285 | +15.7 | 1.53 | 10.5 | 0.94 |
| V3 htffvg | 33 | 49% | +0.624 | +20.6 | 2.91 | 4.1 | 1.84 | 32 | 50% | +0.602 | +19.3 | 2.65 | 4.9 | 1.67 |
| V4 pd | 174 | 39% | +0.186 | +32.4 | 1.43 | 8.7 | 1.51 | 97 | 38% | +0.287 | +27.8 | 1.60 | 9.6 | 1.48 |
| V5 be1 | 192 | 35% | +0.140 | +26.8 | 1.38 | 7.5 | 1.36 | 116 | 31% | +0.061 | +7.1 | 1.14 | 11.6 | 0.49 |

### ES (HistData SPXUSD)

| rule | IS n | WR | avg R | R | PF | DD | t | OOS n | WR | avg R | R | PF | DD | t |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| live | 186 | 33% | +0.063 | +11.6 | 1.13 | 16.5 | 0.56 | 133 | 36% | +0.122 | +16.2 | 1.28 | 12.0 | 0.97 |
| V1 atr50 | 158 | 30% | +0.015 | +2.4 | 1.03 | 16.1 | 0.12 | 113 | 36% | +0.039 | +4.4 | 1.08 | 15.8 | 0.30 |
| V2 killzone | 88 | 36% | +0.152 | +13.3 | 1.37 | 11.0 | 0.96 | 54 | 32% | −0.097 | −5.2 | 0.81 | 10.8 | −0.59 |
| V3 htffvg | 37 | 35% | −0.084 | −3.1 | 0.84 | 8.0 | −0.40 | 32 | 44% | +0.281 | +9.0 | 1.81 | 2.5 | 1.19 |
| V4 pd | 164 | 33% | +0.080 | +13.0 | 1.16 | 15.5 | 0.64 | 121 | 36% | +0.129 | +15.7 | 1.29 | 13.4 | 0.96 |
| V5 be1 | 188 | 28% | +0.009 | +1.8 | 1.02 | 15.8 | 0.10 | 136 | 32% | +0.087 | +11.9 | 1.22 | 12.2 | 0.75 |

### YM (Dukascopy USA30IDXUSD, 2023 on: IS = 2023 only)

| rule | IS n | WR | avg R | R | PF | DD | t | OOS n | WR | avg R | R | PF | DD | t |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| live | 29 | 48% | +0.349 | +10.1 | 1.94 | 3.5 | 1.23 | 97 | 44% | +0.188 | +18.2 | 1.48 | 5.1 | 1.31 |
| V1 atr50 | 25 | 48% | +0.374 | +9.4 | 1.96 | 2.9 | 1.15 | 76 | 40% | +0.123 | +9.4 | 1.30 | 6.9 | 0.80 |
| V2 killzone | 15 | 47% | +0.587 | +8.8 | 2.63 | 2.8 | 1.22 | 50 | 32% | −0.044 | −2.2 | 0.90 | 12.9 | −0.25 |
| V3 htffvg | 6 | 50% | −0.061 | −0.4 | 0.87 | 1.9 | −0.14 | 27 | 37% | +0.049 | +1.3 | 1.10 | 5.1 | 0.16 |
| V4 pd | 22 | 55% | +0.488 | +10.7 | 2.35 | 2.3 | 1.36 | 85 | 46% | +0.256 | +21.7 | 1.66 | 5.1 | 1.60 |
| V5 be1 | 29 | 38% | +0.317 | +9.2 | 2.10 | 3.5 | 1.18 | 98 | 36% | +0.169 | +16.5 | 1.47 | 5.9 | 1.21 |

### GC (HistData XAUUSD spot gold, gold A-rule)

| rule | IS n | WR | avg R | R | PF | DD | t | OOS n | WR | avg R | R | PF | DD | t |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| live | 230 | 42% | +0.156 | +35.9 | 1.28 | 14.6 | 1.39 | 165 | 44% | +0.136 | +22.4 | 1.24 | 7.4 | 1.16 |
| V1 atr50 | 164 | 38% | +0.143 | +23.5 | 1.24 | 17.4 | 0.99 | 118 | 41% | +0.132 | +15.6 | 1.22 | 9.8 | 0.89 |
| V2 killzone | 119 | 42% | +0.265 | +31.6 | 1.50 | 10.6 | 1.65 | 78 | 42% | +0.218 | +17.0 | 1.39 | 7.8 | 1.17 |
| V3 htffvg | 78 | 42% | +0.336 | +26.2 | 1.63 | 6.5 | 1.46 | 60 | 40% | +0.054 | +3.2 | 1.09 | 11.7 | 0.27 |
| V4 pd | 104 | 42% | +0.148 | +15.4 | 1.29 | 13.4 | 0.98 | 60 | 53% | +0.272 | +16.3 | 1.57 | 8.1 | 1.56 |

## By year (net R, trades in brackets)

| rule | book | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|
| live | index | +20.2 (97) | −9.3 (99) | +23.0 (104) | +17.9 (106) | +18.7 (131) | +17.7 (108) | +26.9 (105) |
| live | gold | +13.3 (61) | −5.8 (56) | +9.6 (54) | +18.8 (59) | +11.8 (60) | +10.5 (62) | +0.1 (43) |
| V1 atr50 | index | +18.4 (85) | −4.3 (89) | +16.7 (81) | +14.2 (85) | +31.5 (105) | +9.7 (89) | +8.3 (81) |
| V1 atr50 | gold | +9.3 (45) | −10.1 (41) | +2.5 (35) | +21.8 (43) | +0.7 (41) | +14.3 (42) | +0.7 (35) |
| V2 killzone | index | +21.0 (40) | −6.3 (46) | +7.0 (50) | +10.3 (54) | −9.9 (64) | +10.4 (44) | +7.8 (51) |
| V2 killzone | gold | +9.1 (31) | +5.4 (30) | +2.8 (34) | +14.2 (24) | +13.0 (31) | +2.1 (32) | +1.9 (15) |
| V3 htffvg | index | +5.4 (24) | +2.7 (17) | +4.0 (17) | +5.0 (18) | −1.6 (26) | +17.5 (36) | +13.6 (29) |
| V3 htffvg | gold | −4.4 (20) | +4.1 (16) | +3.6 (18) | +22.9 (24) | −2.9 (25) | −4.2 (25) | +10.3 (10) |
| V4 pd | index | +20.9 (88) | −6.7 (93) | +20.8 (91) | +21.1 (88) | +22.9 (120) | +12.7 (97) | +29.6 (86) |
| V4 pd | gold | +9.7 (20) | −6.2 (23) | −2.8 (34) | +14.8 (27) | +5.8 (18) | +12.5 (14) | −2.0 (28) |
| V5 be1 | index | +11.2 (98) | −2.5 (100) | +8.6 (105) | +20.4 (106) | +11.4 (134) | +2.4 (108) | +21.8 (108) |

Per year avg R, win rate, PF, max DD and t for every row are in `result.json` (`yearStats`).

## Robustness (OOS, not part of the verdict)

| variant | book | OOS avg R gross | at costs ×2 | live gross / ×2 | kept vs dropped Welch t (filters) / paired t (exit) | dropped n / avg R |
|---|---|---|---|---|---|---|
| V1 atr50 | index | +0.198 | +0.162 | +0.199 / +0.169 | 0.03 | 77 / +0.173 |
| V1 atr50 | gold | +0.161 | +0.104 | +0.161 / +0.110 | 0.06 | 48 / +0.118 |
| V2 killzone | index | +0.068 | +0.036 | +0.199 / +0.169 | −1.32 | 195 / +0.272 |
| V2 killzone | gold | +0.248 | +0.189 | +0.161 / +0.110 | 0.59 | 90 / +0.080 |
| V3 htffvg | index | +0.339 | +0.312 | +0.199 / +0.169 | 0.98 | 254 / +0.130 |
| V3 htffvg | gold | +0.084 | +0.023 | +0.161 / +0.110 | −0.48 | 106 / +0.171 |
| V4 pd | index | +0.232 | +0.199 | +0.199 / +0.169 | 1.50 | 42 / −0.051 |
| V4 pd | gold | +0.295 | +0.249 | +0.161 / +0.110 | 0.92 | 105 / +0.058 |
| V5 be1 | index | +0.117 | +0.086 | +0.199 / +0.169 | paired −2.05 (n 344, Δ −0.086R) | – |

## How it was run

- **Data** (council-data `research/candles/`): NQ = HistData NSXUSD M1, ES = SPXUSD M1, GC = XAUUSD M1 (EST without DST → UTC +5 h),
  YM = Dukascopy USA30IDXUSD 5m (2023 on; no older YM exists in the repo's data). H1 on the UTC hour, then the lab's own cleaning
  (positive prices, the 17:00 New York halt hour dropped) and D1 = the tracker's `dailyNY`. 2019 is warm-up. The HistData files end
  on 30 Oct 2026, the YM file on 5 Nov 2026, so the OOS window runs to 5 Nov 2026 (the plan said "the end of the data"; YM's last
  week is the only data after 30 Oct). RTY has no research candles.
- **Cash and spot stand in for the futures** the desk trades; levels and some signals differ (skill §19). The index A-rule was
  fitted on 2023-26 cash and the gold rule on 2019-26 spot gold, so the baseline is not out of sample; only the five changes are.
- **Costs** = the lab's round trip (NQ 1.5, ES 0.5, YM 3 points, gold 0.5). Net R = size × (R − cost / risk). Live sizing (`sizeOf`).
- **Variants.** V1 `atr_max: 0.5`, V3 `htf_fvg: true` and V5 `be: 1` are the lab's own filters / parameters. V2 (signal candle closes
  at 03-05 or 08-11 h New York) and V4 (side-mirrored `feat.pd` < 0.5) ride on `isASetup` so they apply before the one-open-trade
  rule, exactly where the lab applies its filters.
- **Prior knowledge** (declared in PLAN.md): `research/edge/ict-filters` had already seen 2024-26 HistData results for HTF FVG and
  premium/discount; skill §22 / §32 had seen 2023-26 for the 0.5 cap and BE at +1R.

## Proposal

None. No variant passed, so `research/proposals/` gets no file (PLAN.md: "If nothing passes"). The live ICT rules are unchanged.
For the owner, informally: the two inconclusive index filters (HTF FVG, premium/discount) are already recorded on every live signal
(`feat.htfFvg`, `feat.zone` / `feat.pd`), so the forward A-setups will show whether they separate winners without any rule change.

## Files and re-run

- `PLAN.md`: the pre-registration (written before the first run). `run.mjs`: the runner. `result.json`: every number (baseline and
  candidates per book, per market, per year, checks, robustness).

```
git archive -o c.tar origin/council-data research/candles/nsxusd-histdata research/candles/spxusd-histdata research/candles/xau-histdata research/candles/idx
mkdir d && tar xf c.tar -C d
node research/edge/ict-variants/run.mjs d    # ~20 s; writes research/edge/ict-variants/result.json, prints the tables
```
