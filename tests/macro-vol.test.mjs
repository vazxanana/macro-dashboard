// node --test tests/macro-vol.test.mjs — the Macro strategist's move-size engine (council/macro.mjs): event days from
// council/events.mjs, walk-forward models with no look-ahead, MAE / QLIKE vs the naive 20-day mean, the selection protocol,
// and the brief that reports the model's own record.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../council/macro.mjs';
import { EVENTS, HISTORY } from '../council/events.mjs';

const DAY = 86400;
const at = (s) => Date.parse(s) / 1000;
const day = (s) => at(s + 'T00:00:00Z');
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

// weekday candles with clustered volatility; every 21st weekday is an event day that moves `boost` times more
function world({ n = 900, boost = 3, seed = 3 } = {}) {
  const r = rng(seed), bars = [], ev = new Set(); let p = 100, s = 0.8, k = 0;
  for (let t = day('2022-01-03'); bars.length < n; t += DAY) {
    if (!M.weekday(t)) continue;
    const isEv = ++k % 21 === 0; if (isEv) ev.add(t);
    s = Math.max(0.3, Math.min(2.5, s * Math.exp(0.15 * gauss(r))));
    const o = p, c = o * (1 + (s * (isEv ? boost : 1) * gauss(r)) / 100); p = c;
    bars.push({ time: t, open: o, high: Math.max(o, c), low: Math.min(o, c), close: c });
  }
  return { bars, typeOf: (t) => (ev.has(t) ? 'CPI' : null), vixAt: (t) => 16 + (t / DAY) % 7 };
}

test('the shared calendar: HISTORY extends CPI / NFP / FOMC back to 2022 without touching EVENTS', () => {
  assert.ok(HISTORY.length >= 110 && Object.isFrozen(HISTORY) && Object.isFrozen(HISTORY[0]));
  for (const e of HISTORY) { assert.ok(['CPI', 'NFP', 'FOMC'].includes(e.type)); assert.ok(e.t >= day('2022-01-01') && e.t < day('2025-08-01')); assert.ok(e.src && e.history); }
  for (let i = 1; i < HISTORY.length; i++) assert.ok(HISTORY[i].t >= HISTORY[i - 1].t, 'sorted');
  assert.ok(EVENTS.every((e) => e.t >= day('2025-08-01')), 'EVENTS keeps its range: nearEvent / newsFeat do not change');
  const has = (type, iso) => HISTORY.some((e) => e.type === type && e.at === iso);
  assert.ok(has('CPI', '2024-04-10T12:30:00Z'), 'CPI 08:30 EDT');
  assert.ok(has('NFP', '2023-01-06T13:30:00Z'), 'NFP 08:30 EST');
  assert.ok(has('NFP', '2025-07-03T12:30:00Z'), 'July 2025 payrolls on Thursday the 3rd (holiday)');
  assert.ok(has('FOMC', '2024-11-07T19:00:00Z'), 'the post-election Thursday FOMC, 14:00 EST');
});

test('event days come from council/events.mjs, not the first-Friday rule', () => {
  assert.equal(M.eventTypeOn(day('2026-11-06')), 'NFP');
  assert.equal(M.eventTypeOn(day('2026-01-02')), null, 'a first Friday with no payrolls report (it came on 9 Jan)');
  assert.equal(M.eventTypeOn(day('2026-01-09')), 'NFP');
  assert.equal(M.eventTypeOn(day('2025-11-20')), 'NFP', 'the shutdown-delayed September report on a Thursday');
  assert.equal(M.eventTypeOn(day('2026-11-10')), 'CPI');
  assert.equal(M.eventTypeOn(day('2024-03-20')), 'FOMC');
  assert.equal(M.eventTypeOn(day('2023-02-14')), 'CPI');
  assert.equal(M.eventTypeOn(day('2026-11-11')), null);
  assert.ok(M.FOMC.has('2022-01-26') && M.FOMC.has('2026-12-09') && !M.FOMC.has('2026-11-06'));
  const dk = M.dayKind(day('2026-11-06'), []);
  assert.equal(dk.type, 'NFP'); assert.match(dk.title, /Non-Farm Payrolls.*13:30 UTC/);
  // past the end of the calendar the faireconomy feed names the type
  const feed = M.parseCalendar([{ title: 'Non-Farm Employment Change', country: 'USD', date: '2027-01-08T08:30:00-05:00', impact: 'High' },
    { title: 'Unemployment Rate', country: 'USD', date: '2027-01-08T08:30:00-05:00', impact: 'High' }]);
  assert.equal(M.dayKind(day('2027-01-08'), feed).type, 'NFP');
  assert.equal(M.dayKind(day('2027-01-08'), []).type, null);
  // a high-impact release that is not modelled only labels the day
  const ecb = M.parseCalendar([{ title: 'Main Refinancing Rate', country: 'EUR', date: '2026-12-17T14:15:00+01:00', impact: 'High' }]);
  assert.deepEqual(M.dayKind(day('2026-12-17'), ecb), { type: null, title: 'EUR Main Refinancing Rate' });
});

