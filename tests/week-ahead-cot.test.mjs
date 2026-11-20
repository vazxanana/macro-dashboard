// Week ahead: speculative positioning (macro/cot.json) in the frame (20 Nov 2026). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as WA from '../council/week-ahead.mjs';

const mk = (k, o = {}) => ({ k, name: k, who: k === 'gold' || k === 'silver' ? 'managed money' : 'leveraged funds', asOf: '2026-11-17',
  net: 100000, chg1: 2000, pct: 50, z: 0.3, edgeStatus: 'none', edgeText: 'edge: none (pre-registered test: nothing passed in and out of sample)', ...o });

test('crowded long and crowded short give one line each, with the report date, net and percentile', () => {
  const P = WA.positioningOf({ markets: [mk('gold', { pct: 94, net: 182345 }), mk('es', { pct: 7, net: -250000 })] });
  assert.equal(P.length, 2);
  const g = P.find((p) => p.market === 'gold'), e = P.find((p) => p.market === 'es');
  assert.match(g.text, /^Gold: Managed money crowded long \(94th percentile of 3 years\); net 182,345 contracts, as of the 2026-11-17 report\./);
  assert.match(e.text, /S&P 500: Leveraged funds crowded short \(7th percentile/);
  assert.match(e.text, /net −250,000 contracts/);
});

test('middling positioning and an ordinary week say nothing; a big week says so', () => {
  assert.deepEqual(WA.positioningOf({ markets: [mk('gold'), mk('eur', { pct: 60, z: -1.2 })] }), []);
  const P = WA.positioningOf({ markets: [mk('eur', { pct: 60, z: -2.1, chg1: -31000 })] });
  assert.equal(P.length, 1);
  assert.match(P[0].text, /big selling this week \(−31,000 contracts, −2\.1 standard deviations\)/);
});

test('the yen: futures are yen against the dollar, said plainly, crowded long yen = crowded short USD/JPY', () => {
  const [p] = WA.positioningOf({ markets: [mk('jpy', { pct: 95 })] });
  assert.match(p.text, /crowded long yen futures/);
  assert.match(p.text, /a long there is a bet that USD\/JPY falls, so crowded long yen means crowded short USD\/JPY/);
});

test('wording: no tested edge = "positioning, not a tested signal"; a passing cell is named, never proven', () => {
  const [a] = WA.positioningOf({ markets: [mk('nq', { pct: 92 })] });
  assert.match(a.text, /Positioning, not a tested signal: the pre-registered COT test found no edge\./);
  const [b] = WA.positioningOf({ markets: [mk('silver', { pct: 3, edgeStatus: 'tested', edgeText: 'edge: tested (extreme 20d)' })] });
  assert.match(b.text, /passed one cell here \(extreme 20d\): a single cell, not a proven edge\./);
  assert.doesNotMatch(b.text, /not a tested signal/);
});

test('missing file, missing market or markets outside the list give nothing', () => {
  assert.deepEqual(WA.positioningOf(null), []);
  assert.deepEqual(WA.positioningOf({}), []);
  assert.deepEqual(WA.positioningOf({ markets: [{ k: 'gold', missing: true }, mk('chf', { pct: 99 })] }), []);
});

test('build puts the lines in frame.positioning and frame.lines; no cot = none', () => {
  const now = Date.parse('2026-11-20T10:00:00Z') / 1000;
  const A = WA.build({ now, cal: [], rf: null, fc: null, v: null, cot: { markets: [mk('gold', { pct: 91 })] } });
  assert.equal(A.frame.positioning.length, 1);
  assert.equal(A.frame.positioning[0].market, 'gold');
  assert.ok(A.frame.lines.includes(A.frame.positioning[0].text));
  const B = WA.build({ now, cal: [], rf: null, fc: null, v: null });
  assert.deepEqual(B.frame.positioning, []);
});

test('veteran.mjs hands macro/cot.json to the Week ahead', () => {
  const src = fs.readFileSync(new URL('../council/veteran.mjs', import.meta.url), 'utf8');
  assert.match(src, /cot = rd\(path\.join\(M, 'cot\.json'\), null\)/);
  assert.match(src, /weekAhead\(\{[^\n]*\bcot, dataDir: dir \}\)/);
});
