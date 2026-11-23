# The Janda two-step barrier entry on 18 markets, 2020 to now — result

**Verdict: FAIL. T1 (every Janda trade, 18 markets, 2R) made −0.132R a trade after costs in 2024-26 (n 4725, month t −5.47) and −0.107R in 2020-23 (n 6400, month t −6.05); buys only and shallow turns only lose too.**

Pre-registered in PREREGISTRATION.md (committed before `run.mjs`), run once on 23 Nov 2026 (`run.mjs`, `result.json`). Windows:
discovery 2020-01-01 to 2023-12-31 (48 months), confirmation 2024-01-01 to 22 Nov 2026 (35 months). Two pairs per market,
H4 barrier → M15 confirmation and H1 barrier → M5, side by side. R a trade is after the round trip of
`combo-grid-2` `COSTS` over the opening risk; month t uses calendar-month sums by exit month, empty months as zero.

| Test (2R) | 2020-23 n / R a trade (month t) | 2024-26 n / R a trade (month t) | at 2x cost 2020-23 / 2024-26 | before costs 2020-23 / 2024-26 | 3R target 2020-23 / 2024-26 (month t) |
|---|---|---|---|---|---|
| T1 every trade | 6400 / −0.107 (t −6.05) | 4725 / −0.132 (t −5.47) | −0.209 / −0.235 | −0.005 / −0.029 | −0.109 / −0.143 (t −5.93) |
| T2 buys only | 3243 / −0.099 (t −3.70) | 2461 / −0.118 (t −3.81) | −0.205 / −0.219 | +0.006 / −0.017 | −0.127 / −0.145 (t −4.29) |
| T3 shallow only | 3911 / −0.097 (t −3.99) | 2917 / −0.165 (t −5.06) | −0.197 / −0.271 | +0.004 / −0.058 | −0.103 / −0.168 (t −4.87) |

No test meets a single line of the bar: every mean after costs is negative in both windows. The Holm-adjusted p values are tiny
(T1 and T3 under 0.0001, T2 0.0006) because the month t values are strongly NEGATIVE: the rule loses reliably, it does not win.

## In plain words
- **Before costs it is zero.** Over 11,125 trades T1 makes −0.005R (2020-23) and −0.029R (2024-26) a trade before costs; the
  cost (on average about 0.1R a trade: a Janda stop sits a short way past a lower-timeframe leg) is the whole loss.
- **Buys are not better in a way that matters.** Buys −0.118R against sells −0.147R a trade after costs in 2024-26 (sells
  n 2264, month t −4.13); before costs +0.006 / −0.017R for buys against −0.018 / −0.042R for sells. A small tilt, not a lead.
- **Shallow turns are not better.** T3 (the QM head no more than half way into the barrier zone) is the worst of the three in
  2024-26 (−0.165R a trade).
- **3R is no better than 2R** (T1 −0.143R a trade in 2024-26). At 2R, 31 % of trades reached the target, 66 % were stopped,
  3 % left at the time exit (all trades of the run).
- **By pair** (T1, after costs): H4 → M15 1441 / −0.042R (t −1.23) and 1121 / −0.061R (t −1.36); H1 → M5 4959 / −0.126R
  (t −5.78) and 3604 / −0.154R (t −6.40). The M5 version pays more cost on smaller stops.
- **Gold alone** (descriptive, T1): 355 / −0.055R (t −0.60) in 2020-23 and 257 / −0.204R (t −2.16) in 2024-26; gold buys
  193 / +0.026R then 133 / −0.200R; gold shallow 222 / −0.071R then 159 / −0.300R. Before costs gold made +0.059R a trade in
  2020-23 and −0.141R in 2024-26.
- **By market**: 3 of 18 markets are positive after costs in 2024-26 (usdcad, euraud, de40, each month t under 1) and none in
  2020-23. Every year 2020-2026 is negative.

## How the rule was read (only where the pre-registration left a choice)
- The engulf pair's zone is the wick-to-wick range of its two candles; the limit is its middle; the stop is the second leg's
  extreme plus 0.1 × ATR(14) of the confirmation timeframe. A risk under three round trips was skipped (2,166 orders of the two pairs on all markets).
- Orders and trades run one at a time per market, pair and target; a 3R order can therefore fill where its 2R twin was still
  busy (the 3R stream holds more trades).
- Data-quality exclusions dropped 14 filled trades at 2R; 4 positions still open at their market's last candle are not booked.

## No look-ahead
Cut test on gold (candles cut at 15 Apr 2024): the 20 (H4 → M15) and 81 (H1 → M5) orders placed before the cut are identical
with and without the later candles. `tests/mosha-janda-2020.test.mjs` repeats it on synthetic candles.

## What this does not say
It tests one written reading of the two-step entry, mechanically, on every zone the two zone rules give. It does not judge a
person choosing the barrier by eye, the M1 version (no one-minute candles in the cache), or a direction filter (the earlier
`barrier-qm-janda` study tested gold with the Daily side and failed). Nothing live changed.
