# With the Weekly, against the Daily, at a Daily level, on the untouched holdout (holdout-weekly-fade, 23 Nov 2026)

**Verdict: FAIL: pooled holdout −0.007R a trade after costs (n 3342, month t −0.36, one-sided p 0.642); Set A +0.044R (n 715), Set B −0.021R (n 2627); 2x costs −0.031R; ungated control −0.016R (n 14073); lines missed: setB, t2, holm, cost2x**

Paper research only. Rule, sets, costs and the pass bar were fixed in `PREREGISTRATION.md` (committed alone first; sha256 in `result.json`). Nothing live changed. This page is written by `run.mjs` from `result.json`.

## The bar

| Line | Needed | Here | Met |
|---|---|---|---|
| 1 | Set A mean R after costs > 0 | +0.044 (n 715) | yes |
| 2 | Set B mean R after costs > 0 | −0.021 (n 2627) | no |
| 3 | pooled month t ≥ 2 and Holm p < 0.05 | t −0.36 (264 months), one-sided p 0.642, Holm 1 | no |
| 4 | ≥ 100 pooled trades | 3342 | yes |
| 5 | pooled mean R > 0 at 2x costs | −0.031 | no |
| gate | ungated entry reproduces direction-chain-gate (3 windows, 2 % / 0.01R) | 3 of 3 | yes |

