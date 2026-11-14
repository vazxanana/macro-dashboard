// research/edge/gold-curve-slope: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DAY, RT, DUR, TESTS, weekly, signals, sideOf, entryIndex, tradeAt, simulate, holm, normP, monthly, placeboDays, rng,
} from '../research/edge/gold-curve-slope/run.mjs';

const DIR = new URL('../research/edge/gold-curve-slope/', import.meta.url);
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
function bars(n, fn, skip = () => false) {
  const out = []; let d = T0, i = 0;
  while (out.length < n) {
    const wd = new Date(d * 1000).getUTCDay();
    if (wd !== 0 && wd !== 6 && !skip(d)) { const c = fn(i++); out.push({ time: d, open: c, high: c + 1, low: c - 1, close: c }); }
    d += DAY;
  }
  return out;
}

test('weekly points: gold\'s last day of the week, both bonds on that same day, else the week is skipped', () => {
  const g = bars(30, (i) => 100 + i), s = bars(30, () => 100), l = bars(30, () => 100, (d) => d === T0 + 11 * DAY);
  const p = weekly(g, s, l);
  assert.ok(p.every((x) => new Date(x.t * 1000).getUTCDay() === 5));
  assert.ok(!p.some((x) => x.t === T0 + 11 * DAY));
});

test('slope change: a long-bond price fall (long yield up) is steepening, z uses only earlier values', () => {
  // 2-year flat; 30-year price falls 1 % over 4 weeks at the end -> long yield up -> steepening
  const mk = (n, drop) => Array.from({ length: n }, (_, i) => ({ t: T0 + i * 7 * DAY, s: 100, l: 100 * (1 + 0.002 * Math.sin(i)) * (i >= n - 1 ? 1 - drop : 1), brk: false }));
  const r = signals(mk(170, 0.01), DUR.usb02y, DUR.usb30y, 156, 4);
  const last = r[r.length - 1];
  assert.ok(last.ds > 0 && last.z > 1 && sideOf(last) === 1);
  assert.ok(Math.abs(last.dyS) < 1e-12);
  // a change at the last week never changes any earlier row
  const a = signals(mk(170, 0), DUR.usb02y, DUR.usb30y, 156, 4), b = signals(mk(170, 0.05), DUR.usb02y, DUR.usb30y, 156, 4);
  assert.deepEqual(a.slice(0, -1), b.slice(0, -1));
  assert.equal(a[0].t, T0 + 160 * 7 * DAY, 'needs 4 weeks of change and 156 earlier values');
  // flattening: long bond price up -> short gold
  const f = signals(mk(170, -0.01), DUR.usb02y, DUR.usb30y, 156, 4);
  assert.equal(sideOf(f[f.length - 1]), -1);
  // a gap restarts the history
  const p = mk(400, 0); p[200].brk = true;
  const s2 = signals(p, DUR.usb02y, DUR.usb30y, 156, 4);
  assert.ok(!s2.some((x) => x.t >= p[200].t && x.t < p[360].t));
});

test('trade: next open, stop 2 x ATR(20), every trade has a stop on the losing side, financing on longs only', () => {
  const g = bars(60, () => 100);   // true range 2 -> ATR 2, risk 4
  const j = entryIndex(g, g[25].time);
  assert.equal(j, 26);
  const L = tradeAt(g, j, 1, 20), S = tradeAt(g, j, -1, 20);
  assert.equal(L.stop, 96); assert.equal(S.stop, 104);
  assert.ok(L.stop < L.e && S.stop > S.e);
  assert.ok(L.fin > 0); assert.equal(S.fin, 0);
  assert.ok(Math.abs(S.net + RT / 4) < 1e-12);
  const g2 = bars(60, (i) => (i === 30 ? 90 : 100)); g2[30].open = 90;
  const x = tradeAt(g2, 26, 1, 20);
  assert.equal(x.kind, 'gap'); assert.equal(x.exit, 90);
  const tr = simulate([{ t: g[25].time, s: 1 }, { t: g[27].time, s: -1 }], g, 20);
  assert.equal(tr.length, 1, 'one position at a time');
});

test('statistics: Holm, the one-sided p, month sums with empty months, a seeded placebo', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.5]).map((p) => +p.toFixed(3)), [0.03, 0.08, 0.5]);
  assert.ok(Math.abs(normP(1.96) - 0.025) < 0.001);
  const m = monthly([{ c: Date.UTC(2020, 0, 10) / 1000, net: 1 }, { c: Date.UTC(2020, 2, 10) / 1000, net: 1 }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 2, 31) / 1000, 'net');
  assert.equal(m.months, 3);
  const el = Array.from({ length: 50 }, (_, i) => ({ t: i })), sides = [1, 1, -1];
  assert.deepEqual(placeboDays(el, sides, rng(7)), placeboDays(el, sides, rng(7)));
});

test('report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  assert.deepEqual(r.tests.map((t) => t.id), TESTS.map((t) => t.id));
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.includes('FAIL') && line.length < 260);
  const t1 = r.tests[0];
  assert.ok(line.includes(`n ${t1.oos.n}`) && line.includes(`month t ${t1.oos.tMonth}`) && line.includes(`+${t1.oos.net}R`));
  for (const t of r.tests) {
    assert.ok(md.includes(`**${t.oos.tMonth.toFixed(2)}**`), `${t.id} OOS t in the table`);
    assert.ok(md.includes(`no (${t.placebo.beaten})`), `${t.id} placebo count`);
    assert.equal(t.placebo.t.length, 40);
    assert.ok(t.oos.medianStopUsd >= 10 && t.is.medianStopUsd >= 10);
    assert.ok(t.trades.every((x) => (x.side > 0 ? x.e - x.risk : x.e + x.risk) !== x.e));
  }
  assert.equal(r.fin, 0.000148);
});
