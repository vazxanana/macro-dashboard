// research/edge/rulebook-gauges and its live reading on the Macro desk (19 Nov 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseFred, knownAt, episodes, testB } from '../research/edge/rulebook-gauges/run.mjs';
import { policyGapCheck, loadDocs } from '../council/research-watch.mjs';

test('FRED parsing, the known-at rule, VIX episodes', () => {
  assert.deepEqual(parseFred('DATE,X\n2020-01-03,1.5\n2020-01-06,.\n').map((o) => o.v), [1.5]);
  const fri = Date.UTC(2026, 10, 13) / 1000; assert.equal(new Date(knownAt(fri) * 1000).getUTCDay(), 1);
  const v = []; for (let i = 0; i < 60; i++) v.push({ d: '2010-01-' + String(i).padStart(2, '0'), t: i, v: i === 30 || i === 31 || i === 40 ? 45 : 20 });
  assert.deepEqual(episodes(v, '2000').map((o) => o.t), [30]);
});

test('the committed result equals the code, the report quotes it, the desk reads it', () => {
  const R = JSON.parse(fs.readFileSync(new URL('../research/edge/rulebook-gauges/result.json', import.meta.url), 'utf8'));
  assert.deepEqual(testB(R.rows), R.B); assert.equal(R.verdict, 'A FAIL, B1 FAIL, B2 PASS');
  const md = fs.readFileSync(new URL('../research/edge/rulebook-gauges/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, /A FAIL, B1 FAIL, B2 PASS/); assert.ok(md.includes('+' + R.B.tests.B2.all.t.toFixed(2)) && md.includes(R.A.n + ' episodes'));
  assert.ok(fs.existsSync(new URL('../research/edge/rulebook-gauges/PREREGISTRATION.md', import.meta.url)));
  const D = loadDocs(), day = Date.UTC(2026, 10, 18) / 1000;
  const c = policyGapCheck({ S: { DGS2: [{ t: day, v: 3.5 }] }, policy: [{ t: day - 86400, v: 4 }], now: day, study: D.gauges });
  assert.match(c.text, /^Cuts priced/); assert.match(c.caveat, /PASSED .* not a trading rule/);
  assert.equal(policyGapCheck({ S: { DGS2: [] }, policy: [], now: day }), null);
});
