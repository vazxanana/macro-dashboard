# Evaluate forecasts without rewriting their history

This offline evaluator selects eligible forecast snapshots, resolves the declared cases, recomputes losses, and reports missing cases and baseline coverage. It reads local files and writes a separate report. It does not connect to cTrader or place trades.

The supplied 2030 examples are **synthetic demonstrations**. Their scores demonstrate the tool; they are not a forecasting or trading track record. Keep the frozen `gptmacro_v.1` package unchanged and use these files as a separate addition for Claude.

## Run the demonstrations

Use Node.js 20 or later. From the workspace root, run:

```powershell
New-Item -ItemType Directory -Force work/forecast-evaluation | Out-Null
node outputs/scripts/forecast-evaluator.mjs --ledger outputs/forecast-evaluator-demo-ledger.json --plan outputs/forecast-evaluator-demo-binary-plan.json --as-of 2030-01-01T00:02:00Z --out work/forecast-evaluation/binary-report.json
node outputs/scripts/forecast-evaluator.mjs --ledger outputs/forecast-evaluator-demo-ledger.json --plan outputs/forecast-evaluator-demo-quantile-plan.json --as-of 2030-01-01T00:02:00Z --out work/forecast-evaluation/quantile-report.json
node outputs/scripts/forecast-evaluator.mjs --ledger outputs/forecast-evaluator-demo-ledger.json --plan outputs/forecast-evaluator-demo-point-plan.json --as-of 2030-01-01T00:02:00Z --out work/forecast-evaluation/point-report.json
node --test outputs/scripts/forecast-evaluator.test.mjs
```

The [script](scripts/forecast-evaluator.mjs) has no third-party dependencies. `--ledger` accepts a JSON record, JSON array, or JSONL file. `--plan` accepts one JSON object. Optional `--evidence` accepts a JSON array of evidence records; it is needed when forecasts reference external evidence. `--as-of` fixes the evaluation view; without it, the current time is used. Without `--out`, the report goes to standard output. The script rejects an output path that resolves to an input file. These commands preserve the supplied reports; choose a fresh output filename to preserve your own earlier run too. Full schema validation is a separate step described below.

## Freeze the evaluation before the results

Create a plan using the [evaluation-plan schema](forecast-evaluation-plan.schema.json). The [binary](forecast-evaluator-demo-binary-plan.json), [quantile](forecast-evaluator-demo-quantile-plan.json), and [point](forecast-evaluator-demo-point-plan.json) plans illustrate its structure. Choose these settings before evaluating performance:

1. Register every intended `forecast_id` and its `eligibility_cutoff_utc`, including cases that may never receive a forecast. Do not choose the case list by inspecting wins or data availability.
2. Fix `selection` to `initial` or `latest_before_cutoff`. These are separate evaluation questions. Do not switch between them to obtain a better score.
3. Define one comparable cohort: variable, instrument or population, unit, horizon, method version, required tags, and resolution contract. Separate forecasts with different measurement or vintage rules.
4. Declare the forecast family, scoring losses, point functional or quantile grid, interval levels, and probability bins. Retain the chosen baseline definition and its timestamped values.
5. Select an honest evaluation mode. `prospective_research` requires plan creation no later than initial issuance and before each eligibility cutoff, plus strict evidence and resolution policies. `retrospective_research` permits a plan created after historical cutoffs and labels the result accordingly. `synthetic_demonstration` requires forecasts tagged `synthetic`.

Store the plan and ledger in independently timestamped, access-controlled history if the results will support a claimed track record. A date typed into JSON, a current file hash, or a passing test cannot establish that a plan was fixed before the outcome. A retrospective result remains retrospective even when its timestamps and calculations are internally consistent.

## Preserve each forecast and its resolution

Follow the [ledger schema](forecast-ledger.schema.json). Each forecast starts with one `issued` record whose `previous_record_id` is null. Append complete `updated` snapshots linked to the immediately preceding record. Keep the target, horizon, resolution rule, method version, forecast family, quantile probability grid, and comparator type and description unchanged within that chain. A materially different question needs a new forecast ID.

