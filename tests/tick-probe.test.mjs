// council/tick-probe.mjs: the pure pieces and one probe run against a fake read-only broker (no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { quotePath, spreadsOf, marksAt, widest, eventMarks, depthTimes, hourMarks, eventList, hourProfile, readSide, probe, EV_FROM, EV_TO } from '../council/tick-probe.mjs';

test('quote path, spreads, marks and the widest spread', () => {
  const qp = quotePath([[1000, 10], [3000, 11]], [[2000, 10.5], [4000, 11.2]]);
  assert.deepEqual(qp, [[2000, 10, 10.5], [3000, 11, 10.5], [4000, 11, 11.2]]);
  assert.deepEqual(spreadsOf(qp).map((x) => +x.toFixed(2)), [0.5, 0.2]);   // the crossed quote (-0.5) is dropped
  assert.deepEqual(marksAt(qp, [1, 2, 3.5, 9]), [null, [10, 10.5], [11, 10.5], [11, 11.2]]);
  assert.deepEqual(widest(qp, [0, 3]).map((x) => x == null ? x : +x.toFixed(2)), [0.5, 0.2]);
});

test('marks, depth dates, hour marks, events', () => {
  const m = eventMarks(1000);
  assert.equal(m[0], 1000 + EV_FROM); assert.equal(m[m.length - 1], 1000 + EV_TO); assert.ok(m.includes(1005) && m.includes(1030));
  const now = Date.parse('2026-11-20T00:20:00Z') / 1000;
  for (const d of depthTimes(now)) { const x = new Date(d.t * 1000); assert.equal(x.getUTCDay(), 3); assert.equal(x.getUTCHours(), 14); assert.ok(d.t <= now - d.days * 86400 + 86400); }
  const h = hourMarks(now, 7);
  assert.equal(h.length, 5 * 24);   // 13-19 Nov: five weekdays
  assert.ok(h.every((t) => ![0, 6].includes(new Date(t * 1000).getUTCDay())));
  const ev = eventList(now - 400 * 86400, now);
  assert.ok(ev.length > 30 && ev.every((e) => ['CPI', 'NFP', 'FOMC'].includes(e.type) && e.t + EV_TO < now));
  assert.equal(new Set(ev.map((e) => e.type + e.t)).size, ev.length);
});

test('hour profile', () => {
  const t0 = Date.parse('2026-11-18T00:00:00Z') / 1000;
  const p = hourProfile([{ t: t0, median: 0.1, max: 0.3, mid: 100 }, { t: t0 + 86400, median: 0.3, max: 0.5, mid: 100 }, { t: t0 + 3600, median: null, max: null }]);
  assert.equal(p[0].n, 2); assert.equal(p[0].median, 0.2); assert.equal(p[0].max, 0.5); assert.equal(p[1].n, 0); assert.equal(p[0].frac, 0.002); assert.equal(p[1].frac, null);
});

// a fake broker: ticks every 10 s, bid = 100 + i/100, ask = bid + 0.07; pages of 50, newest first, relative-encoded
function fakeBroker(sent) {
  const page = (q) => {
    const all = []; for (let t = Math.ceil(q.fromTimestamp / 10000) * 10000; t <= q.toTimestamp; t += 10000) all.push([t, Math.round((100 + (t / 1e7) % 1 + (q.type === 2 ? 0.07 : 0)) * 1e5)]);
    const take = all.slice(-50).reverse(), tickData = take.map((x, i) => (i ? { timestamp: x[0] - take[i - 1][0], tick: x[1] - take[i - 1][1] } : { timestamp: x[0], tick: x[1] }));
    return { tickData, hasMore: all.length > 50 };
  };
  return {
    PT: { APP_AUTH_REQ: 1, ACCOUNT_AUTH_REQ: 2, SYMBOLS_LIST_REQ: 3, GET_TICKDATA_REQ: 4 }, HOSTS: { demo: 'demo' },
    readAccounts: async () => [{ id: '7', live: false, broker: 'Demo Broker' }],
    session: () => ({ close() {}, send: async (type, q) => { sent.push(type);
      if (type === 3) return { symbol: [{ symbolName: 'XAUUSD', symbolId: 41, digits: 2 }] };
      if (type === 4) return page(q); return {}; } }),
  };
}

