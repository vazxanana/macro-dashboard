# Discretion made explicit, the phase reader picks the entry: holdout result (23 Nov 2026)

**Verdict: FAIL.** Book with the choice: pooled holdout −0.042R a trade after costs (n 6233, month t −2.82, one-sided p 1.00); Set A +0.010R (n 1462), Set B −0.058R (n 4771); at 2x costs −0.067R; before costs −0.017R. Control without the choice −0.024R (n 13391, month t −2.66). Lines missed: setBMean, pooledT, holm, x2Mean.

Pre-registered in PREREGISTRATION.md (committed before any holdout candle was read for this study); run once by `run.mjs` on the
toolkit's OANDA mid 5m cache. The three entry generators and the phase reader are imported unchanged (hashes pinned). R after
each generator's own costs (toolkit round trips; gold buys of the box break and the zone retest pay financing as in their
studies; Set B costs are ASSUMED, not measured); t on calendar-month sums by exit month, each set's own months joined; p one-sided.

| Stream | n | R a trade after costs | month t | at 2x costs | before costs |
|---|---|---|---|---|---|
| Book with the choice, Set A (2005-2009, five main markets) | 1462 | +0.010 | 0.30 | −0.006 | +0.026 |
| Book with the choice, Set B (2010 on, five fresh markets) | 4771 | −0.058 | −3.53 | −0.086 | −0.030 |
| **Book with the choice, pooled holdout (primary)** | 6233 | −0.042 | −2.82 | −0.067 | −0.017 |
| Control: same generators, no choice, pooled | 13391 | −0.024 | −2.66 | −0.047 | −0.001 |
| Control, Set A | 3141 | −0.015 | −0.70 | −0.029 | +0.000 |
| Control, Set B | 10250 | −0.027 | −2.69 | −0.052 | −0.002 |
| Book: Pullback end trades only (pooled) | 392 | −0.169 | −2.28 | −0.204 | −0.134 |
| Book: Daily zone retest trades only (pooled) | 512 | −0.147 | −2.71 | −0.182 | −0.113 |
| Book: H1 box break trades only (pooled) | 5329 | −0.023 | −1.54 | −0.046 | +0.001 |

Primary: one-sided p 1.00; Holm over the five holdout studies 1.00.

Pass lines: setAMean yes, setBMean no, pooledT no, holm no, n100 yes, x2Mean no.

Book with the choice against the control (pooled, after costs): −0.018R a trade, Welch t −1.14 (n 6233 / 13391; the two share trades, so the t is only a guide). Reported only.

## Each generator: kept by the choice against rejected (each one position at a time per market, pooled holdout, after costs)

| Generator | candidates | kept n | kept R | rejected n | rejected R | difference | Welch t |
|---|---|---|---|---|---|---|---|
| Pullback end | 887 | 449 | −0.175 | 434 | −0.111 | −0.064 | −0.69 |
| Daily zone retest | 3638 | 659 | −0.146 | 1972 | −0.021 | −0.125 | −2.17 |
| H1 box break | 29931 | 5636 | −0.021 | 11145 | −0.011 | −0.011 | −0.65 |

## Which condition removed how many candidates (the first condition missed)

- Pullback end: 887 candidates, 450 pass; H4 range 103, D1 against 331, H4 stage not continuation 3.
- Daily zone retest: 3638 candidates, 819 pass; H4 range 388, D1 not on the trade side 2185, D1 stage not pullback / continuation 246.
- H1 box break: 29931 candidates, 9018 pass; H4 range 3119, H4 not on the trade side 11549, H4 not confirmed (ChoCh only) 6169, H1 in a pullback 76.

## Per market (book with the choice), R a trade after costs (n)

A:gbpusd +0.117 (311) · A:audusd −0.039 (305) · A:eurusd −0.038 (327) · A:usdjpy −0.026 (283) · A:xau +0.043 (236) · B:xag −0.075 (867) · B:eurjpy −0.035 (948) · B:usdchf −0.067 (971) · B:nzdusd −0.096 (992) · B:usdcad −0.018 (993)

