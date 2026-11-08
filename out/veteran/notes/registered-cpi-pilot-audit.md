# Independent audit of the newly registered CPI pilot

Audit date: 8 November 2026. This review concerns the real newly registered October 2026 case and its six-reference-month protocol. It is not an audit result for a synthetic forecast. Registered originals and frozen V1 were not edited.

## Finding

The current real record is internally consistent with the captured source bytes and its declared local timing. It is an **unvalidated locally registered prospective experiment with one issued, unresolved case**, not an established forecasting or trading record. No incorrect input extraction, hash mismatch, arithmetic error, or current issuance-window breach was found. The initial evaluation reproduces exactly and correctly contains no scores.

The main remaining control risk is that several economic rules exist only in prose: the generic evaluator does not itself enforce the maximum issuance lead, the actual-publication deadline, first-release identity, or the one-decimal displayed outcome. The real current case passes the issuance checks manually; outcome controls remain necessary at resolution.

## Files and checks

Reviewed the six registered artifacts in `outputs`: protocol, October evaluation plan, six evidence records, source manifest, one-record JSONL forecast ledger, and initial evaluation. Inspected their five corresponding raw HTML/PDF source files under `work/raw/cpi-pilot-sources-2026-11-08`, including BLS Table A headers and core row, Cleveland monthly table headers and October row, BLS calendar row and timezone note, and the relevant complete pages of both Cleveland methodology PDFs.

Ran:

```text
node outputs/scripts/validate-forecast-inputs.mjs --ledger outputs/cpi-pilot-forecast-ledger.jsonl --plan outputs/cpi-pilot-evaluation-plan-2026-10.json --evidence outputs/cpi-pilot-evidence-2026-11-08.json --modules work/schema-validator/node_modules
node outputs/scripts/forecast-evaluator.mjs --ledger outputs/cpi-pilot-forecast-ledger.jsonl --plan outputs/cpi-pilot-evaluation-plan-2026-10.json --evidence outputs/cpi-pilot-evidence-2026-11-08.json --as-of 2026-11-08T14:12:31.252Z --out work/registered-cpi-recomputed-evaluation.json
node work/audit_registered_cpi_pilot.mjs
```

Ajv 8.20.0 with ajv-formats 3.0.1 passed the ledger, evaluation plan and all six evidence records. The scorer report is deeply equal to the registered initial evaluation, including its input hashes: one registered case, one unresolved case, no evidence issues and zero aggregate scores. The protocol and source manifest are reviewed documents, not objects covered by those three schemas.

Reproducible supporting artifacts:

- `work/registered-cpi-schema-validation.json`
- `work/registered-cpi-recomputed-evaluation.json`
- `work/registered-cpi-audit-checks.json`
- `work/audit_registered_cpi_pilot.mjs`

## Source and calculation accuracy

All five current local files have the exact manifest byte counts and SHA-256 hashes; their five evidence-record hashes agree too. The successful capture manifest and the failed attempt are kept separately. Recomputing a hash establishes agreement with today's local manifest, not publisher authenticity or historical immutability.

| Source | Bytes | SHA-256 |
|---|---:|---|
| BLS release calendar | 57,103 | `db4cb05e91e67b434f16f01d37540258e780cad0bffa001607f08fc2ef87e071` |
| BLS September CPI release | 1,373,525 | `b9f981390c08f4a530d839495fce582124015b979bac0398bfcc35ffde0544e4` |
| Cleveland nowcast page | 197,385 | `ed636b6f7807744cfdc39d13a4fc54ad4c3b20b732c231923c1e48ad06e7d956` |
| Cleveland technical FAQ | 241,358 | `a6d4f544a0eaf643b8688bc726088cebc5f51fa0c800e1289082dcea98c8a308` |
| Cleveland missing-input notice | 37,665 | `9afe541247403bdaf89d9676ce66443d443c6828254c1928775cc1c69cbac564` |

The preserved BLS release identifies September 2026 and Table A, CPI-U, U.S. city average. Its seven monthly columns are seasonally adjusted March through September; the last core monthly value is **0.3**. The following **2.6** is explicitly the unadjusted twelve-month change, not the monthly input. The archived value is correctly treated as received on 8 November, with original release-day bytes unconfirmed and vintage status unknown.

The preserved Cleveland table caption is month-over-month percent change. Its columns are Month, CPI, Core CPI, PCE, Core PCE and Updated. The October row is `October 2026, 0.24, 0.21, 0.27, 0.26, 11/06`; therefore **0.21** is the correct monthly core CPI input. The distinct year-over-year table has different values. The `11/06` display label is correctly not used as an established 6 November receipt timestamp or precise publication timestamp.

The blend is exactly `0.5 * 0.21 + 0.5 * 0.30 = 0.255`. It is stored as percent, nonannualized monthly change, not a fraction of 1, an annualized rate, headline CPI or year-over-year inflation. The declared mean target and squared-error loss are coherent. Three stored decimals arise from averaging rounded inputs and imply no validated forecasting precision. Keep 0.255 unrounded for primary scoring against the declared one-decimal BLS outcome.

The technical FAQ explicitly gives nonannualized monthly inflation and a recursively applied J-month moving average with J=12 for core CPI. The missing-input notice says October 2025 inputs use estimates and November monthly rates are implied using estimated October and BLS November levels. Its effect on the October 2026 window follows from the published twelve-month rule; the evidence correctly labels that relevance an inference, not exact replication of the current model. Neither input is an independent measurement of the target; both rely on lagged core CPI.

## Temporal order

