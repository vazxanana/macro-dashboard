// node --test tests/academy-replay.test.mjs — the Academy replay layer (assets/academy-replay.js, MXR): chunked candle
// loading, closed-bar slicing, higher-timeframe bars, the Snapshot builder and its look-ahead guard, the hash, the replay
// clock and the saved replay position. Offline: candles come from a fake /md/bars that behaves like api/bars.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const MXR = createRequire(import.meta.url)('../assets/academy-replay.js');

const M5 = 300, H = 3600, H4 = 14400, D = 86400;
const utc = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi) / 1000;
const r2 = (v) => Math.round(v * 100) / 100;

// ---- a deterministic gold-like market: shut from Friday 22:00 UTC to Sunday 22:00 UTC ---------------------------------
const dow = (t) => (Math.floor(t / D) + 4) % 7;                 // 0 = Sunday … 6 = Saturday
const hourOf = (t) => Math.floor((t % D) / H);
const isOpen = (t) => !(dow(t) === 6 || (dow(t) === 5 && hourOf(t) >= 22) || (dow(t) === 0 && hourOf(t) < 22));
const px = (t) => 2000 + 40 * Math.sin(t / 40000) + 15 * Math.sin(t / 3100);
function mkBar(time, tf) {
  const o = px(time), c = px(time + tf), m = px(time + tf / 2);
  return { time, open: r2(o), high: r2(Math.max(o, c, m) + 0.1), low: r2(Math.min(o, c, m) - 0.1), close: r2(c) };
}
function series(from, to, tf) { const out = []; for (let t = Math.ceil(from / tf) * tf; t < to; t += tf) if (isOpen(t)) out.push(mkBar(t, tf)); return out; }

// A fake /md/bars with the real endpoint's range rules (api/bars.js): to is capped at now, at most 5,000 candles, and
// a window that is too long keeps its END. The open candle is flagged live, as on the feed.
function fakeBars({ nowSec, status = 200, error = 'OANDA_TOKEN not set', failFirst = 0, mutate } = {}) {
  const S = { calls: [], truncated: 0, inFlight: 0, maxInFlight: 0, maxBars: 0 };
  S.fetch = async (url) => {
    S.calls.push(url); S.inFlight++; S.maxInFlight = Math.max(S.maxInFlight, S.inFlight);
    await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
    S.inFlight--;
    if (failFirst > 0) { failFirst--; return { ok: false, status: 502, json: async () => ({ error: 'OANDA 502: upstream' }) }; }
    if (status !== 200) return { ok: false, status, json: async () => ({ error }) };
    const q = new URL(url, 'http://x').searchParams, tf = MXR.TF[q.get('tf')];
    const from = Math.floor(+q.get('from')), to = Math.min(nowSec, Math.ceil(+q.get('to')));
    if (!tf || !(from > 0) || !(to > from)) return { ok: false, status: 400, json: async () => ({ error: 'bad range' }) };
    const fromC = Math.max(from, to - 4999 * tf); if (fromC > from) S.truncated++;
    let bars = []; for (let t = Math.ceil(fromC / tf) * tf; t <= to; t += tf) if (isOpen(t)) bars.push(t + tf > nowSec ? { ...mkBar(t, tf), live: true } : mkBar(t, tf));
    S.maxBars = Math.max(S.maxBars, bars.length);
    if (mutate) bars = mutate(bars);
    return { ok: true, status: 200, json: async () => ({ src: 'OANDA', inst: 'XAU_USD', tf: q.get('tf'), bars }) };
  };
  return S;
}

// ---- loading ------------------------------------------------------------------------------------------------------
test('TF: seconds per timeframe', () => {
  assert.deepEqual({ ...MXR.TF }, { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 });
  assert.ok(Object.isFrozen(MXR.TF));
});

test('load: a range that needs 3+ calls returns every bar once, in order', async () => {
  MXR.cache.clear();
  const from = utc(2026, 3, 2) + 120, to = from + 45 * D, now = () => (to + 30 * D) * 1000;   // from is off the 5m grid on purpose
  const srv = fakeBars({ nowSec: to + 30 * D });
  // the endpoint alone cannot serve this range in one call: it keeps the end and loses the start
  const one = await (await srv.fetch(`/md/bars?sym=xau&tf=5m&from=${from}&to=${to}`)).json();
  assert.ok(one.bars[0].time > from + 20 * D && srv.truncated === 1); srv.calls.length = 0; srv.truncated = 0;

  const res = await MXR.load({ sym: 'xau', tf: '5m', from, to, fetch: srv.fetch, now });
  const want = series(from, to, M5);
  assert.ok(want.length > 9000);
  assert.ok(srv.calls.length >= 3, `expected 3+ calls, got ${srv.calls.length}`);
  assert.equal(srv.truncated, 0, 'no call may ask for more than the endpoint can return');
  assert.ok(srv.maxBars <= 5000 && srv.maxInFlight <= 3);
  for (const u of srv.calls) assert.match(u, /^\/md\/bars\?sym=xau&tf=5m&from=\d+&to=\d+$/);
  // the contract's Bar[] …
  assert.ok(Array.isArray(res));
  assert.deepEqual(res, want);
  for (let i = 1; i < res.length; i++) assert.ok(res[i].time > res[i - 1].time, 'sorted, no repeat');
  assert.deepEqual(Object.keys(res[0]), ['time', 'open', 'high', 'low', 'close']);
  // … that also reads as { bars, src, gaps }
  const { bars, src, gaps } = res;
  assert.equal(bars, res); assert.equal(src, 'OANDA'); assert.equal(res.inst, 'XAU_USD');
  assert.equal(res.calls, srv.calls.length); assert.equal(res.chunks, srv.calls.length); assert.equal(res.dropped, 0);
  assert.equal(gaps.length, 6);                                   // six weekends in the window, nothing else missing
  for (const g of gaps) { assert.equal(g.kind, 'weekend'); assert.equal(g.to - g.from, 48 * H); assert.equal(g.missing, 576); assert.equal(dow(g.from), 5); }
  assert.equal(JSON.stringify(res), JSON.stringify(want), 'the extra properties do not leak into JSON');
});

