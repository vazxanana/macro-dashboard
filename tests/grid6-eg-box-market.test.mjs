// tests/grid6-eg-box-market.test.mjs - research/edge/grid6-eg-box-market: the grid's size, no look-ahead in the signals (a
// cut and a changed future on a seeded market), market entries with the stop on the losing side, and RESULT.md pinned to
// result.json. Offline (synthetic candles, committed files).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signals, trade, NCELL, EXITS, STATES, ZTFS } from '../research/edge/grid6-eg-box-market/run.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';

const DIR = new URL('../research/edge/grid6-eg-box-market/', import.meta.url);
function market(n, seed = 9, px = 100) {
  let x = seed >>> 0; const r = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const t0 = Date.UTC(2012, 0, 2) / 1000, out = []; let c = px, k = 0;
  for (let i = 0; out.length < n; i++) { const t = t0 + i * 300, wd = new Date(t * 1000).getUTCDay(); if (wd === 6) continue;
    const o = c; c = o + (r() - 0.5) * 0.12 + Math.sin(k++ / 900) * 0.01; const h = Math.max(o, c) + r() * 0.05, l = Math.min(o, c) - r() * 0.05;
    out.push({ t, o, h, l, c, e: t + 300 }); }
  return out;
}
const key = (s) => [s.zt, s.st, s.tf, s.mode, s.conf, s.d, s.ts, s.tod, s.box.hi, s.box.lo, s.ext, s.z.bot, s.z.top, s.c0].join('|');

test('the grid: 2,160 stored cells, five exits, D1 / H4 zones, three states', () => {
  assert.equal(NCELL, 2160); assert.deepEqual(EXITS, ['1R', '2R', '3R', 'trail', 'opp']);
  assert.deepEqual(STATES, ['fresh', 'any', 'ef']); assert.deepEqual(ZTFS, ['1d', '4h']);
});

test('no look-ahead: signals before a cut are the same with the candles cut there or changed after it', () => {
  const B = market(60000), from = B[0].t + 40 * 86400, to = B[B.length - 1].e;
  const full = signals(frames(B), { from, to }).sigs; assert.ok(full.length > 30, 'signals on the seeded market: ' + full.length);
  assert.ok(new Set(full.map((s) => s.zt)).size === 2, 'both zone timeframes give signals');
  for (const f of [0.55, 0.7, 0.85]) { const C = B[Math.floor(B.length * f)].e;
    const A = full.filter((s) => s.ts <= C).map(key).sort();
    const cut = signals(frames(B.filter((b) => b.e <= C)), { from, to: C }).sigs.filter((s) => s.ts <= C).map(key).sort();
    assert.deepEqual(cut, A);
    const alt = B.map((b) => (b.e > C ? { ...b, o: b.o + 3, h: b.h + 6, l: b.l - 6, c: b.c - 3 } : b));
    const ch = signals(frames(alt), { from, to }).sigs.filter((s) => s.ts <= C).map(key).sort();
    assert.deepEqual(ch, A); }
});

test('market entry at the next open; no trade when the open is past the stop; stop always on the losing side', () => {
  const B = [{ t: 0, o: 100, h: 100.2, l: 99.9, c: 100.1, e: 300 }, { t: 300, o: 100.1, h: 103.5, l: 100, c: 103.4, e: 600 },
    { t: 600, o: 103.4, h: 103.4, l: 102, c: 102.1, e: 900 }, { t: 172500, o: 102.1, h: 102.2, l: 102, c: 102.1, e: 172800 }];
  const r = trade(B, 1, 99, 0, 2, 0.01); assert.ok(r && r.t === 0 && r.risk === 1);
  assert.deepEqual(r.R, [1, 2, 3, 2.5, 2], '1R 2R 3R, the trail out 1R behind the best (+2.5R), opp = 2R');
  assert.equal(trade(B, 1, 100.5, 0, 2, 0.01), null, 'open under a buy stop: not taken');
  const M = market(5000, 4); let n = 0;
  for (let k = 0; k < 200; k++) { const i = 20 + k * 20, s = k % 2 ? 1 : -1, c0 = M[i].c;
    const x = trade(M, s, c0 - s * 0.4, M[i].e, 2, 0.01); if (!x) continue; n++;
    assert.ok(x.risk > 0); for (const R of x.R) assert.ok(Number.isFinite(R)); }
  assert.ok(n > 100);
});

test('RESULT.md is pinned to result.json', { skip: !fs.existsSync(new URL('result.json', DIR)) }, () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  assert.match(md.split('\n')[2], new RegExp('^\\*\\*Verdict: ' + R.verdict + '\\.'));
  assert.ok(typeof R.headline === 'string' && R.headline.length > 40 && R.headline.length <= 260);
  const n = (x) => x.toLocaleString('en-US');
  for (const side of ['real', 'placebo', 'realNet', 'placeboNet']) for (const k of ['tested', 'discovery', 'rawConfirmed', 'confirmed'])
    assert.ok(md.includes(n(R[side][k])), `${side}.${k} ${R[side][k]} in RESULT.md`);
  assert.equal(R.verdict, R.real.confirmed === 0 ? 'FAIL' : R.real.confirmed > R.placebo.confirmed ? 'PASS' : 'INCONCLUSIVE');
  assert.equal(R.cut.length, 25);
  for (const c of R.cut) assert.equal(c.missing + c.extra, 0, 'cut test ' + c.market + ' ' + c.cut);
  if (R.best) for (const v of [n(R.best.n1519), R.best.t1519.toFixed(2)]) assert.ok(md.includes(v), 'best cell ' + v);
});
