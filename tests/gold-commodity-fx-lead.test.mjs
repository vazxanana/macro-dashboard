// research/edge/gold-commodity-fx-lead: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DAY, RT, CC, KEYS, TESTS, levels, weeks, signals, sideOf, entryIndex, tradeAt, simulate, holm, normP, monthly, placeboDays, rng,
} from '../research/edge/gold-commodity-fx-lead/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const DIR = new URL('../research/edge/gold-commodity-fx-lead/', import.meta.url);
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

test('the market set is the pre-registered one: AUD, NZD, CAD, ZAR in USD terms, and the six dollar-index pairs', () => {
  assert.deepEqual(CC, [['audusd', 1], ['nzdusd', 1], ['usdcad', -1], ['usdzar', -1]]);
  for (const k of ['xau', 'audusd', 'nzdusd', 'usdcad', 'usdzar', 'eurusd', 'usdjpy', 'gbpusd', 'usdsek', 'usdchf']) assert.ok(KEYS.includes(k));
  assert.equal(RT, 0.6);
});

test('levels: CC is the mean of the four log prices (USD-quoted ones inverted), a day only when every pair has a close', () => {
  const one = (c, skip) => bars(5, () => c, skip);
  const fx = { audusd: one(0.7), nzdusd: one(0.6), usdcad: one(1.35), usdzar: one(18, (d) => d === T0 + DAY), eurusd: one(1.1), usdjpy: one(150), gbpusd: one(1.3), usdsek: one(10.5), usdchf: one(0.9) };
  const lv = levels(fx);
  assert.ok(!lv.has(T0 + DAY), 'ZAR missing: no value that day');
  const want = (Math.log(0.7) + Math.log(0.6) - Math.log(1.35) - Math.log(18)) / 4;
  assert.ok(Math.abs(lv.get(T0).cc - want) < 1e-12);
  const dx = Math.log(50.14348112 * 1.1 ** -0.576 * 150 ** 0.136 * 1.3 ** -0.119 * 1.35 ** 0.091 * 10.5 ** 0.042 * 0.9 ** 0.036);
  assert.ok(Math.abs(lv.get(T0).dxy - dx) < 1e-12);
});

test('weekly rows: gold\'s last day of the week, CC / DXY on that same day; a week without them is skipped', () => {
  const g = bars(20, (i) => 100 + i);
  const lv = new Map(g.filter((b) => b.time !== T0 + 11 * DAY).map((b, i) => [b.time, { cc: i * 0.01, dxy: -i * 0.005 }]));
  const w = weeks(g, lv);
  assert.ok(w.every((x) => new Date(x.t * 1000).getUTCDay() === 5));
  assert.ok(!w.some((x) => x.t === T0 + 11 * DAY));
});

test('signals use only the weeks before: changing a later week never changes an earlier row; a gap restarts history', () => {
  const mk = (n, bump) => Array.from({ length: n }, (_, i) => ({ t: T0 + i * 7 * DAY, c: Math.sin(i * 1.3) * 0.01 + (i === 70 ? bump : 0), d: Math.cos(i * 0.7) * 0.008, brk: false }));
  const a = signals(mk(80, 0)), b = signals(mk(80, 0.5));
  const before = (r) => r.filter((x) => x.t < T0 + 70 * 7 * DAY);
  assert.deepEqual(before(a), before(b));
  assert.equal(a[0].t, T0 + 52 * 7 * DAY, 'needs 52 earlier weeks');
  assert.equal(a[0].zm, null, 'the month form needs 4 rows');
  assert.ok(a[3].zm != null && Math.abs(a[3].zm - (a[0].e + a[1].e + a[2].e + a[3].e) / (2 * a[3].sdE)) < 1e-12);
  const p = mk(120, 0); p[60].brk = true;
  assert.ok(!signals(p).some((x) => x.t >= p[60].t && x.t < p[112].t));
});

