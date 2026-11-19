// research/edge/gold-carry-crash: the rule on hand-made candles, no look-ahead, the same-year baseline, and the report
// against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { returns, signals, kindOf, tradeAt, simulate, entryIndex, holm, monthly, baselineByYear, withExcess, TESTS, DAY, RT, STOP_ATR, LOOK, K, PIN } from '../research/edge/gold-carry-crash/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const DIR = new URL('../research/edge/gold-carry-crash/', import.meta.url);
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
const weekdays = (n, t0 = T0) => { const out = []; for (let t = t0; out.length < n; t += DAY) { const wd = new Date(t * 1000).getUTCDay(); if (wd && wd !== 6) out.push(t); } return out; };
const bar = (time, c, w = 2) => ({ time, open: c, high: c + w, low: c - w, close: c });

test('signal: the AUD/JPY return beyond 1.5 sd of the 20 returns BEFORE the day', () => {
  assert.equal(K, 1.5); assert.equal(LOOK, 20);
  const days = weekdays(30);
  const aj = days.map((t, i) => ({ time: t, close: 80 * (1 + (i % 2 ? 0.003 : -0.003)) }));
  aj[25] = { time: days[25], close: aj[24].close * 0.98 };   // carry crash (AUD/JPY falls 2 %)
  const rows = signals(returns(aj));
  assert.equal(rows[0].t, days[LOOK + 1], 'first row needs 20 earlier returns');
  assert.equal(kindOf(rows.find((r) => r.t === days[25])), 'crash');
  assert.equal(kindOf({ z: 1.6 }), 'rally');
  assert.equal(kindOf({ z: -1.4 }), null);
  assert.equal(kindOf({ z: -1.5 }), null);
  // no look-ahead: changing every price after day 25 leaves the rows up to day 25 unchanged
  const aj2 = aj.map((b, i) => (i > 25 ? { ...b, close: b.close * 1.3 } : b));
  const rows2 = signals(returns(aj2));
  for (const r of rows.filter((x) => x.t <= days[25])) assert.deepEqual(rows2.find((x) => x.t === r.t), r);
  // a hole of more than 5 days restarts the history
  const holed = aj.map((b, i) => (i >= 10 ? { ...b, time: b.time + 10 * DAY } : b));
  assert.ok(signals(returns(holed)).every((r) => r.t > days[10] + 10 * DAY + LOOK * DAY));
});

test('the tests are the pre-registered three', () => {
  assert.deepEqual(TESTS.map((t) => [t.id, t.kind, t.side, t.hold]), [['T1', 'crash', 1, 5], ['T2', 'rally', -1, 5], ['T3', 'crash', 1, 10]]);
  assert.equal(PIN, 'd8d68407bae5e7df75e54d57e4877dea340cc705');
});

test('trade: next open, stop 1.5 x ATR(14) on the losing side, costs and financing on buys', () => {
  const days = weekdays(30), gold = days.map((t) => bar(t, 1000, 5));   // true range 10 every day
  const j = entryIndex(gold, days[18]);
  assert.equal(j, 19, 'entry is the first candle after the signal day');
  const tb = tradeAt(gold, j, 1, 5);
  assert.equal(tb.risk, STOP_ATR * 10); assert.equal(tb.stop, 1000 - 15);
  assert.equal(tb.kind, 'time'); assert.equal(tb.gross, 0); assert.equal(tb.k, j + 4);
  const fin = nights(tb.t, tb.c) * FIN.xau.long * 1000 / 15;
  assert.ok(fin > 0);
  assert.ok(Math.abs(tb.net - (-(RT / 15) - fin)) < 1e-12);
  const ts = tradeAt(gold, j, -1, 5);
  assert.equal(ts.stop, 1015); assert.equal(ts.fin, 0); assert.ok(Math.abs(ts.net + RT / 15) < 1e-12);
  // every trade has a stop, and the ATR reads only candles before the entry
  const g1 = gold.map((b, i) => (i >= j ? bar(b.time, 1000, 50) : b));
  assert.equal(tradeAt(g1, j, 1, 5).risk, 15);
  // a gap through the stop fills at the open; a touch at the stop
  const g2 = gold.map((b) => ({ ...b })); g2[20] = { time: days[20], open: 980, high: 981, low: 975, close: 978 };
  assert.deepEqual([tradeAt(g2, j, 1, 5).kind, tradeAt(g2, j, 1, 5).exit], ['gap', 980]);
  const g3 = gold.map((b) => ({ ...b })); g3[21] = { time: days[21], open: 1000, high: 1001, low: 980, close: 999 };
  assert.deepEqual([tradeAt(g3, j, 1, 5).kind, tradeAt(g3, j, 1, 5).exit], ['stop', 985]);
  // one at a time: a second signal while the first trade is open is skipped
  const tr = simulate([{ t: days[17], s: 1 }, { t: days[18], s: 1 }, { t: days[22], s: 1 }], gold, 5);
  assert.deepEqual(tr.map((x) => x.j), [18, 23]);
});

