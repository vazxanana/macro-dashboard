// research/edge/gold-yuan-hedge: the rule on hand-made data, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { returns, signals, sideOf, olsBeta, tradeAt, simulate, entryIndex, holm, DAY, RT, STOP_ATR, BETA_N, WIN } from '../research/edge/gold-yuan-hedge/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const DIR = new URL('../research/edge/gold-yuan-hedge/', import.meta.url);
const T0 = Date.UTC(2015, 0, 5) / 1000;   // a Monday
const weekdays = (n) => { const out = []; for (let t = T0; out.length < n; t += DAY) { const wd = new Date(t * 1000).getUTCDay(); if (wd && wd !== 6) out.push(t); } return out; };
const bar = (time, c, w = 2) => ({ time, open: c, high: c + w, low: c - w, close: c });

test('beta and the yuan-specific z use only the returns before the day', () => {
  assert.ok(Math.abs(olsBeta([2, 4, 6], [1, 2, 3]) - 2) < 1e-12);
  const N = BETA_N + 40, days = weekdays(N);
  // dollar wiggles; CNH = 0.5 x dollar + its own noise; then a yuan-only weakening over the last 20 days
  let d = 100, c = 6.5; const dxy = [], cnh = [], gold = [];
  for (let i = 0; i < N; i++) {
    const rd = Math.sin(i * 1.7) * 0.003, own = Math.cos(i * 2.3) * 0.0005 + (i >= N - WIN ? 0.002 : 0);
    d *= Math.exp(rd); c *= Math.exp(0.5 * rd + own);
    dxy.push({ time: days[i], close: d }); cnh.push({ time: days[i], close: c }); gold.push(bar(days[i], 1500));
  }
  const rows = signals(returns(gold, cnh, dxy));
  assert.equal(rows[0].t, days[BETA_N + 1], 'first row needs 250 earlier returns');
  const last = rows[rows.length - 1];
  assert.ok(Math.abs(last.beta - 0.5) < 0.05, 'beta near the built-in 0.5');
  assert.equal(sideOf(last), 1, 'yuan weak on its own: buy gold');
  assert.equal(sideOf({ z: -1.6 }), -1); assert.equal(sideOf({ z: 1.4 }), 0);
  // no look-ahead: changing every price after day k leaves rows up to day k unchanged
  const k = N - 10, cnh2 = cnh.map((b, i) => (i > k ? { ...b, close: b.close * 1.2 } : b)), dxy2 = dxy.map((b, i) => (i > k ? { ...b, close: b.close * 0.8 } : b));
  const rows2 = signals(returns(gold, cnh2, dxy2));
  for (const r of rows.filter((x) => x.t <= days[k])) assert.deepEqual(rows2.find((x) => x.t === r.t), r);
});

test('trade: next open, stop 2 x ATR(20) on the losing side, costs and financing on buys, one at a time', () => {
  const days = weekdays(80), gold = days.map((t) => bar(t, 1000, 10));   // true range 20 every day
  const j = entryIndex(gold, days[24]);
  assert.equal(j, 25);
  const tb = tradeAt(gold, j, 1, 20);
  assert.equal(tb.risk, STOP_ATR * 20); assert.equal(tb.stop, 960);
  assert.equal(tb.kind, 'time'); assert.equal(tb.gross, 0);
  const fin = nights(tb.t, tb.c) * FIN.xau.long * 1000 / 40;
  assert.ok(Math.abs(tb.net - (-(RT / 40) - fin)) < 1e-12);
  const ts = tradeAt(gold, j, -1, 20);
  assert.equal(ts.stop, 1040); assert.equal(ts.fin, 0); assert.ok(Math.abs(ts.net + RT / 40) < 1e-12);
  const g2 = gold.map((b) => ({ ...b })); g2[27] = { time: days[27], open: 950, high: 951, low: 940, close: 945 };
  assert.deepEqual([tradeAt(g2, j, 1, 20).kind, tradeAt(g2, j, 1, 20).exit], ['gap', 950]);
  const tr = simulate([{ t: days[24], s: 1 }, { t: days[30], s: -1 }, { t: days[45], s: -1 }], gold, 20);
  assert.deepEqual(tr.map((x) => x.j), [25, 46]);
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
      const x = t[w], row = md.split('\n').find((l) => l.includes(`| ${x.n} | ${sg(x.gross)} | ${sg(x.net)} | ${sg(x.x2)} | ${x.tMonth.toFixed(2)} |`));
      assert.ok(row, `${t.id} ${w} row`);
      assert.ok(row.includes(`$${x.medianStop.toFixed(2)}`), `${t.id} ${w} median stop`);
      assert.ok(x.medianStop >= 10);
    }
    assert.ok(md.includes(`| ${t.id} | ${t.oos.tMonth.toFixed(2)} | ${t.placebo.beaten} |`), `${t.id} placebo row`);
    assert.ok(md.includes(t.holm.toFixed(3)), `${t.id} Holm p`);
  }
  const t1 = r.tests.find((t) => t.id === 'T1');
  assert.ok(verdictLine.includes(`n ${t1.oos.n}`) && verdictLine.includes(`month t ${t1.oos.tMonth}`) && verdictLine.includes(`${t1.placebo.beaten} of 40`));
  assert.ok(md.includes(`| T1 OOS | ${t1.oos.buys.n}, ${sg(t1.oos.buys.net)} | ${sg(t1.oos.baseBuy.net)} | ${t1.oos.sells.n}, ${sg(t1.oos.sells.net)} | ${sg(t1.oos.baseSell.net)} |`));
  assert.match(md, /not a gate, entry, exit or size of the live gold book/);
});
