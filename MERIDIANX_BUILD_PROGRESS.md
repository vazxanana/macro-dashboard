# MeridianX Academy: build progress

Resume file for the owner's autonomous build directive (10 Nov 2026). Update after every milestone. The contract between
modules is `docs/academy/ARCHITECTURE.md`.

## Where things stand

- **Branch:** `claude/website-display-xoyadz` (development; a draft PR, never merged to `main` without the owner: `main`
  auto-deploys to production).
- **Current phase:** 1 (audit and foundation) done; 2 (first complete learning loop): modules done and integrated, the page in progress.

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

## In progress

- [ ] Academy page (`academy.html`, `assets/academy.css`, `assets/academy-ui.js`) wired to the modules: the Phase 2 loop
  end to end (replay → decision → correction → lesson → replay the same trade → compare → test on a new setup), with a
  local dev server and a Playwright audit.

## Next

- [ ] Lead verification of the loop with Playwright on real candles and the store.
- [ ] Past-case features per candidate (`academy/data/feat-<edge>.json`) and the Layer C training service (`ml/`,
  chronological walk-forward, JSON model export, champion / challenger; no automatic promotion).
- [ ] Remaining tabs: session training, missed opportunities, blind arena, progress, mistakes, lessons manager, research
  lab and notebook, model registry, cost, audit trail.
- [ ] Research engine and regime studies, discretionary-vs-mechanical measurement, security and cost review, the Academy
  audit in CI, preview (needs the owner's say-so).

## Architecture decisions

See `docs/academy/ARCHITECTURE.md` section 3. In short: deterministic first, explicit lessons instead of pretending model
weights change, no look-ahead by construction, private Blob persistence, full isolation from council and broker code.

## Verified tests

- Whole suite on the development branch: **828 passing, 0 failing** (`node --test tests/*.test.mjs tests/*.test.js`; 719
  before the Academy). Academy files: `tests/academy-replay.test.mjs` (23), `academy-core` (37), `academy-api` (21),
  `academy-risk` (8), `academy-edges` (20).
- `sh scripts/build.sh` leaves `out/` unchanged (CI "build" check).
- Replay + core on real gold candles from the live candle proxy (12 Mar 2025): regime read, WAIT with reasons.

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

Review and merge the `academy-ui` branch when its agent reports, rebuild `out/`, run the suite and the Academy audit
myself, then start the dataset / training-service work.
