// node --test tests/barrier-qm-janda.test.mjs - the barrier / QM / second-break study (research/edge/barrier-qm-janda),
// offline: no look-ahead (later candles changed, and series cut), every order and trade with its stop on the losing side,
// the engulf definition on hand-made candles, and the report equal to result.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { setups, trade, engulfs, zones, windowStats } from '../research/edge/barrier-qm-janda/run.mjs';

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
const key = (u) => [u.side, u.t, u.entry, u.stop, u.target, u.touchT, u.qmT, u.egT, u.kind].join('|');
const pairOf = (m5, opt = {}) => setups(K.resample(m5, 3600), K.resample(m5, 900), K.dailyNY(m5), opt).setups;

test('engulf: last candle of the other colour, completed within three candles by a close beyond it', () => {
  const B = (o, c, h, l) => ({ o, c, h: h ?? Math.max(o, c) + 0.5, l: l ?? Math.min(o, c) - 0.5 });
  // bearish base (10 -> 9, h 10.5), then two small candles, then a close above 10.5 at the 3rd candle: a buy engulf
  const a = [B(9, 10), B(10, 9), B(9, 9.4), B(9.4, 10.2), B(10.2, 10.8)];
  const ga = engulfs(a).filter((g) => g.side === 1);
  assert.equal(ga.length, 1); assert.equal(ga[0].b, 1); assert.equal(ga[0].i, 4); assert.equal(ga[0].hi, 10.5);
  // a fourth candle is too late
  const b = [B(9, 10), B(10, 9), B(9, 9.4), B(9.4, 9.8), B(9.8, 10.2), B(10.2, 10.8)];
  assert.equal(engulfs(b).filter((g) => g.side === 1 && g.b === 1).length, 0);
});

test('no look-ahead: orders known by a moment do not move when every later price changes', () => {
  let seen = 0;
  for (const seed of [3, 11, 29]) {
    const m5 = walk(70000, seed);
    for (const cutI of [30000, 45000, 60000]) {
      const cut = m5[cutI].e;
      const A = m5.map((b, i) => (i <= cutI ? b : { ...b, o: b.o + 40, h: b.h + 90, l: b.l - 90, c: b.c - 30 }));
      for (const opt of [{}, { dir: false }]) {
        const a = pairOf(A, opt).filter((u) => u.t <= cut).map(key);
        const b = pairOf(m5, opt).filter((u) => u.t <= cut).map(key);
        const c = pairOf(m5.slice(0, cutI + 1), opt).filter((u) => u.t <= cut).map(key);
        assert.deepEqual(a, b); assert.deepEqual(c, b);
        seen += b.length;
      }
    }
  }
  assert.ok(seen > 0, 'the synthetic market gives orders to compare');
});

test('every order and trade has its stop on the losing side, $1 or more away, the target 2R or more away', () => {
  let n = 0, nt = 0;
  for (const seed of [5, 17, 41]) {
    const m5 = walk(90000, seed);
    for (const opt of [{}, { dir: false }, { near: true }]) {
      const U = pairOf(m5, opt);
      for (const u of U) {
        assert.ok(u.side * (u.entry - u.stop) >= 1 - 1e-9, 'stop on the losing side, at least $1');
        assert.ok(u.side * (u.target - u.entry) >= 2 * u.side * (u.entry - u.stop) - 1e-9, 'target 2R or more');
        assert.ok(u.side > 0 ? u.head >= u.zlo && u.head <= u.zhi : u.head >= u.zlo && u.head <= u.zhi, 'QM head inside the zone');
        assert.ok(u.qmT > u.touchT && u.t > u.qmT, 'order after the QM, QM after the touch');
        n++;
      }
      for (const t of trade(U, m5, K.resample(m5, 3600), 0.3).trades) {
        assert.ok(t.side * (t.entry - t.stop) > 0);
        assert.ok(Number.isFinite(t.Rnet) && t.Rnet < t.R && t.R2 < t.Rnet);
        assert.ok(t.R >= -1 - 1e-9 || t.reason === 'stop', 'worse than -1R only through a gap at the stop');
        nt++;
      }
    }
  }
  assert.ok(n > 0 && nt > 0);
});

test('barrier zones carry a positive width and the side of their break', () => {
  const B = K.resample(walk(30000, 7), 3600);
  for (const z of zones(B)) { assert.ok(z.hi > z.lo); assert.ok(z.side === 1 || z.side === -1); }
});

test('month t counts empty months of the window as zero', () => {
  const a = Date.UTC(2024, 0, 1) / 1000, b = Date.UTC(2025, 0, 1) / 1000;
  const T = [{ fillT: a + 86400, exitT: a + 90000, R: 1, Rnet: 1 }, { fillT: a + 40 * 86400, exitT: a + 41 * 86400, R: -1, Rnet: -1 }];
  assert.equal(windowStats(T, [a, b]).months, 12);
});

test('RESULT.md states the result.json verdict and the primary figures', () => {
  const dir = new URL('../research/edge/barrier-qm-janda/', import.meta.url);
  const r = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8').replace(/\u2212/g, '-');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(r.verdict));
  assert.match(md.split('\n').slice(0, 6).join('\n'), new RegExp('Verdict: \\*\\*' + r.verdict + '\\*\\*'));
  const P = r.tests.P;
  for (const w of ['IS', 'OOS', 'REP']) {
    assert.ok(md.includes(String(P[w].n)), w + ' n in the report');
    assert.ok(md.includes(P[w].meanR.toFixed(3)), w + ' mean in the report');
  }
  assert.ok(md.includes(P.OOS.tMonth.toFixed(2)));
  const tr = JSON.parse(fs.readFileSync(new URL('trades.json', dir), 'utf8'));
  for (const row of tr.rows) assert.ok(row[2] * (row[4] - row[5]) > 0, 'stop on the losing side in trades.json');
});

test('the report does not claim the Daily direction halves the loss on every window (review 23 Nov 2026)', async () => {
  const fs = await import('node:fs');
  const md = fs.readFileSync(new URL('../research/edge/barrier-qm-janda/RESULT.md', import.meta.url), 'utf8');
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/barrier-qm-janda/result.json', import.meta.url)));
  assert.doesNotMatch(md, /the loss halves against every fresh zone/);
  assert.ok(r.tests.P.REP.meanR < r.tests.S1.REP.meanR, 'on 2010-19 the direction filter is worse than none');
  assert.match(md, /worse than no filter on 2010-2019/);
});
