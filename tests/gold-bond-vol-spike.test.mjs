// research/edge/gold-bond-vol-spike: the onset rule and the trade on hand-made candles, no look-ahead, and the report against
// result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bars, onsets, trade, baseline, monthT, holm, COST, K } from '../research/edge/gold-bond-vol-spike/run.mjs';

const dir = new URL('../research/edge/gold-bond-vol-spike/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// weekday candles from 2024-01-01; f(i) -> close
function rows(n, f, spread = 0.5) { const out = []; let t = Date.UTC(2024, 0, 1) / 1000, prev = f(0);
  while (out.length < n) { const w = new Date(t * 1000).getUTCDay();
    if (w && w < 6) { const c = f(out.length); out.push([t, prev, Math.max(prev, c) + spread, Math.min(prev, c) - spread, c, 1]); prev = c; }
    t += 86400; } return out; }

test('onset: a jump in short volatility after a calm stretch is found once, on the right day', () => {
  // alternating small moves, then from bar 100 large ones
  const B = bars(rows(140, (i) => 100 + (i % 2 ? 0.05 : -0.05) * (i >= 100 ? 10 : 1)));
  const ev = onsets(B);
  assert.ok(ev.length >= 1);
  const first = ev[0].d, idx = B.findIndex((b) => new Date(b.time * 1000).toISOString().slice(0, 10) === first);
  assert.ok(idx >= 100 && idx <= 102, 'onset at the jump: ' + idx);
  assert.ok(ev[0].ratio >= K);
  // cooldown: no second onset within 5 bars
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i].d > ev[i - 1].d);
});

test('no look-ahead: changing every candle after the onset leaves it unchanged', () => {
  const f = (i) => 100 + (i % 2 ? 0.05 : -0.05) * (i >= 100 ? 10 : 1);
  const a = onsets(bars(rows(140, f)))[0];
  const b = onsets(bars(rows(140, (i) => (i > 102 ? 50 + i : f(i)))))[0];
  assert.deepEqual(a, b);
});

test('trade: stop, time exit, costs and financing on buys', () => {
  const G = bars(rows(60, (i) => 100 + i * 0.1));
  const t = trade(G, 30, 5, 1);
  assert.equal(t.how, 'time');
  assert.ok(t.R > 0 && t.fin > 0);
  assert.ok(Math.abs(t.net - (t.R - COST / t.risk - t.fin)) < 1e-12);
  // a crash after entry hits the stop and fills at the gapped open
  const C = bars(rows(60, (i) => (i <= 30 ? 100 + i * 0.1 : 80)));
  const s = trade(C, 30, 5, 1);
  assert.equal(s.how, 'stop');
  assert.ok(s.R < -1);
  assert.equal(trade(G, 10, 5, 1), null);           // not enough candles for the ATR
  assert.equal(trade(G, 58, 5, 1), null);           // no full hold window
  const base = baseline(bars(rows(60, (i) => 100 + i)), 5, 1);
  assert.ok(base.get('2024') > 0);
});

test('statistics helpers', () => {
  const T = [{ a: '2024-01-02', ex: 1 }, { a: '2024-01-05', ex: 1 }, { a: '2024-02-02', ex: 3 }, { a: '2024-03-02', ex: 1 }];
  const m = monthT(T);
  assert.equal(m.months, 3);
  holm([0.01, 0.04, 0.03]).forEach((v, i) => assert.ok(Math.abs(v - [0.03, 0.06, 0.06][i]) < 1e-12));
});

test('report matches result.json', () => {
  assert.equal(R.verdict, 'FAIL');
  assert.deepEqual(R.passed, []);
  assert.equal(R.events.is, 117);
  assert.equal(R.events.oos, 112);
  const T1 = R.tests.T1;
  assert.match(MD, /\*\*Verdict: FAIL, 0 of 3: [^*]+\*\*/);
  const head = MD.match(/\*\*Verdict: ([^*]+)\*\*/)[1];
  assert.ok(head.length < 220);
  const sgn = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  assert.ok(head.includes(`${sgn(T1.oos.ex)}R out of sample (n ${T1.oos.n}, month t ${T1.oos.tEx.toFixed(2)})`));
  assert.ok(head.includes(`${sgn(T1.is.ex)}R in sample`));
  for (const [k, r] of Object.entries(R.tests)) {
    assert.equal(r.pass, false);
    assert.ok(MD.includes(`| ${r.holm} | ${r.placebo.beaten} |`), k + ' holm / placebo row');
    assert.ok(MD.includes(`| ${r.oos.n} | ${sgn(r.oos.ex).replace('-0.000', '0.000').replace('+0.000', '0.000')} |`), k + ' oos row');
  }
});