Record both issuance and recording times accurately. A snapshot must have **both** times strictly before the eligibility cutoff to be selected. The effective cutoff is the earliest of the registered cutoff and every supplied publication time across visible resolution records, including pending attempts. A later completion cannot erase an earlier publication assertion and make a late forecast eligible again. `cutoff_publication_record_ids` identifies publication records binding that cutoff. Review any erroneous earlier assertion explicitly; the tool does not treat a later timestamp as an implicit correction. The target observation period's start is not the eligibility cutoff; a nowcast may concern a reference period already under way. `--as-of` hides records recorded after that instant, while the input ledger's structural chain is still checked.

The resolution contract fixes the publisher, dataset or instrument, exact field or price convention, outcome rule, revision policy, specified vintage if applicable, and missing-data or holiday treatment. Explicitly distinguish a first release from a revised or final value. The evaluator checks contract consistency; a reviewer must establish that the supplied source and outcome satisfy its prose meaning.

Append a `resolved` record with a matching source snapshot and outcome. Use a Boolean for a binary event and a finite number for a point or quantile target. Include the outcome unit and **actual** publication time when established. A scheduled release time is not proof of actual publication. Keep observation, publication, retrieval, resolution, and recording times distinct; the evaluator checks their chronology and the target observation window.

If the outcome is missing, leave the case unresolved. An appended resolution attempt may use `outcome: null` with `scores: []`. Later append a new resolution linked to that attempt to supply the outcome; preserve the earlier attempt. Forecast updates cannot follow a resolution attempt, and a non-null resolution is terminal. The evaluator uses the latest visible resolution and reports the count of pending attempts. Stored scores are ignored and recomputed; leaving `scores: []` avoids trying to encode infinite losses in the ledger's numeric score field.

## Establish what was available at the time

Pass evidence records with the referenced IDs and `time.available_at_utc`. The evaluator checks supporting evidence and counterevidence against the selected snapshot's `information_cutoff_utc`. It does not infer availability from a reference period, scheduled publication, retrieval time, or a modern revised series.

`strict_known_availability` makes a case ineligible when referenced evidence is absent or its availability is unknown. `report_unknown` exposes those issues but permits scoring; evidence known to be available after the cutoff is ineligible in either mode. Prospective mode also requires at least one referenced evidence record. These checks use supplied assertions, so preserve source captures and audit evidence coverage independently. The code cannot detect evidence that influenced a forecast but was never recorded.

An empty `evidence_issues` array with `point_in_time_availability_supplied: false` can mean that no evidence IDs were supplied, as in these synthetic examples. It does not mean the evidence was verified.

Under `require_publication_and_unit`, an otherwise resolved case remains `resolution_unverified` until publication time and the matching outcome unit are supplied. `report_unverified` allows scoring with those gaps exposed. A supplied conflicting unit is rejected in either mode. Do not use a permissive retrospective setting to describe a result as verified prospective performance.

## Read the losses and comparisons

All implemented losses are lower-is-better. For binary outcomes, let `y` be 0 or 1 mathematically; the ledger itself requires `false` or `true`. For continuous targets, `x` is the point forecast and `y` is the outcome.

| Forecast | Declared loss | Calculation or meaning |
|---|---|---|
| Binary probability `p` | Brier | `(p − y)²`; no factor of two. |
| Binary probability `p` | `log_score` | Negative natural log of the assigned probability of the observed outcome. The implementation uses the outcome branch directly. |
| Point mean | Squared error | `(x − y)²`, in squared target units. |
| Point median | Absolute error | Absolute difference between forecast and outcome, in target units. |
| Quantile at probability `τ` | Pinball | `τ × (y − q)` when `y ≥ q`; otherwise `(1 − τ) × (q − y)`. This convention is unscaled. |
| Central interval `[l,u]` with noncoverage `α` | Interval score | Width `u − l`, plus `2/α` times the distance below or above the interval when missed. Endpoints must be supplied quantiles at `α/2` and `1 − α/2`. |

Declare a mean with squared error or a median with absolute error; the evaluator rejects the mismatched pairing. For quantiles, it reports each planned pinball level separately and each central interval's loss and observed coverage. Noncrossing values and the fixed probability grid are checked. A few quantiles do not determine a full distribution, so the evaluator does not manufacture CRPS from them. Interval coverage is a sample diagnostic alongside the loss, not a separate per-case loss or proof of calibration.

A confidently wrong `p = 0` or `p = 1` has infinite log loss. The report retains that case and emits `{ "status": "infinite_loss", "value": null }`; the aggregate log loss is also infinite. It never clips probabilities or drops the loss to obtain a finite mean. A correct certainty has zero loss. Numerical overflow is reported separately as `arithmetic_overflow`. Read every status before interpreting a null number.

