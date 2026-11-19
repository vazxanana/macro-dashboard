# Gold volatility breakout, feed check: the frozen T1 on HistData XAU/USD M1

Paper research only. A stand-alone intraday rule, never a gate, exit, entry or size of the live gold book (owner decision 44 concerns that book; none of its records were read). Nothing live changed, no proposal. The test, window and bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). The rule is `gold-vol-breakout` T1, imported unchanged from `original.mjs` (sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: PASS, not an OANDA artifact (all three checks hold): T1 on HistData 2018-26 +0.042R net (n 1603, gross month t +4.21); same side as OANDA on 99.7 % of 1593 common days**

## The two feeds, 2018-01-01 → 2026-10-31

| Feed · window | n | Win | Net R/trade | Gross R/trade | Cost R/trade | Net at 2x cost | Total net R | Month t (net) | Gross month t | Month t at 2x | Stops / time | Max DD R | Median stop $ | Buys / sells (n, net R) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| HistData · 2018 → 2026-10 | 1603 | 41.9 % | +0.042 | +0.109 | +0.067 | −0.024 | +67.64 | +1.57 | +4.21 | −0.86 | 550 / 1053 | −33.14 | 10.71 | 828 +0.017 / 775 +0.069 |
| HistData · 2018-2020 | 569 | 39.2 % | +0.014 | +0.114 | +0.100 | −0.087 | +7.69 | +0.30 | +2.68 | −1.81 | 194 / 375 | −33.14 | 6.69 | 286 +0.026 / 283 +0.001 |
| HistData · 2021 → 2026-10 | 1034 | 43.4 % | +0.058 | +0.106 | +0.048 | +0.010 | +59.94 | +1.71 | +3.24 | +0.28 | 356 / 678 | −31.69 | 13.99 | 542 +0.012 / 492 +0.108 |
| OANDA · 2018 → 2026-10 | 1682 | 42.0 % | +0.050 | +0.116 | +0.066 | −0.016 | +84.20 | +1.65 | +3.98 | −0.50 | 584 / 1098 | −39.18 | 10.69 | 868 +0.050 / 814 +0.050 |
| OANDA · 2018-2020 | 568 | 39.3 % | +0.014 | +0.113 | +0.099 | −0.085 | +7.91 | +0.29 | +2.50 | −1.62 | 194 / 374 | −35.14 | 6.7 | 284 +0.020 / 284 +0.008 |
| OANDA · 2021 → 2026-10 | 1114 | 43.4 % | +0.068 | +0.118 | +0.049 | +0.019 | +76.29 | +1.77 | +3.11 | +0.48 | 390 / 724 | −39.18 | 13.45 | 584 +0.065 / 530 +0.072 |

## Decision

| HistData net > 0 | HistData gross month t ≥ 2 | same side ≥ 70 % of common days | verdict |
|---|---|---|---|
| yes (+0.042) | yes (+4.21) | yes (99.7 %) | **not an OANDA artifact** |

## Do the two feeds take the same trades?

- Days traded by both: 1593; by HistData only: 10; by OANDA only: 89.
- Same side: 1588 of 1593 (99.7 %). Correlation of daily net R 0.909, of gross R 0.909; same sign of net R on 98.2 % of the common days.
- On same-side days: stopped on HistData only 11, on OANDA only 11; |fill time difference| median 0 min, 95th percentile 15 min; |entry difference| median $0.2, 95th percentile $0.72 (HistData minus OANDA, signed median $-0.19: HistData is bid, OANDA mid).

| Common days only | n | Net R/trade | Gross R/trade | Month t (net) | Gross month t |
|---|---|---|---|---|---|
| HistData | 1593 | +0.046 | +0.113 | +1.70 | +4.32 |
| OANDA | 1593 | +0.063 | +0.129 | +2.09 | +4.48 |

## By year (net R a trade, n)

| Year | HistData | OANDA |
|---|---|---|
| 2018 | −0.021 (189) | −0.097 (188) |
| 2019 | −0.071 (190) | −0.040 (191) |
| 2020 | +0.132 (190) | +0.178 (189) |
| 2021 | +0.018 (179) | +0.021 (179) |
| 2022 | +0.019 (194) | +0.016 (193) |
| 2023 | −0.068 (107) | −0.095 (186) |
| 2024 | +0.029 (200) | +0.053 (200) |
| 2025 | +0.080 (193) | +0.181 (193) |
| 2026 | +0.242 (161) | +0.256 (163) |

## Placebo on HistData (2018 → 2026-10, 40 seeds, reported only)

The original study's placebo: every day T1 could trade, one market entry at a random 5-minute mark 01:00-18:00 UTC, side by a fair coin, stop 0.5 × the previous day's range away, out at 21:00 UTC or the stop, the same costs.

| Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max | Seeds beaten |
|---|---|---|---|---|
| +0.042 | −0.048 | −0.017 | −0.097 / +0.002 | 40 of 40 |

## Data coverage and holes

- HistData: 29 files, first M1 candle 2018-01-01T23:01, last 2026-10-30T20:58; 3081124 M1 candles after dropping 1624 repeated converted times, 616766 M5 candles.
- Weekdays in the window: 2305. With no HistData M1 candle 00:00-20:59 UTC: 26 (2018-01-01, 2018-03-30, 2018-12-25, 2019-01-01, 2019-04-19, 2019-12-25, 2020-01-01, 2020-04-10, 2020-12-25, 2021-01-01, 2021-04-02, 2021-12-24, 2022-04-15, 2022-12-26, 2023-01-02, 2023-04-07, 2023-12-25, 2024-01-01, 2024-03-29, 2024-12-25, 2025-01-01, 2025-04-18, 2025-12-25, 2026-01-01, 2026-04-03, 2026-09-25). With no OANDA candle: 25 (2018-01-01, 2018-03-30, 2018-12-25, 2019-01-01, 2019-04-19, 2019-12-25, 2020-01-01, 2020-04-10, 2020-12-25, 2021-01-01, 2021-04-02, 2021-12-24, 2022-04-15, 2022-12-26, 2023-01-02, 2023-04-07, 2023-12-25, 2024-01-01, 2024-03-29, 2024-12-25, 2025-01-01, 2025-04-18, 2025-12-25, 2026-01-01, 2026-04-03).
- On the weekdays HistData has: 52358 of 2871540 M1 minutes 00:00-20:59 missing (1.82 %); days with an intraday gap over 30 minutes: 188; the longest gap in a day 1020 minutes (2021-05-31). Longest hole in the file over the window: 3.18 days (2020-12-24T18:40 → 2020-12-27T23:00 UTC).
- Days without a trade, HistData: noprev 1, nofill 560, noopen 13, thin 115; OANDA: noopen 15, nofill 596. `prevgap` is the pre-registered guard (previous folded day more than 4 calendar days back), applied to both feeds; `thin` = fewer than 200 M5 candles 00:00-20:55. No exit crosses a hole: every trade closes by 21:00 UTC the same day.

## Reading

On HistData the rule keeps its sign and its strength before costs (gross month t +4.21) and the two feeds take the same side on 99.7 % of the days both trade, so the result is a property of gold's price path, not of the OANDA candles or fills. Over the same 2018 → 2026-10 days OANDA gives +0.050R net a trade (n 1682, month t +1.65, gross t +3.98) and HistData +0.042R (n 1603, month t +1.57, gross t +4.21); at 2x costs HistData −0.024R, OANDA −0.016R. On the 1593 common days the daily net R correlates 0.909 and the common-day means are +0.046R (HistData) and +0.063R (OANDA). By split: 2018-20 HistData +0.014R, OANDA +0.014R; 2021 → 2026-10 HistData +0.058R, OANDA +0.068R. The net month t on HistData over the window is +1.57: this check asks whether the feed carries the effect, not whether 2018-26 alone is an edge (the original's 2016-20 net was flat; the 2007-15 replication carries the evidence). HistData misses 115 days as too thin (fewer than 200 M5 candles), 112 of them in the file's 2023 hole (20 Feb to 28 Jul 2023, about 15 of every 21 hours present; XAU/USD 2023 is UNCERTIFIED in the clock audit research/edge/histdata-clock): the original's own thin rule skips them, so HistData has 79 fewer trades than OANDA, nearly all in 2023. Where both feeds trade, the fill candle is the same (median fill time difference 0 min), which also confirms the converted clock. The placebo on HistData: the real +0.042R beats 40 of 40 seeds (median −0.048R). Not an edge to trade and not a council rule; nothing live changes and no proposal is written.

## Data and method

- HistData XAU/USD M1 (bid) from council-data research/candles/xau-histdata via git show, labels converted with council/histdata.mjs histStampUtc only, aggregated to UTC M5; OANDA mid M5 XAU/USD from the candle proxy (cache out of git). Window 2018-01-01 → 2026-10-31 (the last full month in the HistData files).
- Rule: O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins; stop back at O; out at the 20:55 candle close (gold-vol-breakout T1, unchanged); data guard on both feeds: skip a day whose previous folded day is more than 4 calendar days back
- Costs: $0.60 a round trip per ounce on both feeds, 2x reported; financing `FIN.xau.long` × `nights` on buys (no trade crosses the 22:00 UTC rollover: 0). Month t on calendar-month sums. One frozen rule on one more feed: no Holm, the placebo is reported only.
- To repeat: `node research/edge/gold-vol-breakout-histdata/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `… run <dir> <oanda.json.gz>` with OANDA mid M5 XAU/USD rows `[t,o,h,l,c]` from the candle proxy (kept out of git).
