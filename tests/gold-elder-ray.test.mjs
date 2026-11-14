// Elder's ray pullback on spot gold daily (research/edge/gold-elder-ray): the rule on hand-made candles, no look-ahead, the report.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { build, setupAt, slopeAt, bear, bull, tradeAt, runTest, pools, holm, monthT, report, HOLD, EMA_FROM } from '../research/edge/gold-elder-ray/run.mjs';

const dir = new URL('../research/edge/gold-elder-ray/', import.meta.url);
const T0 = Date.UTC(2020, 0, 6) / 1000; // a Monday
// weekday candles only: 30 days of a flat 10-wide range around 100, then a custom tail
function rows(tail) {
  const r = []; let t = T0;
  const push = (o, h, l, c) => { while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += 86400; r.push([t, o, h, l, c, 1]); t += 86400; };
  for (let k = 0; k < 30; k++) push(100, 105, 95, 100);
  for (const x of tail) push(...x);
  return r;
}
const UP = [[100, 104, 99, 103], [103, 107, 102, 106], [106, 110, 105, 109], [109, 110, 100, 108], [108, 111, 102, 110]];
const DN = [[100, 101, 96, 97], [97, 98, 93, 94], [94, 95, 90, 91], [91, 100, 90, 92], [92, 98, 89, 90]];

test('a rising EMA13 with bear power below zero and rising is a buy; the trade has a 1-ATR stop and holds three days', () => {
  const ds = build(rows([...UP, [110, 112, 109, 111], [111, 113, 110, 112], [112, 114, 111, 113]]));
  const i = 34; // the fifth tail day: low 102 under the EMA, less far under than the day before (low 100)
  assert.equal(slopeAt(ds, i), 1); assert.ok(bear(ds[i]) < 0 && bear(ds[i]) > bear(ds[i - 1]));
  const s = setupAt(ds, i); assert.equal(s.side, 1);
  assert.equal(setupAt(ds, i - 1), null, 'the deeper pullback day itself is not a setup');
  const t = tradeAt(ds, i + 1, 1);
  assert.equal(t.entry, 110); assert.ok(Math.abs(t.entry - t.stop - ds[i].atr) < 1e-9, 'stop = entry − ATR of the signal day');
  assert.equal(t.how, 'time'); assert.equal(t.exit, ds[i + HOLD].close); assert.ok(t.fin > 0, 'buys pay financing');
  assert.ok(runTest(ds).some((x) => x.i === i));
});

test('a falling EMA13 with bull power above zero and falling is a sell; a gapped stop exits at the open', () => {
  const ds = build(rows([...DN, [90, 91, 88, 89], [120, 121, 119, 120], [120, 121, 119, 120]]));
  const i = 34; assert.equal(slopeAt(ds, i), -1); assert.ok(bull(ds[i]) > 0 && bull(ds[i]) < bull(ds[i - 1]));
  assert.equal(setupAt(ds, i).side, -1);
  const t = tradeAt(ds, i + 1, -1); assert.equal(t.fin, 0, 'sells pay no financing');
  assert.equal(t.how, 'stop'); assert.equal(t.exit, 120);
});

test('no look-ahead: the setup, the EMA and the stop do not change when later candles change', () => {
  const a = build(rows([...UP, [110, 112, 109, 111], [111, 113, 110, 112], [112, 114, 111, 113]]));
  const b = build(rows([...UP, [110, 190, 10, 150], [150, 300, 1, 2], [2, 3, 1, 2]]));
  assert.deepEqual(setupAt(a, 34), setupAt(b, 34)); assert.equal(a[34].ema, b[34].ema);
  assert.equal(tradeAt(a, 35, 1).stop, tradeAt(b, 35, 1).stop);
  assert.equal(build(rows([]))[EMA_FROM - 1].ema, null, 'the EMA is used only from its warm-up on');
});

test('the T3 control pool holds same-slope days that were not setups', () => {
  const ds = build(rows([...UP, [110, 112, 109, 111], [111, 113, 110, 112], [112, 114, 111, 113]]));
  const P = pools(ds);
  for (const [k, list] of P.trend) for (const e of list) { assert.equal(slopeAt(ds, e - 1), +k.split(':')[1]); assert.equal(setupAt(ds, e - 1), null); }
});

test('holm and month t', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((v) => +v.toFixed(2)), [0.03, 0.06, 0.06]);
  const m = monthT([{ net: 1, exitT: Date.UTC(2020, 0, 5) / 1000 }, { net: 1, exitT: Date.UTC(2020, 1, 5) / 1000 }], ['2020-01-01', '2020-03-31']);
  assert.equal(m.months, 3);
});

test('the report and result.json agree, and the pre-registration hash matches', () => {
  const out = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  assert.equal(md, report(out));
  assert.equal(out.prereg, crypto.createHash('sha256').update(fs.readFileSync(new URL('PREREGISTRATION.md', dir))).digest('hex'));
  assert.equal(out.pass, out.tests.T1.pass && out.tests.T2.pass);
  const v = md.match(/\*\*Verdict: (.+?)\*\*/)[1]; assert.ok(v.length < 220); assert.ok(v.startsWith(out.pass ? 'PASS' : 'FAIL'));
  for (const t of Object.values(out.tests)) assert.ok(t.oos.n >= 30);
});
