// tests/direction-chain-gate.test.mjs - offline checks of research/edge/direction-chain-gate (no candle cache needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { candidates, procedureSide, weekly } from '../research/edge/direction-chain-gate/run.mjs';

const DIR = new URL('../research/edge/direction-chain-gate/', import.meta.url);

function synth(n, seed = 3, start = Date.UTC(2021, 0, 4) / 1000, p0 = 1.1, vol = 0.0006) {
  const r = K.rng(seed); const out = []; let p = p0, drift = 0;
  for (let i = 0; i < n; i++) {
    if (i % 2000 === 0) drift = (r() - 0.5) * vol * 0.2;
    const o = p, c = o + drift + (r() - 0.5) * vol; const h = Math.max(o, c) + r() * vol * 0.5, l = Math.min(o, c) - r() * vol * 0.5;
    const t = start + i * 300; out.push({ t, o, h, l, c, e: t + 300 }); p = c;
  }
  return out;
}
const bump = (bars, from) => bars.map((b, i) => (i < from ? b : { ...b, o: b.o * 1.03, h: b.h * 1.05, l: b.l * 0.97, c: b.c * 0.99 }));

test('procedure side: no look-ahead (cut and changed later candles)', () => {
  const M5 = synth(60000); const H1 = K.resample(M5, 3600), H4 = K.resample(M5, 14400);
  const full = procedureSide(H1, H4);
  assert.ok(full.some((s) => s !== 0), 'the procedure switches at least once');
  for (const cut of [300, 1700, 3500]) {
    const T = H1[cut].t; const M5b = bump(M5, M5.findIndex((b) => b.t >= T));
    const h1 = K.resample(M5b, 3600), h4 = K.resample(M5b, 14400);
    const s2 = procedureSide(h1, h4);
    // the H4 candle holding T is changed too; the H1 sides before the start of that H4 candle can only use H4 known by then
    const safe = H1.findIndex((b) => b.t >= Math.floor(T / 14400) * 14400);
    assert.deepEqual(s2.slice(0, safe), full.slice(0, safe));
    const cutSide = procedureSide(H1.slice(0, cut), H4.filter((b) => b.e <= H1[cut].t));
    assert.deepEqual(cutSide.slice(0, safe), full.slice(0, safe));
  }
});

test('weekly candles group Monday weeks and close with their last day', () => {
  const D = K.dailyNY(synth(30000)); const W = weekly(D);
  assert.ok(W.length >= 10);
  for (const w of W) assert.equal(new Date(w.key * 86400e3).getUTCDay(), 1);
  assert.equal(W[W.length - 1].e, D[D.length - 1].e);
});

test('candidates: every stop on the losing side, gates and outcomes do not depend on later candles', () => {
  const M5 = synth(60000, 11); const C = candidates('eurusd', M5);
  assert.ok(C.length > 20, 'enough candidates on the synthetic market');
  for (const x of C) {
    assert.ok(x.side * (x.entry - x.stop) > 0, 'stop on the losing side');
    assert.ok(x.side * (x.target - x.entry) > 0, 'target on the winning side');
    assert.ok(Math.abs(x.side * (x.target - x.entry) / (x.side * (x.entry - x.stop)) - 2) < 1e-9, '2R target');
    assert.ok(x.fillT >= x.sig && x.exitT > x.fillT);
    assert.ok(x.R >= -1.0000001 || x.reason === 'stop', 'only a gap past the stop can lose more than 1R');
  }
  const T = M5[40000].t; const M5b = bump(M5, 40000);
  const C2 = candidates('eurusd', M5b); const key = (x) => x.sig + ':' + x.side;
  const m2 = new Map(C2.map((x) => [key(x), x]));
  const before = C.filter((x) => x.exitT <= Math.floor(T / 86400) * 86400 - 86400 * 8);
  assert.ok(before.length > 5);
  for (const x of before) {
    const y = m2.get(key(x)); assert.ok(y, 'the same signal exists with changed later candles');
    for (const f of ['entry', 'stop', 'target', 'exitT', 'R', 'Rnet', 'gA', 'gB', 'dS', 'h4S', 'dB', 'h4B', 'h1B']) assert.equal(y[f], x[f], f);
  }
});

test('result.json and RESULT.md say the same', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR)));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(r.verdict));
  assert.match(md.split('\n').slice(0, 6).join('\n'), new RegExp('Verdict: \\*\\*' + r.verdict));
  for (const k of ['T1', 'T2', 'T3', 'T4']) assert.ok(md.includes(k + ' ') && md.includes(r.verdicts[k].verdict));
  const f = (v, d = 3) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d);
  for (const k of ['all', 'Aagree', 'Adis', 'Bagree', 'Bdis']) {
    const s = r.streams[k];
    assert.ok(md.includes(f(s.OOS.meanR)), k + ' OOS mean ' + f(s.OOS.meanR));
    assert.ok(md.includes(String(s.OOS.n)), k + ' OOS n');
    assert.ok(md.includes(f(s.OOS.tMonth, 2)), k + ' OOS month t');
  }
  const sz = fs.statSync(new URL('trades.json', DIR)).size; assert.ok(sz < 3e6, 'trades.json under 3 MB');
});
