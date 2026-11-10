// node --test tests/academy-policy.test.mjs — the Academy policy investigation (research/edge/academy-policy/):
//   lib.mjs    the pre-registered split, candidates C1 to C5, the statistics and the acceptance rule
//   run.mjs    the offline analysis -> result.json
//   academy/gen/evaluate.mjs additions: eval.json `drawdown`, academy/data/eval-trades.json
//   academy/data/exam-ledger.json: every read of exam outcomes for a policy evaluation (none so far)
// Offline: committed files only. No candles, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { EDGES } from '../academy/edges.mjs';
import { maxDrawdown, drawdownOf, inExitOrder, tradesText, report } from '../academy/gen/evaluate.mjs';
import * as L from '../research/edge/academy-policy/lib.mjs';
import * as RUN from '../research/edge/academy-policy/run.mjs';

const MXA = createRequire(import.meta.url)('../assets/academy-core.js');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const json = (f) => JSON.parse(read(f));
const DIR = 'research/edge/academy-policy';
const RESULT_TEXT = read(`${DIR}/result.json`), R = JSON.parse(RESULT_TEXT), DEC = json(`${DIR}/decisions.json`), PRE = read(`${DIR}/PREREGISTRATION.md`), REPORT = read(`${DIR}/RESULT.md`);
const EV = json('academy/data/eval.json'), TR = json('academy/data/eval-trades.json'), LEDGER = json('academy/data/exam-ledger.json');
const IDS = EDGES.map((e) => e.id), UNFILLED = ['missed', 'expired', 'cancelled'];
const flagged = (c) => !!(c.rule && (c.rule.clockShift || c.rule.pre2020));
const cands = (id) => json(`academy/data/cand-${id}.json`), outs = (id) => json(`academy/data/out-${id}.json`);
const usable = (id) => cands(id).filter((c) => c.pool === 'train' && !flagged(c)).sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
const examIds = new Set(IDS.flatMap((id) => cands(id).filter((c) => c.pool === 'exam').map((c) => c.id)));
// every key of a JSON value, at any depth
const keysDeep = (v, acc = new Set()) => { if (Array.isArray(v)) v.forEach((x) => keysDeep(x, acc)); else if (v && typeof v === 'object') for (const k of Object.keys(v)) { acc.add(k); keysDeep(v[k], acc); } return acc; };

// ── the split ────────────────────────────────────────────────────────────────────────────────────────────────────
test('split: 60 / 40 by count, cut by time, chronological, disjoint, equal to the pre-registered cut times', () => {
  assert.equal(L.SPLIT, 0.6); assert.deepEqual(L.EDGE_IDS, IDS);
  let disc = 0, val = 0;
  for (const id of IDS) {
    const u = usable(id), s = L.splitOf(u.slice().reverse());   // input order does not matter
    assert.equal(s.k, Math.floor(0.6 * u.length), id); assert.equal(s.cut, u[s.k].t, id);
    assert.equal(s.cut, L.CUTS[id], `${id}: the cut is the one written into the pre-registration`);
    assert.deepEqual([s.discovery.length, s.validation.length], L.PARTS[id], id);
    assert.ok(PRE.includes(String(L.CUTS[id])), `${id}: the pre-registration names the cut time`);
    assert.ok(PRE.includes(new Date(L.CUTS[id] * 1000).toISOString().slice(0, 16).replace('T', ' ')), `${id}: and its UTC text`);
    assert.equal(s.discovery.length + s.validation.length, u.length, `${id}: every usable train setup is in exactly one part`);
    const dIds = new Set(s.discovery.map((c) => c.id)); assert.ok(s.validation.every((c) => !dIds.has(c.id)), `${id}: disjoint`);
    assert.ok(Math.max(...s.discovery.map((c) => c.t)) < Math.min(...s.validation.map((c) => c.t)), `${id}: every discovery setup is earlier than every validation setup`);
    assert.ok(s.discovery.every((c) => c.t < s.cut && L.partOf(id, c.t) === 'discovery') && s.validation.every((c) => c.t >= s.cut && L.partOf(id, c.t) === 'validation'), id);
    for (const c of s.discovery.concat(s.validation)) { assert.equal(c.pool, 'train'); assert.ok(!flagged(c)); assert.ok(!examIds.has(c.id), `${c.id}: an exam setup in a split`); }
    assert.deepEqual({ cut: R.splits[id].cut, d: R.splits[id].discoverySetups, v: R.splits[id].validationSetups }, { cut: s.cut, d: s.discovery.length, v: s.validation.length }, `${id}: result.json reports the same split`);
    disc += s.discovery.length; val += s.validation.length;
  }
  assert.deepEqual([disc, val], [903, 609]);
});

