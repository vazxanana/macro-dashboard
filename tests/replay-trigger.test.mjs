// node --test tests/replay-trigger.test.mjs — the daily ICT replay's reliable trigger (11 Nov 2026): the decision
// (council/replay-due.mjs, pure + a fake fetch), the one line the council loop gained and the replay workflow (both read as
// text), and the data-files health threshold for ict/replay.json. Offline: no network, no secrets, nothing dispatched.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decide, main, listRuns, replayAtOf, STALE_H, GAP_H, WORKFLOW } from '../council/replay-due.mjs';
import { checkFiles, freshness, FILES } from '../council/datahealth.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const NOW = Date.parse('2026-11-12T10:00:00Z'), H = 3600e3, iso = (ms) => new Date(ms).toISOString();
const done = (hAgo) => ({ status: 'completed', created_at: iso(NOW - hAgo * H) });
const tmp = (replay) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rpdue-')); fs.mkdirSync(path.join(d, 'ict'));
  if (replay !== undefined) fs.writeFileSync(path.join(d, 'ict', 'replay.json'), typeof replay === 'string' ? replay : JSON.stringify(replay)); return d; };

test('decide: due only when the replay is over 20 h old AND no run is active AND none was started in the last 6 h', () => {
  assert.equal(STALE_H, 20); assert.equal(GAP_H, 6); assert.equal(WORKFLOW, 'ict-replay.yml');
  const D = (replayAt, runs) => decide({ replayAt, runs, now: NOW });
  assert.equal(D(iso(NOW - 19.9 * H), [done(19.9)]).due, false, 'fresh');
  assert.equal(D(iso(NOW - 20.1 * H), [done(20.1)]).due, true, 'a day old, last run a day ago');
  assert.equal(D(iso(NOW - 80 * H), []).due, true, 'no run on record at all');
  // the guards that keep it to one start: a run in flight (any not-completed status), or any start in the last 6 h
  for (const status of ['queued', 'in_progress', 'waiting', 'pending', 'requested']) {
    const d = D(iso(NOW - 30 * H), [{ status, created_at: iso(NOW - 9 * H) }, done(30)]);
    assert.equal(d.due, false, status); assert.match(d.why, /already/);
  }
  assert.equal(D(iso(NOW - 30 * H), [done(5.9), done(30)]).due, false, 'dispatched (or pushed, or cron) 5.9 h ago: wait, even if it failed and wrote nothing');
  assert.equal(D(iso(NOW - 30 * H), [done(6.1), done(30)]).due, true, 'a failed run over 6 h ago: try again');
  // not sure = no
  for (const runs of [null, undefined, 'x', {}]) assert.equal(D(iso(NOW - 30 * H), runs).due, false, 'unreadable run list');
  // a missing or broken file is rebuilt by the replay, under the same guards
  assert.equal(D(null, [done(30)]).due, true); assert.equal(D('not a date', [done(30)]).due, true);
  assert.equal(D(null, [done(1)]).due, false); assert.equal(D(null, null).due, false);
  assert.equal(D(iso(NOW + 2 * H), [done(30)]).due, false, 'a time in the future is not stale');
  // run entries without a usable time never count as a recent start, and never crash
  assert.equal(D(iso(NOW - 30 * H), [{ status: 'completed' }, null, { status: 'completed', created_at: 'x' }]).due, true);
});

