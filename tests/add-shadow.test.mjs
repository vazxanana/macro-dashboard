// node --test tests/add-shadow.test.mjs — a pyramid add inherits its parent's shadow flag (mosha-oos review, 7 Nov):
// the generic add in council/trader.mjs was written `shadow: false, blockedBy: []`, so a SHADOW Mosha BO or replica chain
// reaching +addAt R would have put an add into the live record, the open cap and the decay monitor's record.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');

test('every add record carries its parent\'s shadow flag and blockers', () => {
  const adds = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /addOf: (tr|open)\.id/.test(l));
  assert.ok(adds.length >= 3, `expected the replica/Mosha, crypto and gold-trend adds, found ${adds.length}`);
  for (const [n, l] of adds) {
    assert.doesNotMatch(l, /shadow: false/, `line ${n}: an add must not be forced live`);
    assert.match(l, /shadow: !!(tr|open)\.shadow/, `line ${n}: shadow inherited from the parent`);
    assert.match(l, /blockedBy: (tr|open)\.shadow \?/, `line ${n}: blockers set when the parent is a shadow`);
  }
});

test('the generic add keeps the parent\'s own blockers, else owner-shadow', () => {
  // the expression on the generic add line, evaluated on its own
  const m = src.match(/addOf: tr\.id, shadow: !!tr\.shadow, blockedBy: (tr\.shadow \? .*? : \[\]),/);
  assert.ok(m, 'generic add line present');
  const f = new Function('tr', `return ${m[1]};`);
  assert.deepEqual(f({ shadow: true, blockedBy: ['regime-shadow'] }), ['regime-shadow']);
  assert.deepEqual(f({ shadow: true, blockedBy: [] }), ['owner-shadow']);
  assert.deepEqual(f({ shadow: true }), ['owner-shadow']);
  assert.deepEqual(f({ shadow: false, blockedBy: ['x'] }), []);
  assert.deepEqual(f({}), []);
});
