// asia-index-vol-breakout: the committed result, the cost rule and the imported T1 rule on hand-made candles (offline, fast)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { costOf, COST_PCT, MARKETS, decide } from '../research/edge/asia-index-vol-breakout/run.mjs';
import { vbTrade } from '../research/edge/index-vol-breakout/original.mjs';
import { ORIGINAL_SHA } from '../research/edge/index-vol-breakout/run.mjs';

const dir = new URL('../research/edge/asia-index-vol-breakout/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir)));

test('the rule file is the unchanged T1 copy', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(new URL('../research/edge/index-vol-breakout/original.mjs', import.meta.url))).digest('hex');
  assert.equal(sha, ORIGINAL_SHA);
  assert.equal(R.original.sha256, ORIGINAL_SHA);
});
test('pre-registration hash and markets (HK33 dropped before any trade)', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(new URL('PREREGISTRATION.md', dir))).digest('hex');
  assert.equal(R.planSha256, sha);
  assert.deepEqual(Object.keys(MARKETS), ['jp225', 'au200']);
  assert.equal(COST_PCT, 0.0004);
  assert.equal(costOf({ entry: 40000 }), 16);
});
test('result figures and verdict', () => {
  assert.match(R.verdict, /^FAIL, 0 of 3/);
  const c = R.stats.pooled.C, j = R.stats.jp225, a = R.stats.au200;
  assert.equal(c.n, j.C.n + a.C.n);
  assert.ok(j.D.netR > 0 && j.C.netR < 0 && a.C.netR < 0 && c.t < 2);
  for (const k of ['jp225', 'au200', 'pooled']) assert.equal(R.decision[k].pass, false);
  const again = decide(R.stats, Object.fromEntries(Object.entries(R.placebo).map(([k, v]) => [k, v.means])));
  assert.deepEqual(again, R.decision);
});
test('no look-ahead: a later candle cannot change a trade stopped in its fill candle', () => {
  const mk = (o, h, l, c, i) => ({ t: 1e9 + i * 300, o, h, l, c });
  const bars = [mk(100, 100.5, 99.8, 100.2, 0), mk(100.2, 101.2, 99.9, 101, 1), mk(101, 101.5, 100.6, 101.3, 2)];
  const x = vbTrade(bars, { k: 0.5, prevRange: 2, cost: 0 });
  assert.equal(x.side, 1); assert.equal(x.entry, 101); assert.equal(x.how, 'stop');
  const y = vbTrade([...bars.slice(0, 2), mk(101, 140, 100.6, 139, 2)], { k: 0.5, prevRange: 2, cost: 0 });
  assert.deepEqual(y, x);
});
