# Edge research · timing — time-of-day windows for Scalp / Intraday

> **Clock correction, 10 Nov 2026.** NOT RE-RUN: the published numbers were computed on the old candle clock. Details: the last section of this page.

**Question.** Inside the hours the MERIDIAN Scalp and Intraday setups already trade, are there hours (UTC, and London / New York local with daylight saving), minutes past the hour, session opens (London 08:00 local = 07:00/08:00 UTC, NY cash open 09:30 NY = 13:30/14:30 UTC), first/last 30 minutes, or Friday-afternoon / Monday-Asia windows where results are reliably better or worse out of sample?

**Verdict: FAIL — no time window passes.** No window turns any of the four engine setups positive out of sample, so none meets the bar for a candidate. One finding is robust: **the New York afternoon (12:00–16:59 NY) and everything after 17:00 UTC are worse for Scalp in every year.** That makes this a damage-limitation note, not an edge. A bigger finding sits underneath it: **on 8.8 years of M1 data the live Scalp sleeve itself loses money after costs (−0.18R a trade in-sample, −0.23R out of sample, every year negative).** No time window fixes that.

## Data and method

- **Engine.** The live code: `council/engine.mjs` (`msAnalyze`, `buildSetup`, `buildRetrace`) and `council/clean.mjs` (the bad-print cleaner), imported unchanged. `replay.mjs` copies the stepping, freshness, pending-order, duplicate, management and spread-cost logic from `council/backtest.mjs`:
  - a step every 5 minutes;
  - each timeframe is its last 720 closed candles plus the forming candle built from M1;
  - a signal must be READY with a CF no older than 12 lower-timeframe candles;
  - entry is a limit at the engine's entry price, or at market when price is already through it;
  - resting orders expire after 3 h (Scalp) or 12 h (Intraday);
  - each trade pays one spread in R (forex 1 pip, gold 0.30).
- **Setups.** Scalp (M15→M1), Intraday (H1→M5), Retrace M15→M1 (rscalp) and Retrace H1→M5 (rintra).
- **Data.** HistData M1 bars, 2018 to October 2026, for XAU/USD, EUR/USD, GBP/USD, USD/CAD, USD/CHF and AUD/USD: 54 market-years and 3.7 M engine steps.
  - HistData file times are New York local time with daylight saving. I checked this: NFP prints at 08:30 NY in both January and July. The files are converted to UTC.
  - Total: 128,000 closed trades across the four setups.
