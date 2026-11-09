# Macro veteran (gptmacro_v.1, revision 1.3) — the owner's research skill as a council member

Uploaded by the owner on 8 Nov 2026 ("this is our updated veteran macro, insert on the system and deploy it on the website");
revision 0.1 arrived the same morning ("add this as macro veteran so he will discuss with the macro of the council").
Revision 1.3 arrived on 9 Nov 2026 ("update veteran macro with this new info").

## What's new in 1.3

- CPI first prints, checked: all 144 headline and core CPI figures from the 36 releases of 2022-24 agree between the BLS tables, the release text and a separate extraction. Reissues (June/July 2024) and corrections are mapped. Archived pages are not proof of the original-day bytes.
- BLS release integrity: an official inspector-general report confirms part of the May 2024 CPI was public about 31 minutes before 8:30. A scheduled time is not proof of when a number was first available.
- CPI days move real yields more: on the 36 CPI days of 2022-24 the 10-year real yield moved 6.11 bp on average (up or down) against 4.06 bp on comparable days, a difference of +2.06 bp (rough 95% range 0.20 to 3.96 bp). Only 20 of 36 days were above their comparison, and 2022 was mixed. A daily association, not proof that CPI caused it, and nothing about gold yet.
- Removing the Fed-statement days leaves +2.24 bp over 35 events (other Fed news and speeches are not filtered out).
- A new permitted gold-price route (the National Bank of Ukraine's accounting price) was checked for rights and dates only; no gold numbers were analysed.
- Not done yet: the Cleveland-nowcast vs simple-baseline comparison, the GLD study and the broader news exclusion. The October 2026 CPI pilot is still one unresolved forecast.
- Unchanged from 1.2: the operating standard, the system blueprint, the expectations-capture playbook, the oil-majors and other cases, the forecast evaluators (50 tests) and the CPI pilot ledger.

## Layout

- `SKILL.md`, `START_HERE.md`, `BATCH_INDEX.md`, `DATA_LICENSES.md`, `validation.json`: the batch as delivered.
- `references/`: the batch's `outputs/` (registries, frameworks, cases, schemas, the forecast evaluators and their 50 tests,
  the Treasury CPI-day study with its Python scripts and 12 tests, the CPI first-print ledger, the real October 2026 core-CPI
  pilot ledger, the Newmont workbook).
- `notes/`: the batch's authored working notes (`work/*.md`): design reviews, independent reviews, route findings, audits.

Left out (as in 1.2): the batch's `work/` scripts (one-time capture / repair / registration / packaging programs), its JSON
review dumps (the 1.35 MB Treasury outcome review and the like), synthetic rehearsals and test fixtures, and `work/raw/`
(about 78 MB of raw publisher captures: 37 BLS release pages, BEA PDFs, the 7.7 MB Cleveland JSON, Treasury HTML/XML, the
DOL OIG PDF, NBU responses). They are provenance, are listed with hashes in the batch's `batch-inventory.json`, and some are
restricted (`DATA_LICENSES.md`). `batch-inventory.json` (hash list) and `package-tests.txt` (test log) are also left out;
`validation.json` carries their summary.

`council/veteran.mjs` is a code port of the parts a deterministic council member can run without an LLM or a data budget:
the shock fingerprint (cross-asset regime framework), the gold driver panel (gold driver map), the discussion discipline
(operating standard), the weekly binary forecast ledger scored the evaluator's way and, from 1.3, the release discipline:
the expectation captured before each release, the first print kept, integrity checks before a surprise is scored, the
Treasury CPI-day study as rate context and claim labels (descriptive association vs prospective prediction). It also
reports the batch's own CPI pilot (`cpiPilot`). The whole library is published on the site at `/veteran/` (built by
`scripts/veteran-index.mjs`) and read from the Macro desk's "Veteran library" tab.

Paper research only. The batch authorises no live trading, no credential change and no order.