// ── the exam pool is never in anything this study wrote ──────────────────────────────────────────────────────────────
test('exam setups never appear in decisions.json, eval-trades.json or result.json; no outcome key in the two per-setup files', () => {
  assert.ok(examIds.size > 600);
  for (const id of IDS) {
    const u = usable(id).map((c) => c.id);
    assert.deepEqual(DEC.edges[id].map((r) => r.id), u, `${id}: decisions.json lists exactly the usable train setups, in time order`);
    assert.deepEqual(TR.edges[id].map((r) => r.id), u, `${id}: eval-trades.json too`);
    for (const r of DEC.edges[id].concat(TR.edges[id])) assert.ok(!examIds.has(r.id), `${r.id} is an exam setup`);
    for (const r of TR.edges[id]) { assert.deepEqual(Object.keys(r), ['id', 't', 'action'], 'three keys a row, nothing else'); assert.ok(['BUY', 'SELL', 'WAIT'].includes(r.action)); }
    assert.deepEqual(TR.edges[id].map((r) => r.t), usable(id).map((c) => c.t));
  }
  const outcomeKeys = Object.keys(Object.values(outs('replica'))[0]).filter((k) => k !== 'id').concat(L.OUTCOME_KEYS);   // an outcome row repeats the candidate id; that one is not a result
  for (const k of ['R', 'netR', 'exitT', 'exit', 'reason', 'mfeR', 'maeR']) assert.ok(outcomeKeys.includes(k) && L.OUTCOME_KEYS.includes(k), k);
  for (const [name, doc] of [['eval-trades.json', TR], ['decisions.json', DEC]]) { const ks = keysDeep(doc); for (const k of new Set(outcomeKeys)) assert.ok(!ks.has(k), `${name} carries the outcome key ${k}`); }
  assert.deepEqual(Object.keys(TR), ['version', 'generated', 'policy', 'dataVersion', 'what', 'edges']);
  for (const id of examIds) { assert.ok(!RESULT_TEXT.includes(id), `result.json names the exam setup ${id}`); assert.ok(!REPORT.includes(id)); }
});

test('eval-trades.json is the policy of eval.json: same version hash, same counts, written as one setup a line', () => {
  assert.equal(TR.policy, MXA.POLICY_VERSION); assert.equal(TR.policy, EV.policy); assert.equal(TR.generated, EV.generated); assert.equal(TR.dataVersion, EV.dataVersion);
  const h = crypto.createHash('sha256'); for (const id of IDS) for (const r of TR.edges[id]) h.update(`${r.id}:${r.action}\n`);
  assert.equal(h.digest('hex').slice(0, 12), EV.version, 'the actions hash to eval.json\'s version'); assert.equal(TR.version, EV.version);
  for (const id of IDS) { assert.equal(TR.edges[id].length, EV.edges[id].orders); assert.equal(TR.edges[id].filter((r) => r.action !== 'WAIT').length, EV.edges[id].take.orders, id); }
  assert.equal(read('academy/data/eval-trades.json'), tradesText(TR), 'the committed text is what the writer produces');
  assert.equal(JSON.parse(tradesText({ a: 1, edges: { x: [{ id: 'p', t: 1, action: 'WAIT' }, { id: 'q', t: 2, action: 'BUY' }], y: [] } })).edges.x.length, 2);
});