test('baseline: the same-side trade on every day of the same year; excess subtracts that year only', () => {
  const d19 = weekdays(70, Date.UTC(2019, 10, 4) / 1000);   // Nov 2019 into Jan 2020
  const n19 = d19.filter((t) => new Date(t * 1000).getUTCFullYear() === 2019).length;
  const gold = d19.map((t, i) => bar(t, 1000 + (i < n19 ? i : 2 * n19 - i), 5));   // up through 2019, down in 2020
  const days = d19.slice(15, 60).map((t) => ({ t }));
  const base = baselineByYear(days, gold, 1, 2);
  assert.deepEqual(Object.keys(base), ['2019', '2020']);
  assert.ok(base[2019].net > base[2020].net, 'the rising 2019 days have the better baseline');
  const all = simulate(days.map((d) => ({ t: d.t, s: 1 })), gold, 2, { oneAtATime: false });
  const y19 = all.filter((x) => new Date(x.t * 1000).getUTCFullYear() === 2019);
  assert.equal(base[2019].n, y19.length);
  assert.ok(Math.abs(base[2019].net - y19.reduce((p, x) => p + x.net, 0) / y19.length) < 1e-12);
  const ex = withExcess(all, base);
  for (const x of ex) assert.ok(Math.abs(x.excess - (x.net - base[new Date(x.t * 1000).getUTCFullYear()].net)) < 1e-12);
});

test('helpers: Holm, monthly sums with empty months', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const m = monthly([{ c: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { c: Date.UTC(2020, 2, 5) / 1000, net: 2 }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 2, 31) / 1000, 'net');
  assert.equal(m.months, 3); assert.equal(m.n, 3); assert.equal(m.sum, 3);
});

test('the report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  assert.equal(r.councilData, PIN);
  assert.ok(pre.includes(PIN));
  const verdictLine = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(verdictLine && verdictLine.length < 220, 'bold verdict line with its reason, under 220 characters');
  assert.match(verdictLine, /FAIL, 0 of 3/);
  const sg = (v, d = 3) => (v > 0 ? '+' : v < 0 ? '−' : '+') + Math.abs(v).toFixed(d);
  for (const t of r.tests) {
    assert.equal(t.pass, false);
    for (const w of ['is', 'oos']) {
      const x = t[w];
      const row = md.split('\n').find((l) => l.includes(`| ${x.n} |`) && l.includes(`| ${sg(x.net)} |`) && l.includes(`| ${sg(x.gross)} |`));
      assert.ok(row, `${t.id} ${w} row with n ${x.n} and net ${sg(x.net)}`);
      for (const v of [sg(x.tMonth, 2), sg(x.tMonthGross, 2), sg(x.tExcess, 2), sg(x.excess), sg(x.x2), sg(x.baseline.net)]) assert.ok(row.includes(`| ${v} |`), `${t.id} ${w} ${v}`);
    }
    assert.ok(md.includes(`| ${t.id} | ${sg(t.placebo.p5, 2)} | ${sg(t.placebo.median, 2)} | ${sg(t.placebo.p95, 2)} | ${sg(t.oos.tExcess, 2)} | ${t.placebo.beaten} of 40 |`), `${t.id} placebo row`);
  }
  const t1 = r.tests.find((t) => t.id === 'T1');
  assert.ok(verdictLine.includes(`n ${t1.oos.n}`) && verdictLine.includes(`month t ${t1.oos.tExcess}`) && verdictLine.includes(sg(t1.oos.excess)));
  assert.ok(verdictLine.includes(`Holm p ${t1.holm.toFixed(2)}`));
  assert.deepEqual(r.context, { is: { days: 2605, crash: 216, rally: 182 }, oos: { days: 2563, crash: 191, rally: 177 } });
  assert.ok(pre.includes('216 crash and 182 rally') && pre.includes('191 crash and 177 rally'), 'the counted events are those pre-registered');
  assert.match(md, /not a gate, entry, exit or size of the live gold book/);
});
