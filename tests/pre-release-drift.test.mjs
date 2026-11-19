// The pre-release drift study: the event list, the windows (nothing after 5 minutes before the release), the stop, costs,
// the USD side chosen from the first half, placebo days, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nights } from '../council/fills.mjs';
import { loadEvents, series, endingAt, atrH1, windowAt, manage, costOf, leg, cellDrift, runCell, placeboDays, holm, pTwo, pOne, report, P } from '../research/edge/pre-release-drift/run.mjs';

const M5 = 300, H1 = 3600;
// flat M5 candles from t0 to t1 (opening times), price fn
function m5(t0, t1, px = () => 100, wick = 0.01) { const r = []; for (let t = t0; t < t1; t += M5) { const p = px(t); r.push([t, p, p + wick, p - wick, p]); } return series(r); }
function h1(t0, t1, range = 1) { const r = []; for (let t = Math.floor(t0 / H1) * H1; t < t1; t += H1) r.push([t, 100, 100 + range / 2, 100 - range / 2, 100]); return series(r); }
const T = Date.UTC(2024, 0, 11, 13, 30) / 1000;   // a CPI at 08:30 New York

test('events: exactly the CPI and NFP rows of council/event-base.json', () => {
  const eb = JSON.parse(fs.readFileSync(new URL('../council/event-base.json', import.meta.url)));
  const { ev, rel } = loadEvents();
  assert.equal(ev.CPI.length, eb.rows.filter((r) => r.type === 'CPI').length);
  assert.equal(ev.NFP.length, eb.rows.filter((r) => r.type === 'NFP').length);
  assert.equal(ev.CPI.length, 86); assert.equal(ev.NFP.length, 51);
  for (const r of eb.rows) assert.ok(rel.includes(r.t));
  // dropped CPI dates are never events
  for (const x of eb.dropped) assert.ok(!ev.CPI.some((e) => e.d === x.d));
});

test('window: start is the close of the candle ending 24 h before, end the one ending 5 minutes before; nothing later is read', () => {
  const a = m5(T - 26 * H1, T + 2 * H1, (t) => (t >= T - 600 ? 200 : t === T - 24 * H1 - M5 ? 90 : 100));
  const w = windowAt(a, T);
  assert.equal(w.tStart, T - 24 * H1); assert.equal(w.tEnd, T - 300);
  assert.equal(w.start, 90); assert.equal(w.end, 200);
  // a candle after T - 5 min changes nothing
  const b = m5(T - 26 * H1, T + 2 * H1, (t) => (t >= T - 300 ? 999 : t >= T - 600 ? 200 : t === T - 24 * H1 - M5 ? 90 : 100));
  assert.deepEqual(windowAt(b, T), w);
  // fallback: a missing end candle takes the last one ending in the 30 minutes before
  const c = series(a.t.map((t, i) => [t, a.o[i], a.h[i], a.l[i], a.c[i]]).filter((r) => r[0] !== T - 600));
  assert.equal(windowAt(c, T).tEnd, T - 600);
  assert.equal(endingAt(c, T - 300, M5, 0), null);
});

test('ATR(14) on H1 reads only candles closed at the entry; the stop is 1 ATR and is checked from the next candle', () => {
  const h = h1(T - 40 * H1, T + 5 * H1, 2);
  assert.ok(Math.abs(atrH1(h, T - 24 * H1) - 2) < 1e-12);
  // an entry at :30 (every release here) reads the H1 candle that closed at :00, never one still forming
  assert.ok(Math.abs(atrH1(h, T - 24 * H1 + 1800) - 2) < 1e-12);
  const g = h1(T - 40 * H1, T + 5 * H1, 2); g.h[g.ix.get(Math.floor((T - 24 * H1) / H1) * H1)] = 1e6;
  assert.ok(Math.abs(atrH1(g, T - 24 * H1) - 2) < 1e-12, 'the candle opening at the entry hour is not read');
  const a = m5(T - 26 * H1, T, (t) => (t === T - 12 * H1 ? 97 : 100), 0.01);
  const w = windowAt(a, T);
  assert.equal(manage(a, w, 1, 98).how, 'stop-gap');
  assert.equal(manage(a, w, 1, 99.995).how, 'stop', 'a wick through the stop exits at the stop');
  assert.equal(manage(a, w, 1, 98).exit, 97, 'a candle opening through the stop exits at its open');
  assert.equal(manage(a, w, -1, 102).how, 'time');
  const r = leg('xau', { m5: a, h1: h }, T, 1);
  assert.equal(r.stop, 98); assert.equal(r.risk, 2); assert.equal(r.how, 'stop-gap'); assert.equal(r.gross, -1.5);
});

