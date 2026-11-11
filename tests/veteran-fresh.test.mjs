// node --test tests/veteran-fresh.test.mjs — the veteran's prices are as fresh as the strategist's run (11 Nov 2026).
// The veteran fetches nothing and read its closes only from the weekly candle cache (research/daily, refreshed on Saturdays),
// so mid-week its last close, levels and ranges were the Friday before. Now the strategist hands its run's COMPLETE daily
// candles over in macro/cache.json `daily` (council/macro.mjs handDaily) and the veteran appends them to the cache
// (council/veteran.mjs extendDaily). Pinned here: only complete days, never another feed, never a gap; a short cache plus the
// hand-over is indistinguishable from a refreshed cache for every scored record; the desk says "as of <date> close", says
// "Stale" in words when the close is old, and never offers a level price has already crossed without saying it broke.
// Offline: synthetic candles, temporary folders.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as V from '../council/veteran.mjs';
import * as M from '../council/macro.mjs';
import * as G from '../council/glance.mjs';
import { nearestLevel } from '../council/briefing.mjs';
import { resolveCall, callsLedger } from '../council/outlook.mjs';

const DAY = 86400, T = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi) / 1000, iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const NOW = T(2026, 11, 11, 12);   // Wed 11 Nov 2026 12:00 UTC: Mon 9 and Tue 10 are complete, Wed 11 is forming
const wk = (t) => { const d = new Date(t * 1000).getUTCDay(); return d !== 0 && d !== 6; };
// weekday candles ending on `last` (a day start), newest value f(0)
const bars = (n, last, f) => { const out = []; let i = 0; for (let t = last; out.length < n; t -= DAY) { if (!wk(t)) continue; const c = +f(i).toFixed(2); out.unshift({ t, o: c - 3, h: c + 9, l: c - 11, c }); i++; } return out; };
const TUE = T(2026, 11, 10), FRI = T(2026, 11, 6);
const GOLD = bars(3000, TUE, (i) => 4000 * Math.exp(-i * 0.0003) * (1 + 0.004 * Math.sin(i / 7)));     // every closed day up to Tuesday
const FX = { eurusd: 1.1, usdjpy: 150, gbpusd: 1.27, usdcad: 1.36, usdchf: 0.88 };
const PAIR = (k) => bars(400, TUE, (i) => FX[k] * (1 + 0.0004 * i) * 100).map((b) => ({ ...b, o: b.o / 100, h: b.h / 100, l: b.l / 100, c: b.c / 100 }));
const rowsOf = (B, to) => B.filter((b) => b.t <= to).map((b) => [b.t, b.o, b.h, b.l, b.c, 1]);
const handOf = (B, n = 30) => B.slice(-n).map((b) => [b.t, b.o, b.h, b.l, b.c]);
const series = (n, f) => { const out = []; let i = 0; for (let t = Math.floor(NOW / DAY) * DAY - DAY; out.length < n; t -= DAY) { if (!wk(t)) continue; out.unshift([iso(t), +f(i).toFixed(4)]); i++; } return out; };
const cache = () => ({ fred: { DFII10: series(60, (i) => 2.6 + i * 0.016), DGS2: series(60, (i) => 4.46 + i * 0.016), DGS10: series(60, () => 4.84), T10YIE: series(60, () => 2.23), T10Y3M: series(60, () => 0.67), BAMLH0A0HYM2: series(60, () => 3.3), VIXCLS: series(60, () => 22), VXVCLS: series(60, () => 25.5), DTWEXBGS: series(60, () => 120), SOFR: series(60, () => 3.9), EFFR: series(60, () => 3.86) },
  cot: Array.from({ length: 30 }, (_, i) => ({ t: NOW - (30 - i) * 7 * DAY - 5 * DAY, net: 100000 + i * 1000 })) });
const forecast = (o = {}) => ({ at: new Date((NOW - 600) * 1000).toISOString(), assets: { gold: { pUp: 0.54, fit: { base: 0.536 }, drivers: [], last: GOLD.at(-1).c } }, sources: { 'bars:gold': 'OANDA ok (1400 days)' },
  regime: { label: 'Dollar Smile middle' }, drivers: [{ k: 'ry', vote: -1, detail: '10Y TIPS 2.60%, falling' }], playbook: [],
  goldScore: { ok: true, asOf: '2026-11-06', score: 0.13, z: { ry4w: 1.43, dxy4w: -0.03 }, bias: 'AUCTION', conviction: null, label: 'AUCTION (no macro edge)', weeks: 1067 }, ...o });
