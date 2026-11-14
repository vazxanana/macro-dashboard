// The doji fade on spot gold daily (research/edge/gold-doji-reversal): the rule on hand-made candles, no look-ahead, the report.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { build, isDoji, setupAt, stretchAt, tradeAt, runTest, holm, monthT, report, STRETCH, HOLD } from '../research/edge/gold-doji-reversal/run.mjs';

const dir = new URL('../research/edge/gold-doji-reversal/', import.meta.url);
const T0 = Date.UTC(2020, 0, 6) / 1000; // a Monday
// weekday candles only: n days of a flat 10-wide range around 100, then a custom tail
function rows(tail) {
  const r = []; let t = T0, k = 0;
  const push = (o, h, l, c) => { while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += 86400; r.push([t, o, h, l, c, 1]); t += 86400; };
  for (; k < 30; k++) push(100, 105, 95, 100);
  for (const x of tail) push(...x);
  return r;
}

test('a doji is a body of at most a tenth of the range', () => {
  assert.equal(isDoji({ open: 100, close: 100.9, high: 105, low: 95 }), true);
  assert.equal(isDoji({ open: 100, close: 101.1, high: 105, low: 95 }), false);
  assert.equal(isDoji({ open: 100, close: 100, high: 100, low: 100 }), false);
});

test('a doji after a stretched rise is a sell; the trade has a 1-ATR stop and holds three days', () => {
  // ATR = 10 (true range of the flat days); five up days of +3 each = +15 >= 1 ATR, then a doji, then flat
  const up = [[100, 104, 99, 103], [103, 107, 102, 106], [106, 110, 105, 109], [109, 113, 108, 112], [112, 116, 111, 115]];
  const ds = build(rows([...up, [115, 120, 110, 115.2], [115, 116, 112, 113], [113, 114, 110, 111], [111, 112, 108, 109], [109, 110, 106, 107]]));
  const i = 35; assert.equal(isDoji(ds[i]), true);
  assert.ok(stretchAt(ds, i) >= STRETCH);
  const s = setupAt(ds, i); assert.equal(s.side, -1);
  const t = tradeAt(ds, i + 1, -1);
  assert.equal(t.entry, 115); assert.ok(t.stop > t.entry && Math.abs(t.stop - t.entry - ds[i].atr) < 1e-9, 'stop = entry + ATR of the signal day');
  assert.equal(t.how, 'time'); assert.equal(t.exit, ds[i + HOLD].close); assert.equal(t.fin, 0, 'sells pay no financing');
  assert.ok(t.gross > 0 && t.net < t.gross);
  const all = runTest(ds); assert.equal(all.length, 1);
});

test('no look-ahead: the setup and the stop do not change when later candles change', () => {
  const up = [[100, 104, 99, 103], [103, 107, 102, 106], [106, 110, 105, 109], [109, 113, 108, 112], [112, 116, 111, 115]];
  const a = build(rows([...up, [115, 120, 110, 115.2], [115, 116, 112, 113], [113, 114, 110, 111], [111, 112, 108, 109]]));
  const b = build(rows([...up, [115, 120, 110, 115.2], [115, 116, 112, 113], [113, 190, 10, 150], [150, 300, 1, 2]]));
  assert.deepEqual(setupAt(a, 35), setupAt(b, 35));
  assert.equal(tradeAt(a, 36, -1).stop, tradeAt(b, 36, -1).stop);
});

test('a stop gapped through exits at the open; a buy pays financing', () => {
  const dn = [[100, 101, 96, 97], [97, 98, 93, 94], [94, 95, 90, 91], [91, 92, 87, 88], [88, 89, 84, 85]];
  const ds = build(rows([...dn, [85, 90, 80, 85.1], [85, 86, 84, 85.5], [60, 61, 55, 58], [58, 59, 57, 58]]));
  assert.equal(setupAt(ds, 35).side, 1);
  const t = tradeAt(ds, 36, 1);
  assert.equal(t.how, 'stop'); assert.equal(t.exit, 60); assert.ok(t.fin > 0);
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
