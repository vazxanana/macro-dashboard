# Gold session drift: result

**Verdict: FAIL, 0 of 3 tests pass.** No session of gold's day is a trade after costs on this test: the session short
(London afternoon + New York) loses in both windows, and the two trend-filtered sessions make a little on 2020 → now and lose
on 2008-19. Nothing live changed; no proposal.

This is a new stand-alone intraday rule, **not a gate, exit, entry or size of the gold book** (item 44 respected: nothing
here reads or changes the book's trades). Paper research only. Pre-registration: `PREREGISTRATION.md`, committed and pushed
before any trade was computed.

## Results (net of $0.30 a round trip, R of the stop distance; t on calendar-month sums)

| Test | Window | n | Net R a trade | Gross R a trade | Total net R | t | One-sided p |
|---|---|---|---|---|---|---|---|
| T1 Session short 13:00 → 21:00 UTC | 2020 → 11 Nov 2026 | 1,718 | −0.0032 | +0.0071 | −5.43 | −0.27 | 0.61 |
| | 2008-19 | 3,022 | −0.0149 | +0.0034 | −44.97 | −1.47 | 0.93 |
| T2 Session long 23:00 → 07:00 UTC, close > 50-day average | 2020 → 11 Nov 2026 | 1,063 | +0.0229 | +0.0396 | +24.34 | 1.37 | 0.088 |
| | 2008-19 | 1,614 | −0.0212 | +0.0102 | −34.29 | −1.68 | 0.95 |
| T3 Session short 13:00 → 21:00 UTC, close < 50-day average | 2020 → 11 Nov 2026 | 683 | +0.0158 | +0.0266 | +10.81 | 0.96 | 0.17 |
| | 2008-19 | 1,441 | −0.0027 | +0.0161 | −3.92 | −0.19 | 0.57 |
| *R0 reference, not a test: session long every day (the seasonality H5 window)* | 2020 → 11 Nov 2026 | 1,769 | +0.0172 | +0.0343 | +30.36 | 1.43 | 0.078 |
| | 2008-19 | 3,094 | −0.0054 | +0.0263 | −16.76 | −0.57 | 0.72 |

The pass bar per test (all four needed):

| Test | 2020 → now net > 0 | t ≥ 2 | 2008-19 same sign | Holm (3 tests) | Above placebo p95 | Pass |
|---|---|---|---|---|---|---|
| T1 | no | no | no | no | yes | **no** |
| T2 | yes | no | no | no | no | **no** |
| T3 | yes | no | no | no | yes | **no** |

### Placebo (40 seeds: same days, same side, a random other start hour, same stop rule and cost; 2020 → now)

| Test | Test net R a trade | Placebo median | Placebo 95th pct | Placebo max | Seeds beaten |
|---|---|---|---|---|---|
| T1 | −0.0032 | −0.0235 | −0.0059 | +0.0093 | 39 of 40 |
| T2 | +0.0229 | +0.0115 | +0.0428 | +0.0540 | 28 of 40 |
| T3 | +0.0158 | −0.0205 | +0.0103 | +0.0157 | 40 of 40 |

Read: the shorts look better than a short at a random hour only because a random short window often crosses the Asian hours
or the reopen, where gold rose; that is the same Asian drift again, and it is too small to pay for itself. The trend-on long
is no better than a long at any other hour on the same days (gold rose on those days at most hours).

## What it says

- **Gross, the split the literature describes is visible and tiny.** 2020 → now, the Asian session long (R0) made +0.034R a
  trade gross and the London-afternoon + New York short only +0.007R (gold did not fall in those hours, it rose less).
  $0.30 is about 0.02-0.03R of these stops: it takes most of the long's edge and all of the short's.
- **It does not hold across eras.** Every stream that is positive in 2020 → now is negative in 2008-19 after costs, and the
  trend-on long's 2020 → now gain comes from 2023-26 (2023 +5.6R, 2024 +4.8R, 2025 +10.9R, 2026 +9.3R against 2022 −8.0R):
  the gold bull market, not the clock.
- **Stops rarely matter**: 1.5 × the 20-day median range of the window stopped 3-6 % of trades; the result is the window's
  drift.

## How it differs from the seasonality study

`research/edge/seasonality` (0 of 10) tested gold's Asia session as H5 (long 18:00 New York → 08:00 London; in UTC 23:00 →
08:00 in winter, 22:00 → 07:00 in summer) and the PM fix as H4 (short 15:00 → 15:30 London), in % of price with no stop.
- **The plain session long here (23:00 → 07:00 UTC) is the same window as H5 and was dropped from the tests before
  pre-registering**; it is shown only as the R0 reference line (and agrees with H5: positive gross, near zero net, no
  significance).
- New here: the session **short** 13:00 → 21:00 UTC (eight hours of London afternoon + New York, not H4's 30-minute fix), a
  **50-day trend filter** on both sessions, a **stop on every trade** (results in R), t on **calendar-month sums**, Holm, and a
  **random-start-hour placebo**.

## Details

- **Data**: OANDA mid H1 XAU_USD through the site proxy, 125,658 candles, 20 Mar 2006 → 11 Nov 2026 21:00 UTC (the cache of
  the gold playbook studies, kept outside git). "Now" is the data's end, 11 Nov 2026.
- **Days**: D = the UTC date of the exit, Monday-Friday, not 25 Dec / 1 Jan, all eight H1 candles of the window on file
  (5,193 complete 13:00 sessions, 5,314 complete 23:00 sessions over the whole file; the first 20 of each only seed the stop).
- **Trend filter**: daily close = the 20:00 UTC candle's close (ends 21:00 UTC); 50-day mean of those closes; the filter reads
  the latest one that ended at or before the entry (no look-ahead, tested).
- **Costs**: $0.30 a round trip. **Financing: 0 nights** for both sessions by `council/fills.mjs` `nights` (rollover counted
  at 22:00 UTC; 23:00 → 07:00 and 13:00 → 21:00 cross none), checked in `result.json` `financing` and the test. Placebo longs
  that cross 22:00 UTC are charged at `FIN.xau.long`. At double costs every 2008-19 figure is more negative
  (`result.json` `avgX2`).
- Per-year totals: `result.json` `tests.<id>.years`.

To repeat: `node --use-env-proxy research/edge/gold-session-drift/run.mjs fetch <dir>`, then
`node research/edge/gold-session-drift/run.mjs full <dir>`. Tests: `tests/gold-session-drift.test.mjs`.
