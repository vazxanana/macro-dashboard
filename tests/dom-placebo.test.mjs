// tests/dom-placebo.test.mjs - research/edge/dom-placebo: controls built from closed candles only, RESULT.md pinned to result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { c1Zones, c2Zones, seedOf, welch, summ } from '../research/edge/dom-placebo/run.mjs';
import { buildZones } from '../research/edge/combo-grid-3/run.mjs';
import * as K from '../research/edge/_lib/edgekit.mjs';

const DIR = new URL('../research/edge/dom-placebo/', import.meta.url);
function market(n, seed = 3) {
  const R = K.rng(seed), out = []; let px = 100;
  for (let i = 0; i < n; i++) { const o = px, c = o + (R() - 0.5) * 2, h = Math.max(o, c) + R() * 0.5, l = Math.min(o, c) - R() * 0.5;
    out.push({ t: i * 3600, o, h, l, c, e: (i + 1) * 3600 }); px = c; }
  return out;
}
const known = (z) => ({ d: z.d, bot: z.bot, top: z.top, at: z.at, i: z.i, src: z.src });

test('cut test: C1 and C2 zones known by a moment do not move when later candles change', () => {
  const L = market(3000);
  for (const cut of [500, 1777, 2600]) {
    const cutT = L[cut - 1].e;
    const L2 = L.slice(0, cut).concat(market(3000 - cut, 99).map((b, k) => ({ ...b, t: L[cut + k].t, e: L[cut + k].e })));
    const a1 = c1Zones(L, 7).filter((z) => z.at <= cutT).map(known), b1 = c1Zones(L2, 7).filter((z) => z.at <= cutT).map(known);
    assert.deepEqual(b1, a1);
    const a2 = c2Zones(L).filter((z) => z.at <= cutT).map(known), b2 = c2Zones(L2).filter((z) => z.at <= cutT).map(known);
    assert.deepEqual(b2, a2);
  }
});

test('C1 draws a same-colour body among the 24 before the DOM, never its own first candle', () => {
  const L = market(4000), dom = buildZones('dom', L), c1 = c1Zones(L, seedOf('xau', 1));
  assert.ok(c1.length > 0 && c1.length <= dom.length);
  for (const z of c1) {
    assert.ok(z.src >= z.i - 24 && z.src <= z.i - 2);
    const b = L[z.src]; assert.equal(Math.sign(b.c - b.o), z.d);
    assert.equal(z.bot, Math.min(b.o, b.c)); assert.equal(z.top, Math.max(b.o, b.c));
    assert.equal(z.at, L[z.i].e);
  }
  assert.deepEqual(c1Zones(L, 5).map(known), c1Zones(L, 5).map(known)); // seeded
});

test('Welch and month sums', () => {
  const a = [{ t: 0, trail: 1, cr: 0.1 }, { t: 3e6, trail: 0, cr: 0.1 }, { t: 6e6, trail: 2, cr: 0.1 }], b = [{ t: 0, trail: -1, cr: 0 }, { t: 3e6, trail: 0, cr: 0 }, { t: 6e6, trail: 1, cr: 0 }];
  const w = welch(a, b, 'trail'); assert.equal(w.diff, 1); assert.ok(w.t > 0);
  const s = summ(a, 'trail'); assert.equal(s.n, 3); assert.equal(s.before, 1); assert.equal(s.after, 0.9);
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8').split('\n');
  assert.match(md[2], new RegExp('^\\*\\*Verdict: ' + r.verdict + '\\.'));
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(r.verdict));
  assert.ok(r.headline && r.headline.length > 20);
  const p = r.pooled;
  for (const k of ['dom', 'c1', 'c2']) {
    const s = p[k].trail; assert.ok(md.join('\n').includes(String(s.n.toLocaleString('en-GB'))), k + ' n in RESULT.md');
  }
  assert.ok(md.join('\n').includes(String(r.T1.t)) && md.join('\n').includes(String(r.T2.t)) && md.join('\n').includes(String(r.T3.tBefore)));
});
