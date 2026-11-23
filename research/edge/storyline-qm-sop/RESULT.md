# Breakout sequence with QM breaks only: result (23 Nov 2026)

Pre-registered in PREREGISTRATION.md (committed before any code). OANDA mid 5-minute candles, 2010 to 21 Nov 2026, run once
as written. Nothing live changed.

**Verdict: INCONCLUSIVE.** The primary test T1 (gold, setup H1) has 1 out-of-sample trade, under the 30 the bar needs. The
rule as written almost never trades: 12 gold H1 trades in almost 17 years. Every test also misses every other line of the
bar that could be judged (no test has a positive out-of-sample mean). No data hole over 5 days in any window (largest 3.2 days).

| Test | 2010-19 n / R a trade | 2020-23 n / R a trade | 2024 on n / R a trade | OOS month t | OOS before costs | OOS 2x costs | Holm p |
|---|---|---|---|---|---|---|---|
| T1 gold H1 (primary) | 7 / -1.177 | 4 / -0.347 | 1 / -1.016 | -1.00 | -1.000 | -1.033 | 0.324 |
| T2 gold H4 | 17 / +0.165 | 5 / -0.873 | 3 / -1.117 | -1.78 | -1.000 | -1.234 | 0.250 |
| T3 gold M30 | 5 / -1.174 | 4 / -0.445 | 3 / -1.071 | -1.78 | -1.000 | -1.142 | 0.250 |
| T4 four majors H1 | 38 / -0.451 | 11 / +0.043 | 5 / -1.080 | -2.38 | -1.000 | -1.159 | 0.092 |

R a trade after the round-trip costs of `edgekit.COSTS`; month t on calendar-month sums of the window, empty months as 0;
trades dated by their fill.

Why so few trades (descriptive, gold H1): 7,248 H1 breaks, 1,353 with an M30 QM against them before the next H1 break (the
VR), and only 67 with an M30 QM back with the break after it, before the next H1 break and before a close beyond the VR's
extreme (the CF). In 1,094 of the others the next H1 break came first: the median gap between two H1 breaks is 28 M30
candles, and a QM needs a lower high, a sweep and a close back, which seldom fits inside it. Of the 67 CFs, 4 overlapped the
VR box and 26 did not touch the BO zone; 29 orders were placed, 17 were cancelled because price reached the target first or
the order expired, 12 filled (1 won). The other tests look the same (counts per market in result.json).

What it does NOT show: it does not show the method has no edge. It shows this strict mechanical reading (every structure
break on S counts as a newer break that ends the setup, swings of 3 candles a side, QM by `edgekit.qms`) gives too few
setups to judge, and the few it gives lose. It does not judge the owner's own chart reading, which picks the structure
that matters by eye. By the pre-registration nothing may be changed and re-run on these years (no other swing size,
timeframe, "newer break" reading or filter). Secondary tests do not pass alone; no hypothesis is named.

To repeat: `node research/edge/storyline-qm-sop/run.mjs` (reads the toolkit's candle cache; about 30 s). Every trade is
in trades.json. Test: `tests/storyline-qm-sop.test.mjs`.
