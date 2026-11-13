// metals-rsi2: the frozen RSI(2) pullback on gold and silver. The copied rule file is byte for byte the rsi2-pullback branch's,
// RSI(2) on hand values, next-open fills (no look-ahead), the exits, the stop with its gap fill, the weekend fold, costs and
// financing, the placebo's parity with the original, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as O from '../research/edge/metals-rsi2/rsi2-pullback.mjs';
import { prepare, net, placeboTrades, monthSumsR, RATE, MARKETS, P } from '../research/edge/metals-rsi2/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const DIR = new URL('../research/edge/metals-rsi2/', import.meta.url);
const DAY = 86400, T0 = Date.parse('2020-01-06T00:00:00Z') / 1000; // a Monday
const bar = (i, o, h, l, c) => ({ time: T0 + i * DAY, open: o, high: h, low: l, close: c });

test('the rule file is the rsi2-pullback branch\'s run.mjs, unchanged', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(new URL('rsi2-pullback.mjs', DIR))).digest('hex');
  assert.equal(h, 'edade889f2825fa71d911e039bfe5b9fdaaf5677e7b2fd55742e742830d5ab65');
  assert.deepEqual({ ...P }, { SMA_LONG: 200, SMA_EXIT: 5, RSI_N: 2, RSI_MAX: 10, ATR_N: 20, STOP_ATR: 3, FIN_ADD: 2.5, SEEDS: 40 });
});

test('Wilder RSI(2) on hand-made closes', () => {
  // +1, +1 -> 100; -2: g 0.5, l 1 -> 33.33; +1: g 0.75, l 0.5 -> 60
  const r = O.rsi([10, 11, 12, 10, 11], 2);
  assert.equal(r[1], null); assert.equal(r[2], 100);
  assert.equal(+r[3].toFixed(4), +(100 - 100 / 1.5).toFixed(4));
  assert.equal(+r[4].toFixed(4), 60);
  assert.equal(O.rsi([5, 5, 5], 2)[2], 50);
});

// an uptrend (close > SMA200), a sharp down day (the signal), the fill day, then a recovery
function path({ dip = 3, gap = false } = {}) {
  const D = []; let px = 100;
  for (let i = 0; i < 260; i++) { px += 0.2; D.push(bar(i, px - 0.1, px + 0.5, px - 0.5, px)); }
  const sig = D.length, base = px - dip;
  D.push(bar(sig, px, px + 0.2, base - 0.2, base));
  D.push(bar(sig + 1, base + 0.1, base + 0.5, base - 0.5, base - 0.3));
  if (gap) D.push(bar(sig + 2, base - 40, base - 39, base - 41, base - 40));
  for (let k = 0; k < 6; k++) { const c = base + 1 + k * 1.5; D.push(bar(D.length, c - 0.5, c + 0.5, c - 1, c)); }
  return { D, sig };
}

test('fill at the next open, exit at the open after the first close above SMA5', () => {
  const { D, sig } = path();
  const tr = O.simulate(D).find((t) => t.sig === sig);
  assert.equal(tr.i, sig + 1); assert.equal(tr.entry, D[sig + 1].open);
  const s5 = O.sma(D, 5), first = D.findIndex((b, j) => j >= tr.i && b.close > s5[j]);
  assert.equal(tr.j, first + 1); assert.equal(tr.exit, D[first + 1].open); assert.equal(tr.why, 'sma5');
});

test('no look-ahead: later candles change neither the signal nor the fill; no fill without the next candle', () => {
  const { D, sig } = path();
  const E = D.map((b, j) => (j > sig + 1 ? { ...b, open: 999, high: 1000, low: 998, close: 999 } : b));
  const a = O.simulate(D).find((t) => t.sig === sig), b = O.simulate(E).find((t) => t.sig === sig);
  assert.equal(a.entry, b.entry); assert.equal(a.stop, b.stop); assert.equal(a.risk, b.risk);
  assert.equal(O.simulate(D.slice(0, sig + 1)).find((t) => t.sig === sig), undefined);
});

test('the stop: 3 x ATR(20) at the signal close, filled at the open on a gap below it', () => {
  const { D, sig } = path({ gap: true });
  const tr = O.simulate(D).find((t) => t.sig === sig);
  assert.equal(+tr.risk.toFixed(9), +(3 * O.atr(D, sig)).toFixed(9));
  assert.equal(tr.stop, tr.entry - tr.risk);
  assert.equal(tr.why, 'stop'); assert.equal(tr.j, sig + 2);
  assert.equal(tr.exit, D[sig + 2].open, 'gapped through: out at the open, not at the stop');
  assert.ok(tr.exit < tr.stop);
});