test('load: chunks are cached by sym / tf / chunk; a failure is not', async () => {
  MXR.cache.clear();
  const from = utc(2026, 3, 2), to = from + 45 * D, now = () => (to + 30 * D) * 1000;
  const srv = fakeBars({ nowSec: to + 30 * D });
  const a = await MXR.load({ sym: 'xau', tf: '5m', from, to, fetch: srv.fetch, now });
  const n = srv.calls.length;
  const b = await MXR.load({ sym: 'xau', tf: '5m', from, to, fetch: srv.fetch, now });
  assert.equal(srv.calls.length, n, 'the second load makes no call'); assert.equal(b.calls, 0);
  assert.deepEqual(b, a); assert.notEqual(b[0], a[0], 'callers get their own bar objects');
  const sub = await MXR.load({ sym: 'xau', tf: '5m', from: from + 3 * D, to: from + 4 * D, fetch: srv.fetch, now });
  assert.equal(srv.calls.length, n, 'a range inside loaded chunks makes no call');
  assert.deepEqual(sub, series(from + 3 * D, from + 4 * D, M5));
  await MXR.load({ sym: 'xau', tf: '15m', from, to: from + 2 * D, fetch: srv.fetch, now });
  assert.ok(srv.calls.length > n, 'another timeframe is another cache entry');
  const m = srv.calls.length;
  await MXR.load({ sym: 'xau', tf: '5m', from, to, fetch: srv.fetch, now, cache: false });
  assert.ok(srv.calls.length >= m + 3, 'cache: false always asks');

  MXR.cache.clear();
  const bad = fakeBars({ nowSec: to + 30 * D, status: 503 });
  await assert.rejects(MXR.load({ sym: 'xau', tf: '5m', from, to: from + D, fetch: bad.fetch, now }));
  assert.equal(MXR.cache.size(), 0);
});

test('load: at most 3 calls at once', async () => {
  MXR.cache.clear();
  const from = utc(2026, 3, 2), to = from + 30 * D, srv = fakeBars({ nowSec: to + 30 * D });
  const seen = [];
  const res = await MXR.load({ sym: 'xau', tf: '1m', from, to, fetch: srv.fetch, now: () => (to + 30 * D) * 1000, concurrency: 99, onProgress: (d, n) => seen.push([d, n]) });
  assert.ok(srv.calls.length >= 8);
  assert.ok(srv.maxInFlight <= 3 && srv.maxInFlight >= 2, `max in flight ${srv.maxInFlight}`);
  assert.equal(srv.truncated, 0);
  assert.deepEqual(res, series(from, to, 60));
  assert.deepEqual(seen[seen.length - 1], [srv.calls.length, srv.calls.length]);
});

test('load: 503 gives the clear "no data source" error, without a retry', async () => {
  MXR.cache.clear();
  const from = utc(2026, 3, 2), srv = fakeBars({ nowSec: from + 60 * D, status: 503 });
  await assert.rejects(MXR.load({ sym: 'xau', tf: '1h', from, to: from + 5 * D, fetch: srv.fetch, now: () => (from + 60 * D) * 1000 }), (e) => {
    assert.equal(e.code, 'NO_SOURCE'); assert.equal(e.status, 503);
    assert.match(e.message, /no candle data source is configured/i); assert.match(e.message, /OANDA_TOKEN not set/);
    return true;
  });
  assert.equal(srv.calls.length, 1);
});

test('load: one retry for a failing feed, clear errors for the rest', async () => {
  const from = utc(2026, 3, 2), to = from + 5 * D, now = () => (from + 60 * D) * 1000, nowSec = from + 60 * D;
  MXR.cache.clear();
  const flaky = fakeBars({ nowSec, failFirst: 1 });
  assert.deepEqual(await MXR.load({ sym: 'xau', tf: '1h', from, to, fetch: flaky.fetch, now }), series(from, to, H));
  assert.equal(flaky.calls.length, 2);
  MXR.cache.clear();
  const down = fakeBars({ nowSec, failFirst: 9 });
  await assert.rejects(MXR.load({ sym: 'xau', tf: '1h', from, to, fetch: down.fetch, now, retries: 0 }), (e) => e.code === 'UPSTREAM' && e.status === 502 && /502/.test(e.message));
  assert.equal(down.calls.length, 1);
  await assert.rejects(MXR.load({ sym: 'xau', tf: '1h', from, to, fetch: async () => { throw new Error('offline'); }, now, cache: false }), (e) => e.code === 'NETWORK' && /offline/.test(e.message));
  await assert.rejects(MXR.load({ sym: 'xau', tf: '1h', from, to, fetch: async () => ({ ok: true, status: 200, json: async () => ({ nope: 1 }) }), now, cache: false }), (e) => e.code === 'BAD_RESPONSE');
  await assert.rejects(MXR.load({ sym: 'xau', tf: '2h', from, to, fetch: flaky.fetch, now }), (e) => e.code === 'BAD_TF');
  await assert.rejects(MXR.load({ sym: 'xau', tf: '1h', from, to: from, fetch: flaky.fetch, now }), (e) => e.code === 'BAD_RANGE');
  await assert.rejects(MXR.load({ tf: '1h', from, to, fetch: flaky.fetch, now }), (e) => e.code === 'BAD_REQUEST');
});

test('load: repeated, unsorted and malformed bars are cleaned up', async () => {
  MXR.cache.clear();
  const from = utc(2026, 3, 3), to = from + D, nowSec = from + 60 * D;
  const srv = fakeBars({ nowSec, mutate: (bars) => {
    const good = bars.filter((b) => b.time >= from && b.time < to);
    return [...good.slice().reverse(), { ...good[3] }, { ...good[7], volume: 12 },                    // out of order, two repeats
      { time: from + 100.5, open: 1, high: 2, low: 1, close: 2 },                                      // not a whole second
      { time: from + 7200, open: 2000, high: 1990, low: 1995, close: 1999 },                           // high below low
      { time: from + 10800, open: 2000, high: 2001, low: 1999, close: NaN },                           // not a number
      { time: from + 14400, open: 2000, high: 2001, low: 1999 },                                       // no close
      { time: from + 18000, open: 2000, high: 2000.5, low: 1999, close: 2003 },                        // close above the high
      null, 'x'];
  } });
  const res = await MXR.load({ sym: 'xau', tf: '1h', from, to, fetch: srv.fetch, now: () => nowSec * 1000 });
  assert.deepEqual(res, series(from, to, H));
  assert.equal(res.dropped, 7);
  assert.equal(MXR.cleanBar({ time: '1700000000', open: '1.5', high: '2', low: '1', close: '1.75', volume: 9 }).close, 1.75);
});

test('load: nothing after now, and the open candle is never returned', async () => {
  MXR.cache.clear();
  const from = utc(2026, 3, 3), nowSec = from + 10 * H + 1234; let ms = nowSec * 1000;
  const srv = fakeBars({ nowSec });
  const res = await MXR.load({ sym: 'xau', tf: '1h', from, to: from + 5 * D, fetch: srv.fetch, now: () => ms });
  assert.deepEqual(res.map((b) => b.time), series(from, from + 10 * H, H).map((b) => b.time));
  assert.ok(res[res.length - 1].time + H <= nowSec);
  // a chunk that still touches now is reused only briefly
  await MXR.load({ sym: 'xau', tf: '1h', from, to: from + 5 * D, fetch: srv.fetch, now: () => ms });
  assert.equal(srv.calls.length, 1);
  ms += 31000;
  await MXR.load({ sym: 'xau', tf: '1h', from, to: from + 5 * D, fetch: srv.fetch, now: () => ms });
  assert.equal(srv.calls.length, 2);
  // a window entirely in the future: no call, no bars
  const none = await MXR.load({ sym: 'xau', tf: '1h', from: nowSec + D, to: nowSec + 2 * D, fetch: srv.fetch, now: () => ms });
  assert.equal(none.length, 0); assert.equal(none.src, null); assert.equal(srv.calls.length, 2);
});

