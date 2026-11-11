# MeridianX Academy: architecture audit and build contract

Written 10 Nov 2026 for the owner's "discretionary trading apprentice" directive. This file is the contract between the
modules: read it before touching any `academy` file. Progress and resume notes are in `MERIDIANX_BUILD_PROGRESS.md`.

## 1. Audit of what exists (verified in code, not from labels)

| Area | Finding |
|---|---|
| Site | Static pages built to `out/` by `scripts/build.sh`, served by Vercel. No framework. Lightweight Charts 4.1.3 for charts. |
| Backend | Vercel functions in `api/` (CommonJS). Sign-in is a server session cookie (`api/_session.js`); the owner is `acct.u === 'owner'`. |
| Database | **None.** Persistence is the private Vercel Blob store (JSON files; pattern in `api/notify.js`: a failed read throws, never wipes) and the `council-data` git branch for bot output. No Postgres / Supabase. |
| Language-model API | **None exists in the repo.** The council is deterministic JavaScript. The Academy adds an optional adapter that stays off until the owner sets a key. |
| Market data | `/md/bars?sym=&tf=&from=&to=` (OANDA proxy, 5,000 candles a call, `OANDA_TOKEN` on Vercel). Research candles (HistData M1 2018 to 2026: gold `xau-histdata`, NQ cash `nsxusd-histdata`, dollar index `udx-histdata`, forex, S&P) are in `council-data` under `research/candles/`. |
| Backtesting | Pre-registered studies in `research/edge/<topic>/` (net of costs, in sample vs out of sample). ChronosTrade (`backtest.html`, `assets/backtest-engine.js`) is a manual replay lab with prop-firm rules. |
| Risk | Council: every trade has a stop; sizing in the Trader. ChronosTrade: prop-firm rule sets (`MXB.FIRMS` in `assets/backtest-engine.js`). |
| Brokers | cTrader **demo** mirror only (`council/ctrader-*.mjs`). MT5: a signal CSV (`mt5/`). Tradovate: not present. No live execution anywhere. |
| Tests / CI | `node:test` (offline), `tests.yml` + `ci.yml` (build matches `out/`, page smoke test, ChronosTrade audit). |

## 2. The seven edges

Assumption (documented, the owner can correct it): "the seven edges" are the seven Meridian systems in
`council/decay.mjs` `SYSTEMS` that were live on paper when the Academy was built (live until 11 Nov 2026; since the owner's
decision of that day Gold trend and Gold daily engulf trade live and the other five are paper shadows; the Academy's edges,
data and rules are the same seven). The ICT desk stays a separate edge by the repo's rule 4 and is not mixed in.

| id | Name | Market | Signal TF | Rule source (authoritative replay code) |
|---|---|---|---|---|
| `replica` | Gold replica | XAU/USD | intraday | `research/edge/gold-systems/replica.mjs` (ported from `council/trader.mjs` `replicaSignals`) |
| `mosha-bo` | Mosha BO | XAU/USD | D1 / H4 / H1 chain | `research/edge/gold-systems/mosha.mjs`, `council/mosha.mjs` |
| `gtrend` | Gold trend | XAU/USD | D1 | `research/edge/gold-systems/daily.mjs` `goldTrend(20)` |
| `gtl` | Gold H4 trendline | XAU/USD | H4 | `daily.mjs` (tl_live) |
| `geg` | Gold daily engulf | XAU/USD | D1 | `daily.mjs` (eg_live) |
| `gmp` | Gold momentum pullback | XAU/USD | see `council/trader.mjs` (`gmp`) | port needed; study `research/edge/geg-variants` / trader block |
| `nq-open` | NQ New York open run | NAS100 | M1 / session | `research/edge/nq-open-oos/lib.mjs` (`nqOpenSweep`, `dayTrade`) |

## 3. Design decisions

1. **Edges produce candidates; discretion decides; risk allows.** Three separate modules, never merged.
2. **Deterministic first.** Replay, features, edge scanning, the decision policy, lesson memory, grading and risk are pure
   JavaScript with no network and no model call. The language-model adapter is optional (narrative and reading free-text
   feedback), off by default, budget-capped, and never in the decision path of a certified result.
3. **Learning is explicit, not model weights.** Layer A = versioned lessons (conditions on features → an effect) retrieved
   before each decision. Layer B = a persistent reviewed-examples dataset. Layer C = a Python gradient-boosting scorer
   trained offline with chronological validation; a model is only *used* after manual promotion.
4. **No look-ahead by construction.** The decision function receives a `Snapshot` holding only bars closed at or before `t`;
   `MXA.assertNoFuture` throws otherwise. Outcomes live in separate files / records that the decision path never receives.
