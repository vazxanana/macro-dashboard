// bond-lead-intraday: the pieces of the study on hand-made candles (offline), and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bondSignals, atrAt, trade, stream, releaseCandle, monthT, holm, pOne, jpyCost, placeboSigs, P, M } from '../research/edge/bond-lead-intraday/run.mjs';

const DIR = new URL('../research/edge/bond-lead-intraday/', import.meta.url);
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
const bar = (time, o, h, l, c) => ({ time, open: o, high: h, low: l, close: c });

// a quiet bond: alternating +-1bp returns every 15 minutes for 30 days, then one jump
function bond(jumpAt, jump) {
  const out = []; let px = 100;
  for (let t = T0; t <= jumpAt; t += M) { const r = t === jumpAt ? jump : ((t / M) % 2 ? 1e-4 : -1e-4); px *= 1 + r; out.push(bar(t, px, px, px, px)); }
  return out;
}

test('signal: a jump over 2.5 sd inside 12:00-19:45 UTC, none outside and none without the warm-up', () => {
  const at = T0 + 30 * 86400 + 14 * 3600;
  const s = bondSignals(bond(at, 5e-4));
  assert.equal(s.length, 1); assert.equal(s[0].t, at); assert.equal(s[0].dir, 1);
  assert.equal(bondSignals(bond(at, 2e-4)).length, 0, '2 sd is not enough');
  assert.equal(bondSignals(bond(T0 + 30 * 86400 + 21 * 3600, -5e-4)).length, 0, 'outside the hours');
  assert.equal(bondSignals(bond(T0 + 5 * 86400 + 14 * 3600, 5e-4)).length, 0, 'fewer than 1,000 returns before it');
  // the jump's own return is not in its sd (no look-ahead): a later jump does not change an earlier signal
  const b = bond(at + 3600, 5e-4); assert.deepEqual(bondSignals(b).map((x) => x.t), [at + 3600]);
});

function market(n, from, f) { const out = []; for (let i = 0; i < n; i++) out.push(f(from + i * M, i)); return out; }

test('trade: next open, 1 ATR(96) stop, out after four candles, stop first at the open through it', () => {
  const t = T0 + 200 * M;
  const flat = (tt) => bar(tt, 100, 101, 99, 100);   // true range 2
  let bars = market(300, T0, flat), idx = new Map(bars.map((b, i) => [b.time, i]));
  assert.equal(atrAt(bars, 200), 2);
  let tr = trade(bars, idx, t, 1, () => 0.3);
  assert.equal(tr.entry, 100); assert.equal(tr.stop, 98); assert.equal(tr.how, 'time'); assert.equal(tr.exitT, t + 5 * M);
  assert.equal(tr.R, 0); assert.equal(+tr.net.toFixed(3), -0.15);
  bars = market(300, T0, (tt, i) => (i === 203 ? bar(tt, 97, 97.5, 96, 97) : flat(tt))); idx = new Map(bars.map((b, i) => [b.time, i]));
  tr = trade(bars, idx, t, 1, () => 0); assert.equal(tr.how, 'stop'); assert.equal(tr.exit, 97); assert.equal(tr.R, -1.5);
  tr = trade(bars, idx, t, -1, () => 0); assert.equal(tr.how, 'time');
  // one at a time: a second signal inside the hour is skipped
  bars = market(300, T0, flat); idx = new Map(bars.map((b, i) => [b.time, i]));
  assert.equal(stream(bars, idx, [{ t, side: 1 }, { t: t + 2 * M, side: 1 }, { t: t + 5 * M, side: -1 }], () => 0).length, 2);
});

test('T3 clock: 08:30 and 10:00 New York on weekdays, daylight saving applied', () => {
  assert.equal(releaseCandle(Date.UTC(2024, 6, 10, 12, 30) / 1000), true);   // summer: 08:30 New York = 12:30 UTC
  assert.equal(releaseCandle(Date.UTC(2024, 0, 10, 13, 30) / 1000), true);   // winter: 13:30 UTC
  assert.equal(releaseCandle(Date.UTC(2024, 0, 10, 15, 0) / 1000), true);    // 10:00 winter
  assert.equal(releaseCandle(Date.UTC(2024, 0, 10, 12, 30) / 1000), false);
  assert.equal(releaseCandle(Date.UTC(2024, 0, 13, 13, 30) / 1000), false);  // Saturday
});

test('statistics: month sums, Holm, one-sided p, the USD/JPY cost, the placebo keeps hour and side', () => {
  const T = [1, -0.5, 2, 1].map((v, i) => ({ entryT: Date.UTC(2020, i, 3) / 1000, net: v, R: v }));
  assert.equal(monthT(T).months, 4);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(pOne(1.645) - 0.05) < 1e-3);
  assert.ok(Math.abs(jpyCost(150) - (150 * 4.5e-5 + 0.01)) < 1e-12);
  const bars = market(4000, T0, (t) => bar(t, 1, 1, 1, 1)), sig = [{ t: T0 + 14 * 3600, side: -1 }];
  const pl = placeboSigs(sig, bars, 3); assert.equal(pl.length, 1); assert.equal(pl[0].t % 86400, 14 * 3600); assert.equal(pl[0].side, -1);
  assert.equal(P.k, 2.5);
});

test('report: RESULT.md states the verdict and the figures of result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.match(md, new RegExp(`Verdict: \\*\\*${R.verdict}\\*\\*`));
  assert.ok(fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8').includes('item 44'));
  for (const k of ['T1', 'T2', 'T3']) for (const w of ['decisive', 'replication']) {
    const s = R.tests[k].windows[w];
    assert.ok(md.includes(`| ${k} | ${w} | ${s.n} |`), `${k} ${w} row`);
    assert.ok(md.includes(s.avg.toFixed(3)), `${k} ${w} avg`);
  }
  for (const k of ['T1', 'T2', 'T3']) { const o = R.tests[k]; assert.equal(o.pass, o.checks.netPositiveBoth && o.checks.holm && o.checks.n150); }
  assert.equal(R.verdict, ['T1', 'T2', 'T3'].some((k) => R.tests[k].pass) ? 'PASS' : 'FAIL');
});