test('main: a fresh file is answered without the network; a stale one asks GitHub once with GET and fails closed', async () => {
  let calls = [];
  const fake = (body, ok = true) => async (url, opt) => { calls.push({ url, opt }); return { ok, json: async () => body }; };
  const env = { GITHUB_REPOSITORY: 'o/r', GH_TOKEN: 'tok' };
  const fresh = tmp({ at: iso(NOW - 2 * H) });
  assert.equal((await main(fresh, { env, now: NOW, fetchFn: fake({ workflow_runs: [] }) })).due, false); assert.equal(calls.length, 0);
  const stale = tmp({ at: iso(NOW - 26 * H) });
  const d = await main(stale, { env, now: NOW, fetchFn: fake({ workflow_runs: [{ status: 'completed', created_at: iso(NOW - 26 * H), conclusion: 'success' }] }) });
  assert.equal(d.due, true); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.github.com/repos/o/r/actions/workflows/ict-replay.yml/runs?per_page=20');
  assert.equal(calls[0].opt.method, undefined, 'GET'); assert.equal(calls[0].opt.body, undefined); assert.equal(calls[0].opt.headers.authorization, 'Bearer tok');
  assert.equal((await main(stale, { env, now: NOW, fetchFn: fake({ workflow_runs: [{ status: 'in_progress', created_at: iso(NOW - 0.1 * H) }] }) })).due, false);
  assert.equal((await main(stale, { env, now: NOW, fetchFn: fake({ message: 'rate limited' }, false) })).due, false, 'HTTP error');
  assert.equal((await main(stale, { env, now: NOW, fetchFn: fake({ nothing: 1 }) })).due, false, 'unexpected body');
  assert.equal((await main(stale, { env, now: NOW, fetchFn: async () => { throw new Error('offline'); } })).due, false, 'network error');
  assert.equal((await main(stale, { env: {}, now: NOW, fetchFn: fake({ workflow_runs: [] }) })).due, false, 'no repository name: nothing asked, nothing started');
  assert.equal(await listRuns({ repo: 'o/r/../x', fetchFn: fake({ workflow_runs: [] }) }), null);
  assert.equal(replayAtOf(tmp()), null); assert.equal(replayAtOf(tmp('{ "at": ')), null); assert.equal(replayAtOf(tmp({ at: 5 })), null);
  // a missing file with a readable, quiet run list is due (the replay writes it)
  assert.equal((await main(tmp(), { env, now: NOW, fetchFn: fake({ workflow_runs: [] }) })).due, true);
});

test('the command line: exit 1 (no dispatch) on a fresh file, and on a stale one whose run list cannot be read', () => {
  const run = (dir, env) => { try { execFileSync(process.execPath, [path.join(ROOT, 'council/replay-due.mjs'), dir], { env: { PATH: process.env.PATH, ...env }, stdio: 'pipe', timeout: 30000 }); return 0; } catch (e) { return e.status; } };
  assert.equal(run(tmp({ at: new Date().toISOString() }), { GITHUB_REPOSITORY: 'o/r' }), 1);
  assert.equal(run(tmp({ at: '2026-01-01T00:00:00Z' }), {}), 1, 'no repository in the environment: fails closed before any request');
});

