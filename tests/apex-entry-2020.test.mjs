// tests/apex-entry-2020.test.mjs - the apex / continuation study (research/edge/apex-entry-2020): the report's figures
// against result.json, and the rule's pieces on made-up candles (offline, no candle cache).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { levels, freshAt, frames, allOrders, sim, pips, PLAN } from '../research/edge/apex-entry-2020/run.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'apex-entry-2020');
const R = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
const MD = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
const n = (x) => x.toLocaleString('en-US');
const f3 = (x) => (x < 0 ? '-' : '+') + Math.abs(x).toFixed(3);

test('RESULT.md states the verdict and the figures of result.json', () => {
  assert.equal(R.verdict, 'FAIL');
  assert.match(MD.split('\n')[2], /^\*\*Verdict: FAIL\. 0 of 4 tests pass/);
  for (const T of ['T1', 'T2', 'T3', 'T4']) {
    const x = R.tests[T]; assert.equal(x.pass, false);
    const a = x.net.all, d = x.net.disc, c = x.net.conf;
    assert.ok(MD.includes(`n ${n(a.n)}, ${a.meanR.toFixed(3)}R`), `${T} headline`);
    assert.ok(MD.includes(`${n(d.n)} / ${d.meanR.toFixed(3)} / ${d.tMonth.toFixed(2)}`), `${T} discovery`);
    assert.ok(MD.includes(`${n(c.n)} / ${c.meanR.toFixed(3)} / ${c.tMonth.toFixed(2)}`), `${T} confirmation`);
    assert.ok(MD.includes(`${f3(x.gross.all.meanR)} (t ${x.gross.all.tMonth.toFixed(2)})`), `${T} before costs`);
    assert.ok(MD.includes(`${x.gold.all.n} / ${x.gold.all.meanR.toFixed(3)}`), `${T} gold`);
    assert.equal(x.holm, 1);
  }
  assert.ok(R.cut.every((c) => c.ok), 'the cut check held');
  assert.ok(MD.includes(`+0.319R a trade in 2024 on (n ${R.tests.T2.gold.conf.n}, month t ${R.tests.T2.gold.conf.tMonth})`));
});

test('key levels: A = bullish then bearish, V = bearish then bullish, the close of the first candle; freshness', () => {
  const b = (o, h, l, c) => ({ o, h, l, c });
  const B = [b(1, 2, 0.9, 1.8), b(1.8, 1.9, 1.2, 1.3), b(1.3, 1.4, 1.0, 1.1), b(1.1, 1.6, 1.05, 1.5), b(1.5, 1.6, 1.45, 1.55)];
  const L = levels(B);
  assert.deepEqual(L.map((x) => [x.k, x.type, x.price]), [[0, 'A', 1.8], [2, 'V', 1.1]]);
  // a wick touch makes the level unfresh (one use), a body through makes it fresh again
  const C = [b(1, 1.2, 0.9, 1.1), b(1.1, 1.15, 1.0, 1.05), b(1.3, 1.4, 1.05, 1.35), b(1.35, 1.36, 1.0, 1.02)];
  assert.deepEqual(freshAt(C, { k: 0, price: 1.1 }, 2), { fresh: false, uses: 1 });
  assert.deepEqual(freshAt(C, { k: 0, price: 1.1 }, 3), { fresh: true, uses: 1 });
});

test('pips: gold 30 pips = $3.00, elsewhere the same share of price as $3.00 at $4,000', () => {
  assert.equal(pips('xau', 30, 2000), 3);
  assert.ok(Math.abs(pips('eurusd', 30, 1.1) - 0.000825) < 1e-12);
  assert.ok(Math.abs(pips('nas100', 20, 20000) - 10) < 1e-9);
});

test('a limit with break-even: stop first, break-even from the next candle, target', () => {
  const m = (i, o, h, l, c) => ({ t: 1e6 + i * 300, o, h, l, c, e: 1e6 + (i + 1) * 300 });
  const tr = { side: 1, entry: 100, stop: 97, target: 112, be: 105, placeT: 1e6, expire: 1e6 + 1e5, hold: 1e5 };
  // fill, run to +5 (arms break-even), come back to the entry: out at 0R
  let r = sim(tr, [m(0, 101, 101, 99.5, 100.5), m(1, 100.5, 105.5, 100.2, 105), m(2, 105, 105, 99.8, 100)]);
  assert.equal(r.why, 'be'); assert.equal(r.R, 0);
  // the fill candle can only stop the trade; a candle holding stop and target is a stop
  r = sim(tr, [m(0, 101, 113, 96, 100)]); assert.equal(r.why, 'stop'); assert.equal(r.R, -1);
  r = sim(tr, [m(0, 101, 101, 99.5, 100.5), m(1, 100.5, 113, 100.2, 112.5)]); assert.equal(r.why, 'target'); assert.equal(r.R, 4);
});

// a seeded made-up market: 5-minute candles with slow swings
function market(days, seed = 11) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const out = []; let p = 2000; const t0 = Date.UTC(2021, 0, 4) / 1000;
  for (let i = 0; i < days * 288; i++) {
    const t = t0 + i * 300; const wd = new Date(t * 1000).getUTCDay(); if (wd === 6) continue;
    const o = p; p += (rnd() - 0.5) * 1.6 + Math.sin(i / 700) * 0.12;
    out.push({ t, o, h: Math.max(o, p) + rnd() * 0.5, l: Math.min(o, p) - rnd() * 0.5, c: p, e: t + 300 });
  }
  return out;
}

test('every order has its stop on the losing side and its target on the winning side, sized as the plan says', () => {
  const M5 = market(250, 3); const { orders } = allOrders(frames(M5), 'xau');
  assert.ok(orders.length > 20, 'the made-up market gives orders');
  for (const o of orders) {
    const S = PLAN[o.test].stop * 0.1;
    assert.ok(o.side * (o.entry - o.stop) > 0 && Math.abs(Math.abs(o.entry - o.stop) - S) < 1e-9, o.test + ' stop');
    assert.ok(o.side * (o.target - o.entry) > 0, o.test + ' target');
    assert.ok(o.expire >= o.placeT);
  }
  assert.deepEqual([...new Set(orders.map((o) => o.test))].sort(), ['T1', 'T2', 'T3', 'T4']);
});

test('no look-ahead: signals, candidates and DCs before a cut do not change when later candles are removed', () => {
  const M5 = market(160); const cut = M5[Math.floor(M5.length * 0.6)].t;
  const pick = (A) => ({ sig: [...A.S.t1, ...A.S.t2].filter((x) => x.sigT < cut).map((x) => JSON.stringify([x.test, x.side, x.L, x.ext, x.b, x.sigT, x.apex])),
    cand: A.cands.filter((x) => x.orderT < cut).map((x) => JSON.stringify([x.side, x.level, x.orderT])).sort(),
    dc: A.cands.filter((x) => x.dcT != null && x.dcT < cut).map((x) => JSON.stringify([x.level, x.dcT])).sort() });
  const full = pick(allOrders(frames(M5), 'xau')), part = pick(allOrders(frames(M5.filter((b) => b.t < cut)), 'xau'));
  assert.ok(full.sig.length > 5);
  assert.deepEqual(part, full);
});
