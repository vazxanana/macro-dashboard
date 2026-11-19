// research/edge/fomc-follow: the event list, New York clock and daylight time, no look-ahead, stop first, the time exit,
// Holm, and RESULT.md against result.json. Offline: synthetic candles only, the committed result files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fomcEvents, UNSCHEDULED, clockOf } from '../research/edge/fomc-follow/events.mjs';
import { toBars, signal, levels, manage, trade, windowOf, baseline, holm, pOne, standIns, judge, headline, report, P } from '../research/edge/fomc-follow/run.mjs';
import { zonedToUtc } from '../council/events.mjs';

const DIR = new URL('../research/edge/fomc-follow/', import.meta.url);
const M5 = 300, US = 'America/New_York';

test('event list: scheduled only, sorted, statement clock, 2020 on at 14:00', () => {
  const evs = fomcEvents(Infinity), ds = evs.map((e) => e.date);
  assert.deepEqual(ds, [...ds].sort());
  for (const u of UNSCHEDULED) assert.ok(!ds.includes(u), u);
  const dec = evs.filter((e) => e.date >= '2020-01-01' && e.date < '2026-11-13');
  assert.equal(dec.length, 54);
  assert.ok(dec.every((e) => e.at === '14:00'));
  assert.ok(ds.includes('2026-10-28') && ds.includes('2020-01-29') && !ds.includes('2020-03-18'));
  assert.equal(clockOf('2012-09-13'), '12:30');
  assert.equal(clockOf('2011-08-09'), '14:15');
});

test('daylight time: 14:00 New York is 18:00 UTC in summer and 19:00 UTC in winter', () => {
  assert.equal(zonedToUtc('2024-07-31', '14:00', US), Date.UTC(2024, 6, 31, 18) / 1000);
  assert.equal(zonedToUtc('2024-12-18', '14:00', US), Date.UTC(2024, 11, 18, 19) / 1000);
  assert.equal(zonedToUtc('2024-12-18', P.EXIT, US), Date.UTC(2024, 11, 18, 20, 55) / 1000);
  const ev = fomcEvents(Infinity).find((e) => e.date === '2024-07-31');
  assert.equal(ev.T, Date.UTC(2024, 6, 31, 18) / 1000);
});

// synthetic market: flat days at 100 with a 1-point window range; the event day moves `path` (prices per candle from S)
function market(date, at, path, after = []) {
  const rows = [], S = zonedToUtc(date, at, US);
  const d0 = Date.parse(date + 'T00:00:00Z') / 1000;
  for (let k = 40; k >= 1; k--) {   // 40 previous days, full windows of range 1
    const s = zonedToUtc(new Date((d0 - k * 86400) * 1000).toISOString().slice(0, 10), at, US);
    for (let j = -1; j < 6; j++) rows.push([s + j * M5, 100, 100.5, 99.5, 100]);
  }
  rows.push([S - M5, 100, 100, 100, 100]);
  path.forEach((c, j) => { const o = j ? path[j - 1] : 100; rows.push([S + j * M5, o, Math.max(o, c), Math.min(o, c), c]); });
  after.forEach((r, j) => rows.push([S + (6 + j) * M5, ...r]));
  rows.sort((a, b) => a[0] - b[0]);
  return { b: toBars(rows), ev: { date, at, T: S }, S };
}

test('signal: direction, skip filter on the 20-day baseline, no read of candles after S + 30 min', () => {
  const up = [101, 102, 103, 104, 105, 106], { b, ev } = market('2024-07-31', '14:00', up, [[106, 200, 0, 150]]);
  const sig = signal(b, ev, new Set());
  assert.equal(sig.d, 1); assert.equal(sig.c30, 106); assert.equal(sig.hi, 106); assert.equal(sig.lo, 100);
  assert.equal(sig.base, 1);
  // changing every candle after the window changes nothing of the signal (no look-ahead)
  const other = market('2024-07-31', '14:00', up, [[106, 107, 105, 106], [1, 1, 1, 1]]);
  const s2 = signal(other.b, other.ev, new Set());
  for (const k of ['d', 'ref', 'c30', 'hi', 'lo', 'range', 'base']) assert.equal(s2[k], sig[k], k);
  // a quiet window (range 0.4 < 0.5 x 1) is skipped
  const q = market('2024-07-31', '14:00', [100.1, 100.2, 100.3, 100.4, 100.3, 100.2]);
  assert.equal(signal(q.b, q.ev, new Set()).skip, 'quiet window');
  // announcement days are left out of the baseline; with too few days left, no trade
  const ban = new Set(); for (let k = 1; k <= 45; k++) ban.add(new Date(Date.parse('2024-07-31') - k * 864e5).toISOString().slice(0, 10));
  assert.equal(baseline(b, '2024-07-31', '14:00', ban), null);
  assert.ok(windowOf(b, ev.T));
});

