// fade-late-tick-exec: the 20-22 UTC Break fade at the broker's ticks. Offline: the pure pieces on hand-made quotes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const S = await import('../research/edge/fade-late-tick-exec/run.mjs');
const DIR = new URL('../research/edge/fade-late-tick-exec/', import.meta.url);
const T0 = Date.UTC(2025, 5, 2, 20, 15) / 1000;
const order = (side) => ({ id: 'x0001', ts: T0, bt: T0 - 900, hour: 20, side, fillM: 100, D: 2, deadEnd: T0 + 86400, ns: 1, nt: 1, mid: { R: 0, net: 0 } });
const M = (bid, ask, age = 5) => new Map([[T0, [T0, bid, ask, age, ask - bid]]]);
const MD = (bid, ask, age = 100) => new Map([[T0 + 86400, [T0 + 86400, bid, ask, age, ask - bid]]]);
const F = (rows) => new Map(rows.map((r) => [r[0], r]));

test('a buy fills at the ask, its stop is the bid reaching the level and is booked at that tick', () => {
  const o = order(1), b = S.tickOrder(o, 'XAUUSD', F([['x0001|s0', (T0 + 600) * 1000, 98.1, 98.5], ['x0001|t0', null]]), M(99.9, 100.2), MD(1, 1));
  assert.equal(b.A, 100.2); assert.equal(b.X, 98.2); assert.equal(b.T, 104.2); assert.equal(b.ex, 'stop'); assert.equal(b.px, 98.1);
  assert.ok(Math.abs(b.R - (98.1 - 100.2) / 2) < 1e-9); assert.ok(b.net < b.R); assert.ok(b.X < b.A, 'stop on the losing side');
});
test('a sell fills at the bid; target booked at the level; the earlier crossing wins; the mirror stop is above', () => {
  const o = order(-1), m = M(99.9, 100.2);
  const t = S.tickOrder(o, 'USDJPY', F([['x0001|s0', (T0 + 900) * 1000, 101.8, 101.95], ['x0001|t0', (T0 + 300) * 1000, 95.7, 95.9]]), m, MD(1, 1));
  assert.equal(t.A, 99.9); assert.equal(t.X, 101.9); assert.equal(t.T, 95.9); assert.equal(t.ex, 'target'); assert.equal(t.px, 95.9); assert.ok(Math.abs(t.R - 2) < 1e-9);
  const s = S.tickOrder(o, 'USDJPY', F([['x0001|s0', (T0 + 200) * 1000, 101.8, 101.95], ['x0001|t0', (T0 + 300) * 1000, 95.7, 95.9]]), m, MD(1, 1));
  assert.equal(s.ex, 'stop'); assert.equal(s.px, 101.95); assert.ok(s.R < -1, 'a gap past the stop books worse than -1R');
});
test('no entry quote, an old quote, a missing window and a missing deadline quote are unresolved; the time exit closes at the closing side', () => {
  const o = order(1), none = F([['x0001|s0', null], ['x0001|t0', null]]);
  assert.ok(S.tickOrder(o, 'XAUUSD', none, new Map(), MD(1, 1)).entryUnresolved);
  assert.ok(S.tickOrder(o, 'XAUUSD', none, M(99.9, 100.2, 61), MD(1, 1)).entryUnresolved);
  assert.equal(S.tickOrder(o, 'XAUUSD', F([['x0001|s0', null]]), M(99.9, 100.2), MD(1, 1)).exitUnresolved, 'window not read');
  assert.equal(S.tickOrder(o, 'XAUUSD', none, M(99.9, 100.2), MD(101, 101.4, 3601)).exitUnresolved, 'no deadline quote');
  const t = S.tickOrder(o, 'XAUUSD', none, M(99.9, 100.2), MD(101, 101.4)); assert.equal(t.ex, 'time'); assert.equal(t.px, 101);
  // a crossing before the entry moment or after the deadline does not count
  const early = S.tickOrder(o, 'XAUUSD', F([['x0001|s0', (T0 - 1) * 1000, 98, 98.2], ['x0001|t0', (T0 + 86401) * 1000, 105, 105.2]]), M(99.9, 100.2), MD(101, 101.4));
  assert.equal(early.ex, 'time');
});
test('queries: exact levels from the tick fill, the closing side, wider nearness inside the rollover band', () => {
  const bar = (t, l, h) => ({ t, e: t + 300, o: (l + h) / 2, h, l, c: (l + h) / 2 });
  const day = Date.UTC(2025, 5, 2) / 1000, t20 = day + 20 * 3600 + 900, t21 = day + 21 * 3600 + 600, t02 = day + 26 * 3600;
  const M5 = [bar(t20, 99.8, 100.3), bar(t21, 96.0, 100.1), bar(t02, 96.0, 100.1), bar(t02 + 300, 97.5, 104.0)];
  const o = { id: 'x0002', ts: t20, side: 1, D: 2, deadEnd: t02 + 600, fi: 0 };
  const r = S.queriesOf(o, 100.2, M5, 'XAUUSD'), stops = r.q.filter((x) => x[0].includes('|s')), tg = r.q.filter((x) => x[0].includes('|t'));
  assert.equal(r.X, 98.2); assert.equal(r.T, 104.2);
  assert.ok(stops.every((x) => x[3] === 98.2 && x[4] === -1)); assert.ok(tg.every((x) => x[3] === 104.2 && x[4] === 2));
  // low 96.0 is within reach of the stop on both candles; high 100.1 is 4.1 from the target: inside the band (10 x 0.5) only
  assert.ok(stops.some((x) => x[1] <= t21 && x[2] > t21) && stops.some((x) => x[1] <= t02 && x[2] > t02));
  assert.ok(tg.some((x) => x[1] <= t21 && x[2] > t21)); assert.ok(!tg.some((x) => x[1] <= t02 && x[2] > t02 && x[2] <= t02 + 300));
  assert.ok(tg.some((x) => x[1] <= t02 + 300 && x[2] > t02 + 300));
  const sell = S.queriesOf({ ...o, side: -1 }, 99.9, M5, 'XAUUSD'); assert.ok(sell.X > 99.9 && sell.T < 99.9);
  assert.ok(sell.q.filter((x) => x[0].includes('|s')).every((x) => x[4] === 1)); assert.ok(sell.q.filter((x) => x[0].includes('|t')).every((x) => x[4] === -2));
  assert.ok(S.inBand(day + 20 * 3600 + 55 * 60) && S.inBand(day + 23 * 3600) && !S.inBand(day + 23 * 3600 + 300) && !S.inBand(day + 20 * 3600 + 50 * 60));
});
test('verdict rule, month t, the pre-registration and the committed order files', () => {
  const st = (n, mean, t, u) => ({ unresolvedShare: u, net: { n, mean, monthT: t } });
  assert.equal(S.verdictOf(st(400, 0.1, 2.1, 0.02)), 'PASS'); assert.equal(S.verdictOf(st(400, 0.1, 1.9, 0.02)), 'FAIL');
  assert.equal(S.verdictOf(st(400, -0.1, -3, 0.02)), 'FAIL'); assert.equal(S.verdictOf(st(200, 0.3, 4, 0.02)), 'TOO FEW'); assert.equal(S.verdictOf(st(400, 0.3, 4, 0.2)), 'INCONCLUSIVE');
  assert.deepEqual(S.PRIMARY, [20, 21]); assert.deepEqual(S.HOURS, [20, 21, 22]);
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8'); assert.match(pre, /before\s+any broker tick/); assert.match(pre, /Every trade has one|every trade has one/);
  for (const sym of Object.keys(S.MARKETS)) { const O = JSON.parse(fs.readFileSync(new URL(`orders-${sym}.json`, DIR), 'utf8')); assert.ok(O.length > 100);
    for (const o of O) { assert.ok(S.HOURS.includes(o.hour)); assert.equal(S.hourOf(o.bt), o.hour); assert.ok(o.D > 0); assert.ok(o.ts >= S.FROM && o.ts < S.TO); assert.ok(o.side === 1 || o.side === -1); } }
});
test('the asset holds no order or broker code', () => {
  const src = fs.readFileSync(new URL('run.mjs', DIR), 'utf8'); assert.ok(!/ctrader|NEW_ORDER|WebSocket|fetch\(/i.test(src));
});
