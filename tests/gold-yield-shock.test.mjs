// research/edge/gold-yield-shock: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shockRows, isShock, tradeAt, simulate, baseline, withExcess, entryIndex, holm, rng, pick, RT, DAY } from '../research/edge/gold-yield-shock/run.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gold-yield-shock');
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
const days = (n) => { const out = []; for (let t = T0; out.length < n; t += DAY) { const wd = new Date(t * 1000).getUTCDay(); if (wd && wd !== 6) out.push(t); } return out; };
const flat = (ts, px = 100, rng = 1) => ts.map((time) => ({ time, open: px, high: px + rng / 2, low: px - rng / 2, close: px }));

test('shock z uses only earlier returns, and a later day cannot change it', () => {
  const ts = days(40), gold = flat(ts);
  const bond = ts.map((time, i) => ({ time, open: 100, high: 100, low: 100, close: 100 * (1 + (i % 2 ? 0.001 : -0.001)) }));
  bond[30] = { ...bond[30], close: bond[29].close * 0.98 };   // a -2 % day
  const rows = shockRows(gold, bond, 10), r30 = rows.find((r) => r.t === ts[30]);
  assert.ok(r30.z < -1.5 && isShock(r30, -1) && !isShock(r30, 1));
  const later = bond.map((b, i) => (i > 30 ? { ...b, close: b.close * (1 + i / 100) } : b));
  const r30b = shockRows(gold, later, 10).find((r) => r.t === ts[30]);
  assert.equal(r30b.z, r30.z);
});

test('entry is the next candle open; stop at 2 x ATR; costs and financing on buys only', () => {
  const ts = days(30), gold = flat(ts, 100, 2);
  assert.equal(entryIndex(gold, ts[24]), 25);
  const buy = tradeAt(gold, 25, 1, 5);
  assert.equal(buy.risk, 4); assert.equal(buy.stop, 96); assert.equal(buy.kind, 'time');
  assert.ok(Math.abs(buy.cost - (RT / 4 + buy.fin)) < 1e-12 && buy.fin > 0);
  const sell = tradeAt(gold, 25, -1, 5);
  assert.equal(sell.fin, 0); assert.ok(Math.abs(sell.net + RT / 4) < 1e-12);
  const drop = gold.map((b, i) => (i === 27 ? { ...b, low: 90 } : b));
  const s = tradeAt(drop, 25, 1, 5);
  assert.equal(s.kind, 'stop'); assert.equal(s.exit, 96); assert.equal(s.k, 27);
});

test('one trade at a time, excess against the year baseline', () => {
  const ts = days(60), gold = flat(ts, 100, 2).map((b, i) => ({ ...b, open: 100 + i * 0.1, close: 100 + i * 0.1 + 0.05, high: 101 + i * 0.1, low: 99 + i * 0.1 }));
  const tr = simulate([{ t: ts[30] }, { t: ts[31] }, { t: ts[40] }], gold, 1, 5);
  assert.equal(tr.length, 2);
  const base = baseline(gold, 1, 5), ex = withExcess(tr, base);
  assert.ok(Math.abs(ex[0].ex - (ex[0].net - base[2020].net)) < 1e-12);
});

test('holm and seeded draws are stable', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.5]), [0.03, 0.08, 0.5]);
  const a = pick(days(50).map((t) => ({ t })), 5, rng(7)), b = pick(days(50).map((t) => ({ t })), 5, rng(7));
  assert.deepEqual(a, b);
});

test('the report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8')), md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  const vline = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vline.includes('FAIL') && vline.length < 260);
  const t1 = r.tests.find((t) => t.id === 'T1');
  assert.ok(vline.includes(`n ${t1.oos.n}`) && vline.includes(`month t ${t1.oos.tMonthExcess.toFixed(2)}`));
  assert.ok(vline.includes(`+${t1.oos.excess.toFixed(3)}R`));
  for (const t of r.tests) {
    assert.equal(t.pass, false);
    assert.ok(t.is.events >= 100 && t.oos.events >= 100);
    assert.ok(md.includes(`${t.p} (`) || md.includes(`p ${t.p} `));
    assert.ok(md.includes(`above ${t.placebo.below} of 40`));
  }
  const pre = fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8');
  assert.ok(pre.includes('z <= -1.5') && pre.includes('T1 (primary)'));
});
