// weekly-daily-rejection-2020: RESULT.md figures pinned to result.json, the pass bar, the stop buffer and a cut test on
// made-up candles (offline, no candle cache).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stopOf, passOf, cutCheck, marketTrades, MARKETS } from '../research/edge/weekly-daily-rejection-2020/run.mjs';

const dir = new URL('../research/edge/weekly-daily-rejection-2020/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const fmt = (x, d = 3) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(d);
const n = (x) => x.toLocaleString('en-US');

test('verdict line and the two tests match result.json', () => {
  assert.equal(R.verdict, 'FAIL');
  assert.match(md.split('\n')[2], /^\*\*Verdict: FAIL\./);
  const T1 = R.pooled.T1, T2 = R.pooled.T2;
  assert.ok(md.includes(`${fmt(T1.all.avg)}R a trade after costs (n ${n(T1.all.n)}, month-sum t ${T1.all.tMonth})`));
  assert.ok(md.includes(`${fmt(T2.all.avg)}R (n ${n(T2.all.n)}, month-sum t ${T2.all.tMonth})`));
  for (const [k, T] of [['T1 longs', T1], ['T2 shorts', T2]]) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${k} |`));
    assert.ok(row.includes(`n ${n(T.disc.n)}, ${fmt(T.disc.avg)}R, t ${T.disc.tMonth}`), k);
    assert.ok(row.includes(`n ${n(T.conf.n)}, ${fmt(T.conf.avg)}R, t ${T.conf.tMonth}`), k);
    assert.ok(row.includes(`${fmt(T.disc.avg2x)} / ${fmt(T.conf.avg2x)}R`), k);
    assert.ok(row.includes(R.tests[k.slice(0, 2)].pHolm.toFixed(3)), k);
  }
  assert.equal(R.tests.T1.pass, false); assert.equal(R.tests.T2.pass, false);
});

test('per-market and gold rows match result.json', () => {
  assert.deepEqual(Object.keys(R.markets), MARKETS);
  for (const [m, x] of Object.entries(R.markets)) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${m} |`));
    assert.ok(row.includes(`${x.long.all.n} / ${fmt(x.long.all.avg)} / ${x.long.all.tMonth.toFixed(2)}`), m);
    assert.ok(row.includes(`${x.short.all.n} / ${fmt(x.short.all.avg)} / ${x.short.all.tMonth.toFixed(2)}`), m);
  }
  const g = R.gold.long;
  assert.ok(md.includes(`Long n ${g.all.n}, ${fmt(g.all.avg)}R a trade, month t ${g.all.tMonth}`));
  assert.equal(R.cutAllSame, true);
});

test('the pass bar and the stop buffer', () => {
  const ok = { disc: { n: 100, avg: 0.1, tMonth: 2, avg2x: 0.05 }, conf: { n: 50, avg: 0.1, tMonth: 2.5, avg2x: 0.02 } };
  assert.equal(passOf(ok, 0.04), true);
  assert.equal(passOf(ok, 0.06), false);
  assert.equal(passOf({ ...ok, conf: { ...ok.conf, avg2x: -0.01 } }, 0.01), false);
  assert.equal(passOf({ ...ok, disc: { ...ok.disc, n: 99 } }, 0.01), false);
  assert.ok(stopOf({ low: 100, high: 110 }, 1) < 100 && stopOf({ low: 100, high: 110 }, -1) > 110);
});

// made-up H1 candles: a drift that turns every ~16 weeks, with noise, weekdays only
function fake(seed, hours) {
  let a = seed >>> 0; const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const out = []; let px = 100; let t = Date.UTC(2019, 0, 7) / 1000;
  while (out.length < hours) { const wd = new Date(t * 1000).getUTCDay(); if (wd !== 6 && !(wd === 0 && new Date(t * 1000).getUTCHours() < 22) && !(wd === 5 && new Date(t * 1000).getUTCHours() >= 21)) {
    const dr = Math.floor(out.length / 1920) % 2 ? 0.52 : 0.48, o = px, c = o * (1 + (rnd() - dr) * 0.006), h = Math.max(o, c) * (1 + rnd() * 0.002), l = Math.min(o, c) * (1 - rnd() * 0.002);
    out.push({ time: t, open: o, high: h, low: l, close: c }); px = c; } t += 3600; }
  return out;
}

test('cut test and a stop on the losing side, on made-up candles', () => {
  const h1 = fake(7, 24 * 5 * 120);
  for (const side of [1, -1]) {
    const c = cutCheck(h1, side, h1[Math.floor(h1.length * 0.6)].time);
    assert.ok(c.before > 0); assert.equal(c.same, true);
    const { rule } = marketTrades(h1, side, 0.01, { from: 0 });
    assert.ok(rule.length > 0);
    for (const x of rule) assert.ok(side > 0 ? x.stop < x.entry : x.stop > x.entry);
  }
});
