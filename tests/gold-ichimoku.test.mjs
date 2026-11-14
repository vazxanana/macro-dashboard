// research/edge/gold-ichimoku: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ichimoku, atrW, cloudSignal, tkSignal, simulate, costOf, h4FromH1, holm, pUpper, monthT, placebo, P } from '../research/edge/gold-ichimoku/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const dir = new URL('../research/edge/gold-ichimoku/', import.meta.url);
const res = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const T0 = Date.UTC(2010, 0, 4) / 1000, D = 86400;
// a deterministic wavy path: flat, a long rise, a fall, another rise
function path(n = 400) {
  const out = []; let px = 1000, s = 123456789;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
  for (let i = 0; i < n; i++) {
    const drift = i < 100 ? 0 : i < 200 ? 3 : i < 300 ? -3.5 : 2.5, o = px; px += drift + rnd() * 12;
    out.push({ time: T0 + i * D, open: o, high: Math.max(o, px) + 3 + Math.abs(rnd()) * 4, low: Math.min(o, px) - 3 - Math.abs(rnd()) * 4, close: px });
  }
  return out;
}

test('Ichimoku lines: 9 / 26 / 52 midpoints, the cloud is the spans of 26 candles before', () => {
  const b = path(200), ich = ichimoku(b);
  const midN = (i, n) => { const w = b.slice(i - n + 1, i + 1); return (Math.max(...w.map((x) => x.high)) + Math.min(...w.map((x) => x.low))) / 2; };
  assert.equal(ich.tenkan[7], null); assert.equal(ich.tenkan[8], midN(8, 9));
  assert.equal(ich.kijun[24], null); assert.equal(ich.kijun[60], midN(60, 26));
  assert.equal(ich.spanB[50], null); assert.equal(ich.spanB[120], midN(120, 52));
  assert.equal(ich.top[51 + 26 - 1], null);
  for (const i of [77, 120, 199]) {
    const a = (ich.tenkan[i - 26] + ich.kijun[i - 26]) / 2, s = ich.spanB[i - 26];
    assert.equal(ich.top[i], Math.max(a, s)); assert.equal(ich.bot[i], Math.min(a, s));
  }
});

test('no look-ahead: every line, the ATR and the signals at candle i ignore later candles', () => {
  const b = path(300), full = ichimoku(b), fa = atrW(b);
  for (const cut of [90, 150, 230]) {
    const part = b.slice(0, cut + 1), ich = ichimoku(part), a = atrW(part);
    for (const k of ['tenkan', 'kijun', 'spanA', 'spanB', 'top', 'bot']) assert.deepEqual(ich[k], full[k].slice(0, cut + 1), k);
    assert.deepEqual(a, fa.slice(0, cut + 1));
    for (let i = 0; i <= cut; i++) { assert.equal(cloudSignal(part, ich, i), cloudSignal(b, full, i)); assert.equal(tkSignal(part, ich, i), tkSignal(b, full, i)); }
  }
});

test('trades: next-open fills, a stop on the losing side at 2 x ATR, one at a time, a truncated history gives the same trades', () => {
  const b = path(400);
  for (const rule of ['cloud', 'tk']) {
    const { trades, atr } = simulate(b, rule, D);
    assert.ok(trades.length > 0, rule);
    let lastExit = -Infinity;
    for (const t of trades) {
      const ie = b.findIndex((x) => x.time === t.entryT), is = b.findIndex((x) => x.time === t.sigT);
      assert.equal(ie, is + 1, 'entry at the next candle'); assert.equal(t.entry, b[ie].open);
      assert.ok(Math.abs(t.r0 - 2 * atr[is]) < 1e-9); assert.ok(t.side > 0 ? t.stop < t.entry : t.stop > t.entry, 'stop on the losing side');
      if (t.why === 'stop') assert.ok(t.side > 0 ? t.exit <= t.stop + 1e-9 : t.exit >= t.stop - 1e-9);
      else assert.equal(t.exit, b.find((x) => x.time === t.exitT).open);
      assert.ok(t.entryT >= lastExit, 'one position at a time'); lastExit = t.exitT;
    }
    const part = simulate(b.slice(0, 320), rule, D).trades, done = trades.filter((t) => t.exitT < b[319].time);
    assert.deepEqual(part.filter((t) => t.exitT < b[319].time), done);
  }
});

test('a gap through the stop fills at the open', () => {
  const b = path(400), { trades } = simulate(b, 'tk', D), t = trades.find((x) => x.hold >= 2);
  assert.ok(t, 'a trade held two candles or more');
  const ie = b.findIndex((x) => x.time === t.entryT), g = b.map((x) => ({ ...x }));
  const k = ie + 1, gap = t.side > 0 ? t.stop - 20 : t.stop + 20;
  g[k] = { ...g[k], open: gap, high: Math.max(gap, g[k].high), low: Math.min(gap, g[k].low), close: gap };
  const t2 = simulate(g, 'tk', D).trades.find((x) => x.entryT === t.entryT);
  assert.equal(t2.why, 'stop'); assert.equal(t2.exit, gap); assert.equal(t2.exitT, g[k].time);
});

