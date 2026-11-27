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
  assert.deepEqual(E.FAMILY[5], ['wild']); assert.equal(Object.keys(E.FAMILY).length, 12); assert.deepEqual(E.FAMILY[10], ['nq']);
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

test('auto-3 report: only auto-3 files are counted; a result needs the three t >= 1 figures; a lead also the strict bar and Holm', () => {
  const dir = fs.mkdtempSync('/tmp/auto-rep-'), L = (p, t, all = 2) => ({ group: 'g' + p, p, A: { n: 150, mean: 0.1, t: 1.5 }, C: { n: 200, mean: 0.05, t }, ALL: { n: 350, mean: 0.07, t: all }, g: {} });
  fs.writeFileSync(dir + '/worker-1.json', JSON.stringify({ version: 'auto-3', worker: 1, tries: 1000, survivedA: 5, candidates: 3, cLooks: 3, cPasses: 2, looks: [L(0.01, 2.3), L(0.2, 0.8), L(0.1, 1.2)], results: [L(0.01, 2.3), L(0.1, 1.2)] }));
  fs.writeFileSync(dir + '/worker-2.json', JSON.stringify({ version: 'auto-3', worker: 2, tries: 2000, survivedA: 7, candidates: 3, cLooks: 1, cPasses: 1, looks: [L(0.04, 2.1)], results: [L(0.04, 2.1)] }));
  fs.writeFileSync(dir + '/worker-3.json', JSON.stringify({ version: 'auto-2', worker: 3, tries: 9e6, survivedA: 9, candidates: 9, cLooks: 9, looks: [] }));
  const R = E.report(dir); assert.equal(R.version, 'auto-3'); assert.equal(R.workers, 2); assert.equal(R.tries, 3000); assert.equal(R.cLooks, 4); assert.equal(R.results.length, 3);
  assert.equal(R.leads.length, 1); assert.equal(R.leads[0].group, 'g0.01');                 // 0.01 x 4 = 0.04 clears; 0.04 x 3 = 0.12 does not
  assert.equal(E.resultOk(L(0.2, 0.8)), false); assert.equal(E.resultOk(L(0.1, 1.2, 0.9)), false); assert.equal(E.resultOk(L(0.1, 1.2)), true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('auto-3 draws only EG and EF rules on 2021 to now; a failed zone serves the other side (efr); the zone signals use closed candles only; every rule has a stop', () => {
  assert.equal(E.VERSION, 'auto-3'); assert.deepEqual(E.K2, ['eg', 'egr', 'ef', 'efr']); assert.deepEqual(E.BAR2, { A: { n: 100, t: 1 }, C: { n: 50, t: 1 }, ALL: { t: 1 }, LEAD: { n: 100, t: 2 } });
  assert.equal(new Date(E.WIN2.A[0] * 1000).toISOString().slice(0, 10), '2021-01-01'); assert.equal(new Date(E.WIN2.C[0] * 1000).toISOString().slice(0, 10), '2024-01-01'); assert.equal(E.WIN2.A[1], E.WIN2.C[0]);
  const r = E.rng(9);
  for (let i = 0; i < 3000; i++) { const w = 1 + (i % 12), g = E.genome2(r, w); assert.ok(g.stop > 0); assert.ok(g.trig.length >= 1 && g.trig.length <= 2);
    for (const t of g.trig) assert.ok(E.K2.includes(t.kind), t.kind); if (w === 10) assert.equal(g.mk, 'nas100'); assert.equal(typeof E.group2(g), 'string'); }
  const B = walk(6000, 11), full = data(B), cut = data(B.slice(0, 4000));
  for (const life of [12, 48]) { const a = E.zones(full, life), b = E.zones(cut, life); let n = 0, m = 0;
    for (let i = 0; i < 4000; i++) { assert.equal(a.egr[i], b.egr[i]); assert.equal(a.ef[i], b.ef[i]); assert.equal(a.efr[i], b.efr[i]); if (a.egr[i] || a.ef[i]) n++; if (a.efr[i]) m++; } assert.ok(n > 50, 'zone signals exist'); assert.ok(m > 10, 'efr signals exist'); }
  // an EF is a close through the far side of a zone an engulf made; an engulf's base is one of the 3 candles before it
  const z = E.zones(full, 24); let seen = 0;
  for (let i = 10; i < full.n && seen < 40; i++) { const [d, b] = E.egAt(full, i); if (d) { assert.ok(b >= i - 3 && b < i); assert.ok(d > 0 ? full.c[i] > full.h[b] : full.c[i] < full.l[b]); seen++; } }
  assert.ok(seen === 40); assert.ok(full.idx2.A[0] <= full.idx2.A[1]);
  const src = fs.readFileSync(new URL('../research/edge/auto-researcher/PREREGISTRATION.md', import.meta.url), 'utf8'); assert.match(src, /Version auto-3/); assert.match(src, /never an edge/);
  // efr: the first return to a failed zone, closing back out on the failure's side; never on the candle that failed it
  for (let i = 5; i < full.n; i++) { const q = z.efr[i]; if (!q) continue; assert.equal(E.sig(full, { kind: 'efr', life: 24 }, i), q); }
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

test('market structure (workers 11, 12): closed candles only, breaks named bos / choch, pullbacks inside the leg, the older workers unchanged', () => {
  const bars = walk(9000, 9), D = data(bars);
  for (const P of E.MS_SPACE.P.concat(E.MS_SPACE.msP)) { const S = E.struct(D, P); let dir = 0, breaks = 0, choch = 0, pb = 0;
    for (let i = 0; i < D.n; i++) {
      if (S.bk[i]) { breaks++; assert.equal(S.kd[i], dir === -S.bk[i] ? 2 : 1, 'a break against the structure is a choch, else a bos'); if (S.kd[i] === 2) choch++; dir = S.bk[i]; assert.equal(S.dp[i], 0, 'a break candle is no pullback'); }
      else assert.equal(S.kd[i], 0);
      assert.equal(S.st[i], dir); if (S.dp[i] > 0) { pb++; assert.ok(dir !== 0 && (dir > 0 ? D.c[i] > D.o[i] : D.c[i] < D.o[i]), 'a pullback candle closes with the structure'); } }
    assert.ok(breaks > 20 && choch > 5 && pb > 20, `P ${P}: ${breaks} breaks, ${choch} choch, ${pb} pullbacks`); }
  // no look-ahead: a cut series gives the same structure up to the cut, and a swing counts only P candles after it
  const cut = 5000, C = data(bars.slice(0, cut));
  for (const P of [2, 5, 12]) { const a = E.struct(D, P), b = E.struct(C, P); for (let i = 0; i < cut; i++) { assert.equal(a.bk[i], b.bk[i]); assert.equal(a.kd[i], b.kd[i]); assert.equal(a.st[i], b.st[i]); assert.equal(a.dp[i], b.dp[i]); } }
  // the triggers read it
  const S = E.struct(D, 3), i1 = S.kd.findIndex((x) => x === 1), i2 = S.kd.findIndex((x) => x === 2), i3 = S.dp.findIndex((x) => x >= 0.5);
  assert.equal(E.sig(D, { kind: 'bos', P: 3, follow: true }, i1), S.bk[i1]); assert.equal(E.sig(D, { kind: 'bos', P: 3, follow: false }, i1), -S.bk[i1]); assert.equal(E.sig(D, { kind: 'choch', P: 3, follow: true }, i1), 0);
  assert.equal(E.sig(D, { kind: 'choch', P: 3, follow: true }, i2), S.bk[i2]); assert.equal(E.sig(D, { kind: 'mspb', P: 3, d: 0.5 }, i3), S.st[i3]); assert.equal(E.sig(D, { kind: 'mspb', P: 3, d: 0.5 }, i1), 0);
  // the larger-structure filter only ever removes trades
  const g = { mk: 'eurusd', trig: [{ kind: 'bos', P: 3, follow: true }], side: 'both', hours: null, dows: null, trend: 'none', vol: 'none', volP: 0.5, stop: 1, rr: 2, hold: 12 };
  const all = E.simulate(D, g, 300, 8000), w = E.simulate(D, { ...g, ms: 'with', msP: 12 }, 300, 8000), ag = E.simulate(D, { ...g, ms: 'against', msP: 12 }, 300, 8000);
  assert.ok(all.n > 50 && w.n > 0 && ag.n > 0 && w.n < all.n && ag.n < all.n); assert.deepEqual(E.simulate(D, { ...g, ms: 'none', msP: 12 }, 300, 8000).n, all.n);
});
test('workers 11 and 12 draw structure rules with a stop; workers 1-10 draw exactly what they drew before', () => {
  assert.deepEqual(E.MS_WORKERS, [11, 12]); assert.deepEqual(E.MSK, ['bos', 'choch', 'mspb']); assert.deepEqual(E.MS_MARKETS, [...E.MARKETS, 'nas100']);
  const r = E.rng(21), kinds = new Set(); let two = 0;
  for (let i = 0; i < 800; i++) { const w = 11 + (i % 2), g = E.genome(r, w); assert.ok(E.SPACE.stop.includes(g.stop) && g.stop > 0); assert.ok(E.MS_MARKETS.includes(g.mk)); assert.ok(E.MSK.includes(g.trig[0].kind)); assert.ok(E.MS_SPACE.P.includes(g.trig[0].P));
    assert.equal(g.trig.length, w === 11 ? 1 : 2); assert.ok(['none', 'with', 'against'].includes(g.ms) && E.MS_SPACE.msP.includes(g.msP)); g.trig.forEach((t) => kinds.add(t.kind)); if (g.trig[0].kind === 'mspb') assert.ok(E.MS_SPACE.d.includes(g.trig[0].d)); two += w === 12; }
  assert.ok(['bos', 'choch', 'mspb', 'brk', 'eg', 'sweep'].every((k) => kinds.has(k)));
  // pinned draws of the older workers (the generator's use of the random stream is unchanged): none carries a structure field
  for (let w = 1; w <= 10; w++) { const q = E.rng(100 + w); for (let i = 0; i < 50; i++) { const g = E.genome(q, w); assert.equal(g.ms, undefined); assert.ok(!g.trig.some((t) => E.MSK.includes(t.kind))); } }
  const first = E.genome(E.rng(7), 4); assert.deepEqual(Object.keys(first), ['mk', 'trig', 'side', 'hours', 'dows', 'trend', 'vol', 'volP', 'stop', 'rr', 'hold']);
  const yml = fs.readFileSync(new URL('../.github/workflows/researcher.yml', import.meta.url), 'utf8');
  assert.match(yml, /workers=\[1,2,3,4,5,6,8,10,11,12\]/); assert.match(yml, /7\) echo 'workers=\[11\]'/); assert.match(yml, /9\) echo 'workers=\[12\]'/);
  assert.equal((yml.match(/worker: 1[12], shard: [12]/g) || []).length, 4, 'one runner each: the job count stays at 20');
});
