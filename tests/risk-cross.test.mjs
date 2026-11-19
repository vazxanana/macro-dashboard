// Risk-cross study: the signal reads past data only, next-open entry / exit, the stop with gap fills, costs and the
// financing charge, the placebo's time in market, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spxState, signalFor, positions, hold, atr, costPx, finPx, placeboIntervals, mulberry32, holm, monthlyT, COST, P } from '../research/edge/risk-cross/run.mjs';

const DAY = 86400, T0 = Date.parse('2010-01-04T00:00:00Z') / 1000;
// weekday bars only, starting on a Monday
function days(n) { const out = []; let t = T0; while (out.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w >= 1 && w <= 5) out.push(t); t += DAY; } return out; }
const mk = (ts, f) => ts.map((time, i) => { const c = f(i); return { time, open: c, high: c + 0.5, low: c - 0.5, close: c }; });

test('the S&P state on a day never changes when later prices change (past data only)', () => {
  const ts = days(700), base = mk(ts, (i) => 100 + i * 0.05 + Math.sin(i / 7) * 2);
  const a = spxState(base);
  for (const cut of [480, 550, 650]) {
    const alt = base.map((b, i) => (i > cut ? { ...b, close: b.close * (i % 2 ? 3 : 0.2) } : b)), s = spxState(alt);
    for (let i = 0; i <= cut; i++) assert.deepEqual(s[i], a[i], `day ${i} changed by a later price (cut ${cut})`);
  }
  assert.equal(a[P.sma - 2].up, null); assert.equal(a[P.medN + P.rvN - 2].calm, null); assert.notEqual(a[P.medN + P.rvN - 1].calm, null);
});

test('a cross day reads the latest S&P day at or before it, never a later one', () => {
  const st = [{ time: 10, up: true, calm: true }, { time: 20, up: false, calm: true }, { time: 30, up: true, calm: false }];
  const bars = [5, 10, 15, 20, 29, 30, 31].map((time) => ({ time }));
  assert.deepEqual(signalFor(bars, st), [false, true, true, false, false, false, false]);
  assert.deepEqual(signalFor(bars, st, true), [false, true, true, false, false, true, true]);
});

test('entry at the open after the signal turns on, exit at the open after it turns off; every position has a stop', () => {
  const ts = days(60), bars = mk(ts, (i) => 100 + i * 0.1);
  const sig = bars.map((_, i) => i >= 25 && i <= 34);
  const [p, ...rest] = positions(bars, sig);
  assert.equal(rest.length, 0);
  assert.equal(p.e, 26); assert.equal(p.entry, bars[26].open);
  assert.equal(p.x, 36); assert.equal(p.exit, bars[36].open); assert.equal(p.how, 'signal'); assert.equal(p.held, 10);   // off at the close of 35
  assert.ok(p.stop < p.entry); assert.ok(Math.abs(p.r0 - P.atrK * atr(bars, 25)) < 1e-12);
});

test('the stop fills at the stop, or at the open when the day gaps through it; after a stop, wait for off then on', () => {
  const ts = days(60), bars = mk(ts, () => 100);
  // in hold: day 3 low touches 98 -> filled at the stop; a gap day fills at its open
  const b1 = bars.map((b) => ({ ...b })); b1[3] = { ...b1[3], low: 97.9 };
  assert.deepEqual(hold(b1, 1, 98, null), { exitIdx: 3, exit: 98, how: 'stop', held: 3 });
  const b2 = bars.map((b) => ({ ...b })); b2[4] = { ...b2[4], open: 96, low: 95.5, high: 96.5 };
  const g = hold(b2, 1, 98, null); assert.equal(g.exit, 96); assert.equal(g.how, 'stop'); assert.equal(g.exitIdx, 4);
  // positions: signal stays on after a stop -> no new entry until it goes off and on again
  const b3 = bars.map((b) => ({ ...b })); b3[30] = { ...b3[30], open: 90, low: 89, high: 91, close: 90 };
  const sig = b3.map((_, i) => (i >= 25 && i <= 40) || (i >= 43 && i <= 50));
  const ps = positions(b3, sig);
  assert.equal(ps.length, 2); assert.equal(ps[0].how, 'stop'); assert.equal(ps[0].exit, 90); assert.ok(ps[0].R < -1);
  assert.equal(ps[1].e, 44);
});