- **Differences from the live trader, stated plainly:**
  1. Only the timeframes these four setups read are analysed (M1, M5, M15, H1).
  2. The D1 trend label is `msAnalyze` over the last 720 **closed** daily candles, using the 17:00 New York rollover (OANDA's alignment). Live also includes the forming day.
  3. The prices come from a different feed.
  4. These live rules are not modelled: the portfolio-level exposure cap, the dollar cap, the news guard and the 3-hour re-entry rule.
  5. The spread is a fixed 1 pip, so the real cost around rollover (spreads widen) is *understated*. That only strengthens the "late hours are worse" result.
- **Fidelity check.** On the overlap with the council's 30-day Kraken replay (8–30 Oct 2026) the two replays agree overall:
  - all Scalp trades: n572, −0.154R net here vs n490, −0.169R net in `backtest.json`;
  - the live Scalp rule: −0.25R here vs −0.07R on Kraken (n≈110 each).
- **Baselines** use the live filters, net of cost and with no break-even. Each setup's filter:
  - **Scalp:** against D1, not Asia (00–07 UTC) and not overlap (12–16 UTC), skips AUD/USD, rr ≥ 1.2. Its trading hours are therefore 07–12 and 16–24 UTC.
  - **Intraday:** rr 1.2–10, all hours (shadow).
  - **rscalp:** rr ≥ 3.
  - **rintra:** skips USD/CHF, rr ≥ 1.2.
- **Walk-forward.** Windows are chosen only on 2018–2023 (in-sample, IS):
  - the window's trades differ from the rest with |Welch t| ≥ 2, and the rule (skip the window, or add it if the live sessions currently exclude it) improves IS;
  - each window chosen this way is then judged on 2024–Oct 2026 (out of sample, OOS) by the preamble's tests (OOS n ≥ 100, OOS expectancy > 0, better than the baseline, positive in at least 2 of 3 OOS years), plus one more: the window itself must still be worse (skip) or positive (add) OOS.
- **Windows tried.**
  - 24 UTC hours;
  - 5 minute-of-hour buckets;
  - London open: 07:00 London, 08:00–08:29 / 08:00–08:59 London, and fixed 07 / 08 UTC;
  - US 08:30 data and 10:00 data;
  - NY cash open: 09:30–09:59 / 09:30–10:29 NY, and fixed 13:30–14:29 UTC;
  - London fix/close and the last 30 minutes of London;
  - the last 30 minutes of NY cash, the NY afternoon, rollover, and after 17 UTC;
  - Friday after 12:00 NY, all of Friday, Monday Asia, and each weekday;
  - Tokyo open.
- **Multiple testing.** That is 54 windows; with "skip" and "add" variants, **243 variants were tested** across the 4 setups. 13 were chosen in-sample, and **0 pass OOS**. With 243 tests, about 12 would clear |t| ≥ 2 by chance. 13 chosen is about what noise alone produces, so the per-window IS picks themselves are not evidence. The only thing worth reporting is a window that is worse in both halves *and* year after year (below).

## Baselines (net R/trade after spread; stats {n, win rate, exp, total R, max DD, t})

| setup | IS 2018–23 | OOS 2024–26 | gross IS / OOS | years positive |
|---|---|---|---|---|
| Scalp (live rule) | n9616, wr 27.9%, **−0.179**, −1722R, DD −1768R, t −10.6 | n4445, wr 25.8%, **−0.225**, −1000R, DD −1021R, t −8.7, worst streak 30 | −0.047 / −0.090 | 0 of 9 |
| Intraday | n9769, **−0.144**, t −9.2 | n4625, **−0.090**, t −3.8 | −0.079 / −0.021 | — |
| Retrace M15→M1 (rr ≥ 3) | n3753, **−0.223**, t −5.7 | n1859, **−0.240**, t −4.5 | −0.014 / −0.035 | — |
| Retrace H1→M5 | n2001, **−0.094**, t −2.3 | n968, **−0.118**, t −1.8 | +0.015 / −0.008 | — |

Scalp per year (net): 2018 −0.11, 2019 −0.27, 2020 −0.15, 2021 −0.17, 2022 −0.19, 2023 −0.21, 2024 −0.25, 2025 −0.23, 2026 −0.19.

**Why so different from the 30-day replay's +0.33R?** That figure came from one month on one feed. On this data, in the same weeks, both replays show Scalp negative. The engine's M1 stops are small (the median spread costs about 0.13R a trade), and before costs the Scalp is already about −0.05 to −0.09R.

## Windows chosen in-sample, judged out of sample (Scalp, the live sleeve)

| rule | IS window exp (n) vs rest | rule IS | rule OOS (n) | baseline OOS | window OOS (n) | OOS years > 0 | verdict |
|---|---|---|---|---|---|---|---|
| skip NY afternoon 12:00–16:59 NY | −0.228 (3216) vs −0.154 | −0.154 | **−0.146** (2807) | −0.225 | −0.361 (1638) | 0/3 | FAIL (still < 0) |
| skip after 17:00 UTC | −0.224 (3704) vs −0.151 | −0.151 | −0.138 (2545) | −0.225 | −0.342 (1900) | 0/3 | FAIL (still < 0) |
| skip 20:00 UTC | −0.388 (536) | −0.167 | −0.209 | −0.225 | −0.497 (255) | 0/3 | FAIL |
| skip 21:00 UTC | −0.437 (284) | −0.171 | −0.216 | −0.225 | −0.436 (182) | 0/3 | FAIL |
| skip minute :30–:44 | −0.242 (2312) | −0.159 | −0.212 | −0.225 | −0.270 (1003) | 0/3 | FAIL |

Intraday (skip 18 UTC, skip 21 UTC, skip after 17 UTC), rscalp (skip 03 UTC, 23 UTC, after 17 UTC) and rintra (skip 21 UTC, skip Wednesday): all FAIL. Each rule stays negative OOS. Full tables are in `tables.md`.

## What *is* consistent (worse in both halves and almost every year)

From `yearly.txt` (live Scalp baseline; signals inside the window vs outside, net R/trade):

| window | worse in | IS in / rest | OOS in / rest | explanation |
|---|---|---|---|---|
| **NY afternoon 12:00–16:59 NY** | **9 of 9 years** | −0.23 / −0.15 | −0.36 / −0.16 | London has closed (16:00 London fix); liquidity drops, and M1 breaks in thin markets fail and chop. Gross is also worse (OOS −0.22 vs −0.03), so this is not just cost. |
| after 17:00 UTC | 7 of 9 | −0.22 / −0.15 | −0.34 / −0.16 | The same thin market, plus the 17:00 NY rollover, where real spreads widen (not modelled here, so the true gap is larger). |
| Friday after 12:00 NY | 6 of 9 | −0.19 / −0.18 | −0.46 / −0.19 | Week-end position squaring and thin liquidity; weakest of the three in-sample. |
| last 30 min of NY cash (15:30–15:59 NY) | both halves | −0.29 / −0.18 | −0.62 / −0.19 | Same afternoon effect (n small: 284 / 163). |
| rollover 16:30–18:29 NY | both halves | −0.29 / −0.17 | −0.30 / −0.19 | Spread widening and an empty book. |

For Intraday the same late-day windows are worse in both halves: after 17 UTC is −0.22 vs −0.13 IS and −0.22 vs −0.06 OOS, worse in 7 of 9 years.

The London open and the NY cash open did **not** give a stable result:

- **Scalp at the London open** (08:00–08:59 London, which already sits inside the hours Scalp trades): better than the rest in both halves (IS −0.13 vs −0.18, OOS −0.12 vs −0.20), but still negative. The DST-aware window beats both fixed-UTC hours, which flip sign between halves.
- **Intraday at the London open** (07:00–08:59 London) and **the NY cash open** (09:30–10:29 NY): better than the rest in both halves and positive out of sample (+0.06 to +0.15R, n 270–370). But they were negative in-sample (−0.04 to −0.13R), so "Intraday only at the opens" could not have been picked on 2018–23. Watch it; don't trade it.
- **Minute-of-hour:** no stable effect.
- **Monday Asia:** no stable effect (Scalp doesn't trade Asia anyway).

**Reading for the owner:**

- If the Scalp sleeve keeps trading, stopping new Scalp signals at **12:00 New York time** (16:00/17:00 UTC) is the one timing change backed in every year. On these numbers it cuts the loss per trade by about 0.08R OOS and removes about 37% of the trades.
- But it **does not make the Scalp profitable**, so it doesn't meet the bar for a proposal. The bigger issue is the Scalp baseline itself (see the `baseline` block in `result.json`), which is a question for the setup research, not for timing.

## Heatmaps — OOS 2024–Oct 2026 net expectancy R/trade (n) by signal hour (UTC) × market

Scalp: against D1, rr ≥ 1.2, **all hours**. "(off)" marks hours the live session rule skips. AUD/USD is shown although live skips it. The last column is the same hour in-sample.

| UTC hour | audusd | eurusd | gbpusd | usdcad | usdchf | xau | all | IS all |
|---|---|---|---|---|---|---|---|---|
| 00 (off) | -0.54 (78) | -0.12 (77) | -0.38 (78) | -0.21 (73) | -0.31 (66) | -0.15 (67) | -0.29 (439) | -0.30 (866) |
| 01 (off) | +0.01 (95) | -0.09 (67) | -0.06 (70) | -0.28 (82) | -0.28 (81) | +0.01 (78) | -0.12 (473) | -0.18 (996) |
| 02 (off) | +0.13 (72) | -0.24 (71) | -0.47 (73) | +0.13 (75) | -0.54 (58) | -0.20 (57) | -0.19 (406) | -0.15 (714) |
| 03 (off) | +0.06 (66) | -0.39 (45) | +0.19 (56) | +0.17 (61) | -0.40 (59) | -0.48 (40) | -0.11 (327) | -0.15 (676) |
| 04 (off) | +0.17 (70) | -0.22 (49) | -0.26 (57) | -0.40 (66) | -0.41 (84) | +0.33 (49) | -0.16 (375) | -0.20 (644) |
| 05 (off) | -0.43 (75) | -0.04 (57) | -0.30 (67) | -0.46 (70) | -0.14 (92) | -0.18 (68) | -0.26 (429) | -0.22 (895) |
| 06 (off) | -0.27 (80) | -0.48 (84) | -0.22 (91) | -0.36 (100) | +0.05 (101) | -0.13 (75) | -0.23 (531) | -0.32 (1171) |
| 07 | -0.13 (87) | -0.17 (104) | +0.08 (87) | -0.09 (96) | -0.06 (110) | -0.26 (64) | -0.10 (548) | -0.19 (1372) |
| 08 | -0.06 (94) | -0.26 (95) | +0.01 (87) | -0.33 (114) | -0.29 (109) | -0.30 (56) | -0.21 (555) | -0.08 (1295) |
| 09 | +0.29 (84) | -0.40 (74) | -0.07 (84) | -0.14 (89) | +0.06 (87) | -0.19 (50) | -0.06 (468) | -0.10 (1183) |
| 10 | -0.19 (99) | -0.33 (76) | +0.42 (88) | -0.26 (74) | -0.32 (106) | +0.49 (57) | -0.07 (500) | -0.23 (1170) |
| 11 | -0.57 (87) | -0.36 (87) | -0.03 (92) | +0.09 (102) | -0.14 (105) | -0.35 (77) | -0.21 (550) | -0.16 (1168) |
| 12 (off) | -0.39 (91) | +0.15 (102) | -0.17 (116) | -0.02 (132) | -0.06 (118) | -0.01 (101) | -0.08 (660) | -0.17 (1388) |
| 13 (off) | -0.18 (133) | -0.06 (106) | +0.05 (127) | -0.20 (126) | -0.63 (108) | +0.19 (95) | -0.14 (695) | -0.16 (1453) |
| 14 (off) | -0.31 (132) | +0.05 (99) | -0.20 (97) | -0.24 (145) | -0.23 (119) | -0.35 (89) | -0.22 (681) | -0.17 (1414) |
| 15 (off) | +0.34 (86) | -0.22 (88) | -0.26 (99) | -0.33 (91) | +0.10 (82) | -0.03 (60) | -0.08 (506) | -0.06 (1130) |
| 16 | +0.03 (86) | -0.21 (71) | -0.08 (79) | -0.32 (84) | +0.00 (82) | -0.27 (59) | -0.13 (461) | -0.22 (964) |
| 17 | -0.29 (85) | -0.15 (66) | -0.41 (89) | -0.11 (81) | -0.16 (68) | -0.14 (56) | -0.22 (445) | -0.24 (861) |
| 18 | -0.06 (99) | -0.35 (48) | -0.52 (82) | -0.37 (70) | -0.71 (80) | -0.35 (71) | -0.38 (450) | -0.15 (902) |
| 19 | -0.28 (68) | -0.42 (70) | -0.37 (69) | -0.53 (87) | -0.72 (71) | -0.15 (52) | -0.43 (417) | -0.22 (832) |
| 20 | -0.12 (56) | -0.31 (48) | -0.38 (55) | -0.50 (69) | -0.73 (48) | -0.62 (35) | -0.43 (311) | -0.36 (657) |
| 21 | -0.12 (51) | -0.57 (29) | -0.46 (49) | -0.29 (49) | -0.49 (42) | -0.41 (13) | -0.37 (233) | -0.41 (368) |
| 22 | -0.28 (63) | +0.05 (28) | -0.41 (32) | -0.00 (42) | -0.05 (33) | +0.30 (11) | -0.13 (209) | -0.21 (350) |
| 23 | -0.04 (76) | +0.03 (53) | -0.13 (51) | +0.01 (60) | -0.34 (59) | -0.31 (34) | -0.11 (333) | -0.09 (635) |

Intraday (rr 1.2–10, all hours):

| UTC hour | audusd | eurusd | gbpusd | usdcad | usdchf | xau | all | IS all |
|---|---|---|---|---|---|---|---|---|
| 00 | -0.30 (46) | -0.20 (38) | +0.12 (33) | -0.12 (29) | +0.69 (27) | +0.10 (37) | +0.01 (210) | -0.19 (380) |
| 01 | -0.01 (56) | -0.10 (32) | -0.30 (25) | +0.17 (26) | +0.15 (28) | -0.15 (46) | -0.05 (213) | -0.26 (422) |
| 02 | -0.12 (37) | -0.18 (24) | +0.27 (24) | -0.56 (23) | -0.31 (20) | -0.64 (23) | -0.24 (151) | +0.06 (280) |
| 03 | -0.59 (18) | -0.13 (12) | -0.17 (20) | -0.64 (19) | +1.19 (25) | -0.35 (22) | -0.05 (116) | -0.14 (255) |
| 04 | +0.34 (30) | -0.14 (17) | +0.09 (19) | -0.59 (25) | -0.49 (15) | -0.47 (17) | -0.17 (123) | -0.08 (223) |
| 05 | -0.44 (34) | -0.31 (29) | -0.47 (21) | +0.25 (27) | -0.41 (32) | -0.07 (29) | -0.25 (172) | -0.24 (334) |
| 06 | +0.12 (41) | -0.42 (45) | -0.14 (47) | -0.24 (43) | +0.09 (46) | -0.06 (23) | -0.11 (245) | -0.14 (623) |
| 07 | +0.06 (36) | +0.24 (54) | -0.01 (59) | +0.17 (53) | +0.12 (52) | -0.09 (36) | +0.09 (290) | -0.04 (680) |
| 08 | -0.45 (46) | +0.08 (57) | +0.04 (34) | -0.48 (36) | +0.28 (48) | -0.27 (33) | -0.11 (254) | -0.09 (622) |
| 09 | +0.33 (27) | -0.07 (29) | -0.23 (47) | -0.33 (37) | +0.41 (35) | +0.03 (21) | -0.01 (196) | -0.12 (475) |
| 10 | +0.51 (22) | -0.14 (28) | -0.22 (38) | +0.01 (37) | -0.46 (29) | +0.81 (23) | +0.03 (177) | -0.15 (433) |
| 11 | -0.23 (24) | -0.30 (37) | +0.20 (44) | -0.06 (45) | -0.23 (36) | +0.57 (33) | +0.00 (219) | -0.08 (498) |
| 12 | -0.25 (51) | -0.19 (54) | +0.10 (54) | -0.05 (64) | -0.25 (59) | -0.01 (48) | -0.11 (330) | -0.11 (597) |
| 13 | +0.12 (47) | +0.37 (38) | +0.13 (46) | +0.21 (75) | -0.13 (51) | -0.14 (61) | +0.08 (318) | -0.16 (698) |
| 14 | +0.03 (55) | +0.10 (53) | -0.07 (58) | +0.03 (70) | -0.09 (49) | +0.18 (60) | +0.03 (345) | -0.15 (674) |
| 15 | -0.00 (46) | -0.26 (31) | -0.42 (39) | +0.10 (40) | +0.03 (37) | -0.05 (31) | -0.09 (224) | -0.16 (504) |
| 16 | -0.53 (31) | -0.37 (22) | -0.47 (26) | -0.56 (28) | -0.28 (29) | -0.14 (24) | -0.40 (160) | -0.12 (388) |
| 17 | -0.16 (28) | -0.04 (22) | -0.13 (32) | +0.17 (31) | -0.31 (25) | +0.11 (19) | -0.06 (157) | -0.19 (317) |
| 18 | -0.31 (33) | +0.37 (23) | -0.26 (24) | -0.21 (22) | -0.47 (34) | -0.72 (18) | -0.27 (154) | -0.33 (334) |
| 19 | +0.31 (21) | -0.50 (18) | -0.29 (19) | -0.72 (17) | -0.35 (33) | +0.64 (20) | -0.15 (128) | -0.16 (275) |
| 20 | -0.26 (11) | -0.38 (13) | -0.34 (20) | -0.78 (20) | -0.21 (21) | -0.04 (12) | -0.36 (97) | -0.30 (206) |
| 21 | -0.95 (16) | -0.16 (9) | -0.86 (16) | -0.56 (17) | -0.62 (23) | -0.03 (9) | -0.60 (90) | -0.45 (137) |
| 22 | +0.97 (16) | -0.81 (9) | -0.44 (9) | -0.56 (15) | -0.45 (13) | -1.06 (8) | -0.26 (70) | -0.15 (120) |
| 23 | -0.04 (45) | -0.60 (22) | -0.14 (32) | +0.35 (20) | -0.20 (39) | +0.07 (28) | -0.10 (186) | -0.07 (294) |

The rscalp and rintra heatmaps, and the "every window" tables (inside vs outside, IS and OOS) for each setup, are in `tables.md`. Machine-readable: `result.json` (`heatmaps`).

How to read the heatmaps: no hour × market cell is reliably positive. Single cells of about 50–100 trades swing ±0.4R by chance (one trade's SD is about 1.5R, so the SE is about 0.2R). The pattern across rows is the signal: 17–21 UTC is the worst band for Scalp in both halves.

## Files

- `replay.mjs`: multi-year engine replay, one market-year per run (`node research/edge/timing/replay.mjs <candlesDir> <market> <year> <out.json>`). The candles come from `council-data:research/candles/{EURUSD,…,xau-histdata}`.
- `run-all.mjs`: runs all 54 jobs, 4 at a time (about 2 h on this sandbox).
- `analyze.mjs`: windows, walk-forward selection, OOS verdicts, heatmaps. Writes `result.json` and `tables.md`.
- `yearly.mjs` → `yearly.txt`: year-by-year check of the consistent windows.

No `proposal.md`: no window passed.

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`. This study read every year as New York time, so from 2019 its bars were one hour early in about four weeks a year (the weeks the US is on daylight time and Europe is not).

**Not re-run: computed on the old clock.** Reason: this is a long engine replay over 8 years of M1 candles for several markets, and the machine time was spent on the studies that feed a live system or the Academy. The loader is fixed, so the next run is on the corrected clock; the commands are on this page. Until then every number here is an old-clock number. What the old clock touched here: in about four weeks a year from 2019 the hour-of-day and session buckets, which are this study's subject, were an hour early.
