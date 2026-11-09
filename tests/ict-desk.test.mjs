// ICT desk (market-structure.html, script#ms-ict-lib): the helpers behind the #ict view, run without a page.
// New York time everywhere, floating R that never reads a missing price as a loss, the 36-candle time exit, edge statistics.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
const src = html.match(/<script id="ms-ict-lib">([\s\S]*?)<\/script>/)[1];
const W = {};
vm.runInNewContext(src, { window: W, Intl, Date, Object, Math, Array, String, isFinite });
const I = W.MS_ICT;
const T = (iso) => Date.parse(iso) / 1000;

test('nyDay: the P&L calendar day is the New York date, not UTC or the browser zone', () => {
  assert.equal(I.nyDay(T('2026-11-06T21:30:00Z')), '2026-11-06');   // Fri 16:30 ET
  assert.equal(I.nyDay(T('2026-11-07T03:00:00Z')), '2026-11-06');   // Fri 22:00 ET: still Friday in New York (Saturday in UTC and Asia)
  assert.equal(I.nyDay(T('2026-07-01T03:59:00Z')), '2026-06-30');   // EDT (UTC-4)
  assert.equal(I.nyDay(T('2026-07-01T04:00:00Z')), '2026-07-01');
});

test('nyTime: signal times read in New York', () => {
  assert.equal(I.nyTime(1794186000, true), 'Sun 8 Nov 20:00');      // es-b-1794182400: 01:00 UTC on 9 Nov is Sunday 20:00 ET
  assert.equal(I.nyTime(T('2026-07-06T13:30:00Z')), '6 Jul 09:30');
  assert.equal(I.nyTime(null), '—');
});

test('openHour: CME hours (weekly close Fri 17:00 - Sun 18:00 ET, daily halt 17:00-18:00)', () => {
  const at = (iso) => I.openHour(T(iso));
  assert.equal(at('2026-11-06T21:00:00Z'), true);    // Fri 16:00 ET
  assert.equal(at('2026-11-06T22:00:00Z'), false);   // Fri 17:00 ET
  assert.equal(at('2026-11-07T15:00:00Z'), false);   // Saturday
  assert.equal(at('2026-11-08T22:00:00Z'), false);   // Sun 17:00 ET
  assert.equal(at('2026-11-08T23:00:00Z'), true);    // Sun 18:00 ET: the reopen
  assert.equal(at('2026-11-09T22:00:00Z'), false);   // Mon 17:00 ET halt
  assert.equal(at('2026-11-09T23:00:00Z'), true);
  assert.equal(at('2026-07-06T21:00:00Z'), false);   // Mon 17:00 EDT halt (UTC-4)
});

test('liveR: no usable price, entry or risk -> null (a missing snapshot price used to read as a huge loss or NaN)', () => {
  const x = { status: 'open', side: 'buy', entry: 7423.25, r0: 60, size: 1.5 };
  assert.equal(I.liveR(x, null), null);
  assert.equal(I.liveR(x, undefined), null);
  assert.equal(I.liveR(x, NaN), null);
  assert.equal(I.liveR({ ...x, r0: 0 }, 7500), null);
  assert.equal(I.liveR({ ...x, entry: null }, 7500), null);
  assert.equal(I.liveR({ ...x, status: 'win' }, 7500), null);
  assert.equal(I.liveR(x, 7483.25), 1);
  assert.equal(I.liveR({ ...x, side: 'sell' }, 7483.25), -1);
});

test('liveRs: floating R is booked x size like the closed records (R stored x size, skill §25 / §27)', () => {
  const x = { status: 'open', side: 'buy', entry: 100, r0: 10, size: 1.5 };
  assert.equal(I.liveRs(x, 120), 3);                   // +2R per unit at 1.5x
  assert.equal(I.liveRs({ ...x, size: 0.5 }, 90), -0.5);
  assert.equal(I.liveRs({ ...x, size: undefined }, 110), 1);
  assert.equal(I.liveRs(x, null), null);
});

