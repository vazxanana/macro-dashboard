// Gold's month of the year study: the tested months are the page's, the pieces on hand-made candles, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STRONG, WEAK, months, position, monthRet, welch, holm, pUpper, placebo, randomSet, mulberry32, compare } from '../research/edge/gold-month-of-year/run.mjs';
import { FIN } from '../council/fills.mjs';

const esc = (x) => new RegExp(String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const day = (y, m, d) => Date.UTC(y, m, d) / 1000;
// weekday-only candles from a start date, price from f(i)
function candles(from, n, f, wiggle = 1) {
  const out = []; let t = from, i = 0;
  while (out.length < n) { const wd = new Date(t * 1000).getUTCDay();
    if (wd !== 0 && wd !== 6) { const c = f(i), o = f(i - 1 < 0 ? 0 : i - 1); out.push([t, o, Math.max(o, c) + wiggle, Math.min(o, c) - wiggle, c, 1]); i++; }
    t += 86400; }
  return out;
}

test('the tested months are exactly what the page encodes in seasS', () => {
  const page = read('../gold-trading.html'), m = page.match(/const seasS = \[([\d,]+)\]\.includes\(month\) \? 9 : \[([\d,]+)\]\.includes\(month\) \? 5 : 7;/);
  assert.ok(m, 'seasS line found');
  assert.deepEqual(m[1].split(',').map(Number).sort(), [...STRONG].sort());
  assert.deepEqual(m[2].split(',').map(Number).sort(), [...WEAK].sort());
});

test('months: weekends folded, the incomplete last month dropped', () => {
  const rows = candles(day(2020, 0, 1), 80, (i) => 100 + i);
  rows.splice(3, 0, [day(2020, 0, 5), 50, 200, 40, 104, 1]);   // a Sunday stub folds into Monday 6 Jan
  const { bars, months: M } = months(rows);
  assert.ok(bars.every((b) => ![0, 6].includes(new Date(b.time * 1000).getUTCDay())));
  const mon = bars.find((b) => b.time === day(2020, 0, 6)); assert.equal(mon.open, 50); assert.equal(mon.high, 200);
  assert.equal(M.length, 3);   // Jan, Feb, Mar complete; the April candles' month is dropped
  assert.equal(M[0].k % 12, 0); assert.equal(M.at(-1).k % 12, 2);
});

test('position: 3 x ATR(20) stop below the first open, R and financing from council/fills.mjs', () => {
  const rows = candles(day(2020, 0, 1), 70, () => 100, 1);   // flat candles: true range 2, ATR 2, risk 6
  const { bars, months: M } = months(rows), m = M.find((x) => x.i0 >= 20), p = position(bars, m);
  assert.equal(p.risk, 6); assert.equal(p.stop, 94); assert.equal(p.R, 0); assert.equal(p.how, 'close');
  assert.ok(p.nights >= 25 && p.nights <= 31, String(p.nights));   // about 7 a week (Wednesday three)
  assert.ok(Math.abs(p.net - (-0.3 / 6 - p.nights * FIN.xau.long * 100 / 6)) < 1e-12);
  const p2 = position(bars, m, { cost: 0.6, finMult: 2 }); assert.ok(Math.abs(p2.net - 2 * p.net) < 1e-12);
  // a fall through the stop ends the position at the stop (or at a gapped open)
  const fall = candles(day(2020, 0, 1), 70, (i) => i < 40 ? 100 : 80, 1);
  const B = months(fall), q = position(B.bars, B.months.find((x) => x.i0 <= 40 && x.i1 >= 40));
  assert.equal(q.how, 'stop'); assert.ok(q.R <= -1 - 1e-9 || Math.abs(q.R + 1) < 1e-9);
  assert.equal(position(bars, M[0]), null, 'no 20 candles before: no position');
});

test('the position reads nothing after its month', () => {
  const a = candles(day(2020, 0, 1), 90, (i) => 100 + Math.sin(i / 3) * 4), { bars, months: M } = months(a), m = M[1];
  const b = a.map((r, i) => i > m.i1 ? [r[0], 1, 2, 0.5, 1, 1] : r), B = months(b);
  assert.deepEqual(position(bars, m), position(B.bars, B.months[1]));
  assert.deepEqual(monthRet(bars, m), monthRet(B.bars, B.months[1]));
});

test('statistics: Student t tail, Welch, Holm, the seeded placebo', () => {
  assert.ok(Math.abs(pUpper(0, 10) - 0.5) < 1e-12);
  assert.ok(Math.abs(pUpper(2.228, 10) - 0.025) < 5e-4);   // two-sided 5 % critical value, df 10
  assert.ok(Math.abs(pUpper(1.645, 1e6) - 0.05) < 5e-4);
  const w = welch([1, 2, 3, 4], [0, 0, 1, 1]); assert.ok(Math.abs(w.diff - 2) < 1e-12 && w.t > 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const s = randomSet(mulberry32(1), 4); assert.equal(new Set(s).size, 4); assert.ok(s.every((x) => x >= 0 && x < 12));
  const rows = [...Array(120).keys()].map((i) => ({ mo: i % 12, v: i % 12 === 0 ? 10 : 0 }));
  assert.ok(compare(rows, [0], 1, 'v').diff > 0);
  assert.ok(Math.abs(placebo(rows, [0], 1, 'v', 600, 7) - 1 / 12) < 0.04, 'only sets with January tie or beat');
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(read('../research/edge/gold-month-of-year/result.json')), md = read('../research/edge/gold-month-of-year/RESULT.md');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL\*\*/);
  assert.deepEqual(r.claim.strong, ['Nov', 'Dec', 'Jan', 'Feb']); assert.deepEqual(r.claim.weak, ['Mar', 'Jun']);
  for (const k of ['T1', 'T2', 'T3']) assert.equal(r.pass[k].pass, false);
  const D = r.tests.decisive, R = r.tests.replication;
  const sg = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  assert.match(md, esc(`| 2016 - Oct 2026 | ${D.T1.nIn} | ${D.T1.nOut} | ${sg(D.T1.meanIn)}R | ${sg(D.T1.meanOut)}R | ${sg(D.T1.diff)}R | ${D.T1.t} | ${D.T1.p} |`));
  assert.match(md, esc(`| 2006 - 2015 | ${R.T1.nIn} | ${R.T1.nOut} | ${sg(R.T1.meanIn)}R | ${sg(R.T1.meanOut)}R | ${sg(R.T1.diff)}R | ${R.T1.t} | ${R.T1.p} |`));
  for (const [w, x] of [['decisive', D], ['replication', R]]) for (const k of ['T2', 'T3']) {
    assert.match(md, new RegExp(`\\| ${x[k].nIn} \\| ${x[k].nOut} \\|[^\\n]*\\| ${x[k].t} \\| ${x[k].p} \\|`), `${w} ${k}`); }
  for (const k of ['T1', 'T2', 'T3']) assert.ok(md.includes(`${r.holm[k]}, not met`), k);
  for (const k of ['T1', 'T2', 'T3']) assert.ok(md.includes(`${+(r.placebo[k] * 100).toFixed(1)} %, not met`), k);
  for (const [w, lab] of [['decisive', '2016 - Oct 2026'], ['replication', '2006 - 2015']]) {
    const b = D === r.tests[w] ? D.T1 : R.T1, s = b.strongBook;
    assert.ok(md.includes(`| Strong months only${w === 'decisive' ? ' (Nov-Feb)' : ''} | ${lab} | ${s.n} | ${sg(s.gross)} | ${sg(s.net)} | ${s.t.toFixed(2)} | ${s.total > 0 ? '+' : ''}${s.total}R | ${s.dd}R | ${s.stops} |`), w);
  }
  assert.match(md, /not a gate on the live gold book/i);
  assert.ok(!/now live|live change/i.test(md.replace(/nothing live changed/ig, '')), 'no live change claimed');
});
