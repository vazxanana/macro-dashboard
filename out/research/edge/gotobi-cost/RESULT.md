# Gotobi cost: what the fade after the 09:55 Tokyo fix costs, and where it breaks even

**Verdict: inconclusive on cost (cost accounting only, no rule tested).** The gotobi T2 fade breaks even at **3.73 pips** a round trip (spread + 2 x slippage, commission on top) on USD/JPY 2016-now and loses month t >= 2 above **1.95 pips**; the four crosses pooled 2010-now break even at **3.20** and lose t >= 2 above **1.81**. The study assumed 1.30. **Neither the spread nor the slippage at 00:55 and 06:00 UTC could be measured for any yen pair** (below); the only spreads found are a broker's published all-day averages, not measured here. On those: USD/JPY C2a keeps t >= 2 (+0.223R, t +4.13), C2b keeps t >= 2 (+0.162R, t +2.99); crosses pooled C2a keeps t >= 2 (+0.131R, t +3.64), C2b keeps t >= 2 (+0.079R, t +2.17). So the result survives the published averages only as far as they hold at those two minutes, which nobody has checked. Pre-registered in PREREGISTRATION.md (first commit of the branch); the rule is frozen.mjs, byte for byte. Paper research only; nothing live changed.

## What could be measured

- **Commission**: measured for the broker's forex symbols, assumed for yen pairs. council-data ctrader/symbols.json gives commissionRT 0.000045 (USD 22.5 per million a side, commissionType 1) on EUR/USD, GBP/USD, AUD/USD, USD/CAD and USD/CHF; no yen pair is on the demo account, so the same forex rate is assumed for them.
- **OANDA bid / ask history**: not reachable. api/bars.js asks OANDA for mid candles only (price "M") and the proxy serves nothing else; api/ was not changed. api/stream.js does carry live bid / ask, but today (14 Nov 2026) is a Saturday, markets shut, so no read at 00:55 or 06:00 UTC was possible.
- **Broker spread log**: no yen pair. ctrader/symbols.json has never held a yen pair (git log -S on council-data finds none). Context only: on 13 Nov 2026, itself a gotobi day (the 15th rolled back), the five USD majors were quoted at 0.0 to 0.1 pip at the reads of 00:31, 00:43, 00:56, 01:08 and 05:31-06:25 UTC (a raw-spread account; one day, majors, not yen).
- **Demo fills (slippage)**: no yen pair. no ctrader/mirror*.json holds a yen-pair copy, and none of today's files holds a forex major fill either (the earlier majors measure, median 0 pip from the council price, is in CLAUDE.md "Forex spreads", all hours, majors only).
- **Published spreads**: not measured here. the broker's own help centre lists average spreads of 0.08 (USD/JPY), 0.49 (GBP/JPY), 0.29 (AUD/JPY), 0.49 (CAD/JPY), 1.39 (CHF/JPY) pips, undated and over the whole day; a broker comparison site gives 0.8 for CHF/JPY. Figures from a web search on 14 Nov 2026 (pages not opened). Asian-morning and pre-London spreads on the crosses may differ from an all-day average.

## Gate: the frozen rule at the original cost