Family: Holm over the five primary one-sided p values (siblings' p: holdout-vb-early 0.014, holdout-pullback-deep 0.95, holdout-phase-pick 0.997, holdout-h1-veto 0.873, holdout-weekly-fade 0.642).

## The rule against the ungated control, after costs

| Series | Rule n | Rule net R | Gross R | 2x cost | Month t | Control n | Control net R | Control month t |
|---|---|---|---|---|---|---|---|---|
| **Pooled holdout** | 3342 | −0.007 | +0.017 | −0.031 | −0.36 | 14073 | −0.016 | −1.84 |
| Set A | 715 | +0.044 | +0.060 | +0.028 | +1.07 | 3284 | −0.013 | −0.66 |
| Set B | 2627 | −0.021 | +0.005 | −0.047 | −0.95 | 10789 | −0.017 | −1.76 |
| xau (A) | 102 | +0.069 | +0.120 | +0.019 | +0.87 | 491 | +0.041 | +0.96 |
| eurusd (A) | 147 | +0.035 | +0.044 | +0.026 | +0.43 | 692 | −0.026 | −0.68 |
| gbpusd (A) | 161 | +0.013 | +0.022 | +0.004 | +0.17 | 699 | −0.024 | −0.70 |
| usdjpy (A) | 172 | +0.081 | +0.093 | +0.069 | +1.03 | 695 | +0.011 | +0.29 |
| audusd (A) | 133 | +0.024 | +0.035 | +0.012 | +0.31 | 707 | −0.052 | −1.47 |
| nzdusd (B) | 606 | −0.052 | −0.035 | −0.070 | −1.13 | 2285 | −0.032 | −1.73 |
| usdcad (B) | 529 | −0.052 | −0.037 | −0.067 | −1.11 | 2208 | −0.033 | −1.62 |
| usdchf (B) | 580 | +0.025 | +0.043 | +0.007 | +0.58 | 2225 | −0.014 | −0.75 |
| eurjpy (B) | 476 | +0.081 | +0.095 | +0.067 | +1.87 | 2140 | +0.057 | +2.54 |
| xag (B) | 436 | −0.112 | −0.035 | −0.189 | −2.39 | 1931 | −0.065 | −3.25 |

## Each condition alone (pooled holdout, one position at a time per market)

| Condition | n | Net R | Month t |
|---|---|---|---|
| Weekly side = trade side | 9114 | −0.015 | −1.30 |
| Daily side against the trade | 9252 | −0.013 | −1.13 |
| Within 0.5 ATR of a Daily swing level | 12137 | −0.018 | −1.87 |
| All three (the rule) | 3342 | −0.007 | −0.36 |
| None (ungated control) | 14073 | −0.016 | −1.84 |

## In plain words

The rule does not pass the pre-registered bar (FAIL; missed: setB, t2, holm, cost2x). The rule, pooled: −0.007R a trade after costs (n 3342, gross +0.017R, month t −0.36 over 264 months). The ungated entry on the same holdout: −0.016R (n 14073, gross +0.006R, month t −1.84); rule minus control +0.009R (Welch t +0.46, the two overlap). Set A +0.044R (n 715) against its control −0.013R; Set B −0.021R (n 2627) against −0.017R. The shape was chosen from two of the owner's marked trades and an in-sample scan of 2010-2026 on the five main markets; whatever it shows here is read as the pre-registration says, never as an edge without its n and t.

## Sides and exits (pooled rule trades)

Buys n 1724 +0.007R, sells n 1618 −0.022R; exits time 1859, stop 1118, target 365; worst drawdown −73.85R.

## By year (rule trades, net R a trade, n)

| Year | Set A | Set B |
|---|---|---|
| 2005 | +0.022 (99) | — |
| 2006 | −0.112 (154) | — |
| 2007 | +0.112 (153) | — |
| 2008 | +0.082 (154) | — |
| 2009 | +0.108 (155) | — |
| 2010 | — | −0.069 (160) |
| 2011 | — | −0.037 (143) |
| 2012 | — | −0.014 (194) |
| 2013 | — | +0.113 (159) |
| 2014 | — | −0.092 (124) |
| 2015 | — | −0.029 (146) |
| 2016 | — | +0.075 (153) |
| 2017 | — | −0.146 (135) |
| 2018 | — | −0.045 (170) |
| 2019 | — | +0.066 (145) |
| 2020 | — | +0.055 (134) |
| 2021 | — | +0.028 (179) |
| 2022 | — | +0.054 (177) |
| 2023 | — | −0.155 (185) |
| 2024 | — | −0.163 (170) |
| 2025 | — | +0.043 (140) |
| 2026 | — | −0.034 (113) |

## Harness gate (ungated entry, 2010-2026, five main markets; a code check, not evidence)

| Window | Published n / net R | Here n / net R | Met |
|---|---|---|---|
| REP | 6526 / −0.0055 | 6526 / −0.0055 | yes |
| IS | 2600 / −0.0029 | 2600 / −0.0029 | yes |
| OOS | 1845 / −0.0412 | 1845 / −0.0412 | yes |

## Choices the pre-registration leaves open (written before the run)

- Set A candles are read to 2010-01-09 only so that trades ENTERED by 2009-12-31 can reach their exit (48 h at most); no entry after 2009-12-31 is taken.
- Set B ends at the last complete day on file: entries on the UTC date of the last M5 candle are left out.
- Warm-up: every candle on file before a set's first entry date is read for structure, swings and ATR only (Set A has no warm-up: the cache starts in 2005 / 2006, so the first weeks give a Weekly side of 0 and no trade).
- Weekly / Daily side and levels are read from candles CLOSED at the breaking H1 candle's close (e <= that time); a week counts only once its last Daily candle has closed.
- Daily ATR(14) = simple mean of the true range (max of high-low, |high - previous close|, |low - previous close|) of the last 14 closed days; fewer than 15 closed days = no ATR = condition 3 fails.
- "The last 40 confirmed Daily swing highs or lows" = the 40 most recently confirmed (by confirmation time) of toolkit swings(D, 3), highs and lows together.
- One open position at a time per market and stream: direction-chain-gate oneAtATime (a candidate is taken only if its fill is at or after the previous taken trade's exit), applied after the set window filter.
- Month sums by exit month over the set's span (first entry month to the later of the set's last entry month and its last exit month), empty months 0; Set A and Set B month series pooled; one-sided p from the toolkit t.

## What this does NOT show

- One rule, fixed before the run; no swing size, ATR multiple, level count or timeframe is tried. Whatever is seen here is a hypothesis for other data, not a setting to adopt.
- Set B costs are ASSUMED, not measured on the demo account; past years are charged today's costs; OANDA mid candles, not broker ticks; gold long financing as direction-chain-gate charges it.
- The phase tags in `trades.json` (D1 / H4 side and stage at the signal) are a description, never part of the verdict.
- Nothing here is an edge on its own and nothing live changes.

## Audit (23 Nov 2026)

- An adversarial audit found no defect that changes a number or the verdict: the three conditions recomputed from candles cut at each signal agree on 123 sampled candidates (EUR/JPY Set B, gold Set A); every taken trade sits inside its set window (Set A fills 2005-04-20 to 2009-12-31, Set B 2010-01-04 on); no two taken trades of one market overlap; pooled month t recomputed from trades.json (264 months, t -0.36, one-sided p 0.642); the plan file is unchanged since its commit; the pinned entry hash holds.
- Disclosures added by the audit: silver longs carry no overnight financing (only gold longs are charged, as direction-chain-gate does), which flatters Set B buys slightly; the Set B cost figures live in the toolkit as uncommitted working-tree lines written for this family, assumed, not measured.

## Data

- xau (Set A): 273253 M5 candles 2006-03-19 → 2010-01-08, 1045 candidates in the set window, 163 meeting all three conditions; eurusd (Set A): 382895 M5 candles 2005-01-02 → 2010-01-08, 1463 candidates in the set window, 224 meeting all three conditions; gbpusd (Set A): 381421 M5 candles 2005-01-02 → 2010-01-08, 1487 candidates in the set window, 236 meeting all three conditions; usdjpy (Set A): 382648 M5 candles 2005-01-02 → 2010-01-08, 1501 candidates in the set window, 277 meeting all three conditions; audusd (Set A): 381449 M5 candles 2005-01-02 → 2010-01-08, 1515 candidates in the set window, 209 meeting all three conditions; nzdusd (Set B): 1638858 M5 candles 2005-01-02 → 2026-11-23, 4941 candidates in the set window, 940 meeting all three conditions; usdcad (Set B): 1637270 M5 candles 2005-01-02 → 2026-11-23, 4771 candidates in the set window, 819 meeting all three conditions; usdchf (Set B): 1633086 M5 candles 2005-01-02 → 2026-11-23, 4697 candidates in the set window, 904 meeting all three conditions; eurjpy (Set B): 1646900 M5 candles 2005-01-02 → 2026-11-23, 4632 candidates in the set window, 763 meeting all three conditions; xag (Set B): 1443638 M5 candles 2006-03-19 → 2026-11-23, 3879 candidates in the set window, 657 meeting all three conditions. Source: the shared toolkit's OANDA mid M5 cache; 2010-2026 on the five main markets read only for the harness gate.
- To repeat: `node research/edge/holdout-weekly-fade/run.mjs` (reads the toolkit cache at EDGE_DATA, kept out of git; about a minute).

