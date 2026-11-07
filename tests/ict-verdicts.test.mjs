// node --test tests/ict-verdicts.test.mjs — the Coach's verdict on the ICT desk's paper filter variants
import test from 'node:test';
import assert from 'node:assert/strict';
import { ictVariantVerdicts } from '../council/proposals.mjs';
import { proposalLine, proposalDigest } from '../council/alerts.mjs';
const mk = (i, R, fri) => ({ id: `nq-b-${i}-r`, aset: true, closed: 1000 + i, R, fri });
function replay(rows) { return { at: 'x', trades: rows, shadowByVariant: { nofri: rows.filter((t) => !t.fri).map((t) => ({ ...t, id: t.id.replace(/-r$/, '-nofri-r') })) } }; }
test('dropped trades clearly losing in both halves -> proposal', () => {
  const rows = []; for (let i = 0; i < 120; i++) rows.push(mk(i, i % 4 === 0 ? (i % 8 === 0 ? -1 : -0.75) : (i % 3 ? 1.2 : -1), i % 4 === 0));
  const [v] = ictVariantVerdicts(replay(rows));
  assert.equal(v.kind, 'ictFilter'); assert.equal(v.n, 30); assert.ok(v.t <= -2); assert.equal(v.flag, true);
  assert.match(proposalLine(v), /skip Fridays/);
  assert.ok(proposalDigest([v], null, 1e9), 'an ictFilter proposal is actionable');
});
test('mixed dropped trades -> watch only, with the numbers', () => {
  const rows = []; for (let i = 0; i < 120; i++) rows.push(mk(i, i % 2 ? 1 : -1, i % 4 === 0 || i % 4 === 1));
  const [v] = ictVariantVerdicts(replay(rows));
  assert.equal(v.kind, 'ictWatch'); assert.equal(v.flag, false); assert.match(v.why, /Not proposed/);
  assert.equal(proposalDigest([v], null, 1e9), null, 'a watch note is not sent as a proposal');
});
test('open trades and non-A trades are ignored; bad input gives nothing', () => {
  assert.deepEqual(ictVariantVerdicts(null), []); assert.deepEqual(ictVariantVerdicts({ trades: [] }), []);
  const rows = [mk(1, -1, true), { ...mk(2, -1, true), closed: null }, { ...mk(3, -1, true), aset: false }, mk(4, 1, false)];
  const [v] = ictVariantVerdicts(replay(rows)); assert.equal(v.n, 1);
});
