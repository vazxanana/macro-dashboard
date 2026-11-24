// tests/sd-complement.test.mjs - supply / demand completed: pre-registration, RESULT.md agrees with result.json, the verdict
// follows the bar, and the pieces on hand-made candles. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inDiscount, quality, firstTouch, oppTarget, limitTrade, TESTS } from '../research/edge/sd-complement/run.mjs';

const DIR = new URL('../research/edge/sd-complement/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
const bar = (t, o, h, l, c, sec = 300) => ({ t, o, h, l, c, e: t + sec });

test('pre-registration names the tests, the holdout, the bar and the assumed costs', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['premium / discount', 'Daily trend', 'quality', 'opposite', 'near line', 'holdout', 'Holm', 'Welch', 'ASSUMED', 'after costs', 'Part B', 'gold-vol-breakout'])
    assert.ok(p.includes(w), w);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline));
});

test('the verdict follows the pre-registered bar', () => {
  assert.equal(R.partA.length, 6);
  for (const r of R.partA) {
    const [d, c, h] = [r.disc, r.conf, r.hold];
    const ok = d.n >= 300 && c.n >= 300 && h.n >= 150 && [d, c, h].every((x) => x.mean > 0 && x.t >= 2) && r.holm < 0.05
      && r.vsControl[0] >= 2 && r.vsControl[1] >= 2 && h.mean > r.control.hold.mean && c.meanNet > 0 && h.meanNet > 0;
    assert.equal(r.pass, ok, r.test);
  }
  for (const [mk, o] of Object.entries(R.partB)) {
    const W = o.windows, k = W.OOS.kept;
    const ok = k.net > 0 && k.t >= 2 && k.n >= 30 && W.IS.kept.net > 0 && W.REP.kept.net > 0 && k.net2 > 0
      && ['REP', 'IS', 'OOS'].every((w) => W[w].diff > 0) && o.welch2010 >= 2 && o.holm < 0.05;
    assert.equal(o.pass, ok, mk);
  }
  assert.equal(R.verdict, R.partA.some((r) => r.pass) || Object.values(R.partB).some((o) => o.pass) ? 'PASS' : 'FAIL');
});

test('RESULT.md lists every Part A test with its figures', () => {
  R.partA.forEach((r, i) => {
    assert.equal(r.test, TESTS[i]);
    const row = md.split('\n').find((l) => l.startsWith(`| ${r.test} | ${r.disc.n.toLocaleString('en-US')} |`)); assert.ok(row, r.test);
    assert.ok(row.includes(`${f3(r.conf.mean)} (${r.conf.t.toFixed(2)})`), r.test + ' conf');
    assert.ok(row.includes(`${f3(r.hold.mean)} (${r.hold.t.toFixed(2)})`), r.test + ' hold');
  });
});

test('the cut test found nothing a cut series would not know', () => {
  assert.ok(R.cut.length >= 10);
  assert.equal(R.cut.reduce((a, x) => a + x.missing + x.extra, 0), 0);
});

test('premium / discount and quality', () => {
  const r = { h: 110, l: 100, mid: 105 };
  assert.equal(inDiscount({ d: 1, lo: 101, hi: 104 }, r), true);
  assert.equal(inDiscount({ d: 1, lo: 104, hi: 106 }, r), false);
  assert.equal(inDiscount({ d: -1, lo: 106, hi: 108 }, r), true);
  assert.equal(inDiscount({ d: -1, lo: 104, hi: 108 }, null), false);
  const z = { d: 1, nb: 2, o: 10, i: 11 };
  assert.equal(quality(z, new Map([[11, 1]])), true);
  assert.equal(quality(z, new Map([[11, -1]])), false);
  assert.equal(quality({ ...z, nb: 3 }, new Map([[11, 1]])), false);
});

test('first touch, opposite target, resting limit', () => {
  const z = { d: 1, lo: 10, hi: 11, at: 0, end: 1e9 };
  assert.equal(firstTouch([bar(0, 12, 12.5, 11.5, 12), bar(300, 12, 12, 10.8, 11.2)], z), 1);
  // opposite target: the nearest untouched supply zone 1R or more above
  const Z = [{ d: -1, lo: 13, hi: 14, at: 0, end: 1e9 }, { d: -1, lo: 12.5, hi: 13, at: 0, end: 1e9 }, { d: -1, lo: 11.2, hi: 11.5, at: 0, end: 1e9 }];
  assert.equal(oppTarget(Z, [Infinity, Infinity, Infinity], 1, 11, 1, 100), 12.5);
  assert.equal(oppTarget(Z, [Infinity, 50, Infinity], 1, 11, 1, 100), 13);
  // limit half a round trip inside: fills at 10.9 (cost 0.2), stop 9.9, 2R at 12.9
  const M = [bar(0, 12, 12, 11.5, 11.6), bar(300, 11.6, 11.6, 10.85, 11), bar(600, 11, 13, 10.95, 12.95)];
  const r = limitTrade(M, z, 9.9, 0.2); assert.ok(Math.abs(r.fill - 10.9) < 1e-9); assert.equal(r.R, 2);
  // the fill candle reaching the stop is a loss
  const M2 = [bar(0, 12, 12, 11.5, 11.6), bar(300, 11.6, 11.6, 9.8, 10)];
  assert.equal(limitTrade(M2, z, 9.9, 0.2).R, -1);
});
