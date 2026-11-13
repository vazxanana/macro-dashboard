// AUD/NZD z-score mean reversion study (research/edge/audnzd-revert): the pre-registered constants, indicators from past
// closes only, entry at the next open, the stop on every trade, the three exits, one position at a time, costs, statistics,
// and the committed RESULT.md against result.json. Offline: no candle file is read.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VARIANTS, P, COST, BAR, PLACEBO, WINDOWS, indicators, tradeFrom, simulate, costOf, stats, holm, tStat, pOneSided,
  placebo, report, barsOf } from '../research/edge/audnzd-revert/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/audnzd-revert/PREREGISTRATION.md'), RUN = rd('../research/edge/audnzd-revert/run.mjs');
const T0 = Date.UTC(2020, 0, 6) / 1000; // a Monday
// weekday bars from closes; open = previous close, high / low a fixed band around open and close unless given
function mk(closes, o = {}) {
  const out = []; let t = T0;
  closes.forEach((c, i) => {
    while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += 86400;
    const op = o.open?.[i] ?? (i ? closes[i - 1] : c);
    out.push({ time: t, open: op, high: o.high?.[i] ?? Math.max(op, c) + 0.001, low: o.low?.[i] ?? Math.min(op, c) - 0.001, close: c });
    t += 86400;
  });
  return out;
}
const wiggle = (n, base = 1.1) => Array.from({ length: n }, (_, i) => base + (i % 2 ? 0.002 : -0.002));

test('the pre-registered constants', () => {
  assert.deepEqual(VARIANTS.map((v) => [v.id, v.N, v.Z]), [['V1', 20, 2], ['V2', 20, 2.5], ['V3', 50, 2]]);
  assert.deepEqual(P, { atrN: 14, stopAtr: 1.5, hold: 10 });
  assert.deepEqual(COST, { spreadPx: 0.0001, slipPx: 0.0001, commRT: 0.000045, finYear: 0.02 });
  assert.deepEqual(BAR, { minN: 60, minT: 2, alpha: 0.05 });
  assert.equal(PLACEBO.draws, 40);
  assert.deepEqual(WINDOWS, { rep: { from: '2008-01-01', to: '2016-01-01' }, dec: { from: '2016-01-01', to: null } });
  for (const s of ['Committed on 13 Nov 2026, alone', '1.5 x ATR', 'at the close of bar 10', '**2.0 pips a round trip**',
    '22.5 USD per million', '**2.0 % a year', 'Holm over the three variants', 'n >= 60', '40 seeded draws', 'AUD/CAD and EUR/GBP'])
    assert.ok(PRE.includes(s), s);
});

test('z, SMA, SD and ATR at a close use closes up to that close only', () => {
  const c = wiggle(60), b = mk(c), ind = indicators(b, 20);
  const c2 = [...c]; for (let i = 41; i < 60; i++) c2[i] = 5; // change the future after bar 40
  const ind2 = indicators(mk(c2), 20);
  for (let i = 0; i <= 40; i++) { assert.equal(ind.z[i], ind2.z[i], `z ${i}`); assert.equal(ind.atr[i], ind2.atr[i], `atr ${i}`); }
  const w = c.slice(21, 41), m = w.reduce((a, x) => a + x, 0) / 20, sd = Math.sqrt(w.reduce((a, x) => a + (x - m) ** 2, 0) / 19);
  assert.ok(Math.abs(ind.sma[40] - m) < 1e-12 && Math.abs(ind.sd[40] - sd) < 1e-12);
  assert.equal(ind.z[18], null);
});

test('entry at the next open, stop 1.5 ATR, and the three exits', () => {
  const base = wiggle(30);
  // a spike up at bar 30 -> sell signal, entry at bar 31's open
  const c = [...base, 1.13, 1.129, 1.1, 1.1];
  const b = mk(c), ind = indicators(b, 20);
  assert.ok(ind.z[30] >= 2);
  const t = tradeFrom(b, ind, 30, -1);
  assert.equal(t.e, 31); assert.equal(t.entry, b[31].open);
  assert.ok(Math.abs(t.stop - (t.entry + 1.5 * ind.atr[30])) < 1e-12, 'stop above a sell');
  assert.equal(t.why, 'mean'); assert.equal(t.x, 32); assert.equal(t.exit, 1.1);
  // stop: bar 31 trades up through the stop
  const hi = c.map(() => undefined); hi[31] = 1.2;
  const bs = mk(c, { high: hi }), ts = tradeFrom(bs, indicators(bs, 20), 30, -1);
  assert.equal(ts.why, 'stop'); assert.equal(ts.exit, ts.stop); assert.ok(Math.abs(ts.R + 1) < 1e-12);
  // gap through the stop at the open
  const op = c.map(() => undefined); op[32] = 1.3;
  const bg = mk(c, { open: op, high: Object.assign([], { 32: 1.31 }) }), tg = tradeFrom(bg, indicators(bg, 20), 30, -1);
  assert.equal(tg.why, 'stop-gap'); assert.equal(tg.exit, 1.3); assert.ok(tg.R < -1);
  // time: price stays above the mean for 10 bars -> exit at the close of bar 10
  const ct = [...base, 1.13, ...Array(12).fill(1.128)];
  const bt = mk(ct), tt = tradeFrom(bt, indicators(bt, 20), 30, -1);
  assert.equal(tt.why, 'time'); assert.equal(tt.x - tt.e + 1, 10);
  // still open at the end of the data -> no trade
  assert.equal(tradeFrom(mk([...base, 1.13, 1.128]), indicators(mk([...base, 1.13, 1.128]), 20), 30, -1), null);
});

