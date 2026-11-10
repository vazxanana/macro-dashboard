// node --test tests/academy-ml.test.mjs — the Academy dataset and the offline training service:
//   academy/gen/features.mjs + academy/data/feat-<edge>.json   one small feature row per candidate, closed bars only
//   academy/gen/evaluate.mjs + academy/data/eval.json          the decision policy against taking every setup
//   ml/ (train.py, parity.mjs, models/, data/)                 the scorer's models, their index and the parity check
//   ml/review.py + research/edge/academy-ml-review/            the training review: its result.json against the committed scorers
//   .github/workflows/academy-train.yml                        manual only
// Offline and fast: no candles, no Python, no network. The no-look-ahead test builds its own synthetic series.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { EDGES, edgeById } from '../academy/edges.mjs';
import * as F from '../academy/gen/features.mjs';
import { report, block, verdictOf, walkEdge, stat, welch, T_LINE } from '../academy/gen/evaluate.mjs';
import { loadMatrix, compare, featuresFor, rawExact, TOLERANCE } from '../ml/parity.mjs';

const require = createRequire(import.meta.url);
const MXA = require('../assets/academy-core.js');
const MXR = require('../assets/academy-replay.js');
const { handle } = require('../api/academy.js');
const ST = require('../api/_academy-store.js');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const json = (f) => JSON.parse(read(f));
const cands = (id) => json(`academy/data/cand-${id}.json`), outs = (id) => json(`academy/data/out-${id}.json`), feat = (id) => json(`academy/data/feat-${id}.json`);
const UNFILLED = ['missed', 'expired', 'cancelled'];
const flagged = (c) => !!(c.rule.clockShift || c.rule.pre2020);

async function api(method, payload) {
  const out = {}, res = { setHeader() {}, status(c) { out.code = c; return res; }, json(b) { out.body = b; return out; } };
  const store = api.store || (api.store = ST.memoryStore()); let clock = Date.UTC(2026, 10, 10, 12);
  await handle(method === 'GET' ? { method, headers: {}, query: payload } : { method, headers: {}, body: payload }, res, { env: {}, store, who: async () => ({ u: 'owner' }), sameOrigin: () => true, data: undefined, now: () => (clock += 1000) });
  return out;
}

// ---- synthetic candles (seeded): 130 days of M1 bars with swings on every timeframe -------------------------------------
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const T0 = 1704067200;                                   // Mon 1 Jan 2024 00:00 UTC
function m1Bars(n, seed, base = 2000) {
  const r = rng(seed), out = []; let x = base;
  for (let i = 0; i < n; i++) { const o = x; x = Math.max(100, x + (r() - 0.5) * 1.2 + 0.9 * Math.sin(2 * Math.PI * i / 7000) * 0.05); out.push({ time: T0 + i * 60, open: o, high: Math.max(o, x) + r() * 0.3, low: Math.min(o, x) - r() * 0.3, close: x }); }
  return out;
}
const N = 130 * 1440, BASE = m1Bars(N, 5);
const candAt = (edge, t, side, ser) => {
  const e = edgeById(edge), last = MXR.closedAt(ser['1h'], '1h', t).at(-1).close, d = side === 'buy' ? 1 : -1;
  return { id: `${edge}-${t}${side[0]}`, edge, market: e.market, t, side, entry: +last.toFixed(2), stop: +(last - d * 4).toFixed(2), target: +(last + d * 12).toFixed(2), tf: e.signalTf, rule: {}, edgeVersion: e.version, pool: 'train' };
};
const CAL = { from: T0, to: T0 + 400 * 86400, types: ['CPI'], hash: 'test', items: [100, 104.4, 111.6, 118.2, 126.1].map((d) => ({ t: T0 + Math.round(d * 86400), title: 'CPI', impact: 'high' })) };
const SAMPLE = [['replica', 100.31, 'buy'], ['mosha-bo', 104.52, 'sell'], ['gtrend', 110.0028, 'buy'], ['gtl', 112.1695, 'buy'], ['geg', 118.0028, 'buy'], ['gmp', 121.4375, 'sell'], ['nq-open', 126.6077, 'sell']];

test('aggM1 builds the same bars as MXR.aggregate, and a snapshot holds closed bars only', () => {
  const A = F.typedM1(BASE.slice(0, 20000)), end = BASE[19999].time + 60;
  for (const tf of Object.keys(F.TF_SEC)) {
    const mine = F.aggM1(A, F.TF_SEC[tf]).filter((b) => b.time + F.TF_SEC[tf] <= end);
    assert.deepEqual(mine, MXR.aggregate(BASE.slice(0, 20000), '1m', tf, end), `${tf} buckets`);
  }
  const ser = F.seriesFromM1(F.typedM1(BASE)), t = T0 + Math.round(100.31 * 86400), snap = F.buildSnapshot({ edge: 'replica', cand: candAt('replica', t, 'buy', ser), series: ser, cal: CAL, dataVersion: 'synthetic' });
  for (const tf of edgeById('replica').contextTfs) { assert.ok(snap.bars[tf].length > 0 && snap.bars[tf].length <= F.KEEP, tf); for (const b of snap.bars[tf]) assert.ok(b.time + F.TF_SEC[tf] <= t, `${tf} bar closes after t`); }
  assert.equal(MXA.assertNoFuture(snap), true);
  assert.equal(snap.bars['1m'], undefined, 'no 1m series: nq-open is measured on 5m bars');
  assert.throws(() => F.buildSnapshot({ edge: 'replica', cand: { ...candAt('replica', t, 'buy', ser), netR: 1 }, series: ser }), /LOOKAHEAD|outcome/i, 'a candidate carrying an outcome is refused');
});

test('no look-ahead: the feature row at t does not change when everything from t onwards is replaced', () => {
  const ser0 = F.seriesFromM1(F.typedM1(BASE));
  for (const [edge, day, side] of SAMPLE) {
    const t = T0 + Math.round(day * 86400 / 60) * 60, cand = candAt(edge, t, side, ser0);
    const row = (bars, cal = CAL) => F.featuresOf(F.buildSnapshot({ edge, cand, series: F.seriesFromM1(F.typedM1(bars)), cal, dataVersion: 'synthetic' }));
    const base = row(BASE);
    assert.equal(base.barsOk, true, `${edge}: the synthetic series is long enough`);
    assert.equal(Object.keys(base).length, F.FEATURE_KEYS.length);
    // (1) every M1 bar that OPENS at or after t replaced by wild prices, and three more weeks of them appended
    const cut = BASE.findIndex((b) => b.time >= t), wild = m1Bars(N - cut + 21 * 1440, 99, 9000).map((b, i) => ({ ...b, time: t + i * 60 }));
    assert.deepEqual(row(BASE.slice(0, cut).concat(wild)), base, `${edge}: bars from t onwards changed the features`);
    // (2) the series simply ending at t gives the same row
    assert.deepEqual(row(BASE.slice(0, cut)), base, `${edge}: the future's absence changed the features`);
    // (3) calendar items later than the 72 hours a snapshot may look ahead change nothing
    assert.deepEqual(row(BASE, { ...CAL, items: CAL.items.concat({ t: t + 73 * 3600, title: 'FOMC statement', impact: 'high' }) }), base);
    // the test has teeth: changing bars that had CLOSED before t (from 26 hours to 2 hours earlier) does change the row
    const touched = BASE.slice(); for (let i = cut - 26 * 60; i < cut - 2 * 60; i++) touched[i] = { ...touched[i], high: touched[i].high + 40, close: touched[i].close + 35 };
    assert.notDeepEqual(row(touched), base, `${edge}: closed bars did not reach the features`);
  }
});

