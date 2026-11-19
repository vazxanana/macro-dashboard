// MAX (lottery) effect across currencies: the MAX measure over the signal month only, the ranking and which side is sold,
// the stop, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { maxReturn, rankMax, maxPick, simLeg, stats, percentile, mulberry32, randomPick, P } from '../research/edge/fx-max-effect/run.mjs';

const bar = (time, c) => ({ time, open: c, high: c, low: c, close: c });
// weekday times from 2 Feb 2026 (Monday) for 40 days, Jan 30 (Friday) first
const T0 = Date.UTC(2026, 0, 30) / 1000;
const times = [T0, ...[...Array(40)].map((_, i) => Date.UTC(2026, 1, 2 + i) / 1000)].filter((t) => { const w = new Date(t * 1000).getUTCDay(); return w !== 0 && w !== 6; });
const feb = times.map((t, i) => [t, i]).filter(([t]) => new Date(t * 1000).getUTCMonth() === 1).map(([, i]) => i);
const d = feb.at(-1); // last trading day of February

const series = (jumps) => { let c = 1; return times.map((t, i) => { if (jumps[i]) c *= 1 + jumps[i]; return bar(t, c); }); };

test('MAX = the largest daily close-to-close return of the calendar month ending on the signal day', () => {
  const j = {}; j[feb[0]] = 0.03; j[feb[5]] = 0.01; j[feb[5] + 1] = -0.05;
  const s = series(j);
  assert.ok(Math.abs(maxReturn(s, times, d) - 0.03) < 1e-12, 'first day of the month counts, from the previous close');
  // a jump in January (before the month) does not count
  const s2 = series({ 0: 0, [feb[0] - 1]: 0.2 });
  assert.equal(new Date(times[feb[0] - 1] * 1000).getUTCMonth(), 0);
  assert.equal(maxReturn(s2, times, d), 0);
  // later candles never change it
  const later = s.map((b, i) => (i > d ? bar(b.time, 999) : b));
  assert.equal(maxReturn(later, times, d), maxReturn(s, times, d));
  // fewer than MIN_DAYS days in the month: no signal
  assert.equal(maxReturn(s, times, feb[P.MIN_DAYS - 2]), null);
});

test('ranking: highest MAX first, ties by list order; sell the top two, buy the bottom two', () => {
  const mk = (x) => { const j = {}; j[feb[3]] = x; return series(j); };
  const X = { A: mk(0.01), B: mk(0.05), C: mk(0.002), D: mk(0.03), E: mk(0.002) };
  const r = rankMax(X, times, ['A', 'B', 'C', 'D', 'E'], d);
  assert.deepEqual(r, ['B', 'D', 'A', 'C', 'E']);
  assert.deepEqual(maxPick(r), { long: ['C', 'E'], short: ['B', 'D'] });
});

test('every leg has a stop: touched fills at the stop, a gap at the open', () => {
  const b = (t, o, h, l, c) => ({ time: t, open: o, high: h, low: l, close: c });
  assert.equal(simLeg([b(0, 100, 101, 99, 100), b(1, 100, 101, 95, 96)], 0, 1, 1, 4).exit, 96);
  assert.equal(simLeg([b(0, 100, 101, 99, 100), b(1, 106, 107, 105, 106)], 0, 1, -1, 4).how, 'gap');
  const a = randomPick(mulberry32(3))(), c = randomPick(mulberry32(3))();
  assert.deepEqual(a, c); assert.equal(new Set([...a.long, ...a.short]).size, 4);
  assert.equal(percentile([0, 10], 0.95), 9.5); assert.equal(stats([1, -1, 2, 0]).dd, -1);
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/fx-max-effect/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/fx-max-effect/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.equal(r.pass, false);
  assert.match(md, /^\*\*Verdict: FAIL\*\*/m);
  const sg = (v, k) => (v < 0 ? '−' : v > 0 ? '+' : '') + Math.abs(v).toFixed(k);
  const tt = (v) => (v < 0 ? '−' : '') + String(Math.abs(v));
  const tot = (v) => (v < 0 ? '−' : '+') + String(Math.abs(v)) + 'R';
  const rows = [['oos', 'net', 'Out of sample 2015-01 to 2026-10, base cost'], ['oos', 'gross', 'Out of sample, cost 0 (no cost, no financing)'], ['oos', 'x2', 'Out of sample, 2x cost'], ['is', 'net', 'In sample 2005-01 to 2014-12, base cost'], ['is', 'gross', 'In sample, cost 0'], ['is', 'x2', 'In sample, 2x cost']];
  for (const [w, k, label] of rows) {
    const s = r[w][k];
    const row = `| ${label} | ${s.n} | ${sg(s.mean, 3)} | ${tot(s.total)} | ${tt(s.t)} | ${tt(s.sharpe)} | ${tt(s.dd)}R |`;
    assert.ok(md.includes(row), row);
  }
  const p = r.placebo.t;
  assert.match(md, new RegExp(`5th percentile ${tt(p.p5)}, median ${tt(p.p50)}, 95th percentile ${tt(p.p95)}`));
  assert.ok(md.includes(`beats ${r.placebo.beaten} of the 40`));
  assert.ok(/carry is not in this test/i.test(md));
  assert.ok(!r.checks.oosT2 && !r.checks.placebo);
});
