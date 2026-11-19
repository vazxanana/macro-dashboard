// commodity-fx-lead study (research/edge/commodity-fx-lead): the 17:00 New York day, the signal (day d data only), the entry at
// day d+1's open, the stop side and the gap fill, costs and the rollover nights, and the committed result against the
// pre-registered bar and the written report. Offline: no candle file is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, TESTS, tradeDate, days, signals, atrAt, trade, build, costs, rollNights, rateAt, monthT, holm, verdictOf, iso, nyOff } from '../research/edge/commodity-fx-lead/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/commodity-fx-lead/PREREGISTRATION.md'), RES = rd('../research/edge/commodity-fx-lead/RESULT.md');
const J = JSON.parse(rd('../research/edge/commodity-fx-lead/result.json')), RATES = JSON.parse(rd('../research/edge/commodity-fx-lead/rates.json'));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const U = (s) => Date.parse(s) / 1000;

// H1 rows for consecutive New York days: each day 24 candles from 17:00 NY of the previous date (winter: 22:00 UTC)
function series(closes, start = '2021-01-04', fx = false) {
  const rows = []; let d0 = U(start + 'T00:00:00Z'), px = closes[0];
  for (let i = 0; i < closes.length;) {
    const w = new Date(d0 * 1000).getUTCDay(); if (w === 0 || w === 6) { d0 += 86400; continue; }
    const t0 = d0 - 2 * 3600, c = closes[i];                       // 22:00 UTC the evening before (winter)
    for (let h = 0; h < 24; h++) { const o = px + (c - px) * h / 24, cl = px + (c - px) * (h + 1) / 24; rows.push([t0 + h * 3600, o, Math.max(o, cl) + (fx ? 0.0002 : 0.2), Math.min(o, cl) - (fx ? 0.0002 : 0.2), cl]); }
    px = c; i++; d0 += 86400;
  }
  return rows;
}

test('the constants are the pre-registered ones', () => {
  assert.deepEqual([P.K, P.SD_N, P.ATR_N, P.STOP_ATR, P.MIN_H1, P.SPREAD_PIP, P.SLIP_PIP, P.COMM_RT, P.MARKUP, P.SEEDS], [1.5, 60, 20, 1, 6, 0.3, 0.15, 0.000045, 1.0, 40]);
  assert.deepEqual([P.DEC[0], P.REP], ['2016-01-01', ['2006-01-01', '2015-12-31']]);
  assert.equal(TESTS.T1.com, 'wtico'); assert.equal(TESTS.T1.fx, 'usdcad'); assert.equal(TESTS.T1.upSide, -1);
  assert.equal(TESTS.T2.com, 'xcu'); assert.equal(TESTS.T2.fx, 'audusd'); assert.equal(TESTS.T2.upSide, 1);
  for (const s of ['1.5', '60 commodity returns', '1 × ATR(20)', '0.3 pip', '22.5 USD per million', 'Wednesday three', '40 seeds', '2016-01-01', '2006-01-01 to\n2015-12-31']) assert.ok(PRE.includes(s), s);
});

test('the 17:00 New York day: a 17:00 NY candle opens the next date, Sunday evening counts into Monday, both clocks', () => {
  assert.equal(nyOff(U('2021-01-06T12:00:00Z')), 5); assert.equal(nyOff(U('2021-07-06T12:00:00Z')), 4); assert.equal(nyOff(U('2006-03-20T12:00:00Z')), 5);   // 2006: old rule, still EST in March
  assert.equal(iso(tradeDate(U('2021-01-06T21:00:00Z'))), '2021-01-06');   // 16:00 NY
  assert.equal(iso(tradeDate(U('2021-01-06T22:00:00Z'))), '2021-01-07');   // 17:00 NY
  assert.equal(iso(tradeDate(U('2021-07-06T20:00:00Z'))), '2021-07-06');   // 16:00 NY (summer)
  assert.equal(iso(tradeDate(U('2021-07-06T21:00:00Z'))), '2021-07-07');   // 17:00 NY (summer)
  assert.equal(iso(tradeDate(U('2021-01-10T23:00:00Z'))), '2021-01-11');   // Sunday 18:00 NY -> Monday
  const d = days([[U('2021-01-06T22:00:00Z'), 1, 2, 0.5, 1.5], [U('2021-01-06T23:00:00Z'), 1.5, 3, 1, 2.5]], 1);
  assert.equal(d.length, 1); assert.deepEqual([d[0].open, d[0].high, d[0].low, d[0].close], [1, 3, 0.5, 2.5]);
  assert.equal(days([[U('2021-01-06T22:00:00Z'), 1, 2, 0.5, 1.5]]).length, 0, 'fewer than 6 H1 candles is not a day');
});

test('signal: day d against sigma of the 60 returns before it; later days change nothing', () => {
  const cl = []; for (let i = 0; i < 70; i++) cl.push(100 * (1 + 0.01 * (i % 2 ? 1 : -1)));
  cl[65] = cl[64] * 1.05;                                           // a big up day
  const dd = days(series(cl));
  const s = signals(dd);
  const hit = s.find((x) => x.date === dd[65].date);
  assert.ok(hit && hit.dir === 1);
  const w = []; for (let j = 5; j <= 64; j++) w.push(Math.log(dd[j].close / dd[j - 1].close));
  const m = w.reduce((a, b) => a + b, 0) / 60; near(hit.sd, Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / 59), 1e-12);
  const cl2 = cl.slice(); for (let i = 66; i < 70; i++) cl2[i] = cl2[i] * 3;
  const s2 = signals(days(series(cl2))).find((x) => x.date === dd[65].date);
  assert.deepEqual([s2.dir, s2.r, s2.sd], [hit.dir, hit.r, hit.sd]);
  assert.ok(!s.some((x) => x.date <= dd[60].date), 'no signal before 60 earlier returns');
});

