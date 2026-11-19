// research/edge/gold-lunar-cycle: the moon phases against known times, the legs on hand-made candles, the stop, costs,
// no look-ahead, statistics, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { phaseTime, switches, prepare, candleAt, closeTime, trade, legs, baseline, monthT, holm, report, verdictLine, COST, IS } from '../research/edge/gold-lunar-cycle/run.mjs';

const dir = new URL('../research/edge/gold-lunar-cycle/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const at = (iso) => Date.parse(iso) / 1000;
function rows(n, f, start = Date.UTC(2024, 0, 1)) { const out = []; let t = start / 1000; for (let k = 0; k < n; k++, t += 86400) out.push(f(k, t)); return out; }

test('moon phases: the textbook example and published 2024 times, within 3 minutes', () => {
  assert.ok(Math.abs(phaseTime(-283) - at('1977-02-18T03:37:42Z')) < 180);          // the worked new-moon example (TD)
  const k = Math.round((at('2024-01-11T00:00:00Z') - 947182440) / 86400 / 29.530588861);
  const want = [[-0.25, '2024-01-04T03:30Z'], [0, '2024-01-11T11:57Z'], [0.25, '2024-01-18T03:52Z'], [0.5, '2024-01-25T17:54Z']];
  for (const [q, iso] of want) assert.ok(Math.abs(phaseTime(k + q) - at(iso)) < 180, `${q} ${iso}`);
});

test('switch points alternate: long from a last quarter, short from a first quarter, about 14.8 days apart', () => {
  const sw = switches(at('2024-01-01T00:00:00Z'), at('2024-12-31T00:00:00Z'));
  assert.ok(sw.length >= 24 && sw.length <= 26);
  for (let n = 1; n < sw.length; n++) { assert.equal(sw[n].side, -sw[n - 1].side); const g = (sw[n].t - sw[n - 1].t) / 86400; assert.ok(g > 13 && g < 16.5, g); }
  assert.equal(sw[0].side, 1);                                                         // 4 Jan 2024 last quarter -> long
  const sh = switches(at('2024-01-01T00:00:00Z'), at('2024-03-01T00:00:00Z'), 3);
  assert.ok(Math.abs(sh[0].t - sw[0].t - 3 * 86400) < 1);                             // the placebo shift moves every time
});

test('legs: enter at the first close at or after the phase, exit on the candle the next leg enters, a stop on every leg', () => {
  const P = prepare(rows(120, (i, t) => [t, 100 + Math.sin(i / 3), 101.5 + Math.sin(i / 3), 98.5 + Math.sin(i / 3), 100 + Math.sin((i + 1) / 3), 1]));
  const i = candleAt(P.bars, at('2024-02-02T23:30:00Z'));                              // Friday after 21:00 -> next Monday
  assert.equal(new Date(P.bars[i].time * 1000).getUTCDay(), 1);
  assert.ok(closeTime(P.bars[i - 1].time) < at('2024-02-02T23:30:00Z'));
  const sw = switches(at('2024-02-01T00:00:00Z'), at('2024-05-01T00:00:00Z')), L = legs(P, sw);
  assert.ok(L.T.length >= 4);
  for (let n = 1; n < L.T.length; n++) { assert.equal(L.T[n].side, -L.T[n - 1].side); assert.ok(L.T[n].i >= L.T[n - 1].j); }
  for (const x of L.T) { assert.ok(Number.isFinite(x.stop)); assert.ok(x.side > 0 ? x.stop < x.entry : x.stop > x.entry); }
});

test('trade: R, stop, costs, financing on buys only', () => {
  const P = prepare(rows(60, (i, t) => [t, 100 + i, 101 + i, 99 + i, 100 + i, 1]));
  const Lg = trade(P, 25, 30, 1), S = trade(P, 25, 30, -1);
  assert.ok(Lg.R > 0 && Lg.fin > 0); assert.equal(S.fin, 0);
  assert.ok(Math.abs(Lg.net - (Lg.R - COST / Lg.risk - Lg.fin)) < 1e-12);
  assert.equal(S.how, 'stop'); assert.ok(Math.abs(S.R + 1) < 1e-9);
  assert.equal(trade(P, 5, 8, 1), null);
  const B = baseline(P, 1, ['2024-01', '2024-12']); assert.ok(B.n > 0 && B.net > 0);
});

test('no look-ahead: later prices move no earlier leg', () => {
  const f = (i, t) => [t, 100 + Math.sin(i / 2), 102 + Math.sin(i / 2), 98 + Math.sin(i / 2), 100 + Math.cos(i / 2), 1];
  const a = rows(200, f), b = a.map((r, i) => i > 150 ? [r[0], 999, 1999, 1, 500, 1] : r);
  const sw = switches(at('2024-01-01T00:00:00Z'), at('2024-08-01T00:00:00Z'));
  const La = legs(prepare(a), sw).T, Lb = legs(prepare(b), sw).T, cut = a[150][0];
  const early = (T) => T.filter((x) => at(x.b + 'T23:59:59Z') < cut);
  assert.ok(early(La).length >= 5); assert.deepEqual(early(La), early(Lb));
});

test('statistics: month sums and Holm', () => {
  const m = monthT([{ a: '2020-01-02', net: 1 }, { a: '2020-01-09', net: 1 }, { a: '2020-02-03', net: 1 }, { a: '2020-03-03', net: 3 }]);
  assert.equal(m.months, 3); assert.ok(m.t > 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('report matches result.json, verdict line, checks', () => {
  assert.equal(R.verdict, 'FAIL'); assert.deepEqual(R.passed, []); assert.deepEqual(R.rules.IS, IS);
  assert.equal(MD.trim(), report(R).trim());
  const line = MD.match(/\*\*Verdict: [^\n]*\*\*/)[0];
  assert.equal(line, verdictLine(R)); assert.ok(line.length < 220, line);
  const T1 = R.tests.T1;
  assert.ok(line.includes(`n ${T1.oos.n}`) && line.includes(T1.oos.t.toFixed(2)) && line.includes(`${T1.placebo.beaten} of 40`));
  for (const k of ['T1', 'T2', 'T3']) { const r = R.tests[k];
    assert.equal(r.pass, Object.values(r.checks).every(Boolean)); assert.equal(r.checks.oosT2, r.oos.t >= 2); }
  assert.equal(T1.oos.longs * 2 >= T1.oos.n - 2, true);                                // about half the legs long
  assert.ok(T1.oos.medianStop >= 10);
  assert.ok(!/is an edge/.test(MD.replace('Nothing is an edge here', '')));
});
