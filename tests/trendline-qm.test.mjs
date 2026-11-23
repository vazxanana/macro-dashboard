// node --test tests/trendline-qm.test.mjs - the trendline break / retest / M15 QM study (research/edge/trendline-qm), offline:
// no look-ahead (every later price changed), every setup and trade with its stop on the losing side, the report = result.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { breaks, setups, stream, windowStats, P } from '../research/edge/trendline-qm/run.mjs';

const T0 = Date.UTC(2021, 0, 4) / 1000;
function walk(n, seed) { // trending legs with pullbacks, 5-minute candles
  const r = K.rng(seed); const out = []; let p = 1800, drift = 0;
  for (let i = 0; i < n; i++) {
    if (i % 400 === 0) drift = (r() - 0.5) * 0.6;
    const o = p, c = o + drift + (r() - 0.5) * 3; const h = Math.max(o, c) + r() * 1.5, l = Math.min(o, c) - r() * 1.5;
    out.push({ t: T0 + i * 300, o, h, l, c, e: T0 + (i + 1) * 300 }); p = c;
  }
  return out;
}
const key = (u) => [u.side, u.t, u.fill, u.stop, u.target, u.breakT, u.retestT, u.lineA, u.lineB, u.h4].join('|');
const bkey = (b) => [b.side, b.i, b.t, b.A.i, b.B.i, b.value, b.atr].join('|');

test('no look-ahead: breaks and setups known by a moment do not move when every later price changes', () => {
  let seenB = 0, seenU = 0;
  for (const seed of [3, 11, 29]) {
    const m5 = walk(60000, seed);
    for (const cutI of [20000, 37000, 52000]) {
      const cut = m5[cutI].e;
      const A = m5.map((b, i) => (i <= cutI ? b : { ...b, o: b.o + 40, h: b.h + 90, l: b.l - 90, c: b.c - 30 }));
      const pickB = (x) => breaks(K.resample(x, 3600)).breaks.filter((b) => b.t <= cut).map(bkey);
      const pickU = (x) => setups(x).setups.filter((u) => u.t < cut).map(key);
      const b1 = pickB(A), b2 = pickB(m5); assert.deepEqual(b1, b2); seenB += b2.length;
      const u1 = pickU(A), u2 = pickU(m5); assert.deepEqual(u1, u2); seenU += u2.length;
    }
  }
  assert.ok(seenB > 0 && seenU > 0, 'the synthetic market gives breaks and setups to compare');
});

test('a line is drawn only through a lower high (higher low) and broken by a close beyond it', () => {
  const m5 = walk(60000, 7); const H = K.resample(m5, 3600);
  const { breaks: BR } = breaks(H);
  assert.ok(BR.length > 0);
  for (const b of BR) {
    const gap = b.B.i - b.A.i;
    assert.ok(gap >= P.minGap && gap <= P.maxGap);
    if (b.side > 0) { assert.ok(b.B.price < b.A.price); assert.ok(H[b.i].c > b.value); }
    else { assert.ok(b.B.price > b.A.price); assert.ok(H[b.i].c < b.value); }
    assert.ok(b.i - b.B.i <= P.life);
  }
});

test('every setup and every trade has its stop on the losing side, at least $1 away', () => {
  let n = 0, m = 0;
  for (const seed of [5, 17, 41]) {
    const m5 = walk(80000, seed);
    const { setups: U } = setups(m5);
    for (const u of U) {
      assert.ok(u.side * (u.fill - u.stop) >= P.minStop - 1e-9, 'stop on the losing side, $1 or more');
      if (u.target != null) assert.ok(u.side * (u.target - u.fill) >= u.risk - 1e-9, 'swing target 1R or more away');
      n++;
    }
    for (const id of ['T1', 'S1', 'S2']) for (const t of stream(m5, U, id, 0.3).trades) {
      assert.ok(t.side * (t.entry - t.stop) > 0);
      assert.ok(Number.isFinite(t.Rnet) && t.Rnet < t.R);
      assert.ok(t.R >= -1 - 1e-9 || t.reason === 'stop', 'worse than -1R only through a gap at the stop');
      m++;
    }
  }
  assert.ok(n > 0 && m > 0);
});

test('month t counts empty months of the window as zero', () => {
  const a = Date.UTC(2024, 0, 1) / 1000, b = Date.UTC(2025, 0, 1) / 1000;
  const s = windowStats([{ fillT: a + 86400, exitT: a + 90000, R: 1, Rnet: 1 }, { fillT: a + 40 * 86400, exitT: a + 41 * 86400, R: -1, Rnet: -1 }], [a, b]);
  assert.equal(s.months, 12); assert.equal(s.n, 2);
});

test('the report matches result.json and trades.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/trendline-qm/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/trendline-qm/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, new RegExp('\\*\\*Verdict: ' + r.verdict));
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  for (const id of ['T1', 'S1', 'S2']) {
    const t = r.tests[id];
    for (const w of ['REP', 'IS', 'OOS']) assert.ok(md.includes(`${t[w].n} / ${f(t[w].meanR)}`), id + ' ' + w);
    assert.ok(md.includes(t.pHolm.toFixed(3)), id + ' Holm');
  }
  if (r.tests.T1.OOS.n < 30) assert.equal(r.verdict, 'INCONCLUSIVE');
  const tr = JSON.parse(fs.readFileSync(new URL('../research/edge/trendline-qm/trades.json', import.meta.url)));
  assert.equal(tr.rows.length, ['T1', 'S1', 'S2'].reduce((a, id) => a + r.tests[id].REP.n + r.tests[id].IS.n + r.tests[id].OOS.n, 0));
  for (const x of tr.rows) assert.ok(x[2] * (x[4] - x[5]) > 0, 'stored stop on the losing side');
});
