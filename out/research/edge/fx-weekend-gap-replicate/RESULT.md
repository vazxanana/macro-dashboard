# Forex Sunday-open gap fade, Rule G frozen: replication (14 Nov 2026)

**Verdict: PARTLY.** Rule G, frozen byte for byte, made +0.238R a trade after costs on six forex crosses over 2020 to now
(R1: n 294, monthly t 2.99, Holm-adjusted p 0.0028), but nothing on the first study's six majors over 2010-2015 (R2: n 297,
+0.003R a trade, monthly t 0.03, Holm-adjusted p 0.4889). The pre-registered "REPLICATES" needed both; one positive test with
t ≥ 1 is "PARTLY". Not an edge; no proposal; nothing live changed.

Read R1 with care: it shares its calendar with the first study's decisive window. 228 of its 294 trades fall on weekends on
which the first study also traded a major, and, as there, 2026 carries most of it (+39.7R of +70.1R). The six crosses of one
weekend and the majors of that weekend are largely the same few dollar and yen moves. The out-of-time test (R2, six years
the first study never traded) is the cleaner one, and it is flat before stress costs and negative after them.

Paper research only. The data, windows, per-pair costs, statistics and reading were committed before this code existed
(`PREREGISTRATION.md`, commit 749b59c2). `frozen.mjs` is `research/edge/fx-weekend-gap/run.mjs` of branch `fx-weekend-gap`
(#880) byte for byte, sha256 `3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273` (pinned by the test);
nothing in it was edited and nothing is imported across branches.

## The gate

The frozen `study()` on #880's own candle files (OANDA mid M5 of its six majors, 1 Nov 2015 to 12 Nov 2026) reproduces #880's
published Rule G exactly: the 2020-to-now and 2016-19 statistics objects (n 243, net +0.194R, monthly t 2.14; n 173, +0.034R,
0.39) and the full trade list are identical, and `run.mjs`'s own window path gives the same 2020-to-now statistics. **Gate:
passed.**

## Data and costs (as pre-registered)

- **R1**: EUR/GBP, GBP/JPY, AUD/JPY, EUR/AUD, GBP/AUD, EUR/CHF; weeks with Friday 1 Jan 2020 to 12 Nov 2026 (the years of
  #880's decisive window). EUR/CHF replaces the EUR/JPY of the request: EUR/JPY on 2020 to now was #880's own data.
- **R2**: #880's majors (EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CHF, EUR/JPY); weeks with Friday 1 Jan 2010 to 31 Dec 2015.
  #880 read candles from 1 Nov 2015 (ATR warm-up only) and traded weeks from 2016 to 12 Nov 2026.
- OANDA mid M5 through the site's candle proxy (`fetch.mjs`), about 524,000 candles a cross (Nov 2019 on) and 466,000 a major
  (Nov 2009 to 10 Jan 2016); file hashes in `result.json`.
- Costs: #880's formula (spread + 1 pip slippage a side + 22.5 per million a side; stress 2 pips a side). Quoted spread 0.3 pip
  on the majors; assumed on the crosses (none is measured in the repository): EUR/GBP 0.4, EUR/CHF 0.5, AUD/JPY 0.6, GBP/JPY
  0.9, EUR/AUD 0.9, GBP/AUD 1.3. No trade crossed a weekday 22:00 UTC rollover (financing 0).

## Results

| Test | n | win | gross R | net R (base) | net R (stress) | net R (2x cost) | t (trades) | t (months) | p | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|
| R1 | 294 | 69 % | +0.365 | +0.238 | +0.158 | +0.112 | 4.72 | 2.99 | 0.0014 | 0.0028 |
| R2 | 297 | 56 % | +0.088 | +0.003 | −0.059 | −0.083 | 0.05 | 0.03 | 0.4889 | 0.4889 |
| R3 | 591 | 62 % | +0.226 | +0.120 | +0.049 | +0.014 | 3.21 | 1.95 | 0.0257 | (not in the family) |

- The reading: R1 > 0 with Holm p < 0.05 (yes); R2 > 0 (barely, +0.003R) but Holm p 0.4889 (no). So not "REPLICATES"; R1 has
  t ≥ 1, so "PARTLY".
- Totals at base cost: R1 +70.1R (worst closed drawdown 9.8R, 62 months with a trade), R2 +0.8R (drawdown 33.4R), R3 +70.9R.
  Monthly t at 2x cost: R1 1.44, R2 −0.91, R3 0.23.
- Exits: R1 178 targets, 69 stops, 1 gapped stop, 46 time exits; R2 137 targets, 119 stops, 41 time exits. Median risk 34 pips
  (R1) and 38 pips (R2); median base cost 0.109R and 0.076R a trade.
- No-trade: R1 5 filled inside the first candle, 3 risk under 0.1 x ATR; R2 3 risk under 0.1 x ATR. Weeks skipped: 2 Fridays
  without afternoon trading a pair in both tests and 3 reopens after 21:00 New York a cross.

### By pair (net R at base cost, not in the reading)

| R1 pair | n | net R | monthly t | | R2 pair | n | net R | monthly t |
|---|---|---|---|---|---|---|---|---|
| eurgbp | 57 | +0.216 | 1.68 | | eurusd | 52 | +0.022 | 0.13 |
| gbpjpy | 41 | +0.145 | 1.17 | | gbpusd | 35 | −0.129 | -0.68 |
| audjpy | 51 | +0.360 | 3.28 | | usdjpy | 40 | +0.074 | 0.45 |
| euraud | 42 | +0.351 | 2.62 | | audusd | 71 | +0.161 | 1.36 |
| gbpaud | 56 | +0.309 | 2.19 | | usdchf | 42 | +0.166 | 1.16 |
| eurchf | 47 | +0.031 | 0.23 | | eurjpy | 57 | −0.302 | -2.52 |

By year, net R a trade (n): R1 2020 −0.18 (46), 2021 +0.33 (28), 2022 +0.07 (34), 2023 +0.03 (11), 2024 +0.32 (25), 2025 +0.27
(71), 2026 +0.50 (79). R2 2010 +0.19 (58), 2011 −0.34 (56), 2012 −0.06 (51), 2013 +0.09 (51), 2014 +0.02 (44), 2015 +0.16 (37).

## Placebo (40 seeds, random direction on each test's own trades, same costs)

| Test | Rule G | placebo 5th | median | 95th | max | runs at or above Rule G |
|---|---|---|---|---|---|---|
| R1 | +0.238 | −0.189 | −0.130 | −0.058 | −0.038 | 0 of 40 |
| R2 | +0.003 | −0.181 | −0.097 | −0.020 | +0.017 | 1 of 40 |
| R3 | +0.120 | −0.153 | −0.109 | −0.031 | −0.014 | 0 of 40 |

The placebo's mean sits near minus the cost, as it should. On R2 Rule G's direction was worth about the cost and no more.

## Also reported (not in the reading)

- R1 at #880's flat 0.3-pip quote instead of the assumed cross spreads: n 294, +0.252R, monthly t 3.14. The cross spread
  assumption moves R1 by about 0.013R a trade.

## Post hoc (chosen after the result, not evidence)

- 228 of R1's 294 trades fall on a weekend on which #880 also took a Rule G trade (+0.237R a trade on those, +0.245R on the 66
  others); R1 2020-25 alone: n 215, +0.142R a trade. R1 is a second look at the same weekends through other pairs more than
  new history.

## What this does not say

- It does not say the forex gap fade is worthless: R1 is positive, above every placebo run, and survives 2x costs. It says the
  rule did not hold on six years of its own markets outside the first study's window, which is what "REPLICATES" required.
- The crosses' quoted spreads are stated assumptions, not measured quotes; the reopen fill is modelled at the mid plus a fixed
  slippage, as in #880.
- Any further test needs its own pre-registration on data not yet read (2004-09, or other markets), not a re-cut of these weeks.
