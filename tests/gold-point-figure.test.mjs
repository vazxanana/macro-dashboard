// research/edge/gold-point-figure: the point-and-figure chart and its signals, the trade (stop, costs), the drift baseline
// and the report against result.json (offline)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pnfSignals, atr, trade, rOf, holm, windowStats, study, P } from '../research/edge/gold-point-figure/run.mjs';

const dir = new URL('../research/edge/gold-point-figure/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const day = (i) => Date.UTC(2010, 0, 4) / 1000 + i * 86400;
const box = (k) => Math.pow(1.005, k);                                  // the price at box level k
// a candle spanning box levels lo..hi (a hair inside, so floor / ceil land on the intended boxes)
const bar = (i, lo, hi) => ({ time: day(i), open: box((lo + hi) / 2), high: box(hi) * 1.00001, low: box(lo) * 0.99999, close: box((lo + hi) / 2) });

test('chart: up to 10, reverse to 6, up to 11 = one double-top buy, on the day the column passes 10', () => {
  const b = [bar(0, 0, 0), bar(1, 0, 5), bar(2, 4, 10), bar(3, 6, 9), bar(4, 6, 9), bar(5, 7, 9), bar(6, 8, 10), bar(7, 9, 11), bar(8, 10, 12)];
  const s = pnfSignals(b, { box: 0.5, rev: 3 });
  assert.deepEqual(s, [0, 0, 0, 0, 0, 0, 0, 1, 0]);
});

test('chart: a pullback of only two boxes is not a reversal, so no signal; continuation is checked before reversal', () => {
  const b = [bar(0, 0, 0), bar(1, 0, 10), bar(2, 8, 9), bar(3, 9, 11)];
  assert.deepEqual(pnfSignals(b, { box: 0.5, rev: 3 }), [0, 0, 0, 0]);
  // a day that makes a new high AND a deep low extends the X column (no reversal)
  const c = [bar(0, 0, 0), bar(1, 0, 10), bar(2, 2, 12), bar(3, 9, 13)];
  assert.deepEqual(pnfSignals(c, { box: 0.5, rev: 3 }), [0, 0, 0, 0]);
});

test('chart: double-bottom sell is the mirror, one signal per column', () => {
  const d = [bar(0, 0, 0), bar(1, 0, 10), bar(2, 5, 7), bar(3, 6, 8), bar(4, 6, 9), bar(5, 4, 6), bar(6, 3, 5), bar(7, 2, 4)];
  // X to 10; O to 5; X 6..9 (lastO = 5); O from 6 down: 4 (signal: below 5), then 3, 2: one sell only
  assert.deepEqual(pnfSignals(d, { box: 0.5, rev: 3 }), [0, 0, 0, 0, 0, -1, 0, 0]);
});

test('no look-ahead: changing candles after day k leaves the signals up to k unchanged', () => {
  const c = Array.from({ length: 400 }, (_, i) => 1000 + Math.sin(i / 9) * 40 + (i % 50 === 0 ? 30 : 0));
  const mk = (cl) => cl.map((v, i) => ({ time: day(i), open: v, high: v + 6, low: v - 6, close: v }));
  const x = pnfSignals(mk(c));
  assert.ok(x.includes(1) && x.includes(-1));
  const k = 250, c2 = c.map((v, i) => (i > k ? v * 1.5 : v));
  assert.deepEqual(pnfSignals(mk(c2)).slice(0, k + 1), x.slice(0, k + 1));
});

test('trade: fills at the next open, a stop on the losing side, a gap fills at the open, time exit at open i+1+H', () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ time: day(i), open: 100, high: 101, low: 99, close: 100 }));
  const bars = mk(60), A = atr(bars);
  const t = trade(bars, A, 30, 1, 10);
  assert.equal(t.entry, bars[31].open); assert.equal(t.exit, bars[41].open); assert.equal(t.why, 'time');
  assert.equal(t.dist, 2 * A[30]); assert.ok(t.dist > 0);
  const b2 = mk(60); b2[35] = { ...b2[35], open: 90, low: 89, high: 91, close: 90 };
  const s = trade(b2, atr(b2), 30, 1, 10); assert.equal(s.why, 'stop'); assert.equal(s.exit, 90);
  assert.equal(trade(b2, atr(b2), 30, -1, 10).why, 'time');
  assert.equal(trade(bars, A, 50, 1, 10), null);
});

test('costs: $0.60 a round trip, financing on buys only, doubled at 2x; Holm; excess vs the every-day mean', () => {
  const t = { side: 1, entry: 2000, exit: 2040, dist: 20, entryT: Date.UTC(2020, 0, 6) / 1000, exitT: Date.UTC(2020, 0, 13) / 1000 };
  const r = rOf(t), fin = 7 * 0.000148 * 2000 / 20;
  assert.equal(r.gross, 2); assert.equal(r.nights, 7);
  assert.ok(Math.abs(r.net - (2 - 0.03 - fin)) < 1e-12 && Math.abs(r.net2 - (2 - 0.06 - 2 * fin)) < 1e-12);
  assert.ok(Math.abs(rOf({ ...t, side: -1 }).net - (-2 - 0.03)) < 1e-12);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const T = (d, net) => ({ entryT: Date.UTC(2010, 0, d) / 1000, net, net2: net, gross: net, why: 'time' });
  const base = [T(1, 1), T(2, 0), T(3, -1), T(4, 2)];
  const w = windowStats([base[0], base[3]], base, Date.UTC(2010, 0, 1) / 1000, Date.UTC(2010, 2, 1) / 1000);
  assert.equal(w.baseNet, 0.5); assert.equal(w.excess, 1);
  const c = Array.from({ length: 400 }, (_, i) => 1000 + Math.sin(i / 9) * 40);
  const s = study(c.map((v, i) => ({ time: day(i), open: v, high: v + 6, low: v - 6, close: v })), { ...P, warm: 0 });
  for (const x of Object.values(s.tests)) assert.equal(x.placebo.seeds.length, 40);
});

test('the report matches result.json', () => {
  assert.equal(R.verdict, 'FAIL'); assert.equal(R.pass, false);
  const v = md.match(/\*\*Verdict:[^*]*\*\*/)[0];
  assert.match(v, /^\*\*Verdict: FAIL, 0 of 3: /);
  assert.ok(v.length < 220, `verdict line ${v.length} chars`);
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  for (const id of ['T1', 'T2', 'T3']) {
    const x = R.tests[id];
    assert.equal(x.pass, false);
    for (const w of ['IS', 'OOS']) {
      assert.ok(md.includes(`| ${x[w].n} |`), `${id} ${w} n`);
      for (const k of ['gross', 'net', 'baseNet', 'excess', 'excess2']) assert.ok(md.includes(f(x[w][k])), `${id} ${w} ${k} ${f(x[w][k])}`);
      for (const k of ['t', 'plainT', 'grossT']) assert.ok(md.includes(x[w][k].toFixed(2)), `${id} ${w} ${k}`);
    }
    assert.ok(md.includes(`(${x.placebo.beaten}; `), `${id} placebo`);
    assert.ok(md.includes(`Holm p ${x.holmP.toFixed(2)}`), `${id} holm`);
    assert.equal(x.checks.n, true);
  }
});
