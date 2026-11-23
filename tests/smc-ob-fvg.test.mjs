// tests/smc-ob-fvg.test.mjs - research/edge/smc-ob-fvg: no look-ahead in the zones (cut test), stops on the losing side,
// and RESULT.md pinned to result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { obZones, fvgZones, placebo, deathOf } from '../research/edge/smc-ob-fvg/run.mjs';

const dir = new URL('../research/edge/smc-ob-fvg/', import.meta.url);
function walk(n, seed = 5) {
  const r = K.rng(seed), out = []; let p = 100;
  for (let i = 0; i < n; i++) { const o = p, c = o + (r() - 0.5) * 2 * (1 + 2 * r()); const h = Math.max(o, c) + r(), l = Math.min(o, c) - r();
    out.push({ t: 3600 * i, o, h, l, c, e: 3600 * (i + 1) }); p = c; }
  return out;
}
const strip = (z) => JSON.stringify({ d: z.d, bot: z.bot, top: z.top, i: z.i, at: z.at });

test('zones known at a moment do not change when later candles are cut or changed', () => {
  const H = walk(3000);
  const fullOB = obZones(H), fullF = fvgZones(H, K.resample(H, 14400));
  assert.ok(fullOB.length > 20 && fullF.length > 50);
  for (const n of [700, 1333, 2001, 2600]) {
    const C = H.slice(0, n).concat(walk(400, n).map((b, k) => ({ ...b, t: H[n - 1].e + 3600 * k, e: H[n - 1].e + 3600 * (k + 1), o: b.o * 3, h: b.h * 3, l: b.l * 3, c: b.c * 3 })));
    const lim = H[n - 1].e;
    const a = fullOB.filter((z) => z.at <= lim).map(strip), b = obZones(C).filter((z) => z.at <= lim).map(strip);
    assert.deepEqual(b, a, 'order blocks before cut ' + n);
    const c4 = (X) => K.resample(X, 14400);
    const f1 = fullF.filter((z) => z.at <= lim - 14400).map(strip), f2 = fvgZones(C, c4(C)).filter((z) => z.at <= lim - 14400).map(strip);
    assert.deepEqual(f2, f1, 'FVGs before cut ' + n);
  }
});

test('order blocks have displacement, sit behind the break and the placebo keeps size and side', () => {
  const H = walk(3000, 9);
  const Z = obZones(H);
  for (const z of Z) {
    assert.ok(z.top > z.bot && z.ob < z.i);
    assert.ok(z.d > 0 ? H[z.i].c > z.top : H[z.i].c < z.bot);
    assert.ok(deathOf(H, z.i, z.d, z.bot, z.top) > z.at);
  }
  const P = placebo(H, Z, 3, (z) => -z.d);
  assert.ok(P.length > 0);
  for (const p of P) { const z = Z.find((x) => x.i === p.i); assert.ok(Math.abs((p.top - p.bot) - (z.top - z.bot)) < 1e-9); assert.ok(p.src !== z.ob);
    assert.ok(p.d > 0 ? p.top < H[p.i].c : p.bot > H[p.i].c); }
});

test('RESULT.md is pinned to result.json', () => {
  const res = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8').split('\n');
  assert.match(md[2], new RegExp('^\\*\\*Verdict: ' + res.verdict + '\\. '));
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(res.verdict) && typeof res.headline === 'string');
  const s = res.pooled, f = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
  for (const v of [String(s.ob.n), f(s.ob.before), String(s.fvg.n), f(s.fvg.before), String(res.T2.all.t)]) assert.ok(md.join('\n').includes(v), 'RESULT.md names ' + v);
});
