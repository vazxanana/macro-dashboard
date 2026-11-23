# 23 Nov 2026: the combination grids and the DOM zone, one page

Every study of the day with its own verdict line (copied from its RESULT.md). Each folder is under `research/edge/<topic>/` with its pre-registration, code, result.json and test, and is listed on the Edge lab page. Research only: nothing here changes a live rule.

## The finding in short

- About 8 million rule variants of the engulf, Mosha and MSNR pieces (four grids) found one before-cost tilt: a resting limit at the edge of an H1 dominant zone, about +0.05R a trade, also on 2005-2019 and on a second price feed.
- The DOM zone is not what makes it: a limit at a random recent candle body of the same colour did better (+0.080R). The tilt belongs to resting limit orders judged on mid-price candles.
- Open: whether real broker fills keep it (the tick test, a stricter fill rule and a random-price control were started on 23 Nov). The DOM demo job (`council/dom-demo.mjs`) records real demo fills from 23 Nov.

## Every study

| Study | Verdict line |
|---|---|
| [`combo-grid`](../edge/combo-grid/RESULT.md) | Verdict: FAIL. 0 combinations confirmed, before or after costs. |
| [`combo-grid-2`](../edge/combo-grid-2/RESULT.md) | Verdict: PASS before costs on the pre-registered bar, 1 rule of 2,968,203 cells (FAIL after costs, 0 confirmed). The one rule makes +0.024R a trade before costs and about -0.11R after them; it is a near-zero tilt, not something to trade. |
| [`combo-grid-3`](../edge/combo-grid-3/RESULT.md) | Verdict: FAIL after costs (0 of 2,426,380 cells confirmed); before costs 9 confirmed, eight of them one family, a hypothesis for untouched years. |
| [`combo-grid-4`](../edge/combo-grid-4/RESULT.md) | Verdict: PASS. Before costs 57 of 5,346 cells confirmed on 2010-2019, 42 of them dominant zones (H1 zone limit, pooled: +0.050R a trade in 2015-19, n 75,711, month t 8.54); after costs 0 confirmed (-0.064R). |
| [`dom-zone-holdout`](../edge/dom-zone-holdout/RESULT.md) | Verdict: PASS before costs on all three untouched tests (n 151,045 / 273,279 / 27,965, about +0.05R a trade, month t 14.2 / 14.9 / 2.7); after costs it loses on every set. |
| [`dom-placebo`](../edge/dom-placebo/RESULT.md) | Verdict: FAIL. DOM +0.055R a trade before costs (n 151,045, month t 14.23), but a random earlier same-colour body makes +0.080R (n 101,439; Welch t -4.29). |
| [`dom-second-feed`](../edge/dom-second-feed/RESULT.md) | Verdict: PASS. On HistData M1 candles, 2020 on, the seven markets pooled made +0.0486R a trade before costs (n 148190, month t 11.66), and 2018-19 alone +0.0663R (n 41172, month t 8.12); after costs both lose. |
| [`dom-gold-hourcost`](../edge/dom-gold-hourcost/RESULT.md) | Verdict: FAIL. At measured costs the 4R exit made -0.015R a trade in 2021-23 (n 8850, month t -0.48) and +0.072R in 2024-now (n 8911, t 3.33); the trail -0.035R (t -2.19) and +0.010R (t 0.87). |
| [`dom-timeframes`](../edge/dom-timeframes/RESULT.md) | Verdict: PARTIAL. Mixed: before costs H4 > M15 (+0.055R a trade, n 39,617, halves t 5.47 / 4.66), H1 > M5 (+0.055R, n 151,045, t 12.13 / 8.45) and M30 > M5 (+0.036R, n 286,612, t 7.74 / 9.70) clear the bar on 2010-2019 and D1 > H1 misses it (+0.039R, n 7,015, t 1.34 / 1.91); after costs only D1 > H1 is above zero (+0.019R, t under 1) and H4 > M15 is flat (−0.003R). |
| [`dom-filters`](../edge/dom-filters/RESULT.md) | Verdict: FAIL. 0 of 13 filters pick better trades in both halves; the unfiltered rule itself made +0.0548R a trade before costs (n 151045, month t 14.23) and -0.052R after costs. |
| [`dom-exits`](../edge/dom-exits/RESULT.md) | Verdict: PASS. Before costs the 2R exit made +0.053R a trade in 2010-14 (n 75,351, month t 8.33) and +0.045R in 2015-19 (n 75,703, t 6.41); no other exit beats 2R after Holm, and after costs every exit loses (2R -0.058R a trade). |
| [`usdjpy-dom-ef`](../edge/usdjpy-dom-ef/RESULT.md) | Verdict: FAIL. -0.076R a trade after costs on USD/JPY 2005-2019 (n 4,500, month t -3.58). |
| [`ltf-choch-entry`](../edge/ltf-choch-entry/RESULT.md) | Verdict: INCONCLUSIVE. T1 (M5 ChoCh, 2R, 18 markets) −0.014R a trade before costs out of sample (n 117772, month t −3.42); T2 (M1) −0.007R (n 46335); M5 vs M15 −0.003R, M1 vs M5 +0.007R |
| [`weekly-daily-rejection-2020`](../edge/weekly-daily-rejection-2020/RESULT.md) | Verdict: FAIL. Longs pooled over 17 markets made +0.086R a trade after costs (n 6,778, month-sum t 1.85) and shorts -0.075R (n 3,534, month-sum t -1.31); neither passes discovery (t 1.48 / -0.27) or confirmation (t 1.12 / -2.22). |
| [`trendline-engulf-2020`](../edge/trendline-engulf-2020/RESULT.md) | Verdict: FAIL. 0 of 4 tests pass: confirmation 2024-26 after costs T1 n 1,174, -0.021R a trade, month t -0.49; T2 n 4,024, -0.050R, t -2.46; T3 n 1,019, +0.050R, t 1.18 (discovery -0.064R); T4 n 3,624, -0.084R, t -3.46. |
| [`isl-engulf-2020`](../edge/isl-engulf-2020/RESULT.md) | Verdict: FAIL. 0 of 4 tests pass: the ISL-qualified engulf zone loses after costs in both windows (best confirmation, H4 with a 2R target: n 4,209, -0.0067R a trade, month t -0.27). |
| [`zone-use-count-2020`](../edge/zone-use-count-2020/RESULT.md) | Verdict: FAIL. No difference between touch numbers holds (0 of 4; largest T2-EG -0.0068R a trade, t -1.60, Holm p 0.44) and no touch group passes the bar (EG first touch -0.060R a trade after costs, n 219,541, month t -15.18). |
| [`decision-level-2020`](../edge/decision-level-2020/RESULT.md) | Verdict: FAIL. 0 of 2 pass: confirmation 2024-now T1 (strict) n 2,635, -0.015R a trade after costs, month t -0.59; T2 (broad) n 16,371, -0.020R, month t -1.25. |
| [`apex-entry-2020`](../edge/apex-entry-2020/RESULT.md) | Verdict: FAIL. 0 of 4 tests pass: apex n 2,738, -0.220R a trade, month t -6.07; low-risk apex n 2,282, -0.199R, t -4.80; continuation instant n 4,550, -0.299R, t -11.04; continuation after an H1 DC n 1,207, -0.178R, t -4.59 (after costs). |
| [`mosha-weekly-er`](../edge/mosha-weekly-er/RESULT.md) | Verdict: FAIL. 0 of 2: weekly agrees and er20 >= 0.2 made −0.249R a trade after costs in 2020-2023 (n 224, month t -1.35) and −0.012R from 2024 (n 168, month t -0.06); the rest −0.318R and −0.013R. |
| [`mosha-janda-2020`](../edge/mosha-janda-2020/RESULT.md) | Verdict: FAIL. T1 (every Janda trade, 18 markets, 2R) made −0.132R a trade after costs in 2024-26 (n 4725, month t −5.47) and −0.107R in 2020-23 (n 6400, month t −6.05); buys only and shallow turns only lose too. |
| [`eg-3tf-chain-2020`](../edge/eg-3tf-chain-2020/RESULT.md) | Verdict: FAIL. After costs 0 of 6 pass and all six lose in the confirmation window; the best, T2 (D1 / H4 / H1, roadblock target), made −0.183R a trade (n 2880, month t −1.31). |
| [`storyline-pairs-2020`](../edge/storyline-pairs-2020/RESULT.md) | Verdict: INCONCLUSIVE. 0 of 6 tests pass after costs; the best in confirmation, D-gap, made +0.333R a trade (n 26, month-sum t 0.82). |
| [`mosha-cf-cases-2020`](../edge/mosha-cf-cases-2020/RESULT.md) | Verdict: FAIL. after costs, confirmation: T1 case 2 minus case 1 −0.187R (n 871/627, t -1.51); T2 −0.196R (n 1287/211, t -1.16); clear-CF +0.013R a trade (n 627, month t 0.12; discovery −0.296R, t -3.54). |
| [`drd-h4-2020`](../edge/drd-h4-2020/RESULT.md) | Verdict: FAIL. Before costs, T1 (strong H4 body, 30-pip stop, 3R) made -0.022R a trade in confirmation 2024-now (n 1323, month-sum t -0.41) after -0.052R in discovery 2020-23 (n 1780, t -0.95); 0 of 3 tests pass. |
| [`chart-rules-2020`](../edge/chart-rules-2020/RESULT.md) | Verdict: FAIL. 0 of 3 tests pass: the barrier retest on H1 boxes made -0.020R a trade after costs in 2024-2026 (n 3,354, month t -0.29), on H4 boxes -0.035R (n 283, month t -0.20), the sweep reversal -0.252R (n 94, month t -1.49). |
| [`eg-methods-18-2020`](../edge/eg-methods-18-2020/RESULT.md) | Verdict: FAIL. 0 of 6 readings pass before costs and 0 of 6 after costs: from 2024 on the six made −0.028R a trade before costs on 27501 trades (month t -2.98) and −0.073R after costs (month t -7.97). |
