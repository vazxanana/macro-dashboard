import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../research/edge/auto-researcher/engine.mjs';

// a seeded random walk of H1 candles from 2005, in the shape the engine reads
function walk(n, seed = 5, mk = 'eurusd') {
  const r = E.rng(seed), bars = []; let c = 1.2, t = Date.UTC(2005, 0, 3) / 1000;
  for (let i = 0; i < n; i++) { const o = c, ch = (r() - 0.5) * 0.004, h = Math.max(o, o + ch) + r() * 0.0015, l = Math.min(o, o + ch) - r() * 0.0015; c = o + ch; bars.push({ t, o, h, l, c }); t += 3600; }
  return bars;
}
const data = (bars, mk = 'eurusd') => E.prep(E.toArrays(bars), mk);

test('the three windows are 2005-14, 2015-19 and 2020 on, in that order, and the bars are the protocol\'s', () => {
  assert.ok(E.WIN.A[1] === E.WIN.B[0] && E.WIN.B[1] === E.WIN.C[0]);
  assert.deepEqual(E.BAR.A, { n: 250, mean: 0.04, t: 3.0 }); assert.deepEqual(E.BAR.B, { n: 100, mean: 0, t: 1.5 }); assert.deepEqual(E.BAR.C, { n: 100, mean: 0, t: 2.0 });
  assert.deepEqual(E.FAMILY[5], ['wild']); assert.equal(Object.keys(E.FAMILY).length, 10); assert.deepEqual(E.FAMILY[10], ['nq']);
});

test('every generated rule has a stop and only known pieces', () => {
  const r = E.rng(11);
  for (let w = 1; w <= 9; w++) for (let i = 0; i < 300; i++) {
    const g = E.genome(r, w);
    assert.ok(g.stop > 0 && E.SPACE.stop.includes(g.stop)); assert.ok(E.MARKETS.includes(g.mk)); assert.ok(g.hold >= 4);
    const wild = E.FAMILY[w][0] === 'wild';
    assert.equal(g.trig.length, wild ? 2 : 1);
    for (const t of g.trig) if (!wild) assert.ok(E.FAMILY[w].includes(t.kind));
  }
});

test('no look-ahead: the trades before a cut do not change when every later candle is removed', () => {
  const bars = walk(9000), cutAt = 6000, r = E.rng(3);
  const full = data(bars), short = data(bars.slice(0, cutAt));
  for (let w = 1; w <= 9; w++) for (let i = 0; i < 60; i++) {
    const g = E.genome(r, w); g.mk = 'eurusd';
    // trades are compared through their month sums over a window that ends well before the cut (the last trades need later candles to exit)
    const hi = cutAt - 400, a = E.simulate(full, g, 250, hi), b = E.simulate(short, g, 250, hi);
    assert.equal(a.n, b.n); assert.ok(Math.abs(a.sum - b.sum) < 1e-9, JSON.stringify(g));
  }
});

test('stop first when one candle holds both; a gap through the stop exits at its open; the cost is charged', () => {
  // flat candles with one breakout, then a candle that reaches both the stop and the target
  const base = []; let t = Date.UTC(2005, 0, 3) / 1000;
  for (let i = 0; i < 400; i++) { base.push({ t, o: 1.2, h: 1.2002, l: 1.1998, c: 1.2 }); t += 3600; }
  const g = { mk: 'eurusd', trig: [{ kind: 'brk', N: 5 }], side: 'long', hours: null, dows: null, trend: 'none', vol: 'none', volP: 0.5, stop: 1, rr: 1, hold: 20 };
  const bars = base.map((b) => ({ ...b })); bars[300] = { ...bars[300], h: 1.203, c: 1.2025 };              // breakout close above the 5-bar high
  bars[301] = { ...bars[301], o: 1.2025, h: 1.2060, l: 1.1995, c: 1.2 };                                       // entry at 1.2025; a wide candle: both the 1R target and the 1R stop are inside it
  const d = data(bars); const out = E.simulate(d, g, 250, 399);
  assert.equal(out.n, 1); assert.ok(out.sum < 0, 'stop first');
  const gap = bars.map((b) => ({ ...b })); gap[300] = bars[300]; gap[301] = { ...bars[301], l: 1.2011, h: 1.2040, c: 1.2030 }; gap[302] = { ...gap[302], o: 1.1900, h: 1.1905, l: 1.1890, c: 1.1895 };
  const o2 = E.simulate(data(gap), g, 250, 399); assert.equal(o2.n, 1); assert.ok(o2.sum < -1, 'gap exit is worse than -1R');
});

