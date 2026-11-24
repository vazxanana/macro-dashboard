// fade-range-regime: the result file's figures, the two range measures on hand-made days (closed candles only), the level cuts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { er20, dayRatio, levelOf, MEASURES, RULES } from '../research/edge/fade-range-regime/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/fade-range-regime/result.json', import.meta.url), 'utf8'));

test('result: FAIL, 0 of 6, every range-day subset negative after costs in both windows', () => {
  assert.equal(R.verdict, 'FAIL');
  assert.equal(R.tests.length, 6);
  assert.equal(R.tests.filter((x) => x.pass).length, 0);
  for (const x of R.tests) {
    assert.ok(x.levels.range.disc.n >= 200 && x.levels.range.conf.n >= 200);
    assert.ok(x.levels.range.disc.meanNet < 0 && x.levels.range.conf.meanNet < 0, `${x.rule} ${x.measure}`);
    assert.equal(x.checks.net, false);
  }
  const f3m1 = R.tests.find((x) => x.rule === 'F3' && x.measure === 'M1');
  assert.ok(Math.abs(f3m1.diff[1].mean - 0.055) < 0.001 && f3m1.diff[1].t > 2 && f3m1.diff[0].t < 2);
});

test('gate: confirmation exact for all three rules, discovery within 11 trades', () => {
  assert.equal(R.gate.length, 3);
  for (const g of R.gate) {
    assert.ok(g.near);
    assert.equal(g.mine[1].n, g.parent[1].n);
    assert.ok(Math.abs(g.parent[0].n - g.mine[0].n) <= 11);
  }
  assert.deepEqual(RULES.map((r) => r.cell), ['m15 none atr 2R all', 'm15 k1.5 nobreak half', 'fade other 2R']);
});

test('cut test: no measure changes when the candles are cut', () => {
  assert.ok(R.cut.length >= 10);
  for (const c of R.cut) assert.equal(c.missing + c.extra, 0);
});

// days: { t, h, l, c, e }; a steady trend then the current day
const day = (i, c, h = c + 1, l = c - 1) => ({ t: i * 86400, e: (i + 1) * 86400, o: c, h, l, c });

test('er20 reads the last 21 closed days only', () => {
  const D = Array.from({ length: 30 }, (_, i) => day(i, 100 + i));
  assert.equal(er20(D, 21 * 86400), 1);                 // 21 closed days, straight line
  assert.equal(er20(D, 20 * 86400 + 5), null);           // only 20 closed
  const Z = Array.from({ length: 30 }, (_, i) => day(i, 100 + (i % 2)));
  assert.ok(er20(Z, 25 * 86400) < 0.1);                  // back and forth
  const before = er20(D, 25 * 86400); D[25].c = 9999;    // the forming day's close changes nothing
  assert.equal(er20(D, 25 * 86400 + 3600), before);
});

test('dayRatio: the current day so far over the ATR14 of closed days, no later candle', () => {
  const D = Array.from({ length: 20 }, (_, i) => day(i, 100));   // TR 2 each
  const t0 = 16 * 86400; const M5 = [];
  for (let k = 0; k < 288; k++) M5.push({ t: t0 + k * 300, e: t0 + (k + 1) * 300, o: 100, h: 100 + k * 0.01, l: 100, c: 100 });
  const ts = t0 + 10 * 300;                                       // 10 candles closed
  assert.ok(Math.abs(dayRatio(D, M5, ts) - 0.09 / 2) < 1e-12);
  M5[10].h = 500;                                                  // a candle after ts
  assert.ok(Math.abs(dayRatio(D, M5, ts) - 0.09 / 2) < 1e-12);
  assert.equal(dayRatio(D, M5, t0), null);                        // nothing of the day closed yet
});

test('levels: range below lo, trend above hi', () => {
  assert.equal(levelOf(0.1, MEASURES[0]), 0); assert.equal(levelOf(0.3, MEASURES[0]), 1); assert.equal(levelOf(0.5, MEASURES[0]), 2);
  assert.equal(levelOf(0.4, MEASURES[1]), 0); assert.equal(levelOf(1.2, MEASURES[1]), 2); assert.equal(levelOf(null, MEASURES[1]), -1);
});
