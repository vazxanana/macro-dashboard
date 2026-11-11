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
- The language-model adapter is off without `ACADEMY_LLM_KEY`; `explain` and `analyse` then answer `{ available: false }`.

## The analyst · `api/_academy-analyst.js`, `analyse` in `api/academy.js`, `assets/academy-analyst.js` (tests: `tests/academy-analyst.test.mjs`)

Owner's guide: `docs/academy/LLM.md` (what it sees, safeguards, environment variables, budgets, first-run checklist).

- The analyst is the optional language model asked to judge one decision point: BUY, SELL, WAIT or MANAGE. Every decision
  is still made by `MXA.decide`; the analyst's answer is a second opinion, stored apart. Nothing ran against a real provider.
- `AN.buildRequest({ edge, features, snapshotDigest: { t, hash, cand, bars }, deterministic, lessons, thesis, position,
  calendar, ask, cost, examDecided })` → `{ ok, system, prompt, schema, context, facts }` or `{ ok: false, refusals }`. Pure.
  It refuses an outcome field, a bar closing after `t`, anything dated later, an exam setup already decided.
  `AN.parseAnswer(text, context)` → `{ ok, decision, notes }` or `{ ok: false, refusals }`. `AN.record` turns a checked
  decision into the Decision shape. Bump `AN.PROMPT_VERSION` when the system text, the facts layout or a rule changes.
- `POST { action: 'analyse', edge, candidateId, attemptId, snapshot: { t, hash, bars, dataVersion }, features, deterministic,
  thesis?, position?, ask?: 'setup' | 'position', cost?, sessionId?, dryRun?, retry? }`. The engine's attempt must be stored
  first and `deterministic.gates` must be sent (an empty list when none). Answers: `{ available: false, reason }` when off;
  else `{ decision, wanted, forced, refusals, provider, fake, usage, costUsd, cached, attempt: { id, n, mode, stored }, budget }`.
  `skipped: 'budget'` (scope `day | month | hard-stop | calls`) and `error` mean nothing was stored as an answer.
- Storage, apart from the engine's: `analyst/attempts/<edge>.json`, `analyst/corrections/<edge>.json`,
  `analyst/dataset/<edge>.json`, `analyst/cache.json`. Read them with `GET ?get=attempts|corrections|dataset&engine=language-model`;
  `GET ?get=progress` has an `analyst` block. `POST correct` takes `engine: 'language-model'`.
- Adapter changes (`api/_academy-llm.js`): `messages` format sends the key in `x-api-key` and an API version header;
  `ACADEMY_LLM_BODY`, `ACADEMY_LLM_MAX_TOKENS_FIELD`, `ACADEMY_LLM_SYSTEM_ROLE`, `ACADEMY_LLM_JSON_SCHEMA`; stop reasons;
  cache-token pricing; a bounded retry on 408 / 429 / 5xx / 529; a daily call cap (`ACADEMY_LLM_MAX_CALLS_DAY`, all routes);
  a timed-out call keeps its estimate in the ledger (`unconfirmed`). `complete` takes `{ cap: 'analyst', long, schema, fresh }`
  and the dependencies `{ env, store, fetch, now, sleep, provider }`.
- The page block is one file, `assets/academy-analyst.js` (`window.MXAN`), with one hook in `assets/academy-ui.js`:
  `MXAC.point()`, a read-only view of the open decision point. It reads the ledger once when a replay opens (never while a
  decision is made), so a train decision is still one Academy call. It never asks by itself.
- The fake: `node scripts/academy-dev.mjs --fake-llm` injects `scripts/academy-fake-llm.cjs` (`provider: 'fake-test'`, a fixed
  rule) into the handler. The deployed function takes no dependency, so nothing else can switch it on.

## Edges · `academy/edges.mjs`, `academy/data/` (tests: `tests/academy-edges.test.mjs`)

- `EDGES` (registry: definition, `signalTf`, `costPerRoundTrip`, `study`, `version`), `poolOf`, `EVAL_FROM`.
- `cand-<edge>.json` is an array of candidates; `out-<edge>.json` is a map by candidate id. Outcome extras: `unitR`, `add`,
  `fillT`; an order that never filled has `R = netR = 0` and reason `missed` / `expired` / `cancelled`.
- `nq-open` candidates carry `tf: '1m'`; the core judges that edge on 5m bars.
- Regenerate (about 40 s, deterministic): `ACADEMY_CANDLES=<dir outside the repo> node academy/gen/run.mjs`. The candles are
  the council-data `research/candles/` HistData files.