| Event | UTC |
|---|---|
| Calendar received | 2026-11-08 14:05:32.579 |
| BLS September release received | 2026-11-08 14:05:32.788 |
| Cleveland nowcast received | 2026-11-08 14:05:33.380 |
| Last methodology source received | 2026-11-08 14:05:34.082 |
| Protocol and case plan created | 2026-11-08 14:12:31.143 |
| Calculation available / information cutoff | 2026-11-08 14:12:31.196 |
| Forecast issued and recorded | 2026-11-08 14:12:31.228 |
| Original evaluation as of | 2026-11-08 14:12:31.252 |
| Eligibility cutoff | 2026-11-09 13:30:00 |
| Captured scheduled release | 2026-11-10 13:30:00 |
| Resolution deadline | 2026-11-17 13:30:00 |

The BLS calendar actually lists Tuesday 10 November 2026 at 08:30 AM for October CPI, and states all calendar times are Eastern. The November New York conversion to 13:30 UTC is consistent. The issuance lead is **47.2913255556 hours**, inside the declared 24-72 hour window. The eligibility cutoff is exactly 24 hours before the captured schedule; the deadline is exactly seven days after it. All cited source receipts and the calculation precede the information cutoff/issuance in the supplied local chronology.

These are self-recorded local times. There is no externally authenticated timestamped deposit, trusted receipt log or independently demonstrated append-only history. A plan preceding issuance by 85 milliseconds is a valid supplied order but gives no independent assurance of precommitment. The protocol explicitly makes that limitation visible; do not shorten its status to externally preregistered or independently certified.

## Cohort and baseline design

The protocol fixes six consecutive reference months, October 2026 through March 2027, and requires missing/unissued cases to remain in the denominator. The machine-readable October plan registers **one** case; the remaining five are presently intentions pending official calendar captures and pre-issuance absolute plans. This is accurately disclosed. A final pilot report needs an explicit six-case reconciliation so a one-case evaluator output cannot silently become the whole cohort.

The primary Cleveland comparator is a defensible contemporaneously captured baseline for the same reference month and unit. Its dependence on lagged BLS inputs is disclosed. Latest-print persistence (0.3 for the current case) is correctly predeclared as a secondary comparator, but it is stored only through the protocol/evidence, not as a second machine-scored comparator. Compute and report its squared loss for every resolved case under the frozen rule; do not choose the comparator after observing the outcome.

Equal weights were fixed without fitting, which makes the candidate reproducible but does not establish an optimum. Six months will give a small and dependent sample; a single result cannot establish skill, and a favorable six-case mean should remain preliminary. Report model, Cleveland and persistence losses, resolved/unresolved/missing counts and the full intended denominator. Do not convert a CPI loss improvement into trading profitability without a separate prospective market decision and execution study.

For this specific first case, the midpoint beat-Cleveland threshold is 0.2325 and the beat-persistence threshold is 0.2775. With exact one-decimal outcomes, 0.255 cannot beat both 0.21 and 0.30 on the same case; either benchmark can be the nearer point. This is an arithmetic property, not a reason to change the frozen forecast or scoring rule. Across multiple varying outcomes, a blend can still have lower average squared error than both.

## Concrete future-control gaps

The following findings were reproduced using **in-memory, explicitly synthetic audit probes only**, never appended to the real ledger. Detailed outputs are in `work/registered-cpi-audit-checks.json`.

1. **Actual publication deadline is not machine-enforced.** A schema-valid synthetic outcome with reference-period endpoint 31 October and actual publication 18 November, after the 17 November deadline, is scored. The evaluator checks the observation timestamp against the deadline but permits publication afterward. The protocol requires such a case to remain unresolved/unverified. At resolution, explicitly compare actual publication with the frozen deadline before accepting the outcome; the scorer's `scored` status alone is insufficient.
2. **First-release identity and displayed precision require source review.** A schema-valid synthetic record labeled as a revised vintage with outcome 0.333 is scored despite the first-release one-decimal contract. A nonempty vintage label is not evidence of the initial release. Preserve the first-release source and receipt context, confirm the precise Table A field, and verify that the actual accepted number is the displayed one-decimal value. Corrections need separate reporting. This limitation is consistent with the evaluator's stated need for external prose/source review.
3. **The 72-hour maximum is prose, not a machine predicate.** A supplied synthetic forecast issued 73.5 hours before the scheduled release remains eligible/unresolved when its other dates are made internally consistent. The evaluator has an upper eligibility cutoff but no structured scheduled-release/minimum-lead field. Manually check the full 24-72 hour rule for every future issuance or use an additional separately versioned preflight check. The current real issuance was manually checked and passes.
4. **Six-case coverage and secondary-baseline loss need a companion report.** Neither is fully produced by the current single-case plan and one-comparator evaluator. Preserve all six protocol cases, including omissions, and reconcile later case-plan outputs to that fixed list.

These findings warrant documented checks around future case registration/resolution; they do not justify rewriting the original issuance, silently changing its contract, or inventing a current outcome.

## Validation limits

This was an audit of the supplied preserved source bytes and local records, not a fresh publisher retrieval or verification of the publisher's servers, original publication instants, source delivery authenticity, historical immutability, or outcome vintage. No future October CPI result exists in the registered evidence. Schema success verifies structure/formats; scorer success verifies its implemented predicates. Neither proves that prose rules, source truth, independence, predictive calibration, out-of-sample skill or economic value are satisfied.

The appropriate present status remains: **one real October case issued at 0.255%, primary Cleveland baseline 0.21%, secondary latest-print baseline 0.30%, unresolved, no scores; six intended protocol months; locally registered and unvalidated.**
