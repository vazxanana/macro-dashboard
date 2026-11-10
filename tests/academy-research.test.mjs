// node --test tests/academy-research.test.mjs — the Academy research engine:
//   academy/gen/research.mjs + academy/data/research.json   baselines, pre-registered condition studies, regime, book and
//                                                           policy studies, and draft lessons, all as notebook entries
// Offline and fast: committed data only (the feature matrix, eval.json, meta.json). No candles, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { EDGES } from '../academy/edges.mjs';
import * as RS from '../academy/gen/research.mjs';

const require = createRequire(import.meta.url);
const MXA = require('../assets/academy-core.js');
const { handle } = require('../api/academy.js');
const ST = require('../api/_academy-store.js');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const json = (f) => JSON.parse(read(f));
const MINE = ['academy/gen/research.mjs', 'tests/academy-research.test.mjs', 'docs/academy/RESEARCH.md'];
const TEXT = read('academy/data/research.json'), R = JSON.parse(TEXT), EV = json('academy/data/eval.json'), META = json('academy/data/meta.json');
const byId = Object.fromEntries(R.studies.map((s) => [s.id, s]));
const conditions = R.studies.filter((s) => s.kind === 'condition'), testedStudies = conditions.filter((s) => s.table.tested);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b}`);

async function api(method, payload, store) {
  const out = {}, res = { setHeader() {}, status(c) { out.code = c; return res; }, json(b) { out.body = b; return out; } };
  let clock = Date.UTC(2026, 10, 10, 12);
  await handle(method === 'GET' ? { method, headers: {}, query: payload } : { method, headers: {}, body: payload }, res, { env: {}, store, who: async () => ({ u: 'owner' }), sameOrigin: () => true, data: undefined, now: () => (clock += 1000) });
  return out;
}

// ---- the file -----------------------------------------------------------------------------------------------------------
test('research.json regenerates byte-identical from the committed data, and stays small', () => {
  assert.equal(RS.generate(), TEXT, 'run node academy/gen/research.mjs and commit the result');
  assert.equal(RS.generate(), RS.generate(), 'two runs give the same bytes');
  assert.ok(Buffer.byteLength(TEXT) < 500e3, 'under 500 kB');
  assert.deepEqual(Object.keys(R), ['version', 'generated', 'recipe', 'dataVersions', 'what', 'preregistration', 'pool', 'counts', 'summary', 'proposedLessonsNote', 'studies', 'proposedLessons']);
  assert.equal(R.generated, META.generated, 'the date stamp of the candidate run, not the clock');
  const m = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'ml/data/matrix.json.gz'))).toString('utf8'));
  assert.equal(R.dataVersions.matrix, m.version); assert.equal(R.dataVersions.eval, EV.version); assert.equal(R.dataVersions.candles, EV.dataVersion);
  assert.equal(R.dataVersions.policy, MXA.POLICY_VERSION); assert.equal(R.dataVersions.core, MXA.VERSION);
  assert.equal(R.dataVersions.code, crypto.createHash('sha256').update(read('academy/gen/research.mjs')).digest('hex').slice(0, 12), 'the code hash is the hash of the generator');
  for (const s of R.studies) assert.ok(s.reproducibility.includes('node academy/gen/research.mjs') && s.reproducibility.includes(R.dataVersions.code) && s.reproducibility.includes(R.dataVersions.matrix) && s.reproducibility.includes(R.dataVersions.eval), s.id);
});

test('the exam pool is never read: scrambling every exam row gives the same bytes; a changed train result does not', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-research-'));
  try {
    const src = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'ml/data/matrix.json.gz'))).toString('utf8')), L = Object.fromEntries(src.labelKeys.map((k, i) => [k, i])), F = src.labelKeys.length;
    const write = (name, rows) => { const f = path.join(dir, name); fs.writeFileSync(f, zlib.gzipSync(Buffer.from(JSON.stringify({ ...src, rows })))); return f; };
    // every outcome column and every feature of every exam row replaced with wild values (some unfilled orders become winners)
    let exam = 0;
    const scrambled = src.rows.map((r, i) => {
      if (r[L.pool] !== 'exam') return r;
      exam++; const x = r.slice();
      x[L.filled] = i % 3 !== 0; x[L.reason] = i % 2 ? 'target' : 'missed'; x[L.R] = 50 - (i % 7) * 30; x[L.netR] = 999 - (i % 5) * 700; x[L.win] = i % 2; x[L.exitT] = r[L.t] + 1 + (i % 9) * 86400 * 40;
      x[L.clockShift] = i % 2 === 0; x[L.pre2020] = i % 4 === 0;
      x[F] = r[F].map((v, j) => (typeof v === 'number' ? v * -3 + j : typeof v === 'string' ? 'zz' : typeof v === 'boolean' ? !v : 7));
      return x;
    });
    assert.ok(exam > 700, 'the matrix holds the exam rows');
    assert.equal(RS.generate({ matrixFile: write('exam.json.gz', scrambled) }), TEXT, 'exam outcomes and features do not reach the output');
    // the control: the same generator does notice a train result (and refuses, because eval.json no longer agrees)
    const iTrain = src.rows.findIndex((r) => r[L.pool] === 'train' && !r[L.clockShift] && !r[L.pre2020] && r[L.filled]);
    const moved = src.rows.map((r, i) => { if (i !== iTrain) return r; const x = r.slice(); x[L.netR] = r[L.netR] + 25; return x; });
    assert.throws(() => RS.generate({ matrixFile: write('train.json.gz', moved) }), /eval\.json/);
    // loadTrain keeps train rows only and counts the exam rows without their numbers
    const d = RS.loadTrain(write('exam2.json.gz', scrambled)), d0 = RS.loadTrain();
    assert.equal(d.rowsHash, d0.rowsHash); assert.deepEqual(d.counts, d0.counts);
    assert.equal(d.orders.length, src.rows.filter((r) => r[L.pool] === 'train' && !r[L.clockShift] && !r[L.pre2020]).length);
    assert.equal(Object.values(d.counts).reduce((s, c) => s + c.exam, 0), exam);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  const code = read('academy/gen/research.mjs');
  assert.ok(!/(out|cand|feat)-\$\{|academy\/data\/(out|cand|feat)-|readdirSync/.test(code), 'the generator opens no outcome or candidate file');
  assert.deepEqual([...new Set(code.match(/readFileSync\(([^)]*)\)/g))].sort(), ['readFileSync(SELF, \'utf8\')', 'readFileSync(evalFile, \'utf8\')', 'readFileSync(matrixFile)', 'readFileSync(metaFile, \'utf8\')'].sort(), 'it reads the matrix, eval.json, meta.json and its own source, nothing else');
});

// ---- 1. baselines -------------------------------------------------------------------------------------------------------
test('baselines equal the mechanical numbers of eval.json, for every edge and for the book', () => {
  const pick = (b) => ({ n: b.n, avg: b.avg, total: b.total, t: b.t, win: b.win });
  for (const [id, ev] of [...EDGES.map((e) => [e.id, EV.edges[e.id]]), ['book', EV.overall]]) {
    const s = byId['base:' + id]; assert.ok(s, 'base:' + id); const b = s.table;
    assert.deepEqual(pick(b), ev.mechanical, id);
    assert.equal(b.split.cut, ev.split.cut, id + ' cut');
    assert.deepEqual(b.split.first70, ev.split.first70.mechanical, id + ' first 70 %');
    assert.deepEqual(b.split.last30, ev.split.last30.mechanical, id + ' last 30 %');
    assert.equal(b.orders, ev.orders); assert.equal(b.unfilled, ev.unfilled); assert.equal(b.from, ev.from); assert.equal(b.to, ev.to);
    assert.equal(s.sampleSize, b.n); assert.equal(s.validation, 'in-sample'); assert.equal(s.edge, id === 'book' ? null : id);
    assert.equal(b.byYear.reduce((n, y) => n + y.n, 0), b.n, id + ' years add up');
    near(b.byYear.reduce((n, y) => n + y.total, 0), b.total, 0.05, id + ' year totals');
    assert.ok(b.byYear.every((y) => y.year >= 2020), id + ' nothing before 2020');
    assert.ok(b.maxDrawdownR >= 0 && (b.profitFactor === null || b.profitFactor > 0));
    assert.ok(s.results.includes(`t ${b.t}`) && s.results.includes(`${b.n} trades`), 'n and t are in the sentence');
  }
  assert.equal(R.pool.trades, EV.overall.mechanical.n);
  for (const e of EDGES) { const c = R.pool.perEdge[e.id]; assert.equal(c.exam, EV.edges[e.id].excluded.exam); assert.equal(c.flaggedTrain, EV.edges[e.id].excluded.flaggedTrain); assert.equal(c.trades, EV.edges[e.id].mechanical.n); assert.equal(c.candidates, META.edges[e.id].candidates); }
});

test('baselines against the candidate and outcome files (train setups only), recomputed here', () => {
  for (const e of EDGES) {
    const cands = json(`academy/data/cand-${e.id}.json`), outs = json(`academy/data/out-${e.id}.json`), b = byId['base:' + e.id].table;
    const tr = cands.filter((c) => c.pool === 'train' && !(c.rule.clockShift || c.rule.pre2020)).map((c) => ({ ...outs[c.id], id: c.id })).filter((o) => !['missed', 'expired', 'cancelled'].includes(o.reason));
    assert.equal(tr.length, b.n, e.id);
    near(tr.reduce((s, o) => s + o.netR, 0), b.total, 0.006, e.id + ' total');
    const up = tr.filter((o) => o.netR > 0).reduce((s, o) => s + o.netR, 0), dn = -tr.filter((o) => o.netR < 0).reduce((s, o) => s + o.netR, 0);
    near(up / dn, b.profitFactor, 0.006, e.id + ' profit factor');
    let eq = 0, peak = 0, dd = 0; for (const o of tr.sort((x, y) => x.exitT - y.exitT || (x.id < y.id ? -1 : 1))) { eq += o.netR; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); }
    near(dd, b.maxDrawdownR, 0.006, e.id + ' drawdown');
  }
});

// ---- statistics ---------------------------------------------------------------------------------------------------------
test('Benjamini-Hochberg against a hand-worked example', () => {
  // ten p-values. Limits at 10 %: 0.01, 0.02 … 0.10. Ranks 5 and 6 sit at or under their limit (0.042 <= 0.05, 0.060 <= 0.06),
  // rank 7 does not (0.074 > 0.07): six pass, including ranks 3 and 4, which are over their own limits (the step-up rule).
  const p = [0.205, 0.039, 0.001, 0.074, 0.212, 0.042, 0.008, 0.216, 0.041, 0.060];
  const a = RS.benjaminiHochberg(p, 0.10);
  assert.equal(a.k, 6); near(a.threshold, 0.06, 1e-12);
  assert.deepEqual(a.pass, [false, true, true, false, false, true, true, false, true, true]);
  // at 5 % the limits are 0.005, 0.010, 0.015 …: only 0.001 and 0.008 pass
  const b = RS.benjaminiHochberg(p, 0.05); assert.equal(b.k, 2); assert.deepEqual(b.pass, [false, false, true, false, false, false, true, false, false, false]);
  // adjusted p = min over the larger ranks of p * m / rank:  0.001*10/1 = 0.01, 0.008*10/2 = 0.04, 0.039*10/3 = 0.13 -> min(0.13, 0.1025, 0.084) = 0.084 …
  const want = [0.216, 0.084, 0.01, 0.74 / 7, 0.216, 0.084, 0.04, 0.216, 0.084, 0.1];
  a.adjusted.forEach((x, i) => near(x, want[i], 1e-12, 'adjusted ' + i));
  assert.deepEqual(RS.benjaminiHochberg([], 0.1), { m: 0, k: 0, pass: [], adjusted: [], threshold: 0 });
  assert.deepEqual(RS.benjaminiHochberg([0.5, 0.9], 0.1).pass, [false, false]);
  assert.deepEqual(RS.benjaminiHochberg([0.04, 0.04], 0.1).pass, [true, true], 'ties pass together');
});

test('Student t, Welch, drawdown, profit factor and correlation against known values', () => {
  near(RS.tTwoSided(2, 10), 0.073388, 1e-5); near(RS.tTwoSided(2.228, 10), 0.05, 1e-4); near(RS.tTwoSided(1.96, 1e6), 0.05, 1e-4); near(RS.tTwoSided(12.706, 1), 0.05, 1e-4);
  near(RS.tTwoSided(-2, 10), RS.tTwoSided(2, 10), 1e-12); assert.equal(RS.tTwoSided(0, 5), 1); assert.equal(RS.tTwoSided(null, 5), null);
  // a = 1 2 3 4 5 (mean 3, variance 2.5), b = 2 4 6 8 (mean 5, variance 20/3): se = sqrt(0.5 + 5/3), t = -2 / 1.47196 = -1.35873
  const w = RS.welch([1, 2, 3, 4, 5], [2, 4, 6, 8]);
  near(w.diff, -2, 1e-12); near(w.t, -1.358732, 1e-5); near(w.df, (0.5 + 5 / 3) ** 2 / (0.25 / 4 + (25 / 9) / 3), 1e-9); assert.ok(w.p > 0.2 && w.p < 0.3);
  assert.equal(RS.welch([1], [1, 2]).t, null); assert.equal(RS.welch([1, 1], [2, 2]).t, null, 'no spread, no t');
  const s = RS.stat([1, -1, 2, -1, 3]); assert.equal(s.n, 5); near(s.avg, 0.8, 1e-12); near(s.total, 4, 1e-12); near(s.win, 0.6, 1e-12); near(s.t, 0.8 / Math.sqrt(3.2 / 5), 1e-12);
  assert.equal(RS.maxDrawdown([1, -2, -1, 4, -1]), 3); assert.equal(RS.maxDrawdown([-1, -1]), 2, 'the curve starts at zero'); assert.equal(RS.maxDrawdown([1, 2]), 0);
  near(RS.profitFactor([2, -1, 3, -1]), 2.5, 1e-12); assert.equal(RS.profitFactor([1, 2]), null);
  near(RS.pearson([1, 2, 3, 4], [2, 4, 6, 8]).r, 1, 1e-12); near(RS.pearson([1, 2, 3, 4], [1, 3, 2, 4]).r, 0.8, 1e-12); assert.equal(RS.pearson([1, 1, 1], [1, 2, 3]).r, null);
});

// ---- 2. the pre-registration and the condition studies ----------------------------------------------------------------------
test('the pre-registration is written before the code and the file carries it unchanged', () => {
  const code = read('academy/gen/research.mjs'), end = code.lastIndexOf('END OF PRE-REGISTRATION');
  assert.ok(end > 0 && code.indexOf('PRE-REGISTRATION.') < end);
  for (const name of ['SPLIT', 'MIN_N', 'T_PASS', 'FDR', 'TERCILE', 'FAMILIES', 'PASS_RULE', 'LESSON_RULE', 'AMENDMENTS']) { const i = code.indexOf(`export const ${name} =`); assert.ok(i > 0 && i < end, `${name} is inside the pre-registration block`); }
  for (const fn of ['function loadTrain', 'function build', 'function classify', 'function partOf']) assert.ok(code.indexOf(fn) > end, fn + ' comes after it');
  assert.match(code.slice(0, end), /written BEFORE any condition result was\s*\n?\/\/ computed/);
  const P = R.preregistration;
  assert.equal(P.minN, RS.MIN_N); assert.equal(P.fdr, RS.FDR); assert.equal(P.tPass, RS.T_PASS); assert.equal(P.split.discovery, RS.SPLIT);
  assert.deepEqual([P.minN, P.fdr, P.tPass, P.split.discovery], [20, 0.1, 2, 0.7], 'the registered constants');
  assert.deepEqual(P.passRule, RS.PASS_RULE); assert.deepEqual(P.lessonRule, RS.LESSON_RULE); assert.deepEqual(P.amendments, RS.AMENDMENTS);
  assert.deepEqual(P.families, RS.FAMILIES.map((f) => ({ id: f.id, title: f.title, keys: f.keys.map((k) => k.f) })));
  const keys = P.buckets.keys.map((k) => k.key);
  assert.equal(new Set(keys).size, keys.length); assert.ok(keys.length >= 15 && keys.length <= 25, 'about 15 to 25 keys');
  assert.equal(P.buckets.keys.reduce((n, k) => n + k.buckets.length, 0), RS.BUCKETS_PER_EDGE); assert.equal(P.buckets.perEdge, RS.BUCKETS_PER_EDGE);
});

test('no look-ahead: every condition is built from feature keys known at the signal time, never from an outcome', () => {
  const m = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'ml/data/matrix.json.gz'))).toString('utf8'));
  const outcome = ['filled', 'reason', 'R', 'netR', 'win', 'exitT', 'exit', 'mfeR', 'maeR', 'unitR', 'fillT'];
  const whens = [...testedStudies.map((s) => s.table.when), ...R.proposedLessons.map((l) => l.when), ...RS.bucketsFor(RS.loadTrain().orders.filter((o) => o.filled)).map((b) => b.when)];
  for (const when of whens) for (const c of when) {
    assert.ok(Object.prototype.hasOwnProperty.call(MXA.FEATURE_DOC, c.f) && m.featureKeys.includes(c.f), c.f + ' is a feature key');
    assert.ok(!m.labelKeys.includes(c.f) && !outcome.includes(c.f), c.f + ' is not a label');
    assert.ok(!MXA.PRICE_KEYS.includes(c.f), c.f + ' is not a raw price');
    assert.ok(MXA.lessons.OPS.includes(c.op));
  }
  for (const k of R.preregistration.buckets.keys) assert.ok(m.featureKeys.includes(k.key) && !MXA.PRICE_KEYS.includes(k.key), k.key);
  // numeric cuts come from the discovery trades alone: confirmation trades with wild values change no cut
  const mk = (i, v) => ({ id: 't' + i, t: i, netR: 0, f: Object.fromEntries(Object.keys(MXA.FEATURE_DOC).map((k) => [k, v])) });
  const disc = Array.from({ length: 9 }, (_, i) => mk(i, i + 1)), sp = RS.splitOf([...disc, ...Array.from({ length: 4 }, (_, i) => mk(100 + i, 1e6))]);
  assert.equal(sp.discovery.length, 9); assert.equal(sp.confirmation.length, 4);
  const cuts = RS.bucketsFor(sp.discovery).filter((b) => 'cut' in b);
  assert.equal(cuts.length, 12); for (const b of cuts) assert.equal(b.cut, b.label === 'low' ? 3 : 7, `${b.f} ${b.label}: the top of the lowest third and the bottom of the highest third of 1..9`);
  assert.deepEqual(RS.bucketsFor(sp.discovery), RS.bucketsFor(disc));
  // an unknown key is in neither side; membership is the lesson matcher
  const b = { f: 'regime', when: [{ f: 'regime', op: 'eq', v: 'trending' }] };
  const p = RS.partOf([{ t: 1, netR: 1, f: { regime: 'trending' } }, { t: 2, netR: 3, f: { regime: 'trending' } }, { t: 3, netR: -1, f: { regime: 'ranging' } }, { t: 4, netR: -2, f: { regime: 'ranging' } }, { t: 5, netR: 9, f: { regime: null } }], b);
  assert.equal(p.nIn, 2); assert.equal(p.nOut, 2); assert.equal(p.unknown, 1); assert.equal(p.rIn, 2); assert.equal(p.rOut, -1.5); assert.equal(p.diff, 3.5);
});

test('the pass rule, branch by branch', () => {
  const part = (diff, t, n = 30) => ({ nIn: n, nOut: n, diff, t });
  assert.equal(RS.classify(part(0.5, 2.5, 19), part(0.5, 2.5), true).validation, 'inconclusive');
  assert.equal(RS.classify(part(0.5, 2.5), part(0.5, 2.5, 19), true).reason, 'too few trades');
  assert.equal(RS.classify(part(0.5, 1.99), part(0.9, 5), true).validation, 'inconclusive', 'no discovery, no finding, whatever the confirmation shows');
  assert.equal(RS.classify(part(0.5, 2.5), part(-0.1, -0.3), true).validation, 'rejected');
  assert.equal(RS.classify(part(-0.5, -2.5), part(0.4, 2.2), false).validation, 'rejected');
  assert.equal(RS.classify(part(0.5, 2.5), part(0.2, 1.9), true).validation, 'in-sample');
  assert.equal(RS.classify(part(0.5, 2.5), part(0.4, 2.0), false).validation, 'out-of-sample');
  assert.equal(RS.classify(part(-0.5, -2.5), part(-0.4, -2.1), false).validation, 'out-of-sample');
  assert.equal(RS.classify(part(0.5, 2.5), part(0.4, 2.0), true).validation, 'validated');
  assert.equal(RS.classify(part(0.5, null), part(0.4, 2.0), true).validation, 'inconclusive');
  assert.equal(RS.classify(null, null, true).validation, 'inconclusive');
});

test('every study is a notebook entry the API accepts, with a legal validation value', async () => {
  const fields = ['id', 'kind', 'edge', 'title', 'hypothesis', 'dataset', 'sampleSize', 'method', 'results', 'table', 'limitations', 'validation', 'reproducibility', 'tags'];
  const legal = ['hypothesis', 'in-sample', 'out-of-sample', 'validated', 'rejected', 'inconclusive'], max = { title: 160, hypothesis: 4000, dataset: 2000, method: 4000, results: 6000, limitations: 4000, reproducibility: 2000 };
  assert.deepEqual(RS.VALIDATION, legal);
  assert.equal(new Set(R.studies.map((s) => s.id)).size, R.studies.length, 'ids are unique');
  for (const s of R.studies) {
    assert.deepEqual(Object.keys(s), fields, s.id);
    assert.ok(legal.includes(s.validation), s.id);
    for (const [k, n] of Object.entries(max)) assert.ok(typeof s[k] === 'string' && s[k].length > 0 && s[k].length <= n, `${s.id}.${k}`);
    assert.ok(Number.isInteger(s.sampleSize) && s.sampleSize > 0, s.id + ' has an n');
    assert.ok(s.edge === null || EDGES.some((e) => e.id === s.edge), s.id);
    assert.ok(Array.isArray(s.tags) && s.tags.length <= 12 && s.tags.every((t) => typeof t === 'string' && t.length <= 40) && new Set(s.tags).size === s.tags.length, s.id + ' tags');
    assert.ok(s.table && typeof s.table === 'object');
    assert.ok(/^[A-Za-z0-9][A-Za-z0-9._:|@+-]{0,119}$/.test(s.id), s.id);
    assert.ok(!/\bproven\b|\bis an edge\b|\ba real edge\b|\bedge found\b/i.test(s.results + s.title + s.hypothesis), s.id + ': never calls anything an edge');
  }
  // the real notebook.add route takes every one of them and keeps the text as it is
  const store = ST.memoryStore();
  for (const s of R.studies) {
    const { id, kind, table, ...note } = s, r = await api('POST', { action: 'notebook.add', note }, store);
    assert.equal(r.code, 200, `${s.id}: ${JSON.stringify(r.body).slice(0, 200)}`);
    for (const k of ['title', 'hypothesis', 'dataset', 'method', 'results', 'limitations', 'reproducibility', 'validation', 'sampleSize', 'edge']) assert.equal(r.body.note[k], s[k], `${s.id}.${k}`);
    assert.deepEqual(r.body.note.tags, s.tags);
  }
  assert.equal((await api('GET', { get: 'notebook' }, store)).body.notes.length, R.studies.length);
});

test('nothing is out-of-sample or validated without n and t in the confirmation part, and every verdict follows the rule', () => {
  const m = R.counts.tests;
  assert.equal(testedStudies.length, m);
  for (const s of testedStudies) {
    const T = s.table, d = T.discovery, c = T.confirmation;
    assert.ok(Math.min(d.nIn, d.nOut, c.nIn, c.nOut) >= RS.MIN_N, s.id + ' has the minimum n in all four cells');
    for (const p of [d, c]) { for (const k of ['rIn', 'rOut', 'diff', 't', 'df', 'p']) assert.ok(Number.isFinite(p[k]), `${s.id}.${k}`); near(p.diff, p.rIn - p.rOut, 0.0011, s.id + ' diff'); assert.ok(p.p >= 0 && p.p <= 1); }
    assert.equal(s.sampleSize, d.nIn + d.nOut + c.nIn + c.nOut);
    assert.ok(T.q >= d.p - 1e-5 && T.q <= 1, s.id + ' the adjusted p is never under the raw p');
    assert.equal(T.testsInRun, m);
    if (s.validation === 'out-of-sample' || s.validation === 'validated') {
      assert.ok(Math.abs(d.t) >= 2 && Math.abs(c.t) >= 2, s.id + ' t >= 2 in both parts');
      assert.ok(d.diff * c.diff > 0, s.id + ' same sign');
      assert.equal(T.fdrPass, s.validation === 'validated', s.id + ' validated means it survived the correction');
    }
    if (s.validation === 'validated') assert.ok(T.q <= RS.FDR + 1e-9);
    if (s.validation === 'rejected') assert.ok(Math.abs(d.t) >= 2 && d.diff * c.diff <= 0, s.id);
    if (s.validation === 'in-sample') assert.ok(Math.abs(d.t) >= 2 && d.diff * c.diff > 0, s.id);
    // away from the rounding edge of t = 2 the stored numbers reproduce the verdict
    if (Math.abs(Math.abs(d.t) - 2) > 0.006 && Math.abs(Math.abs(c.t) - 2) > 0.006) assert.equal(RS.classify(d, c, T.fdrPass).validation, s.validation, s.id);
    for (const part of ['Discovery', 'Confirmation']) assert.ok(s.results.includes(part + ':'), s.id);
    assert.ok(s.results.includes(`t ${d.t})`) && s.results.includes(`t ${c.t})`) && s.results.includes(`${c.nIn} trades in the bucket`), s.id + ': n and t are in the sentence');
  }
  // the correction, redone here from the stored discovery p-values (to the stored rounding)
  const bh = RS.benjaminiHochberg(testedStudies.map((s) => s.table.discovery.p), RS.FDR);
  testedStudies.forEach((s, i) => { near(bh.adjusted[i], s.table.q, 2e-3, s.id + ' q'); if (Math.abs(s.table.q - RS.FDR) > 0.005) assert.equal(bh.pass[i], s.table.fdrPass, s.id); });
  // untested conditions: one entry an edge, counts only, no averages to misread
  for (const s of conditions.filter((x) => !x.table.tested)) {
    assert.equal(s.validation, 'inconclusive'); assert.match(s.results, /^Inconclusive: too few trades\./); assert.equal(s.table.rows.length, s.table.covers);
    for (const r of s.table.rows) assert.ok(Math.min(...r.slice(2)) < RS.MIN_N, `${s.id} ${r[0]} ${r[1]} was rightly not tested`);
  }
});

test('the condition studies recomputed from the matrix: same buckets, counts, means and t', () => {
  const data = RS.loadTrain();
  for (const e of EDGES) {
    const tr = data.orders.filter((o) => o.edge === e.id && o.filled).sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1)), nD = Math.floor(0.7 * tr.length), D = tr.slice(0, nD), C = tr.slice(nD);
    assert.ok(D[D.length - 1].t <= C[0].t, e.id + ': discovery ends before confirmation begins');
    assert.equal(RS.eligible(tr), C.length >= 40);
    const mine = testedStudies.filter((s) => s.edge === e.id), un = byId[`cond:${e.id}:untested`];
    assert.equal(mine.length + (un ? un.table.covers : 0), RS.BUCKETS_PER_EDGE, e.id + ': every registered bucket is accounted for');
    if (!RS.eligible(tr)) assert.equal(mine.length, 0, e.id + ' is too small for any test');
    for (const s of mine) {
      const T = s.table, w = T.when[0], inB = (o) => (w.op === 'eq' ? o.f[w.f] === w.v : w.op === 'lte' ? o.f[w.f] <= w.v : o.f[w.f] >= w.v), known = (o) => o.f[w.f] !== null;
      for (const [part, rows] of [[T.discovery, D], [T.confirmation, C]]) {
        const a = rows.filter((o) => known(o) && inB(o)).map((o) => o.netR), b = rows.filter((o) => known(o) && !inB(o)).map((o) => o.netR), mean = (x) => x.reduce((q, y) => q + y, 0) / x.length;
        assert.equal(part.nIn, a.length, s.id); assert.equal(part.nOut, b.length, s.id);
        near(part.rIn, mean(a), 0.00051, s.id); near(part.rOut, mean(b), 0.00051, s.id); near(part.t, RS.welch(a, b).t, 0.0051, s.id);
      }
      if (w.op !== 'eq' || typeof w.v === 'number') { const v = D.map((o) => o.f[w.f]).filter((x) => x !== null).sort((x, y) => x - y); if (w.op !== 'eq' && w.f !== 'oppLiq') assert.ok(v.includes(w.v), s.id + ': the cut is a value seen in discovery'); }
    }
  }
});

test('the counts add up, and the file says plainly how much chance alone would give', () => {
  const c = R.counts, cc = c.conditions;
  assert.equal(c.studies, R.studies.length);
  assert.equal(cc.registered, EDGES.length * RS.BUCKETS_PER_EDGE); assert.equal(cc.tested, c.tests); assert.equal(cc.tested + cc.tooFewTrades, cc.registered);
  assert.equal(Object.values(cc.byValidation).reduce((a, b) => a + b, 0), cc.registered);
  assert.equal(Object.values(c.byValidation).reduce((a, b) => a + b, 0), c.studies);
  for (const v of RS.VALIDATION) {
    assert.equal(c.byValidation[v], R.studies.filter((s) => s.validation === v).length, v);
    assert.equal(cc.byValidation[v], testedStudies.filter((s) => s.validation === v).length + (v === 'inconclusive' ? cc.tooFewTrades : 0), 'conditions ' + v);
  }
  assert.equal(cc.passedDiscovery, testedStudies.filter((s) => Math.abs(s.table.discovery.t) >= 2).length);
  assert.equal(cc.survivedCorrection, testedStudies.filter((s) => s.table.fdrPass).length);
  assert.deepEqual([...cc.edgesTested, ...cc.edgesTooSmall].sort(), EDGES.map((e) => e.id).sort());
  // about 4.6 % of tests pass |t| >= 2 by chance (a little more with few degrees of freedom); far fewer also confirm
  const x = c.expectedByChance; assert.ok(x.passDiscovery >= 0.0455 * c.tests - 0.06 && x.passDiscovery <= 0.06 * c.tests, 'expected by chance in discovery');
  assert.ok(x.outOfSample > 0 && x.outOfSample < x.passDiscovery * 0.04); assert.ok(x.note.includes(String(c.tests)));
  assert.equal(c.byValidation.hypothesis, 0);
  assert.ok(R.summary.join(' ').includes(`${c.tests} of ${cc.registered}`));
  if (cc.byValidation.validated === 0) assert.ok(R.summary.some((s) => /Nothing is validated/.test(s)), 'it says so plainly');
});

// ---- 3 to 5. regime, book, policy -----------------------------------------------------------------------------------------
test('regime study: n and t by regime and volatility band, and "unfamiliar" under 20 trades', () => {
  const data = RS.loadTrain();
  for (const e of EDGES) {
    const s = byId['regime:' + e.id], T = s.table, tr = data.orders.filter((o) => o.edge === e.id && o.filled);
    assert.equal(T.unfamiliarBelow, 20); assert.equal(s.validation, 'in-sample');
    assert.equal(T.regime.reduce((n, r) => n + r.n, 0), tr.length, e.id + ': every trade is in one regime');
    assert.equal(T.volState.reduce((n, r) => n + r.n, 0), tr.length, e.id + ': every trade is in one volatility band');
    for (const r of [...T.regime, ...T.volState]) { assert.equal(r.familiar, r.n >= 20); if (!r.familiar) assert.ok(s.results.includes(`${r.value} (${r.n})`), `${e.id}: ${r.value} is named unfamiliar`); else assert.ok(s.results.includes(`${r.value} n ${r.n}`) && Number.isFinite(r.t)); }
    for (const r of T.regime) assert.equal(r.n, tr.filter((o) => o.f.regime === r.value).length);
    assert.match(s.results, /Unfamiliar: /);
  }
});

test('book study: pair correlations only with enough common days, overlap shares and the book drawdown', () => {
  const s = byId['book:seven'], T = s.table;
  assert.equal(T.pairs.length, 21); assert.equal(s.edge, null); assert.equal(s.sampleSize, EV.overall.mechanical.n);
  for (const p of T.pairs) { if (p.commonDays >= RS.MIN_COMMON_DAYS) { assert.ok(p.r >= -1 && p.r <= 1 && p.note === null); } else { assert.equal(p.r, null); assert.equal(p.note, 'too few common days'); } }
  assert.ok(T.days.shareActive > 0 && T.days.shareActive < 1 && T.days.moreThanOneClosing <= T.days.closing);
  near(T.book.totalR, EV.overall.mechanical.total, 0.011);
  assert.ok(T.book.maxDrawdownR > 0 && T.book.maxDrawdownR <= T.book.edgesOwn.reduce((a, d) => a + d.maxDrawdownR, 0));
  for (const d of T.book.edgesOwn) assert.equal(d.maxDrawdownR, byId['base:' + d.edge].table.maxDrawdownR);
  // recomputed: daily net R on the exit day
  const data = RS.loadTrain(), days = new Map(); for (const o of data.orders) if (o.filled) { const k = Math.floor(o.exitT / 86400); days.set(k, (days.get(k) || 0) + o.netR); }
  assert.equal(T.days.closing, days.size); near(T.book.maxDrawdownR, RS.maxDrawdown([...days].sort((a, b) => a[0] - b[0]).map((x) => x[1])), 0.006);
});

test('policy study: eval.json joined as it is, and the wait reasons with n', () => {
  const s = byId['policy:eval'], T = s.table, o = EV.overall;
  assert.equal(T.evalVersion, EV.version); assert.equal(T.policy, EV.policy);
  assert.deepEqual(T.overall.every, o.mechanical); assert.equal(T.overall.take.n, o.take.n); assert.equal(T.overall.wait.total, o.wait.total); assert.equal(T.overall.t, o.diff.t); assert.equal(T.overall.verdict, o.verdict);
  for (const r of T.edges) { const e = EV.edges[r.edge]; assert.deepEqual(r.every, e.mechanical); assert.equal(r.take.avg, e.take.avg); assert.equal(r.wait.n, e.wait.n); assert.equal(r.t, e.diff.t); assert.equal(r.verdict, e.verdict); }
  assert.equal(T.edges.length, 7);
  const data = RS.loadTrain(), tr = data.orders.filter((x) => x.filled);
  for (const r of T.reasons) { assert.ok(Number.isInteger(r.trades) && r.trades > 0 && Number.isInteger(r.policyWaits)); const [f] = r.feature.split(' '); assert.ok(f in MXA.FEATURE_DOC); }
  assert.equal(T.reasons.find((r) => r.reason === 'event').trades, tr.filter((x) => x.f.eventNear === true).length);
  assert.equal(T.reasons.find((r) => r.reason === 'htfBias').trades, tr.filter((x) => x.f.biasAlign === 'against').length);
  assert.equal(T.reasons.find((r) => r.reason === 'event').policyWaits, o.waits.gates.find((g) => g.code === 'event').n);
  assert.ok(s.results.includes(`t ${o.diff.t}`) && s.results.includes(o.verdict) && /n \d+/.test(s.results));
  assert.match(s.method + s.limitations, /proxy/);
});

// ---- 6. draft lessons -----------------------------------------------------------------------------------------------------
test('proposed lessons: only for confirmed conditions, valid for the lesson engine and the API, inactive, with their evidence', async () => {
  const qual = testedStudies.filter((s) => s.validation === 'out-of-sample' || s.validation === 'validated');
  assert.equal(R.proposedLessons.length, qual.length, 'one draft per confirmed condition, none for anything else');
  assert.ok(R.proposedLessonsNote.length > 20); if (!qual.length) assert.match(R.proposedLessonsNote, /^No draft lessons: /);
  const data = RS.loadTrain(), store = ST.memoryStore();
  for (const L of R.proposedLessons) {
    assert.deepEqual(MXA.lessons.validate(L), [], L.id);
    assert.equal(L.active, false); assert.equal(L.version, 1); assert.equal(L.source.kind, 'research');
    const s = byId[L.source.studyId]; assert.ok(s && qual.includes(s), L.id + ' points at a confirmed study'); assert.equal(L.evidence.studyId, s.id); assert.equal(L.edge, s.edge);
    assert.deepEqual(L.when, s.table.when); assert.deepEqual(L.evidence.discovery, s.table.discovery); assert.deepEqual(L.evidence.confirmation, s.table.confirmation); assert.equal(L.evidence.validation, s.validation);
    const d = L.evidence.discovery, c = L.evidence.confirmation;
    for (const p of [d, c]) assert.ok(p.nIn >= 20 && p.nOut >= 20 && Math.abs(p.t) >= 2, L.id + ' carries n and t in both parts');
    assert.equal(L.then.action, d.diff < 0 ? 'WAIT' : 'TAKE');
    assert.ok(L.text.includes(`n ${c.nIn}`) && L.text.includes(`t ${c.t}`) && L.text.includes(`t ${d.t}`) && /not active/.test(L.text) && /exam pool has not seen/.test(L.text), L.id + ' says its evidence');
    if (s.validation !== 'validated') assert.match(L.text, /did not survive the correction/);
    // the lesson fires on exactly the trades the study counted
    const tr = data.orders.filter((o) => o.edge === L.edge && o.filled);
    assert.equal(tr.filter((o) => MXA.lessons.matches(L, o.f)).length, d.nIn + c.nIn, L.id);
    // retrieve() leaves an inactive draft out until the mentor switches it on
    const hit = tr.find((o) => MXA.lessons.matches(L, o.f)); assert.equal(MXA.lessons.retrieve([L], hit.f, L.edge).matched.length, 0); assert.equal(MXA.lessons.retrieve([{ ...L, active: true }], hit.f, L.edge).matched.length, 1);
    // the lesson.save route takes the draft and keeps it inactive
    const r = await api('POST', { action: 'lesson.save', lesson: { edge: L.edge, title: L.title, text: L.text, when: L.when, then: L.then, source: L.source, active: L.active } }, store);
    assert.equal(r.code, 200, JSON.stringify(r.body).slice(0, 300)); assert.equal(r.body.lesson.active, false); assert.deepEqual(r.body.lesson.when, L.when); assert.equal(r.body.lesson.then.action, L.then.action);
  }
  // the draft builder on a made-up confirmed study: a worse bucket that still made money gets a WAIT with the caution
  const part = (rIn, rOut, t) => ({ from: '2020-01-01', to: '2023-01-01', nIn: 40, nOut: 60, rIn, rOut, diff: +(rIn - rOut).toFixed(3), t, df: 80, p: 0.01 });
  const fake = { id: 'cond:gtl:regime:ranging', validation: 'out-of-sample', table: { text: 'the regime is ranging', when: [{ f: 'regime', op: 'eq', v: 'ranging' }], discovery: part(0.1, 0.9, -2.4), confirmation: part(0.05, 0.8, -2.1), q: 0.4, fdrPass: false, testsInRun: 100 } };
  const W = RS.draftLesson(fake, EDGES.find((e) => e.id === 'gtl'), 1794268800);
  assert.deepEqual(MXA.lessons.validate(W), []); assert.equal(W.then.action, 'WAIT'); assert.equal(W.active, false); assert.match(W.text, /Caution: these trades still made money/);
  fake.table.discovery = part(-0.2, -0.9, 2.4); fake.table.confirmation = part(0.3, -0.5, 2.2);
  const T2 = RS.draftLesson(fake, EDGES[0], 1794268800); assert.equal(T2.then.action, 'TAKE'); assert.match(T2.text, /Caution: these trades lost money in one part/);
});

// ---- hygiene --------------------------------------------------------------------------------------------------------------
test('isolation: nothing from the trading bots, no key, no network, no model names, no emojis', () => {
  const names = new RegExp(['clau' + 'de', 'anth' + 'ropic', 'open' + 'ai', 'g' + 'pt-?\\d', 'gem' + 'ini', 'son' + 'net', 'op' + 'us', 'hai' + 'ku', 'lla' + 'ma', 'fab' + 'le'].join('|'), 'i');
  const banned = new RegExp(['coun' + 'cil/', '(^|[^a-z])i' + 'ct/', 'ctra' + 'der', 'mir' + 'ror', 'bro' + 'ker', 'place' + 'Order', 'send' + 'Alerts'].join('|'), 'im');
  const secret = new RegExp(['api[_-]?k' + 'ey', '_TOK' + 'EN', '_SEC' + 'RET', '_K' + 'EY\\b', 'secr' + 'ets\\.', 'process\\.e' + 'nv'].join('|'), 'i');
  const net = new RegExp(['\\bfet' + 'ch\\s*\\(', 'htt' + 'ps?://', 'node:htt' + 'ps?', 'node:n' + 'et', 'child_pro' + 'cess'].join('|'));
  for (const f of [...MINE, 'academy/data/research.json']) {
    const s = read(f);
    assert.ok(!names.test(s), `${f}: a model name`);
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s), `${f}: an emoji`);
    assert.ok(!banned.test(s), `${f}: references the trading bots' code`);
    assert.ok(!secret.test(s), `${f}: a key`);
    assert.ok(!net.test(s), `${f}: a network call`);
  }
  const code = read('academy/gen/research.mjs'), imports = [...code.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['../edges.mjs', 'node:crypto', 'node:fs', 'node:module', 'node:path', 'node:url', 'node:zlib']);
  assert.deepEqual([...code.matchAll(/createRequire\(import\.meta\.url\)\('([^']+)'\)/g)].map((m) => m[1]), ['../../assets/academy-core.js'], 'the only other module is the core (lesson matcher and validator)');
  assert.ok(!/Date\.now\(|new Date\(\)|Math\.random/.test(code), 'no clock and no randomness: the run is deterministic');
  assert.ok(!/writeFileSync\((?!FILES\.out)/.test(code), 'it writes research.json and nothing else');
});

test('the notes describe what the engine does and its limits', () => {
  const doc = read('docs/academy/RESEARCH.md');
  for (const w of ['node academy/gen/research.mjs', 'Pre-registration', 'Benjamini-Hochberg', 'discovery', 'confirmation', 'exam pool', 'HistData', 'How to read a study', 'Limits', 'validated', 'out-of-sample', 'in-sample', 'rejected', 'inconclusive']) assert.ok(doc.includes(w), w);
  const c = R.counts;
  assert.ok(doc.includes(`${c.tests} tests`) || doc.includes(`${c.tests} of ${c.conditions.registered}`), 'the notes carry the run\'s test count');
});
