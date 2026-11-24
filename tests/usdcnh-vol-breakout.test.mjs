// usdcnh-vol-breakout: the committed result and the rule's pieces (offline, no candles needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { charge, costPx, decide, discStart, corr, COMM, SLIP, W } from '../research/edge/usdcnh-vol-breakout/run.mjs';
import { vbTrade } from '../research/edge/index-vol-breakout/original.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/usdcnh-vol-breakout/result.json', import.meta.url)));
const md = fs.readFileSync(new URL('../research/edge/usdcnh-vol-breakout/RESULT.md', import.meta.url), 'utf8');

test('usdcnh-vol-breakout: pinned original and pre-registered cost', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(new URL('../research/edge/index-vol-breakout/original.mjs', import.meta.url))).digest('hex');
  assert.equal(sha, R.origSha);
  assert.equal(COMM, 0.000045); assert.equal(SLIP, 0.0003); assert.equal(R.cost.assumed, true);
  assert.ok(Math.abs(costPx(7) - (0.000315 + 0.0003)) < 1e-12);
  const c = charge({ entry: 7, r: 0.01, R: 1 }); assert.ok(Math.abs(c.net - (1 - 0.0615)) < 1e-9);
});

test('usdcnh-vol-breakout: verdict and figures', () => {
  const D = R.decision;
  assert.match(R.verdict, /^FAIL/); assert.equal(D.pass, false);
  assert.deepEqual(Object.entries(D.checks).filter(([, v]) => !v).map(([k]) => k), ['cost2x']);
  assert.equal(D.conf.n, 1699); assert.equal(D.conf.netR, 0.066); assert.equal(D.conf.t, 2.09);
  assert.equal(D.disc.n, 680); assert.equal(D.disc.netR, 0.023);
  assert.ok(D.conf.net2R <= 0); assert.equal(D.beaten, 40);
  assert.equal(R.placebo.length, 40);
  assert.ok(Math.abs(R.corr.conf.r) < 0.3);
  assert.ok(md.startsWith('# USD/CNH')); assert.ok(md.includes(R.verdict));
  assert.ok(!/\bis an edge\b/i.test(md));
});

test('usdcnh-vol-breakout: rule unit — stop at the open, fill only after the trigger, later candles do not change it', () => {
  const t0 = 1700000000 - (1700000000 % 86400), bars = [];
  for (let i = 0; i < 252; i++) bars.push({ t: t0 + i * 300, o: 7, h: 7.001, l: 6.999, c: 7 });
  bars[10] = { t: t0 + 3000, o: 7, h: 7.006, l: 7, c: 7.005 };          // crosses open + 0.5 x 0.01
  const x = vbTrade(bars, { k: 0.5, sides: 'both', prevRange: 0.01, cost: 0 });
  assert.equal(x.side, 1); assert.equal(x.stop, 7); assert.equal(x.fillT, t0 + 3000);
  const cut = vbTrade(bars.slice(0, 11), { k: 0.5, sides: 'both', prevRange: 0.01, cost: 0 });
  assert.equal(cut.entry, x.entry); assert.equal(cut.fillT, x.fillT);
});

test('usdcnh-vol-breakout: windows, decision and correlation helpers', () => {
  assert.equal(discStart([{ day: '2011-02-07' }]), '2011-03-01');
  assert.equal(W.CONF[0], '2018-01-01');
  const tr = [{ day: '2015-01-02', net: 1, R: 1, net2: 1, r: 1, side: 1, how: 'time' }, { day: '2019-01-02', net: 1, R: 1, net2: 1, r: 1, side: 1, how: 'time' }];
  const d = decide(tr, Array(40).fill(0), ['2011-03-01', '2017-12-31']);
  assert.equal(d.tooFew, true); assert.equal(d.pass, false);
  assert.equal(corr({ a: 1, b: 2, c: 3 }, { a: 2, b: 4, c: 6 }).r, 1);
});