// ── drawdown ────────────────────────────────────────────────────────────────────────────────────────────────────
test('drawdown: the definition, and eval.json equals an independent recomputation from eval-trades.json and the outcome files', () => {
  assert.equal(maxDrawdown([]), 0); assert.equal(maxDrawdown([1, 1, 1]), 0); assert.equal(maxDrawdown([-1, -1, 3, -2]), 2); assert.equal(maxDrawdown([2, -1, -1, -1, 5, -4]), 4);
  assert.equal(maxDrawdown([-0.5, 1, -0.25]), 0.5, 'the peak starts at zero, so an opening loss is a drawdown');
  const base = { gates: [], evidenceWait: false, topCon: null, confidence: 'low' };
  const rows = [{ id: 'a', t: 1, exitT: 30, action: 'BUY', filled: true, netR: -1 }, { id: 'b', t: 2, exitT: 10, action: 'WAIT', filled: true, netR: 2 }, { id: 'c', t: 3, exitT: 20, action: 'BUY', filled: true, netR: -3 }, { id: 'd', t: 4, exitT: null, action: 'BUY', filled: false, netR: null }].map((r) => ({ ...base, ...r }));
  assert.deepEqual(inExitOrder(rows).map((r) => r.id), ['b', 'c', 'a'], 'exit order, unfilled orders left out');
  const d = drawdownOf(rows); assert.deepEqual([d.mechanical, d.take, d.wait], [{ n: 3, maxR: 4 }, { n: 2, maxR: 4 }, { n: 1, maxR: 0 }]);
  assert.ok('drawdown' in report(rows));
  // independent recomputation: join the action file to the outcome files, sort by exit, walk the equity
  const dd = (a) => { let eq = 0, peak = 0, worst = 0; for (const x of a) { eq += x; peak = Math.max(peak, eq); worst = Math.max(worst, peak - eq); } return +worst.toFixed(2); };
  const all = [], RS = json('academy/data/research.json');
  for (const id of IDS) {
    const O = outs(id), tr = TR.edges[id].map((r) => ({ ...r, o: O[r.id] })).filter((r) => !UNFILLED.includes(r.o.reason)).sort((a, b) => a.o.exitT - b.o.exitT || (a.id < b.id ? -1 : 1));
    const x = EV.edges[id].drawdown; all.push(...tr);
    assert.deepEqual(x.mechanical, { n: tr.length, maxR: dd(tr.map((r) => r.o.netR)) }, `${id}: mechanical`);
    const take = tr.filter((r) => r.action !== 'WAIT'), wait = tr.filter((r) => r.action === 'WAIT');
    assert.deepEqual(x.take, { n: take.length, maxR: take.length ? dd(take.map((r) => r.o.netR)) : null }, `${id}: take-set`);
    assert.deepEqual(x.wait, { n: wait.length, maxR: wait.length ? dd(wait.map((r) => r.o.netR)) : null }, `${id}: wait-set`);
    assert.equal(x.mechanical.n, EV.edges[id].mechanical.n); assert.equal(x.take.n, EV.edges[id].take.n); assert.equal(x.wait.n, EV.edges[id].wait.n);
    assert.equal(x.mechanical.maxR, RS.studies.find((s) => s.id === `base:${id}`).table.maxDrawdownR, `${id}: the research baseline's worst drawdown is the same number`);
    assert.equal(R.incumbent[id].all.mechanical.maxDD, x.mechanical.maxR); assert.equal(R.incumbent[id].all.take.maxDD, x.take.maxR, `${id}: the study agrees with eval.json`);
  }
  all.sort((a, b) => a.o.exitT - b.o.exitT || (a.id < b.id ? -1 : 1));
  assert.deepEqual(EV.overall.drawdown.mechanical, { n: all.length, maxR: dd(all.map((r) => r.o.netR)) }, 'overall: the seven edges\' trades in one sequence');
  assert.deepEqual(EV.overall.drawdown.take.maxR, dd(all.filter((r) => r.action !== 'WAIT').map((r) => r.o.netR)));
  assert.match(EV.method.drawdown, /exit order/);
});

// ── the ledger ──────────────────────────────────────────────────────────────────────────────────────────────────
test('exam ledger: its shape, zero reads, and it agrees with the result (a read only for an accepted candidate, logged with its version)', () => {
  assert.equal(LEDGER.schema, 1); assert.ok(Array.isArray(LEDGER.reads)); assert.ok(Array.isArray(LEDGER.priorUses) && LEDGER.priorUses.length >= 3);
  for (const r of LEDGER.reads) { for (const k of ['at', 'what', 'policyVersion', 'edges', 'by']) assert.ok(k in r, `a read needs ${k}`); assert.ok(Array.isArray(r.edges) && r.edges.length); assert.match(r.at, /^\d{4}-\d\d-\d\dT/); }
  assert.equal(new Set(LEDGER.reads.map((r) => r.policyVersion)).size, LEDGER.reads.length, 'at most one read per frozen policy version');
  const accepted = R.candidates.filter((c) => c.verdict === 'accepted');
  assert.ok(LEDGER.reads.length <= accepted.length, 'no read without a candidate that passed validation');
  assert.equal(R.exam.reads, LEDGER.reads.length); assert.equal(LEDGER.reads.length, 0, 'no candidate passed, so nothing was read');
  assert.match(LEDGER.note, /Zero reads/); assert.match(PRE, /at most once per frozen candidate policy version/);
  for (const u of LEDGER.priorUses) assert.equal(u.tunedOn, false);
  assert.equal(MXA.POLICY_VERSION, 'policy-1.0', 'nothing was accepted, so the shipped policy version did not move');
});

