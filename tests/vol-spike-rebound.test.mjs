// The volatility-spike rebound study: realised vol and its median read only past data, next-open fills, the stop, the time
// exit, costs, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rv, pastMedian, median, signals, simulate, net, nights, rateAt, holm, sma, P } from '../research/edge/vol-spike-rebound/run.mjs';

const DAY = 86400, T0 = Date.parse('2020-01-06T00:00:00Z') / 1000;
const bar = (i, o, h, l, c) => ({ time: T0 + i * DAY, open: o, high: h, low: l, close: c });

// a calm drift (alternating small moves), then a sharp sell-off, then a recovery
function path({ crash = false } = {}) {
  const D = []; let px = 100;
  for (let i = 0; i < 200; i++) { px *= i % 2 ? 1.003 : 0.999; D.push(bar(i, px, px * 1.002, px * 0.998, px)); }
  const drops = [0.96, 1.03, 0.95, 1.02, 0.94];
  for (const f of drops) { const o = px; px *= f; D.push(bar(D.length, o, Math.max(o, px) * 1.001, Math.min(o, px) * 0.999, px)); }
  const sig = D.length - 1, base = px;
  if (crash) D.push(bar(sig + 1, base * 1.001, base * 1.002, base * 0.5, base * 0.6));
  for (let k = 0; k < 15; k++) { const c = (crash ? base * 0.6 : base) * (1 + 0.003 * (k + 1)); D.push(bar(D.length, c * 0.999, c * 1.002, c * 0.997, c)); }
  return { D, sig };
}

test('realised vol: sample sd of the last 5 log returns x sqrt 252', () => {
  const c = [100, 101, 99, 102, 100, 103];
  const D = c.map((x, i) => bar(i, x, x, x, x)), v = rv(D, 5);
  const r = c.slice(1).map((x, i) => Math.log(x / c[i])), m = r.reduce((a, b) => a + b) / 5;
  const sd = Math.sqrt(r.reduce((a, x) => a + (x - m) ** 2, 0) / 4) * Math.sqrt(252);
  assert.equal(v[4], null); assert.equal(+v[5].toFixed(12), +sd.toFixed(12));
});

test('the median baseline uses only the values BEFORE day i', () => {
  const v = [1, 2, 3, 4, 100];
  const md = pastMedian(v, 3);
  assert.deepEqual(md.slice(0, 3), [null, null, null]);
  assert.equal(md[3], 2); assert.equal(md[4], 3); // today's 100 is not in its own baseline
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.deepEqual(sma([1, 2, 3].map((c, i) => bar(i, c, c, c, c)), 2), [null, 1.5, 2.5]);
});

test('no look-ahead: signals and the fill do not change when every later candle changes', () => {
  const { D, sig } = path();
  const s = signals(D);
  assert.ok(s[sig], 'the sell-off close is a signal');
  const E = D.map((b, j) => (j > sig ? { ...b, open: 1, high: 2, low: 0.5, close: 1 } : b));
  assert.deepEqual(signals(E).slice(0, sig + 1), s.slice(0, sig + 1));
  assert.deepEqual(signals(D.slice(0, sig + 1)), s.slice(0, sig + 1));
  const a = simulate(D, 5).find((t) => t.sig === sig), b = simulate(D.map((x, j) => (j > sig + 1 ? { ...x, close: 999, high: 1000 } : x)), 5).find((t) => t.sig === sig);
  assert.equal(a.entry, b.entry); assert.equal(a.stop, b.stop);
  assert.equal(simulate(D.slice(0, sig + 1), 5).find((t) => t.sig === sig), undefined, 'no candle to fill on, no trade');
});

