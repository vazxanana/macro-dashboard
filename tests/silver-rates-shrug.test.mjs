// research/edge/silver-rates-shrug: the rule on hand-made candles, no look-ahead, the control, and the report against result.json (offline)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shockRows, isShock, shuffleBond, tradeAt, simulate, baseline, withExcess, entryIndex, holm, rng, RT, FIN_XAG_LONG, DAY } from '../research/edge/silver-rates-shrug/run.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/silver-rates-shrug');
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
const days = (n) => { const out = []; for (let t = T0; out.length < n; t += DAY) { const wd = new Date(t * 1000).getUTCDay(); if (wd && wd !== 6) out.push(t); } return out; };
const wig = (ts, amp, lvl = 100) => ts.map((time, i) => { const c = lvl * (1 + (i % 2 ? amp : -amp)); return { time, open: c, high: c * 1.01, low: c * 0.99, close: c }; });

test('event = yields up hard and the named metal flat the same day; z uses only earlier returns', () => {
  const ts = days(40), silver = wig(ts, 0.002, 20), gold = wig(ts, 0.002), bond = wig(ts, 0.001);
  bond[30] = { ...bond[30], close: bond[29].close * 0.98 };     // bond -2 %: yields up hard
  silver[30] = { ...silver[30], close: silver[29].close };      // silver unchanged
  gold[30] = { ...gold[30], close: gold[29].close * 0.97 };     // gold fell hard
  const rows = shockRows(silver, gold, bond, 10), r30 = rows.find((r) => r.t === ts[30]);
  assert.ok(r30.z < -1 && Math.abs(r30.sz) < 0.5 && Math.abs(r30.gz) >= 0.5);
  assert.ok(isShock(r30, 'sz') && !isShock(r30, 'gz'));
  // a yields-DOWN day is never an event
  assert.ok(!isShock({ ...r30, z: 2 }, 'sz'));
  // later prices cannot change day 30
  const later = bond.map((b, i) => (i > 30 ? { ...b, close: b.close * (1 + i / 100) } : b));
  const sl = silver.map((b, i) => (i > 30 ? { ...b, close: b.close * 2 } : b));
  const r30b = shockRows(sl, gold, later, 10).find((r) => r.t === ts[30]);
  assert.equal(r30b.z, r30.z); assert.equal(r30b.sz, r30.sz); assert.equal(r30b.gz, r30.gz);
  // a day missing in one market is not a common day
  assert.ok(!shockRows(silver, gold.filter((_, i) => i !== 20), bond, 10).some((r) => r.t === ts[20]));
});

test('control keeps each year\'s bond z values and the metals\' days, only moves them between days', () => {
  const rows = days(300).map((t, i) => ({ t, z: Math.sin(i), sz: Math.cos(i), gz: Math.cos(2 * i) }));
  const sh = shuffleBond(rows, rng(1001));
  for (const y of [2020, 2021]) {
    const of = (a) => a.filter((x) => new Date(x.t * 1000).getUTCFullYear() === y).map((x) => x.z).sort((a, b) => a - b);
    assert.deepEqual(of(sh), of(rows));
  }
  assert.deepEqual(sh.map((x) => x.sz), rows.map((x) => x.sz));
  assert.ok(sh.some((x, i) => x.z !== rows[i].z));
  assert.deepEqual(shuffleBond(rows, rng(1001)), sh);
});

test('entry next open, stop 2 x ATR, $0.06 a round trip, no silver financing', () => {
  const ts = days(40), bars = ts.map((time) => ({ time, open: 20, high: 20.5, low: 19.5, close: 20 }));
  assert.equal(entryIndex(bars, ts[24]), 25);
  assert.ok(Math.abs(RT - 0.06) < 1e-12); assert.equal(FIN_XAG_LONG, 0);
  const buy = tradeAt(bars, 25, 1, 5);
  assert.equal(buy.risk, 2); assert.equal(buy.stop, 18); assert.equal(buy.fin, 0);
  assert.ok(Math.abs(buy.cost - RT / 2) < 1e-12 && Math.abs(buy.net - (buy.gross - RT / 2)) < 1e-12);
  const tr = simulate([{ t: ts[22] }, { t: ts[23] }, { t: ts[28] }], bars, 1, 5);
  assert.equal(tr.length, 2);   // the second overlaps the open trade
  const ex = withExcess(tr, baseline(bars, 1, 5));
  assert.ok(Math.abs(ex[0].ex - (ex[0].net - baseline(bars, 1, 5)[2020].net)) < 1e-12);
  assert.deepEqual(holm([0.01, 0.04, 0.5]), [0.03, 0.08, 0.5]);
});

test('the report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8')), md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  const vline = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vline.includes('FAIL') && vline.length < 220);
  const t1 = r.tests.find((t) => t.id === 'T1');
  assert.ok(vline.includes(`n ${t1.oos.n}`) && vline.includes(`month t ${t1.oos.tMonthExcess.toFixed(2)}`) && vline.includes(`+${t1.oos.excess.toFixed(3)}R`));
  for (const t of r.tests) {
    assert.equal(t.pass, false);
    assert.ok(t.is.events >= 100 && t.oos.events >= 100);
    assert.ok(md.includes(`${t.p} (Holm ${t.holm})`));
    assert.ok(md.includes(`above ${t.placebo.below} of 40`) && md.includes(`above ${t.control.below} of 40`));
    assert.ok(md.includes(t.oos.tMonthExcess.toFixed(2)) && md.includes(t.all.tMonthExcess.toFixed(2)));
  }
  const pre = fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8');
  assert.ok(pre.includes('bond z <= -1.0 AND |silver z| < 0.5') && pre.includes('T1 (primary)') && pre.includes('Financing: none'));
});
