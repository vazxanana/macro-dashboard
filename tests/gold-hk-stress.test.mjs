// research/edge/gold-hk-stress: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gapMap, days, tradeAt, simulate, atrBefore, holm, TESTS, LOOK } from '../research/edge/gold-hk-stress/run.mjs';

const DAY = 86400, T0 = Date.UTC(2020, 0, 6) / 1000; // a Monday
function bars(closes) {
  const out = []; let t = T0;
  closes.forEach((c, i) => {
    while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += DAY;
    const o = i ? closes[i - 1] : c;
    out.push({ time: t, open: o, high: Math.max(o, c) + 1, low: Math.min(o, c) - 1, close: c }); t += DAY;
  });
  return out;
}
const wiggle = (n, base, amp) => Array.from({ length: n }, (_, i) => base + (i % 3 === 0 ? amp : i % 3 === 1 ? -amp : 0));

test('the gap is HK 5-day log return minus US 5-day log return', () => {
  const hk = bars([100, 100, 100, 100, 100, 90]), us = bars([200, 200, 200, 200, 200, 210]);
  const g = gapMap(hk, us), t = hk.at(-1).time;
  assert.ok(Math.abs(g.get(t) - (Math.log(0.9) - Math.log(1.05))) < 1e-12);
});

test('a stress day needs the gap at or below the q-quantile of the 250 gaps before it; a global sell-off is not one', () => {
  const n = LOOK + 20, hk = wiggle(n, 20000, 50), us = wiggle(n, 3000, 15), gold = wiggle(n + 1, 1000, 2);
  const hkD = [...hk, 18000], usD = [...us, 3000], usBoth = [...us, 2700];
  const d1 = days(bars(gold), bars(hkD), bars(usD), 0.15), d2 = days(bars(gold), bars(hkD), bars(usBoth), 0.15);
  assert.equal(d1.at(-1).liq, true, 'HK alone falls: stress');
  assert.equal(d2.at(-1).liq, false, 'both fall by the same 10 %: not China-specific');
});

test('no look-ahead: a day flag and cut do not change with later candles', () => {
  const n = LOOK + 30, hk = wiggle(n, 20000, 50), us = wiggle(n, 3000, 7.5), gold = wiggle(n + 5, 1000, 2);
  const a = days(bars(gold), bars(hk), bars(us), 0.15);
  const b = days(bars(gold), bars([...hk, 5000, 40000]), bars([...us, 9000, 100]), 0.15);
  for (const d of a) { const e = b.find((x) => x.t === d.t); assert.equal(e.cut, d.cut); assert.equal(e.liq, d.liq); }
});

test('trade: entry at the next open, stop 2 x ATR, exit at the H-th close or the stop, costs charged', () => {
  const g = bars(wiggle(50, 1000, 2));
  const j = 30, atr = atrBefore(g, j), tr = tradeAt(g, j, 5);
  assert.equal(tr.e, g[j].open);
  assert.ok(Math.abs(tr.risk - 2 * atr) < 1e-9);
  assert.equal(tr.kind, 'time'); assert.equal(tr.k, j + 4);
  assert.ok(tr.net < tr.gross && tr.fin > 0);
  const crash = g.map((b, i) => (i === 32 ? { ...b, low: 900 } : b));
  const ts = tradeAt(crash, 30, 5);
  assert.equal(ts.kind, 'stop'); assert.ok(Math.abs(ts.gross + 1) < 1e-9);
});

test('one trade at a time unless free; holm', () => {
  const g = bars(wiggle(80, 1000, 2)), ds = [{ t: g[40].time }, { t: g[42].time }, { t: g[60].time }];
  assert.equal(simulate(ds, g, 5).length, 2);
  assert.equal(simulate(ds, g, 5, { free: true }).length, 3);
  assert.deepEqual(holm([0.01, 0.04, 0.5]), [0.03, 0.08, 0.5]);
});

test('the report says what result.json says', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-hk-stress/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-hk-stress/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.tests.length, TESTS.length);
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}, ${r.passed} of 3`));
  const t1 = r.tests[0];
  assert.ok(md.includes(`n ${t1.oos.n}, month t ${t1.oos.tMonth.toFixed(2)}`));
  const f = (v) => (v > 0 ? '+' : '') + v.toFixed(3);
  for (const t of r.tests) {
    for (const w of ['is', 'oos']) {
      const x = t[w];
      assert.ok(md.includes(`| ${x.liqDays} | ${x.n} | ${f(x.gross)} | ${f(x.net)} | ${f(x.base.net)} | ${f(x.excess)} | ${x.tMonth.toFixed(2)} | ${f(x.excess2x)} |`), `${t.id} ${w}`);
      assert.ok(x.n >= 100, 'at least 100 events in each window');
    }
    assert.ok(md.includes(`${t.placebo.beaten} of 40`));
    assert.equal(t.pass, false);
  }
});