test('costs: $0.60 a round trip on both sides, financing on buys only', () => {
  const a = Date.UTC(2020, 0, 6, 0) / 1000, z = a + 3 * D, n = nights(a, z);
  const buy = costOf(1, 1500, 1510, a, z, 20), sell = costOf(-1, 1500, 1490, a, z, 20);
  assert.ok(Math.abs(buy.net - (10 - P.cost - n * FIN.xau.long * 1500) / 20) < 1e-12);
  assert.ok(Math.abs(sell.net - (10 - P.cost) / 20) < 1e-12);
  assert.ok(Math.abs(costOf(1, 1500, 1510, a, z, 20, 2).net - (10 - 1.2 - 2 * n * FIN.xau.long * 1500) / 20) < 1e-12);
});

test('H4 candles start at 17:00 New York, skip the shut weekend, and hold up to four hours', () => {
  const h1 = []; // Friday 15 Jan 2021 12:00 UTC to Monday 18 Jan 06:00 UTC (winter: 17:00 New York = 22:00 UTC)
  for (let t = Date.UTC(2021, 0, 15, 12) / 1000; t <= Date.UTC(2021, 0, 18, 6) / 1000; t += 3600) h1.push({ time: t, open: 1, high: 2, low: 0, close: 1 });
  const h4 = h4FromH1(h1), hrs = (b) => new Date(b.time * 1000).getUTCHours();
  assert.deepEqual(h4.map(hrs), [12, 14, 18, 22, 2, 6]);
  assert.deepEqual(h4.map((b) => b.hours), [2, 4, 4, 4, 4, 1]);
  assert.equal(new Date(h4[3].time * 1000).getUTCDay(), 0, 'the week opens with the Sunday 17:00 New York candle');
  // summer: 17:00 New York = 21:00 UTC
  const s = []; for (let t = Date.UTC(2021, 6, 5, 20) / 1000; t <= Date.UTC(2021, 6, 6, 2) / 1000; t += 3600) s.push({ time: t, open: 1, high: 1, low: 1, close: 1 });
  assert.deepEqual(h4FromH1(s).map(hrs), [20, 21, 1]);
});

test('statistics helpers: Holm, Student t tail, month sums', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(pUpper(1.96, 1e6) - 0.025) < 1e-3); assert.ok(Math.abs(pUpper(0, 30) - 0.5) < 1e-9); assert.ok(pUpper(-2, 30) > 0.97);
  const m = monthT([{ exitT: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { exitT: Date.UTC(2020, 2, 5) / 1000, net: 1 }], '2020-01-01', '2020-03-31');
  assert.equal(m.months, 3); assert.equal(m.t, 2);
  const b = path(300), { trades, atr } = simulate(b, 'tk', D);
  assert.deepEqual(placebo(b, atr, trades, ['2010-01-01', '2011-12-31'], D, 5), placebo(b, atr, trades, ['2010-01-01', '2011-12-31'], D, 5), 'seeded');
});

test('the report matches result.json', () => {
  assert.equal(res.verdict, 'FAIL'); assert.deepEqual(res.passed, []);
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.length - 4 <= 220, 'headline under 220 characters');
  for (const k of ['T1', 'T2', 'T3']) {
    const t = res.tests[k];
    assert.equal(t.pass, false); assert.equal(Object.values(t.checks).every(Boolean), false);
    for (const w of ['is', 'oos']) {
      const s = t[w], f = (x) => (x > 0 ? '+' : '') + x.toFixed(2);
      assert.ok(md.includes(`| ${s.n} |`), `${k} ${w} n`);
      assert.ok(md.includes(f(s.netR)), `${k} ${w} net ${f(s.netR)}`); assert.ok(md.includes(f(s.net2R)), `${k} ${w} 2x ${f(s.net2R)}`);
      assert.ok(md.includes(` ${s.monthT.toFixed(2)} |`) || md.includes(` ${s.monthT} |`), `${k} ${w} t ${s.monthT}`);
    }
    assert.ok(md.includes(`(${t.placebo.beaten}; median`), `${k} placebo`);
    assert.ok(md.includes(`p ${t.holmP.toFixed(2)}`), `${k} Holm`);
  }
  const t2 = res.tests.T2;
  assert.ok(line.includes(`+${t2.oos.netPer.toFixed(2)}R`) && line.includes(`n ${t2.oos.n}`) && line.includes(`month t ${t2.oos.monthT}`));
  assert.ok(md.includes(`+${res.hold.oos.pct}`) && md.includes(`+${res.hold.oos.pctFin}`));
  assert.ok(/not a gate, exit, entry or size of the\s+live gold book/.test(md));
});