test('holdLeft: the 36th closed H1 candle, weekends and the daily halt not counted', () => {
  // es-s-1793995200 (council-data ict/trades.json, 9 Nov 01:15 UTC): signal Fri 6 Nov 16:00 ET; the tracker holds 3 closed candles
  const h1 = [[1793998800, 0, 0, 0, 0], [1794178800, 0, 0, 0, 0], [1794182400, 0, 0, 0, 0]];
  const x = { signalAt: 1793998800 }, now = T('2026-11-09T01:15:09Z');
  const r = I.holdLeft(x, h1, now);
  assert.equal(r.held, 3); assert.equal(r.left, 33);
  // 21 candles Sun 20:00 - Mon 17:00 ET (24 held), halt, then 12 more from Mon 18:00: the 36th closes Tue 06:00 ET = 11:00 UTC
  assert.equal(r.endAt, T('2026-11-10T11:00:00Z'));
  // without the tracker's candles the CME clock alone gives the same count
  assert.deepEqual({ ...I.holdLeft(x, [], now) }, { ...r });
  // the feed behind the clock: the hour the tracker has not stored yet still counts once it has closed
  assert.equal(I.holdLeft(x, h1.slice(0, 2), now).held, 3);
  // done
  assert.deepEqual({ ...I.holdLeft(x, h1, T('2026-11-10T11:00:00Z')) }, { held: 36, left: 0, endAt: null });
  assert.equal(I.holdLeft({}, h1, now), null);
});

test('stats: win rate, expectancy, profit factor and max drawdown in close order', () => {
  const L = [{ R: 1, closed: 1 }, { R: -1, closed: 2 }, { R: 2, closed: 3 }, { R: -0.5, closed: 4 }, { R: null, closed: 5 }];
  const s = I.stats(L);
  assert.equal(s.n, 4); assert.equal(s.w, 2); assert.equal(s.l, 2); assert.equal(s.wr, 0.5);
  assert.equal(s.tot, 1.5); assert.equal(s.exp, 0.375); assert.equal(s.avgW, 1.5); assert.equal(s.avgL, -0.75);
  assert.equal(s.pf, 2); assert.equal(s.dd, 1);
  // drawdown follows the close time, not the array order
  assert.equal(I.stats([{ R: -1, closed: 4 }, { R: 3, closed: 1 }, { R: -2, closed: 2 }]).dd, 3);
  const z = I.stats([]); assert.equal(z.n, 0); assert.equal(z.exp, null); assert.equal(z.pf, null);
  assert.equal(I.stats([{ R: 1, closed: 1 }]).pf, Infinity);
});

test('groupBy: grades best first, sessions in the order of the day, missing keys as n/a', () => {
  const L = [{ R: 1, g: 'B+' }, { R: 1, g: 'A+' }, { R: -1, g: 'C' }, { R: 1, g: 'B+' }, { R: 1 }];
  assert.deepEqual(I.groupBy(L, (x) => x.g, 'grade').map((r) => r.k), ['A+', 'B+', 'C', 'n/a']);
  assert.deepEqual(I.groupBy([{ s: 'NY PM' }, { s: 'Asia' }, { s: 'London' }], (x) => x.s, 'session').map((r) => r.k), ['Asia', 'London', 'NY PM']);
  const g = I.groupBy(L, (x) => x.g, 'grade').find((r) => r.k === 'B+'); assert.equal(g.s.n, 2); assert.equal(g.s.tot, 2);
});

test('norm: partial records render (no grade, no feat, no short); unusable ones are dropped', () => {
  const y = I.norm({ id: 'nq-b-1', market: 'nq', side: 'buy', signalAt: 100, entry: 1, stop: 0, r0: 1, status: 'open' });
  assert.equal(y.short, 'NQ'); assert.deepEqual({ ...y.feat }, {}); assert.deepEqual({ ...y.grade }, {}); assert.equal(y.label, 'NQ');
  assert.equal(I.norm({ id: 'x', market: 'nq', side: 'long', signalAt: 1 }), null);
  assert.equal(I.norm({ market: 'nq', side: 'buy', signalAt: 1 }), null);
  assert.equal(I.norm({ id: 'x', market: 'nq', side: 'buy', opened: 5 }).signalAt, 5);
  assert.equal(I.norm(null), null);
});

test('the desk reads every record through norm and New York days / times', () => {
  const desk = html.slice(html.indexOf('// ─── ICT desk (owner, 6 Nov 2026)'), html.indexOf('<style id="ms-trv-css">'));
  assert.match(desk, /\.map\(ICT\.norm\)\.filter\(KEEP\)/);
  assert.match(desk, /const dkey = \(t\) => ICT\.nyDay\(t\)/);
  assert.match(desk, /const tm = \(t\) => ICT\.nyTime\(t\)/);
  assert.doesNotMatch(desk, /\(m\.price - x\.entry\)/, 'floating R goes through ICT.liveR');
});
