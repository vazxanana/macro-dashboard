// tests/grid6-mosha-market.test.mjs - research/edge/grid6-mosha-market: the cell index, the session tag, the trade-through
// limit, the market fill at the next 5m open, no look-ahead on synthetic candles, and RESULT.md pinned to result.json.
// Offline (synthetic candles, committed files).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cellIndex, cellName, NCELL, simulate, sessionOf, cutCheck, entries, frames, storylines, msnrCalls, LADDERS, BRK } from '../research/edge/grid6-mosha-market/run.mjs';
import { atr14 } from '../research/edge/grid5-mosha-cycle/run.mjs';

const DIR = new URL('../research/edge/grid6-mosha-market/', import.meta.url);
function market(n, seed = 3, px = 100) {
  let x = seed >>> 0; const r = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const out = []; let c = px, t = Date.UTC(2012, 0, 2) / 1000;
  for (let i = 0; i < n; i++) { const o = c; c = o + (r() - 0.5) * 0.6 + Math.sin(i / 900) * 0.02; const h = Math.max(o, c) + r() * 0.2, l = Math.min(o, c) - r() * 0.2;
    out.push({ t, o, h, l, c, e: t + 300 }); t += 300; if (new Date(t * 1000).getUTCDay() === 6) t += 2 * 86400; }
  return out;
}

test('cell index round trip, size and session tag', () => {
  assert.equal(NCELL, 11520);
  const c = cellIndex([3, 1, 2, 2, 1, 4, 3, 2]);
  assert.deepEqual(cellName(c), { ladder: '30m>5m', brk: 'qm', place: 'inside', entry: 'LIM', stop: 'cfz', exit: 'trail', session: 'other', msnr: 'against' });
  const at = (h) => Date.UTC(2015, 3, 1, h, 30) / 1000;
  assert.deepEqual([6, 7, 11, 12, 16, 17].map((h) => sessionOf(at(h))), [3, 1, 1, 2, 2, 3]);
});

test('a limit fills only when price trades through it by half the cost', () => {
  const B = [{ t: 0, o: 101, h: 101.2, l: 100.0, c: 100.8, e: 300 }, { t: 300, o: 100.8, h: 100.9, l: 99.9, c: 100.3, e: 600 },
    { t: 600, o: 100.3, h: 104, l: 100.2, c: 103, e: 900 }];
  const o = { type: 'lim', t0: 0, entry: 100, stop: 99, cancelT: 1e9, through: 0.1 };
  const r = simulate(B, o, 1, 103.5, 600); assert.ok(r); assert.equal(r.fillT, 300); assert.equal(r.fill, 100);
  assert.equal(simulate(B, { ...o, through: 0.2 }, 1, 103.5, 600), null);
});

test('every entry is at a later 5m open (market) or a trade-through limit, with the stop on the losing side', () => {
  const M5 = market(40000, 11), F = frames(M5), calls = msnrCalls(F); let n = 0;
  for (const [h, v] of LADDERS.slice(2)) for (const b of BRK) { const A = atr14(F[v]);
    for (const s of storylines(F, h, v, b, calls)) for (const o of entries(s, F, A, M5, 0.02)) { if (o.gate) continue; n++;
      if (o.type === 'mkt') { assert.ok(M5[o.j].t >= s.T); assert.equal(o.fill, M5[o.j].o); assert.ok(s.d * (o.fill - o.stop) > 0); }
      else { assert.equal(o.t0, s.T); assert.ok(s.d * (o.entry - o.stop) > 0); assert.equal(o.through, 0.01); } } }
  assert.ok(n > 50, 'too few entries on the synthetic market: ' + n);
});

test('no look-ahead: storylines known by a cut equal the ones computed on candles cut there', () => {
  const M5 = market(60000, 7), r = [0.35, 0.5, 0.65, 0.8, 0.95].map((f) => Math.floor(M5[0].t + f * (M5[M5.length - 1].e - M5[0].t)));
  const out = cutCheck(M5, r);
  assert.ok(out.compared > 20, 'too few storylines on the synthetic market: ' + out.compared);
  assert.equal(out.mismatches, 0);
});

test('RESULT.md is pinned to result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(R.verdict, 'PASS'); assert.ok(R.headline.length > 20);
  assert.match(md.split('\n')[2], /^\*\*Verdict: PASS\. /);
  assert.equal(R.real.eligible, 16045); assert.equal(R.real.discovery, 354); assert.equal(R.real.expectedByChance, 369);
  assert.equal(R.real.confirmed, 1); assert.equal(R.real.confirmedRaw, 23);
  assert.equal(R.placebo.discovery, 1155); assert.equal(R.placebo.confirmed, 0); assert.equal(R.placebo.confirmedRaw, 159);
  assert.ok(md.includes('| Storyline | 16,045 | 354 | 369.0 | 1 | 23 |')); assert.ok(md.includes('| 16,045 | 1,155 | 369.0 | 0 | 159 |'));
  assert.equal(R.confirmed.length, 1); const p = R.confirmed[0];
  assert.deepEqual([p.scope, p.ladder, p.brk, p.place, p.entry, p.stop, p.exit, p.session, p.msnr], ['xau', '30m>5m', 'any', 'any', 'MKT', 'cfz', '1R', 'london', 'with']);
  assert.equal(p.confirmation.n, 290); assert.equal(p.confirmation.meanR, 0.2249); assert.equal(p.confirmation.tMonth, 4.25);
  assert.equal(p.confirmation.netR, 0.0639); assert.equal(p.confirmation.tNet, 1.27); assert.equal(p.confirmation.holm, 0.0273);
  assert.ok(md.split('\n')[2].includes('+0.225R a trade before costs in 2015-19 (n 290, month t 4.25, Holm p 0.027), +0.064R after costs (t 1.27)'));
  assert.ok(md.includes('| +0.114R (n 302, t 2.16), +0.005R after costs |'));
  const trades = R.perMarket.reduce((a, m) => a + m.trades, 0), stories = R.perMarket.reduce((a, m) => a + m.storylines, 0);
  assert.equal(trades, 188060); assert.equal(stories, 47686); assert.ok(md.includes('47,686 storylines and 188,060 trades'));
  assert.equal(R.cutTest.mismatches, 0); assert.equal(R.cutTest.markets.reduce((a, m) => a + m.compared, 0), 132309); assert.ok(md.includes('132,309'));
  const y = R.passingCellByYear; assert.equal(y.length, 10); assert.ok(y.every((r) => r.grossR > 0)); assert.equal(y.filter((r) => r.netR < 0).length, 4);
  for (const r of y) { const m = md.match(new RegExp(`${r.year} ([+-][0-9]+\\.[0-9]) /\\s+([+-][0-9]+\\.[0-9])`)); assert.ok(m, 'year ' + r.year);
    assert.ok(Math.abs(+m[1] - r.grossR) <= 0.051 && Math.abs(+m[2] - r.netR) <= 0.051, 'year ' + r.year); }
  const bl = R.baseline.find((x) => x.ladder === '30m>5m' && x.brk === 'any' && x.entry === 'MKT' && x.stop === 'cfz' && x.exit === '2R');
  assert.equal(bl.real_conf.n, 12821); assert.ok(md.includes('+0.002R (n 12,821, t 0.12)'));
});