test('no look-ahead: every model forecast for a day is the same with or without the candles from that day on', () => {
  const w = world();
  const full = M.volEngine(w.bars, { typeOf: w.typeOf, vixAt: w.vixAt });
  assert.equal(full.rows.length, w.bars.length);
  for (const i of [25, 300, 299 + 21 - (299 % 21), 640, 899]) {
    const D = w.bars[i].time, cut = M.volEngine(w.bars, { D, typeOf: w.typeOf, vixAt: w.vixAt }), f = cut.next(w.typeOf(D), w.vixAt(D));
    for (const k of ['naive', 'cur', 'evt', 'ewma', 'har', 'vix']) assert.equal(f[k], full.rows[i].f[k], `${k} on row ${i}`);
  }
  // rewriting the future does not move a past forecast
  const fut = w.bars.map((b, i) => (i > 500 ? { ...b, close: b.open * 1.2 } : b)), alt = M.volEngine(fut, { typeOf: w.typeOf, vixAt: w.vixAt });
  for (let i = 0; i <= 500; i++) assert.deepEqual(alt.rows[i].f, full.rows[i].f);
  assert.notDeepEqual(alt.rows[502].f, full.rows[502].f);
  // a forming candle and weekend candles are ignored
  const live = M.volEngine([...w.bars, { time: w.bars[899].time + 3 * DAY, open: 1, close: 2, live: true }], { typeOf: w.typeOf });
  assert.equal(live.n, 900);
  assert.equal(M.volEngine(w.bars.slice(0, 10)).next(), null, 'needs 20 candles');
});

test('the models see the event effect; naive cannot', () => {
  const w = world(), E = M.volEngine(w.bars, { typeOf: w.typeOf, vixAt: w.vixAt }), late = E.rows.slice(400);
  const ev = late.filter((r) => r.type), mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  for (const k of ['evt', 'ewma', 'har']) assert.ok(mean(ev.map((r) => r.f[k] / r.f.naive)) > 1.8, `${k} raises event days`);
  assert.ok(mean(late.filter((r) => !r.type).map((r) => r.f.ewma / r.f.naive)) < 1.15, 'not the other days');
  assert.ok(late.every((r) => r.f.vix > 0 && r.f.har > 0));
  // with a 3x event effect a model clears both halves, and the protocol uses it
  const s = M.volSelect(E.rows, 'es');
  assert.notEqual(s.used, 'naive'); assert.equal(s.used, s.picked); assert.equal(s.tried, 4);
  assert.ok(M.beatsNaive(s.selection.models[s.used]) && M.beatsNaive(s.confirmation.models[s.used]));
  assert.equal(M.volSelect(E.rows, 'gold').tried, 3, 'the VIX model is for ES and NQ only');
  assert.equal(M.volSelect(E.rows, 'gold').full.models.vix, undefined);
});

test('the protocol keeps naive unless a model wins the first half and beats naive again on the second', () => {
  // hand-made rows: ewma is better everywhere, evt only on the first half, har never
  const rows = [];
  for (let i = 0; i < 400; i++) {
    const a = 0.5 + (i % 7) * 0.1, ev = i % 10 === 0 ? 'NFP' : null, late = i >= 200;
    rows.push({ t: day('2023-01-02') + i * DAY, type: ev, a, f: { naive: a * 1.6, cur: a * 1.6, ewma: a * 1.05, evt: late ? a * 3 : a * 1.1, har: a * 2.5, vix: null } });
  }
  assert.equal(M.volSelect(rows, 'gold').used, 'ewma');
  const noEwma = rows.map((r) => ({ ...r, f: { ...r.f, ewma: r.f.naive * 1.3 } })), s = M.volSelect(noEwma, 'gold');
  assert.equal(s.picked, 'evt'); assert.equal(s.used, 'naive'); assert.match(s.reason, /evt won the first half but did not beat naive on the second half/);
  const none = rows.map((r) => ({ ...r, f: { ...r.f, ewma: r.f.naive * 2, evt: r.f.naive * 2, har: r.f.naive * 2 } }));
  assert.match(M.volSelect(none, 'gold').reason, /none of the 3 models beat naive on the first half/);
  assert.equal(M.volSelect(rows.slice(0, 50), 'gold').used, 'naive', 'too little history');
  // beating naive needs all four: MAE and QLIKE, all days and event days
  const ok = { mae: 1, maeNaive: 2, qlike: 1, qlikeNaive: 2 };
  assert.equal(M.beatsNaive({ all: ok, event: ok }), true);
  assert.equal(M.beatsNaive({ all: ok, event: { ...ok, mae: 3 } }), false);
  assert.equal(M.beatsNaive({ all: { ...ok, qlike: 2.5 }, event: ok }), false);
  assert.equal(M.beatsNaive({ all: ok, event: null }), false);
});

