# US indices: the share of the day's range New York made, followed for 2-5 days. Result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: following a New York-made day did not beat the same side on NAS100 (5 days OOS excess -0.010R, month t -0.36, n 698) or SPX500.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A replication of the near miss of
`gold-ny-range-share` (gold OOS excess +0.138R, t +2.63, flat in sample) with the same rule on two markets it was not found on.
Paper research only: nothing live changed, nothing of `ict/` touched, no proposal written.

## Rule (as pre-registered, identical to the gold study's T1 / T3)

- OANDA mid NAS100 and SPX500 H1 via the candle proxy, 2 Jan 2006 to 30 Oct 2026 (124,672 and 124,687 candles); UTC days,
  weekend candles to Monday; a day needs 18 H1 candles.
- NY share = 1 - (00-13 UTC range) / (00-21 UTC range). Median over eligible days: NAS100 0.511, SPX500 0.464 (gold 0.275):
  on the indices New York makes about half of the day's range on an ordinary day.
- Signal: NY share >= 0.60 → follow New York's move. Entry at the next day's first H1 open, stop 2 x ATR(14) of the daily
  candles, out at the close of the last day of the hold or the stop.
- Costs: NAS100 1.5 points, SPX500 0.5 points a round trip (`api/_ictlab.js` COST for NQ / ES on these CFDs); no financing
  charged (none measured here for index CFDs; buys are flattered by that).
- Excess = net R minus the mean net R of the every-day trade of the same side in the same calendar year; t on calendar-month
  sums; Holm over the three out-of-sample p. In sample 2007-16, out of sample 2017-26.

## Tests (R of the 2 x ATR stop)

| Test | Window | n | Gross R | Net R | Excess R | Month t (excess) |
|---|---|---|---|---|---|---|
| T1 NAS100 follow NY, 5 days | IS | 863 | -0.017 | -0.037 | -0.016 | -0.66 |
| T1 NAS100 follow NY, 5 days | OOS | 698 | -0.010 | -0.015 | -0.010 | -0.36 |
| T2 NAS100 follow NY, 2 days | IS | 863 | +0.003 | -0.016 | +0.002 | +0.10 |
| T2 NAS100 follow NY, 2 days | OOS | 699 | -0.010 | -0.015 | -0.012 | -0.71 |
| T3 SPX500 follow NY, 5 days | IS | 575 | -0.045 | -0.058 | -0.044 | -1.53 |
| T3 SPX500 follow NY, 5 days | OOS | 611 | -0.012 | -0.018 | -0.008 | -0.27 |

| Test | OOS net month t | Holm p | 2x costs (excess / net) | Placebo beaten | Control beaten | Failed checks |
|---|---|---|---|---|---|---|
| T1 | -0.56 | 1.000 | -0.010 / -0.020 | 12 of 40 | 30 of 40 | monthT, netT, isSign, costs2x, placebo, control |
| T2 | -0.95 | 1.000 | -0.012 / -0.021 | 9 of 40 | 30 of 40 | monthT, netT, costs2x, placebo, control |
| T3 | -0.57 | 1.000 | -0.008 / -0.024 | 16 of 40 | 23 of 40 | monthT, netT, isSign, costs2x, placebo, control |

Out-of-sample halves, T1: 2017-21 excess +0.012R (n 344, t +0.32), 2022-26 -0.031R (n 354, t -0.84). T3: -0.027R (n 256,
t -0.57), +0.005R (n 355, t +0.13).
Baseline every-day trade out of sample, NAS100 5 days: long +0.094R net (t +2.99), short -0.115R (t -3.64); the excess
measure takes this drift out.
Placebo = the real signal days with seeded random sides (median t T1 +0.23); control = per year as many random days on their
own rule side (median t T1 -0.93).

## Reading

On both US indices the rule is flat: every excess is within 0.05R of zero, no month t reaches 2 in either window, and the
out-of-sample t sits inside the placebo spread (beaten by 9-16 of 40). Following a New York-made index day for 2 or 5 days
does no better than taking the same side on any day of that year. So the gold near miss does not generalise to the markets
where New York hours matter most; the "New York made the day" effect is not a general market property, and gold's 2017-26
figure stays what its own study called it, a one-decade result. Nothing here is a council rule.

## Files

`run.mjs` (fetch / count / full), `result.json`, `tests/index-ny-range-share.test.mjs`. Candles kept out of git and deleted.
To repeat: `node --use-env-proxy research/edge/index-ny-range-share/run.mjs fetch <dir>`, then `… full <dir>`.
