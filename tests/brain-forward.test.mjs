// "Improve the brain" (17 Nov 2026): the language-model reviewer reads the ledger's forward checks and never re-proposes a faded
// idea (api/_trade-review.js), and the edge analyst sees its system's own forward record as it stood at the entry, from trades
// closed strictly before it (api/_edge-analyst.js). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as T from '../council/trade-review.mjs';

const require = createRequire(import.meta.url);
const R = require('../api/_trade-review.js'), E = require('../api/_edge-analyst.js');
const FX = new URL('./fixtures/trade-review/', import.meta.url).pathname, NOW = 1794700800;

// the review file with one strong proposal whose forward check faded (an opposite-sign entry recorded before every trade)
function fadedFile() {
  const D = T.readData(FX), base = T.build(D, { now: NOW }), strong = base.proposals.find((p) => p.strong), f = base.flags.find((x) => x.id === strong.flag);
  const key = strong.flag.split('|').slice(0, 2).join('|');
  const old = { id: T.ledgerId(key, strong.flag), stream: key, flag: strong.flag, kind: f.kind, field: f.field, value: f.value, recordedAt: NOW - 90 * 86400, recorded: '2026-08-17T00:00:00.000Z', evidence: { n: 40, mean: 0.5, t: -f.t } };
  const J = JSON.parse(JSON.stringify(T.build({ ...D, ledger: { entries: [old] } }, { now: NOW })));
  return { J, flag: strong.flag, key };
}

test('trade reviewer: the request carries each stream\'s forward checks, and a faded flag is never proposed again', () => {
  const { J, flag, key } = fadedFile(), q = R.buildRequest(J);
  const s = q.payload.streams.find((x) => x.key === key);
  const fc = s.forwardChecks.find((x) => x.flag === flag);
  assert.ok(fc && fc.status === 'faded' && Number.isFinite(fc.n) && Number.isFinite(fc.t));
  assert.match(q.system, /forwardChecks/); assert.match(q.system, /faded/);
  assert.ok(R.fadedFlags(J).has(flag));
  const other = J.flags.find((f) => f.id !== flag && J.systems.find((x) => x.key === key).flags.includes(f.id));
  const ans = JSON.stringify({ overview: 'x', streams: [{ key, review: 'y', proposals: [{ flag, change: 'the faded idea again', why: 'z' }, ...(other ? [{ flag: other.id, change: 'another idea', why: 'w' }] : [])] }] });
  const p = R.parseAnswer(ans, J);
  assert.ok(p.ok); const st = p.answer.streams[0];
  assert.ok(!st.proposals.some((x) => x.flag === flag), 'the faded flag is dropped');
  assert.equal(p.answer.dropped, 1);
  if (other) assert.ok(st.proposals.some((x) => x.flag === other.id), 'a flag that did not fade still passes');
  // a flag the file does not hold is still dropped (the old rule)
  assert.equal(R.parseAnswer(JSON.stringify({ streams: [{ key, review: 'y', proposals: [{ flag: 'made|up', change: 'c' }] }] }), J).answer.dropped, 1);
});

// ─── the edge analyst's forward record ───
const ENTRY = 1794700800;
const done = (i, o = {}) => ({ id: `xau-geg-${i}`, k: 'geg', market: 'xau', side: 'buy', status: i % 3 ? 'win' : 'loss', R: i % 3 ? 2 : -1, Rnet: i % 3 ? 1.9 : -1.1, opened: ENTRY - 40 * 86400 + i * 86400, closed: ENTRY - 30 * 86400 + i * 86400, ...o });
const x = { id: 'xau-geg-now', k: 'geg', market: 'xau', side: 'buy', entry: 4000, r0: 20, stop: 3980, opened: ENTRY, filled: ENTRY, status: 'open', dec: 2 };

test('edge analyst: the forward record holds only trades of the same system closed strictly before the entry', () => {
  const pool = [];
  for (let i = 0; i < 12; i++) pool.push(done(i));   // closed 30 to 19 days before the entry
  pool.push(done(50, { closed: ENTRY, R: 7.77, Rnet: 7.77, status: 'win' }));   // closed AT the entry: not before it
  pool.push(done(51, { closed: ENTRY + 3600, R: 8.88, Rnet: 8.88, status: 'win' }));   // closed after
  pool.push(done(52, { closed: ENTRY - 100, shadow: true, R: 6.66, Rnet: 6.66 }));   // a shadow
  pool.push(done(53, { closed: ENTRY - 100, k: 'gtrend', R: 5.55, Rnet: 5.55 }));   // another system
  pool.push(done(54, { closed: ENTRY - 100, addOf: 'xau-geg-1', R: 4.44, Rnet: 4.44 }));   // an add
  pool.push(done(55, { closed: ENTRY - 100, replay: true, R: 3.33, Rnet: 3.33 }));   // a replay row
  pool.push({ ...x, status: 'win', R: 2.22, Rnet: 2.22, closed: ENTRY - 100 });   // this trade itself (same id)
  pool.push(done(56, { closed: undefined }));   // no close time
  const f = E.forwardRecord(x, pool);
  assert.equal(f.closedBeforeEntry, 12);
  assert.equal(f.winRate, Math.round((8 / 12) * 1000) / 1000); assert.equal(f.meanR, Math.round(((8 * 1.9 - 4 * 1.1) / 12) * 1000) / 1000);
  assert.equal(f.basis, 'R after costs'); assert.equal(f.lastResults.length, 10);
  const q = E.buildRequest(x, {}, [], pool), txt = q.prompt;
  for (const leak of ['7.77', '8.88', '6.66', '5.55', '4.44', '3.33', '2.22', 'xau-geg-']) assert.ok(!txt.includes(leak), `no ${leak} in the request`);
  assert.deepEqual(q.payload.systemForwardRecord, f);
  assert.match(E.SYSTEM, /forward record/);
});

test('edge analyst: under 10 closed trades it says too few and gives no win rate or mean; the NQ open run counts its live session only', () => {
  const pool = [done(0), done(1), done(2)];
  const f = E.forwardRecord(x, pool);
  assert.equal(f.closedBeforeEntry, 3); assert.equal(f.winRate, null); assert.equal(f.meanR, null); assert.match(f.note, /Too few: 3 of 10/);
  assert.equal(E.forwardRecord(x, []).closedBeforeEntry, 0);
  assert.match(E.forwardRecord(x, [{ ...done(0), Rnet: undefined }]).basis, /before costs/);
  const nq = { id: 'nq-nyflip-x', k: 'nq-open', session: 'nyflip', market: 'nq', side: 'buy', entry: 1, r0: 0.1, opened: ENTRY };
  const rows = [{ id: 'a', k: 'nq-open', session: 'nyflip', status: 'win', R: 1, closed: ENTRY - 10 }, { id: 'b', k: 'nq-open', session: 'nyflip-trend', status: 'win', R: 1, closed: ENTRY - 10 }];
  assert.equal(E.forwardRecord(nq, rows).closedBeforeEntry, 1);
  // without a pool the request is as before (no forward record)
  assert.equal(E.buildRequest(x, {}, []).payload.systemForwardRecord, undefined);
});
