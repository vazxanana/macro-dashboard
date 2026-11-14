# Result: spot gold after an emerging-market currency stress day (2026-11-14)

**Verdict: FAIL, 0 of 3: after a rand / peso / lira stress day the 5-day gold buy makes −0.127R a trade over the same buy on ordinary days, out of sample 2017-26 (n 145, month t −2.37).**

Judged on the pre-registered bar ([PREREGISTRATION.md](PREREGISTRATION.md), pushed alone before any gold outcome was computed). Paper research only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here was compared with or applied to that book (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member changed; no proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC days), council-data research/daily/{xau,usdzar,usdmxn,usdtry}.json (git show), weekend folded into Monday; gold 2006-03-20 to 2026-11-13 (5369 candles).
- Trigger: the mean daily log change of USD/ZAR, USD/MXN and USD/TRY divided by the standard deviation of its previous 60 values; a **stress day** is z >= 1.5 (404 of 5074 scored days, 8.0 %).
- Trade: entry at the next gold open, stop 2 x ATR(20) checked on daily candles; a stop day closes at mid-day for financing, out at the close of the hold's last candle; one position at a time; cost $0.60 an ounce round trip; financing `FIN.xau.long` 0.000148 of price a rollover on buys only.
- **Excess R** = a trade's net R minus the mean net R of the same trade after every ordinary (non-stress) day of the same calendar year; t on calendar-month sums; Holm over the three tests; in sample 2007-2016, out of sample 2017 to 2026-10-31.

## The three tests

| Test, window | n | months | gross R | gross t | cost R | financing R | net R | net t | year baseline R | **excess R** | **excess t** | p (OOS: Holm) | net R 2x | excess R 2x | won | stops |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 buy at the next open, out after 5 candles (forced selling reverses), in sample | 149 | 90 | +0.080 | +1.28 | +0.016 | +0.030 | +0.035 | +0.60 | −0.017 | +0.052 | +0.91 | 0.364 | −0.011 | +0.053 | 50 % | 26 |
| T1 buy at the next open, out after 5 candles (forced selling reverses), out of sample | 145 | 83 | −0.020 | −0.32 | +0.014 | +0.034 | −0.068 | −1.15 | +0.059 | −0.127 | −2.37 | 0.061 | −0.115 | −0.123 | 51 % | 37 |
| T1 buy at the next open, out after 5 candles (forced selling reverses), whole | 294 | 173 | +0.031 | +0.70 | +0.015 | +0.032 | −0.016 | −0.38 | +0.021 | −0.036 | −0.91 | 0.362 | −0.062 | −0.033 | 51 % | 63 |
| T2 sell at the next open, out after 1 candle (liquidation goes on), in sample | 204 | 90 | +0.006 | +0.22 | +0.016 | +0.000 | −0.010 | −0.37 | −0.022 | +0.012 | +0.45 | 0.652 | −0.025 | +0.013 | 47 % | 6 |
| T2 sell at the next open, out after 1 candle (liquidation goes on), out of sample | 200 | 83 | +0.039 | +1.34 | +0.014 | +0.000 | +0.025 | +0.91 | −0.037 | +0.062 | +2.14 | 0.070 | +0.012 | +0.062 | 45 % | 1 |
| T2 sell at the next open, out after 1 candle (liquidation goes on), whole | 404 | 173 | +0.022 | +1.12 | +0.015 | +0.000 | +0.008 | +0.40 | −0.029 | +0.037 | +1.86 | 0.064 | −0.007 | +0.037 | 46 % | 7 |
| T3 buy at the next open, out after 20 candles (slower haven bid), in sample | 92 | 77 | +0.296 | +1.99 | +0.016 | +0.097 | +0.183 | +1.31 | +0.022 | +0.161 | +1.17 | 0.246 | +0.070 | +0.159 | 47 % | 39 |
| T3 buy at the next open, out after 20 candles (slower haven bid), out of sample | 92 | 74 | +0.193 | +1.18 | +0.014 | +0.112 | +0.068 | +0.42 | +0.177 | −0.109 | −0.70 | 0.486 | −0.057 | −0.100 | 36 % | 41 |
| T3 buy at the next open, out after 20 candles (slower haven bid), whole | 184 | 151 | +0.245 | +2.21 | +0.015 | +0.104 | +0.126 | +1.17 | +0.100 | +0.026 | +0.25 | 0.803 | +0.006 | +0.029 | 41 % | 80 |

