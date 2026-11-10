# MeridianX Academy: build progress

Resume file for the owner's autonomous build directive (10 Nov 2026). Update after every milestone. The contract between
modules is `docs/academy/ARCHITECTURE.md`.

## Where things stand

- **Branch:** `claude/website-display-xoyadz` (development; a draft PR, never merged to `main` without the owner: `main`
  auto-deploys to production).
- **Current phase:** 1 to 7 built and verified on the development branch (see "Next (not done)" for the gaps); 8 (preview and
  production) waits for the owner.

## Previous work stopped or preserved (10 Nov)

- The every-minute "keep improving" loop: already gone after the session restart (no scheduled jobs found).
- Two agents were halted by the usage limit on 9 Nov. Their unfinished, **unverified** work is saved, not merged:
  - `wip/desk-inner-pages` (Desk inner pages design pass, includes the Council → Systems `sn is not defined` fix request).
  - `wip/data-clock-fixes` (COT release-lag alignment and the HistData summer-clock audit; re-runs many study outputs).
- Everything merged before (#682 to #708) is on `main` and reused as is.
- Not stopped (outside this session's control, and production): the council loop on GitHub Actions and the Vercel crons.

## Completed

- [x] Repository audit (see the architecture file, section 1).
- [x] The seven edges identified from `council/decay.mjs` (assumption documented in the architecture file, section 2).
- [x] Module contract written (data shapes, function names, API surface): `docs/academy/ARCHITECTURE.md`; what was
  actually built: `docs/academy/MODULES.md`.
- [x] **Edges** (`academy/edges.mjs`, `academy/gen/`, `academy/data/`): candidates and outcomes for all seven edges, produced
  by running each study's own replay code on the research candles. Every edge reproduces its study's published n and net R
  per trade exactly (the generator throws otherwise). 2,775 candidates; 2,038 usable (see "Known problems").
- [x] **Replay** `assets/academy-replay.js` (`MXR`): candle loading, closed-bar slicing, snapshots with a look-ahead guard,
  clock (play / pause / step / jump / 1x to 100x / restart), session save and restore.
- [x] **Core** `assets/academy-core.js` (`MXA`): 95 features, regimes, the decision policy (BUY / SELL / WAIT / MANAGE with
  evidence, gates, invalidation), market thesis, lesson memory, attempt comparison, error classes, counterfactuals, model scoring.
- [x] **API and store** `api/academy.js` (owner only, private Blob or a local file store), **risk engine**
  `assets/academy-risk.js` (`MXK`, 0.25 % a trade, prop-firm simulation on the ChronosTrade presets), **optional
  language-model adapter** `api/_academy-llm.js` (off without a key; daily / monthly / hard budgets; cost ledger).
- [x] Flagged setups (clock-shifted weeks, before 2020) are left out of candidate lists and can never be scored as a test;
  `history` route for "similar past cases" (train pool only, finished before the moment asked about, no ids).

- [x] **Dataset and training service** (`academy/gen/features.mjs`, `academy/gen/evaluate.mjs`, `ml/`,
  `docs/academy/TRAINING.md`): one feature row per candidate from closed bars only (`academy/data/feat-<edge>.json`, so
  "similar past cases" now works), the decision policy measured against taking every setup (`academy/data/eval.json`), an
  offline gradient-boosting scorer with chronological walk-forward validation, JSON tree export and a parity check against
  `MXA.score` (max difference 5e-7). Manual workflow `academy-train.yml` (never on push, commits nothing; not yet run on GitHub).

### Honest results so far (train pool, 2020 → now, flagged setups left out, net R a trade after costs)

| Edge | Every setup: n, R, t | Policy takes: n, R | Policy waits: n, R | Difference t |
|---|---|---|---|---|
| replica | 303, +0.428, 2.34 | 153, +0.209 | 150, +0.652 | −1.21 |
| mosha-bo | 29, +0.971, 2.08 | 16, +1.085 | 13, +0.831 | 0.27 |
| gtrend | 19, +1.730, 1.54 | 19, +1.730 | 0 | n/a |
| gtl | 165, +0.232, 2.28 | 57, +0.405 | 108, +0.141 | 1.20 |
| geg | 84, +0.405, 1.81 | 57, +0.473 | 27, +0.262 | 0.41 |
| gmp | 494, +0.062, 1.09 | 110, −0.023 | 384, +0.086 | −0.80 |
| nq-open | 327, +0.185, 2.10 | 74, +0.490 | 253, +0.095 | 1.79 |
| all | 1,421, +0.249, 4.57 | 486, +0.342 | 935, +0.201 | 1.17 |

- **The deterministic policy, with no lessons, does not yet add measurable value over taking every setup** (no edge reaches
  t 2; on replica and gmp it is worse, not significantly). This is the baseline the mentor's lessons have to beat; the
  "every setup" column was recomputed independently by the lead and matches.
- **No trained scorer beats taking every setup.** Out of fold: replica AUC 0.561, gtl 0.516, gmp 0.511, nq-open 0.563,
  pooled 0.602 (0.545 within edge); none with t ≥ 2. All five are stored as rejected challengers (`promoted: false`);
  mosha-bo, gtrend and geg have too few trades to fit. Nothing is promoted automatically, and nothing was promoted.

- [x] **The Academy page, Phase 2 loop** (`academy.html`, `assets/academy-ui.js`, `assets/academy.css`): select an edge → replay
  real candles → decision with evidence (stored at once) → mentor correction → lesson saved → replay the same trade → compare
  attempts → test on new setups (unseen exam pool, with and without lessons, kept apart) → paper account under the risk engine.
  Local server `scripts/academy-dev.mjs`, end-to-end audit `scripts/audit/academy.cjs` (88 checks, in CI), page tests.
- [x] **Research engine** (`academy/gen/research.mjs` → `academy/data/research.json`, `docs/academy/RESEARCH.md`): 145 notebook
  entries from pre-registered studies on the train pool (baselines, 420 registered conditions of which 121 had enough trades,
  regimes, the book, the policy). **Nothing validated**: 0 conditions survive the multiple-comparison correction; 1 is
  out-of-sample only (gtl, lower-timeframe structure neutral: discovery t 2.10, confirmation t 2.10, adjusted p 0.79) and is
  offered as one inactive draft lesson; 2 flipped sign and are rejected. About 5.8 of 121 would pass discovery by chance; 7 did.
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

## In progress

Nothing is running. All module, page, dataset, training and research branches are merged into the development branch.

## Next (not done)

- [ ] **Preview / production**: nothing is deployed. `main` and production are untouched; branch previews are skipped by
  `scripts/vercel-ignore.sh`. Merging PR #1 is the owner's decision.
- [ ] First real use: the store is empty in production until the owner trains. Every number on the page comes from the
  owner's own stored attempts; the audit's rows live only in temporary test stores.
- [ ] The policy does not beat taking every setup yet (table above): improving it is what the mentor's lessons and the
  research drafts are for; it was deliberately not tuned on the training results.
- [ ] Not built: automatic promotion (by design), a browser upload of model files (promotion is documented as a manual API
  step), a dollar-index series for gold decisions (no candles for it), live-candle runs of the Blind and Session tabs
  (recorded candles only), four difficulty levels beyond the filter the Train tab has, alternative-decision simulation in
  the page (the core function `MXA.simulate` exists and is tested; no panel uses it yet).
- [ ] Owner decisions: the research-candle clock fix and study re-runs; whether `/api/academy` should get a higher firewall
  limit; a language-model key and budget, if commentary is wanted; the seven-edge assumption.

## Architecture decisions

See `docs/academy/ARCHITECTURE.md` section 3. In short: deterministic first, explicit lessons instead of pretending model
weights change, no look-ahead by construction, private Blob persistence, full isolation from council and broker code.

## Verified tests

- Whole suite on the development branch: **909 passing, 0 failing** (`node --test tests/*.test.mjs tests/*.test.js`; 719
  before the Academy). Academy files: `tests/academy-replay.test.mjs` (23), `academy-core` (37), `academy-api` (21),
  `academy-risk` (8), `academy-edges` (20), `academy-ml` (13), `academy-research` (19), `academy-ui`. Model parity:
  `node ml/parity.mjs`.
- `node scripts/audit/academy.cjs`: **202 of 202** (run by the lead after the last merge; 88 of 88 before the sections were
  added). The loop part: the clock pauses on a real setup, the decision and
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

- **Research-candle clock (owner decision).** From 2019 the HistData files follow Europe's summer-time dates while the
  studies read them as New York time, so in about four weeks a year every bar the studies used is stamped one hour early
  (cross-checked against OANDA H1 in 27 weeks, `academy/data/clock-check.json`). The studies were not changed. 187 of the
  2,775 candidates carry `rule.clockShift`; the Academy keeps them out of replay lists and tests. The real fix is re-running
  the studies on a corrected clock (the unmerged `wip/data-clock-fixes` branch is about this).
- Data quality (`academy/data/quality.json`): both H1 research series are "usable", not "certified" (gold 97.65 %, NAS100
  97.36 % coverage); 2023 is "unreliable" for both (about 87 %); the NAS100 09:30–11:00 M1 window is "unreliable".
- `gmp` (gold momentum pullback) candidates come from the robustness study's port, which departs from live (one position at
  a time, $0.15 cost); live it is a test / shadow system. `replica` has only 50 test setups and none after 27 Apr 2026.
- No language-model API key exists in the project. The adapter is built and tested against a fake; it stays off (cost: $0)
  until the owner sets a key and a budget. **API money spent so far: $0.**
- Preview deployments of branches are skipped by `scripts/vercel-ignore.sh`; a preview URL needs the owner's say-so.

## Next executable step

Owner review of draft PR #1 (`claude/website-display-xoyadz`). To see it locally: `sh scripts/build.sh && node
scripts/academy-dev.mjs` then open `http://127.0.0.1:8770/academy` (recorded candles; add `--live` and
`node --use-env-proxy` for live ones).