test('calendar: three release types from 2022 on, nothing passed before, no result fields', async () => {
  const cal = await F.calendar();
  assert.deepEqual(cal.types, ['CPI', 'NFP', 'FOMC']); assert.equal(cal.from, Date.UTC(2022, 0, 1) / 1000); assert.ok(cal.n > 120);
  for (const it of cal.items) assert.deepEqual(Object.keys(it), ['t', 'title', 'impact']);
  assert.ok(cal.items[0].t >= cal.from && cal.items.every((x, i) => i === 0 || x.t >= cal.items[i - 1].t));
  assert.deepEqual(F.calendarAt(cal, cal.from - 1), { events: null, schedule: null }, 'before the calendar starts nothing is passed (eventNear stays null)');
  const t = cal.items[40].t - 3600, at = F.calendarAt(cal, t);
  assert.ok(at.schedule.some((e) => e.t === cal.items[40].t) && at.schedule.every((e) => e.t > t && e.t <= t + 72 * 3600) && at.events.every((e) => e.t <= t));
  // the calendar file is plain data: no imports, no network
  const src = read('council/events.mjs'); assert.ok(!/^\s*import\s/m.test(src) && !/\bfetch\s*\(/.test(src));
});

test('feat-<edge>.json: a row for every candidate, lite keys only, the version follows the inputs', async () => {
  const cal = await F.calendar(), meta = json('academy/data/meta.json'); let total = 0;
  for (const e of EDGES) {
    const text = read(`academy/data/cand-${e.id}.json`), C = JSON.parse(text), ft = feat(e.id);
    assert.deepEqual(Object.keys(ft), ['version', 'generated', 'policy', 'n', 'missing', 'meta', 'features'], e.id);
    assert.deepEqual(Object.keys(ft.features), C.map((c) => c.id), `${e.id}: one row per candidate, in candidate order`);
    assert.equal(ft.n, C.length); total += ft.n;
    assert.equal(ft.version, F.featVersion({ edge: e, candText: text, cal, candlesRef: meta.candles.ref }), `${e.id}: the candidates, the calendar or the feature code changed: run academy/gen/features.mjs again`);
    assert.equal(ft.policy, MXA.POLICY_VERSION); assert.equal(ft.generated, meta.generated); assert.equal(ft.meta.code.core, MXA.VERSION); assert.equal(ft.meta.code.replay, MXR.VERSION);
    assert.deepEqual(ft.meta.series, e.contextTfs); assert.ok(!ft.meta.series.includes('1m'));
    assert.ok(Number.isInteger(ft.missing) && ft.missing >= 0 && ft.missing < 0.05 * ft.n, `${e.id}: ${ft.missing} rows with a missing timeframe`);
    for (const c of C) {
      const row = ft.features[c.id];
      assert.deepEqual(Object.keys(row), F.LITE_KEYS, c.id);
      assert.equal(row.side, c.side);
      for (const k of Object.keys(row)) assert.ok(row[k] === null || typeof row[k] === 'string', `${c.id}.${k}`);
      for (const k of ['R', 'netR', 'exitT', 'exit', 'reason', 'mfeR', 'maeR', 'win']) assert.ok(!(k in row), `${c.id} carries the outcome field ${k}`);
    }
    assert.ok(read(`academy/data/feat-${e.id}.json`).length < 200000, `${e.id}: the file stays small`);
  }
  assert.equal(total, 2783);
});

test('the API history route reads the files: train pool only, finished before t, no ids', async () => {
  for (const e of EDGES) {
    const C = cands(e.id), O = outs(e.id), ft = feat(e.id), target = C[Math.floor(C.length * 0.8)];
    const r = await api('GET', { get: 'history', edge: e.id, cand: target.id });
    assert.equal(r.code, 200, e.id); assert.equal(r.body.available, true); assert.equal(r.body.version, ft.version);
    const want = C.filter((c) => c.pool === 'train' && !flagged(c) && c.t < target.t && O[c.id].exitT < target.t && !UNFILLED.includes(O[c.id].reason)).sort((a, b) => a.t - b.t);
    assert.ok(want.length > 5, `${e.id}: ${want.length} past cases`);
    assert.deepEqual(r.body.rows, want.map((c) => ({ t: c.t, exitT: O[c.id].exitT, netR: O[c.id].netR, features: ft.features[c.id] })));
    const s = JSON.stringify(r.body.rows); assert.ok(!s.includes(e.id + '-'), 'no candidate id leaves through history');
    const examT = new Set(C.filter((c) => c.pool === 'exam').map((c) => c.t)), trainT = new Set(C.filter((c) => c.pool === 'train').map((c) => c.t));
    for (const row of r.body.rows) { assert.deepEqual(Object.keys(row), ['t', 'exitT', 'netR', 'features']); assert.ok(row.t < target.t && row.exitT < target.t); assert.ok(trainT.has(row.t) || !examT.has(row.t)); }
    // the rows are what MXA.decide takes as history
    const sim = MXA.decide({ v: 1, edge: e.id, market: e.market, t: target.t, cand: null, bars: {} }, { history: r.body.rows });
    assert.equal(sim.action, 'WAIT');
  }
});

test('the feature matrix: every candidate, all feature keys, labels kept apart', () => {
  const m = JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(path.join(ROOT, 'ml/data/matrix.json.gz'))).toString('utf8'));
  assert.deepEqual(m.featureKeys, Object.keys(MXA.FEATURE_DOC)); assert.equal(m.featureKeys.length, 95); assert.deepEqual(m.labelKeys, F.LABEL_KEYS); assert.deepEqual(m.priceKeys, MXA.PRICE_KEYS);
  assert.equal(m.rows.length, 2783);
  assert.deepEqual(m.featVersions, Object.fromEntries(EDGES.map((e) => [e.id, feat(e.id).version])), 'the matrix and the feat files come from the same run');
  const L = Object.fromEntries(m.labelKeys.map((k, i) => [k, i])), nl = m.labelKeys.length, iSide = m.featureKeys.indexOf('side'), iReg = m.featureKeys.indexOf('regime');
  for (const e of EDGES) {
    const C = cands(e.id), O = outs(e.id), ft = feat(e.id), rows = m.rows.filter((r) => r[L.edge] === e.id);
    assert.deepEqual(rows.map((r) => r[L.id]), C.map((c) => c.id));
    rows.forEach((r, i) => {
      const c = C[i], o = O[c.id], filled = !UNFILLED.includes(o.reason);
      assert.equal(r.length, nl + 1); assert.equal(r[nl].length, 95);
      assert.deepEqual([r[L.t], r[L.pool], r[L.clockShift], r[L.pre2020], r[L.filled], r[L.reason], r[L.exitT]], [c.t, c.pool, !!c.rule.clockShift, !!c.rule.pre2020, filled, o.reason, o.exitT]);
      assert.deepEqual([r[L.R], r[L.netR], r[L.win]], filled ? [o.R, o.netR, o.netR > 0 ? 1 : 0] : [null, null, null]);
      assert.equal(r[nl][iSide], c.side); assert.equal(r[nl][iReg], ft.features[c.id].regime, 'the lite row is cut from the same features');
    });
  }
  assert.ok(fs.statSync(path.join(ROOT, 'ml/data/matrix.json.gz')).size < 2e6);
});

