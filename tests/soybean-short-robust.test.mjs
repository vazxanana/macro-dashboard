// Soybean short robustness checks (research/edge/soybean-short-robust): the frozen copy of grain-seasonality's run.mjs is
// unchanged, the window shifts on a hand-made calendar, the stop multiple is put back, the verdict rule, and the written report
// against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { P, prep, windowOf, atrBefore } from '../research/edge/soybean-short-robust/frozen.mjs';
import { FROZEN_SHA256, PUBLISHED, SHIFTS, STOPS, shifted, rowsFor, withK, aprJun, verdictOf } from '../research/edge/soybean-short-robust/run.mjs';

const dir = new URL('../research/edge/soybean-short-robust/', import.meta.url);
const rd = (f) => fs.readFileSync(new URL(f, dir), 'utf8');
const PRE = rd('PREREGISTRATION.md'), RES = rd('RESULT.md'), J = JSON.parse(rd('result.json'));
const DAY = 86400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
function cal(from, to) {
  const rows = [];
  for (let t = Date.UTC(from[0], from[1] - 1, from[2]) / 1000; t <= Date.UTC(to[0], to[1] - 1, to[2]) / 1000; t += DAY) rows.push([t, 100, 101, 99, 100, 1]);
  return rows;
}
const sg = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(3);

test('frozen.mjs is grain-seasonality run.mjs byte for byte (pinned hash)', () => {
  const h = createHash('sha256').update(fs.readFileSync(new URL('frozen.mjs', dir))).digest('hex');
  assert.equal(h, FROZEN_SHA256);
  assert.equal(h, 'e9ba1c2776dacb6df7f2759ea4f7caa5644e156cca7d51308438cccc90b80159');
  assert.ok(PRE.includes(FROZEN_SHA256));
  assert.equal(J.frozen.sha256, FROZEN_SHA256);
});

test('the pre-registered variants', () => {
  assert.deepEqual(SHIFTS, [-10, -5, 5, 10]); assert.deepEqual(STOPS, [2, 4]);
  assert.match(PRE, /s = -10, -5, \+5, \+10/); assert.match(PRE, /\*\*2 x\*\* and \*\*4 x\*\* ATR\(20\)/);
  assert.deepEqual(J.r1.map((v) => v.shift), SHIFTS); assert.deepEqual(J.r2.map((v) => v.k), STOPS);
});

test('window shifts move both ends by weekday candles on a hand-made calendar', () => {
  const B = prep(cal([2021, 3, 1], [2021, 11, 10]));
  const w = shifted(B, 2021, 0);
  assert.deepEqual([ymd(B[w[0]].time), ymd(B[w[1]].time)], ['2021-07-01', '2021-09-30']);
  const p5 = shifted(B, 2021, 5);                    // five weekdays later: Thu 1 Jul -> Thu 8 Jul, Thu 30 Sep -> Thu 7 Oct
  assert.deepEqual([ymd(B[p5[0]].time), ymd(B[p5[1]].time)], ['2021-07-08', '2021-10-07']);
  const m10 = shifted(B, 2021, -10);                 // ten weekdays earlier: Thu 17 Jun, Thu 16 Sep
  assert.deepEqual([ymd(B[m10[0]].time), ymd(B[m10[1]].time)], ['2021-06-17', '2021-09-16']);
  assert.equal(p5[1] - p5[0], w[1] - w[0]);
  const C = prep(cal([2021, 3, 1], [2021, 10, 8]));  // the data ends before the +10 exit
  assert.equal(shifted(C, 2021, 10), null);
  assert.ok(shifted(C, 2021, 5));
});

test('the stop multiple is set for one run and put back, also on an error', () => {
  const k0 = P.K, B = prep(cal([2021, 3, 1], [2021, 11, 10])), [i0] = shifted(B, 2021, 0);
  const [r] = rowsFor(B, [2021], { k: 2 });
  assert.equal(r.stop, +(B[i0].open + 2 * atrBefore(B, i0)).toFixed(4));
  assert.equal(P.K, k0);
  assert.throws(() => withK(4, () => { throw new Error('x'); }));
  assert.equal(P.K, k0);
  assert.equal(rowsFor(B, [2021], {})[0].stop, +(B[i0].open + 3 * atrBefore(B, i0)).toFixed(4));
});