5. **Persistence = private Blob JSON** (existing store, no new service). Append-only audit trail. Owner-only API.
6. **Isolation.** The Academy never imports or writes council, mirror or broker code or data. It places no orders.
7. **No model names in repo files** (rule 6): say "language model" / "LLM adapter".

## 4. Files and ownership

| Path | Owner module | Notes |
|---|---|---|
| `academy/edges.mjs` | Edges | Registry: id, name, market (`/md/bars` sym), signal TF, context TFs, plain-English definition, rule source, `version` (hash of the rule code), cost per round trip |
| `academy/gen/*.mjs`, `academy/data/cand-<edge>.json`, `academy/data/out-<edge>.json`, `academy/data/quality.json` | Edges | Generated from the study code on the research candles. Not copied to `out/`: served only through the API |
| `academy/quality.mjs` | Edges | Candle data-quality checks (gaps, duplicates, timestamps, session alignment, incomplete HTF bars) → status `certified` / `usable` / `unreliable` |
| `assets/academy-replay.js` | Replay | Browser + Node (UMD `MXR`): candle loading, clock, closed-bar slicing, snapshot builder |
| `assets/academy-core.js` | Core | Browser + Node (UMD `MXA`): features, regimes, decision engine, thesis, lessons, comparison, grading, error classes, counterfactuals |
| `assets/academy-risk.js` | API/Risk | UMD `MXK`: deterministic risk engine and configurable prop-firm simulation |
| `api/academy.js`, `api/_academy-store.js`, `api/_academy-llm.js` | API/Risk | Owner-only persistence, audit, cost ledger, optional LLM adapter |
| `academy.html` (→ `/academy`), `assets/academy.css`, `assets/academy-ui.js` | UI | The Academy page |
| `ml/` | ML | Python training service (offline / manual workflow), model registry, JSON model export |
| `tests/academy-*.test.mjs` | each module | Offline `node:test` |

## 5. Data contracts

```js
Bar       = { time, open, high, low, close }          // time = bar OPEN, UTC seconds
Candidate = { id, edge, market, t, side: 'buy'|'sell', entry, stop, target /* or null */, tf, rule: {…edge tags…},
              edgeVersion, pool: 'train'|'exam' }
            // t = the moment the edge fired = the decision time. NO outcome fields here, ever.
Outcome   = { id, R, netR, exitT, exit, reason, mfeR, maeR }   // out-<edge>.json, keyed by candidate id
Snapshot  = { v: 1, edge, market, t, cand /* Candidate or null between signals */,
              bars: { '5m': Bar[], '15m': Bar[], '1h': Bar[], '4h': Bar[], '1d': Bar[] },   // only bars with time + tfSec <= t
              inter: { dxy: { '1h': Bar[], '1d': Bar[] } } /* optional */,
              events: [{ t, title, impact }]   /* optional: releases at or before t */,
              schedule: [{ t, title, impact }] /* optional: releases due in the next 72 h; no result fields */,
              dataVersion }
```

**Pools.** `pool` is fixed when candidates are generated: a whole calendar month goes to `exam` when
`fnv1a(edge + ':' + 'YYYY-MM') % 10 < 3`, else `train`. Normal training, mentoring and same-trade replays draw only from
`train`. "Test on new setup" draws only from `exam` candidates that the store has never marked `seen`. The two result sets
are stored and reported separately.

```js
Decision = { id, edge, market, t, action: 'BUY'|'SELL'|'WAIT'|'MANAGE',
             entry, stop, target, candidateId,
             thesis: '…', supporting: [{ factor, text, weight }], contradicting: [{ factor, text, weight }],
             waitReasons: [..], invalidation: [..],
             risk: { rr, stopAtr, riskPct, allowed, blocks: [..] },
             similar: { n, winRate, avgR, note },         // from candidates strictly BEFORE t
             lessonsApplied: [{ id, version, effect }], confidence: 'low'|'medium'|'high',   // words, not a probability
             uncertainty: [..], modelVersion, policyVersion, edgeVersion, dataVersion, featuresHash }

Correction = { id, attemptId, at, verdict: 'approve'|'reject'|'change',
               action /* mentor's BUY/SELL/WAIT */, entry, stop, target, bias: 'up'|'down'|'neutral'|null, edge /* corrected edge or null */,
               reasons: ['missing-confirmation','wrong-structure','liquidity','htf-bias','session','volatility','rr','news','late','early','other'],
               text, annotations: [{ kind: 'entry'|'stop'|'target'|'liquidity'|'structure'|'sr'|'supply-demand'|'invalidation', t, price, t2, price2, note }] }

Lesson = { id, edge /* or '*' */, version, active, title, text, createdAt, updatedAt,
           when: [{ f /* feature key */, op: 'eq'|'ne'|'gte'|'lte'|'in'|'between', v }],
           then: { action: 'WAIT'|'SKIP'|'TAKE'|'FLIP'|null, adjust: { entry?, stop?, target? } /* optional rule */, note },
           source: { attemptId, correctionId, candidateId, sessionId }, supersedes /* lesson id */,
           stats: { applied, replayPass, replayFail, examN, examAgree, examNetWith, examNetWithout } }

Attempt = { id, candidateId /* or snapshot key */, edge, sessionId, n /* 1, 2, 3… for the same decision point */, at,
            mode: 'train'|'replay-same'|'exam'|'blind', decision: Decision, lessonsAvailable: [ids], snapshotHash }
```