test('every trade has a stop on the losing side; one position at a time', () => {
  const c = []; for (let k = 0; k < 400; k++) c.push(1.1 + 0.02 * Math.sin(k / 7) + (k % 23 === 0 ? 0.03 : 0));
  const b = mk(c);
  for (const v of VARIANTS) {
    const tr = simulate(b, v);
    assert.ok(tr.length > 0, v.id);
    for (const t of tr) {
      assert.ok(t.risk > 0 && (t.dir > 0 ? t.stop < t.entry : t.stop > t.entry), 'stop on the losing side');
      assert.equal(t.e, t.sig + 1);
    }
    for (let k = 1; k < tr.length; k++) assert.ok(tr[k].sig >= tr[k - 1].x, 'no overlap');
  }
});

test('costs, month-sum t and Holm', () => {
  const t = { entry: 1.1, risk: 0.01, opened: T0, closed: T0 + 2 * 86400 }; // Mon 00:00 -> Wed 00:00: Mon and Tue nights
  assert.ok(Math.abs(costOf(t, 0) - (0.0002 + 0.000045 * 1.1) / 0.01) < 1e-12);
  assert.ok(Math.abs(costOf(t) - costOf(t, 0) - 2 * 0.02 / 365 * 1.1 / 0.01) < 1e-12);
  assert.ok(Math.abs(tStat([1, 2, 3]) - 2 / Math.sqrt(1 / 3)) < 1e-12);
  assert.ok(Math.abs(pOneSided(1.645) - 0.05) < 0.001);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const tr = [{ R: 1, entry: 1.1, risk: 0.01, opened: T0, closed: T0 + 86400 }];
  const s = stats(tr, T0, Date.UTC(2020, 3, 1) / 1000, 0);
  assert.equal(s.n, 1); assert.equal(s.months, 3); // Jan, Feb, Mar; empty months count 0
});

test('placebo is seeded and repeatable', () => {
  const c = []; for (let k = 0; k < 300; k++) c.push(1.1 + 0.01 * Math.sin(k / 5));
  const b = mk(c), a1 = placebo(b, VARIANTS[0], 10, b[0].time, b.at(-1).time + 86400, { draws: 5 }), a2 = placebo(b, VARIANTS[0], 10, b[0].time, b.at(-1).time + 86400, { draws: 5 });
  assert.equal(a1.length, 5); assert.deepEqual(a1, a2);
});

test('weekend stubs are folded into the next weekday', () => {
  const sun = Date.UTC(2020, 0, 5) / 1000, mon = sun + 86400;
  const b = barsOf({ rows: [[sun, 1, 1.5, 0.9, 1.2, 1], [mon, 1.2, 1.3, 1.1, 1.25, 1]] });
  assert.equal(b.length, 1); assert.equal(b[0].time, mon); assert.equal(b[0].open, 1); assert.equal(b[0].high, 1.5);
});

test('RESULT.md is the report of result.json; the verdict follows the bar; nothing live imported', () => {
  const res = JSON.parse(rd('../research/edge/audnzd-revert/result.json'));
  assert.equal(rd('../research/edge/audnzd-revert/RESULT.md'), report(res));
  for (const x of res.variants) {
    const pass = x.dec.n >= 60 && x.dec.avg > 0 && x.dec.monthT >= 2 && x.holmP < 0.05 && x.rep.avg > 0;
    assert.equal(x.pass, pass, x.id);
  }
  assert.equal(res.verdict.startsWith('PASS'), res.variants.some((x) => x.pass));
  assert.ok(/^# Result/.test(rd('../research/edge/audnzd-revert/RESULT.md')) && rd('../research/edge/audnzd-revert/RESULT.md').includes('**Verdict: '));
  const imports = [...RUN.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(imports.filter((s) => s.startsWith('.')), ['../../../council/fills.mjs']);
});
