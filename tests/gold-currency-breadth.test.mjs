// research/edge/gold-currency-breadth: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { commonDays, states, trade, simulate, entryIndex, placeboTrades, holm, monthly, DAY, RT, STOP_ATR, MAX_HOLD } from '../research/edge/gold-currency-breadth/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const DIR = new URL('../research/edge/gold-currency-breadth/', import.meta.url);
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
const weekdays = (n) => { const out = []; for (let t = T0; out.length < n; t += DAY) { const wd = new Date(t * 1000).getUTCDay(); if (wd && wd !== 6) out.push(t); } return out; };
const bar = (time, c, w = 5) => ({ time, open: c, high: c + w, low: c - w, close: c });
const flat = (days, v) => days.map((t) => ({ time: t, close: v }));

test('state: +1 only when gold is up over L days in all six currencies, -1 only when down in all six', () => {
  const days = weekdays(40);
  const series = { xau: days.map((t, i) => ({ time: t, close: 1000 + i })), eurusd: flat(days, 1.1), gbpusd: flat(days, 1.3), usdjpy: flat(days, 110), usdchf: flat(days, 0.9), audusd: flat(days, 0.7) };
  let st = states(commonDays(series), 5);
  assert.equal(st[4].s, null, 'needs L earlier days');
  assert.equal(st[5].s, 1);
  // the euro rises faster than gold: gold in EUR falls, no agreement
  series.eurusd = days.map((t, i) => ({ time: t, close: 1.1 * (1 + 0.01 * i) }));
  st = states(commonDays(series), 5);
  assert.equal(st[10].s, 0);
  // gold down and every pair flat: -1
  series.eurusd = flat(days, 1.1); series.xau = days.map((t, i) => ({ time: t, close: 1000 - i }));
  st = states(commonDays(series), 5);
  assert.equal(st[10].s, -1);
  // JPY and CHF multiply, the others divide
  series.usdjpy = days.map((t, i) => ({ time: t, close: 110 * (1 + 0.01 * i) }));
  assert.equal(states(commonDays(series), 5)[10].s, 0, 'yen weakening lifts gold in JPY');
  // no look-ahead: changing every later price leaves earlier states unchanged
  const a = states(commonDays(series), 5);
  const s2 = { ...series, xau: series.xau.map((b, i) => (i > 20 ? { ...b, close: b.close * 3 } : b)) };
  const b = states(commonDays(s2), 5);
  for (let i = 0; i <= 20; i++) assert.deepEqual(b[i], a[i]);
  // a day missing in one pair is not a common day
  const s3 = { ...series, audusd: series.audusd.filter((_, i) => i !== 7) };
  assert.equal(commonDays(s3).length, days.length - 1);
});

test('trade: next open, stop 2 x ATR(20), exit at the open after the state leaves, costs and financing on buys', () => {
  const days = weekdays(60), gold = days.map((t) => bar(t, 1000));   // true range 10 every day
  const j = entryIndex(gold, days[24]);
  assert.equal(j, 25);
  const tb = trade(gold, j, 1, 30);
  assert.equal(tb.risk, STOP_ATR * 10); assert.equal(tb.stop, 980);
  assert.deepEqual([tb.kind, tb.k, tb.exit, tb.gross], ['state', 30, 1000, 0]);
  const fin = nights(tb.t, tb.c) * FIN.xau.long * 1000 / 20;
  assert.ok(fin > 0 && Math.abs(tb.net - (-(RT / 20) - fin)) < 1e-12);
  const ts = trade(gold, j, -1, 30);
  assert.equal(ts.stop, 1020); assert.equal(ts.fin, 0); assert.ok(Math.abs(ts.net + RT / 20) < 1e-12);
  // gap through the stop fills at the open, a touch at the stop
  const g2 = gold.map((b) => ({ ...b })); g2[27] = { time: days[27], open: 970, high: 972, low: 965, close: 968 };
  assert.deepEqual([trade(g2, j, 1, 30).kind, trade(g2, j, 1, 30).exit], ['gap', 970]);
  const g3 = gold.map((b) => ({ ...b })); g3[27] = { time: days[27], open: 1000, high: 1001, low: 979, close: 999 };
  assert.deepEqual([trade(g3, j, 1, 30).kind, trade(g3, j, 1, 30).exit], ['stop', 980]);
  // no state exit: out at the close of candle MAX_HOLD, or left out when the data ends first
  assert.equal(trade(gold, 0 + 21, 1, null), null);
  const long = Array.from({ length: 120 }, (_, i) => bar(T0 + i * DAY, 1000));
  const tt = trade(long, 21, 1, null);
  assert.deepEqual([tt.kind, tt.k], ['time', 21 + MAX_HOLD - 1]);
});

test('simulate: entry only on a turn, one at a time, sides filter', () => {
  const days = weekdays(60), gold = days.map((t) => bar(t, 1000));
  const s = (arr) => arr.map((v, i) => ({ t: days[i], s: v }));
  const st = s([...Array(22).fill(null), 0, 1, 1, 1, 0, 0, -1, -1, 0, 1, 1, 1, 1, 1, 1, 0, ...Array(22).fill(0)]);
  const tr = simulate(st, gold);
  assert.deepEqual(tr.map((x) => [x.side, x.j, x.k]), [[1, 24, 27], [-1, 29, 31], [1, 32, 38]]);
  assert.deepEqual(simulate(st, gold, { sides: [-1] }).map((x) => x.j), [29]);
  // placebo keeps sides and lengths
  const p = placeboTrades(gold, tr, days[22], days[59], 3);
  assert.deepEqual(p.map((x) => x.side), tr.map((x) => x.side));
  assert.deepEqual(p.map((x) => x.k - x.j), tr.map((x) => x.k - x.j));
});

test('helpers: Holm and monthly sums', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const m = monthly([{ c: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { c: Date.UTC(2020, 2, 5) / 1000, net: 2 }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 2, 31) / 1000, 'net');
  assert.equal(m.months, 3); assert.equal(m.n, 3); assert.equal(m.sum, 3);
});

test('the report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  const verdictLine = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(verdictLine && verdictLine.length < 220, 'bold verdict line with its reason');
  assert.match(verdictLine, /FAIL, 0 of 3/);
  const sg = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(3);
  for (const t of r.tests) {
    assert.equal(t.pass, false);
    for (const w of ['is', 'oos']) {
      const x = t[w];
      const row = md.split('\n').find((l) => l.startsWith(`| ${t.id} `) && l.includes(` | ${x.n} `) && l.includes(`| ${sg(x.gross)} | ${sg(x.net)} | ${sg(x.x2)} |`));
      assert.ok(row, `${t.id} ${w} row`);
      assert.ok(row.includes(`| ${x.tMonth.toFixed(2)} (${x.tMonthGross.toFixed(2)}) |`), `${t.id} ${w} month t`);
      if (w === 'oos') assert.ok(row.includes(`| ${t.holm.toFixed(2)} | ${t.placebo.beaten} / 40 |`), `${t.id} Holm and placebo`);
    }
  }
  const t1 = r.tests.find((t) => t.id === 'T1');
  assert.ok(verdictLine.includes(`n ${t1.oos.n}`) && verdictLine.includes(`month t ${t1.oos.tMonth}`) && verdictLine.includes(`${t1.placebo.beaten} of 40`) && verdictLine.includes(sg(t1.oos.net)));
  assert.match(md, /not a gate, entry, exit or size of the live gold book/);
});
