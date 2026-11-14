// research/edge/gold-yen-surge: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { returns, signals, kindOf, tradeAt, simulate, entryIndex, holm, monthly, TESTS, DAY, RT, STOP_ATR, LOOK, K } from '../research/edge/gold-yen-surge/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const DIR = new URL('../research/edge/gold-yen-surge/', import.meta.url);
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
const weekdays = (n) => { const out = []; for (let t = T0; out.length < n; t += DAY) { const wd = new Date(t * 1000).getUTCDay(); if (wd && wd !== 6) out.push(t); } return out; };
const bar = (time, c, w = 2) => ({ time, open: c, high: c + w, low: c - w, close: c });

test('signal: the USD/JPY return beyond 1.5 sd of the 20 returns BEFORE the day', () => {
  assert.equal(K, 1.5); assert.equal(LOOK, 20);
  const days = weekdays(30);
  const jpy = days.map((t, i) => ({ time: t, close: 110 * (1 + (i % 2 ? 0.003 : -0.003)) }));
  jpy[25] = { time: days[25], close: jpy[24].close * 0.98 };   // yen surges (USD/JPY falls 2 %)
  const rows = signals(returns(jpy));
  assert.equal(rows[0].t, days[LOOK + 1], 'first row needs 20 earlier returns');
  assert.equal(kindOf(rows.find((r) => r.t === days[25])), 'surge');
  assert.equal(kindOf({ z: 1.6 }), 'slump');
  assert.equal(kindOf({ z: -1.4 }), null);
  assert.equal(kindOf({ z: 1.5 }), null);
  // no look-ahead: changing every price after day 25 leaves the rows up to day 25 unchanged
  const jpy2 = jpy.map((b, i) => (i > 25 ? { ...b, close: b.close * 1.3 } : b));
  const rows2 = signals(returns(jpy2));
  for (const r of rows.filter((x) => x.t <= days[25])) assert.deepEqual(rows2.find((x) => x.t === r.t), r);
  // a hole of more than 5 days restarts the history
  const holed = jpy.map((b, i) => (i >= 10 ? { ...b, time: b.time + 10 * DAY } : b));
  assert.ok(signals(returns(holed)).every((r) => r.t > days[10] + 10 * DAY + LOOK * DAY));
});

test('the tests are the pre-registered three', () => {
  assert.deepEqual(TESTS.map((t) => [t.id, t.kind, t.side, t.hold]), [['T1', 'surge', 1, 3], ['T2', 'slump', -1, 3], ['T3', 'surge', 1, 1]]);
});

test('trade: next open, stop 1.5 x ATR(14) on the losing side, costs and financing on buys', () => {
  const days = weekdays(30), gold = days.map((t) => bar(t, 1000, 5));   // true range 10 every day
  const j = entryIndex(gold, days[18]);
  assert.equal(j, 19, 'entry is the first candle after the signal day');
  const tb = tradeAt(gold, j, 1, 3);
  assert.equal(tb.risk, STOP_ATR * 10); assert.equal(tb.stop, 1000 - 15);
  assert.equal(tb.kind, 'time'); assert.equal(tb.gross, 0);
  const fin = nights(tb.t, tb.c) * FIN.xau.long * 1000 / 15;
  assert.ok(Math.abs(tb.net - (-(RT / 15) - fin)) < 1e-12);
  const ts = tradeAt(gold, j, -1, 3);
  assert.equal(ts.stop, 1015); assert.equal(ts.fin, 0); assert.ok(Math.abs(ts.net + RT / 15) < 1e-12);
  // every trade has a stop, and the ATR reads only candles before the entry
  const g1 = gold.map((b, i) => (i >= j ? bar(b.time, 1000, 50) : b));
  assert.equal(tradeAt(g1, j, 1, 3).risk, 15);
  // a gap through the stop fills at the open; a touch at the stop
  const g2 = gold.map((b) => ({ ...b })); g2[20] = { time: days[20], open: 980, high: 981, low: 975, close: 978 };
  assert.deepEqual([tradeAt(g2, j, 1, 3).kind, tradeAt(g2, j, 1, 3).exit], ['gap', 980]);
  const g3 = gold.map((b) => ({ ...b })); g3[21] = { time: days[21], open: 1000, high: 1001, low: 980, close: 999 };
  assert.deepEqual([tradeAt(g3, j, 1, 3).kind, tradeAt(g3, j, 1, 3).exit], ['stop', 985]);
  // one at a time: a second signal while the first trade is open is skipped
  const tr = simulate([{ t: days[18], s: 1 }, { t: days[19], s: 1 }, { t: days[22], s: 1 }], gold, 3);
  assert.deepEqual(tr.map((x) => x.j), [19, 23]);
});

test('helpers: Holm, monthly sums with empty months', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const m = monthly([{ c: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { c: Date.UTC(2020, 2, 5) / 1000, net: 2 }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 2, 31) / 1000, 'net');
  assert.equal(m.months, 3); assert.equal(m.n, 3); assert.equal(m.sum, 3);
});

test('the report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  assert.equal(r.councilData, 'e3dbfa18e93eb7a5997ab9f330518745e1f9e1fa');
  const verdictLine = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(verdictLine && verdictLine.length < 220 + 20, 'bold verdict line with its reason');
  assert.match(verdictLine, /FAIL, 0 of 3/);
  const sg = (v, d = 3) => (v > 0 ? '+' : v < 0 ? '−' : '+') + Math.abs(v).toFixed(d);
  for (const t of r.tests) {
    assert.equal(t.pass, false);
    for (const w of ['is', 'oos']) {
      const x = t[w];
      const row = md.split('\n').find((l) => l.includes(`| ${x.n} |`) && l.includes(`| ${sg(x.net)} |`) && l.includes(`| ${sg(x.gross)} |`));
      assert.ok(row, `${t.id} ${w} row with n ${x.n} and net ${sg(x.net)}`);
      assert.ok(row.includes(`| ${sg(x.tMonth, 2)} |`) && row.includes(`| ${sg(x.tMonthGross, 2)} |`), `${t.id} ${w} month t`);
      assert.ok(row.includes(`| ${sg(x.x2)} |`), `${t.id} ${w} 2x costs`);
    }
    assert.ok(md.includes(`| ${t.id} | ${sg(t.placebo.p5, 2)} | ${sg(t.placebo.median, 2)} | ${sg(t.placebo.p95, 2)} | ${sg(t.oos.tMonth, 2)} | ${t.placebo.beaten} of 40 |`), `${t.id} placebo row`);
    assert.equal(t.holm.toFixed(2), '1.00');
  }
  const t1 = r.tests.find((t) => t.id === 'T1');
  assert.ok(verdictLine.includes(`n ${t1.oos.n}`) && verdictLine.includes(`month t ${t1.oos.tMonth}`) && verdictLine.includes(sg(t1.oos.net)));
  assert.ok(verdictLine.includes(sg(t1.oos.baseBuy.net)), 'the baseline buy is named');
  assert.match(md, /not a gate, entry, exit or size of the live gold book/);
});
