// research/edge/gold-cci: the CCI, the signals, stops, costs and the report against result.json (offline)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cci, atr, entrySig, exitSig, simulate, rOf, holm, P, TESTS } from '../research/edge/gold-cci/run.mjs';

const dir = new URL('../research/edge/gold-cci/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const day = (i) => Date.UTC(2010, 0, 4) / 1000 + i * 86400;
const mk = (closes) => closes.map((c, i) => ({ time: day(i), open: c, high: c + 1, low: c - 1, close: c }));

test('CCI(20) = (TP - mean) / (0.015 x mean absolute deviation), and reads no later day', () => {
  const c = Array.from({ length: 20 }, (_, i) => 100 + i);
  const C = cci(mk(c));
  assert.equal(C[18], null);
  // TP = close here; mean 109.5, mean abs deviation 5, last TP 119
  assert.ok(Math.abs(C[19] - (119 - 109.5) / (0.015 * 5)) < 1e-9);
  const long = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 3) * 8);
  const k = 50, a = cci(mk(long)), b = cci(mk(long.map((x, i) => (i > k ? x * 2 : x))));
  assert.deepEqual(a.slice(0, k + 1), b.slice(0, k + 1));
});

test('entry and exit signals: trend crosses +/-100 outward, fade crosses back inward, exits at the zero line', () => {
  assert.equal(entrySig([90, 120], 1, 'trend'), 1);
  assert.equal(entrySig([-90, -120], 1, 'trend'), -1);
  assert.equal(entrySig([120, 130], 1, 'trend'), 0);
  assert.equal(entrySig([120, 90], 1, 'fade'), -1);
  assert.equal(entrySig([-120, -90], 1, 'fade'), 1);
  assert.equal(exitSig([-5], 0, 1, 'trend'), true);
  assert.equal(exitSig([5], 0, 1, 'trend'), false);
  assert.equal(exitSig([5], 0, 1, 'fade'), true);
  assert.equal(exitSig([-5], 0, -1, 'fade'), true);
});

test('a signal on day i fills at day i+1 open with a 2 ATR stop; stops fill at a gap open; 30-day limit', () => {
  const p = { ...P, warm: 0 };
  // flat, then a sharp rise (CCI crosses +100), then flat at the new level for long
  const c = [...Array(30).fill(100), 110, ...Array(60).fill(110)];
  const bars = mk(c), C = cci(bars);
  const sigDay = C.findIndex((x, i) => i > 0 && entrySig(C, i, 'trend') === 1);
  assert.equal(sigDay, 30);
  const t = simulate(bars, TESTS.T2, p);
  assert.equal(t[0].entryI, 31); assert.equal(t[0].side, 1);
  assert.ok(Math.abs(t[0].dist - 2 * atr(bars)[30]) < 1e-12);
  for (const x of t) assert.ok(x.dist > 0 && (x.stop - x.entry) * x.side < 0);
  assert.ok(t[0].bars <= p.maxHold);
  // gap through the stop fills at the open
  const b2 = mk(c); b2[33] = { ...b2[33], open: 80, low: 79, high: 81, close: 80 };
  const s2 = simulate(b2, TESTS.T2, p);
  assert.equal(s2[0].why, 'stop'); assert.equal(s2[0].exit, 80);
  // the long-only test never sells
  const down = mk([...Array(30).fill(100), 90, ...Array(30).fill(90)]);
  assert.equal(simulate(down, TESTS.T2, p).length, 0);
  const sh = simulate(down, TESTS.T1, p);
  assert.equal(sh[0].side, -1); assert.ok(sh[0].stop > sh[0].entry);
});

test('costs: $0.60 a round trip and financing on buys only, doubled at 2x', () => {
  const t = { side: 1, entry: 2000, exit: 2040, dist: 20, entryT: Date.UTC(2020, 0, 6) / 1000, exitT: Date.UTC(2020, 0, 13) / 1000 };
  const r = rOf(t), r2 = rOf(t, 2);
  assert.equal(r.gross, 2); assert.equal(r.cost, 0.03); assert.equal(r.nights, 7);
  assert.ok(Math.abs(r.fin - 7 * 0.000148 * 2000 / 20) < 1e-12);
  assert.ok(Math.abs(r2.fin - 2 * r.fin) < 1e-12);
  assert.equal(rOf({ ...t, side: -1 }).fin, 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('the report matches result.json', () => {
  assert.equal(R.verdict, 'FAIL'); assert.equal(R.pass, false);
  const v = md.match(/\*\*Verdict:[^*]*\*\*/)[0];
  assert.match(v, /^\*\*Verdict: FAIL, 0 of 3: /);
  assert.ok(v.length < 220);
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  for (const id of ['T1', 'T2', 'T3']) {
    const x = R.tests[id];
    assert.equal(x.pass, false);
    assert.ok(x.OOS.medStop >= 10);
    for (const w of ['IS', 'OOS']) {
      assert.ok(md.includes(`| ${x[w].n} |`), `${id} ${w} n`);
      assert.ok(md.includes(f(x[w].net)), `${id} ${w} net`);
      assert.ok(md.includes(x[w].t.toFixed(2)), `${id} ${w} t`);
    }
    assert.ok(md.includes(`(${x.placebo.beaten}; median ${f(x.placebo.median)}R)`), `${id} placebo`);
  }
  assert.ok(md.includes(`Holm p ${R.tests.T2.holmP.toFixed(2)}`));
  assert.ok(md.includes(`${Math.round(R.tests.T1.costR.share * 100)} % of the gross R`));
});