// ---- closed bars --------------------------------------------------------------------------------------------------
test('closedAt never leaks the forming bar at exact boundaries', () => {
  const T0 = utc(2026, 3, 3, 8), bars = [0, 1, 2].map((i) => mkBar(T0 + i * H, H));
  const times = (t) => MXR.closedAt(bars, H, t).map((b) => b.time);
  assert.deepEqual(times(T0), []);                                  // t on the first bar's open
  assert.deepEqual(times(T0 + H - 1), []);                          // one second before its close
  assert.deepEqual(times(T0 + H), [T0]);                            // at its close
  assert.deepEqual(times(T0 + 2 * H), [T0, T0 + H]);                // t on the third bar's open: the third is not in
  assert.deepEqual(times(T0 + 3 * H - 1), [T0, T0 + H]);            // one second before the third closes
  assert.deepEqual(times(T0 + 3 * H), [T0, T0 + H, T0 + 2 * H]);    // at its close
  assert.deepEqual(times(T0 + 99 * H), [T0, T0 + H, T0 + 2 * H]);
  assert.deepEqual(times(T0 - 5), []);
  assert.deepEqual(MXR.closedAt(bars, '1h', T0 + 2 * H), MXR.closedAt(bars, 3600, T0 + 2 * H), 'a timeframe key works too');
  assert.equal(MXR.closedCount(bars, H, T0 + 2 * H), 2);
  assert.deepEqual(MXR.closedAt([], H, T0), []);
  // a display bar left at the end of the array is never closed, whatever t says
  const withForming = [...bars, { ...mkBar(T0 + 3 * H, H), forming: true }];
  assert.deepEqual(MXR.closedAt(withForming, H, T0 + 50 * H).map((b) => b.time), [T0, T0 + H, T0 + 2 * H]);
  assert.throws(() => MXR.closedAt(bars, 'x', T0), (e) => e.code === 'BAD_TF');
  // exhaustive against a plain filter on a long series with a weekend gap
  const long = series(utc(2026, 3, 5), utc(2026, 3, 11), M5);
  for (let t = long[0].time - 600; t < long[long.length - 1].time + 900; t += 173) assert.equal(MXR.closedAt(long, M5, t).length, long.filter((b) => b.time + M5 <= t).length);
});

// ---- higher timeframes --------------------------------------------------------------------------------------------
test('aggregate: a 1h bar written by hand', () => {
  const T = utc(2026, 3, 4, 10), q = (i, o, h, l, c) => ({ time: T + i * 900, open: o, high: h, low: l, close: c });
  const m15 = [q(0, 100, 101, 99.5, 100.5), q(1, 100.5, 103, 100.2, 102.8), q(2, 102.8, 102.9, 98.7, 99), q(3, 99, 100.4, 98.9, 100.1),
    q(4, 100.1, 100.6, 100, 100.3), q(5, 100.3, 100.9, 99.9, 100.2)];
  assert.deepEqual(MXR.aggregate(m15, 900, H), [{ time: T, open: 100, high: 103, low: 98.7, close: 100.1 }], 'the second hour has two of four bars: not complete');
  assert.deepEqual(MXR.aggregate(m15, '15m', '1h', T + 2 * H), [{ time: T, open: 100, high: 103, low: 98.7, close: 100.1 }, { time: T + H, open: 100.1, high: 100.9, low: 99.9, close: 100.2 }], 'with t at 12:00 the second hour is over (a quiet half hour)');
  assert.deepEqual(MXR.aggregate(m15, 900, H, T + 2 * H - 1), [{ time: T, open: 100, high: 103, low: 98.7, close: 100.1 }]);
  assert.deepEqual(MXR.aggregate(m15, 900, H, T + H), [{ time: T, open: 100, high: 103, low: 98.7, close: 100.1 }]);
  assert.deepEqual(MXR.aggregate(m15, 900, H, T + H - 1), []);
  assert.deepEqual(MXR.aggregate(m15.slice(0, 3), 900, H), []);
  assert.deepEqual(MXR.aggregate(m15, 900, 900), m15);
  assert.throws(() => MXR.aggregate(m15, 900, 1000), (e) => e.code === 'BAD_TF');
  assert.throws(() => MXR.aggregate(m15, H, 900), (e) => e.code === 'BAD_TF');
});

test('aggregate: 1h, 4h and 1d over a weekend gap match bars built by hand, on 00:00 UTC boundaries', () => {
  const from = utc(2026, 3, 5), to = utc(2026, 3, 11), m5 = series(from, to, M5);   // Thu 5 Mar … Tue 10 Mar 2026, shut Fri 22:00 → Sun 22:00
  // the reference: one bucket at a time, straight from the definition
  const ref = (tf) => { const out = []; for (let s = from; s < to; s += tf) { const in_ = m5.filter((b) => b.time >= s && b.time < s + tf); if (!in_.length) continue;
    out.push({ time: s, open: in_[0].open, high: Math.max(...in_.map((b) => b.high)), low: Math.min(...in_.map((b) => b.low)), close: in_[in_.length - 1].close }); } return out; };
  for (const tf of [H, H4, D]) {
    const got = MXR.aggregate(m5, M5, tf, to);
    assert.deepEqual(got, ref(tf));
    for (const b of got) { assert.equal(b.time % tf, 0, 'on a UTC boundary'); assert.ok(!('forming' in b)); }
  }
  const h1 = MXR.aggregate(m5, M5, H, to), h4 = MXR.aggregate(m5, M5, H4, to), d1 = MXR.aggregate(m5, M5, D, to);
  assert.equal(h1.length, 24 + 22 + 2 + 24 + 24);
  assert.deepEqual(h4.map((b) => new Date(b.time * 1000).getUTCHours()).slice(0, 6), [0, 4, 8, 12, 16, 20]);
  // the weekend: Friday's 20:00 bar holds only 20:00 → 22:00, nothing on Saturday, Sunday starts with the 20:00 bucket (22:00 → 24:00)
  const fri20 = h4.find((b) => b.time === utc(2026, 3, 6, 20)), in20 = m5.filter((b) => b.time >= utc(2026, 3, 6, 20) && b.time < utc(2026, 3, 6, 22));
  assert.equal(in20.length, 24);
  assert.deepEqual(fri20, { time: utc(2026, 3, 6, 20), open: in20[0].open, high: Math.max(...in20.map((b) => b.high)), low: Math.min(...in20.map((b) => b.low)), close: in20[23].close });
  assert.equal(h4[h4.indexOf(fri20) + 1].time, utc(2026, 3, 8, 20));
  assert.deepEqual(d1.map((b) => b.time), [utc(2026, 3, 5), utc(2026, 3, 6), utc(2026, 3, 8), utc(2026, 3, 9), utc(2026, 3, 10)], 'no Saturday; the short Sunday session is its own day');
  const sun = m5.filter((b) => b.time >= utc(2026, 3, 8) && b.time < utc(2026, 3, 9));
  assert.equal(sun.length, 24); assert.equal(d1[2].open, sun[0].open); assert.equal(d1[2].close, sun[23].close);
  // 1d from 1h and from 4h give the same bars as 1d from 5m
  assert.deepEqual(MXR.aggregate(h1, H, D, to), d1); assert.deepEqual(MXR.aggregate(h4, H4, D, to), d1);

  // nothing is closed before it is complete
  const tSat = utc(2026, 3, 7, 9), tFri = utc(2026, 3, 6, 21, 30);
  assert.equal(MXR.aggregate(m5, M5, H4, tFri).at(-1).time, utc(2026, 3, 6, 16), 'at 21:30 the 20:00 bar is still forming');
  assert.equal(MXR.aggregate(m5, M5, D, tFri).at(-1).time, utc(2026, 3, 5), 'and so is Friday');
  assert.equal(MXR.aggregate(m5, M5, H4, tSat).at(-1).time, utc(2026, 3, 6, 20));
  assert.equal(MXR.aggregate(m5, M5, D, tSat).at(-1).time, utc(2026, 3, 6));
  // without t the last bucket only counts when the lower bars reach its end: bars up to Friday 22:00 do not prove that
  const upToFri = m5.filter((b) => b.time < utc(2026, 3, 7));
  assert.equal(MXR.aggregate(upToFri, M5, H4).at(-1).time, utc(2026, 3, 6, 16));
  assert.equal(MXR.aggregate(upToFri, M5, H).at(-1).time, utc(2026, 3, 6, 21));
  // for every t: exactly the reference buckets that have ended
  for (let t = from + 1000; t < to; t += 7919) for (const tf of [H, H4, D]) {
    const lower = m5.filter((b) => b.time + M5 <= t);
    const want = []; for (let s = from; s + tf <= t; s += tf) { const in_ = lower.filter((b) => b.time >= s && b.time < s + tf); if (in_.length) want.push(s); }
    assert.deepEqual(MXR.aggregate(m5, M5, tf, t).map((b) => b.time), want);
  }
});

