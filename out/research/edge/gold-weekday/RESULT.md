# Result: the day-of-the-week effect on spot gold (14 Nov 2026)

**Verdict: FAIL.** The pre-registered Monday short lost after costs out of sample (-0.005R, n 506, month t -0.19); the in-sample-chosen Friday long passes alone (+0.060R, t 2.10, Holm 0.036): a lead, not an edge.

Pre-registered in PREREGISTRATION.md (pushed alone first, commit 89c6b7cf7). Paper research: nothing live changed and no
proposal follows. **Item 44**: a new stand-alone calendar rule judged on 2017-26; it is not a gate, exit, entry or size of the
gold book (Gold trend / Gold daily engulf) and says nothing about it. Topic chosen here: the 14 Nov backlog
(`research/proposals/2026-11-14-untested-backlog.md`) lists no stand-alone gold candidate, and no study had traded gold by
weekday (`fx-weekday` is the dollar basket; `seasonality` read the Friday-to-Monday short on NQ / ES only).

Rule: 17:00 New York trading days built from OANDA mid H1 XAU_USD (`fetch.mjs`, 2006-03-20 to 2026-11-12, 5,351 days;
`gold-drd-long` `days()`); a day's weekday is its closing date's. One trade per selected session: in at the session's first
H1 open (Monday = the Sunday reopen, so the weekend gap is not in the trade), out at its last H1 close, stop 1 x ATR(20) of
the 20 days before, checked on H1 (a gap fills at the open). Costs: $0.30 spread + $0.15 slippage on each of the two market
orders ($0.60 a round trip) and `council/fills.mjs` `FIN.xau.long` (0.000148 of price a 22:00 UTC rollover, Wednesday three)
on longs; shorts pay and earn nothing. t = calendar-month sums of net R (every month counts), Holm over two tests.

- **T1 (primary)**: short every Monday session (the published weekend / Monday effect).
- **T2**: the weekday with the largest |mean gross R| of a long in 2007-16, traded on its sign: **Friday, long**
  (in-sample long gross R a session: Monday -0.026, Tuesday +0.006, Wednesday +0.033, Thursday -0.007, Friday +0.111).

## Tests

| Test | Window | n | Gross R | Net R | Net R at 2x costs | Cost R | Financing R | Nights | Win % | Stops | Month t (net) | Month t (gross) | Worst drawdown R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 short Monday (primary) | 2017-2026 | 506 | 0.023 | -0.005 | -0.033 | 0.028 | 0 | 0 | 47.23 | 45 | -0.19 | 0.88 | -11.84 |
| T1 short Monday (primary) | 2007-2016 | 519 | 0.035 | 0.001 | -0.033 | 0.034 | 0 | 0 | 48.36 | 40 | 0.03 | 1.23 | -15.34 |
| T2 long Friday (chosen in sample) | 2017-2026 | 500 | 0.088 | 0.06 | 0.033 | 0.028 | 0 | 0 | 54.6 | 60 | 2.1 | 3.05 | -5.87 |
| T2 long Friday (chosen in sample) | 2007-2016 | 520 | 0.111 | 0.072 | 0.032 | 0.034 | 0.006 | 295 | 53.85 | 61 | 2.24 | 3.44 | -11.14 |

2017-2026 = out of sample (decisive, entries 2017-01-01 to 2026-10-31, 118 months); 2007-2016 = in sample (120 months). T2's
in-sample row is the window it was chosen on: fitted by construction, so its in-sample line says nothing.

## Checks (all five needed per test)

| Test | OOS n >= 100 | OOS net > 0, t >= 2, Holm p < 0.05 | In-sample net > 0 | OOS net > 0 at 2x costs | Beats >= 38 of 40 placebo means | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|
| T1 | yes | no | yes | no | yes (39) | 0.5753 | 0.5753 | fail |
| T2 | yes | yes | yes (fitted) | yes | yes (38) | 0.0179 | 0.0357 | pass |

## Placebo (each OOS trade moved to a random trading day of the same year, any weekday, same side, rule and costs; 40 seeds)

| Test | Rule net R | Seeds beaten | 5th pct | Median | 95th pct | Seed mean |
|---|---|---|---|---|---|---|
| T1 | -0.005 | 39 / 40 | -0.108 | -0.062 | -0.022 | -0.059 |
| T2 | +0.060 | 38 / 40 | -0.025 | +0.009 | +0.058 | +0.012 |