## By entry year (book with the choice), R a trade after costs (n)

2005 −0.058 (224) · 2006 +0.016 (295) · 2007 −0.030 (290) · 2008 +0.133 (328) · 2009 −0.036 (325) · 2010 −0.104 (297) · 2011 −0.024 (315) · 2012 −0.045 (289) · 2013 −0.021 (280) · 2014 −0.111 (274) · 2015 +0.032 (254) · 2016 −0.060 (261) · 2017 −0.134 (295) · 2018 −0.018 (279) · 2019 +0.053 (270) · 2020 −0.023 (271) · 2021 −0.129 (270) · 2022 −0.105 (315) · 2023 −0.071 (299) · 2024 −0.047 (262) · 2025 −0.126 (284) · 2026 −0.029 (256)

## Exits and sides (book with the choice)

time 3053 (+0.24R before costs), stop 2360 (−1.00R before costs), target 820 (+1.88R before costs); sells −0.058R after costs (n 2918), buys −0.028R after costs (n 3315).

## Harness gate

Each generator, unchanged, re-run on 2010-2026, five main markets: reproduced (pull.rep n 411 / 411, +0.042 / +0.042R; pull.is n 154 / 154, −0.036 / −0.036R; pull.oos n 120 / 120, +0.125 / +0.125R; box.REP n 6526 / 6526, −0.005 / −0.005R; box.IS n 2600 / 2600, −0.003 / −0.003R; box.OOS n 1845 / 1845, −0.041 / −0.041R; zone.REP n 1157 / 1157, −0.025 / −0.025R; zone.IS n 417 / 417, −0.008 / −0.008R; zone.OOS n 302 / 302, −0.030 / −0.030R). tests/phase.test.mjs: pass 8, fail 0. A code check only, not part of the verdict.

## In plain words

- The choice let 6233 trades through out of 10287 candidates it accepted (34456 candidates in all); without it the same generators took 13391 trades.
- With the choice the book made −0.042R a trade after costs, without it −0.024R: the difference is −0.018R a trade.
- Pullback end: kept by the choice −0.175R a trade (n 449), rejected −0.111R (n 434), Welch t −0.69.
- Daily zone retest: kept by the choice −0.146R a trade (n 659), rejected −0.021R (n 1972), Welch t −2.17.
- H1 box break: kept by the choice −0.021R a trade (n 5636), rejected −0.011R (n 11145), Welch t −0.65.
- Before costs the book is −0.017R a trade; costs take +0.025R a trade.

## What it does NOT show

- One mechanical reading of the market cycle (the repository's phase reader, 3-candle swings), not the owner's reading on a chart; no variant of the choice was tried.
- Set B costs are assumed round trips; stop slippage beyond a gap is not modelled; financing is charged only where the generators' studies charge it (gold buys).
- Set A trades opened in late December 2009 are closed on candles of January 2010 (exit only).
- A FAIL is about this written choice on this holdout; it does not judge a person's discretion, which only a record of choices stamped before the outcome can measure.

## Audit correction (23 Nov 2026)

- The five-study Holm was reported as not computable: `familyHolm` read `primaryP` / `primary.pOne` only, and three sibling studies store their p as `primary.p`. It now reads that too. Holm over the five primary p values: this study 1 (raw one-sided p 0.9974); the line is missed, the verdict stays FAIL. No holdout candle was read again; result.json and RESULT.md were rewritten from the stored result.
- Checked and found sound: the phase is read at each signal close from candles closed by then (tests); every stored trade has signal time at or before its fill, its stop on the losing side, its entry inside its set window; costs and financing as each generator's own study; the pooled figures recompute from trades.json; the four pinned hashes match; the harness gate reproduced all nine generator windows.

Nothing live changed. Files: result.json (every number), trades.json (every trade of the book and of the control, with its phase), tests/holdout-phase-pick.test.mjs.