test('costs: spread once, slippage both sides, commission on both prices; the charge is 0.004 % a night on the entry', () => {
  assert.ok(Math.abs(costPx(100, 102) - (0.003 + 0.01 + 22.5e-6 * 202)) < 1e-12);
  const mon = Date.parse('2026-11-02T00:00:00Z') / 1000;      // Monday 00:00 to next Monday 00:00 = Mon, Tue, Wed(3), Thu, Fri
  assert.ok(Math.abs(finPx(90, mon, mon + 7 * DAY) - 90 * 4e-5 * 7) < 1e-12);
  assert.equal(COST.fin, 0.004 / 100);
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/risk-cross/result.json', import.meta.url)));
  assert.equal(r.costs.swapListed, false);
  for (const x of Object.values(r.rows)) for (const t of x.trades) { assert.ok(t.stop < t.entry); assert.ok(t.net <= t.net0 + 1e-9); assert.ok(t.net0 < t.R); }
});

test('the placebo has the same count and the same days in market, inside the window, without overlap', () => {
  const durs = [5, 1, 30, 12, 7, 40, 2];
  for (let s = 1; s <= 40; s++) {
    const iv = placeboIntervals(durs, 100, 400, mulberry32(s)).sort((a, b) => a.s - b.s);
    assert.equal(iv.length, durs.length);
    assert.deepEqual(iv.map((x) => x.d).sort((a, b) => a - b), durs.slice().sort((a, b) => a - b));
    assert.ok(iv[0].s >= 100 && iv.at(-1).s + iv.at(-1).d <= 401);
    for (let k = 1; k < iv.length; k++) assert.ok(iv[k].s >= iv[k - 1].s + iv[k - 1].d + 1, 'inner gap of at least a day');
  }
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/risk-cross/result.json', import.meta.url)));
  for (const x of Object.values(r.rows)) { assert.equal(x.placebo.vals.length, 40); for (const v of x.placebo.vals) assert.equal(v.planned, x.dec.held); }
});

test('Holm and the monthly t', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  const t0 = Date.parse('2016-01-15T00:00:00Z') / 1000;
  const m = monthlyT([{ tOut: t0, v: 1 }, { tOut: t0 + 40 * DAY, v: 2 }], 'v', '2016-01', '2016-04');
  assert.equal(m.months, 4); assert.ok(Math.abs(m.mean - 0.75) < 1e-12);
});

test('RESULT.md says what result.json holds', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/risk-cross/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/risk-cross/RESULT.md', import.meta.url), 'utf8');
  const s = (x, d = 3) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d);
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /^\*\*Verdict: FAIL, 0 of 3\.\*\*/m);
  for (const k of ['T1', 'T2', 'T3']) {
    const x = r.rows[k]; assert.equal(x.verdict, 'FAIL');
    for (const [w, lab] of [['dec', '2016-now'], ['rep', '2008-15']]) {
      const y = x[w];
      const row = `| ${k} ${lab} | ${y.n} | ${(y.timeInMarket * 100).toFixed(1)} % | ${s(y.grossAvg)} | ${s(y.zero.avg)} | ${s(y.charged.avg)} | ${s(y.charged.total, 2)}R | ${s(y.charged.t, 2)} (${y.charged.months} months) | ${s(y.charged.sharpe, 2)} | ${s(y.zero.t, 2)} | ${s(y.zero.sharpe, 2)} |`;
      assert.ok(md.includes(row), `${k} ${w}: ${row}`);
    }
    assert.ok(md.includes(`| ${k} | ${s(x.dec.charged.avg)} | ${s(x.placebo.median)} | ${s(x.placebo.p95)} | ${x.placebo.planned} = ${x.placebo.held} | ${x.holmP} | ${x.verdict} |`), k + ' placebo row');
  }
});
