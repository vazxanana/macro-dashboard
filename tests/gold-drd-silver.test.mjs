// The playbook long on silver: price-scaled signals and trade, Holm, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signals, simulate, holm, BUF, COST } from '../research/edge/gold-drd-silver/run.mjs';

test('silver numbers are the pre-registered ones', () => { assert.equal(BUF, 0.004); assert.equal(COST, 0.03); });

test('the stop sits under the signal day low by the buffer, every trade has one below its entry', () => {
  const ds = [{ d: 0, high: 30, low: 29, close: 29.5 }, { d: 1, high: 30.2, low: 29.6, close: 30.1 }, { d: 2, high: 30.3, low: 30, close: 30.2 }];
  const wk = [{ k: -3 }, { k: -3 }], wst = [1];
  const s = signals(ds.map((x) => ({ ...x, d: x.d })), [{ k: -3 }], [1]);
  for (const x of s) assert.ok(Math.abs(x.stop - (ds[x.i].low - BUF)) < 1e-12);
  const t0 = 86400 * 2 + 3600;
  const h1 = [{ time: t0, open: 30.1, high: 30.15, low: 29.5, close: 29.6 }];
  const tr = simulate(h1, new Map([[2, 0]]), [...ds, { d: 3 }], { i: 1, d: 1, stop: 29.6 - BUF }, 3);
  if (tr) { assert.ok(tr.entry > tr.stop); assert.equal(tr.how, 'stop'); assert.ok(tr.R <= -1 + 1e-9); assert.ok(tr.net < tr.R); }
});

test('Holm multiplies the smallest p by the count and keeps the order', () => {
  assert.deepEqual(holm([0.0287, 0.0125, 0.0059]).map((x) => +x.toFixed(4)), [0.0287, 0.025, 0.0177]);
  assert.deepEqual(holm([0.5, 0.01]), [0.5, 0.02]);
});

test('the report says what result.json holds, including that it is not robust', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-drd-silver/result.json', import.meta.url))), md = fs.readFileSync(new URL('../research/edge/gold-drd-silver/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'PASS'); assert.match(md, /\*\*Verdict: PASS on the pre-registered bar, and not robust\.\*\*/);
  for (const k of ['T1', 'T2', 'T3']) { const a = r.rows[k].all; assert.ok(r.tests[k].pass);
    assert.match(md, new RegExp(`\\| ${a.n} \\| \\+${a.avg.toFixed(3)} \\| ${a.pf.toFixed(2)} \\| ${a.t.toFixed(2)} \\| ${a.dd}R \\|`), k);
    assert.ok(md.includes(`| ${r.robust[k].monthly.t.toFixed(2)} |`), k + ' monthly t'); }
  assert.ok(!/now live|live change/i.test(md.replace(/nothing live changed/i, '')));
});
