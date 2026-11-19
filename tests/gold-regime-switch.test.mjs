// gold-regime-switch study: the efficiency-ratio label, the breakout and fade signals, no look-ahead, the stop and exits on
// hand-made candles, the block shuffle, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { indicators, legSignal, trade, stream, costs, holm, monthT, shuffleBlocks, placebo, toBars, P, TESTS, TREND, RANGE } from '../research/edge/gold-regime-switch/run.mjs';

const H = 14400, T0 = Date.parse('2022-03-01T00:00:00Z') / 1000;
const bar = (i, o, h, l, c) => ({ time: T0 + i * H, open: o, high: h, low: l, close: c });
// 30 candles climbing 1 a candle (ER 1 => TREND, up), candle 30 closes above the prior high, then `after`
function trendPath(after = (k) => 131 + k) {
  const b = [];
  for (let i = 0; i < 30; i++) { const c = 100 + i; b.push(bar(i, c - 0.5, c + 0.6, c - 0.8, c)); }
  b.push(bar(30, 129.5, 132, 129, 131.5));
  for (let k = 1; k <= 40; k++) { const c = after(k); b.push(bar(30 + k, c - 0.3, c + 0.8, c - 0.8, c)); }
  return b;
}
// 30 candles zig-zagging around 100 (ER ~0 => RANGE), candle 30 closes far above the upper band, then `after`
function rangePath(after = (k) => 100.2) {
  const b = [];
  for (let i = 0; i < 30; i++) { const c = 100 + (i % 2 ? 0.5 : -0.5); b.push(bar(i, 100, c + 0.4, c - 0.4, c)); }
  b.push(bar(30, 100.4, 103.2, 100.3, 103));
  for (let k = 1; k <= 40; k++) { const c = after(k); b.push(bar(30 + k, c, c + 0.4, c - 0.4, c)); }
  return b;
}

test('labels: a steady climb is TREND up, a zig-zag is RANGE', () => {
  const t = indicators(trendPath()), r = indicators(rangePath());
  assert.equal(t.regime[25], TREND); assert.equal(t.dir[25], 1); assert.ok(t.er[25] > P.ER_TREND);
  assert.equal(r.regime[25], RANGE); assert.ok(r.er[25] < P.ER_RANGE);
});

test('signals: breakout buy in TREND, fade sell in RANGE, and neither leg fires in the other regime', () => {
  const tb = trendPath(), ti = indicators(tb), rb = rangePath(), ri = indicators(rb);
  assert.equal(legSignal(tb, ti, 30, 'brk'), 1);
  assert.equal(legSignal(tb, ti, 30, 'fade'), 0);   // above the band but TREND: no fade
  assert.ok(rb[30].close > ri.up[30]);
  assert.equal(legSignal(rb, ri, 30, 'fade'), -1);
  assert.equal(legSignal(rb, ri, 30, 'brk'), 0);    // above the 20-bar high but RANGE: no breakout
  const s = stream(rb, ri, TESTS.T1.legs).trades[0];
  assert.equal(s.leg, 'fade'); assert.equal(s.side, -1);
});

test('no look-ahead: changing candles after bar 30 changes no indicator up to it and not the signal', () => {
  const a = trendPath(), b = trendPath((k) => 120 - k), ia = indicators(a), ib = indicators(b);
  for (const k of ['er', 'dir', 'atr', 'h20', 'l20', 'mid', 'up', 'lo', 'regime']) for (let i = 0; i <= 30; i++) assert.equal(ia[k][i], ib[k][i], k + i);
  assert.equal(legSignal(a, ia, 30, 'brk'), legSignal(b, ib, 30, 'brk'));
  assert.equal(ia.h20[30], Math.max(...a.slice(10, 30).map((x) => x.high)));   // the 20 candles BEFORE i
});

test('trade: entry at the next open, stop 1.5 ATR(14) on the losing side, time exit at 30', () => {
  const b = trendPath(), ind = indicators(b), tr = trade(b, ind, { i: 30, side: 1, leg: 'brk' });
  assert.equal(tr.fill, b[31].open);
  assert.ok(Math.abs(tr.r0 - P.STOP_ATR * ind.atr[30]) < 1e-12);
  assert.ok(tr.stop < tr.fill);
  assert.equal(tr.why, 'time'); assert.equal(tr.held, 30);
});

