# Forex Sunday-open gap fade, Rule G frozen: second replication (14 Nov 2026)

**Verdict: PARTLY.** Rule G, frozen byte for byte, held on six pairs neither earlier study traded, 2016 to now (S2: n 481,
+0.153R a trade after costs, monthly t 3.19, Holm-adjusted p 0.0014), but not on the first replication's six crosses over
2010-2019 (S1: n 588, +0.061R a trade, monthly t 1.02, Holm-adjusted p 0.1535). The pre-registered "REPLICATES" needed both;
one test holding is "PARTLY". Not an edge; no proposal; nothing live changed.

Read S2 with care: new pair-weeks, mostly old weekends. 386 of its 481 trades fall on a weekend on which #880 or #928 also
took a Rule G trade (the 95 others made +0.160R a trade, about the same). It is positive in every one of its eleven years
(best year 2026, 21 % of the total), but at 2 pips of slippage a side it keeps only +0.066R a trade and at twice the base
cost +0.013R (monthly t 0.29). S1, the stretch outside every decisive window, is flat once 2015 is taken out: 2015 alone
carries 81 % of its total, and without it S1 is +0.013R a trade (monthly t 0.22).

Paper research only. The pairs, windows, per-pair costs, statistics and the reading were committed alone before this code
existed (`PREREGISTRATION.md`, commit 091bd871). `frozen.mjs` is #928's `frozen.mjs` byte for byte, which is #880's
`research/edge/fx-weekend-gap/run.mjs` byte for byte, sha256 `3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273`
(pinned by the test). Nothing in it was edited; nothing is imported across branches. `run.mjs` copies #928's window selection.

## The gate

#880's six majors were fetched again through the same proxy (1 Nov 2015 to 12 Nov 2026; candle counts equal #880's on every
pair). The frozen `study()` on them reproduces #880's published Rule G exactly: the 2020-to-now and 2016-19 statistics objects
(n 243, net +0.194R, monthly t 2.14; n 173, +0.034R, 0.39) and the full trade list (416 trades) are identical, and `run.mjs`'s
own window path gives the same 2020-to-now statistics. **Gate: passed.**

## Data and costs (as pre-registered)

- **S1**: EUR/GBP, GBP/JPY, AUD/JPY, EUR/AUD, GBP/AUD, EUR/CHF (#928's crosses); weeks with Friday 1 Jan 2010 to 31 Dec 2019.
  #928 read these crosses only from 1 Nov 2019 and traded them only from 2020.
- **S2**: NZD/USD, USD/CAD, CAD/JPY, NZD/JPY, AUD/NZD, AUD/CAD (in neither study); weeks with Friday 1 Jan 2016 to 6 Nov 2026.
- OANDA mid M5 through the site's candle proxy (`fetch.mjs`), about 766,000 candles a cross (Nov 2009 to 10 Jan 2020) and
  822,000 a new pair (Nov 2015 to 13 Nov 2026); file hashes in `result.json`.
- Costs: #880's formula (quoted spread + 1 pip slippage a side + 22.5 per million a side; stress 2 pips a side). Quoted spread:
  #928's table on the crosses (EUR/GBP 0.4, EUR/CHF 0.5, AUD/JPY 0.6, GBP/JPY 0.9, EUR/AUD 0.9, GBP/AUD 1.3); USD/CAD 0.3;
  assumed NZD/USD 0.4, AUD/CAD 0.8, CAD/JPY 0.8, AUD/NZD 1.0, NZD/JPY 1.0. No trade crossed a weekday 22:00 UTC rollover.

## Results

| Test | n | win | gross R | net R (base) | net R (stress) | net R (2x cost) | net R (0.3 pip) | t (trades) | t (months) | p | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 | 588 | 60 % | +0.179 | +0.061 | −0.013 | −0.058 | +0.074 | 1.60 | 1.02 | 0.1535 | 0.1535 |
| S2 | 481 | 65 % | +0.293 | +0.153 | +0.066 | +0.013 | +0.174 | 3.79 | 3.19 | 0.0007 | 0.0014 |
| S3 | 1069 | 62 % | +0.230 | +0.102 | +0.022 | −0.026 | +0.119 | 3.69 | 2.48 | 0.0065 | (not in the family) |

- The bar (net > 0, monthly t ≥ 2, Holm p < 0.05, n ≥ 150): S1 net yes, t no (1.02), Holm no, n yes: does not hold. S2 all
  four: holds. One of two: "PARTLY".
- Totals at base cost: S1 +35.7R (worst closed drawdown 31.2R, 109 months with a trade), S2 +73.7R (drawdown 7.6R, 105 months).
  Monthly t at 2x cost: S1 −0.96, S2 0.29, S3 −0.62.
- Exits: S1 296 targets, 201 stops, 4 gapped stops, 87 time exits; S2 276, 128, 3, 74. Median risk 36.5 pips (S1) and 25.2
  pips (S2); median base cost 0.091R and 0.127R a trade, so S2 is the more cost-sensitive of the two.
- No-trade: S1 3 filled inside the first candle, 7 risk under 0.1 x ATR; S2 2 and 9. Weeks skipped a pair: 3 Fridays without
  afternoon trading, 4-5 (S1) and 7 (S2) reopens after 21:00 New York.

### Weekend overlap with the two earlier studies (by Friday)

| Test | trades | on a #880 weekend | on a #928 weekend | on either | on neither (net R) |
|---|---|---|---|---|---|
| S1 | 588 | 197 | 328 | 525 of 588 | 63 (−0.072) |
| S2 | 481 | 364 | 220 | 386 of 481 | 95 (+0.160) |

S1's weekends are #880's 2016-19 replication weekends and #928's 2010-15 majors weekends (no S1 weekend is in either decisive
window); S2's are #880's and #928's crosses' weekends. Only the pair-weeks are new.

