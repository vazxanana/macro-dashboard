// research/edge/gold-copper-gauge: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DAY, RT, KEYS, LOOK, HOLD, TESTS, rows, sideOf, tradeAt, simulate, baseline, holm, normP, monthly, placeboDays, controlDays, rng,
} from '../research/edge/gold-copper-gauge/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const DIR = new URL('../research/edge/gold-copper-gauge/', import.meta.url);
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
function bars(n, fn, skip = () => false) {
  const out = []; let d = T0, i = 0;
  while (out.length < n) {
    const wd = new Date(d * 1000).getUTCDay();
    if (wd !== 0 && wd !== 6 && !skip(d)) { const c = fn(i++); out.push({ time: d, open: c, high: c + 1, low: c - 1, close: c }); }
    d += DAY;
  }
  return out;
}

test('pre-registered settings: gold and copper only, 20 rows, 5 candles, $0.60 a round trip, three tests', () => {
  assert.deepEqual(KEYS, ['xau', 'xcu']);
  assert.equal(LOOK, 20); assert.equal(HOLD, 5); assert.equal(RT, 0.6);
  assert.deepEqual(TESTS.map((t) => t.id), ['T1', 'T2', 'T3']);
});

test('rows: the ratio high / low against the 19 rows before, gold\'s own extreme, a day without copper has no row', () => {
  const g = bars(30, () => 100), c = bars(30, (i) => (i === 25 ? 50 : 60), (d) => d === T0 + 2 * DAY);
  const r = rows(g, c);
  assert.ok(!r.some((x) => x.t === T0 + 2 * DAY), 'no copper candle: no row');
  const day25 = r.find((x) => x.i === g.findIndex((b) => b.time === c[25].time));
  assert.ok(day25.hi && !day25.lo, 'copper falls: ratio high');
  assert.ok(!day25.ghi, 'gold flat: not at its own high');
  assert.equal(sideOf(day25, 'T1'), 1);
  assert.equal(sideOf(day25, 'T2'), 0);
  assert.equal(sideOf(day25, 'T3'), 1, 'copper-driven ratio high: buy');
  assert.equal(sideOf({ hi: true, ghi: true }, 'T3'), 0, 'gold at its own high: not copper-driven');
  assert.equal(sideOf({ lo: true, glo: false }, 'T3'), -1);
  assert.equal(sideOf({ lo: true }, 'T2'), -1);
});

test('no look-ahead: changing a later candle never changes an earlier row', () => {
  const g = bars(60, (i) => 100 + Math.sin(i * 0.7) * 5), c1 = bars(60, (i) => 50 + Math.cos(i * 0.4) * 3);
  const c2 = c1.map((b, i) => (i === 45 ? { ...b, close: 10 } : b)), g2 = g.map((b, i) => (i === 45 ? { ...b, close: 500 } : b));
  const before = (r) => r.filter((x) => x.t < g[45].time);
  assert.deepEqual(before(rows(g, c1)), before(rows(g2, c2)));
});

test('trade: next day\'s open, stop 2 x ATR(20), 5 candles, gap fill at the open, $0.60 + financing on buys only', () => {
  const g = bars(40, () => 100);
  const tr = tradeAt(g, 25, 1);
  assert.equal(tr.risk, 4); assert.equal(tr.kind, 'time'); assert.equal(tr.k, 29);
  const fin = nights(tr.t, tr.c) * FIN.xau.long * 100 / 4;
  assert.ok(Math.abs(tr.net - (0 - 0.6 / 4 - fin)) < 1e-12);
  const sh = tradeAt(g, 25, -1);
  assert.ok(Math.abs(sh.net + 0.15) < 1e-12, 'sells pay no financing');
  const gp = g.map((b) => ({ ...b })); gp[27] = { ...gp[27], open: 90, low: 89, high: 91, close: 90 };
  const tg = tradeAt(gp, 25, 1);
  assert.equal(tg.kind, 'gap'); assert.equal(tg.exit, 90);
  // one at a time: signal day i enters at i + 1; a second signal inside an open trade is skipped
  const s = simulate([{ t: g[24].time, i: 24, s: 1 }, { t: g[26].time, i: 26, s: 1 }, { t: g[31].time, i: 31, s: -1 }], g);
  assert.equal(s.length, 2); assert.equal(s[0].j, 25);
  const b = baseline(g, [{ i: 24 }, { i: 26 }], 1);
  assert.equal(b.n, 2, 'the baseline overlaps');
});

test('statistics: Holm, normal p, empty months as zero, seeded placebo and same-year control repeat', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(normP(1.96) - 0.025) < 1e-3);
  const m = monthly([{ c: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { c: Date.UTC(2020, 2, 5) / 1000, net: 1 }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 2, 31) / 1000, 'net');
  assert.equal(m.months, 3); assert.ok(Math.abs(m.mean - 2 / 3) < 1e-12);
  const el = Array.from({ length: 30 }, (_, i) => ({ t: Date.UTC(2019 + (i % 2), 3, 1 + i) / 1000, i }));
  assert.deepEqual(placeboDays(el, [1, -1, 1], rng(7)), placeboDays(el, [1, -1, 1], rng(7)));
  const tr = [{ sig: Date.UTC(2019, 5, 1) / 1000, side: 1 }, { sig: Date.UTC(2020, 5, 1) / 1000, side: -1 }];
  const c = controlDays(el, tr, rng(101));
  assert.deepEqual(c, controlDays(el, tr, rng(101)));
  assert.deepEqual(c.map((x) => new Date(x.t * 1000).getUTCFullYear()).sort(), [2019, 2020], 'same calendar year');
});

test('the report matches result.json, and the verdict follows the pre-registered bar', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  const head = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(head.length < 220 && head.includes('FAIL, 0 of 3'));
  const f = (v) => (v < 0 ? '-' : '+') + Math.abs(v).toFixed(3);
  for (const t of r.tests) {
    assert.equal(t.pass, false);
    assert.equal(t.placebo.seeds, 40); assert.equal(t.control.seeds, 40);
    assert.ok(md.includes(`| ${t.id} | ${t.p} | ${t.holm} | ${t.placebo.beaten} (`), t.id + ' row');
    assert.ok(md.includes(`| ${t.control.beaten} (median`), t.id + ' control');
    for (const w of ['is', 'oos']) {
      const x = t[w];
      assert.ok(x.n >= 100, `${t.id} ${w} n >= 100`);
      assert.ok(md.includes(`${x.n} (${x.longs.n} / ${x.shorts.n})`), `${t.id} ${w} n`);
      assert.ok(md.includes(`| ${f(x.gross)} | ${f(x.net)} | ${f(x.x2)} |`), `${t.id} ${w} R`);
      assert.ok(md.includes(`| ${f(x.excess)} | ${f(x.x2Excess)} | ${x.tMonth.toFixed(2)} | ${x.tMonthExcess.toFixed(2)} |`), `${t.id} ${w} excess`);
    }
  }
  const t1 = r.tests[0];
  assert.ok(head.includes(t1.oos.excess.toFixed(3)) && head.includes(`n ${t1.oos.n}`) && head.includes(`t ${t1.oos.tMonthExcess.toFixed(2)}`));
});