Baseline comparisons use the selected snapshot's numeric comparator only when its capture time is known and no later than the forecast's information cutoff. A missing or late baseline does not remove the model's case score. Inspect `n`, `paired_n`, `model_mean`, `paired_model_mean`, and `paired_baseline_mean`: compare model and baseline on the **paired** cases. Brier skill is `1 − paired_model_mean / paired_baseline_mean`, and is undefined when the baseline mean is zero. A numeric point comparator is not a quantile distribution, so quantile baseline comparison is unavailable. Review baseline units, source quality, and fair point-in-time construction externally.

The binary demonstration registers six cases: four score, one remains unresolved, and one was never issued. Its latest-before-cutoff Brier mean is 0.3525 across four cases; the paired comparison uses three. One wrong certainty makes its aggregate log loss infinite. These expected values help check the example, not estimate real forecasting skill. Probability-bin counts and event rates are descriptive; small or dependent samples need further uncertainty analysis.

The quantile example has issued values 10, 15 and 20 at probabilities 0.1, 0.5 and 0.9, against outcome 25. Pinball losses are 1.5, 5 and 4.5; the central 80% interval score is 60, observed coverage is zero for this single case, and no quantile baseline is available. The point-mean example has squared error 4 versus baseline 1.

## Validate structure, execution, and source truth separately

Validate **each ledger record** against [the ledger schema](forecast-ledger.schema.json), each plan against [the plan schema](forecast-evaluation-plan.schema.json), and supplied evidence against [the evidence schema](research-evidence-record.schema.json), using a JSON Schema 2020-12 validator with date-time and URI formats enabled. The standalone command performs runtime checks, not full JSON Schema validation. Its success therefore does not prove that every field complies with the schemas. Conversely, schema validation alone does not check the complete forecasting chronology or scoring behavior.

The supplied [schema-checking script](scripts/validate-forecast-inputs.mjs) performs this structural step without writing to the inputs. Its validator dependencies are separate from the dependency-free scorer. In a new recipient workspace, install the pinned validator packages once in an isolated tools folder, then check each chosen plan:

```powershell
npm install --prefix work/schema-tools --ignore-scripts --no-audit --no-fund --package-lock=false ajv@8.20.0 ajv-formats@3.0.1
node outputs/scripts/validate-forecast-inputs.mjs --modules work/schema-tools/node_modules --ledger outputs/forecast-evaluator-demo-ledger.json --plan outputs/forecast-evaluator-demo-binary-plan.json
node outputs/scripts/validate-forecast-inputs.mjs --modules work/schema-tools/node_modules --ledger outputs/forecast-evaluator-demo-ledger.json --plan outputs/forecast-evaluator-demo-quantile-plan.json
node outputs/scripts/validate-forecast-inputs.mjs --modules work/schema-tools/node_modules --ledger outputs/forecast-evaluator-demo-ledger.json --plan outputs/forecast-evaluator-demo-point-plan.json
```

Installation requires network access; the installed validator and scorer run locally. This workspace already has the same packages under `work/schema-validator/node_modules`, which can be used with `--modules` without reinstalling. When scoring real evidence, pass the same evidence JSON array to both commands using `--evidence FILE`. Keep the schemas next to this `scripts` folder when moving the addition. A failed check exits unsuccessfully; a passing check prints its validator versions, input/schema hashes and checked record counts. The [verification report](forecast-evaluator-validation-2026-11-08.json) records the current fixture, runtime and command checks.

The [test suite](scripts/forecast-evaluator.test.mjs) exercises numerical scores, snapshot cutoffs, chain integrity, evidence and resolution checks, missing cases, infinite losses, overflow, and input-file protection. A passing suite supports those tested behaviors. It does not authenticate the underlying data or establish market usefulness.

For every evaluated cohort, review case exclusions and unresolved counts, input hashes, the explicit `as_of_utc`, source and vintage captures, selection policy, baseline coverage, and evaluation mode. Report unsupported assumptions and dependence between cases. Keep predictive accuracy separate from a trading result, which additionally depends on execution, spreads, fees, financing, sizing, and risk. See the [calibration playbook](probability-forecast-calibration-playbook.md) and [empirical market validation protocol](empirical-market-research-validation.md) for the broader research process.
