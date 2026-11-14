// research/edge/gold-spx-vol-regime: the three event rules and the trade on hand-made candles, no look-ahead, the control path,
// and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bars, rv, eventsE1, eventsMed, trade, baseline, shuffled, monthT, holm, mulberry32, dateOf, COST, K } from '../research/edge/gold-spx-vol-regime/run.mjs';

const dir = new URL('../research/edge/gold-spx-vol-regime/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// weekday candles from 2024-01-01; f(i) -> close
function rows(n, f, spread = 0.5) { const out = []; let t = Date.UTC(2024, 0, 1) / 1000, prev = f(0);
  while (out.length < n) { const w = new Date(t * 1000).getUTCDay();
    if (w && w < 6) { const c = f(out.length); out.push([t, prev, Math.max(prev, c) + spread, Math.min(prev, c) - spread, c, 1]); prev = c; }
    t += 86400; } return out; }
const zig = (a) => (i) => 100 + (i % 2 ? a(i) : -a(i));
const idxOf = (B, d) => B.findIndex((b) => dateOf(b.time) === d);

test('E1: equity volatility jumping while gold stays calm is found once, at the jump', () => {
  const S = bars(rows(140, zig((i) => (i >= 100 ? 1 : 0.1))));
  const G = bars(rows(140, zig(() => 0.1)));
  const ev = eventsE1(S, G);
  assert.equal(ev.length, 1);
  const i = idxOf(S, ev[0].d);
  assert.ok(i >= 100 && i <= 101, 'event at the jump: ' + i);
  assert.ok(ev[0].q >= K);
  // the same jump in gold's volatility cancels it
  assert.equal(eventsE1(S, bars(rows(140, zig((i) => (i >= 100 ? 1 : 0.1))))).length, 0);
});

test('E2 / E3: RV5 crossing its 252-day median, up and down', () => {
  const amp = (i) => (i >= 300 && i < 330 ? 1 : 0.1 + 0.001 * (i % 7));
  const S = bars(rows(400, zig(amp)));
  const up = eventsMed(S, 1), dn = eventsMed(S, -1);
  assert.ok(up.some((e) => { const i = idxOf(S, e.d); return i >= 300 && i <= 301; }), 'up-cross at the turn');
  assert.ok(dn.some((e) => { const i = idxOf(S, e.d); return i >= 334 && i <= 342; }), "first down-cross once calm returns");
  for (const e of up) assert.ok(e.rv > e.med);
  for (const e of dn) assert.ok(e.rv < e.med);
  assert.ok(eventsMed(S, 1).every((e) => idxOf(S, e.d) >= 5 + 251), 'no event before a full median window');
});

test('no look-ahead: changing every candle after an event leaves the events up to it unchanged', () => {
  const f = zig((i) => (i >= 100 ? 1 : 0.1));
  const G = bars(rows(140, zig(() => 0.1)));
  const a = eventsE1(bars(rows(140, f)), G)[0];
  const b = eventsE1(bars(rows(140, (i) => (i > 101 ? 50 + i : f(i)))), G)[0];
  assert.deepEqual(a, b);
  const v1 = rv(bars(rows(80, f)), 5), v2 = rv(bars(rows(80, (i) => (i > 60 ? 7 * i : f(i)))), 5);
  assert.deepEqual(v1.slice(0, 61), v2.slice(0, 61));
});

test('trade: stop, time exit, costs, financing on buys only', () => {
  const G = bars(rows(60, (i) => 100 + i * 0.1));
  const t = trade(G, 30, 5, 1);
  assert.equal(t.how, 'time');
  assert.ok(t.R > 0 && t.fin > 0);
  assert.ok(Math.abs(t.net - (t.R - COST / t.risk - t.fin)) < 1e-12);
  const s = trade(G, 30, 5, -1);
  assert.equal(s.fin, 0);
  assert.ok(s.R < 0);
  const C = bars(rows(60, (i) => (i <= 30 ? 100 + i * 0.1 : 80)));
  const x = trade(C, 30, 5, 1);
  assert.equal(x.how, 'stop');
  assert.ok(x.R < -1);
  assert.equal(trade(G, 10, 5, 1), null);
  assert.equal(trade(G, 58, 5, 1), null);
  assert.ok(baseline(bars(rows(60, (i) => 100 + i)), 5, 1).get('2024') > 0);
});

test('control path: same dates, same candles per year in another order', () => {
  const G = bars(rows(300, (i) => 100 + 5 * Math.sin(i / 7) + i * 0.05));
  const P = shuffled(G, mulberry32(7));
  assert.equal(P.length, G.length);
  assert.deepEqual(P.map((x) => x.time), G.map((x) => x.time));
  const rel = (A) => A.slice(1).map((x, i) => +(x.close / A[i].close).toFixed(10)).sort();
  assert.deepEqual(rel(P), rel(G));
  for (const x of P) assert.ok(x.high >= Math.max(x.open, x.close) - 1e-9 && x.low <= Math.min(x.open, x.close) + 1e-9);
});

test('statistics helpers', () => {
  assert.equal(monthT([{ a: '2024-01-02', ex: 1 }, { a: '2024-01-05', ex: 1 }, { a: '2024-02-02', ex: 3 }, { a: '2024-03-02', ex: 1 }]).months, 3);
  holm([0.01, 0.04, 0.03]).forEach((v, i) => assert.ok(Math.abs(v - [0.03, 0.06, 0.06][i]) < 1e-12));
});

test('report matches result.json', () => {
  assert.equal(R.verdict, 'FAIL');
  assert.deepEqual(R.passed, []);
  assert.deepEqual([R.events.E1.is, R.events.E1.oos, R.events.E2.is, R.events.E2.oos, R.events.E3.is, R.events.E3.oos], [153, 143, 131, 138, 135, 137]);
  const head = MD.match(/\*\*Verdict: ([^*]+)\*\*/)[1];
  assert.ok(head.length < 220);
  const sgn = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  const T1 = R.tests.T1;
  assert.ok(head.includes(`${sgn(T1.oos.ex)}R out of sample (n ${T1.oos.n}, month t ${T1.oos.tEx.toFixed(2)})`));
  assert.ok(head.includes(`${sgn(T1.is.ex)}R in sample`));
  const cell = (x) => (x === 0 ? '0.000' : sgn(x));
  for (const [k, r] of Object.entries(R.tests)) {
    assert.equal(r.pass, false);
    assert.ok(MD.includes(`| ${k} | ${r.oos.n} | ${r.oos.ex > 0 ? r.oos.ex.toFixed(3) : r.oos.ex.toFixed(3)} | ${r.holm} | ${r.placebo.beaten} | ${r.control.beaten} | no |`), k + ' check row');
    for (const [w, lab] of [['is', 'IS 2007-16'], ['oos', 'OOS 2017-26']]) {
      const s = r[w];
      assert.ok(MD.includes(`| ${k} | ${lab} | ${s.n} | ${cell(s.ex)} | ${s.tEx.toFixed(2)} | ${cell(s.net)} | ${s.tNet.toFixed(2)} |`), `${k} ${w} row`);
    }
  }
});
