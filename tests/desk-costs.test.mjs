// After costs on the desks (26 Nov 2026, owner: "on all edges add the option after costs"). Display only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), S = require('../assets/mosha-sop.js'), M = S.MS_MOSHA_SOP || S;
const src = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('one round trip comes off each trade, on the risk it opened with; off = the rows untouched', () => {
  const rows = [{ market: 'eurusd', entry: 1.1, stop: 1.0994, R: 2, t: 1 }, { entry: 4000, stop: 3997, R: null, float: 0.5, t: 2 }, { market: 'eurusd', entry: 1.1, stop: 1.1006, R: -1, t: 3 }];
  assert.equal(M.costed(rows, false), rows);
  const c = M.costed(rows, true);
  assert.ok(Math.abs(c[0].R - 1.9) < 1e-9 && c[0].grossR === 2);
  assert.ok(c[1].R === null && Math.abs(c[1].float - 0.4) < 1e-9, 'an open trade stays open; gold is the default market');
  assert.ok(Math.abs(c[2].R + 1.1) < 1e-9, 'a loss pays the cost too');
  assert.equal(rows[0].R, 2, 'the stored rows are never changed');
});
test('every market a desk can show has a cost; the choice is memory only', () => {
  for (const k of Object.keys(M.ALL)) assert.ok(M.COSTS[k] > 0, k);
  const a = src('assets/mosha-sop.js'), b = src('assets/desk-trades.js');
  assert.ok(!/localStorage|sessionStorage/.test(a.slice(a.indexOf('var COSTS'), a.indexOf('function summary(rows)'))));
  assert.ok(b.includes("SOP.costed(S.rows)") && b.includes('data-dk-costs') && a.includes('data-sop-costs') && a.includes('costed(S.rows || [])'));
  assert.ok(a.includes("tile('Total, ' + costsWord()") && b.includes("tile('Total, ' + SOP.costsWord()"));
});