test('trade: entry at the open, stop on the losing side, gap fills at the open, otherwise the stop or the close', () => {
  const T = U('2021-01-06T22:00:00Z'), mk = (rows) => ({ date: U('2021-01-07T00:00:00Z'), close: rows.at(-1)[3], h1: rows.map((r, i) => [T + i * 3600, ...r]) });
  const a = trade(mk([[1.30, 1.301, 1.299, 1.3005], [1.3005, 1.302, 1.300, 1.301]]), 1, 0.01);
  assert.deepEqual([a.entry, a.stop, a.exit, a.how], [1.30, 1.29, 1.301, 'close']);
  const b = trade(mk([[1.30, 1.301, 1.299, 1.3005], [1.3005, 1.3006, 1.285, 1.286]]), 1, 0.01);
  assert.deepEqual([b.exit, b.how], [1.29, 'stop']);
  const c = trade(mk([[1.30, 1.301, 1.299, 1.3005], [1.285, 1.286, 1.28, 1.282]]), 1, 0.01);
  assert.deepEqual([c.exit, c.how], [1.285, 'gap']);
  const s = trade(mk([[1.30, 1.311, 1.299, 1.305]]), -1, 0.01);
  assert.deepEqual([s.stop, s.exit, s.how], [1.31, 1.31, 'stop']);
  assert.ok(s.stop > s.entry && a.stop < a.entry, 'stop on the losing side');
});

test('build: oil up -> sell USD/CAD at the next day open; ATR from days up to d only', () => {
  const cl = []; for (let i = 0; i < 70; i++) cl.push(60 * (1 + 0.005 * (i % 2 ? 1 : -1)));
  cl[66] = cl[65] * 1.08;
  const fxc = []; for (let i = 0; i < 70; i++) fxc.push(1.30 + 0.001 * (i % 3));
  const cd = days(series(cl)), fd = days(series(fxc, '2021-01-04', true));
  const tr = build(TESTS.T1, cd, fd, RATES);
  const t = tr.find((x) => x.signal === cd[66].date);
  assert.ok(t); assert.equal(t.side, -1); assert.equal(t.date, fd[67].date); assert.equal(t.entry, fd[67].h1[0][1]);
  near(t.atr, atrAt(fd, 66)); near(t.stop, t.entry + t.atr);
  const fd2 = fd.map((d, i) => (i >= 67 ? { ...d, high: d.high + 1, low: d.low - 1 } : d));
  near(atrAt(fd2, 66), t.atr);
});

test('costs: spread + slippage + commission in R; one rollover held to the close, Wednesday three, none after a stop', () => {
  const wed = U('2021-01-06T00:00:00Z'), thu = U('2021-01-07T00:00:00Z');
  assert.equal(rollNights(wed), 3); assert.equal(rollNights(thu), 1); assert.equal(rollNights(U('2021-01-08T00:00:00Z')), 1);
  const t = { date: thu, entry: 1.30, stop: 1.29, side: -1, how: 'close' };
  const c = costs(t, TESTS.T1, RATES);
  near(c.cost, (0.6 * 0.0001 + 0.000045 * 1.30) / 0.01);
  const rb = rateAt(RATES, 'usd', thu), rq = rateAt(RATES, 'cad', thu);
  near(c.carry, (-1 * (rb - rq) - 1) / 100 / 365 * 1.30 / 0.01); assert.equal(c.nights, 1);
  assert.equal(costs({ ...t, how: 'stop' }, TESTS.T1, RATES).nights, 0);
  const c2 = costs(t, TESTS.T1, RATES, 2); near(c2.cost, 2 * c.cost);
  assert.equal(rateAt(RATES, 'usd', U('2008-12-17T00:00:00Z')), 0.125);
});

test('statistics: month sums count empty months, Holm, the bar', () => {
  const tr = [{ date: U('2020-01-10T00:00:00Z'), net: 1 }, { date: U('2020-03-10T00:00:00Z'), net: 2 }];
  assert.equal(monthT(tr, '2020-01-01', '2020-03-31').months, 3);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  const ok = { n: 40, net: 0.1, t: 2.5, net2: 0.05 };
  assert.ok(verdictOf(ok, { net: 0.1 }, 0.01).pass);
  assert.ok(!verdictOf(ok, { net: -0.1 }, 0.01).pass); assert.ok(!verdictOf(ok, { net: 0.1 }, 0.06).pass); assert.ok(!verdictOf({ ...ok, net2: -0.01 }, { net: 0.1 }, 0.01).pass);
});

test('result.json follows the bar, and RESULT.md says what result.json says', () => {
  assert.equal(J.verdict, Object.values(J.tests).some((t) => t.pass) ? 'PASS' : 'FAIL');
  for (const t of Object.values(J.tests)) assert.equal(t.pass, verdictOf(t.decisive, t.replication, t.holmP).pass);
  assert.ok(RES.startsWith(`**Verdict:** ${J.verdict}`));
  const f2 = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3);
  for (const [k, t] of Object.entries(J.tests)) for (const w of ['decisive', 'replication']) {
    const s = t[w], row = RES.split('\n').find((l) => l.startsWith(`| ${k} `) && l.includes(w === 'decisive' ? '2016' : '2006'));
    assert.ok(row, `${k} ${w}`);
    assert.ok(row.includes(`| ${s.n} |`) && row.includes(f2(s.net)) && row.includes(s.t.toFixed(2).replace('-', '−')), row);
  }
  assert.ok(RES.includes(`${J.pooled.decisive.n}`));
  for (const t of Object.values(J.tests)) assert.ok(RES.includes(t.corr.decisive.sameDay.toFixed(2).replace('-', '−')));
});
