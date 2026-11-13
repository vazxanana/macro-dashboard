// research/edge/gold-silver-ratio: the z-score sees no future, entry / exit / stop on hand-made series, RESULT.md == result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { align, zScores, simulate, cost, summary, P } from '../research/edge/gold-silver-ratio/run.mjs';

const dir = new URL('../research/edge/gold-silver-ratio/', import.meta.url);
const T0 = Date.UTC(2024, 0, 1) / 1000; // a Monday
// weekday days with log ratio L[i]; silver wiggles so both legs have a volatility; opens = closes
function series(L) {
  const days = []; let t = T0;
  for (let i = 0; i < L.length; i++) {
    while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += 86400;
    const sc = 20 * (1 + 0.01 * Math.sin(i * 1.7)), gc = sc * Math.exp(L[i]);
    days.push({ t, go: gc, gc, so: sc, sc }); t += 86400;
  }
  return days;
}
const noise = (n) => Array.from({ length: n }, (_, i) => (i % 2 ? 0.01 : -0.01));
const p = { ...P, win: 20, vol: 5, hold: 10 };

test('z at a close uses only the closes before it, never later ones', () => {
  const L = [...noise(30), 0.03, 0.02, 0.05, -0.04, 0.01], days = series(L), a = zScores(days, 20);
  for (let i = 0; i < 20; i++) assert.equal(a.z[i], null);
  const w = a.L.slice(10, 30), m = w.reduce((x, y) => x + y, 0) / 20, sd = Math.sqrt(w.reduce((x, y) => x + (y - m) ** 2, 0) / 19);
  assert.ok(Math.abs(a.z[30] - (a.L[30] - m) / sd) < 1e-12);
  // change every price after close 30: z up to 30 is unchanged
  const b = zScores(days.map((d, i) => (i > 30 ? { ...d, gc: d.gc * 3, sc: d.sc / 2 } : d)), 20);
  for (let i = 0; i <= 30; i++) assert.equal(b.z[i], a.z[i]);
  assert.notEqual(b.z[31], a.z[31]);
});

test('ratio short at z >= 2, entered at the next open, out at the open after z crosses 0', () => {
  const days = series([...noise(30), 0.03, 0.02, 0.0, -0.01, 0.01, ...noise(4)]), T = simulate(days, p);
  assert.equal(T.length, 1); const [x] = T;
  assert.equal(x.side, -1); assert.equal(x.how, 'target');
  assert.equal(x.tIn, days[31].t); assert.equal(x.ge, days[31].go);
  assert.equal(x.tOut, days[33].t); // z <= 0 at close 32, out at open 33
  assert.ok(x.z >= 2 && x.wg > 0 && x.ws > 0 && Math.abs(x.wg + x.ws - 1) < 1e-12);
});

test('stop: the log ratio at |z| = 3.5 of the signal day, fixed at entry; no re-entry until |z| < 2', () => {
  const days = series([...noise(30), 0.03, 0.06, 0.07, 0.08, 0.08, 0.08, 0.08]), T = simulate(days, p);
  assert.equal(T.length, 1);
  assert.equal(T[0].how, 'stop'); assert.equal(T[0].tOut, days[32].t);
  // a mirror ratio long hits its stop below
  const U = simulate(series([...noise(30), -0.03, -0.06, -0.06, -0.06]), p);
  assert.equal(U[0].side, 1); assert.equal(U[0].how, 'stop');
});

test('time exit at the close of the hold-th day, executed at the next open; an open trade at the data end is dropped', () => {
  const L = [...noise(30), 0.03, ...Array(12).fill(0.028)], days = series(L), T = simulate(days, p);
  assert.equal(T[0].how, 'time'); assert.equal(T[0].hold, 10); assert.equal(T[0].tOut, days[41].t);
  assert.equal(simulate(series([...noise(30), 0.03, ...Array(5).fill(0.028)]), p).length, 0);
});

test('costs: spreads on both legs, financing on the long leg only, nothing credited on the short', () => {
  const tr = { side: 1, wg: 0.4, ws: 0.6, ge: 2000, se: 25, gx: 2000, sx: 25, tIn: T0, tOut: T0 + 7 * 86400 };
  const c = cost(tr);
  assert.ok(Math.abs(c.spread - (0.4 * 0.35 / 2000 + 0.6 * 0.03 / 25)) < 1e-15);
  assert.equal(c.nights, 7); // Mon 22:00 .. Fri, Wednesday three, Monday again
  assert.ok(Math.abs(c.fin - 7 * 0.4 * P.finXau) < 1e-15);
  const s = cost({ ...tr, side: -1 }); assert.ok(Math.abs(s.fin - 7 * 0.6 * P.finXag) < 1e-15);
  assert.equal(c.gross, 0);
});

test('align keeps weekdays present in both files', () => {
  const sat = Date.UTC(2024, 0, 6) / 1000, mon = Date.UTC(2024, 0, 8) / 1000, tue = mon + 86400;
  const d = align([[sat, 1, 1, 1, 1], [mon, 1, 1, 1, 2000], [tue, 1, 1, 1, 2001]], [[sat, 1, 1, 1, 1], [mon, 1, 1, 1, 25]]);
  assert.deepEqual(d.map((x) => x.t), [mon]);
});

test('RESULT.md says what result.json holds', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}`));
  const pct = (v) => (v < 0 ? '-' : '') + Math.abs(v).toFixed(2) + ' %';
  for (const [k, label] of [['2006-17', '2006-17 (confirmation)'], ['2018-now', '2018 to now (reported apart)'], ['all', 'All']]) {
    const w = r.windows[k], row = md.split('\n').find((l) => l.startsWith(`| ${label} |`));
    assert.ok(row, label);
    assert.ok(row.includes(`| ${w.n} |`) && row.includes(pct(w.meanNetPct)) && row.includes(w.tTrade.toFixed(2)) && row.includes(w.tMonthly.toFixed(2)), label);
  }
  assert.ok(md.includes(`better than ${r.placebo.beaten} of 40`));
  // the summary agrees with the trades in the file
  assert.equal(r.trades.length, r.windows.all.n);
  assert.equal(summary([]).n, 0);
});
