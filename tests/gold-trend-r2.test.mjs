// research/edge/gold-trend-r2: the line fit, trades with stops, costs, the same-month excess and the report against result.json (offline)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lineFit, atr, tradeAt, rOf, dayTrades, oneAtATime, excessOf, holm, P } from '../research/edge/gold-trend-r2/run.mjs';

const dir = new URL('../research/edge/gold-trend-r2/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const day = (i) => Date.UTC(2010, 0, 4) / 1000 + i * 86400;
const mk = (closes) => closes.map((c, i) => ({ time: day(i), open: c, high: c + 1, low: c - 1, close: c }));

test('line fit: an exact exponential rise has R squared 1 and a positive slope; a zigzag has a low R squared', () => {
  const up = lineFit(mk(Array.from({ length: 80 }, (_, i) => 100 * Math.exp(0.01 * i))));
  assert.equal(up[58], null);
  assert.ok(Math.abs(up[79].r2 - 1) < 1e-9 && Math.abs(up[79].slope - 0.01) < 1e-12);
  const zz = lineFit(mk(Array.from({ length: 80 }, (_, i) => 100 + (i % 2 ? 5 : -5))));
  assert.ok(zz[79].r2 < 0.05);
  const dn = lineFit(mk(Array.from({ length: 80 }, (_, i) => 200 - i)));
  assert.ok(dn[79].slope < 0 && dn[79].r2 > 0.99);
});

test('no look-ahead: changing every bar after day k leaves the fit and the side of day k unchanged', () => {
  const c = Array.from({ length: 140 }, (_, i) => 100 + Math.sin(i / 7) * 6 + i * 0.2);
  const k = 100, b1 = mk(c), b2 = mk(c.map((x, i) => (i > k ? x * 3 : x)));
  assert.deepEqual(lineFit(b1).slice(0, k + 1), lineFit(b2).slice(0, k + 1));
  assert.deepEqual(atr(b1).slice(0, k + 1), atr(b2).slice(0, k + 1));
});

test('a trade enters at the next open, has a stop on the losing side, exits at the stop or after 10 days', () => {
  const bars = mk(Array.from({ length: 60 }, () => 100)), A = atr(bars);
  const t = tradeAt(bars, A, 20, 1);
  assert.equal(t.entryI, 21); assert.equal(t.exitI, 31); assert.equal(t.why, 'time'); assert.equal(t.exit, 100);
  assert.ok(t.stop < t.entry && t.dist === 2 * A[20]);
  const b2 = mk(Array.from({ length: 60 }, () => 100)); b2[25] = { ...b2[25], open: 90, low: 89, high: 91, close: 90 };
  const s = tradeAt(b2, atr(b2), 20, 1);
  assert.equal(s.why, 'stop'); assert.equal(s.exit, 90);
  const sh = tradeAt(bars, A, 20, -1);
  assert.ok(sh.stop > sh.entry);
  assert.equal(tradeAt(bars, A, 55, 1), null);
});

test('costs: $0.60 a round trip, financing on buys only', () => {
  const t = { side: 1, entry: 2000, exit: 2040, dist: 20, entryT: Date.UTC(2020, 0, 6) / 1000, exitT: Date.UTC(2020, 0, 13) / 1000 };
  const r = rOf(t), r2 = rOf(t, 2);
  assert.equal(r.gross, 2); assert.equal(r.cost, 0.03); assert.equal(r.nights, 7);
  assert.ok(Math.abs(r.fin - 7 * 0.000148 * 2000 / 20) < 1e-12 && Math.abs(r2.fin - 2 * r.fin) < 1e-12);
  assert.equal(rOf({ ...t, side: -1 }).fin, 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('excess = signal net minus the mean of the month\'s baseline trades; one at a time skips overlaps', () => {
  const T = (m, net, sig, e, x, side = 1) => ({ entryT: Date.UTC(2020, m, 3) / 1000, net, net2: net - 0.1, sig, entryI: e, exitI: x, side });
  const days = [T(0, 1, true, 1, 11), T(0, -1, false, 2, 12), T(0, 3, true, 3, 13, -1), T(1, 2, true, 20, 30)];
  const ex = excessOf(days);
  assert.deepEqual(ex.map((d) => d.ex), [0, 2, 0]);
  assert.deepEqual(oneAtATime(days).map((d) => d.entryI), [1, 20]);
  assert.deepEqual(oneAtATime(days, 'short').map((d) => d.entryI), [3]);
  // every baseline day of a real-ish series is a trade with a stop
  const bars = mk(Array.from({ length: 200 }, (_, i) => 100 + i * 0.3 + Math.sin(i / 5) * 3));
  for (const d of dayTrades(bars, { ...P, warm: 0 })) assert.ok(d.dist > 0 && (d.stop - d.entry) * d.side < 0);
});

test('the report matches result.json', () => {
  assert.equal(R.verdict, 'FAIL'); assert.equal(R.pass, false);
  const v = md.match(/\*\*Verdict:[^*]*\*\*/)[0];
  assert.match(v, /^\*\*Verdict: FAIL, 0 of 3: /);
  assert.ok(v.length < 220, `verdict line ${v.length} chars`);
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  const t1 = R.tests.T1;
  for (const w of ['IS', 'OOS', 'oosH1', 'oosH2']) {
    assert.ok(md.includes(`| ${t1[w].n} |`), `T1 ${w} n`);
    assert.ok(md.includes(f(t1[w].ex)) && md.includes(f(t1[w].sigNet)) && md.includes(f(t1[w].sigGross)), `T1 ${w}`);
    assert.ok(md.includes(t1[w].t.toFixed(2)), `T1 ${w} t`);
  }
  assert.ok(md.includes(`beats ${t1.placebo.beaten} of them`));
  for (const id of ['T2', 'T3']) {
    const x = R.tests[id]; assert.equal(x.pass, false);
    for (const w of ['IS', 'OOS']) {
      assert.ok(md.includes(`| ${x[w].n} |`), `${id} ${w} n`);
      assert.ok(md.includes(f(x[w].net)) && md.includes(f(x[w].gross)), `${id} ${w} R`);
      assert.ok(md.includes(x[w].t.toFixed(2)), `${id} ${w} t`);
    }
    assert.ok(md.includes(`(${x.placebo.beaten}; 40 seeds)`), `${id} placebo`);
  }
  assert.ok(t1.IS.t < 0 && t1.OOS.t < 0 && t1.pass === false);
});