test('residual removes the dollar: CC that is an exact multiple of the dollar gives no residual signal, the raw form does', () => {
  const w = Array.from({ length: 60 }, (_, i) => { const d = Math.sin(i * 0.9) * 0.01; return { t: T0 + i * 7 * DAY, c: -0.8 * d + (i === 55 ? 0 : 1e-6 * Math.cos(i * 2.1)), d: i === 55 ? -0.05 : d, brk: false }; });
  w[55].c = -0.8 * w[55].d;   // a big CC week fully explained by a big dollar fall
  const r = signals(w).find((x) => x.t === w[55].t);
  assert.equal(sideOf(r, 'zc'), 1, 'raw: CC up beyond 1 sd');
  assert.ok(Math.abs(r.e) < 1e-4 && Math.abs(r.beta + 0.8) < 1e-3);
  assert.equal(sideOf({ ze: 1.2 }, 'ze'), 1);
  assert.equal(sideOf({ ze: -1.2 }, 'ze'), -1);
  assert.equal(sideOf({ ze: 0.9 }, 'ze'), 0);
  assert.equal(sideOf({ zm: null }, 'zm'), 0);
});

test('trade: entry the next day\'s open, stop k x ATR(20), gap fill at the open, $0.60 + financing on longs', () => {
  const g = bars(40, () => 100);
  const j = entryIndex(g, g[24].time);
  assert.equal(j, 25);
  const tr = tradeAt(g, j, 1, 5, 2);
  assert.equal(tr.risk, 4); assert.equal(tr.kind, 'time');
  const fin = nights(tr.t, tr.c) * FIN.xau.long * 100 / 4;
  assert.ok(Math.abs(tr.net - (0 - 0.6 / 4 - fin)) < 1e-12);
  const sh = tradeAt(g, j, -1, 5, 3);
  assert.equal(sh.risk, 6); assert.ok(Math.abs(sh.net + 0.1) < 1e-12, 'shorts pay no financing');
  const gp = g.map((b) => ({ ...b })); gp[27] = { ...gp[27], open: 90, low: 89, high: 91, close: 90 };
  const tg = tradeAt(gp, j, 1, 5, 2);
  assert.equal(tg.kind, 'gap'); assert.equal(tg.exit, 90);
  // one at a time: a second signal inside an open trade is skipped
  const s = simulate([{ t: g[24].time, s: 1 }, { t: g[26].time, s: 1 }, { t: g[31].time, s: -1 }], g, TESTS[0]);
  assert.equal(s.length, 2);
});

test('statistics: Holm, normal p, month sums with empty months as zero, seeded placebo repeats', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(normP(1.96) - 0.025) < 1e-3);
  const m = monthly([{ c: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { c: Date.UTC(2020, 2, 5) / 1000, net: 1 }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 2, 31) / 1000, 'net');
  assert.equal(m.months, 3); assert.ok(Math.abs(m.mean - 2 / 3) < 1e-12);
  const el = Array.from({ length: 30 }, (_, i) => ({ t: i }));
  assert.deepEqual(placeboDays(el, [1, -1, 1], rng(7)), placeboDays(el, [1, -1, 1], rng(7)));
});

test('the report matches result.json, and the verdict follows the pre-registered bar', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  const head = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(head.length < 220 && head.includes('FAIL, 0 of 3'));
  for (const t of r.tests) {
    assert.equal(t.pass, false);
    assert.equal(t.placebo.seeds, 40);
    assert.ok(md.includes(`| ${t.id} | ${t.p} | ${t.holm} | ${t.placebo.beaten} (`), t.id + ' row');
    for (const w of ['is', 'oos']) {
      const x = t[w], f = (v) => (v < 0 ? '-' : '+') + Math.abs(v).toFixed(3);
      assert.ok(md.includes(`${x.n} (${x.longs.n} / ${x.shorts.n})`), `${t.id} ${w} n`);
      assert.ok(md.includes(`| ${f(x.gross)} | ${f(x.net)} | ${f(x.x2)} |`), `${t.id} ${w} R`);
    }
  }
  const t1 = r.tests[0];
  assert.ok(head.includes(t1.oos.net.toFixed(3)) && head.includes(`n ${t1.oos.n}`) && head.includes(`t ${t1.oos.tMonth.toFixed(2)}`));
});
