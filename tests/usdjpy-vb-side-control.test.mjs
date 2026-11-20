// usdjpy-vb-side-control (v1, INVALID: look-ahead) and -v2 (the corrected control). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decide } from '../research/edge/usdjpy-vb-side-control-v2/run.mjs';

const rd = (p) => fs.readFileSync(new URL(`../research/edge/${p}`, import.meta.url), 'utf8');

test('v1 is reported as INVALID, never as a FAIL or PASS, and says why', () => {
  const R = JSON.parse(rd('usdjpy-vb-side-control/result.json')), md = rd('usdjpy-vb-side-control/RESULT.md');
  assert.match(R.verdict, /^INVALID \(look-ahead/); assert.match(md, /No conclusion is drawn/); assert.ok(md.includes(`**Verdict: ${R.verdict}**`));
});

test('v2: the control is every tradable day, long and short, no day picked by the breakout; one test on the buys', () => {
  const pre = rd('usdjpy-vb-side-control-v2/PREREGISTRATION.md');
  assert.match(pre, /on EVERY tradable day: one LONG/); assert.match(pre, /at least 38 of the 40 seeds/);
  const src = rd('usdjpy-vb-side-control-v2/run.mjs');
  assert.match(src, /days\.filter\(\(x\) => !daySkip\(x\)\)/); assert.doesNotMatch(src, /side: t\.side/, 'the control side never comes from a real trade');
  const tr = (side, net, day = '2010-01-04') => ({ side, net, day }), seed = (l, s) => ({ long: [{ day: '2010-01-04', net: l }], short: [{ day: '2010-01-04', net: s }] });
  assert.equal(decide([tr(1, 0.2), tr(-1, 0)], Array.from({ length: 40 }, () => seed(0.1, 0))).pass, true);
  assert.equal(decide([tr(1, 0.05)], Array.from({ length: 40 }, () => seed(0.1, 0))).pass, false);
});

test('v2: the report matches result.json', () => {
  const R = JSON.parse(rd('usdjpy-vb-side-control-v2/result.json')), md = rd('usdjpy-vb-side-control-v2/RESULT.md');
  assert.ok(md.includes(`**Verdict: ${R.verdict}**`)); assert.equal(R.verdict.startsWith('PASS'), R.pass); assert.equal(R.pass, R.buys.beaten >= 38);
});
