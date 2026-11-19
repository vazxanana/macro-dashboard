// research/edge/gold-rates-shrug: the rule on hand-made candles, no look-ahead, the control, and the report against result.json (offline)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shockRows, isShock, shuffleBond, tradeAt, simulate, baseline, withExcess, entryIndex, holm, rng, RT, DAY } from '../research/edge/gold-rates-shrug/run.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gold-rates-shrug');
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
const days = (n) => { const out = []; for (let t = T0; out.length < n; t += DAY) { const wd = new Date(t * 1000).getUTCDay(); if (wd && wd !== 6) out.push(t); } return out; };
const wig = (ts, amp) => ts.map((time, i) => { const c = 100 * (1 + (i % 2 ? amp : -amp)); return { time, open: c, high: c + 1, low: c - 1, close: c }; });

test('event = bond shock and gold flat the same day; z uses only earlier returns', () => {
  const ts = days(40), gold = wig(ts, 0.002), bond = wig(ts, 0.001);
  bond[30] = { ...bond[30], close: bond[29].close * 0.98 };   // bond -2 %: yields up hard
  gold[30] = { ...gold[30], close: gold[29].close };           // gold unchanged
  const rows = shockRows(gold, bond, 10), r30 = rows.find((r) => r.t === ts[30]);
  assert.ok(r30.z < -1 && Math.abs(r30.gz) < 0.5);
  assert.ok(isShock(r30, -1) && !isShock(r30, 1));
  // gold followed the rates (down 2 %): no longer an event
  const g2 = gold.map((b, i) => (i === 30 ? { ...b, close: gold[29].close * 0.98 } : b));
  assert.ok(!isShock(shockRows(g2, bond, 10).find((r) => r.t === ts[30]), -1));
  // later prices cannot change day 30
  const later = bond.map((b, i) => (i > 30 ? { ...b, close: b.close * (1 + i / 100) } : b));
  const r30b = shockRows(gold, later, 10).find((r) => r.t === ts[30]);
  assert.equal(r30b.z, r30.z); assert.equal(r30b.gz, r30.gz);
});

test('control keeps each year\'s bond z values and gold days, only moves them between days', () => {
  const rows = days(300).map((t, i) => ({ t, z: Math.sin(i), gz: Math.cos(i) }));
  const sh = shuffleBond(rows, rng(1001));
  assert.equal(sh.length, rows.length);
  for (const y of [2020, 2021]) {
    const of = (a) => a.filter((x) => new Date(x.t * 1000).getUTCFullYear() === y).map((x) => x.z).sort((a, b) => a - b);
    assert.deepEqual(of(sh), of(rows));
  }
  assert.deepEqual(sh.map((x) => x.gz), rows.map((x) => x.gz));
  assert.ok(sh.some((x, i) => x.z !== rows[i].z));
  assert.deepEqual(shuffleBond(rows, rng(1001)), sh);
});

test('entry next open, stop 2 x ATR, costs on both, financing on buys only', () => {
  const ts = days(40), gold = ts.map((time) => ({ time, open: 100, high: 101, low: 99, close: 100 }));
  assert.equal(entryIndex(gold, ts[24]), 25);
  const buy = tradeAt(gold, 25, 1, 5);
  assert.equal(buy.risk, 4); assert.equal(buy.stop, 96);
  assert.ok(buy.fin > 0 && Math.abs(buy.cost - (RT / 4 + buy.fin)) < 1e-12);
  assert.equal(tradeAt(gold, 25, -1, 5).fin, 0);
  const tr = simulate([{ t: ts[22] }, { t: ts[23] }, { t: ts[28] }], gold, 1, 5);
  assert.equal(tr.length, 2);   // the second overlaps the open trade
  const ex = withExcess(tr, baseline(gold, 1, 5));
  assert.ok(Math.abs(ex[0].ex - (ex[0].net - baseline(gold, 1, 5)[2020].net)) < 1e-12);
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
  }
  const pre = fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8');
  assert.ok(pre.includes('bond z <= -1.0 AND |gold z| < 0.5') && pre.includes('T1 (primary)'));
});