test('costs: the frozen cpi-follow model plus long-gold financing over the rollover', () => {
  assert.equal(costOf('xau', 4000), 0.30);
  assert.ok(Math.abs(costOf('eurusd', 1.1) - (0.00003 + 4.95e-5 + 0.0002)) < 1e-12);
  assert.ok(Math.abs(costOf('usdjpy', 150) - (0.003 + 0.00675 + 0.02)) < 1e-12);
  const a = m5(T - 26 * H1, T, () => 100), h = h1(T - 40 * H1, T, 2);
  const g = leg('xau', { m5: a, h1: h }, T, 1), f = leg('eurusd', { m5: a, h1: h }, T, 1);
  assert.ok(g.finR > 0, 'one rollover is crossed'); assert.equal(f.finR, 0);
  assert.ok(Math.abs(g.net - (g.gross - (0.30 + nights(g.tStart, g.tEnd) * 100 * 0.000148) / 2)) < 1e-12);
});

test('USD side: fixed by the first half, then applied to both halves; the basket needs all three legs', () => {
  const mk = (up) => ({ m5: m5(T - 30 * 86400, T + 86400, (t) => 100 + (up ? 1 : -1) * (t - (T - 30 * 86400)) / 86400), h1: h1(T - 32 * 86400, T + 86400, 1) });
  const data = { xau: mk(true), eurusd: mk(false), usdjpy: mk(true), gbpusd: mk(false) };
  const times = [0, 1, 2, 3].map((k) => T - k * 86400).sort((a, b) => a - b);
  const r = runCell('usd', data, times);
  assert.equal(r.usdDir, 1); assert.equal(r.ev.length, 4);
  assert.ok(cellDrift('usd', data, T) > 0);
  const miss = { ...data, gbpusd: { m5: series([]), h1: series([]) } };
  assert.equal(cellDrift('usd', miss, T), null);
});

test('placebo days: Tuesday to Friday, never within 48 h of a release', () => {
  const rel = [Date.UTC(2024, 0, 11, 13, 30) / 1000];
  const d = placeboDays('2024-01-01', '2024-01-31', rel);
  for (const x of d) { const w = new Date(x.d + 'T12:00:00Z').getUTCDay(); assert.ok(w >= 2 && w <= 5); assert.ok(Math.abs(x.T - rel[0]) > P.near); }
  assert.ok(!d.some((x) => ['2024-01-10', '2024-01-11', '2024-01-12'].includes(x.d)));
});

test('statistics: Holm, one- and two-sided p', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(pTwo(2, 1000) - 2 * pOne(2, 1000)) < 1e-12);
  assert.ok(Math.abs(pTwo(-2, 1000) - pTwo(2, 1000)) < 1e-12);
});

test('result.json and RESULT.md agree with the pass bar', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/pre-release-drift/result.json', import.meta.url)));
  assert.equal(r.cells.length, 10);
  for (const c of r.cells) {
    const ok = c.n >= 20 && c.IS.net > 0 && c.OOS.net > 0 && c.trade.t >= 2 && c.trade.holm < 0.05 && c.trade.net > c.placebo.p95;
    assert.equal(c.pass, ok, `${c.type} ${c.cell}`);
    assert.equal(c.placebo.means.length, 40);
    assert.equal(c.events.length, c.n);
  }
  const passed = r.cells.filter((c) => c.pass).length;
  assert.equal(r.verdict, passed ? 'PASS' : 'FAIL');
  assert.equal(fs.readFileSync(new URL('../research/edge/pre-release-drift/RESULT.md', import.meta.url), 'utf8').startsWith(report(r).slice(0, 400)), true);
});