test('formingAt: the partial bar for display, flagged, never closed', () => {
  const from = utc(2026, 3, 5), m5 = series(from, utc(2026, 3, 11), M5), T = utc(2026, 3, 5, 10);
  const part = m5.filter((b) => b.time >= T && b.time + M5 <= T + 35 * 60);   // 10:00 … 10:30 are closed at 10:35
  assert.equal(part.length, 7);
  const want = { time: T, open: part[0].open, high: Math.max(...part.map((b) => b.high)), low: Math.min(...part.map((b) => b.low)), close: part[6].close, forming: true };
  assert.deepEqual(MXR.formingAt(m5, H, T + 35 * 60, M5), want);
  assert.deepEqual(MXR.formingAt(m5, '1h', T + 35 * 60), want, 'the lower timeframe is read from the bars when not given');
  assert.deepEqual(MXR.formingAt(m5, H, T + 35 * 60 + 299, M5), want, 'the 10:35 bar is not closed at 10:39:59');
  assert.equal(MXR.formingAt(m5, H, T, M5), null, 'on the open nothing has closed yet');
  assert.equal(MXR.formingAt(m5, H, T + 299, M5), null);
  assert.equal(MXR.formingAt(m5, H, T + 300, M5).close, m5.find((b) => b.time === T).close);
  assert.equal(MXR.formingAt(m5, D, utc(2026, 3, 7, 12), M5), null, 'nothing forms on a Saturday');
  assert.equal(MXR.formingAt(m5, D, T + 35 * 60, M5).time, from);
  assert.equal(MXR.formingAt(m5, H, utc(2027, 1, 1), M5), null);
  // the forming bar and the closed bars never overlap
  const t = T + 35 * 60, closed = MXR.aggregate(m5, M5, H, t), f = MXR.formingAt(m5, H, t, M5);
  assert.equal(closed.at(-1).time + H, f.time);
  // and it cannot enter a snapshot
  const snap = MXR.snapshot({ edge: 'gtrend', market: 'xau', t, series: { '1h': [...closed, f] } });
  assert.deepEqual(snap.bars['1h'], closed.slice(-300));
});

// ---- snapshot, guard, hash ----------------------------------------------------------------------------------------
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const WORLD = (() => {
  const from = utc(2026, 2, 2), to = utc(2026, 3, 2), m5 = series(from, to, M5), rnd = mulberry32(20261110);
  const S = { '5m': m5, '15m': MXR.aggregate(m5, M5, 900, to), '1h': MXR.aggregate(m5, M5, H, to), '4h': MXR.aggregate(m5, M5, H4, to), '1d': MXR.aggregate(m5, M5, D, to) };
  const dxy = (bars) => bars.map((b) => ({ time: b.time, open: r2(b.open / 20), high: r2(b.high / 20) + 0.01, low: r2(b.low / 20) - 0.01, close: r2(b.close / 20) }));
  const inter = { dxy: { '1h': dxy(S['1h']), '1d': dxy(S['1d']) } };
  const events = Array.from({ length: 60 }, (_, i) => ({ t: from + Math.floor(rnd() * (to - from) / 60) * 60, title: 'Event ' + i, impact: ['low', 'medium', 'high'][i % 3], actual: i }));
  return { from, to, S, inter, events, rnd };
})();

