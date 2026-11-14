// research/edge/gold-dollar-lead: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DAY, RT, PAIRS, dxyIndex, pairs, signals, sideOf, entryIndex, tradeAt, simulate, holm, normP, monthly, TESTS, placeboDays, rng,
} from '../research/edge/gold-dollar-lead/run.mjs';

const DIR = new URL('../research/edge/gold-dollar-lead/', import.meta.url);
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
// weekdays from T0, n of them; close from fn(i)
function bars(n, fn, skip = () => false) {
  const out = []; let d = T0, i = 0;
  while (out.length < n) {
    const wd = new Date(d * 1000).getUTCDay();
    if (wd !== 0 && wd !== 6 && !skip(d)) { const c = fn(i++); out.push({ time: d, open: c, high: c + 1, low: c - 1, close: c }); }
    d += DAY;
  }
  return out;
}

test('weekly pairs: gold\'s last day of the week, the dollar index on that same day stamp, else the week is skipped', () => {
  const g = bars(30, (i) => 100 + i), b = bars(30, (i) => 50 + i * 0.1, (d) => d === T0 + 11 * DAY);   // dollar missing Fri of week 2
  const p = pairs(g, b, 'week');
  assert.ok(p.every((x) => new Date(x.t * 1000).getUTCDay() === 5));
  assert.ok(!p.some((x) => x.t === T0 + 11 * DAY), 'unaligned week dropped');
  const w3 = p.find((x) => x.t === T0 + 18 * DAY);
  assert.ok(w3.b > 0 && Math.abs(w3.g - (114 / 104 - 1)) < 1e-12, 'returns from the earlier counted week-end');
});

test('signals use only the pairs before: changing later data never changes an earlier row', () => {
  const mkp = (n, bump) => Array.from({ length: n }, (_, i) => ({ t: T0 + i * 7 * DAY, b: Math.sin(i) * 0.01 + (i === 70 ? bump : 0), g: Math.cos(i) * 0.01, brk: false }));
  const a = signals(mkp(80, 0), 52), b = signals(mkp(80, 0.5), 52);
  const before = (r) => r.filter((x) => x.t < T0 + 70 * 7 * DAY);
  assert.deepEqual(before(a), before(b));
  assert.equal(a[0].t, T0 + 52 * 7 * DAY, 'needs 52 earlier pairs');
  // a gap restarts the history after it
  const p = mkp(120, 0); p[60].brk = true;
  const s = signals(p, 52);
  assert.ok(!s.some((x) => x.t >= p[60].t && x.t < p[113].t), 'no row until 52 pairs after the gap');
});

test('sides: T1 needs the dollar down > 1 sd AND gold below its co-move; T2 the mirror; T3 both', () => {
  const [t1, t2, t3] = TESTS;
  assert.equal(sideOf({ z: -1.5, e: -0.001 }, t1), 1);
  assert.equal(sideOf({ z: -1.5, e: 0.001 }, t1), 0, 'gold already caught up: no trade');
  assert.equal(sideOf({ z: -0.9, e: -0.01 }, t1), 0);
  assert.equal(sideOf({ z: 1.5, e: 0.001 }, t2), -1);
  assert.equal(sideOf({ z: 1.5, e: 0.001 }, t1), 0);
  assert.equal(sideOf({ z: -1.5, e: -0.001 }, t2), 0);
  assert.equal(sideOf({ z: 2, e: 0.01 }, t3), -1);
  assert.equal(sideOf({ z: -2, e: -0.01 }, t3), 1);
});

