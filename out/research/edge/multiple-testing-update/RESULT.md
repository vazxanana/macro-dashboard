# Result: multiple testing, update of the 13-14 Nov count with the studies pushed since (14 Nov 2026)

**Verdict: no test survives a correction across all 333 (the 248 of #904 plus 85 new): Holm 0, BH q 0.10 0; t >= 2 in 6 against 7.6 expected by chance; with an independent replication on other years, only the gotobi fade stays under the family's Bonferroni line (Fisher p 3.6e-6, independence assumed), and it is not a net edge until the broker spread at the fix is measured.**

- **Holm across all 333 decisive tests: 0 survive. BH at q 0.10: 0; at q 0.05: 0.** Bonferroni needs p < 1.50e-4 (t ≥ 3.62).
- **t ≥ 2: 6 observed against 7.6 expected by chance** (Poisson 95 % range 3-13); t ≤ −2: 83. The 85 new tests alone: t ≥ 2 in 0 against 1.9 expected; t ≤ −2 in 36; Holm 0, BH q 0.10 0.
- **Hypotheses still standing** (an independent replication on years the original never used, combined evidence under the family's Bonferroni line): gotobi. Every other replicated hypothesis falls short; details below.

Paper research only: nothing live, no study, rule or stored figure changed; no market data fetched. Pre-registration: `PREREGISTRATION.md` (pushed alone first). Inputs: `collected.json` (built by `node run.mjs collect` from each study's own branch and #904's `inputs.json`); numbers: `result.json`.

## (b) Hypotheses with a replication, and their combined evidence

Fisher, −2 Σ ln p on 2k df, assumes independent p's. **Calendar-disjoint** (the pre-registered reading): the original plus replications on years it never used; two replications that share years on other instruments (and that no study pooled) are each combined with the original on their own, and the weaker result is shown. **All cells** adds the replications on the same years and other instruments: those share the same days (the studies say so), so that figure overstates the evidence and is an upper bound only. A robustness re-run on the same days is never combined.

| Hypothesis | Original (t, one-sided p) | Replications (t) | Fisher, calendar-disjoint | Fisher, all cells (upper bound) |
|---|---|---|---|---|
| Gotobi fade: sell USD/JPY at the 09:55 Tokyo fix on gotobi days, out at 15:00 Tokyo (#878 T2) | #878 gotobi: T2: t 2.74, p 0.0031 | R2 USD/JPY 2005-09 3.80; R1 crosses pooled 2.75 (same years) | p 3.63e-6 (z 4.49; R2 USD/JPY 2005-09) **under Bonferroni** | p 1.63e-7 (z 5.11) |
| Forex Sunday-open gap fade, rule G (#880 G) | #880 fx-weekend-gap: G: t 2.14, p 0.0161 | R1 crosses 2020-26 2.99 (same years); R2 majors 2010-15 0.03; S1 crosses 2010-19 1.02; S2 new pairs 2016-26 3.19 (same years) | p 0.0461 (z 1.68; R2 majors 2010-15) | p 1.11e-5 (z 4.24) |
| Index rebound after a volatility spike, 10-day hold (#860) | #860 vol-spike-rebound: 10-day hold: t 2.53, p 0.0057 | R1 other indices 2016-26 1.20 (same years); R2 other indices 2005-15 −0.52 | p 0.0260 (z 1.94; R2 other indices 2005-15) | p 0.0175 (z 2.11) |
| Index IBS daily reversal (#895, pooled) | #895 index-ibs: pooled (from #924 gate): t 0.64, p 0.2611 | R1 other indices 2016 → −1.97 (same years); R2 other indices 2005-15 1.06 | p 0.1614 (z 0.99; R2 other indices 2005-15) | p 0.3591 (z 0.36) |
| Index RSI(2) pullback (#838) | #838 rsi2-pullback: spx500: t 2.02, p 0.0217 | pooled 0.85 (same years); pooled −1.79 (same years) | none on other years | p 0.0891 (z 1.35) |
| Turnaround Tuesday (#857) | #857 turnaround-tuesday: nas100-r2: t 2.33, p 0.0099 | pooled 1.69 (same years) | none on other years | p 0.0039 (z 2.66) |

Sensitivity, not pre-registered: the original p multiplied by its own study's number of decisive tests (its selection among them), then the calendar-disjoint Fisher: gotobi p 1.33e-5; weekend-gap p 0.0812; vol-spike p 0.0464; ibs p 0.3599.

### In plain words

**Gotobi fade: sell USD/JPY at the 09:55 Tokyo fix on gotobi days, out at 15:00 Tokyo (#878 T2).** On years the original never used, combined p 3.63e-6, under the family's Bonferroni line (1.50e-4). Robustness on the same days: #894 gotobi-feed: HistData USD/JPY t 2.34 (second feed, same 2018-26 days (per-trade correlation 0.997)); #912 FEED-CONFIRMED; #908 the result sits on the 00:55 entry minute; #915 NOT CAPTURABLE. At twice the assumed spread the edge is about zero on every feed (#878, #893, #894); the broker spread at 00:55 UTC (yen spread log, #897) decides whether it is tradable. It sits on the one entry minute: one minute late keeps about a third of it (#908 OANDA, #912 HistData), and a resting limit placed before the fix does not capture it (#915). Whether the fix-minute move is special to gotobi days is unclear (#917: on ordinary days the same fade loses, t −2.37; gotobi minus ordinary days at the fix minute t −0.25).

**Forex Sunday-open gap fade, rule G (#880 G).** On years the original never used, combined p 0.0461 (the other way to pair the shared years gives p 0.0173 with S1 crosses 2010-19), not under the family's Bonferroni line (1.50e-4). Counting the replications on the same years too gives p 1.11e-5, under the line, but only by counting the same days again on other instruments. Both replications read PARTLY: it holds on other pairs over the SAME weekends (R1 t 2.99, S2 t 3.19) and not on years the first study never traded (R2 t 0.03; S1 t 1.02, flat without 2015). Costs: at 2 pips of slippage a side or twice the base cost most of it goes (R1 2x cost month t 1.44; S2 2x cost +0.013R a trade); crosses' spreads are assumed, not measured. 2026 carries most of the 2020-26 total (#928: +39.7R of +70.1R).

**Index rebound after a volatility spike, 10-day hold (#860).** On years the original never used, combined p 0.0260, not under the family's Bonferroni line (1.50e-4). #920 reads PARTLY: R1 t 1.20, HK33 (n 27) is most of the total; under the random-entry 95th percentile; near zero at 2x costs.

**Index IBS daily reversal (#895, pooled).** On years the original never used, combined p 0.1614, not under the family's Bonferroni line (1.50e-4). #924: DOES NOT REPLICATE (R1 month t −1.97).

**Index RSI(2) pullback (#838).** No replication on other years; the replications on the same years cannot be combined honestly. Both frozen replications failed (#844 t 0.85, #873 t −1.79).

**Turnaround Tuesday (#857).** No replication on other years; the replications on the same years cannot be combined honestly. #862 failed its bar (t 1.69).

**Short soybeans July to September (#934 T2)** (no replication study, one robustness check). Decisive t 1.38 over 11 years, one-sided p 0.0843 by this count's rule (the study's own permutation p 0.01195, Holm 0.03585); across all 333: Holm 1.0000, BH q 1.0000. Post hoc, shown only: with the study's own 2003-15 window (t 1.83) Fisher p 0.0196. Three of its eleven decisive years were stopped at about −1R (2026 among them). FRAGILE (#937): ten trading days later the 2016-26 result turns negative (−0.041R a year); −5 days keeps +0.057R. No second feed could be read. The 2003-15 window (the same study, pre-registered with it) is positive (+1.186R a year, t 1.83), but those years are likely part of what the seasonal was drawn from (#937).

Combined evidence for a gross or paper effect is not a net, tradable edge, and nothing here changes a live rule: any use stays the owner's decision.

## (a) The smallest p across all tests

| Test | n | t | one-sided p | Holm over all | BH q | BY q |
|---|---|---|---|---|---|---|
| #878 gotobi: T2 | 771 | 2.74 | 0.0031 | 1.0000 | 0.9491 | 1.0000 |
| #860 vol-spike-rebound: 10-day hold | 165 | 2.53 | 0.0057 | 1.0000 | 0.9491 | 1.0000 |
| #857 turnaround-tuesday: nas100-r2 | 81 | 2.33 | 0.0099 | 1.0000 | 1.0000 | 1.0000 |
| #878 gotobi: T3 | 765 | 2.20 | 0.0139 | 1.0000 | 1.0000 | 1.0000 |
| #880 fx-weekend-gap: G | 243 | 2.14 | 0.0161 | 1.0000 | 1.0000 | 1.0000 |
| #838 rsi2-pullback: spx500 | 99 | 2.02 | 0.0217 | 1.0000 | 1.0000 | 1.0000 |
| #860 vol-spike-rebound: 5-day hold | 216 | 1.95 | 0.0253 | 1.0000 | 1.0000 | 1.0000 |
| #815 cycle-gate: geg G1 | 106 | 1.90 | 0.0290 | 1.0000 | 1.0000 | 1.0000 |
| #838 rsi2-pullback: us30 | 102 | 1.88 | 0.0301 | 1.0000 | 1.0000 | 1.0000 |
| #878 gotobi: T4 | 771 | 1.84 | 0.0329 | 1.0000 | 1.0000 | 1.0000 |
| #901 cb-days-other: RBA (new) | 89 | 1.73 | 0.0418 | 1.0000 | 1.0000 | 1.0000 |
| #895 index-ibs: T2 | 473 | 1.65 | 0.0495 | 1.0000 | 1.0000 | 1.0000 |
| #901 cb-days-other: RBNZ (new) | 54 | 1.52 | 0.0643 | 1.0000 | 1.0000 | 1.0000 |
| #896 ecb-boj-days: ECB EUR/USD | 71 | 1.51 | 0.0655 | 1.0000 | 1.0000 | 1.0000 |
| #856 crypto-sma200: btc-sma200 | — | 1.49 | 0.0680 | 1.0000 | 1.0000 | 1.0000 |

Tests with t ≥ 2: #838 rsi2-pullback: spx500; #857 turnaround-tuesday: nas100-r2; #860 vol-spike-rebound: 10-day hold; #878 gotobi: T2; #878 gotobi: T3; #880 fx-weekend-gap: G.

## Sensitivity: replication tests included

N = 347 (the family plus 14 replication tests: #904's six and the new ones in each replication study's own Holm family). t ≥ 2: 11 (expected 7.9). Holm across all: #889 gotobi-replicate: R2 USD/JPY 2005-09. BH q 0.05: #889 gotobi-replicate: R2 USD/JPY 2005-09; q 0.10: #889 gotobi-replicate: R2 USD/JPY 2005-09. Replications of a rule that already passed are not exchangeable with new hypotheses: shown, not judged.

## What went in

- #904's 248 family tests exactly as in its `inputs.json`, plus 85 decisive tests of 31 new studies (#901, #902, #905, #906, #907, #909, #910, #911, #913, #914, #916, #917, #918, #919, #921, #922, #923, #925, #926, #927, #929, #930, #931, #932, #933, #934, #935, #936, #939, #940, #941).
- Replication studies (not in the primary family): #920, #924, #928, #938. Robustness reports on the same days (no test, never combined): #908, #912, #915, #937. Left out: #827 vix-term (not run (Cboe not reachable)); #893 gotobi-cost (cost accounting, no rule tested); #897 yen-spread-log (build (spread log), not a study); #900 index-futures-cost (cost accounting of existing trades, no rule tested).
- Not parsed: #815 cycle-gate: gtrend G1 (no t or p stored for this test (not computed: too few blocked trades)); #815 cycle-gate: gtrend5 G1 (no t or p stored for this test (not computed: too few blocked trades)).
- How the pre-registered rule was applied where it needed a reading: (1) #919 pre-registered two-sided weekday tests with no direction: its stored two-sided p is used as is, and its t is the one-sided normal equivalent of that p. (2) #934 stores a t over years and judged on a permutation p; the rule converts the stored t (p 0.084 for the soybean short against the study's own 0.012). (3) #909 stores a z (Jobson-Korkie-Memmel) for each test; #939 stores only a one-sided p. (4) #894 (HistData, the same 2018-26 days) was a replication in #904; here it is a robustness re-run and is not in Fisher, so the gotobi figure is #904's two-p one. (5) #895's original for the IBS hypothesis is its pooled decisive test (the rule #924 froze), read from #924's gate, where it is reproduced exactly; #838 and #857 have no single frozen test, so their smallest p stands in (named in the table).
- Tests within a study, and replications on the same days, are correlated: BH is valid under positive dependence only (Benjamini-Yekutieli is beside it), and the Poisson range for the count of t ≥ 2 assumes independence.

Tests: `tests/multiple-testing-update.test.mjs`.
