// The 2-day RSI pullback study: Wilder RSI(2) on hand values, next-open fills (no look-ahead), the stop, costs,
// and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rsi, sma, simulate, net, nights, rateAt, holm, P } from '../research/edge/rsi2-pullback/run.mjs';

const DAY = 86400, T0 = Date.parse('2020-01-06T00:00:00Z') / 1000;
const bar = (i, o, h, l, c) => ({ time: T0 + i * DAY, open: o, high: h, low: l, close: c });

test('Wilder RSI(2) on hand values', () => {
  // changes: +1, +1 -> seed gain 1, loss 0 -> 100; then -2: g = 0.5, l = 1 -> 100 - 100/1.5 = 33.33; then +1: g = 0.75, l = 0.5 -> 60
  const r = rsi([10, 11, 12, 10, 11], 2);
  assert.equal(r[0], null); assert.equal(r[1], null);
  assert.equal(r[2], 100);
  assert.equal(+r[3].toFixed(4), +(100 - 100 / 1.5).toFixed(4));
  assert.equal(+r[4].toFixed(4), 60);
  assert.equal(rsi([5, 5, 5], 2)[2], 50);
});

test('SMA reads only days up to i', () => {
  const D = [1, 2, 3, 4, 5].map((c, i) => bar(i, c, c, c, c));
  assert.deepEqual(sma(D, 3), [null, null, 2, 3, 4]);
});

// A long uptrend (so close > SMA200), then a sharp down day, a weak fill day, then a recovery.
function path({ dip = 3, crash = false } = {}) {
  const D = [];
  let px = 100;
  for (let i = 0; i < 260; i++) { px += 0.2; D.push(bar(i, px - 0.1, px + 0.5, px - 0.5, px)); }
  const s = D.length;
  D.push(bar(s, px, px + 0.2, px - dip - 0.2, px - dip));              // a sharp down day: RSI(2) under 10, the signal close
  const sig = s, base = px - dip;
  if (crash) D.push(bar(sig + 1, base + 0.1, base + 0.3, base - 50, base - 40)); // fill day crashes through the stop
  else D.push(bar(sig + 1, base + 0.1, base + 0.5, base - 0.5, base - 0.3)); // fill day closes under SMA5
  for (let k = 0; k < 6; k++) { const c = base + 1 + k * 1.5; D.push(bar(D.length, c - 0.5, c + 0.5, c - 1, c)); }
  return { D, sig };
}

test('signal on the close fills at the NEXT open, exit at the open after the first close above SMA5', () => {
  const { D, sig } = path();
  const tr = simulate(D).find((t) => t.sig === sig);
  assert.ok(tr, 'the dip gives a trade');
  assert.equal(tr.i, sig + 1); assert.equal(tr.entry, D[sig + 1].open);
  const s5 = sma(D, 5);
  const first = D.findIndex((b, j) => j >= tr.i && b.close > s5[j]);
  assert.equal(tr.j, first + 1); assert.equal(tr.exit, D[first + 1].open); assert.equal(tr.why, 'sma5');
  assert.ok(tr.stop < tr.entry && tr.risk > 0, 'a stop below the entry');
});

test('no look-ahead: changing every candle after the signal close changes neither the signal nor the fill', () => {
  const { D, sig } = path();
  const E = D.map((b, j) => (j > sig + 1 ? { ...b, open: 999, high: 1000, low: 998, close: 999 } : j === sig + 1 ? { ...b, high: 999, low: b.low, close: 500 } : b));
  const a = simulate(D).find((t) => t.sig === sig), b = simulate(E).find((t) => t.sig === sig);
  assert.equal(a.entry, b.entry); assert.equal(a.stop, b.stop);
  // and a candle that does not exist yet cannot be filled: cut the data at the signal close -> no trade from it
  assert.equal(simulate(D.slice(0, sig + 1)).find((t) => t.sig === sig), undefined);
});

test('the stop: 3 x ATR(20) below the fill, taken on the entry day, at the open when it gaps', () => {
  const { D, sig } = path({ crash: true });
  const tr = simulate(D).find((t) => t.sig === sig);
  assert.equal(tr.why, 'stop'); assert.equal(tr.j, tr.i);
  assert.equal(tr.exit, Math.min(D[tr.i].open, tr.stop));
  assert.equal(+(tr.risk / P.STOP_ATR).toFixed(9), +((D.slice(sig - 19, sig + 1).reduce((a, x, k) => {
    const prev = D[sig - 19 + k - 1]; return a + Math.max(x.high - x.low, Math.abs(x.high - prev.close), Math.abs(x.low - prev.close));
  }, 0)) / 20).toFixed(9));
  // a gap below the stop on a later day exits at that day's open
  const q = path(), t2 = simulate(q.D).find((t) => t.sig === q.sig), k = t2.i + 1;
  const G = q.D.map((b, j) => (j === k ? { ...b, open: t2.stop - 5, high: t2.stop - 4, low: t2.stop - 6 } : b));
  const g = simulate(G).find((t) => t.sig === q.sig);
  assert.equal(g.why, 'stop'); assert.equal(g.j, k); assert.equal(g.exit, G[k].open);
});

test('costs: spread points and financing per calendar night (Friday to Monday = 3)', () => {
  const fri = Date.parse('2024-01-05T00:00:00Z') / 1000, mon = fri + 3 * DAY;
  assert.equal(nights(fri, mon), 3); assert.equal(nights(fri, fri), 0);
  const rates = [['2023-12-29', 4.0], ['2024-01-12', 5.0]];
  assert.equal(rateAt(rates, fri), 4.0); assert.equal(rateAt(rates, Date.parse('2023-01-01') / 1000), null);
  const x = net({ entry: 1000, exit: 1010, risk: 20, tIn: fri, tOut: mon, hold: 1 }, 1, rates);
  const fin = 3 * (4.0 + 2.5) / 100 / 365 * 1000;
  assert.equal(+x.fin.toFixed(9), +fin.toFixed(9));
  assert.equal(+x.R.toFixed(9), +((10 - 1 - fin) / 20).toFixed(9));
});

test('Holm step-down', () => {
  const h = holm([0.01, 0.04, 0.03]);
  assert.deepEqual(h.map((x) => +x.adj.toFixed(4)), [0.03, 0.06, 0.06]);
  assert.deepEqual(h.map((x) => x.pass), [true, false, false]);
});

test('RESULT.md says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/rsi2-pullback/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/rsi2-pullback/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL\*\*/);
  assert.ok(Object.values(r.markets).every((m) => !m.pass));
  const sg = (v, d) => (v >= 0 ? '+' : '') + v.toFixed(d);
  for (const [k, m] of Object.entries(r.markets)) {
    const B = m.B, A = m.A, name = k.toUpperCase();
    assert.ok(md.includes(`| ${name} | ${B.n} | ${sg(B.avgRet, 3)} | ${sg(B.avgR, 3)} | ${B.wr.toFixed(2)} % | ${B.tTrades.toFixed(2)} | ${B.tMonths.toFixed(2)} | ${sg(B.placebo.p95, 3)} | ${m.holmP.toFixed(4)} |`), `window B row ${k}`);
    assert.ok(md.includes(`| ${name} | ${A.n} | ${sg(A.avgRet, 3)} | ${sg(A.avgR, 3)} | ${A.tTrades.toFixed(2)} | ${A.tMonths.toFixed(2)} |`), `window A row ${k}`);
  }
  assert.ok(!fs.existsSync(new URL('../research/proposals/2026-11-13-rsi2.md', import.meta.url)), 'no proposal on a FAIL');
});
