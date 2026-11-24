// tests/pdhl-sweep-m5-shift.test.mjs - offline checks of research/edge/pdhl-sweep-m5-shift (24 Nov 2026): the signal on seeded
// candles (no look-ahead, what a signal must satisfy, the stop on the losing side), the trade engine, and RESULT.md against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { signals, exits, trade, cutTest, headline, cellName, lower, P, NCELL, mstat, p1 } from '../research/edge/pdhl-sweep-m5-shift/run.mjs';

const DIR = new URL('../research/edge/pdhl-sweep-m5-shift/', import.meta.url);
function seeded(seed, days = 70) {
  const rnd = K.rng(seed), B = []; let p = 100; const t0 = Date.UTC(2021, 0, 4) / 1000;
  for (let d = 0; d < days; d++) { const day = t0 + d * 86400, wd = new Date(day * 1000).getUTCDay(); if (wd === 6 || wd === 0) continue;
    for (let i = 0; i < 288; i++) { const o = p, c = o + (rnd() - 0.5) * 0.4, h = Math.max(o, c) + rnd() * 0.15, l = Math.min(o, c) - rnd() * 0.15; p = c;
      B.push({ t: day + i * 300, o, h, l, c, e: day + i * 300 + 300 }); } }
  return B;
}

test('signals on seeded candles: what a sweep and its M5 break must satisfy', () => {
  const M5 = seeded(11), S = signals(M5), T = K.resample(M5, 900);
  assert.ok(S.length > 20, 'sweeps found'); const C = S.filter((g) => g.conf); assert.ok(C.length > 5, 'confirmed ones');
  for (const g of S) {
    assert.equal(g.s, -g.e);
    assert.ok(g.e > 0 ? g.X > g.pd : g.X < g.pd, 'the extreme is beyond the previous day level');
    const m = T.find((b) => b.e === g.tm); assert.ok(g.e > 0 ? m.c < g.pd : m.c > g.pd, 'the M15 candle closes back inside');
    assert.ok(!(g.conf && g.cancelled));
  }
  for (const g of C) {
    assert.ok(g.te >= g.tm, 'never before the M15 close back');
    assert.ok(g.te <= g.tm + P.waitM5 * 300, 'inside the waiting window');
    assert.ok(g.e > 0 ? g.L < g.X : g.L > g.X);
    const k = M5.filter((b) => b.e <= g.te && b.t >= g.tm - 3600 - 900 && (g.e > 0 ? b.c < g.L : b.c > g.L)); assert.ok(k.length >= 1, 'an M5 close beyond the swing level by the entry moment');
    // between the M15 close back and the entry, the extreme was not taken out
    for (const b of M5) if (b.t >= g.tm && b.e <= g.te) assert.ok(g.e > 0 ? b.h <= g.X : b.l >= g.X);
    const tr = trade(M5, g, g.te, 0);
    if (tr) { assert.ok(tr.s * (tr.fill - tr.stop) > 0, 'stop on the losing side'); assert.ok(tr.t >= g.te, 'filled after the signal is known');
      assert.ok(g.e > 0 ? tr.stop > g.X : tr.stop < g.X, 'stop past the sweep extreme'); assert.ok(Number.isFinite(tr.R[1])); assert.ok(tr.R[1] <= 2 + 1e-9);
      if (Number.isFinite(tr.R[0])) assert.ok(tr.s * (g.open - tr.fill) >= tr.risk - 1e-12, 'the open target is 1R or more away'); }
  }
  assert.ok(C.some((g) => trade(M5, g, g.te, 0)));
});

