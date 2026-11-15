// research/edge/silver-nikkei-drop (gold-nikkei-drop's rule on silver): the rule on hand-made candles, no look-ahead, the
// same-year baseline, no silver financing, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { retMap, days, tradeAt, simulate, atrBefore, holm, yearMeans, summarize, TESTS, LOOK, RT, FIN_SILVER, FIN_SENS } from '../research/edge/silver-nikkei-drop/run.mjs';

const DAY = 86400, T0 = Date.UTC(2020, 0, 6) / 1000; // a Monday
function bars(closes) {
  const out = []; let t = T0;
  closes.forEach((c, i) => {
    while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += DAY;
    const o = i ? closes[i - 1] : c;
    out.push({ time: t, open: o, high: Math.max(o, c) + 0.2, low: Math.min(o, c) - 0.2, close: c }); t += DAY;
  });
  return out;
}
const wiggle = (n, base, amp) => Array.from({ length: n }, (_, i) => base + (i % 3 === 0 ? amp : i % 3 === 1 ? -amp : 0));

test('the Nikkei return is the one-day log return', () => {
  const jp = bars([100, 100, 90]), m = retMap(jp);
  assert.ok(Math.abs(m.get(jp[2].time) - Math.log(0.9)) < 1e-12);
});

test('a drop day needs the return at or below the q-quantile of the 250 returns before it', () => {
  const n = LOOK + 20, jp = wiggle(n, 30000, 100), ag = wiggle(n + 1, 25, 0.3);
  const down = days(bars(ag), bars([...jp, 27000]), 0.10), up = days(bars(ag), bars([...jp, 33000]), 0.10);
  assert.equal(down.at(-1).liq, true, 'a 10 % fall is a drop day');
  assert.equal(up.at(-1).liq, false, 'a rise is not');
});

test('no look-ahead: a day flag and cut do not change with later candles', () => {
  const n = LOOK + 30, jp = wiggle(n, 30000, 100), ag = wiggle(n + 5, 25, 0.3);
  const a = days(bars(ag), bars(jp), 0.10);
  const b = days(bars(ag), bars([...jp, 5000, 90000]), 0.10);
  for (const d of a) { const e = b.find((x) => x.t === d.t); assert.equal(e.cut, d.cut); assert.equal(e.liq, d.liq); }
});

test('trade: entry at the next open, stop 2 x ATR, exit at the H-th close or the stop, cost charged, no financing', () => {
  const g = bars(wiggle(50, 25, 0.3));
  const j = 30, atr = atrBefore(g, j), tr = tradeAt(g, j, 5);
  assert.equal(tr.e, g[j].open);
  assert.ok(Math.abs(tr.risk - 2 * atr) < 1e-9);
  assert.equal(tr.kind, 'time'); assert.equal(tr.k, j + 4);
  assert.equal(tr.fin, 0, 'no silver financing rate: none charged');
  assert.ok(Math.abs(tr.gross - tr.net - RT / tr.risk) < 1e-12);
  const tf = tradeAt(g, j, 5, 1, FIN_SENS);
  assert.ok(tf.fin > 0 && tf.net < tr.net, 'the sensitivity charges gold\'s rate');
  const crash = g.map((b, i) => (i === 32 ? { ...b, low: 10 } : b));
  const ts = tradeAt(crash, 30, 5);
  assert.equal(ts.kind, 'stop'); assert.ok(Math.abs(ts.gross + 1) < 1e-9);
});

test('one trade at a time unless free; holm', () => {
  const g = bars(wiggle(80, 25, 0.3)), ds = [{ t: g[40].time }, { t: g[42].time }, { t: g[60].time }];
  assert.equal(simulate(ds, g, 5).length, 2);
  assert.equal(simulate(ds, g, 5, { free: true }).length, 3);
  assert.deepEqual(holm([0.01, 0.04, 0.5]), [0.03, 0.08, 0.5]);
});

test('the excess is taken against the baseline of the same calendar year', () => {
  const y = (yy) => Date.UTC(yy, 5, 1) / 1000;
  const base = [{ sig: y(2018), net: 0.2, gross: 0.2 }, { sig: y(2018), net: 0.4, gross: 0.4 }, { sig: y(2019), net: -1, gross: -1 }];
  const m = yearMeans(base, 'net');
  assert.ok(Math.abs(m.get(2018) - 0.3) < 1e-12); assert.equal(m.get(2019), -1);
  const tr = [{ sig: y(2018), t: y(2018), c: y(2018) + DAY, net: 0.5, gross: 0.5, cost: 0, risk: 1, nights: 1, kind: 'time' },
    { sig: y(2019), t: y(2019), c: y(2019) + DAY, net: 0, gross: 0, cost: 0, risk: 1, nights: 1, kind: 'time' }];
  const s = summarize(tr, base, y(2018), y(2019) + 2 * DAY);
  assert.ok(Math.abs(s.excess - (0.2 + 1) / 2) < 1e-3);
});

test('the rule is gold-nikkei-drop\'s: same thresholds and holds, silver cost, no financing', () => {
  assert.deepEqual(TESTS.map((t) => [t.q, t.hold, t.on]), [[0.10, 5, 'oos'], [0.10, 5, 'pool'], [0.15, 10, 'oos']]);
  assert.equal(LOOK, 250); assert.equal(RT, 0.03); assert.equal(FIN_SILVER, 0);
});

test('the report says what result.json says', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/silver-nikkei-drop/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/silver-nikkei-drop/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.tests.length, TESTS.length);
  assert.deepEqual(r.rule.markets, ['xag', 'jp225']);
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}, ${r.passed} of 3`));
  const t1 = r.tests[0];
  assert.ok(md.includes(`(n ${t1.oos.n}, month t ${t1.oos.tMonth.toFixed(2)})`));
  const f = (v) => (v < 0 ? '' : '+') + v.toFixed(3);
  const W = { is: '2007-16', oos: '2017-26', pool: '2007-26' };
  for (const t of r.tests) {
    if (t.id !== 'T2') for (const w of ['is', 'oos', 'pool']) {
      const x = t[w];
      assert.ok(md.includes(`| ${t.id} | ${W[w]} | ${x.liqDays} | ${x.n} | ${f(x.gross)} | ${f(x.net)} | ${f(x.base.net)} | ${f(x.excess)} | ${x.tMonth.toFixed(2)} | ${f(x.excess2x)} |`), `${t.id} ${w}`);
      assert.ok(x.n >= 100, 'at least 100 events in each window');
    }
    assert.deepEqual(t.tested, t[t.on]);
    assert.ok(md.includes(`| ${t.id} | ${W[t.on]} | ${t.holmP.toFixed(3)} | ${t.placebo.beaten} of 40 |`), `${t.id} holm / placebo`);
    assert.equal(t.pass, false);
  }
  assert.deepEqual(r.tests[1].pool, r.tests[0].pool, 'T2 is the T1 rule');
});
