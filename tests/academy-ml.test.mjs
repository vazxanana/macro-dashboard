// node --test tests/academy-ml.test.mjs — the Academy dataset and the offline training service:
//   academy/gen/features.mjs + academy/data/feat-<edge>.json   one small feature row per candidate, closed bars only
//   academy/gen/evaluate.mjs + academy/data/eval.json          the decision policy against taking every setup
//   ml/ (train.py, parity.mjs, models/, data/)                 the scorer's models, their index and the parity check
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
function checkNode(n, nf, depth, where) {
  assert.ok(depth <= 3, `${where}: deeper than the trainer allows`);
  if (n.v !== undefined) { assert.deepEqual(Object.keys(n), ['v'], where); assert.ok(Number.isFinite(n.v), where); return 1; }
  assert.deepEqual(Object.keys(n), ['f', 't', 'defaultLeft', 'left', 'right'], where);
  assert.ok(Number.isInteger(n.f) && n.f >= 0 && n.f < nf && Number.isFinite(n.t) && typeof n.defaultLeft === 'boolean', where);
  return checkNode(n.left, nf, depth + 1, where + 'L') + checkNode(n.right, nf, depth + 1, where + 'R');
}

test('ml/models/index.json: the documented fields; small edges are not fitted; nothing is promoted', () => {
  for (const k of ['generated', 'trainer', 'code', 'libraries', 'data', 'target', 'rows', 'settings', 'notInputs', 'verdictRule', 'promotion', 'examRead', 'models', 'skipped']) assert.ok(k in INDEX, k);
  const m = loadMatrix(); assert.equal(INDEX.data.matrixVersion, m.version, 'the models were trained on the committed matrix');
  assert.deepEqual(INDEX.data.featVersions, Object.fromEntries(EDGES.map((e) => [e.id, feat(e.id).version])));
  assert.equal(INDEX.settings.minRows, 150); assert.equal(INDEX.settings.tLine, 2); assert.ok(INDEX.settings.embargoSec >= 86400); assert.ok(INDEX.settings.lightgbm.max_depth <= 3);
  assert.deepEqual(INDEX.models.map((e) => e.scope).concat(INDEX.skipped.map((e) => e.edge)).sort(), EDGES.map((e) => e.id).concat('pooled').sort(), 'every edge and the pooled model are accounted for');
  for (const s of INDEX.skipped) { assert.equal(s.status, 'not enough data'); assert.ok(s.trainRows < 150, s.edge); assert.match(s.why, /\d+ filled train trades/); }
  for (const e of INDEX.models) {
    for (const k of ['id', 'edge', 'scope', 'status', 'verdict', 'beatsBaseline', 'promoted', 'calibrated', 'file', 'pred', 'trainRows', 'from', 'to', 'featureNames', 'validation', 'folds', 'outOfFold', 'regressionView', 'calibration', 'threshold', 'exam', 'hash', 'register']) assert.ok(k in e, `${e.scope}.${k}`);
    assert.equal(e.promoted, false); assert.ok(e.trainRows >= 150);
    // the rows it was fitted on: train pool, not flagged, filled (recounted from the candidate files)
    const ids = e.scope === 'pooled' ? EDGES.map((x) => x.id) : [e.scope]; let n = 0;
    for (const id of ids) { const O = outs(id); n += cands(id).filter((c) => c.pool === 'train' && !flagged(c) && !UNFILLED.includes(O[c.id].reason) && m.rows.get(c.id).f.barsOk === true).length; }
    assert.equal(e.trainRows, n, `${e.scope}: trained on the train pool only`);
    // chronological walk-forward: at least three folds, each trained only on what came before, with trades purged at the boundary
    assert.match(e.validation.scheme, /walk-forward/); assert.ok(e.folds.length >= 3 && e.folds.length === e.validation.folds);
    e.folds.forEach((f, i) => {
      assert.ok(f.testFrom <= f.testTo && (i === 0 || f.testFrom >= e.folds[i - 1].testTo), `${e.scope}: folds in time order`);
      assert.ok(i === 0 || f.trainRows > e.folds[i - 1].trainRows, 'expanding window'); assert.ok(f.purged >= 0);
      assert.match(f.thresholdFrom, /earlier test blocks|inner split/);
      for (const k of ['gbt', 'logit']) { const x = f[k]; for (const q of ['n', 'auc', 'brier', 'brierPrior', 'logLoss', 'trading']) assert.ok(q in x, `${e.scope} fold ${f.fold} ${k}.${q}`); assert.equal(x.trading.kept.n + x.trading.skipped.n, x.trading.mechanical.n); assert.equal(x.n, f.testRows); }
    });
    assert.equal(e.folds.reduce((s, f) => s + f.testRows, 0), e.validation.outOfFoldRows);
    const o = e.outOfFold; for (const k of ['gbt', 'logit', 'prior', 'alwaysTake']) assert.ok(k in o, k);
    assert.equal(o.gbt.n, e.validation.outOfFoldRows); assert.equal(o.gbt.calibration.reduce((s, b) => s + b.n, 0), o.gbt.n); assert.equal(o.alwaysTake.n, o.gbt.n);
    // the verdict rule, re-applied to the stored numbers
    const tr = o.gbt.trading, last = e.folds.at(-1).gbt.trading;
    const beats = tr.keptMinusSkippedT !== null && tr.keptMinusSkippedT >= 2 && tr.keptMinusMechanical > 0 && last.kept.n > 0 && last.skipped.n > 0 && last.kept.avg > last.mechanical.avg;
    assert.equal(e.beatsBaseline, beats, e.scope); assert.equal(e.status, beats ? 'challenger' : 'rejected challenger');
    if (!beats) assert.match(e.verdict, /^no improvement over taking every setup/);
    // the exam block stands apart and names its limit
    if (INDEX.examRead) { assert.match(e.exam.what, /read once/); assert.match(e.exam.limit, /not later data/); assert.ok(e.exam.gbt.n >= 10 && e.exam.alwaysTake.n === e.exam.gbt.n); }
  }
});

