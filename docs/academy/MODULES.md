# Academy modules as built: integration notes

Read with `ARCHITECTURE.md`. Where the two differ, the code and this file win (they record what was actually built and
tested). Full signatures are in each file's header comments and its tests.

## `MXR` · `assets/academy-replay.js` (tests: `tests/academy-replay.test.mjs`)

- `await MXR.load({ sym, tf, from, to, fetch, base, onProgress })` resolves to a `Bar[]` (bars that OPEN in `[from, to)`,
  never the forming candle) that also carries non-enumerable `src`, `gaps`, `calls`. Errors are `Error` with `.code`
  (`NO_SOURCE` = the server has no candle source, `UPSTREAM`, `NETWORK`, `BAD_RANGE`, …). Chunks are grid-aligned and cached.
- `MXR.closedAt(bars, tf, t)`, `MXR.closedCount(bars, tf, t)`, `MXR.aggregate(bars, fromTf, toTf, t)`,
  `MXR.formingAt(lowerBars, tf, t)` (display only, flagged `forming: true`).
- `MXR.snapshot({ edge, market, t, cand, series, inter, events, schedule, dataVersion, keep })` slices everything to closed
  bars, keeps 300 a timeframe, and runs `MXR.guard`. **Pass `cand: null` until the signal time** (a candidate with
  `cand.t > t`, or one carrying outcome fields, throws `LOOKAHEAD`). `events` = releases at or before t; `schedule` =
  releases due within 72 h with only `t / title / impact`.
- `MXR.clock({ from, to, stepSec, speed, onTick, onBatch, onDone, t })` → `play, pause, resume, step(n), jump(t),
  setSpeed(1|5|10|50|100), restart, state()`. Draw in `onBatch`. Calling `pause()` inside `onTick` stops the batch at once,
  so a signal candle is never run past.
- `MXR.session.save(state)` / `.restore(json)`, `MXR.hash(snapshot)`, `MXR.gaps(bars, tf)`.

## `MXA` · `assets/academy-core.js` (tests: `tests/academy-core.test.mjs`)

- `MXA.features(snapshot)` → 95 flat keys (`MXA.FEATURE_DOC`). `MXA.lite(features)` → the small bucket set used for
  "similar past cases". `MXA.regime(bars)`.
- `MXA.decide(snapshot, { lessons, thesis, model, history, risk, edgeDef, position, limits })` → Decision.
  - `history` entries must be `{ t, exitT?, features: MXA.lite(f), netR }`; anything not strictly before `snapshot.t`
    is ignored.
  - `edgeDef`: `{ version, cost }` (cost per round trip in price units).
  - gmp and nq-open are judged on 5m bars: the snapshot needs a `5m` series or the decision is "missing data: 5m".
  - Extra Decision fields: `side`, `waitingFor[]`, `gates[]`, `notes[]`, `refused` (a SKIP lesson), `evidence { support,
    contradiction, margin, needMargin }`, `modelScore`, `manage` (on MANAGE). On WAIT with a candidate the levels keep the
    rejected candidate's numbers.
  - A TAKE / FLIP lesson overrides a judgement gate (event, volatility, unfamiliar regime, timeframe conflict) only when its
    `when` names that gate's feature. Data gaps, no stop, reward-to-risk below 1 after costs, a risk block and conflicting
    lessons are never overridable.
- `MXA.thesis.start(snapshot)`, `MXA.thesis.update(thesis, snapshot, decision)` (pure).
- `MXA.lessons.fromCorrection(decision, correction, features)` → draft; `.validate(lesson)` → string[];
  `.matches`, `.retrieve(lessons, features, edge)` → `{ matched, conflicts }`. `then.adjust` rules are relative
  (`{ ref, k, unit: 'atr'|'r' }`), never raw prices; raw price keys are refused in `when`.