test('readSide pages back to the start of the window', async () => {
  const lib = fakeBroker([]), s = lib.session();
  const r = await readSide((q) => s.send(4, q), 7, 41, 1, 0, 1_000_000, async () => {});
  assert.equal(r.ticks.length, 101); assert.equal(r.ticks[0][0], 0); assert.equal(r.partial, false);
});

test('probe: read only, demo only, and the file shape', async () => {
  const env = { CTRADER_CLIENT_ID: 'a', CTRADER_CLIENT_SECRET: 'b', CTRADER_ACCESS_TOKEN: 'c', CTRADER_ACCOUNT_ID: '7', CTRADER_ENV: 'demo' };
  assert.match((await probe({ env: { ...env, CTRADER_ENV: 'live' }, lib: fakeBroker([]) })).error, /not demo/);
  const liveLib = { ...fakeBroker([]), readAccounts: async () => [{ id: '7', live: true }] };
  assert.match((await probe({ env, lib: liveLib })).error, /not a demo account/);
  const sent = [], now = Date.parse('2026-11-20T00:20:00Z');
  const r = await probe({ env, lib: fakeBroker(sent), now, sleep: async () => {} });
  const x = r.symbols.XAUUSD;
  assert.equal(x.reachDays, 1095); assert.ok(x.hours.length > 900); assert.ok(x.events.length > 60);
  assert.ok(x.hourProfile.every((h) => h.n === 0 || Math.abs(h.median - 0.07) < 1e-6));
  const e = x.events[0]; assert.equal(e.quotes.length, e.marks.length); assert.ok(e.quotes.every((q) => q && Math.abs(q[1] - q[0] - 0.07) < 1e-6));
  assert.ok(sent.every((t) => [1, 2, 3, 4].includes(t)));   // only auth, the symbol list and tick reads
  const src = fs.readFileSync(new URL('../council/tick-probe.mjs', import.meta.url), 'utf8');
  assert.ok(!/NEW_ORDER|CLOSE_POSITION|AMEND|CANCEL_ORDER|ctrader-mirror\.mjs['"];?\s*$/m.test(src.replace(/import \{ unseal, scrubber, normName \} from '\.\/ctrader-mirror\.mjs';/, '')));
  assert.match(src, /lib\.session\(WS, lib\.HOSTS\.demo\)/);
});

test('gotobi part: parts parsing, the gotobi days, entry and exit quotes', async () => {
  const { parseName, gotobiDays, probe } = await import('../council/tick-probe.mjs');
  assert.deepEqual(parseName('USDJPY:gotobi'), { name: 'USDJPY', parts: ['depth', 'gotobi'] });
  assert.deepEqual(parseName('XAUUSD').parts, ['depth', 'hours', 'events']);
  const now = Date.parse('2026-11-20T07:00:00Z') / 1000, days = gotobiDays(now - 30 * 86400, now).map((g) => g.day);
  assert.ok(days.includes('2026-11-20') && days.includes('2026-11-10') && !days.includes('2026-11-11'));
  const env = { CTRADER_CLIENT_ID: 'a', CTRADER_CLIENT_SECRET: 'b', CTRADER_ACCESS_TOKEN: 'c', CTRADER_ACCOUNT_ID: '7', CTRADER_ENV: 'demo' };
  const lib = fakeBroker([]), base = lib.session();
  lib.session = () => ({ ...base, send: async (type, q) => (type === 3 ? { symbol: [{ symbolName: 'USDJPY', symbolId: 4, digits: 3 }] } : base.send(type, q)) });
  const r = await probe({ env, lib, names: ['USDJPY:gotobi'], now: now * 1000, sleep: async () => {} });
  const x = r.symbols.USDJPY; assert.equal(x.hours.length, 0); assert.equal(x.events.length, 0); assert.ok(x.gotobi.length > 60);
  const g = x.gotobi.find((d) => d.day === '2026-11-20'); assert.ok(g.entry && g.exit); assert.ok(Math.abs(g.entry.ask - g.entry.bid - 0.07) < 1e-6); assert.ok(g.entry.ageS >= 0 && g.entry.ageS <= 10);
});

test('marks part: the quote at each given moment, nothing past now', async () => {
  const { probe } = await import('../council/tick-probe.mjs');
  const env = { CTRADER_CLIENT_ID: 'a', CTRADER_CLIENT_SECRET: 'b', CTRADER_ACCESS_TOKEN: 'c', CTRADER_ACCOUNT_ID: '7', CTRADER_ENV: 'demo' };
  const lib = fakeBroker([]), base = lib.session(), now = Date.parse('2026-11-20T07:00:00Z') / 1000;
  lib.session = () => ({ ...base, send: async (type, q) => (type === 3 ? { symbol: [{ symbolName: 'EURUSD', symbolId: 1 }] } : base.send(type, q)) });
  const r = await probe({ env, lib, names: ['EURUSD:marks'], marks: { EURUSD: [now - 86400, now - 3600 + 5, now + 600] }, now: now * 1000, sleep: async () => {} });
  const m = r.symbols.EURUSD.marks; assert.equal(m.length, 2);
  assert.equal(m[0][0], now - 86400); assert.ok(Math.abs(m[0][2] - m[0][1] - 0.07) < 1e-6); assert.equal(m[0][3], 0); assert.equal(m[1][3], 5);
});

test('fills part: the first tick that crosses a level, by side', async () => {
  const { probe, firstCross } = await import('../council/tick-probe.mjs');
  const qp = [[1000, 1.0, 1.1], [2000, 1.2, 1.3], [3000, 0.9, 1.0]];
  assert.deepEqual(firstCross(qp, 1.25, 1), [2000, 1.2, 1.3]); assert.deepEqual(firstCross(qp, 0.95, -1), [3000, 0.9, 1.0]); assert.equal(firstCross(qp, 2, 1), null);
  const env = { CTRADER_CLIENT_ID: 'a', CTRADER_CLIENT_SECRET: 'b', CTRADER_ACCESS_TOKEN: 'c', CTRADER_ACCOUNT_ID: '7', CTRADER_ENV: 'demo' };
  const lib = fakeBroker([]), base = lib.session(), now = Date.parse('2026-11-20T07:00:00Z') / 1000;
  lib.session = () => ({ ...base, send: async (type, q) => (type === 3 ? { symbol: [{ symbolName: 'XAUUSD', symbolId: 41 }] } : base.send(type, q)) });
  const t0 = now - 86400, bid0 = 100 + (t0 * 1000 / 1e7) % 1;
  const r = await probe({ env, lib, names: ['XAUUSD:fills'], marks: { fills: { XAUUSD: [['a', t0, t0 + 600, bid0 + 0.07 + 0.00005, 1], ['b', t0, t0 + 600, 0, -1], ['c', t0, t0 + 5000, 0, 1]] } }, now: now * 1000, sleep: async () => {} });
  const f = r.symbols.XAUUSD.fills; assert.equal(f.length, 2);   // 'c' spans over FILLS_SPAN
  assert.equal(f[0][0], 'a'); assert.ok(f[0][1] > t0 * 1000 && f[0][3] >= bid0 + 0.07); assert.deepEqual(f[1], ['b', null]);
});

test('marks look-back: PROBE_MARKS_BACK between 60 and 3600 seconds, else 60', async () => {
  const { marksBack } = await import('../council/tick-probe.mjs');
  assert.equal(marksBack({}), 60); assert.equal(marksBack({ PROBE_MARKS_BACK: '' }), 60); assert.equal(marksBack({ PROBE_MARKS_BACK: '30' }), 60);
  assert.equal(marksBack({ PROBE_MARKS_BACK: '1800' }), 1800); assert.equal(marksBack({ PROBE_MARKS_BACK: '99999' }), 3600); assert.equal(marksBack({ PROBE_MARKS_BACK: 'x' }), 60);
});