test('snapshot: the contract shape, the last N closed bars, future events dropped', () => {
  const { S, inter, events } = WORLD, t = utc(2026, 2, 20, 14, 35);
  const cand = { id: 'c1', edge: 'gtl', market: 'xau', t, side: 'buy', entry: 2001, stop: 1995, target: 2013, tf: '4h', rule: { tag: 'x' }, edgeVersion: 'v1', pool: 'train' };
  const snap = MXR.snapshot({ edge: 'gtl', market: 'xau', t, cand, series: S, inter, events, dataVersion: 'd1' });
  assert.deepEqual(Object.keys(snap), ['v', 'edge', 'market', 't', 'cand', 'bars', 'inter', 'events', 'dataVersion']);
  assert.equal(snap.v, 1); assert.equal(snap.edge, 'gtl'); assert.equal(snap.market, 'xau'); assert.equal(snap.t, t); assert.equal(snap.dataVersion, 'd1');
  assert.deepEqual(snap.cand, cand); assert.notEqual(snap.cand, cand);
  assert.deepEqual(Object.keys(snap.bars), ['5m', '15m', '1h', '4h', '1d']);
  assert.equal(snap.bars['5m'].length, 300); assert.equal(snap.bars['5m'].at(-1).time, t - M5);
  assert.equal(snap.bars['15m'].at(-1).time, utc(2026, 2, 20, 14, 15)); assert.equal(snap.bars['1h'].at(-1).time, utc(2026, 2, 20, 13));
  assert.equal(snap.bars['4h'].at(-1).time, utc(2026, 2, 20, 8)); assert.equal(snap.bars['1d'].at(-1).time, utc(2026, 2, 19));
  assert.equal(snap.bars['1d'].length, S['1d'].filter((b) => b.time + D <= t).length);
  assert.deepEqual(Object.keys(snap.inter), ['dxy']); assert.deepEqual(Object.keys(snap.inter.dxy), ['1h', '1d']);
  assert.equal(snap.inter.dxy['1h'].at(-1).time, utc(2026, 2, 20, 13));
  assert.equal(snap.events.length, events.filter((e) => e.t <= t).length); assert.ok(snap.events.length > 0 && snap.events.length < events.length);
  assert.deepEqual(Object.keys(snap.events[0]), ['t', 'title', 'impact']);
  // N is configurable, for all timeframes or one by one
  assert.equal(MXR.KEEP, 300);
  const small = MXR.snapshot({ edge: 'gtl', market: 'xau', t, series: S, keep: 50 });
  for (const tf of ['5m', '15m', '1h', '4h']) assert.equal(small.bars[tf].length, 50);
  assert.deepEqual(small.bars['5m'], snap.bars['5m'].slice(-50));
  const mixed = MXR.snapshot({ edge: 'gtl', market: 'xau', t, series: S, keep: { '5m': 1000, '1h': 10 } });
  assert.equal(mixed.bars['5m'].length, 1000); assert.equal(mixed.bars['1h'].length, 10); assert.equal(mixed.bars['15m'].length, 300);
  // optional parts stay out; a missing timeframe is an empty list; '1m' is carried when given
  const bare = MXR.snapshot({ edge: 'nq-open', market: 'nas100', t, series: { '1m': series(t - 2 * H, t + 2 * H, 60), '5m': S['5m'] } });
  assert.deepEqual(Object.keys(bare), ['v', 'edge', 'market', 't', 'cand', 'bars', 'dataVersion']);
  assert.deepEqual(Object.keys(bare.bars), ['1m', '5m', '15m', '1h', '4h', '1d']);
  assert.equal(bare.cand, null); assert.equal(bare.dataVersion, null); assert.deepEqual(bare.bars['1h'], []);
  assert.equal(bare.bars['1m'].length, 120); assert.equal(bare.bars['1m'].at(-1).time, t - 60);
  // the builder never changes what it was given
  assert.equal(S['5m'].length, WORLD.S['5m'].length); assert.equal(events.length, 60);
  // refusals
  assert.throws(() => MXR.snapshot({ edge: 'gtl', market: 'xau', series: S }), (e) => e.code === 'BAD_TIME');
  assert.throws(() => MXR.snapshot({ edge: 'gtl', market: 'xau', t, series: { '2h': [] } }), (e) => e.code === 'BAD_TF');
  assert.throws(() => MXR.snapshot({ edge: 'gtl', market: 'xau', t, series: S, keep: 0 }), (e) => e.code === 'BAD_KEEP');
  assert.throws(() => MXR.snapshot({ edge: 'gtl', market: 'xau', t, series: S, cand: { ...cand, t: t + 60 } }), (e) => e.code === 'LOOKAHEAD');
  assert.throws(() => MXR.snapshot({ edge: 'gtl', market: 'xau', t, series: S, cand: { ...cand, netR: 1.2 } }), (e) => e.code === 'LOOKAHEAD' && /netR/.test(e.message));
});

test('snapshot: no bar and no event after t, in every timeframe, for 200 random decision times', () => {
  const { from, to, S, inter, events } = WORLD, rnd = mulberry32(7);
  const tfs = Object.keys(S); let checkedBars = 0, onBoundary = 0;
  for (let i = 0; i < 200; i++) {
    let t = from + 2 * D + Math.floor(rnd() * (to - from - 2 * D + 5 * D));   // some decision times lie past the end of the data
    if (i % 4 === 1) t = Math.floor(t / M5) * M5;                             // exactly on a 5m boundary
    if (i % 4 === 2) t = Math.floor(t / H4) * H4;                             // exactly on a 4h boundary (every third of those is also a day's)
    if (i % 4 === 3) t = Math.floor(t / H) * H - 1;                           // one second before an hour closes
    if (t % M5 === 0) onBoundary++;
    const keep = [300, 300, 40, 1][i % 4];
    const snap = MXR.snapshot({ edge: 'replica', market: 'xau', t, series: S, inter, events, dataVersion: 'prop', keep });
    for (const tf of tfs) {
      const sec = MXR.TF[tf], got = snap.bars[tf], want = S[tf].filter((b) => b.time + sec <= t).slice(-keep);
      for (const b of got) { assert.ok(b.time + sec <= t, `${tf}: bar ${b.time} ends after t ${t}`); checkedBars++; }
      assert.ok(got.length <= keep);
      assert.deepEqual(got, want, `${tf} at ${t}: exactly the last closed bars`);
    }
    for (const tf of ['1h', '1d']) {
      const sec = MXR.TF[tf], got = snap.inter.dxy[tf];
      for (const b of got) assert.ok(b.time + sec <= t, `dxy ${tf}: bar ${b.time} ends after t ${t}`);
      assert.deepEqual(got, inter.dxy[tf].filter((b) => b.time + sec <= t).slice(-keep));
    }
    for (const e of snap.events) assert.ok(e.t <= t, `event ${e.t} after t ${t}`);
    assert.equal(snap.events.length, events.filter((e) => e.t <= t).length);
    for (let k = 1; k < snap.events.length; k++) assert.ok(snap.events[k].t >= snap.events[k - 1].t);
    assert.equal(MXR.guard(snap), snap);
    assert.equal(MXR.hash(snap), MXR.hash(MXR.snapshot({ edge: 'replica', market: 'xau', t, series: S, inter, events, dataVersion: 'prop', keep })));
  }
  assert.ok(checkedBars > 50000 && onBoundary >= 100);
});

test('guard throws on a planted future bar, event or candidate', () => {
  const { S, inter, events } = WORLD, t = utc(2026, 2, 20, 14, 35);
  const make = () => MXR.snapshot({ edge: 'gtl', market: 'xau', t, series: S, inter, events, dataVersion: 'd1' });
  const look = (fn, re) => { const s = make(); fn(s); assert.throws(() => MXR.guard(s), (e) => { assert.equal(e.code, 'LOOKAHEAD'); if (re) assert.match(e.message, re); return true; }); };
  assert.equal(MXR.guard(make()).t, t);
  look((s) => s.bars['1h'].push(mkBar(utc(2026, 2, 20, 14), H)), /bars\.1h/);                 // the hour still forming at 14:35
  look((s) => s.bars['5m'].push(mkBar(t, M5)), /bars\.5m/);                                    // the bar that opens at t
  look((s) => s.bars['5m'].push(mkBar(t - M5 + 1, M5)));                                       // closes one second after t
  look((s) => s.bars['1d'].push(mkBar(utc(2026, 2, 20), D)), /bars\.1d/);                      // today's daily bar
  look((s) => s.bars['4h'].splice(5, 0, mkBar(utc(2026, 2, 25), H4)));                         // hidden in the middle
  look((s) => s.inter.dxy['1d'].push(mkBar(utc(2026, 2, 20), D)), /inter\.dxy\.1d/);
  look((s) => s.inter.dxy['1h'].push(mkBar(utc(2026, 2, 20, 14), H)), /inter\.dxy\.1h/);
  look((s) => s.events.push({ t: t + 1, title: 'CPI', impact: 'high' }), /events/);
  look((s) => { s.bars['1h'][s.bars['1h'].length - 1].forming = true; }, /forming/);
  look((s) => { s.cand = { id: 'c', t: t + 300, side: 'buy' }; }, /candidate/);
  look((s) => { s.cand = { id: 'c', t, side: 'buy', R: 2 }; }, /outcome/);
  const bad = (fn) => { const s = make(); fn(s); assert.throws(() => MXR.guard(s), (e) => e.code === 'BAD_SNAPSHOT'); };
  bad((s) => { s.v = 2; }); bad((s) => { delete s.bars; }); bad((s) => { s.bars['2h'] = []; }); bad((s) => s.bars['1h'].reverse());
  bad((s) => s.bars['1h'].push({ ...s.bars['1h'].at(-1) }));
  assert.throws(() => MXR.guard(null), (e) => e.code === 'BAD_SNAPSHOT');
  // an event or a bar that ends exactly at t is allowed
  const edge = make(); edge.events.push({ t, title: 'now', impact: 'low' }); assert.equal(MXR.guard(edge), edge);
  assert.equal(edge.bars['5m'].at(-1).time + M5, t);
});

