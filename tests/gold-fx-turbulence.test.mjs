// research/edge/gold-fx-turbulence: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rows, entryIndex, tradeAt, simulate, holm, monthT, rng, DAY, LOOK, TH, RT, STOP_ATR, TESTS } from '../research/edge/gold-fx-turbulence/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const DIR = new URL('../research/edge/gold-fx-turbulence/', import.meta.url);
const T0 = Date.UTC(2020, 0, 6) / 1000;
const weekdays = (n) => { const out = []; for (let t = T0; out.length < n; t += DAY) { const wd = new Date(t * 1000).getUTCDay(); if (wd && wd !== 6) out.push(t); } return out; };
const bar = (time, c, w = 2) => ({ time, open: c, high: c + w, low: c - w, close: c });

test('signal: mean |return| / sd60 over six pairs, uses only closes up to the day', () => {
  const days = weekdays(90), wig = (i, a, ph) => 1 + Math.sin(i * 1.7 + ph) * a;
  const gold = days.map((t, i) => bar(t, 1000 * wig(i, 0.004, 0)));
  const fx = [0, 1, 2, 3, 4, 5].map((p) => days.map((t, i) => bar(t, (1 + p) * wig(i, 0.002, p))));
  fx.forEach((a) => { a[80] = bar(days[80], a[79].close * 1.03); });
  const rs = rows(gold, fx);
  assert.equal(rs[0].t, days[LOOK + 1]);
  const r80 = rs.find((r) => r.t === days[80]);
  assert.ok(r80.u >= TH, 'a 3% move in every pair is a turbulence day');
  assert.ok(rs.find((r) => r.t === days[70]).u < TH);
  // no look-ahead: changing prices after day 80 leaves rows up to day 80 unchanged
  const bump = (a) => a.map((b, i) => (i > 80 ? bar(b.time, b.close * 1.4) : b));
  const rs2 = rows(bump(gold), fx.map(bump));
  for (const r of rs.filter((x) => x.t <= days[80])) assert.deepEqual(rs2.find((x) => x.t === r.t), r);
  // a day missing in one pair is left out
  const fx3 = fx.map((a, p) => (p === 2 ? a.filter((b) => b.time !== days[80]) : a));
  assert.equal(rows(gold, fx3).find((r) => r.t === days[80]), undefined);
});

test('trade: next open, stop 2 x ATR20 on the losing side, hold, costs and financing on buys only', () => {
  const days = weekdays(40), gold = days.map((t) => bar(t, 1000, 5));
  const j = entryIndex(gold, days[25]);
  assert.equal(j, 26);
  const b = tradeAt(gold, j, 1, 5);
  assert.equal(b.risk, STOP_ATR * 10); assert.equal(b.stop, 980); assert.equal(b.k, j + 4); assert.equal(b.kind, 'time');
  const n = nights(gold[j].time, gold[j + 4].time + DAY);
  assert.ok(n > 0);
  assert.ok(Math.abs(b.net - -(RT + n * FIN.xau.long * 1000) / 20) < 1e-12);
  const s = tradeAt(gold, j, -1, 5);
  assert.equal(s.nights, 0); assert.ok(Math.abs(s.net + RT / 20) < 1e-12);
  // a gap through the stop exits at the open; a touch exits at the stop
  const g2 = gold.slice(); g2[j + 2] = { time: days[j + 2], open: 970, high: 972, low: 965, close: 968 };
  const t2 = tradeAt(g2, j, 1, 5); assert.equal(t2.kind, 'stop'); assert.equal(t2.exit, 970);
  const g3 = gold.slice(); g3[j + 1] = { time: days[j + 1], open: 1000, high: 1001, low: 979, close: 990 };
  const t3 = tradeAt(g3, j, 1, 5); assert.equal(t3.exit, 980); assert.ok(Math.abs(t3.gross + 1) < 1e-12);
  // one position at a time
  const sim = simulate(gold, [{ t: days[25], g: 1 }, { t: days[26], g: 1 }, { t: days[31], g: -1 }], TESTS[1]);
  assert.equal(sim.trades.length, 2); assert.equal(sim.skipped, 1); assert.equal(sim.trades[1].side, -1);
});

test('statistics helpers: month t, Holm, seeded rng', () => {
  const a = Date.UTC(2020, 0, 1) / 1000, b = Date.UTC(2020, 11, 31) / 1000;
  assert.equal(monthT([], a, b), 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const r1 = rng(118), r2 = rng(118); for (let i = 0; i < 5; i++) assert.equal(r1(), r2());
});

test('report agrees with result.json', () => {
  const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(res.verdict, 'FAIL');
  assert.ok(res.tests.every((t) => !t.pass));
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line && line.length < 260 && line.includes('FAIL'));
  const t1 = res.tests[0].oos, f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  assert.ok(line.includes(`n ${t1.n}`) && line.includes(f(t1.net) + 'R') && line.includes(`t ${t1.tExcess.toFixed(2)}`));
  for (const t of res.tests) for (const w of ['is', 'oos']) {
    const s = t[w];
    assert.ok(md.includes(`| ${s.n} | ${f(s.gross)} | ${f(s.net)} | ${f(s.excess)} | ${s.tGross.toFixed(2)} | ${s.tNet.toFixed(2)} | ${s.tExcess.toFixed(2)} |`), `${t.id} ${w} row`);
  }
  for (const t of res.tests) assert.ok(md.includes(`${t.oos.placebo.beats} of 40`) && md.includes(`${t.oos.control.beats} of 40`));
  assert.ok(res.context.is.signals >= 100 && res.context.oos.signals >= 100);
});