## 6. Module APIs (names are binding)

**`MXR` (`assets/academy-replay.js`)**
`MXR.TF` (seconds per timeframe) · `MXR.load({ sym, tf, from, to, fetch })` → Bar[] (chunks of ≤ 5,000, de-duplicated,
sorted, validated) · `MXR.closedAt(bars, tfSec, t)` → Bar[] closed at or before t ·
`MXR.snapshot({ edge, market, t, cand, series, inter, events, dataVersion })` → Snapshot (series = `{ tf: Bar[] }` full
arrays; the builder slices) · `MXR.clock({ from, to, stepSec, speed, onTick })` → `{ play, pause, step, jump(t), setSpeed(x),
restart, state() }` with speeds 1, 5, 10, 50, 100 · `MXR.hash(snapshot)`.

**`MXA` (`assets/academy-core.js`)**
`MXA.VERSION`, `MXA.POLICY_VERSION` · `MXA.assertNoFuture(snapshot)` · `MXA.features(snapshot)` → flat object of numbers and
strings (keys documented in the file: `htfBias`, `structH1`, `sweep`, `displacement`, `momentum`, `atrPct`, `volState`,
`session`, `regime`, `rr`, `stopAtr`, `entryLoc`, `distSR`, `dxyTrend`, `dxyConflict`, `eventNear`, …) ·
`MXA.regime(bars)` → `{ label, trend, vol, detail }` (quantitative definitions in the file) ·
`MXA.decide(snapshot, { lessons, thesis, model, history, risk })` → Decision ·
`MXA.thesis.start(snapshot)`, `MXA.thesis.update(thesis, snapshot, decision)` → thesis (expected, why, invalidation, changes[], bias history) ·
`MXA.lessons.fromCorrection(decision, correction, features)` → Lesson draft · `MXA.lessons.matches(lesson, features)` ·
`MXA.lessons.retrieve(lessons, features, edge)` → ranked active lessons with conflicts flagged ·
`MXA.lessons.revise(lesson, patch)` → new version · `MXA.compare(attemptA, attemptB, correction)` →
`{ changed: [...], matchesCorrection, lessonApplied, verdict }` · `MXA.gradeAgainst(decision, correction)` ·
`MXA.classifyError(decision, correction, outcome)` → one of the error classes · `MXA.classifyMiss(decision, outcome, features)` ·
`MXA.simulate(alternatives, futureBars, costs)` → per-alternative result (evaluation only; never call from `decide`) ·
`MXA.score(model, features)` → model score, or null without a promoted model.

**`MXK` (`assets/academy-risk.js`)**
`MXK.DEFAULTS` (risk 0.25 % a trade) · `MXK.check(order, account, limits)` → `{ allowed, blocks: [...], size }` ·
`MXK.propSim(trades, firmRules)` · `MXK.FIRMS` reuses the rule sets already in `assets/backtest-engine.js` (no invented rules).

**`/api/academy`** (owner session; POST needs `sameOrigin`; everything `private, no-store`)
`GET ?get=edges|candidates&edge=|outcome&id=|lessons&edge=|attempts&edge=&cand=|sessions|session&id=|progress&edge=|mistakes&edge=|exams&edge=|notebook|models|cost|audit`
`POST { action: 'attempt' | 'correct' | 'lesson.save' | 'lesson.revise' | 'lesson.deactivate' | 'session.save' | 'seen' |
'exam.result' | 'blind.submit' | 'notebook.add' | 'explain' | 'analyse', … }`.
`outcome` is only returned once an attempt for that candidate is stored (no peeking). Every write appends to the audit trail.

## 7. Limits stated honestly

- Passing a same-trade replay shows the lesson is recalled and applied, not that it generalises. Only exam-pool results count
  towards progression, and they are reported with n and net R, with and without the lesson.
- Replay candles on the page come from OANDA; candidates and outcomes were generated on HistData candles. Prices differ by
  a small feed basis; the page shows the data source of each.
- A language-model explanation is commentary. It never changes a certified statistic.
- The analyst (`docs/academy/LLM.md`) is a language model's second opinion on a decision the engine has already made and
  stored. It is off without a key, checked in code, held by the engine's hard gates and stored apart from the engine's
  attempts, so it changes no certified statistic either. Until the owner sets a key it has only ever run against a fake.