T1 beats the placebo only because a short on a random day lost more (gold rose over the window); it still lost money.

## Every weekday, long, before costs (mean gross R a session; n; month t), deciding nothing

| Weekday | 2007-2016 | 2017-2026 |
|---|---|---|
| Monday | -0.026 (519, t -1.05) | -0.003 (506, t -0.11) |
| Tuesday | +0.006 (520, t 0.23) | +0.035 (512, t 1.25) |
| Wednesday | +0.033 (520, t 1.25) | +0.051 (509, t 1.77) |
| Thursday | -0.007 (519, t -0.21) | +0.024 (511, t 0.81) |
| Friday | +0.111 (520, t 3.44) | +0.088 (500, t 3.05) |

## By year (net R a trade, n; by entry year, 2026 runs to 12 Nov)

| Year | T1 short Monday | T2 long Friday |
|---|---|---|
| 2007 | -0.039 (52) | +0.290 (52) |
| 2008 | -0.101 (52) | -0.003 (52) |
| 2009 | +0.058 (52) | +0.052 (53) |
| 2010 | -0.097 (52) | +0.092 (52) |
| 2011 | -0.037 (52) | +0.156 (52) |
| 2012 | -0.025 (52) | +0.091 (52) |
| 2013 | +0.117 (52) | -0.114 (52) |
| 2014 | +0.046 (52) | +0.042 (52) |
| 2015 | +0.127 (52) | +0.063 (52) |
| 2016 | -0.042 (51) | +0.048 (51) |
| 2017 | -0.045 (50) | +0.110 (51) |
| 2018 | -0.015 (52) | +0.028 (51) |
| 2019 | -0.021 (52) | +0.023 (51) |
| 2020 | +0.007 (52) | +0.101 (50) |
| 2021 | -0.051 (52) | -0.007 (50) |
| 2022 | +0.182 (51) | -0.009 (51) |
| 2023 | -0.020 (50) | +0.164 (51) |
| 2024 | +0.022 (52) | +0.143 (51) |
| 2025 | -0.137 (52) | +0.044 (51) |
| 2026 | -0.010 (45) | -0.006 (45) |

## What this does and does not say

- **The published Monday effect is not in gold's Monday sessions here.** Long Monday made -0.026R gross in 2007-16 and -0.003R
  in 2017-26 (t -1.05 / -0.11); after the $0.60 round trip the short is about zero in both windows and negative at 2x costs.
  The papers read Friday close to Monday close; this rule leaves the weekend gap out (it cannot be entered at a CFD's reopen
  price), so it does not say the papers were wrong, only that the Monday SESSION is not a trade.
- **Friday long passes every line, as T2, and that is a lead only.** It was picked as the best of five weekdays on 2007-16, and
  it held on 2017-26: +0.060R a session net (n 500, month t 2.10, Holm p 0.036), +0.033R at 2x costs, 38 of 40 placebos (the
  bar's edge), positive in 7 of the 10 out-of-sample years, worst drawdown 5.9R. By the pre-registration the study FAILS
  because the primary test failed; T2 "passes alone, not an edge until replicated on other data". With the 333 earlier
  decisive tests on file no family correction would leave it standing, and a t of 2.10 on one market is where luck lives.
- Mechanism not tested: the Friday session holds the US payroll release on first Fridays and the end-of-week book squaring; a
  replication should check that the effect is not only payroll Fridays and test it on silver or another gold feed (HistData M1
  through `council/histdata.mjs`) before anyone calls it more.
- Costs: 0.028-0.034R a session at a 1 x ATR stop; financing is zero on almost every session (one entry after the 17:00 New
  York rollover, out before the next), except 295 in-sample rollover nights on Friday sessions of New York summers 2007-15,
  whose first H1 candle on that feed is the 17:00 New York hour (21:00 UTC, before the fixed 22:00 UTC rollover `nights`
  counts); from 2016 the feed's session starts after it.

## To repeat
`node --use-env-proxy research/edge/gold-weekday/fetch.mjs <dir>` (OANDA H1 gold, keep out of git), then
`node research/edge/gold-weekday/run.mjs <dir>`. Test: `tests/gold-weekday.test.mjs`.
