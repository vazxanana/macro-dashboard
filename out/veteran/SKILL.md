---
name: gptmacro-v-1
description: Research macroeconomics, gold, financial markets, issuer fundamentals and difficult financial data using primary sources, explicit vintages, reproducible calculations and forecast evaluation.
metadata:
  display_name: "gptmacro_v.1"
  version: "1.3"
---

# gptmacro_v.1 — complete research batch, revision 1.3

Read `START_HERE.md` first, then `outputs/latest-research-batch-status-2026-11-09.md` and `outputs/research-pack-index.md`. Load only the references needed for the question. This complete batch preserves the original workspace layout: current references, models and tools are in `outputs/`; supporting research notes, source extractors, audits and eligible captures are in `work/`.

The user confirmed **private research and trading**. That purpose is not a blanket redistribution or commercial-data licence. `DATA_LICENSES.md` and `batch-inventory.json` identify source attribution, included data and individual exclusions. Restricted raw publisher files remain represented by URLs, hashes, field profiles and authored findings.

## Current state

- The forecast evaluators passed 50 tests. Synthetic demonstrations and deliberately invalid controls are labeled; they are not market outcomes.
- The October 2026 CPI pilot contains one real locally timestamped 0.255% core-monthly issuance and remains unresolved. Six absolute case plans exist, but only October has an issued forecast. Do not copy its input values into future months or backdate a record.
- The Newmont workbook passed 17 behavioral checks and independent calculation/source review. It is a Q3-equivalent consolidated cash-flow sensitivity, not a Q4 forecast, DCF or equity target. Desktop Excel itself was not opened.
- Newly discovered Cleveland chart JSON supplies historical daily model benchmarks and is included with the chart's CC BY 4.0 declaration. It is not survey consensus or an independently captured historical delivery log.
- The separate Treasury study is frozen and calculated: 36 CPI-release windows, +2.06 bp mean absolute real10y change versus matched controls; approximate L3 interval [0.20,3.96] bp. Its formal-FOMC exclusion gives +2.24 bp over35 scored events. Both have independent reconstruction. Read their full limitations; this is daily association, not causal CPI identification or a trading result.
- The CPI release-vintage ledger has144 independently agreeing printed fields over36 releases, plus corrected reissue/format metadata. Present archived bytes are not authenticated original-day bytes.
- NBU offers a separately defined UAH gold accounting-reference route with affirmative publisher-use conditions. Its1096 effective dates represent781 calculation dates; price values remain analytically uninspected. Methodology/FX/carryover gates remain.
- The conditional GLD NAV study remains uncalculated and rights/clock-gated. A Cleveland-versus-baseline forecast-quality study was only proposed when this handoff was requested; no such comparison was frozen or calculated.

## Research decisions

For current or unstable facts, check the originating agency, central bank, exchange, regulator, issuer or dataset producer. Record reference period, publication metadata, completed receipt, vintage, units, adjustment status and reporting perimeter. A schedule, feed field, current archive or file hash does not authenticate actual historical first publication.

Separate reported observations, estimates, calculations and interpretations. Check whether several pages repeat one upstream measurement. Preserve distinctions such as stocks versus flows, residence versus nationality, consolidated versus attributable, production versus sales, cash versus accounting, market close versus NAV, and daily association versus intraday response.

For release research, retain the original first print and genuine pre-release expectations if available. Do not call a model forecast error survey consensus or relabel actual-minus-previous CPI as market surprise. The historical calendar-release cohort is December 2021–November 2024 reference months, producing 36 releases during calendar 2022–2024; the separate target-month extraction extends into January 2025 and must not silently replace it.

For forecasts, fix the target, resolution rule, cohort, cutoff, version selection, loss and comparator. Validate structure separately from semantic/scoring rules and source truth. Keep unresolved, unissued, ineligible and missing-baseline cases visible. Use appropriate mean/median/quantile losses; retain infinite log-loss status and paired comparison counts. First-release authenticity cannot be established by a nonempty vintage label.

For issuer analysis, reconcile reported cash before projecting macro effects. Newmont's operating-asset/liability cash use includes actual reclamation spending. Its consolidated cash capex differs from attributable capex. AISC cannot be deducted again from a cash-flow bridge already incorporating costs and capital spending. Its price-linked charge proxy, cash-tax response and fixed-volume assumptions are dated model assumptions, not universal issuer facts.

Lead with the conclusion, then evidence, mechanism, strongest counterargument, conditions that would change the view and the most material missing evidence. Match language to what was established: descriptive association, prospective prediction, causal identification and execution performance are different claims. Historical model selection and a retrospective freeze do not create an untouched prospective test.

## Using the files

Run the supplied `outputs/scripts/` commands from this folder; the original `outputs/` and `work/` paths are retained. Node.js 20+ is needed for the offline evaluators. Schema validation additionally needs the Ajv packages described in the guide. Dependencies, caches and the original assistant's spreadsheet runtime are not bundled. Use the prebuilt workbook or an available verified spreadsheet engine for changes.

The `work/` tree includes one-time repair/registration programs, provisional leads, synthetic future rehearsals and failed access attempts. Read their purpose before execution; do not run all scripts or treat test-generated resolutions as real records. Current `outputs/` files are the main reference layer. Older delivery ZIPs are omitted as duplicates; their hashes are in the inventory. This standalone bundle includes the current library. Historical validator scripts that require an old ZIP need that separate original archive.

Some dated validation-report hashes differ after later documented reference edits. Use this batch's inventory for current bytes and preserve older audit timestamps. Raw captures that are absent are explicitly listed; hashes do not authenticate unavailable source bodies. Source freshness and predictive validity still require their own evidence.

The user's cTrader constraint remains **demo only**. The research package authorizes no live trading or order execution. Credentials belong in the authorized environment/secret store, never in examples, reference files or reports.