test('scores: QLIKE prefers the true scale, MAE the median; Diebold-Mariano sign; least squares', () => {
  const r = rng(11), a = Array.from({ length: 5000 }, () => Math.abs(gauss(r))), mean = (x) => x.reduce((s, y) => s + y, 0) / x.length;
  const q = (e) => mean(a.map((x) => M.qlike(e, x))), right = Math.sqrt(2 / Math.PI);
  assert.ok(q(right) < q(right * 0.7) && q(right) < q(right * 1.4), 'QLIKE is lowest at E|r| of a unit normal');
  const rows = a.map((x, i) => ({ t: i * DAY, type: i % 5 ? null : 'CPI', a: x, f: { naive: 1.2, cur: 0.67, ewma: right } }));
  const c = M.volCompare(rows, ['cur', 'ewma']);
  assert.ok(c.models.cur.all.mae < c.models.ewma.all.mae, 'the median wins on MAE');
  assert.ok(c.models.ewma.all.qlike < c.models.cur.all.qlike, 'the mean wins on QLIKE');
  assert.ok(c.models.ewma.all.dmQlike > 2 && c.models.ewma.event.n === 1000 && c.eventDays === 1000);
  assert.deepEqual(M.ols([[1, 0], [1, 1], [1, 2], [1, 3]], [1, 3, 5, 7]).map((x) => +x.toFixed(4)), [1, 2]);
});

test('forecast and brief: the move model in use and its own record, naive said plainly', () => {
  const w = world(), E = M.volEngine(w.bars, { typeOf: w.typeOf }), D = w.bars[899].time + DAY;
  const vf = M.volForecast(null, D, 'CPI', { engine: E, model: 'ewma' });
  assert.equal(vf.model, 'ewma'); assert.match(vf.basis, /EWMA volatility × \d\.\d\d \(actual vs forecast on the last 24 CPI days\)/);
  assert.equal(M.volForecast(null, D, null, { engine: E }).model, 'naive');
  assert.equal(M.volForecast(null, D, null, { engine: E }).exp, +E.next().naive.toFixed(3));
  const m = (mae, maeN, ql, qlN) => ({ n: 400, mae, maeNaive: maeN, qlike: ql, qlikeNaive: qlN, dmMae: 1, dmQlike: 1 });
  const sc = (used) => ({ used, picked: used === 'naive' ? null : used, tried: 3, eventDays: 50, eventAvgAbs: 1.1, otherAvgAbs: 0.8,
    full: { eventDays: 50, eventAvgAbs: 1.1, otherAvgAbs: 0.8, models: { vix: { all: m(0.41, 0.44, 0.7, 0.88), event: m(0.5, 0.54, 1.4, 1.73) } } } });
  const fc = { scorecard: { vol: Object.fromEntries(M.AK.map((a) => [a, { ...sc('naive'), tried: a === 'es' || a === 'nq' ? 4 : 3 }])) } };
  assert.match(M.volLine(fc), /all five markets keep the naive 20-day average: none of the 4 models tried beat it out of sample/);
  assert.match(M.volLine(fc), /gold 1\.1% on average against 0\.8% on other days, but no model turned that into a better forecast/);
  fc.scorecard.vol.es = { ...sc('vix'), tried: 4 };
  assert.match(M.volLine(fc), /ES \(S&P 500\) uses the VIX-implied move, which beat the naive 20-day average on both halves of the replay \(all days MAE 0\.41 vs 0\.44, QLIKE 0\.7 vs 0\.88/);
  assert.match(M.volLine(fc), /Gold, EUR\/USD, USD\/JPY, NQ \(Nasdaq 100\) keep the naive 20-day average/);
});
