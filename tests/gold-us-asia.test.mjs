// gold-us-asia: the pure pieces on hand-made candles (offline), and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { usDst, nySession, nyMove, nyDays, atrAt, simulate, candidates, trades, TESTS, holmAdj, monthSums, monthT, placebo, study, M, H, D } from '../research/edge/gold-us-asia/run.mjs';
import { nights } from '../council/fills.mjs';

const day = (s) => Date.parse(s + 'T00:00:00Z') / 1000 / D;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16);

test('US daylight time by the rule of each year, the cash session in UTC', () => {
  assert.equal(usDst(Date.parse('2006-10-31T12:00:00Z') / 1000), false, '2006: off after the last Sunday of October');
  assert.equal(usDst(Date.parse('2006-04-03T12:00:00Z') / 1000), true, '2006: on from the first Sunday of April');
  assert.equal(usDst(Date.parse('2006-03-20T12:00:00Z') / 1000), false);
  assert.equal(usDst(Date.parse('2016-03-14T12:00:00Z') / 1000), true, '2016: on from the second Sunday of March');
  assert.equal(usDst(Date.parse('2016-11-07T12:00:00Z') / 1000), false, '2016: off from the first Sunday of November');
  const s = nySession(day('2026-07-15')), w = nySession(day('2026-01-15'));
  assert.equal(iso(s.start), '2026-07-15T13:30'); assert.equal(iso(s.end), '2026-07-15T20:00');
  assert.equal(iso(w.start), '2026-01-15T14:30'); assert.equal(iso(w.end), '2026-01-15T21:00');
});

test('a 00:00 -> 07:00 UTC hold crosses no rollover: no financing', () => {
  for (const d of ['2026-01-05', '2026-07-08', '2016-03-11']) assert.equal(nights(day(d) * D, day(d) * D + 7 * H), 0);
});

// a flat candle path with chosen moves: every M15 candle from `from` to `to`, price by f(t)
function path(from, to, f, wick = 0.2) {
  const out = []; for (let t = from; t < to; t += M) { const o = f(t), c = f(t + M); out.push({ time: t, open: o, close: c, high: Math.max(o, c) + wick, low: Math.min(o, c) - wick }); } return out;
}

test('NY move, ATR from New York days, the stop first and a gap through', () => {
  const d = day('2026-07-15'), s = nySession(d), m15 = path(d * D, (d + 1) * D, (t) => (t >= s.start && t < s.end ? 100 + (t - s.start) / M * 0.1 : t >= s.end ? 102.6 : 100));
  const by = new Map(m15.map((b) => [b.time, b])), mv = nyMove(by, d);
  assert.equal(+mv.move.toFixed(6), 2.6, '26 candles of 0.1 from the 13:30 open to the 19:45 close');
  const r = simulate([{ open: 100, high: 100.5, low: 99, close: 99.5 }, { open: 97, high: 97, low: 96, close: 96 }], 1, 2);
  assert.equal(r.how, 'stop'); assert.equal(r.exit, 97); assert.equal(r.R, -1.5, 'a gap through fills at the open');
  const r2 = simulate([{ open: 100, high: 101.5, low: 99.5, close: 101 }, { open: 101, high: 103, low: 100.8, close: 102 }], -1, 2);
  assert.equal(r2.exit, 102); assert.equal(r2.R, -1);
  const days = [{ end: 1, high: 10, low: 9, close: 9.5 }, { end: 2, high: 11, low: 9.5, close: 10.5 }, { end: 3, high: 10.6, low: 8, close: 9 }];
  assert.equal(atrAt(days, 3, 2), (1.5 + 2.6) / 2); assert.equal(atrAt(days, 2.5, 2), null, 'a day not ended is not read');
  const nd = nyDays(path(day('2026-07-17') * D, day('2026-07-21') * D, () => 50));
  assert.deepEqual(nd.map((x) => new Date(x.lab * D * 1000).getUTCDay()), [5, 1, 2], 'Sunday reopen hours go to Monday, no weekend day');
});

test('fade sells after an up NY session, follow buys; the median filter reads only earlier sessions', () => {
  // 30 weekdays: NY sessions move +1 each, the last one +3 (ratio 3 vs a median of 1); Asia then falls 0.5
  const d0 = day('2026-06-01'), m15 = [];
  for (let d = d0 - 3; d < d0 + 45; d++) {
    const s = nySession(d), big = d === day('2026-07-09');
    m15.push(...path(d * D, (d + 1) * D, (t) => {
      const base = 1000 + (d - d0) * 0; if (t >= s.start && t < s.end) return base + (t - s.start) / (s.end - s.start) * (big ? 3 : 1);
      if (t >= s.end) return base + (big ? 3 : 1); if (t < 7 * H + d * D) return base - (t - d * D) / (7 * H) * 0.5; return base - 0.5; }, 0.05));
  }
  const { cands } = candidates(m15), c = cands.find((x) => x.d === day('2026-07-10'));
  assert.ok(c, 'the day after the big session is a candidate'); assert.ok(c.ratio > 2.9 && c.ratio < 3.1, String(c.ratio));
  const t1 = trades([c], TESTS.T1)[0], t2 = trades([c], TESTS.T2)[0], t3 = trades([c], TESTS.T3);
  assert.equal(t1.side, -1); assert.equal(t2.side, 1); assert.equal(t3.length, 1);
  assert.ok(t1.R > 0 && t2.R < 0 && Math.abs(t1.R + t2.R) < 1e-9);
  assert.ok(t1.net < t1.R, 'the round trip is charged');
  const small = { ...c, ratio: 1.2 }; assert.equal(trades([small], TESTS.T3).length, 0); assert.equal(trades([{ ...c, ratio: 0.4 }], TESTS.T1).length, 0);
  const P = placebo([c, c, c], 5); assert.equal(P.length, 5);
  const r = study(m15, { seeds: 3 }); assert.ok(['PASS', 'FAIL'].includes(r.verdict)); assert.equal(r.financing.nights, 0);
});

test('statistics: month sums with empty months, Holm adjusted p', () => {
  const ms = monthSums([{ d: day('2026-01-10'), net: 1 }, { d: day('2026-03-02'), net: 2 }], '2026-01-01', '2026-03-31');
  assert.deepEqual(ms, [1, 0, 2]); assert.ok(Math.abs(monthT(ms) - 1 / (1 / Math.sqrt(3))) < 1e-9);
  assert.deepEqual(holmAdj({ a: 0.01, b: 0.04, c: 0.03 }), { a: 0.03, c: 0.06, b: 0.06 });
});

test('the report and result.json agree; item 44 and the verdict are stated', () => {
  const dir = new URL('../research/edge/gold-us-asia/', import.meta.url);
  const r = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');
  assert.match(pre, /not a gate, exit, entry or size of the gold book/); assert.match(md, /not a gate, exit, entry or size of the gold book/);
  assert.match(md, new RegExp(`^## Verdict: ${r.verdict}`, 'm'));
  assert.equal(r.passed, Object.values(r.tests).filter((x) => x.pass).length);
  for (const [id, row] of Object.entries(r.tests)) for (const k of ['decisive', 'replication']) {
    const x = row[k]; assert.ok(md.includes(`| ${id} | ${k} | ${x.n} |`), `${id} ${k} row`);
    assert.ok(md.includes(x.avg.toFixed(3).replace('-', '−')), `${id} ${k} net`);
  }
  assert.equal(r.financing.nights, 0);
});
