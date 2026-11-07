// node --test tests/coach-trials.test.mjs — the Coach's champion/challenger trials (council/coach.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { CC, judgeTrial, trialDeltas, takes, setRule, sameRule, ruleState, descRule } from '../council/coach.mjs';

const DAY = 86400, T0 = Date.parse('2026-11-08T00:00:00Z') / 1000, START = new Date(T0 * 1000).toISOString();
let seq = 0;
const tr = (R, feat, at = T0 + DAY, k = 'scalp') => ({ id: `t${seq++}`, k, R, status: R > 0 ? 'win' : R < 0 ? 'loss' : 'be', opened: at + seq, closed: at + seq + 3600, feat: { d1: 'with', struct: 'main', session: 'london', ...feat } });
// the Coach added "only against D1": the challenger skips the with-D1 signals, the champion (no rule) takes them
const addD1 = { id: 'cc-scalp-d1-1', k: 'scalp', fe: 'd1', champion: null, challenger: 'against', start: START };

test('challenger wins: the with-D1 signals it skips keep losing -> kept', () => {
  const T = [];
  for (let i = 0; i < 24; i++) T.push(tr(i % 4 === 3 ? 1.5 : -1, { d1: 'with' }));          // what the challenger drops: 18 x -1, 6 x +1.5
  for (let i = 0; i < 30; i++) T.push(tr(i % 3 ? -1 : 2.2, { d1: 'against' }));            // both rules take these: they cancel out
  const v = judgeTrial(addD1, T, T0 + 20 * DAY);
  assert.equal(v.status, 'kept');
  assert.equal(v.n, 24); assert.equal(v.signals, 54);
  assert.equal(v.deltaR, 9);                       // challenger is +9R better: it avoided 18 losses and missed 6 x 1.5R
  assert.ok(v.shrunk >= CC.edge && v.shrunk < 9 / 24, `shrunk ${v.shrunk} sits between the bar and the raw +0.375R`);
  assert.match(v.why, /The change stays/);
});

test('challenger loses: the skipped signals win -> reverted, with the reason', () => {
  const T = [];
  for (let i = 0; i < 24; i++) T.push(tr(i % 2 ? 2 : -1, { d1: 'with' }));                 // dropped signals make +0.5R each
  for (let i = 0; i < 10; i++) T.push(tr(-1, { d1: 'against' }));
  const v = judgeTrial(addD1, T, T0 + 20 * DAY);
  assert.equal(v.status, 'reverted');
  assert.equal(v.deltaR, -12);
  assert.ok(v.shrunk < 0);
  assert.match(v.why, /Back to the champion/);
});

test('a small raw edge that does not survive shrinkage is reverted', () => {
  const T = [];
  // 20 disagreeing signals, raw edge +0.06R per signal but noisy: shrunk toward 0, under the +0.05R bar
  const R = [-3, 3, -3, 3, -3, 3, -3, 3, -3, 3, -3, 3, -3, 3, -3, 3, -3, 3, -3, 1.8];
  for (const r of R) T.push(tr(r, { d1: 'with' }));
  const v = judgeTrial(addD1, T, T0 + 20 * DAY);
  assert.equal(v.n, 20); assert.ok(v.deltaR > 0, 'raw: the challenger is ahead');
  assert.equal(v.status, 'reverted'); assert.ok(v.shrunk < CC.edge);
});

test('not enough forward signals: running, then back to the champion after maxDays', () => {
  const T = [];
  for (let i = 0; i < 5; i++) T.push(tr(-1, { d1: 'with' }));
  assert.equal(judgeTrial(addD1, T, T0 + 10 * DAY).status, 'running');
  const v = judgeTrial(addD1, T, T0 + (CC.maxDays + 1) * DAY);
  assert.equal(v.status, 'reverted'); assert.match(v.why, /not proven/);
});

test('only the setup, closed signals and signals since the start count', () => {
  const T = [tr(-1, { d1: 'with' }), tr(-1, { d1: 'with' }, T0 - 5 * DAY), tr(-1, { d1: 'with' }, T0 + DAY, 'rscalp'), { ...tr(-1, { d1: 'with' }), status: 'open' }, { ...tr(0, { d1: 'with' }), status: 'expired' }];
  const D = trialDeltas(addD1, T);
  assert.equal(D.n, 1); assert.equal(D.signals, 1); assert.equal(D.deltaR, 1);
});

test('drop and session trials: the delta sign follows which rule takes the signal', () => {
  const drop = { k: 'scalp', fe: 'd1', champion: 'against', challenger: null, start: START };
  const D = trialDeltas(drop, [tr(2, { d1: 'with' }), tr(-1, { d1: 'against' })]);
  assert.deepEqual(D.d, [2]);                       // the challenger (no rule) takes the with-D1 winner the champion skipped
  const sess = { k: 'scalp', fe: 'session:asia', champion: false, challenger: true, start: START };
  const S = trialDeltas(sess, [tr(-1, { session: 'asia' }), tr(1, { session: 'london' })]);
  assert.deepEqual(S.d, [1]);                       // skipping asia avoided a loser
  assert.equal(takes('struct', 'main', { feat: { struct: 'n/a' } }), true, 'structure n/a passes, as in the Trader');
});

test('rules are set and read back the way the Trader stores them', () => {
  const fl = { d1: 'against', noSession: ['asia'], since: { d1: 'x', 'session:asia': 'x' } };
  setRule(fl, 'session:asia', false, 'now'); assert.equal(fl.noSession, undefined); assert.equal(fl.since['session:asia'], undefined);
  setRule(fl, 'session:late', true, 'now'); assert.deepEqual(fl.noSession, ['late']); assert.equal(fl.since['session:late'], 'now');
  setRule(fl, 'd1', null, 'now'); assert.equal(fl.d1, undefined);
  assert.equal(sameRule(fl, 'd1', null), true); assert.equal(ruleState(fl, 'session:late'), true);
  assert.equal(descRule('d1', 'with'), 'only with D1'); assert.equal(descRule('session:asia', false), 'trade the asia session');
});
