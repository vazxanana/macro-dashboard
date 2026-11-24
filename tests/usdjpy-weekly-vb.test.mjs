// usdjpy-weekly-vb: result figures, the imported weekly rule on hand-made candles (no look-ahead), cost and financing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { chargeW, finPx, decide, pearson, K } from '../research/edge/usdjpy-weekly-vb/run.mjs';
import { wvbTrade } from '../research/edge/gold-weekly-vol-breakout/run.mjs';

const DIR = new URL('../research/edge/usdjpy-weekly-vb/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR)));

test('result.json: verdict, figures and the pre-registration hash', () => {
  assert.equal(R.decision.pass, false);
  assert.match(R.verdict, /^FAIL/);
  assert.equal(R.windows.C.n, 486); assert.equal(R.windows.D.n, 390);
  assert.ok(R.windows.C.t < 2 && R.windows.C.netR > 0 && R.windows.D.netR > 0);
  assert.equal(R.decision.placeboBeaten, 31);
  assert.equal(R.placebo.means.length, 40);
  assert.equal(R.prereg, crypto.createHash('sha256').update(fs.readFileSync(new URL('PREREGISTRATION.md', DIR))).digest('hex'));
  assert.deepEqual(decide(R.windows, R.placebo.means), R.decision);
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(md.includes(`**Verdict: ${R.verdict}**`));
  for (const k of ['D', 'C']) assert.ok(R.correlation[k].weekCorr > -1 && R.correlation[k].weekCorr < 1);
});

test('the weekly rule decides with candles up to the fill only (cut test)', () => {
  const t0 = 1700438400, bars = [];               // a Monday
  let p = 150;
  for (let i = 0; i < 700; i++) { const o = p; p += Math.sin(i / 7) * 0.05 + (i > 300 ? 0.02 : 0); bars.push({ t: t0 + i * 300, o, h: Math.max(o, p) + 0.01, l: Math.min(o, p) - 0.01, c: p }); }
  const full = wvbTrade(bars, { k: K, prevRange: 2, cost: 0 });
  assert.equal(full.side, 1);
  const i = bars.findIndex((b) => b.t === full.fillT);
  const cut = wvbTrade(bars.slice(0, i + 1), { k: K, prevRange: 2, cost: 0 });
  assert.equal(cut.fillT, full.fillT); assert.equal(cut.entry, full.entry); assert.equal(cut.side, full.side);
  const late = bars.map((b, j) => (j > i ? { ...b, o: 10, h: 10, l: 10, c: 10 } : b));
  assert.equal(wvbTrade(late, { k: K, prevRange: 2, cost: 0 }).entry, full.entry);
});

test('cost and assumed financing', () => {
  const mon = 1700438400;                         // Monday 00:00 UTC, out Friday 21:00: Mon, Tue, Wed (3), Thu = 6 rollovers
  const x = chargeW({ R: 1, entry: 150, r: 1, side: 1, fillT: mon + 3600, exitT: mon + 4 * 86400 + 21 * 3600 });
  assert.equal(x.nightsN, 6);
  assert.ok(Math.abs(finPx(150, mon + 3600, mon + 4 * 86400 + 21 * 3600) - 6 * 0.01 / 365 * 150) < 1e-12);
  assert.ok(Math.abs(x.costR - (0.000045 * 150 + 0.005)) < 1e-12);
  assert.ok(Math.abs(x.net - (1 - x.costR - x.finR)) < 1e-12);
  assert.ok(Math.abs(pearson([1, 2, 3], [2, 4, 6]) - 1) < 1e-12);
});
