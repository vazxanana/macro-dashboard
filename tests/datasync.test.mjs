// council/datasync.mjs: the council loop's pull / save against council-data, on throwaway local git repositories (offline).
// Scenarios from the 8-9 Nov run logs: a dirty working tree refused every pull, a conflict left a rebase half-done, and a
// diverged clone could not push for the rest of the run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pull, save, inRebase, recover } from '../council/datasync.mjs';

const G = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const W = (dir, f, v) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), typeof v === 'string' ? v : JSON.stringify(v, null, 1)); };
const R = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const quiet = () => {};
const opts = { log: quiet, sleep: () => {} };

function clone(remote, into) {
  execFileSync('git', ['clone', '-q', '--branch', 'council-data', remote, into], { stdio: 'ignore' });
  G(into, 'config', 'user.name', 'test'); G(into, 'config', 'user.email', 'test@example.com'); G(into, 'config', 'commit.gpgsign', 'false');
  return into;
}
// a bare "origin" with council-data, the loop's clone (A) and another writer's clone (B: the owner's page, the live runner)
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'datasync-')), remote = path.join(root, 'origin.git'), seed = path.join(root, 'seed');
  execFileSync('git', ['init', '-q', '--bare', remote]);
  fs.mkdirSync(seed); G(seed, 'init', '-q'); G(seed, 'config', 'user.name', 'test'); G(seed, 'config', 'user.email', 'test@example.com'); G(seed, 'config', 'commit.gpgsign', 'false');
  G(seed, 'checkout', '-q', '-b', 'council-data');
  W(seed, 'trades.json', [{ id: 'a', R: 1 }]); W(seed, 'snapshot.json', { at: 't0' }); W(seed, 'reviews/losses.json', {}); W(seed, 'ctrader/accounts.json', { at: 't0' });
  G(seed, 'add', '-A'); G(seed, 'commit', '-q', '-m', 'seed'); G(seed, 'remote', 'add', 'origin', remote); G(seed, 'push', '-q', 'origin', 'council-data');
  return { root, remote, A: clone(remote, path.join(root, 'A')), B: clone(remote, path.join(root, 'B')) };
}
const pushB = (B, f, v, msg = 'owner edit') => { W(B, f, v); G(B, 'add', '-A'); G(B, 'commit', '-q', '-m', msg); G(B, 'push', '-q', 'origin', 'HEAD:council-data'); };

test('the old pull is refused with uncommitted changes (the logged error); datasync pull takes the update and keeps them', () => {
  const { A, B } = setup();
  pushB(B, 'reviews/losses.json', { x: { tags: ['hunt'] } });
  W(A, 'ctrader/accounts.json', { at: 't1' });                       // the minute account step's file, never committed
  assert.throws(() => G(A, 'pull', '-q', '--rebase', 'origin', 'council-data'), /unstaged changes|uncommitted changes/);
  const r = pull(A, opts);
  assert.equal(r.ok, true);
  assert.deepEqual(JSON.parse(R(A, 'reviews/losses.json')), { x: { tags: ['hunt'] } });   // the owner's review arrived
  assert.deepEqual(JSON.parse(R(A, 'ctrader/accounts.json')), { at: 't1' });             // the loop's own change kept
  assert.equal(inRebase(A), false);
});

test('a conflict keeps the council-data copy of that file, the rest of the round is pushed, nothing is left half-done', () => {
  const { A, B } = setup();
  pushB(B, 'trades.json', [{ id: 'a', R: 1, note: 'repair' }]);
  W(A, 'trades.json', [{ id: 'a', R: 2 }]); W(A, 'snapshot.json', { at: 't1' });
  const r = save(A, 'Council run test', opts);
  assert.equal(r.ok, true); assert.equal(r.pushed, true);
  assert.equal(inRebase(A), false);
  assert.equal(G(A, 'status', '--porcelain'), '');
  const B2 = clone(path.join(path.dirname(A), 'origin.git'), path.join(path.dirname(A), 'C'));
  assert.deepEqual(JSON.parse(R(B2, 'trades.json')), [{ id: 'a', R: 1, note: 'repair' }]);   // the other writer's copy won
  assert.deepEqual(JSON.parse(R(B2, 'snapshot.json')), { at: 't1' });                         // the round's other file is saved
  assert.match(G(B2, 'log', '-1', '--format=%s'), /^Council run test/);
});

