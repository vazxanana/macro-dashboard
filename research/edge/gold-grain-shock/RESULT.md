# Result: spot gold after a grain-price shock day (2026-11-14)

**Verdict: FAIL, 0 of 3: after a wheat / corn / soybean up-shock day the 5-day gold buy makes +0.011R a trade over the same buy on ordinary days, out of sample 2017-26 (n 137, month t +0.19).**

Judged on the pre-registered bar ([PREREGISTRATION.md](PREREGISTRATION.md), pushed alone before any gold outcome was computed). Paper research only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here was compared with or applied to that book (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member changed; no proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC days), council-data research/daily/{xau,wheat,corn,soybn}.json (git show), weekend folded into Monday; gold 2006-03-20 to 2026-11-13 (5369 candles).
- Trigger: the mean daily log change of wheat, corn and soybeans divided by the standard deviation of its previous 60 values; an **up-shock** is z >= 1.5, a **down-shock** z <= -1.5 (on gold's candles: 358 up and 317 down of 5205 scored days; from the grain files alone, before any gold price was read: 2007-16 154 up / 160 down, 2017-26 185 up / 148 down).
- Trade: entry at the next gold open, stop 2 x ATR(20) checked on daily candles; a stop day closes at mid-day for financing, out at the close of the hold's last candle; one position at a time; cost $0.60 an ounce round trip; financing `FIN.xau.long` 0.000148 of price a rollover on buys only.
- **Excess R** = a trade's net R minus the mean net R of the same trade after every ordinary day (not a shock in the test's direction) of the same calendar year; t on calendar-month sums; Holm over the three tests; in sample 2007-2016, out of sample 2017 to 2026-10-31.

## The three tests

| Test, window | n | months | gross R | gross t | cost R | financing R | net R | net t | year baseline R | **excess R** | **excess t** | p (OOS: Holm) | net R 2x | excess R 2x | won | stops |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 buy after a grain up-shock, out after 5 candles (inflation impulse), in sample | 120 | 78 | +0.111 | +1.64 | +0.017 | +0.030 | +0.064 | +0.87 | +0.002 | +0.062 | +0.87 | 0.389 | +0.016 | +0.061 | 53 % | 19 |
| T1 buy after a grain up-shock, out after 5 candles (inflation impulse), out of sample | 137 | 88 | +0.115 | +1.78 | +0.014 | +0.037 | +0.064 | +1.01 | +0.053 | +0.011 | +0.19 | 1.000 | +0.013 | +0.011 | 55 % | 19 |
| T1 buy after a grain up-shock, out after 5 candles (inflation impulse), whole | 257 | 166 | +0.113 | +2.43 | +0.015 | +0.034 | +0.064 | +1.34 | +0.029 | +0.035 | +0.76 | 0.449 | +0.015 | +0.035 | 54 % | 38 |
| T2 buy after a grain up-shock, out after 20 candles (slower repricing), in sample | 79 | 69 | +0.216 | +1.34 | +0.017 | +0.092 | +0.107 | +0.69 | +0.070 | +0.037 | +0.24 | 0.808 | −0.003 | +0.038 | 42 % | 35 |
| T2 buy after a grain up-shock, out after 20 candles (slower repricing), out of sample | 84 | 78 | +0.226 | +1.51 | +0.014 | +0.125 | +0.087 | +0.61 | +0.199 | −0.112 | −0.79 | 1.000 | −0.052 | −0.114 | 39 % | 29 |
| T2 buy after a grain up-shock, out after 20 candles (slower repricing), whole | 163 | 147 | +0.222 | +2.02 | +0.016 | +0.109 | +0.097 | +0.93 | +0.137 | −0.040 | −0.39 | 0.699 | −0.028 | −0.040 | 40 % | 64 |
| T3 sell after a grain down-shock, out after 5 candles (disinflation impulse), in sample | 132 | 93 | −0.004 | −0.06 | +0.017 | +0.000 | −0.021 | −0.33 | −0.052 | +0.031 | +0.49 | 0.628 | −0.037 | +0.031 | 48 % | 21 |
| T3 sell after a grain down-shock, out after 5 candles (disinflation impulse), out of sample | 114 | 80 | −0.096 | −1.40 | +0.014 | +0.000 | −0.111 | −1.42 | −0.111 | −0.000 | −0.00 | 1.000 | −0.125 | −0.001 | 42 % | 21 |
| T3 sell after a grain down-shock, out after 5 candles (disinflation impulse), whole | 246 | 173 | −0.047 | −1.03 | +0.016 | +0.000 | −0.062 | −1.27 | −0.079 | +0.017 | +0.35 | 0.729 | −0.078 | +0.016 | 45 % | 42 |

Shock days skipped by the one-position rule: T1 87, T2 188, T3 63. gross t is per trade; net t and excess t are on calendar-month sums.

## Pass bar (T1 decides the verdict)

| Test | OOS excess t >= 2 and Holm p < 0.05 | IS and OOS excess positive | OOS net R and excess R > 0 at 2x costs | beats >= 38 of 40 placebo seeds | passes |
|---|---|---|---|---|---|
| T1 | no (t +0.19, Holm p 1) | yes (IS +0.062R, OOS +0.011R) | yes (net +0.013R, excess +0.011R) | no (25) | no |
| T2 | no (t −0.79, Holm p 1) | no (IS +0.037R, OOS −0.112R) | no (net −0.052R, excess −0.114R) | no (11) | no |
| T3 | no (t −0.00, Holm p 1) | no (IS +0.031R, OOS −0.000R) | no (net −0.125R, excess −0.001R) | no (23) | no |

## Placebo

| Test | OOS trades | real OOS excess t | seeds beaten (of 40) | seed t range |
|---|---|---|---|---|
| T1 | 137 | +0.19 | 25 | −1.49 to +1.57 |
| T2 | 84 | −0.79 | 11 | −2.02 to +1.66 |
| T3 | 114 | −0.00 | 23 | −3.20 to +1.72 |

Per seed, as many random ordinary entry days per out-of-sample year as the test took trades that year, the same trade and the same month-sum t of excess.

## Reading

- T1 buy after a grain up-shock, out after 5 candles (inflation impulse): excess +0.062R a trade in sample (n 120, t +0.87), +0.011R out of sample (n 137, t +0.19, Holm p 1); raw net +0.064R out of sample (t +1.01); beats 25 of 40 placebo seeds.
- T2 buy after a grain up-shock, out after 20 candles (slower repricing): excess +0.037R a trade in sample (n 79, t +0.24), −0.112R out of sample (n 84, t −0.79, Holm p 1); raw net +0.087R out of sample (t +0.61); beats 11 of 40 placebo seeds.
- T3 sell after a grain down-shock, out after 5 candles (disinflation impulse): excess +0.031R a trade in sample (n 132, t +0.49), −0.000R out of sample (n 114, t −0.00, Holm p 1); raw net −0.111R out of sample (t −1.42); beats 23 of 40 placebo seeds.
- The raw net R of a buy carries gold's drift of the year (it rose in most years of 2017-26); the excess column is what the study is judged on.
- Stops are checked on daily candles (stop first on a candle that touches it), coarser than an hourly check; the same rule is applied to the baseline trades, so the excess is like for like.
- Paper only; never call this an edge without its n and t.

To repeat: `node research/edge/gold-grain-shock/run.mjs fetch <dir>` (the four daily files by git show from `origin/council-data`; keep `<dir>` out of git), then `… full <dir>`. Test: `tests/gold-grain-shock.test.mjs`.
