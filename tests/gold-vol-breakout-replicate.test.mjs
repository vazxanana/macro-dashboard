// node --test tests/gold-vol-breakout-replicate.test.mjs — research/edge/gold-vol-breakout-replicate (14 Nov 2026): the
// original study's T1 imported unchanged from a verbatim copy, run on hand-made days inside and outside the 2007-15 window,
// the 250-day median with no look-ahead, the decision and the gate, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/gold-vol-breakout-replicate/run.mjs';
import * as O from '../research/edge/gold-vol-breakout-replicate/original.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'gold-vol-breakout-replicate');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const R = JSON.parse(read('result.json'));

// M5 rows [t,o,h,l,c] for weekday d0: flat at p (±0.2), one wide candle at 22:00 (D1 range 2 → T1 levels p ± 1), and a
// break up to p+1.5 at 09:00 when up
function dayRows(d0, p, up) {
  const rows = [];
  for (let m = 0; m < 24 * 60; m += 5) {
    let c = [p, p + 0.2, p - 0.2, p];
    if (up && m >= 9 * 60) c = m === 9 * 60 ? [p, p + 1.5, p + 0.05, p + 1.4] : [p + 1.4, p + 1.6, p + 1.2, p + 1.5];
    if (m === 22 * 60) c = [p, p + 1, p - 1, p];
    rows.push([d0 + m * 60, ...c]);
  }
  return rows;
}
const at = (s) => Date.parse(s + 'T00:00:00Z') / 1000;

test('original.mjs is the verbatim copy and the rule is its T1', () => {
  assert.equal(sha(read('original.mjs')), S.ORIG_SHA);
  assert.deepEqual(S.T1, { name: 'k 0.5, both sides', k: 0.5, sides: 'both' });
  assert.equal(O.COST, 0.6);
  assert.deepEqual(S.WIN, ['2007-01-01', '2015-12-31']);
});

test('T1 trades only inside the window, on the previous folded day\'s range', () => {
  // Tue 2015-12-29 .. Tue 2016-01-05: breaks up on the 31st and the 4th
  const ds = ['2015-12-29', '2015-12-30', '2015-12-31', '2016-01-01', '2016-01-04', '2016-01-05'];
  const rows = ds.flatMap((d, i) => dayRows(at(d), 100, d === '2015-12-31' || d === '2016-01-04'));
  rows.push([at('2016-01-06'), 100, 100, 100, 100]);              // the forming last day is dropped
  const { days } = S.daysOf(rows);
  assert.equal(days.at(-1).day, '2016-01-05');
  const { tr } = S.tradesIn(days, S.WIN);
  assert.ok(tr.length >= 1 && tr.every((x) => x.day <= '2015-12-31'), 'nothing after the window');
  const x = tr.find((t) => t.day === '2015-12-31');
  assert.equal(tr.length, 1, 'flat days do not reach the levels');
  assert.equal(x.side, 1); assert.equal(x.entry, 101); assert.equal(x.stop, 100); assert.equal(x.how, 'time');
  assert.ok(Math.abs(x.R - 0.5) < 1e-9); assert.ok(Math.abs(x.net - (0.5 - 0.6)) < 1e-9);
});

test('the 250-day median uses only ranges known before the open', () => {
  const days = Array.from({ length: 300 }, (_, i) => ({ day: `d${i}`, prevRange: 1 + (i % 7) }));
  const a = S.withMedian(days), b = S.withMedian(days.map((d, i) => (i > 200 ? { ...d, prevRange: 999 } : d)));
  for (let i = 0; i <= 200; i++) assert.equal(a[i].med250, b[i].med250, `day ${i} changed by later days`);
  assert.equal(a[5].med250, null, 'fewer than 20 ranges: no median');
  const sp = S.rangeSplit([{ day: '2007-01-02', prevRange: 3, med250: 2, net: 1, R: 1 }, { day: '2007-02-02', prevRange: 2, med250: 2, net: -1, R: -1 }]);
  assert.equal(sp.high.n, 1); assert.equal(sp.low.n, 1); assert.equal(sp.low.netR, -1);
});

test('decision and gate rules', () => {
  const m = { n: 100, netR: 0.1, t: 2.1, net2R: 0.01 }, h = { netR: 0.05 };
  const pl = Array.from({ length: 40 }, (_, i) => (i < 38 ? -0.01 : 0.2));
  assert.equal(S.decide(m, h, h, pl).pass, true);
  assert.equal(S.decide(m, h, h, Array(3).fill(0.2).concat(Array(37).fill(0))).pass, false, '37 of 40 beaten');
  assert.equal(S.decide({ ...m, t: 1.99 }, h, h, pl).pass, false);
  assert.equal(S.decide(m, h, { netR: -0.01 }, pl).pass, false, 'a losing half');
  assert.equal(S.decide({ ...m, net2R: -0.001 }, h, h, pl).pass, false);
  const g = S.gateCheck({ IS: { ...S.ORIG_T1.IS }, OOS: { ...S.ORIG_T1.OOS, t: 1.9 } }, true);
  assert.equal(g.IS.ok, true); assert.equal(g.OOS.ok, false); assert.equal(g.ok, false);
  assert.equal(S.gateCheck({ IS: { ...S.ORIG_T1.IS }, OOS: { ...S.ORIG_T1.OOS, t: 1.9 } }, false).ok, true, 'within tolerance');
  assert.equal(S.gateCheck({ IS: { ...S.ORIG_T1.IS, netR: 0.03 }, OOS: { ...S.ORIG_T1.OOS } }, false).ok, false);
});

test('result.json and RESULT.md agree with the code', () => {
  assert.equal(R.planSha256, sha(read('PREREGISTRATION.md')));
  assert.equal(R.original.runSha256, S.ORIG_SHA);
  assert.equal(R.gate.exact.ok, true); assert.equal(R.gate.tol.ok, true);
  assert.deepEqual(R.decision, S.decide(R.main, R.halves.H1, R.halves.H2, R.placebo.means));
  assert.equal(R.verdict, S.verdictLine(R.main, R.decision));
  assert.equal(read('RESULT.md'), S.report(R));
  assert.ok(read('RESULT.md').includes(`**Verdict: ${R.verdict}**`));
  const v = studyVerdict(R, read('RESULT.md'));
  assert.equal(v.verdict, R.decision.pass ? 'pass' : 'fail');
  assert.ok(R.verdict.length < 220);
  assert.equal(R.placebo.means.length, 40);
  assert.equal(R.main.n, R.halves.H1.n + R.halves.H2.n);
  assert.ok(/not a gate, exit, entry or size of the live gold book/.test(read('RESULT.md')));
});