// a council-data folder: the candle cache ending on `cacheTo`, and (hand) the strategist's hand-over in macro/cache.json
function folder({ cacheTo = FRI, hand = true, fc = forecast(), calls = null, ledger = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vetfresh-')); fs.mkdirSync(path.join(dir, 'macro')); fs.mkdirSync(path.join(dir, 'research', 'daily'), { recursive: true });
  const C = cache(); if (hand) C.daily = { src: 'test', days: { xau: handOf(GOLD), ...Object.fromEntries(Object.keys(FX).map((k) => [k, handOf(PAIR(k))])) } };
  fs.writeFileSync(path.join(dir, 'macro', 'forecast.json'), JSON.stringify(fc)); fs.writeFileSync(path.join(dir, 'macro', 'cache.json'), JSON.stringify(C));
  fs.writeFileSync(path.join(dir, 'research', 'daily', 'xau.json'), JSON.stringify({ rows: rowsOf(GOLD, cacheTo) }));
  for (const k of Object.keys(FX)) fs.writeFileSync(path.join(dir, 'research', 'daily', `${k}.json`), JSON.stringify({ rows: rowsOf(PAIR(k), cacheTo) }));
  if (calls) fs.writeFileSync(path.join(dir, 'macro', 'veteran-calls.json'), JSON.stringify(calls));
  if (ledger) fs.writeFileSync(path.join(dir, 'macro', 'veteran-ledger.json'), JSON.stringify(ledger));
  return dir;
}
const rd = (dir, f) => JSON.parse(fs.readFileSync(path.join(dir, 'macro', f), 'utf8'));

test('strategist hand-over: the run\'s complete daily candles only, OANDA only, the last good days kept when a fetch fails', () => {
  const day = (t, c, live) => ({ time: t, open: c * 0.5, high: c * 2, low: c * 0.25, close: c, ...(live ? { live: true } : {}) });
  const data = { bars: { gold: [day(FRI, 4070.59), day(T(2026, 11, 8), 4055.69), day(T(2026, 11, 9), 4138.9), day(TUE, 4039.03), day(T(2026, 11, 11), 3987.7, true)],
    eurusd: [day(TUE, 1.1), day(T(2026, 11, 11), 1.09)],                                 // the forming day carries no `live` flag here: the clock still leaves it out
    usdjpy: [day(TUE, 150)], nq: Array.from({ length: 50 }, (_, i) => day(TUE - (49 - i) * DAY, 25000 + i)) } };
  const src = { 'bars:gold': 'OANDA ok (5 days)', 'bars:eurusd': 'OANDA ok (2 days)', 'bars:usdjpy': 'OANDA failed (timeout), Kraken ok (720 days)', 'bars:nq': 'OANDA ok (50 days)', 'bars:es': 'failed (timeout)' };
  const prev = { days: { usdjpy: [[FRI, 1, 1, 1, 149.5]], spx500: [[FRI, 1, 1, 1, 7000]], gbpusd: [[FRI, 1, 1, 1, 1.27]] } };
  const h = M.handDaily(data, src, NOW, prev);
  assert.deepEqual(h.days.xau.map((r) => iso(r[0])), ['2026-11-06', '2026-11-08', '2026-11-09', '2026-11-10'], 'the forming candle of 11 Nov is never handed over');
  assert.deepEqual(h.days.xau.at(-1), [TUE, 4039.03 * 0.5, 4039.03 * 2, 4039.03 * 0.25, 4039.03], '[dayStart, o, h, l, c]');
  assert.deepEqual(h.days.eurusd.map((r) => iso(r[0])), ['2026-11-10'], 'a day that has not ended at `now` is left out even without the live flag');
  assert.deepEqual(h.days.usdjpy, prev.days.usdjpy, 'a Kraken fallback has another price basis: the last good OANDA days stay');
  assert.deepEqual(h.days.spx500, prev.days.spx500, 'a failed fetch keeps the closed days of the last good run');
  assert.deepEqual(h.days.gbpusd, prev.days.gbpusd); assert.equal(h.days.usdcad, undefined);
  assert.equal(h.days.nas100.length, M.HAND_DAYS, 'capped'); assert.equal(h.days.nas100.at(-1)[0], TUE);
  assert.equal(JSON.stringify(h).includes('"at"'), false, 'no timestamp: cache.json only changes with new data');
  assert.equal(M.handDaily({ bars: {} }, {}, NOW, null), null);
  assert.deepEqual(Object.values(M.HAND_KEYS).sort(), ['eurusd', 'gbpusd', 'nas100', 'spx500', 'usdcad', 'usdchf', 'usdjpy', 'xau'], 'handed under the candle cache\'s own keys');
});

test('extendDaily: appended after the cache\'s last day only when the days join up, agree on that day and have ended', () => {
  const json = { rows: rowsOf(GOLD, FRI) }, hand = handOf(GOLD);
  const e = V.extendDaily(json, hand, NOW);
  assert.equal(e.cacheTo, '2026-11-06'); assert.equal(e.to, '2026-11-10'); assert.equal(e.added, 2); assert.equal(e.why, null);
  assert.deepEqual(e.json.rows.slice(-2).map((r) => r.slice(0, 5)), GOLD.slice(-2).map((b) => [b.t, b.o, b.h, b.l, b.c]));
  assert.deepEqual(e.json.rows.slice(0, json.rows.length), json.rows, 'the cache\'s own rows are untouched'); assert.equal(json.rows.length, rowsOf(GOLD, FRI).length, 'and the input is not mutated');
  // a forming day (it ends after now) is never appended, whoever handed it over
  const forming = [...hand, [T(2026, 11, 11), 1, 2, 0.5, 9999]];
  assert.equal(V.extendDaily(json, forming, NOW).to, '2026-11-10'); assert.equal(V.extendDaily(json, forming, T(2026, 11, 12)).to, '2026-11-11', 'once the day has ended it counts');
  assert.equal(V.extendDaily(json, hand, T(2026, 11, 10, 12)).to, '2026-11-09', 'cut at the veteran\'s own clock');
  // a gap between the cache and the handed days: not appended (the ledger counts rows), and it says why
  const gap = V.extendDaily(json, hand.filter((r) => r[0] > FRI), NOW); assert.equal(gap.added, 0); assert.equal(gap.json, json); assert.match(gap.why, /do not reach back/);
  // another feed (the overlap day's close differs): not appended
  const other = V.extendDaily(json, hand.map((r) => [r[0], r[1], r[2], r[3], r[4] * 1.002]), NOW); assert.equal(other.added, 0); assert.match(other.why, /another feed/);
  assert.match(V.extendDaily(json, null, NOW).why, /handed over no closed days/); assert.match(V.extendDaily(null, hand, NOW).why, /no candle cache/);
  // a cache that is already up to date (Saturday's refresh): nothing to add, no complaint
  const full = V.extendDaily({ rows: rowsOf(GOLD, TUE) }, hand, NOW); assert.equal(full.added, 0); assert.equal(full.why, null); assert.equal(full.to, '2026-11-10');
});

test('run: mid-week the veteran\'s last close, levels and calls come from yesterday\'s close, not from last Friday\'s', () => {
  const stale = V.run({ dir: folder({ hand: false }), now: NOW, log: () => {} }), fresh = V.run({ dir: folder(), now: NOW, log: () => {} });
  const gs = stale.briefing.levels.gold, gf = fresh.briefing.levels.gold;
  assert.equal(gs.asOf, '2026-11-06'); assert.equal(gs.px, GOLD.find((b) => b.t === FRI).c);
  assert.equal(gf.asOf, '2026-11-10'); assert.equal(gf.px, GOLD.at(-1).c, 'the last COMPLETE candle');
  assert.equal(fresh.summary.levels.asOf, '2026-11-10'); assert.equal(fresh.briefing.levels.dxy.asOf, '2026-11-10', 'the dollar index too');
  assert.match(fresh.outlook.week.list[0].claim, /^Gold closes 2026-11-17 above /); assert.equal(fresh.outlook.week.list[0].level, GOLD.at(-1).c);
  assert.match(stale.outlook.week.list[0].claim, /^Gold closes 2026-11-13 above /);
  assert.equal(fresh.closes.markets.xau.added, 2); assert.equal(fresh.closes.markets.xau.to, '2026-11-10'); assert.match(stale.closes.markets.xau.why, /handed over no closed days/);
  // honesty in words
  assert.deepEqual(gf.fresh, { asOf: '2026-11-10', sessions: 0, stale: false, text: 'as of 2026-11-10 close' });
  assert.deepEqual(gs.fresh, { asOf: '2026-11-06', sessions: 2, stale: true, text: 'Stale: last close 2026-11-06, 2 trading days ago' });
  assert.match(fresh.summary.sentence, /\(levels as of the 10 Nov close\)\.$/); assert.match(stale.summary.sentence, /Levels are stale: last close 6 Nov, 2 trading days ago\.$/);
  assert.equal(fresh.source.includes('fetches nothing'), true);
});

test('scored records: a short cache plus the hand-over is the same as a refreshed cache, and no past record changes', () => {
  // records on file from earlier weeks: dated calls (some due, some open) and the weekly ledger forecast
  const lvl = GOLD.find((b) => b.t === T(2026, 10, 30)).c;
  const calls0 = [
    { id: `gold:closeAbove:${lvl}:2026-11-06`, issued: '2026-10-30', claim: 'due before the cache ends', p: 0.55, asset: 'gold', kind: 'closeAbove', level: lvl, lo: null, hi: null, pct: null, by: '2026-11-06', src: 'base rate + council tilt' },
    { id: `gold:closeAbove:${lvl}:2026-11-09`, issued: '2026-11-02', claim: 'due Monday', p: 0.55, asset: 'gold', kind: 'closeAbove', level: lvl, lo: null, hi: null, pct: null, by: '2026-11-09', src: 'base rate + council tilt' },
    { id: 'gold:touchUp:4012:2026-11-09', issued: '2026-11-03', claim: 'due Monday', p: 0.4, asset: 'gold', kind: 'touchUp', level: 4012, lo: null, hi: null, pct: null, by: '2026-11-09', src: 'base rate + council tilt' },
    { id: 'gold:range:3950:2026-11-09', issued: '2026-11-03', claim: 'due Monday', p: 0.6, asset: 'gold', kind: 'range', level: null, lo: 3950, hi: 4040, pct: null, by: '2026-11-09', src: 'base rate + council tilt' },
    { id: 'hyp:2026-10-31:H2', issued: '2026-11-02', claim: 'stay inside', p: 0.5, asset: 'gold', kind: 'stayInside', level: null, lo: 3900, hi: 4100, pct: null, by: '2026-11-09', src: 'veteran hypothesis' },
    { id: 'gold:closeAbove:4000:2026-11-20', issued: '2026-11-03', claim: 'still open', p: 0.5, asset: 'gold', kind: 'closeAbove', level: 4000, lo: null, hi: null, pct: null, by: '2026-11-20', src: 'base rate + council tilt' },
    { id: 'dxy:closeAbove:101:2026-11-09', issued: '2026-11-03', claim: 'dollar, due Monday', p: 0.5, asset: 'dxy', kind: 'closeAbove', level: 101, lo: null, hi: null, pct: null, by: '2026-11-09', src: 'base rate + council tilt' },
  ];
  const anchor = GOLD[GOLD.length - 1 - 20];   // a forecast whose 20th row is Tuesday's close: it resolves only once that close is on file
  const led0 = JSON.parse(JSON.stringify(V.ledgerIssue([], { now: anchor.t + DAY + 3600, gold: GOLD.filter((b) => b.t <= anchor.t).map((b) => ({ t: b.t, v: b.c })), verdict: { bias: 'AUCTION', conviction: null }, base: { upRate: 0.56 }, gs: { ok: true, score: 0.1, weeks: 1000 }, card: {} }).ledger));
  assert.equal(led0.length, 1); assert.equal(led0[0].anchor.t, anchor.t);
  const A = folder({ cacheTo: TUE, hand: false, calls: calls0, ledger: led0 });   // what Saturday's refresh would give
  const B = folder({ cacheTo: FRI, hand: true, calls: calls0, ledger: led0 });    // mid-week: Friday's cache + the strategist's closed days
  const C = folder({ cacheTo: FRI, hand: false, calls: calls0, ledger: led0 });   // mid-week before this change
  const vA = V.run({ dir: A, now: NOW, log: () => {} }), vB = V.run({ dir: B, now: NOW, log: () => {} }); V.run({ dir: C, now: NOW, log: () => {} });
  for (const f of ['veteran-calls.json', 'veteran-ledger.json', 'veteran-debates.json', 'veteran-expectations.json', 'veteran-briefings.json']) assert.deepEqual(rd(B, f), rd(A, f), `${f}: identical to a refreshed cache`);
  const strip = (v) => { const x = JSON.parse(JSON.stringify(v)); delete x.closes; return x; };
  assert.deepEqual(strip(vB), strip(vA), 'veteran.json too: levels, calls, hypotheses, analogs, calibration');
  // every record that was on file keeps what was recorded; it only gains its result
  const cB = rd(B, 'veteran-calls.json'), cC = rd(C, 'veteran-calls.json'), by = (L) => new Map(L.map((r) => [r.id, r]));
  for (const r0 of calls0) { const r = by(cB).get(r0.id); for (const k of Object.keys(r0)) assert.deepEqual(r[k], r0[k], `${r0.id} ${k} unchanged`); }
  // and each result is the one the closes give: computed here straight from the candles
  const S = (from, to) => GOLD.filter((b) => b.t > T(...from) + DAY - 1 && b.t <= T(...to)).map((b) => b.c), m = by(cB);
  assert.equal(m.get(calls0[0].id).hit, S([2026, 10, 30], [2026, 11, 6]).at(-1) > lvl);
  assert.equal(m.get(calls0[1].id).hit, S([2026, 11, 2], [2026, 11, 9]).at(-1) > lvl);
  assert.equal(m.get(calls0[2].id).hit, S([2026, 11, 3], [2026, 11, 9]).some((c) => c >= 4012));
  assert.equal(m.get(calls0[3].id).hit, (() => { const c = S([2026, 11, 3], [2026, 11, 9]).at(-1); return c >= 3950 && c <= 4040; })());
  assert.equal(m.get(calls0[4].id).hit, S([2026, 11, 2], [2026, 11, 9]).every((c) => c >= 3900 && c <= 4100));
  assert.equal(m.get(calls0[5].id).hit, undefined, 'a call that is not due stays open');
  assert.equal(typeof m.get(calls0[6].id).hit, 'boolean');
  // the stale cache: the record due before its end is scored the same; the ones due after it WAIT (they are not scored on Friday's close)
  assert.equal(by(cC).get(calls0[0].id).hit, m.get(calls0[0].id).hit);
  for (const i of [1, 2, 3, 4, 6]) assert.equal(by(cC).get(calls0[i].id).hit, undefined, `${calls0[i].id} waits for its close`);
  // the weekly ledger: resolved on the 20th row after its anchor, the same row either way; the issued record is never edited
  const lB = rd(B, 'veteran-ledger.json'), res = lB.find((r) => r.record_type === 'resolved' && r.forecast_id === led0[0].forecast_id);
  assert.deepEqual(lB.find((r) => r.record_id === led0[0].record_id), led0[0]); assert.equal(res.resolution.realized_value, GOLD.at(-1).c); assert.equal(res.resolution.resolved_at_utc.slice(0, 10), '2026-11-10');
  assert.equal(rd(C, 'veteran-ledger.json').some((r) => r.record_type === 'resolved'), false);
});

test('resolveCall: a call is scored only once the closes on file reach its date; on complete closes the result is as before', () => {
  const MON = T(2026, 11, 9), cl = GOLD.map((b) => ({ t: b.t, v: b.c })), lvl = cl.find((o) => o.t === FRI).v - 1, c = { issued: '2026-11-02', by: '2026-11-09', kind: 'closeAbove', level: lvl };
  assert.equal(resolveCall(c, cl, NOW), cl.find((o) => o.t === MON).v > lvl, 'on the close of its date');
  assert.equal(resolveCall(c, cl.filter((o) => o.t <= FRI), NOW), null, 'the file ends on Friday: wait (it used to be scored on Friday\'s close: true here)');
  assert.equal(cl.find((o) => o.t === FRI).v > lvl, true);
  assert.equal(resolveCall(c, cl.filter((o) => o.t !== MON), NOW), true, 'a date with no candle (a holiday) inside a file that goes on: the last close up to the date, as before');
  assert.equal(resolveCall(c, cl, T(2026, 11, 10, 20)), null, 'never before the day after the date has ended (unchanged)');
  const L = callsLedger([{ id: 'x', hit: null, p: 0.5, asset: 'gold', ...c }], { outlook: null, closesBy: { gold: cl.filter((o) => o.t <= FRI) }, now: NOW }); assert.equal(L[0].hit, null);
});

test('closeAge: complete weekday sessions since the close, on the data check\'s holiday calendar; in words when stale', () => {
  assert.equal(G.closeAge('2026-11-10', NOW).sessions, 0); assert.equal(G.closeAge('2026-11-10', NOW).text, 'as of 2026-11-10 close');
  assert.equal(G.closeAge('2026-11-09', NOW).text, 'Stale: last close 2026-11-09, 1 trading day ago');
  assert.equal(G.closeAge('2026-11-06', NOW).sessions, 2);
  assert.equal(G.closeAge('2026-11-06', T(2026, 11, 7, 12)).stale, false, 'Saturday: Friday\'s close is the latest there is');
  assert.equal(G.closeAge('2026-11-06', T(2026, 11, 9, 23)).stale, false, 'Monday, still forming');
  assert.equal(G.closeAge('2026-11-06', T(2026, 11, 10, 0)).sessions, 1, 'Monday has ended');
  assert.equal(G.closeAge('2026-11-08', T(2026, 11, 9, 12)).stale, false, 'the Sunday-evening candle as the last close');
  assert.equal(G.closeAge('2026-04-02', T(2026, 4, 6, 12)).sessions, 0, 'Good Friday (3 Apr 2026) is shut all day: not a missed session');
  assert.equal(G.closeAge('2026-12-24', T(2026, 12, 28, 12)).sessions, 0, 'Christmas Day');
  assert.equal(G.closeAge('2026-11-25', T(2026, 11, 27, 12)).sessions, 1, 'Thanksgiving is an early close, a session all the same');
  assert.equal(G.closeAge(null, NOW), null); assert.equal(G.closeAge('n/a', NOW), null);
});

const lv = (px, list, asOf = '2026-11-10') => ({ px, asOf, unit: '$', dp: 0, list: list.map(([price, label, kind]) => ({ price, label, kind, dist: +((price / px - 1) * 100).toFixed(2), side: price >= px ? 'above' : 'below' })).sort((a, b) => b.price - a.price) });
const LIST = [[4146.9, "Last week's high", 'week'], [4100, 'Round number', 'round'], [4082.8, 'Swing high 2026-10-28', 'swing'], [4045.4, '20-day average', 'sma'], [4019.2, 'Swing low 2026-08-03', 'swing'], [4000, 'Round number', 'round'], [3960, 'Analog median', 'analog'], [3891.3, "Last week's low", 'week']];
const vetOf = (g) => ({ at: '2026-11-11T12:00:00.000Z', briefing: { levels: { gold: g }, insights: [], hypotheses: [] }, channels: [], verdict: {} });

test('levels to watch: a level price has already crossed is said to be broken, and the next one is offered', () => {
  // the 11 Nov case: levels from the 6 Nov close (4,070.59), price at 3,987: "watch 4,045 below" was already behind it
  const g = G.markLevels(lv(4070.59, LIST, '2026-11-06'), { now: NOW, mark: { px: 3987.36, at: '2026-11-11T11:50:00.000Z' } });
  assert.deepEqual(g.list.filter((l) => l.crossed).map((l) => l.price), [4045.4, 4019.2, 4000], 'every level between the close and the price');
  assert.deepEqual(g.mark, { px: 3987.36, at: '2026-11-11T11:50:00.000Z', dist: -2.04 });
  const w = G.watchLevels(vetOf(g));
  assert.equal(w.below.price, 3891.3, 'the next level under the PRICE (a derived level is never offered)'); assert.equal(w.below.crossed, undefined); assert.equal(w.below.distNow, -2.41);
  assert.equal(w.above.price, 4019.2); assert.equal(w.above.crossed, true, 'the nearest level above the price is one it fell through: said so'); assert.equal(w.above.distNow, 0.8);
  assert.deepEqual(w.broken, { price: 4045.4, label: '20-day average', side: 'below' }, 'the level that was the one to watch below at the close');
  const s = G.summary(vetOf(g)).sentence;
  assert.match(s, /Gold has traded below \$4,045 \(20-day average\) since the 6 Nov close and is near \$3,987\. Watch \$4,019 above \(broken since the close\) and \$3,891 below\. Levels are stale: last close 6 Nov, 2 trading days ago\.$/);
  assert.equal(/Watch \$4,100 above and \$4,045 below/.test(s), false, 'never again a level "below" that price is already under');
  // upward too
  const u = G.markLevels(lv(4070.59, LIST), { now: NOW, mark: { px: 4110, at: '2026-11-11T11:50:00.000Z' } }), wu = G.watchLevels(vetOf(u));
  assert.deepEqual(u.list.filter((l) => l.crossed).map((l) => l.price), [4100, 4082.8]); assert.equal(wu.above.price, 4146.9); assert.equal(wu.below.price, 4082.8); assert.equal(wu.below.crossed, true); assert.equal(wu.broken.price, 4100); assert.equal(wu.broken.side, 'above');
  assert.match(G.summary(vetOf(u)).sentence, /Gold has traded above \$4,100 \(round number\) since the 10 Nov close and is near \$4,110\. Watch \$4,147 above and \$4,083 below \(broken since the close\) \(levels as of the 10 Nov close\)\.$/);
  // price has moved but crossed nothing: the same two levels, measured from the price, nothing called broken
  const q = G.markLevels(lv(4070.59, LIST), { now: NOW, mark: { px: 4075, at: '2026-11-11T11:50:00.000Z' } }), wq = G.watchLevels(vetOf(q));
  assert.equal(q.list.some((l) => l.crossed), false); assert.equal(wq.broken, null); assert.equal(wq.above.price, 4100); assert.equal(wq.below.price, 4045.4);
  assert.match(G.summary(vetOf(q)).sentence, /Watch \$4,100 above and \$4,045 below \(levels as of the 10 Nov close\)\.$/);
});

test('the latest price is used only when it can be trusted: same feed, later than the close; without it the close decides, as before', () => {
  const fc = { at: '2026-11-11T11:50:00.000Z', assets: { gold: { last: 3987.36 } }, sources: { 'bars:gold': 'OANDA ok (1400 days)' } };
  assert.deepEqual(G.markOf(fc), { px: 3987.36, at: fc.at });
  assert.equal(G.markOf({ ...fc, sources: { 'bars:gold': 'OANDA failed (timeout), Kraken ok (720 days)' } }), null, 'a fallback feed has another price basis: it must not "break" a level');
  assert.equal(G.markOf({ ...fc, assets: { gold: {} } }), null); assert.equal(G.markOf({ ...fc, at: null }), null); assert.equal(G.markOf(null), null);
  // a price from before the close the levels come from says nothing about "since the close"
  const old = G.markLevels(lv(4070.59, LIST), { now: NOW, mark: { px: 3987.36, at: '2026-11-10T20:00:00.000Z' } }); assert.equal(old.mark, null); assert.equal(old.list.some((l) => l.crossed), false);
  const none = G.markLevels(lv(4070.59, LIST), { now: NOW }), w = G.watchLevels(vetOf(none));
  assert.equal(none.mark, null); assert.equal(w.above.price, 4100); assert.equal(w.below.price, 4045.4); assert.equal(w.above.distNow, undefined); assert.equal(w.broken, null);
  // a second stamp with a later price replaces the first (no stale `crossed` flags left behind)
  const g = G.markLevels(lv(4070.59, LIST), { now: NOW, mark: { px: 3987.36, at: '2026-11-11T11:50:00.000Z' } }); G.markLevels(g, { now: NOW, mark: { px: 4075, at: '2026-11-11T11:55:00.000Z' } }); assert.equal(g.list.some((l) => 'crossed' in l), false);
});

test('display only: the hypotheses, the calls and every level are the same whatever the latest price is', () => {
  const far = forecast(); far.assets.gold.last = GOLD.at(-1).c * 0.97;
  const a = V.run({ dir: folder(), now: NOW, log: () => {} }), b = V.run({ dir: folder({ fc: far }), now: NOW, log: () => {} });
  assert.ok(b.briefing.levels.gold.mark && b.briefing.levels.gold.list.some((l) => l.crossed), 'the far price crosses levels'); assert.equal(a.briefing.levels.gold.mark, null, 'a price equal to the close crosses nothing');
  assert.deepEqual(b.briefing.hypotheses, a.briefing.hypotheses); assert.deepEqual(b.outlook, a.outlook); assert.deepEqual(b.briefing.analogs, a.briefing.analogs); assert.deepEqual(b.calibration, a.calibration);
  const bare = (l) => { const x = { ...l }; delete x.crossed; return x; };
  assert.deepEqual(b.briefing.levels.gold.list.map(bare), a.briefing.levels.gold.list.map(bare), 'prices, sides and distances stay those of the close');
  // nearestLevel without a reference price (what the hypotheses call) is the close's, with or without the stamp
  const g = lv(4070.59, LIST), m = G.markLevels(lv(4070.59, LIST), { now: NOW, mark: { px: 3987.36, at: '2026-11-11T11:50:00.000Z' } });
  for (const side of ['above', 'below']) for (const min of [0.4, 0.8]) assert.equal(nearestLevel(m, side, min).price, nearestLevel(g, side, min).price);
});

test('desk: the glance, the ladder and the level table say which close, say "Stale" in words and mark a broken level', () => {
  const html = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
  assert.match(html, /function lvFresh\(L\) \{ var f = L && L\.fresh; return f && f\.text \? f\.text : 'last close '/, 'falls back to the plain as-of for an older veteran.json');
  assert.match(html, /function lvStale\(L\)[^\n]*f\.stale[^\n]*class="lv-stale" role="status"/);
  assert.match(html, /<p class="lv-stale" id="ld-stale" role="status" hidden><\/p>/); assert.match(html, /\$\('ld-sub'\)\.textContent = lvFresh\(L\)/);
  assert.match(html, /\$\('g-levels'\)\.innerHTML = '<span class="lab">Two levels to watch<\/span>' \+ lvStale\(L\)/);
  assert.ok(html.split('broken since the close').length - 1 >= 5, 'tile, take line, ladder row and label, table');
  assert.match(html, /\.lv-stale \{[^}]*font-size: var\(--fs-sm\)/); assert.match(html, /\.brk \{ color: var\(--gold-ink\)/);
  assert.equal(/L\.asOf\) \+ '<\/small>|'last close ' \+ esc\(L\.asOf\)\)/.test(html), false, 'the tile no longer prints a bare last-close date');
  // every field the desk reads for this is written by the veteran
  const v = V.run({ dir: folder({ hand: false, fc: (() => { const f = forecast(); f.assets.gold.last = GOLD.find((b) => b.t === FRI).c * 0.985; return f; })() }), now: NOW, log: () => {} });
  const L = v.summary.levels, g = v.briefing.levels.gold;
  for (const k of ['asOf', 'sessions', 'stale', 'text']) { assert.ok(k in L.fresh, `summary.levels.fresh.${k}`); assert.ok(k in g.fresh, `levels.gold.fresh.${k}`); assert.ok(k in v.briefing.levels.dxy.fresh, `levels.dxy.fresh.${k}`); }
  for (const k of ['px', 'at', 'dist']) { assert.ok(Number.isFinite(L.mark[k]) || typeof L.mark[k] === 'string', `summary.levels.mark.${k}`); assert.ok(k in g.mark); }
  assert.ok(g.list.some((l) => l.crossed === true)); assert.ok(Number.isFinite(L.below.distNow)); assert.ok(L.broken && L.broken.side === 'below' && L.broken.label);
  for (const f of ['.fresh', '.mark', '.crossed', '.distNow', '.broken']) assert.ok(html.includes(f), `the page reads ${f}`);
  assert.equal(v.briefing.levels.dxy.mark, null, 'no latest price is claimed for the dollar index');
});