test('hash: stable for the same decision point, different when one bar changes', () => {
  const { S, inter, events } = WORLD, t = utc(2026, 2, 20, 14, 35);
  const args = () => ({ edge: 'gtl', market: 'xau', t, series: S, inter, events, dataVersion: 'd1' });
  const a = MXR.snapshot(args()), h = MXR.hash(a);
  assert.match(h, /^[0-9a-f]{16}$/);
  assert.equal(MXR.hash(MXR.snapshot(args())), h);
  assert.equal(MXR.hash(JSON.parse(JSON.stringify(a))), h, 'survives a trip through JSON');
  const shuffled = {}; for (const k of Object.keys(a).reverse()) shuffled[k] = a[k];
  shuffled.bars = {}; for (const k of Object.keys(a.bars).reverse()) shuffled.bars[k] = a.bars[k].map((b) => ({ close: b.close, low: b.low, high: b.high, open: b.open, time: b.time }));
  assert.equal(MXR.hash(shuffled), h, 'key order does not matter');
  // bars the decision cannot see do not change it: the same closed bars with a longer future give the same hash
  const cutS = {}; for (const tf of Object.keys(S)) cutS[tf] = S[tf].filter((b) => b.time < t + D);
  assert.equal(MXR.hash(MXR.snapshot({ ...args(), series: cutS })), h);
  const seen = new Set([h]);
  const differs = (fn, msg) => { const s = JSON.parse(JSON.stringify(a)); fn(s); const x = MXR.hash(s); assert.ok(!seen.has(x), msg); seen.add(x); };
  differs((s) => { s.bars['1h'][120].close = r2(s.bars['1h'][120].close + 0.01); }, 'one close, one cent');
  differs((s) => { s.bars['5m'][0].high += 0.01; }, 'the oldest bar');
  differs((s) => { s.inter.dxy['1d'][3].low -= 0.01; }, 'an intermarket bar');
  differs((s) => { s.bars['5m'].pop(); }, 'one bar fewer');
  differs((s) => { s.events[0].impact = 'x'; }, 'an event');
  differs((s) => { s.t += 1; }, 'the time');
  differs((s) => { s.cand = { id: 'c1', t: s.t, side: 'buy' }; }, 'the candidate');
  differs((s) => { s.dataVersion = 'd2'; }, 'the data version');
  differs((s) => { s.edge = 'geg'; }, 'the edge');
  // FNV-1a, 32 bits: published test values
  assert.equal(MXR.fnv1a(''), 0x811c9dc5); assert.equal(MXR.fnv1a('a'), 0xe40c292c); assert.equal(MXR.fnv1a('foobar'), 0xbf9cf968);
  assert.notEqual(MXR.fnv1a('é'), MXR.fnv1a('e'));
  assert.equal(MXR.canonical({ b: 1, a: [1, { d: undefined, c: -0 }], e: NaN }), '{"a":[1,{"c":0}],"b":1,"e":null}');
});

// ---- the clock ----------------------------------------------------------------------------------------------------
// virtual time: timers fire in order as advance() moves the clock; nothing here waits for real time
function sched() {
  let nowMs = 0, seq = 0; const q = [];
  return { now: () => nowMs, setTimer: (fn, ms) => { const h = ++seq; q.push({ h, at: nowMs + ms, fn }); return h; },
    clearTimer: (h) => { const i = q.findIndex((x) => x.h === h); if (i >= 0) q.splice(i, 1); },
    advance(ms) { const end = nowMs + ms; for (;;) { q.sort((a, b) => a.at - b.at || a.h - b.h); if (!q.length || q[0].at > end) break; const x = q.shift(); nowMs = Math.max(nowMs, x.at); x.fn(); } nowMs = Math.max(nowMs, end); },
    stall(ms) { nowMs += ms; }, pending: () => q.length, set: () => seq };
}
const T0 = utc(2026, 3, 3, 8);

test('clock: at every speed it advances speed candles a second and lands on exact candle boundaries', () => {
  assert.deepEqual([...MXR.SPEEDS], [1, 5, 10, 50, 100]);
  for (const speed of MXR.SPEEDS) for (const from of [T0, T0 + 7]) {
    const s = sched(), ticks = [], batches = [];
    const c = MXR.clock({ from, to: T0 + 5000 * M5, stepSec: M5, speed, now: s.now, setTimer: s.setTimer, clearTimer: s.clearTimer,
      onTick: (t, info) => { ticks.push(t); assert.equal(info.kind, 'play'); assert.ok(s.pending() <= 1); }, onBatch: (t, n) => batches.push(n) });
    assert.deepEqual(c.state(), { t: from, from, to: T0 + 5000 * M5, stepSec: M5, speed, playing: false, done: false, steps: 0 });
    s.advance(5000); assert.equal(ticks.length, 0, 'nothing moves before play');
    assert.equal(c.play().playing, true);
    s.advance(1000);
    assert.equal(ticks.length, speed, `${speed}x: ${speed} candles in the first second`);
    assert.equal(c.state().t, T0 + speed * M5);
    s.advance(3000);
    assert.equal(ticks.length, 4 * speed); assert.equal(c.state().t, T0 + 4 * speed * M5); assert.equal(c.state().steps, 4 * speed);
    ticks.forEach((t, i) => { assert.equal(t % M5, 0, 'on a candle boundary'); assert.equal(t, T0 + (i + 1) * M5, 'no candle skipped or repeated'); });
    assert.ok(s.pending() === 1, 'one timer, whatever the speed');
    assert.ok(s.set() <= 4 * 20 + 2, `${speed}x used ${s.set()} timers in 4 s: batching, not a timer per candle`);
    assert.equal(batches.reduce((x, y) => x + y, 0), 4 * speed);
    if (speed === 100) assert.ok(batches.every((n) => n === 5));
    c.pause(); assert.equal(s.pending(), 0);
  }
});

