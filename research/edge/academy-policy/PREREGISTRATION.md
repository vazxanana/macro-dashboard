# Academy decision policy: why it does not beat "take every setup", and whether any change generalises

Pre-registration. Written 10 Nov 2026, before any script of this study existed or ran. Paper research on the
MeridianX Academy's own data (`academy/data/`, corrected research clock). It changes no trading rule of any edge, no
council code, no live system. Its only possible effect is on the Academy's decision policy (`MXA.decide`,
`assets/academy-core.js`), and only if a candidate passes the rule in section 7.

## 1. The question

Seven mechanical edges produce setups. The Academy's deterministic policy (`policy-1.0`: fixed evidence weights per
edge, hard gates, no lessons, no model) answers BUY / SELL / WAIT on each. On the train pool the policy does not
measurably beat taking every setup, and on `replica` and `gmp` its take-set is worse than its wait-set (not
significantly). The owner asked: find out why, and improve the policy only where the improvement generalises.

Two parts: a **diagnosis** (which votes and gates drive WAIT, and whether they point the right way) and at most
**five candidate policies**, each described below before it is run, each judged by one fixed rule.

## 2. What is already known (disclosed, so nobody mistakes this for a blind test)

Read before this file was written:

- `academy/data/eval.json` in full: `policy-1.0` on the whole train pool, per edge and overall: every setup, take-set,
  wait-set, the first-70 % / last-30 % blocks by time, the counts of wait reasons and gates, the take-set by confidence.
  So the author knows, for the **whole** train pool (the validation period of section 3 included), that the policy's
  takes are worse than its waits on replica (t −1.53) and gmp (t −1.17), that this holds in both time blocks of each,
  that "location" is the most common top contradiction on replica and "oppLiq" / "displacement" on gmp, and that on
  gmp the high-confidence takes did worst.
- `docs/academy/RESEARCH.md`: the research engine's 130 condition tests on the train pool (nothing validated).
- `docs/academy/DATA-CLOCK.md`, `MERIDIANX_BUILD_PROGRESS.md`: the baselines and the trained scorers (all rejected).
- By accident, while searching the repository for exam-pool readers: five lines of `ml/models/report.md` that give the
  **mechanical** "take every setup" average on the exam pool for replica, gtl, gmp, nq-open and pooled. These are
  unconditional averages (no policy decision is in them). They were not used for anything below.

Consequence: candidates C3 and C5 are informed by whole-train knowledge of `policy-1.0`. The validation part of this
study is therefore **not** untouched by the author's prior knowledge of the incumbent policy; it is untouched by the
candidates themselves. The exam pool is the only fully untouched data, and section 6 guards it.

Not known when this was written: any per-vote or per-gate result, any candidate's result on any part of the data, the
discovery / validation numbers of `policy-1.0` under the split of section 3, any drawdown of a take-set.

## 3. Data and splits

- **Usable train setups** of an edge: `pool === 'train'`, not flagged (`rule.clockShift`, `rule.pre2020`), in order of
  signal time `t` (ties by id). A **trade** is a usable setup whose order filled (`reason` not `missed` / `expired` /
  `cancelled`). Net R is after costs, as the outcome files book it.
- **Discovery** = the earliest 60 % of an edge's usable train setups by count; **validation** = the latest 40 %.
  Exactly: `k = floor(0.6 × n)`, `cut = t` of the setup at index `k` (zero-based); discovery is `t < cut`, validation is
  `t >= cut`. The cut times below were computed from the candidate files alone (no outcome file was opened):

