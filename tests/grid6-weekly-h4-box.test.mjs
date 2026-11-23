// tests/grid6-weekly-h4-box.test.mjs - research/edge/grid6-weekly-h4-box: the grid's size, Monday-UTC weeks known at a fixed end,
// no look-ahead in the signals (a cut and a changed future on a seeded market), trade-through fills with the stop on the losing
// side, and RESULT.md pinned to result.json. Offline (synthetic candles, committed files).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signals, trade, frames6, weeklyUTC, sigKey, NCELL, EXITS } from '../research/edge/grid6-weekly-h4-box/run.mjs';

const DIR = new URL('../research/edge/grid6-weekly-h4-box/', import.meta.url);
function market(n, seed = 9, px = 100) {
  let x = seed >>> 0; const r = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const t0 = Date.UTC(2011, 0, 3) / 1000, out = []; let c = px, k = 0;
  for (let i = 0; out.length < n; i++) { const t = t0 + i * 300, wd = new Date(t * 1000).getUTCDay(); if (wd === 6) continue;
    const o = c; c = o + (r() - 0.5) * 0.12 + Math.sin(k++ / 3000) * 0.012; const h = Math.max(o, c) + r() * 0.05, l = Math.min(o, c) - r() * 0.05;
    out.push({ t, o, h, l, c, e: t + 300 }); }
  return out;
}

test('the grid: 2,400 stored cells, five exits', () => {
  assert.equal(NCELL, 2400); assert.deepEqual(EXITS, ['1R', '2R', '3R', 'trail', 'opp']);
});

test('weeks start Monday UTC, Saturday and Sunday join the next week, and a week ends at a fixed Saturday 00:00', () => {
  const d = (s) => Date.parse(s + 'T00:00:00Z') / 1000, bar = (s, c) => ({ t: d(s), o: c, h: c + 1, l: c - 1, c, e: d(s) + 86400 });
  const W = weeklyUTC([bar('2015-01-09', 1), bar('2015-01-11', 2), bar('2015-01-12', 3), bar('2015-01-14', 4)]);
  assert.equal(W.length, 2);
  assert.equal(W[0].e, d('2015-01-10')); assert.equal(W[1].t, d('2015-01-10')); assert.equal(W[1].e, d('2015-01-17'));
  assert.equal(W[1].o, 2); assert.equal(W[1].c, 4, 'the Sunday candle opens the Monday week; a forming week keeps its fixed end');
});

test('no look-ahead: signals before a cut are the same with the candles cut there or changed after it', () => {
  const B = market(250000), from = B[0].t + 120 * 86400, to = B[B.length - 1].e;
  const full = signals(frames6(B), { from, to }).sigs; assert.ok(full.length > 40, 'signals on the seeded market: ' + full.length);
  for (const f of [0.6, 0.8]) { const C = B[Math.floor(B.length * f)].e;
    const A = full.filter((s) => s.ts <= C).map(sigKey).sort();
    const cut = signals(frames6(B.filter((b) => b.e <= C)), { from, to: C }).sigs.filter((s) => s.ts <= C).map(sigKey).sort();
    assert.deepEqual(cut, A);
    const alt = B.map((b) => (b.e > C ? { ...b, o: b.o + 3, h: b.h + 6, l: b.l - 6, c: b.c - 3 } : b));
    const ch = signals(frames6(alt), { from, to }).sigs.filter((s) => s.ts <= C).map(sigKey).sort();
    assert.deepEqual(ch, A); }
});

test('trade-through limit: no fill on a touch; every trade has its stop on the losing side', () => {
  const B = [{ t: 0, o: 101, h: 101.2, l: 100.0, c: 100.8, e: 300 }, { t: 300, o: 100.8, h: 100.9, l: 99.95, c: 100.3, e: 600 },
    { t: 600, o: 100.3, h: 103, l: 100.2, c: 102.9, e: 900 }, { t: 900, o: 102.9, h: 102.9, l: 98, c: 98.5, e: 1200 }];
  assert.equal(trade(B, 1, 'lim', 100, 99, 0, 900, 2, 0.2), null, 'a touch and 0.05 through is not half of a 0.2 round trip');
  const r = trade(B, 1, 'lim', 100, 99, 0, 1e9, 2, 0.08); assert.ok(r && r.t === 300 && r.risk === 1);
  assert.deepEqual(r.R, [1, 2, 3, 2, 2], '1R 2R 3R, the trail out at +2R, opp = 2R');
  const M = market(5000, 4); let n = 0;
  for (let k = 0; k < 200; k++) { const i = 20 + k * 20, s = k % 2 ? 1 : -1, c0 = M[i].c;
    for (const [type, en, sp] of [['mkt', null, c0 - s * 0.4], ['lim', c0 - s * 0.1, c0 - s * 0.5]]) {
      const x = trade(M, s, type, en, sp, M[i].e, M[i].e + 3600, 2, 0.01); if (!x) continue; n++;
      assert.ok(x.risk > 0); for (const R of x.R) assert.ok(Number.isFinite(R)); } }
  assert.ok(n > 100);
});

test('RESULT.md is pinned to result.json', { skip: !fs.existsSync(new URL('result.json', DIR)) }, () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  assert.match(md.split('\n')[2], new RegExp('^\\*\\*Verdict: ' + R.verdict + '\\.'));
  assert.ok(typeof R.headline === 'string' && R.headline.length > 40 && R.headline.length <= 221);
  const n = (x) => x.toLocaleString('en-US');
  for (const side of ['real', 'placebo', 'realNet', 'placeboNet']) for (const k of ['tested', 'discovery', 'rawConfirmed', 'confirmed'])
    assert.ok(md.includes(n(R[side][k])), `${side}.${k} ${R[side][k]} in RESULT.md`);
  assert.equal(R.verdict, R.real.confirmed === 0 ? 'FAIL' : R.real.confirmed > R.placebo.confirmed ? 'PASS' : 'INCONCLUSIVE');
  assert.ok(R.cut.length >= 25); for (const c of R.cut) assert.equal(c.missing + c.extra, 0, 'cut test ' + c.market + ' ' + c.cut);
  if (R.best) for (const v of [n(R.best.n1519), R.best.t1519.toFixed(2)]) assert.ok(md.includes(v), 'best cell ' + v);
});
