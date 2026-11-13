// node --test tests/desk-ict-book-risk.test.mjs — research/edge/ict-book-risk (13 Nov 2026): the four pre-registered book rules on
// hand-made trade lists, the measures and the bootstrap, the published numbers, and that the study reads the ICT engine without
// touching it. Offline. Not named tests/ict-*: it checks research files only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as B from '../research/edge/ict-book-risk/book.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'ict-book-risk');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const H = 3600, T0 = Date.UTC(2024, 0, 2, 14) / 1000;   // Tue 2 Jan 2024 09:00 New York
const tr = (id, market, side, h0, h1, R, grade = 'A') => ({ id, market, side, t: T0 + h0 * H, closed: T0 + h1 * H, R, grade });
const ids = (r) => r.taken.map((x) => x.id);

test('R1: one same-side index position at a time, first signal wins, gold and the other side apart', () => {
  const list = [tr('nq', 'nq', 'buy', 0, 5, 1), tr('es', 'es', 'buy', 1, 3, 1), tr('ym-s', 'ym', 'sell', 2, 4, 1), tr('gc', 'gc', 'buy', 2, 6, 1), tr('rty', 'rty', 'buy', 5, 7, 1)];
  const r = B.r1Cluster(list);
  assert.deepEqual(ids(r), ['nq', 'ym-s', 'gc', 'rty'], 'es skipped while nq is open; rty enters at the hour nq closes');
  assert.deepEqual(r.skipped.map((x) => x.id), ['es']);
  // a tie: the higher grade wins, then NQ, ES, YM, RTY
  assert.deepEqual(ids(B.r1Cluster([tr('es', 'es', 'buy', 0, 2, 1, 'A+'), tr('nq', 'nq', 'buy', 0, 2, 1, 'A')])), ['es']);
  assert.deepEqual(ids(B.r1Cluster([tr('es', 'es', 'buy', 0, 2, 1), tr('nq', 'nq', 'buy', 0, 2, 1)])), ['nq']);
});

test('R2: no new entry once -2R closed in the same New York trading day; the 17:00 roll starts a new day', () => {
  const list = [tr('a', 'nq', 'buy', 0, 1, -1), tr('b', 'es', 'buy', 0.5, 2, -1.2), tr('c', 'ym', 'buy', 3, 4, 2), tr('d', 'gc', 'buy', 8.5, 9, 1)];
  const r = B.r2DayStop(list);
  assert.deepEqual(ids(r), ['a', 'b', 'd'], 'c is skipped at -2.2R closed; d enters after 17:00 New York, a new trading day');
  assert.equal(B.nyDay(T0 + 7.9 * H), '2024-01-02'); assert.equal(B.nyDay(T0 + 8 * H), '2024-01-03');
  assert.deepEqual(ids(B.r2DayStop([tr('a', 'nq', 'buy', 0, 1, -1.9), tr('c', 'ym', 'buy', 3, 4, 2)])), ['a', 'c'], '-1.9R does not stop');
  assert.deepEqual(ids(B.r2DayStop([tr('a', 'nq', 'buy', 0, 5, -3), tr('c', 'ym', 'buy', 3, 4, 2)])), ['a', 'c'], 'a loss still open does not count');
});

test('R3: at most two open positions', () => {
  const list = [tr('a', 'nq', 'buy', 0, 4, 1), tr('b', 'gc', 'sell', 1, 3, 1), tr('c', 'es', 'sell', 2, 5, 1), tr('d', 'ym', 'buy', 3, 6, 1)];
  const r = B.r3OpenCap(list);
  assert.deepEqual(ids(r), ['a', 'b', 'd']); assert.deepEqual(r.skipped.map((x) => x.id), ['c']);
});

test('R4: inverse volatility, mean weight 1, clipped, weight 1 before 60 days and for a quiet market', () => {
  const from = Date.UTC(2024, 0, 1) / 1000, days = B.tradingDays(from, from + 200 * 86400), list = [];
  // nq: +-2R every day; es: +-1R every day; ym, rty, gc silent. Trades close at 15:00 UTC of each weekday.
  const at = (d) => Date.parse(d + 'T15:00:00Z') / 1000;
  days.slice(0, 80).forEach((d, i) => { list.push({ id: 'nq' + i, market: 'nq', side: 'buy', t: at(d) - 3600, closed: at(d), R: i % 2 ? 2 : -2 }); list.push({ id: 'es' + i, market: 'es', side: 'buy', t: at(d) - 3600, closed: at(d), R: i % 2 ? 1 : -1 }); });
  list.push({ id: 'gc', market: 'gc', side: 'buy', t: at(days[70]) - 3600, closed: at(days[70]), R: 1 });
  const w = Object.fromEntries(B.r4InvVol(list, days).taken.map((x) => [x.id, x.w]));
  assert.equal(w.nq10, 1, 'before 60 trading days: weight 1');
  assert.ok(Math.abs(w.nq70 - 2 / 3) < 1e-3 && Math.abs(w.es70 - 4 / 3) < 1e-3, `raw 1/2 and 1/1, mean 3/4: ${w.nq70} ${w.es70}`);
  assert.equal(w.gc, 1, 'no closed R in 60 days: weight 1');
  const R = B.r4InvVol(list, days).taken.find((x) => x.id === 'es69');
  assert.ok(Math.abs(R.R - 4 / 3) < 1e-3, 'R is scaled, never skipped');
  assert.equal(B.r4InvVol(list, days).skipped.length, 0);
  const wild = days.slice(0, 80).map((d, i) => ({ id: 'ym' + i, market: 'ym', side: 'buy', t: at(d) - 3600, closed: at(d), R: i % 2 ? 50 : -50 }));
  const w2 = Object.fromEntries(B.r4InvVol(list.concat(wild), days).taken.map((x) => [x.id, x.w]));
  assert.ok(Math.abs(w2.ym70 - B.P.wMin) < 1e-4, 'clipped at 1/3');
});

