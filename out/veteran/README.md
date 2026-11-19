# Macro veteran (gptmacro_v.1, revision 1.8) — the owner's research skill as a council member

Uploaded by the owner on 8 Nov 2026 ("this is our updated veteran macro, insert on the system and deploy it on the website");
revision 0.1 arrived the same morning ("add this as macro veteran so he will discuss with the macro of the council").
Revision 1.3 arrived on 9 Nov 2026 ("update veteran macro with this new info"). On 19 Nov 2026 the owner sent the 1.5 top-level
files (SKILL.md, START_HERE.md, DATA_LICENSES.md, validation.json, package-tests.txt) and the 1.8 combined news batch
("more stuff to implement on macro"): the 1.6, 1.7 and 1.8 news increments in one package.

## What's new in 1.8

- Release order: PPI came out before CPI for the same month in only 5 of 36 months of 2022-24; CPI and PPI both came before PCE in all 36.
- CPI and PPI as a forecast of PCE: over 24 expanding-window tests, core CPI plus one broad PPI measure improved on core CPI alone by a tiny, unstable amount. Not a signal, and not a trade.
- A jobs-report ledger: 36 BLS Employment Situation releases (Dec 2021 to Nov 2024 data) with payrolls, unemployment, hourly earnings, weekly hours and the prior two months' revisions, each with its source excerpt. Archived pages, not proof of the bytes first posted.
- Consensus for those 36 releases is deliberately left empty: a forecast column from a later calendar is not what the market expected before the release. No surprise is computed without a frozen pre-release consensus.
- Seven jobs days of 2022-24 had an ISM report the same morning (verified one by one); other regular releases showed no same-day match in seven bounded inventories. An overlap list, not a complete check.
- A register of ten ways to test news on the demo (CPI parts, jobs fields, Fed stages, continuation vs reversal, claims / JOLTS, PCE, retail, Treasury auctions, ISM, oil inventories), each with the data it still needs. None is validated; it needs timestamped consensus, real bid / ask quotes, spread, delay and a no-trade comparison first.
- The 1.5 base adds an October 2026 CPI pilot check (archive shows 0.3%, still unscored), an NBU / CPI clock audit (756 fields, no gold prices analysed) and a macro-release overlap audit. Those reference files came with the 1.4 outputs (17 Nov) and are already in the library.

## What's new in 1.4 research outputs (17 Nov 2026)

- The October 2026 core CPI pilot is still unresolved: today's BLS archive shows 0.3% against the forecast 0.255%, but the original release-day evidence could not be authenticated, so a pending attempt was logged with no outcome and no score. The desk shows it as one pending attempt, never as a result.
- Cleveland nowcast against a simple "last print" baseline, 36 CPI releases of 2022-24: no clear advantage (slightly lower squared error, higher absolute error, the interval spans zero, and the sign flips without 2022). A public nowcast is not a strong release predictor here.
- NY Fed survey archive: 26 workbooks mapped and two checked in detail; usable aggregate expectations, but the collection date is not proof the answers were public before a meeting.
- The National Bank of Ukraine's accounting gold price: a dated method history (a wartime metals freeze, clock changes) and a clock check of 36 CPI days with zero failures. Still no gold prices analysed.
- A wider macro calendar audit (216 regular releases, PCE at 10:00, holiday-shifted claims): the broad news exclusion for the Treasury study is still not ready.
- No new trading or gold result in this increment.

## What's new in 1.3

