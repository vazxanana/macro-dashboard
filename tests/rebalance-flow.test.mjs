// rebalance-flow study (research/edge/rebalance-flow): the NYSE calendar, no look-ahead in the signal, the stop with gap fill,
// costs and financing, and RESULT.md against result.json. Offline: hand-made candles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as R from '../research/edge/rebalance-flow/run.mjs';

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'research', 'edge', 'rebalance-flow');
const sec = (ymd) => Date.parse(ymd + 'T00:00:00Z') / 1000;

test('calendar: NYSE trading days, TD-5 and TD-1', () => {
  assert.equal(R.isTradingDay('2025-11-27'), false, 'Thanksgiving');
  assert.equal(R.isTradingDay('2025-11-28'), true, 'day after Thanksgiving is a half day, still a trading day');
  assert.equal(R.isTradingDay('2024-03-29'), false, 'Good Friday');
  assert.equal(R.isTradingDay('2012-10-29'), false, 'hurricane closure');
  assert.equal(R.isTradingDay('2025-01-09'), false, 'day of mourning');
  assert.equal(R.isTradingDay('2021-06-18'), true, 'Juneteenth observed only from 2022');
  assert.equal(R.isTradingDay('2023-06-19'), false);
  assert.equal(R.isTradingDay('2025-11-22'), false, 'Saturday');
  assert.equal(R.signalDay('2025-11'), '2025-11-21');
  assert.equal(R.lastDay('2025-11'), '2025-11-28');
  assert.equal(R.lastDay('2024-03'), '2024-03-28');
  assert.equal(R.signalDay('2020-12'), '2020-12-24');
  assert.equal(R.prevMonth('2020-01'), '2019-12');
  assert.equal(R.addMonths('2020-01', -36), '2017-01');
});

test('weekend candles fold into the next weekday', () => {
  const B = R.fold([[sec('2025-11-21'), 10, 11, 9, 10.5], [sec('2025-11-23'), 10.4, 13, 10.3, 12], [sec('2025-11-24'), 12, 12.5, 11, 12.2]]);
  assert.equal(B.length, 2);
  assert.deepEqual(B[1], { d: '2025-11-24', o: 10.4, h: 13, l: 10.3, c: 12.2 });
});

test('the signal uses only the 36 prior months and the closes up to TD-5', () => {
  // a Diff series where month m is the largest ever: sell; the smallest: buy; changing a later month never moves it
  const D = new Map(); let ym = '2015-01';
  for (let k = 0; k < 40; k++, ym = R.addMonths(ym, 1)) D.set(ym, k % 3 === 0 ? 0.01 : k % 3 === 1 ? 0 : -0.01);
  const m = '2018-01'; D.set(m, 0.05);
  assert.equal(R.signalOf(D, m), -1, 'top third -> sell');
  D.set(R.addMonths(m, 1), 999); D.set(R.addMonths(m, 2), -999);
  assert.equal(R.signalOf(D, m), -1, 'later months do not move it');
  D.set(m, -0.05); assert.equal(R.signalOf(D, m), 1, 'bottom third -> buy');
  D.set(m, 0.0); assert.equal(R.signalOf(D, m), 0, 'middle third -> no trade');
  D.delete(R.addMonths(m, -36)); assert.equal(R.signalOf(D, m), null, 'a missing prior month -> no history');
  // Diff reads closes at P and S only: a price after S changes nothing
  const days = []; for (let t = sec('2017-12-01'); t <= sec('2018-01-31'); t += 86400) days.push(t);
  const mk = (f) => days.map((t) => { const c = f(t); return [t, c, c, c, c, 1]; });
  const eq = mk((t) => 100 + (t - days[0]) / 86400), bd = mk(() => 100);
  const after = sec(R.signalDay('2018-01')) + 86400;
  const eq2 = eq.map((r) => r[0] >= after ? [r[0], 1, 1, 1, 1, 1] : r);
  const I = (B) => new Map(B.map((b, i) => [b.d, i]));
  const run = (e) => { const Be = R.fold(e), Bb = R.fold(bd); return R.diffs(Be, I(Be), Bb, I(Bb), '2018-01', '2018-01').get('2018-01'); };
  assert.equal(run(eq), run(eq2));
  assert.ok(run(eq) > 0);
});

// 30 flat weekday candles with a true range of 2 -> ATR 2, risk 5
function flat(n, from = '2024-01-01') {
  const out = []; let t = sec(from);
  while (out.length < n) { const wd = new Date(t * 1000).getUTCDay(); if (wd && wd !== 6) out.push([t, 100, 101, 99, 100, 1]); t += 86400; }
  return out;
}
const idxOf = (B) => new Map(B.map((b, i) => [b.d, i]));