// ── the pure parts ──────────────────────────────────────────────────────────────────────────────────────────────
const rec = (o = {}) => ({ id: 'x', t: 1, edge: 'gtl', action: 'WAIT', side: 'buy', sup: [['htfBias', 2], ['regime', 1]], con: [['oppLiq', 1]], gates: [], support: 3, contradiction: 1, margin: 2, needMargin: 1.5, needSupport: 2.5, confidence: 'medium', similarN: 30, regime: 'trending', volRatio: 1.2, ...o });
test('candidates: each is the function of a decision record that the pre-registration describes', () => {
  assert.deepEqual(L.CANDIDATES.map((c) => c.id), ['C1', 'C2', 'C3', 'C4', 'C5']); assert.equal(L.CANDIDATES.length, 5, 'five, none added');
  for (const c of L.CANDIDATES) assert.ok(PRE.includes(`| ${c.id} | ${c.name} |`), `${c.id} is in the pre-registration under the same name`);
  const A = (p, r, ctx) => L.actionOf(p, r, ctx);
  // C0 = the evidence rule of policy-1.0
  assert.equal(A('C0', rec()), 'TAKE'); assert.equal(A('C0', rec({ con: [['oppLiq', 1], ['htfBias', 1]] })), 'WAIT', 'margin 1 under 1.5');
  assert.equal(A('C0', rec({ sup: [['htfBias', 2]] })), 'WAIT', 'support 2 under 2.5'); assert.equal(A('C0', rec({ gates: ['event'] })), 'WAIT'); assert.equal(A('C0', rec({ gates: ['rr'] })), 'WAIT');
  // C1: only a non-overridable gate holds a trade back
  assert.equal(A('C1', rec({ sup: [], con: [['htfBias', 2]], gates: ['event', 'volatility', 'unfamiliar', 'conflict'] })), 'TAKE');
  for (const g of L.HARD_GATES) { assert.equal(A('C1', rec({ gates: [g] })), 'WAIT', g); assert.equal(MXA.GATES[g].overridable, false, g); }
  for (const g of L.JUDGEMENT_GATES) assert.equal(MXA.GATES[g].overridable, true, g);
  assert.deepEqual(Object.keys(MXA.GATES).sort(), L.HARD_GATES.concat(L.JUDGEMENT_GATES).sort(), 'every gate of the core is on one of the two lists');
  // C2: any gate
  assert.equal(A('C2', rec({ sup: [], con: [['htfBias', 2]] })), 'TAKE'); for (const g of L.HARD_GATES.concat(L.JUDGEMENT_GATES)) assert.equal(A('C2', rec({ gates: [g] })), 'WAIT', g);
  // C3: the fixed table, replica and gmp only
  assert.deepEqual(L.C3_TABLE, { replica: { dropCon: ['location', 'volatility'], highVolOk: true, volGate: 4 }, gmp: { dropCon: ['displacement', 'oppLiq', 'volatility'], highVolOk: true, volGate: 4 } });
  const poor = { con: [['location', 1.25], ['oppLiq', 1]] };   // margin 3 - 2.25 = 0.75: a wait for policy-1.0
  assert.equal(A('C0', rec({ edge: 'replica', ...poor })), 'WAIT'); assert.equal(A('C3', rec({ edge: 'replica', ...poor })), 'TAKE', 'location no longer counts against a replica trade');
  assert.equal(A('C3', rec({ edge: 'gtl', ...poor })), 'WAIT', 'other edges are policy-1.0');
  assert.equal(A('C3', rec({ edge: 'gmp', con: [['displacement', 1], ['oppLiq', 1], ['volatility', 0.75]] })), 'TAKE'); assert.equal(A('C0', rec({ edge: 'gmp', con: [['displacement', 1], ['oppLiq', 1], ['volatility', 0.75]] })), 'WAIT');
  assert.equal(A('C3', rec({ edge: 'gmp', con: [['regime', 1], ['htfBias', 1]], regime: 'high-vol' })), 'TAKE', 'a high-vol regime is no longer bad'); assert.equal(A('C3', rec({ edge: 'gmp', con: [['regime', 1], ['htfBias', 1]], regime: 'ranging' })), 'WAIT', 'ranging still is');
  assert.equal(A('C3', rec({ edge: 'gmp', gates: ['volatility'], volRatio: 2.4 })), 'TAKE', 'the volatility gate moved to 4'); assert.equal(A('C3', rec({ edge: 'gmp', gates: ['volatility'], volRatio: 4 })), 'WAIT');
  assert.equal(A('C3', rec({ edge: 'replica', gates: ['volatility', 'event'], volRatio: 2.4 })), 'WAIT', 'another gate still holds');
  // C4: only the listed votes of that edge are dropped
  const ctx = { drops: { gtl: ['sup:regime', 'con:oppLiq', 'gate:event'] } };
  assert.equal(A('C4', rec(), {}), A('C0', rec())); assert.equal(A('C4', rec({ edge: 'geg' }), ctx), 'TAKE');
  assert.equal(A('C4', rec(), ctx), 'WAIT', 'support falls to 2 once the regime vote is dropped'); assert.equal(A('C4', rec({ sup: [['htfBias', 2], ['sweep', 1]], con: [['oppLiq', 1], ['htfBias', 1]], gates: ['event'] }), ctx), 'TAKE', 'the dropped contradiction and gate no longer count');
  assert.equal(A('C4', rec({ gates: ['rr'] }), { drops: { gtl: ['gate:rr'] } }), 'WAIT', 'a non-overridable gate is not a vote, so it can never be on a drop list that matters');
  // C5
  assert.equal(A('C5', rec()), 'TAKE'); assert.equal(A('C5', rec({ confidence: 'low' })), 'WAIT'); assert.equal(A('C5', rec({ confidence: 'high', gates: ['event'] })), 'WAIT');
  assert.throws(() => A('C9', rec()), /unknown policy/);
  assert.deepEqual(L.votesOf(rec({ gates: ['event', 'rr'] })), ['sup:htfBias', 'sup:regime', 'con:oppLiq', 'gate:event']);
});