test('no look-ahead: cut candles give the same signals, and later prices do not move earlier ones', () => {
  const M5 = seeded(5);
  for (const r of cutTest(M5, ['2021-01-21', '2021-02-10', '2021-03-03'])) { assert.ok(r.same, r.cut); assert.ok(r.n > 0); }
  const cutT = Date.UTC(2021, 1, 10, 13, 35) / 1000, rnd = K.rng(99);
  const M2 = M5.map((b) => (b.e <= cutT ? b : { ...b, o: b.o + 50, h: b.h + 50 + rnd(), l: b.l + 50 - rnd(), c: b.c + 50 }));
  const key = (g) => [g.e, g.day, g.X, g.tm, g.te, g.L, g.a].join('|');
  const a = signals(M5).filter((g) => g.conf && g.te <= cutT).map(key), b = signals(M2).filter((g) => g.conf && g.te <= cutT).map(key);
  assert.ok(a.length > 3); assert.deepEqual(a, b);
  // a trade's fill is the first candle at or after the entry moment
  const g = signals(M5).find((x) => x.conf && trade(M5, x, x.te, 0)); const tr = trade(M5, g, g.te, 0);
  assert.equal(tr.t, M5[lower(M5, g.te)].t); assert.equal(tr.fill, M5[lower(M5, g.te)].o);
  // a risk under the cost is no trade
  assert.equal(trade(M5, g, g.te, tr.risk * 2), null);
});

test('the trade engine: stop first, gaps, several targets, time limit', () => {
  const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
  let r = exits([bar(0, 100, 100.2, 99.8, 100), bar(300, 100, 100.1, 98.5, 99), bar(600, 99, 101.5, 99, 101)], -1, 0, 101, [99, 98], 86400);
  assert.deepEqual(r.R, [1, -1]);
  r = exits([bar(0, 100, 100, 100, 100), bar(300, 100, 101.2, 98.9, 100)], -1, 0, 101, [99, NaN], 86400); assert.equal(r.R[0], -1); assert.ok(Number.isNaN(r.R[1]));
  r = exits([bar(0, 100, 100, 100, 100), bar(300, 102, 102.5, 101.8, 102)], -1, 0, 101, [99, NaN], 86400); assert.equal(r.R[0], -2);
  r = exits([bar(0, 100, 100.1, 99.9, 100), bar(300, 100, 100.2, 99.6, 99.6)], -1, 0, 101, [98, NaN], 600); assert.ok(Math.abs(r.R[0] - 0.4) < 1e-9);
  assert.equal(exits([bar(0, 100, 100, 100, 100)], -1, 0, 99, [98, NaN], 600), null);
  assert.equal(exits([bar(0, 100, 100.1, 99.9, 100)], 1, 0, 99, [102, NaN], 86400), null); // still open at the end
  const s = mstat([1, 2, 3, 4]); assert.ok(Math.abs(s.mean - 2.5) < 1e-12); assert.ok(p1(3, 100) < 0.01 && p1(-3, 100) > 0.99);
});

test('RESULT.md and result.json agree, and the verdict follows the pre-registered bar', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8').split('\n');
  assert.equal(md[2], R.headline); assert.equal(headline(R), R.headline); assert.match(md[2], /^\*\*Verdict: (PASS|FAIL|INCONCLUSIVE)\. /);
  assert.equal(R.cells.length, NCELL); R.cells.forEach((c, i) => assert.equal(c.cell, cellName(i)));
  for (const c of R.cells) { const d = c.discovery, k = c.confirmation;
    assert.equal(c.pass, d.n >= 300 && k.n >= 300 && d.netR > 0 && d.tNet >= 2 && k.netR > 0 && k.tNet >= 2 && c.holm < 0.05);
    for (const w of [d, k]) if (w.n) assert.ok(w.netR <= w.grossR, 'after costs is never above before costs'); }
  const passed = R.cells.filter((c) => c.pass).length; assert.equal(R.passed, passed);
  assert.equal(R.verdict, passed ? 'PASS' : R.cells.some((c) => c.enough) ? 'FAIL' : 'INCONCLUSIVE');
  const best = [...R.cells].sort((a, b) => b.confirmation.netR - a.confirmation.netR)[0]; assert.equal(R.best.cell, best.cell);
  const f = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3) + 'R';
  assert.ok(md[2].includes(f(best.confirmation.netR)) && md[2].includes(f(best.discovery.netR)) && md[2].includes(best.confirmation.n.toLocaleString('en-US')));
  assert.ok(R.cutTest.every((c) => c.same)); assert.deepEqual(R.markets, ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd']);
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8'); for (const c of R.cells) assert.ok(pre.includes('`' + c.cell + '`'));
  assert.ok(!/\bedge found\b|is an edge\b/i.test(md.join('\n')));
});
