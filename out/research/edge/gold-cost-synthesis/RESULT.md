# Gold cost synthesis: stop size, gross R and cost R across the 13-14 Nov gold studies

Built 2026-11-14. Pre-registration: PREREGISTRATION.md (pushed alone first). Inputs: collected.json (each study's own result.json, read from its branch by run.mjs; the commit of each is in result.json).

**Verdict: DESCRIPTIVE, no rule tested: across 44 gold studies cost R falls as the $ stop widens (rank −0.83) while gross R rises only weakly (0.29); 17 of 214 test-windows have gross t ≥ 2, 2 tests in both windows.**

This is a description of committed results. Nothing was re-run, no candle was read, no rule was tested, no study's verdict changes, nothing live changed and no proposal follows. No row below is an edge.

## What was read

- 44 studies, 127 pre-registered tests, 249 test-windows (in sample, out of sample, or a single window). 1 study is left out of the stop / cost description: gold-vol-target (portfolio weights rebalanced weekly, not trades with a stop; no R a trade).
- 249 test-windows report both gross and net R a trade; 214 of them also report a gross t. 97 report a median stop in $, 30 a mean stop in $ only; the rest give the stop as a rule (ATR multiples, a range side) and no $ figure.
- Cost R = gross minus net, as each study charged it (spread and slippage, $0.30-0.60 a round trip, plus overnight financing on buys where the study counted it). Where a figure is missing the table says "not reported"; nothing was estimated.

## Gross R, cost R and net R by median stop in $

| Median stop | Test-windows | Studies | Median gross R | Median cost R | Median net R | Gross > 0 | Gross t ≥ 2 (of those with a gross t) | Net > 0 |
|---|---|---|---|---|---|---|---|---|
| under $3 | 15 | 6 | +0.001 | +0.357 | −0.345 | 8 | 2 of 15 | 0 |
| $3-6 | 26 | 10 | −0.005 | +0.153 | −0.155 | 12 | 2 of 22 | 1 |
| $6-10 | 19 | 8 | +0.007 | +0.093 | −0.110 | 10 | 5 of 15 | 6 |
| $10-20 | 20 | 8 | +0.045 | +0.059 | −0.023 | 14 | 3 of 15 | 8 |
| $20 and over | 17 | 5 | +0.109 | +0.051 | +0.066 | 12 | 0 of 1 | 10 |

Rank correlation (Spearman), median-stop rows only (97 test-windows, 18 studies): stop $ vs cost R −0.83, stop $ vs gross R 0.29, stop $ vs net R 0.68. With the mean-stop rows added (127 test-windows, 23 studies): −0.87, 0.20, 0.63. No p-value is given: the rows share data, rules and windows and are not independent.

## Counts

- Test-windows gross-positive: 148 of 249; net-positive: 82; net t ≥ 2: 3.
- Gross-positive with gross t ≥ 2: 17 of 214 test-windows that report a gross t; with gross t ≥ 1.5: 32, of which 31 have a net t under 2.
- Gross-positive test-windows whose cost R is larger than their gross R (positive before costs, negative after): 65.
- Tests with gross t ≥ 2 and gross > 0 in BOTH windows: 2 of 106 tests that report a gross t in both (gold-vol-breakout T1, gold-vol-breakout T2).

## Intraday against multi-day rules

| Style | Test-windows | Studies | Median of the median stops (rows with one) | Median gross R | Median cost R | Median net R | Gross > 0 | Gross t ≥ 2 and gross > 0 (of those with a gross t) | Gross > 0 but cost > gross |
|---|---|---|---|---|---|---|---|---|---|
| intraday | 93 | 16 | $5.36 (69 rows) | +0.016 | +0.117 | −0.131 | 55 | 13 of 85 | 43 |
| multi-day | 156 | 27 | $28.14 (28 rows) | +0.021 | +0.046 | −0.014 | 93 | 4 of 129 | 22 |

Intraday = flat the same session by the study's own exit rule (16 studies); multi-day = held overnight or longer (27 studies).

## Every gross-positive test-window with gross t ≥ 1.5

| Study | Test | Window | Style | n | Gross R | Gross t | Net R | Net t | Cost R | Stop |
|---|---|---|---|---|---|---|---|---|---|---|
| gold-vol-breakout | T1 | IS | intraday | 935 | +0.111 | 2.87 | +0.009 | 0.22 | +0.102 | $6.49 |
| gold-vol-breakout | T1 | OOS | intraday | 1121 | +0.121 | 3.21 | +0.072 | 1.86 | +0.049 | $13.49 |
| gold-vol-breakout | T2 | IS | intraday | 652 | +0.120 | 3.31 | +0.040 | 1.10 | +0.080 | $8.29 |
| gold-vol-breakout | T2 | OOS | intraday | 801 | +0.099 | 2.53 | +0.061 | 1.54 | +0.038 | $17.21 |
| gold-vol-breakout | T3 | IS | intraday | 310 | +0.136 | 1.87 | +0.028 | 0.39 | +0.108 | $6.25 |
| gold-vol-breakout | T3 | OOS | intraday | 377 | +0.111 | 1.80 | +0.058 | 0.95 | +0.053 | $13.07 |
| gold-vol-breakout-replicate | R1 | single | intraday | 1657 | +0.203 | 5.96 | +0.111 | 3.19 | +0.092 | $7.76 |
| gold-comex-orb | T1 | OOS | intraday | 1407 | +0.075 | 2.43 | +0.006 | 0.20 | +0.069 | $9.19 |
| gold-comex-orb | T2 | OOS | intraday | 725 | +0.155 | 3.14 | +0.064 | 1.30 | +0.091 | $6.30 |
| gold-london-orb | T1 | IS | intraday | 2317 | +0.150 | 3.28 | −0.041 | −0.88 | +0.191 | $3.49 |
| gold-london-orb | T1 | OOS | intraday | 2542 | +0.076 | 1.77 | −0.078 | −1.78 | +0.154 | $4.59 |
| gold-london-orb | T2 | IS | intraday | 2317 | +0.068 | 2.90 | −0.122 | −5.01 | +0.190 | $3.49 |
| gold-london-orb | T2 | OOS | intraday | 2542 | +0.035 | 1.55 | −0.119 | −5.24 | +0.154 | $4.59 |
| gold-london-orb | T3 | IS | intraday | 1177 | +0.213 | 2.90 | −0.037 | −0.50 | +0.250 | $2.55 |
| gold-volume-spike | T2 | IS | intraday | 394 | +0.285 | 2.02 | −0.072 | −0.53 | +0.357 | $1.77 |
| gold-volume-spike | T3 | OOS | intraday | 339 | +0.147 | 2.06 | +0.061 | 1.02 | +0.086 | $10.21 |
| gold-silver-lead-intraday | T2 | OOS | intraday | 2990 | +0.039 | 1.60 | −0.113 | −4.37 | +0.152 | not reported |
| gold-silver-lead-intraday | T3 | IS | intraday | 2076 | +0.053 | 2.06 | −0.229 | −8.56 | +0.282 | not reported |
| gold-floor-pivots | T2 | IS | intraday | 627 | +0.074 | 1.77 | −0.061 | −1.44 | +0.135 | not reported |
| gold-squeeze | T1 | IS | multi-day | 95 | +0.353 | 1.72 | +0.230 | 1.15 | +0.123 | not reported |
| gold-turn-of-month | T1 | OOS | multi-day | 118 | +0.163 | 2.50 | +0.117 | 1.80 | +0.046 | not reported |
| gold-turn-of-month | T3 | OOS | multi-day | 118 | +0.175 | 2.10 | +0.121 | 1.46 | +0.054 | not reported |
| gold-china-holidays | T1 | OOS | multi-day | 10 | +0.295 | 1.80 | +0.224 | 1.38 | +0.071 | not reported |
| gold-record-high | T1 | IS | multi-day | 16 | +0.659 | 2.09 | +0.563 | 1.87 | +0.096 | not reported |
| gold-record-high | T2 | IS | multi-day | 22 | +0.407 | 1.73 | +0.315 | 1.39 | +0.092 | not reported |
| gold-record-high | T2 | OOS | multi-day | 30 | +0.388 | 1.58 | +0.285 | 1.21 | +0.103 | not reported |
| gold-weekly-momentum | T1 | OOS | multi-day | 513 | +0.062 | 1.99 | +0.029 | 0.95 | +0.033 | not reported |
| gold-dollar-divergence | T1 | IS | multi-day | 98 | +0.167 | 2.39 | +0.121 | 1.77 | +0.046 | mean $34.44 |
| gold-dollar-divergence | T1 | OOS | multi-day | 92 | +0.169 | 1.69 | +0.120 | 1.23 | +0.049 | mean $55.43 |
| gold-dollar-divergence | T3 | OOS | multi-day | 105 | +0.087 | 1.69 | +0.060 | 1.20 | +0.027 | mean $54.82 |
| gold-ichimoku | T2 | OOS | multi-day | 50 | +0.527 | 1.90 | +0.389 | 1.49 | +0.138 | not reported |
| gold-ichimoku | T3 | IS | multi-day | 399 | +0.163 | 1.75 | +0.087 | 0.94 | +0.076 | not reported |

## The replicated rule beside the rest

| Study | Test | Window | n | Gross R | Gross t | Net R | Net t | Cost R | Median stop |
|---|---|---|---|---|---|---|---|---|---|
| gold-vol-breakout | T1 | IS | 935 | +0.111 | 2.87 | +0.009 | 0.22 | +0.102 | $6.49 |
| gold-vol-breakout | T1 | OOS | 1121 | +0.121 | 3.21 | +0.072 | 1.86 | +0.049 | $13.49 |
| gold-vol-breakout-replicate | R1 | single | 1657 | +0.203 | 5.96 | +0.111 | 3.19 | +0.092 | $7.76 |

## Reading (plain English)

- **Costs fall with the stop, as arithmetic says they must.** The median cost a trade is +0.357R under a $3 stop, +0.153R at $3-6, +0.093R at $6-10, +0.059R at $10-20 and +0.051R at $20 and over (rank −0.83). That is a fixed dollar cost divided by a wider stop, not a finding.
- **Gross R rises only weakly with the stop** (rank 0.29). The bin medians are +0.001, −0.005, +0.007, +0.045 and +0.109R: near zero up to $10, higher in the two widest bins. The $10-20 bin mixes 13 intraday and 7 multi-day test-windows (3 reach gross t 2); the $20 and over bin is 17 multi-day test-windows of 5 studies held for days, of which 1 reports a gross t and 0 reach gross t 2, so its higher median rests on figures whose noise is not known. Intraday and multi-day rules have about the same median gross R (+0.016 and +0.021R); they differ in cost (+0.117 against +0.046R) and so in net (−0.131 against −0.014R).
- **"Positive before costs, lost to costs" is real but narrow.** 65 of 148 gross-positive test-windows are made negative by their cost (43 intraday, 22 multi-day), but most of these are small gross figures with gross t well under 2. Of the 32 gross-positive test-windows with gross t ≥ 1.5, 9 are made zero or negative by cost (gold-london-orb, gold-volume-spike, gold-silver-lead-intraday, gold-floor-pivots); every one of them that reports a median stop (6) has it between $1.77 and $4.59. The other 23 stay positive after cost but, apart from the replication, under net t 2: there the cost is small and the gross t was not 2 to begin with, or was cut under 2.
- **Many never had a gross effect to lose**:101 of 249 test-windows are flat or negative before any cost, at every stop size, and 197 of the 214 with a gross t do not reach gross t 2. Only 2 tests reach gross t 2 in both windows, and both are the same rule family (gold-vol-breakout T1, gold-vol-breakout T2).
- **The replicated rule stands out by its gross R more than by its stop.** gold-vol-breakout T1 had a median stop of $6.49 in 2016-20 (cost +0.102R, net +0.009R) and $13.49 in 2021-now (cost +0.049R, net +0.072R); its 2007-15 replication had $7.76 (cost +0.092R) and kept +0.111R net because its gross was +0.203R (gross t 5.96). Its stops sit in the middle of the table (the intraday median is $5.36); its consistent gross R is what sets it apart.
- **So the story holds in part.** Tight stops did turn a handful of real-looking gross effects (the London first-hour breakout above all) into losses, and a wider stop makes any given gross R cheaper to trade. But a wide stop does not create gross R, most of these rules had none, and this table cannot say whether any rule would survive with a wider stop: changing the stop changes the rule, and that is a new test with its own pre-registration, not a reading of this one.

## Limits

- The studies used different windows (2016-20 | 2021-now for most intraday M5 rules, 2008-16 | 2017-26 for most daily ones, single windows for the two replications and the CPI study), different costs ($0.30 to $0.60 a round trip; financing on buys in some, none in others) and different definitions of 1R. A row of one study is not comparable to a row of another in more than a rough way.
- The tests are not independent: several are variants of one rule on the same days, some tests are subsets of others (gold-hourly-shock T3 is the non-release part of its T1), and every study reads the same gold history. The counts are counts of test-windows, not of independent pieces of evidence, and no p-value or pass / fail is attached to them.
- A fixed dollar cost divided by the stop makes cost R fall as the stop widens by arithmetic. The stop-cost correlation is that arithmetic; it is not a finding about markets.
- Gold's price rose a long way across these windows, so the same rule's stop in $ is wider in the later window than in the earlier one (gold-vol-breakout T1: $6.49 then $13.49). Stop $ and period are entangled in these rows.
- Most daily rules report their stop as an ATR multiple only, so they are missing from the $ bins; the bins mostly hold intraday rules.
- **Picking "wide stops" after seeing this table is itself data mining.** Any rule built on it needs its own pre-registration on data none of these 44 studies used, and little untouched gold history is left.

## Every test-window

| Study | Test | Window | TF | n | Gross R | Net R | Gross t | Net t | Cost R (gross − net) | Cost stored | Stop | Hold |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gold-vol-breakout | T1 k 0.5, both sides | IS | M5 intraday | 935 | +0.111 | +0.009 | 2.87 | 0.22 | +0.102 | +0.102 | $6.49 | to 21:00 UTC the same day |
| gold-vol-breakout | T1 k 0.5, both sides | OOS | M5 intraday | 1121 | +0.121 | +0.072 | 3.21 | 1.86 | +0.049 | +0.049 | $13.49 | to 21:00 UTC the same day |
| gold-vol-breakout | T2 k 0.7, both sides | IS | M5 intraday | 652 | +0.120 | +0.040 | 3.31 | 1.10 | +0.080 | +0.079 | $8.29 | to 21:00 UTC the same day |
| gold-vol-breakout | T2 k 0.7, both sides | OOS | M5 intraday | 801 | +0.099 | +0.061 | 2.53 | 1.54 | +0.038 | +0.038 | $17.21 | to 21:00 UTC the same day |
| gold-vol-breakout | T3 k 0.5, buys only, previous D1 close above its 20-day mean | IS | M5 intraday | 310 | +0.136 | +0.028 | 1.87 | 0.39 | +0.108 | +0.108 | $6.25 | to 21:00 UTC the same day |
| gold-vol-breakout | T3 k 0.5, buys only, previous D1 close above its 20-day mean | OOS | M5 intraday | 377 | +0.111 | +0.058 | 1.80 | 0.95 | +0.053 | +0.053 | $13.07 | to 21:00 UTC the same day |
| gold-vol-breakout-replicate | R1 T1 rule on untouched 2007-15 | single | M5 intraday | 1657 | +0.203 | +0.111 | 5.96 | 3.19 | +0.092 | +0.092 | $7.76 | to 21:00 UTC the same day |
| gold-comex-orb | T1 Breakout, stop at the opposite side, 2R | IS | M5 intraday | 1183 | −0.002 | −0.155 | −0.08 | −5.05 | +0.153 | +0.153 | $4.13 | flat by 12:00 New York |
| gold-comex-orb | T1 Breakout, stop at the opposite side, 2R | OOS | M5 intraday | 1407 | +0.075 | +0.006 | 2.43 | 0.20 | +0.069 | +0.069 | $9.19 | flat by 12:00 New York |
| gold-comex-orb | T2 T1 on a range under its 20-day median width | IS | M5 intraday | 600 | +0.036 | −0.161 | 0.78 | −3.27 | +0.197 | +0.197 | $3.00 | flat by 12:00 New York |
| gold-comex-orb | T2 T1 on a range under its 20-day median width | OOS | M5 intraday | 725 | +0.155 | +0.064 | 3.14 | 1.30 | +0.091 | +0.091 | $6.30 | flat by 12:00 New York |
| gold-comex-orb | T3 Fade of the first break, stop past its extreme, 1R | IS | M5 intraday | 1147 | −0.354 | −6.087 | −11.47 | −6.53 | +5.733 | +5.734 | $0.38 | flat by 12:00 New York |
| gold-comex-orb | T3 Fade of the first break, stop past its extreme, 1R | OOS | M5 intraday | 1359 | −0.480 | −3.235 | −15.79 | −12.94 | +2.755 | +2.755 | $0.59 | flat by 12:00 New York |
| gold-london-orb | T1 Breakout, stop at the opposite side, out at 20:00 UTC | IS | M5 intraday | 2317 | +0.150 | −0.041 | 3.28 | −0.88 | +0.191 | +0.190 | $3.49 | out at 20:00 UTC |
| gold-london-orb | T1 Breakout, stop at the opposite side, out at 20:00 UTC | OOS | M5 intraday | 2542 | +0.076 | −0.078 | 1.77 | −1.78 | +0.154 | +0.154 | $4.59 | out at 20:00 UTC |
| gold-london-orb | T2 T1 with a 1.5R target | IS | M5 intraday | 2317 | +0.068 | −0.122 | 2.90 | −5.01 | +0.190 | +0.190 | $3.49 | out at 20:00 UTC |
| gold-london-orb | T2 T1 with a 1.5R target | OOS | M5 intraday | 2542 | +0.035 | −0.119 | 1.55 | −5.24 | +0.154 | +0.154 | $4.59 | out at 20:00 UTC |
| gold-london-orb | T3 T1 on a range under its 20-day median width | IS | M5 intraday | 1177 | +0.213 | −0.037 | 2.90 | −0.50 | +0.250 | +0.249 | $2.55 | out at 20:00 UTC |
| gold-london-orb | T3 T1 on a range under its 20-day median width | OOS | M5 intraday | 1260 | +0.071 | −0.127 | 1.01 | −1.80 | +0.198 | +0.199 | $3.51 | out at 20:00 UTC |
| gold-london-reversal | T1 fade London at 09:30 | IS | M5 intraday | 319 | −0.018 | −0.224 | −0.24 | −3.11 | +0.206 | +0.206 | $3.41 | flat at 16:00 New York |
| gold-london-reversal | T1 fade London at 09:30 | OOS | M5 intraday | 352 | −0.064 | −0.164 | −0.87 | −2.22 | +0.100 | +0.100 | $7.78 | flat at 16:00 New York |
| gold-london-reversal | T2 T1 on the midnight open's side | IS | M5 intraday | 301 | −0.036 | −0.249 | −0.47 | −3.29 | +0.213 | +0.213 | $3.29 | flat at 16:00 New York |
| gold-london-reversal | T2 T1 on the midnight open's side | OOS | M5 intraday | 322 | −0.086 | −0.191 | −1.05 | −2.34 | +0.105 | +0.105 | $7.34 | flat at 16:00 New York |
| gold-london-reversal | T3 after a New York raid of the London extreme | IS | M5 intraday | 137 | +0.001 | −0.244 | 0.01 | −1.83 | +0.245 | +0.245 | $2.72 | flat at 16:00 New York |
| gold-london-reversal | T3 after a New York raid of the London extreme | OOS | M5 intraday | 155 | −0.267 | −0.380 | −2.69 | −3.82 | +0.113 | +0.114 | $5.93 | flat at 16:00 New York |
| gold-pdhl-break | T1 no target, out at 20:00 UTC | IS | M15 intraday | 939 | +0.027 | −0.090 | 0.76 | −2.44 | +0.117 | +0.116 | $5.36 | out at 20:00 UTC |
| gold-pdhl-break | T1 no target, out at 20:00 UTC | OOS | M15 intraday | 1120 | +0.033 | −0.026 | 0.83 | −0.64 | +0.059 | +0.059 | $10.37 | out at 20:00 UTC |
| gold-pdhl-break | T2 target 1.5R, else out at 20:00 UTC | IS | M15 intraday | 939 | −0.019 | −0.135 | −0.59 | −4.04 | +0.116 | +0.116 | $5.36 | out at 20:00 UTC |
| gold-pdhl-break | T2 target 1.5R, else out at 20:00 UTC | OOS | M15 intraday | 1120 | −0.003 | −0.062 | −0.10 | −1.94 | +0.059 | +0.059 | $10.37 | out at 20:00 UTC |
| gold-pdhl-break | T3 T1 on the side of the 20-day average | IS | M15 intraday | 531 | +0.026 | −0.090 | 0.46 | −1.54 | +0.116 | +0.116 | $5.39 | out at 20:00 UTC |
| gold-pdhl-break | T3 T1 on the side of the 20-day average | OOS | M15 intraday | 633 | +0.057 | −0.001 | 1.25 | −0.02 | +0.058 | +0.058 | $10.39 | out at 20:00 UTC |
| ict-silver-bullet-gold | T1 AM 10:00-11:00 | IS | M5 intraday | 360 | −0.036 | −0.253 | −0.51 | −3.42 | +0.217 | +0.216 | $1.51 | intraday, flat the same session |
| ict-silver-bullet-gold | T1 AM 10:00-11:00 | OOS | M5 intraday | 401 | −0.078 | −0.168 | −0.98 | −2.13 | +0.090 | +0.090 | $3.72 | intraday, flat the same session |
| ict-silver-bullet-gold | T2 PM 14:00-15:00 | IS | M5 intraday | 351 | +0.038 | −0.377 | 0.45 | −4.35 | +0.415 | +0.414 | $0.86 | intraday, flat the same session |
| ict-silver-bullet-gold | T2 PM 14:00-15:00 | OOS | M5 intraday | 490 | −0.058 | −0.311 | −1.16 | −5.49 | +0.253 | +0.253 | $1.39 | intraday, flat the same session |
| ict-silver-bullet-gold | T3 London 03:00-04:00 | IS | M5 intraday | 148 | +0.046 | −0.289 | 0.47 | −2.56 | +0.335 | +0.335 | $0.99 | intraday, flat the same session |
| ict-silver-bullet-gold | T3 London 03:00-04:00 | OOS | M5 intraday | 191 | −0.073 | −0.224 | −0.69 | −2.15 | +0.151 | +0.151 | $2.43 | intraday, flat the same session |
| mmxm-pdhl-raid-gold | T1 previous-day high / low raid model | IS | M15 intraday | 5 | −0.324 | −0.400 | not reported | −1.05 | +0.076 | not reported | $3.81 | flat at 16:00 ET |
| mmxm-pdhl-raid-gold | T1 previous-day high / low raid model | OOS | M15 intraday | 7 | −0.081 | −0.131 | not reported | −0.32 | +0.050 | not reported | $6.10 | flat at 16:00 ET |
| mmxm-pdhl-raid-gold | T2 variant T2 | IS | M15 intraday | 5 | −0.324 | −0.400 | not reported | −1.05 | +0.076 | not reported | $3.81 | flat at 16:00 ET |
| mmxm-pdhl-raid-gold | T2 variant T2 | OOS | M15 intraday | 8 | −0.196 | −0.246 | not reported | −0.65 | +0.050 | not reported | $6.10 | flat at 16:00 ET |
| mmxm-pdhl-raid-gold | T3 variant T3 | IS | M15 intraday | 5 | −0.342 | −0.451 | not reported | −0.99 | +0.109 | not reported | $3.02 | flat at 16:00 ET |
| mmxm-pdhl-raid-gold | T3 variant T3 | OOS | M15 intraday | 3 | −0.298 | −0.367 | not reported | −0.59 | +0.069 | not reported | $3.66 | flat at 16:00 ET |
| mmxm-pdhl-raid-gold | T4 variant T4 | IS | M15 intraday | 2 | −0.698 | −0.759 | not reported | −1.34 | +0.061 | not reported | $6.75 | flat at 16:00 ET |
| mmxm-pdhl-raid-gold | T4 variant T4 | OOS | M15 intraday | 4 | −0.544 | −0.599 | not reported | −1.59 | +0.055 | not reported | $6.10 | flat at 16:00 ET |
| gold-late-ny | T1 Follow the late-NY move into Asia (every signal day) | IS | M5 intraday | 1229 | +0.016 | −0.077 | 0.85 | −4.23 | +0.093 | not reported | $6.10 | 18:00-02:00 New York |
| gold-late-ny | T1 Follow the late-NY move into Asia (every signal day) | OOS | M5 intraday | 1445 | +0.002 | −0.045 | 0.11 | −2.57 | +0.047 | not reported | $12.03 | 18:00-02:00 New York |
| gold-late-ny | T2 Follow, sizeable late-NY moves only (|move| > 0.5x its 20-day mean size) | IS | M5 intraday | 756 | +0.006 | −0.087 | 0.29 | −3.99 | +0.093 | not reported | $6.09 | 18:00-02:00 New York |
| gold-late-ny | T2 Follow, sizeable late-NY moves only (|move| > 0.5x its 20-day mean size) | OOS | M5 intraday | 906 | +0.019 | −0.029 | 0.83 | −1.27 | +0.048 | not reported | $11.99 | 18:00-02:00 New York |
| gold-late-ny | T3 Fade the late-NY move in Asia (every signal day) | IS | M5 intraday | 1229 | −0.017 | −0.110 | −0.98 | −5.70 | +0.093 | not reported | $6.10 | 18:00-02:00 New York |
| gold-late-ny | T3 Fade the late-NY move in Asia (every signal day) | OOS | M5 intraday | 1445 | −0.018 | −0.065 | −0.97 | −3.46 | +0.047 | not reported | $12.03 | 18:00-02:00 New York |
| gold-gap-open | T1 Fade the gap in Asia (18:05 -> 02:00, target the 17:00 close) | IS | M5 intraday | 107 | +0.016 | −0.118 | 0.30 | −1.98 | +0.134 | not reported | $3.43 | out at 02:00 New York |
| gold-gap-open | T1 Fade the gap in Asia (18:05 -> 02:00, target the 17:00 close) | OOS | M5 intraday | 142 | −0.027 | −0.077 | −0.55 | −1.52 | +0.050 | not reported | $12.15 | out at 02:00 New York |
| gold-gap-open | T2 Follow the gap to 02:00 (18:05 -> 02:00, no target) | IS | M5 intraday | 146 | −0.044 | −0.210 | −0.52 | −2.47 | +0.166 | not reported | $3.44 | out at 02:00 New York |
| gold-gap-open | T2 Follow the gap to 02:00 (18:05 -> 02:00, no target) | OOS | M5 intraday | 143 | +0.026 | −0.034 | 0.25 | −0.32 | +0.060 | not reported | $11.54 | out at 02:00 New York |
| gold-gap-open | T3 NDOG midpoint as a London magnet (03:00 -> 08:00, target the midpoint) | IS | M5 intraday | 10 | +0.181 | +0.028 | 0.67 | 0.10 | +0.153 | not reported | $3.28 | out at 02:00 New York |
| gold-gap-open | T3 NDOG midpoint as a London magnet (03:00 -> 08:00, target the midpoint) | OOS | M5 intraday | 14 | +0.127 | +0.056 | 0.55 | 0.25 | +0.071 | not reported | $10.67 | out at 02:00 New York |
| gold-volume-spike | T1 continuation | IS | H1 / M5 intraday | 841 | −0.009 | −0.155 | −0.25 | −3.89 | +0.146 | not reported | $5.61 | out after 4 hours |
| gold-volume-spike | T1 continuation | OOS | H1 / M5 intraday | 515 | +0.061 | −0.054 | 0.79 | −0.85 | +0.115 | not reported | $8.36 | out after 4 hours |
| gold-volume-spike | T2 reversal against an outer-quarter close | IS | H1 / M5 intraday | 394 | +0.285 | −0.072 | 2.02 | −0.53 | +0.357 | not reported | $1.77 | out after 4 hours |
| gold-volume-spike | T2 reversal against an outer-quarter close | OOS | H1 / M5 intraday | 307 | −0.050 | −0.363 | −0.44 | −2.65 | +0.313 | not reported | $2.13 | out after 4 hours |
| gold-volume-spike | T3 with an outer-quarter close | IS | H1 / M5 intraday | 531 | −0.062 | −0.172 | −2.03 | −4.86 | +0.110 | not reported | $6.90 | out after 4 hours |
| gold-volume-spike | T3 with an outer-quarter close | OOS | H1 / M5 intraday | 339 | +0.147 | +0.061 | 2.06 | 1.02 | +0.086 | not reported | $10.21 | out after 4 hours |
| gold-hourly-shock | T1 fade (against the shock, target the 50%) | IS | H1 intraday | 1041 | −0.020 | −0.422 | −0.37 | −7.48 | +0.402 | not reported | $2.22 | out at the 6th H1 candle's close |
| gold-hourly-shock | T1 fade (against the shock, target the 50%) | OOS | H1 intraday | 1051 | +0.069 | −0.349 | 1.10 | −5.56 | +0.418 | not reported | $2.11 | out at the 6th H1 candle's close |
| gold-hourly-shock | T2 follow (with the shock, stop at the 50%) | IS | H1 intraday | 933 | +0.085 | −0.071 | 1.43 | −1.16 | +0.156 | not reported | $4.47 | out at the 6th H1 candle's close |
| gold-hourly-shock | T2 follow (with the shock, stop at the 50%) | OOS | H1 intraday | 937 | +0.029 | −0.103 | 0.53 | −1.88 | +0.132 | not reported | $5.92 | out at the 6th H1 candle's close |
| gold-hourly-shock | T3 fade, non-release shocks only | IS | H1 intraday | 966 | +0.004 | −0.404 | 0.06 | −6.89 | +0.408 | not reported | $2.15 | out at the 6th H1 candle's close |
| gold-hourly-shock | T3 fade, non-release shocks only | OOS | H1 intraday | 949 | +0.084 | −0.345 | 1.29 | −5.21 | +0.429 | not reported | $1.99 | out at the 6th H1 candle's close |
| gold-silver-lead-intraday | T1 follow a silver shock gold lags, 30 min | IS | M5 intraday | 2653 | +0.009 | −0.272 | 0.52 | −12.10 | +0.281 | not reported | not reported (rule: 1 x the 28-day mean 30-minute gold range (whole-study median $3.02, RESULT.md)) | 30 minutes (T2: 60) |
| gold-silver-lead-intraday | T1 follow a silver shock gold lags, 30 min | OOS | M5 intraday | 3295 | +0.027 | −0.125 | 1.44 | −6.16 | +0.152 | not reported | not reported (rule: 1 x the 28-day mean 30-minute gold range (whole-study median $3.02, RESULT.md)) | 30 minutes (T2: 60) |
| gold-silver-lead-intraday | T2 same, 60 min | IS | M5 intraday | 2401 | +0.034 | −0.248 | 1.29 | −8.66 | +0.282 | not reported | not reported (rule: 1 x the 28-day mean 30-minute gold range (whole-study median $3.02, RESULT.md)) | 30 minutes (T2: 60) |
| gold-silver-lead-intraday | T2 same, 60 min | OOS | M5 intraday | 2990 | +0.039 | −0.113 | 1.60 | −4.37 | +0.152 | not reported | not reported (rule: 1 x the 28-day mean 30-minute gold range (whole-study median $3.02, RESULT.md)) | 30 minutes (T2: 60) |
| gold-silver-lead-intraday | T3 variant T3, 30 min | IS | M5 intraday | 2076 | +0.053 | −0.229 | 2.06 | −8.56 | +0.282 | not reported | not reported (rule: 1 x the 28-day mean 30-minute gold range (whole-study median $3.02, RESULT.md)) | 30 minutes (T2: 60) |
| gold-silver-lead-intraday | T3 variant T3, 30 min | OOS | M5 intraday | 2848 | +0.020 | −0.127 | 1.02 | −5.99 | +0.147 | not reported | not reported (rule: 1 x the 28-day mean 30-minute gold range (whole-study median $3.02, RESULT.md)) | 30 minutes (T2: 60) |
| gold-round-numbers | T1 stall at $100 (limit) | IS | M5 intraday | 123 | −0.258 | −0.361 | −2.24 | −3.03 | +0.103 | not reported | not reported (rule: 0.25 x ATR(14) (T1), 0.1 x ATR (T3) past the $100 level) | flat before the 17:00 NY rollover |
| gold-round-numbers | T1 stall at $100 (limit) | OOS | M5 intraday | 344 | −0.053 | −0.090 | −0.81 | −1.37 | +0.037 | not reported | not reported (rule: 0.25 x ATR(14) (T1), 0.1 x ATR (T3) past the $100 level) | flat before the 17:00 NY rollover |
| gold-round-numbers | T2 variant T2 | IS | M5 intraday | 112 | −0.134 | −0.231 | −1.32 | −2.23 | +0.097 | not reported | not reported (rule: 0.25 x ATR(14) (T1), 0.1 x ATR (T3) past the $100 level) | flat before the 17:00 NY rollover |
| gold-round-numbers | T2 variant T2 | OOS | M5 intraday | 348 | −0.180 | −0.219 | −2.39 | −2.87 | +0.039 | not reported | not reported (rule: 0.25 x ATR(14) (T1), 0.1 x ATR (T3) past the $100 level) | flat before the 17:00 NY rollover |
| gold-round-numbers | T3 break of $100 | IS | M5 intraday | 221 | +0.149 | −0.028 | 1.38 | −0.25 | +0.177 | not reported | not reported (rule: 0.25 x ATR(14) (T1), 0.1 x ATR (T3) past the $100 level) | flat before the 17:00 NY rollover |
| gold-round-numbers | T3 break of $100 | OOS | M5 intraday | 615 | +0.007 | −0.062 | 0.09 | −0.83 | +0.069 | not reported | not reported (rule: 0.25 x ATR(14) (T1), 0.1 x ATR (T3) past the $100 level) | flat before the 17:00 NY rollover |
| gold-vwap | T1 fade a 2 sd close to VWAP | IS | M5 intraday | 599 | +0.083 | −0.252 | 1.30 | −3.91 | +0.335 | not reported | not reported (rule: 3 sd band (fade), 1 sd band (follow, pullback); at least $1) | out by 16:00 New York |
| gold-vwap | T1 fade a 2 sd close to VWAP | OOS | M5 intraday | 1061 | −0.079 | −0.310 | −1.33 | −4.97 | +0.231 | not reported | not reported (rule: 3 sd band (fade), 1 sd band (follow, pullback); at least $1) | out by 16:00 New York |
| gold-vwap | T2 follow | IS | M5 intraday | 1011 | +0.072 | −0.228 | 1.00 | −3.08 | +0.300 | not reported | not reported (rule: 3 sd band (fade), 1 sd band (follow, pullback); at least $1) | out by 16:00 New York |
| gold-vwap | T2 follow | OOS | M5 intraday | 1345 | +0.038 | −0.138 | 0.56 | −1.96 | +0.176 | not reported | not reported (rule: 3 sd band (fade), 1 sd band (follow, pullback); at least $1) | out by 16:00 New York |
| gold-vwap | T3 pullback limit | IS | M5 intraday | 920 | −0.059 | −0.256 | −1.59 | −6.60 | +0.197 | not reported | not reported (rule: 3 sd band (fade), 1 sd band (follow, pullback); at least $1) | out by 16:00 New York |
| gold-vwap | T3 pullback limit | OOS | M5 intraday | 1177 | +0.006 | −0.113 | 0.18 | −3.07 | +0.119 | not reported | not reported (rule: 3 sd band (fade), 1 sd band (follow, pullback); at least $1) | out by 16:00 New York |
| gold-floor-pivots | T1 fade R1 / S1 | IS | M5 intraday | 693 | −0.011 | −0.169 | −0.28 | −4.17 | +0.158 | not reported | not reported (rule: 0.25 x ATR20 (T1, T2), 0.2 x ATR20 (T3)) | flat by 20:00 UTC |
| gold-floor-pivots | T1 fade R1 / S1 | OOS | M5 intraday | 796 | −0.071 | −0.151 | −1.84 | −3.83 | +0.080 | not reported | not reported (rule: 0.25 x ATR20 (T1, T2), 0.2 x ATR20 (T3)) | flat by 20:00 UTC |
| gold-floor-pivots | T2 break of R1 / S1, held to 20:00 | IS | M5 intraday | 627 | +0.074 | −0.061 | 1.77 | −1.44 | +0.135 | not reported | not reported (rule: 0.25 x ATR20 (T1, T2), 0.2 x ATR20 (T3)) | flat by 20:00 UTC |
| gold-floor-pivots | T2 break of R1 / S1, held to 20:00 | OOS | M5 intraday | 744 | +0.018 | −0.050 | 0.37 | −1.03 | +0.068 | not reported | not reported (rule: 0.25 x ATR20 (T1, T2), 0.2 x ATR20 (T3)) | flat by 20:00 UTC |
| gold-floor-pivots | T3 variant T3 | IS | M5 intraday | 504 | +0.028 | −0.169 | 0.45 | −2.60 | +0.197 | not reported | not reported (rule: 0.25 x ATR20 (T1, T2), 0.2 x ATR20 (T3)) | flat by 20:00 UTC |
| gold-floor-pivots | T3 variant T3 | OOS | M5 intraday | 596 | +0.023 | −0.081 | 0.43 | −1.48 | +0.104 | not reported | not reported (rule: 0.25 x ATR20 (T1, T2), 0.2 x ATR20 (T3)) | flat by 20:00 UTC |
| gold-ote-retrace | T1 limit at 0.705 of an H1 break leg | IS | H1 / M5 | 628 | −0.034 | −0.279 | −0.64 | −5.12 | +0.245 | not reported | not reported (rule: $0.30 beyond the leg origin) | out after 72 H1 candles |
| gold-ote-retrace | T1 limit at 0.705 of an H1 break leg | OOS | H1 / M5 | 740 | −0.094 | −0.230 | −1.44 | −3.42 | +0.136 | not reported | not reported (rule: $0.30 beyond the leg origin) | out after 72 H1 candles |
| gold-ote-retrace | T2 variant T2 | IS | H1 / M5 | 589 | −0.062 | −0.308 | −1.02 | −5.00 | +0.246 | not reported | not reported (rule: $0.30 beyond the leg origin) | out after 72 H1 candles |
| gold-ote-retrace | T2 variant T2 | OOS | H1 / M5 | 707 | −0.092 | −0.229 | −1.23 | −2.98 | +0.137 | not reported | not reported (rule: $0.30 beyond the leg origin) | out after 72 H1 candles |
| gold-ote-retrace | T3 variant T3 | IS | H1 / M5 | 401 | +0.012 | −0.241 | 0.19 | −3.67 | +0.253 | not reported | not reported (rule: $0.30 beyond the leg origin) | out after 72 H1 candles |
| gold-ote-retrace | T3 variant T3 | OOS | H1 / M5 | 485 | −0.038 | −0.182 | −0.44 | −2.13 | +0.144 | not reported | not reported (rule: $0.30 beyond the leg origin) | out after 72 H1 candles |
| gold-squeeze | T1 H4 squeeze release | IS | H4 / D1 | 95 | +0.353 | +0.230 | 1.72 | 1.15 | +0.123 | not reported | not reported (rule: 1.5 x ATR(20)) | up to 30 H4 / 20 D1 candles (median 12-15 candles held) |
| gold-squeeze | T1 H4 squeeze release | OOS | H4 / D1 | 108 | −0.016 | −0.086 | −0.10 | −0.58 | +0.070 | not reported | not reported (rule: 1.5 x ATR(20)) | up to 30 H4 / 20 D1 candles (median 12-15 candles held) |
| gold-squeeze | T2 D1 squeeze release | IS | H4 / D1 | 15 | −0.091 | −0.190 | −0.26 | −0.56 | +0.099 | not reported | not reported (rule: 1.5 x ATR(20)) | up to 30 H4 / 20 D1 candles (median 12-15 candles held) |
| gold-squeeze | T2 D1 squeeze release | OOS | H4 / D1 | 17 | −0.391 | −0.479 | −1.49 | −1.81 | +0.088 | not reported | not reported (rule: 1.5 x ATR(20)) | up to 30 H4 / 20 D1 candles (median 12-15 candles held) |
| gold-squeeze | T3 H4 with the slope filter | IS | H4 / D1 | 54 | +0.409 | +0.284 | 1.44 | 1.03 | +0.125 | not reported | not reported (rule: 1.5 x ATR(20)) | up to 30 H4 / 20 D1 candles (median 12-15 candles held) |
| gold-squeeze | T3 H4 with the slope filter | OOS | H4 / D1 | 68 | −0.158 | −0.231 | −0.89 | −1.31 | +0.073 | not reported | not reported (rule: 1.5 x ATR(20)) | up to 30 H4 / 20 D1 candles (median 12-15 candles held) |
| gold-regime-switch | T1 ER regime switch | IS | D1 | 330 | +0.103 | −0.005 | 1.02 | −0.05 | +0.108 | not reported | not reported (rule: 1.5 x ATR(14)) | 30-candle time exit (median 6-13 held) |
| gold-regime-switch | T1 ER regime switch | OOS | D1 | 400 | −0.031 | −0.094 | −0.39 | −1.19 | +0.063 | not reported | not reported (rule: 1.5 x ATR(14)) | 30-candle time exit (median 6-13 held) |
| gold-regime-switch | T2 breakout leg | IS | D1 | 181 | +0.222 | +0.100 | 1.37 | 0.63 | +0.122 | not reported | not reported (rule: 1.5 x ATR(14)) | 30-candle time exit (median 6-13 held) |
| gold-regime-switch | T2 breakout leg | OOS | D1 | 215 | +0.055 | −0.020 | 0.38 | −0.14 | +0.075 | not reported | not reported (rule: 1.5 x ATR(14)) | 30-candle time exit (median 6-13 held) |
| gold-regime-switch | T3 fade leg | IS | D1 | 164 | −0.039 | −0.129 | −0.45 | −1.48 | +0.090 | not reported | not reported (rule: 1.5 x ATR(14)) | 30-candle time exit (median 6-13 held) |
| gold-regime-switch | T3 fade leg | OOS | D1 | 199 | −0.125 | −0.177 | −1.66 | −2.34 | +0.052 | not reported | not reported (rule: 1.5 x ATR(14)) | 30-candle time exit (median 6-13 held) |
| gold-comex-calendar | T1 short into options expiry | IS | D1 | 108 | +0.001 | −0.014 | 0.02 | −0.21 | +0.015 | not reported | not reported (rule: 2 x ATR(20)) | 5 days, daily closes |
| gold-comex-calendar | T1 short into options expiry | OOS | D1 | 118 | −0.116 | −0.130 | −1.91 | −2.13 | +0.014 | not reported | not reported (rule: 2 x ATR(20)) | 5 days, daily closes |
| gold-comex-calendar | T2 variant T2 | IS | D1 | 108 | +0.016 | −0.033 | 0.25 | −0.50 | +0.049 | not reported | not reported (rule: 2 x ATR(20)) | 5 days, daily closes |
| gold-comex-calendar | T2 variant T2 | OOS | D1 | 118 | +0.104 | +0.050 | 1.39 | 0.67 | +0.054 | not reported | not reported (rule: 2 x ATR(20)) | 5 days, daily closes |
| gold-comex-calendar | T3 variant T3 | IS | D1 | 54 | +0.020 | +0.005 | 0.25 | 0.06 | +0.015 | not reported | not reported (rule: 2 x ATR(20)) | 5 days, daily closes |
| gold-comex-calendar | T3 variant T3 | OOS | D1 | 59 | −0.030 | −0.044 | −0.32 | −0.47 | +0.014 | not reported | not reported (rule: 2 x ATR(20)) | 5 days, daily closes |
| gold-turn-of-month | T1 long TD-2 to TD+3 | IS | D1 | 108 | +0.042 | 0.000 | 0.64 | 0.01 | +0.042 | not reported | not reported (rule: 2 x ATR(20)) | TD-2 to TD+3 (5 days) |
| gold-turn-of-month | T1 long TD-2 to TD+3 | OOS | D1 | 118 | +0.163 | +0.117 | 2.50 | 1.80 | +0.046 | not reported | not reported (rule: 2 x ATR(20)) | TD-2 to TD+3 (5 days) |
| gold-turn-of-month | T2 variant T2 | IS | D1 | 108 | +0.040 | +0.025 | 0.84 | 0.52 | +0.015 | not reported | not reported (rule: 2 x ATR(20)) | TD-2 to TD+3 (5 days) |
| gold-turn-of-month | T2 variant T2 | OOS | D1 | 118 | +0.018 | +0.005 | 0.34 | 0.09 | +0.013 | not reported | not reported (rule: 2 x ATR(20)) | TD-2 to TD+3 (5 days) |
| gold-turn-of-month | T3 variant T3 | IS | D1 | 108 | +0.062 | +0.015 | 0.88 | 0.21 | +0.047 | not reported | not reported (rule: 2 x ATR(20)) | TD-2 to TD+3 (5 days) |
| gold-turn-of-month | T3 variant T3 | OOS | D1 | 118 | +0.175 | +0.121 | 2.10 | 1.46 | +0.054 | not reported | not reported (rule: 2 x ATR(20)) | TD-2 to TD+3 (5 days) |
| gold-china-holidays | T1 Lunar New Year, 10 days before the closure (claim a) | IS | D1 | 9 | +0.169 | +0.116 | 0.62 | 0.43 | +0.053 | +0.011 | not reported (rule: 3 x ATR(20)) | 10 trading days around the Lunar New Year |
| gold-china-holidays | T1 Lunar New Year, 10 days before the closure (claim a) | OOS | D1 | 10 | +0.295 | +0.224 | 1.80 | 1.38 | +0.071 | +0.011 | not reported (rule: 3 x ATR(20)) | 10 trading days around the Lunar New Year |
| gold-china-holidays | T2 Lunar New Year, while Shanghai is shut (claim b predicts <= 0) | IS | D1 | 9 | +0.329 | +0.298 | 1.48 | 1.34 | +0.031 | +0.010 | not reported (rule: 3 x ATR(20)) | 10 trading days around the Lunar New Year |
| gold-china-holidays | T2 Lunar New Year, while Shanghai is shut (claim b predicts <= 0) | OOS | D1 | 10 | +0.125 | +0.085 | 0.68 | 0.47 | +0.040 | +0.010 | not reported (rule: 3 x ATR(20)) | 10 trading days around the Lunar New Year |
| gold-china-holidays | T3 Lunar New Year, 5 days after the reopening (claim c) | IS | D1 | 9 | −0.031 | −0.060 | −0.19 | −0.37 | +0.029 | +0.010 | not reported (rule: 3 x ATR(20)) | 10 trading days around the Lunar New Year |
| gold-china-holidays | T3 Lunar New Year, 5 days after the reopening (claim c) | OOS | D1 | 10 | +0.151 | +0.112 | 0.95 | 0.71 | +0.039 | +0.010 | not reported (rule: 3 x ATR(20)) | 10 trading days around the Lunar New Year |
| gold-china-holidays | T4 Golden Week, the three windows pooled (secondary) | IS | D1 | 27 | +0.133 | +0.093 | 1.10 | 0.77 | +0.040 | +0.011 | not reported (rule: 3 x ATR(20)) | 10 trading days around the Lunar New Year |
| gold-china-holidays | T4 Golden Week, the three windows pooled (secondary) | OOS | D1 | 30 | +0.106 | +0.062 | 0.86 | 0.51 | +0.043 | +0.009 | not reported (rule: 3 x ATR(20)) | 10 trading days around the Lunar New Year |
| gold-record-high | T1 Long after an all-time closing high (primary) | IS | D1 | 16 | +0.659 | +0.563 | 2.09 | 1.87 | +0.096 | +0.011 | not reported (rule: 3 x ATR(20)) | 20 days |
| gold-record-high | T1 Long after an all-time closing high (primary) | OOS | D1 | 17 | +0.412 | +0.319 | 1.15 | 0.93 | +0.093 | +0.006 | not reported (rule: 3 x ATR(20)) | 20 days |
| gold-record-high | T2 Long after a 52-week closing high | IS | D1 | 22 | +0.407 | +0.315 | 1.73 | 1.39 | +0.092 | +0.011 | not reported (rule: 3 x ATR(20)) | 20 days |
| gold-record-high | T2 Long after a 52-week closing high | OOS | D1 | 30 | +0.388 | +0.285 | 1.58 | 1.21 | +0.103 | +0.008 | not reported (rule: 3 x ATR(20)) | 20 days |
| gold-record-high | T3 Short (fade) after a 52-week closing high | IS | D1 | 30 | −0.290 | −0.301 | −1.51 | −1.55 | +0.011 | +0.011 | not reported (rule: 3 x ATR(20)) | 20 days |
| gold-record-high | T3 Short (fade) after a 52-week closing high | OOS | D1 | 53 | −0.396 | −0.404 | −2.43 | −2.47 | +0.008 | +0.007 | not reported (rule: 3 x ATR(20)) | 20 days |
| gold-weekly-momentum | T1 One-week momentum (primary) | IS | W1 / D1 | 470 | +0.037 | +0.007 | 1.15 | 0.23 | +0.030 | +0.016 | not reported (rule: 2 x ATR(20)) | one week |
| gold-weekly-momentum | T1 One-week momentum (primary) | OOS | W1 / D1 | 513 | +0.062 | +0.029 | 1.99 | 0.95 | +0.033 | +0.014 | not reported (rule: 2 x ATR(20)) | one week |
| gold-weekly-momentum | T2 Four-week momentum | IS | W1 / D1 | 470 | +0.016 | −0.014 | 0.49 | −0.43 | +0.030 | +0.016 | not reported (rule: 2 x ATR(20)) | one week |
| gold-weekly-momentum | T2 Four-week momentum | OOS | W1 / D1 | 513 | +0.030 | −0.003 | 0.84 | −0.08 | +0.033 | +0.014 | not reported (rule: 2 x ATR(20)) | one week |
| gold-weekly-momentum | T3 Reversal after a week over 2 sd | IS | W1 / D1 | 29 | −0.148 | −0.171 | −1.23 | −1.41 | +0.023 | +0.013 | not reported (rule: 2 x ATR(20)) | one week |
| gold-weekly-momentum | T3 Reversal after a week over 2 sd | OOS | W1 / D1 | 28 | −0.041 | −0.061 | −0.20 | −0.29 | +0.020 | +0.011 | not reported (rule: 2 x ATR(20)) | one week |
| gold-oil-lead | T1 follow a big WTI day | IS | D1 | 126 | −0.069 | −0.094 | −1.31 | −1.77 | +0.025 | +0.024 | mean $40.69 | to the close of the 3rd gold candle |
| gold-oil-lead | T1 follow a big WTI day | OOS | D1 | 126 | −0.006 | −0.028 | −0.10 | −0.47 | +0.022 | +0.022 | mean $82.21 | to the close of the 3rd gold candle |
| gold-oil-lead | T2 fade it | IS | D1 | 125 | +0.075 | +0.049 | 1.48 | 0.97 | +0.026 | +0.026 | mean $40.55 | to the close of the 3rd gold candle |
| gold-oil-lead | T2 fade it | OOS | D1 | 125 | +0.050 | +0.022 | 0.81 | 0.37 | +0.028 | +0.028 | mean $77.60 | to the close of the 3rd gold candle |
| gold-oil-lead | T3 copper version | IS | D1 | 136 | −0.018 | −0.043 | −0.40 | −0.99 | +0.025 | +0.026 | mean $42.04 | to the close of the 3rd gold candle |
| gold-oil-lead | T3 copper version | OOS | D1 | 121 | +0.092 | +0.067 | 1.46 | 1.07 | +0.025 | +0.026 | mean $67.54 | to the close of the 3rd gold candle |
| gold-bond-lead | T1 long after a bond up week gold lagged | IS | W1 / D1 | 32 | +0.176 | +0.133 | 1.42 | 1.08 | +0.043 | +0.043 | mean $42.34 | to the close of the 5th gold candle (daily: one candle) |
| gold-bond-lead | T1 long after a bond up week gold lagged | OOS | W1 / D1 | 30 | +0.133 | +0.088 | 0.69 | 0.46 | +0.045 | +0.045 | mean $66.20 | to the close of the 5th gold candle (daily: one candle) |
| gold-bond-lead | T2 mirror short | IS | W1 / D1 | 33 | −0.105 | −0.122 | −0.87 | −1.00 | +0.017 | +0.017 | mean $43.41 | to the close of the 5th gold candle (daily: one candle) |
| gold-bond-lead | T2 mirror short | OOS | W1 / D1 | 53 | −0.105 | −0.119 | −1.19 | −1.35 | +0.014 | +0.014 | mean $58.76 | to the close of the 5th gold candle (daily: one candle) |
| gold-bond-lead | T3 daily 2-year | IS | W1 / D1 | 309 | +0.023 | +0.002 | 1.21 | 0.13 | +0.021 | +0.021 | mean $38.46 | to the close of the 5th gold candle (daily: one candle) |
| gold-bond-lead | T3 daily 2-year | OOS | W1 / D1 | 317 | −0.030 | −0.048 | −1.54 | −2.37 | +0.018 | +0.017 | mean $63.57 | to the close of the 5th gold candle (daily: one candle) |
| gold-dollar-lead | T1 long after a dollar down week gold lagged | IS | W1 / D1 | 28 | +0.166 | +0.125 | 1.16 | 0.88 | +0.041 | +0.042 | mean $40.83 | to the close of the 5th gold candle (daily: one candle) |
| gold-dollar-lead | T1 long after a dollar down week gold lagged | OOS | W1 / D1 | 30 | +0.220 | +0.174 | 1.41 | 1.12 | +0.046 | +0.046 | mean $74.71 | to the close of the 5th gold candle (daily: one candle) |
| gold-dollar-lead | T2 mirror short | IS | W1 / D1 | 47 | −0.024 | −0.038 | −0.22 | −0.35 | +0.014 | +0.015 | mean $46.52 | to the close of the 5th gold candle (daily: one candle) |
| gold-dollar-lead | T2 mirror short | OOS | W1 / D1 | 44 | −0.193 | −0.207 | −2.00 | −2.14 | +0.014 | +0.014 | mean $63.47 | to the close of the 5th gold candle (daily: one candle) |
| gold-dollar-lead | T3 daily version | IS | W1 / D1 | 388 | −0.001 | −0.019 | −0.05 | −1.14 | +0.018 | +0.019 | mean $42.94 | to the close of the 5th gold candle (daily: one candle) |
| gold-dollar-lead | T3 daily version | OOS | W1 / D1 | 344 | −0.051 | −0.069 | −2.64 | −3.51 | +0.018 | +0.017 | mean $58.89 | to the close of the 5th gold candle (daily: one candle) |
| gold-platinum-ratio | T1 gold / platinum ratio reversion | IS | D1 | 70 | −0.023 | −0.048 | −0.24 | −0.49 | +0.025 | +0.024 | mean $70.01 | not reported |
| gold-platinum-ratio | T1 gold / platinum ratio reversion | OOS | D1 | 67 | −0.093 | −0.112 | −0.94 | −1.13 | +0.019 | +0.019 | mean $86.35 | not reported |
| gold-platinum-ratio | T2 palladium | IS | D1 | 80 | −0.103 | −0.137 | −1.10 | −1.46 | +0.034 | +0.034 | mean $62.56 | not reported |
| gold-platinum-ratio | T2 palladium | OOS | D1 | 64 | +0.036 | −0.011 | 0.40 | −0.13 | +0.047 | +0.048 | mean $74.95 | not reported |
| gold-platinum-ratio | T3 monthly relative momentum | IS | D1 | 119 | +0.061 | +0.005 | 0.66 | 0.06 | +0.056 | +0.056 | mean $58.88 | not reported |
| gold-platinum-ratio | T3 monthly relative momentum | OOS | D1 | 104 | +0.129 | +0.064 | 1.26 | 0.64 | +0.065 | +0.066 | mean $101.20 | not reported |
| gold-dollar-divergence | T1 buy after gold and the dollar both rose | IS | D1 | 98 | +0.167 | +0.121 | 2.39 | 1.77 | +0.046 | +0.046 | mean $34.44 | not reported |
| gold-dollar-divergence | T1 buy after gold and the dollar both rose | OOS | D1 | 92 | +0.169 | +0.120 | 1.69 | 1.23 | +0.049 | +0.049 | mean $55.43 | not reported |
| gold-dollar-divergence | T2 variant T2 | IS | D1 | 67 | −0.144 | −0.165 | −1.72 | −1.95 | +0.021 | +0.021 | mean $31.89 | not reported |
| gold-dollar-divergence | T2 variant T2 | OOS | D1 | 74 | +0.101 | +0.083 | 1.14 | 0.95 | +0.018 | +0.017 | mean $49.27 | not reported |
| gold-dollar-divergence | T3 variant T3 | IS | D1 | 110 | +0.048 | +0.020 | 1.35 | 0.57 | +0.028 | +0.028 | mean $34.13 | not reported |
| gold-dollar-divergence | T3 variant T3 | OOS | D1 | 105 | +0.087 | +0.060 | 1.69 | 1.20 | +0.027 | +0.027 | mean $54.82 | not reported |
| gold-weekly-open | T1 bullish-week buy limit | IS | M5 / W1 | 73 | +0.089 | +0.016 | not reported | 0.14 | +0.073 | not reported | $16.74 | to Friday's last candle before 16:00 New York |
| gold-weekly-open | T1 bullish-week buy limit | OOS | M5 / W1 | 79 | +0.117 | +0.066 | not reported | 0.57 | +0.051 | not reported | $31.46 | to Friday's last candle before 16:00 New York |
| gold-weekly-open | T2 variant T2 | IS | M5 / W1 | 52 | −0.090 | −0.116 | not reported | −0.92 | +0.026 | not reported | $15.80 | to Friday's last candle before 16:00 New York |
| gold-weekly-open | T2 variant T2 | OOS | M5 / W1 | 65 | −0.166 | −0.178 | not reported | −1.60 | +0.012 | not reported | $33.58 | to Friday's last candle before 16:00 New York |
| gold-weekly-open | T3 both-sides limits | IS | M5 / W1 | 127 | −0.045 | −0.086 | not reported | −1.05 | +0.041 | not reported | $16.07 | to Friday's last candle before 16:00 New York |
| gold-weekly-open | T3 both-sides limits | OOS | M5 / W1 | 167 | −0.107 | −0.131 | not reported | −1.94 | +0.024 | not reported | $32.64 | to Friday's last candle before 16:00 New York |
| gold-month-levels | T1 last month's high / low | IS | D1 | 81 | +0.093 | −0.020 | not reported | −0.11 | +0.113 | not reported | $14.92 | not reported |
| gold-month-levels | T1 last month's high / low | OOS | D1 | 80 | +0.259 | +0.145 | not reported | 0.55 | +0.114 | not reported | $18.70 | not reported |
| gold-month-levels | T2 variant T2 | IS | D1 | 77 | +0.272 | +0.210 | not reported | 1.41 | +0.062 | not reported | $27.77 | not reported |
| gold-month-levels | T2 variant T2 | OOS | D1 | 83 | +0.230 | +0.148 | not reported | 1.00 | +0.082 | not reported | $34.02 | not reported |
| gold-month-levels | T3 buys of T2 | IS | D1 | 42 | +0.467 | +0.370 | not reported | 1.59 | +0.097 | not reported | $28.50 | not reported |
| gold-month-levels | T3 buys of T2 | OOS | D1 | 52 | +0.553 | +0.435 | not reported | 2.06 | +0.118 | not reported | $37.75 | not reported |
| gold-inside-week | T1 inside-week OCO breakout | IS | W1 / D1 | 50 | −0.034 | −0.087 | not reported | −0.83 | +0.053 | not reported | $36.11 | to the last close of the week after |
| gold-inside-week | T1 inside-week OCO breakout | OOS | W1 / D1 | 67 | +0.236 | +0.177 | not reported | 0.94 | +0.059 | not reported | $35.53 | to the last close of the week after |
| gold-inside-week | T2 NR4 week | IS | W1 / D1 | 102 | +0.052 | −0.002 | not reported | −0.17 | +0.054 | not reported | $31.27 | to the last close of the week after |
| gold-inside-week | T2 NR4 week | OOS | W1 / D1 | 101 | +0.146 | +0.077 | not reported | 0.54 | +0.069 | not reported | $35.01 | to the last close of the week after |
| gold-inside-week | T3 Monday range held to Wednesday | IS | W1 / D1 | 18 | +0.187 | +0.158 | not reported | 1.46 | +0.029 | not reported | $22.46 | to the last close of the week after |
| gold-inside-week | T3 Monday range held to Wednesday | OOS | W1 / D1 | 19 | −0.167 | −0.193 | not reported | −1.37 | +0.026 | not reported | $29.98 | to the last close of the week after |
| gold-ibs | T1 T1 long, IBS < 0.2 | IS | D1 / H1 | 310 | −0.010 | −0.034 | −0.36 | −1.17 | +0.024 | +0.015 | not reported (rule: 2 x ATR(20)) | to an IBS cross of 0.5 (mean about 1.7 days) |
| gold-ibs | T1 T1 long, IBS < 0.2 | OOS | D1 / H1 | 353 | +0.024 | +0.004 | 1.06 | 0.18 | +0.020 | +0.014 | not reported (rule: 2 x ATR(20)) | to an IBS cross of 0.5 (mean about 1.7 days) |
| gold-ibs | T2 T2 short, IBS > 0.8 | IS | D1 / H1 | 362 | −0.061 | −0.076 | −2.64 | −3.26 | +0.015 | +0.015 | not reported (rule: 2 x ATR(20)) | to an IBS cross of 0.5 (mean about 1.7 days) |
| gold-ibs | T2 T2 short, IBS > 0.8 | OOS | D1 / H1 | 442 | −0.063 | −0.077 | −2.64 | −3.20 | +0.014 | +0.014 | not reported (rule: 2 x ATR(20)) | to an IBS cross of 0.5 (mean about 1.7 days) |
| gold-ibs | T3 T3 long, IBS < 0.2 above SMA200 | IS | D1 / H1 | 173 | −0.014 | −0.037 | −0.38 | −1.01 | +0.023 | +0.015 | not reported (rule: 2 x ATR(20)) | to an IBS cross of 0.5 (mean about 1.7 days) |
| gold-ibs | T3 T3 long, IBS < 0.2 above SMA200 | OOS | D1 / H1 | 231 | +0.026 | +0.008 | 0.96 | 0.28 | +0.018 | +0.013 | not reported (rule: 2 x ATR(20)) | to an IBS cross of 0.5 (mean about 1.7 days) |
| gold-key-reversal | T1 T1 bearish key reversal at a 20-day high, short | IS | D1 / H1 | 77 | +0.011 | −0.031 | 0.09 | −0.24 | +0.042 | +0.043 | 0.96 x ATR (mean, as reported) | to the close of the third day |
| gold-key-reversal | T1 T1 bearish key reversal at a 20-day high, short | OOS | D1 / H1 | 90 | −0.144 | −0.176 | −1.25 | −1.50 | +0.032 | +0.032 | 1.1 x ATR (mean, as reported) | to the close of the third day |
| gold-key-reversal | T2 T2 bullish key reversal at a 20-day low, long | IS | D1 / H1 | 55 | +0.121 | +0.053 | 0.75 | 0.32 | +0.068 | +0.039 | 1.01 x ATR (mean, as reported) | to the close of the third day |
| gold-key-reversal | T2 T2 bullish key reversal at a 20-day low, long | OOS | D1 / H1 | 58 | −0.061 | −0.131 | −0.40 | −0.85 | +0.070 | +0.040 | 0.88 x ATR (mean, as reported) | to the close of the third day |
| gold-key-reversal | T3 T3 outside reversal day, both sides | IS | D1 / H1 | 210 | +0.015 | −0.032 | 0.21 | −0.46 | +0.047 | +0.034 | 1.15 x ATR (mean, as reported) | to the close of the third day |
| gold-key-reversal | T3 T3 outside reversal day, both sides | OOS | D1 / H1 | 263 | +0.048 | +0.003 | 0.74 | 0.05 | +0.045 | +0.031 | 1.06 x ATR (mean, as reported) | to the close of the third day |
| gold-daily-turtle-soup | T1 T1 classic Turtle Soup, both sides | IS | D1 / H1 | 170 | −0.220 | −0.396 | −2.39 | −4.07 | +0.176 | +0.167 | $4.10 | about 0.6-1.7 days (mean, as reported) |
| gold-daily-turtle-soup | T1 T1 classic Turtle Soup, both sides | OOS | D1 / H1 | 156 | −0.026 | −0.181 | −0.25 | −1.75 | +0.155 | +0.147 | $6.66 | about 0.6-1.7 days (mean, as reported) |
| gold-daily-turtle-soup | T2 T2 Turtle Soup Plus One, both sides | IS | D1 / H1 | 66 | −0.270 | −0.360 | −2.30 | −2.98 | +0.090 | +0.073 | $10.51 | about 0.6-1.7 days (mean, as reported) |
| gold-daily-turtle-soup | T2 T2 Turtle Soup Plus One, both sides | OOS | D1 / H1 | 56 | +0.223 | +0.153 | 1.30 | 0.89 | +0.070 | +0.060 | $12.13 | about 0.6-1.7 days (mean, as reported) |
| gold-daily-turtle-soup | T3 T3 classic Turtle Soup, longs only | IS | D1 / H1 | 74 | −0.278 | −0.442 | −1.94 | −2.87 | +0.164 | +0.143 | $5.09 | about 0.6-1.7 days (mean, as reported) |
| gold-daily-turtle-soup | T3 T3 classic Turtle Soup, longs only | OOS | D1 / H1 | 67 | +0.014 | −0.167 | 0.09 | −0.99 | +0.181 | +0.161 | $7.20 | about 0.6-1.7 days (mean, as reported) |
| gold-h4-pinbar | T1 T1 both sides, target 2R | IS | H4 | 141 | +0.065 | −0.030 | 0.63 | −0.28 | +0.095 | +0.078 | not reported (rule: $0.30 past the pin's extreme) | out after 12 H4 candles |
| gold-h4-pinbar | T1 T1 both sides, target 2R | OOS | H4 | 156 | +0.014 | −0.065 | 0.13 | −0.63 | +0.079 | +0.064 | not reported (rule: $0.30 past the pin's extreme) | out after 12 H4 candles |
| gold-h4-pinbar | T2 T2 both sides, no target, time exit after 12 H4 candles | IS | H4 | 138 | +0.205 | +0.105 | 1.28 | 0.65 | +0.100 | +0.078 | not reported (rule: $0.30 past the pin's extreme) | out after 12 H4 candles |
| gold-h4-pinbar | T2 T2 both sides, no target, time exit after 12 H4 candles | OOS | H4 | 154 | +0.001 | −0.083 | 0.01 | −0.70 | +0.084 | +0.064 | not reported (rule: $0.30 past the pin's extreme) | out after 12 H4 candles |
| gold-h4-pinbar | T3 T3 bullish pins only, target 2R, D1 close above its 100-day average | IS | H4 | 37 | +0.208 | +0.109 | 1.06 | 0.56 | +0.099 | +0.063 | not reported (rule: $0.30 past the pin's extreme) | out after 12 H4 candles |
| gold-h4-pinbar | T3 T3 bullish pins only, target 2R, D1 close above its 100-day average | OOS | H4 | 54 | −0.090 | −0.176 | −0.59 | −1.15 | +0.086 | +0.062 | not reported (rule: $0.30 past the pin's extreme) | out after 12 H4 candles |
| gold-streak | T1 buy after 3+ down closes | IS | D1 | 239 | +0.017 | −0.013 | 0.62 | −0.46 | +0.030 | not reported | not reported (rule: 1.5 x ATR(14)) | to the close of the last day held |
| gold-streak | T1 buy after 3+ down closes | OOS | D1 | 215 | 0.000 | −0.028 | −0.02 | −0.90 | +0.028 | not reported | not reported (rule: 1.5 x ATR(14)) | to the close of the last day held |
| gold-streak | T2 sell after 3+ up closes | IS | D1 | 323 | −0.029 | −0.050 | −1.25 | −2.10 | +0.021 | not reported | not reported (rule: 1.5 x ATR(14)) | to the close of the last day held |
| gold-streak | T2 sell after 3+ up closes | OOS | D1 | 349 | −0.029 | −0.049 | −1.13 | −1.82 | +0.020 | not reported | not reported (rule: 1.5 x ATR(14)) | to the close of the last day held |
| gold-streak | T3 variant T3 | IS | D1 | 74 | −0.099 | −0.142 | −1.10 | −1.53 | +0.043 | not reported | not reported (rule: 1.5 x ATR(14)) | to the close of the last day held |
| gold-streak | T3 variant T3 | OOS | D1 | 57 | −0.119 | −0.162 | −0.97 | −1.32 | +0.043 | not reported | not reported (rule: 1.5 x ATR(14)) | to the close of the last day held |
| gold-premium-discount | T1 buy the bottom quarter of the 20-day range | IS | D1 | 147 | +0.007 | −0.055 | 0.08 | −0.66 | +0.062 | not reported | not reported (rule: 1.5 x ATR(14)) | up to 10 days or the range's 50 % |
| gold-premium-discount | T1 buy the bottom quarter of the 20-day range | OOS | D1 | 138 | +0.080 | +0.009 | 1.28 | 0.14 | +0.071 | not reported | not reported (rule: 1.5 x ATR(14)) | up to 10 days or the range's 50 % |
| gold-premium-discount | T2 sell in premium | IS | D1 | 170 | −0.074 | −0.096 | −0.87 | −1.10 | +0.022 | not reported | not reported (rule: 1.5 x ATR(14)) | up to 10 days or the range's 50 % |
| gold-premium-discount | T2 sell in premium | OOS | D1 | 224 | −0.200 | −0.220 | −2.46 | −2.66 | +0.020 | not reported | not reported (rule: 1.5 x ATR(14)) | up to 10 days or the range's 50 % |
| gold-premium-discount | T3 buy in discount, 100-day trend up | IS | D1 | 42 | +0.013 | −0.048 | 0.09 | −0.33 | +0.061 | not reported | not reported (rule: 1.5 x ATR(14)) | up to 10 days or the range's 50 % |
| gold-premium-discount | T3 buy in discount, 100-day trend up | OOS | D1 | 56 | +0.159 | +0.097 | 1.40 | 0.87 | +0.062 | not reported | not reported (rule: 1.5 x ATR(14)) | up to 10 days or the range's 50 % |
| gold-measured-move | T1 measured move to D | IS | H1 / D1 | 206 | +0.059 | +0.020 | 1.30 | 0.42 | +0.039 | not reported | not reported (rule: the study's ATR-based stop) | up to 30 candles |
| gold-measured-move | T1 measured move to D | OOS | H1 / D1 | 231 | −0.004 | −0.043 | −0.10 | −0.97 | +0.039 | not reported | not reported (rule: the study's ATR-based stop) | up to 30 candles |
| gold-measured-move | T2 variant T2 | IS | H1 / D1 | 176 | −0.001 | −0.038 | −0.02 | −1.06 | +0.037 | not reported | not reported (rule: the study's ATR-based stop) | up to 30 candles |
| gold-measured-move | T2 variant T2 | OOS | H1 / D1 | 189 | −0.018 | −0.053 | −0.50 | −1.45 | +0.035 | not reported | not reported (rule: the study's ATR-based stop) | up to 30 candles |
| gold-measured-move | T3 variant T3 | IS | H1 / D1 | 121 | +0.022 | −0.015 | 0.34 | −0.23 | +0.037 | not reported | not reported (rule: the study's ATR-based stop) | up to 30 candles |
| gold-measured-move | T3 variant T3 | OOS | H1 / D1 | 138 | −0.034 | −0.070 | −0.61 | −1.26 | +0.036 | not reported | not reported (rule: the study's ATR-based stop) | up to 30 candles |
| gold-macd | T1 MACD stop-and-reverse | IS | D1 | 186 | +0.148 | +0.090 | not reported | 0.92 | +0.058 | not reported | not reported (rule: k x ATR(14), never moved) | average 12-174 daily candles (as reported) |
| gold-macd | T1 MACD stop-and-reverse | OOS | D1 | 200 | +0.115 | +0.045 | not reported | 0.47 | +0.070 | not reported | not reported (rule: k x ATR(14), never moved) | average 12-174 daily candles (as reported) |
| gold-macd | T2 MACD long only | IS | D1 | 93 | +0.249 | +0.148 | not reported | 0.97 | +0.101 | not reported | not reported (rule: k x ATR(14), never moved) | average 12-174 daily candles (as reported) |
| gold-macd | T2 MACD long only | OOS | D1 | 100 | +0.379 | +0.253 | not reported | 1.53 | +0.126 | not reported | not reported (rule: k x ATR(14), never moved) | average 12-174 daily candles (as reported) |
| gold-macd | T3 50/200 SMA long only | IS | D1 | 6 | +1.181 | +0.681 | not reported | 0.48 | +0.499 | not reported | not reported (rule: k x ATR(14), never moved) | average 12-174 daily candles (as reported) |
| gold-macd | T3 50/200 SMA long only | OOS | D1 | 7 | +1.669 | +0.797 | not reported | 0.47 | +0.872 | not reported | not reported (rule: k x ATR(14), never moved) | average 12-174 daily candles (as reported) |
| gold-ichimoku | T1 daily cloud breakout | IS | D1 | 62 | −0.029 | −0.117 | −0.19 | −0.83 | +0.088 | not reported | not reported (rule: 2 x ATR(14)) | median 3-20 days (as reported) |
| gold-ichimoku | T1 daily cloud breakout | OOS | D1 | 66 | +0.098 | −0.029 | 0.56 | −0.19 | +0.127 | not reported | not reported (rule: 2 x ATR(14)) | median 3-20 days (as reported) |
| gold-ichimoku | T2 Tenkan / Kijun cross | IS | D1 | 42 | +0.179 | +0.102 | 0.79 | 0.48 | +0.077 | not reported | not reported (rule: 2 x ATR(14)) | median 3-20 days (as reported) |
| gold-ichimoku | T2 Tenkan / Kijun cross | OOS | D1 | 50 | +0.527 | +0.389 | 1.90 | 1.49 | +0.138 | not reported | not reported (rule: 2 x ATR(14)) | median 3-20 days (as reported) |
| gold-ichimoku | T3 variant T3 | IS | D1 | 399 | +0.163 | +0.087 | 1.75 | 0.94 | +0.076 | not reported | not reported (rule: 2 x ATR(14)) | median 3-20 days (as reported) |
| gold-ichimoku | T3 variant T3 | OOS | D1 | 450 | +0.096 | +0.018 | 1.04 | 0.20 | +0.078 | not reported | not reported (rule: 2 x ATR(14)) | median 3-20 days (as reported) |
| gold-pre-cpi | T1 long before CPI | single | H1 | 74 | +0.043 | +0.024 | not reported | 0.93 | +0.019 | not reported | $99.98 | from 17:00 NY days before the release to the release morning |
| gold-pre-cpi | T2 long before payrolls | single | H1 | 47 | +0.109 | +0.088 | not reported | 2.07 | +0.021 | not reported | $108.62 | from 17:00 NY days before the release to the release morning |
| gold-pre-cpi | T3 variant T3 | single | H1 | 121 | −0.001 | −0.027 | not reported | −0.53 | +0.026 | not reported | $24.10 | from 17:00 NY days before the release to the release morning |
| gold-pre-nfp-replicate | R1 gold-pre-cpi T2 on 2006-21 | single | H1 | 156 | +0.003 | −0.024 | 0.14 | −0.97 | +0.027 | not reported | $56.18 | 17:00 NY, third weekday before payrolls, to 08:00 NY on release day |

## Each study's verdict (its own words)

| Study | Commit read | Cost assumption | Windows | Verdict |
|---|---|---|---|---|
| gold-vol-breakout | 72009ebe62 | $0.60 a round trip | 2016-20 | 2021-2026-11 | FAIL, 0 of 3: gold open ± 0.5 × prior range breakout 2021 → now +0.072R a trade net (n 1121, month t +1.86, gross +0.121R); 2016-20 +0.009R |
| gold-vol-breakout-replicate | 3360a2cfd3 | $0.60 a round trip | single window 2007-15 | PASS: gold open ± 0.5 × prior range breakout on untouched 2007-15 +0.111R a trade net (n 1657, month t +3.19, gross +0.203R) |
| gold-comex-orb | 08c7f3cd41 | $0.60 a round trip | 2016-20 | 2021-2026-11 | FAIL, 0 of 3: gold 08:20-08:50 NY breakout 2021 → now +0.006R a trade net (n 1407, month t +0.20, gross +0.075R); 2016-20 −0.155R |
| gold-london-orb | 2b3ee55f88 | $0.60 a round trip | 2008-16 | 2017-2026-11 | FAIL, 0 of 3: gold London first-hour range breakout 2017 → now −0.078R a trade net (n 2542, month t −1.78, gross +0.076R); 2008-16 −0.041R |
| gold-london-reversal | ae93e67345 | $0.60 a round trip | 2016-20 | 2021-2026-11 | FAIL, 0 of 3: fading gold's London move at 09:30 NY, 2021 → now −0.164R a trade net (n 352, month t −2.22, gross −0.064R); after a NY raid −0.380R (n 155, t −3.82) |
| gold-pdhl-break | f2ab59c9dc | $0.60 a round trip | 2016-20 | 2021-2026-11 | FAIL, 0 of 3: buying / selling an M15 close beyond the previous day's high / low, 2021 → now −0.026R a trade net (n 1120, month t −0.64); 2016-20 −0.090R (n 939) |
| ict-silver-bullet-gold | 7f7f64fabe | $0.30 a round trip | 2016-20 | 2021-2026-11 | FAIL, 0 of 3: AM silver bullet on gold 2021 → now −0.168R a trade net (n 401, month t −2.13, gross −0.078R); 2016-20 −0.253R |
| mmxm-pdhl-raid-gold | b1058bcd77 | $0.60 a round trip | 2017-19 (36 months) | 2021-2026-11 | FAIL: the pre-registered rule trades 12 times in 8.8 years and loses (T1 out of sample -0.131R a trade net, n 7, month t -0.32; in sample -0.400R, n 5). |
| gold-late-ny | 588b99c8a5 | $0.60 a round trip | 2016-20 | 2021-2026-11 | FAIL, 0 of 3: gold's 13:30-16:30 New York move does not carry into the 18:00-02:00 Asian session (out of sample follow −0.045R a trade net, n 1445, month t −2.57; fade −0.065R, t −3.46). |
| gold-gap-open | 858df19b58 | $0.60 a round trip | 2016-20 | 2021-2026-11 | FAIL, 0 of 3: gold's 17:00 → 18:00 New York reopen gap is usually within a spread; fading it (OOS −0.077R net, t −1.52) or following it (−0.034R, t −0.32) does not pay. |
| gold-volume-spike | 516935301e | $0.60 a round trip | 2016-20 | 2021-2026-11 | FAIL, 0 of 3 pass: OOS 2021-now net R a trade, continuation −0.054 (n 515, t −0.85), reversal −0.363 (t −2.65), strong-close +0.061 (t +1.02). |
| gold-hourly-shock | 2c5315eec5 | $0.60 a round trip + financing on buys | 2008-16 | 2017-2026-11 | FAIL, 0 of 3 pass: OOS 2017-now net R a trade T1 −0.349 (n 1051, t −5.56), T2 −0.103 (n 937, t −1.88), T3 −0.345 (n 949, t −5.21). |
| gold-silver-lead-intraday | f390309292 | $0.60 a round trip | 2016-20 | 2021-2026-11 | FAIL, 0 of 3: a silver M5 shock gold lags is followed by a tiny gold catch-up (+0.027R gross, 2021-26) that $0.60 of costs turns into -0.125R a trade (n 3295, month t -6.16). |
| gold-round-numbers | b7f09e820c | $0.45-0.60 (spread + slippage on market orders) | 2016-20 | 2021-2026-11 | FAIL, 0 of 3: T1 OOS -0.09R net (n 344, t -1.37), IS -0.361R; T2 OOS -0.219R net (n 348, t -2.87), IS -0.231R; T3 OOS -0.062R net (n 615, t -0.83), IS -0.028R |
| gold-vwap | b908a105b5 | $0.60 a round trip | 2016-20 | 2021-2026-11 | FAIL, 0 of 3 tests pass: fading the 2 sd close to VWAP made −0.310R a trade net out of sample (2021-now, n 1061, month t −4.97); follow and pullback failed too. |
| gold-floor-pivots | a0650342f0 | $0.60 a round trip | 2016-20 | 2021-2026-11 | FAIL: fading R1/S1 made −0.151R a trade net out of sample (n 796, month t −3.83); 0 of 3 tests pass. |
| gold-ote-retrace | f84b1bf730 | $0.60 a round trip | 2016-20 | 2021-2026-11 | FAIL, 0 of 3: a limit at the 0.705 retracement of an H1 structure-break leg loses after costs in and out of sample (T1 out of sample -0.230R a trade, n 740, month t -3.42). |
| gold-squeeze | 0124bf3d9c | $0.60 a round trip + financing on buys | 2016-20 | 2021-2026-11 | FAIL, 0 of 3 tests pass: the H4 squeeze release lost out of sample (2021-now −0.086R a trade net, n 108, month t −0.58), D1 and the slope filter lost too. |
| gold-regime-switch | a6c678fd3a | $0.60 a round trip + financing on buys | 2016-20 | 2021-2026-11 | FAIL, 0 of 3 tests pass: the ER switch lost out of sample (2021-now −0.094R a trade net, n 400, month t −1.19) and sat under its shuffled-label placebo's median. |
| gold-comex-calendar | 514cc960f0 | $0.60 a round trip | 2008-16 | 2017-2026-10 | FAIL: shorting gold into options expiry lost -0.130R a trade net out of sample (n 118, month t -2.13), -0.014R in sample; 0 of 3 tests pass. |
| gold-turn-of-month | c0ae1524ef | $0.60 a round trip | 2008-16 | 2017-2026-10 | FAIL: long gold TD-2 to TD+3 made +0.117R a trade net out of sample (n 118, month t 1.80, Holm p 0.11), +0.000R in sample, 36 of 40 placebos; 0 of 3 pass. |
| gold-china-holidays | 98a9438c9b | $0.60 a round trip + financing | 2008-16 | 2017-26 | FAIL (tOos, placebo not met): long gold the 10 days before the Lunar New Year closure makes +0.224R a year net out of sample 2017-26 (n 10, t +1.38). |
| gold-record-high | 9522d5d234 | $0.60 a round trip + financing | 2008-16 | 2017-26 | FAIL: long 20 days after an all-time closing high made +0.319R a trade net 2017-26 (n 17, month t 0.93); 0 of 3 tests pass. |
| gold-weekly-momentum | a1f601ef83 | $0.60 a round trip + financing | 2008-16 | 2017-26 | FAIL, 0 of 3: last week's sign made +0.029R a trade net 2017-26 (n 513, month t 0.95); fading a 2-sd week -0.061R (n 28, t -0.29). |
| gold-oil-lead | 54a29a877d | $0.60 a round trip + financing on longs | 2006-16 | 2017-2026-10 | FAIL, 0 of 3: a big WTI day does not lead gold over the next 3 days (follow, out of sample 2017-26: −0.028R a trade net, n 126, month t −0.47); the fade and copper fail too. |
| gold-bond-lead | 1754d4ca9a | $0.60 a round trip + financing on longs | 2007-16 | 2017-2026-10 | FAIL, 0 of 3: buying gold after a 10-year bond up week that gold lagged makes +0.088R a trade net out of sample 2017-26 (n 30, month t 0.46); the mirror short and the daily 2-year lose. |
| gold-dollar-lead | c5c9b63509 | $0.60 a round trip + financing on longs | 2007-16 | 2017-2026-10 | FAIL, 0 of 3: buying gold after a dollar down week that gold lagged makes +0.174R a trade net out of sample 2017-26 (n 30, month t 1.12); the mirror short and the daily version lose. |
| gold-platinum-ratio | 4e5d2d0cfe | $0.60 a round trip + financing on longs | 2006-16 | 2017-2026-10 | FAIL, 0 of 3: a gold / platinum ratio extreme does not predict gold (reversion on gold, OOS 2017-26 −0.112R a trade net, n 67, month t −1.13); palladium and monthly relative momentum fail too. |
| gold-dollar-divergence | bc48fb127b | $0.60 a round trip + financing on buys | 2008-16 | 2017-2026-10 | FAIL, 0 of 3: buying gold after a day both gold and the dollar rose makes +0.120R a trade net out of sample 2017-26 (n 92, month t 1.23, Holm p 0.33); it beats 34 of 40 placebos. |
| gold-weekly-open | 2426265a82 | $0.45-0.60 | 2016-20 | 2021-2026-11 | FAIL, 0 of 3 tests: the bullish-week long T1 made +0.066R a trade net out of sample (n 79, month t 0.57, Holm p 0.85) and beat 24 of 40 placebos; T2 and T3 lose in both windows. |
| gold-month-levels | 7eb40c4e6a | $0.60 a round trip | 2008-16 | 2017-2026-11 | FAIL, 0 of 3 tests: no rule at last month's high / low reaches t 2 after Holm (best Holm p 0.06), and random levels near them do as well. |
| gold-inside-week | 5e626606c3 | $0.60 a round trip | 2008-16 | 2017-2026-10 | FAIL, 0 of 3: the inside-week breakout made +0.177R a trade net out of sample (n 67, month t 0.94) but lost in sample (−0.087R, n 50); the NR4-week and Monday-range tests fail too. |
| gold-ibs | 514519df56 | $0.60 a round trip + financing on buys | 2008-16 | 2017-26 | FAIL. 0 of 3 tests pass: buying gold after a close in the bottom 20 % of its day made +0.004R a trade net in 2017-26 (n 353, month t 0.18) and -0.034R in 2008-16; the short and the trend version fail too. |
| gold-key-reversal | 20f095c25e | $0.60 a round trip + financing on buys | 2008-16 | 2017-26 | FAIL: 0 of 3 tests pass; shorting a bearish key reversal at a 20-day high lost -0.176R a trade net in 2017-26 (n 90, month t -1.50) and -0.031R in 2008-16. |
| gold-daily-turtle-soup | 0730f3bf74 | $0.45-0.60 + financing | 2007-16 | 2017-26 | FAIL: the classic Turtle Soup lost −0.181R a trade net out of sample 2017-26 (n 156, month t −1.75) and −0.396R in 2007-16 (n 170, t −4.07); 0 of 3 tests pass. |
| gold-h4-pinbar | 3950a17e5d | $0.60 a round trip + financing on buys | 2008-16 | 2017-26 | FAIL, 0 of 3: the gold H4 pin bar at a 20-candle extreme loses after costs (T1 OOS −0.065R a trade, n 156, t −0.63; in sample −0.030R). |
| gold-streak | 5afc05590e | $0.60 a round trip + financing on buys | 2008-16 | 2017-2026-10 | FAIL: 0 of 3 tests pass; buying after 3+ down closes made -0.028R a trade net in 2017-26 (n 215, month t -0.90) and selling after 3+ up closes -0.049R (n 349, t -1.82). |
| gold-premium-discount | d57460e3ef | $0.60 a round trip + financing on buys | 2008-16 | 2017-2026-10 | FAIL: 0 of 3 tests pass; buying the bottom quarter of the 20-day range made +0.009R a trade net in 2017-26 (n 138, month t 0.14) and lost to 40 of 40 random buy-day placebos. |
| gold-measured-move | deb73df855 | $0.60 a round trip + financing | 2016-20 | 2021-2026-11 | FAIL, 0 of 3 tests: after a close beyond B, gold reaches D no more often than a random-side trade does (67.1 % vs 66.7 %). |
| gold-macd | a3dbb481ae | $0.60 a round trip + financing | 2008-16 | 2017-2026-11 | FAIL, 0 of 3: no test has an out-of-sample month t near 2 (best MACD long only +0.253R a trade, t 1.53, Holm p 0.39), none beats 38 of 40 placebos, and the 50/200 cross has 7 trades. |
| gold-ichimoku | 958dedbc58 | $0.60 a round trip + financing | 2008-16 | 2017-26 | FAIL, 0 of 3 tests pass: the best, the daily Tenkan / Kijun cross, made +0.39R a trade net out of sample (n 50, month t 1.49, Holm p 0.21), most of it in 2025. |
| gold-pre-cpi | 4894595371 | $0.60 a round trip + financing | single window 2018-2026-11 (T2 2022-26) | FAIL: 0 of 3 tests pass; best T2 +0.088R a trade net (n 47, month t 2.07, Holm p 0.067, 37 of 40 placebos). |
| gold-pre-nfp-replicate | a68b804886 | $0.60 a round trip + financing | single window 2006-21 | FAIL: no replication on 2006-21, -0.024R a trade net (n 156, month t -0.97, 14 of 40 placebos); month t -0.97 under 2, 2x costs not positive, 14 of 40 placebos, a half not positive. |
| gold-vol-target | 54b83c54da | not reported | not reported | FAIL, 0 of 3 tests pass: vol-targeted gold beats a matched constant holding out of sample (Sharpe +0.07, t 0.59) but lost to it in 2008-16; no test near Holm p 0.05. |
