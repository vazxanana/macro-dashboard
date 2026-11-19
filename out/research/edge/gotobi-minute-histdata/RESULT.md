# Gotobi fade: the entry-minute grid on HistData M1 (is the 00:55 spike a feed artefact?)

**Verdict: FEED-CONFIRMED: on HistData too the 00:55 entry is the clear maximum (+0.127R a trade, +0.027R above the next row, 00:54) and one minute late keeps 35 % of it (+0.044R).**

**A sensitivity report, not a test and not a choice.** The frozen gotobi fade (T2 of #878: sell USD/JPY at 00:55 UTC on gotobi days, buy back at 06:00 UTC) with the entry moved minute by minute, as #908 did on OANDA M1, on the independent HistData USD/JPY M1 feed (bid; labels to UTC through council/histdata.mjs only). The day list, the stop distance D (from this feed's own M5 base window), the side and the costs are frozen; nothing is chosen from the grid, and nothing here is a verdict about an edge. Pre-registered in PREREGISTRATION.md (first commit of the branch). Paper research only; nothing live changed.

**Gate: PASSED.** The frozen code on this loader's M5 candles gives n 623, +0.1265R a trade over 2018-01-01 to 2026-10-29 (#894: 623, +0.1265, to 2026-10-29). The HistData M1 00:55 row gives n 623 (tolerance ±6) and +0.1265R a trade (tolerance ±0.010R), month t +2.34. The M1 open at 00:55 equals the M5 open at 00:55 on 625 of 625 days (100.00 %; required 99 %). Days traded on M5 only: none; on M1 only: none; open mismatches: none.

## HistData M1 (bid), 2018-01-01 to 2026-10-29, 626 gotobi days with a frozen D

| Entry (UTC), exit 06:00 | n | Net R a trade | Gross R | Cost R | Total net R | Month t | Win % | Stopped % | No trade (no candle at the entry or exit) |
|---|---|---|---|---|---|---|---|---|---|
| 00:53 | 623 | +0.0963 | +0.2128 | 0.1166 | +60.0 | +1.70 | 48.3 | 28.9 | 3 |
| 00:54 | 623 | +0.0999 | +0.2165 | 0.1166 | +62.3 | +1.72 | 49.0 | 28.6 | 3 |
| **00:55 (the rule)** | 623 | +0.1265 | +0.2430 | 0.1166 | +78.8 | +2.34 | 50.1 | 27.5 | 3 |
| 00:56 | 623 | +0.0443 | +0.1608 | 0.1165 | +27.6 | +0.88 | 47.7 | 28.6 | 3 |
| 00:57 | 623 | +0.0218 | +0.1383 | 0.1165 | +13.6 | +0.43 | 45.8 | 28.9 | 3 |
| 00:58 | 623 | +0.0066 | +0.1231 | 0.1165 | +4.1 | +0.13 | 44.8 | 29.4 | 3 |
| 01:00 | 622 | +0.0305 | +0.1472 | 0.1166 | +19.0 | +0.59 | 45.2 | 28.5 | 4 |

## OANDA M1 (mid, #908's file), same window, 631 gotobi days with a frozen D

| Entry (UTC), exit 06:00 | n | Net R a trade | Gross R | Cost R | Total net R | Month t | Win % | Stopped % | No trade (no candle at the entry or exit) |
|---|---|---|---|---|---|---|---|---|---|
| 00:53 | 625 | +0.1004 | +0.2170 | 0.1166 | +62.8 | +1.75 | 49.0 | 29.6 | 6 |
| 00:54 | 625 | +0.1109 | +0.2275 | 0.1166 | +69.3 | +1.92 | 49.4 | 28.5 | 6 |
| **00:55 (the rule)** | 625 | +0.1431 | +0.2597 | 0.1166 | +89.4 | +2.66 | 51.2 | 26.6 | 6 |
| 00:56 | 625 | +0.0508 | +0.1674 | 0.1166 | +31.7 | +1.01 | 47.8 | 29.1 | 6 |
| 00:57 | 625 | +0.0303 | +0.1469 | 0.1166 | +18.9 | +0.59 | 46.6 | 29.0 | 6 |
| 00:58 | 624 | +0.0193 | +0.1358 | 0.1164 | +12.1 | +0.38 | 45.8 | 29.2 | 7 |
| 01:00 | 625 | +0.0308 | +0.1474 | 0.1166 | +19.3 | +0.60 | 45.3 | 28.5 | 6 |

## The two feeds, day by day, at each entry minute (days both feeds trade)

| Entry (UTC) | Common days | Corr. net R | Corr. move (pips) | Same sign % | Entry diff, median abs (pips) | Entry diff, 95th pct abs (pips) | HistData net R | OANDA net R |
|---|---|---|---|---|---|---|---|---|
| 00:53 | 617 | 0.9959 | 0.9963 | 98.9 | 0.2 | 0.6 | +0.0973 | +0.0921 |
| 00:54 | 617 | 0.9965 | 0.9993 | 99.0 | 0.2 | 0.6 | +0.1020 | +0.1036 |
| 00:55 | 617 | 0.9966 | 0.9979 | 98.9 | 0.2 | 0.9 | +0.1314 | +0.1378 |
| 00:56 | 617 | 0.9970 | 0.9995 | 99.4 | 0.2 | 0.6 | +0.0453 | +0.0437 |
| 00:57 | 617 | 0.9992 | 0.9995 | 99.5 | 0.2 | 0.7 | +0.0221 | +0.0240 |
| 00:58 | 616 | 0.9959 | 0.9991 | 99.5 | 0.2 | 0.7 | +0.0063 | +0.0134 |
| 01:00 | 617 | 0.9920 | 0.9968 | 99.5 | 0.3 | 0.7 | +0.0310 | +0.0256 |

## The pre-registered reading

| Condition | Value | Holds |
|---|---|---|
| 00:55 net R a trade > 0 and at least 0.020R above every other row | +0.1265; next highest 00:54 +0.0999 (margin +0.0266) | yes |
| 00:56 net R a trade < 0.5 x 00:55 | +0.0443 = 35.0 % of 00:55 | yes |

## Notes

- D, the day list, the side and the costs are frozen; the stop sits D above the actual (shifted) fill. D comes from the HistData M5 base window (00:55 -> 06:00 UTC), as #908 took D from its own feed's M5; on the OANDA side D is #878's, from the OANDA M5 file.
- HistData is bid, OANDA mid: the entry prices differ by about half a spread; the move and the stop distance are not affected by a constant offset. Costs are the frozen model at every minute.
- Month t is on calendar-month sums of net R (frozen monthT): a measure of each row's noise, not a test. No Holm, no placebo: nothing here is judged as an edge.
- Entry at 00:53 / 00:54 is shown only to see whether the effect sits on the fix minute itself; no minute is an option.
- Plain reading, after the gate: on HistData 00:53 +0.096R, 00:54 +0.100R, 00:55 +0.127R, 00:56 +0.044R, 00:57 +0.022R, 00:58 +0.007R, 01:00 +0.030R.
- On the shared 2018-26 window the minutes before the fix keep more of the 00:55 figure than #908 showed on 2016-26 (HistData 00:54 keeps about four fifths, OANDA about three quarters, against about half on #908's longer window); after the fix both feeds drop at once. The reading condition is about 00:55 against every other row and 00:56 against 00:55 only.
- Per-day net R correlates at 0.99 or more between the two feeds at every minute, so the minute profile is not a print of one feed. Whether it is the fix flow itself is not something a feed comparison can show; it only rules out an OANDA-only artefact.
- OANDA on the same window: 00:53 +0.100R, 00:54 +0.111R, 00:55 +0.143R, 00:56 +0.051R, 00:57 +0.030R, 00:58 +0.019R, 01:00 +0.031R (#908 over 2016-01-01 to 2026-11-11: 00:55 +0.148R, 00:56 +0.048R).