test('decisions.json: every record reproduces the policy\'s own action, and digestOf writes no outcome', () => {
  assert.equal(DEC.policy, MXA.POLICY_VERSION); assert.equal(DEC.dataVersion, EV.dataVersion);
  let n = 0;
  for (const id of IDS) DEC.edges[id].forEach((r, i) => {
    const want = TR.edges[id][i].action; assert.equal(r.action, want, r.id); assert.equal(L.actionOf('C0', { ...r, edge: id }), want === 'WAIT' ? 'WAIT' : 'TAKE', `${r.id}: the record gives the same answer as the engine did`);
    assert.equal(r.support, +r.sup.reduce((s, x) => s + x[1], 0).toFixed(2)); assert.equal(r.margin, +(r.support - r.contradiction).toFixed(2)); n++;
  });
  assert.equal(n, 1512);
  const d = L.digestOf('gtl', { id: 'c1', t: 5 }, { action: 'BUY', side: 'buy', supporting: [{ factor: 'htfBias', weight: 2, text: 'x' }], contradicting: [], gates: [{ code: 'event' }], evidence: { support: 2, contradiction: 0, margin: 2, needMargin: 1.5, needSupport: 2.5 }, confidence: 'low', similar: { n: 3 } }, { regime: 'trending', volRatio: 1.23456 });
  assert.deepEqual(d, { id: 'c1', t: 5, edge: 'gtl', action: 'BUY', side: 'buy', sup: [['htfBias', 2]], con: [], gates: ['event'], support: 2, contradiction: 0, margin: 2, needMargin: 1.5, needSupport: 2.5, confidence: 'low', similarN: 3, regime: 'trending', volRatio: 1.2346 });
  for (const k of Object.keys(d)) assert.ok(!L.OUTCOME_KEYS.includes(k));
});

test('statistics: Welch t and its p, Holm, Spearman, the vote audit', () => {
  const w = L.welch([1, 2, 3, 4], [0, 0.5, 1, 1.5, 2]); assert.equal(w.diff, 1.5); assert.equal(w.t, 2.04); assert.ok(w.pOne > 0.03 && w.pOne < 0.06 && Math.abs(w.pTwo - 2 * w.pOne) < 1e-12);
  const neg = L.welch([0, 0.5, 1, 1.5, 2], [1, 2, 3, 4]); assert.ok(Math.abs(neg.pOne - (1 - w.pOne)) < 1e-12, 'one-sided: a difference the wrong way has p over a half');
  assert.equal(L.welch([1], [1, 2]).t, null); assert.equal(L.welch([1, 1], [1, 1]).t, null);
  assert.deepEqual(L.holm([0.01, 0.04, 0.03, 0.005]).map((p) => +p.toFixed(4)), [0.03, 0.06, 0.06, 0.02], 'Holm: 4 x 0.005, 3 x 0.01, 2 x 0.03, then no smaller than the one before');
  assert.deepEqual(L.holm([0.5, 0.9]), [1, 1]); assert.deepEqual(L.holm([]), []);
  assert.equal(L.spearman([1, 2, 3, 4, 5], [2, 4, 6, 8, 100]).rho, 1); assert.equal(L.spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]).rho, -1); assert.equal(L.spearman([1, 2], [1, 2]).rho, null);
  assert.ok(Math.abs(L.zOfP(0.0228) - 2) < 0.011); assert.equal(L.mde(1, 50, 50, 2), 0.4);
  assert.equal(L.maxDD([{ id: 'a', exitT: 3, netR: 5 }, { id: 'b', exitT: 1, netR: -1 }, { id: 'c', exitT: 2, netR: -1 }]), 2, 'exit order, not the order given');
  // the audit: a support vote whose trades did worse is wrong-signed; it is dropped at |t| >= 1; under 20 a side it is counted only
  const mk = (sup, con, netR) => ({ rec: rec({ sup: sup.map((f) => [f, 1]), con: con.map((f) => [f, 1]) }), netR });
  const rows = []; for (let i = 0; i < 25; i++) { rows.push(mk(['momentum'], [], i % 2 ? -1 : -0.5)); rows.push(mk([], ['location'], i % 2 ? 1 : 2)); } rows.push(mk(['sweep'], [], 3));
  const a = Object.fromEntries(L.auditVotes(rows).map((v) => [v.vote, v]));
  assert.deepEqual([a['sup:momentum'].nWith, a['sup:momentum'].nWithout, a['sup:momentum'].wrongSigned, a['sup:momentum'].drop], [25, 26, true, true]);
  assert.deepEqual([a['con:location'].kind, a['con:location'].wrongSigned, a['con:location'].drop], ['contradiction', true, true], 'a contradiction vote whose trades did better is wrong-signed');
  assert.deepEqual([a['sup:sweep'].nWith, a['sup:sweep'].t, a['sup:sweep'].wrongSigned, a['sup:sweep'].drop], [1, null, null, false], 'too few: counts only, never dropped');
  const flip = Object.fromEntries(L.auditVotes(rows.map((r) => ({ ...r, netR: -r.netR }))).map((v) => [v.vote, v])); assert.equal(flip['sup:momentum'].wrongSigned, false); assert.equal(flip['sup:momentum'].drop, false);
});

