// research/edge/index-spread-momentum: past-data-only beta and z, entry / stop / target / time exit on hand-made series,
// the two-leg R, costs and financing, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  P, SPREAD, CUR, PAIRS, signals, tradeFrom, simulate, costOf, rateAt, statsOf, withCost, report, dirOf, mulberry32, join,
} from '../research/edge/index-spread-momentum/run.mjs';
import { nights } from '../council/fills.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../research/edge/index-spread-momentum');
const T0 = Date.parse('2024-01-01T00:00:00Z') / 1000; // a Monday
const close = (a, b, eps = 1e-12) => Math.abs(a - b) < eps;

// joined rows from leg-A spreads (log) with leg B fixed at 1 (beta 1: spread = ln A); open of day k = aOpen[k] ?? close
function rows(sp, op = {}) {
  return sp.map((s, k) => ({ time: T0 + k * 86400, ao: Math.exp(op[k] ?? s), ac: Math.exp(s), bo: 1, bc: 1 }));
}
// 60 base days of +-0.01 (mean 0, sd ~0.01), the signal close at day 59
const base = () => Array.from({ length: 60 }, (_, k) => (k % 2 ? 0.01 : -0.01));
const SIG = (dir = 1) => { const s = []; s[59] = { beta: 1, mean: 0, sd: 0.01, z: 2.5 * dir }; return s; };

test('beta and z use closes up to the signal only', () => {
  const rnd = mulberry32(7); let a = 100, b = 100; const A = [], B = [];
  for (let k = 0; k < 420; k++) { a *= Math.exp((rnd() - 0.5) * 0.02); b *= Math.exp((rnd() - 0.5) * 0.02); A.push(a); B.push(b); }
  const J = A.map((x, k) => ({ time: T0 + k * 86400, ao: x, ac: x, bo: B[k], bc: B[k] }));
  const s1 = signals(J);
  const J2 = J.map((r, k) => (k > 330 ? { ...r, ao: r.ao * 3, ac: r.ac * 0.2, bo: r.bo * 5, bc: r.bc * 7 } : r));
  const s2 = signals(J2);
  for (let i = 0; i <= 330; i++) assert.deepEqual(s1[i], s2[i], `signal ${i} changed when later prices changed`);
  assert.equal(s1[P.betaN - 2], null, 'no signal before 250 closes');
  assert.ok(s1[P.betaN - 1] && Number.isFinite(s1[P.betaN - 1].beta));
  assert.ok(s2.slice(331).some((x, k) => JSON.stringify(x) !== JSON.stringify(s1[331 + k])));
});

test('direction is momentum: z > 2 buys the spread, z < -2 sells it', () => {
  assert.equal(dirOf(2.01), 1); assert.equal(dirOf(-2.01), -1); assert.equal(dirOf(2), 0); assert.equal(dirOf(-1.5), 0);
  assert.equal(P.zStop, 0); assert.equal(P.zTarget, 4); assert.equal(P.hold, 20);
});

test('long spread: target at z 4, at the close', () => {
  const sp = [...base(), 0.06], J = rows(sp, { 60: 0.025 });
  const t = tradeFrom(J, SIG(1), 59, 1);
  assert.equal(t.why, 'target'); assert.equal(t.x, 60);
  assert.ok(close(t.risk, 0.025)); assert.ok(close(t.R, (0.06 - 0.025) / 0.025));
  assert.equal(t.opened, J[60].time); assert.equal(t.closed, J[60].time + 86400);
});

test('long spread: stop when z returns to 0, at the close; 1R = entry to the signal mean', () => {
  const sp = [...base(), -0.005], J = rows(sp, { 60: 0.025 });
  const t = tradeFrom(J, SIG(1), 59, 1);
  assert.equal(t.why, 'stop'); assert.ok(close(t.stop, 0)); assert.ok(close(t.R, (-0.005 - 0.025) / 0.025));
});

