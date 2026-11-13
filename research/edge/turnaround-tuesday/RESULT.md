# Result: "Turnaround Tuesday" on US indices, out of sample (13 Nov 2026)

**Verdict: PASS** on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed), by **one cell of
four, narrowly**: Nasdaq 100 after a Monday down more than 1 % (R2). On 2016 to now, buying NAS100 at the New York close of
such a Monday and selling at Tuesday's close made +0.098R a trade after costs and financing, t 2.33 (n 81), Holm p 0.0392 over
the four cells (bar 0.05); 2008-15 the same sign (+0.103R, t 2.12, n 70); its Tuesdays rose +0.739 % against +0.144 % on all
Tuesdays (Welch t 2.59); it beat random down-more-than-1 % days in 40 of 40 placebo seeds. **The base rule (any down Monday)
fails on both markets**, and the S&P 500 variant fails too (t 1.10). This is a paper-shadow candidate, not a proven edge: one
cell of four, a Holm p just under the bar, n 81, and the same day's calendar studies (turn-of-month, overnight drift,
pre-holiday) were not corrected for together with it.

| 2016 - Nov 2026, net of costs and financing | n | net R a trade | t | gross R | t gross | net % a trade | won | stopped | Holm p |
|---|---|---|---|---|---|---|---|---|---|
| S&P 500 (SPX500), R1 any down Monday | 237 | +0.013 | 0.54 | +0.036 | 1.50 | +0.151 | 50.63 % | 8 | 0.3272 |
| S&P 500 (SPX500), R2 Monday down more than 1 % | 51 | +0.069 | 1.10 | +0.086 | 1.36 | +0.496 | 50.98 % | 3 | 0.3272 |
| Nasdaq 100 (NAS100), R1 any down Monday | 224 | +0.030 | 1.23 | +0.049 | 2.04 | +0.210 | 55.36 % | 5 | 0.3272 |
| Nasdaq 100 (NAS100), R2 Monday down more than 1 % | 81 | +0.098 | 2.33 | +0.114 | 2.72 | +0.599 | 58.02 % | 2 | 0.0392 |

| 2008 - 2015 (replication, judged on sign) | n | net R a trade | t | gross R | t gross | net % a trade |
|---|---|---|---|---|---|---|
| S&P 500 (SPX500), R1 any down Monday | 195 | +0.011 | 0.41 | +0.029 | 1.04 | +0.240 |
| S&P 500 (SPX500), R2 Monday down more than 1 % | 63 | +0.116 | 2.52 | +0.129 | 2.79 | +0.746 |
| Nasdaq 100 (NAS100), R1 any down Monday | 185 | -0.007 | -0.24 | +0.011 | 0.40 | +0.149 |
| Nasdaq 100 (NAS100), R2 Monday down more than 1 % | 70 | +0.103 | 2.12 | +0.117 | 2.42 | +0.703 |

## Checks per cell (C1 net R t >= 2 and Holm p < 0.05; C2 n; C3 2008-15 positive; C4 against all Tuesdays; C5 placebo)
- **S&P 500, R1**: C1 not met (t 0.54); C2 met; C3 met; C4 not met (+0.242 % against +0.104 %, Welch t 1.43); C5 not met
  (33 of 40). FAIL.
- **S&P 500, R2**: C1 not met (t 1.10); C2 met (51 >= 30); C3 met; C4 not met (+0.684 % against +0.104 %, Welch t 1.85); C5 not
  met (37 of 40). FAIL.
- **Nasdaq 100, R1**: C1 not met (t 1.23); C2 met; C3 not met (-0.007R); C4 not met (+0.305 % against +0.144 %, Welch t 1.36);
  C5 not met (33 of 40). FAIL.
- **Nasdaq 100, R2**: C1 met (t 2.33, Holm p 0.0392); C2 met (81 >= 30); C3 met (+0.103R);
  C4 met (+0.739 % against +0.144 %, Welch t 2.59); C5 met (40 of 40, placebo median 0.000R). PASS.

## How to read it
- The plain "down Monday, up Tuesday" pattern is not there after costs: on any down Monday the next session made +0.013R
  (S&P 500) and +0.030R (Nasdaq 100) a trade net, inside noise in both windows. Tuesdays in general rose more than zero
  (all weeks, M to T before costs: S&P 500 +0.104 %, t 2.33; Nasdaq 100 +0.144 %, t 2.62 on 567 weeks), so a down Monday adds
  little that the ordinary Tuesday does not.
- What holds is the deeper drop on the Nasdaq 100: a Monday down more than 1 % was followed by a Tuesday that rose more than
  an ordinary Tuesday and more than the session after an ordinary 1 %-down day (the placebo: every seed's mean was at or near
  0R). The S&P 500 variant points the same way (+0.069R, +0.116R in 2008-15) but does not reach the bar.
- Fragility, reported, not judged: without 2020 the cell is +0.086R, t 2.02 (n 70); without 2022 +0.134R, t 2.68 (n 65);
  2022 (16 trades, -0.046R) is its only losing year since 2016. The best six trades carry 4.58R of the 7.95R total (largest
  +0.948R, 24 Dec 2018). One session held: 2 of 81 were stopped. Costs and a night of financing take about 0.016R a
  trade here (gross +0.114R).
- Holiday weeks: M is the first trading day of the week (the Tuesday after a Monday holiday) and T the next one; a Monday on a
  Christmas Eve half day exits at the 26 December close (two nights of financing).

## Data and method
OANDA mid H1 SPX500 and NAS100, 30 Sep 2007 to 12 Nov 2026 (`fetch.mjs`, the pre-holiday study's files, kept out of git); a
day's close = the H1 candle ending 16:00 New York (13:00 on a half day), daylight saving read in New York; NYSE calendar from
`ict/calendar.mjs` (read only) with the unscheduled closures; stop 2 x ATR(20) on New York days, checked on every H1 candle
(gaps fill at the open); costs 0.04 % (SPX500) and 0.05 % (NAS100) a round trip; financing (2-year yield + 2.5 %) / 365 a
calendar night. Trades skipped for a missing close: 11, 3, 9, 4 (cells in table order). Calendar, close, ATR, stop and cost
code copied from the pre-holiday study (not on main). To repeat: `node --use-env-proxy research/edge/turnaround-tuesday/fetch.mjs
<dir>`, then `node research/edge/turnaround-tuesday/run.mjs <dir>`.

Research only: nothing live changed. The paper-shadow proposal is `research/proposals/2026-11-13-turnaround-tuesday.md`.