test('acceptance rule: every clause of section 7, on built cases', () => {
  const T = (rs, t0 = 0) => rs.map((netR, i) => ({ id: 'k' + (t0 + i), exitT: t0 + i, netR, adj: netR }));
  const good = Array.from({ length: 30 }, (_, i) => (i % 3 ? 1 : -0.5)), bad = Array.from({ length: 30 }, (_, i) => (i % 3 ? -1 : 0.5));
  const x = L.testOf({ take: T(good), wait: T(bad, 100) });
  assert.equal(x.testable, true); assert.ok(x.t >= 2 && x.diff > 0 && x.aboveMechanical && x.drawdownNotWorse);
  assert.equal(L.verdictOf(x, 0.001), 'accepted'); assert.equal(L.verdictOf(x, 0.0228), 'accepted'); assert.equal(L.verdictOf(x, 0.03), 'inconclusive', 'significant alone, not after the correction');
  assert.equal(L.verdictOf({ ...x, t: 1.9 }, 0.001), 'inconclusive', 'a raw t under 2 is never accepted');
  assert.equal(L.verdictOf({ ...x, drawdownNotWorse: false }, 0.001), 'rejected'); assert.equal(L.verdictOf({ ...x, aboveMechanical: false }, 0.001), 'rejected'); assert.equal(L.verdictOf({ ...x, diff: 0 }, 0.001), 'rejected');
  assert.equal(L.verdictOf(L.testOf({ take: T(bad), wait: T(good, 100) }), 1), 'rejected');
  const few = L.testOf({ take: T(good).slice(0, 19), wait: T(bad, 100) }); assert.equal(few.testable, false); assert.equal(L.verdictOf(few, 0), 'inconclusive: too few trades');
  // the pooled scope tests the adjusted figure and reports the plain one beside it
  const p = L.testOf({ take: T(good).map((r) => ({ ...r, adj: r.netR - 2 })), wait: T(bad, 100), pooled: true }); assert.ok(p.diff < 0 && p.diffNetR > 0); assert.equal(L.verdictOf(p, 0), 'rejected');
  // a candidate's own verdict
  const S = (verdict, changedSetups = 5) => ({ verdict, changedSetups });
  assert.equal(L.candidateVerdict([S('rejected'), S('accepted')]), 'accepted'); assert.equal(L.candidateVerdict([S('rejected'), S('rejected'), S('inconclusive: too few trades')]), 'rejected');
  assert.equal(L.candidateVerdict([S('rejected'), S('inconclusive')]), 'inconclusive'); assert.equal(L.candidateVerdict([S('inconclusive: too few trades')]), 'inconclusive', 'changes decisions but cannot be tested');
  assert.equal(L.candidateVerdict([S('identical to policy-1.0 here: not a test', 0)]), 'rejected', 'changes nothing');
  assert.deepEqual([L.MIN_SIDE, L.T_LINE, L.ALPHA_ONE, L.ALPHA_TWO, L.AUDIT_T], [20, 2, 0.0228, 0.0455, 1]);
});

