# Revision 1.1 recipient-style forward review

Reviewed 8 November 2026 using the packaged `outputs/claude-update-v1-1/gptmacro-v-1/SKILL.md` entrypoint, then only the routed update, index, evaluation guide, CPI pilot and publication-time audit materials needed for this task. No publisher requests, future outcomes, master evaluator scripts or full test-suite reruns were used. Packaged references, stage and frozen V1 were not edited.

## Result

**The packaged October CPI evaluation executes successfully after the documented path substitution. It is an unresolved locally registered forecasting experiment, not a validated forecasting record.** The fresh report is `work/claude-v1-1-forward/original-as-of-report.json`.

The evaluation reproduced the original view at `2026-11-08T14:12:31.252Z`: one registered October case, one selected issuance, one unresolved case, zero scored cases and no aggregate scores. The six-month protocol supplies an intended denominator of six; only one case is in this supplied original plan, so the report explicitly retains five intended cases outside this input plan. It does not mislabel those five as forecast omissions at the original instant. The supplied evidence has known availability and no reported evidence issues. This is a check of the supplied assertions, not independent source authentication.

The issuance lead is `47.29132555555555` hours to the captured scheduled release, within the frozen 24–72-hour window and strictly before the T−24h selection cutoff. The point estimate is `0.255` percent monthly; the captured Cleveland primary baseline is `0.21`, and the predeclared persistence baseline is `0.30`. There is no observed target outcome to score. Secondary persistence reports `n: 0`, unavailable loss, and `primary_case_unresolved`.

The result explicitly records `source_truth_authenticated: false`, `publication_times_authenticated: false`, and `first_release_vintage_authenticated: false`. Local supplied timestamps and file hashes cannot independently prove external precommitment or unchanged release-day source bytes. Even one later resolved case would demonstrate an operational forecasting cycle rather than comparative predictive skill.

## Commands actually executed

All paths below are relative to the stated working directory. The packaged schemas remained beside the packaged scripts. Runtime check from the repository root: `node --version` returned `v24.16.0` (meets Node 20+). Both `Test-Path` checks for `work/schema-validator/node_modules/ajv/package.json` and `work/schema-validator/node_modules/ajv-formats/package.json` returned `True`.

From repository root:

```powershell
New-Item -ItemType Directory -Force -Path 'work/claude-v1-1-forward' | Out-Null
```

Result: exit 0; directory available.

From `C:/Users/Xanan/Documents/Codex/2026-11-07/continue-setting-up-my-meridianx-ctrader/work/claude-v1-1-forward`:

```powershell
node ../../outputs/claude-update-v1-1/gptmacro-v-1/references/scripts/validate-forecast-inputs.mjs --modules ../schema-validator/node_modules --ledger ../../outputs/claude-update-v1-1/gptmacro-v-1/references/cpi-pilot-forecast-ledger.jsonl --plan ../../outputs/claude-update-v1-1/gptmacro-v-1/references/cpi-pilot-evaluation-plan-2026-10.json --evidence ../../outputs/claude-update-v1-1/gptmacro-v-1/references/cpi-pilot-evidence-2026-11-08.json
```

Result: exit 0. Ajv 2020-12 with asserted date-time and URI formats, `ajv 8.20.0`, `ajv-formats 3.0.1`; one ledger record, one plan and six evidence records passed structural validation. No full suite was run. This command validates structure and formats; it does not authenticate source truth.

```powershell
node ../../outputs/claude-update-v1-1/gptmacro-v-1/references/scripts/evaluate-cpi-pilot.mjs --ledger ../../outputs/claude-update-v1-1/gptmacro-v-1/references/cpi-pilot-forecast-ledger.jsonl --plan ../../outputs/claude-update-v1-1/gptmacro-v-1/references/cpi-pilot-evaluation-plan-2026-10.json --protocol ../../outputs/claude-update-v1-1/gptmacro-v-1/references/cpi-pilot-protocol-2026-11-08.json --evidence ../../outputs/claude-update-v1-1/gptmacro-v-1/references/cpi-pilot-evidence-2026-11-08.json --as-of 2026-11-08T14:12:31.252Z --out original-as-of-report.json
```