test('clock: pause, resume, step, jump, setSpeed and restart', () => {
  const s = sched(), ticks = [], kinds = [];
  const c = MXR.clock({ from: T0, to: T0 + 1000 * M5, stepSec: '5m', now: s.now, setTimer: s.setTimer, clearTimer: s.clearTimer, onTick: (t, info) => { ticks.push(t); kinds.push(info.kind); } });
  assert.equal(c.state().speed, 1);
  c.play(); c.play(); assert.equal(s.pending(), 1, 'play twice is one timer');
  s.advance(2000); assert.equal(c.state().t, T0 + 2 * M5);
  s.advance(600);                                              // 0.6 s into the third second
  assert.equal(c.pause().playing, false); assert.equal(s.pending(), 0);
  s.advance(60000); assert.equal(c.state().t, T0 + 2 * M5, 'paused: time does not move');
  assert.equal(c.resume().playing, true);
  s.advance(999); assert.equal(c.state().t, T0 + 2 * M5, 'resume starts a fresh second');
  s.advance(1); assert.equal(c.state().t, T0 + 3 * M5);
  // step: one candle, and the clock is left paused
  const st = c.step(); assert.equal(st.t, T0 + 4 * M5); assert.equal(st.playing, false); assert.equal(kinds.at(-1), 'step');
  s.advance(5000); assert.equal(c.state().t, T0 + 4 * M5);
  assert.equal(c.step(3).t, T0 + 7 * M5); assert.equal(c.state().steps, 7);
  assert.throws(() => c.step(0), (e) => e.code === 'BAD_STEP');
  // jump: anywhere inside the window, clamped to it; the next step lands on the next boundary
  assert.equal(c.jump(T0 + 100 * M5 + 17).t, T0 + 100 * M5 + 17); assert.equal(kinds.at(-1), 'jump'); assert.equal(ticks.at(-1), T0 + 100 * M5 + 17);
  assert.equal(c.step().t, T0 + 101 * M5);
  assert.equal(c.jump(T0 - 999).t, T0); assert.equal(c.jump(T0 + 5 * M5).t, T0 + 5 * M5);
  assert.throws(() => c.jump('x'), (e) => e.code === 'BAD_TIME');
  assert.equal(c.state().playing, false, 'a jump while paused stays paused');
  c.play(); s.advance(1000); assert.equal(c.state().t, T0 + 6 * M5);
  s.advance(500); assert.equal(c.jump(T0 + 50 * M5).playing, true, 'a jump while playing keeps playing');
  s.advance(999); assert.equal(c.state().t, T0 + 50 * M5); s.advance(1); assert.equal(c.state().t, T0 + 51 * M5);
  // setSpeed: only the five speeds; takes effect at once
  for (const bad of [0, 2, 7, 1000, '5', null]) assert.throws(() => c.setSpeed(bad), (e) => e.code === 'BAD_SPEED');
  assert.equal(c.setSpeed(10).speed, 10); s.advance(1000); assert.equal(c.state().t, T0 + 61 * M5);
  assert.equal(c.setSpeed(100).speed, 100); s.advance(500); assert.equal(c.state().t, T0 + 111 * M5);
  assert.equal(s.pending(), 1);
  c.pause(); assert.equal(c.setSpeed(5).playing, false); assert.equal(s.pending(), 0, 'changing the speed while paused does not start the clock');
  // restart: back to from, paused, counters cleared
  const r = c.restart(); assert.deepEqual(r, { t: T0, from: T0, to: T0 + 1000 * M5, stepSec: M5, speed: 5, playing: false, done: false, steps: 0 });
  assert.equal(kinds.at(-1), 'restart'); assert.equal(ticks.at(-1), T0);
  s.advance(5000); assert.equal(c.state().t, T0);
  c.play(); s.advance(1000); assert.equal(c.state().t, T0 + 5 * M5);
  assert.throws(() => MXR.clock({ from: T0, to: T0 - 1, stepSec: M5 }), (e) => e.code === 'BAD_RANGE');
  assert.throws(() => MXR.clock({ from: T0, to: T0 + 1, stepSec: M5, speed: 3 }), (e) => e.code === 'BAD_SPEED');
  assert.throws(() => MXR.clock({ from: T0, to: T0 + 1, stepSec: 'x' }), (e) => e.code === 'BAD_TF');
});

test('clock: it stops at to and never passes it', () => {
  for (const speed of MXR.SPEEDS) {
    const s = sched(), ticks = []; let doneAt = [];
    const to = T0 + 12 * M5, c = MXR.clock({ from: T0, to, stepSec: M5, speed, now: s.now, setTimer: s.setTimer, clearTimer: s.clearTimer, onTick: (t) => { ticks.push(t); assert.ok(t <= to); }, onDone: (t) => doneAt.push(t) });
    c.play(); s.advance(60000);
    assert.deepEqual(c.state(), { t: to, from: T0, to, stepSec: M5, speed, playing: false, done: true, steps: 12 });
    assert.equal(ticks.length, 12); assert.equal(ticks.at(-1), to); assert.deepEqual(doneAt, [to]); assert.equal(s.pending(), 0);
    assert.equal(c.play().playing, false, 'play at the end does nothing'); assert.equal(s.pending(), 0);
    assert.equal(c.step().t, to); assert.equal(c.jump(to + 9999).t, to); assert.equal(ticks.filter((t) => t > to).length, 0);
    assert.deepEqual(doneAt, [to], 'done is said once');
    c.jump(to - M5); c.step(); assert.deepEqual(doneAt, [to, to], 'and again after going back');
    assert.equal(c.restart().done, false);
  }
  // to off a boundary: the last step is the short one
  const s = sched(), ticks = [], c = MXR.clock({ from: T0, to: T0 + 2 * M5 + 100, stepSec: M5, speed: 100, now: s.now, setTimer: s.setTimer, clearTimer: s.clearTimer, onTick: (t) => ticks.push(t) });
  c.play(); s.advance(2000);
  assert.deepEqual(ticks, [T0 + M5, T0 + 2 * M5, T0 + 2 * M5 + 100]); assert.equal(c.state().done, true);
  // resuming a saved position: starts at t, restart goes back to from; from == to is simply done
  const r = MXR.clock({ from: T0, to: T0 + 10 * M5, stepSec: M5, t: T0 + 4 * M5 });
  assert.equal(r.state().t, T0 + 4 * M5); assert.equal(r.step().t, T0 + 5 * M5); assert.equal(r.restart().t, T0);
  assert.equal(MXR.clock({ from: T0, to: T0, stepSec: M5 }).play().done, true);
});

