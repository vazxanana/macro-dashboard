// gold-squeeze study: the squeeze, the release, no look-ahead, the stop and exits on hand-made candles, and the report
// against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { indicators, signals, trade, stream, costs, holm, monthT, placebo, P, TESTS } from '../research/edge/gold-squeeze/run.mjs';

const H = 14400, T0 = Date.parse('2022-03-01T00:00:00Z') / 1000;
const bar = (i, o, h, l, c) => ({ time: T0 + i * H, open: o, high: h, low: l, close: c });
// 40 swinging candles (closes far apart, small ranges => Bollinger wide, no squeeze), then 20 calm candles with wide ranges but flat
// closes (Bollinger narrow inside Keltner => squeeze), then a breakout close up, then a rise
function path(after = (k) => 110 + k) {
  const b = [];
  for (let i = 0; i < 40; i++) { const c = 100 + 10 * Math.sin(i / 3); b.push(bar(i, c, c + 0.5, c - 0.5, c)); }
  for (let i = 40; i < 60; i++) { const c = 100 + (i % 2 ? 0.1 : -0.1); b.push(bar(i, c, c + 3, c - 3, c)); }
  b.push(bar(60, 100, 106, 99.5, 105.5));
  for (let k = 1; k <= 40; k++) { const c = after(k); b.push(bar(60 + k, c - 0.5, c + 1, c - 1, c)); }
  return b;
}

test('squeeze is on in the calm stretch and off in the noisy one', () => {
  const b = path(), ind = indicators(b);
  assert.equal(ind.sq[30], false);
  assert.ok(ind.sq.slice(54, 60).every(Boolean));
});

test('release: first close above the upper band after a 6+ run, one signal per run', () => {
  const b = path(), ind = indicators(b), s = signals(b, ind);
  assert.equal(s.length, 1);
  assert.equal(s[0].i, 60);
  assert.equal(s[0].side, 1);
  assert.ok(b[60].close > ind.bbU[60]);
});

test('no look-ahead: changing candles after the signal changes neither the indicators up to it nor the signal', () => {
  const a = path(), b = path((k) => 90 - k);
  const ia = indicators(a), ib = indicators(b);
  for (let i = 0; i <= 60; i++) { assert.equal(ia.mid[i], ib.mid[i]); assert.equal(ia.sq[i], ib.sq[i]); assert.equal(ia.atr[i], ib.atr[i]); }
  assert.deepEqual(signals(a, ia)[0], signals(b, ib)[0]);
});

test('trade: entry at the next open, stop 1.5 ATR, every trade has a stop on the losing side', () => {
  const b = path(), ind = indicators(b), s = signals(b, ind)[0];
  const tr = trade(b, ind, s, 30);
  assert.equal(tr.fill, b[61].open);
  assert.ok(Math.abs(tr.r0 - P.STOP_ATR * ind.atr[60]) < 1e-9);
  assert.ok(tr.stop < tr.fill);
  assert.equal(tr.why, 'time');   // the rise never closes under the middle line within 30 candles
  assert.equal(tr.held, 30);
});

test('trade: a wick through the stop books -1R; a gap below the stop fills at the open', () => {
  const b = path(() => 106), s = signals(b, indicators(b))[0];
  b[62] = bar(62, 104, 105, 85, 104);
  const tr = trade(b, indicators(b), s, 30);
  assert.equal(tr.why, 'stop'); assert.ok(Math.abs(tr.R + 1) < 1e-9);
  const g = path(() => 106), sig = signals(g, indicators(g))[0];
  g[63] = bar(63, 80, 81, 79, 80);
  const tg = trade(g, indicators(g), sig, 30);
  assert.equal(tg.why, 'gap'); assert.equal(tg.R, (80 - g[61].open) / tg.r0);
});

test('trade: a close back under the middle line exits at the next open', () => {
  const b = path((k) => (k < 3 ? 106 : 99)), ind = indicators(b), s = signals(b, ind)[0];
  const tr = trade(b, ind, s, 30);
  assert.equal(tr.why, 'mid'); assert.equal(tr.fill, b[61].open); assert.equal(tr.R, (b[tr.exitIdx].open - tr.fill) / tr.r0);
});

test('costs: $0.60 a trade, financing on buys only, doubled at 2x', () => {
  const tr = { side: 1, t: T0, c: T0 + 3 * 86400, fill: 2000, r0: 10 };
  const c = costs(tr), c2 = costs(tr, 2);
  assert.ok(Math.abs(c.spread - 0.06) < 1e-12);
  assert.ok(c.fin > 0 && Math.abs(c2.fin - 2 * c.fin) < 1e-12);
  assert.equal(costs({ ...tr, side: -1 }).fin, 0);
});

test('statistics: Holm, month t counts empty months, placebo is seeded', () => {
  const h = holm([0.01, 0.04, 0.5]);
  assert.deepEqual(h.map((x) => x.adj), [0.03, 0.08, 0.5]);
  const rows = [{ c: T0, net: 1 }, { c: T0 + 40 * 86400, net: 1 }];
  assert.equal(monthT(rows, T0, T0 + 80 * 86400).months, 3);
  const b = path(), ind = indicators(b), real = stream(b, ind, TESTS.T1).trades;
  assert.deepEqual(placebo(b, ind, real, T0, T0 + 200 * H, 5), placebo(b, ind, real, T0, T0 + 200 * H, 5));
});

test('report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-squeeze/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-squeeze/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  assert.ok(Object.values(r.tests).every((t) => !t.pass));
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.includes('FAIL') && line.length < 260);
  const f = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(3);
  for (const k of ['T1', 'T2', 'T3']) for (const w of ['is', 'oos']) {
    const s = r.tests[k][w];
    assert.ok(md.includes(`| ${s.n} | ${f(s.gross)} | ${f(s.net)} | ${f(s.net2)} |`), `${k} ${w} row`);
    assert.ok(md.includes(` ${String(s.t).replace('-', '−')} |`), `${k} ${w} t`);
  }
  for (const k of ['T1', 'T2', 'T3']) assert.ok(md.includes(`| ${f(r.tests[k].placebo.median)} | ${f(r.tests[k].placebo.p95)} |`), `${k} placebo`);
});
