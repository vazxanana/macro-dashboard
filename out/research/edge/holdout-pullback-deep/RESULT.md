# The end of an H4 pullback, only after a pullback past the 50 % line: holdout result (23 Nov 2026)

**Verdict: FAIL.** Pooled holdout −0.110R a trade after costs (n 607, month t −1.65, one-sided p 0.95); Set A +0.048R (n 117), Set B −0.147R (n 490); at 2x costs −0.147R; before costs −0.072R. Lines missed: setBMean, pooledT, x2Mean.

Pre-registered in PREREGISTRATION.md (committed before any holdout candle was read for this study); run once by `run.mjs` on the
toolkit's OANDA mid 5m cache. R after the toolkit's round-trip costs unless said (Set B costs are ASSUMED, not measured); t on
calendar-month sums by exit month, each set's own months joined; p one-sided (mean > 0).

| Stream | n | R a trade after costs | month t | at 2x costs | before costs |
|---|---|---|---|---|---|
| Rule, Set A (2005-2009, five main markets) | 117 | +0.048 | 0.30 | +0.025 | +0.071 |
| Rule, Set B (2010 on, five fresh markets) | 490 | −0.147 | −2.03 | −0.188 | −0.106 |
| **Rule, pooled holdout (primary)** | 607 | −0.110 | −1.65 | −0.147 | −0.072 |
| Removed internal branch, pooled (comparison) | 275 | −0.216 | −2.91 | −0.257 | −0.175 |
| Gold alone (Set A) | 16 | −0.323 | −1.04 | −0.399 | −0.247 |
| Forex alone (both sets) | 495 | −0.035 | −0.46 | −0.056 | −0.014 |
| Silver alone (Set B) | 96 | −0.461 | −3.71 | −0.578 | −0.344 |

Primary: one-sided p 0.95; Holm over the five holdout studies not yet computable (holdout-vb-early, holdout-phase-pick, holdout-h1-veto, holdout-weekly-fade missing); it is at most 1.00.

Pass lines: setAMean yes, setBMean no, pooledT no, holm pending, n100 yes, x2Mean no.

Deep against internal (pooled holdout, after costs): +0.106R a trade, Welch t 1.14 (n 607 / 275). Reported only.

## Per market, R a trade after costs (n)

A:usdjpy +0.156 (31) · A:eurusd −0.168 (31) · A:gbpusd +0.142 (27) · A:audusd +0.613 (12) · A:xau −0.323 (16) · B:eurjpy −0.030 (111) · B:xag −0.461 (96) · B:nzdusd +0.028 (102) · B:usdchf −0.152 (88) · B:usdcad −0.151 (93)

## By entry year, R a trade after costs (n)

2005 −0.593 (17) · 2006 −0.154 (14) · 2007 −0.530 (29) · 2008 +0.297 (27) · 2009 +0.841 (30) · 2010 −0.135 (28) · 2011 −0.465 (28) · 2012 −0.152 (32) · 2013 −0.188 (25) · 2014 −0.132 (29) · 2015 +0.260 (33) · 2016 −0.067 (28) · 2017 −0.437 (22) · 2018 −0.226 (33) · 2019 −0.037 (27) · 2020 −0.185 (29) · 2021 +0.189 (34) · 2022 −0.476 (23) · 2023 −0.030 (38) · 2024 −0.170 (20) · 2025 −0.559 (36) · 2026 +0.157 (25)

## Exits and sides

target 183 (+1.98R before costs), stop 414 (−1.00R before costs), time 10 (+0.72R before costs); buys −0.134R after costs (n 281), sells −0.089R after costs (n 326).

## Harness gate

The original rule (internal branch kept) re-run on 2010-2026, five main markets: reproduced rep n 411 / 411, +0.042 / +0.042R; is n 154 / 154, −0.036 / −0.036R; oos n 120 / 120, +0.125 / +0.125R. A code check only, not part of the verdict.

## What it does NOT show

- One mechanical reading (3-candle swings, the toolkit's structure), not the owner's reading on a chart; no variant was tried.
- Set B costs are assumed round trips; financing is not charged; stop slippage beyond a gap is not modelled.
- Set A trades opened in late December 2009 are closed on candles of the first half of January 2010 (exit only).
- The deep/internal split that suggested this rule came from 2024-2026 on the main markets; that data does not judge it.
- A FAIL is about this rule on this holdout; it does not judge discretionary trades.

Nothing live changed. Files: result.json (every number), trades.json (rule and comparison trades), tests/holdout-pullback-deep.test.mjs.