## Dataset and training · `academy/gen/features.mjs`, `academy/gen/evaluate.mjs`, `ml/` (tests: `tests/academy-ml.test.mjs`)

- Full notes: `docs/academy/TRAINING.md`. The page must build its snapshot the same way as the dataset so that live features
  and past-case features are comparable: series = the edge's `contextTfs` from the registry (no 1m), 300 bars a timeframe, no
  dollar index (those keys are null).
- The dataset's calendar comes from `council/events.mjs` (read only; CPI / NFP / FOMC from 2022), written to
  `academy/data/calendar.json` by `node academy/gen/calendar.mjs`. The page gets the same cut from
  `GET ?get=calendar&t=<t>` → `{ events, schedule }` (both null outside the calendar's span) and passes them to `MXR.snapshot`.
- `evaluate.mjs` also writes `eval.json` `drawdown` (mechanical, take-set and wait-set, per edge and overall) and
  `academy/data/eval-trades.json` (`{ policy, generated, edges: { <edge>: [{ id, t, action }] } }`, train pool only, no outcome
  field). `walkEdge({ …, onDecision })` hands each decision to a caller before its result is read; the policy investigation
  (`research/edge/academy-policy/`, `RESEARCH.md` section 7) uses it. `academy/data/exam-ledger.json` logs exam reads (none).
- `MXA.decide` hands the snapshot's edge id to the scorer (a pooled model uses it as a feature). A model is used only when
  `promoted` and `calibrated` are both true; every model in `ml/models/` is a rejected challenger.

## The page · `academy.html`, `assets/academy-ui.js` (`window.MXAC`), `assets/academy.css` (tests: `tests/academy-ui.test.mjs`, audit: `scripts/audit/academy.cjs`)

- Train tab = the whole loop: setup → replay → decision (stored as an attempt at once) → mentor controls → lesson draft → replay the
  same trade → comparison → test on new setups (exam pool, with and without lessons, results kept apart) → paper account.
- The other tabs live in `assets/academy-tabs.js` (`window.MXAT`, tests `tests/academy-tabs.test.mjs`) and register with
  `MXAC.registerTab(id, { title, render(section, ctx) })`, `ctx = { api: { get, post }, edge(), edges(), me, kit, go(tab) }`:
  - `lessons`: every version (chains by `root`), origin, recall and new-setup records kept apart, revise through
    `lesson.revise` with a live diff, switch off / on, research drafts (saved inactive; "Dismiss" = saved inactive and switched
    off with the reason "Dismissed research draft", so it is kept and audited).
  - `progress` (mistakes inside it): counts, agreement by week, recall beside new setups (never added), mistakes by class with
    examples, and the spaced-repetition queue `MXAT.reviewQueue`: a setup whose latest verdict was not an approval is due
    1, 3, 7, 21 days after its last review; a later sitting that gives the mentor's answer is a pass, anything else starts again
    at 1 day; four passes in a row retire it; train pool only. "Replay this setup" = `kit.openInTrain(edge, t)`.
  - `research` (studies, a study in full, the policy table, the notebook), `models`, `costs`, `audit`: read views.
  - `blind`: the engine's decision is posted as a hidden `blind` attempt and dropped from the page; `blind.submit` returns it;
    the outcome is read last. `GET ?get=blind&edge=` lists answered setups only, graded like tests.
  - `session`: a range replayed with the running thesis; stops on train setups (attempt stored, verdict through `correct`);
    notes anywhere through `POST { action: 'miss', miss: { edge, t, kind: 'missed' | 'right-wait', action, entry, stop, target,
    text, sessionId, engine, cls, why, snapshotHash } }` (read back with `GET ?get=misses&edge=[&session=]`); sessions are
    stored with `kind: 'session'`.
- `ctx.kit` (shared with the Train loop, in `assets/academy-ui.js`): `el / clear / listOr / actBadge`, `newChart(host)`,
  `viewBarsOf`, `loadSeries`, `snapOf` (the one snapshot builder), `decideOn`, `decisionView`, `lessonForm`, `attemptBody`,
  `poolFor / lessonsFor / historyFor` (read once, cached), `seenBefore`, `openInTrain`.
- **Rate limit.** The firewall allows 30 requests a minute per IP on `/api`. `MXAC.makeApi` keeps the page under `MXAC.PACE`
  (24) Academy calls in any minute, waits out a 429 (`Retry-After`, else 5 s doubling, 4 tries) with a calm status line, and
  sends writes one at a time. A replay run reads candidates, lessons, calendar and past cases once
  (`?get=history&before=<end of the range>`, cut per decision by `MXAC.historyAt`); a train decision is then two calls since
  11 Nov 2026 (the attempt, then the session position; one before that), a test on a new setup two, a blind setup three. `window.MXAC_PACE = 0` lifts the pace (the audit does, and counts
  calls instead).
- A setup decided in an earlier sitting is stored as `replay-same` when the Train or Session clock stops on it again (recall).
- **Round 3 (11 Nov 2026).** A Session-tab decision is two calls as well (the attempt, then `session.save` with the clock,
  the events and the setup the clock is on; the first decision of a sitting saves before its attempt). Resuming a sitting
  saved on a setup reads its stored attempt and verdict (`attempts`, `corrections`, and `lessons` when a disagreeing verdict
  is stored) and decides nothing again. Leaving a half-written answer asks once on every section: `MXAC.leaveGuard`
  (`kit.leaveGuard`), fed by `mentorUnsaved` in Train and by the answer form's `unsaved()` in Session and Blind;
  `kit.watchUnsaved` adds a section to the browser's reload question. `kit.decided(id, pool, mode)` writes the mode of a
  stored attempt into the shared pool list, which is how the Blind arena knows a setup was shown in Train or Session after
  its hidden attempt (answered as recall, not scored). The Blind arena never reads a stored decision; the API refuses a
  second answer for a setup (409) and the page says the first one stands. A lesson draft is rebuilt on resume from the
  stored correction (`MXA.lessons.fromCorrection`), never from browser storage.
- **What if** (`kit.whatIfCard`, pure parts `MXAC.whatIfAllowed / whatIfWindow / whatIfAlternatives / whatIfRun / whatIfNote`): the
  one user of `MXA.simulate`. The card is absent until the attempt is stored (a test: its result too; the blind arena: the
  mentor's answer too). On the click it asks `MXR.load` for the candles from the decision time on the edge's signal timeframe
  (`exit.maxHoldH` + `orderValidH`, else 96 candles), simulates the setup, the engine's and the mentor's answers where they
  differ, and fixed variants (stop at 0.5x and 1.5x, target at 1R / 2R / 3R, entry one candle later) at the run's costs, and
  compares the first row with the stored outcome. It builds no snapshot and stores nothing (no existing route writes only an
  audit row); `MXAC.whatIfLoads` lists every such read. Showing the later candles on the chart is a separate step, undone on
  Continue. Note: `MXR.load` fetches whole grid chunks from `/md/bars`, so the network always carries candles after a setup;
  the page-level rule is what is asked of `MXR.load` and what reaches a snapshot.
- `scripts/academy-dev.mjs`: out/ + the real API handler on a file store + `/md/bars` from `tests/fixtures/academy/` (real OANDA gold
  candles, 26 Apr to 17 May 2024, 10 train and 3 exam gmp setups) or `--live`.
- More API reads added for the page: `corrections&edge=[&cand=]`, `research[&edge=&kind=]` / `research&id=`, `evaluation`, `training`.
  A saved lesson keeps `source.kind` (`mentor` | `research`) and `source.studyId`.
- Usability pass (11 Nov 2026), page code only: `#point-bar` under the chart at a decision point (`renderPointBar`, pure
  `MXAC.pointLine`; `goTo` / `showNode` move between the chart and the cards, `showNode` is on `MXAC.kit`); `leaveOk` in front
  of play / continue, step, jump and restart, so a half-written verdict (`MXAC.mentorUnsaved`, `M.dirty`) needs a second press
  to be dropped; `MXAC.humanize(text, lessons)` shows lesson titles for ids in the engine's text (display only). The "What if"
  columns are Alternative, Net R after costs, Exit, Filled, Levels, Best, Worst, Exit time.
- Round 2 (11 Nov 2026), page code only: `keepPlace` (the session position with every decision; two API calls a train
  decision: `attempt`, `session.save`), `#resume-now` / `renderResumeNow` (pure `MXAC.latestFirst`, `MXAC.unfinished`),
  `decisionView(box, { fold: true, onLessons })` with `foldBox` and the pure `MXAC.mainReasons` / `MXAC.conflictIds`,
  `MXAC.mentorChoices`, `mentorCheck(show)` (the red problem only after Save), `MXAC.lessonFocus = { edge, ids }` read once by
  the Lessons tab, `prefGet` / `prefSet` (the page's only browser storage: `mxacEdge`, `mxacFold`), `MXAC.rememberEdge`.
