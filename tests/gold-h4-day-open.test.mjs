// gold-h4-day-open: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nyOf, toDays, setup, simulate, TESTS, baseline, holm, monthT, RT, ATR_N } from '../research/edge/gold-h4-day-open/run.mjs';

const dir = new URL('../research/edge/gold-h4-day-open/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const H = 3600, DAY = 86400;

// weekday New York days in January 2020 (winter: New York = UTC-5): H1 candles 18:00 NY .. 16:00 NY, flat at 100 with range 1
function h1Days(nDays, tweak = () => null) {
  const rows = []; let d = Date.UTC(2020, 0, 1, 23) / 1000;   // 18:00 New York on 1 Jan 2020
  let made = 0;
  while (made < nDays) {
    const w = new Date((d + 6 * H) * 1000).getUTCDay();          // weekday of the New York day it belongs to
    if (w >= 1 && w <= 5) {
      for (let h = 0; h < 23; h++) { const t = d + h * H, x = tweak(made, h) || { o: 100, h: 100.5, l: 99.5, c: 100 }; rows.push([t, x.o, x.h, x.l, x.c]); }
      made++;
    }
    d += DAY;
  }
  return rows;
}

test('New York day and hour: 17:00 New York starts the next day, in winter and in summer', () => {
  const w = nyOf(Date.UTC(2020, 0, 6, 23) / 1000);   // 18:00 New York Monday 6 Jan -> Tuesday's day
  assert.equal(w.hour, 18); assert.equal(new Date(w.key * DAY * 1000).toISOString().slice(0, 10), '2020-01-07');
  const s = nyOf(Date.UTC(2020, 6, 6, 22) / 1000);   // 18:00 New York in July (UTC-4)
  assert.equal(s.hour, 18); assert.equal(new Date(s.key * DAY * 1000).toISOString().slice(0, 10), '2020-07-07');
  assert.equal(nyOf(Date.UTC(2020, 0, 6, 21) / 1000).hour, 16);   // 16:00 New York stays in Monday's day
});

test('setup reads the first H4 (17:00-20:59 New York) and the days before only', () => {
  const up = (k, h) => (k === 25 && h < 3 ? { o: 100 + h, h: 101 + h + 0.2, l: 100 + h - 0.2, c: 101 + h } : null);   // first H4 +3
  const D = toDays(h1Days(30, up)), i = 25 + (D.length - 30);
  const s = setup(D, i);
  assert.ok(s); assert.equal(s.body, 3); assert.ok(Math.abs(s.atr - 1) < 1e-9);
  assert.equal(s.rest[0].t, D[i].bars[3].t);                    // entry candle = 21:00 New York
  assert.equal(TESTS.T1.side(s), 1); assert.equal(TESTS.T2.side(s), -1);
  // changing every price from 21:00 on (and every later day) leaves the setup unchanged
  const later = (k, h) => (k === 25 && h < 3 ? up(k, h) : k >= 25 ? { o: 50, h: 300, l: 10, c: 70 } : null);
  const s2 = setup(toDays(h1Days(30, later)), i);
  assert.equal(s2.body, s.body); assert.equal(s2.atr, s.atr); assert.equal(s2.trend, s.trend);
  assert.equal(setup(D, ATR_N), null);                           // not enough history
});

test('trade: stop 1 ATR, stop first with a gap at the open, time exit at 17:00 New York; costs and no financing', () => {
  const D = toDays(h1Days(30)), i = D.length - 1, s = setup(D, i);
  let t = simulate(s, 1);
  assert.equal(t.how, 'time'); assert.equal(t.entry, 100); assert.equal(t.exit, 100); assert.equal(t.gross, 0);
  assert.ok(Math.abs(t.cost - RT / 1) < 1e-12); assert.equal(t.nights, 0); assert.equal(t.fin, 0);
  assert.equal(t.exitT, s.rest.at(-1).t + H);
  const gap = { ...s, rest: s.rest.map((b, j) => (j === 2 ? { ...b, o: 98, l: 97.5, h: 98.2, c: 98 } : b)) };
  t = simulate(gap, 1); assert.equal(t.how, 'stop'); assert.equal(t.exit, 98); assert.ok(Math.abs(t.gross + 2) < 1e-9);
  const touch = { ...s, rest: s.rest.map((b, j) => (j === 2 ? { ...b, h: 101.5 } : b)) };
  t = simulate(touch, -1); assert.equal(t.how, 'stop'); assert.equal(t.exit, 101); assert.ok(Math.abs(t.gross + 1) < 1e-9);
});

test('baseline per year and side, Holm, month t', () => {
  const D = toDays(h1Days(30)), S = []; for (let i = 0; i < D.length; i++) { const s = setup(D, i); if (s) S.push(s); }
  const b = baseline(S); assert.ok(b.has('2020:1') && b.has('2020:-1')); assert.ok(Math.abs(b.get('2020:1') + RT) < 1e-9);
  assert.deepEqual(holm([0.01, 0.04, 0.5]), [0.03, 0.08, 0.5]);
  const m = monthT([{ exitT: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { exitT: Date.UTC(2020, 1, 5) / 1000, net: 1 }], ['2020-01-01', '2020-03-31']);
  assert.equal(m.months, 3);
});

test('the report says what result.json says', () => {
  assert.equal(R.verdict, 'FAIL'); assert.deepEqual(R.passAlone, []);
  assert.ok(MD.includes('**Verdict: FAIL, 0 of 3'));
  const line = MD.split('\n').find((l) => l.startsWith('**Verdict'));
  assert.ok(line.length < 220);
  const T1 = R.tests.T1, T2 = R.tests.T2;
  const f = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(3);
  assert.ok(line.includes(`${f(T1.oos.net)}R a trade, n ${T1.oos.n.toLocaleString('en-US')}, t ${T1.oos.t < 0 ? '−' : ''}${Math.abs(T1.oos.t).toFixed(2)}`));
  assert.ok(line.includes(`in sample ${f(T1.is.net)}R`));
  for (const k of ['T1', 'T2', 'T3']) { const x = R.tests[k]; assert.equal(x.pass, false);
    assert.ok(MD.includes(`| ${x.is.n} | ${f(x.is.gross)} / ${f(x.is.net)} |`), k);
    assert.ok(MD.includes(`| ${x.oos.n} | ${f(x.oos.gross)} / ${f(x.oos.net)} |`), k);
    assert.ok(MD.includes(`${x.placebo.beaten} of 40`), k); }
  assert.equal(T2.placebo.beaten, 38); assert.equal(T2.checks.oosT, false);
  assert.equal(R.costs.roundTrip, 0.6); assert.deepEqual(R.windows, { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] });
  assert.ok(R.tests.T1.oos.n >= 100 && R.tests.T2.oos.n >= 100 && R.tests.T2.is.n >= 100);
});
