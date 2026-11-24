// usdjpy-vb-manage: the management walker on hand-made candles (no stop ever moved away, no look-ahead), and the figures of
// result.json against RESULT.md. Offline, no candle cache needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { manageTrade, MODES, VARIANTS } from '../research/edge/usdjpy-vb-manage/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/usdjpy-vb-manage/result.json', import.meta.url)));
const MD = fs.readFileSync(new URL('../research/edge/usdjpy-vb-manage/RESULT.md', import.meta.url), 'utf8');
const bar = (t, o, h, l, c) => ({ t, o, h, l, c });

test('a buy: +1R reached, back to entry, out at the close', () => {
  // entry 101 (fill candle 0), stop 100, r 1
  const B = [bar(0, 100.5, 101.2, 100.4, 101.1), bar(300, 101.1, 102.3, 101.0, 102.0), bar(600, 102.0, 102.1, 100.9, 101.0), bar(900, 101.0, 101.5, 100.5, 101.4)];
  const rule = manageTrade(B, 0, 1, 101, 100, 'rule'), be = manageTrade(B, 0, 1, 101, 100, 'BE1'), tr = manageTrade(B, 0, 1, 101, 100, 'TR1'), ph = manageTrade(B, 0, 1, 101, 100, 'PH1');
  assert.equal(rule.how, 'time'); assert.ok(Math.abs(rule.R - 0.4) < 1e-9);
  assert.equal(be.how, 'stop'); assert.equal(be.exit, 101); assert.equal(be.R, 0);        // stop at entry from candle 2
  assert.equal(tr.how, 'stop'); assert.ok(Math.abs(tr.exit - 101.3) < 1e-9);              // best 102.3 - 1R
  assert.ok(ph.half); assert.ok(Math.abs(ph.R - (0.5 + 0.5 * 0.4)) < 1e-9);
});

test('the fill candle never moves the stop or takes the half; stop first when one candle holds both', () => {
  const B = [bar(0, 100.5, 103, 100.4, 102), bar(300, 102, 102.1, 99.5, 99.8)];          // fill candle reaches +2R
  for (const m of MODES) { const y = manageTrade(B, 0, 1, 101, 100, m); assert.equal(y.exit, 100); assert.equal(y.R, -1); assert.equal(y.half, false); }
  const C = [bar(0, 100.5, 101.1, 100.4, 101), bar(300, 101, 102.5, 99.9, 101)];         // +1R and the stop in one candle
  assert.equal(manageTrade(C, 0, 1, 101, 100, 'PH1').R, -1);
});

test('a sell mirrors, a gap through a moved stop fills at the open', () => {
  const B = [bar(0, 99.5, 99.6, 98.9, 99), bar(300, 99, 99.1, 97.5, 97.8), bar(600, 99.4, 99.6, 99.2, 99.5)];
  const be = manageTrade(B, 0, -1, 99, 100, 'BE1');
  assert.equal(be.exit, 99.4); assert.ok(Math.abs(be.R - -0.4) < 1e-9);                   // gap above the entry stop
});

test('no stop is ever moved away from the entry, and no candle after the exit is read', () => {
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 300; k++) {
    const B = []; let p = 100;
    for (let i = 0; i < 60; i++) { const o = p, c = o + (rnd() - 0.5) * 0.6; B.push(bar(i * 300, o, Math.max(o, c) + rnd() * 0.2, Math.min(o, c) - rnd() * 0.2, c)); p = c; }
    const side = rnd() < 0.5 ? 1 : -1, entry = B[0].c, stop = entry - side * 0.5;
    for (const m of MODES) {
      const y = manageTrade(B, 0, side, entry, stop, m);
      for (let i = 1; i < y.stops.length; i++) assert.ok(side * (y.stops[i] - y.stops[i - 1]) > 0, 'stop moved away');
      assert.ok(side * (y.stops.at(-1) - stop) >= 0);
      const cut = B.filter((b) => b.t <= y.t), z = manageTrade(cut, 0, side, entry, stop, m);
      if (y.how === 'stop') assert.deepEqual([z.exit, z.R], [y.exit, y.R]);           // same result without later candles
    }
  }
});

test('result.json: gates, tests and verdict as RESULT.md says', () => {
  assert.equal(R.gate.ok, true); assert.equal(R.gate.same, R.gate.of); assert.equal(R.gate.of, 4168);
  assert.equal(R.gate.got.early.n, 2089); assert.equal(R.gate.got.early.netR, 0.079);
  assert.equal(R.gate.got.late.n, 2079); assert.equal(R.gate.got.late.netR, 0.063);
  assert.equal(R.pass, false);
  for (const v of VARIANTS) { assert.equal(R.tests[v].improves, false); assert.ok(MD.includes(`**${R.tests[v].label}**`)); }
  assert.equal(R.byWindow.late.diff.TR1.monthT, -2.28); assert.equal(R.byWindow.late.diff.PH1.monthT, -3.56);
  assert.ok(MD.startsWith('# USD/JPY T1')); assert.ok(MD.includes('**Verdict: FAIL'));
  assert.ok(!/\bedge\b/i.test(R.verdict));
});
