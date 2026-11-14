// research/edge/gold-adx-trend: Wilder's DMI / ADX, the state rule, stops, costs and the report against result.json (offline)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dmi, states, signals, crosses, atr, simulate, rOf, holm, P, TESTS } from '../research/edge/gold-adx-trend/run.mjs';

const dir = new URL('../research/edge/gold-adx-trend/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const day = (i) => Date.UTC(2010, 0, 4) / 1000 + i * 86400;
const mk = (closes) => closes.map((c, i) => ({ time: day(i), open: c, high: c + 1, low: c - 1, close: c }));

test('Wilder DMI: a steady rise has +DI > -DI and an ADX that climbs; first ADX after 2n-1 bars', () => {
  const bars = mk(Array.from({ length: 60 }, (_, i) => 100 + i));
  const d = dmi(bars);
  assert.equal(d.pdi[13], null); assert.ok(d.pdi[14] > 0);
  assert.equal(d.adx[26], null); assert.ok(d.adx[27] != null);
  assert.ok(d.pdi[40] > d.mdi[40] && d.mdi[40] === 0);
  assert.ok(Math.abs(d.adx[59] - 100) < 1e-9);
  assert.equal(states(bars)[59], 1);
  const down = dmi(mk(Array.from({ length: 60 }, (_, i) => 200 - i)));
  assert.ok(down.mdi[50] > down.pdi[50]);
  // hand check of the first DI: 14 bars of +1 highs, TR 2 each -> +DI = 100 * 14 / 28 = 50
  assert.ok(Math.abs(d.pdi[14] - 50) < 1e-9);
});

test('no look-ahead: changing every bar after day k leaves states and signals up to k unchanged', () => {
  const c = Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i / 6) * 8 + i * 0.1);
  const k = 80, b1 = mk(c), b2 = mk(c.map((x, i) => (i > k ? x * 2 : x)));
  assert.deepEqual(states(b1).slice(0, k + 1), states(b2).slice(0, k + 1));
  for (const ind of ['state', 'cross']) assert.deepEqual(signals(b1, ind).slice(0, k + 1), signals(b2, ind).slice(0, k + 1));
  assert.deepEqual(crosses([1, 2, 3, 2], [2, 2, 2, 2.5]), [0, 0, 1, -1]);
});

test('an entry on day i fills at day i+1 open, every trade has a stop on the losing side, a gap fills at the open', () => {
  const p = { ...P, warm: 0 };
  const bars = mk(Array.from({ length: 40 }, () => 100));
  const sig = Array.from({ length: 40 }, () => ({ enter: 0, want: null }));
  sig[20] = { enter: 1, want: 1 }; sig[30] = { enter: -1, want: -1 };
  const t = simulate(bars, sig, TESTS.T2, p);
  assert.equal(t.length, 1);
  assert.equal(t[0].entryI, 21); assert.equal(t[0].exitI, 31); assert.equal(t[0].why, 'signal');
  assert.ok(t[0].stop < t[0].entry && t[0].dist === 2 * atr(bars)[20]);
  // leaving the state (want 0) closes a long in T2 and a short in T1
  const sig0 = sig.map((x) => ({ ...x })); sig0[30] = { enter: 0, want: 0 };
  assert.equal(simulate(bars, sig0, TESTS.T2, p)[0].exitI, 31);
  const b2 = mk(Array.from({ length: 40 }, () => 100)); b2[25] = { ...b2[25], open: 90, low: 89, high: 91, close: 90 };
  const s2 = simulate(b2, sig, TESTS.T2, p);
  assert.equal(s2[0].why, 'stop'); assert.equal(s2[0].exit, 90);
  const s3 = simulate(bars, sig, TESTS.T1, p);
  assert.equal(s3.length, 2); assert.equal(s3[1].side, -1); assert.equal(s3[1].entryI, 31); assert.ok(s3[1].stop > s3[1].entry);
  for (const x of [...t, ...s2, ...s3]) assert.ok(x.dist > 0 && (x.stop - x.entry) * x.side < 0);
});

test('costs: $0.60 a round trip and financing on buys only, doubled at 2x', () => {
  const t = { side: 1, entry: 2000, exit: 2040, dist: 20, entryT: Date.UTC(2020, 0, 6) / 1000, exitT: Date.UTC(2020, 0, 13) / 1000 };
  const r = rOf(t), r2 = rOf(t, 2);
  assert.equal(r.gross, 2); assert.equal(r.cost, 0.03); assert.equal(r.nights, 7);
  assert.ok(Math.abs(r.fin - 7 * 0.000148 * 2000 / 20) < 1e-12);
  assert.ok(Math.abs(r2.fin - 2 * r.fin) < 1e-12 && Math.abs(r2.cost - 0.06) < 1e-12);
  assert.equal(rOf({ ...t, side: -1 }).fin, 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('the report matches result.json', () => {
  assert.equal(R.verdict, 'FAIL'); assert.equal(R.pass, false);
  const v = md.match(/\*\*Verdict:[^*]*\*\*/)[0];
  assert.match(v, /^\*\*Verdict: FAIL, 0 of 3: /);
  assert.ok(v.length < 220, `verdict line ${v.length} chars`);
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  for (const id of ['T1', 'T2', 'T3']) {
    const x = R.tests[id];
    assert.equal(x.pass, false);
    for (const w of ['IS', 'OOS']) {
      assert.ok(md.includes(`| ${x[w].n} |`), `${id} ${w} n`);
      assert.ok(md.includes(f(x[w].net)), `${id} ${w} net`);
      assert.ok(md.includes(f(x[w].gross)), `${id} ${w} gross`);
      assert.ok(md.includes(x[w].t.toFixed(2)), `${id} ${w} t`);
    }
    assert.ok(md.includes(`(${x.placebo.beaten}; `), `${id} placebo`);
    assert.ok(md.includes(`Holm p ${x.holmP.toFixed(2)}`), `${id} holm`);
  }
  assert.equal(R.tests.T1.checks.isSign, false);
});
