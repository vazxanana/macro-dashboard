# Result: the US dollar on the day after a US market holiday, read on dollar-priced metals (2026-11-14)

**Verdict: FAIL (T1, T2, T3, T4 not met)**: short gold and silver on the day after a US holiday makes −0.092R a holiday net 2006-26 (n 185, t −2.78).

Judged on the pre-registered bar (PREREGISTRATION.md, pushed alone before any candle was read). A second out-of-sample check of #975's side observation (long USD on the first NYSE trading day after a US holiday; seven majors, reported only) after #980 failed it on six exotic dollar pairs. Here, short gold and silver (a dollar rise = metals down in dollars), 2006-04-18 to 2026-11-06: −0.092R a holiday after costs (n 185, event t −2.78, month-sum t −2.67); gross −0.066R; at 2x cost −0.119R; first half −0.082R (n 84), second half −0.101R (n 101); above 2 of 40 placebo seeds. #975's side observation does not carry to the metals. Nothing live changed and no proposal follows. This is a standalone calendar study, not a test of any gold-book system (owner item 44).

Data: OANDA mid daily candles (UTC days, close 00:00 UTC = 19:00 / 20:00 New York), council-data research/daily/<key>.json (git show), weekend folded into Monday (council/fills.mjs foldWeekend). Judged basket: short XAU and XAG, equal weight in R; reported only: XPT, XPD. Basket days 2006-04-18 to 2026-11-06 (5342; 21 dates skipped where a metal lacked the day or its previous candle differed). Post-holiday days without a basket candle: 2014-04-21. Pre-registered from 2005; gold and silver candles start 2006-03-20. **The close is the UTC daily close (19:00 or 20:00 New York), not 17:00 New York**, as in #975 and #980. Costs a round trip: XAU $0.30 an ounce, XAG $0.03 an ounce, XPT 0.30 % (assumed), XPD 0.50 % (assumed). Financing: council/fills.mjs financing(): a short is credited nothing (FIN.xau.short = 0); no FIN entry for xag / xpt / xpd, so it is 0 on every leg.

## The basket (judged)

| Window | n | gross % (short) | gross R | financing R | cost R | net R cost 0 | net R base | net R 2x | event t | month-sum t (months) | won | leg stops |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Whole 2006-04-18 to 2026-11-06 | 185 | −0.1927 | −0.066 | +0.000 | +0.027 | −0.066 | −0.092 | −0.119 | −2.78 | −2.67 (167) | 43.2 % | 18 |
| First half to 2015-12-31 | 84 | −0.2442 | −0.056 | +0.000 | +0.026 | −0.056 | −0.082 | −0.108 | −1.54 | −1.48 (76) | 40.5 % | 7 |
| Second half from 2016-01-01 | 101 | −0.1498 | −0.074 | +0.000 | +0.028 | −0.074 | −0.101 | −0.129 | −2.40 | −2.31 (91) | 45.5 % | 11 |

Welch t of the gross basket % (short) on post-holiday days against 4802 ordinary days: −1.50 (ordinary days −0.0314 % a day short, −0.036R net).

## Pass bar

| Test | Holds |
|---|---|
| T1 net R > 0, event t >= 2 and month-sum t >= 2 | no (−0.092R, t −2.78, month t −2.67) |
| T2 net R > 0 at 2x cost | no (−0.119R) |
| T3 above at least 38 of 40 placebo seeds | no (2 of 40) |
| T4 net R > 0 in both halves | no (−0.082R, −0.101R) |

## Placebo

40 seeds, each drawing as many ordinary days per year as the rule traded (from 4802 ordinary days: NYSE trading days that are neither the day before nor the day after a holiday), traded short with the same stop and costs. The rule's −0.092R is above 2 of them; seed means range −0.095R to +0.058R.

## Per leg inside the basket (same days)

| Metal | n | gross R | financing R | cost R | net R | t | stops |
|---|---|---|---|---|---|---|---|
| XAU | 185 | −0.079 | +0.000 | +0.011 | −0.090 | −2.53 | 9 |
| XAG | 185 | −0.052 | +0.000 | +0.043 | −0.095 | −2.68 | 9 |

## Each metal alone, on its own candles (reported only)

| Metal | in basket | n | from | gross R | net R cost 0 | net R base | net R 2x | t | stops |
|---|---|---|---|---|---|---|---|---|---|
| XAU | yes | 186 | 2006-05-30 | −0.077 | −0.077 | −0.088 | −0.099 | −2.49 | 9 |
| XAG | yes | 186 | 2006-05-30 | −0.049 | −0.049 | −0.092 | −0.136 | −2.62 | 9 |
| XPT | no | 196 | 2005-02-22 | −0.060 | −0.060 | −0.161 | −0.262 | −4.58 | 11 |
| XPD | no | 196 | 2005-02-22 | −0.021 | −0.021 | −0.142 | −0.264 | −4.16 | 7 |

XPT and XPD costs are assumed (0.30 % and 0.50 % of price a round trip), not measured.

## By holiday (reported only)

| Holiday before the day | n | net R | t |
|---|---|---|---|
| Christmas Day | 20 | −0.273 | −3.85 |
| Good Friday | 19 | −0.187 | −2.98 |
| Independence Day | 21 | +0.094 | +1.05 |
| Juneteenth | 5 | +0.041 | +0.18 |
| Labor Day | 21 | −0.036 | −0.33 |
| Martin Luther King Day | 20 | −0.158 | −1.62 |
| Memorial Day | 21 | +0.192 | +2.34 |
| New Year's Day | 18 | −0.489 | −5.56 |
| Presidents' Day | 20 | −0.047 | −0.39 |
| Thanksgiving Day | 20 | −0.033 | −0.32 |

## Reading

- One observation is one holiday (the two legs of one basket are one bet); about nine holidays a year over 20 years.
- The side (short metals = long USD), the day, the hold, the stop and the bar were fixed from #975 / #980 before these candles were read; nothing was chosen on them.
- Gross −0.066R a holiday (t before costs −1.97); the costs of gold and silver are small (+0.027R a holiday), so on these markets the question is the move itself, not the spread. Gross Welch t against ordinary days −1.50.
- The sign is the OPPOSITE of the hypothesis on every metal and in both halves: gold and silver rose more than on an ordinary day on the day after a US holiday (gross Welch t −1.50, below the ±2 line). That is a second look, not a pre-registered test, and must not be read as "long metals after a holiday": it sits mostly in a few holidays (New Year's Day −0.489R (n 18), Christmas Day −0.273R (n 20), Good Friday −0.187R (n 19)), where spot metals themselves are shut or thin over the holiday and around the turn of the year, and any such rule would need its own pre-registration on other data (and could never be a gate on a gold-book system, owner item 44).
- With #980, two out-of-sample checks of #975's dollar observation now fail; the dollar's day after a US holiday is not a rule to carry further.
- Short metals are credited no financing in the repo's paper model (a broker would credit some), so the net figures are conservative on that side by a night or three of carry.
- The UTC close sits two or three hours after the 17:00 New York rollover, as in #975 and #980.
- Paper only. Not a gold-book test and never a gate on one. Never call this an edge without its n and t.

To repeat: `node research/edge/post-holiday-metals/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `… full <dir>`. Test: `tests/post-holiday-metals.test.mjs`.