- CPI first prints, checked: all 144 headline and core CPI figures from the 36 releases of 2022-24 agree between the BLS tables, the release text and a separate extraction. Reissues (June/July 2024) and corrections are mapped. Archived pages are not proof of the original-day bytes.
- BLS release integrity: an official inspector-general report confirms part of the May 2024 CPI was public about 31 minutes before 8:30. A scheduled time is not proof of when a number was first available.
- CPI days move real yields more: on the 36 CPI days of 2022-24 the 10-year real yield moved 6.11 bp on average (up or down) against 4.06 bp on comparable days, a difference of +2.06 bp (rough 95% range 0.20 to 3.96 bp). Only 20 of 36 days were above their comparison, and 2022 was mixed. A daily association, not proof that CPI caused it, and nothing about gold yet.
- Removing the Fed-statement days leaves +2.24 bp over 35 events (other Fed news and speeches are not filtered out).
- A new permitted gold-price route (the National Bank of Ukraine's accounting price) was checked for rights and dates only; no gold numbers were analysed.
- Not done yet: the Cleveland-nowcast vs simple-baseline comparison, the GLD study and the broader news exclusion. The October 2026 CPI pilot is still one unresolved forecast.
- Unchanged from 1.2: the operating standard, the system blueprint, the expectations-capture playbook, the oil-majors and other cases, the forecast evaluators (50 tests) and the CPI pilot ledger.

## Layout

- `SKILL.md`, `START_HERE.md`, `DATA_LICENSES.md`, `validation.json`, `package-tests.txt`: revision 1.5 as delivered (`BATCH_INDEX.md` is
  1.3's). Assistant and tool names in the text were made neutral (repository rule 6); nothing else was changed.
- `references/` also holds the 1.8 news batch's `outputs/` (its three handoff readmes renamed `v1-6-…`, `v1-7-…`, `v1-8-…`).
- `references/`: the batch's `outputs/` (registries, frameworks, cases, schemas, the forecast evaluators and their 50 tests,
  the Treasury CPI-day study with its Python scripts and 12 tests, the CPI first-print ledger, the real October 2026 core-CPI
  pilot ledger, the Newmont workbook).
- `notes/`: the batch's authored working notes (`work/*.md`): design reviews, independent reviews, route findings, audits.

Left out (as in 1.2): the batch's `work/` scripts (one-time capture / repair / registration / packaging programs), its JSON
review dumps (the 1.35 MB Treasury outcome review and the like), synthetic rehearsals and test fixtures, and `work/raw/`
(about 78 MB of raw publisher captures: 37 BLS release pages, BEA PDFs, the 7.7 MB Cleveland JSON, Treasury HTML/XML, the
DOL OIG PDF, NBU responses). They are provenance, are listed with hashes in the batch's `batch-inventory.json`, and some are
restricted (`DATA_LICENSES.md`). `batch-inventory.json` (hash list) is also left out. From 1.5 `package-tests.txt` (the test log) is kept, because
`validation.json` no longer carries the test counts.
1.8 news batch: its `work/` Python scripts and its five overlap JSONs (raw-file paths from the author's own computer) are
left out; the matching `.md` route notes are already in `notes/`.
1.4 research outputs (17 Nov 2026), installed the same way: the new and changed `outputs/` files in `references/`, the authored
`work/*.md` in `notes/`. Left out: `cpi-model-benchmark-protocol-2022-2024.json` (it names an AI product, rule 6, and is bound by
its published SHA-256, so it is not edited; the `.sha256` file is kept), the work scripts, raw publisher captures, the synthetic
CPI-resolution rehearsal and the forecast-schema test cases. Product names in the markdown were made neutral, as in 1.3.

`council/veteran.mjs` is a code port of the parts a deterministic council member can run without an LLM or a data budget:
the shock fingerprint (cross-asset regime framework), the gold driver panel (gold driver map), the discussion discipline
(operating standard), the weekly binary forecast ledger scored the evaluator's way and, from 1.3, the release discipline:
the expectation captured before each release, the first print kept, integrity checks before a surprise is scored, the
Treasury CPI-day study as rate context and claim labels (descriptive association vs prospective prediction). It also
reports the batch's own CPI pilot (`cpiPilot`). The whole library is published on the site at `/veteran/` (built by
`scripts/veteran-index.mjs`) and read from the Macro desk's "Veteran library" tab.

Paper research only. The batch authorises no live trading, no credential change and no order.
