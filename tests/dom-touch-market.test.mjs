// tests/dom-touch-market.test.mjs - research/edge/dom-touch-market: the re-implemented touch search equals combo-grid-3's,
// control zones use closed candles only (cut test), every trade's stop is on the losing side, RESULT.md pinned to result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { buildZones, signalsFor, NONE, multi } from '../research/edge/combo-grid-3/run.mjs';
import { atr14 } from '../research/edge/grid6-dom-confirm/run.mjs';
import { closeEnd, firstTouches, randBodyZones, oppBodyZones, bandZones, tradeRows, seedOf, COLS } from '../research/edge/dom-touch-market/run.mjs';

const DIR = new URL('../research/edge/dom-touch-market/', import.meta.url);
function m5(n, seed = 3, t0 = Date.UTC(2012, 0, 2) / 1000) {
  const R = K.rng(seed), out = []; let px = 1.3;
  for (let i = 0; i < n; i++) { const o = px, c = o + (R() - 0.5) * 0.0012, h = Math.max(o, c) + R() * 0.0004, l = Math.min(o, c) - R() * 0.0004;
    out.push({ t: t0 + i * 300, o, h, l, c, e: t0 + (i + 1) * 300 }); px = c; }
  return out;
}
const known = (z) => ({ d: z.d, bot: z.bot, top: z.top, at: z.at, i: z.i });

test('the zone end and the first touch equal combo-grid-3 (buildZones, signalsFor trigger NONE visit 1)', () => {
  const M5 = m5(30000), H = K.resample(M5, 3600), dom = buildZones('dom', H);
  for (const z of dom) assert.deepEqual(closeEnd(H, z.i, z.d, z.bot, z.top), { end: z.end, fi: z.fi });
  const start = M5[2000].t, F = { '5m': M5, '1h': H };
  const ref = signalsFor(F, '1h', '5m', 'dom', { '1hdom': dom }, start).filter((s) => s.trig === NONE && s.visit === 1).map((s) => [s.z.i, s.k0]);
  const got = firstTouches(M5, dom, start).map((s) => [s.z.i, s.k0]);
  assert.ok(ref.length > 50); assert.deepEqual(got, ref);
});

test('cut test: control zones known by a moment do not move when later candles change', () => {
  const H = K.resample(m5(40000), 3600);
  for (const cut of [200, 450]) {
    const cutT = H[cut - 1].e, tail = K.resample(m5(40000, 99), 3600).slice(cut).map((b, k) => ({ ...b, t: H[cut + k].t, e: H[cut + k].e }));
    const H2 = H.slice(0, cut).concat(tail).slice(0, H.length);
    for (const f of [(L) => randBodyZones(L, 7), (L) => oppBodyZones(L), (L) => bandZones(L, 7)]) {
      assert.deepEqual(f(H2).filter((z) => z.at <= cutT).map(known), f(H).filter((z) => z.at <= cutT).map(known));
    }
  }
});

test('controls: (a) a same-colour earlier body within 120, (b) the last opposite-colour body, (c) the DOM height', () => {
  const H = K.resample(m5(40000), 3600), dom = buildZones('dom', H);
  for (const z of randBodyZones(H, seedOf('eurusd', 'rb1'))) { assert.ok(z.src >= z.i - 120 && z.src <= z.i - 2); const b = H[z.src];
    assert.equal(Math.sign(b.c - b.o), z.d); assert.equal(z.bot, Math.min(b.o, b.c)); assert.equal(z.at, H[z.i].e); }
  for (const z of oppBodyZones(H)) { assert.ok(z.src < z.i); assert.equal(Math.sign(H[z.src].c - H[z.src].o), -z.d); assert.equal(Math.sign(H[z.i].c - H[z.i].o), z.d);
    for (let j = z.src + 1; j < z.i; j++) assert.notEqual(Math.sign(H[j].c - H[j].o), -z.d); }
  const byI = new Map(dom.map((z) => [z.i, z]));
  for (const z of bandZones(H, 3)) { const d = byI.get(z.i); assert.ok(Math.abs((z.top - z.bot) - (d.top - d.bot)) < 1e-9); assert.equal(z.d, d.d);
    assert.ok(z.d > 0 ? z.top <= H[z.i].c + 1e-12 || z.u < 0 : z.bot >= H[z.i].c - 1e-12 || z.u < 0); }
});

test('every trade has its stop on the losing side, entered at the next 5-minute open', () => {
  const M5 = m5(40000), H = K.resample(M5, 3600), A = atr14(H), from = M5[3000].t, to = M5[39000].t;
  const r = tradeRows('eurusd', M5, H, A, [], buildZones('dom', H), { from, to, placebo: true });
  assert.ok(r.t.length > 30);
  const z1 = COLS.indexOf('z1'), zt = COLS.indexOf('zt');
  for (let i = 0; i < r.t.length; i++) { const v = r.vals[i * COLS.length + z1]; if (!Number.isNaN(v)) assert.ok(v >= -1.5 && v <= 1.0001);
    const w = r.vals[i * COLS.length + zt]; if (!Number.isNaN(w)) assert.ok(w >= -1.5); }
  assert.equal(multi(M5, 1, M5[100].c, M5[100].c + 0.001, 'mkt', M5[100].e, null, 2, null, 86400, null), null); // stop above a buy: no trade
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8'); const lines = md.split('\n');
  assert.match(lines[2], new RegExp('^\\*\\*Verdict: ' + r.verdict + '\\. .+\\*\\*$'));
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(r.verdict));
  assert.ok(r.headline && r.headline.length > 20);
  assert.equal(r.gate.ok, true);
  for (const set of ['a', 'b', 'c']) for (const ck of ['C1', 'C2']) { const c = r.q2[set].cells[ck];
    assert.ok(md.includes(c.n.toLocaleString('en-GB')), set + ck + ' n'); assert.ok(md.includes(String(c.tBefore)), set + ck + ' t'); }
  for (const ck of ['C1', 'C2']) for (const k of ['rb', 'ob', 'bd']) for (const h of r.q1[ck].controls[k].halves) assert.ok(md.includes(String(h.diff.t)), ck + k);
});
