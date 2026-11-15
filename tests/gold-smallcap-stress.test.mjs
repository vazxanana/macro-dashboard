// research/edge/gold-smallcap-stress: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rows, entryIndex, tradeAt, simulate, holm, monthT, rng, DAY, LOOK, H_REL, TH, RT, STOP_ATR, TESTS } from '../research/edge/gold-smallcap-stress/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const DIR = new URL('../research/edge/gold-smallcap-stress/', import.meta.url);
const T0 = Date.UTC(2015, 0, 5) / 1000;
const weekdays = (n) => { const out = []; for (let t = T0; out.length < n; t += DAY) { const wd = new Date(t * 1000).getUTCDay(); if (wd && wd !== 6) out.push(t); } return out; };
const bar = (time, c, w = 2) => ({ time, open: c, high: c + w, low: c - w, close: c });

test('signal: z of the 5-day small-cap minus large-cap return, fresh crossings, closes up to the day only', () => {
  const days = weekdays(320), wig = (i, a, ph) => 1 + Math.sin(i * 1.3 + ph) * a;
  const gold = days.map((t, i) => bar(t, 1000 * wig(i, 0.004, 0)));
  const spx = days.map((t, i) => bar(t, 3000 * wig(i, 0.003, 1)));
  const rut = days.map((t, i) => bar(t, 1500 * wig(i, 0.004, 2)));
  // from day 300 on the small caps drop 8 % against the large caps
  for (let i = 300; i < days.length; i++) rut[i] = bar(days[i], rut[i].close * 0.92);
  const rs = rows(gold, spx, rut);
  assert.equal(rs[0].t, days[H_REL + LOOK + 1]);
  const r300 = rs.find((r) => r.t === days[300]);
  assert.ok(r300.z <= -TH && r300.stress && !r300.rally, 'an 8 % relative drop is a stress day');
  assert.ok(!rs.find((r) => r.t === days[301]).stress, 'only the fresh crossing counts');
  assert.ok(rs.filter((r) => r.t < days[300]).every((r) => r.z > r300.z + 3), 'the drop stands far below every earlier z');
  // the mirror: an 8 % relative rise is a rally day
  const up = rut.map((b, i) => (i >= 300 ? bar(b.time, b.close / 0.92 * 1.08) : b));
  const u300 = rows(gold, spx, up).find((r) => r.t === days[300]);
  assert.ok(u300.rally && !u300.stress && u300.z >= TH);
  // no look-ahead: changing prices after day 300 leaves rows up to day 300 unchanged
  const bump = (a) => a.map((b, i) => (i > 300 ? bar(b.time, b.close * 1.4) : b));
  const rs2 = rows(bump(gold), bump(spx), rut);
  for (const r of rs.filter((x) => x.t <= days[300])) assert.deepEqual(rs2.find((x) => x.t === r.t), r);
  // gold's prices do not enter the signal
  const rs3 = rows(gold.map((b) => bar(b.time, 5)), spx, rut);
  assert.deepEqual(rs3, rs);
  // a day missing in one index is left out
  assert.equal(rows(gold, spx, rut.filter((b) => b.time !== days[300])).find((r) => r.t === days[300]), undefined);
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
  assert.equal(s.nights, 0); assert.ok(Math.abs(s.net + RT / 20) < 1e-12); assert.equal(s.stop, 1020);
  const g2 = gold.slice(); g2[j + 2] = { time: days[j + 2], open: 970, high: 972, low: 965, close: 968 };
  const t2 = tradeAt(g2, j, 1, 5); assert.equal(t2.kind, 'stop'); assert.equal(t2.exit, 970);
  const g3 = gold.slice(); g3[j + 1] = { time: days[j + 1], open: 1000, high: 1001, low: 979, close: 990 };
  const t3 = tradeAt(g3, j, 1, 5); assert.equal(t3.exit, 980); assert.ok(Math.abs(t3.gross + 1) < 1e-12);
  // one position at a time; T2 sells
  const sim = simulate(gold, [{ t: days[25] }, { t: days[26] }, { t: days[31] }], TESTS[1]);
  assert.equal(sim.trades.length, 2); assert.equal(sim.skipped, 1); assert.ok(sim.trades.every((x) => x.side === -1));
  assert.ok(simulate(gold, [{ t: days[25] }], TESTS[0]).trades[0].side === 1);
});

test('statistics helpers: month t, Holm, seeded rng', () => {
  const a = Date.UTC(2020, 0, 1) / 1000, b = Date.UTC(2020, 11, 31) / 1000;
  assert.equal(monthT([], a, b), 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const r1 = rng(125), r2 = rng(125); for (let i = 0; i < 5; i++) assert.equal(r1(), r2());
});

test('report agrees with result.json', () => {
  const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(res.verdict, 'FAIL');
  assert.ok(res.tests.every((t) => !t.pass));
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line && line.length < 240 && line.includes('FAIL'));
  const t1 = res.tests[0].oos, f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  assert.ok(line.includes(`n ${t1.n}`) && line.includes(f(t1.excess) + 'R') && line.includes(f(t1.net) + 'R') && line.includes(`t ${t1.tExcess.toFixed(2)}`));
  for (const t of res.tests) for (const w of ['is', 'oos']) {
    const s = t[w];
    assert.ok(md.includes(`| ${s.n} | ${f(s.gross)} | ${f(s.net)} | ${f(s.excess)} | ${s.tGross.toFixed(2)} | ${s.tNet.toFixed(2)} | ${s.tExcess.toFixed(2)} |`), `${t.id} ${w} row`);
  }
  for (const t of res.tests) assert.ok(md.includes(`| ${t.id} | ${t.oos.p.toFixed(3)} | ${t.oos.holm.toFixed(3)} | ${f(t.oos.net2x)} | ${t.oos.placebo.beats} of 40 | ${t.oos.control.beats} of 40 |`), `${t.id} placebo row`);
  for (const w of ['is', 'oos']) assert.ok(res.context[w].stress >= 100 && res.context[w].rally >= 100);
});