test('a pull into a conflicting uncommitted change never leaves conflict markers in a JSON file', () => {
  const { A, B } = setup();
  pushB(B, 'snapshot.json', { at: 'remote' });
  W(A, 'snapshot.json', { at: 'local' });
  const r = pull(A, opts);
  assert.equal(r.ok, true);
  assert.equal(inRebase(A), false);
  assert.doesNotThrow(() => JSON.parse(R(A, 'snapshot.json')));
  assert.doesNotMatch(R(A, 'snapshot.json'), /<<<<<<<|>>>>>>>/);
  assert.equal(G(A, 'stash', 'list'), '');                        // no stash left to pile up over a 5-hour run
});

test('an untracked local file that council-data now also has does not block the pull (the council-data copy wins)', () => {
  const { A, B } = setup();
  pushB(B, 'ctrader/mirror-2.json', { from: 'live runner' });
  W(A, 'ctrader/mirror-2.json', { from: 'loop' }); W(A, 'snapshot.json', { at: 'mine' });
  W(A, 'trades.json', [{ id: 'a', R: 1 }, { id: 'n' }]); G(A, 'commit', '-q', '-am', 'local round');   // a commit to rebase
  const r = pull(A, opts);
  assert.equal(r.ok, true);
  assert.deepEqual(JSON.parse(R(A, 'ctrader/mirror-2.json')), { from: 'live runner' });
  assert.equal(G(A, 'rev-list', '--count', 'origin/council-data..HEAD'), '1', 'the local round is rebased, not lost');
  assert.equal(inRebase(A), false);
});

test('a rebase left half-done by an earlier step is cleared before the next pull', () => {
  const { A, B } = setup();
  pushB(B, 'trades.json', [{ id: 'b' }]);
  W(A, 'trades.json', [{ id: 'c' }]); G(A, 'commit', '-q', '-am', 'local');
  try { G(A, 'pull', '-q', '--rebase', 'origin', 'council-data'); } catch (e) { /* conflict, as in the logs */ }
  assert.equal(inRebase(A), true);
  assert.match(R(A, 'trades.json'), /<<<<<<</);
  assert.equal(recover(A, quiet), true);
  assert.equal(inRebase(A), false);
  const r = save(A, 'Council run later', opts);
  assert.equal(r.ok, true); assert.equal(r.pushed, true);
  assert.deepEqual(JSON.parse(R(A, 'trades.json')), [{ id: 'b' }]);
});

test('a JSON file cut short (a step killed mid-write) is not committed; the last good copy comes back', () => {
  const { A } = setup();
  W(A, 'trades.json', '[{"id":"a","R":1},{"id":');
  W(A, 'snapshot.json', { at: 't2' });
  const r = save(A, 'Council run cut', opts);
  assert.equal(r.ok, true);
  assert.deepEqual(JSON.parse(R(A, 'trades.json')), [{ id: 'a', R: 1 }]);
  assert.equal(G(A, 'show', 'HEAD:snapshot.json').includes('t2'), true);
  assert.equal(G(A, 'show', 'HEAD:trades.json').includes('"id":'), true);
  assert.doesNotThrow(() => JSON.parse(G(A, 'show', 'HEAD:trades.json')));
});

test('save with paths commits only those; a dirty file outside them does not block the push', () => {
  const { A, B } = setup();
  pushB(B, 'reviews/losses.json', { y: 1 });
  W(A, 'ctrader/accounts.json', { at: 't3' }); W(A, 'snapshot.json', { at: 'dirty' });
  const r = save(A, 'cTrader account', { ...opts, paths: ['ctrader/accounts.json'] });
  assert.equal(r.ok, true); assert.equal(r.pushed, true);
  assert.match(G(A, 'show', 'origin/council-data:ctrader/accounts.json'), /t3/);
  assert.match(G(A, 'show', 'origin/council-data:snapshot.json'), /t0/);
  assert.deepEqual(JSON.parse(R(A, 'snapshot.json')), { at: 'dirty' });     // still there for the round's own save
});

test('nothing to save and nothing ahead: no commit, no push, ok', () => {
  const { A } = setup();
  const r = save(A, 'Council run idle', opts);
  assert.deepEqual(r, { ok: true, committed: false, pushed: false });
});

test('an unreachable origin never throws; the commit stays local for the next save', () => {
  const { A } = setup();
  G(A, 'remote', 'set-url', 'origin', path.join(path.dirname(A), 'missing.git'));
  W(A, 'snapshot.json', { at: 'offline' });
  const r = save(A, 'Council run offline', opts);
  assert.equal(r.ok, false); assert.equal(r.committed, true);
  assert.equal(pull(A, opts).ok, false);
  assert.match(G(A, 'log', '-1', '--format=%s'), /offline/);
});