test('dollar index: the ICE formula on six pairs, a value only on days with all six; the proxy needs no USD/SEK', () => {
  const one = (c, skip) => bars(5, () => c, skip);
  const fx = { eurusd: one(1.1), usdjpy: one(150), gbpusd: one(1.3), usdcad: one(1.35), usdsek: one(10.5, (d) => d === T0 + DAY), usdchf: one(0.9) };
  assert.deepEqual(PAIRS, ['eurusd', 'usdjpy', 'gbpusd', 'usdcad', 'usdsek', 'usdchf']);
  const x = dxyIndex(fx), want = 50.14348112 * 1.1 ** -0.576 * 150 ** 0.136 * 1.3 ** -0.119 * 1.35 ** 0.091 * 10.5 ** 0.042 * 0.9 ** 0.036;
  assert.ok(Math.abs(x[0].close - want) < 1e-9);
  assert.ok(!x.some((r) => r.time === T0 + DAY), 'a day without USD/SEK has no value');
  const p = dxyIndex(fx, { proxy: true });
  assert.equal(p.length, 5);
  assert.ok(Math.abs(p[0].close - want * (11.2 / 1.1 / 10.5) ** 0.042) < 1e-9);
  // a stronger dollar (EUR/USD down) raises the index
  const fx2 = { ...fx, eurusd: one(1.0) };
  assert.ok(dxyIndex(fx2)[0].close > x[0].close);
});

test('trade: entry at the next day\'s open, stop 2 x ATR(20) of earlier candles, costs and financing on longs only', () => {
  const g = bars(40, () => 100);   // true range 2 every day -> ATR 2, risk 4
  const j = entryIndex(g, g[25].time);
  assert.equal(j, 26);
  const L = tradeAt(g, j, 1, 5), S = tradeAt(g, j, -1, 5);
  assert.equal(L.risk, 4); assert.equal(L.stop, 96); assert.equal(S.stop, 104);
  assert.equal(L.gross, 0); assert.ok(L.fin > 0); assert.equal(S.fin, 0);
  assert.ok(Math.abs(S.net + RT / 4) < 1e-12);
  // a gap through the stop fills at the open
  const g2 = bars(40, (i) => (i === 28 ? 90 : 100));
  g2[28].open = 90;
  const x = tradeAt(g2, 26, 1, 5);
  assert.equal(x.kind, 'gap'); assert.equal(x.exit, 90);
  // one at a time
  const tr = simulate([{ t: g[25].time, s: 1 }, { t: g[26].time, s: 1 }, { t: g[31].time, s: 1 }], g, 5);
  assert.equal(tr.length, 2);
});

test('statistics: Holm, the one-sided p, month sums with empty months, a seeded placebo keeps the side mix', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.5]).map((p) => +p.toFixed(3)), [0.03, 0.08, 0.5]);
  assert.ok(Math.abs(normP(1.96) - 0.025) < 0.001);
  const m = monthly([{ c: Date.UTC(2020, 0, 10) / 1000, net: 1 }, { c: Date.UTC(2020, 2, 10) / 1000, net: 1 }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 2, 31) / 1000, 'net');
  assert.equal(m.months, 3);
  const el = Array.from({ length: 50 }, (_, i) => ({ t: i })), sides = [1, 1, -1];
  const a = placeboDays(el, sides, rng(7)), b = placeboDays(el, sides, rng(7));
  assert.deepEqual(a, b);
  assert.deepEqual(a.map((d) => d.s).sort(), [-1, 1, 1]);
});

test('report: the verdict line and tables agree with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  const line = md.match(/\*\*Verdict: (.+?)\*\*/)[1];
  assert.ok(line.length < 220 && line.startsWith('FAIL, 0 of 3'));
  const [t1, t2, t3] = r.tests;
  assert.ok(r.tests.every((t) => !t.pass));
  assert.ok(line.includes(`+${t1.oos.net}R`) && line.includes(`n ${t1.oos.n}`) && line.includes(`month t ${t1.oos.tMonth}`));
  for (const t of r.tests) for (const w of ['is', 'oos']) assert.ok(md.includes(`| ${t[w].n} (${t[w].long} / ${t[w].short}) |`), `${t.id} ${w} n`);
  assert.ok(md.includes(`**${t1.oos.tMonth}**`) && md.includes(`**${t2.oos.tMonth}**`) && md.includes(`**${t3.oos.tMonth}**`));
  for (const t of r.tests) assert.ok(md.includes(`| ${t.id} | ${t.oos.tMonth} | ${t.placebo.atLeast2} | ${t.placebo.atLeastReal} | ${t.placebo.median} / ${t.placebo.p5} / ${t.placebo.p95} |`), `${t.id} placebo`);
  assert.ok(md.includes(`| ${t1.p} | ${t1.holm} |`));
  assert.equal(r.tests[0].placebo.seeds, 40);
  assert.ok(fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8').includes('decision 44'));
});
