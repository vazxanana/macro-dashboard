// eg-methods-18-2020: the report matches result.json, the bar is applied as pre-registered, and the in-memory pip fix holds.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = new URL('../research/edge/eg-methods-18-2020/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');
const f = (v, d = 3) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));

test('eg-methods-18-2020: verdict on line 3 and the headline match result.json', () => {
  const l3 = md.split('\n')[2];
  assert.match(l3, /^\*\*Verdict: (PASS|FAIL|INCONCLUSIVE|INVALID)\. /);
  assert.ok(l3.includes(`Verdict: ${R.verdict}.`));
  assert.ok(l3.includes(R.headline));
  assert.equal(Object.keys(R.tests).length, 6);
  assert.equal(R.markets.length, 18);
});

test('eg-methods-18-2020: every row of the table is the result file', () => {
  for (const [id, t] of Object.entries(R.tests)) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${id} | ${t.what} |`));
    assert.ok(row, id);
    for (const s of [String(t.discovery.net.n), f(t.discovery.net.mean), String(t.confirmation.net.n), f(t.confirmation.net.mean), String(t.holm), t.verdict]) assert.ok(row.includes(s), `${id} ${s}`);
  }
});

test('eg-methods-18-2020: the pre-registered bar decides each verdict; the look-ahead check passed', () => {
  assert.equal(R.cutCheck.ok, true);
  for (const t of Object.values(R.tests)) {
    const pass = Object.values(t.checks).every(Boolean);
    assert.equal(t.verdict === 'PASS', pass);
    if (t.checks.discN100 && t.checks.confN50 && !pass) assert.equal(t.verdict, 'FAIL');
  }
  assert.equal(R.verdict, Object.values(R.tests).some((t) => t.verdict === 'PASS') ? 'PASS' : 'FAIL');
  assert.match(pre, /Holm/); assert.match(pre, /month-sum t ≥ 2/);
});

test('eg-methods-18-2020: the in-memory decimals give 30 of each market\'s own pips', async () => {
  await import(fileURLToPath(new URL('run.mjs', dir)));
  const { stopSize } = await import('../council/eg-methods.mjs');
  assert.ok(Math.abs(stopSize('eurjpy') - 0.30) < 1e-9);
  assert.ok(Math.abs(stopSize('nzdusd') - 0.0030) < 1e-12);
  assert.ok(Math.abs(stopSize('xau') - 3.0) < 1e-9);
  assert.ok(Math.abs(stopSize('de40') - 30) < 1e-9);
});

test('eg-methods-18-2020: the before-cost judgement (asked after the run) leads and matches result.json', () => {
  assert.ok(md.indexOf('## Before costs') < md.indexOf('## After costs'));
  assert.equal(R.verdictBeforeCosts, Object.values(R.tests).some((t) => t.beforeCosts.verdict === 'PASS') ? 'PASS' : 'FAIL');
  for (const t of Object.values(R.tests)) assert.equal(t.beforeCosts.verdict === 'PASS', Object.values(t.beforeCosts.checks).every(Boolean));
});