test('eval.json: the documented fields, consistent counts, verdicts that follow the rule, exam pool untouched', () => {
  const ev = json('academy/data/eval.json');
  for (const k of ['version', 'generated', 'recipe', 'policy', 'core', 'dataVersion', 'what', 'method', 'edges', 'overall']) assert.ok(k in ev, k);
  assert.equal(ev.policy, MXA.POLICY_VERSION); assert.deepEqual(Object.keys(ev.edges), EDGES.map((e) => e.id));
  const check = (b, name) => {
    for (const k of ['orders', 'unfilled', 'mechanical', 'take', 'wait', 'takeShare', 'diff']) assert.ok(k in b, `${name}.${k}`);
    for (const s of ['mechanical', 'take', 'wait']) for (const k of ['n', 'avg', 'total', 't']) assert.ok(k in b[s], `${name}.${s}.${k}`);
    assert.equal(b.take.n + b.wait.n, b.mechanical.n, `${name}: TAKE + WAIT = every filled trade`);
    assert.equal(b.take.orders + b.wait.orders, b.orders); assert.equal(b.take.unfilled + b.wait.unfilled, b.unfilled); assert.equal(b.orders - b.unfilled, b.mechanical.n, `${name}: an unfilled order is in no average`);
    assert.ok(Math.abs(b.take.total + b.wait.total - b.mechanical.total) < 0.02, `${name}: totals add up`);
  };
  let orders = 0;
  for (const e of EDGES) {
    const x = ev.edges[e.id], C = cands(e.id), O = outs(e.id), use = C.filter((c) => c.pool === 'train' && !flagged(c));
    check(x, e.id); check(x.split.first70, e.id + '.first70'); check(x.split.last30, e.id + '.last30');
    assert.equal(x.orders, use.length, `${e.id}: train pool, not flagged, nothing else`); orders += x.orders;
    assert.equal(x.split.first70.orders + x.split.last30.orders, x.orders);
    assert.deepEqual(x.excluded, { exam: C.filter((c) => c.pool === 'exam').length, flaggedTrain: C.filter((c) => c.pool === 'train' && flagged(c)).length });
    const net = use.filter((c) => !UNFILLED.includes(O[c.id].reason)).map((c) => O[c.id].netR);
    assert.deepEqual(x.mechanical, stat(net), `${e.id}: the mechanical line is every filled train trade`);
    assert.deepEqual({ verdict: x.verdict, why: x.why }, verdictOf(x));
    assert.ok(['adds value', 'no measurable difference', 'worse'].includes(x.verdict));
    if (x.verdict === 'adds value') assert.ok(x.diff.t >= T_LINE); if (x.verdict === 'worse') assert.ok(x.diff.t <= -T_LINE);
    assert.match(x.why, /n \d+/, 'a verdict names its n');
    assert.equal(x.waits.n, x.wait.orders); assert.equal(x.waits.gateOnly + x.waits.evidenceOnly + x.waits.both, x.waits.n);
    for (const g of x.waits.gates) assert.ok(g.code in MXA.GATES, g.code);
  }
  check(ev.overall, 'overall'); assert.equal(ev.overall.orders, orders);
});

test('evaluate: statistics and the walk (history only from trades that had finished) on a synthetic edge', () => {
  assert.deepEqual(stat([1, -1, 2, 0.5]), { n: 4, avg: 0.625, total: 2.5, t: 1, win: 0.75 });   // sd 1.25, so t = 0.625 / (1.25 / 2)
  assert.deepEqual(stat([]), { n: 0, avg: null, total: 0, t: null, win: null });
  const w = welch([1, 2, 3, 4], [0, 0.5, 1, 1.5, 2]); assert.equal(w.diff, 1.5); assert.equal(w.t, 2.04);   // 1.5 / sqrt(1.6667 / 4 + 0.625 / 5)
  const mk = (action, netR, t, filled = true) => ({ id: 'x' + t, t, action, filled, netR: filled ? netR : null, gates: [], evidenceWait: action === 'WAIT', topCon: null, confidence: 'low' });
  const rows = [1, 2, 3, 4, 5, 6].map((r, i) => mk('BUY', r, i)).concat([-1, -2, -1, -3, 0, -1].map((r, i) => mk('WAIT', r, 10 + i)), [mk('BUY', 0, 20, false)]);
  const b = block(rows); assert.equal(b.orders, 13); assert.equal(b.unfilled, 1); assert.equal(b.take.n, 6); assert.equal(b.wait.n, 6); assert.equal(b.mechanical.n, 12);
  assert.equal(verdictOf(b).verdict, 'adds value'); assert.equal(verdictOf(block(rows.map((r) => ({ ...r, action: r.action === 'WAIT' ? 'BUY' : 'WAIT' })))).verdict, 'worse');
  assert.equal(verdictOf(block(rows.filter((r) => r.action !== 'WAIT'))).verdict, 'no measurable difference');
  assert.equal(report(rows).split.first70.orders + report(rows).split.last30.orders, 13);
  // the walk: a trade still open at the next signal is not history yet; exam and flagged setups are never decided
  const ser = F.seriesFromM1(F.typedM1(BASE)), tt = (d) => T0 + Math.round(d * 1440) * 60, seen = [];
  const C = [100.3, 101.3, 102.3, 103.3].map((d, i) => ({ ...candAt('replica', tt(d), i % 2 ? 'sell' : 'buy', ser), pool: i === 2 ? 'exam' : 'train' }));
  C.push({ ...candAt('replica', tt(104.3), 'buy', ser), rule: { clockShift: true } });
  const O = Object.fromEntries(C.map((c, i) => [c.id, { id: c.id, R: 1, netR: 0.9, exitT: i === 0 ? tt(102) : c.t + 600, reason: 'target' }]));
  const real = MXA.decide; MXA.decide = (snap, opts) => { seen.push({ t: snap.t, history: opts.history.map((h) => h.t), edgeDef: opts.edgeDef, lessons: opts.lessons }); return real(snap, opts); };
  try { const out = walkEdge({ edge: edgeById('replica'), cands: C, outs: O, series: ser, cal: null, dataVersion: 'synthetic' }); assert.deepEqual(out.map((r) => r.t), [C[0].t, C[1].t, C[3].t]); } finally { MXA.decide = real; }
  assert.deepEqual(seen.map((s) => s.history), [[], [], [C[0].t, C[1].t]], 'the first trade was still open at the second signal');
  assert.deepEqual(seen[0].edgeDef, { version: edgeById('replica').version, cost: 0.3 }); assert.deepEqual(seen[0].lessons, []);
});

