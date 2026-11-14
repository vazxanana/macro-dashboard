# Gotobi feed check: the frozen T2 fade on HistData USD/JPY M1 against OANDA, same days

**Verdict: FEED-ROBUST.** On HistData USD/JPY (bid, M1 aggregated to M5) the frozen T2 makes +0.127R a trade net over 2018-01-01 to 2026-10-29 (n 623, month t +2.34), and per-trade net R correlates 1.00 with OANDA on the 617 common days. The rule is the gotobi study's T2, frozen byte for byte (frozen.mjs); only the candle loader is new (HistData labels to UTC with council/histdata.mjs). Pre-registered in PREREGISTRATION.md (first commit of the branch). Paper research only; nothing live changed.

## Results

| Feed | Window | n | Net R a trade | Gross R | Cost R | Total net R | Month t | Months | Win % | Stopped % | Median stop (pips) | Net R at 2 x cost | Month t at 2 x cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **HistData M1 (bid)** | 2018-01-01 to 2026-10-29 | 623 | +0.127 | +0.243 | 0.117 | +78.8 | +2.34 | 106 | 50.1 | 27.5 | 19 | +0.010 | +0.18 |
| OANDA mid M5 | 2018-01-01 to 2026-10-29 | 625 | +0.143 | +0.260 | 0.117 | +89.5 | +2.66 | 106 | 51.2 | 26.6 | 18.9 | +0.027 | +0.49 |
| HistData, common days | same | 617 | +0.131 | +0.248 | 0.117 | +81.1 | +2.40 | 106 | 50.4 | 27.6 | 19 | +0.015 | +0.27 |
| OANDA, common days | same | 617 | +0.138 | +0.255 | 0.117 | +85.0 | +2.53 | 106 | 50.9 | 26.7 | 19 | +0.021 | +0.38 |

## The pre-registered conditions

| Condition | Value | Holds |
|---|---|---|
| H1: HistData net R a trade > 0 | +0.127 | yes |
| H1: HistData month t >= 2 | +2.34 | yes |
| H2: per-trade net R correlation with OANDA on common days >= 0.80 | 0.9966 (617 days) | yes |

## The two feeds, trade by trade (common days)

Common days: 617. Only on HistData: 6; only on OANDA: 8. Correlation of the window move in pips 0.9979; same sign of net R on 98.9 % of days; stopped on HistData only 5, on OANDA only 0.

HistData minus OANDA, in pips (0.01). HistData is bid and OANDA mid, so a small negative signed offset in prices is expected; it cancels in the move.

| Quantity | Median abs. difference | 95th pct abs. difference | Max abs. difference | Median signed difference |
|---|---|---|---|---|
| Entry price (00:55 UTC open) | 0.2 | 0.9 | 4.5 | -0.1 |
| Exit price (06:00 UTC open, or stop) | 0.25 | 0.94 | 38.05 | -0.2 |
| Move, exit − entry | 0.2 | 1.1 | 38.15 | -0.07 |
| Stop distance D | 0.23 | 1.22 | 10.65 | 0 |

## By year (net R total, gotobi trades)

| Feed | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|---|
| HistData | −8.7 (67) | +21.1 (71) | +13.7 (70) | +3.3 (70) | +28.6 (72) | −3.6 (72) | +15.1 (72) | +22.4 (71) | −13.0 (58) |
| OANDA | −2.8 (71) | +21.6 (70) | +14.2 (70) | +3.2 (71) | +29.3 (72) | −0.8 (71) | +15.4 (71) | +21.9 (70) | −12.4 (59) |

## Notes

- Data: HistData USD/JPY M1 (18 files in council-data research/candles/USDJPY, read with git show, bid prices) converted to UTC with council/histdata.mjs histStampUtc only (a repeated converted time dropped), aggregated to UTC M5 candles 00:00-06:55; first candle 2018-01-02 00:00, last 2026-10-30 06:55. OANDA mid M5 from the /md/bars proxy (fetch.mjs), first 2017-11-01 00:00, last 2026-11-12 06:55. Both are judged through 2026-10-29, the frozen rule's last whole day on the HistData file.
- Gotobi days in the window: 631. No trade on HistData: 1 without a 00:55 UTC candle, 2 without an exit candle, 5 without 15 of the 20 lookback days (2026-09-25, 2020-11-30, 2021-05-31, 2018-01-05, 2018-01-10, 2018-01-15, 2018-01-19, 2018-01-25; the lookback ones are the start of the file). On OANDA: 6 without a 00:55 candle (2018-12-25, 2019-12-25, 2020-12-25, 2023-12-25, 2024-12-25, 2025-12-25: Christmas Day, which the HistData files do carry), 0 without an exit, 0 without the lookback. The 2023 HistData hole (20 Feb to 30 Jul, too few bars for the clock audit's weekly reading) still holds the 00:55 and 06:00 UTC candles: both feeds trade the same 32 gotobi days in it.
- The largest exit difference, 38.05 pips on 2018-01-31: HistData exits by stop at 109.0745, OANDA by time at 108.694 (stop 109.0745 / 109.092). Exit differences over 5 pips are days stopped on one feed and not the other (5 stopped on HistData only, 0 on OANDA only); where both feeds stop, the two stops sit up to a few pips apart because D differs; the 95th percentile of the exit difference is 0.94 pip.
- In the clock audit (research/edge/histdata-clock) USD/JPY 2019 and 2023 are UNCERTIFIED (2019: the first bar after the US spring change; 2023: the file hole). They are kept, as pre-registered; the by-year table shows them.
- Costs are the frozen model on both feeds (0.3 pip spread, 0.5 pip slippage a side, USD 22.5 per million a side). HistData bid prices carry no spread of their own; the bid/mid offset cancels in the move.
- Month t is on calendar-month sums of net R (the frozen monthT). No placebo or Holm: one frozen rule on one more feed.
