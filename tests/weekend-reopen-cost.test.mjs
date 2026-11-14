// research/edge/weekend-reopen-cost: the frozen file's hash, the spread measurement on hand-made bid / ask reads, the re-costing
// arithmetic against the frozen cost formula, the break-even search, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { nyTime } from '../research/edge/weekend-reopen-cost/frozen.mjs';
import { FROZEN_SHA256, MIN_REOPENS, reopens, measurePair, spreadFor, spreadPips, median, p90, toTrade, frozenNet, recost, breakEven } from '../research/edge/weekend-reopen-cost/run.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../research/edge/weekend-reopen-cost');
const R = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
const MD = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
const U = (s) => Date.parse(s) / 1000;
const q = (iso, bid, ask, pipPos = 4) => ({ t: U(iso), bid, ask, pipPos });

test('frozen.mjs is #880 run.mjs byte for byte', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'frozen.mjs'))).digest('hex');
  assert.equal(h, FROZEN_SHA256);
  assert.equal(R.frozenSha256, FROZEN_SHA256);
  assert.equal(FROZEN_SHA256, '3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273');
});

test('spread measurement on a hand-made bid / ask series', () => {
  assert.equal(spreadPips(q('2026-11-08T22:10:00Z', 1.1, 1.10006)), 0.6);
  assert.equal(spreadPips(q('2026-11-08T22:10:00Z', 150.1, 150.125, 2)), 2.5);
  assert.equal(median([3, 1, 2]), 2); assert.equal(median([1, 2, 3, 4]), 2.5); assert.equal(p90([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 9);
  assert.equal(p90([5]), 5);
  // winter Sunday: entry minute 17:05 New York = 22:05 UTC; summer Sunday = 21:05 UTC
  const reads = [
    q('2026-07-12T21:00:00Z', 1.1, 1.1003), // 5 min before: candidate
    q('2026-07-12T21:08:00Z', 1.1, 1.1001), // 3 min after: nearest
    q('2026-07-12T21:30:00Z', 1.1, 1.1), // exit window
    q('2026-07-13T15:59:00Z', 1.1, 1.1002), // Monday 11:59 New York: exit window
    q('2026-07-13T16:30:00Z', 1.1, 1.1009), // after Monday 12:00 New York: outside
    q('2026-11-08T21:50:00Z', 1.1, 1.1009), // 15 min before 22:05 UTC: too far
    q('2026-11-08T22:20:00Z', 1.1, 1.1009), // 15 min after: too far -> no entry read that Sunday
  ];
  const ro = reopens(reads);
  const jul = ro.find((r) => r.sunday === '2026-07-12'), nov = ro.find((r) => r.sunday === '2026-11-08');
  assert.equal(jul.entryAt, U('2026-07-12T21:05:00Z'));
  assert.equal(nov.entryAt, U('2026-11-08T22:05:00Z'));
  assert.equal(jul.entry.pips, 1); assert.equal(jul.entry.sec, 180);
  assert.deepEqual(jul.exit, [0, 2]);
  assert.equal(nov.entry, null);
  // a tie goes to the earlier read
  const tie = reopens([q('2026-11-08T22:00:00Z', 1, 1.0004), q('2026-11-08T22:10:00Z', 1, 1.0001)]);
  assert.equal(tie[0].entry.pips, 4);
  // coverage: under 20 reopens with an entry read = not measured, and then no spread is ever given
  const m1 = measurePair(reads);
  assert.equal(m1.withEntry, 1); assert.equal(m1.measured, false); assert.equal(spreadFor(m1, 2026), null);
  // 25 Sundays of reads: measured; a year with fewer than 5 reopens falls back to all years
  const many = [];
  for (let i = 0; i < 25; i++) { const d = new Date(Date.UTC(2025, 0, 5 + 7 * i)), t = nyTime(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 17, 5); many.push({ t: t + 60, bid: 1, ask: 1 + (i % 5 + 1) * 1e-4, pipPos: 4 }, { t: t + 3600, bid: 1, ask: 1, pipPos: 4 }); }
  const m2 = measurePair(many);
  assert.equal(MIN_REOPENS, 20); assert.equal(m2.withEntry, 25); assert.equal(m2.measured, true);
  assert.deepEqual(spreadFor(m2, 2025), { entry: 3, exit: 0 });
  assert.deepEqual(spreadFor(m2, 2025, 'p90'), { entry: 5, exit: 0 });
  assert.deepEqual(spreadFor(m2, 2019), { entry: 3, exit: 0 });
});

test('re-costing equals the frozen formula with the new spread', () => {
  const row = ['eurusd', '2024-03-08', 1, 1.0945, 30.5, 1.0975, 'target', 1, 0, 0];
  const t0 = toTrade(row), base = frozenNet(t0, 0.3), t = { ...t0, net: +base.toFixed(4), net2: +(base - 2 / 30.5).toFixed(4) };
  assert.ok(Math.abs(recost(t, 0.3, 0.3).net - t.net) < 1e-9);
  for (const C of [0, 1.2, 4.6, 14.5]) assert.ok(Math.abs(recost(t, 0.3, C).net - frozenNet(t0, C)) <= 0.0001);
  // the frozen parameter is put back
  frozenNet(t0, 9); assert.ok(Math.abs(frozenNet(t0, 0.3) - base) < 1e-12);
  assert.equal(breakEven((C) => 2 - C), 2);
  assert.equal(breakEven((C) => -1 - C), null);
});

test('result.json: gate passed, coverage, verdict', () => {
  assert.equal(R.gate.ok, true);
  for (const g of R.gate.tests) { assert.ok(g.ok); for (const k of ['n', 'gross', 'net', 'net2', 't', 'tMonth']) assert.equal(g.stats[k], g.published[k]); }
  assert.equal(R.sources.proxy.usable, false);
  assert.equal(R.sources.broker.sundayReopens, 1);
  assert.deepEqual(R.sources.broker.forexSymbols, ['audusd', 'eurusd', 'gbpusd', 'usdcad', 'usdchf']);
  for (const m of Object.values(R.measurement)) assert.equal(m.measured, false);
  for (const t of R.tests) { assert.equal(t.recostable, false); assert.equal(t.recost, null); }
  assert.equal(R.reading, 'NOT MEASURABLE');
  assert.match(R.verdict, /^NOT MEASURABLE \(inconclusive/);
  // the proxy claim: the API still asks OANDA for mid prices only
  const bars = fs.readFileSync(path.join(DIR, '../../../api/bars.js'), 'utf8');
  assert.match(bars, /price: 'M'/);
});

test('RESULT.md against result.json', () => {
  assert.match(MD.split('\n').find((l) => l.startsWith('**Verdict')), /^\*\*Verdict: NOT MEASURABLE \(inconclusive/);
  const f2 = (x) => x.toFixed(2), f3 = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3);
  for (const g of R.gate.tests) assert.ok(MD.includes(`| ${g.published.n} | ${f3(g.published.net)} | ${f2(g.published.tMonth)} |`), g.test);
  for (const t of R.tests.filter((x) => x.headline)) {
    const b = t.breakEven;
    assert.ok(MD.includes(`| ${f2(b.assumedMean)} | ${b.medR0Pips.toFixed(1)} | **${f2(b.tMonth2)}** | **${f2(b.entryIfExitZero.tMonth2)}** | ${f2(b.netZero)} | ${f2(b.entryIfExitZero.netZero)} |`), t.test);
  }
  for (const t of R.tests.filter((x) => !x.headline)) assert.equal(t.breakEven.tMonth2, null);
  const names = { eurusd: 'EUR/USD', gbpusd: 'GBP/USD', audusd: 'AUD/USD', usdcad: 'USD/CAD', usdchf: 'USD/CHF' };
  for (const [p, w] of Object.entries(R.weekend)) {
    const e = w[0].entryRead; assert.ok(MD.includes(`| ${names[p]} | ${e.atUtc.slice(11)}, **${e.pips.toFixed(1)}** |`), p);
    assert.ok(MD.includes(`${w[0].exitWindow.n}, ${w[0].exitWindow.median.toFixed(1)}, ${w[0].exitWindow.p90.toFixed(1)}, ${Math.round(w[0].exitZeroShare * 100)} %`), p);
  }
  assert.ok(MD.includes(`${R.sources.broker.reads.toLocaleString('en-US')} forex reads`));
});
