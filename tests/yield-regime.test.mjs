// research/edge/yield-regime and its live reading on the Macro desk (19 Nov 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classOf, whyOf, holm, analyse } from '../research/edge/yield-regime/run.mjs';
import { regimeCheck, loadDocs } from '../council/research-watch.mjs';

test('classes and the why split follow the rule book\'s thresholds; the live reading uses the same ones', () => {
  assert.equal(classOf(0.25, 0, 0), 'risingFast'); assert.equal(classOf(0, 0.5, 0), 'risingFast'); assert.equal(classOf(-0.3, 0, 0), 'fallingFast');
  assert.equal(classOf(0.1, 0.2, 0.3), 'risingSlow'); assert.equal(classOf(0, 0, -0.25), 'fallingSlow'); assert.equal(classOf(0, 0, 0), 'flat');
  assert.equal(whyOf(0.3, 0.35), 'led2y'); assert.equal(whyOf(0.4, 0.2), 'termPremium'); assert.equal(whyOf(0.4, 0.3), null); assert.equal(whyOf(0.2, 0), null);
  const day = (k) => Date.UTC(2026, 0, 1) / 1000 + k * 86400, S = { DGS10: [{ t: day(0), v: 4 }, { t: day(14), v: 4 }, { t: day(28), v: 4 }, { t: day(42), v: 4.3 }], DGS2: [{ t: day(14), v: 3 }, { t: day(42), v: 3 }] };
  const r = regimeCheck({ S, now: day(42), study: null }); assert.match(r.text, /rising fast.*term premium/);
  assert.deepEqual(holm([0.01, 0.04, 0.5]).map((x) => +x.toFixed(2)), [0.03, 0.08, 0.5]);
});

test('the committed result equals the code, the report quotes it, the desk reads it', () => {
  const R = JSON.parse(fs.readFileSync(new URL('../research/edge/yield-regime/result.json', import.meta.url), 'utf8'));
  const A = analyse(R.rows); assert.deepEqual(A.tests, R.tests); assert.equal(R.verdict, 'FAIL, 0 of 3');
  const md = fs.readFileSync(new URL('../research/edge/yield-regime/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, /Verdict: FAIL, 0 of 3/); for (const k of ['T1', 'T2', 'T3']) assert.ok(md.includes(String(R.tests[k].all.t).replace('-', '−')), k);
  assert.ok(md.includes(R.classes.fallingFast.n + ' | +' + (R.classes.fallingFast.gold * 100).toFixed(2) + ' %'));
  assert.ok(fs.existsSync(new URL('../research/edge/yield-regime/PREREGISTRATION.md', import.meta.url)));
  const D = loadDocs(); assert.equal(D.regime.verdict, 'FAIL, 0 of 3');
});