test('measures: drawdown from a high that starts at 0, return / drawdown, monthly Sharpe with zero months', () => {
  const list = [tr('a', 'nq', 'buy', 0, 1, -1), tr('b', 'nq', 'buy', 2, 3, 3), tr('c', 'nq', 'buy', 4, 5, -2), tr('d', 'nq', 'buy', 6, 7, 1)];
  assert.equal(B.maxDD(list), 2);
  const m = B.measure(list, T0); assert.equal(m.R, 1); assert.equal(m.rdd, 0.5); assert.equal(m.n, 4); assert.equal(m.wr, 0.5);
  const jan = Date.UTC(2024, 0, 15) / 1000, mar = Date.UTC(2024, 2, 15) / 1000;
  const s = B.monthlySharpe([{ R: 2, closed: jan, t: jan }, { R: 1, closed: mar, t: mar }], Date.UTC(2024, 0, 1) / 1000);
  assert.ok(Math.abs(s - 1 / 1 * Math.sqrt(12)) < 1e-9, 'months 2, 0, 1: mean 1, sd 1');
  assert.deepEqual(B.monthsBetween(Date.UTC(2024, 0, 31) / 1000, Date.UTC(2024, 3, 1) / 1000), ['2024-01', '2024-02', '2024-03']);
});

test('bootstrap: seeded, paired, and a rule that only removes losers wins almost every draw', () => {
  const months = B.monthsBetween(Date.UTC(2024, 0, 1) / 1000, Date.UTC(2025, 0, 1) / 1000), base = [];
  months.forEach((mo, i) => { const t = Date.parse(mo + '-10T15:00:00Z') / 1000; base.push({ id: 'w' + i, R: 2, t, closed: t + 3600 }, { id: 'l' + i, R: -1.5, t: t + 7200, closed: t + 9000 }); });
  const rule = base.filter((x) => x.R > 0);
  const p = B.bootstrap(base, rule, months, 500, 7); assert.ok(p > 0.9, String(p));
  assert.equal(B.bootstrap(base, rule, months, 500, 7), p, 'same seed, same answer');
  assert.equal(B.bootstrap(base, base, months, 200, 7), 0, 'the same book is never better than itself');
  assert.deepEqual(B.holm([0.01, 0.04, 0.03, 0.5]), [0.04, 0.09, 0.09, 0.5]);
});

test('judge: the pre-registered bar', () => {
  const base = { is: { rdd: 2, sharpe: 1 }, oos: { rdd: 4, sharpe: 1.5 } };
  assert.equal(B.judge(base, { is: { rdd: 2.5 }, oos: { rdd: 5, sharpe: 1.5 } }, 0.95, 0.08).verdict, 'PASS');
  assert.equal(B.judge(base, { is: { rdd: 2.5 }, oos: { rdd: 5, sharpe: 1.4 } }, 0.95, 0.08).verdict, 'FAIL', 'OOS Sharpe lower');
  assert.equal(B.judge(base, { is: { rdd: 1.9 }, oos: { rdd: 5, sharpe: 2 } }, 0.95, 0.08).verdict, 'FAIL', 'IS not better');
  assert.equal(B.judge(base, { is: { rdd: 2.5 }, oos: { rdd: 5, sharpe: 2 } }, 0.89, 0.08).verdict, 'FAIL', 'bootstrap under 0.9');
  assert.equal(B.judge(base, { is: { rdd: 2.5 }, oos: { rdd: 5, sharpe: 2 } }, 0.95, 0.11).verdict, 'FAIL', 'Holm over 0.10');
});

test('the published study: pre-registration hash, RESULT.md equals result.json, verdict reader', () => {
  const r = JSON.parse(read('result.json')), md = read('RESULT.md');
  assert.equal(r.planSha256, crypto.createHash('sha256').update(read('PREREGISTRATION.md')).digest('hex'));
  assert.equal(r.candidates.length, 4); assert.equal(r.testsJudged, 4);
  for (const c of r.candidates) {
    assert.ok(md.includes(`| ${c.test} | IS | ${c.is.n} |`) && md.includes(`| ${c.test} | OOS | ${c.oos.n} |`), c.test);
    assert.ok(md.includes(String(c.oos.rdd)) && md.includes(String(c.bootstrap.pBetter)), c.test);
    const ok = Object.values(c.checks).every(Boolean); assert.equal(c.verdict, ok ? 'PASS' : 'FAIL');
  }
  assert.ok(md.includes(`| as is | OOS | ${r.baseline.oos.n} |`) && md.includes(String(r.baseline.oos.rdd)));
  assert.match(md.split('\n').find((l) => l.startsWith('**Verdict')), r.candidates.some((c) => c.verdict === 'PASS') ? /PASS/ : /FAIL/);
  assert.ok(studyVerdict(r, md).verdict, 'the Edge lab reads a verdict');
});

test('the study never writes to the ICT edge and imports the engine read-only', () => {
  const src = read('run.mjs') + read('book.mjs');
  assert.ok(!/writeFileSync\([^)]*ict\//.test(src)); assert.ok(!/child_process|process\.env\.[A-Z_]*(TOKEN|KEY)/.test(src));
  assert.match(read('run.mjs'), /require\('\.\.\/\.\.\/\.\.\/api\/_ictlab\.js'\)/);
});
