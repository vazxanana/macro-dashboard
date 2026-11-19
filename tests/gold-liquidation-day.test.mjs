// research/edge/gold-liquidation-day: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { zMap, days, tradeAt, simulate, atrBefore, holm, TESTS } from '../research/edge/gold-liquidation-day/run.mjs';

const DAY = 86400, T0 = Date.UTC(2020, 0, 6) / 1000; // a Monday
// weekday candles from a close series
function bars(closes) {
  const out = []; let t = T0;
  closes.forEach((c, i) => {
    while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += DAY;
    const o = i ? closes[i - 1] : c;
    out.push({ time: t, open: o, high: Math.max(o, c) + 1, low: Math.min(o, c) - 1, close: c }); t += DAY;
  });
  return out;
}
const wiggle = (n, base, amp) => Array.from({ length: n }, (_, i) => base + (i % 2 ? amp : -amp));

test('a day is a liquidation day only when all three markets fall K sd', () => {
  const g = wiggle(70, 1000, 2), s = wiggle(70, 3000, 5), b = wiggle(70, 110, 0.1);
  const gD = [...g, 980], sD = [...s, 2950], bD = [...b, 109], bUp = [...b, 111];
  const d1 = days(bars(gD), bars(sD), bars(bD), 1), d2 = days(bars(gD), bars(sD), bars(bUp), 1);
  assert.equal(d1.at(-1).liq, true);
  assert.equal(d2.at(-1).liq, false, 'bonds up: not a liquidation day');
  assert.equal(d1.slice(0, -1).some((d) => d.liq), false);
});

test('no look-ahead: the z of a day does not change with later candles, and its own return is not in its sd', () => {
  const c = wiggle(80, 1000, 2); c.push(980);
  const a = zMap(bars(c)), more = zMap(bars([...c, 500, 1500]));
  const t = bars(c).at(-1).time;
  assert.equal(a.get(t), more.get(t));
  assert.ok(a.get(t) < -3);
});

test('trade: entry at the next open, stop 2 x ATR, exit at the 10th close or the stop, costs charged', () => {
  const g = bars(wiggle(50, 1000, 2));
  const j = 30, atr = atrBefore(g, j), tr = tradeAt(g, j, 10);
  assert.equal(tr.e, g[j].open);
  assert.ok(Math.abs(tr.risk - 2 * atr) < 1e-9);
  assert.equal(tr.kind, 'time');
  assert.equal(tr.k, j + 9);
  assert.ok(tr.net < tr.gross && tr.fin > 0);
  const crash = g.map((b, i) => (i === 32 ? { ...b, low: 900 } : b));
  const ts = tradeAt(crash, 30, 10);
  assert.equal(ts.kind, 'stop'); assert.equal(ts.exit, ts.stop);
  assert.ok(Math.abs(ts.gross + 1) < 1e-9);
});

test('one trade at a time unless free', () => {
  const g = bars(wiggle(80, 1000, 2)), ds = [{ t: g[40].time }, { t: g[42].time }, { t: g[60].time }];
  assert.equal(simulate(ds, g, 10).length, 2);
  assert.equal(simulate(ds, g, 10, { free: true }).length, 3);
});

test('holm', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.5]), [0.03, 0.08, 0.5]);
});

test('the report says what result.json says', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-liquidation-day/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-liquidation-day/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.tests.length, TESTS.length);
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}, ${r.passed} of 3`));
  const t1 = r.tests[0];
  assert.ok(md.includes(`n ${t1.oos.n}, month t ${t1.oos.tMonth.toFixed(2)}`));
  for (const t of r.tests) {
    for (const w of ['is', 'oos']) {
      const x = t[w], f = (v) => (v > 0 ? '+' : '') + v.toFixed(3);
      assert.ok(md.includes(`| ${x.liqDays} | ${x.n} | ${f(x.gross)} | ${f(x.net)} | ${f(x.base.net)} | ${f(x.excess)} | ${x.tMonth.toFixed(2)} | ${f(x.excess2x)} |`), `${t.id} ${w}`);
    }
    assert.ok(md.includes(`${t.placebo.beaten} of 40`));
    assert.equal(t.pass, false);
  }
});
