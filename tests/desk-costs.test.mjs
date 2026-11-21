// The four paper desks (Mosha, LIT, Engulfing, MSNR) show their records before costs; the same figures after costs are drawn
// beside them (display only). One cost table and one costR() in assets/mosha-sop.js, used by both cards.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), M = require('../assets/mosha-sop.js');
const sop = fs.readFileSync(new URL('../assets/mosha-sop.js', import.meta.url), 'utf8');
const desks = fs.readFileSync(new URL('../assets/desk-trades.js', import.meta.url), 'utf8');

test('the cost table equals the pre-registered desk studies (desk-slices, desk-rigor) for every market they name', async () => {
  const slices = await import('../research/edge/desk-slices/run.mjs'), rigor = await import('../research/edge/desk-rigor/run.mjs');
  for (const [k, px] of [['xau', 4000], ['xag', 50], ['eurusd', 1.15], ['gbpusd', 1.31], ['usdjpy', 155], ['audusd', 0.65], ['usdcad', 1.4], ['nas100', 25000], ['spx500', 6700], ['us30', 46000], ['de40', 23000]])
    assert.ok(Math.abs(M.costPx(k, px) - slices.cost(k, px)) < 1e-12, k);
  for (const k of rigor.MARKETS) assert.ok(Math.abs(M.costPx(k, 3000) - rigor.cost(k, 3000)) < 1e-12, k);
  // every market a desk may record has a cost on record; the two assumed ones say so
  for (const k of Object.keys(M.ALL)) assert.ok(M.COSTS[k], k);
  assert.deepEqual(Object.keys(M.COSTS).filter((k) => M.COSTS[k].assumed).sort(), ['de40', 'us30']);
  for (const k of Object.keys(M.COSTS)) assert.ok(M.COSTS[k].src, k);
});

test('costR = round trip / the risk the trade opened with; no cost on record = null, never guessed', () => {
  // gold at 4000 with $2 risk: 0.2 / 2 = 0.1R
  assert.ok(Math.abs(M.costR({ market: 'xau', entry: 4000, stop: 3998, r0: 2 }) - 0.1) < 1e-12);
  // no market field = gold (the Mosha tracker's first records)
  assert.ok(Math.abs(M.costR({ entry: 4000, stop: 3998, r0: 2 }) - 0.1) < 1e-12);
  // r0 is the opening risk: a moved stop does not change the cost
  assert.ok(Math.abs(M.costR({ market: 'xau', entry: 4000, stop: 4000, r0: 2 }) - 0.1) < 1e-12);
  // without r0, |entry - stop|
  assert.ok(Math.abs(M.costR({ market: 'eurusd', entry: 1.1, stop: 1.099 }) - (0.000045 * 1.1 + 0.00005) / 0.001) < 1e-12);
  assert.equal(M.costR({ market: 'btcusd', entry: 90000, stop: 89000, r0: 1000 }), null);
  assert.equal(M.costR({ market: 'xau', entry: 4000, stop: 4000 }), null);
});

test('summaryNet: closed rows only, rows with no cost on record counted apart', () => {
  const rows = [{ market: 'xau', entry: 4000, stop: 3998, r0: 2, R: 1 }, { market: 'xau', entry: 4000, stop: 4002, r0: 2, R: -1 },
    { market: 'zzz', entry: 1, stop: 0.9, r0: 0.1, R: 2 }, { market: 'xau', entry: 4000, stop: 3998, r0: 2, R: null }];
  const n = M.summaryNet(rows);
  assert.equal(n.closed, 3); assert.equal(n.costed, 2); assert.equal(n.noCost, 1);
  assert.ok(Math.abs(n.total - (0.9 - 1.1)) < 1e-12); assert.ok(Math.abs(n.costMean - 0.1) < 1e-12); assert.equal(n.wins, 1);
  const t = M.netTile(rows); assert.equal(t.v, '−0.20R'); assert.match(t.sub, /1 closed with no cost on record left out/);
  assert.equal(M.netTile([{ market: 'zzz', entry: 1, stop: 0.9, r0: 0.1, R: 1 }]).v, '—');
  assert.match(M.netClause(rows), /after costs/);
});

test('both cards draw the after-costs tile and the per-type lines; the calendar says before costs; no edge wording', () => {
  for (const s of [sop, desks]) assert.match(s, /tile\('Total, after costs'/);
  assert.match(desks, /SOP\.netTile\(list\)/); assert.match(desks, /typeLine\(/); assert.match(desks, /SOP\.COST_NOTE/);
  assert.match(sop, /API\.netClause\(rows\)/); assert.match(sop, /API\.COST_NOTE/);
  assert.match(sop, /open trades not added in · before costs/);
  assert.doesNotMatch(M.COST_NOTE, /\bedge\b/i);
  // only one cost table: desk-trades.js reads it from MS_MOSHA_SOP
  assert.doesNotMatch(desks, /0\.000045|0\.00005/);
});