test('gap stop at the open against the previous close window', () => {
  const sp = [...base(), 0.03, 0.03], J = rows(sp, { 60: 0.025, 61: -0.01 });
  const t = tradeFrom(J, SIG(1), 59, 1);
  assert.equal(t.why, 'stop-gap'); assert.equal(t.x, 61); assert.equal(t.closed, J[61].time);
  assert.ok(close(t.R, (-0.01 - 0.025) / 0.025));
});

test('time exit at the close of the 20th day', () => {
  const sp = [...base(), ...Array(30).fill(0.03)], J = rows(sp, { 60: 0.025 });
  const t = tradeFrom(J, SIG(1), 59, 1);
  assert.equal(t.why, 'time'); assert.equal(t.x, 60 + P.hold - 1); assert.ok(close(t.R, (0.03 - 0.025) / 0.025));
});

test('short spread mirrors the long one', () => {
  const sp = [...base().map((x) => -x), -0.06], J = rows(sp, { 60: -0.025 });
  const t = tradeFrom(J, SIG(-1), 59, -1);
  assert.equal(t.why, 'target'); assert.ok(close(t.R, (0.06 - 0.025) / 0.025));
  const J2 = rows([...base().map((x) => -x), 0.005], { 60: -0.025 });
  const t2 = tradeFrom(J2, SIG(-1), 59, -1);
  assert.equal(t2.why, 'stop'); assert.ok(close(t2.R, -(0.005 + 0.025) / 0.025));
});

test('skip when the entry open is already at or past the stop or the target', () => {
  assert.equal(tradeFrom(rows([...base(), 0.03], { 60: -0.001 }), SIG(1), 59, 1).skip, true);
  assert.equal(tradeFrom(rows([...base(), 0.03], { 60: 0.0 }), SIG(1), 59, 1).skip, true);
  assert.equal(tradeFrom(rows([...base(), 0.05], { 60: 0.041 }), SIG(1), 59, 1).skip, true);
  assert.equal(tradeFrom(rows([...base(), ...Array(25).fill(0.03)], { 60: 0.02 }), SIG(1), 59, 1).why, 'time');
});

test('two-leg R: spread = ln A - beta ln B, frozen at the signal', () => {
  const J = base().map((s, k) => ({ time: T0 + k * 86400, ao: 1, ac: 1, bo: Math.exp(-2 * s), bc: Math.exp(-2 * s) })); // spread = -0.5 ln B = s
  J.push({ time: T0 + 60 * 86400, ao: 1.5, ac: 1.6, bo: Math.exp(2 * Math.log(1.5) - 0.05), bc: Math.exp(2 * Math.log(1.6) - 0.12) });
  const sig = []; sig[59] = { beta: 0.5, mean: 0, sd: 0.01, z: 2.5 };
  const t = tradeFrom(J, sig, 59, 1);
  assert.ok(close(t.entry, Math.log(1.5) - 0.5 * Math.log(J[60].bo)));
  assert.ok(close(t.entry, 0.025, 1e-9)); assert.ok(close(t.exit, 0.06, 1e-9));
  assert.equal(t.why, 'target'); assert.ok(close(t.R, (0.06 - 0.025) / 0.025, 1e-9));
});

test('one position at a time per pair', () => {
  const J = rows([...base(), ...Array(30).fill(0.03)], { 60: 0.025 });
  const sig = []; for (let i = 59; i < 85; i++) sig[i] = { beta: 1, mean: 0, sd: 0.01, z: 2.5 };
  const { trades } = simulate(J, sig);
  assert.ok(trades.length >= 1);
  for (let k = 1; k < trades.length; k++) assert.ok(trades[k].sig >= trades[k - 1].x);
});

