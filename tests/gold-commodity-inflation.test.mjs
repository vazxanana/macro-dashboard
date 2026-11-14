// research/edge/gold-commodity-inflation: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DAY, RT, BASKET, KEYS, closeAt, weeks, signals, sideOf, entryIndex, tradeAt, simulate, holm, normP, monthly, placeboDays, rng,
} from '../research/edge/gold-commodity-inflation/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const DIR = new URL('../research/edge/gold-commodity-inflation/', import.meta.url);
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

test('the market set is the pre-registered eight-commodity basket, gold traded, $0.60 a round trip', () => {
  assert.deepEqual(BASKET, ['wtico', 'bco', 'natgas', 'corn', 'wheat', 'soybn', 'sugar', 'xcu']);
  assert.deepEqual(KEYS, ['xau', ...BASKET]);
  assert.equal(RT, 0.6);
});

test('closeAt: last close at or before the day, no more than 5 days old', () => {
  const b = bars(10, (i) => 10 + i);
  assert.equal(closeAt(b, b[3].time), 13);
  assert.equal(closeAt(b, b[3].time + 3600), 13);
  assert.equal(closeAt(b, b[9].time + 5 * DAY), 19);
  assert.equal(closeAt(b, b[9].time + 6 * DAY), null);
  assert.equal(closeAt(b, T0 - DAY), null);
});

test('weekly rows: basket = mean of the eight log returns between week ends, gold its own; a week ending on a holiday uses the close before', () => {
  const g = bars(20, (i) => 100 * Math.exp(0.01 * i));
  const mk = Object.fromEntries(BASKET.map((k, n) => [k, bars(20, (i) => 0, (d) => k === 'corn' && d === T0 + 11 * DAY).map((x) => ({ ...x, close: 50 * Math.exp(0.002 * (n + 1) * (x.time - T0) / DAY) }))]));
  const w = weeks(g, mk);
  assert.ok(w.every((x) => new Date(x.t * 1000).getUTCDay() === 5));
  const want = BASKET.reduce((s, _, n) => s + 0.002 * (n + 1) * 7, 0) / 8;
  // first row ends Friday T0+11 (corn shut that day: its Thursday close, 6 days of corn), the next has 8 days of corn
  assert.equal(w[0].t, T0 + 11 * DAY);
  assert.ok(Math.abs(w[0].b - (want - 0.002 * 4 / 8)) < 1e-12);
  assert.ok(Math.abs(w[1].b - (want + 0.002 * 4 / 8)) < 1e-12);
  assert.ok(Math.abs(w[0].g - 0.05) < 1e-12);
  // the week of T0+11 (Friday) still counts: corn's Thursday close is used
  assert.ok(w.some((x) => x.t === T0 + 11 * DAY));
});

test('signals use only data at or before the week: a later week never changes an earlier row; windows and gaps', () => {
  const mk = (n, bump) => Array.from({ length: n }, (_, i) => ({ t: T0 + i * 7 * DAY, b: Math.sin(i * 1.3) * 0.01 + (i === 75 ? bump : 0), g: Math.cos(i * 0.7) * 0.008, brk: false }));
  const a = signals(mk(90, 0)), b = signals(mk(90, 0.5));
  const before = (r) => r.filter((x) => x.t < T0 + 75 * 7 * DAY);
  assert.deepEqual(before(a), before(b));
  assert.equal(a.find((x) => x.z4 != null).i, 55, 'T1 needs 52 weeks before the 4');
  assert.equal(a.find((x) => x.z13 != null).i, 64, 'T3 needs 52 weeks before the 13');
  assert.equal(a.find((x) => x.zr != null).i, 52, 'T2 needs 52 weeks to fit');
  const w = mk(90, 0), r = a[70];
  const sd = (xs) => { const m = xs.reduce((p, q) => p + q, 0) / xs.length; return Math.sqrt(xs.reduce((p, q) => p + (q - m) ** 2, 0) / (xs.length - 1)); };
  const s4 = w.slice(67, 71).reduce((p, q) => p + q.b, 0);
  assert.ok(Math.abs(r.z4 - s4 / (2 * sd(w.slice(15, 67).map((q) => q.b)))) < 1e-12);
  const p = mk(150, 0); p[70].brk = true;
  const ps = signals(p);
  assert.ok(ps.filter((x) => x.i >= 70 && x.i < 125).every((x) => x.z4 == null));
});