// ---- the models ---------------------------------------------------------------------------------------------------------
const INDEX = json('ml/models/index.json');
const REVIEW = json('research/edge/academy-ml-review/result.json');
const sha256 = (s) => require('node:crypto').createHash('sha256').update(s).digest('hex');
const PASSED = 'passed validation, not promoted: owner decision', REJECTED = 'rejected challenger';
const SCOPES = (e) => (e.scopeEdge === 'pooled' ? EDGES.map((x) => x.id) : [e.scopeEdge]);
// the rows a scope is fitted on: train pool, not flagged, filled, every timeframe present; sorted as the trainer sorts them
function usableRows(scopeEdge, m) {
  const out = [];
  for (const id of (scopeEdge === 'pooled' ? EDGES.map((x) => x.id) : [scopeEdge])) { const O = outs(id); for (const c of cands(id)) if (c.pool === 'train' && !flagged(c) && !UNFILLED.includes(O[c.id].reason) && m.rows.get(c.id).f.barsOk === true) out.push({ id: c.id, edge: id, t: c.t, exitT: O[c.id].exitT }); }
  return out.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
// Python's round(): halves go to the even neighbour
const pyRound = (x) => { const f = Math.floor(x), d = x - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : f % 2 === 0 ? f : f + 1; };
function holm(ps) { const m = ps.length, order = ps.map((p, i) => i).sort((a, b) => ps[a] - ps[b] || a - b), out = new Array(m); let run = 0; order.forEach((i, rank) => { run = Math.max(run, Math.min(1, (m - rank) * ps[i])); out[i] = run; }); return out; }
function checkNode(n, nf, depth, where) {
  assert.ok(depth <= 3, `${where}: deeper than the trainer allows`);
  if (n.v !== undefined) { assert.deepEqual(Object.keys(n), ['v'], where); assert.ok(Number.isFinite(n.v), where); return 1; }
  assert.deepEqual(Object.keys(n), ['f', 't', 'defaultLeft', 'left', 'right'], where);
  assert.ok(Number.isInteger(n.f) && n.f >= 0 && n.f < nf && Number.isFinite(n.t) && typeof n.defaultLeft === 'boolean', where);
  return checkNode(n.left, nf, depth + 1, where + 'L') + checkNode(n.right, nf, depth + 1, where + 'R');
}

test('ml/models/index.json: every configuration and scope is accounted for; small edges are not fitted; nothing is promoted', () => {
  for (const k of ['generated', 'trainer', 'code', 'libraries', 'data', 'target', 'rows', 'settings', 'notInputs', 'preregistration', 'verdictRule', 'promotion', 'examRead', 'examPolicy', 'family', 'tests', 'models', 'skipped']) assert.ok(k in INDEX, k);
  const m = loadMatrix(); assert.equal(INDEX.data.matrixVersion, m.version, 'the scorers were trained on the committed matrix');
  assert.deepEqual(INDEX.data.featVersions, Object.fromEntries(EDGES.map((e) => [e.id, feat(e.id).version])));
  assert.equal(INDEX.code['train.py'], sha256(fs.readFileSync(path.join(ROOT, 'ml/train.py'))).slice(0, 12), 'ml/models was not written by the committed ml/train.py: run it again');
  assert.equal(INDEX.partial, false); assert.equal(INDEX.settings.minRows, 150); assert.equal(INDEX.settings.tLine, 2); assert.ok(Math.abs(INDEX.settings.pLine - 0.02275) < 1e-5); assert.ok(INDEX.settings.lightgbm.max_depth <= 3);
  assert.ok(fs.existsSync(path.join(ROOT, INDEX.preregistration)));
  // four challenger configurations at most, each with a short, fixed feature list
  const cfg = INDEX.settings.configs; assert.deepEqual(Object.keys(cfg), ['gbt', 'logit-short', 'mono-gbt', 'pooled-logit', 'ridge-netR']);
  assert.equal(INDEX.settings.shortList.length, 7); for (const k of Object.keys(cfg)) if (k !== 'gbt') assert.deepEqual(cfg[k].features, INDEX.settings.shortList, k);
  for (const k of INDEX.settings.shortList.concat(INDEX.settings.monotoneUp)) assert.ok(k in MXA.FEATURE_DOC && !MXA.PRICE_KEYS.includes(k) && !(k in INDEX.notInputs), k);
  // every configuration on every scope it is defined for: fitted, or the edge is listed as too small
  const fitted = EDGES.filter((e) => usableRows(e.id, m).length >= 150).map((e) => e.id), small = EDGES.map((e) => e.id).filter((id) => !fitted.includes(id));
  assert.deepEqual(INDEX.skipped.map((s) => s.edge), small);
  for (const s of INDEX.skipped) { assert.equal(s.status, 'not enough data'); assert.equal(s.trainRows, usableRows(s.edge, m).length); assert.ok(s.trainRows < 150, s.edge); assert.match(s.why, /\d+ filled train trades/); }
  const want = []; for (const [k, c] of Object.entries(cfg)) { if (c.scopes.includes('edges')) for (const e of fitted) want.push(`${k}/${e}`); if (c.scopes.includes('pooled')) want.push(`${k}/pooled`); }
  assert.deepEqual(INDEX.models.map((e) => `${e.config}/${e.scopeEdge}`), want);
  assert.equal(new Set(INDEX.models.map((e) => e.id)).size, INDEX.models.length); assert.equal(new Set(INDEX.models.map((e) => e.scope)).size, INDEX.models.length, 'the page tells the scorers apart by scope');
  // NOTHING is promoted, and no status is a registry status
  assert.equal(JSON.stringify(INDEX).includes('"champion"'), false);
  for (const e of INDEX.models) {
    for (const k of ['id', 'edge', 'scope', 'scopeEdge', 'config', 'kind', 'status', 'verdict', 'beatsBaseline', 'promoted', 'calibrated', 'file', 'pred', 'trainRows', 'from', 'to', 'rowIdsHash', 'featureNames', 'validation', 'folds', 'outOfFold', 'acceptance', 'calibration', 'threshold', 'exam', 'hash', 'register']) assert.ok(k in e, `${e.scope}.${k}`);
    assert.equal(e.promoted, false); assert.ok([REJECTED, PASSED].includes(e.status), e.status); assert.equal(e.status, e.beatsBaseline ? PASSED : REJECTED);
    assert.equal(e.kind, cfg[e.config].kind); assert.equal(e.scope, e.config === 'gbt' ? e.scopeEdge : `${e.scopeEdge} · ${e.config}`);
    assert.equal(e.exam, null, 'no exam block: this trainer cannot read the exam pool');
  }
  assert.equal(INDEX.examRead, false); assert.match(INDEX.examPolicy, /cannot read the exam pool/); assert.match(INDEX.promotion, /manual, by the owner/);
});

test('walk-forward: every scorer has its folds, n and metrics; the embargo and the threshold rule hold on the committed data', () => {
  const m = loadMatrix(), W = INDEX.settings.embargoSec;
  // the label window of an edge is at least its rule's own bound (order life plus maximum hold) and at least a day
  for (const e of EDGES) { const rule = ((e.exit.maxHoldH || 0) + (e.exit.orderValidH || 0)) * 3600; assert.ok(W[e.id] >= 86400 && W[e.id] >= rule, `${e.id}: embargo ${W[e.id]} s is shorter than its rule's ${rule} s`); }
  for (const e of INDEX.models) {
    const rows = usableRows(e.scopeEdge, m), n = rows.length;
    assert.equal(e.trainRows, n, `${e.scope}: trained on the train pool only`);
    assert.equal(e.rowIdsHash, sha256(JSON.stringify(rows.map((r) => r.id).sort())).slice(0, 16), `${e.scope}: the fitted ids are exactly the usable train ids`);
    assert.match(e.validation.scheme, /walk-forward/); assert.ok(e.folds.length >= 3 && e.folds.length === e.validation.folds);
    // the folds, recomputed here from the candidate and outcome files
    const k = n >= 300 ? 4 : 3, first = pyRound(INDEX.settings.firstTrainShare * n), cuts = Array.from({ length: k + 1 }, (_, j) => first + pyRound(j * (n - first) / k));
    assert.equal(e.folds.length, k); const end = rows.map((r) => r.t + W[r.edge]); let seen = 0;
    e.folds.forEach((f, j) => {
      const a = cuts[j], b = cuts[j + 1], start = rows[a].t, train = rows.slice(0, a).filter((r, i) => end[i] <= start);
      assert.deepEqual([f.fold, f.testFrom, f.testTo, f.testRows, f.trainRows, f.purged], [j + 1, start, rows[b - 1].t, b - a, train.length, a - train.length], `${e.scope} fold ${j + 1}`);
      assert.ok(j === 0 || f.trainRows > e.folds[j - 1].trainRows, 'expanding window');
      // no training row's trade is still open when the block starts, and none of them comes from the block or later
      for (const r of train) assert.ok(r.exitT <= start && r.t < start, `${e.scope} fold ${j + 1}: ${r.id} was still open at the block start`);
      // the keep-threshold: from earlier predictions on trades whose label window had closed
      if (j === 0) assert.match(f.thresholdFrom, /inner split/);
      else { const closed = rows.slice(first, a).filter((r, i) => end[first + i] <= start); assert.match(f.thresholdFrom, /earlier test blocks/); assert.equal(f.thresholdRows, closed.length); assert.equal(f.thresholdHeldBack, a - first - closed.length); for (const r of closed) assert.ok(r.exitT <= start); }
      for (const key of ['gbt'].concat('logit' in e.outOfFold ? ['logit'] : [])) { const x = f[key]; for (const q of ['n', 'auc', 'trading']) assert.ok(q in x, `${e.scope} fold ${f.fold} ${key}.${q}`); assert.equal(x.trading.kept.n + x.trading.skipped.n, x.trading.mechanical.n); assert.equal(x.n, f.testRows); }
      seen += f.testRows;
    });
    assert.equal(seen, e.validation.outOfFoldRows); assert.equal(seen, n - first);
    const o = e.outOfFold; for (const key of ['gbt', 'prior', 'alwaysTake']) assert.ok(key in o, key);
    assert.equal('logit' in o, e.config === 'gbt', 'the 70-input logistic line belongs to the reference only');
    const g = o.gbt, tr = g.trading; assert.equal(g.n, seen); assert.equal(o.alwaysTake.n, seen); assert.equal(g.calibration.reduce((s, x) => s + x.n, 0), seen);
    assert.equal(tr.kept.n + tr.skipped.n, seen); assert.ok(Number.isFinite(g.auc) && Number.isFinite(g.inFoldAuc)); for (const q of ['keptMinusSkippedT', 'p', 'pHolm', 'keptMinusMechanical', 'maxDrawdown']) assert.ok(q in tr, q);
    if (e.kind === 'ridge') { assert.equal(g.brier, null, 'an expected R is not a probability'); assert.ok(Number.isFinite(g.mse) && Number.isFinite(g.msePrior)); } else assert.ok(Number.isFinite(g.brier) && Number.isFinite(g.brierPrior));
    // the acceptance rule, re-applied to the stored numbers
    const last = e.folds.at(-1).gbt.trading, pLine = INDEX.settings.pLine;
    const lines = [tr.keptMinusSkippedT !== null && tr.keptMinusSkippedT >= 2 && tr.pHolm !== null && tr.pHolm <= pLine, tr.keptMinusMechanical !== null && tr.keptMinusMechanical > 0, tr.kept.n > 0 && tr.maxDrawdown.kept <= tr.maxDrawdown.mechanical,
      e.kind === 'ridge' ? g.mse <= g.msePrior : g.brier <= g.brierPrior, last.kept.n > 0 && last.skipped.n > 0 && last.kept.avg > last.mechanical.avg];
    assert.deepEqual(e.acceptance.map((x) => x.line), [1, 2, 3, 4, 5]); assert.deepEqual(e.acceptance.map((x) => x.ok), lines, e.scope);
    assert.equal(e.beatsBaseline, lines.every(Boolean), e.scope);
    if (!e.beatsBaseline) assert.match(e.verdict, /^no improvement over taking every setup/); else assert.match(e.verdict, /^passes every line/);
  }
});

test('the test family: every scorer x edge test, Holm-corrected; a pass needs the corrected p', () => {
  const T = INDEX.tests; assert.equal(INDEX.family.tests, T.length); assert.equal(INDEX.family.correction, 'Holm'); assert.ok(T.length >= INDEX.models.length);
  const adj = holm(T.map((x) => x.p)); T.forEach((x, i) => { assert.ok(x.kept >= 2 && x.skipped >= 2, 'a test needs two trades a side'); assert.ok(Math.abs(x.pHolm - adj[i]) < 1e-4, `${x.scorer} ${x.edge}: Holm p ${x.pHolm}, recomputed ${adj[i]}`); assert.ok(x.pHolm >= x.p - 1e-9); });
  for (const e of INDEX.models) {
    const mine = T.filter((x) => x.scorer === e.id && x.line === 'scorer' && x.verdictTest), tr = e.outOfFold.gbt.trading;
    assert.ok(mine.length <= 1); if (tr.keptMinusSkippedT === null) { assert.equal(mine.length, 0); continue; }
    assert.equal(mine.length, 1, `${e.scope}: its own test is in the family`); assert.equal(mine[0].t, tr.keptMinusSkippedT); assert.ok(Math.abs(mine[0].pHolm - tr.pHolm) < 1e-6);
    assert.equal(mine[0].edge, e.scopeEdge === 'pooled' ? 'all, edge-adjusted' : e.scopeEdge);
    if (e.scopeEdge === 'pooled') assert.ok(T.some((x) => x.scorer === e.id && !x.verdictTest), 'a pooled scorer is also tested inside each edge');
  }
  // the smallest corrected p among the scorers' own tests decides whether anything can pass
  const own = T.filter((x) => x.verdictTest && x.line === 'scorer'); if (!own.some((x) => x.t >= 2 && x.pHolm <= INDEX.settings.pLine)) assert.ok(INDEX.models.every((e) => !e.beatsBaseline), 'no scorer may pass without a corrected p under the line');
});

test('every exported scorer fits MXA.MODEL_SCHEMA, is not promoted, and MXA.score reproduces the training library', () => {
  const matrix = loadMatrix(), docKeys = Object.keys(MXA.FEATURE_DOC), trees = INDEX.models.filter((e) => e.file), linear = INDEX.models.filter((e) => !e.file);
  assert.ok(trees.length >= 1); assert.deepEqual(trees.map((e) => e.kind), trees.map(() => 'trees')); assert.ok(linear.every((e) => e.kind !== 'trees'));
  const onDisk = fs.readdirSync(path.join(ROOT, 'ml/models')).filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
  assert.deepEqual(onDisk, trees.flatMap((e) => [e.file, e.pred]).sort(), 'no stray model file');
  // a linear scorer has no file the page could load, no registry body, and never a probability on show
  for (const e of linear) { assert.equal(e.file, null); assert.equal(e.pred, null); assert.equal(e.register, null); assert.equal(e.calibrated, false); assert.match(e.notExported, /no file the page could load/); assert.ok(e.coefficients.inputs.length >= 1 && e.coefficients.weights.length === e.coefficients.inputs.length); }
  const trainIds = new Set(EDGES.flatMap((x) => cands(x.id).filter((c) => c.pool === 'train').map((c) => c.id)));
  for (const e of trees) {
    const model = json('ml/models/' + e.file), pred = json('ml/models/' + e.pred), cfg = INDEX.settings.configs[e.config];
    for (const k of ['version', 'promoted', 'calibrated', 'featureNames', 'encoders', 'baseScore', 'link', 'trees']) assert.ok(k in model, `${e.id}: ${k} (MXA.MODEL_SCHEMA)`);
    for (const k of Object.keys(MXA.MODEL_SCHEMA)) if (k !== 'platt') assert.ok(k in model, k);
    assert.equal(model.version, e.id); assert.equal(model.promoted, false, 'promotion is the owner\'s action, never the trainer\'s'); assert.equal(typeof model.calibrated, 'boolean'); assert.equal(model.status, e.status);
    assert.equal(model.calibrated, e.calibrated); assert.equal(model.calibrated, e.calibration.passed === true, 'calibrated only when the check on the last fold passed');
    assert.equal('platt' in model, model.calibrated); if (model.platt) assert.ok(model.platt.length === 2 && model.platt.every(Number.isFinite));
    assert.equal(model.link, 'logit'); assert.equal(model.baseScore, 0);
    assert.deepEqual(model.featureNames, e.featureNames);
    for (const name of model.featureNames) {
      assert.ok(docKeys.includes(name) || (e.scopeEdge === 'pooled' && name === 'edge'), `${e.id}: ${name} is not a key of MXA.features`);
      assert.ok(!MXA.PRICE_KEYS.includes(name) && !(name in INDEX.notInputs), `${e.id}: ${name} is not an allowed input`);
    }
    for (const [name, enc] of Object.entries(model.encoders)) { assert.ok(model.featureNames.includes(name)); for (const v of Object.values(enc)) assert.ok(Number.isFinite(v)); }
    // every string value the data holds for an input has a code (so nothing is silently "missing" on the page)
    for (const [, row] of matrix.rows) for (const name of model.featureNames) { const v = name === 'edge' ? row.edge : row.f[name]; if (typeof v === 'string') assert.ok(model.encoders[name] && v in model.encoders[name], `${e.id}: no code for ${name} = ${v}`); }
    assert.equal(model.trees.length, cfg.trees);
    model.trees.forEach((t, i) => assert.ok(checkNode(t, model.featureNames.length, 1, `${e.id} tree ${i} `) <= cfg.params.num_leaves));
    // the constrained stumps really are non-decreasing in the policy's factors (a row goes left when x <= t)
    if (cfg.monotoneUp) for (const t of model.trees) if (t.v === undefined && cfg.monotoneUp.includes(model.featureNames[t.f])) { assert.ok(t.left.v !== undefined && t.right.v !== undefined, 'a stump'); assert.ok(t.left.v <= t.right.v + 1e-12, `${e.id}: the score falls as ${model.featureNames[t.f]} rises`); }
    // parity: the stored predictions of the training library, reproduced by the page's scorer; the sample is train-pool rows only
    assert.equal(pred.model, e.id); assert.ok(pred.rows.length >= 100 && pred.rows.length <= 300);
    for (const r of pred.rows) assert.ok(trainIds.has(r.id), `${e.id}: a prediction for ${r.id}, which is not a train-pool candidate`);
    const c = compare(model, pred, matrix);
    assert.ok(c.maxRaw < TOLERANCE && c.maxP < TOLERANCE, `${e.id}: MXA.score differs from the training library by ${c.maxP} (row ${c.worst})`);
    assert.ok(c.maxExact < 1e-9, `${e.id}: the unrounded tree sum differs by ${c.maxExact}`);
    assert.ok(new Set(pred.rows.map((r) => r.p.toFixed(4))).size > (e.config === 'gbt' ? 20 : 5), 'the sample is not one constant');
    // a missing value takes the node's default side and an unknown category counts as missing
    const some = matrix.rows.get(pred.rows[0].id), f = featuresFor(some), holes = { ...f }; for (const k of model.featureNames.slice(0, 30)) holes[k] = null;
    assert.ok(Math.abs(MXA.score(model, holes).raw - rawExact(model, holes)) < 1e-6);
    assert.equal(MXA.score(model, { ...f, biasAlign: 'mars', session: 'mars' }).p, MXA.score(model, { ...f, biasAlign: null, session: null }).p);
    // decide() does not use it: not promoted
    const d = MXA.decide({ v: 1, edge: e.edge || 'gmp', market: 'xau', t: T0, cand: null, bars: {} }, { model });
    assert.equal(d.modelScore, null); assert.equal(d.modelVersion, null);
  }
});

test('the registry bodies in the index are accepted by the API as challengers; promotion needs the owner\'s confirm', async () => {
  const withBody = INDEX.models.filter((e) => e.register);
  assert.deepEqual(withBody.map((e) => e.id), INDEX.models.filter((e) => e.file).map((e) => e.id), 'only a scorer with a file has a registry body');
  for (const e of withBody) {
    const b = e.register; assert.equal(b.action, 'model.register'); assert.equal(b.model.status, 'challenger'); assert.equal(b.model.version, e.id); assert.equal(b.model.hash, e.hash); assert.equal(b.model.artifact, 'ml/models/' + e.file);
    assert.match(b.model.notes, e.beatsBaseline ? /^PASSED VALIDATION, NOT PROMOTED/ : /^REJECTED CHALLENGER/);
    const r = await api('POST', b); assert.equal(r.code, 200, JSON.stringify(r.body)); assert.equal(r.body.model.status, 'challenger');
    assert.equal((await api('POST', { action: 'model.promote', id: r.body.model.id })).code, 400, 'no promotion without confirm: true');
  }
  const reg = (await api('GET', { get: 'models' })).body; assert.equal(reg.championId, null, 'registering promotes nothing'); assert.equal(reg.models.length, withBody.length);
  // what the page's Models tab is given: every scorer, its status and numbers, never a promoted one
  const tr = (await api('GET', { get: 'training' })).body; assert.equal(tr.available, true); assert.equal(tr.models.length, INDEX.models.length);
  for (const x of tr.models) { assert.equal(x.promoted, false); assert.ok([REJECTED, PASSED].includes(x.status)); assert.ok(Number.isFinite(x.outOfFold.gbt.n) && x.outOfFold.gbt.n > 0); assert.equal(x.exam, null); }
});

// ---- the training review of 10 Nov 2026 (research/edge/academy-ml-review) -----------------------------------------------------
test('the trainer cannot read an exam outcome: the loader drops other pools, there is no exam code path, and the scrambled run matches', () => {
  const py = read('ml/train.py'), code = py.replace(/"""[\s\S]*?"""/g, '').split('\n').map((l) => l.replace(/(^|\s+)#.*$/, '')).join('\n');
  // one loader, and it skips a row of another pool before unpacking it
  assert.equal((code.match(/def load_matrix\(/g) || []).length, 1);
  const loader = code.slice(code.indexOf('def load_matrix('), code.indexOf('def feature_names('));
  assert.match(loader, /if r\[i_pool\] != "train":\s*\n\s*dropped\[[^\n]*\n\s*continue\s*\n\s*d = dict\(zip\(lab, r\[:nl\]\)\)/, 'a row outside the train pool is skipped before its labels and features are unpacked');
  assert.match(loader, /m\["rows"\] = None/, 'the raw table is released');
  // nothing else opens a data file, and the word exam appears only where the trainer says it reads none
  assert.ok(!/out-<|out-%|cand-|feat-<|feat-%|academy\/data|"academy"/.test(code), 'the trainer reads the matrix and nothing else');
  assert.deepEqual((code.match(/gzip\.open\(/g) || []).length, 1); assert.ok(!/exam_block|usable\([^)]*"exam"|== "exam"|pool"\] == /.test(code));
  for (const l of code.split('\n')) if (/exam/i.test(l)) assert.match(l, /"exam": None|"examRead": False|"examPolicy"|--no-exam|The exam pool is not read/, `ml/train.py mentions the exam pool in code: ${l.trim().slice(0, 90)}`);
  assert.match(code, /if row\["pool"\] != "train":\s*\n\s*raise RuntimeError/); assert.match(code, /if any\(r\["pool"\] != "train" for r in rows\):\s*\n\s*raise RuntimeError/);
  // the proof on record: the same run on a matrix whose other-pool rows are noise gives the same bytes as the committed models
  const x = REVIEW.audit.leakage.exam, exam = EDGES.reduce((n, e) => n + cands(e.id).filter((c) => c.pool !== 'train').length, 0);
  assert.equal(x.notTrainCandidates, exam); assert.equal(x.droppedByTheLoader, exam); assert.equal(x.scramble.rowsOverwritten, exam);
  assert.equal(x.examIdsInAnyFit, 0); assert.equal(x.scramble.identical, true); assert.equal(x.scramble.matchesCommittedModels, true);
  assert.equal(x.scramble.files, fs.readdirSync(path.join(ROOT, 'ml/models')).length);
  assert.deepEqual(INDEX.notTrainDropped, Object.fromEntries(EDGES.map((e) => [e.id, cands(e.id).filter((c) => c.pool !== 'train').length]).filter(([, n]) => n > 0)));
  // the review made no exam read, and left no entry in the ledger
  assert.equal(REVIEW.examReads, 0);
  const ledger = path.join(ROOT, 'academy/data/exam-ledger.json');
  if (fs.existsSync(ledger)) { const L = JSON.parse(fs.readFileSync(ledger, 'utf8')); assert.ok(Array.isArray(L.reads)); for (const r of L.reads) assert.ok(!/ml\/(train|review)|academy-ml-review/.test(JSON.stringify(r)), 'the training review reads no exam data'); }
});

test('the review: result.json belongs to the committed scorers, with zero exam reads and zero fold-overlap violations under the embargo', () => {
  for (const k of ['built', 'title', 'system', 'prereg', 'verdict', 'variantsTried', 'examReads', 'data', 'code', 'design', 'summary', 'scorers', 'family', 'audit', 'protocol', 'deviations']) assert.ok(k in REVIEW, k);
  assert.equal(REVIEW.code['train.py'], INDEX.code['train.py'], 'the review was run against another trainer: run python ml/review.py again');
  assert.equal(REVIEW.code['review.py'], sha256(fs.readFileSync(path.join(ROOT, 'ml/review.py'))).slice(0, 12), 'result.json was not written by the committed ml/review.py');
  assert.equal(REVIEW.data.matrixVersion, INDEX.data.matrixVersion); assert.deepEqual(REVIEW.design.embargoSec, INDEX.settings.embargoSec);
  // the same scorers, the same numbers, the same verdicts
  assert.deepEqual(REVIEW.scorers.map((s) => s.id), INDEX.models.map((e) => e.id));
  REVIEW.scorers.forEach((s, i) => { const e = INDEX.models[i], tr = e.outOfFold.gbt.trading; assert.deepEqual([s.scope, s.trainRows, s.outOfFoldN, s.auc, s.t, s.kept.n, s.skipped.n, s.passes], [e.scope, e.trainRows, e.outOfFold.gbt.n, e.outOfFold.gbt.auc, tr.keptMinusSkippedT, tr.kept.n, tr.skipped.n, e.beatsBaseline], e.scope); });
  const S = REVIEW.summary; assert.equal(S.scorers, INDEX.models.length); assert.equal(S.passed, INDEX.models.filter((e) => e.beatsBaseline).length); assert.equal(S.promoted, 0); assert.equal(S.familyTests, INDEX.family.tests);
  assert.deepEqual(S.notFitted, INDEX.skipped.map((s) => s.edge));
  // a claim of skill needs a scorer that passed; without one the verdict says so, with n and t
  if (S.passed === 0) { assert.match(REVIEW.verdict, /^No scorer passes/); assert.match(REVIEW.verdict, /t out of fold is -?\d/); assert.match(REVIEW.verdict, /n \d+/); }
  const L = REVIEW.audit.leakage;
  // leakage checks: shuffled labels fall to chance, the canary is seen, no boundary violation, no exam id
  assert.ok(L.permutation.seeds >= 20 && Math.abs(L.permutation.meanAuc - 0.5) < 0.02, `shuffled labels: mean AUC ${L.permutation.meanAuc}`); assert.ok(L.permutation.shareTAtLeast2 < 0.08);
  assert.ok(L.canary.netR.minCanaryAuc > 0.8 && L.canary.netR.minCanaryT > 4, 'the pipeline must see a leak when one is planted');
  for (const v of Object.values(L.singleFeature)) assert.ok(v.maxAuc < v.canaryNetRAuc - 0.1, 'no real feature scores like the net-R canary');
  assert.equal(L.foldBoundaries.violationsWithEmbargo, 0); assert.equal(L.foldBoundaries.thresholdViolationsNew, 0); assert.equal(S.foldOverlapViolationsWithEmbargo, 0); assert.equal(S.thresholdViolationsNow, 0);
  assert.ok(L.foldBoundaries.violationsOldRule > 0 && L.foldBoundaries.thresholdViolationsOld > 0, 'the defects the review fixed are on record');
  for (const x of L.foldBoundaries.perScope) assert.deepEqual([x.newRule.firstUnitOpen, x.newRule.addMayBeOpen, x.thresholdNew.tradeOpenAtStart], [0, 0, 0], x.scope);
  assert.equal(S.examIdsInAnyFit, 0);
  // features: every input is known at the decision time; the table covers every input of the reference scorer
  const F = REVIEW.audit.features, ref = INDEX.models.find((e) => e.config === 'gbt' && e.scopeEdge === 'pooled');
  assert.deepEqual(F.table.map((x) => x.feature), ref.featureNames); assert.equal(F.notKnownAtDecision, 0); assert.ok(F.table.every((x) => x.knownAtDecision === true && x.missing >= 0 && x.missing <= 1));
  // power: per edge n, SD and the smallest detectable difference; the small edges are named
  const P = REVIEW.audit.power; for (const e of EDGES) { const v = P.perEdge[e.id]; assert.equal(v.n, usableRows(e.id, loadMatrix()).length); assert.ok(v.sdNetR > 0 && v.mdeEvenSplit > 0 && v.mde80_20 > v.mdeEvenSplit); }
  assert.deepEqual(P.cannotSupportAScorer, INDEX.skipped.map((s) => s.edge));
  // the first trainer's numbers are reproduced by the first trainer's rules, so the before / after table compares like with like
  assert.equal(REVIEW.protocol.reproducesTheArchivedNumbers, true);
  const old = json('ml/archive/gbt-1/index.json'); assert.equal(old.trainer, 'gbt-1'); assert.equal(old.examRead, true); assert.deepEqual(Object.keys(REVIEW.protocol.archived), old.models.map((e) => e.scope));
  // the written report: a verdict line, and no claim of skill unless a scorer passed
  const md = read('research/edge/academy-ml-review/RESULT.md'); assert.match(md, /^\*\*Verdict: No scorer passes/m); assert.match(md, /Exam reads by this review: \*\*0\*\*/);
  assert.ok(fs.existsSync(path.join(ROOT, 'research/edge/academy-ml-review/PREREGISTRATION.md')));
});

test('the workflow is manual only, commits nothing and needs no secret', () => {
  const y = read('.github/workflows/academy-train.yml'), body = y.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const on = body.match(/^on:\n((?:[ \t]+.*\n|\n)+)/m)[1], top = on.split('\n').filter((l) => /^ {2}\S/.test(l)).map((l) => l.trim());
  assert.deepEqual(top, ['workflow_dispatch:'], 'workflow_dispatch is the only trigger');
  assert.ok(!/\b(schedule|pull_request|push|workflow_run|cron)\s*:/.test(body));
  assert.ok(!/secrets\./.test(body) && !/git (push|commit)|contents:\s*write/.test(body));
  assert.match(body, /permissions:\n {2}contents: read/); assert.match(body, /runs-on: ubuntu-latest/);
  assert.match(body, /ref: council-data/); assert.match(body, /research\/candles\/xau-histdata/); assert.match(body, /research\/candles\/nsxusd-histdata/);
  for (const step of ['node academy/gen/features.mjs', 'node academy/gen/evaluate.mjs', 'python ml/train.py', 'node ml/parity.mjs', 'actions/upload-artifact@']) assert.ok(body.includes(step), step);
  assert.ok(body.indexOf('features.mjs') < body.indexOf('train.py') && body.indexOf('train.py') < body.indexOf('parity.mjs'));
});

test('isolation: no council, ICT, mirror or broker code, no key, no network, no model names', () => {
  const files = ['academy/gen/features.mjs', 'academy/gen/evaluate.mjs', '.github/workflows/academy-train.yml', 'tests/academy-ml.test.mjs', 'docs/academy/TRAINING.md']
    .concat(fs.readdirSync(path.join(ROOT, 'ml')).filter((f) => /\.(py|mjs|md|txt)$/.test(f)).map((f) => 'ml/' + f), ['ml/models/report.md', 'ml/models/index.json', 'ml/archive/gbt-1/report.md',
      'research/edge/academy-ml-review/PREREGISTRATION.md', 'research/edge/academy-ml-review/RESULT.md', 'research/edge/academy-ml-review/result.json']);
  const names = new RegExp(['clau' + 'de', 'anth' + 'ropic', 'open' + 'ai', 'g' + 'pt-?\\d', 'gem' + 'ini', 'son' + 'net', 'op' + 'us', 'hai' + 'ku', 'lla' + 'ma'].join('|'), 'i');
  for (const f of files) {
    const s = read(f), code = /\.(py|mjs)$/.test(f) && !f.startsWith('tests/');
    assert.ok(!names.test(s), `${f}: a model name`);
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s), `${f}: an emoji`);
    if (!code) continue;
    // the one allowed reading of council code: the calendar data file, imported read-only by the feature export
    const council = s.match(/council\/[\w.-]*/g) || [];
    assert.deepEqual([...new Set(council)], f === 'academy/gen/features.mjs' ? ['council/events.mjs'] : [], `${f}: references council code`);
    assert.ok(!/(^|[^a-z])ict\/|ctrader|mirror|broker|placeOrder|sendAlerts/i.test(s), `${f}: references ICT, mirror or broker code`);
    assert.ok(!/api[_-]?key|_TOKEN|_SECRET|_KEY\b|secrets\./i.test(s), `${f}: a key`);
    assert.ok(!/\bfetch\s*\(|https?:\/\/|node:https?|require\(['"]https?['"]\)|\b(requests|urllib|socket|http\.client)\b/.test(s), `${f}: a network call`);
  }
  // and nothing in council/, ict/ or api/ imports the dataset or the training code
  for (const dir of ['council', 'ict', 'api']) for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((x) => /\.(mjs|js)$/.test(x))) {
    const s = read(`${dir}/${f}`); assert.ok(!/gen\/features|gen\/evaluate|ml\/(train|parity)/.test(s), `${dir}/${f} imports Academy training code`);
  }
  // shuffled K-fold has no place in the trainer
  for (const f of ['ml/train.py', 'ml/review.py']) {
    const py = read(f); assert.ok(!/\bKFold\b|shuffle\s*=\s*True|train_test_split|StratifiedKFold|cross_val/.test(py.replace(/"""[\s\S]*?"""/g, '')), `${f}: shuffled cross-validation`);
    assert.ok(!/"promoted": True|promoted\s*=\s*True|"status": "champion"|model\.promote"/.test(py), `${f}: promotes a model`);
  }
  assert.match(read('ml/train.py'), /"promoted": False/);
});