test('costs: both legs\' spreads and financing at each leg\'s local rate, long r + 2.5 %, short max(0, 2.5 % - r)', () => {
  const rates = JSON.parse(fs.readFileSync(path.join(DIR, 'rates.json'), 'utf8'));
  assert.equal(rateAt(rates, 'eur', Date.parse('2026-05-01') / 1000), 2);
  assert.equal(rateAt(rates, 'aud', Date.parse('2016-05-01') / 1000), 1.7);
  assert.equal(rateAt(rates, 'gbp', Date.parse('2004-05-01') / 1000), 5.5, 'before the table: its first year');
  assert.deepEqual(SPREAD, { de40: 2, uk100: 2, eu50: 2, fr40: 2, jp225: 10, au200: 2 });
  assert.deepEqual(CUR, { de40: 'eur', eu50: 'eur', fr40: 'eur', uk100: 'gbp', jp225: 'jpy', au200: 'aud' });
  const pair = PAIRS[0], opened = Date.parse('2026-03-02T00:00:00Z') / 1000, closedT = opened + 7 * 86400;
  const tr = { Ae: 20000, Be: 8000, beta: 0.8, risk: 0.02, opened, closed: closedT };
  const N = nights(opened, closedT), sprR = (2 / 20000 + 0.8 * 2 / 8000) / 0.02;
  const L = costOf({ ...tr, dir: 1 }, pair, rates); // long DE40 (eur 2 % + 2.5), short UK100 (max(0, 2.5 - 3.9) = 0)
  assert.ok(close(L.spr, sprR)); assert.ok(close(L.fin, N * (0.045 + 0.8 * 0) / 365 / 0.02)); assert.ok(close(L.total, L.spr + L.fin));
  const S = costOf({ ...tr, dir: -1 }, pair, rates); // short DE40 (2.5 - 2 = 0.5 %), long UK100 (3.9 + 2.5)
  assert.ok(close(S.fin, N * (0.005 + 0.8 * 0.064) / 365 / 0.02));
  const neg = costOf({ ...tr, dir: -1, opened: Date.parse('2020-03-02T00:00:00Z') / 1000, closed: Date.parse('2020-03-09T00:00:00Z') / 1000 }, pair, rates);
  assert.ok(close(neg.fin, nights(Date.parse('2020-03-02T00:00:00Z') / 1000, Date.parse('2020-03-09T00:00:00Z') / 1000) * (0.03 + 0.8 * 0.027) / 365 / 0.02), 'negative euro rate: the short leg pays 2.5 % + 0.5 %');
  assert.equal(costOf({ ...tr, dir: 1 }, pair, rates, false).fin, 0);
  const st = statsOf(withCost([{ ...tr, dir: 1, R: 1, why: 'target' }], pair, rates), opened - 86400, closedT + 86400 * 40);
  assert.ok(close(st.avg, Math.round((1 - L.total) * 1000) / 1000));
});

test('join keeps only days both legs have', () => {
  const a = [{ time: 1, open: 1, close: 2 }, { time: 2, open: 3, close: 4 }], b = [{ time: 2, open: 5, close: 6 }];
  assert.deepEqual(join(a, b), [{ time: 2, ao: 3, ac: 4, bo: 5, bc: 6 }]);
});

test('RESULT.md matches result.json; the verdict follows the bar', () => {
  const res = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  assert.equal(fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8'), report(res));
  const q = res.pooled;
  const checks = {
    netPositive: q.dec.avg > 0, tAtLeast2: q.dec.monthT >= 2, sameSignRep: q.rep.avg > 0,
    pairsPositive: res.pairs.filter((x) => x.dec.avg > 0).length >= 3, aboveRandom: q.dec.avg > q.placebo.p95,
  };
  assert.deepEqual(res.checks, checks);
  assert.equal(res.pass, Object.values(checks).every(Boolean));
  assert.equal(res.verdict.startsWith('PASS'), res.pass);
  assert.equal(q.dec.n, res.pairs.reduce((a, x) => a + x.dec.n, 0));
  assert.equal(q.rep.n, res.pairs.reduce((a, x) => a + x.rep.n, 0));
  assert.deepEqual(res.pairs.map((x) => x.legs.join('/')), ['de40/uk100', 'eu50/uk100', 'jp225/au200', 'de40/fr40']);
  for (const k of ['us2000', 'nas100', 'spx500', 'us30']) assert.ok(!res.pairs.some((x) => x.legs.includes(k)), 'the US pairs stay out');
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.ok(md.includes(`**Verdict: ${res.verdict}.**`));
  assert.ok(fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8').includes('#881'));
});
