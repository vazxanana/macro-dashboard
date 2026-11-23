// tests/dom-zone-holdout.test.mjs - the report says what result.json holds
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const D = new URL('../research/edge/dom-zone-holdout/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', D), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', D), 'utf8');
const f = (x, d = 3) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(d);

test('verdict and the three tests', () => {
  assert.equal(R.verdict, 'PASS');
  assert.deepEqual(R.passes, [true, true, true]);
  assert.match(md.split('\n')[2], /^\*\*Verdict: PASS /);
  assert.ok(R.T1.early.before > 0 && R.T1.early.tBefore >= 2 && R.T1.late.before > 0 && R.T1.late.tBefore >= 2);
  assert.ok(R.T2.before > 0 && R.T2.tBefore >= 2 && R.T3.before > 0 && R.T3.tBefore >= 2);
});

test('report figures equal result.json', () => {
  for (const [s, n] of [[R.T1.early, '75,351'], [R.T1.late, '75,694'], [R.T2, '273,279'], [R.T3, '27,965']]) {
    assert.ok(md.includes(n), n);
    assert.ok(md.includes(`${f(s.before)} (${s.tBefore.toFixed(2)})`), n);
    assert.ok(md.includes(`${f(s.after)} (${s.tAfter.toFixed(2)})`), n);
  }
  for (const [m, v] of Object.entries(R.perMarket)) for (const s of Object.values(v)) {
    assert.ok(md.includes(`${f(s.before)} (${s.tBefore.toFixed(2)})`), m);
    assert.ok(md.includes(`${f(s.after)} (${s.tAfter.toFixed(2)})`), m);
  }
});

test('after costs it loses on every 2010-19 market', () => {
  for (const [m, v] of Object.entries(R.perMarket)) { const s = v['2010-19'] || v['2005-19']; assert.ok(s.after < 0, m); }
});