test('April-June move reads the first April open and the last June close', () => {
  const B = prep(cal([2021, 3, 1], [2021, 11, 10]));
  const w = windowOf(B, 2021, 4); B[w[0]].open = 80; B[w[1]].close = 100;
  assert.equal(aprJun(B, 2021), 0.25);
});

test('verdict rule', () => {
  const v = (x) => ({ decisive: { meanNet: x } });
  const off = { available: false };
  assert.equal(verdictOf([v(1), v(1), v(1), v(1)], [v(1), v(1)], off), 'ROBUST');
  assert.equal(verdictOf([v(1), v(1), v(1), v(-0.01)], [v(1), v(1)], off), 'FRAGILE');
  assert.equal(verdictOf([v(1), v(1), v(1), v(1)], [v(0), v(1)], off), 'FRAGILE');
  assert.equal(verdictOf([v(1), v(1), v(1), v(1)], [v(1), v(1)], { available: true, decisive: { meanNet: -1 } }), 'FRAGILE');
});

test('gate: the frozen code reproduced the published T2 figures', () => {
  assert.equal(J.gate.pass, true);
  for (const s of ['decisive', 'replication']) {
    assert.deepEqual(PUBLISHED[s], J.gate[s].published);
    for (const k of ['n', 'won', 'meanNet', 'perm']) assert.equal(J.gate[s][k], PUBLISHED[s][k]);
  }
  // the published per-year net R of T2 (grain-seasonality RESULT.md)
  assert.deepEqual(J.base.years.decisive.map((r) => r.net), [2.261, -1.064, 0.24, 0.046, -1.172, 1.084, 1.72, 2.085, 1.084, 0.495, -1.055]);
  assert.deepEqual(J.base.years.replication.map((r) => r.net), [-1.167, 3.294, -1.03, 1.768, -1.042, 3.773, 2.724, -1.057, -1.053, -1.041, 2.167, 5.498, 2.584]);
});

test('the report against result.json', () => {
  assert.equal(J.verdict, verdictOf(J.r1, J.r2, J.r4));
  assert.ok(RES.startsWith(`**Verdict: ${J.verdict}.**`));
  assert.equal(J.r4.available, false);
  for (const v of J.r1) {
    const d = v.decisive, lab = `window ${v.shift > 0 ? '+' : '−'}${Math.abs(v.shift)} trading days`;
    assert.ok(RES.includes(`| R1 | ${lab} | ${d.n} | ${d.won} | ${d.stopped} | ${sg(d.meanG)} | ${sg(d.meanNet)} |`), lab);
    assert.ok(RES.includes(`### R1, window shifted ${v.shift > 0 ? '+' : '−'}${Math.abs(v.shift)} trading days`));
    for (const r of v.years.decisive) assert.ok(RES.includes(`| dec | ${r.year} | ${r.entryDay} | ${r.exitDay} | ${r.entry} | ${r.stop} | ${r.exit} | ${r.why} | ${sg(r.g)} |`), `${lab} ${r.year}`);
  }
  for (const v of J.r2) {
    const d = v.decisive;
    assert.ok(RES.includes(`| R2 | stop ${v.k} x ATR(20) | ${d.n} | ${d.won} | ${d.stopped} | ${sg(d.meanG)} | ${sg(d.meanNet)} |`));
  }
  for (const [s, lab] of [['decisive', '2016-26'], ['replication', '2003-15']]) for (const h of ['rose', 'fell']) {
    const x = J.r3[s][h];
    assert.ok(RES.includes(`| ${lab} | ${h} | ${x.n} | ${x.won} | ${sg(x.meanNet)} |`), `${lab} ${h}`);
  }
  assert.ok(RES.includes(sg(J.r1.find((v) => v.shift === 10).decisive.meanNet) + 'R a year net'));
  assert.doesNotMatch(RES.replace(/not an edge|Nothing here is an edge/g, ''), /\bis an edge\b/);
});