test('trade: stop, gap, channel exit and middle-band exit', () => {
  const b = trendPath(() => 132), s = { i: 30, side: 1, leg: 'brk' };
  b[33] = bar(33, 131.8, 132, 110, 131.8);
  const st = trade(b, indicators(b), s);
  assert.equal(st.why, 'stop'); assert.ok(Math.abs(st.R + 1) < 1e-9);
  const g = trendPath(() => 132); g[34] = bar(34, 110, 111, 109, 110);
  const tg = trade(g, indicators(g), s);
  assert.equal(tg.why, 'gap'); assert.equal(tg.R, (110 - g[31].open) / tg.r0);
  const c = trendPath((k) => (k < 12 ? 131 : 130)), ic = indicators(c), tc = trade(c, ic, s);   // close under the 10-bar low
  assert.equal(tc.why, 'channel'); assert.equal(tc.R, (c[tc.exitIdx].open - tc.fill) / tc.r0);
  const r = rangePath(), ir = indicators(r), tf = trade(r, ir, { i: 30, side: -1, leg: 'fade' });
  assert.equal(tf.why, 'mid'); assert.ok(r[tf.exitIdx - 1].close <= ir.mid[tf.exitIdx - 1]);
  assert.ok(tf.stop > tf.fill);
});

test('data: candles before 2016 are dropped', () => {
  const rows = [[Date.parse('2015-12-31T20:00:00Z') / 1000, 1, 1, 1, 1, 0], [Date.parse('2016-01-01T00:00:00Z') / 1000, 2, 2, 2, 2, 0]];
  assert.deepEqual(toBars(rows).map((x) => x.close), [2]);
});

test('costs: $0.60 a trade, financing on buys only, doubled at 2x', () => {
  const tr = { side: 1, t: T0, c: T0 + 3 * 86400, fill: 2000, r0: 10 };
  const c = costs(tr), c2 = costs(tr, 2);
  assert.ok(Math.abs(c.spread - 0.06) < 1e-12);
  assert.ok(c.fin > 0 && Math.abs(c2.fin - 2 * c.fin) < 1e-12);
  assert.equal(costs({ ...tr, side: -1 }).fin, 0);
});

test('statistics: Holm, month t counts empty months, the block shuffle keeps blocks and counts, placebo is seeded', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.5]).map((x) => x.adj), [0.03, 0.08, 0.5]);
  assert.equal(monthT([{ c: T0, net: 1 }, { c: T0 + 40 * 86400, net: 1 }], T0, T0 + 80 * 86400).months, 3);
  const lab = Array.from({ length: 100 }, (_, i) => Math.floor(i / 20));
  const sh = shuffleBlocks(lab, 7);
  assert.equal(sh.length, 100);
  for (let i = 0; i < 100; i += 20) assert.ok(sh.slice(i, i + 20).every((v) => v === sh[i]));
  assert.deepEqual([...sh].sort(), [...lab].sort());
  assert.deepEqual(shuffleBlocks(lab, 7), sh);
  const b = rangePath(), ind = indicators(b);
  assert.deepEqual(placebo(b, ind, TESTS.T1.legs, T0, 5), placebo(b, ind, TESTS.T1.legs, T0, 5));
});

test('report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-regime-switch/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-regime-switch/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  assert.ok(Object.values(r.tests).every((t) => !t.pass));
  assert.ok(r.data.h4.from >= Date.parse('2016-01-01T00:00:00Z') / 1000);
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.includes('FAIL') && line.length < 220);
  const f = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(3);
  for (const k of ['T1', 'T2', 'T3']) for (const w of ['is', 'oos']) {
    const s = r.tests[k][w];
    assert.ok(md.includes(`| ${s.n} | ${f(s.gross)} | ${f(s.net)} | ${f(s.net2)} |`), `${k} ${w} row`);
    assert.ok(md.includes(` ${String(s.t).replace('-', '−')} |`), `${k} ${w} t`);
  }
  for (const k of ['T1', 'T2', 'T3']) assert.ok(md.includes(`| ${f(r.tests[k].placebo.median)} | ${f(r.tests[k].placebo.p95)} |`), `${k} placebo`);
  for (const [k, w] of [['brkAnyRegime', 'oos'], ['fadeAnyRegime', 'oos']]) {
    const s = r.descriptive[k][w];
    assert.ok(md.includes(`| ${s.n} | ${f(s.gross)} | ${f(s.net)} |`), k);
  }
});
