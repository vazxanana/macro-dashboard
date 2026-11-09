// council-data sync for the council loop (reliability, 9 Nov 2026). Replaces the inline `git pull --rebase` / `git push` lines of
// council.yml and watchdog.yml, which the run logs showed failing every minute:
//   * "cannot pull with rebase: You have unstaged changes" (489 times in 5 runs, 8-9 Nov): the minute step commits
//     ctrader/account.json but ctrader-account.mjs also rewrites ctrader/accounts.json, so every later pull was refused and the
//     quick-pass Trader ran on a council-data copy that never took in the owner's edits or the live runner's heartbeat;
//   * a pull whose rebase stopped on a conflict was left half-done at the start of a round (no abort there), so the Trader read
//     files with conflict markers; the save's abort then left the clone diverged, every push was rejected for the rest of the run.
// Policy: the loop's working-tree changes ride along (autostash); on a conflict, the copy on council-data wins for that file
// (another writer or the owner touched it; the loop rebuilds its own files next round), the rest of the round is kept; a JSON
// file that does not parse is never committed (the last committed copy is restored). Never throws; exit code 0 unless the
// save could not be pushed (the loop ignores it either way).
//   node council/datasync.mjs <dir> pull
//   node council/datasync.mjs <dir> save "<commit message>" [path ...]      (no paths: everything)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const BRANCH = 'council-data';
const GIT_TIMEOUT = 120000;

// one git command in `dir` (2-minute cap, never prompts): { ok, out, err }
export function git(dir, args) {
  try {
    const out = execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: GIT_TIMEOUT, env: { ...process.env, GIT_EDITOR: 'true', GIT_TERMINAL_PROMPT: '0' } });
    return { ok: true, out: out.trim(), err: '' };
  } catch (e) {
    return { ok: false, out: String(e.stdout || '').trim(), err: String(e.stderr || e.message || e).trim() };
  }
}
const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const gitDir = (dir) => { const r = git(dir, ['rev-parse', '--git-dir']); return r.ok ? path.resolve(dir, r.out) : null; };
export const inRebase = (dir) => { const g = gitDir(dir); return !!g && (fs.existsSync(path.join(g, 'rebase-merge')) || fs.existsSync(path.join(g, 'rebase-apply'))); };

// leave no half-done rebase / merge / unmerged index behind (an earlier step may have died in one)
export function recover(dir, log = () => {}) {
  const g = gitDir(dir); if (!g) return false;
  let did = false;
  if (inRebase(dir)) { git(dir, ['rebase', '--abort']); did = true; log('datasync: aborted a rebase left in progress'); }
  if (fs.existsSync(path.join(g, 'MERGE_HEAD'))) { git(dir, ['merge', '--abort']); did = true; log('datasync: aborted a merge left in progress'); }
  const um = lines(git(dir, ['diff', '--name-only', '--diff-filter=U']).out);
  if (um.length) { git(dir, ['reset', '-q', '--merge']); for (const f of um) git(dir, ['checkout', '-q', 'HEAD', '--', f]); did = true; log(`datasync: reset unmerged ${um.join(', ')}`); }
  return did;
}

// JSON files that do not parse (paths relative to dir)
export function badJson(dir, files) {
  const bad = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const p = path.join(dir, f); if (!fs.existsSync(p)) continue;
    try { JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { bad.push(f); }
  }
  return bad;
}

// rebase the local commits onto origin/<branch>; a conflicting file takes the council-data copy. Returns { ok, dropped }.
export function rebaseOnto(dir, upstream, log = () => {}) {
  const dropped = new Set();
  let r = git(dir, ['rebase', '--autostash', upstream]);
  // an untracked file of ours that council-data now has too blocks the whole rebase (the autostash holds tracked files only):
  // the council-data copy wins, as for a conflict
  if (!r.ok && !inRebase(dir) && /untracked working tree files would be overwritten/.test(r.err)) {
    const m = r.err.split('\n').map((x) => x.match(/^\t(.+)$/)).filter(Boolean).map((x) => x[1].trim());
    for (const f of m) { fs.rmSync(path.join(dir, f), { force: true }); dropped.add(f); }
    if (m.length) r = git(dir, ['rebase', '--autostash', upstream]);
  }
  for (let guard = 0; !r.ok && inRebase(dir) && guard < 200; guard++) {
    const um = lines(git(dir, ['diff', '--name-only', '--diff-filter=U']).out);
    if (!um.length) { r = git(dir, ['rebase', '--skip']); continue; }   // nothing left of this commit
    for (const f of um) {
      // during a rebase "ours" is the branch being rebased onto (council-data as pushed)
      if (git(dir, ['checkout', '-q', '--ours', '--', f]).ok) git(dir, ['add', '--', f]);
      else { git(dir, ['rm', '-q', '--cached', '--ignore-unmatch', '--', f]); fs.rmSync(path.join(dir, f), { force: true }); }
      dropped.add(f);
    }
    r = git(dir, ['rebase', '--continue']);
    if (!r.ok && inRebase(dir) && !lines(git(dir, ['diff', '--name-only', '--diff-filter=U']).out).length) r = git(dir, ['rebase', '--skip']);
  }
  if (inRebase(dir)) { git(dir, ['rebase', '--abort']); return { ok: false, dropped: [...dropped], err: r.err }; }
  // the autostash (the loop's uncommitted files) clashed with council-data: git leaves those files with conflict markers and keeps
  // the stash. Conflicting files take the council-data copy, the rest of the stash stays applied (unstaged), the stash is dropped.
  const um = lines(git(dir, ['diff', '--name-only', '--diff-filter=U']).out);
  if (um.length) {
    for (const f of um) { if (!git(dir, ['checkout', '-q', 'HEAD', '--', f]).ok) { git(dir, ['rm', '-q', '--cached', '--ignore-unmatch', '--', f]); fs.rmSync(path.join(dir, f), { force: true }); } dropped.add(f); }
    git(dir, ['reset', '-q']);
    if (/autostash/.test(git(dir, ['stash', 'list', '-1']).out)) git(dir, ['stash', 'drop', '-q']);
  }
  if (dropped.size) log(`datasync: conflict, kept the council-data copy of ${[...dropped].join(', ')}`);
  return { ok: r.ok || !inRebase(dir), dropped: [...dropped] };
}

