// The extreme-timing study on gold: New York days from H1 candles, the late / early class, the trade with its stop, costs,
// one position at a time, Holm, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, nyKey, nyDays, atrAt, classify, signals, trade, ruleTrades, holm, monthT } from '../research/edge/gold-extreme-timing/run.mjs';

const H = 3600;
// a New York day starting at 17:00 New York on date (winter: 22:00 UTC the day before), 24 H1 candles from a price path
function day(dateUtc, path) {
  const t0 = Date.parse(dateUtc + 'T22:00:00Z') / 1000;
  return path.map((p, k) => [t0 + k * H, p[0], p[1], p[2], p[3]]);
}
const flat = (n, o = 100) => [...Array(n)].map(() => [o, o + 1, o - 1, o]);

test('New York days: 17:00 New York boundary, winter and summer, short days dropped', () => {
  assert.equal(nyKey(Date.parse('2018-01-09T22:00:00Z') / 1000), '2018-01-10'); // 17:00 EST opens the 10th's session
  assert.equal(nyKey(Date.parse('2018-01-09T21:59:00Z') / 1000), '2018-01-09');
  assert.equal(nyKey(Date.parse('2018-07-09T21:00:00Z') / 1000), '2018-07-10'); // 17:00 EDT
  const rows = [...day('2018-01-09', flat(24)), ...day('2018-01-10', flat(10))];
  const d = nyDays(rows);
  assert.equal(d.length, 1); assert.equal(d[0].key, '2018-01-10'); assert.equal(d[0].n, 24);
});

test('class from the hour of the extreme, read from the day alone', () => {
  const up = flat(24).map(([o], k) => [o + k * 0.1, o + k * 0.1 + 0.5, o + k * 0.1 - 0.5, o + k * 0.1 + 0.1]);
  const [d] = nyDays(day('2018-01-09', up));
  assert.equal(d.hiIdx, 23); assert.deepEqual(classify(d), { side: 'buy', kind: 'late' });
  const early = up.map((r, k) => (k === 1 ? [r[0], 200, r[2], r[3]] : r));
  assert.deepEqual(classify(nyDays(day('2018-01-09', early))[0]), { side: 'buy', kind: 'early' });
  const dn = up.map(([o, h, l, c]) => [200 - o, 200 - l, 200 - h, 200 - c]);
  assert.deepEqual(classify(nyDays(day('2018-01-09', dn))[0]), { side: 'sell', kind: 'late' });
  const mid = up.map((r, k) => (k === 12 ? [r[0], 200, r[2], r[3]] : r));
  assert.equal(classify(nyDays(day('2018-01-09', mid))[0]), null);
  assert.equal(P.late, 4);
});

// a run of usable days for trade tests: day i opens at 100, H1 candles 100 +- 1
function days(n, edit = () => null) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const date = new Date(Date.UTC(2018, 0, 2 + i)).toISOString().slice(0, 10);
    rows.push(...day(date, flat(24).map((r, k) => edit(i, k) || r)));
  }
  return nyDays(rows);
}

test('signals never read a later day', () => {
  const d = days(40, (i, k) => (i % 3 === 0 ? [100 + k * 0.1, 100.6 + k * 0.1, 99.5 + k * 0.1, 100.1 + k * 0.1] : null));
  const s = signals(d);
  assert.ok(s.length > 0);
  const d2 = d.map((x, i) => (i > 20 ? { ...x, high: x.high + 50, hiIdx: 0 } : x));
  assert.deepEqual(signals(d2).filter((x) => x.i <= 20), s.filter((x) => x.i <= 20));
});

test('every trade has a stop on the losing side; stop and gap fills; buys pay financing, sells none', () => {
  const d = days(30);
  assert.equal(atrAt(d, 20), 2);
  const buy = trade(d, 21, 'buy', 2), sell = trade(d, 21, 'sell', 2);
  assert.ok(buy.stop < buy.entry && sell.stop > sell.entry);
  assert.equal(buy.how, 'time'); assert.equal(buy.risk, P.stopAtr * 2);
  const b5 = trade(d, 21, 'buy', 2, 5); assert.ok(b5.nights > 0 && b5.cost > P.cost / b5.risk); assert.equal(buy.nights, 0); assert.equal(sell.cost, P.cost / sell.risk);
  const s = days(30, (i, k) => (i === 21 && k === 5 ? [100, 101, 97, 100] : null));
  const sx = trade(s, 21, 'buy', 2); assert.equal(sx.how, 'stop'); assert.equal(sx.exitPx, 98); assert.equal(sx.gross, -1);
  const g = days(30, (i, k) => (i === 22 && k === 0 ? [90, 91, 89, 90] : null));
  const gx = trade(g, 21, 'buy', 2, 2); assert.equal(gx.how, 'gap'); assert.equal(gx.exitPx, 90);
});

test('one position at a time; Holm; month sums count empty months', () => {
  const d = days(40);
  const tr = ruleTrades(d, [{ i: 20, side: 'buy' }, { i: 21, side: 'sell' }, { i: 24, side: 'buy' }, { i: 25, side: 'buy' }], 5);
  assert.deepEqual(tr.map((x) => x.e), [21, 26]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  assert.equal(monthT([], 'oos', () => 0).months, 118);
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-extreme-timing/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-extreme-timing/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL: /);
  const head = md.match(/\*\*Verdict: [^*]+\*\*/)[0]; assert.ok(head.length < 220, 'headline under 220 characters');
  for (const t of r.tests) assert.match(md, new RegExp(`\\| ${t.id} \\| ${t.what} \\| ${t.t} \\| ${t.p} \\| ${t.holm} \\|`));
  for (const [w, label] of [['is', '2007-16'], ['oos', '2017-26']]) {
    const s = r.S.T1[w];
    assert.match(md, new RegExp(`\\| ${label} \\| ${s.n} \\| ${s.gross.toFixed(3)} \\| ${s.net.toFixed(3)} \\| ${s.excess.toFixed(3)} \\| ${s.totalNet}R \\| ${s.tGross} \\| ${s.tNet} \\| ${s.tExcess} \\|`));
    assert.match(md, new RegExp(`\\$${s.medianStop.toFixed(2)}`));
  }
  assert.match(md, new RegExp(`${r.placebo.atLeastActual} of 40 draws`));
  assert.match(md, new RegExp(`largest ${r.placebo.max}`));
  assert.ok(!(r.tests[0].t >= 2), 'T1 did not pass');
  assert.ok(!/now live|live change/i.test(md.replace(/nothing live changed/gi, '')), 'no live change claimed');
});