test('the residual form: a basket move that is an exact multiple of gold\'s gives no residual, the raw form signals', () => {
  const w = Array.from({ length: 70 }, (_, i) => { const g = Math.sin(i * 0.9) * 0.01; return { t: T0 + i * 7 * DAY, b: 0.7 * g + 1e-4 * Math.cos(i * 2.3), g, brk: false }; });
  for (let k = 62; k <= 65; k++) { w[k].g = 0.03; w[k].b = 0.021; }   // a big basket month fully followed by gold
  const r = signals(w)[65];
  assert.equal(sideOf(r, 'z4'), 1);
  assert.ok(Math.abs(r.beta - 0.7) < 0.02 && Math.abs(r.zr) < 1, 'gold followed: no residual signal');
  assert.equal(sideOf({ z4: -1.2 }, 'z4'), -1);
  assert.equal(sideOf({ z4: 0.9 }, 'z4'), 0);
});

test('trade: next day\'s open, stop 3 x ATR(20), gap fill, $0.60 + financing on longs, one at a time', () => {
  const g = bars(60, () => 100);
  const j = entryIndex(g, g[24].time);
  assert.equal(j, 25);
  const tr = tradeAt(g, j, 1);
  assert.equal(tr.risk, 6); assert.equal(tr.kind, 'time'); assert.equal(tr.k, j + 19);
  const fin = nights(tr.t, tr.c) * FIN.xau.long * 100 / 6;
  assert.ok(Math.abs(tr.net - (0 - 0.6 / 6 - fin)) < 1e-12);
  const sh = tradeAt(g, j, -1);
  assert.ok(Math.abs(sh.net + 0.1) < 1e-12, 'shorts pay no financing');
  const gp = g.map((b) => ({ ...b })); gp[27] = { ...gp[27], open: 90, low: 89, high: 91, close: 90 };
  const tg = tradeAt(gp, j, 1);
  assert.equal(tg.kind, 'gap'); assert.equal(tg.exit, 90);
  const s = simulate([{ t: g[24].time, s: 1 }, { t: g[30].time, s: 1 }, { t: g[45].time, s: -1 }], g);
  assert.equal(s.length, 1, 'the second signal falls in the first trade, the third has too few candles left');
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
  const f = (v) => (v < 0 ? '-' : '+') + Math.abs(v).toFixed(3);
  for (const t of r.tests) {
    assert.equal(t.pass, false);
    assert.equal(t.placebo.seeds, 40);
    assert.ok(md.includes(`${t.placebo.beaten} of 40`), t.id + ' placebo');
    for (const w of ['is', 'oos']) {
      const x = t[w];
      assert.ok(md.includes(`| ${x.n} | ${x.longs.n} / ${x.shorts.n} | ${f(x.gross)} | ${f(x.net)} | ${f(x.x2)} | ${x.tMonth.toFixed(2)} (${x.tMonthGross.toFixed(2)}) |`), `${t.id} ${w} row`);
      assert.ok(md.includes(`${f(x.longs.net)} | ${f(x.shorts.net)}`), `${t.id} ${w} sides`);
    }
  }
  const o = r.tests[0].oos;
  assert.ok(md.includes(`${f(o.baseline.long.net)} (n ${o.baseline.long.n}, t ${o.baseline.long.tMonth.toFixed(2)})`));
  const t1 = r.tests[0];
  assert.ok(head.includes(t1.oos.net.toFixed(3)) && head.includes(`n ${t1.oos.n}`) && head.includes(`t ${t1.oos.tMonth.toFixed(2)}`));
});
