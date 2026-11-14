// research/edge/gold-bond-52w-extreme: the zone rule and the trade on hand-made candles, no look-ahead, and the report
// against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bars, zoneDays, trade, baseline, monthT, holm, COST, Q } from '../research/edge/gold-bond-52w-extreme/run.mjs';

const dir = new URL('../research/edge/gold-bond-52w-extreme/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// weekday candles from 2024-01-01; f(i) -> close
function rows(n, f, spread = 0.5) { const out = []; let t = Date.UTC(2024, 0, 1) / 1000, prev = f(0);
  while (out.length < n) { const w = new Date(t * 1000).getUTCDay();
    if (w && w < 6) { const c = f(out.length); out.push([t, prev, Math.max(prev, c) + spread, Math.min(prev, c) - spread, c, 1]); prev = c; }
    t += 86400; } return out; }
const dayIdx = (B, d) => B.findIndex((b) => new Date(b.time * 1000).toISOString().slice(0, 10) === d);

test('zone: a bond at the bottom / top of its 253-close range is found on the right days', () => {
  // flat-ish oscillation 100..110 for 260 bars, then a fall to 99 (bottom), then a rise to 112 (top)
  const f = (i) => (i < 260 ? 105 + 5 * Math.sin(i / 7) : i < 270 ? 99 : 112);
  const B = bars(rows(280, f));
  const Z = zoneDays(B);
  const lo = Z.filter((z) => z.zone === 'lo').map((z) => dayIdx(B, z.d));
  const hi = Z.filter((z) => z.zone === 'hi').map((z) => dayIdx(B, z.d));
  for (let i = 260; i < 270; i++) assert.ok(lo.includes(i), 'bottom day ' + i);
  for (let i = 270; i < 280; i++) assert.ok(hi.includes(i), 'top day ' + i);
  assert.ok(Z.every((z) => (z.zone === 'lo' ? z.pos <= Q : z.pos >= 1 - Q)));
  assert.ok(Z.every((z) => dayIdx(B, z.d) >= 252));
});

test('no look-ahead: changing every candle after a day leaves its zone reading unchanged', () => {
  const f = (i) => (i < 260 ? 105 + 5 * Math.sin(i / 7) : 99);
  const a = zoneDays(bars(rows(280, f))).filter((z) => z.d <= '2024-12-31');
  const cut = a.at(-1).d;
  const g = (i) => (i > 265 ? 300 - i : f(i));
  const B2 = bars(rows(280, g));
  const b = zoneDays(B2).filter((z) => z.d <= cut && dayIdx(B2, z.d) <= 265);
  assert.deepEqual(a.filter((z) => dayIdx(bars(rows(280, f)), z.d) <= 265), b);
});

test('trade: one-day hold, stop, costs and financing on buys', () => {
  const G = bars(rows(60, (i) => 100 + i * 0.1));
  const t = trade(G, 30, 1, 1);
  assert.equal(t.how, 'time');
  assert.ok(t.R > 0 && t.fin > 0);
  assert.ok(Math.abs(t.net - (t.R - COST / t.risk - t.fin)) < 1e-12);
  const C = bars(rows(60, (i) => (i <= 30 ? 100 + i * 0.1 : 80)));
  const s = trade(C, 30, 1, 1);
  assert.equal(s.how, 'stop');
  assert.ok(s.R < -1);
  assert.equal(trade(G, 10, 1, 1), null);
  assert.equal(trade(G, 59, 1, 1), null);
  assert.ok(baseline(bars(rows(60, (i) => 100 + i)), 1, 1).get('2024') > 0);
});

test('statistics helpers', () => {
  const T = [{ a: '2024-01-02', ex: 1 }, { a: '2024-01-05', ex: 1 }, { a: '2024-02-02', ex: 3 }, { a: '2024-03-02', ex: 1 }];
  assert.equal(monthT(T).months, 3);
  holm([0.01, 0.04]).forEach((v, i) => assert.ok(Math.abs(v - [0.02, 0.04][i]) < 1e-12));
});

test('report matches result.json', () => {
  assert.equal(R.verdict, 'FAIL');
  assert.deepEqual(R.passed, []);
  assert.deepEqual(R.events.lo, { is: 160, oos: 439 });
  assert.deepEqual(R.events.hi, { is: 450, oos: 154 });
  const T1 = R.tests.T1;
  const head = MD.match(/\*\*Verdict: ([^*]+)\*\*/)[1];
  assert.ok(head.startsWith('FAIL, 0 of 2: '));
  assert.ok(head.length < 220);
  const sgn = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  assert.ok(head.includes(`${sgn(T1.oos.ex)}R out of sample (n ${T1.oos.n}, month t ${T1.oos.tEx.toFixed(2)})`));
  assert.ok(head.includes(`${sgn(T1.is.ex)}R in sample`));
  for (const [k, r] of Object.entries(R.tests)) {
    assert.equal(r.pass, false);
    assert.ok(MD.includes(`| ${r.oos.n} | ${r.oos.ex.toFixed(3)} | ${r.holm} | ${r.placebo.beaten} |`), k + ' summary row');
    assert.ok(MD.includes(`| ${r.is.n} | ${sgn(r.is.ex)} | ${r.is.tEx.toFixed(2)} |`), k + ' IS row');
    assert.ok(MD.includes(`| ${r.oos.n} | ${sgn(r.oos.ex)} | ${r.oos.tEx.toFixed(2)} |`), k + ' OOS row');
  }
});
