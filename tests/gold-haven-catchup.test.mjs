// research/edge/gold-haven-catchup: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DAY, RT, HAVEN, KEYS, TESTS, levels, weeks, signals, sideOf, entryIndex, tradeAt, simulate, baseline, excessOf, holm, normP, monthly, placeboDays, rng,
} from '../research/edge/gold-haven-catchup/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const DIR = new URL('../research/edge/gold-haven-catchup/', import.meta.url);
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

test('the market set is the pre-registered one: yen, franc, US 10-year Treasury CFD; $0.60 a round trip', () => {
  assert.deepEqual(HAVEN, [['usdjpy', -1], ['usdchf', -1], ['usb10y', 1]]);
  assert.deepEqual(KEYS, ['xau', 'usdjpy', 'usdchf', 'usb10y']);
  assert.equal(RT, 0.6);
  assert.deepEqual(TESTS.map((t) => [t.id, t.sig, t.dir, t.hold, t.stopAtr]), [['T1', 'ze', -1, 5, 2], ['T2', 'ze', -1, 10, 3], ['T3', 'zh', 1, 5, 2]]);
});

test('levels: H is the mean of the signed log prices, a day only when every market has a close', () => {
  const g = bars(5, () => 2000);
  const mk = { usdjpy: bars(5, () => 150), usdchf: bars(5, () => 0.9, (d) => d === T0 + DAY), usb10y: bars(5, () => 110) };
  const lv = levels(g, mk);
  assert.ok(!lv.has(T0 + DAY), 'franc missing: no value that day');
  assert.ok(Math.abs(lv.get(T0).h - (-Math.log(150) - Math.log(0.9) + Math.log(110)) / 3) < 1e-12);
  assert.ok(Math.abs(lv.get(T0).g - Math.log(2000)) < 1e-12);
});

test('weekly rows: gold\'s last day of each week; a week whose last day lacks H is skipped', () => {
  const g = bars(20, (i) => 100 + i);
  const lv = new Map(g.filter((b) => b.time !== T0 + 11 * DAY).map((b, i) => [b.time, { g: Math.log(b.close), h: i * 0.001 }]));
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
  const p = mk(120, 0); p[60].brk = true;
  assert.ok(!signals(p).some((x) => x.t >= p[60].t && x.t < p[112].t));
});

test('residual: gold lagging a haven rally is a buy (T1 fades), gold fully explained by H is no residual signal', () => {
  const w = Array.from({ length: 60 }, (_, i) => { const d = Math.sin(i * 0.9) * 0.01; return { t: T0 + i * 7 * DAY, c: 1.2 * d + 1e-4 * Math.cos(i * 2.1), d, brk: false }; });
  w[55] = { ...w[55], d: 0.03, c: 1.2 * 0.03 };   // a big haven week, gold followed exactly
  let r = signals(w).find((x) => x.t === w[55].t);
  assert.ok(Math.abs(r.beta - 1.2) < 0.02);
  assert.equal(sideOf(r, 'ze', -1), 0, 'explained: no residual signal');
  assert.equal(sideOf(r, 'zh', 1), 1, 'raw haven week up beyond 1 sd: T3 long');
  w[55] = { ...w[55], c: 0 };   // havens rallied, gold did not move: lagged
  r = signals(w).find((x) => x.t === w[55].t);
  assert.ok(r.ze < -1);
  assert.equal(sideOf(r, 'ze', -1), 1, 'T1 buys the laggard');
  assert.equal(sideOf({ ze: 1.2 }, 'ze', -1), -1);
  assert.equal(sideOf({ ze: 0.9 }, 'ze', -1), 0);
});

test('trade: entry the next day\'s open, stop k x ATR(20), gap fill at the open, $0.60 + financing on longs; one at a time', () => {
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
  const s = simulate([{ t: g[24].time, s: 1 }, { t: g[26].time, s: 1 }, { t: g[31].time, s: -1 }], g, TESTS[0]);
  assert.equal(s.length, 2);
  const base = baseline([{ t: g[24].time }, { t: g[31].time }], g, TESTS[0]);
  assert.equal(base[1].n, 2); assert.equal(base[-1].n, 2);
  assert.ok(Math.abs(excessOf([{ side: 1, net: 0.5 }], { 1: { net: 0.2 }, '-1': { net: 0 } }) - 0.3) < 1e-12);
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
    assert.ok(md.includes(`| ${t.id} | ${t.p} | ${t.holm} | ${t.placebo.beaten} (`), t.id + ' row');
    for (const w of ['is', 'oos']) {
      const x = t[w];
      assert.ok(md.includes(`${x.n} (${x.longs.n} / ${x.shorts.n}) | ${f(x.gross)} | ${f(x.net)} | ${f(x.x2)} | ${x.tMonth.toFixed(2)} |`), `${t.id} ${w}`);
      assert.ok(md.includes(`| ${f(x.excess)} |`), `${t.id} ${w} excess`);
      assert.ok(x.medianStop >= 10, 'median stop $10 or more');
    }
  }
  const t1 = r.tests[0];
  assert.ok(head.includes(t1.oos.net.toFixed(3)) && head.includes(`n ${t1.oos.n}`) && head.includes(`t ${t1.oos.tMonth.toFixed(2)}`));
  assert.ok(head.includes(`${t1.placebo.beaten} of 40`));
});
