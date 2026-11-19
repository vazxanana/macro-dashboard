// gold-brent-ratio study: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ratioZ, signals, tradeAt, simulate, entryIndex, holm, monthly, RT, STOP_ATR, HOLD } from '../research/edge/gold-brent-ratio/run.mjs';

const D = 86400, T0 = Date.UTC(2010, 0, 4) / 1000;
const bar = (i, c, w = 1) => ({ time: T0 + i * D, open: c, high: c + w, low: c - w, close: c });

test('z uses only values up to the day: changing later prices leaves earlier z alone', () => {
  const g = Array.from({ length: 300 }, (_, i) => bar(i, 1000 + 10 * Math.sin(i / 7)));
  const b = Array.from({ length: 300 }, (_, i) => bar(i, 80 + Math.cos(i / 5)));
  const z1 = ratioZ(g, b, 250);
  const g2 = g.map((x, i) => (i >= 280 ? { ...x, close: x.close * 2 } : x));
  const z2 = ratioZ(g2, b, 250);
  assert.equal(z1.length, 51);
  for (let k = 0; k < 30; k++) assert.equal(z1[k].z, z2[k].z);
  assert.notEqual(z1[40].z, z2[40].z);
});

test('a day without a Brent candle of the same stamp has no ratio', () => {
  const g = Array.from({ length: 10 }, (_, i) => bar(i, 1000 + i));
  const b = g.filter((_, i) => i !== 4).map((x) => ({ ...x, close: 80 }));
  assert.equal(ratioZ(g, b, 3).length, 9 - 2);
});

test('signals: short above +2, long below -2, re-armed only under |z| 1', () => {
  const zs = [0.5, 2.1, 2.5, 1.5, 2.2, 0.5, 2.3, -2.4, -2.6, -0.2, -2.1].map((z, i) => ({ t: i, z }));
  const s = signals(zs);
  assert.deepEqual(s.map((x) => [x.t, x.s]), [[1, -1], [6, -1], [7, 1], [10, 1]]);
});

test('trade: entry at the next open, stop 3 x ATR, gap fills at the open, longs pay financing', () => {
  const g = Array.from({ length: 60 }, (_, i) => bar(i, 1000, 5));   // true range 10 -> ATR 10, risk 30
  const j = entryIndex(g, g[30].time); assert.equal(j, 31);
  const tL = tradeAt(g, j, 1), tS = tradeAt(g, j, -1);
  assert.equal(tL.risk, STOP_ATR * 10); assert.equal(tL.kind, 'time'); assert.equal(tL.k, j + HOLD - 1);
  assert.ok(tL.fin > 0); assert.equal(tS.fin, 0);
  assert.ok(Math.abs(tS.net - (0 - RT / 30)) < 1e-12);
  const g2 = g.map((x, i) => (i === j + 3 ? { ...x, open: 950, high: 951, low: 940, close: 945 } : x));
  const tg = tradeAt(g2, j, 1); assert.equal(tg.kind, 'gap'); assert.equal(tg.exit, 950);
  const two = simulate([{ t: g[30].time, s: 1 }, { t: g[35].time, s: -1 }], g);
  assert.equal(two.length, 1);   // one position at a time
});

test('statistics helpers', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const m = monthly([{ c: Date.UTC(2010, 0, 5) / 1000, net: 1 }, { c: Date.UTC(2010, 2, 5) / 1000, net: 1 }], Date.UTC(2010, 0, 1) / 1000, Date.UTC(2010, 2, 31) / 1000, 'net');
  assert.equal(m.months, 3);
});

test('report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-brent-ratio/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-brent-ratio/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  const head = md.match(/\*\*Verdict: ([^*]+)\*\*/)[1];
  assert.ok(head.length < 220 && head.startsWith('FAIL'));
  const t1 = r.tests.find((t) => t.id === 'T1');
  assert.ok(head.includes(t1.oos.net.toFixed(3)) && head.includes(`n ${t1.oos.n}`) && head.includes(t1.oos.tMonth.toFixed(2)));
  for (const t of r.tests) {
    assert.equal(t.pass, false);
    for (const w of ['is', 'oos']) {
      const fmt = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(3);
      assert.ok(md.includes(fmt(t[w].net)), `${t.id} ${w} net ${t[w].net}`);
      assert.ok(md.includes(`${t[w].n} (${t[w].long} / ${t[w].short})`));
    }
  }
  assert.ok(md.includes(`${t1.placebo.atLeastReal} reached`));
});
