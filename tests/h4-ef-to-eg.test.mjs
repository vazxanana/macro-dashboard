// node --test tests/h4-ef-to-eg.test.mjs - the H4 engulf-failed-to-engulf study (research/edge/h4-ef-to-eg), offline:
// no look-ahead (later prices changed, and the series cut), every order built from a FAILED H4 engulf zone of the other side
// known before it, its stop on the losing side and its target the near side of an alive opposite H4 engulf zone 2R or more
// away, buys and sells mirrored exactly, and RESULT.md equal to result.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { zones as egZones } from '../council/eg-methods.mjs';
import { setups, trade, P } from '../research/edge/h4-ef-to-eg/run.mjs';

const T0 = Date.UTC(2021, 0, 4) / 1000;
function walk(n, seed) { // trending legs with pullbacks, 5-minute candles
  const r = K.rng(seed); const out = []; let p = 1800, drift = 0;
  for (let i = 0; i < n; i++) {
    if (i % 300 === 0) drift = (r() - 0.5) * 0.8;
    const o = p, c = o + drift + (r() - 0.5) * 3; const h = Math.max(o, c) + r() * 1.5, l = Math.min(o, c) - r() * 1.5;
    out.push({ t: T0 + i * 300, o, h, l, c, e: T0 + (i + 1) * 300 }); p = c;
  }
  return out;
}
const key = (u) => [u.side, u.t, u.entry, u.stop, u.target, u.failT, u.returnT].join('|');
const desk = (bars) => bars.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));

test('no look-ahead: orders known by a moment do not move when later prices change or the series ends there', () => {
  let seen = 0;
  for (const seed of [3, 11, 29]) {
    const m5 = walk(60000, seed);
    for (const cutI of [25000, 40000, 55000]) {
      const cut = m5[cutI].e;
      const A = m5.map((b, i) => (i <= cutI ? b : { ...b, o: b.o + 40, h: b.h + 90, l: b.l - 90, c: b.c - 30 }));
      const a = setups(A).setups.filter((u) => u.t <= cut).map(key);
      const b = setups(m5).setups.filter((u) => u.t <= cut).map(key);
      const c = setups(m5.slice(0, cutI + 1)).setups.filter((u) => u.t <= cut).map(key);
      assert.deepEqual(a, b); assert.deepEqual(c, b);
      seen += b.length;
    }
  }
  assert.ok(seen > 0, 'the synthetic market gives orders to compare');
});

test('every order: a failed H4 engulf of the other side, known before; stop on the losing side; target an alive opposite zone at 2R+', () => {
  let n = 0, nt = 0;
  for (const seed of [5, 17, 41]) {
    const m5 = walk(70000, seed);
    const H4 = K.resample(m5, K.TF['4h']), Z = egZones(desk(H4), '4h');
    const U = setups(m5).setups;
    for (const u of U) {
      const z = Z.find((y) => y.fail != null && y.dir === -u.side && y.bot === u.zbot && y.top === u.ztop && y.fail === u.failT);
      assert.ok(z, 'the barrier is a failed engulf zone of the other side');
      assert.ok(u.failT <= u.returnT && u.returnT < u.t, 'fail, then the return, then the order');
      assert.equal(u.entry, u.side > 0 ? u.ztop : u.zbot, 'limit at the near edge of the barrier');
      assert.ok(u.side * (u.entry - u.stop) > 0, 'stop on the losing side');
      assert.ok(Math.abs(u.side * (u.entry - u.stop) - (1 + P.bufFrac) * (u.ztop - u.zbot)) < 1e-9, 'stop beyond the zone by 10 % of its height');
      assert.ok(u.side * (u.target - u.entry) >= P.minRR * u.side * (u.entry - u.stop) - 1e-9, 'target 2R or more');
      const tz = Z.find((y) => y.dir === u.side * -1 && y.at <= u.t && y.end > u.t && (u.side > 0 ? y.bot === u.target : y.top === u.target));
      assert.ok(tz, 'the target is the near side of an opposite engulf zone alive at the order');
      // and it is the nearest such zone beyond the entry
      for (const y of Z) if (y.dir === -u.side && y.at <= u.t && y.end > u.t && (u.side > 0 ? y.bot > u.entry : y.top < u.entry)) assert.ok(u.side > 0 ? y.bot >= u.target : y.top <= u.target);
      n++;
    }
    for (const t of trade(U, m5, H4, 'eurusd', 0.3).trades) {
      assert.ok(t.side * (t.entry - t.stop) > 0);
      assert.ok(Number.isFinite(t.Rnet) && t.Rnet < t.R && t.R2 < t.Rnet);
      assert.ok(t.R >= -1 - 1e-9 || t.reason === 'stop', 'worse than -1R only through a gap at the stop');
      nt++;
    }
  }
  assert.ok(n > 0 && nt > 0);
});

test('a sell mirrors a buy: prices turned upside down give the same orders on the other side', () => {
  const m5 = walk(60000, 13), M = 4000;
  const flip = m5.map((b) => ({ t: b.t, e: b.e, o: M - b.o, c: M - b.c, h: M - b.l, l: M - b.h }));
  const a = setups(m5).setups, b = setups(flip).setups;
  assert.ok(a.length > 0); assert.equal(a.length, b.length);
  a.forEach((u, i) => {
    const v = b[i]; assert.equal(v.side, -u.side); assert.equal(v.t, u.t);
    for (const k of ['entry', 'stop', 'target']) assert.ok(Math.abs(v[k] - (M - u[k])) < 1e-6, k);
  });
});

test('RESULT.md says what result.json says', () => {
  const dir = new URL('../research/edge/h4-ef-to-eg/', import.meta.url);
  const r = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  assert.equal(r.study, 'h4-ef-to-eg');
  assert.match(md, new RegExp('Verdict: \\*\\*' + r.verdict));
  const p = r.tests.P;
  for (const w of ['REP', 'IS', 'OOS']) {
    assert.ok(md.includes(String(p[w].n)), w + ' n');
    assert.ok(md.includes(p[w].meanR.toFixed(3).replace('-', '−')), w + ' mean');
    assert.ok(md.includes(p[w].tMonth.toFixed(2).replace('-', '−')), w + ' t');
  }
  assert.ok(md.includes(`${p.placebo.beaten} of ${p.placebo.runs}`));
  assert.ok(r.cutCheck.every((c) => c.same), 'the cut-series check on gold held');
  assert.doesNotMatch(md, /is an edge/i, 'never called an edge');
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');
  assert.match(pre, /committed alone/);
});
