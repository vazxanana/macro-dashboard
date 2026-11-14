// gold-factor-residual: the rule on hand-made data, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ols, join, zAt, signals, trade, atr, rOf, baseline, holm, P, TESTS } from '../research/edge/gold-factor-residual/run.mjs';

const dir = new URL('../research/edge/gold-factor-residual/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

function mk(n, seed = 7) {   // four markets on the same weekdays; gold = 0.5 eur - 0.3 bond + 0.2 spx + noise
  let a = seed; const rnd = () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648 - 0.5; };
  const t0 = Date.UTC(2010, 0, 4) / 1000, M = [[], [], [], []], c = [1000, 1.3, 120, 1100];
  let t = t0;
  for (let i = 0; i < n; i++) {
    const f = [rnd() * 0.01, rnd() * 0.006, rnd() * 0.012], g = 0.5 * f[0] - 0.3 * f[1] + 0.2 * f[2] + rnd() * 0.004;
    const r = [g, ...f]; for (let q = 0; q < 4; q++) { const o = c[q]; c[q] *= Math.exp(r[q]); M[q].push({ time: t, open: o, high: Math.max(o, c[q]) * 1.002, low: Math.min(o, c[q]) * 0.998, close: c[q] }); }
    t += 86400; if (new Date(t * 1000).getUTCDay() === 6) t += 2 * 86400;
  }
  return M;
}

test('ols recovers known coefficients', () => {
  const X = [], y = []; for (let i = 0; i < 50; i++) { const x1 = Math.sin(i), x2 = Math.cos(i * 1.7), x3 = (i % 7) / 7; X.push([1, x1, x2, x3]); y.push(0.1 + 2 * x1 - 3 * x2 + 0.5 * x3); }
  const f = ols(X, y); [0.1, 2, -3, 0.5].forEach((b, i) => assert.ok(Math.abs(f.b[i] - b) < 1e-9)); assert.ok(f.s < 1e-9);
});

test('a residual shock gives a fade signal on its day, the opposite side for follow', () => {
  const M = mk(200); const j0 = 150;
  for (let i = j0; i < 200; i++) for (const k of ['open', 'high', 'low', 'close']) M[0][i][k] *= 1.05;   // gold jumps 5 % alone on day 150
  const J = join(M[0], M.slice(1)), z = zAt(J, j0, 5);
  assert.ok(z > 2, `z ${z}`);
  assert.equal(signals(M[0], J, TESTS.T1)[j0], -1);
  assert.equal(signals(M[0], J, TESTS.T3)[j0], 1);
});

test('no look-ahead: changing every day after j leaves z at j unchanged', () => {
  const M = mk(220), J = join(M[0], M.slice(1)), j = 150, z = zAt(J, j, 5);
  const M2 = M.map((s) => s.map((b, i) => (i > j ? { ...b, close: b.close * (1 + (i % 3) * 0.03), open: b.open * 0.9 } : b)));
  assert.equal(zAt(join(M2[0], M2.slice(1)), j, 5), z);
  assert.equal(zAt(J, 60, 5), null);   // fit window before the data starts
});

test('a trade has a stop, fills a gapped stop at the open, and pays financing on buys only', () => {
  const bars = mk(80)[0], A = atr(bars), i = 40;
  const tb = trade(bars, A, i, 1, 10, 2), ts = trade(bars, A, i, -1, 10, 2);
  for (const t of [tb, ts]) { assert.ok(t.dist > 0); assert.ok(t.side > 0 ? t.stop < t.entry : t.stop > t.entry); }
  assert.ok(rOf(tb).fin > 0); assert.equal(rOf(ts).fin, 0);
  const g = bars.map((b) => ({ ...b })); g[i + 2] = { ...g[i + 2], open: tb.stop - 5, low: tb.stop - 6, high: tb.stop - 4 };
  const tg = trade(g, A, i, 1, 10, 2); assert.equal(tg.why, 'stop'); assert.equal(tg.exit, tb.stop - 5);
  const b0 = baseline(bars, 1, 10, bars[20].time, bars[60].time); assert.equal(b0.n, 40);
});

test('holm', () => { assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(2)), [0.03, 0.06, 0.06]); });

test('result.json and RESULT.md agree', () => {
  assert.equal(R.topic, 'gold-factor-residual'); assert.equal(R.verdict, R.tests.T1.pass ? 'PASS' : 'FAIL');
  const v = MD.match(/\*\*Verdict: ([^*]+)\*\*/); assert.ok(v && v[1].length < 220);
  assert.ok(v[1].startsWith(R.verdict));
  for (const [id, x] of Object.entries(R.tests)) {
    assert.equal(x.placebo.seeds.length, P.seeds);
    for (const w of ['IS', 'OOS']) {
      assert.ok(MD.includes(x[w].excess.toFixed(3).replace('-', '−')) || MD.includes(x[w].excess.toFixed(3)), `${id} ${w} excess`);
      assert.ok(MD.includes(x[w].tExcess.toFixed(2)), `${id} ${w} tExcess`);
      assert.ok(MD.includes(String(x[w].n)), `${id} ${w} n`);
    }
    assert.ok(x.OOS.medianStop >= 10);
  }
});
