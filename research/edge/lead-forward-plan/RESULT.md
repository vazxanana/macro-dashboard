# What a forward paper record could show for each open lead, and how long it would take (14 Nov 2026)

**Verdict: PLAN COMPUTED (no rule tested).** This is accounting, not a test: no rule is tested, no rule is proposed, and nothing live changed. **No lead is an edge.** **This is not a proposal to trade anything.** Any forward paper stream of any lead below would be a new rule and needs the owner's approval first (absolute rule 3); the council has none today.

In one line per lead, at the cost each study charged (1x):

- **Gotobi fade, USD/JPY (T2, #878)**: 70.63 trades a year, +0.148R a trade (sd 1.416); months of forward record for an expected t of 2: **70 (5.8 yr)**; a two-year record shows t ≥ 2 in 17 % of paths if it is as measured and in 1 % if there is no edge.
- **Sunday-gap fade rule G, six majors (#880)**: 35.13 trades a year, +0.194R a trade (sd 0.884); months of forward record for an expected t of 2: **75 (6.2 yr)**; a two-year record shows t ≥ 2 in 20 % of paths if it is as measured and in 4 % if there is no edge.
- **Bond month-end, USB10Y CFD (#939 T1)**: 12 trades a year, +0.036R a trade (sd 0.529); months of forward record for an expected t of 2: **over 50 yr**; a two-year record shows t ≥ 2 in 6 % of paths if it is as measured and in 3 % if there is no edge.
- **Index overnight long, NAS100 CFD (T2)**: 251.17 trades a year, −0.006R a trade (sd 0.415); months of forward record for an expected t of 2: **never** (not positive after its cost).

So: at the cost the studies charged, **no stream reaches an expected t of 2 within three years of forward record**; at half that cost, L2b. A forward record of two or three years can therefore mostly measure the COST at each lead's minute, and stop a stream that is clearly worse than its study; it cannot prove one. The stop lines are fixed from the as-measured world, so their false-stop rate is about 12-13 % in every stream (three 5 % checks and one 95 % drawdown line), as in the path-to-live plan.

Months to t 2 from monthly sums is the honest figure where several trades fall in the same days (the four gotobi crosses trade the same mornings, the six gap pairs the same weekends): their trades are not independent, so the per-trade figure is much shorter and wrong for planning (L1b at 1x: 32 (2.7 yr) months from trades, 107 (8.9 yr) from months).

## Method

Pre-registered in PREREGISTRATION.md (pushed alone first). Each lead's own decisive-window trades, read from the pinned commits by `extract.mjs` into `inputs.json`; per trade gross R and the cost its study charged (1x); the cost grid scales the whole charged cost (0.5x, 1x, 1.5x, 2x). The month-block bootstrap is research/proposals/2026-11-12-path-to-live.mjs (mulberry32, quant, simulate imported): 20,000 paths, seed 12, every calendar month of the window a block (empty months included). Worlds: measured = the stream at that cost; none = minus that level's mean; losing = minus (that level's mean + |the 1x mean|). Stop lines (from the measured world at each cost: total under its 5th percentile at 6 / 12 / 24 months, or a closed drawdown over the 95th percentile of the 24-month worst drawdown). "Months to t 2" = (2σ/μ)² on monthly sums over all calendar months; "from trades" = (2 sd / mean)² trades at the stream's pace. P(t ≥ 2) = share of paths whose monthly-sum t over that horizon is 2 or more.

## Gates (each study's published decisive-window figures, in its own t)

| Stream | n | gross | net | t | expected | pass |
|---|---|---|---|---|---|---|
| L1 Gotobi fade, USD/JPY (T2, #878) | 771 | +0.261 | +0.148 | +2.74 | n 771, net 0.148, t 2.74 | yes |
| L1b Gotobi fade, four yen crosses pooled (#889 R1) | 4784 | +0.193 | +0.099 | +2.75 | n 4784, net 0.099, t 2.75 | yes |
| L2 Sunday-gap fade rule G, six majors (#880) | 243 | +0.292 | +0.194 | +2.14 | n 243, net 0.194, t 2.14 | yes |
| L2b Sunday-gap fade rule G, six new pairs (#938 S2) | 481 | +0.293 | +0.153 | +3.19 | n 481, net 0.153, t 3.19 | yes |
| L3 Bond month-end, USB10Y CFD (#939 T1) | 130 | +0.106 | +0.036 | +0.77 | n 130, gross 0.107, net 0.036, t 0.77 | yes |
| L3b Bond month-end, same trades at assumed ZN futures cost (#943) | 130 | +0.106 | +0.088 | +1.91 | n 130, net 0.088, t 1.91 | yes |
| L4 Index overnight long, NAS100 CFD (T2) | 2721 | +0.026 | −0.006 | −0.84 | n 2721, gross 0.026, net -0.006, t -0.84 | yes |
| L4b Index overnight long, US500 CFD (T1) | 2721 | +0.022 | −0.022 | −2.86 | n 2721, gross 0.023, net -0.022, t -2.86 | yes |

## L1

### L1: Gotobi fade, USD/JPY (T2, #878)

Trades 2016-01-05 to 2026-11-10, months 2016-01 to 2026-11 (keyed by Tokyo day).

| Cost | trades / yr | mean R | sd | months to t 2 (monthly; from trades) | stop lines: total under at 6 / 12 / 24 m; drawdown over | P(stop in 24 m): as measured (false) / no edge (correct) / losing | P(t ≥ 2): 24 m / 36 m / 60 m as measured | P(t ≥ 2) 24 m, no edge |
|---|---|---|---|---|---|---|---|---|
| 0.5x | 70.63 | +0.204 | 1.416 | 36 (3.0 yr); 33 (2.7 yr) | −6.0 / −4.7 / +1.2; 16.1R | 13 % / 72 % / 96 % | 34 % / 51 % / 75 % | 1 % |
| 1x | 70.63 | +0.148 | 1.416 | 70 (5.8 yr); 62 (5.2 yr) | −8.1 / −8.7 / −6.8; 20R | 13 % / 54 % / 90 % | 17 % / 26 % / 44 % | 1 % |
| 1.5x | 70.63 | +0.092 | 1.417 | 184 (15.3 yr); 162 (13.5 yr) | −10.2 / −12.7 / −14.7; 24.9R | 12 % / 34 % / 79 % | 7 % / 10 % / 17 % | 1 % |
| 2x | 70.63 | +0.035 | 1.418 | over 50 yr; over 50 yr | −12.3 / −16.9 / −22.8; 30.8R | 12 % / 19 % / 63 % | 3 % / 3 % / 4 % | 1 % |

At 1x, 24 months as measured: total −6.8 / +20.2 / +51.4R (5 / 50 / 95 %), P(total < 0) 12 %; with no edge P(total < 0) 52 %.

### L1b: Gotobi fade, four yen crosses pooled (#889 R1)

Trades 2010-01-05 to 2026-11-10, months 2010-01 to 2026-11 (keyed by Tokyo day).

| Cost | trades / yr | mean R | sd | months to t 2 (monthly; from trades) | stop lines: total under at 6 / 12 / 24 m; drawdown over | P(stop in 24 m): as measured (false) / no edge (correct) / losing | P(t ≥ 2): 24 m / 36 m / 60 m as measured | P(t ≥ 2) 24 m, no edge |
|---|---|---|---|---|---|---|---|---|
| 0.5x | 282.8 | +0.146 | 1.366 | 49 (4.1 yr); 15 | −21.4 / −20.9 / −7.8; 58.3R | 13 % / 65 % / 92 % | 25 % / 38 % / 62 % | 1 % |
| 1x | 282.8 | +0.099 | 1.367 | 107 (8.9 yr); 32 (2.7 yr) | −28.5 / −34.5 / −35.2; 73R | 12 % / 45 % / 81 % | 11 % / 16 % / 28 % | 1 % |
| 1.5x | 282.8 | +0.052 | 1.368 | 391 (32.6 yr); 116 (9.7 yr) | −35.6 / −48.1 / −62.4; 90.7R | 12 % / 26 % / 65 % | 4 % / 5 % / 8 % | 1 % |
| 2x | 282.8 | +0.005 | 1.369 | over 50 yr; over 50 yr | −42.6 / −62.0 / −90.0; 111.6R | 12 % / 13 % / 45 % | 1 % / 1 % / 2 % | 1 % |

At 1x, 24 months as measured: total −35.2 / +53.2 / +157.9R (5 / 50 / 95 %), P(total < 0) 17 %; with no edge P(total < 0) 52 %.

## L2

### L2: Sunday-gap fade rule G, six majors (#880)

Trades 2020-01-03 to 2026-10-23, months 2020-01 to 2026-11 (keyed by Friday).

| Cost | trades / yr | mean R | sd | months to t 2 (monthly; from trades) | stop lines: total under at 6 / 12 / 24 m; drawdown over | P(stop in 24 m): as measured (false) / no edge (correct) / losing | P(t ≥ 2): 24 m / 36 m / 60 m as measured | P(t ≥ 2) 24 m, no edge |
|---|---|---|---|---|---|---|---|---|
| 0.5x | 35.13 | +0.243 | 0.887 | 51 (4.2 yr); 18 | −5.0 / −5.0 / −2.3; 13.5R | 13 % / 53 % / 87 % | 27 % / 39 % / 60 % | 4 % |
| 1x | 35.13 | +0.194 | 0.884 | 75 (6.2 yr); 28 (2.4 yr) | −5.8 / −6.5 / −5.2; 15R | 12 % / 44 % / 80 % | 20 % / 28 % / 43 % | 4 % |
| 1.5x | 35.13 | +0.145 | 0.881 | 127 (10.6 yr); 51 (4.2 yr) | −6.6 / −8.1 / −8.4; 16.7R | 12 % / 34 % / 72 % | 14 % / 18 % / 27 % | 4 % |
| 2x | 35.13 | +0.096 | 0.879 | 279 (23.3 yr); 115 (9.6 yr) | −7.5 / −9.7 / −11.6; 18.7R | 12 % / 25 % / 63 % | 9 % / 11 % / 15 % | 4 % |

At 1x, 24 months as measured: total −5.2 / +13.3 / +33.9R (5 / 50 / 95 %), P(total < 0) 12 %; with no edge P(total < 0) 50 %.

### L2b: Sunday-gap fade rule G, six new pairs (#938 S2)

Trades 2016-01-15 to 2026-11-06, months 2016-01 to 2026-11 (keyed by Friday).

| Cost | trades / yr | mean R | sd | months to t 2 (monthly; from trades) | stop lines: total under at 6 / 12 / 24 m; drawdown over | P(stop in 24 m): as measured (false) / no edge (correct) / losing | P(t ≥ 2): 24 m / 36 m / 60 m as measured | P(t ≥ 2) 24 m, no edge |
|---|---|---|---|---|---|---|---|---|
| 0.5x | 44.06 | +0.223 | 0.887 | 27 (2.2 yr); 17 | −3.1 / −1.7 / +2.8; 10.6R | 13 % / 70 % / 97 % | 47 % / 64 % / 86 % | 3 % |
| 1x | 44.06 | +0.153 | 0.886 | 53 (4.4 yr); 37 (3.0 yr) | −4.4 / −4.6 / −2.9; 12.9R | 13 % / 49 % / 90 % | 26 % / 37 % / 56 % | 3 % |
| 1.5x | 44.06 | +0.083 | 0.887 | 168 (14.0 yr); 124 (10.3 yr) | −5.9 / −7.5 / −8.8; 15.9R | 12 % / 29 % / 75 % | 12 % / 15 % / 22 % | 3 % |
| 2x | 44.06 | +0.013 | 0.89 | over 50 yr; over 50 yr | −7.5 / −10.5 / −14.8; 19.8R | 12 % / 14 % / 54 % | 4 % / 4 % / 4 % | 3 % |

At 1x, 24 months as measured: total −2.9 / +13.3 / +30.1R (5 / 50 / 95 %), P(total < 0) 9 %; with no edge P(total < 0) 50 %.

## L3

### L3: Bond month-end, USB10Y CFD (#939 T1)

Trades 2016-01-26 to 2026-10-27, months 2016-01 to 2026-10 (keyed by entry day).

| Cost | trades / yr | mean R | sd | months to t 2 (monthly; from trades) | stop lines: total under at 6 / 12 / 24 m; drawdown over | P(stop in 24 m): as measured (false) / no edge (correct) / losing | P(t ≥ 2): 24 m / 36 m / 60 m as measured | P(t ≥ 2) 24 m, no edge |
|---|---|---|---|---|---|---|---|---|
| 0.5x | 12 | +0.071 | 0.528 | 220 (18.3 yr); 220 (18.3 yr) | −1.7 / −2.2 / −2.5; 4.1R | 12 % / 26 % / 37 % | 11 % / 14 % / 19 % | 3 % |
| 1x | 12 | +0.036 | 0.529 | over 50 yr; over 50 yr | −1.9 / −2.6 / −3.4; 4.7R | 12 % / 18 % / 26 % | 6 % / 7 % / 8 % | 3 % |
| 1.5x | 12 | +0.001 | 0.531 | over 50 yr; over 50 yr | −2.1 / −3.0 / −4.2; 5.3R | 12 % / 12 % / 18 % | 3 % / 3 % / 3 % | 3 % |
| 2x | 12 | −0.035 | 0.533 | never; never | −2.4 / −3.5 / −5.1; 5.9R | 12 % / 7 % / 12 % | 2 % / 1 % / 1 % | 3 % |

At 1x, 24 months as measured: total −3.4 / +0.9 / +5.1R (5 / 50 / 95 %), P(total < 0) 36 %; with no edge P(total < 0) 50 %.

### L3b: Bond month-end, same trades at assumed ZN futures cost (#943)

Trades 2016-01-26 to 2026-10-27, months 2016-01 to 2026-10 (keyed by entry day).

| Cost | trades / yr | mean R | sd | months to t 2 (monthly; from trades) | stop lines: total under at 6 / 12 / 24 m; drawdown over | P(stop in 24 m): as measured (false) / no edge (correct) / losing | P(t ≥ 2): 24 m / 36 m / 60 m as measured | P(t ≥ 2) 24 m, no edge |
|---|---|---|---|---|---|---|---|---|
| 0.5x | 12 | +0.098 | 0.527 | 117 (9.7 yr); 117 (9.7 yr) | −1.5 / −1.8 / −1.9; 3.7R | 12 % / 34 % / 63 % | 16 % / 21 % / 30 % | 3 % |
| 1x | 12 | +0.088 | 0.527 | 142 (11.8 yr); 142 (11.8 yr) | −1.6 / −2.0 / −2.1; 3.9R | 12 % / 31 % / 60 % | 14 % / 18 % / 26 % | 3 % |
| 1.5x | 12 | +0.080 | 0.527 | 176 (14.7 yr); 176 (14.7 yr) | −1.7 / −2.1 / −2.3; 4R | 12 % / 29 % / 57 % | 13 % / 16 % / 22 % | 3 % |
| 2x | 12 | +0.070 | 0.528 | 225 (18.7 yr); 225 (18.7 yr) | −1.7 / −2.2 / −2.5; 4.1R | 12 % / 26 % / 54 % | 11 % / 14 % / 18 % | 3 % |

At 1x, 24 months as measured: total −2.1 / +2.1 / +6.4R (5 / 50 / 95 %), P(total < 0) 20 %; with no edge P(total < 0) 50 %.

## L4

### L4: Index overnight long, NAS100 CFD (T2)

Trades 2016-01-04 to 2026-10-29, months 2016-01 to 2026-10 (keyed by entry time (UTC date)).

| Cost | trades / yr | mean R | sd | months to t 2 (monthly; from trades) | stop lines: total under at 6 / 12 / 24 m; drawdown over | P(stop in 24 m): as measured (false) / no edge (correct) / losing | P(t ≥ 2): 24 m / 36 m / 60 m as measured | P(t ≥ 2) 24 m, no edge |
|---|---|---|---|---|---|---|---|---|
| 0.5x | 251.17 | +0.010 | 0.415 | 270 (22.5 yr); 320 (26.7 yr) | −5.8 / −7.2 / −8.8; 15.6R | 12 % / 25 % / 35 % | 10 % / 12 % / 16 % | 3 % |
| 1x | 251.17 | −0.006 | 0.415 | never; never | −7.7 / −11.2 / −16.8; 20.9R | 12 % / 7 % / 12 % | 1 % / 1 % / 0 % | 3 % |
| 1.5x | 251.17 | −0.022 | 0.415 | never; never | −9.7 / −15.2 / −24.7; 27.4R | 11 % / 2 % / 3 % | 0 % / 0 % / 0 % | 3 % |
| 2x | 251.17 | −0.038 | 0.415 | never; never | −11.7 / −19.2 / −32.8; 34.7R | 11 % / 1 % / 1 % | 0 % / 0 % / 0 % | 3 % |

At 1x, 24 months as measured: total −16.8 / −3.0 / +10.7R (5 / 50 / 95 %), P(total < 0) 64 %; with no edge P(total < 0) 50 %. Not positive at 1x: its stop lines at 1x are lines of a losing stream and are shown for completeness only.

### L4b: Index overnight long, US500 CFD (T1)

Trades 2016-01-04 to 2026-10-29, months 2016-01 to 2026-10 (keyed by entry time (UTC date)).

| Cost | trades / yr | mean R | sd | months to t 2 (monthly; from trades) | stop lines: total under at 6 / 12 / 24 m; drawdown over | P(stop in 24 m): as measured (false) / no edge (correct) / losing | P(t ≥ 2): 24 m / 36 m / 60 m as measured | P(t ≥ 2) 24 m, no edge |
|---|---|---|---|---|---|---|---|---|
| 0.5x | 251.17 | +0.000 | 0.426 | over 50 yr; over 50 yr | −7.5 / −10.4 / −14.7; 20R | 12 % / 12 % / 44 % | 3 % / 3 % / 3 % | 3 % |
| 1x | 251.17 | −0.022 | 0.426 | never; never | −10.2 / −15.8 / −25.6; 28.6R | 11 % / 2 % / 11 % | 0 % / 0 % / 0 % | 3 % |
| 1.5x | 251.17 | −0.044 | 0.427 | never; never | −12.9 / −21.4 / −36.9; 38.7R | 11 % / 0 % / 2 % | 0 % / 0 % / 0 % | 3 % |
| 2x | 251.17 | −0.066 | 0.428 | never; never | −15.8 / −27.1 / −48.2; 49.5R | 11 % / 0 % / 0 % | 0 % / 0 % / 0 % | 3 % |

At 1x, 24 months as measured: total −25.6 / −10.9 / +3.4R (5 / 50 / 95 %), P(total < 0) 90 %; with no edge P(total < 0) 50 %. Not positive at 1x: its stop lines at 1x are lines of a losing stream and are shown for completeness only.

## What the demo route lacks today

council-data ctrader/symbols.json (2026-11-14T02:55:38.225Z): the symbols the mirror maps, not the broker's whole catalogue. Listed: XAUUSD, EURUSD, GBPUSD, AUDUSD, USDCAD, USDCHF, BTCUSD, ETHUSD, SOLUSD, NAS100, US500, US30, US2000.

- **L1** needs USD/JPY (and for L1b GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY) quoted and filled at 00:55 and 06:00 UTC on gotobi days. On the list: USDJPY no, GBPJPY no, AUDJPY no, CADJPY no, CHFJPY no. no yen pair is on the mirror's list, so no spread, fill or commission of a yen pair has ever been read on this route (the spread log reads only listed symbols).
- **L2** needs EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CHF, EUR/JPY filled in the first five minutes after the Sunday 17:00 New York reopen. On the list: EURUSD yes, GBPUSD yes, USDJPY no, AUDUSD yes, USDCHF yes, EURJPY no. two of the six (USD/JPY, EUR/JPY) are not listed; the spread log holds no Sunday read of any pair, and the broker's forex session opens at 17:02 New York, so the reopen candle the rule fades and its slippage have never been seen on this route.
- **L3** needs a 10-year Treasury CFD (OANDA USB10Y_USD in the study) held over the last three US trading days of each month, with its financing. On the list: bond no. no bond symbol is on the mirror's list; the study's CFD is OANDA's, and the futures cost (#943) is not a demo route at all.
- **L4** needs NAS100 / US500 bought at the 16:00 New York cash close and sold at the next 09:30 open, with the swap charged. On the list: NAS100 yes, US500 yes. both indices are listed and quoted (one day of reads, 12-13 Nov); what is missing is a writer: no council member opens a trade at the cash close, and the spread at 16:00 New York and the swap actually charged on a held CFD have not been read. Swap on a long (the broker's own figure, swap type 1): NAS100 -6.18, US500 -6.18; median spread outside the rollover NAS100 0.8, US500 0.3 points.

## Reading, and suggestions (for the owner; nothing here is done)

- Every lead turns on a cost nobody has measured at the minute it trades. Before any forward paper stream, the cheapest step is to MEASURE that cost: read bid / ask (and, on a demo account that lists the symbol, a fill) at the lead's own minutes for a few weeks. That is a data writer, not a trading rule, and would itself need the owner to approve adding symbols to the demo account.
- A forward record only helps where its expected t of 2 comes in a time the owner would wait; where it needs many years at 1x, the record would only ever show the cost, not the edge.
- No owner-decisions item is written by this study. If the owner wants any of this, it is a new rule with its own pre-registration (the stop lines above, fixed before the first trade), paper and demo only.

Files: `PREREGISTRATION.md`, `extract.mjs` (inputs), `inputs.json`, `run.mjs`, `result.json`. Test: `tests/lead-forward-plan.test.mjs`.
