# Asia range sweep, then a 5-minute QM back inside: result

**INCONCLUSIVE** (23 Nov 2026): the pre-registered primary has 27 out-of-sample trades, under the 30 its verdict needs. Read as
it stands it is also nowhere near the bar: −0.007R a trade after costs out of sample (month t −0.03), and −0.103R on the
2010-2019 replication. Not an edge; nothing live changed.

One run of `run.mjs` (the code below, unchanged after the result) on the overnight toolkit's OANDA mid M5 cache, gold and
EUR/USD, 4 Jan 2010 to 20 Nov 2026 (the last candle day on file). Costs: gold $0.30, EUR/USD 0.00006 a round trip. Holes: at most 1.2 % of weekdays a window
had no usable Asia range (well under the 10 % limit), so the INCONCLUSIVE comes from the trade count alone.

| Test | Window | Trades | Won | R a trade after costs | Month t | At 2x costs | Before costs |
|---|---|---|---|---|---|---|---|
| P: both markets (primary) | 2010-2019 | 99 | 39 % | −0.103 | −0.92 | −0.183 | −0.024 |
| | 2020-2023 (in sample) | 41 | 49 % | +0.195 | 1.00 | +0.127 | +0.262 |
| | 2024-26 (out of sample) | 27 | 41 % | −0.007 | −0.03 | −0.058 | +0.044 |
| S1: gold | 2024-26 | 14 | 43 % | +0.038 | 0.10 | −0.008 | +0.084 |
| S2: EUR/USD | 2024-26 | 13 | 38 % | −0.056 | −0.14 | −0.112 | +0.001 |
| S3: with the daily bias | 2024-26 | 17 | 35 % | −0.024 | −0.07 | −0.075 | +0.026 |

Holm-adjusted p of all four tests: 1.00. No test passes the bar: beyond "in-sample mean above zero", only gold alone (S1) has an out-of-sample mean above zero (+0.038R on 14 trades, t 0.10).

What else the run shows (reported, not judged):
- **The rule almost never fires**: 167 trades in 17 years on two markets (about one a month a market). Most days have no fresh
  sweep followed by a QM back inside the same window, and a target under 1R or a cancellation removes more.
- **By window**: London 163 trades, −0.003R a trade; New York morning 4 trades (it trades only when London gave none).
- **By side**: buys +0.152R (n 77), sells −0.157R (n 90): gold's and the euro's drift over these years, not the setup.
- **Exits**: 67 targets, 93 stops, 7 at the 16:00 time exit. Worst drawdown of the whole pool −23.5R.
- **By year** (pool, after costs): wins and losses alternate with no trend (2022 +5.2R on 5 trades, 2017 −6.4R on 13).
- **Month-block bootstrap** of the out-of-sample mean monthly R: 5 % −0.33, median 0.00, 95 % +0.33 (P below 0 = 0.50).

What it does NOT show: that sweeps of the Asia range are useless when read by eye, or with another reversal confirmation, other
hours or another target (none of that was tested, and none may be tried on these years after this result); anything about
markets other than gold and EUR/USD; anything at the broker's own prices (OANDA mid candles, fixed costs). The in-sample
2020-2023 figure (+0.195R, t 1.00, n 41) is the only positive window and is noise at that size.

Files: `PREREGISTRATION.md` (committed first), `run.mjs`, `result.json` (every figure, per market, year, window, side),
`trades.json` (every trade). Test: `tests/session-sweep.test.mjs`.

## Audit correction (23 Nov 2026)
An independent read-only audit of `run.mjs` against `PREREGISTRATION.md` and the toolkit. No number of `result.json` changed and
`run.mjs` was not changed; two sentences of this file were wrong and are corrected above: the last candle day is 20 Nov 2026
(this file said 22 Nov), and S1 also has a positive out-of-sample mean (this file said no test passed any line but the
in-sample mean).
Checked and found sound: the Asia range, windows and fresh checks use only candles before the decision; the QM detector's
swings are used only after their confirming candle and the entry is the open of the candle after the QM closes; the stop is
on the losing side of every trade, stop-first in one candle, gaps exit at the open, the round-trip cost is taken off every
trade (and twice at 2x); the daily bias reads the last 17:00 New York day closed at 00:00 of the day; Holm runs over the four
pre-registered tests and no other variant is reported as a result; the figures above equal `result.json`.
One reading is sensitive and is said here, not changed: the run starts each setup's cancellation check at its own sweep, so
21 of the 167 trades (3 out of sample) were taken on days when the other side of the range (the target) had already been
traded through earlier that day. Read strictly ("swept first" / "target reached before the QM" from 00:00), those 21 drop:
the out-of-sample count falls to 24 (still under 30) and the verdict stays INCONCLUSIVE. Three days with no 16:00 candle on
file left a trade unscored ("sim open"); they do not move the count past 30.
