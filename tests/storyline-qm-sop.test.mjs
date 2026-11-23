// node --test tests/storyline-qm-sop.test.mjs - the QM breakout-sequence study (research/edge/storyline-qm-sop), offline:
// no look-ahead (later candles changed), every order and trade with its stop on the losing side, the report = result.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { setups, runMarket, windowStats } from '../research/edge/storyline-qm-sop/run.mjs';

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
const key = (u) => [u.side, u.t, u.entry, u.stop, u.target, u.boT, u.vrT].join('|');

test('no look-ahead: the orders known by a moment do not move when every later price changes', () => {
  let seen = 0;
  for (const seed of [3, 11, 29]) {
    const m5 = walk(60000, seed);
    for (const cutI of [20000, 37000, 52000]) {
      const cut = m5[cutI].e;
      const A = m5.map((b, i) => (i <= cutI ? b : { ...b, o: b.o + 40, h: b.h + 90, l: b.l - 90, c: b.c - 30 }));
      const pick = (x) => setups(K.resample(x, 1800), K.resample(x, 900), 0.3).setups.filter((u) => u.t <= cut).map(key);
      const a = pick(A), b = pick(m5);
      assert.deepEqual(a, b);
      seen += b.length;
    }
  }
  assert.ok(seen > 0, 'the synthetic market gives orders to compare');
});

test('every order and every trade has its stop on the losing side and its target 1R or more away', () => {
  let n = 0;
  for (const seed of [5, 17, 41]) {
    const m5 = walk(80000, seed);
    const { setups: U } = setups(K.resample(m5, 1800), K.resample(m5, 900), 0.3);
    for (const u of U) {
      assert.ok(u.side * (u.entry - u.stop) > 0, 'stop on the losing side');
      assert.ok(u.side * (u.target - u.entry) >= u.side * (u.entry - u.stop) - 1e-9, 'target 1R or more away');
      n++;
    }
    for (const t of runMarket(m5, '30m', 0.3).trades) {
      assert.ok(t.side * (t.entry - t.stop) > 0);
      assert.ok(Number.isFinite(t.Rnet) && t.Rnet <= t.R);
      assert.ok(t.R >= -1 - 1e-9 || t.reason === 'stop', 'worse than -1R only through a gap at the stop');
    }
  }
  assert.ok(n > 0);
});

test('month t counts empty months of the window as zero', () => {
  const a = Date.UTC(2024, 0, 1) / 1000, b = Date.UTC(2025, 0, 1) / 1000;
  const T = [{ fillT: a + 86400, exitT: a + 90000, R: 1, Rnet: 1 }, { fillT: a + 40 * 86400, exitT: a + 41 * 86400, R: -1, Rnet: -1 }];
  const s = windowStats(T, [a, b]);
  assert.equal(s.months, 12);
  assert.equal(s.n, 2);
});

test('the report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/storyline-qm-sop/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/storyline-qm-sop/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, new RegExp('\\*\\*Verdict: ' + r.verdict));
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  for (const id of ['T1', 'T2', 'T3', 'T4']) {
    const t = r.tests[id];
    for (const w of ['REP', 'IS', 'OOS']) assert.ok(md.includes(`${t[w].n} / ${f(t[w].meanR)}`), id + ' ' + w);
    assert.ok(md.includes(t.pHolm.toFixed(3)), id + ' Holm');
  }
  if (r.tests.T1.OOS.n < 30) assert.equal(r.verdict, 'INCONCLUSIVE');
  const tr = JSON.parse(fs.readFileSync(new URL('../research/edge/storyline-qm-sop/trades.json', import.meta.url)));
  assert.equal(tr.rows.length, ['T1', 'T2', 'T3', 'T4'].reduce((a, id) => a + r.tests[id].REP.n + r.tests[id].IS.n + r.tests[id].OOS.n, 0));
  for (const x of tr.rows) assert.ok(x[2] * (x[4] - x[5]) > 0, 'stored stop on the losing side');
});