Result: exit 0 with no stdout; the new report was written. `Get-Content -LiteralPath 'original-as-of-report.json'` was then executed successfully to inspect the actual result described above.

Reproduced input hashes (also emitted by the fresh report):

| Input | SHA-256 |
|---|---|
| Ledger | `3341d6397ad0715f490f80c3484a5824ee5323d5ac536ad953385f45e90ce1b1` |
| Evaluation plan | `4bbbed01b776c3f54459d11208ec21c6fc067b082acc48018750410b9f672538` |
| Protocol | `fb6fb6593672450c00af3bfa1406f3c7c1aa88403e51d30fb9ebcb71ce381157` |
| Evidence | `5bdb730452865e37719c30e9dc5872635273e7c8b8be02f1ac9f09f3c27fcb52` |

## Portability and guidance assessment

The package's entrypoint and update note explain that guide examples retain original-workspace `outputs/` paths and that recipients must substitute the installed skill's `references/` directory. Following that instruction worked. Executing from a separate working subdirectory demonstrated that the scorer's sibling import and schema-relative lookup do not require the original repository root as current directory. Every script and input passed to the substantive commands above came from the package. Existing validator dependencies were the only external runtime files used.

The guide gives an isolated pinned dependency installation command for a fresh recipient. That is a useful portable instruction, and the versions available here matched the pins. **A fresh dependency installation was not performed or validated by this review**; this environment already contained the pinned modules. Network access and the npm installation step remain recipient prerequisites for schema checking. The scorer itself needed no third-party packages.

No command failure occurred. Two remaining guidance frictions deserve attention:

1. The pilot's concrete scoring example omits `--as-of`, which defaults to wall-clock current time. For this requested original-view reproduction, I obtained `2026-11-08T14:12:31.252Z` from the packaged initial report and added `--as-of` explicitly. The generic guide documents this switch, so the task was recoverable without outside information. A copied ready-to-run original-view command would be clearer.
2. Dated examples still show `work/schema-validator/node_modules` and original `outputs/` paths. The entrypoint expressly corrects both assumptions and directs new recipients to isolated dependency setup, but a reader entering only the dated pilot may first try paths that do not exist in an installed skill. This is a discoverability friction, not an execution failure when the prescribed entrypoint is followed.

This was a recipient-style path adaptation run against the packaged tree in situ, not an installation of the entire archive on a separate clean machine. It verifies these packaged execution paths and supplied-input behavior, not every possible host environment. Raw publisher captures are absent from the package by design; manifests supply hashes and provenance metadata only, so this run makes no raw-byte source verification claim.

## Does a feed timestamp before embargo prove early public release?

**No.** Using only the packaged audit note and JSON, the September entry in the later-captured CPI Atom feed has `published` and `updated` equal to `2026-10-14T07:50:31.2-04:00` (`11:50:31.200Z`). Its embargo is `12:30:00Z`, a gap of `2368.8` seconds (39 minutes 28.8 seconds). That establishes a publisher metadata field predating the embargo in the version captured on 8 November, not public access on 14 October before embargo. The record could reflect preparation/lifecycle metadata. The raw contemporaneous public-availability history is not in this portable package.

The other packaged example reinforces the distinction: the latest-number feed has a 6 November `pubDate` while still carrying September observations. Its date therefore does not identify the original September release instant. HTTP Date, Last-Modified, ETag, schedule, reference period and completed receipt describe different clocks or versions. A current receipt can establish that the collector had this version by receipt; it cannot retrospectively establish earliest public availability. Actual publication remains unknown unless appropriate evidence establishes it. The frozen pilot must not substitute these metadata fields, a schedule or a receipt merely to make strict resolution pass.

The feed audit occurred after the original forecast issuance. It was used here to answer the separate publication-clock question and was not introduced retrospectively into the forecast's original evidence set.
