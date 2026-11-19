// research/edge/rulebook-stress and its live reading on the Macro desk (19 Nov 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { episodes, rescueHit, stressHit, welch } from '../research/edge/rulebook-stress/run.mjs';
import { stressCheck, STRESS, loadDocs } from '../council/research-watch.mjs';

const D = 86400, mk = (vals, t0 = Date.UTC(2010, 0, 4) / 1000) => vals.map((v, i) => ({ d: new Date((t0 + i * D) * 1000).toISOString().slice(0, 10), t: t0 + i * D, v }));

test('episodes, the rescue and stress conditions, Welch', () => {
  const y = mk([...Array(30).fill(2), 1.6, 1.6, ...Array(5).fill(1.6), 1.2]);
  assert.deepEqual(episodes(y, rescueHit(y)).map((o) => o.v), [1.6]);   // the second drop is within 20 sessions
  const ry = mk([0, 0, 0, 0, 0, 0.3]), vix = mk([35, 35, 35, 35, 35, 35]), usd = mk([100, 100, 100, 100, 100, 99]);
  assert.equal(stressHit(ry, vix, usd)(5), true);
  assert.equal(stressHit(ry, mk([20, 20, 20, 20, 20, 20]), usd)(5), false);
  assert.equal(stressHit(ry, vix, mk([99, 99, 99, 99, 99, 100]))(5), false);
  assert.equal(welch([1, 2, 3], [0, 1, 2]).diff, 1);
});

test('the committed result, the report and the desk agree', () => {
  const R = JSON.parse(fs.readFileSync(new URL('../research/edge/rulebook-stress/result.json', import.meta.url), 'utf8'));
  assert.equal(R.verdict, 'C1 FAIL, C2 PASS, C3 FAIL, C4 FAIL, C5 FAIL');
  const md = fs.readFileSync(new URL('../research/edge/rulebook-stress/RESULT.md', import.meta.url), 'utf8').replace(/−/g, '-');
  for (const k of ['C3', 'C4']) assert.ok(md.includes('t ' + R[k].all.t.toFixed(2)), k);
  assert.ok(md.includes('t ' + R.C5.all.t.toFixed(2)) && md.includes(R.C2.n + ' |') && md.includes(R.C1.above + ' of ' + R.C1.n));
  assert.ok(fs.existsSync(new URL('../research/edge/rulebook-stress/PREREGISTRATION.md', import.meta.url)));
  const run = fs.readFileSync(new URL('../research/edge/rulebook-stress/run.mjs', import.meta.url), 'utf8');
  assert.ok(run.includes('c < -0.30') && run.includes('c < 0.25') && run.includes('v > 30'));
  assert.deepEqual(STRESS, { rescueBp: 0.30, rescueN: 2, ryBp: 0.25, ryN: 5, vix: 30 });
  const L = loadDocs(), now = Date.UTC(2010, 1, 1) / 1000;
  const on = stressCheck({ S: { DGS2: mk([2, 2, 2, 2, 2, 2]), DFII10: mk([0, 0, 0, 0, 0, 0.3]), VIXCLS: mk(Array(6).fill(40)), DTWEXBGS: mk([100, 100, 100, 100, 100, 99]) }, now, study: L.stress });
  assert.match(on.text, /^Stress exception ON/); assert.match(on.caveat, /2008-09: consistent with the claim, not proven/);
  const off = stressCheck({ S: { DGS2: mk([2, 2, 2]), DFII10: mk([0, 0, 0, 0, 0, 0]), VIXCLS: [], DTWEXBGS: [] }, now, study: L.stress });
  assert.match(off.text, /^No stress rule/);
  assert.equal(stressCheck({ S: { DGS2: [], DFII10: [] }, now }), null);
});