| Edge | Usable train setups | Cut (UTC) | Cut (unix s) | Discovery setups | Validation setups |
|---|---|---|---|---|---|
| replica | 325 | 2025-06-02 11:29 | 1748863740 | 195 | 130 |
| mosha-bo | 33 | 2023-09-11 07:19 | 1694416740 | 19 | 14 |
| gtrend | 18 | 2024-10-18 00:04 | 1729209840 | 10 | 8 |
| gtl | 166 | 2024-05-27 16:04 | 1716825840 | 99 | 67 |
| geg | 113 | 2024-08-17 00:04 | 1723853040 | 67 | 46 |
| gmp | 513 | 2023-08-30 13:15 | 1693401300 | 307 | 206 |
| nq-open | 344 | 2024-05-31 13:37 | 1717162620 | 206 | 138 |
| all | 1,512 | (each edge's own) | | 903 | 609 |

- **Pooled** discovery / validation = the union of the seven edges' parts, each with its own cut.
- **Exam pool** (`pool === 'exam'`, 619 usable setups): the untouched final test. Section 6.
- Decisions are made by one walk through each edge's usable train setups in time order, exactly as
  `academy/gen/evaluate.mjs` does it: the snapshot holds only bars closed at or before `t`; "similar past cases" are
  the earlier train trades that had finished before `t`. A validation decision may lean on discovery trades as past
  cases. That is how the page works and it is not look-ahead. No outcome field ever reaches a decision or a feature.
- The walk writes an outcome-free record of each decision (votes with weights, gates, margin, confidence, a few
  features). Every candidate is a pure function of that record, so candidates cannot differ in what they saw.

## 4. Diagnosis (discovery first, then the same table on validation with nothing re-fitted)

A **vote** is one evidence item of a decision: a factor (`htfBias`, `ltfStructure`, `sweep`, `displacement`,
`momentum`, `location`, `confirmation`, `rr`, `stop`, `oppLiq`, `volatility`, `session`, `regime`, `similar`, `event`)
on one side (support or contradiction). The four judgement gates (`event`, `volatility`, `unfamiliar`, `conflict`)
are treated as contradiction-type votes of their own.

For each edge and each vote, on trades: n with the vote and n without, net R a trade of each, the difference and its
Welch t. A support vote is **wrong-signed** when trades carrying it did worse than the rest (difference < 0); a
contradiction vote or gate is wrong-signed when trades carrying it did better (difference > 0). A vote needs 20
trades on each side to be tabled with a t; below that only the counts are shown.

Also reported per edge: the share of WAIT decisions decided by gates only, by evidence only and by both; which
evidence condition failed (the margin or the minimum support); the net R of the waited trades by top contradiction;
the Spearman rank correlation between the evidence margin and net R; `policy-1.0`'s take-set against its wait-set.

Hypotheses, stated before the run:

- **H1 (gmp, structural votes).** `displacement` against and `oppLiq` in the way fire on a large share of gmp setups
  because of how the edge is built (an M5 pullback inside an H1 momentum candle; with no target the policy measures to
  entry + 2R, and the candle's own extreme sits about half way). Prediction: each fires on at least 40 % of gmp
  discovery setups, and trades carrying it are not worse than the rest.
- **H2 (gmp, volatility).** The setup requires an abnormal H1 candle, so the volatility gate and vote fire on the
  setup's own condition. Prediction: gated trades are not worse than the rest.
- **H3 (replica, location).** The replica trades against an intraday leg in the direction of the D1 structure, so
  "poor location" (a buy in the upper part of the 50-bar M15 range) marks pullback-continuation trades. Prediction:
  it is the leading wait reason and the trades carrying it are not worse than the rest.
- **H4 (margin).** The evidence margin does not rank trades: its rank correlation with net R is not positive on
  replica and gmp.
- **H5 (similar cases).** The `similar` vote (a trailing average of past trades in the same bucket) does not
  separate better trades from worse ones on any edge.
- **H6 (gates).** None of the four judgement gates marks a group of trades with negative net R on any edge with
  enough gated trades.

**Harm check on the incumbent** (a diagnosis, not an acceptance): on validation, `policy-1.0`'s take-minus-wait per
edge and pooled, two-sided, Holm-corrected over the scopes that can be tested (20 trades on each side). Adjusted
p ≤ 0.0455 with a negative difference is reported as "measurably worse"; anything else as "no measurable
difference". It changes no shipped behaviour by itself: it is a finding for the owner.

## 5. Candidates (at most five; none added after the run)

All keep the non-overridable gates of `policy-1.0` (missing data, no valid stop, reward to risk after costs under 1,
the risk engine, conflicting lessons). All are run with no lessons and no model, like `eval.json`. `policy-1.0` is
run beside them as the incumbent (C0), not as a candidate. No threshold is searched: every number below is fixed here.

| Id | Name | Definition |
|---|---|---|
| C1 | defer to the edge | TAKE every setup unless a non-overridable gate fires. Evidence scoring and the four judgement gates do not hold a trade back. This is the null hypothesis made into a policy: by construction it waits on almost nothing, so it can rarely be tested and cannot "add value"; it is here as the reference a later lesson would start from. |
| C2 | gates only | TAKE unless any gate fires (the non-overridable ones and `event`, `volatility`, `unfamiliar`, `conflict`). No evidence scoring. Tests whether the gates alone carry the policy's value. |
| C3 | edge-logic table (a priori) | `policy-1.0` with contradiction votes removed where the vote is the edge's own design, decided from the rule text only (same convention the profile table already uses for momentum on replica). **replica**: `location` contradiction 1.25 → 0; `volatility` contradiction 0.75 → 0; `high-vol` no longer a bad regime; volatility gate at 4 × the median instead of 2 (the rule only trades in top-fifth volatility after a leg of 2 ATRs). **gmp**: `displacement` contradiction 1 → 0; `oppLiq` contradiction 1 → 0; `volatility` contradiction 0.75 → 0; `high-vol` no longer a bad regime (`ranging` stays); volatility gate at 4 (the setup needs an H1 candle of 1.5 × the average range). Support weights, `takeMargin` 1.5 and `minSupport` 2.5 unchanged. Other edges unchanged (identical to C0 there, so not tested there). |
| C4 | discovery sign audit | `policy-1.0` with every vote and judgement gate dropped (weight 0, gate ignored) that is wrong-signed on that edge's **discovery** trades with \|t\| ≥ 1 and at least 20 trades on each side. Nothing is re-signed or re-weighted; thresholds unchanged. The drop list is fixed from discovery and then applied to validation. An edge with no drop is identical to C0 and not tested. Discovery figures of C4 are in-sample by construction and are labelled so. |
| C5 | confidence threshold | TAKE only where `policy-1.0` takes **and** its confidence is medium or high (evidence at least 1 past the line, at least 5 similar past cases, no stated uncertainty). |

## 6. The exam pool and its ledger

`academy/data/exam-ledger.json` (`{ reads: [{ at, what, policyVersion, edges, by }] }`) is committed with this file,
with zero reads.

- The exam outcomes may be read **at most once per frozen candidate policy version**, only for a candidate that has
  passed section 7 on validation, and the read is written to the ledger and committed **before** it happens.
- If no candidate passes validation, the exam pool is **not read at all** and the ledger keeps zero reads.
- The study's loader drops every outcome that does not belong to a usable train setup as soon as the file is parsed;
  a test replaces every exam outcome with wild values and must get the same result file back, byte for byte.
- After an exam read nothing is iterated. If the exam contradicts validation (exam take-minus-wait ≤ 0, or the exam
  take-set's net R a trade is not above the exam's own "take every setup"), the candidate is rejected and the report
  says so. An accepted candidate that the exam does not contradict becomes `policy-1.1` for the accepted scope only.

**Has any existing code already used exam outcomes to evaluate the policy?** Checked by reading the code on 10 Nov 2026:

- `academy/gen/evaluate.mjs`, `academy/gen/research.mjs`: train pool only. No.
- `ml/train.py` (`exam_block`): reads the exam pool once per trained **scorer** (not `MXA.decide`), after its
  walk-forward verdict is fixed, and publishes exam AUC / Brier and the exam's mechanical average. All five scorers are
  rejected challengers. This is the accidental sight disclosed in section 2.
- `academy/gen/clock-compare.mjs` (`docs/academy/DATA-CLOCK.md`, section 4): mechanical "usable" figures over train and
  exam together. No policy decision.
- `academy/gen/run.mjs`, `scripts/audit/academy-review.mjs` (cost check): every outcome, mechanical only.
- The page's "Test on new setups", by design: it scores the policy on exam setups one at a time, with and without the
  mentor's lessons, and stores them. The production store is empty. In temporary stores: the page audit scores 3 gmp
  exam setups from the fixture window; the lead's live walk of 10 Nov scored 10 nq-open exam setups
  (`MERIDIANX_BUILD_PROGRESS.md`). Thirteen setups, reported as "too few to judge", used to tune nothing.

So: no code path has evaluated the decision policy on the exam pool as a whole, and nothing was tuned on it. The
small uses above are listed in the ledger as prior uses, apart from this study's reads.

## 7. The acceptance rule (applied mechanically; the null is "take every setup")

Every table sets a policy against the mechanical baseline "take every setup" on the same trades.

For a candidate on a scope (one edge, or pooled), on **validation** trades:

1. **Testable**: at least 20 trades in its take-set and 20 in its wait-set. Otherwise the scope is "inconclusive: too
   few trades" and is not a test.
2. **Test**: Welch t of net R a trade, take-set minus wait-set, one-sided (take > wait), p from Student's t with the
   Welch-Satterthwaite degrees of freedom. **Pooled** scope: each trade's net R first has its edge's **discovery**
   mechanical mean taken out, so a policy gets no credit for simply preferring a high-mean edge.
3. **Holm correction** over every candidate × scope test that is run (all testable scopes of C1 to C5 together).
4. **Accepted** only if all of: raw t ≥ 2; Holm-adjusted p ≤ 0.0228 (the one-sided normal tail at t = 2); the
   take-set's net R a trade is above the mechanical baseline's on the same validation trades (pooled: on the adjusted
   R); the take-set's maximum drawdown in R is not worse than the mechanical baseline's on the same period.
5. **Rejected**: tested, and the take-minus-wait difference is ≤ 0, or the take-set's net R a trade is not above the
   baseline's, or its drawdown is worse. **Inconclusive**: tested, pointing the right way on all three, but not
   significant after the correction. Neither changes anything.
6. A candidate's own verdict: accepted if any scope is accepted (for that scope only); rejected if every tested scope
   is rejected or nothing could be tested and it changes nothing measurable; otherwise inconclusive.

`policy-1.0` stays the shipped policy unless a candidate is accepted on validation **and** not contradicted by its one
exam read.

**Maximum drawdown**: trades in order of exit time (ties by id), equity = running sum of net R from zero, the largest
fall from a running peak (the peak starts at zero). Same definition as the research engine's baselines.

Discovery figures of every candidate are reported for information only. A candidate that looks good on discovery and
not on validation did not generalise and is reported that way.

## 8. Power (stated before the run, from published whole-train figures)

Minimum detectable difference at raw t = 2 with the validation trades split evenly between take and wait (the best
case): `4 × SD / sqrt(n)`. SD is backed out of `eval.json` (`avg / t × sqrt(n)`); n is 40 % of the edge's trades.

| Edge | SD of net R (about) | Validation trades (about) | Smallest take-minus-wait that reaches t = 2 | The edge's own mean |
|---|---|---|---|---|
| replica | 3.1 R | 130 | 1.1 R | +0.41 R |
| mosha-bo | 2.4 R | 11 | cannot be tested (under 20 a side) | +0.81 R |
| gtrend | 5.0 R | 7 | cannot be tested | +1.88 R |
| gtl | 1.3 R | 66 | 0.65 R | +0.22 R |
| geg | 2.1 R | 33 | cannot be tested evenly (16 a side) | +0.47 R |
| gmp | 1.3 R | 205 | 0.35 R | +0.07 R |
| nq-open | 1.6 R | 138 | 0.54 R | +0.20 R |
| pooled | about 2 R | about 590 | about 0.33 R | +0.25 R |

With the Holm correction over roughly 15 to 25 tests the bar is near t = 3, about half as much again. So on every
edge a candidate must separate takes from waits by **several times the edge's own average trade** to be accepted. A
real but modest improvement (say +0.1 R a trade) cannot be shown on this data: it would be reported as inconclusive,
not as an improvement. The report repeats this table with the discovery SD and each candidate's real take share.

## 9. Outputs

`RESULT.md` and `result.json` here (diagnosis tables for discovery and validation; every candidate with n, net R a
trade, t, win rate and maximum drawdown for mechanical, take-set and wait-set on both parts; take-minus-wait with Welch
t, raw and adjusted p, the verdict; the power note; the exam-read count). `academy/data/eval.json` gains maximum
drawdown for the mechanical set and the take-set; `academy/data/eval-trades.json` lists the policy's action per train
setup with no outcome field. Tests: `tests/academy-policy.test.mjs`.

## 10. Amendments

None. Any change to sections 3 to 7 after the first run must be listed here with its date and reason.
