# Result: the turn of the month in Bitcoin (and Ether) (14 Nov 2026)

**Verdict: FAIL, the BTC turn-of-the-month long made +0.23R an event in sample (t 2.07) but -0.03R out of sample (n 55, t -0.42), lost at 2x costs and beat 6 of 40 placebo windows.**
Rule, stop, costs, windows and pass bar: `PREREGISTRATION.md` (committed before this run). Nothing live changed.

Rule: buy BTC at the close of the 3rd-to-last calendar day of the month, sell at the close of the 2nd day of the next (four
daily returns), stop 2 x ATR(20) daily, `CFD_CRYPTO` round trip (0.04 %) and the demo broker's crypto swap (15 % a year long,
17:00 New York rollovers, Friday x3: 5.0 nights a hold on average). Binance spot UTC days 2017-08-17 to 2026-10-31.
**n is small: one event a month, 109 events in all.** With one event a month the calendar-month-sum t equals the event t.

## BTC (primary, judged)

| Window | Events | Net R / event | t | Gross R | Cost R | Financing R | 2x cost R | Stops | Win % | Window % (no stop) |
|---|---|---|---|---|---|---|---|---|---|---|
| In sample 2017-09-28 to 2022-03-02 | 54 | +0.2348 | 2.07 | +0.2584 | 0.0039 | 0.0197 | +0.2112 | 3 | 63 | +2.92 |
| Out of sample 2022-03-29 to 2026-10-02 | 55 | -0.0348 | -0.42 | +0.0008 | 0.0058 | 0.0298 | -0.0704 | 5 | 42 | -0.29 |

Checks: OOS t >= 2 **no** (-0.42); IS net > 0 yes (+0.23R); OOS net at 2x costs > 0 **no** (-0.07R); beats >= 38 of 40
placebo seeds **no** (6 of 40; the seeds' median +0.040R an event, random four-day windows inside the same months, away from the
turn, same stop, costs and financing).

Before any cost the out-of-sample window made +0.001R an event: the 2017-21 pattern did not repeat, it was not eaten by costs.

By year (net R an event, n 12 unless shown): 2017 +0.11 (n 4), 2018 +0.01, 2019 +0.39, 2020 +0.38 (t 1.82), 2021 +0.18,
2022 -0.08, 2023 -0.00, 2024 -0.18, 2025 +0.26, 2026 -0.12 (n 9). The in-sample strength sits in 2019-21, the bull years.

## Reported only

| Stream | In sample | Out of sample |
|---|---|---|
| ETH turn of the month | +0.2658R, t 2.98 (n 54) | -0.0867R, t -1.23 (n 55); 2x cost -0.11R; beats 4 of 40 seeds |
| BTC mirror, mid-month (close of the 13th to close of the 17th) | +0.024R, t 0.23 (n 55) | +0.023R, t 0.24 (n 55) |
| ETH mirror, mid-month | +0.023R, t 0.23 (n 55) | -0.026R, t -0.27 (n 55) |

ETH tells the same story more strongly: in sample t 2.98, carried by 2020-21 (+0.55R and +0.62R an event), then negative out
of sample. Two events were not taken: the first month (no 21 days of history) and October 2026 (exit candle not on file yet).

## Reading

The published turn-of-the-month pattern shows up in Bitcoin and Ether in 2017-21 and is gone from March 2022 on, on both
coins, before costs. One test, judged once, failed: not an edge, not a filter, not a paper shadow. A further look would need
its own pre-registration on data after this file (the in-sample years cannot be used again).

Files: `run.mjs` (reads council-data with `git show`, no network), `result.json` (every event with its levels and stop).