- `MXA.compare(attemptA, attemptB, correction)` → `{ changed, matchesCorrection, lessonApplied, lessonIds, verdict:
  'learned'|'partly'|'not-learned', note, score }`. `MXA.gradeAgainst`, `MXA.classifyError` (string),
  `MXA.explainError` (`{ cls, why }`), `MXA.classifyMiss` (`{ cls, why, justified }`).
- `MXA.simulate(alternatives, futureBars, costs)`: evaluation only (never part of a decision).
- `MXA.score(model, features)` + `MXA.MODEL_SCHEMA` (JSON trees), `MXA.difficulty(features, evidence)`.

## `MXK` · `assets/academy-risk.js` (tests: `tests/academy-risk.test.mjs`)

- Load `assets/backtest-engine.js` first in the browser (its global is `BT`; `MXK.FIRMS` is `BT.FIRMS`).
- `MXK.check(order { market, side, entry, stop, target?, t }, account, limits)` → `{ allowed, blocks[], codes[], size,
  riskCash, riskPct }`. An order without `t` or without a stop is blocked. `MXK.account(start, { t })`, `MXK.apply`,
  `MXK.open`, `MXK.propSim(trades, firm, { riskPct })`. Defaults: 0.25 % a trade, 1 % daily loss, 5 % drawdown, 3 positions.

## `/api/academy` · `api/academy.js` (tests: `tests/academy-api.test.mjs`)

- Owner session only. **Send POSTs one at a time (await each)**: the Blob store has no compare-and-swap.
- Shaped objects are nested: `{ action: 'attempt', attempt: {…}, features: {…} }`, `{ action: 'correct', edge,
  correction: {…} }`, `{ action: 'lesson.save', lesson: {…} }`, `session`, `result`, `blind`, `note`, `model`.
- Ids are made by the server; a revised lesson gets a **new id** (`supersedes` = the old id, `root` = the first), and the
  old version is kept with `active: false`. Feed `MXA.lessons.retrieve` the list from `GET ?get=lessons&edge=&active=1`.
- `GET ?get=candidates` leaves out setups flagged `rule.clockShift` / `rule.pre2020` (counts in `excluded`); `flagged=1`
  lists them in the train pool for study. A flagged setup is refused as an `exam` or `blind` attempt.
- `GET ?get=history&edge=&cand=<id>` (or `&before=<t>`) → `{ available, rows: [{ t, exitT, netR, features }] }` for
  `MXA.decide(…, { history })`: train pool, not flagged, trade finished before that time, no ids. `available: false` until
  `academy/data/feat-<edge>.json` (`{ version, features: { <candidateId>: MXA.lite(features) } }`) exists.
- `GET ?get=outcome&id=` answers 403 until an attempt for that candidate is stored (and while a blind answer is pending).
- `pool=exam` candidates refuse `train` / `replay-same` attempts; an exam candidate can be decided once.
- Blind flow: post the engine's attempt with `mode: 'blind'` (kept hidden), then `blind.submit` with the mentor's answer
  reveals it.
- Extras: `GET ?get=dataset&edge=` (Layer B rows, mentor label and outcome kept apart), `errorClass` on corrections.
- Local runs: set `ACADEMY_STORE_DIR` to use a file store instead of the Blob.
- The language-model adapter is off without `ACADEMY_LLM_KEY`; `explain` then answers `{ available: false }`.

## Edges · `academy/edges.mjs`, `academy/data/` (tests: `tests/academy-edges.test.mjs`)

- `EDGES` (registry: definition, `signalTf`, `costPerRoundTrip`, `study`, `version`), `poolOf`, `EVAL_FROM`.
- `cand-<edge>.json` is an array of candidates; `out-<edge>.json` is a map by candidate id. Outcome extras: `unitR`, `add`,
  `fillT`; an order that never filled has `R = netR = 0` and reason `missed` / `expired` / `cancelled`.
- `nq-open` candidates carry `tf: '1m'`; the core judges that edge on 5m bars.
- Regenerate (about 40 s, deterministic): `ACADEMY_CANDLES=<dir outside the repo> node academy/gen/run.mjs`. The candles are
  the council-data `research/candles/` HistData files.