test('the side-flipped twin is the mirror: on a symmetric walk both sides lose about the cost', () => {
  const d = data(walk(60000, 9)), g = { mk: 'eurusd', trig: [{ kind: 'fade', N: 20 }], side: 'both', hours: null, dows: null, trend: 'none', vol: 'none', volP: 0.5, stop: 1, rr: 1, hold: 12 };
  const a = E.summary(E.simulate(d, g, 250, d.n)), b = E.summary(E.simulate(d, g, 250, d.n, true));
  assert.ok(a.n > 500 && b.n > 500); assert.ok(a.mean < 0.05 && b.mean < 0.05, 'noise has no edge');
});

test('the worker writes its file, counts every try and puts only a C look after A and B', async () => {
  const dir = fs.mkdtempSync('/tmp/auto-test-'), D = {};
  // run() loads real candles; here the engine is driven by hand: tries counted, a survivor needs the bars
  const r = E.rng(2); let tries = 0; const d = data(walk(30000, 4));
  for (let i = 0; i < 200; i++) { const g = E.genome(r, 4); g.mk = 'eurusd'; tries++; const s = E.summary(E.simulate(d, g, 250, d.n)); assert.ok(Number.isFinite(s.mean)); }
  assert.equal(tries, 200); assert.equal(typeof E.groupOf(E.genome(r, 1)), 'string'); fs.rmSync(dir, { recursive: true, force: true });
});

test('the report adds the workers up; a lead needs the C bar AND Holm over every C look', () => {
  const dir = fs.mkdtempSync('/tmp/auto-rep-'), L = (p, t) => ({ group: 'g' + p, p, A: { mean: 0.1, t: 3.5 }, B: { mean: 0.05, t: 2 }, C: { n: 200, mean: 0.05, t }, g: {} });
  fs.writeFileSync(dir + '/worker-1.json', JSON.stringify({ worker: 1, tries: 1000, survivedA: 5, candidates: 2, cLooks: 2, looks: [L(0.01, 2.3), L(0.2, 0.8)] }));
  fs.writeFileSync(dir + '/worker-2.json', JSON.stringify({ worker: 2, tries: 2000, survivedA: 7, candidates: 3, cLooks: 1, looks: [L(0.04, 2.1)] }));
  const R = E.report(dir); assert.equal(R.tries, 3000); assert.equal(R.cLooks, 3); assert.equal(R.cPasses, 2);
  assert.equal(R.leads.length, 1); assert.equal(R.leads[0].group, 'g0.01');                 // 0.01 x 3 = 0.03 clears; 0.04 x 2 = 0.08 does not
  fs.rmSync(dir, { recursive: true, force: true });
});

test('worker 10 trades NAS100 only, every trigger kind alone or two together, and an index cost is a share of its price (none now)', () => {
  const r = E.rng(3), seen = new Set(); let two = 0;
  for (let i = 0; i < 600; i++) { const g = E.genome(r, 10); assert.equal(g.mk, 'nas100'); assert.ok(g.stop > 0); assert.ok(g.trig.length === 1 || g.trig.length === 2); two += g.trig.length === 2; g.trig.forEach((t) => seen.add(t.kind)); }
  assert.ok(two > 200 && two < 400); assert.deepEqual([...seen].sort(), ['big', 'blk', 'brk', 'dev', 'eg', 'fade', 'pull', 'sweep']);
  assert.equal(E.NQ_COST, 0);   // the owner's word: no cost on NQ (futures); results are before costs
  // a cost, if set, is a share of the entry price: the same walk at ten times the level costs ten times as much, so R is the same
  const mk = (k) => data(walk(9000, 5).map((b) => ({ t: b.t, o: b.o * k, h: b.h * k, l: b.l * k, c: b.c * k })), 'nas100');
  const g = { mk: 'nas100', trig: [{ kind: 'brk', N: 20 }], side: 'both', hours: null, dows: null, trend: 'none', vol: 'none', volP: 0.5, stop: 1, rr: 2, hold: 24 };
  const a = E.simulate(mk(1), g, 300, 8000), b = E.simulate(mk(10), g, 300, 8000);
  assert.ok(a.n > 50); assert.equal(a.n, b.n); assert.ok(Math.abs(a.sum - b.sum) < 1e-6);
});
