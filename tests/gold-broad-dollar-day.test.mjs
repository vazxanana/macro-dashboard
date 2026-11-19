// research/edge/gold-broad-dollar-day: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { returns, signals, kindsOf, tradeAt, simulate, entryIndex, dxyIndex, baselineByYear, withExcess, holm, DAY, RT, STOP_ATR, HOLD, LOOK, PAIRS } from '../research/edge/gold-broad-dollar-day/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const DIR = new URL('../research/edge/gold-broad-dollar-day/', import.meta.url);
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
const weekdays = (n) => { const out = []; for (let t = T0; out.length < n; t += DAY) { const wd = new Date(t * 1000).getUTCDay(); if (wd && wd !== 6) out.push(t); } return out; };
const bar = (time, c, w = 2) => ({ time, open: c, high: c + w, low: c - w, close: c });
const BASE = { eurusd: 1.1, gbpusd: 1.3, audusd: 0.7, usdjpy: 110, usdcad: 1.3, usdchf: 0.95 };
const SIGN = { eurusd: -1, gbpusd: -1, audusd: -1, usdjpy: 1, usdcad: 1, usdchf: 1 };

function market(n, strong = {}) {
  const days = weekdays(n);
  const fx = Object.fromEntries(PAIRS.map((k) => [k, days.map((t, i) => {
    const wig = (i % 2 ? 1 : -1) * 0.002 * ((PAIRS.indexOf(k) % 2) ? 1 : -1);   // pairs disagree on ordinary days
    const s = strong[i] ? SIGN[k] * strong[i] * 0.01 : 0;
    return { time: t, open: BASE[k], high: BASE[k] * 1.01, low: BASE[k] * 0.99, close: BASE[k] * (1 + wig + s) };
  })]));
  const gold = days.map((t, i) => bar(t, 1000 * (1 + (i % 2 ? 0.003 : -0.003))));
  return { days, fx, gold };
}

test('signal: all six pairs the dollar\'s way AND the index beyond 1 sd of the 20 returns BEFORE the day', () => {
  const { days, fx, gold } = market(32, { 25: 1, 28: -1 });
  const rows = signals(returns(gold, dxyIndex(fx), fx));
  assert.equal(rows[0].t, days[LOOK + 1], 'first row needs 20 earlier returns');
  const r25 = rows.find((r) => r.t === days[25]), r28 = rows.find((r) => r.t === days[28]);
  assert.equal(r25.up, 6); assert.ok(kindsOf(r25).includes('up'));
  assert.equal(r28.dn, 6); assert.ok(kindsOf(r28).includes('down'));
  for (const r of rows.filter((x) => x.t !== days[25] && x.t !== days[28] && x.t !== days[26] && x.t !== days[29])) assert.deepEqual(kindsOf(r), []);
  // five of six is not broad; the index must move > 1 sd; T3 needs gold down too
  assert.deepEqual(kindsOf({ up: 5, dn: 1, zd: 3, zg: 0 }), []);
  assert.deepEqual(kindsOf({ up: 6, dn: 0, zd: 0.9, zg: 0 }), []);
  assert.deepEqual(kindsOf({ up: 6, dn: 0, zd: 1.5, zg: -0.6 }), ['up', 'upGoldDown']);
  assert.deepEqual(kindsOf({ up: 6, dn: 0, zd: 1.5, zg: -0.4 }), ['up']);
  // no look-ahead: changing every price after day 25 leaves the rows up to day 25 unchanged
  const fx2 = Object.fromEntries(PAIRS.map((k) => [k, fx[k].map((b, i) => (i > 25 ? { ...b, close: b.close * 1.3 } : b))]));
  const g2 = gold.map((b, i) => (i > 25 ? bar(b.time, b.close * 1.5) : b));
  const rows2 = signals(returns(g2, dxyIndex(fx2), fx2));
  for (const r of rows.filter((x) => x.t <= days[25])) assert.deepEqual(rows2.find((x) => x.t === r.t), r);
});

test('trade: next open, stop 2 x ATR(14), five candles, costs and financing on buys', () => {
  const days = weekdays(40), gold = days.map((t) => bar(t, 1000, 5));   // true range 10 every day
  const j = entryIndex(gold, days[18]);
  assert.equal(j, 19);
  const tb = tradeAt(gold, j, 1);
  assert.equal(tb.risk, STOP_ATR * 10); assert.equal(tb.stop, 980); assert.equal(tb.k, j + HOLD - 1);
  assert.equal(tb.kind, 'time'); assert.equal(tb.gross, 0);
  const fin = nights(tb.t, tb.c) * FIN.xau.long * 1000 / 20;
  assert.ok(Math.abs(tb.net - (-(RT / 20) - fin)) < 1e-12);
  const ts = tradeAt(gold, j, -1);
  assert.equal(ts.stop, 1020); assert.equal(ts.fin, 0); assert.ok(Math.abs(ts.net + RT / 20) < 1e-12);
  const g2 = gold.map((b) => ({ ...b })); g2[21] = { time: days[21], open: 975, high: 976, low: 970, close: 972 };
  assert.deepEqual([tradeAt(g2, j, 1).kind, tradeAt(g2, j, 1).exit], ['gap', 975]);
  // one at a time
  const tr = simulate([{ t: days[18], s: 1 }, { t: days[20], s: 1 }, { t: days[24], s: 1 }], gold);
  assert.deepEqual(tr.map((x) => x.j), [19, 25]);
});

test('excess: net minus the same-side every-day baseline of the entry year', () => {
  const days = weekdays(40), gold = days.map((t, i) => bar(t, 1000 + i, 5));
  const base = baselineByYear(days.map((t) => ({ t })), gold, 1);
  const tr = withExcess(simulate([{ t: days[18], s: 1 }], gold), base);
  assert.ok(Math.abs(tr[0].excess - (tr[0].net - base.mean['2020'])) < 1e-12);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('the report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  const verdictLine = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(verdictLine && verdictLine.length < 220, 'bold verdict line with its reason, under 220 characters');
  assert.match(verdictLine, /FAIL, 0 of 3/);
  const sg = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(3);
  for (const t of r.tests) {
    assert.equal(t.pass, false);
    for (const w of ['is', 'oos']) {
      const x = t[w];
      const row = md.split('\n').find((l) => l.includes(`| ${x.signals} | ${x.n} |`) && l.includes(`| ${sg(x.net)} |`) && l.includes(`| ${sg(x.excess)} |`));
      assert.ok(row, `${t.id} ${w} row`);
      assert.ok(row.includes(x.tExcess.toFixed(2)) && row.includes(x.tMonth.toFixed(2)), `${t.id} ${w} t values`);
    }
    assert.ok(md.includes(`| ${t.id} | ${t.oos.tExcess.toFixed(2)} | ${t.oos.placebo.beaten} |`), `${t.id} placebo row`);
    assert.ok(md.includes(`| ${t.oos.control.beaten} | ${t.oos.control.median.toFixed(2)}`), `${t.id} control`);
    assert.ok(md.includes(t.holm.toFixed(3)), `${t.id} Holm p`);
  }
  const t1 = r.tests.find((t) => t.id === 'T1');
  assert.ok(verdictLine.includes(`n ${t1.oos.n}`) && verdictLine.includes(`excess month t ${t1.oos.tExcess}`));
  assert.match(md, /not a gate, entry, exit or size of the live gold book/);
});
