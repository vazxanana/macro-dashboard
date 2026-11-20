# USD/JPY T1 on a second candle feed (20 Nov 2026)

Paper research only. Data, rule, cost and bar fixed in `PREREGISTRATION.md` before any trade on these candles was computed. Nothing live changed.

**Verdict: PASS: USD/JPY T1 on HistData M1 2018-01-02 → 2026-10-30, +0.086R a trade net (n 1582, month t +2.91); OANDA mid on the same window +0.073R (n 1679, t +2.48); same side on 100 % of the 1575 days both traded, daily R correlation 0.984**

| Feed | n | Net R/trade | Month t |
|---|---|---|---|
| HistData M1 (tested) | 1582 | +0.086 | +2.91 |
| OANDA mid 5m (reported) | 1679 | +0.073 | +2.48 |

Days traded on both feeds: 1575 (OANDA 1679, HistData 1582); same side 100 %; correlation of daily net R 0.984.

| Year | n | Net R/trade (HistData) |
|---|---|---|
| 2018 | 192 | +0.111 |
| 2019 | 183 | −0.048 |
| 2020 | 188 | +0.104 |
| 2021 | 188 | +0.157 |
| 2022 | 187 | +0.107 |
| 2023 | 106 | +0.055 |
| 2024 | 190 | +0.175 |
| 2025 | 203 | +0.047 |
| 2026 | 145 | +0.037 |

Fewer HistData days trade than OANDA days (1,582 against 1,679): the HistData file has missing minutes, most in February-July 2023 (4,000-5,100 five-minute candles a month against about 6,300), so the rule's thin-day skip drops those days. On the days both feeds traded, the trade is the same.

HistData quotes are bid prices; the cost is the one charged on OANDA mid. 2018-26 overlaps `fx-vol-breakout`'s in-sample years on OANDA: this checks the feed, not new years.
