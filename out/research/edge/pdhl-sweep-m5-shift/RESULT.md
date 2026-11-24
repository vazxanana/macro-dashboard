# Previous-day sweep, then an M5 structure-shift break back: five markets (result)

**Verdict: FAIL. 0 of 6 cells pass; the best cell, 2R all, made −0.017R a trade after costs in 2015-26 (n 3,298, month t −0.70; +0.036R before costs; 2005-14 −0.060R after costs, n 2,660, month t −2.29).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed, no rule is
proposed. OANDA mid 5-minute candles, xau, eurusd, gbpusd, usdjpy, audusd; R after the demo round-trip cost (`edgekit` `COSTS`); t on calendar-month
sums (120 and 142 months, empty months as 0), pooled over the markets.

## The rule in one paragraph

An M15 candle trades beyond the previous trading day's high (low) and, within an hour, an M15 candle closes back inside the
previous day's range. Then a 5-minute candle closes beyond the last 5-minute swing (3 candles a side) made before the sweep's
extreme, within two hours and before the extreme is taken out. Sell (buy) at the next 5-minute open, stop 0.1 x ATR(14) of M15
past the extreme, target the day's opening price (when 1R or more away) or 2R, out after 24 hours.

## The six cells (the bar is judged after costs)

| cell | 2005-14 n | before | after | month t (after) | 2015-26 n | before | after | month t (after) | cost / risk | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|
| open all | 550 | −0.177R | −0.248R | −4.17 | 625 | −0.043R | −0.117R | −2.17 | 0.074R | 1.000 |
| open london | 156 | −0.118R | −0.188R | −1.90 | 171 | −0.116R | −0.187R | −1.91 | 0.071R | 1.000 |
| open ny | 139 | −0.301R | −0.356R | −3.26 | 200 | +0.015R | −0.036R | −0.34 | 0.051R | 1.000 |
| 2R all | 2,660 | −0.012R | −0.060R | −2.29 | 3,298 | +0.036R | −0.017R | −0.70 | 0.053R | 1.000 |
| 2R london | 665 | +0.103R | +0.058R | 1.04 | 732 | −0.009R | −0.057R | −1.15 | 0.047R | 1.000 |
| 2R ny | 585 | −0.016R | −0.053R | −0.93 | 748 | +0.010R | −0.027R | −0.58 | 0.037R | 1.000 |

Bar: n >= 300 in each window, R after costs > 0 with month t >= 2 in both windows, Holm p < 0.05 over the six confirmation tests.
**0 of 6 pass.**

## Control: the same sweeps entered at the M15 close back inside, no M5 confirmation

| cell | 2005-14 n | before | after | month t (after) | 2015-26 n | before | after | month t (after) | cost / risk | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|
| open all | 6,955 | +0.023R | −0.109R | −4.36 | 8,673 | +0.005R | −0.157R | −7.05 | 0.161R | 1.000 |
| open london | 1,841 | −0.024R | −0.148R | −3.09 | 2,171 | −0.027R | −0.172R | −3.63 | 0.145R | 1.000 |
| open ny | 1,687 | −0.070R | −0.169R | −3.83 | 2,119 | −0.036R | −0.147R | −3.46 | 0.110R | 1.000 |
| 2R all | 9,810 | +0.059R | −0.060R | −4.41 | 12,313 | +0.020R | −0.121R | −8.82 | 0.141R | 1.000 |
| 2R london | 2,344 | +0.018R | −0.093R | −3.35 | 2,791 | −0.018R | −0.148R | −5.10 | 0.130R | 1.000 |
| 2R ny | 2,197 | −0.003R | −0.092R | −2.86 | 2,817 | +0.011R | −0.086R | −3.15 | 0.096R | 1.000 |

## By market (all sessions)

| market | cell | 2005-14 n | before | after | 2015-26 n | before | after | month t (after) |
|---|---|---|---|---|---|---|---|---|
| xau | open all | 85 | −0.004R | −0.167R | 95 | −0.237R | −0.331R | −2.71 |
| xau | 2R all | 448 | +0.061R | −0.038R | 640 | +0.040R | −0.029R | −0.55 |
| eurusd | open all | 111 | −0.156R | −0.204R | 133 | +0.129R | +0.069R | 0.60 |
| eurusd | 2R all | 587 | +0.093R | +0.062R | 661 | +0.127R | +0.082R | 1.45 |
| gbpusd | open all | 118 | −0.302R | −0.352R | 136 | +0.023R | −0.044R | −0.41 |
| gbpusd | 2R all | 566 | −0.075R | −0.109R | 650 | +0.046R | −0.001R | −0.02 |
| usdjpy | open all | 116 | −0.238R | −0.311R | 100 | −0.149R | −0.226R | −1.47 |
| usdjpy | 2R all | 499 | −0.062R | −0.113R | 595 | +0.013R | −0.038R | −0.72 |
| audusd | open all | 120 | −0.136R | −0.183R | 161 | −0.061R | −0.139R | −1.13 |
| audusd | 2R all | 560 | −0.073R | −0.110R | 752 | −0.037R | −0.092R | −1.88 |

## Counts

Sweeps found 22,268; M5 break confirmed 5,963; cancelled (extreme taken out first) 11,721; no break in two hours
4,584; confirmed but no trade (risk under the cost, fill past the stop, still open at the end) 2; dropped for bad data 3.
Gold's candles start 2006-03-19. Cut test (EUR/USD, the confirmed signals known by a date computed on candles cut there equal the full
run's): 2008-06-11 same (205), 2016-09-21 same (676), 2025-05-07 same (1,163).

## What it means

Waiting for the 5-minute chart to turn after a failed break of the previous day's extreme does not make a rule that survives costs on these five markets in both decades. Not an edge; this combination is closed on these markets and years. One run, no variants.

## Limits

- OANDA mid candles; a constant round-trip cost for every year and hour (today's demo figures), no slippage.
- Trades overlap (at most two a market a day) and the "all" cell contains the two session cells, so the six tests are not independent.
- The "open" cells need the day's open 1R or more away, so they are a subset of the sweeps with a large reward to risk.