test('entry at the next open, time exit at the close of the 5th (10th) trading day, stop 3 x ATR(20)', () => {
  const { D, sig } = path();
  for (const H of [5, 10]) {
    const tr = simulate(D, H).find((t) => t.sig === sig);
    assert.equal(tr.i, sig + 1); assert.equal(tr.entry, D[sig + 1].open);
    assert.equal(tr.why, 'time'); assert.equal(tr.j, sig + H); assert.equal(tr.exit, D[sig + H].close); assert.equal(tr.hold, H);
    let a = 0; for (let j = sig - 19; j <= sig; j++) a += Math.max(D[j].high - D[j].low, Math.abs(D[j].high - D[j - 1].close), Math.abs(D[j].low - D[j - 1].close));
    assert.equal(+tr.risk.toFixed(9), +(P.STOP_ATR * a / 20).toFixed(9));
    assert.ok(tr.stop < tr.entry);
  }
  // no new entry while in the trade
  const all = simulate(D, 10);
  for (let k = 1; k < all.length; k++) assert.ok(all[k].sig >= all[k - 1].j);
});

test('the stop is checked from the entry day, at the open when it gaps through', () => {
  const { D, sig } = path({ crash: true });
  const tr = simulate(D, 5).find((t) => t.sig === sig);
  assert.equal(tr.why, 'stop'); assert.equal(tr.j, tr.i); assert.equal(tr.exit, tr.stop);
  const q = path(), t2 = simulate(q.D, 5).find((t) => t.sig === q.sig), k = t2.i + 2;
  const G = q.D.map((b, j) => (j === k ? { ...b, open: t2.stop - 1, high: t2.stop - 0.5, low: t2.stop - 2 } : b));
  const g = simulate(G, 5).find((t) => t.sig === q.sig);
  assert.equal(g.why, 'stop'); assert.equal(g.j, k); assert.equal(g.exit, G[k].open);
});

test('costs: spread and financing per calendar night; Holm', () => {
  const fri = Date.parse('2024-01-05T00:00:00Z') / 1000, mon = fri + 3 * DAY;
  assert.equal(nights(fri, mon), 3);
  const rates = [['2023-12-29', 4.0]];
  assert.equal(rateAt(rates, fri), 4.0);
  const x = net({ entry: 1000, exit: 1010, risk: 20, tIn: fri, tOut: mon }, 1, rates), fin = 3 * 6.5 / 100 / 365 * 1000;
  assert.equal(+x.R.toFixed(9), +((10 - 1 - fin) / 20).toFixed(9));
  assert.deepEqual(holm([0.0057, 0.0253]).map((h) => +h.adj.toFixed(4)), [0.0114, 0.0253]);
});

test('RESULT.md says what result.json holds; a proposal exists because it passed', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/vol-spike-rebound/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/vol-spike-rebound/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}\\*\\*`));
  const sg = (v, d) => (v >= 0 ? '+' : '') + v.toFixed(d);
  for (const H of [5, 10]) {
    const { A, B, pass } = r.holds[H];
    assert.ok(md.includes(`| ${H} days | ${B.n} | ${sg(B.avgR, 3)} | ${sg(B.avgRet, 3)} | ${B.wr.toFixed(2)} % | ${B.tTrades.toFixed(2)} | ${B.holmP.toFixed(4)} | ${B.tMonths.toFixed(2)} | ${B.clusters.t.toFixed(2)} | ${sg(B.random.p95, 3)} | ${A.n} | ${sg(A.avgR, 3)} | ${pass ? 'PASS' : 'fail'} |`), `pooled row ${H}`);
    for (const [k, m] of Object.entries(r.holds[H].markets)) {
      assert.ok(md.includes(`| ${H} | ${k.toUpperCase()} | ${m.B.n} | ${sg(m.B.avgR, 3)} | ${m.B.tTrades.toFixed(2)} | ${m.A.n} | ${sg(m.A.avgR, 3)} | ${m.A.tTrades.toFixed(2)} |`), `market row ${H} ${k}`);
    }
  }
  assert.equal(r.verdict === 'PASS', Object.values(r.holds).some((h) => h.pass));
  assert.equal(fs.existsSync(new URL('../research/proposals/2026-11-13-vol-spike-rebound.md', import.meta.url)), r.verdict === 'PASS');
});