| Stream | n | Net R a trade | Month t | Expected (RESULT.md of the PR) |
|---|---|---|---|---|
| USD/JPY 2016-now | 771 | +0.1481 | +2.74 | n 771, +0.148, t 2.74 (#878) |
| Crosses pooled 2010-now | 4784 | +0.0993 | +2.75 | n 4784, +0.099, t 2.75 (#889) |
| USD/JPY 2016-now at 2 x the original cost | | +0.0355 | +0.65 | +0.035, t 0.65 (#878) |
| Crosses pooled at 2 x the original cost | | +0.0053 | +0.15 | +0.005, t 0.15 (#889) |

## Break-even

x = spread + 2 x slippage, pips a round trip; the commission (USD 22.5 per million a side) comes on top. "All-in" adds the commission at the stream's median entry price.

| Stream | n | Gross R a trade | Median stop (pips) | Commission (pips, median price) | x at net 0 | all-in | x at month t = 2 | all-in | t falls with x |
|---|---|---|---|---|---|---|---|---|---|
| **USD/JPY 2016-now** | 771 | +0.261 | 19.5 | 0.51 | 3.73 | 4.24 | 1.95 | 2.46 | yes |
| **Crosses pooled 2010-now** | 4784 | +0.193 | 21.8 | 0.48 | 3.20 | 3.68 | 1.81 | 2.29 | yes |
| USD/JPY 2010-15 | 425 | +0.243 | 17.5 | 0.42 | 3.31 | 3.72 | 1.67 | 2.09 | yes |
| GBP/JPY 2010-now | 1196 | +0.217 | 27.5 | 0.69 | 4.67 | 5.35 | 2.39 | 3.08 | yes |
| AUD/JPY 2010-now | 1196 | +0.105 | 24.1 | 0.39 | 1.97 | 2.36 | 0.50 | 0.89 | yes |
| CAD/JPY 2010-now | 1196 | +0.203 | 17 | 0.40 | 2.66 | 3.06 | 1.47 | 1.87 | yes |
| CHF/JPY 2010-now | 1196 | +0.247 | 19.3 | 0.52 | 3.77 | 4.28 | 2.30 | 2.81 | yes |

## At each candidate cost

| Candidate | Source | Measured at 00:55 / 06:00 UTC? | USD/JPY 2016-now: x | net R | month t | Crosses pooled: net R | month t |
|---|---|---|---|---|---|---|---|
| C1 Original assumption: 0.3 spread + 2 x 0.5 slippage | gotobi study assumption (PR #878): 0.3 pip spread + 0.5 pip slippage a side | no | 1.30 | +0.148 | +2.74 | +0.099 | +2.75 |
| C2a Published average spread, no slippage | Fusion Markets help centre average spreads (undated, all-day averages, account type not stated); web search 14 Nov 2026, page not opened | no | 0.08 | +0.223 | +4.13 | +0.131 | +3.64 |
| C2b Published average spread + 2 x 0.5 slippage | Fusion Markets help centre average spreads (undated, all-day averages, account type not stated); web search 14 Nov 2026, page not opened | no | 1.08 | +0.162 | +2.99 | +0.079 | +2.17 |
| C4 twice the original cost (in R) | #878 / #889 | no | 2 x 1.30 + 2 x commission | +0.035 | +0.65 | +0.005 | +0.15 |

Published spreads used for C2 (pips): USD/JPY 0.08, GBP/JPY 0.49, AUD/JPY 0.29, CAD/JPY 0.49, CHF/JPY 1.39. In the pooled stream each cross takes its own figure.

### Each cross

| Cross | n | x at net 0 | x at t = 2 | C1 net R / t | C2a net R / t | C2b net R / t |
|---|---|---|---|---|---|---|
| GBP/JPY (published 0.49) | 1196 | 4.67 | 2.39 | +0.136 / +2.97 | +0.168 / +3.70 | +0.128 / +2.80 |
| AUD/JPY (published 0.29) | 1196 | 1.97 | 0.50 | +0.030 / +0.91 | +0.075 / +2.29 | +0.030 / +0.92 |
| CAD/JPY (published 0.49) | 1196 | 2.66 | 1.47 | +0.090 / +2.28 | +0.144 / +3.66 | +0.077 / +1.96 |
| CHF/JPY (published 1.39) | 1196 | 3.77 | 2.30 | +0.142 / +3.39 | +0.137 / +3.27 | +0.079 / +1.87 |

C3, CHF/JPY at the other published 0.8 pip spread (BrokerChooser, Fusion Markets Zero account CHF/JPY spread; web search 14 Nov 2026, page not opened): x 0.8: +0.171R, t +4.10; x 1.8: +0.113R, t +2.69.

## The grid

| x (pips) | 0 | 0.5 | 1 | 1.3 | 2 | 2.6 | 3 | 4 |
|---|---|---|---|---|---|---|---|---|
| USD/JPY 2016-now net R | +0.227 | +0.197 | +0.166 | +0.148 | +0.105 | +0.069 | +0.044 | −0.016 |
| USD/JPY 2016-now month t | +4.22 | +3.65 | +3.08 | +2.74 | +1.94 | +1.26 | +0.81 | −0.30 |
| Crosses pooled net R | +0.167 | +0.141 | +0.115 | +0.099 | +0.063 | +0.032 | +0.011 | −0.042 |
| Crosses pooled month t | +4.67 | +3.93 | +3.19 | +2.75 | +1.73 | +0.86 | +0.29 | −1.13 |

## Notes

- Costs never change a trade's path in the frozen rule (the stop and the exit are price-based), so every figure here is the same set of trades re-costed; n does not move with x.
- The gross edge is +0.261R a trade on USD/JPY 2016-now with a median stop of 19.5 pips, so each pip a round trip costs about 0.051R at the median (the mean of 1 / D is what counts: shorter stops pay more in R).
- The commission alone is about 0.51 pips a round trip on USD/JPY at the median price of 113.759 (and 0.48 on the crosses pooled), which is why the x at net 0 is below the gross-edge-in-pips.
- How to measure the missing figure: read bid / ask of USD/JPY and the four crosses at 00:55 and 06:00 UTC on real gotobi mornings (the price stream already carries both sides; a demo account with the yen pairs would add the broker's own quote and fills). Not done here; it needs weekdays and a writer that does not exist yet.
- This study tests nothing: the gotobi verdict (PASS, T2) and the replication (REPLICATES) stand as written; this only says how much cost room they have.