// ── the committed result ────────────────────────────────────────────────────────────────────────────────────────
test('result.json: reproduced byte for byte from the committed files, and the acceptance rule gives the committed verdicts', () => {
  assert.equal(RUN.render(RUN.build()), RESULT_TEXT, 'node research/edge/academy-policy/run.mjs rewrites the same file');
  assert.deepEqual(R.preregistration.amendments, []); assert.match(PRE, /## 10\. Amendments\n\nNone\./);
  assert.equal(R.candidates.length, 5);
  const fam = [];
  for (const c of R.candidates) for (const s of c.scopes) {
    const v = s.validation;
    assert.equal(v.testable, v.take.n >= 20 && v.wait.n >= 20, `${c.id} ${s.scope}`); assert.equal(s.tested, s.changedSetups > 0 && v.testable);
    assert.equal(v.take.n + v.wait.n, v.mechanical.n); assert.equal(s.discovery.take.n + s.discovery.wait.n, s.discovery.mechanical.n);
    if (s.tested) fam.push(s); else assert.equal(s.pHolm, null);
    const want = s.changedSetups === 0 ? 'identical to policy-1.0 here: not a test' : L.verdictOf(v, s.tested ? s.pHolm : 1);
    assert.equal(s.verdict, want, `${c.id} ${s.scope}: the verdict follows the rule`);
    if (s.verdict === 'accepted') assert.ok(v.t >= 2 && s.pHolm <= 0.0228 && v.aboveMechanical && v.drawdownNotWorse && v.diff > 0);
    if (v.take.n && v.mechanical.n && s.scope !== 'pooled') { assert.equal(v.aboveMechanical, v.take.avg > v.mechanical.avg || (v.take.avg === v.mechanical.avg && v.takeAvgTested > v.mechanical.avg), `${c.id} ${s.scope}`); assert.equal(v.drawdownNotWorse, v.take.maxDD <= v.mechanical.maxDD); }
  }
  // the Holm family and its adjusted p, recomputed from the stored one-sided p (stored to 5 decimals)
  assert.equal(fam.length, R.holm.tests); assert.equal(fam.length, 16);
  const adj = L.holm(fam.map((s) => s.validation.pOne)); fam.forEach((s, i) => assert.ok(Math.abs(adj[i] - s.pHolm) < 2e-4, `Holm p ${adj[i]} against ${s.pHolm}`));
  for (const c of R.candidates) { assert.equal(c.verdict, L.candidateVerdict(c.scopes), c.id); assert.deepEqual(c.acceptedScopes, c.scopes.filter((s) => s.verdict === 'accepted').map((s) => s.scope)); }
  assert.deepEqual(R.candidates.map((c) => c.verdict), ['inconclusive', 'rejected', 'rejected', 'inconclusive', 'inconclusive']);
  assert.deepEqual(R.counts, { candidates: 5, tests: 16, accepted: 0, rejected: 2, inconclusive: 3 });
  assert.ok(Math.max(...fam.map((s) => s.validation.t)) < 2, 'no test reaches t = 2 even before the correction');
  assert.match(R.verdict, /^No candidate passes/); assert.match(REPORT, /\*\*Verdict: no candidate passes\./);
  // C1 is the mechanical baseline (no non-overridable gate fires anywhere), so it has no wait-set to test
  const c1 = R.candidates[0]; for (const s of c1.scopes) assert.equal(s.validation.wait.n, 0);
  // the incumbent's whole-pool line is eval.json's, edge by edge
  for (const id of IDS) { const a = R.incumbent[id].all, e = EV.edges[id]; assert.deepEqual([a.mechanical.n, a.mechanical.avg, a.take.n, a.take.avg, a.wait.n, a.wait.avg, a.t], [e.mechanical.n, e.mechanical.avg, e.take.n, e.take.avg, e.wait.n, e.wait.avg, e.diff.t], id); }
  assert.equal(R.incumbent.pooled.all.tNetR, EV.overall.diff.t, 'pooled, plain net R = eval.json overall');
  // C4's drop list is what the discovery audit says, and nothing else
  for (const id of IDS) assert.deepEqual(R.c4Drops[id], R.diagnosis[id].discovery.votes.filter((v) => v.wrongSigned && v.nWith >= 20 && v.nWithout >= 20 && v.drop).map((v) => v.vote), id);
  for (const id of IDS) for (const v of R.diagnosis[id].discovery.votes) if (v.drop) assert.ok(v.wrongSigned && Math.abs(v.t) >= 0.99, `${id} ${v.vote}`);
  // every figure in the report's tables carries its n: spot checks against the file
  for (const s of ['0 of 16', 'zero', '1.00']) assert.ok(REPORT.includes(s), s);
});

test('the exam pool is unread: wild exam and flagged outcomes give the same bytes; a changed train outcome does not', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acad-policy-'));
  try {
    const write = (mut) => { const dir = fs.mkdtempSync(path.join(tmp, 'd-')); fs.copyFileSync(path.join(ROOT, 'academy/data/meta.json'), path.join(dir, 'meta.json'));
      for (const id of IDS) { const C = cands(id), O = outs(id); fs.writeFileSync(path.join(dir, `cand-${id}.json`), JSON.stringify(C)); fs.writeFileSync(path.join(dir, `out-${id}.json`), JSON.stringify(mut(id, C, O))); } return dir; };
    let wild = 0;
    const d1 = write((id, C, O) => { for (const c of C) if (c.pool === 'exam' || flagged(c)) { O[c.id] = { id: c.id, R: 999, netR: -999, exitT: 1, exit: 0, reason: 'target', mfeR: 999, maeR: -999 }; wild++; } return O; });
    assert.ok(wild > 1000, `${wild} outcomes replaced`);
    assert.equal(RUN.render(RUN.build({ dataDir: d1 })), RESULT_TEXT, 'not one exam or flagged outcome is read');
    const d2 = write((id, C, O) => { for (const c of C) if (c.pool === 'exam') delete O[c.id]; return O; });
    assert.equal(RUN.render(RUN.build({ dataDir: d2 })), RESULT_TEXT, 'the study runs without any exam outcome in the files at all');
    // the control: the same code does notice a train outcome
    const victim = usable('gmp').find((c) => !UNFILLED.includes(outs('gmp')[c.id].reason)).id;
    const d3 = write((id, C, O) => { if (id === 'gmp') O[victim] = { ...O[victim], netR: O[victim].netR + 50 }; return O; });
    assert.notEqual(RUN.render(RUN.build({ dataDir: d3 })), RESULT_TEXT);
    // and a decisions file that does not list exactly the usable train setups is refused
    const bad = JSON.parse(JSON.stringify(DEC)); bad.edges.gtl.pop(); const f = path.join(tmp, 'dec.json'); fs.writeFileSync(f, JSON.stringify(bad));
    assert.throws(() => RUN.build({ decisionsFile: f }), /usable train setups/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('isolation and wording: no exam read in the code, no trading code, no network, no model names', () => {
  const names = new RegExp(['clau' + 'de', 'anth' + 'ropic', 'open' + 'ai', 'g' + 'pt-?\\d', 'gem' + 'ini', 'son' + 'net', 'op' + 'us', 'hai' + 'ku', 'lla' + 'ma', 'fab' + 'le'].join('|'), 'i');
  const net = new RegExp(['\\bfet' + 'ch\\s*\\(', 'htt' + 'ps?://', 'node:htt' + 'ps?', 'node:n' + 'et', 'child_pro' + 'cess'].join('|'));
  const files = [`${DIR}/lib.mjs`, `${DIR}/run.mjs`, `${DIR}/walk.mjs`, `${DIR}/PREREGISTRATION.md`, `${DIR}/RESULT.md`, `${DIR}/result.json`, 'academy/data/exam-ledger.json', 'academy/data/eval-trades.json', 'tests/academy-policy.test.mjs'];
  for (const f of files) { const s = read(f); assert.ok(!names.test(s), `${f}: a model name`); assert.ok(!net.test(s), `${f}: a network call`); assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s), `${f}: an emoji`); }
  for (const f of ['lib.mjs', 'run.mjs', 'walk.mjs']) { const s = read(`${DIR}/${f}`); assert.ok(!/from '[^']*(council|ict|api)\/(?!events)/.test(s), `${f} imports trading or API code`); assert.ok(!/process\.env\.(?!ACADEMY_CANDLES)/.test(s), f); }
  // the analysis opens the outcome files in one place and keeps train ids only; the walk does the same through trainOutcomes
  const run = read(`${DIR}/run.mjs`); assert.equal((run.match(/out-\$\{id\}\.json/g) || []).length, 1); assert.match(run, /if \(ok\.has\(k\)\) outs\[k\] = all\[k\]/);
  assert.match(read(`${DIR}/walk.mjs`), /c\.pool === 'train' && !isFlagged\(c\)/);
  assert.deepEqual(run.match(/\w+: cands\.filter\(\(c\) => c\.pool === 'exam'\)\.length/g), ["examNeverRead: cands.filter((c) => c.pool === 'exam').length"]); assert.equal(run.split("'exam'").length - 1, 1, 'run.mjs names the exam pool once, to count its setups');
  for (const f of ['lib.mjs', 'walk.mjs']) assert.ok(!read(`${DIR}/${f}`).includes("'exam'"), `${f} never selects the exam pool`);
  // lib.mjs is pure: it opens no file
  assert.ok(!/node:fs|readFileSync|writeFileSync/.test(read(`${DIR}/lib.mjs`)));
});
