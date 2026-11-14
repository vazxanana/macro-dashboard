// gold-london-reversal: the rule on hand-made candles, no look-ahead, and the report against result.json. Offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as G from '../research/edge/gold-london-reversal/run.mjs';

const DIR = new URL('../research/edge/gold-london-reversal/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');

// a flat New York day of M5 candles 00:00 → 15:55 at price p, with optional overrides by New York minute
function day(p, over = {}) {
  const bars = [];
  for (let min = 0; min < 16 * 60; min += 5) bars.push({ t: 1e9 + min * 60, o: p, h: p + 0.1, l: p - 0.1, c: p, min, ...(over[min] || {}) });
  return bars;
}
// London rises from 100 to 110 between 02:00 and 07:55
function londonUp(over = {}) {
  const o = {};
  for (let min = 120; min < 480; min += 5) { const a = 100 + ((min - 120) / 360) * 10, b = 100 + ((min - 115) / 360) * 10; o[min] = { o: a, c: b, h: Math.max(a, b) + 0.1, l: Math.min(a, b) - 0.1 }; }
  for (let min = 480; min < 960; min += 5) o[min] = { o: 110, c: 110, h: 110.1, l: 109.9 };
  return day(100, { ...o, ...over });
}

test('dayPlan: fade side, levels, threshold', () => {
  const p = G.dayPlan(londonUp(), 10);
  assert.equal(p.side, -1); assert.equal(p.mo, 100); assert.ok(Math.abs(p.move - 10) < 1e-9);
  assert.ok(Math.abs(p.lh - 110.1) < 1e-9);
  assert.equal(G.dayPlan(londonUp(), 40).skip, 'small');   // 10 is not over 0.3 x 40
  assert.equal(G.dayPlan(londonUp(), null).skip, 'atr');
});

test('T1: sell at 09:30, stop above the extreme since 02:00, flat 16:00; stop first', () => {
  const bars = londonUp({ 600: { o: 110, h: 110.1, l: 104, c: 105 }, 955: { o: 105, h: 105.1, l: 104.9, c: 105 } });
  for (let m = 605; m < 955; m += 5) bars[m / 5] = { ...bars[m / 5], o: 105, h: 105.1, l: 104.9, c: 105 };
  const k = G.entryT1(bars); assert.equal(bars[k].min, 570);
  const x = G.trade(bars, k, -1, 3, 0.6);
  assert.ok(Math.abs(x.stop - 110.4) < 1e-9);               // 110.1 + 0.30
  assert.equal(x.how, 'time'); assert.ok(Math.abs(x.R - 5 / 0.4) < 1e-6);
  assert.ok(Math.abs(x.net - (x.R - 0.6 / 0.4)) < 1e-9);
  // a stop at least 0.1 x ATR20 away
  assert.ok(Math.abs(G.trade(bars, k, -1, 20, 0.6).r - 2) < 1e-9);
  // a candle that trades both the stop and lower: stop first
  const b2 = londonUp({ 600: { o: 110, h: 111, l: 100, c: 101 } });
  assert.equal(G.trade(b2, k, -1, 3, 0.6).how, 'stop');
  // a gap through the stop fills at the open
  const b3 = londonUp({ 600: { o: 112, h: 112.2, l: 111.9, c: 112 } });
  const g = G.trade(b3, k, -1, 3, 0.6); assert.equal(g.exit, 112); assert.equal(g.how, 'stop');
});

test('no look-ahead: changing candles after the exit or after 16:00 changes nothing', () => {
  const a = londonUp(), k = G.entryT1(a), x = G.trade(a, k, -1, 10);
  const b = londonUp(); b.push({ t: 2e9, o: 50, h: 200, l: 1, c: 50, min: 16 * 60 + 5 });
  assert.deepEqual(G.trade(b, k, -1, 10), x);
  // the entry and stop depend only on candles before the entry candle
  const c = londonUp({ 700: { o: 110, h: 130, l: 109, c: 110 } });
  const y = G.trade(c, k, -1, 10); assert.equal(y.entry, x.entry); assert.equal(y.stop, x.stop);
});

test('T2: needs the extreme and the entry beyond the midnight open', () => {
  const a = londonUp(), p = G.dayPlan(a, 10), k = G.entryT1(a);
  assert.equal(G.okT2(a, k, p), true);
  assert.equal(G.okT2(a, k, { ...p, mo: 115 }), false);
});

test('T3: a raid of the London high from 08:00, then the first close back inside 09:00-10:25', () => {
  assert.equal(G.entryT3(londonUp(), G.dayPlan(londonUp(), 10)), null);   // no raid
  const a = londonUp({ 545: { o: 110, h: 111, l: 109.9, c: 110.8 }, 550: { o: 110.8, h: 110.9, l: 109.5, c: 109.6 } });
  const k = G.entryT3(a, G.dayPlan(a, 10));
  assert.equal(a[k].min, 555);
  const x = G.trade(a, k, -1, 10); assert.ok(Math.abs(x.stop - 111.3) < 1e-9);   // the raid's high + 0.30
  // a raid before 08:00 only does not count
  const b = londonUp({ 470: { o: 110, h: 112, l: 109.9, c: 110 } });
  assert.equal(G.entryT3(b, G.dayPlan(b, 10)), null);
});

test('statistics: month t, Holm', () => {
  const tr = [{ day: '2021-01-05', net: 1 }, { day: '2021-02-05', net: 2 }, { day: '2021-03-05', net: 3 }];
  assert.ok(Math.abs(G.monthT(tr).t - 2 / (1 / Math.sqrt(3))) < 1e-9);
  assert.deepEqual(G.holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.equal(G.rng(7)(), G.rng(7)());
});

test('result.json and RESULT.md agree, plan hash, verdict line', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(new URL('PREREGISTRATION.md', DIR))).digest('hex');
  assert.equal(R.planSha256, sha);
  assert.equal(R.cost, 0.6);
  assert.equal(R.verdict, G.verdictLine(R.tests, R.decision));
  assert.ok(R.verdict.length < 220);
  assert.ok(MD.includes(`**Verdict: ${R.verdict}**`));
  assert.equal(MD, G.report(R));
  const pass = Object.values(R.decision).some((d) => d.pass);
  assert.ok(R.verdict.startsWith(pass ? 'PASS' : 'FAIL'));
  for (const k of ['T1', 'T2', 'T3']) {
    assert.equal(R.tests[k].placebo.means.length, 40);
    assert.ok(R.tests[k].IS.n > 0 && R.tests[k].OOS.n > 0);
  }
});
