// research/edge/metals-fade-clean-trend: the fade side, stops, costs, the same-month excess, the placebo draw and the report against result.json (offline)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lineFit, atr, tradeAt, rOf, dayTrades, oneAtATime, excessOf, holm, fakeSig, mulberry32, study, P, MK, FIN_RATE } from '../research/edge/metals-fade-clean-trend/run.mjs';
import { FIN } from '../council/fills.mjs';

const dir = new URL('../research/edge/metals-fade-clean-trend/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const day = (i) => Date.UTC(2010, 0, 4) / 1000 + i * 86400;
const mk = (closes) => closes.map((c, i) => ({ time: day(i), open: c, high: c * 1.01, low: c * 0.99, close: c }));

test('pre-registered constants: the gold study\'s numbers, the two metals, their costs, the assumed financing', () => {
  assert.deepEqual([P.n, P.r2Min, P.hold, P.atrN, P.k, P.seeds], [60, 0.7, 10, 14, 2, 40]);
  assert.deepEqual(Object.keys(MK), ['xag', 'xpt']);
  assert.equal(MK.xag.cost, 0.03); assert.equal(MK.xpt.cost, 2.00);
  assert.equal(FIN_RATE.long, FIN.xau.long); assert.equal(FIN_RATE.short, 0);
  assert.equal(FIN.xag, undefined, 'a silver rate now exists in fills.mjs: the assumption should be revisited');
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');
  assert.match(pre, /silver \(XAG\/USD/); assert.match(pre, /\$0\.03/); assert.match(pre, /platinum \$2\.00/);
});

test('the side is AGAINST the slope: a clean rise is sold with the stop above, a clean fall bought with the stop below', () => {
  const up = mk(Array.from({ length: 130 }, (_, i) => 100 * Math.exp(0.004 * i)));
  const d1 = dayTrades(up, { ...P, warm: 0 });
  assert.ok(d1.length > 0 && d1.every((d) => d.side === -1 && d.stop > d.entry && d.sig));
  const dn = mk(Array.from({ length: 130 }, (_, i) => 100 * Math.exp(-0.004 * i)));
  const d2 = dayTrades(dn, { ...P, warm: 0 });
  assert.ok(d2.every((d) => d.side === 1 && d.stop < d.entry && d.dist > 0));
  const zz = mk(Array.from({ length: 130 }, (_, i) => 100 + (i % 2 ? 3 : -3)));
  assert.ok(dayTrades(zz, { ...P, warm: 0 }).every((d) => !d.sig));
});

test('no look-ahead: changing every bar after day k leaves the fit, ATR and side of day k unchanged', () => {
  const c = Array.from({ length: 140 }, (_, i) => 20 + Math.sin(i / 7) * 2 + i * 0.05);
  const k = 100, b1 = mk(c), b2 = mk(c.map((x, i) => (i > k ? x * 3 : x)));
  assert.deepEqual(lineFit(b1).slice(0, k + 1), lineFit(b2).slice(0, k + 1));
  assert.deepEqual(atr(b1).slice(0, k + 1), atr(b2).slice(0, k + 1));
  const s1 = dayTrades(b1, { ...P, warm: 0 }).find((d) => d.signalI === k - 20), s2 = dayTrades(b2, { ...P, warm: 0 }).find((d) => d.signalI === k - 20);
  assert.equal(s1.side, s2.side); assert.equal(s1.entry, s2.entry); assert.equal(s1.stop, s2.stop);
});

test('a trade enters at the next open, exits at the stop (gap at the open) or after 10 days', () => {
  const bars = mk(Array.from({ length: 60 }, () => 20)), A = atr(bars);
  const t = tradeAt(bars, A, 20, -1);
  assert.equal(t.entryI, 21); assert.equal(t.exitI, 31); assert.equal(t.why, 'time'); assert.ok(t.stop > t.entry);
  const b2 = mk(Array.from({ length: 60 }, () => 20)); b2[25] = { ...b2[25], open: 22, high: 22.2, low: 21.8, close: 22 };
  const s = tradeAt(b2, atr(b2), 20, -1);
  assert.equal(s.why, 'stop'); assert.equal(s.exit, 22);
});

test('costs: the metal\'s round trip, the gold financing rate on buys only, twice at 2x', () => {
  const t = { side: 1, entry: 30, exit: 31, dist: 1, entryT: Date.UTC(2020, 0, 6) / 1000, exitT: Date.UTC(2020, 0, 13) / 1000 };
  const r = rOf(t, 1, { ...P, cost: MK.xag.cost }), r2 = rOf(t, 2, { ...P, cost: MK.xag.cost });
  assert.equal(r.gross, 1); assert.equal(r.cost, 0.03); assert.equal(r.nights, 7);
  assert.ok(Math.abs(r.fin - 7 * FIN.xau.long * 30) < 1e-12 && Math.abs(r2.fin - 2 * r.fin) < 1e-12);
  assert.equal(rOf({ ...t, side: -1 }, 1, { ...P, cost: 2 }).fin, 0);
  assert.equal(rOf({ ...t, side: -1 }, 1, { ...P, cost: 2 }).cost, 2);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('excess, one at a time and the placebo keep each year\'s signal count', () => {
  const T = (m, net, sig, e, x) => ({ entryT: Date.UTC(2020, m, 3) / 1000, net, net2: net - 0.1, sig, entryI: e, exitI: x, side: 1 });
  const days = [T(0, 1, true, 1, 11), T(0, -1, false, 2, 12), T(0, 3, true, 3, 13), T(1, 2, true, 20, 30)];
  assert.deepEqual(excessOf(days).map((d) => d.ex), [0, 2, 0]);
  assert.deepEqual(oneAtATime(days).map((d) => d.entryI), [1, 20]);
  const fake = fakeSig(days, mulberry32(3));
  assert.equal(fake.filter((d) => d.sig).length, 3);
});

test('study runs on hand-made candles and every trade has a stop', () => {
  const c = (f) => mk(Array.from({ length: 900 }, (_, i) => f(i))).map((b, i) => ({ ...b, time: Date.UTC(2006, 6, 3) / 1000 + i * 86400 }));
  const r = study({ xag: c((i) => 20 + 3 * Math.sin(i / 40) + i * 0.002), xpt: c((i) => 1000 + 80 * Math.sin(i / 55)) });
  assert.deepEqual(Object.keys(r.tests), ['T1', 'T2', 'T3']);
  for (const x of Object.values(r.tests)) assert.equal(x.placebo.seeds.length, 40);
  assert.equal(r.tests.T3.full.n, r.tests.T1.full.n + r.tests.T2.full.n);
});

test('the report matches result.json', () => {
  assert.equal(R.verdict, 'FAIL'); assert.equal(R.pass, false); assert.equal(R.passCount, 0);
  const v = md.match(/\*\*Verdict:[^*]*\*\*/)[0];
  assert.match(v, /^\*\*Verdict: FAIL, 0 of 3: /);
  assert.ok(v.length < 220, `verdict line ${v.length} chars`);
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  for (const id of ['T1', 'T2', 'T3']) {
    const x = R.tests[id];
    assert.equal(x.pass, false); assert.equal(x.checks.costs2x, false);
    assert.ok(x.checks.monthT && x.checks.halves, `${id} selection checks`);
    for (const w of ['full', 'h1', 'h2']) {
      assert.ok(md.includes(`| ${x[w].n} |`), `${id} ${w} n`);
      for (const k of ['sigGross', 'sigNet', 'sigNet2', 'ex', 'ex2']) assert.ok(md.includes(f(x[w][k])), `${id} ${w} ${k}`);
      assert.ok(md.includes(x[w].t.toFixed(2)), `${id} ${w} t`);
    }
    assert.equal(x.placebo.beaten, 40);
  }
  assert.ok(v.includes(f(R.tests.T1.full.ex).replace('+', '+')) && v.includes(R.tests.T1.full.t.toFixed(2)));
  for (const m of ['xag', 'xpt']) for (const w of ['full', 'h1', 'h2']) {
    const s = R.markets[m].solo[w];
    assert.ok(md.includes(`| ${s.n} |`) && md.includes(f(s.net)) && md.includes(s.total.toFixed(2)), `${m} solo ${w}`);
  }
  assert.ok(md.includes('beats 40 of 40'));
});
