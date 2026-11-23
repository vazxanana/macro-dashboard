// tests/grid6-msnr-ef-market.test.mjs - research/edge/grid6-msnr-ef-market: the grid's size, EFs from eg-methods' zones, no
// look-ahead in the signals (a cut and a changed future on a seeded market), the opposite-zone target, and RESULT.md pinned to
// result.json. Offline (synthetic candles, committed files).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signals, zoneSets, oppEdge, reportedCells, NCELL, EXITS, TRIGS } from '../research/edge/grid6-msnr-ef-market/run.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';

const DIR = new URL('../research/edge/grid6-msnr-ef-market/', import.meta.url);
function market(n, seed = 9, px = 100) {
  let x = seed >>> 0; const r = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const t0 = Date.UTC(2012, 0, 2) / 1000, out = []; let c = px, k = 0;
  for (let i = 0; out.length < n; i++) { const t = t0 + i * 300, wd = new Date(t * 1000).getUTCDay(); if (wd === 6) continue;
    const o = c; c = o + (r() - 0.5) * 0.12 + Math.sin(k++ / 900) * 0.01; const h = Math.max(o, c) + r() * 0.05, l = Math.min(o, c) - r() * 0.05;
    out.push({ t, o, h, l, c, e: t + 300 }); }
  return out;
}
const key = (s) => [s.ztf, s.trig, s.conf, s.visit, s.d, s.ts, s.c0, s.ext, s.ef.bot, s.ef.top, s.ef.at, s.call, s.tod].join('|');

test('the grid: 4,320 stored cells, 5,130 reported cells a scope, four triggers, five exits', () => {
  assert.equal(NCELL, 4320); assert.equal(reportedCells().length, 5130);
  assert.deepEqual(TRIGS, ['ef', 'eg', 'sb', 'box']); assert.deepEqual(EXITS, ['1R', '2R', '3R', 'trail', 'opp']);
});

test('an EF serves the other side from the close that failed its zone, and ends by its close back or 20 days', () => {
  const F = frames(market(40000)), H1 = F['1h'], { eg, ef } = zoneSets(H1, '1h');
  assert.ok(ef.length > 50 && eg.length >= ef.length);
  for (const z of ef) { const b = H1[z.fi];
    assert.equal(z.at, b.e, 'at = the close of the failing candle');
    assert.ok(z.d > 0 ? b.c > z.top : b.c < z.bot, 'the failing candle closed through the far side');
    assert.ok(z.end > z.at && z.end <= z.at + 20 * 86400); }
});

test('no look-ahead: signals before a cut are the same with the candles cut there or changed after it', () => {
  const B = market(60000), from = B[0].t + 40 * 86400, to = B[B.length - 1].e;
  const full = signals(frames(B), { from, to }).sigs; assert.ok(full.length > 100, 'signals on the seeded market: ' + full.length);
  for (const t of [0, 1, 2, 3]) assert.ok(full.some((s) => s.trig === t), 'trigger ' + TRIGS[t]);
  for (const f of [0.55, 0.7, 0.85]) { const C = B[Math.floor(B.length * f)].e;
    const A = full.filter((s) => s.ts <= C).map(key).sort();
    const cut = signals(frames(B.filter((b) => b.e <= C)), { from, to: C }).sigs.filter((s) => s.ts <= C).map(key).sort();
    assert.deepEqual(cut, A);
    const alt = B.map((b) => (b.e > C ? { ...b, o: b.o + 3, h: b.h + 6, l: b.l - 6, c: b.c - 3 } : b));
    const ch = signals(frames(alt), { from, to }).sigs.filter((s) => s.ts <= C).map(key).sort();
    assert.deepEqual(ch, A); }
});

test('the opposite target: the nearest standing zone of the other side beyond the reference', () => {
  const eg = [{ d: -1, bot: 105, top: 106, at: 100, end: 1000 }, { d: -1, bot: 103, top: 104, at: 200, end: 1000 },
    { d: -1, bot: 102, top: 102.5, at: 300, end: 400 }, { d: 1, bot: 98, top: 99, at: 100, end: 1000 }];
  assert.equal(oppEdge(eg, 1, 500, 101, 3600), 103, 'the zone that ended at 400 no longer stands');
  assert.equal(oppEdge(eg, -1, 500, 101, 3600), 99);
  assert.equal(oppEdge(eg, 1, 150, 101, 3600), 105, 'a zone not yet known is not used');
  assert.equal(oppEdge(eg, 1, 500, 107, 3600), null);
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
  assert.equal(R.cut.length, 25); for (const c of R.cut) assert.equal(c.missing + c.extra, 0, 'cut test ' + c.market + ' ' + c.cut);
  if (R.best) for (const v of [n(R.best.n1519), R.best.t1519.toFixed(2)]) assert.ok(md.includes(v), 'best cell ' + v);
  const trades = Object.values(R.meta).reduce((a, m) => a + m.trades, 0); assert.ok(md.includes(n(trades)), 'trades ' + trades);
});
