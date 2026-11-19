// research/edge/gold-driven-day: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { returns, signals, kindOf, inPool, tradeAt, simulate, entryIndex, summarize, holm, DAY, RT, STOP_ATR, LOOK } from '../research/edge/gold-driven-day/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const DIR = new URL('../research/edge/gold-driven-day/', import.meta.url);
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
const weekdays = (n) => { const out = []; for (let t = T0; out.length < n; t += DAY) { const wd = new Date(t * 1000).getUTCDay(); if (wd && wd !== 6) out.push(t); } return out; };
const bar = (time, c, w = 2) => ({ time, open: c, high: c + w, low: c - w, close: c });

test('signal: gold-driven = same sign beyond 0.5 sd in USD, EUR and GBP; dollar-driven up = USD up, EUR and GBP down', () => {
  const days = weekdays(30), wig = (i, a) => 1 + (i % 2 ? a : -a);
  const usd = days.map((t, i) => bar(t, 1000 * wig(i, 0.005))), eur = days.map((t, i) => bar(t, 900 * wig(i, 0.004))), gbp = days.map((t, i) => bar(t, 800 * wig(i, 0.006)));
  usd[25] = bar(days[25], usd[24].close * 1.03); eur[25] = bar(days[25], eur[24].close * 1.02); gbp[25] = bar(days[25], gbp[24].close * 1.025);
  usd[27] = bar(days[27], usd[26].close * 1.02); eur[27] = bar(days[27], eur[26].close * 0.999); gbp[27] = bar(days[27], gbp[26].close * 0.998);
  const rows = signals(returns(usd, eur, gbp));
  assert.equal(rows[0].t, days[LOOK + 1], 'first row needs 20 earlier returns');
  assert.equal(kindOf(rows.find((r) => r.t === days[25])), 'goldUp');
  assert.equal(kindOf(rows.find((r) => r.t === days[27])), 'dollarUp');
  assert.equal(kindOf({ zu: -0.6, ze: -0.7, zg: -0.9 }), 'goldDown');
  assert.equal(kindOf({ zu: 0.6, ze: 0.7, zg: 0.3 }), null);
  assert.equal(kindOf({ zu: 0.6, ze: -0.1, zg: 0.2 }), null);
  assert.ok(inPool({ zu: 0.6 }, 'usdUp') && !inPool({ zu: 0.4 }, 'usdUp') && inPool({ zu: -0.6 }, 'usdDown'));
  // a day missing in one currency is left out
  assert.equal(signals(returns(usd, eur.filter((b) => b.time !== days[25]), gbp)).find((r) => r.t === days[25]), undefined);
  // no look-ahead: changing every price after day 25 leaves the rows up to day 25 unchanged
  const bump = (a, f) => a.map((b, i) => (i > 25 ? bar(b.time, b.close * f) : b));
  const rows2 = signals(returns(bump(usd, 1.5), bump(eur, 0.7), bump(gbp, 1.2)));
  for (const r of rows.filter((x) => x.t <= days[25])) assert.deepEqual(rows2.find((x) => x.t === r.t), r);
});

test('trade: next open, stop 1.5 x ATR(14) on the losing side, 3 candles, costs and financing on buys', () => {
  const days = weekdays(30), gold = days.map((t) => bar(t, 1000, 5));   // true range 10 every day
  const j = entryIndex(gold, days[18]);
  assert.equal(j, 19);
  const tb = tradeAt(gold, j, 1);
  assert.equal(tb.risk, STOP_ATR * 10); assert.equal(tb.stop, 985); assert.equal(tb.k, j + 2);
  assert.equal(tb.kind, 'time'); assert.equal(tb.gross, 0);
  const fin = nights(tb.t, tb.c) * FIN.xau.long * 1000 / 15;
  assert.ok(fin > 0 && Math.abs(tb.net - (-(RT / 15) - fin)) < 1e-12);
  const ts = tradeAt(gold, j, -1);
  assert.equal(ts.stop, 1015); assert.equal(ts.fin, 0); assert.ok(Math.abs(ts.net + RT / 15) < 1e-12);
  const g2 = gold.map((b) => ({ ...b })); g2[20] = { time: days[20], open: 980, high: 981, low: 975, close: 978 };
  assert.deepEqual([tradeAt(g2, j, 1).kind, tradeAt(g2, j, 1).exit], ['gap', 980]);
  const g3 = gold.map((b) => ({ ...b })); g3[21] = { time: days[21], open: 1000, high: 1001, low: 980, close: 999 };
  assert.deepEqual([tradeAt(g3, j, 1).kind, tradeAt(g3, j, 1).exit], ['stop', 985]);
  const tr = simulate([{ t: days[18], s: 1 }, { t: days[19], s: 1 }, { t: days[22], s: 1 }], gold);
  assert.deepEqual(tr.map((x) => x.j), [19, 23]);
});

test('excess = net minus the baseline mean, month sums, Holm', () => {
  const c1 = Date.UTC(2020, 0, 10) / 1000, c2 = Date.UTC(2020, 2, 10) / 1000;
  const s = summarize([{ c: c1, net: 0.3, gross: 0.4, cost: 0.1, risk: 10, kind: 'time' }, { c: c2, net: -0.1, gross: 0, cost: 0.1, risk: 10, kind: 'stop' }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 2, 31) / 1000, 0.05);
  assert.equal(s.n, 2); assert.equal(s.net, 0.1); assert.equal(s.excess, 0.05); assert.equal(s.months, 3); assert.equal(s.stops, 1);
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
      const row = md.split('\n').find((l) => l.includes(`| ${x.n} |`) && l.includes(`| ${sg(x.net)} |`) && l.includes(`| ${sg(x.excess)} |`));
      assert.ok(row, `${t.id} ${w} row with n ${x.n}, net ${sg(x.net)}, excess ${sg(x.excess)}`);
      assert.ok(row.includes(`**${x.tExcess.toFixed(2)}**`) && row.includes(`| ${x.tMonth.toFixed(2)} |`), `${t.id} ${w} month t`);
    }
    assert.ok(md.includes(`| ${t.id} | ${t.oos.tExcess.toFixed(2)} | ${t.placebo.beaten} |`), `${t.id} placebo row`);
    assert.ok(md.includes(t.holm.toFixed(3)), `${t.id} Holm p`);
  }
  const t1 = r.tests.find((t) => t.id === 'T1');
  assert.ok(verdictLine.includes(`n ${t1.oos.n}`) && verdictLine.includes(`excess month t ${t1.oos.tExcess}`) && verdictLine.includes(`Holm p ${t1.holm}`));
  assert.match(md, /not a gate, entry, exit or size of the live gold book/);
});
