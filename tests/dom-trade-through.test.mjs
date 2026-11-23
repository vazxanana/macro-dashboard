// tests/dom-trade-through.test.mjs - research/edge/dom-trade-through: the fill rules, no look-ahead, parity of F0 with
// combo-grid-3 multi(), and RESULT.md pinned to result.json. Offline (synthetic candles, committed files).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { findFill, manage, rulesFor, atr14 } from '../research/edge/dom-trade-through/run.mjs';
import { multi } from '../research/edge/combo-grid-3/run.mjs';

const DIR = new URL('../research/edge/dom-trade-through/', import.meta.url);
function market(n, seed = 3, px = 100) {
  let x = seed >>> 0; const r = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const out = []; let c = px;
  for (let i = 0; i < n; i++) { const o = c; c = o + (r() - 0.5) * 0.8; const h = Math.max(o, c) + r() * 0.3, l = Math.min(o, c) - r() * 0.3;
    out.push({ t: 1e9 + i * 300, o, h, l, c, e: 1e9 + (i + 1) * 300 }); }
  return out;
}

test('fill rules: touch, trade-through, close beyond', () => {
  const B = [{ t: 0, o: 101, h: 101.2, l: 100.0, c: 100.8, e: 300 }, { t: 300, o: 100.8, h: 100.9, l: 99.85, c: 100.3, e: 600 },
    { t: 600, o: 100.3, h: 100.4, l: 99.7, c: 99.95, e: 900 }];
  assert.equal(findFill(B, 1, 100, 99, 0, 1e9, 'touch').i, 0);
  assert.equal(findFill(B, 1, 100, 99, 0, 1e9, 'through', 0.1).i, 1);
  assert.equal(findFill(B, 1, 100, 99, 0, 1e9, 'through', 0.2).i, 2);
  assert.equal(findFill(B, 1, 100, 99, 0, 1e9, 'close').i, 2);
  assert.equal(findFill(B, 1, 100, 99, 0, 1e9, 'through', 0.5), null);
  // a close past the stop before a fill cancels the order
  const C = [{ t: 0, o: 101, h: 101, l: 100.5, c: 98.9 + 2, e: 300 }, { t: 300, o: 100.9, h: 100.95, l: 100.05, c: 98.5 + 2.4, e: 600 }];
  assert.equal(findFill(C, 1, 100, 100.95, 0, 1e9, 'touch'), null);
  // expiry
  assert.equal(findFill(B, 1, 100, 99, 0, 300, 'through', 0.1), null);
});

test('no look-ahead: cutting or changing every candle after a fill leaves it unchanged', () => {
  const B = market(3000, 11);
  for (const rule of [['touch', 0], ['through', 0.05], ['close', 0]]) for (let k = 0; k < 40; k++) {
    const i0 = 100 + k * 60, s = k % 2 ? 1 : -1, entry = B[i0].c - s * 0.3, stop = entry - s * 1.0;
    const f = findFill(B, s, entry, stop, B[i0].t, B[i0].t + 12 * 300, rule[0], rule[1]); if (!f) continue;
    const cut = B.slice(0, f.i + 1); assert.deepEqual(findFill(cut, s, entry, stop, B[i0].t, B[i0].t + 12 * 300, rule[0], rule[1]), f);
    const alt = B.map((b, j) => (j > f.i ? { ...b, o: b.o + 5, h: b.h + 9, l: b.l - 9, c: b.c - 5 } : b));
    assert.deepEqual(findFill(alt, s, entry, stop, B[i0].t, B[i0].t + 12 * 300, rule[0], rule[1]), f);
  }
});

test('F0 equals combo-grid-3 multi() on a seeded market; every stop on the losing side', () => {
  const B = market(6000, 5), A5 = atr14(B); let n = 0;
  for (let k = 0; k < 120; k++) {
    const i0 = 50 + k * 45, s = k % 2 ? 1 : -1, entry = B[i0].c - s * 0.25, stop = entry - s * (0.4 + (k % 5) * 0.2);
    const t0 = B[i0].t, exp = t0 + 12 * 300, cap = 2 * 86400;
    const rr = rulesFor(B, s, entry, stop, t0, exp, cap, A5, 0.02), ref = multi(B, s, entry, stop, 'lim', t0, exp, 2, null, cap, null);
    assert.equal(!!rr.F0, !!ref);
    if (ref) { n++; assert.equal(rr.F0.t, ref.t); assert.ok(Math.abs(rr.F0.R[6] - ref.R[6]) < 1e-12); assert.ok(Math.abs(rr.F0.R[1] - ref.R[1]) < 1e-12); }
    for (const r of Object.values(rr)) if (r) { assert.ok(r.risk > 0); assert.ok(r.R[1] >= -1 - 1e-9 || r.R[1] < -1); }
    if (rr.F1) assert.ok(rr.F0 && rr.F1.t >= rr.F0.t);
    if (rr.F3) assert.ok(rr.F0 && rr.F3.t >= rr.F0.t);
  }
  assert.ok(n > 20);
});

test('manage: a market entry counts the first candle, a limit fill does not', () => {
  const B = [{ t: 0, o: 100, h: 102.5, l: 99.5, c: 101.5, e: 300 }, { t: 300, o: 101, h: 101.1, l: 100.9, c: 101, e: 600 }];
  const lim = manage(B, 1, 0, 100, 99, 600, false), mkt = manage(B, 1, 0, 100, 99, 600, true);
  assert.equal(lim.R[1], 1); // the limit's fill candle cannot reach the target; out at the cap, the last close
  assert.equal(mkt.R[1], 2);
});

test('RESULT.md is pinned to result.json', { skip: !fs.existsSync(new URL('result.json', DIR)) }, () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  assert.match(md.split('\n')[2], new RegExp('^\\*\\*Verdict: ' + R.verdict + '\\.'));
  assert.ok(typeof R.headline === 'string' && R.headline.length > 40);
  const p = R.pooled;
  for (const k of ['F0', 'F1', 'F2', 'F3', 'MKT']) assert.ok(md.includes(String(p[k].trail.n.toLocaleString('en-US'))), k + ' n in RESULT.md');
  for (const T of [R.T1, R.T2]) for (const h of ['2010-14', '2015-19']) assert.ok(md.includes(fmt(T[h].before)), 'test figure ' + T[h].before);
  assert.ok(md.includes(String(Math.round(R.drop.F1.share * 1000) / 10) + ' %'));
  assert.ok(md.includes(String(Math.round(R.drop.F2.share * 1000) / 10) + ' %'));
  assert.equal(Object.values(R.parity).every((n) => n > 1000), true);
});
const fmt = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
