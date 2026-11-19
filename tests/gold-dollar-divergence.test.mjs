// research/edge/gold-dollar-divergence: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { returns, signals, kindOf, tradeAt, simulate, entryIndex, dxyIndex, holm, monthly, DAY, RT, STOP_ATR, LOOK } from '../research/edge/gold-dollar-divergence/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const DIR = new URL('../research/edge/gold-dollar-divergence/', import.meta.url);
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
const weekdays = (n) => { const out = []; for (let t = T0; out.length < n; t += DAY) { const wd = new Date(t * 1000).getUTCDay(); if (wd && wd !== 6) out.push(t); } return out; };
const bar = (time, c, w = 2) => ({ time, open: c, high: c + w, low: c - w, close: c });

test('signal: both returns beyond 0.5 sd of the 20 returns BEFORE the day, same sign', () => {
  const days = weekdays(30);
  const g = days.map((t, i) => bar(t, 1000 * (1 + (i % 2 ? 0.01 : -0.01) * 0.5)));
  const d = days.map((t, i) => ({ time: t, close: 100 * (1 + (i % 2 ? -0.004 : 0.004)) }));
  g[25] = bar(days[25], g[24].close * 1.03); d[25] = { time: days[25], close: d[24].close * 1.02 };   // both up strongly
  const rows = signals(returns(g, d));
  assert.equal(rows[0].t, days[LOOK + 1], 'first row needs 20 earlier returns');
  const r25 = rows.find((r) => r.t === days[25]);
  assert.equal(kindOf(r25), 'up');
  assert.equal(kindOf({ zg: -0.6, zd: -0.7 }), 'down');
  assert.equal(kindOf({ zg: 0.6, zd: -0.7 }), null);
  assert.equal(kindOf({ zg: 0.6, zd: 0.4 }), null);
  // no look-ahead: changing every price after day 25 leaves the rows up to day 25 unchanged
  const g2 = g.map((b, i) => (i > 25 ? bar(b.time, b.close * 1.5) : b)), d2 = d.map((b, i) => (i > 25 ? { ...b, close: b.close * 0.7 } : b));
  const rows2 = signals(returns(g2, d2));
  for (const r of rows.filter((x) => x.t <= days[25])) assert.deepEqual(rows2.find((x) => x.t === r.t), r);
});

test('trade: next open, stop 1.5 x ATR(14) on the losing side, costs and financing on buys', () => {
  const days = weekdays(30), gold = days.map((t) => bar(t, 1000, 5));   // true range 10 every day
  const j = entryIndex(gold, days[18]);
  assert.equal(j, 19);
  const tb = tradeAt(gold, j, 1, 3);
  assert.equal(tb.risk, STOP_ATR * 10); assert.equal(tb.stop, 1000 - 15);
  assert.equal(tb.kind, 'time'); assert.equal(tb.gross, 0);
  const fin = nights(tb.t, tb.c) * FIN.xau.long * 1000 / 15;
  assert.ok(Math.abs(tb.net - (-(RT / 15) - fin)) < 1e-12);
  const ts = tradeAt(gold, j, -1, 3);
  assert.equal(ts.stop, 1015); assert.equal(ts.fin, 0); assert.ok(Math.abs(ts.net + RT / 15) < 1e-12);
  // a gap through the stop fills at the open; a touch at the stop
  const g2 = gold.map((b) => ({ ...b })); g2[20] = { time: days[20], open: 980, high: 981, low: 975, close: 978 };
  assert.deepEqual([tradeAt(g2, j, 1, 3).kind, tradeAt(g2, j, 1, 3).exit], ['gap', 980]);
  const g3 = gold.map((b) => ({ ...b })); g3[21] = { time: days[21], open: 1000, high: 1001, low: 980, close: 999 };
  assert.deepEqual([tradeAt(g3, j, 1, 3).kind, tradeAt(g3, j, 1, 3).exit], ['stop', 985]);
  // one at a time: a second signal while the first trade is open is skipped
  const tr = simulate([{ t: days[18], s: 1 }, { t: days[19], s: 1 }, { t: days[22], s: 1 }], gold, 3);
  assert.deepEqual(tr.map((x) => x.j), [19, 23]);
});

test('helpers: the council DXY build, Holm, monthly sums', () => {
  const t = T0, fx = { eurusd: [{ time: t, close: 1.1 }], gbpusd: [{ time: t, close: 1.3 }], usdjpy: [{ time: t, close: 110 }], usdcad: [{ time: t, close: 1.3 }], usdchf: [{ time: t, close: 0.95 }] };
  const v = 50.14348112 * 1.1 ** -0.576 * 110 ** 0.136 * 1.3 ** -0.119 * 1.3 ** 0.091 * (11.2 / 1.1) ** 0.042 * 0.95 ** 0.036;
  assert.ok(Math.abs(dxyIndex(fx)[0].close - v) < 1e-9);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const m = monthly([{ c: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { c: Date.UTC(2020, 2, 5) / 1000, net: 2 }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 2, 31) / 1000, 'net');
  assert.equal(m.months, 3); assert.equal(m.n, 3); assert.equal(m.sum, 3);
});

test('the report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  const verdictLine = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(verdictLine && verdictLine.length < 260, 'bold verdict line with its reason');
  assert.match(verdictLine, /FAIL, 0 of 3/);
  for (const t of r.tests) {
    assert.equal(t.pass, false);
    for (const w of ['is', 'oos']) {
      const x = t[w], sg = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(3);
      const row = md.split('\n').find((l) => (w === 'is' ? l.includes(`| ${t.id} `) : true) && l.includes(`| ${x.n} |`) && l.includes(`| ${sg(x.net)} |`));
      assert.ok(row, `${t.id} ${w} row with n ${x.n} and net ${sg(x.net)}`);
      assert.ok(row.includes(String(x.tMonth.toFixed(2))), `${t.id} ${w} month t ${x.tMonth}`);
    }
    assert.ok(md.includes(`| ${t.id} | ${t.oos.tMonth.toFixed(2)} | ${t.placebo.beaten} |`), `${t.id} placebo row`);
    assert.ok(md.includes(t.holm.toFixed(3)), `${t.id} Holm p`);
  }
  const t1 = r.tests.find((t) => t.id === 'T1');
  assert.ok(verdictLine.includes(`n ${t1.oos.n}`) && verdictLine.includes(`month t ${t1.oos.tMonth}`) && verdictLine.includes(`${t1.placebo.beaten} of 40`));
  assert.match(md, /not a gate, entry, exit or size of the live gold book/);
});
