// tests/grid5-mosha-cycle.test.mjs - research/edge/grid5-mosha-cycle: the cell index, the trade-through limit, the exits,
// no look-ahead on synthetic candles, and RESULT.md pinned to result.json. Offline (synthetic candles, committed files).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cellIndex, cellName, NCELL, simulate, manage, cutCheck } from '../research/edge/grid5-mosha-cycle/run.mjs';
import { loadFns } from '../council/mosha-desk.mjs';

const DIR = new URL('../research/edge/grid5-mosha-cycle/', import.meta.url);
function market(n, seed = 3, px = 100) {
  let x = seed >>> 0; const r = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const out = []; let c = px, t = Date.UTC(2012, 0, 2) / 1000;
  for (let i = 0; i < n; i++) { const o = c; c = o + (r() - 0.5) * 0.6 + Math.sin(i / 900) * 0.02; const h = Math.max(o, c) + r() * 0.2, l = Math.min(o, c) - r() * 0.2;
    out.push({ t, o, h, l, c, e: t + 300 }); t += 300; if (new Date(t * 1000).getUTCDay() === 6) t += 2 * 86400; }
  return out;
}

test('cell index round trip and size', () => {
  assert.equal(NCELL, 9720);
  const c = cellIndex([1, 1, 2, 1, 2, 1, 3, 4]); const n = cellName(c);
  assert.deepEqual(n, { chain: '4h>1h', cftf: 'lower', stage: 'continuation', barrier: 'yes', back: 'no', inVR: 'clear', entry: 'LIM-cfz', exit: 'trail' });
});

test('a limit fills only when price trades through it by half the cost', () => {
  const B = [{ t: 0, o: 101, h: 101.2, l: 100.0, c: 100.8, e: 300 }, { t: 300, o: 100.8, h: 100.9, l: 99.9, c: 100.3, e: 600 },
    { t: 600, o: 100.3, h: 104, l: 100.2, c: 103, e: 900 }];
  const o = { es: 3, type: 'lim', t0: 0, entry: 100, stop: 99, cancelT: 1e9, through: 0.1 };
  const r = simulate(B, o, 1, 103.5, 600); assert.ok(r); assert.equal(r.fillT, 300); assert.equal(r.fill, 100);
  assert.equal(simulate(B, { ...o, through: 0.2 }, 1, 103.5, 600), null);           // never 0.2 through
  assert.deepEqual([...r.R], [1, 2, 3, 3.5, 3]);                            // 104 reached the 1R, 2R and 3R targets
});

test('stop first, gaps at the open, a limit fill candle counts only the stop', () => {
  const B = [{ t: 0, o: 100, h: 102.5, l: 98.5, c: 100, e: 300 }, { t: 300, o: 97, h: 97.5, l: 96, c: 96.5, e: 600 }];
  const m = manage(B, 0, -1, 100, 1, 99, 110, 1e6); assert.deepEqual([...m.R], [-1, -1, -1, -1, -1]); // both in one candle: the stop
  const l = manage(B, 0, 0, 100, 1, 99, 110, 1e6); assert.deepEqual([...l.R], [-1, -1, -1, -1, -1]);
  const g = manage([{ t: 0, o: 100, h: 100.5, l: 99.5, c: 100, e: 300 }, { t: 300, o: 98, h: 98.2, l: 97, c: 97.5, e: 600 }], 0, -1, 100, 1, 99, 110, 1e6);
  assert.equal(g.R[0], -2);                                                       // gapped through the stop: out at the open
});

test('no look-ahead: storylines known by a cut equal the ones computed on candles cut there', () => {
  const M5 = market(60000, 7), r = [0.35, 0.5, 0.65, 0.8, 0.95].map((f) => Math.floor(M5[0].t + f * (M5[M5.length - 1].e - M5[0].t)));
  const out = cutCheck(M5, loadFns(), r);
  assert.ok(out.compared > 20, 'too few storylines on the synthetic market: ' + out.compared);
  assert.equal(out.mismatches, 0);
});

test('RESULT.md is pinned to result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(R.verdict, 'FAIL'); assert.ok(R.headline.length > 20);
  assert.match(md.split('\n')[2], /^\*\*Verdict: FAIL\. /);
  assert.equal(R.real.confirmed, 0); assert.equal(R.real.discovery, 27); assert.equal(R.placebo.discovery, 453); assert.equal(R.real.eligible, 4030);
  assert.ok(md.includes('| Storyline | 4,030 | 27 | 92.7 | 0 | 0 |')); assert.ok(md.includes('| 4,030 | 453 | 92.7 | 0 | 45 |'));
  assert.equal(R.placebo.confirmedRaw, 45);
  const b = R.best; assert.equal(b.chain, '4h>1h'); assert.equal(b.confirmation.n, 131); assert.equal(b.confirmation.meanR, 0.1971); assert.equal(b.confirmation.tMonth, 1.93);
  assert.ok(md.split('\n')[2].includes('+0.197R a trade before costs in 2015-19 (n 131, month t 1.93, Holm p 1)'));
  const trades = R.perMarket.reduce((a, m) => a + m.trades, 0), stories = R.perMarket.reduce((a, m) => a + m.storylines, 0);
  assert.equal(trades, 25633); assert.equal(stories, 8505); assert.ok(md.includes('25,633 trades'));
  assert.equal(R.cutTest.mismatches, 0); assert.equal(R.cutTest.markets.reduce((a, m) => a + m.compared, 0), 26026);
  const bl = R.baseline.find((x) => x.chain === '1h>15m' && x.cftf === 'lower' && x.entry === 'MKT-cfz' && x.exit === '2R');
  assert.equal(bl.real_disc.n, 1681); assert.equal(bl.real_conf.meanR, -0.0896); assert.equal(bl.real_conf.tMonth, -2.52);
  assert.ok(md.includes('-0.090R (n 1,525, t -2.52)'));
  assert.ok(!/\bedge\b(?! on 2010)/i.test(md.split('\n')[2]));
});
