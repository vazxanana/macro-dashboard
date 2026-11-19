// research/edge/gold-dxy-month-shock: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { returns, signals, kindOf, sideOf, tradeAt, simulate, entryIndex, baseByYear, withExcess, holm, monthly, TESTS, DAY, RT, STOP_ATR, LOOK } from '../research/edge/gold-dxy-month-shock/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const DIR = new URL('../research/edge/gold-dxy-month-shock/', import.meta.url);
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
const weekdays = (n) => { const out = []; for (let t = T0; out.length < n; t += DAY) { const wd = new Date(t * 1000).getUTCDay(); if (wd && wd !== 6) out.push(t); } return out; };
const bar = (time, c, w = 2) => ({ time, open: c, high: c + w, low: c - w, close: c });

test('signal: the dollar move larger than every one of the 21 returns BEFORE the day, side against or with it', () => {
  const days = weekdays(40);
  const g = days.map((t) => bar(t, 1000));
  const d = days.map((t, i) => ({ time: t, close: 100 * (1 + (i % 2 ? 0.003 : -0.003)) }));   // alternating 0.6 % moves
  d[30] = { time: days[30], close: d[29].close * 1.01 };                                         // a 1 % up day
  const rows = signals(returns(g, d));
  assert.equal(rows[0].t, days[LOOK + 1], 'first row needs 21 earlier returns');
  const r30 = rows.find((r) => r.t === days[30]);
  assert.equal(kindOf(r30), 'up');
  assert.equal(kindOf({ d: -0.02, mx: 0.01 }), 'down');
  assert.equal(kindOf({ d: 0.01, mx: 0.01 }), null, 'equal to the earlier maximum is not a shock');
  const [t1, , t3] = TESTS;
  assert.equal(sideOf(t1, r30), 1, 'T1 buys gold after a dollar up shock');
  assert.equal(sideOf(t3, r30), -1, 'T3 sells gold after a dollar up shock');
  assert.equal(sideOf(t1, { d: -0.02, mx: 0.01 }), -1);
  // no look-ahead: changing every price after day 30 leaves the rows up to day 30 unchanged
  const g2 = g.map((b, i) => (i > 30 ? bar(b.time, b.close * 1.5) : b)), d2 = d.map((b, i) => (i > 30 ? { ...b, close: b.close * 0.7 } : b));
  const rows2 = signals(returns(g2, d2));
  for (const r of rows.filter((x) => x.t <= days[30])) assert.deepEqual(rows2.find((x) => x.t === r.t), r);
});

test('trade: next open, stop 2 x ATR(20) on the losing side, costs and financing on buys', () => {
  const days = weekdays(40), gold = days.map((t) => bar(t, 1000, 5));   // true range 10 every day
  const j = entryIndex(gold, days[24]);
  assert.equal(j, 25);
  const tb = tradeAt(gold, j, 1, 5);
  assert.equal(tb.risk, STOP_ATR * 10); assert.equal(tb.stop, 1000 - 20);
  assert.equal(tb.kind, 'time'); assert.equal(tb.gross, 0);
  const fin = nights(tb.t, tb.c) * FIN.xau.long * 1000 / 20;
  assert.ok(Math.abs(tb.net - (-(RT / 20) - fin)) < 1e-12);
  const ts = tradeAt(gold, j, -1, 5);
  assert.equal(ts.stop, 1020); assert.equal(ts.fin, 0); assert.ok(Math.abs(ts.net + RT / 20) < 1e-12);
  const g2 = gold.map((b) => ({ ...b })); g2[26] = { time: days[26], open: 975, high: 976, low: 970, close: 972 };
  assert.deepEqual([tradeAt(g2, j, 1, 5).kind, tradeAt(g2, j, 1, 5).exit], ['gap', 975]);
  // one at a time
  const tr = simulate([{ t: days[24], s: 1 }, { t: days[25], s: 1 }, { t: days[30], s: 1 }], gold, 5);
  assert.deepEqual(tr.map((x) => x.j), [25, 31]);
});

test('baseline: same side, every day of the same year; excess = net less that year mean', () => {
  const days = weekdays(60), gold = days.map((t, i) => bar(t, 1000 + i, 5));
  const elig = days.slice(25, 50).map((t) => ({ t }));
  const base = { buy: baseByYear(elig, gold, 1, 1), sell: baseByYear(elig, gold, -1, 1) };
  assert.equal(base.buy.n, 25);
  const tr = withExcess(simulate([{ t: days[30], s: 1 }], gold, 1), base);
  assert.ok(Math.abs(tr[0].ex - (tr[0].net - base.buy.byYear[2020])) < 1e-12);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const m = monthly([{ c: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { c: Date.UTC(2020, 2, 5) / 1000, net: 2 }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 2, 31) / 1000, 'net');
  assert.equal(m.months, 3); assert.equal(m.sum, 3);
});

test('the report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  const verdictLine = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(verdictLine && verdictLine.length < 220, 'bold verdict line with its reason');
  assert.match(verdictLine, /FAIL, 0 of 3/);
  assert.ok(r.context.is.up + r.context.is.down >= 100 && r.context.oos.up + r.context.oos.down >= 100, '100+ events a window');
  const sg = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(3);
  for (const t of r.tests) {
    assert.equal(t.pass, false);
    for (const [w, lab] of [['is', 'IS 2007-16'], ['oos', 'OOS 2017-26']]) {
      const x = t[w];
      const row = md.split('\n').find((l) => l.startsWith(`| ${t.id} | ${lab} |`));
      assert.ok(row, `${t.id} ${w} row`);
      for (const v of [`| ${x.n} |`, `| ${sg(x.net)} |`, `| ${sg(x.excess)} |`, ` ${x.tMonth.toFixed(2)} |`]) assert.ok(row.includes(v), `${t.id} ${w} ${v}`);
    }
    assert.ok(md.includes(`| ${t.id} | ${t.oos.tMonth.toFixed(2)} | ${t.placebo.beaten} |`), `${t.id} placebo row`);
    assert.ok(md.includes(t.holm.toFixed(3)), `${t.id} Holm p`);
  }
  const t1 = r.tests.find((t) => t.id === 'T1');
  assert.ok(verdictLine.includes(`n ${t1.oos.n}`) && verdictLine.includes(`month t ${t1.oos.tMonth}`) && verdictLine.includes(`${t1.placebo.beaten} of 40`));
  assert.match(md, /not a\s+gate, entry, exit or size of the live gold book/);
});
