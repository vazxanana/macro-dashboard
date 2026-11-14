// The tug-of-war study on gold: New York days from H1 candles, the Asian / Western split, the 20-day signal (no later day
// read), the trade with its stop and costs, one position at a time, the placebo and control shuffles, and the report against
// result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, nyKey, nyHour, isAsia, nyDays, splits, signalSeries, strong, atrAt, trade, ruleTrades, toSigs, holm, monthT,
  mulberry32, shuffleByYear, swapSplits } from '../research/edge/gold-tug-of-war/run.mjs';

const H = 3600;
// one New York day in winter: 24 H1 candles from 17:00 New York (22:00 UTC the day before); hour k = New York hour (17 + k) % 24
function day(date, f) {
  const t0 = Date.parse(date + 'T22:00:00Z') / 1000 - 86400;
  return [...Array(24)].map((_, k) => { const [o, c] = f(k); return [t0 + k * H, o, Math.max(o, c) + 0.5, Math.min(o, c) - 0.5, c]; });
}
// n days from 2018-01-02; asia(i) / west(i) = price change of the Asian / Western part of day i
function days(n, asia, west) {
  const rows = []; let px = 100;
  for (let i = 0; i < n; i++) {
    const date = new Date(Date.UTC(2018, 0, 2 + i)).toISOString().slice(0, 10), a = asia(i), w = west(i), start = px;
    rows.push(...day(date, (k) => (k < 10 ? [start + (a * k) / 10, start + (a * (k + 1)) / 10] : [start + a + (w * (k - 10)) / 14, start + a + (w * (k - 9)) / 14])));
    px = start + a + w;
  }
  return nyDays(rows);
}

test('New York hours and the Asian part (17:00 to 03:00 New York)', () => {
  const t = Date.parse('2018-01-09T22:00:00Z') / 1000;
  assert.equal(nyKey(t), '2018-01-10'); assert.equal(nyHour(t), 17); assert.ok(isAsia(t));
  assert.ok(isAsia(t + 9 * H)); assert.ok(!isAsia(t + 10 * H)); assert.ok(!isAsia(t + 23 * H));
  assert.equal(nyHour(Date.parse('2018-07-09T21:00:00Z') / 1000), 17); // summer time
  assert.equal(P.asiaEnd, 3);
});

test('the split adds up to the day and the signal follows Asia when the two disagree', () => {
  const d = days(30, () => 1, () => -1.5);
  const sp = splits(d);
  assert.equal(sp[0], null);
  const s = sp[5]; assert.ok(Math.abs(s.A + s.W - Math.log(d[5].close / d[4].close)) < 1e-12);
  assert.ok(s.A > 0 && s.W < 0);
  const sig = signalSeries(sp);
  assert.equal(sig[19], null); assert.equal(sig[20].side, 'buy');
  const agree = signalSeries(splits(days(30, () => 1, () => 1)));
  assert.equal(agree[25].side, null);
  const sell = signalSeries(splits(days(30, () => -1, () => 2)));
  assert.equal(sell[25].side, 'sell');
});

test('the signal never reads a later day; T2 reads only past days', () => {
  const d = days(60, (i) => (i % 2 ? 1 : -0.5), (i) => (i % 3 ? -1 : 0.4));
  const sp = splits(d), sig = signalSeries(sp);
  const sp2 = sp.map((x, i) => (i > 40 ? { A: -5, W: 9 } : x)), sig2 = signalSeries(sp2);
  for (let i = 0; i <= 40; i++) assert.deepEqual(sig2[i], sig[i]);
  const st = sig.map((_, i) => strong(sig, i, 20)), st2 = sig2.map((_, i) => strong(sig2, i, 20));
  for (let i = 0; i <= 40; i++) assert.equal(st2[i], st[i]);
});

