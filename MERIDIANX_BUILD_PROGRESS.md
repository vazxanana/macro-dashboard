# MeridianX Academy: build progress

Resume file for the owner's autonomous build directive (10 Nov 2026). Update after every milestone. The contract between
modules is `docs/academy/ARCHITECTURE.md`.

## Where things stand

- **Branch:** `claude/website-display-xoyadz` (development; a draft PR, never merged to `main` without the owner: `main`
  auto-deploys to production).
- **Current phase:** 1 (audit and foundation) done → 2 (first complete learning loop) in progress.

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
- [x] Module contract written (data shapes, function names, API surface).

## In progress

- [ ] Edges: registry, candidate / outcome files generated from the study code on real candles, data-quality report.
- [ ] Replay layer `assets/academy-replay.js`.
- [ ] Core `assets/academy-core.js` (features, regimes, decision, thesis, lessons, comparison, grading).
- [ ] API, store, risk engine, optional LLM adapter with a cost ledger.

## Next

- [ ] Academy page (`academy.html`) wired to the modules: the Phase 2 loop end to end on one edge
  (replay → decision → correction → lesson → replay same trade → compare → test on new setup).
- [ ] Verify the loop with Playwright on real candles and the store.
- [ ] Extend to all seven edges (Phase 3), then session training, blind arena, missed opportunities (Phase 4),
  the Python training service and champion / challenger (Phase 5), research lab and notebook (Phase 6),
  cost controls, security review and regression tests (Phase 7), preview (Phase 8).

## Architecture decisions

See `docs/academy/ARCHITECTURE.md` section 3. In short: deterministic first, explicit lessons instead of pretending model
weights change, no look-ahead by construction, private Blob persistence, full isolation from council and broker code.

## Verified tests

(none yet for the Academy; the existing suite was at 719 passing on `main` before this work)

## Known failures / external blockers

- No language-model API key exists in the project. The adapter is built and tested against a fake; it stays off (cost: $0)
  until the owner sets a key and a budget.
- Preview deployments of branches are skipped by `scripts/vercel-ignore.sh`; a preview URL needs the owner's say-so.

## Next executable step

Integrate the four module branches into the development branch, run the full test suite, then build the page.
