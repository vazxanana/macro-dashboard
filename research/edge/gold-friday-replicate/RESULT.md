# Result: does the gold Friday-session long replicate? (14 Nov 2026)

**Verdict: FAIL. R2 broke: on HistData 2018-26 the Friday long made +0.053R net (n 445, month t 1.69, under 2); OANDA over the same years gives t 1.76. R1 and R3 held. Still a lead, not an edge.**

Pre-registered in PREREGISTRATION.md (pushed alone first, commit a4a5df2ac). Paper research: nothing live changed, no
proposal follows. **Item 44**: a stand-alone calendar rule; it says nothing about the gold book.

The rule under test is branch `gold-weekday`'s T2, frozen: long every Friday 17:00-New-York session, in at its first H1 open,
out at its last H1 close, stop 1 x ATR(20) of the 20 days before checked on H1, $0.60 a round trip + `FIN.xau.long` on longs.
`original.mjs` is a verbatim copy of that branch's `run.mjs` (sha256 `7cc7253f…`, pinned in the test); every trading function
is imported from it. t = calendar-month sums of net R (every month counts); one-sided p; Holm over R2 and R3.

**Said plainly: R2 and R3 re-read the same years as the original (2017-26) on other prices of the same metal. They are not
independent evidence. R4, the next 52 Fridays, is the real test.**

## Gate G0: the original reproduced
OANDA mid H1 XAU_USD (2006-03-19 to 2026-11-13, 125,704 candles): out of sample n 500, +0.060R net, month t 2.10, exactly the
original's figures. Gate passed.

## The three checks

| Check | Data, window | n | Gross R | Net R | Net R at 2x costs | Month t (net) | Month t (gross) | One-sided p | Holm p | Placebo (seeds beaten) | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R1 other Fridays (not payroll) | OANDA, 2017-2026 | 392 | 0.103 | 0.075 | 0.048 | 2.44 | 3.3 | - | - | 39 / 40 | survives (bar: net > 0, t >= 1.5) |
| R1 payroll Fridays | OANDA, 2017-2026 | 108 | 0.037 | 0.008 | -0.022 | 0.11 | 0.52 | - | - | - | reported |
| R2 HistData XAU/USD M1 bid | 2018-2026 | 445 | 0.08 | 0.053 | 0.027 | 1.69 | 2.51 | 0.0455 | 0.0455 | 35 / 40 | **fail** (t under 2) |
| R3 XAU/EUR, 0.016 % cost | OANDA, 2017-2026 | 500 | 0.088 | 0.074 | 0.06 | 2.51 | 2.97 | 0.006 | 0.012 | 36 / 40 | pass |

2017-2026 = entries 2017-01-01 to 2026-10-31 (118 months); R2's window is 2018-01-01 to 2026-10-31 (106 months; the HistData
files start in 2018).

- **R1, the payroll split.** Payroll Fridays (US Employment Situation release days: `council/events.mjs` from 2022, the BLS
  rule before) carry almost nothing (+0.008R net, t 0.11). The other Fridays carry the whole result (+0.075R, t 2.44), so the
  lead is not a jobs-report effect. In sample 2007-16 both were positive (payroll +0.101R, n 115, t 1.33; other +0.063R, n 405,
  t 1.90). By `ict/tracker.mjs`'s fallback proxy (a Friday dated 1st-7th), deciding nothing: payroll +0.052R (n 114, t 0.74),
  other +0.063R (n 386, t 2.00).
- **R2, a second feed.** HistData and OANDA agree session by session (445 sessions on both, 436 with the same sign of gross R);
  OANDA over the same 2018-26 window: n 449, +0.055R net, t 1.76. So the miss is the window, not the feed: without 2017
  (+0.110R on OANDA) the result is under the bar on either feed. Its 2x-cost figure stays positive (+0.027R).
- **R3, gold in euros.** Passes out of sample (+0.074R, t 2.51, Holm 0.012) and was positive in sample (+0.106R, n 520,
  t 3.21). The cost is an assumption (0.016 % of price; no measured XAU/EUR spread in the repository); at 2x it is +0.060R.
  Gold in euros moves with gold in dollars on most days, so this mostly re-reads the same Friday moves.

## Net R a trade by year (n; by entry year, deciding nothing)

| Year | OANDA XAU/USD | HistData XAU/USD | OANDA XAU/EUR |
|---|---|---|---|
| 2007 | +0.290 (52) | - | +0.286 (52) |
| 2008 | -0.003 (52) | - | +0.096 (52) |
| 2009 | +0.052 (53) | - | +0.106 (53) |
| 2010 | +0.092 (52) | - | +0.048 (52) |
| 2011 | +0.156 (52) | - | +0.213 (52) |
| 2012 | +0.091 (52) | - | -0.015 (52) |
| 2013 | -0.114 (52) | - | -0.113 (52) |
| 2014 | +0.042 (52) | - | +0.135 (52) |
| 2015 | +0.063 (52) | - | +0.166 (52) |
| 2016 | +0.048 (51) | - | +0.134 (51) |
| 2017 | +0.110 (51) | - | +0.030 (51) |
| 2018 | +0.028 (51) | -0.023 (47) | +0.094 (51) |
| 2019 | +0.023 (51) | +0.020 (51) | +0.012 (51) |
| 2020 | +0.101 (50) | +0.111 (50) | +0.102 (50) |
| 2021 | -0.007 (50) | -0.004 (50) | +0.026 (50) |
| 2022 | -0.009 (51) | -0.009 (51) | +0.088 (51) |
| 2023 | +0.164 (51) | +0.157 (51) | +0.188 (51) |
| 2024 | +0.143 (51) | +0.145 (51) | +0.195 (51) |
| 2025 | +0.044 (51) | +0.062 (51) | -0.004 (51) |
| 2026 | -0.006 (45) | +0.008 (43) | +0.009 (45) |

## R4: the forward line (nothing computed)
The next 52 Friday sessions from the one closing Friday 20 November 2026, by the frozen rule on OANDA mid H1 XAU_USD with
$0.60 a round trip and `FIN.xau.long`: **the lead holds only if their mean net R a trade is > 0.** Read once, after the 52nd.
At +0.06R a trade and a session sd of 0.67R (2017-26), 52 trades give a t near 0.65: R4 can contradict the lead, it cannot prove it.

## What this means
Not an edge, and not a rule for the council. The Friday long is not a payroll-day artefact and survives a change of currency,
but the second feed starts in 2018, and from 2018 neither feed clears t 2 (HistData 1.69, OANDA 1.76): the out-of-sample t of 2.10 leans on 2017. It stays what gold-weekday called it:
a lead.

To repeat: `node research/edge/gold-friday-replicate/run.mjs fetch <dir>` (git show from `origin/council-data`, no network),
then `node research/edge/gold-friday-replicate/run.mjs run <xau-h1.json> <dir> <xaueur-5m.json.gz>` with OANDA mid H1 XAU_USD
(gold-weekday `fetch.mjs`) and OANDA mid M5 XAU_EUR from the candle proxy, kept out of git.
