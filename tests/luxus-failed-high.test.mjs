// Study 143, research/edge/luxus-failed-high: the rule on hand-made candles (trend state, failed new high, BO sell, zone of the
// break, stop on the losing side), no look-ahead, fills, costs, month-sum t, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detectSells, boEvents, stateWalker, agg, simulate, costR, monthT, mirror, K, WIN, holm } from '../research/edge/luxus-failed-high/run.mjs';
import { nights, FIN } from '../council/fills.mjs';

const DIR = new URL('../research/edge/luxus-failed-high/', import.meta.url);
// a rising wave (H4 and H1 bullish when it ends on a rising phase), then: up to P, down to L, up to a lower high A, down through L
function build(N, { higherA = false } = {}) {
  const t0 = Date.UTC(2024, 0, 1) / 1000, B = [];
  const add = (c, w = 0) => { const o = B.length ? B.at(-1).close : c; B.push({ time: t0 + B.length * 300, open: o, high: Math.max(o, c) + 0.2 + Math.max(w, 0), low: Math.min(o, c) - 0.2 + Math.min(w, 0), close: c }); };
  for (let i = 0; i < N; i++) add(2000 + i * 0.05 + 20 * Math.sin(i * 2 * Math.PI / 384) + 3 * Math.sin(i * 2 * Math.PI / 48));
  const last = B.at(-1).close, path = [], top = higherA ? 12 : 7.5;
  for (let k = 1; k <= 6; k++) path.push(last + k * 1.5);
  for (let k = 1; k <= 4; k++) path.push(last + 9 - k * 1.5);
  if (higherA) for (let k = 1; k <= 6; k++) path.push(last + 3 + k * 1.5); else for (let k = 1; k <= 3; k++) path.push(last + 3 + k * 1.5);
  const aI = path.length - 1;
  for (let k = 1; k <= 4; k++) path.push(last + top - k * 1.5);
  if (higherA) path.push(last + 3, last + 1.5);
  path.forEach((c, k) => add(c, k === 5 || k === aI ? 0.5 : k === 9 ? -0.5 : 0));
  return { B, last };
}

test('BO events: a close above the last unbroken swing high is a BO buy, each swing broken once, closed candles only', () => {
  const c = (time, h, l, cl) => ({ time, open: cl, high: h, low: l, close: cl });
  const B = [c(0, 10, 9, 9.5), c(1, 12, 10, 11), c(2, 11, 9.5, 10), c(3, 10.5, 9, 9.5), c(4, 12.5, 10, 12.2), c(5, 13, 12, 12.8)];
  const ev = boEvents(B, 1, 1);   // swing high at 1 (12) exists from the close of candle 2; candle 4 closes above it
  assert.deepEqual(ev, [{ at: 5, side: 1 }]);
  const st = stateWalker(ev); assert.equal(st(4.9), 0); assert.equal(st(5), 1);
});

test('the rule: H4 and H1 bullish, a failed new high, then the close below the previous low gives one sell at the zone of the break', () => {
  const { B, last } = build(1824), r = detectSells(B), g = r.signals.at(-1);
  assert.equal(r.signals.length, 1); assert.equal(g.i, B.length - 1);
  assert.equal(r.s4(g.placed), 1); assert.equal(r.s1(g.placed), 1);
  assert.ok(Math.abs(g.entry - (last + 3 - 0.7)) < 1e-9, 'entry = the broken swing low');
  assert.ok(Math.abs(g.stop - (B[g.i].high + K.PAD)) < 1e-3, 'stop = the break candle high + $0.30');
  assert.ok(g.stop > g.entry && g.r0 >= K.MIN_R0, 'a stop on the losing side');
});

test('no sell while H1 is bearish, and none when the second high is a new high', () => {
  assert.equal(detectSells(build(1728).B).signals.length, 0);
  assert.equal(detectSells(build(1824, { higherA: true }).B).signals.length, 0);
});

test('no look-ahead: candles after a signal never change it', () => {
  const { B } = build(1824), a = detectSells(B).signals;
  const more = [...B]; for (let k = 1; k <= 300; k++) { const c = 1900 + 50 * Math.sin(k); more.push({ time: B.at(-1).time + k * 300, open: c, high: c + 40, low: c - 40, close: c }); }
  const b = detectSells(more).signals.filter((s) => s.i < B.length);
  assert.deepEqual(b.map(({ barrier, ...x }) => x), a.map(({ barrier, ...x }) => x));
  const { B: M } = build(1824); assert.deepEqual(mirror(mirror(M)), M);
});

test('fills: stop first when a candle holds both; target before the fill is a miss; a buy pays financing', () => {
  const t = 1700000000, bar = (i, o, h, l, c) => ({ time: t + i * 300, open: o, high: h, low: l, close: c });
  const o = { side: -1, placed: t, entry: 100, stop: 102, target: 96, r0: 2 };
  assert.equal(simulate([bar(0, 99, 100.5, 98, 99), bar(1, 99, 103, 95, 100)], o).exit, 'stop');
  assert.equal(simulate([bar(0, 99, 99.5, 95, 96)], o).status, 'missed');
  const sell = { side: -1, entry: 4000, r0: 2, filled: t, closed: t + 3 * 86400 };
  assert.equal(costR(sell), 0.30);
  const buy = { ...sell, side: 1 }, n = nights(buy.filled, buy.closed);
  assert.ok(n > 0); assert.ok(Math.abs(costR(buy) - (0.30 + n * FIN.xau.long * 4000 / 2)) < 1e-12);
  assert.ok(Math.abs(costR(buy, 2) - 2 * costR(buy)) < 1e-12);
});

test('month-sum t counts empty months as zero; Holm is monotone', () => {
  const m = (y, mo) => Date.UTC(y, mo, 15) / 1000, tr = [{ closed: m(2024, 0), net: 1 }, { closed: m(2024, 2), net: 2 }];
  const r = monthT(tr, 'net', [Date.UTC(2024, 0, 1) / 1000, Date.UTC(2024, 3, 1) / 1000]);
  assert.equal(r.months, 3); assert.equal(r.t, 1.73);
  assert.deepEqual(holm({ a: 0.01, b: 0.04, c: 0.5 }), { a: 0.03, b: 0.08, c: 0.5 });
  assert.ok(WIN.is[1] === WIN.oos[0] && WIN.rep[1] === WIN.is[0]);
});

test('the report says what result.json holds', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR))), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.length < 260 && /FAIL/.test(line) && R.verdict.startsWith('FAIL'));
  const f = (x, d = 2) => x.toFixed(d).replace('-', '−'), T1 = R.tests.T1;
  assert.ok(line.includes(`${f(T1.oos.net)}R`) && line.includes(`n ${T1.oos.n}`) && line.includes(`t ${f(T1.oos.tNet)}`) && line.includes(`${f(T1.is.net)}R`));
  assert.ok(line.includes(`${f(T1.oos.gross)}R`) && line.includes(`${Math.round(T1.placebo.oosShareAtOrAbove * 100)} %`));
  for (const k of ['T1', 'T2', 'T3']) {
    const T = R.tests[k]; assert.equal(T.primary.verdict, 'FAIL'); assert.equal(T.placebo.oosMeans.length, 40);
    for (const w of ['is', 'oos']) assert.ok(md.includes(`| ${T[w].n.toLocaleString('en-US')} |`) && md.includes(f(T[w].net, 3)) && md.includes(f(T[w].tNet)), `${k} ${w}`);
  }
  assert.ok(fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8').includes('Closest prior study: `research/edge/mosha-level`'));
});