Stress days skipped by the one-position rule: T1 110, T2 0, T3 220. gross t is per trade; net t and excess t are on calendar-month sums.

## Pass bar (T1 decides the verdict)

| Test | OOS excess t >= 2 and Holm p < 0.05 | IS and OOS excess positive | OOS net R and excess R > 0 at 2x costs | beats >= 38 of 40 placebo seeds | passes |
|---|---|---|---|---|---|
| T1 | no (t −2.37, Holm p 0.0612) | no (IS +0.052R, OOS −0.127R) | no (net −0.115R, excess −0.123R) | no (0) | no |
| T2 | no (t +2.14, Holm p 0.0704) | yes (IS +0.012R, OOS +0.062R) | yes (net +0.012R, excess +0.062R) | yes (40) | no |
| T3 | no (t −0.70, Holm p 0.4862) | no (IS +0.161R, OOS −0.109R) | no (net −0.057R, excess −0.100R) | no (8) | no |

## Placebo

| Test | OOS trades | real OOS excess t | seeds beaten (of 40) | seed t range |
|---|---|---|---|---|
| T1 | 145 | −2.37 | 0 | −1.52 to +1.58 |
| T2 | 200 | +2.14 | 40 | −1.59 to +1.41 |
| T3 | 92 | −0.70 | 8 | −2.10 to +1.97 |

Per seed, as many random ordinary entry days per out-of-sample year as the test took trades that year, the same trade and the same month-sum t of excess.

## Reading

- T1 buy at the next open, out after 5 candles (forced selling reverses): excess +0.052R a trade in sample (n 149, t +0.91), −0.127R out of sample (n 145, t −2.37, Holm p 0.0612); raw net −0.068R out of sample (t −1.15); beats 0 of 40 placebo seeds.
- T2 sell at the next open, out after 1 candle (liquidation goes on): excess +0.012R a trade in sample (n 204, t +0.45), +0.062R out of sample (n 200, t +2.14, Holm p 0.0704); raw net +0.025R out of sample (t +0.91); beats 40 of 40 placebo seeds.
- T3 buy at the next open, out after 20 candles (slower haven bid): excess +0.161R a trade in sample (n 92, t +1.17), −0.109R out of sample (n 92, t −0.70, Holm p 0.4862); raw net +0.068R out of sample (t +0.42); beats 8 of 40 placebo seeds.
- T1 went the other way out of sample (month t −2.37): seen after the fact, not a pre-registered claim, and not a finding.
- T2 is a near miss: out-of-sample month t +2.14 clears 2 before the correction for three tests but not after (Holm p 0.0704 >= 0.05), so it fails bar 1; its in-sample excess (+0.012R, t +0.45) is much smaller. A hypothesis at most, for a new pre-registration on other data.
- The raw net R of a buy carries gold's drift of the year (it rose in most years of 2017-26); the excess column is what the study is judged on.
- Stops are checked on daily candles (stop first on a candle that touches it), coarser than an hourly check; the same rule is applied to the baseline trades, so the excess is like for like.
- Paper only; never call this an edge without its n and t.

To repeat: `node research/edge/gold-em-fx-stress/run.mjs fetch <dir>` (the four daily files by git show from `origin/council-data`; keep `<dir>` out of git), then `… full <dir>`. Test: `tests/gold-em-fx-stress.test.mjs`.