test('the decision file only reads: no write, no process, no request other than the one GET', () => {
  const s = rd('council/replay-due.mjs');
  assert.deepEqual([...s.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), ['node:fs', 'node:path', 'node:url']);
  assert.doesNotMatch(s, /writeFile|appendFile|unlink|rename|child_process|method:|dispatches"|POST|PUT|PATCH|DELETE/);
  assert.equal((s.match(/fetchFn\(/g) || []).length, 1);
  assert.doesNotMatch(s, /console\.log\([^)]*(token|TOKEN)/, 'the token is never printed');
});

test('council.yml: one guarded line after the round is saved; it can only skip, never stop the round', () => {
  const y = rd('.github/workflows/council.yml'), lines = y.split('\n');
  const hit = lines.filter((l) => /ict-replay\.yml/.test(l) && !/^\s*#/.test(l));
  assert.equal(hit.length, 1, 'exactly one line names the replay workflow');
  assert.equal(hit[0].trim(), 'if timeout 45 node council/replay-due.mjs data; then timeout 30 gh workflow run ict-replay.yml --ref main -R "${{ github.repository }}" || echo "ICT replay not dispatched after round $i (a later round retries)"; fi');
  // `if A; then B || echo; fi` cannot end non-zero under bash -e: A's failure is the else branch, B's failure is swallowed
  assert.equal((y.match(/replay-due\.mjs data/g) || []).length, 1);
  // placed after the round's save and before the hand-over check: nothing new between the Trader and the mirror
  const at = lines.indexOf(hit[0]), find = (re) => lines.findIndex((l) => re.test(l));
  const save = find(/datasync\.mjs data save "Council run /), hand = find(/if newcode; then echo "New council code on main: handing over after round \$i"; break; fi/);
  assert.ok(save > 0 && save < at && at < hand, 'after the save, before the hand-over check');
  const trader = find(/^\s*node council\/trader\.mjs data \|\| echo "Trader round/), mirror = find(/^\s*node council\/ctrader-mirror\.mjs data \|\| echo "cTrader mirror round/);
  assert.ok(trader > 0 && mirror > trader, 'the Trader and its mirror pass are where they were');
  assert.doesNotMatch(lines.slice(trader, mirror + 1).filter((l) => !/^\s*#/.test(l)).join('\n'), /replay/);
  // the quick pass (the minute steps) does not run it
  const quick = lines.slice(find(/for k in 1 2 3 4; do sleep 60/)).join('\n');
  assert.doesNotMatch(quick, /replay-due|ict-replay/);
  // the loop's token may dispatch, and holds nothing new
  assert.match(y, /^permissions:\n  contents: write\n  actions: write\n\njobs:/m);
  // the loop's own hand-over is untouched
  assert.match(y, /for a in 1 2 3; do gh workflow run council\.yml --ref main/);
});

test('ict-replay.yml: dispatchable, the cron kept as the second path, one run at a time, a dispatch is never a rebuild', () => {
  const y = rd('.github/workflows/ict-replay.yml');
  assert.match(y, /^on:\n  workflow_dispatch:\n/m); assert.match(y, /schedule:\n    - cron: '41 6 \* \* \*'/);
  assert.match(y, /concurrency:\n  group: ict-replay\n  cancel-in-progress: false/);
  assert.match(y, /rebuild:[\s\S]*?type: boolean\n        default: false/);
  assert.match(y, /ICT_REPLAY_REBUILD: \$\{\{ github\.event\.inputs\.rebuild == 'true' && 'on' \|\| 'off' \}\}/);
  assert.match(y, /^permissions:\n  contents: write\n/m); assert.doesNotMatch(y, /secrets\./);
  assert.match(y, /timeout-minutes: 40/);
});

test('data files health: an ICT replay over 36 h old is a named warning on the Data chip, over 4 days it pages', () => {
  const s = FILES.find((f) => f.file === 'ict/replay.json'), t = NOW / 1000;
  assert.equal(s.warn, 36 * 60); assert.equal(s.bad, 4 * 24 * 60); assert.ok(!s.need && !s.quiet && !s.clock, 'optional, wall clock, not silenced');
  assert.equal(freshness(s, t - 35 * 3600, t).sev, null);
  const w = freshness(s, t - 37 * 3600, t);
  assert.equal(w.sev, 'warn'); assert.match(w.detail, /^not updated for 37\.0 h \(expected daily .*flag after 36\.0 h\): unresolved replay records .* "update pending"/);
  assert.equal(freshness(s, t - 97 * 3600, t).sev, 'bad');
  assert.ok(36 > STALE_H + GAP_H, 'the warning comes only after the loop had its chance: 20 h, a retry 6 h later, a 40-minute run');
  const reader = (age) => ({ text: (f) => (f === 'ict/replay.json' ? JSON.stringify({ at: iso(NOW - age * H) }) : null), list: () => [] });
  const r = checkFiles(reader(40), t).files['ict/replay.json'];
  assert.equal(r.label, 'ICT replay'); assert.equal(r.status, 'warn'); assert.equal(r.issues[0].kind, 'stale');
  assert.equal(checkFiles(reader(10), t).files['ict/replay.json'].status, 'ok');
});