test('levels: follow and fade, stops beyond the window, risk floor 0.25 x range, target 1.5R', () => {
  const sig = { d: 1, c30: 106, hi: 106, lo: 100, range: 6 };
  const F = levels(sig, 'F'), R = levels(sig, 'R');
  assert.deepEqual([F.side, F.stop, F.risk, F.target], [1, 100, 6, 115]);
  assert.deepEqual([R.side, R.stop, R.risk], [-1, 107.5, 1.5]);   // close at the high: floored at 0.25 x 6
  assert.equal(R.target, 106 - 2.25);
  assert.ok(F.stop < F.entry && R.stop > R.entry);
});

test('manage: stop first when one candle reaches both, gap at the open, time exit at 15:55 New York', () => {
  const date = '2024-12-18', S = zonedToUtc(date, '14:00', US), X = zonedToUtc(date, P.EXIT, US);
  const path = [101, 102, 103, 104, 105, 106];
  // a candle that reaches the target (115) and the stop (100) together: the stop
  let m = market(date, '14:00', path, [[106, 120, 95, 110]]);
  let r = manage(m.b, levels(signal(m.b, m.ev, new Set()), 'F'), m.b.at.get(S + 25 * 60), X);
  assert.equal(r.why, 'stop'); assert.equal(r.R, -1);
  // open below the stop: out at the open
  m = market(date, '14:00', path, [[98, 99, 97, 98]]);
  r = manage(m.b, levels(signal(m.b, m.ev, new Set()), 'F'), m.b.at.get(S + 25 * 60), X);
  assert.equal(r.why, 'gap'); assert.equal(r.exit, 98);
  // nothing hit: out at the close of the candle ending at 15:55, never later
  const calm = []; for (let t = S + 1800; t < X + 3600; t += M5) calm.push([107, 108, 104, t >= X ? 140 : 107]);
  m = market(date, '14:00', path, calm);
  r = manage(m.b, levels(signal(m.b, m.ev, new Set()), 'F'), m.b.at.get(S + 25 * 60), X);
  assert.equal(r.why, 'time'); assert.equal(r.exitT, X); assert.equal(r.exit, 107); assert.equal(r.R, 1 / 6);
  const t = trade(m.b, m.ev, 'F', 'spx500', new Set());
  assert.ok(Math.abs(t.net - (1 / 6 - 1 / 6)) < 1e-12);   // 1 point cost on a 6-point risk
});

test('Holm, one-sided p and the pass bar', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(pOne(1.6449) - 0.05) < 1e-4);
  const good = { n: 54, mean: 0.3, t: 2.5 };
  assert.equal(judge(good, { mean: 0.1 }, 0.03, 0.2).pass, true);
  assert.equal(judge(good, { mean: -0.1 }, 0.03, 0.2).pass, false);
  assert.equal(judge({ ...good, n: 39 }, { mean: 0.1 }, 0.03, 0.2).pass, false);
  assert.equal(judge(good, { mean: 0.1 }, 0.03, 0.4).pass, false);
});

test('placebo pool: Wednesdays only, inside the window, away from announcements', () => {
  const ev = fomcEvents(Infinity).find((e) => e.date === '2024-07-31');
  const pool = standIns(ev, P.W.dec);
  assert.ok(pool.length > 30);
  for (const c of pool) {
    assert.equal(new Date(c.date + 'T00:00:00Z').getUTCDay(), 3);
    assert.ok(Math.abs(Date.parse(c.date) - Date.parse('2024-07-31')) > 3 * 864e5);
  }
});

test('result.json and RESULT.md agree; the verdict is the pre-registered rule', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, report(r));
  assert.ok(md.startsWith('# Follow or fade') && md.includes(headline(r)));
  assert.equal(r.tests.length, 6);
  assert.equal(r.verdict, r.tests.some((x) => x.pass) ? 'PASS' : 'FAIL');
  for (const x of r.tests) assert.equal(x.pass, x.n >= 40 && x.netR > 0 && x.t >= 2 && x.holmP < 0.05 && x.repNetR > 0 && x.netR > x.placeboP95);
  assert.match(md, /not a test of the gold book/);
  assert.ok(fs.existsSync(new URL('PREREGISTRATION.md', DIR)));
});
