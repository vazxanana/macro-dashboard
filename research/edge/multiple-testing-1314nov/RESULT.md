# Result: multiple testing across the studies of 13-14 Nov 2026 (14 Nov 2026)

**Verdict: no decisive test of the day survives a correction across all 248 (Holm 0, BH q 0.10 0); gotobi T2: (a) BH q 0.7068 fails q 0.10, (b) Holm 0.7618 fails; with its frozen USD/JPY 2005-09 replication, Fisher p 3.6e-6 (independence assumed)**

Across all **N = 248** decisive tests of the original studies (one-sided p, edge positive), **6** had t ≥ 2 against **5.6** expected under the null (Poisson 95 % range 2-11). Bonferroni needs p < 0.0002 (t ≥ 3.54). **Holm across all: 0 survive. BH at q 0.05: 0; at q 0.10: 0.**

**Gotobi T2** (#878, t 2.74, one-sided p 0.0031): (a) BH q across all 248 = **0.7068**: **does not survive** q 0.10; (b) Holm across all = **0.7618**: **does not survive** at 0.05. (c) Fisher on the original + USD/JPY 2005-09 + HistData feed: χ² 39.92 on 6 df, p **4.72e-7** (z 4.90); on the original + USD/JPY 2005-09 only (the one confirmation on new days): χ² 30.64 on 4 df, p **3.63e-6** (z 4.49). Both are under the family's Bonferroni line (0.0002): yes.

Paper research only: nothing live, no study, rule or stored figure changed. Pre-registration: `PREREGISTRATION.md` (pushed alone first). Inputs: `inputs.json` (built by `build-inputs.mjs` from each study's own branch); numbers: `result.json`.

## Reading

- On their own decisive windows the day's tests look like chance. 6 results at t ≥ 2 against 5.6 expected is inside the chance range; 47 tests sat at t ≤ −2 (costs push most rules below zero, so the null "no edge after costs" is generous to the rules and the count of t ≥ 2 is if anything optimistic for them). 11 of 248 p's are under 0.05 against 12.4 expected.
- Even the gotobi T2 test does not keep a false-discovery q under 0.10 and it does not survive Holm over all 248: on the 2016-26 window alone it cannot be told apart from the best of 248 draws. What separates it is the frozen replication on days the original never saw (USD/JPY 2005-09, t 3.8), which no other study of the day has.
- Fisher's combined p assumes independent p's. USD/JPY 2005-09 is new history; the HistData run is the same 2018-26 days on another feed (per-trade correlation 0.997), so it mostly re-counts the original: read the two-p figure (3.63e-6) as the honest one. The crosses (t 2.75) are left out (the crosses correlate 0.5-0.8 with the USD/JPY leg on the same days).
- What this does not settle: the cost. At twice the assumed spread the gotobi edge is about zero on every feed (#878, #893, #894); the measured broker spread at 00:55 / 06:00 UTC (the yen spread log, #897) decides whether it is tradable. Combined evidence for a gross effect is not a net edge.

## The twelve smallest p in the family

| Test | n | t | one-sided p | Holm over all | BH q | BY q |
|---|---|---|---|---|---|---|
| #878 gotobi: T2 | 771 | 2.74 | 0.0031 | 0.7618 | 0.7068 | 1.0000 |
| #860 vol-spike-rebound: 10-day hold | 165 | 2.53 | 0.0057 | 1.0000 | 0.7068 | 1.0000 |
| #857 turnaround-tuesday: nas100-r2 | 81 | 2.33 | 0.0099 | 1.0000 | 0.8002 | 1.0000 |
| #878 gotobi: T3 | 765 | 2.20 | 0.0139 | 1.0000 | 0.8002 | 1.0000 |
| #880 fx-weekend-gap: G | 243 | 2.14 | 0.0161 | 1.0000 | 0.8002 | 1.0000 |
| #838 rsi2-pullback: spx500 | 99 | 2.02 | 0.0217 | 1.0000 | 0.8155 | 1.0000 |
| #860 vol-spike-rebound: 5-day hold | 216 | 1.95 | 0.0253 | 1.0000 | 0.8155 | 1.0000 |
| #815 cycle-gate: geg G1 | 106 | 1.90 | 0.0290 | 1.0000 | 0.8155 | 1.0000 |
| #838 rsi2-pullback: us30 | 102 | 1.88 | 0.0301 | 1.0000 | 0.8155 | 1.0000 |
| #878 gotobi: T4 | 771 | 1.84 | 0.0329 | 1.0000 | 0.8155 | 1.0000 |
| #895 index-ibs: T2 | 473 | 1.65 | 0.0495 | 1.0000 | 1.0000 | 1.0000 |
| #896 ecb-boj-days: ECB EUR/USD | 71 | 1.51 | 0.0655 | 1.0000 | 1.0000 | 1.0000 |

## Sensitivity: the frozen replications included

N = 254 (the family plus 6 replication tests: #844, #862, #873, #889 x2, #894). t ≥ 2: 9 (expected 5.8). Holm across all: #889 gotobi-replicate: R2 USD/JPY 2005-09. BH q 0.05: #889 gotobi-replicate: R2 USD/JPY 2005-09; q 0.10: #889 gotobi-replicate: R2 USD/JPY 2005-09. Gotobi T2 in this set: BH q 0.2601, Holm 0.7741. (Replications of a passed rule are not exchangeable with new hypotheses; this is shown, not judged.)

## Post hoc, not pre-registered: one p per study

Two studies carry 63 of the 248 tests (#815 cycle-gate 31, #821 shadow-best-raw 32). Counting each study once (its smallest p times its number of tests), S = 74 studies: gotobi p 0.0123, Holm across studies 0.8970, BH q 0.4546. Holm passes: none; BH q 0.10: none. Shown only; it does not change the pre-registered answer.

## What went in

- 82 rows of the research-day table (PR #815-#899). Left out: #827 vix-term (not run (Cboe not reachable)); #893 gotobi-cost (cost accounting, no rule tested); #897 yen-spread-log (build (spread log), not a study). gold-carry, index-futures-cost and the audit fixes are not rows of the table.
- Not parsed (no t or p stored): #815 cycle-gate: gtrend G1 (no t or p stored for this test (not computed: too few blocked trades)); #815 cycle-gate: gtrend5 G1 (no t or p stored for this test (not computed: too few blocked trades)).
- Each study's decisive tests as its pre-registration judged them (its Holm family, or its single primary test); variants, descriptive splits, replication windows and placebos are not in. p = 1 − Φ(t) from the stored decisive t; where a study stored only a one-sided p or a bootstrap P (#824, #825 T2-T3, #838, #839, #841, #855, #856, #860) that p, or 1 − P. Four studies' figures come from RESULT.md or the verdict line (#839, #874, #879, #886); each row of `inputs.json` names its source path.
- Tests within a study are correlated (follow / fade pairs negatively, overlapping markets positively). BH is valid under positive dependence only, so Benjamini-Yekutieli is shown beside it; the Poisson range for the count of t ≥ 2 assumes independence and is an approximation.

Tests: `tests/multiple-testing-1314nov.test.mjs`.
