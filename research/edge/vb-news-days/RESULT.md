# The two volatility breakouts on US release days (24 Nov 2026)

**Verdict: NO DIFFERENCE SHOWN, 0 of 3.** Confirmation 2022 → 20 Nov 2026, release-day minus other-day net R a trade: gold −0.189R (release days n 131, other days n 815; month t −1.31, Holm p 0.57), USD/JPY +0.156R (n 136 vs 801; month t +0.81; the other sign in 2018-21), pooled −0.015R (n 267 vs 1,616; month t −0.39).

Paper research only. Rule, costs, windows, tests and bar were committed in `PREREGISTRATION.md` before any trade was split. Rule and costs are imported from `gold-vol-breakout-hourcost` (gold, C1: the demo's measured hourly spread + commission + 0.05 × the fill candle's median range) and `usdjpy-vol-breakout-early` / `fx-vol-breakout` (USD/JPY, 0.000045 of the entry + 0.5 pip). Both harness gates passed exactly (gold 2021 → 12 Nov 2026 n 1121, +0.105R, t 2.79; USD/JPY 2016 → 19 Nov 2026 n 2079, +0.063R). Nothing live changed.

**Coverage.** Release dates exist in the repository from January 2018 only (`council/consensus-history.json` 2018 → Apr 2025, `council/events.mjs` HISTORY 2022 → Jul 2025 and EVENTS from Aug 2025): 282 releases on 279 UTC days (CPI 106, payrolls 106, FOMC 70). The asked-for 2005-14 / 2015 → now split could not be used; the windows are discovery 2018-21 and confirmation 2022 → now (the `red-folder-surprise` split, for the same reason). Breakout trades of 2005-2017 are not in this study.

## Tests (net of costs; Δ = release days − other days)

| Test | Window | Release days n / net R (gross) | Other days n / net R (gross) | Δ net R | Welch t | Month diff t (months) | Random-day sets: 2.5-97.5 % (release-day percentile) |
|---|---|---|---|---|---|---|---|
| T1 gold | 2018-21 | 98 / −0.018 (−0.001) | 649 / +0.106 (+0.124) | −0.124 | −0.82 | −1.09 (48) | −0.120 … +0.345 (14 %) |
| T1 gold | 2022 → now | 131 / −0.047 (−0.032) | 815 / +0.142 (+0.157) | −0.189 | −1.47 | −1.31 (58) | −0.048 … +0.371 (2.6 %) |
| T2 USD/JPY | 2018-21 | 86 / +0.037 (+0.081) | 668 / +0.084 (+0.127) | −0.047 | −0.29 | −0.12 (43) | −0.143 … +0.341 (36 %) |
| T2 USD/JPY | 2022 → now | 136 / +0.206 (+0.232) | 801 / +0.051 (+0.077) | +0.156 | +0.97 | +0.81 (58) | −0.126 … +0.245 (94 %) |
| T3 pooled | 2018-21 | 184 / +0.008 (+0.037) | 1,317 / +0.095 (+0.126) | −0.088 | −0.80 | −1.03 (48) | −0.063 … +0.278 (15 %) |
| T3 pooled | 2022 → now | 267 / +0.082 (+0.102) | 1,616 / +0.097 (+0.118) | −0.015 | −0.14 | −0.39 (59) | −0.043 … +0.240 (44 %) |

Holm over the three confirmation month t: gold p 0.19 → 0.57, USD/JPY 0.42 → 0.84, pooled 0.70 → 0.84. No test meets any of month |t| ≥ 2, Holm, Welch |t| ≥ 2 or the random-day control; the n bar (100 / 200 release-day trades in confirmation) is met.

## Reported, not tested: release days by fill time and type (net R, n)

| | Gold 2018-21 | Gold 2022 → now | USD/JPY 2018-21 | USD/JPY 2022 → now |
|---|---|---|---|---|
| Filled before the release minute | +0.153 (60) | +0.026 (62) | −0.013 (54) | +0.051 (76) |
| Filled at or after it | −0.289 (38) | −0.113 (69) | +0.121 (32) | +0.402 (60) |
| CPI days | −0.130 (39) | −0.211 (48) | +0.095 (31) | +0.468 (53) |
| Payrolls days | +0.304 (33) | −0.056 (52) | +0.213 (32) | +0.084 (50) |
| FOMC days | −0.162 (28) | +0.210 (32) | −0.225 (25) | −0.059 (34) |

## Reading

- Gold's breakout did worse on release days in both windows (−0.12R and −0.19R a trade against other days), and the release-day trades were about zero before costs, but month t −1.09 / −1.31 and the control percentile 2.6 % sit inside the bar: a lean, not a shown difference. Most of it is the trades that filled at or after the print (−0.29R / −0.11R).
- USD/JPY flips sign between the windows (−0.05R, then +0.16R); its 2022 → now release-day gain is the CPI days (+0.47R, n 53) and fills after the print, picked after looking: not evidence.
- No release-day filter or skip is proposed for either breakout; the forward records stay as they are.

## Caveats

- The cost model is an hourly median. A fill in the release minute pays far more (`gold-release-quotes`: about 18x the usual spread at T+5 s), so the "at or after the release" rows are charged too little here; gold's release-day result would be worse, USD/JPY's after-print gain smaller, with the real cost.
- OANDA mid M5 candles, not the broker's ticks. Release days are UTC dates; FOMC (18:00 / 19:00 UTC) falls inside the rule's 00:00-21:00 day.
- About 30 release days a year; a difference of ±0.15R a trade needs several more years of releases to be told apart from noise at these n.

To repeat: `node research/edge/vb-news-days/run.mjs [candleDir]` (default: the edgekit candle cache).
