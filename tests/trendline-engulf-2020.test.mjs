// node --test tests/trendline-engulf-2020.test.mjs - the trendline third-touch / break-and-retest engulf study
// (research/edge/trendline-engulf-2020), offline: no look-ahead on seeded candles, stops on the losing side, lines as
// pre-registered, and the report pinned to result.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { lines, signals, stream, lineVal, atrs, windowStats, P, TFS } from '../research/edge/trendline-engulf-2020/run.mjs';

const DIR = new URL('../research/edge/trendline-engulf-2020/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR)));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
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
const key = (x) => [x.rule, x.side, x.t, x.stop, x.at, x.line.join(':')].join('|');

test('no look-ahead: signals known by a moment do not move when every later price changes', () => {
  let seen = 0;
  for (const seed of [5, 17]) {
    const m5 = walk(50000, seed);
    for (const cutI of [21000, 39000]) {
      const cut = m5[cutI].e;
      const A = m5.map((b, i) => (i <= cutI ? b : { ...b, o: b.o + 30, h: b.h + 80, l: b.l - 80, c: b.c - 25 }));
      for (const sec of Object.values(TFS)) for (const rule of ['A', 'B']) {
        const pick = (x) => signals(K.resample(x, sec), rule).filter((u) => u.t <= cut).map(key);
        const a = pick(A), b = pick(m5); assert.deepEqual(a, b); seen += b.length;
      }
    }
  }
  assert.ok(seen > 20, 'the synthetic market gives signals to compare');
});

test('lines follow the pre-registered limits; every signal has its stop on the losing side', () => {
  const m5 = walk(50000, 9); const B = K.resample(m5, 3600), atr = atrs(B);
  const L = lines(B, atr); assert.ok(L.length > 10);
  for (const x of L) {
    const gap = x.B.i - x.A.i; assert.ok(gap >= P.minGap && gap <= P.maxGap);
    assert.ok(x.s > 0 ? x.B.price < x.A.price : x.B.price > x.A.price);
    assert.ok(Math.abs(x.m) >= P.slopeMin * atr[x.drawn] - 1e-12 && Math.abs(x.m) <= P.slopeMax * atr[x.drawn] + 1e-12);
    for (let y = x.A.i + 1; y <= x.drawn; y++) assert.ok(x.s > 0 ? B[y].c <= lineVal(x, y) : B[y].c >= lineVal(x, y));
  }
  for (const rule of ['A', 'B']) {
    const S = signals(B, rule, atr); assert.ok(S.length > 0);
    for (const u of S) assert.ok(u.side * (B[u.j].c - u.stop) > 0, 'stop on the losing side of the trigger close');
    const { trades } = stream(m5, S, { cost: 0.3, tfSec: 3600, from: 0 });
    for (const t of trades) assert.ok(t.side * (t.entry - t.stop) > 0 && t.risk >= P.minRiskCost * 0.3);
  }
});

test('windowStats pads empty months and takes the one-sided p', () => {
  const a = Date.UTC(2020, 0, 1) / 1000, b = Date.UTC(2020, 3, 1) / 1000;
  const xs = [{ fillT: a + 86400, R: 1, Rnet: 1 }, { fillT: a + 40 * 86400, R: 0.5, Rnet: 0.5 }];
  const w = windowStats(xs, a, b); assert.equal(w.months, 3); assert.equal(w.n, 2); assert.ok(w.pOne < 0.5);
});

test('the report says what result.json says', () => {
  assert.equal(R.verdict, 'FAIL'); assert.deepEqual(R.passed, []);
  assert.match(MD.split('\n')[2], /^\*\*Verdict: FAIL\. /);
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  for (const id of ['T1', 'T2', 'T3', 'T4']) {
    const t = R.tests[id], w = (e) => `${e.net.n} / ${f(e.net.meanR)} (t ${e.net.tMonth.toFixed(2)})`;
    const row = `| ${id} | ${t.rule === 'A' ? 'third touch' : 'break and retest'}, ${t.tf} | ${w(t.disc)} | ${w(t.conf)} | ${f(t.conf.x2.meanR)} | ${f(t.conf.gross.meanR)} | ${t.pHolm.toFixed(3)} |`;
    assert.ok(MD.includes(row), 'row ' + id);
    assert.equal(t.bar.pass, false);
    const g = R.descriptive[id].gold, T = R.descriptive[id].targets;
    assert.ok(MD.includes(`| ${id} | ${w(g.disc)} | ${w(g.conf)} | ${w(T['1R'].conf)} | ${w(T['3R'].conf)} |`), 'descriptive ' + id);
  }
  for (const m of ['xau', 'eurusd']) for (const c of Object.values(R.cutCheck[m])) assert.equal(c.identical, true);
});
