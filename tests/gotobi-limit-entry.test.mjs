// gotobi-limit-entry: frozen.mjs is gotobi-timing's byte for byte, run.mjs takes the rule from it, the variants are the
// pre-registered ones, the limit fill / stop logic behaves as written on hand-made candles, the gate and the reading in
// result.json follow from its rows, and RESULT.md says what result.json holds. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from '../research/edge/gotobi-limit-entry/frozen.mjs';
import * as R from '../research/edge/gotobi-limit-entry/run.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gotobi-limit-entry');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const FROZEN_SHA = '645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32';
const res = JSON.parse(read('result.json'));

test('gotobi-limit-entry: frozen.mjs is gotobi-timing\'s frozen.mjs byte for byte', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'frozen.mjs'))).digest('hex');
  assert.equal(h, FROZEN_SHA);
  assert.match(read('PREREGISTRATION.md'), new RegExp(FROZEN_SHA));
  assert.equal(res.frozen.sha256, FROZEN_SHA);
});

test('gotobi-limit-entry: run.mjs takes the rule from frozen.mjs; variants and bar are the pre-registered ones', () => {
  const src = read('run.mjs').replace(/\/\/[^\n]*/g, '');
  assert.match(read('run.mjs'), /import \* as F from '\.\/frozen\.mjs'/);
  for (const fn of ['trade', 'stopDist', 'windowMove', 'costPx', 'gotobiSet', 'jpHolidays', 'monthT', 'summary'])
    assert.doesNotMatch(src, new RegExp(`(function\\s+${fn}\\b|(const|let)\\s+${fn}\\s*=)`), `run.mjs defines ${fn}`);
  assert.deepEqual(R.KS, [0, 1, 2]);
  assert.equal(R.hhmm(R.PLACE), '00:53');
  assert.deepEqual(R.LIVE.map(R.hhmm), ['00:54', '00:55', '00:56', '00:57']);
  assert.equal(R.STRICT_PIPS, 0.3);
  assert.equal(R.hhmm(R.EXIT), '06:00');
  assert.deepEqual([R.CAPT, R.PART, R.T_BAR], [0.70, 0.40, 2]);
  assert.deepEqual([R.FROM, R.LAST], ['2016-01-01', '2026-11-11']);
  assert.deepEqual([R.GATE.n, R.GATE.netR, R.GATE.t], [771, 0.1481, 2.74]);
  const pre = read('PREREGISTRATION.md');
  for (const s of ['k = 0, 1, 2 pips', 'high >= L + 0.003', 'at least 70 %', 'at least 40 %', 'month t >= 2', 'NOT CAPTURABLE', '00:54 M1 open', '00:55 M1 open'])
    assert.ok(pre.includes(s), s);
});

// hand-made M1 day: candles 00:40-06:14 flat at 150.00 unless overridden
function day(over = {}, ymd = '2016-03-10') {
  const d0 = Date.parse(ymd + 'T00:00:00Z') / 1000, bars = [];
  for (let m = 40; m < 375; m++) bars.push(over[m] ? [d0 + m * 60, ...over[m]] : [d0 + m * 60, 150, 150.001, 149.999, 150]);
  return F.index(bars);
}

test('gotobi-limit-entry: lenient and strict fills, fill price, misses', () => {
  // 00:53 closes at 150.00; 00:55 high 150.022: k=2 lenient fills (L 150.02), strict needs 150.023 -> miss
  const ix = day({ 55: [150, 150.022, 149.99, 150] });
  const a = R.limitTrade(ix, '2016-03-10', 0.2, 2, 0), b = R.limitTrade(ix, '2016-03-10', 0.2, 2, 0.003);
  assert.equal(a.trade.fillMin, 55); assert.ok(Math.abs(a.trade.entry - 150.02) < 1e-9);
  assert.equal(b.miss, 'no-fill');
  // fill in 00:58 does not count (live 00:54-00:57)
  assert.equal(R.limitTrade(day({ 58: [150, 150.05, 150, 150] }), '2016-03-10', 0.2, 2, 0).miss, 'no-fill');
  // no 00:53 candle = no order
  const ix2 = day(); ix2.at.delete(Date.parse('2016-03-10T00:53:00Z') / 1000);
  assert.equal(R.limitTrade(ix2, '2016-03-10', 0.2, 0, 0).miss, 'no-order');
  // fill credited at L even when the candle opened above it
  const c = R.limitTrade(day({ 54: [150.03, 150.04, 150.0, 150.0] }), '2016-03-10', 0.2, 1, 0).trade;
  assert.ok(Math.abs(c.entry - 150.01) < 1e-9 && Math.abs(c.stop - 150.21) < 1e-9);
});

