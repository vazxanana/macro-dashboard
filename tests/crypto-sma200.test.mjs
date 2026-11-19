// research/edge/crypto-sma200: the rule on hand-made candles (no look-ahead, stop, swap) and RESULT.md against result.json.
// Offline: no candle file is read.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { simulate, buyHold, nightsOf, sma, atr, maxDD, bootstrap, holm, P, ts } from '../research/edge/crypto-sma200/run.mjs';

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'research', 'edge', 'crypto-sma200');
const T0 = ts('2021-01-04');
const mk = (closes, opt = {}) => closes.map((c, i) => {
  const o = i ? closes[i - 1] : c;
  return [T0 + i * 86400, o, Math.max(o, c) + (opt.hi ?? 1), Math.min(o, c) - (opt.lo ?? 1), c];
});

test('signal uses closes up to the day before only (no look-ahead)', () => {
  const N = 5, closes = [...Array(25).fill(10), 11, 12, 13, 14, 15, 16];
  const rows = mk(closes, { hi: 0.1, lo: 0.1 });
  const a = simulate(rows, N, 0);
  // change every price from index 28 on: the records of the days before stay equal
  const rows2b = rows.map((r, i) => (i >= 28 ? [r[0], r[1] + 5 * (i - 27), r[2] + 5 * (i - 26), r[3] + 5 * (i - 27), r[4] + 5 * (i - 26)] : r));
  const b2 = simulate(rows2b, N, 0);
  for (let k = 0; k < 28 - N; k++) assert.deepEqual(a[k], b2[k]);
  assert.notDeepEqual(a.at(-1), b2.at(-1));
  // entry happens on the day after the first close above the average (index 25 close 11 > SMA5 → day 26 opens long)
  const e = a.find((x) => x.ev === 'entry');
  assert.equal(e.t, rows[26][0]);
  assert.equal(sma(rows, 25, N), (10 * 4 + 11) / 5);
  // no entry while ATR20 cannot be measured: a position always has a stop
  assert.ok(!simulate(mk([10, 10, 11, 12, 13, 14, 15]), 2, 0).some((x) => x.held));
});

test('every position has a stop: 3 x ATR20 under entry, gap fill at the open, disarm until a close at or below the average', () => {
  const closes = [...Array(25).fill(100), ...Array.from({ length: 10 }, (_, i) => 101 + i)]; // flat, then a rise
  closes.push(200); // big gap up close
  const rows = mk(closes, { hi: 1, lo: 1 });
  rows.push([rows.at(-1)[0] + 86400, 50, 151, 49, 150]); // opens under the stop, closes still above the average
  rows.push([rows.at(-1)[0] + 86400, 50, 300, 49, 260]); // closes above SMA again but rule is disarmed
  rows.push([rows.at(-1)[0] + 86400, 260, 261, 259, 260]);
  const recs = simulate(rows, 20, 0);
  const entry = recs.find((x) => x.ev === 'entry');
  assert.ok(entry);
  const stop = recs.find((x) => x.ev === 'stop-gap');
  assert.ok(stop, 'stopped at the open');
  const iS = recs.indexOf(stop);
  assert.ok(Math.abs(stop.gross - (50 / 200 - 1)) < 1e-12);
  assert.ok(!recs.slice(iS + 1).some((x) => x.held), 'no new position before a close at or below the average');
  const iE = recs.indexOf(entry) + 20;
  assert.ok(rows[iE][1] - 3 * atr(rows, iE - 1) > 50, 'the stop sat above the crash open');
});

test('swap: 15 % a year a night, Friday three, none on flat days; buy and hold pays every day', () => {
  assert.equal(nightsOf(ts('2026-11-13')), 3); // Friday
  assert.equal(nightsOf(ts('2026-11-14')), 1); // Saturday
  assert.equal(nightsOf(ts('2026-11-13'), 1), 1);
  const rows = mk(Array.from({ length: 40 }, () => 100), { hi: 0.5, lo: 0.5 });
  const flat = simulate(rows, 20, 0.15);
  assert.ok(flat.every((x) => x.fin === 0 && !x.held), 'never above the average: never long, never charged');
  const bh = buyHold(rows, ['2021-01-04', '2021-12-31'], 0.15);
  const nights = bh.reduce((s, x) => s + nightsOf(x.t), 0);
  assert.ok(Math.abs(bh.reduce((s, x) => s + x.fin, 0) - nights * 0.15 / 365) < 1e-12);
  assert.ok(Math.abs(bh.reduce((s, x) => s + x.cost, 0) - 2 * P.cost) < 1e-12);
});

test('drawdown, bootstrap and Holm helpers', () => {
  assert.ok(Math.abs(maxDD([0.1, -0.5, 0.2]) - 0.5) < 1e-12);
  const a = Array.from({ length: 90 }, (_, i) => ({ t: T0 + i * 86400, r: 0.01 + (i % 3) * 0.001 }));
  const b = a.map((x, i) => ({ t: x.t, r: (i % 2 ? 1 : -1) * 0.02 }));
  assert.equal(bootstrap(a, b, 200, 1), 1);
  assert.deepEqual(holm([0.01, 0.04, 0.03, 0.5]).map((x) => +x.toFixed(2)), [0.04, 0.09, 0.09, 0.5]);
});

test('RESULT.md says what result.json says', () => {
  const R = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  const n = R.tests.filter((x) => x.pass).length;
  assert.match(md, new RegExp(`\\*\\*Verdict: ${R.verdict}, ${n} of ${R.tests.length} tests pass`));
  const pc = (x) => `${x >= 0 ? '+' : '-'}${Math.abs(x * 100).toFixed(1)} %`;
  for (const x of R.tests) {
    const d = x.w.decisive, ds = x.w.discovery;
    const row = md.split('\n').find((l) => l.startsWith(`| ${x.id} |`));
    assert.ok(row, x.id);
    const c = row.split('|').map((s) => s.trim());
    assert.equal(c[2], d.rule.sharpe.toFixed(2));
    assert.equal(c[3], d.bh.sharpe.toFixed(2));
    assert.equal(c[4], pc(d.rule.cagr));
    assert.equal(c[5], pc(d.bh.cagr));
    assert.equal(c[6], (d.rule.maxDD * 100).toFixed(1) + ' %');
    assert.equal(c[7], (d.bh.maxDD * 100).toFixed(1) + ' %');
    assert.equal(c[9], String(d.rule.entries));
    assert.equal(c[10], String(d.rule.stops));
    assert.equal(c[11], x.P.toFixed(3));
    assert.equal(c[12], x.holmP.toFixed(3));
    assert.equal(c[13], `${ds.rule.sharpe.toFixed(2)} / ${ds.bh.sharpe.toFixed(2)}`);
    assert.equal(c[14], x.pass ? 'yes' : 'no');
  }
  assert.ok(fs.existsSync(path.join(DIR, 'PREREGISTRATION.md')));
});