test('every exported model fits MXA.MODEL_SCHEMA, is not promoted, and MXA.score reproduces the training library', () => {
  const matrix = loadMatrix(), docKeys = Object.keys(MXA.FEATURE_DOC);
  assert.ok(INDEX.models.length >= 1);
  const onDisk = fs.readdirSync(path.join(ROOT, 'ml/models')).filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
  assert.deepEqual(onDisk, INDEX.models.flatMap((e) => [e.file, e.pred]).sort(), 'no stray model file');
  for (const e of INDEX.models) {
    const model = json('ml/models/' + e.file), pred = json('ml/models/' + e.pred);
    for (const k of ['version', 'promoted', 'calibrated', 'featureNames', 'encoders', 'baseScore', 'link', 'trees']) assert.ok(k in model, `${e.id}: ${k} (MXA.MODEL_SCHEMA)`);
    for (const k of Object.keys(MXA.MODEL_SCHEMA)) if (k !== 'platt') assert.ok(k in model, k);
    assert.equal(model.version, e.id); assert.equal(model.promoted, false, 'promotion is the owner\'s action, never the trainer\'s'); assert.equal(typeof model.calibrated, 'boolean');
    assert.equal(model.calibrated, e.calibrated); assert.equal(model.calibrated, e.calibration.passed === true, 'calibrated only when the check on the last fold passed');
    assert.equal('platt' in model, model.calibrated); if (model.platt) assert.ok(model.platt.length === 2 && model.platt.every(Number.isFinite));
    assert.equal(model.link, 'logit'); assert.equal(model.baseScore, 0);
    assert.deepEqual(model.featureNames, e.featureNames);
    for (const name of model.featureNames) {
      assert.ok(docKeys.includes(name) || (e.scope === 'pooled' && name === 'edge'), `${e.id}: ${name} is not a key of MXA.features`);
      assert.ok(!MXA.PRICE_KEYS.includes(name) && !(name in INDEX.notInputs), `${e.id}: ${name} is not an allowed input`);
    }
    for (const [name, enc] of Object.entries(model.encoders)) { assert.ok(model.featureNames.includes(name)); for (const v of Object.values(enc)) assert.ok(Number.isFinite(v)); }
    // every string value the data holds for an input has a code (so nothing is silently "missing" on the page)
    for (const [, row] of matrix.rows) for (const name of model.featureNames) { const v = name === 'edge' ? row.edge : row.f[name]; if (typeof v === 'string') assert.ok(model.encoders[name] && v in model.encoders[name], `${e.id}: no code for ${name} = ${v}`); }
    assert.equal(model.trees.length, INDEX.settings.trees);
    model.trees.forEach((t, i) => assert.ok(checkNode(t, model.featureNames.length, 1, `${e.id} tree ${i} `) <= INDEX.settings.lightgbm.num_leaves));
    // parity: the stored predictions of the training library, reproduced by the page's scorer
    assert.equal(pred.model, e.id); assert.ok(pred.rows.length >= 100 && pred.rows.length <= 300);
    const c = compare(model, pred, matrix);
    assert.ok(c.maxRaw < TOLERANCE && c.maxP < TOLERANCE, `${e.id}: MXA.score differs from the training library by ${c.maxP} (row ${c.worst})`);
    assert.ok(c.maxExact < 1e-9, `${e.id}: the unrounded tree sum differs by ${c.maxExact}`);
    assert.ok(new Set(pred.rows.map((r) => r.p.toFixed(4))).size > 20, 'the sample is not one constant');
    // a missing value takes the node's default side and an unknown category counts as missing
    const some = matrix.rows.get(pred.rows[0].id), f = featuresFor(some), holes = { ...f }; for (const k of model.featureNames.slice(0, 30)) holes[k] = null;
    assert.ok(Math.abs(MXA.score(model, holes).raw - rawExact(model, holes)) < 1e-6);
    assert.equal(MXA.score(model, { ...f, session: 'mars' }).p, MXA.score(model, { ...f, session: null }).p);
    // decide() does not use it: not promoted
    const d = MXA.decide({ v: 1, edge: e.edge || 'gmp', market: 'xau', t: T0, cand: null, bars: {} }, { model });
    assert.equal(d.modelScore, null); assert.equal(d.modelVersion, null);
  }
});