test('gotobi-limit-entry: stops, the worse case in the fill candle, and the time exit', () => {
  // stop reached inside the fill candle -> stopped at the stop, -1R gross
  const s = R.limitTrade(day({ 54: [150, 150.25, 150, 150] }), '2016-03-10', 0.2, 0, 0).trade;
  assert.equal(s.how, 'stop'); assert.ok(Math.abs(s.R + 1) < 1e-9);
  // later gap above the stop -> out at that open
  const g = R.limitTrade(day({ 54: [150, 150.01, 150, 150], 100: [150.3, 150.31, 150.29, 150.3] }), '2016-03-10', 0.2, 0, 0).trade;
  assert.equal(g.how, 'gap'); assert.ok(Math.abs(g.exit - 150.3) < 1e-9);
  // falls 10 pips by 06:00 -> +0.5R gross on D 0.2, cost from the frozen model
  const ov = { 54: [150, 150.01, 150, 150] }; for (let m = 100; m < 375; m++) ov[m] = [149.9, 149.901, 149.899, 149.9];
  const t = R.limitTrade(day(ov), '2016-03-10', 0.2, 0, 0).trade;
  assert.equal(t.how, 'time'); assert.ok(Math.abs(t.R - 0.5) < 1e-9); assert.ok(Math.abs(t.costR - F.costPx(150) / 0.2) < 1e-12);
  // the copied market trade at 00:55 uses the 00:55 open
  const m = R.tradeM1(day({ 55: [150.04, 150.05, 150.03, 150.04] }), '2016-03-10', 0.2, 55);
  assert.ok(Math.abs(m.entry - 150.04) < 1e-9);
});

test('gotobi-limit-entry: per-day figures count unfilled days as 0 and keep every month', () => {
  const p = R.perDay(['2016-01-05', '2016-01-08', '2016-02-05', '2016-03-04'], [{ day: '2016-01-05', net: 1 }, { day: '2016-03-04', net: -0.5 }]);
  assert.equal(p.days, 4); assert.equal(p.netPerDay, 0.125); assert.equal(p.months, 3);
});

test('gotobi-limit-entry: gate and reading in result.json follow from its rows', () => {
  assert.equal(res.gate.pass, true);
  assert.deepEqual([res.gate.n, res.gate.netR, res.gate.t], [771, 0.1481, 2.74]);
  assert.equal(res.universe, 771);
  const ids = res.rows.map((r) => r.id);
  assert.deepEqual(ids, ['E1 k=0 lenient', 'E1 k=0 strict', 'E1 k=1 lenient', 'E1 k=1 strict', 'E1 k=2 lenient', 'E1 k=2 strict', 'E2', 'E3']);
  const e3 = res.rows.find((r) => r.id === 'E3');
  assert.equal(e3.perDay.netPerDay, 0.1481); assert.equal(e3.keep, 1);
  for (const r of res.rows) {
    assert.ok(Math.abs(r.keep - r.perDay.netPerDay / e3.perDay.netPerDay) < 1e-3, r.id);
    assert.ok(Math.abs(r.perDay.netPerDay - r.perTrade.netR * r.fillRate) < 2e-4, r.id);
  }
  const strict = res.rows.filter((r) => r.fill === 'strict');
  const want = strict.some((r) => r.keep >= 0.7 && r.perDay.t >= 2) ? 'CAPTURABLE' : strict.some((r) => r.keep >= 0.4) ? 'PARTLY' : 'NOT CAPTURABLE';
  assert.equal(res.reading, want);
});

test('gotobi-limit-entry: RESULT.md says what result.json holds', () => {
  const md = read('RESULT.md');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${res.reading}\\.\\*\\*`));
  assert.ok(/^\*\*Verdict: (CAPTURABLE|PARTLY|NOT CAPTURABLE)\./m.test(md));
  const f = (v, d) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
  for (const r of res.rows) {
    const line = md.split('\n').find((l) => l.startsWith(`| ${r.id} |`));
    assert.ok(line, r.id);
    assert.ok(line.includes(f(r.perDay.netPerDay, 4)) && line.includes(`${(r.fillRate * 100).toFixed(1)} %`), r.id);
  }
  assert.match(md, /not an edge verdict/);
});