test('clock: a pause or a jump from inside onTick stops the batch at once; a stall is not caught up', () => {
  const s = sched(), stopAt = T0 + 3 * M5; let c; const ticks = [], batches = [];
  c = MXR.clock({ from: T0, to: T0 + 1000 * M5, stepSec: M5, speed: 100, now: s.now, setTimer: s.setTimer, clearTimer: s.clearTimer,
    onTick: (t) => { ticks.push(t); if (t === stopAt) c.pause(); }, onBatch: (t, n, kind) => batches.push([t, n, kind]) });
  c.play(); s.advance(5000);
  assert.equal(c.state().t, stopAt, 'a signal candle is never run past'); assert.equal(c.state().playing, false);
  assert.deepEqual(ticks, [T0 + M5, T0 + 2 * M5, stopAt]); assert.deepEqual(batches, [[stopAt, 3, 'play']]); assert.equal(s.pending(), 0);
  // a jump from inside a tick
  const s2 = sched(); let c2; const seen = [];
  c2 = MXR.clock({ from: T0, to: T0 + 1000 * M5, stepSec: M5, speed: 100, now: s2.now, setTimer: s2.setTimer, clearTimer: s2.clearTimer, onTick: (t, info) => { seen.push(t); if (t === T0 + 2 * M5 && info.kind === 'play') c2.jump(T0 + 500 * M5); } });
  c2.play(); s2.advance(50);
  assert.deepEqual(seen, [T0 + M5, T0 + 2 * M5, T0 + 500 * M5]); assert.equal(c2.state().playing, true); assert.equal(s2.pending(), 1);
  s2.advance(50); assert.equal(c2.state().t, T0 + 505 * M5);
  // an error in onTick pauses the clock instead of leaving a broken loop
  const s3 = sched(), c3 = MXR.clock({ from: T0, to: T0 + 10 * M5, stepSec: M5, now: s3.now, setTimer: s3.setTimer, clearTimer: s3.clearTimer, onTick: () => { throw new Error('boom'); } });
  c3.play(); assert.throws(() => s3.advance(1000), /boom/); assert.equal(c3.state().playing, false); assert.equal(s3.pending(), 0);
  // a tab asleep for a minute: at most a few candles, not sixty
  const s4 = sched(), c4 = MXR.clock({ from: T0, to: T0 + 1000 * M5, stepSec: M5, now: s4.now, setTimer: s4.setTimer, clearTimer: s4.clearTimer });
  c4.play(); s4.stall(60000); s4.advance(0);
  assert.ok(c4.state().steps >= 1 && c4.state().steps <= 4, `steps after a stall: ${c4.state().steps}`);
  // without an injected clearTimer a stale timer does nothing
  const s5 = sched(), c5 = MXR.clock({ from: T0, to: T0 + 1000 * M5, stepSec: M5, now: s5.now, setTimer: s5.setTimer });
  c5.play(); c5.pause(); c5.play(); assert.equal(s5.pending(), 2); s5.advance(1000); assert.equal(c5.state().t, T0 + M5);
});

// ---- the saved replay position ------------------------------------------------------------------------------------
test('session: save → restore round-trips', () => {
  const state = { id: 's-7', edge: 'mosha-bo', market: 'xau', tf: '15m', t: T0 + 40 * 900, from: T0, to: T0 + 400 * 900, speed: 10, balance: 100000,
    risk: { riskPct: 0.25, firm: 'ftmo2', maxOpen: 1 }, costs: { spread: 0.25, commission: 0 }, difficulty: 'normal', mode: 'exam', openDecisions: ['d-1', 'd-9'], savedAt: 1794000000 };
  const saved = MXR.session.save(state);
  assert.deepEqual(saved, { v: 1, kind: 'mxr-session', ...state });
  assert.deepEqual(Object.keys(saved), ['v', 'kind', 'id', 'edge', 'market', 'tf', 't', 'from', 'to', 'speed', 'balance', 'risk', 'costs', 'difficulty', 'mode', 'openDecisions', 'savedAt']);
  const json = JSON.stringify(saved);
  assert.deepEqual(MXR.session.restore(json), saved, 'from JSON text');
  assert.deepEqual(MXR.session.restore(JSON.parse(json)), saved, 'from the stored object');
  assert.deepEqual(MXR.session.save(MXR.session.restore(json)), saved, 'and again');
  assert.notEqual(saved.risk, state.risk, 'a copy, not a reference');
  // a restored position starts a clock where it stopped
  const r = MXR.session.restore(json), c = MXR.clock({ from: r.from, to: r.to, stepSec: r.tf, speed: r.speed, t: r.t });
  assert.equal(c.state().t, state.t); assert.equal(c.state().speed, 10);
  // defaults, the short name for the open decisions, repeated ids
  const min = MXR.session.save({ edge: 'gtl', market: 'xau', tf: '4h', t: T0, from: T0, to: T0 + D, open: [3, '3', 'a', null] });
  assert.deepEqual(min, { v: 1, kind: 'mxr-session', id: null, edge: 'gtl', market: 'xau', tf: '4h', t: T0, from: T0, to: T0 + D, speed: 1, balance: null, risk: null, costs: null, difficulty: null, mode: 'train', openDecisions: ['3', 'a'], savedAt: null });
  assert.deepEqual(MXR.session.restore(JSON.stringify(min)), min);
  // refusals
  const bad = (patch) => assert.throws(() => MXR.session.save({ ...state, ...patch }), (e) => e.code === 'BAD_SESSION');
  bad({ tf: '2h' }); bad({ t: T0 - 1 }); bad({ t: state.to + 1 }); bad({ speed: 3 }); bad({ edge: '' }); bad({ market: null }); bad({ balance: 'lots' }); bad({ openDecisions: 'd-1' }); bad({ from: NaN });
  for (const x of ['{', '{}', 'null', JSON.stringify({ ...saved, v: 2 }), JSON.stringify({ ...saved, kind: 'other' })]) assert.throws(() => MXR.session.restore(x), (e) => e.code === 'BAD_SESSION');
});

// ---- the file itself ----------------------------------------------------------------------------------------------
test('the same file works as a plain browser script (window.MXR) and holds no network or page code of its own', () => {
  const src = fs.readFileSync(new URL('../assets/academy-replay.js', import.meta.url), 'utf8');
  const win = {}; vm.runInNewContext(src, win);
  assert.equal(typeof win.MXR, 'object');
  assert.deepEqual(Object.keys(win.MXR).sort(), Object.keys(MXR).sort());
  for (const k of ['TF', 'load', 'closedAt', 'aggregate', 'formingAt', 'snapshot', 'hash', 'clock', 'session', 'guard']) assert.ok(k in win.MXR, k);
  for (const k of ['play', 'pause', 'resume', 'step', 'jump', 'setSpeed', 'restart', 'state']) assert.equal(typeof win.MXR.clock({ from: 1, to: 2, stepSec: 60 })[k], 'function', k);
  assert.equal(win.MXR.closedAt([{ time: 60, open: 1, high: 1, low: 1, close: 1 }], 60, 120).length, 1);
  assert.ok(!/\b(require|import)\s*\(/.test(src), 'no dependency');
  assert.ok(!/document\.|localStorage|XMLHttpRequest/.test(src), 'no page code');
});