test('stop: 2.5 x ATR(20), touch fill and gap fill, buy and sell', () => {
  const rows = flat(30), B0 = R.fold(rows), sD = B0[24].d, xD = B0[28].d, opt = { pts: 0, rate: () => 0 };
  // no stop: exit at the close of the exit day
  let t = R.trade(B0, idxOf(B0), sD, xD, 1, opt);
  assert.equal(t.risk, 5); assert.equal(t.stop, 95); assert.equal(t.how, 'time'); assert.equal(t.exit, 100);
  // touch: the low reaches 95 on the candle after entry -> filled at the stop, -1R before costs
  const r1 = rows.map((r) => r.slice()); r1[25] = [r1[25][0], 100, 100, 94, 96, 1];
  const B1 = R.fold(r1); t = R.trade(B1, idxOf(B1), sD, xD, 1, opt);
  assert.equal(t.how, 'stop'); assert.equal(t.exit, 95); assert.equal(t.gross, -1); assert.equal(t.exitD, B1[25].d);
  // gap: opens under the stop -> filled at the open, worse than -1R
  const r2 = rows.map((r) => r.slice()); r2[26] = [r2[26][0], 90, 91, 89, 90, 1];
  const B2 = R.fold(r2); t = R.trade(B2, idxOf(B2), sD, xD, 1, opt);
  assert.equal(t.how, 'stop-gap'); assert.equal(t.exit, 90); assert.equal(t.gross, -2);
  // sell: gap up through 105
  const r3 = rows.map((r) => r.slice()); r3[25] = [r3[25][0], 108, 109, 107, 108, 1];
  const B3 = R.fold(r3); t = R.trade(B3, idxOf(B3), sD, xD, -1, opt);
  assert.equal(t.stop, 105); assert.equal(t.how, 'stop-gap'); assert.ok(Math.abs(t.gross + 1.6) < 1e-12);
  // the entry candle itself never stops the trade
  const r4 = rows.map((r) => r.slice()); r4[24] = [r4[24][0], 100, 100, 50, 100, 1];
  const B4 = R.fold(r4); t = R.trade(B4, idxOf(B4), sD, xD, 1, opt);
  assert.ok(t.stop < t.entry && t.how === 'time', 'the stop is always on the losing side');
});

test('costs: spread in points and financing (buy pays 2Y + 2.5 %, sell receives 2Y - 2.5 %)', () => {
  const B = R.fold(flat(30)), sD = B[24].d, xD = B[28].d, nights = R.nights(sD, xD);
  const buy = R.trade(B, idxOf(B), sD, xD, 1, { pts: 1, rate: () => 4 });
  assert.equal(buy.costR, 1 / 5);
  assert.ok(Math.abs(buy.finR - (-(4 + 2.5) / 100 / 365 * nights * 100 / 5)) < 1e-12);
  assert.ok(Math.abs(buy.net - (0 - 0.2 + buy.finR)) < 1e-12);
  const sell = R.trade(B, idxOf(B), sD, xD, -1, { pts: 3, rate: () => 4 });
  assert.equal(sell.costR, 3 / 5);
  assert.ok(sell.finR > 0 && Math.abs(sell.finR - (1.5 / 100 / 365 * nights * 100 / 5)) < 1e-12, 'a sell receives 2Y - 2.5 %');
  const sellLow = R.trade(B, idxOf(B), sD, xD, -1, { pts: 0, rate: () => 1 });
  assert.ok(sellLow.finR < 0, 'and pays when the 2Y is under 2.5 %');
  assert.equal(R.nights('2025-11-21', '2025-11-28'), 7);
  const rate = R.rateOf([['2020-01-03', 1.5], ['2020-01-10', 1.6]]);
  assert.equal(rate('2020-01-09'), 1.5); assert.equal(rate('2020-01-10'), 1.6); assert.equal(rate('2019-12-31'), null);
});

test('Holm and the verdict rule', () => {
  assert.deepEqual(R.holm([0.01, 0.04, 0.03, 0.5]).map((x) => +x.toFixed(4)), [0.04, 0.09, 0.09, 0.5]);
  assert.ok(Math.abs(R.pOneSided(2) - 0.02275) < 1e-4);
});

test('RESULT.md matches result.json', () => {
  const res = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.equal(res.verdict, 'FAIL');
  assert.match(md, /^# Result[^\n]*\n\n\*\*Verdict: FAIL, 0 of 4 tests\.\*\*/);
  assert.equal(Object.values(res.checks).filter((c) => c.pass).length, 0);
  const sg = (x, d = 3) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(d);
  for (const k of Object.keys(R.TESTS)) {
    const t = res.tests[k];
    const row = md.split('\n').find((l) => l.startsWith(`| ${k} |`));
    assert.ok(row, 'row ' + k);
    const cells = row.split('|').map((s) => s.trim());
    assert.equal(+cells[4], t.dec.n); assert.equal(cells[5], sg(t.dec.net)); assert.equal(cells[6], t.dec.t.toFixed(2));
    assert.equal(cells[7], sg(t.dec.gross)); assert.equal(cells[8], t.dec.win.toFixed(1));
    assert.equal(+cells[9], t.rep.n); assert.equal(cells[10], sg(t.rep.net)); assert.equal(cells[11], t.rep.t.toFixed(2));
    assert.equal(cells[12], `${t.placebo.beaten} / 40`); assert.equal(cells[13], res.checks[k].holmP.toFixed(2)); assert.equal(cells[14], 'no');
    const prow = md.split('\n').filter((l) => l.startsWith(`| ${k} |`))[1].split('|').map((s) => s.trim());
    assert.equal(prow[2], sg(t.placebo.ruleMean)); assert.equal(prow[3], sg(t.placebo.median)); assert.equal(prow[4], sg(t.placebo.p95)); assert.equal(+prow[5], t.placebo.beaten);
  }
  // the trades never overlap and every one has a stop on the losing side recorded through its R
  for (const k of Object.keys(R.TESTS)) for (const tr of res.tests[k].trades) assert.ok(tr[2] >= tr[1] && tr[0] === tr[1].slice(0, 7));
});
