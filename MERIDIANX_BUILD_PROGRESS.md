# MeridianX Academy: build progress

Resume file for the owner's autonomous build directive (10 Nov 2026). Update after every milestone. The contract between
modules is `docs/academy/ARCHITECTURE.md`.

## Where things stand

- **Deployed.** The owner said "Deploy everything" on 10 Nov 2026: the development branch `claude/website-display-xoyadz`
  (PR #1) is merged to `main`, which deploys to production (`/academy`, owner only). Fred's connector (#710) went first.
- **Current phase:** 1 to 9 built and verified. What the owner still has to do is under "Next (not done)".

## Previous work stopped or preserved (10 Nov)

- The every-minute "keep improving" loop: already gone after the session restart (no scheduled jobs found).
- Two agents were halted by the usage limit on 9 Nov. Their unfinished, **unverified** work is saved, not merged:
  - `wip/desk-inner-pages` (Desk inner pages design pass, includes the Council → Systems `sn is not defined` fix request).
  - `wip/data-clock-fixes` (COT release-lag alignment and a first HistData clock fix). Its clock part is superseded by the
    audited correction of 10 Nov 2026 (branch `academy-clock`, `docs/academy/DATA-CLOCK.md`); its COT part is open as
    `docs/owner-decisions.md` item 25.
- Everything merged before (#682 to #708) is on `main` and reused as is.
- Not stopped (outside this session's control, and production): the council loop on GitHub Actions and the Vercel crons.

## Completed

- [x] Repository audit (see the architecture file, section 1).
- [x] The seven edges identified from `council/decay.mjs` (assumption documented in the architecture file, section 2).
- [x] Module contract written (data shapes, function names, API surface): `docs/academy/ARCHITECTURE.md`; what was
  actually built: `docs/academy/MODULES.md`.
- [x] **Edges** (`academy/edges.mjs`, `academy/gen/`, `academy/data/`): candidates and outcomes for all seven edges, produced
  by running each study's own replay code on the research candles. Every edge reproduces its study's published n and net R
  per trade exactly (the generator throws otherwise). 2,783 candidates; 2,131 usable since the clock correction of 10 Nov 2026 (2,775 and 2,058 before it; `docs/academy/DATA-CLOCK.md`).
- [x] **Replay** `assets/academy-replay.js` (`MXR`): candle loading, closed-bar slicing, snapshots with a look-ahead guard,
  clock (play / pause / step / jump / 1x to 100x / restart), session save and restore.
- [x] **Core** `assets/academy-core.js` (`MXA`): 95 features, regimes, the decision policy (BUY / SELL / WAIT / MANAGE with
  evidence, gates, invalidation), market thesis, lesson memory, attempt comparison, error classes, counterfactuals, model scoring.
- [x] **API and store** `api/academy.js` (owner only, private Blob or a local file store), **risk engine**
  `assets/academy-risk.js` (`MXK`, 0.25 % a trade, prop-firm simulation on the ChronosTrade presets), **optional
  language-model adapter** `api/_academy-llm.js` (off without a key; daily / monthly / hard budgets; cost ledger).
- [x] Flagged setups (weeks whose clock could not be verified, before 2020) are left out of candidate lists and can never be scored as a test;
  `history` route for "similar past cases" (train pool only, finished before the moment asked about, no ids).

- [x] **Dataset and training service** (`academy/gen/features.mjs`, `academy/gen/evaluate.mjs`, `ml/`,
  `docs/academy/TRAINING.md`): one feature row per candidate from closed bars only (`academy/data/feat-<edge>.json`, so
  "similar past cases" now works), the decision policy measured against taking every setup (`academy/data/eval.json`), an
  offline gradient-boosting scorer with chronological walk-forward validation, JSON tree export and a parity check against
  `MXA.score` (max difference 5e-7). Manual workflow `academy-train.yml` (never on push, commits nothing; not yet run on GitHub).

### Honest results so far (corrected research clock, train pool, 2020 → now, flagged setups left out, net R a trade after costs)

| Edge | Every setup: n, R, t | Policy takes: n, R | Policy waits: n, R | Difference t |
|---|---|---|---|---|
| replica | 325, +0.406, 2.34 | 169, +0.148 | 156, +0.685 | −1.53 |
| mosha-bo | 28, +0.815, 1.79 | 15, +1.227 | 13, +0.339 | 1.01 |
| gtrend | 18, +1.885, 1.60 | 18, +1.885 | 0 | n/a |
| gtl | 166, +0.216, 2.13 | 59, +0.400 | 107, +0.114 | 1.33 |
| geg | 82, +0.469, 2.05 | 54, +0.463 | 28, +0.481 | −0.03 |
| gmp | 513, +0.075, 1.35 | 120, −0.041 | 393, +0.110 | −1.17 |
| nq-open | 344, +0.204, 2.39 | 87, +0.481 | 257, +0.111 | 1.84 |
| all | 1,476, +0.252, 4.74 | 522, +0.312 | 954, +0.219 | 0.82 |

- These are the numbers after the research-candle clock was corrected (10 Nov 2026). The table on the old clock (1,421
  trades, +0.249, t 4.57; difference t 1.17) is in `docs/academy/DATA-CLOCK.md`. Nothing changed in kind.
- **The deterministic policy, with no lessons, does not yet add measurable value over taking every setup** (no edge reaches
  t 2; on replica and gmp it is worse, not significantly). This is the baseline the mentor's lessons have to beat.
- **No trained scorer beats taking every setup.** Out of fold: replica AUC 0.547, gtl 0.456, gmp 0.489, nq-open 0.579,
  pooled 0.587 (0.534 within edge); none with t ≥ 2, and on gtl the kept trades did worse than the skipped ones (t −2.30).
  All five are stored as rejected challengers (`promoted: false`); mosha-bo, gtrend and geg have too few trades to fit.
  Nothing is promoted automatically, and nothing was promoted.

- [x] **The Academy page, Phase 2 loop** (`academy.html`, `assets/academy-ui.js`, `assets/academy.css`): select an edge → replay
  real candles → decision with evidence (stored at once) → mentor correction → lesson saved → replay the same trade → compare
  attempts → test on new setups (unseen exam pool, with and without lessons, kept apart) → paper account under the risk engine.
  Local server `scripts/academy-dev.mjs`, end-to-end audit `scripts/audit/academy.cjs` (88 checks, in CI), page tests.
- [x] **Research engine** (`academy/gen/research.mjs` → `academy/data/research.json`, `docs/academy/RESEARCH.md`): 154 notebook
  entries from pre-registered studies on the train pool (baselines, 420 registered conditions of which 130 had enough trades,
  regimes, the book, the policy). **Nothing validated**: 0 conditions survive the multiple-comparison correction and none is
  out-of-sample; 2 are in-sample only and 3 flipped sign and are rejected. About 6.2 of 130 would pass discovery by chance;
  5 did. No draft lesson is offered. (On the old clock one gtl condition was out-of-sample only at t 2.10; on the corrected
  clock it does not pass discovery.)
- [x] API reads for the page: corrections, research, evaluation, training report; module bugs found by the page work fixed
  (a stored decision keeps whether a lesson was applied; evidence text gives dates).

- [x] **All page sections** (`assets/academy-tabs.js`): Lessons (revise with a diff, switch off / on, research drafts with
  their evidence), Progress and mistakes (recall and new-setup records side by side, error classes, a 1 / 3 / 7 / 21-day
  review queue), Research lab and the owner's notebook, Models (training report and registry; promotion is a manual owner
  step), Costs, Audit trail, Blind arena (the mentor answers before the engine's stored answer is shown; the result is read
  last), Session training with missed opportunities and "right to wait" notes. API additions: `get=blind`, `get=misses`,
  `action: miss`.
- [x] **Inside the production firewall limit** (30 requests a minute on /api): the page paces itself to 24 Academy calls a
  minute, waits out a 429, never drops a write. Measured: 1 call a train decision, 2 a test setup, 3 a blind setup.
- [x] Owner-only link to `/academy` in the Desk's account menu (checked by the lead: owner sees it; reviewer, viewer and
  guest do not).

- [x] **What-if card** (Train, test results, Blind arena): once an answer is stored, the candles after the decision are loaded
  on request and `MXA.simulate` plays the setup as proposed, the engine's answer, the mentor's levels and fixed variants (stop
  at half and one and a half times the distance, targets at 1R / 2R / 3R, entry one candle later). Nothing is stored; no
  snapshot ever holds those candles; the card says that hindsight is for study, not evidence.

## Phase 9: finish, validate, improve (10 Nov, in progress)

Merged into the development branch and verified by the lead (suite, browser audit, live-candle review after each merge):

- **Preview, safe and opt-in** (`docs/academy/PREVIEW.md`, `tests/academy-preview.test.mjs`): one named branch builds a
  preview only when the project variable `MX_PREVIEW_BRANCH` is set; a preview keeps its Academy files under
  `academy-preview/`. No preview exists: this session's Vercel connection sees the team but not the project.
- **The analyst** (`docs/academy/LLM.md`, `api/_academy-analyst.js`, `assets/academy-analyst.js`): the optional language
  model's second opinion on a decision the engine has already stored. Off without a key; checked in code; held by the engine's
  hard gates; stored apart. Only ever run against the labelled fake: no real call, $0.
- **Replay and Prove, proven** (`tests/academy-prove.test.mjs`): fresh decisions, a context reset, lesson retrieval and
  application, unseen evaluation, conflicting lessons, deactivation, regression after new lessons; a no-lesson control
  (`MXAC.proveWithControl`) and "Check earlier corrections" on the Lessons tab. An exam setup refuses a correction (409).
- **Security and reliability** (`tests/academy-security.test.mjs`): every route enumerated from the handler's own tables,
  validation, storage, look-ahead, isolation, pacing.
- **Four defects found by that work, fixed by the lead:** a TAKE / FLIP lesson overruled by the final reward-to-risk gate or
  the risk engine is now recorded as not applied; a store write step is all or nothing (earlier files are put back when a
  later write fails); a lesson condition, feature or model metric named like an inherited object member is refused and the
  matcher reads own properties only; both look-ahead guards know every field of the outcome file.
- **The Council → Systems "sn is not defined" bug** fixed (`renderReplica`); the page smoke test now opens 13 inner Desk views.
- **The lead's independent review on live candles** (`scripts/audit/academy-review.mjs`): 38 of 38 on the pre-clock data.
- **Owner acceptance checklist**: `docs/academy/ACCEPTANCE.md`.

- **Research-candle clock corrected** (`docs/academy/DATA-CLOCK.md`, `research/edge/histdata-clock/`, `council/histdata.mjs`):
  New York time in 2018; from 2019 UTC−5, and UTC−4 while Europe is on summer time. Pre-registered audit: 4,755 of 4,755
  decisive OANDA symbol-weeks, 2,191 of 2,195 release minutes; 26 of 99 symbol-years stay uncertified (all of 2023: the files
  have a hole from 20 Feb to 30 Jul). Studies, Academy data, research, scorers and three monitoring baselines re-run; originals in
  `academy/archive/pre-clock/`. No trading rule changed. Flagged setups 187 → 101 (`rule.clockShift` now means "week not
  verified against a second feed"). The lead's check on live candles after the merge: sampled setups sit on the live feed in
  59 of 59 cases, and in 23 of 23 inside the US / Europe mismatch weeks.

- **Policy investigation: nothing passes, nothing changed** (`research/edge/academy-policy/`, pre-registered before any run;
  discovery = first 60 % of the train pool by time, validation = last 40 %). Five candidate policies, 16 validation tests,
  none reaches t 2 (largest 1.00); `policy-1.0` stays. The unseen pool was read 0 times (`academy/data/exam-ledger.json`).
  Why it does not help on replica and gmp: the evidence margin does not rank trades (rank correlation with net R about −0.1 to
  0 in both parts); the replica gap is a discovery result that did not repeat (−0.73R, t −1.43 → −0.07R, t −0.19); the gmp gap
  keeps its sign and is significant in neither part; two votes are constants because the 10R cap is read as a target. The data
  cannot show a real +0.1R: the smallest difference that reaches t 2 on validation is 0.35R (gmp) to 1.28R (replica).
  Max drawdown, every setup against the setups the policy takes (R): replica 26.63 / 17.13, mosha-bo 4.57 / 3.11, gtrend
  5.26 / 5.26, gtl 13.48 / 5.47, geg 7.33 / 7.64, gmp 16.06 / 11.88, nq-open 16.29 / 4.94, all 32.45 / 24.07 (a take-set
  holds about a third of the trades, so a smaller drawdown is not evidence of selection). The lead recomputed the
  discovery / validation figures and both drawdowns from the outcome files: they match.

- **Model-training review: no scorer passes, none promoted** (`research/edge/academy-ml-review/`, pre-registered). 20 scorers
  walk-forward (the reference trees and four low-capacity configurations): best own-test t 0.95, 12 of 20 negative, 0 beat the
  prior rate on calibration. Three trainer defects fixed (the embargo ended at the first unit's exit; the keep threshold was
  chosen on trades not yet closed; the unseen pool was read by default: the trainer now cannot read it). Leakage checks:
  shuffled labels give AUC 0.50; a planted outcome column jumps to 0.91, no real feature behaves like it. mosha-bo, gtrend and
  geg are too small to fit. Smallest kept-minus-skipped difference that could reach t 2: 0.29R (gmp) to 0.90R (replica).

Outside the Academy, same day: the mirror's replica book (PR #709, on `main`), the reconciliation tool, and Fred's connector
(#710, merged to `main` on the owner's word: Fred has full control of the ICT edge; the stop guard, paper / demo only and the
ICT file allowlist still bind him).

## Next (not done)

- [x] **Production**: merged to `main` on 10 Nov 2026 (owner: "Deploy everything"). A preview is still possible with
  `MX_PREVIEW_BRANCH` (`docs/academy/PREVIEW.md`).
- [ ] First real use: the store is empty in production until the owner trains. Every number on the page comes from the
  owner's own stored attempts; the audit's rows live only in temporary test stores.
- [ ] The policy does not beat taking every setup yet (table above): improving it is what the mentor's lessons and the
  research drafts are for; it was deliberately not tuned on the training results.
- [ ] Not built: automatic promotion (by design), a browser upload of model files (promotion is documented as a manual API
  step), a dollar-index series for gold decisions (no candles for it), live-candle runs of the Blind and Session tabs
  (recorded candles only), statistical training and the research run started from the page (both are commands and a manual GitHub workflow, by
  design: no long job runs in a site function).
- [ ] Owner decisions: what the clock correction leaves open (`docs/owner-decisions.md` items 19-25: baselines, one ICT
      variant that now passes its bar, the studies not yet re-run); whether `/api/academy` should get a higher firewall
  limit; a language-model key and budget, if commentary is wanted; the seven-edge assumption.

## Architecture decisions

See `docs/academy/ARCHITECTURE.md` section 3. In short: deterministic first, explicit lessons instead of pretending model
weights change, no look-ahead by construction, private Blob persistence, full isolation from council and broker code.

## Verified tests

- Whole suite on the development branch: **1,073 passing, 0 failing, 0 todo** (`node --test tests/*.test.mjs tests/*.test.js`;
  914 at the end of phase 8, 719 before the Academy). Model parity: `node ml/parity.mjs`.
- `node scripts/audit/academy.cjs`: **270 of 270**, then the analyst block **48 of 48** (fake provider, and the connector with a scripted assistant). `node --use-env-proxy
  scripts/audit/academy-review.mjs` (live candles): **41 of 41**. The paragraph below describes the 225-check stage.
- `node scripts/audit/academy.cjs`: **225 of 225** (run by the lead after the last merge; also green on GitHub's runner at the
  88-check stage). The loop part: the clock pauses on a real setup, the decision and
  its evidence are stored, a SELL corrected to WAIT becomes a lesson, the same-trade replay gives WAIT with the lesson applied
  ("learned"), the test on 3 unseen setups stores both answers (with lessons 0.00R against +1.42R without, n = 3, "too few to
  judge": this lesson passes recall and does not help on new setups, which is exactly what the split is for), a reload keeps
  everything, no snapshot held a future bar, no outcome was asked for before its attempt.
- Live candles: all seven edges reached a stored decision (page agent's run). The lead walked the whole loop on live
  NAS100 candles for nq-open (30 Jul to 28 Sep 2026, pacing on): SELL with low confidence (25 similar past cases, 28 % winners,
  −0.19R) → corrected to WAIT → lesson "session = overlap → WAIT" saved → same-trade replay "Learned" → 10 new setups tested
  and stored → 27 audit rows, no page error.
- Desk link by role (lead's Playwright check): owner visible; reviewer, viewer, guest hidden.
- API review by the lead: method, same-origin, session and owner checks run before any work; ids, edges, months and session
  ids are validated by pattern; bodies are capped at 256 KB; errors are generic; the language-model key is read from the
  environment only and never returned.
- `sh scripts/build.sh` leaves `out/` unchanged (CI "build" check).
- Replay + core on real gold candles from the live candle proxy (12 Mar 2025): regime read, WAIT with reasons.
- Candidates against the live candle proxy (30 usable setups an edge, entry price against the 5m candles within 10 minutes
  of the signal time): replica 30 / 30 inside, gtl 30 / 30, gmp 30 / 30, nq-open 30 / 30 (one of an earlier 8 was 0.26R
  outside: the research and proxy index feeds differ by a few points); mosha-bo and geg are limit orders that fill later
  (inside or resting, none wrong); gtrend and geg daily signals are stamped 00:04 UTC, so a Friday signal falls on the
  closed weekend market (no candle at that minute; the entry is the next open). No setup was on the wrong price.

## Known problems / external blockers

- **Research-candle clock: corrected on 10 Nov 2026.** A pre-registered audit (`research/edge/histdata-clock/`) settled the
  rule: the HistData labels are New York time in 2018 and follow Europe's summer-time dates from 2019 (4,755 of 4,755
  decisive weeks against OANDA H1 agree; 2,191 of 2,195 release minutes). Every study loader now converts with
  `council/histdata.mjs`, the seven edges' source studies were re-run, and the Academy data was regenerated
  (`docs/academy/DATA-CLOCK.md`; the old files are in `academy/archive/pre-clock/` and in git at 81f35f51). 101 of the 2,783
  candidates keep `rule.clockShift`, which now means "the week could not be verified against the second feed" (most sit in
  the hole of the 2023 files). Open for the owner: the live ICT replay still reads the files with the old clock
  (`docs/owner-decisions.md`).
- Data quality (`academy/data/quality.json`): both H1 research series are "usable", not "certified" (gold 97.65 %, NAS100
  97.36 % coverage); 2023 is "unreliable" for both (about 87 %); the NAS100 09:30–11:00 M1 window is "unreliable".
- `gmp` (gold momentum pullback) candidates come from the robustness study's port, which departs from live (one position at
  a time, $0.15 cost); live it is a test / shadow system. `replica` has only 50 test setups and none after 27 Apr 2026.
- No language-model API key exists in the project, and none is needed: since 10 Nov 2026 the analyst's questions are queued
  and answered by the owner's own assistant through the connector (`docs/academy/LLM.md` section 9; no cost from this site).
  The paid-provider path stays built and off. Neither has met a real model yet: the provider path ran against a fake, the
  connector against a scripted assistant. **API money spent so far: $0.**
- Preview deployments of branches are skipped by `scripts/vercel-ignore.sh`; a preview URL needs the owner's say-so.

## Next executable step

The owner's acceptance walk on production: `docs/academy/ACCEPTANCE.md` (sign in as the owner, open `/academy`). Then the
open owner items: `docs/owner-decisions.md` 19 to 25 (the monitoring baselines rebuilt on the corrected clock are live with
this merge: confirm or revert), a language-model key and budget if written analysis is wanted (`docs/academy/LLM.md`).