test('weekend stubs fold into Monday (council/fills.mjs foldWeekend), nothing dropped', () => {
  const fri = Date.parse('2020-01-10T00:00:00Z') / 1000, sun = fri + 2 * DAY, mon = fri + 3 * DAY;
  const D = prepare([[fri, 10, 11, 9, 10.5, 1], [sun, 10.4, 12, 10.3, 10.6, 1], [mon, 10.6, 10.9, 10.1, 10.8, 1]]);
  assert.equal(D.length, 2);
  assert.deepEqual(D[1], { time: mon, open: 10.4, high: 12, low: 10.1, close: 10.8 });
});

test('costs and financing: round trip in price, nights x FIN.xau.long x entry, silver at the same fraction', () => {
  assert.equal(RATE, FIN.xau.long); assert.equal(MARKETS.xau.cost, 0.30); assert.equal(MARKETS.xag.cost, 0.03);
  const tue = Date.parse('2020-01-07T00:00:00Z') / 1000, fri = tue + 3 * DAY; // Tue, Wed (x3), Thu rollovers -> 5
  const tr = { tIn: tue, tOut: fri, entry: 2000, exit: 2010, risk: 30, why: 'sma5' };
  const g = net(tr, 0.30);
  assert.equal(g.nights, 5); assert.equal(g.nights, nights(tue, fri));
  assert.equal(+g.fin.toFixed(9), +(5 * 0.000148 * 2000).toFixed(9));
  assert.equal(+g.R.toFixed(9), +((10 - 0.30 - 5 * 0.000148 * 2000) / 30).toFixed(9));
  const s = net({ ...tr, entry: 25, exit: 25.2, risk: 1 }, 0.03);
  assert.equal(+s.fin.toFixed(12), +(5 * RATE * 25).toFixed(12));
  // a close exit counts the day's own rollover; an open exit does not
  assert.equal(net({ ...tr, tOut: tue, why: 'end' }, 0).nights, 1);
  assert.equal(net({ ...tr, tOut: tue, why: 'stop' }, 0).nights, 0);
});

test('placebo trades are the original placebo, line for line', () => {
  const { D, sig } = path();
  const real = O.simulate(D).map((t) => ({ ...t, hold: t.hold }));
  for (const seed of [1, 7, 40]) {
    const mine = placeboTrades(D, real, '2020-01-01', '2021-12-31', seed).map((t) => O.net(t, 1, []));
    const m = mine.reduce((a, t) => a + t.ret, 0) / mine.length;
    assert.equal(+m.toFixed(12), +O.placebo(D, real, 1, [], '2020-01-01', '2021-12-31', seed).toFixed(12));
  }
  assert.ok(real.length >= 1 && sig > 0);
});

test('month sums of R: every month counts, by exit month', () => {
  const t = (d, R) => ({ tOut: Date.parse(d + 'T00:00:00Z') / 1000, R });
  assert.deepEqual(monthSumsR([t('2020-01-10', 1), t('2020-01-20', -0.5), t('2020-03-02', 2)], '2020-01-01', '2020-04-30'), [0.5, 0, 2, 0]);
});

test('RESULT.md says what result.json says', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR)));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}\\*\\*`));
  assert.equal(r.verdict, Object.values(r.checks).every(Boolean) ? 'PASS' : 'FAIL');
  const f = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(3);
  const n2 = (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
  const rows = { Pooled: r.pooled, 'Gold (XAU/USD)': r.markets.xau, 'Silver (XAG/USD)': r.markets.xag };
  for (const [name, x] of Object.entries(rows)) {
    const B = x.B, A = x.A;
    assert.ok(md.includes(`| ${name} | ${B.n} | ${f(B.avgR)} | ${f(B.avgRgross)} | ${B.wr.toFixed(2)} % | ${n2(B.tTrades)} | ${n2(B.tMonths)} | ${n2(B.ddR)}R |`), name + ' B');
    assert.ok(md.includes(`| ${name} | ${A.n} | ${f(A.avgR)} | ${f(A.avgRgross)} | ${A.wr.toFixed(2)} % | ${n2(A.tTrades)} | ${n2(A.tMonths)} |`), name + ' A');
  }
  assert.ok(md.includes(`95th percentile ${f(r.placebo.p95)}R`)); assert.ok(md.includes(`**${f(r.placebo.mean)}R**`));
  assert.ok(md.includes('Item 44') && fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8').includes('Item 44'));
  assert.equal(r.placebo.means.length, 40);
});
