// copper-vol-breakout: the committed result against its pre-registration, the pinned rule, and a no-look-ahead cut test (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { vbTrade } from '../research/edge/index-vol-breakout/original.mjs';
import { ORIG_SHA } from '../research/edge/fx-vol-breakout/run.mjs';
import { COST, charge, W } from '../research/edge/copper-vol-breakout/run.mjs';

const dir = new URL('../research/edge/copper-vol-breakout/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const sha = (u) => crypto.createHash('sha256').update(fs.readFileSync(u)).digest('hex');

test('pinned rule and pre-registration', () => {
  assert.equal(sha(new URL('../research/edge/index-vol-breakout/original.mjs', import.meta.url)), ORIG_SHA);
  assert.equal(R.origSha, ORIG_SHA);
  assert.equal(R.prereg, sha(new URL('PREREGISTRATION.md', dir)));
  assert.equal(COST, 0.0006); assert.equal(R.cost.assumed, true);
  assert.deepEqual(W.C, ['2016-01-01', '2099-12-31']);
});

test('verdict follows the checks', () => {
  const J = R.judged, c = J.checks;
  assert.equal(c.bothWindows, J.d.netR > 0 && J.c.netR > 0);
  assert.equal(c.t2, J.c.t >= 2);
  assert.equal(c.cost2x, J.c.net2R > 0);
  assert.equal(c.placebo, J.beaten >= 38);
  assert.equal(c.n200, J.c.n >= 200);
  assert.equal(R.pass, Object.values(c).every(Boolean));
  assert.ok(R.verdict.startsWith(R.pass ? 'PASS' : 'FAIL'));
  assert.equal(R.placebo.length, 40);
  const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  assert.ok(md.includes(R.verdict));
});

test('the cost charge and no look-ahead: a day cut after the fill keeps the fill', () => {
  const bars = []; let p = 100;
  for (let i = 0; i < 252; i++) { const o = p; p += Math.sin(i / 7) * 0.08 + (i > 40 && i < 60 ? 0.05 : 0); bars.push({ t: i * 300, o, h: Math.max(o, p) + 0.02, l: Math.min(o, p) - 0.02, c: p }); }
  const full = vbTrade(bars, { k: 0.5, sides: 'both', prevRange: 1, cost: 0 });
  assert.ok(!full.skip);
  const i = bars.findIndex((b) => b.t === full.fillT);
  const cut = vbTrade(bars.slice(0, i + 1), { k: 0.5, sides: 'both', prevRange: 1, cost: 0 });
  assert.equal(cut.side, full.side); assert.equal(cut.entry, full.entry); assert.equal(cut.fillT, full.fillT);
  const x = charge(full);
  assert.ok(Math.abs(x.R - x.net - COST * full.entry / full.r) < 1e-12);
  assert.ok(x.net2 < x.net);
});
