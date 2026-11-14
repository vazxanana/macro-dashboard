// gold-absorption study: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { features, trade, withExcess, holm, monthT, HOLD, COST } from '../research/edge/gold-absorption/run.mjs';

const dir = new URL('../research/edge/gold-absorption/', import.meta.url);
const res = JSON.parse(fs.readFileSync(new URL('result.json', dir)));
const report = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// weekdays only, a gentle zigzag, range 2, volume 100; day `spike` gets volume 300 and a range of 0.5
function bars(n, spike = -1) {
  const out = []; let t = Date.UTC(2010, 0, 4) / 1000, p = 1000;
  while (out.length < n) {
    const wd = new Date(t * 1000).getUTCDay();
    if (wd !== 0 && wd !== 6) {
      const k = out.length, c = p + (k % 2 ? 0.5 : -0.6) - (k > n - 30 ? 0 : 0);
      const big = k === spike, r = big ? 0.25 : 1;
      out.push({ time: t, open: p, high: Math.max(p, c) + r, low: Math.min(p, c) - r, close: c, v: big ? 300 : 100 + (k % 7) });
      p = c;
    }
    t += 86400;
  }
  return out;
}

test('an absorption day is flagged from heavy activity on a small range', () => {
  const B = bars(400, 350), F = features(B);
  assert.equal(F[350].abs, true);
  assert.ok(F[350].va > 2 && F[350].rr < 0.5);
  assert.ok(F.slice(300, 350).every((f) => !f || f.E < F[350].E / 3));
});

test('no look-ahead: changing every candle after day i leaves day i flags unchanged', () => {
  const B = bars(400, 350), F = features(B), C = B.map((b, k) => k > 350 ? { ...b, high: b.high + 50, close: b.close + 40, v: b.v * 9 } : b);
  const G = features(C);
  for (let i = 0; i <= 350; i++) assert.deepEqual(G[i], F[i]);
});

test('a trade has its stop on the losing side, pays costs and financing on buys only', () => {
  const B = bars(400), L = trade(B, 300, 1), S = trade(B, 300, -1);
  assert.ok(L.stop < L.entry && S.stop > S.entry);
  assert.ok(L.fin > 0 && S.fin === 0);
  assert.ok(Math.abs(L.net - (L.R - COST / L.risk - L.fin)) < 1e-12);
  assert.equal(trade(B, B.length - HOLD, 1), null);
});

test('excess is net R minus the same-year baseline mean', () => {
  const ev = [{ a: '2020-03-02', net: 0.5 }, { a: '2021-01-05', net: 0.1 }], base = [{ a: '2020-01-01', net: 0.2 }, { a: '2020-06-01', net: 0.0 }];
  const x = withExcess(ev, base);
  assert.equal(x.length, 1); assert.ok(Math.abs(x[0].ex - 0.4) < 1e-12);
});

test('Holm and month t', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.5]), [0.03, 0.08, 0.5]);
  const m = monthT([{ a: '2020-01-01', k: 1 }, { a: '2020-02-01', k: 2 }, { a: '2020-03-01', k: 3 }], 'k');
  assert.equal(m.months, 3); assert.ok(m.t > 3);
});

test('the report matches result.json', () => {
  assert.equal(res.verdict, 'FAIL');
  const T1 = res.tests.T1;
  assert.equal(T1.pass, false);
  assert.match(report, /\*\*Verdict: FAIL: [^*]+\*\*/);
  const line = report.match(/\*\*Verdict: ([^*]+)\*\*/)[1];
  assert.ok(line.length < 220);
  assert.ok(line.includes(`+${T1.oos.stat.toFixed(3)}R`) && line.includes(`n ${T1.oos.n}`) && line.includes(`month t ${T1.oos.t.toFixed(2)}`));
  assert.ok(line.includes(`${T1.is.stat.toFixed(3)}R in sample`));
  for (const k of ['T1', 'T2', 'T3']) for (const w of ['is', 'oos']) {
    const r = res.tests[k][w];
    assert.ok(report.includes(`| ${r.n} |`), `${k} ${w} n`);
    assert.ok(report.includes(Math.abs(r.t).toFixed(2)), `${k} ${w} t`);
  }
  assert.equal(res.tests.T3.checks.isSameSign, false);
  assert.equal(res.tests.T1.placebo.beaten, 40);
});
