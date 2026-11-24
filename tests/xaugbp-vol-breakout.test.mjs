// xaugbp-vol-breakout: the imported rule is unchanged, the cost is gold-eur-vol-breakout's, the decision follows the
// pre-registered bar, the report says what result.json says, and a trade never reads candles after its own exit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as S from '../research/edge/xaugbp-vol-breakout/run.mjs';
import * as EUR from '../research/edge/gold-eur-vol-breakout/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/xaugbp-vol-breakout/result.json', import.meta.url)));
const MD = fs.readFileSync(new URL('../research/edge/xaugbp-vol-breakout/RESULT.md', import.meta.url), 'utf8');

test('imported rule file is the pinned one; cost equals gold-eur-vol-breakout', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(S.ORIG_PATH)).digest('hex');
  assert.equal(sha, S.ORIG_SHA);
  assert.equal(R.originalSha256, S.ORIG_SHA);
  assert.equal(S.COST_PCT, EUR.COST_PCT);
  const plan = crypto.createHash('sha256').update(fs.readFileSync(new URL('../research/edge/xaugbp-vol-breakout/PREREGISTRATION.md', import.meta.url))).digest('hex');
  assert.equal(R.planSha256, plan);
});

test('decision follows the bar and the report states it', () => {
  const d = S.decide(R.tests.DISC, R.tests.CONF, R.placebo.means);
  assert.deepEqual(d, R.decision);
  assert.equal(R.verdict, S.verdictLine(R.tests, d));
  assert.ok(MD.startsWith(`**Verdict: ${R.verdict}**`));
  assert.equal(MD, S.report(R));
  assert.ok(Number.isFinite(R.comparison.corrMonthlyNet));
});

test('no look-ahead: a trade is the same when every candle from 21:00 UTC of its day on is changed', () => {
  // a synthetic run of days; cut each day's candles after the trade's exit and scramble them
  let px = 2000; const rows = [];
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let d = 0; d < 30; d++) {
    const d0 = Date.UTC(2020, 0, 6 + d) / 1000;
    const wd = new Date(d0 * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    for (let i = 0; i < 288; i++) { const o = px; px += (rnd() - 0.5) * 2; rows.push([d0 + i * 300, o, Math.max(o, px) + 0.3, Math.min(o, px) - 0.3, px]); }
  }
  const { days } = S.daysOf(rows.map((r) => [...r]));
  const { tr } = S.tradesIn(days, ['2020-01-01', '2020-12-31']);
  assert.ok(tr.length > 5);
  for (const x of tr) {
    const end = Date.parse(x.day + 'T21:00:00Z') / 1000;
    const cut = rows.map((r) => (r[0] >= end ? [r[0], 1, 9e9, 0.001, 1] : [...r]));
    const again = S.tradesIn(S.daysOf(cut).days, [x.day, x.day]).tr[0];
    assert.equal(again.net, x.net);
  }
});
