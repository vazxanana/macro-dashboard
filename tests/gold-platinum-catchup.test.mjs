// research/edge/gold-platinum-catchup: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DAY, RT, N, HOLD, STOP_ATR, KEYS, TESTS, aboveMap, rows, isSignal, entryIndex, tradeAt, simulate, yearBaseline, placeboDays, rng, holm, normP, yearOf,
} from '../research/edge/gold-platinum-catchup/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const DIR = new URL('../research/edge/gold-platinum-catchup/', import.meta.url);
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

test('the pre-registered set: gold traded, platinum and silver read; SMA20, 5 candles, 2 x ATR, $0.60', () => {
  assert.deepEqual(KEYS, ['xau', 'xpt', 'xag']);
  assert.deepEqual(TESTS.map((t) => [t.id, t.metals]), [['T1', ['xpt']], ['T2', ['xpt', 'xag']]]);
  assert.equal(N, 20); assert.equal(HOLD, 5); assert.equal(STOP_ATR, 2); assert.equal(RT, 0.6);
});

test('SMA state uses closes up to and including the day; changing a later close never changes an earlier state', () => {
  const a = bars(60, (i) => 100 + Math.sin(i) * 3), b = a.map((x, i) => (i === 45 ? { ...x, close: 999 } : x));
  const ma = aboveMap(a), mb = aboveMap(b);
  assert.ok(!ma.has(a[18].time) && ma.has(a[19].time), 'needs 20 closes');
  for (const x of a.slice(0, 45)) assert.equal(ma.get(x.time), mb.get(x.time));
  const up = bars(25, (i) => 100 + i);
  assert.equal(aboveMap(up).get(up[24].time), true);
});

test('signal = metal above its SMA20 and gold below its own; T2 takes either metal; a missing metal day is no row', () => {
  const gold = bars(30, (i) => 200 - i), pt = bars(30, (i) => 50 + i), ag = bars(30, () => 20, (d) => d === T0 + 29 * DAY);
  const r1 = rows(gold, [pt]);
  assert.ok(r1.every(isSignal));
  const flat = bars(30, (i) => 50 - i);
  assert.ok(!rows(gold, [flat]).some(isSignal), 'platinum down: no signal');
  const r2 = rows(gold, [flat, pt]);
  assert.ok(r2.every(isSignal), 'either metal is enough');
  assert.ok(!rows(gold, [pt, ag]).some((r) => r.t === T0 + 29 * DAY));
  const goldUp = bars(30, (i) => 100 + i);
  assert.ok(!rows(goldUp, [pt]).some(isSignal), 'gold above its SMA: no signal');
});

test('trade: next open, stop 2 x ATR(20), stop and gap fills, $0.60 + financing; one at a time', () => {
  const g = bars(40, () => 100);
  const j = entryIndex(g, g[24].time);
  assert.equal(j, 25);
  const tr = tradeAt(g, j);
  assert.equal(tr.risk, 4); assert.equal(tr.kind, 'time'); assert.equal(tr.k, j + 4);
  const fin = nights(tr.t, tr.c) * FIN.xau.long * 100 / 4;
  assert.ok(Math.abs(tr.net - (0 - 0.6 / 4 - fin)) < 1e-12);
  const gs = g.map((b, i) => (i === 27 ? { ...b, open: 90, low: 89, high: 91, close: 90 } : b));
  const gp = tradeAt(gs, j); assert.equal(gp.kind, 'gap'); assert.equal(gp.exit, 90);
  const st = g.map((b, i) => (i === 26 ? { ...b, low: 95 } : b));
  const sp = tradeAt(st, j); assert.equal(sp.kind, 'stop'); assert.equal(sp.exit, 96); assert.ok(Math.abs(sp.gross + 1) < 1e-12);
  const sim = simulate([g[24].time, g[25].time, g[29].time, g[30].time], g);
  assert.deepEqual(sim.map((x) => x.j), [25, 30], 'a signal inside an open trade is skipped');
});

test('baseline per year and the placebo keep the year and gold-below pool', () => {
  const g = bars(300, (i) => 100 + i * 0.1);
  const days = g.slice(30, 280).map((b) => b.time), base = yearBaseline(days, g);
  assert.ok(Object.keys(base).every((y) => +y === 2020 || +y === 2021));
  const sig = [days[10], days[20], days[240]], pool = days.filter((_, i) => i % 3 === 0);
  const p = placeboDays(pool, sig, rng(7)), q = placeboDays(pool, sig, rng(7));
  assert.deepEqual(p, q, 'seeded');
  assert.equal(p.length, 3);
  assert.ok(p.every((t) => pool.includes(t)));
  const cnt = (a) => a.reduce((m, t) => ({ ...m, [yearOf(t)]: (m[yearOf(t)] || 0) + 1 }), {});
  assert.deepEqual(cnt(p), cnt(sig));
});

test('holm and normP', () => {
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.ok(Math.abs(normP(1.96) - 0.025) < 1e-3);
});

test('the report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line && line.includes('FAIL') && line.length < 260);
  for (const t of r.tests) {
    for (const w of ['is', 'oos']) {
      const x = t[w];
      assert.ok(md.includes(`| ${t.id} | ${w === 'is' ? '2007-16' : '2017-26'} | ${x.n} |`), `${t.id} ${w} row`);
      assert.ok(md.includes(String(x.tMonth)));
    }
    assert.ok(md.includes(`${t.placebo.beaten} of 40`));
  }
  const t1 = r.tests[0];
  assert.ok(line.includes(t1.oos.net.toFixed(3)) && line.includes(String(t1.oos.n)) && line.includes(String(t1.oos.tMonth)));
  assert.ok(fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8').includes('Pre-registration'));
});