### By year (net R a trade, n) and the best year's share

- S1: 2010 +0.19 (74), 2011 −0.16 (55), 2012 −0.14 (65), 2013 −0.05 (64), 2014 +0.00 (63), 2015 +0.62 (47), 2016 −0.00 (56),
  2017 +0.10 (60), 2018 −0.03 (51), 2019 +0.16 (53). Best year 2015, +28.9R of +35.7R (81 %); without it n 541, +0.013R,
  monthly t 0.22.
- S2: 2016 +0.13 (56), 2017 +0.05 (47), 2018 +0.04 (52), 2019 +0.17 (43), 2020 +0.06 (37), 2021 +0.04 (24), 2022 +0.45 (32),
  2023 +0.18 (31), 2024 +0.24 (26), 2025 +0.16 (63), 2026 +0.22 (70). Best year 2026, +15.6R of +73.7R (21 %); without it
  n 411, +0.141R, monthly t 2.75.

### By pair (net R at base cost, monthly t; not in the reading)

| S1 pair | n | net R | monthly t | | S2 pair | n | net R | monthly t |
|---|---|---|---|---|---|---|---|---|
| eurgbp | 94 | +0.010 | 0.08 | | nzdusd | 69 | +0.034 | 0.30 |
| gbpjpy | 88 | +0.038 | 0.35 | | usdcad | 51 | +0.115 | 0.97 |
| audjpy | 120 | +0.010 | 0.11 | | cadjpy | 78 | +0.013 | 0.13 |
| euraud | 106 | +0.109 | 1.11 | | nzdjpy | 94 | +0.164 | 1.75 |
| gbpaud | 106 | +0.159 | 1.62 | | audnzd | 102 | +0.339 | 3.74 |
| eurchf | 74 | +0.027 | 0.27 | | audcad | 87 | +0.167 | 1.81 |

## Placebo (40 seeds, random direction on each test's own trades, same costs)

| Test | Rule G | placebo 5th | median | 95th | max | runs at or above Rule G |
|---|---|---|---|---|---|---|
| S1 | +0.061 | −0.184 | −0.135 | −0.054 | −0.052 | 0 of 40 |
| S2 | +0.153 | −0.209 | −0.136 | −0.053 | −0.049 | 0 of 40 |
| S3 | +0.102 | −0.175 | −0.142 | −0.079 | −0.074 | 0 of 40 |

S2 holds and its mean is above its placebo's 95th percentile, so by the pre-registered check it is not inside the placebo band.
On S1 too the direction toward Friday's close was worth more than chance before costs (+0.18R gross); the costs took most of it.

## Post hoc (chosen after the result, not evidence)

- S2 by calendar block: 2016-19 +0.097R a trade (n 198), 2020 to now +0.193R (n 283). The first study's majors were about zero
  in 2016-19; these pairs were not.
- AUD/NZD carries the largest share of S2 (+34.6R of +73.7R, monthly t 3.74 alone); without it S2 is about +0.10R a trade.
- S1's 2015 is the year of the Swiss franc's de-peg and of large Sunday gaps across the crosses: one year of unusual weekends.

## What this does not say

- It does not say the forex gap fade is an edge: three tests of the frozen rule on data outside #880's decisive window (#928's
  R2, S1, S2) give one that holds (S2), and that one sits on the same weekends as the earlier positive results and loses most
  of its margin at realistic reopen costs.
- S2's quoted spreads are stated assumptions on five of its six pairs; the reopen fill is modelled at the mid plus a fixed
  slippage, as in #880. The real reopen spread on these less liquid pairs can be several pips.
- Any further test needs its own pre-registration on data not yet read, not a re-cut of these weeks.
