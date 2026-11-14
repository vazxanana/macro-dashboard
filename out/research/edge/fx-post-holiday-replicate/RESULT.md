# Result: the US dollar on the day after a US market holiday, replicated on other dollar pairs (2026-11-14)

**Verdict: FAIL**: long USD on the day after a US holiday against six other currencies makes +0.026R a holiday net 2005-26 (n 198, t +1.00).

Judged on the pre-registered bar (PREREGISTRATION.md, pushed alone before any candle was read). The hypothesis replicated is the side observation of `research/edge/fx-us-holiday` (PR #975): long USD on the first NYSE trading day after a US holiday, seven majors: +0.089R a holiday out of sample 2015-26 (n 110, t 2.65), -0.004R in sample 2005-14 (n 88, t -0.10); reported only there. Here, on 6 dollar pairs that study never read, over 2005-01-03 to 2026-11-06: +0.026R a holiday after costs and financing (n 198, event t +1.00, month-sum t +0.95); at 2x cost −0.020R; first half −0.006R (n 97), second half +0.058R (n 101); above 40 of 40 placebo seeds. #975's side observation does not carry to these dollar pairs. Nothing live changed and no proposal follows.

Data: OANDA mid daily candles (UTC days, close 00:00 UTC = 19:00 / 20:00 New York), council-data research/daily/<key>.json (git show), weekend folded into Monday (council/fills.mjs foldWeekend). Judged basket: USDMXN, USDZAR, USDSEK, USDNOK, USDSGD, USDPLN, equal weight, every leg long USD; reported only: USDTRY, USDCNH; dropped: USDHKD (pegged inside 7.75-7.85). Basket days 2004-06-30 to 2026-11-06 (5814; 562 dates skipped where a pair lacked the day or its previous candle differed). Post-holiday days without a basket candle: none. **The close is the UTC daily close (19:00 or 20:00 New York), not 17:00 New York**, as in #975. Costs are **assumed** spreads (the demo broker does not quote these pairs): USDMXN 0.05 %, USDZAR 0.10 %, USDSEK 0.05 %, USDNOK 0.05 %, USDSGD 0.03 %, USDPLN 0.06 %, USDTRY 0.15 %, USDCNH 0.04 % a round trip, plus 0.0045 % commission. Financing: (USD rate − the other currency's rate − 1 %) / 365 a rollover, three on a Wednesday candle; USD from #975's rate path, the others annual approximate policy rates from memory (`rates-exotic.json`); holiday value-date days not modelled.

## The basket (judged)

| Window | n | gross % | gross R | financing R | cost R | net R cost 0 | net R base | net R 2x | event t | month-sum t (months) | won | leg stops |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Whole 2005-01-03 to 2026-11-06 | 198 | +0.1248 | +0.075 | −0.005 | +0.044 | +0.070 | +0.026 | −0.020 | +1.00 | +0.95 (179) | 54.5 % | 40 |
| First half to 2015-12-31 | 97 | +0.0909 | +0.042 | −0.006 | +0.042 | +0.036 | −0.006 | −0.051 | −0.16 | −0.16 (88) | 53.6 % | 28 |
| Second half from 2016-01-01 | 101 | +0.1573 | +0.108 | −0.004 | +0.046 | +0.104 | +0.058 | +0.009 | +1.61 | +1.52 (91) | 55.5 % | 12 |

Welch t of the gross basket % on post-holiday days against 5097 ordinary days: +2.72 (ordinary days +0.0054 % a day long USD).

## Pass bar

| Test | Holds |
|---|---|
| T1 net R > 0, event t >= 2 and month-sum t >= 2 | no (+0.026R, t +1.00, month t +0.95) |
| T2 net R > 0 at 2x cost | no (−0.020R) |
| T3 above at least 38 of 40 placebo seeds | yes (40 of 40) |
| T4 net R > 0 in both halves | no (−0.006R, +0.058R) |

## Placebo

40 seeds, each drawing as many ordinary days per year as the rule traded (from 5097 ordinary days: NYSE trading days that are neither the day before nor the day after a holiday), traded long USD with the same stop, costs and financing. The rule's +0.026R is above 40 of them; seed means range −0.098R to +0.006R.

## Per leg inside the basket (same days)

| Pair | n | gross R | financing R | cost R | net R | t | stops |
|---|---|---|---|---|---|---|---|
| USDMXN | 198 | +0.090 | −0.013 | +0.042 | +0.036 | +1.17 | 5 |
| USDZAR | 198 | +0.100 | −0.008 | +0.051 | +0.040 | +1.36 | 4 |
| USDSEK | 198 | +0.058 | −0.000 | +0.037 | +0.020 | +0.62 | 8 |
| USDNOK | 198 | +0.041 | −0.002 | +0.035 | +0.004 | +0.12 | 9 |
| USDSGD | 198 | +0.080 | −0.002 | +0.056 | +0.022 | +0.66 | 9 |
| USDPLN | 198 | +0.085 | −0.004 | +0.044 | +0.036 | +1.09 | 5 |

## Each pair alone, on its own candles (reported only)

| Pair | in basket | n | from | net R cost 0 | net R base | net R 2x | t | financing R |
|---|---|---|---|---|---|---|---|---|
| USDMXN | yes | 198 | 2005-01-18 | +0.077 | +0.036 | −0.008 | +1.17 | −0.013 |
| USDZAR | yes | 198 | 2005-01-18 | +0.092 | +0.040 | −0.013 | +1.36 | −0.008 |
| USDSEK | yes | 198 | 2005-01-18 | +0.057 | +0.020 | −0.019 | +0.62 | −0.000 |
| USDNOK | yes | 198 | 2005-01-18 | +0.039 | +0.004 | −0.033 | +0.12 | −0.002 |
| USDSGD | yes | 198 | 2005-01-18 | +0.078 | +0.022 | −0.039 | +0.66 | −0.002 |
| USDPLN | yes | 198 | 2005-01-18 | +0.080 | +0.036 | −0.010 | +1.09 | −0.004 |
| USDTRY | no | 177 | 2007-04-09 | +0.063 | −0.107 | −0.280 | −2.42 | −0.076 |
| USDCNH | no | 143 | 2011-04-25 | +0.090 | −0.024 | −0.145 | −0.66 | −0.034 |

## By holiday (reported only)

| Holiday before the day | n | net R | t |
|---|---|---|---|
| Christmas Day | 21 | −0.036 | −1.25 |
| Good Friday | 22 | −0.058 | −0.89 |
| Independence Day | 22 | +0.157 | +2.00 |
| Juneteenth | 5 | +0.082 | +0.93 |
| Labor Day | 22 | +0.044 | +0.50 |
| Martin Luther King Day | 22 | −0.053 | −0.55 |
| Memorial Day | 22 | +0.154 | +2.17 |
| New Year's Day | 19 | +0.000 | +0.00 |
| Presidents' Day | 22 | −0.000 | −0.01 |
| Thanksgiving Day | 21 | +0.010 | +0.15 |

## Reading

- One observation is one holiday (the six legs of one basket are one bet); about nine holidays a year over 22 years.
- The side, the day, the hold, the stop and the bar were fixed from #975 before these candles were read; nothing was chosen on them.
- Before costs the day after a US holiday does stand out on these pairs too: +0.070R a holiday with financing but no spread (t +2.67), a gross Welch t of +2.72 against ordinary days, and every leg positive gross. That is the same sign as #975's majors, so the dollar's move may be real; but the spreads of these pairs (assumed, +0.044R a holiday) take most of it, the first half is −0.006R, and the net t is +1.00. The placebo pass (40 of 40) mostly says ordinary days lose the same costs; it is not enough on its own. Not an edge, not a proposal.
- Long USD against these currencies pays carry on most days (their rates are mostly above the US rate); it is charged on the approximate annual table, and three nights on a Wednesday candle. The spreads are assumptions, not measurements: cost 0 is shown beside base and 2x.
- The UTC close sits two or three hours after the 17:00 New York rollover, as in #975.
- Paper only. Never call this an edge without its n and t.

To repeat: `node research/edge/fx-post-holiday-replicate/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `… full <dir>`. Test: `tests/fx-post-holiday-replicate.test.mjs`.
