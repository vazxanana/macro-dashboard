// research/edge/red-folder-surprise: pre-registered, the result file matches the code and the report
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { events, analyse, binomP, stat, COST } from '../research/edge/red-folder-surprise/run.mjs';

test('the rule: hot miss = gold down, trade T+5 to T+60 less the cost, zero misses skipped', () => {
  const base = { rows: [{ type: 'CPI', d: '2023-01-12', t: 100, g5: -0.2, g5to60: -0.1, g60: -0.3 }, { type: 'CPI', d: '2019-01-12', t: 200, g5: 0.1, g5to60: 0.2, g60: 0.3 }, { type: 'NFP', d: '2023-02-03', t: 300, g5: 0.1, g5to60: 0.1, g60: 0.2 }] };
  const hist = { rows: [['Core CPI m/m', new Date(100e3).toISOString(), '0.2%', '0.4%', '0.3%'], ['Core CPI m/m', new Date(200e3).toISOString(), '0.3%', '0.2%', ''], ['ADP Non-Farm Employment Change', new Date(300e3).toISOString(), '1K', '2K', ''], ['Non-Farm Employment Change', new Date(300e3).toISOString(), '150K', '150K', '']] };
  const E = events(base, hist);
  assert.equal(E.length, 2); assert.equal(E[0].dir, -1); assert.equal(E[0].R, +(0.1 - COST).toFixed(4)); assert.equal(E[1].dir, 1); assert.equal(E[1].oos, false);
  assert.equal(binomP(5, 10), 1); assert.ok(binomP(10, 10) < 0.01); assert.equal(stat([1, 1]).mean, 1);
});

test('the committed result equals the code, the pre-registration came first, the report quotes it', () => {
  const R = JSON.parse(fs.readFileSync(new URL('../research/edge/red-folder-surprise/result.json', import.meta.url), 'utf8'));
  assert.deepEqual(analyse(R.events).T2, R.T2); assert.equal(R.verdict, 'FAIL');
  const md = fs.readFileSync(new URL('../research/edge/red-folder-surprise/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, /Verdict: FAIL/); assert.ok(md.includes('t ' + String(R.T2.outOfSample.t).replace('-', '−'))); assert.ok(md.includes(R.T1.all.agree + ' of ' + R.T1.all.n));
  assert.ok(fs.existsSync(new URL('../research/edge/red-folder-surprise/PREREGISTRATION.md', import.meta.url)));
});

test('the red folder study tells the desk what the surprise study found, for CPI and payrolls', async () => {
  const { build, loadInputs } = await import('../council/redfolder.mjs');
  const R = build({ inputs: loadInputs(), rel: null, now: Date.UTC(2026, 10, 19) / 1000, gold: [], dxy: [] });
  for (const k of ['CPI', 'NFP']) assert.ok(R.study[k].prep.some((l) => /first 5 minutes .* do not chase/.test(l)), k);
  assert.ok(!R.study.FOMC.prep.some((l) => /first 5 minutes/.test(l)));
});