export function pull(dir, { branch = BRANCH, log = console.log } = {}) {
  recover(dir, log);
  const f = git(dir, ['fetch', '-q', 'origin', branch]);
  if (!f.ok) { log(`datasync: fetch failed: ${f.err.split('\n')[0]}`); return { ok: false }; }
  const r = rebaseOnto(dir, `origin/${branch}`, log);
  if (!r.ok) log(`datasync: could not rebase onto council-data (${String(r.err || '').split('\n')[0]}); working on the local copy`);
  return r;
}

// commit (paths, or everything), then up to `tries` times: fetch, rebase (conflict policy above), push
export function save(dir, message, { paths = [], branch = BRANCH, tries = 3, log = console.log, sleep = (s) => execFileSync('sleep', [String(s)]) } = {}) {
  recover(dir, log);
  for (const p of paths.length ? paths : ['.']) git(dir, ['add', '-A', '--', p]);   // one by one: a missing path skips only itself
  // never commit a JSON file that does not parse (a step killed mid-write): restore the last committed copy
  const staged = lines(git(dir, ['diff', '--cached', '--name-only', '--diff-filter=AM']).out), bad = badJson(dir, staged);
  for (const f of bad) {
    git(dir, ['reset', '-q', '--', f]);
    if (!git(dir, ['checkout', '-q', 'HEAD', '--', f]).ok) fs.rmSync(path.join(dir, f), { force: true });
  }
  if (bad.length) log(`datasync: not committed, invalid JSON restored: ${bad.join(', ')}`);
  let committed = false;
  if (!git(dir, ['diff', '--cached', '--quiet']).ok) committed = git(dir, ['commit', '-q', '-m', message]).ok;
  for (let i = 1; i <= tries; i++) {
    const f = git(dir, ['fetch', '-q', 'origin', branch]);
    if (f.ok) {
      const ahead = +git(dir, ['rev-list', '--count', `origin/${branch}..HEAD`]).out || 0;
      if (!ahead) return { ok: true, committed, pushed: false };
      rebaseOnto(dir, `origin/${branch}`, log);
      const changed = lines(git(dir, ['diff', '--name-only', `origin/${branch}`, 'HEAD']).out), bj = badJson(dir, changed);
      if (bj.length) {   // a clean text merge can still break a JSON file: take the council-data copy
        for (const x of bj) if (!git(dir, ['checkout', '-q', `origin/${branch}`, '--', x]).ok) git(dir, ['rm', '-q', '--', x]);
        git(dir, ['add', '--', ...bj]); git(dir, ['commit', '-q', '-m', `${message} (merge repair)`]);
        log(`datasync: merged JSON did not parse, kept the council-data copy of ${bj.join(', ')}`);
      }
      const p = git(dir, ['push', '-q', 'origin', `HEAD:${branch}`]);
      if (p.ok) return { ok: true, committed, pushed: true };
      log(`datasync: push ${i}/${tries} failed: ${p.err.split('\n').filter((x) => !/^hint:/.test(x))[0] || ''}`);
    } else log(`datasync: fetch ${i}/${tries} failed: ${f.err.split('\n')[0]}`);
    if (i < tries) sleep(5);
  }
  return { ok: false, committed, pushed: false };
}

if (process.argv[1] && process.argv[1].endsWith('datasync.mjs')) {
  const [dir = 'data', cmd = 'pull', msg = '', ...paths] = process.argv.slice(2);
  try {
    const r = cmd === 'save' ? save(dir, msg || `Council run ${new Date().toISOString().slice(0, 16)}Z`, { paths }) : pull(dir);
    process.exitCode = r.ok ? 0 : 1;
  } catch (e) { console.log('datasync failed:', (e && e.message) || e); process.exitCode = 1; }
}
