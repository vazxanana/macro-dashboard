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
// review (7 Nov): a variant stream keeps its own one-open-trade rule, so an A-setup can be missing from it only because the variant
// was busy with a trade the A-rule never took. Such a trade passes the filter and must not count as "dropped". The replay tags
// every A-setup with the variants' verdicts (vr); the Coach uses them when present.
test('dropped = the A-setups the filter rejects (vr tags), not the ones lost to the variant\'s own one-open rule', () => {
  const rows = []; for (let i = 0; i < 120; i++) { const fri = i % 4 === 0; rows.push({ ...mk(i, fri ? -1 : 1.2, fri), vr: { nofri: !fri } }); }
  const r = replay(rows); r.shadowByVariant.nofri = r.shadowByVariant.nofri.filter((t, j) => j % 10);   // ~9 winners missing: variant busy
  const [v] = ictVariantVerdicts(r);
  assert.equal(v.n, 30); assert.equal(v.exp, -1); assert.equal(v.keptN, 90); assert.equal(v.keptExp, 1.2);
});
test('variantTags: each variant\'s verdict on an A-setup (what the replay stores as vr)', async () => {
  const { variantTags, loadMeridian } = await import('../ict/tracker.mjs');
  const g = { side: 1, grade: { total: 8 }, feat: { bias: 'against', atrR: 0.5, body: 0.5, session: 'NY AM' }, close: Date.UTC(2026, 10, 6, 15) / 1000 };   // a NY Friday
  const ctx = { H: [], D: [], ms: await loadMeridian() };
  assert.deepEqual(variantTags(g, 'nq', ctx), { nofri: false, h1opp: true });
  assert.deepEqual(variantTags({ ...g, close: g.close - 86400 }, 'nq', ctx), { nofri: true, h1opp: true });
});
test('coach.json: the daily Coach rewrite keeps the proposals and the ICT watch list', async () => {
  const { coachCarry } = await import('../council/proposals.mjs');
  const prev = { proposals: [{ kind: 'ictFilter' }], proposalsKey: 'v5|k', proposalsSent: { key: 'a' }, ictWatch: [{ kind: 'ictWatch', value: 'h1opp' }], notes: ['old'] };
  assert.deepEqual(coachCarry(prev), { proposals: prev.proposals, proposalsKey: 'v5|k', proposalsSent: { key: 'a' }, ictWatch: prev.ictWatch });
  assert.deepEqual(coachCarry({}), { proposals: [], proposalsKey: '', proposalsSent: undefined, ictWatch: [] });
});

test('open trades and non-A trades are ignored; bad input gives nothing', () => {
  assert.deepEqual(ictVariantVerdicts(null), []); assert.deepEqual(ictVariantVerdicts({ trades: [] }), []);
  const rows = [mk(1, -1, true), { ...mk(2, -1, true), closed: null }, { ...mk(3, -1, true), aset: false }, mk(4, 1, false)];
  const [v] = ictVariantVerdicts(replay(rows)); assert.equal(v.n, 1);
});
test('a paper-only market stream (research/ict-markets.md) is not judged as a filter of the A-setups', () => {
  const rows = []; for (let i = 0; i < 60; i++) rows.push(mk(i, i % 2 ? 1 : -1, i % 5 === 0));
  const silver = [{ id: 'xag-b-1-silver-r', market: 'xag', shadow: true, variant: 'silver', paperMarket: true, aset: true, closed: 5, R: 1 }];
  const r = { ...replay(rows), paperVariants: ['silver'] }; r.shadowByVariant.silver = silver;
  assert.deepEqual(ictVariantVerdicts(r).map((v) => v.value), ['nofri']);
  r.shadowByVariant.silver = []; assert.deepEqual(ictVariantVerdicts(r).map((v) => v.value), ['nofri'], 'empty stream skipped by the listed name');
  delete r.paperVariants; r.shadowByVariant.silver = silver; assert.deepEqual(ictVariantVerdicts(r).map((v) => v.value), ['nofri'], 'records flagged paperMarket skipped');
});
test('the exit variant strail (same A-setups, another exit) is not judged as a filter', () => {
  const rows = []; for (let i = 0; i < 60; i++) rows.push(mk(i, i % 2 ? 1 : -1, false));
  const r = replay(rows); r.shadowByVariant.strail = rows.slice(0, 20).map((t) => ({ ...t, id: t.id.replace(/-r$/, '-strail-r') }));
  assert.deepEqual(ictVariantVerdicts(r).map((v) => v.value), []);
});