test('the registry bodies in the index are accepted by the API as challengers; promotion needs the owner\'s confirm', async () => {
  for (const e of INDEX.models) {
    const b = e.register; assert.equal(b.action, 'model.register'); assert.equal(b.model.status, 'challenger'); assert.equal(b.model.version, e.id); assert.equal(b.model.hash, e.hash);
    if (!e.beatsBaseline) assert.match(b.model.notes, /^REJECTED CHALLENGER/);
    const r = await api('POST', b); assert.equal(r.code, 200, JSON.stringify(r.body)); assert.equal(r.body.model.status, 'challenger');
    assert.equal((await api('POST', { action: 'model.promote', id: r.body.model.id })).code, 400, 'no promotion without confirm: true');
  }
  const reg = (await api('GET', { get: 'models' })).body; assert.equal(reg.championId, null, 'registering promotes nothing'); assert.equal(reg.models.length, INDEX.models.length);
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
    .concat(fs.readdirSync(path.join(ROOT, 'ml')).filter((f) => /\.(py|mjs|md|txt)$/.test(f)).map((f) => 'ml/' + f), ['ml/models/report.md']);
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
  const py = read('ml/train.py'); assert.ok(!/\bKFold\b|shuffle\s*=\s*True|train_test_split|StratifiedKFold/.test(py.replace(/"""[\s\S]*?"""/, '')));
  assert.match(py, /"promoted": False/); assert.ok(!/"promoted": True|promoted\s*=\s*True/.test(py));
});
