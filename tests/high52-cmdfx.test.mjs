// Nearness to the 52-week high on commodities and currencies (research/edge/high52-cmdfx): offline checks of the signal
// (no look-ahead), the residual regression, the thirds, the stop and costs of a leg, the books, Holm, and the report
// against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  nearness, residuals, pick, leg, indexMarket, signalsAt, groupBook, combine, holm, costFrac, shiftYm, CMD, FX, EXOTIC, P,
  headline, report,
} from '../research/edge/high52-cmdfx/run.mjs';

const dir = new URL('../research/edge/high52-cmdfx/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// a weekday-only daily series from 2019-01-01, closes from f(i)
function series(key, n, f, range = 0.01) {
  const bars = []; let t = Date.UTC(2019, 0, 1) / 1000, i = 0;
  while (bars.length < n) {
    const wd = new Date(t * 1000).getUTCDay();
    if (wd !== 0 && wd !== 6) { const c = f(i++); bars.push({ time: t, open: c, high: c * (1 + range), low: c * (1 - range), close: c }); }
    t += 86400;
  }
  return indexMarket(key, bars);
}

test('nearness = close / the highest close of the last 252 candles, and needs 252 of them', () => {
  const m = series('x', 400, (i) => (i === 100 ? 200 : 100 + i * 0.01));
  assert.equal(nearness(m.bars, 250), null);
  assert.equal(nearness(m.bars, 251), m.bars[251].close / 200);
  assert.equal(nearness(m.bars, 351), m.bars[351].close / 200);
  // the high leaves the window after 252 candles; a rising series is then at its high
  assert.equal(nearness(m.bars, 352), 1);
});

test('no look-ahead: changing every candle after the signal day leaves the signal unchanged', () => {
  const f = (i) => 100 + Math.sin(i / 7) * 5 + i * 0.02, S = '2020-04';
  const a = series('x', 450, f), k = a.last.get(S);
  const b = series('x', 450, (i) => (i > k ? 999 : f(i)));
  const sa = signalsAt([a], S)[0], sb = signalsAt([b], S)[0];
  assert.ok(sa && sb && b.bars[k + 1].close === 999);
  assert.deepEqual({ ...sa, res: undefined }, { ...sb, res: undefined });
});

test('residual nearness removes the linear part of momentum', () => {
  const x = [0.1, -0.2, 0.3, 0.05, -0.1], y = x.map((v, i) => 0.9 + 0.5 * v + [0.01, -0.02, 0, 0.03, -0.02][i]);
  const r = residuals(y, x);
  assert.ok(Math.abs(r.reduce((a, b) => a + b, 0)) < 1e-12);
  assert.ok(Math.abs(r.reduce((a, v, i) => a + v * x[i], 0)) < 1e-12);
});

test('thirds: floor(n / 3) a side, highest long, lowest short', () => {
  const sigs = 'abcdefghijk'.split('').map((key, i) => ({ key, near: i / 10 }));
  const p = pick(sigs, 'near');
  assert.deepEqual(p.long.map((s) => s.key), ['k', 'j', 'i']);
  assert.deepEqual(p.short.map((s) => s.key), ['c', 'b', 'a']);
  assert.equal(pick(sigs.slice(0, 8), 'near').long.length, 2);
});

test('a leg: entry at the next month first open, 3 ATR stop, stop and gap fills, costs and financing in R', () => {
  const m = series('eurusd', 400, (i) => 1.1 + i * 0.0001, 0.001);
  const S = '2020-04', M = shiftYm(S, 1), e = m.first.get(M);
  const l = leg(m, S, 1, 0.002);
  assert.equal(l.how, 'close');
  const dist = 0.006, entry = m.bars[e].open, exit = m.bars[m.last.get(M)].close;
  assert.ok(Math.abs(l.gross - (exit - entry) / dist) < 1e-12);
  assert.ok(Math.abs(l.costR - (P.FX_FRAC * entry) / dist) < 1e-12);
  assert.ok(l.nights > 15 && Math.abs(l.finR - (l.nights * P.FX_FIN_NIGHT * entry) / dist) < 1e-12);
  // short into a rising market with a tight ATR: stopped at the stop, -1R gross
  const s = leg(m, S, -1, 0.00001);
  assert.ok(s.how === 'stop' || s.how === 'gap');
  assert.ok(s.gross <= -1 + 1e-9);
  // a gap through the stop fills at the open
  const e2 = series('xau', 400, () => 100).first.get(M);
  const g = series('xau', 400, (i) => (i > e2 + 2 ? 50 : 100), 0.0001);
  const gl = leg(g, '2020-04', 1, 1);
  assert.equal(gl.how, 'gap'); assert.ok(gl.gross < -1);
});

test('costs: gold and silver per ounce, others a share of price, exotics wider', () => {
  assert.equal(costFrac('xau', 3000), 0.3 / 3000);
  assert.equal(costFrac('wheat', 500), P.CMD_FRAC);
  assert.equal(costFrac('eurusd', 1.1), P.FX_FRAC);
  assert.equal(costFrac('usdtry', 30), 0.002);
  assert.equal(CMD.length, 12); assert.equal(FX.length, 35);
  assert.ok(!FX.includes('usdhkd') && !FX.includes('usdcnh') && !CMD.includes('xaueur'));
  assert.ok(Object.keys(EXOTIC).every((k) => FX.includes(k)));
});

test('books: a group needs its minimum, combined is the mean of the two', () => {
  const mks = 'abcdefghi'.split('').map((k, j) => series(['xau', 'xag', 'xpt', 'xpd', 'xcu', 'bco', 'wtico', 'corn', 'wheat'][j], 600, (i) => 100 + j * Math.sin(i / (20 + j)) * 3 + i * 0.01 * (j - 4)));
  const months = ['2020-06', '2020-07', '2020-08'];
  const b = groupBook(mks, months, 'near', { min: 8 });
  assert.equal(b.size, 3);
  for (const v of b.values()) assert.equal(v.legs.length, 6);
  assert.equal(groupBook(mks, months, 'near', { min: 10 }).size, 0);
  const c = combine(new Map([['2020-07', { gross: 1, net: 0.5 }]]), new Map([['2020-07', { gross: 3, net: -0.5 }], ['2020-08', { gross: 2, net: 1 }]]));
  assert.deepEqual(c.get('2020-07'), { gross: 2, net: 0, groups: 2 });
  assert.equal(c.get('2020-08').net, 1);
});

test('Holm adjusts in order and caps at 1', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03, 0.5]).map((v) => +v.toFixed(4)), [0.04, 0.09, 0.09, 0.5]);
  assert.equal(holm([0.9, 0.9])[0], 1);
});

test('the report matches result.json, the verdict follows the pre-registered bar', () => {
  assert.equal(R.tests.length, 4);
  const t1 = R.tests[0];
  const pass = t1.oos.net.mean > 0 && t1.oos.net.t >= 2 && t1.holm < 0.05 && Math.sign(t1.is.net.mean) === Math.sign(t1.oos.net.mean) && t1.oosX2.mean > 0;
  assert.equal(R.verdict, pass ? 'PASS' : 'FAIL');
  assert.equal(md, report(R));
  assert.ok(md.includes(headline(R)));
  assert.match(md, /^\*\*Verdict: (PASS|FAIL): .{20,}\*\*$/m);
  assert.ok(md.includes(`(n ${t1.oos.net.n}, t `));
  assert.equal(R.placebo.runs.length, 40);
  assert.equal(R.tests.find((t) => t.id === 'T1').oos.from, '2017-01');
  assert.equal(R.tests[0].is.to, '2016-12');
  assert.ok(R.months.every((m) => m.month <= '2026-10'));
});
