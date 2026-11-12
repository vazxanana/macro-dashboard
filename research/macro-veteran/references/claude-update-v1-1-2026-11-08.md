# Assistant update: gptmacro_v.1, revision 1.1

**Prepared:** 8 November 2026. This is a complete current reference snapshot, not a claim that all dated facts remain current. It retains the skill name `gptmacro-v-1` and updates its metadata version to `1.1`. The original V1 archive remains a separate frozen artifact.

## What the update adds

1. **Corrected source and schema examples.** The [correction note](research-corrections-and-quality-audit-2026-11-08.md) documents the invalid V1 enum example, source/observation lineage and publication-clock fixes, plus subsequent measurement corrections. This snapshot uses the corrected master files.
2. **A worked GDP-vintage case.** The [2023 Q3 case](gdp-revision-and-composition-case-2023-q3.md) links release-vintage records and shows how an unchanged headline can conceal revised spending, inventory and inflation composition.
3. **Executable forecast evaluation.** The [guide](forecast-ledger-evaluation-guide.md) supplies runnable schema validation and scoring commands, frozen evaluation plans, explicit missing-case accounting and synthetic examples. Generic losses, CPI-specific rules and source truth are separate checks.
4. **One real prospective CPI issuance.** The [pilot](core-cpi-prospective-pilot-2026-11-08.md) records an unvalidated October core-CPI point estimate before release. It is unresolved. Five further absolute plans contain no issued future forecasts. Preserve original records and unknown publication metadata.
5. **An official-feed timestamp audit.** The [finding](bls-publication-timestamp-audit-2026-11-08.md) explains why an official feed field can predate an embargo or refresh without a new observation. It does not establish an early public release.
6. **An editable issuer cash-flow model.** The [Newmont case](newmont-cash-flow-model-2026-11-08.md) reconciles cash flow, retains reclamation spending and tests conditional gold/cost/tax/capex changes. It is not a Q4 forecast or equity valuation.

## How to use the snapshot

Use the skill folder's `SKILL.md` as the entry point and the [research index](research-pack-index.md) for routing. The new archive contains the updated skill folder and its `references/` tree. When replacing an installed copy, keep the prior archive for provenance and avoid loading two conflicting revisions as if they were independent research sources.

Examples in reference documents use the original workspace's `outputs/` prefix. In an installed skill, point those commands at the skill's `references/` folder and write new reports to a separate working location. The original workspace's `work/` captures and installed libraries are not included; source manifests retain their provenance and hashes. Use original publisher links or separately supplied raw captures before claiming raw-file verification in a new environment.

For a dependency-free check from the skill folder itself, this prints the original CPI view without writing to the packaged references:

```text
node references/scripts/evaluate-cpi-pilot.mjs --ledger references/cpi-pilot-forecast-ledger.jsonl --plan references/cpi-pilot-evaluation-plan-2026-10.json --protocol references/cpi-pilot-protocol-2026-11-08.json --evidence references/cpi-pilot-evidence-2026-11-08.json --as-of 2026-11-08T14:12:31.252Z
```

The expected state is one unresolved case and no performance scores. Full schema validation remains the separate command described in the evaluation guide.

The package manifest establishes the bytes included in this revision. Older validation reports certify their recorded snapshots; subsequent reference-index or schema changes can differ from those older hashes. Do not rewrite old checked-at times to imply a fresh audit. Inspect the applicable current data, code, plan, sources and validation scope.

All synthetic examples, unresolved forecasts, model assumptions and financial perimeters remain labeled. No credential, account integration or live-trading activation is part of this package.