test('every trade has a stop on the losing side; buys pay financing, sells none; one position at a time', () => {
  const d = days(40, () => 0, () => 0);
  const atr = atrAt(d, 20); assert.ok(atr > 0);
  const buy = trade(d, 21, 'buy', atr), sell = trade(d, 21, 'sell', atr);
  assert.ok(buy.stop < buy.entry && sell.stop > sell.entry);
  assert.equal(buy.risk, P.stopAtr * atr);
  assert.ok(buy.nights > 0 && buy.cost > P.cost / buy.risk); assert.equal(sell.nights, 0); assert.equal(sell.cost, P.cost / sell.risk);
  const drop = days(40, (i) => (i === 22 ? -20 : 0), () => 0);
  const sx = trade(drop, 21, 'buy', 2); assert.ok(sx.how === 'stop' || sx.how === 'gap'); assert.ok(sx.gross <= -1);
  const tr = ruleTrades(d, [{ i: 20, side: 'buy' }, { i: 22, side: 'sell' }, { i: 25, side: 'buy' }, { i: 26, side: 'buy' }]);
  assert.deepEqual(tr.map((x) => x.e), [21, 26]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  assert.equal(monthT([], 'oos', () => 0).months, 118);
});

test('placebo keeps the count and side mix of each year; control keeps every day\'s total', () => {
  const d = days(60, (i) => (i % 2 ? 1 : -0.5), (i) => (i % 3 ? -1 : 0.4));
  const sp = splits(d), sig = signalSeries(sp), sh = shuffleByYear(sig, d, mulberry32(3));
  const count = (s, side) => s.filter((x) => x && x.side === side).length;
  assert.equal(count(sh, 'buy'), count(sig, 'buy')); assert.equal(count(sh, 'sell'), count(sig, 'sell'));
  assert.equal(toSigs(sh).length, toSigs(sig).length);
  const sw = swapSplits(sp, mulberry32(5));
  sw.forEach((x, i) => { if (x) assert.ok(Math.abs(x.A + x.W - (sp[i].A + sp[i].W)) < 1e-12); });
  assert.ok(sw.some((x, i) => x && x.A !== sp[i].A));
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-tug-of-war/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-tug-of-war/RESULT.md', import.meta.url), 'utf8');
  const f3 = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(3), f2 = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2);
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL, 0 of 3: /);
  const head = md.match(/\*\*Verdict: [^*]+\*\*/)[0]; assert.ok(head.length < 220, 'headline under 220 characters');
  const labels = { T1: 'T1 follow Asia, 5 days', T2: 'T2 strong Asia, 5 days', T3: 'T3 follow Asia, 10 days' };
  for (const k of ['T1', 'T2', 'T3']) for (const [w, lab] of [['is', 'IS 2007-16'], ['oos', 'OOS 2017-26']]) {
    const s = r.S[k][w];
    const row = `| ${labels[k]} | ${lab} | ${s.n} | ${s.buy.n} / ${s.sell.n} | ${f3(s.gross)} | ${f3(s.net)} | ${f3(s.excess)} | ${f2(s.tGross)} | ${f2(s.tNet)} | ${f2(s.tExcess)} |`;
    assert.ok(md.includes(row), row);
  }
  assert.ok(md.includes(`| ${f3(r.S.x2.oos.net)} |`));
  r.tests.forEach((t) => assert.ok(md.includes(`${t.id} p ${t.p.toFixed(2)} → ${t.holm.toFixed(2)}`), t.id));
  for (const [x, lab] of [[r.placebo, 'Placebo'], [r.control, 'Control']]) {
    assert.ok(md.includes(`| ${f2(x.median).replace('+', '')} | ${f2(x.p95).replace('+', '')} | ${f2(x.max).replace('+', '')} | ${x.atLeastActual} |`), lab);
  }
  assert.ok(!(r.tests[0].t >= 2), 'T1 did not pass');
  assert.ok(!/now live|live change/i.test(md.replace(/nothing live changed/gi, '')), 'no live change claimed');
});
