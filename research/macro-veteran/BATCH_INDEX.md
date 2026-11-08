# Complete Claude handoff — gptmacro_v.1 revision 1.2

Prepared 8 November 2026 for private research and trading. This is a cumulative batch: the current research library, all persisted authored working notes, models, tools, test evidence and eligible source captures. The inventory lists every included payload and each excluded raw publisher file. It does not claim unrecorded work or missing historical chat text was recovered.

## Start here

1. Read `SKILL.md` and `outputs/latest-research-batch-status-2026-11-08.md` for the current state and limitations.
2. Use `outputs/research-pack-index.md` to navigate the complete source library and cases. Current `outputs/` references take precedence over older working drafts and old archives.
3. Read `DATA_LICENSES.md` and `batch-inventory.json` before moving source data to another service.
4. Continue the unfinished study only after freezing its endpoint, clocks and access rules. The design is in `work/cpi-gold-study-design-review.md`; no market-return or Treasury event-study statistics have been calculated.

## What is included

| Area | Main files |
|---|---|
| Broad macro and difficult data | `outputs/macro-gold-source-registry.md`, `outputs/advanced-market-intelligence-source-map.md`, `outputs/hard-to-get-market-data-playbook.md` |
| Macro/market frameworks | Gold drivers, cross-asset regimes, funding/collateral, derivatives/positioning, physical/issuer flows, market-expectations capture and calibration references in `outputs/` |
| Cases | GDP vintages, US banks, gold producers, oil majors, Japan/BOJ, China housing and local fiscal conditions, SNC credit migration |
| Evidence and forecast tools | Schemas, guides and portable Node tools under `outputs/scripts/`; 50 evaluator tests |
| Real CPI pilot | One unresolved issuance in `outputs/cpi-pilot-forecast-ledger.jsonl`; six case plans, only the first issued |
| Newmont model | `outputs/newmont-cash-flow-2026-11-08/` plus guide, source tables, builder, previews and independent reviews |
| New historical model-data route | `work/historical-cpi-expectations-route.md`, monthly Cleveland JSON, attribution, extraction scripts, both cohorts and 37 BLS release captures |
| New gold route and rights findings | `work/gld-historical-data-route.md`, metadata profiles and capture manifests; restricted raw payloads excluded |
| Proposed empirical study | `work/cpi-gold-study-design-review.md`; design only, not a completed result |
| Supporting work | All persisted authored reviews, extractors, audit reports, test logs and working fixtures under `work/` |
| Prior deliveries | Original `outputs/gptmacro_v.1.zip` and `outputs/gptmacro_v.1.1.zip`, unchanged |

## Status rules

The historical Cleveland series is a producer-maintained model benchmark, not survey consensus or proof of original-time delivery. The intended study contains 36 releases during 2022–2024; the older target-month cohort extends into January 2025 and is preserved separately. Extract BLS first-print values from their own releases before scoring; chart actuals may be unrounded.

`work/cpi-resolution-rehearsal/`, `forecast-evaluator-demo-*`, `work/forward-test/` and `work/forecast-schema-cases-*/` contain synthetic examples, future scenarios or deliberate invalid controls. They are software tests, not resolved forecasts or research evidence. Superseded audit failures are retained as history, with corrections in current references. Provisional Newmont operating leads are explicitly labeled in `work/newmont-operating-session-leads-2026-11-08.md`.

Do not run every script automatically. `register_*`, `repair_*`, old `build_claude_revision.mjs` and old finalizers are one-time historical operations and can alter files or address older layouts. Preserve original issuance timestamps and old archives. Reproduce the current evaluator tests from this folder with:

```sh
node --test outputs/scripts/forecast-evaluator.test.mjs outputs/scripts/evaluate-cpi-pilot.test.mjs
```

The evaluator core uses Node built-ins. Schema checks need Ajv 8 and ajv-formats 3 as documented in the guide. Model builders use a Codex spreadsheet authoring runtime that is not included; the finished XLSX and factual inputs are included. Python helper dependencies are also not bundled. Paths mentioning an original Windows workspace or runtime are historical provenance and may need local adaptation.

## Integrity and handoff

`batch-inventory.json` hashes all ordinary payloads and records exclusions. It and `validation.json` are generated metadata and do not hash themselves. The external ZIP checksum covers the entire archive. `validation-tests.tap` records the current package's test run. Earlier validation documents describe their own dated bytes; a later guide edit does not retroactively change those reports.

Claude should treat this package as a cumulative knowledge and reproducibility handoff. Continue private research. Keep cTrader demo-only; this batch contains no authorization to enable live trading, change credentials or place orders.
