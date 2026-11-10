// node --test tests/apply-workflow.test.mjs — the locks between an applied ICT change and main, outside the connector:
// the two workflow files (read as text), main's verifier scripts/ict-apply-check.mjs against temporary git repositories, the
// merge script scripts/ict-apply-merge.mjs against a fake GitHub, the one shared allowlist (api/_ictrules.js), and the stop
// guard biting on a broken tracker. The path ships SWITCHED OFF: council/ict-apply.json is empty and every branch is refused.
// This file is deliberately not named tests/ict-*: a change to the ICT edge cannot edit it. No network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { fakeFetch } from './fixtures/mcp-fake.mjs';
import { checkRepo, checkApiFiles, checkBranch, readMembers } from '../scripts/ict-apply-check.mjs';
import { handle, sweep, makeGh, mark, VERIFY } from '../scripts/ict-apply-merge.mjs';
const require = createRequire(import.meta.url);
const RULES = require('../api/_ictrules.js'), MCP = require('../api/mcp.js').lib;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const REPO = 'vazxanana/macro-dashboard', J = (v, status = 200) => new Response(JSON.stringify(v), { status });

// ---- one allowlist ----
const OK = ['ict/tracker.mjs', '.claude/skills/ICT/SKILL.md', 'tests/ict-roll.test.mjs', 'tests/fixtures/ict/trades.json', 'research/ict/notes.md', 'research/edge/ict-exits-replay/run.mjs'];
const NO = ['council/trader.mjs', 'council/ict-apply.json', 'api/mcp.js', 'api/_ictrules.js', '.github/workflows/ict-apply.yml', '.github/workflows/ict-apply-merge.yml', 'scripts/ict-apply-check.mjs', 'scripts/ict-apply-merge.mjs', 'scripts/build.sh',
  'tests/desk-ict-guard.test.mjs', 'tests/mcp-apply.test.mjs', 'tests/apply-workflow.test.mjs', 'tests/mcp.test.mjs', 'tests/fixtures/mcp-fake.mjs', 'package.json', 'vercel.json', 'market-structure.html', 'out/index.html', 'ict/../api/x.js', 'ict/sub/x.mjs', 'ict/apply-members.json', 'CLAUDE.md', 'docs/fred-mcp.md'];
test('the two allowlists are one: the connector and the verifier use api/_ictrules.js and hold no list of their own', () => {
  assert.equal(MCP.okPath, RULES.okPath, 'the connector checks paths with the shared function');
  for (const p of OK) assert.ok(RULES.okPath(p), p); for (const p of NO) assert.ok(!RULES.okPath(p), p);
  assert.equal(RULES.ALLOW.length, OK.length, 'one sample for every allowlist entry: a new entry needs a sample here and a paths line in ict-apply.yml');
  const mcp = rd('api/mcp.js'), chk = rd('scripts/ict-apply-check.mjs'), mrg = rd('scripts/ict-apply-merge.mjs');
  for (const [name, src] of [['api/mcp.js', mcp], ['scripts/ict-apply-check.mjs', chk], ['scripts/ict-apply-merge.mjs', mrg]]) {
    assert.match(src, /_ictrules\.js/, `${name} loads the shared rules`);
    assert.ok(!/\bALLOW\s*=|\bRISKY\s*=/.test(src), `${name} defines no allowlist or risky list of its own`);
    assert.ok(!src.includes('skills\\/ICT') && !src.includes('^ict\\/[^/]+\\.mjs$/,'), `${name} carries no path pattern of the allowlist`);
  }
  assert.match(mcp, /const \{[^}]*okPath[^}]*riskyAdded[^}]*\} = require\('\.\/_ictrules\.js'\)/);
  // the rules module stays self-contained: the merge workflow downloads it alone
  assert.ok(!/\brequire\s*\(|^\s*import\s/m.test(rd('api/_ictrules.js')), 'api/_ictrules.js imports nothing');
  // the list of who may apply is outside the allowlist, so a change cannot add its own author; and it ships empty
  assert.equal(RULES.MEMBERS_FILE, 'council/ict-apply.json'); assert.ok(!RULES.okPath(RULES.MEMBERS_FILE));
  assert.deepEqual(JSON.parse(rd(RULES.MEMBERS_FILE)).members, []);
  assert.deepEqual(RULES.membersOf('{"members":["fred","Owner!","owner",7,"orlando"]}'), ['fred', 'orlando']); assert.deepEqual(RULES.membersOf('{broken'), []); assert.deepEqual(RULES.membersOf({ members: 'fred' }), []); assert.deepEqual(RULES.membersOf(null), []);
});
test('apply branches: mcp/<member>/apply-<time>-<slug>, never a proposal branch, never the owner', () => {
  assert.equal(RULES.applyMember('mcp/fred/apply-mhx12abc-tighter-swing'), 'fred'); assert.equal(RULES.applyMember('mcp/fred/apply-mhx12abc-revert-7'), 'fred');
  for (const b of ['mcp/fred/mhx12abc-tighter-swing', 'mcp/fred/apply-', 'mcp/fred/apply-x-', 'mcp/fred/apply-X', 'mcp/owner/apply-x', 'mcp/fred/x/apply-y', 'mcp//apply-x', 'fred/apply-x', 'refs/heads/mcp/fred/apply-x', 'mcp/fred/apply-x y', '', null, 42, `mcp/fred/apply-${'a'.repeat(200)}`]) assert.equal(RULES.applyMember(b), null, String(b));
  assert.deepEqual(checkBranch('mcp/fred/apply-a-b', ['fred']), { who: 'fred', problems: [] });
  assert.match(checkBranch('mcp/fred/apply-a-b', []).problems[0], /fred is not in council\/ict-apply\.json on main/);
  assert.match(checkBranch('mcp/orlando/apply-a-b', ['fred']).problems[0], /orlando is not in/); assert.match(checkBranch('feature/x', ['fred']).problems[0], /not an apply branch/);
});

// ---- the workflow files, as text ----
const WF = rd('.github/workflows/ict-apply.yml'), WM = rd('.github/workflows/ict-apply-merge.yml'), TESTS = rd('.github/workflows/tests.yml');
const code = (y) => y.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');   // without whole-line comments
// every script of a workflow: the text of each `run:` (one line, or an indented block)
function runs(y) {
  const L = y.split('\n'), out = [];
  for (let i = 0; i < L.length; i++) { const m = /^(\s*)(?:- )?run:\s*(.*)$/.exec(L[i]); if (!m) continue;
    if (!/^[|>][+-]?$/.test(m[2].trim())) { out.push(m[2]); continue; }
    const ind = m[1].length, body = []; while (i + 1 < L.length && (L[i + 1].trim() === '' || L[i + 1].search(/\S/) > ind)) body.push(L[++i]); out.push(body.join('\n')); }
  return out;
}
test('ict-apply.yml: runs on pull requests onto main, only for a branch of this repository named mcp/…/apply-…', () => {
  const y = code(WF);
  assert.match(y, /^on:\n  pull_request:\n    types: \[opened, synchronize, reopened\]\n    branches: \[main\]\n    paths:/m);
  for (const t of ['pull_request_target', 'workflow_run', 'workflow_dispatch', 'push:', 'schedule:', 'issue_comment']) assert.ok(!y.includes(t), `no ${t} trigger`);
  const cond = /\n    if: >-\n((?:      .+\n)+)/.exec(y)[1];
  for (const c of ['github.event.pull_request.head.repo.full_name == github.repository', "github.event.pull_request.base.ref == 'main'", "startsWith(github.event.pull_request.head.ref, 'mcp/')", "contains(github.event.pull_request.head.ref, '/apply-')"]) assert.ok(cond.includes(c), c);
  assert.ok(!cond.includes('||'), 'every condition must hold');
  // the paths filter covers every allowlist entry (a filter only; the verifier is the lock)
  const globs = [...y.matchAll(/^      - '([^']+)'$/gm)].map((m) => m[1]); assert.equal(globs.length, RULES.ALLOW.length);
  for (const p of OK) assert.ok(globs.some((g) => p.startsWith(g.split('*')[0])), `a paths line covers ${p}`);
});
test('ict-apply.yml: the checks job can only read, uses no secret, and runs main\'s verifier before any pull request code', () => {
  const y = code(WF);
  assert.deepEqual([...y.matchAll(/^\s*([a-z-]+): (read|write|none)\s*$/gm)].map((m) => `${m[1]}: ${m[2]}`), ['contents: read', 'contents: read'], 'contents: read for the file and the job, nothing else');
  assert.ok(!/\bwrite\b/.test(y), 'no write permission anywhere'); assert.ok(!/secrets\./.test(y), 'no secret'); assert.ok(!/github\.token|GITHUB_TOKEN|GH_TOKEN/.test(y), 'the token is never handed to a step');
  assert.deepEqual([...y.matchAll(/^  ([a-z_-]+):\n(?:    .*\n)*?    runs-on:/gm)].map((m) => m[1]), ['verify'], 'one job; the merge lives in ict-apply-merge.yml');
  assert.equal((y.match(/uses: actions\/checkout@v4/g) || []).length, 2); assert.equal((y.match(/persist-credentials: false/g) || []).length, 2, 'no credentials left on disk');
  assert.match(y, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}\n\s+path: base\n/); assert.match(y, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}\n\s+path: pr\n/);
  const R = runs(y), iVerify = R.findIndex((r) => r.includes('ict-apply-check.mjs')), iGuard = R.findIndex((r) => r.includes('desk-ict-guard.test.mjs'));
  assert.equal(iVerify, 0, 'the verifier is the first script of the job');
  assert.match(R[iVerify], /^node base\/scripts\/ict-apply-check\.mjs --repo pr --base "\$\(git -C base rev-parse HEAD\)" --head "\$HEAD_SHA" --branch "\$HEAD_REF"$/, 'main\'s copy, never the pull request\'s');
  assert.ok(!R.some((r) => /node (pr\/)?scripts\/ict-apply|node \.\/scripts\/ict-apply/.test(r)));
  assert.equal(R[iGuard], 'node --test base/tests/desk-ict-guard.test.mjs', 'the stop guard runs from main\'s copy'); assert.match(y, /ICT_GUARD_ROOT: \$\{\{ github\.workspace \}\}\/pr/);
  // pull request code (anything with working-directory: pr, or the guard that imports it) runs only after the verifier
  const steps = y.split(/\n      - /).slice(1), firstPr = steps.findIndex((s) => /working-directory: pr|desk-ict-guard/.test(s)), verifyStep = steps.findIndex((s) => s.includes('ict-apply-check.mjs'));
  assert.ok(verifyStep >= 0 && verifyStep < firstPr);
  // the same suite tests.yml runs, plus the build check
  for (const r of runs(code(TESTS))) assert.ok(R.includes(r), `runs what tests.yml runs: ${r.slice(0, 60)}`);
  assert.ok(R.some((r) => r.includes('sh scripts/build.sh') && r.includes('git status --porcelain -- out/')));
});
test('workflow hygiene: no ${{ … }} inside any script of either workflow; pull request text only arrives through env', () => {
  for (const [name, y] of [['ict-apply.yml', code(WF)], ['ict-apply-merge.yml', code(WM)]]) {
    const R = runs(y); assert.ok(R.length >= 2, name);
    for (const r of R) assert.ok(!r.includes('${{'), `${name}: an expression inside a script: ${r.slice(0, 80)}`);
    for (const ex of [...y.matchAll(/\$\{\{([^}]+)\}\}/g)].map((m) => m[1].trim())) assert.ok(!/\.(title|body|label|name|message|email|login)\b/.test(ex) && !/head_commit|head_branch/.test(ex), `${name}: ${ex} is text a pull request controls`);
  }
  assert.match(code(WF), /env:\n\s+HEAD_REF: \$\{\{ github\.event\.pull_request\.head\.ref \}\}\n\s+HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}\n\s+run: node base/);
});
test('ict-apply-merge.yml: main\'s definition (workflow_run), no checkout, exactly the permissions the merge needs, one at a time', () => {
  const y = code(WM), name = /^name: (.+)$/m.exec(WF)[1];
  assert.match(y, new RegExp(`^on:\\n  workflow_run:\\n    workflows: \\[${name}\\]\\n    types: \\[completed\\]\\n  workflow_dispatch:\\n`, 'm'));
  for (const t of ['pull_request', 'push:', 'schedule:', 'issue_comment']) assert.ok(!y.includes(t) || t === 'pull_request' && !/^\s*pull_request(_target)?:/m.test(y), `no ${t} trigger`);
  assert.ok(!/^\s*pull_request(_target)?:/m.test(y), 'never triggered by a pull request event: its file would be the pull request\'s');
  assert.ok(!/actions\/checkout|git clone|git fetch|git checkout|git pull/.test(y), 'no checkout: this job never holds pull request code');
  assert.match(y, /^permissions: \{\}$/m, 'nothing by default');
  assert.deepEqual([...y.matchAll(/^\s*([a-z-]+): (read|write)\b/gm)].map((m) => `${m[1]}: ${m[2]}`), ['contents: write', 'pull-requests: write', 'actions: write']);
  assert.match(y, /concurrency:\n\s+group: ict-apply\n\s+cancel-in-progress: false/);
  assert.ok(!/secrets\./.test(y), 'only the workflow token');
  const R = runs(y);
  assert.match(R[0], /for f in scripts\/ict-apply-merge\.mjs scripts\/ict-apply-check\.mjs api\/_ictrules\.js council\/ict-apply\.json; do/); assert.match(R[0], /contents\/\$f\?ref=\$GITHUB_SHA"/, 'main\'s files (GITHUB_SHA of a workflow_run is main)');
  assert.equal(R[1], 'node "$RUNNER_TEMP/trusted/scripts/ict-apply-merge.mjs"');
  assert.equal(VERIFY, 'ict-apply.yml'); assert.ok(fs.existsSync(path.join(ROOT, '.github/workflows', VERIFY)));
  assert.match(rd('.github/workflows/ict-replay.yml'), /workflow_dispatch:/, 'the replay can be dispatched after a merge');
});

// ---- main's verifier against temporary git repositories ----
const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const TMP = [];
function repoWith(base) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ict-apply-test-')); TMP.push(d);
  execFileSync('git', ['init', '-q', '-b', 'main', d]);
  const write = (files) => { for (const [p, c] of Object.entries(files)) { const f = path.join(d, p); if (c === null) { fs.rmSync(f); continue; } fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); } };
  const commit = (files, msg = 'c') => { write(files); git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', msg); return git(d, 'rev-parse', 'HEAD'); };
  const mainSha = commit(base, 'base');
  return { d, mainSha, commit, branch: (name, files) => { git(d, 'checkout', '-q', '-b', name, mainSha); const sha = commit(files, 'change'); git(d, 'checkout', '-q', 'main'); return sha; } };
}
const BASE = { 'ict/tracker.mjs': 'export const P = { piv: 3 };\nexport const f = () => fetch("x");\n', 'tests/ict-a.test.mjs': "import test from 'node:test';\ntest('a', () => {});\n", 'council/trader.mjs': 'export const x = 1;\n',
  'council/ict-apply.json': '{"members":[]}\n', '.github/workflows/tests.yml': 'name: Tests\n', 'scripts/build.sh': 'echo\n', 'api/mcp.js': 'module.exports = 1;\n', 'package.json': '{}\n', 'market-structure.html': '<html></html>\n', 'tests/desk-ict-guard.test.mjs': '// guard\n' };
const CHANGE = { 'ict/tracker.mjs': 'export const P = { piv: 2 };\nexport const f = () => fetch("x");\n', 'tests/ict-piv.test.mjs': "import test from 'node:test';\ntest('piv', () => {});\n", 'research/ict/note.md': '# note\n' };
const BR = 'mcp/fred/apply-abc-tighter-swing';
const verify = (files, o = {}) => { const r = repoWith(o.base || BASE), head = r.branch(o.branch || BR, files); if (o.mainMoves) r.commit(o.mainMoves, 'main moves');
  return checkRepo({ repo: r.d, base: git(r.d, 'rev-parse', 'main'), head, branch: o.branch || BR, members: o.members || ['fred'] }); };
test.after(() => { for (const d of TMP) fs.rmSync(d, { recursive: true, force: true }); });
test('verifier: an allowed change by a listed member passes; with the committed (empty) list it is refused', () => {
  const ok = verify(CHANGE); assert.deepEqual(ok.problems, []); assert.equal(ok.ok, true); assert.equal(ok.who, 'fred');
  assert.deepEqual(ok.files.map((f) => `${f.path} ${f.status}`), ['ict/tracker.mjs changed', 'research/ict/note.md new', 'tests/ict-piv.test.mjs new']);
  const off = verify(CHANGE, { members: readMembers() }); assert.equal(off.ok, false); assert.match(off.problems.join('\n'), /fred is not in council\/ict-apply\.json on main/);
  // a deletion inside the allowlist (a revert removes the test it added), and main moving on elsewhere, are fine
  assert.equal(verify({ 'tests/ict-a.test.mjs': null }).ok, true);
  assert.equal(verify(CHANGE, { mainMoves: { 'council/trader.mjs': 'export const x = 2;\n', 'market-structure.html': '<html>2</html>\n' } }).ok, true, 'only the pull request\'s own changes count (merge base ... head)');
});
test('verifier: refuses a member who is not listed, a branch that is not an apply branch, and anything outside the ICT edge', () => {
  const bad = (files, re, o) => { const r = verify(files, o); assert.equal(r.ok, false, JSON.stringify(Object.keys(files))); assert.match(r.problems.join('\n'), re); return r; };
  bad(CHANGE, /orlando is not in council\/ict-apply\.json/, { branch: 'mcp/orlando/apply-abc-x' });
  bad(CHANGE, /not an apply branch/, { branch: 'mcp/fred/abc-a-proposal' }); bad(CHANGE, /not an apply branch/, { branch: 'feature/ict' });
  bad({ ...CHANGE, 'council/trader.mjs': 'export const x = 9;\n' }, /council\/trader\.mjs is the council: an applied change may touch the ICT edge only/);
  bad({ ...CHANGE, 'council/ict-apply.json': '{"members":["fred"]}\n' }, /council\/ict-apply\.json is the council/, { members: [] });
  bad({ ...CHANGE, '.github/workflows/tests.yml': 'name: x\n' }, /\.github\/workflows\/tests\.yml is a workflow or GitHub setting/);
  bad({ ...CHANGE, '.github/workflows/new.yml': 'on: push\n' }, /is a workflow or GitHub setting/);
  bad({ ...CHANGE, 'scripts/build.sh': 'curl evil\n' }, /scripts\/build\.sh is a script/);
  bad({ ...CHANGE, 'api/mcp.js': 'module.exports = 2;\n' }, /api\/mcp\.js is the API/);
  bad({ ...CHANGE, 'package.json': '{"scripts":{}}\n' }, /package\.json is the project configuration/);
  bad({ ...CHANGE, 'market-structure.html': '<html>x</html>\n' }, /market-structure\.html is a page or page asset/);
  bad({ ...CHANGE, 'tests/desk-ict-guard.test.mjs': '// nothing\n' }, /tests\/desk-ict-guard\.test\.mjs is a test outside tests\/ict-\*/);
  bad({ ...CHANGE, 'tests/other.test.mjs': '// x\n' }, /is a test outside tests\/ict-\*/);
  bad({ ...CHANGE, 'ict/sub/x.mjs': 'export {};\n' }, /ict\/sub\/x\.mjs is outside the ICT edge/);
  bad({ 'council/trader.mjs': null }, /council\/trader\.mjs is the council/);
});
test('verifier: refuses new network / environment / process access, an oversize file, a symlink, an executable, broken syntax, too many files', () => {
  const bad = (files, re) => { const r = verify(files); assert.equal(r.ok, false); assert.match(r.problems.join('\n'), re); };
  bad({ 'ict/tracker.mjs': BASE['ict/tracker.mjs'] + 'fetch("https://evil.example");\n' }, /ict\/tracker\.mjs adds network access/);
  bad({ 'ict/tracker.mjs': BASE['ict/tracker.mjs'] + 'const k = process.env.GH_TOKEN;\n' }, /adds process\.env/);
  bad({ 'ict/new.mjs': "import { execSync } from 'node:child_process';\n" }, /ict\/new\.mjs adds child_process/);
  bad({ 'tests/ict-x.test.mjs': 'eval("1");\n' }, /adds eval/);
  bad({ 'ict/new.mjs': "import { x } from '../council/ctrader-mirror.mjs';\n" }, /adds an import from api\/ or council\//);
  assert.equal(verify({ 'ict/tracker.mjs': 'export const P = { piv: 2 };\nexport const f = () => fetch("y");\n' }).ok, true, 'what main already has may stay');
  bad({ 'research/ict/big.md': 'x'.repeat(200001) }, /research\/ict\/big\.md is over 200 KB/);
  bad({ 'research/ict/a.md': 'a'.repeat(150000), 'research/ict/b.md': 'b'.repeat(150000), 'research/ict/c.md': 'c'.repeat(150000) }, /over 400 KB in total/);
  bad({ 'ict/tracker.mjs': 'export const P = { piv: 2 ;\n' }, /ict\/tracker\.mjs has a syntax error/);
  bad({ 'tests/fixtures/ict/x.json': '{bad' }, /is not valid JSON/);
  bad(Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`research/ict/n${i}.md`, `${i}\n`])), /13 files: at most 12/);
  // a symlink and an executable file, committed by hand (the connector cannot make either)
  const r = repoWith(BASE); git(r.d, 'checkout', '-q', '-b', BR, r.mainSha); fs.symlinkSync('../api/mcp.js', path.join(r.d, 'ict/link.mjs')); fs.writeFileSync(path.join(r.d, 'ict/run.mjs'), 'export {};\n'); fs.chmodSync(path.join(r.d, 'ict/run.mjs'), 0o755);
  git(r.d, 'add', '-A'); git(r.d, 'commit', '-q', '-m', 'x'); const out = checkRepo({ repo: r.d, base: r.mainSha, head: git(r.d, 'rev-parse', 'HEAD'), branch: BR, members: ['fred'] });
  assert.match(out.problems.join('\n'), /ict\/link\.mjs: only plain files \(mode 100644, not 120000\)/); assert.match(out.problems.join('\n'), /ict\/run\.mjs: only plain files \(mode 100644, not 100755\)/);
});
test('verifier, as the workflow starts it: exit 1 and REFUSED lines with the committed empty list; it never runs the change', () => {
  const r = repoWith(BASE), head = r.branch(BR, { ...CHANGE, 'ict/boom.mjs': "import fs from 'node:fs';\nfs.writeFileSync('PWNED', 'x');\nexport {};\n" });
  const run = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'scripts/ict-apply-check.mjs'), ...a], { encoding: 'utf8' });
  const o = run('--repo', r.d, '--base', r.mainSha, '--head', head, '--branch', BR);
  assert.equal(o.status, 1); assert.match(o.stdout, /REFUSED: fred is not in council\/ict-apply\.json on main/); assert.match(o.stdout, /this change is not applied/);
  assert.ok(!fs.existsSync(path.join(r.d, 'PWNED')) && !fs.existsSync('PWNED'), 'the change is read, never run');
  assert.equal(run('--repo', r.d).status, 2, 'missing arguments: it could not run');
  assert.equal(run('--repo', r.d, '--base', r.mainSha, '--head', 'nope', '--branch', BR).status, 2);
  const f = path.join(r.d, 'files.json'); fs.writeFileSync(f, JSON.stringify([{ filename: 'ict/tracker.mjs', status: 'modified' }]));
  const a = run('--api-files', f, '--branch', BR); assert.equal(a.status, 1); assert.match(a.stdout, /REFUSED: fred is not in/);
});
test('verifier, API mode: branch, member, paths and the file count again, on main\'s rules', () => {
  const F = (...names) => names.map((n) => ({ filename: n, status: 'modified' }));
  assert.equal(checkApiFiles(F('ict/tracker.mjs', 'tests/ict-a.test.mjs'), BR, ['fred']).ok, true);
  assert.equal(checkApiFiles(F('ict/tracker.mjs'), BR, []).ok, false, 'an empty list refuses everything');
  assert.match(checkApiFiles(F('ict/tracker.mjs', '.github/workflows/ict-apply.yml'), BR, ['fred']).problems.join(), /ict-apply\.yml is a workflow or GitHub setting/);
  assert.match(checkApiFiles([{ filename: 'ict/tracker.mjs', previous_filename: 'api/mcp.js', status: 'renamed' }], BR, ['fred']).problems.join(), /api\/mcp\.js is the API/, 'both names of a rename');
  assert.match(checkApiFiles([], BR, ['fred']).problems.join(), /lists no files/); assert.match(checkApiFiles(null, BR, ['fred']).problems.join(), /lists no files/);
  assert.match(checkApiFiles(F(...Array.from({ length: 13 }, (_, i) => `research/ict/n${i}.md`)), BR, ['fred']).problems.join(), /13 files: at most 12/);
  assert.match(checkApiFiles(F('ict/tracker.mjs'), 'mcp/fred/x-proposal', ['fred']).problems.join(), /not an apply branch/);
});

// ---- the merge script against a fake GitHub ----
const PR = (o = {}) => ({ number: 7, state: 'open', draft: false, title: 'ICT (fred, applied): Tighter swing', changed_files: 2, mergeable: true, ...o, head: { sha: 'c1', ref: BR, repo: { full_name: REPO }, ...(o.head || {}) }, base: { ref: 'main', sha: 'base1', ...(o.base || {}) } });
const RUN = (o = {}) => ({ id: 31, head_sha: 'c1', status: 'completed', conclusion: 'success', path: '.github/workflows/ict-apply.yml', created_at: '2026-11-10T10:00:00Z', html_url: 'https://github.com/x/actions/runs/31', ...o });
function world(o = {}) {
  const did = { comments: [], merges: [], dispatches: [] }, pr = o.pr || PR(), comments = [...(o.comments || [])];
  const routes = [['GET', /^\/pulls\?state=open&base=main/, () => J(o.list || [pr])], ['GET', /^\/pulls\/(\d+)$/, () => J(pr)],
    ['GET', /^\/issues\/7\/comments/, () => J(comments)], ['POST', /^\/issues\/7\/comments$/, (m, b) => { did.comments.push(b.body); comments.push({ body: b.body }); return J({}, 201); }],
    ['GET', /^\/actions\/workflows\/ict-apply\.yml\/runs\?head_sha=([a-z0-9]+)&event=pull_request/, (m) => J({ workflow_runs: (o.runs || [RUN()]).filter((r) => r.head_sha === m[1] || o.wrongRuns) })],
    ['GET', /^\/actions\/runs\/31\/jobs/, () => J({ jobs: [{ name: 'ICT apply checks', conclusion: 'failure', steps: [{ name: 'Check out main (trusted copy)', conclusion: 'success' }, { name: 'Unit tests (tests/)', conclusion: 'failure' }] }] })],
    ['GET', /^\/pulls\/7\/files/, () => J(o.files || [{ filename: 'ict/tracker.mjs', status: 'modified' }, { filename: 'tests/ict-piv.test.mjs', status: 'added' }])],
    ['GET', /^\/compare\/base1\.\.\.main$/, () => (o.compare === 404 ? J({}, 404) : J({ files: o.compare || [] }))],
    ['PUT', /^\/pulls\/7\/merge$/, (m, b) => { did.merges.push(b); const r = (o.merge || [])[did.merges.length - 1]; return r ? J({ message: r[1] }, r[0]) : J({ merged: true, sha: 'm1' }); }],
    ['POST', /^\/actions\/workflows\/ict-replay\.yml\/dispatches$/, (m, b) => { did.dispatches.push(b); return new Response(null, { status: o.dispatch || 204 }); }]];
  const net = fakeFetch({ routes }), io = { gh: makeGh({ repo: REPO, token: 'ghs_secret', fetchFn: net }), repo: REPO, members: o.members || ['fred'], sleep: async () => {}, waitTries: 2, runUrl: 'https://github.com/x/actions/runs/99' };
  return { did, net, io };
}
test('merge script: merges an applied change only after its checks passed for exactly its head commit; squash, bound to that commit', async () => {
  const w = world(), out = await handle(7, w.io);
  assert.deepEqual(out, { number: 7, result: 'merged', who: 'fred', replay: 'dispatched' });
  assert.equal(w.did.merges.length, 1); assert.equal(w.did.merges[0].merge_method, 'squash'); assert.equal(w.did.merges[0].sha, 'c1'); assert.equal(w.did.merges[0].commit_title, 'ICT (fred, applied): Tighter swing (#7)');
  assert.deepEqual(w.did.dispatches, [{ ref: 'main' }]); assert.deepEqual(w.did.comments, [], 'no comment on a merge');
  assert.ok(w.net.calls.every((c) => !c.url.includes('ghs_secret')), 'the token travels in a header only');
  // research files only: nothing to replay
  const r = world({ files: [{ filename: 'research/ict/note.md', status: 'added' }], pr: PR({ changed_files: 1 }) }); assert.equal((await handle(7, r.io)).replay, 'not needed'); assert.deepEqual(r.did.dispatches, []);
  // the head moved since the checks: the only passed run is for another commit -> nothing happens (the new commit gets its own run)
  const moved = world({ pr: PR({ head: { sha: 'c2' } }) }), o2 = await handle(7, moved.io);
  assert.equal(o2.result, 'skipped'); assert.match(o2.reason, /no checks for this commit yet/); assert.deepEqual(moved.did.merges, []); assert.deepEqual(moved.did.comments, []);
  // even if GitHub handed back a run of another commit, it is not taken
  const wrong = world({ pr: PR({ head: { sha: 'c2' } }), wrongRuns: true }); assert.equal((await handle(7, wrong.io)).result, 'skipped'); assert.deepEqual(wrong.did.merges, []);
  // the branch moves during the merge call: GitHub refuses the named commit (409); left alone
  const race = world({ merge: [[409, 'Head branch was modified. Review and try the merge again.']] }); assert.equal((await handle(7, race.io)).result, 'skipped'); assert.deepEqual(race.did.comments, []);
  // checks still running, or cancelled: wait
  for (const run of [RUN({ status: 'in_progress', conclusion: null }), RUN({ conclusion: 'cancelled' }), RUN({ conclusion: 'skipped' })]) { const x = world({ runs: [run] }); assert.equal((await handle(7, x.io)).result, 'skipped'); assert.deepEqual(x.did.merges, []); assert.deepEqual(x.did.comments, []); }
  // the newest run for the commit decides
  const rerun = world({ runs: [RUN({ created_at: '2026-11-10T09:00:00Z' }), RUN({ id: 31, conclusion: 'failure', created_at: '2026-11-10T11:00:00Z' })] }); assert.equal((await handle(7, rerun.io)).result, 'refused');
});
test('merge script: every refusal is one comment with the reason, no merge, and the pull request stays open', async () => {
  const refused = async (o, re) => { const w = world(o), out = await handle(7, w.io); assert.equal(out.result, 'refused', JSON.stringify(out)); assert.deepEqual(w.did.merges.filter((m, i) => !(o.merge && o.merge[i])), [], 'never merged'); assert.deepEqual(w.did.dispatches, []);
    assert.equal(w.did.comments.length, 1); assert.ok(w.did.comments[0].startsWith(`${mark('c1')}\n**Not applied.** `)); assert.match(w.did.comments[0], re); assert.match(w.did.comments[0], /Nothing changed on the desk\. This pull request stays open for the owner\./); return w; };
  await refused({ members: [] }, /fred is not in council\/ict-apply\.json on main/);                                  // the committed default: off
  await refused({ members: ['orlando'] }, /fred is not in council\/ict-apply\.json/);
  await refused({ runs: [RUN({ conclusion: 'failure' })] }, /The apply checks failed at the step "Unit tests \(tests\/\)"\. See the run/);
  await refused({ runs: [RUN({ conclusion: 'timed_out' })] }, /The apply checks failed/);
  await refused({ pr: PR({ draft: true }) }, /It is a draft/);
  await refused({ files: [{ filename: 'ict/tracker.mjs' }, { filename: '.github/workflows/ict-apply.yml' }] }, /ict-apply\.yml is a workflow or GitHub setting/);
  await refused({ files: [{ filename: 'ict/tracker.mjs' }, { filename: 'council/ict-apply.json' }] }, /council\/ict-apply\.json is the council/);
  await refused({ files: [{ filename: 'ict/tracker.mjs' }] }, /file list could not be read in full/);                 // 1 listed, 2 changed
  await refused({ compare: [{ filename: 'api/mcp.js' }, { filename: 'ict/replay.mjs' }] }, /The ICT files on main changed after this change was made \(ict\/replay\.mjs\)/);
  await refused({ compare: Array.from({ length: 300 }, (_, i) => ({ filename: `docs/${i}.md` })) }, /Main moved too far/);
  await refused({ compare: 404 }, /Main moved too far/);
  await refused({ merge: [[405, 'Pull Request is not mergeable']] }, /GitHub did not merge it \(405\): Pull Request is not mergeable/);
  await refused({ merge: [[403, 'Resource not accessible by integration']] }, /GitHub did not merge it \(403\)/);
  await refused({ runs: [], pr: PR({ mergeable: false }) }, /conflicts with main/);
  // branch protection still waiting for another required check: it tries again, then merges; or gives up with the reason
  const wait = world({ merge: [[405, 'Required status check "test" is expected.'], [405, 'Required status check "test" is in progress.']] }); assert.equal((await handle(7, wait.io)).result, 'merged'); assert.equal(wait.did.merges.length, 3);
  const w = await refused({ merge: [[405, 'Required status check "test" is expected.'], [405, 'Required status check "test" is expected.'], [405, 'Required status check "test" is expected.']] }, /Required status check/); assert.equal(w.did.merges.length, 3);
});
test('merge script: comments once per commit; never touches a fork, another base, a proposal or a closed pull request', async () => {
  const w = world({ runs: [RUN({ conclusion: 'failure' })] });
  assert.equal((await handle(7, w.io)).result, 'refused'); const again = await handle(7, w.io); assert.equal(again.result, 'skipped'); assert.match(again.reason, /already answered/); assert.equal(w.did.comments.length, 1, 'one comment');
  for (const [pr, re] of [[PR({ head: { repo: { full_name: 'evil/fork' } } }), /fork/], [PR({ head: { repo: null } }), /fork/], [PR({ base: { ref: 'council-data' } }), /not an applied change onto main/], [PR({ head: { ref: 'mcp/fred/abc-proposal' } }), /not an applied change/],
    [PR({ state: 'closed' }), /not open/], [PR({ merged: true }), /not open/]]) { const x = world({ pr }), o = await handle(7, x.io); assert.equal(o.result, 'skipped'); assert.match(o.reason, re); assert.deepEqual(x.did.merges, []); assert.deepEqual(x.did.comments, []); }
});
test('merge script: the sweep looks only at open applied changes of this repository; one failing never stops the rest', async () => {
  const other = (n, ref, repo = REPO) => ({ number: n, head: { ref, sha: 'x', repo: { full_name: repo } } });
  const w = world({ list: [other(3, 'feature/some-work'), other(4, 'mcp/fred/abc-proposal'), other(5, BR, 'evil/fork'), PR()] });
  assert.deepEqual((await sweep(w.io)).map((x) => `${x.number} ${x.result}`), ['7 merged']);
  const none = world({ list: [] }); assert.deepEqual(await sweep(none.io), []);
  const boom = world(); boom.io.gh = async (u, o) => { if (/^\/pulls\/7$/.test(u)) throw new Error('GitHub 500 Bearer ghs_secret'); return makeGh({ repo: REPO, token: 't', fetchFn: boom.net })(u, o); };
  const out = await sweep(boom.io); assert.equal(out[0].result, 'error'); assert.ok(!out[0].reason.includes('ghs_secret'), 'no token in a reason');
});

// ---- the stop guard bites ----
function guardOn(mutate) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ict-guard-test-')); TMP.push(d); fs.mkdirSync(path.join(d, 'ict')); fs.mkdirSync(path.join(d, 'council'));
  for (const f of fs.readdirSync(path.join(ROOT, 'ict'))) fs.copyFileSync(path.join(ROOT, 'ict', f), path.join(d, 'ict', f));
  for (const f of ['events.mjs', 'engine.mjs']) fs.copyFileSync(path.join(ROOT, 'council', f), path.join(d, 'council', f));
  mutate(d, (f, from, to) => { const p = path.join(d, 'ict', f), s = fs.readFileSync(p, 'utf8'); assert.ok(s.includes(from), `the tracker still holds: ${from}`); fs.writeFileSync(p, s.replace(from, to)); });
  const { NODE_TEST_CONTEXT, ...env } = process.env;   // a test run started from inside a test run needs a clean context
  const r = spawnSync(process.execPath, ['--test', path.join(ROOT, 'tests/desk-ict-guard.test.mjs')], { encoding: 'utf8', env: { ...env, ICT_GUARD_ROOT: d } });
  return { status: r.status, out: r.stdout + r.stderr };
}
test('stop guard: passes on an untouched copy of the ICT code, from another folder (as the apply workflow runs it)', () => {
  const r = guardOn(() => {}); assert.equal(r.status, 0, r.out.slice(-1500)); assert.match(r.out, /# pass 5/);
});
test('stop guard: fails when a change puts the stop on the wrong side, drops it, or widens a moved stop', () => {
  const wrong = guardOn((d, edit) => edit('tracker.mjs', 'entry: side * e, stop: side * stop, r0,', 'entry: side * e, stop: side * (2 * e - stop), r0,'));
  assert.notEqual(wrong.status, 0); assert.match(wrong.out, /on the losing side of the entry/);
  const none = guardOn((d, edit) => edit('tracker.mjs', 'entry: side * e, stop: side * stop, r0,', 'entry: side * e, stop: null, r0,'));
  assert.notEqual(none.status, 0); assert.match(none.out, /entry and stop are numbers/);
  const loose = guardOn((d, edit) => edit('replay.mjs', 'stop: f(g.stop), stop0: f(g.stop),', 'stop: f(g.stop - s * 3 * r0), stop0: f(g.stop),'));
  assert.notEqual(loose.status, 0); assert.match(loose.out, /a stop may only tighten/);
});
test('stop guard: fails when the ICT code reaches for the mirror, the API, another council file, a broker or an order', () => {
  const add = (line, file = 'calendar.mjs') => guardOn((d) => fs.appendFileSync(path.join(d, 'ict', file), `\n${line}\n`));
  for (const [line, re] of [["const m = () => import('../council/ctrader-mirror.mjs');", /imports "\.\.\/council\/ctrader-mirror\.mjs"/], ["const a = () => import('../api/ctrader-link.js');", /imports "\.\.\/api\/ctrader-link\.js"/],
    ["const t = () => import('../council/trader.mjs');", /imports "\.\.\/council\/trader\.mjs"/], ["const e = () => import('../council/engine.mjs');", /imports "\.\.\/council\/engine\.mjs"/],
    ["const h = () => import('node:https');", /imports "node:https"/], ['const p = "x"; const q = () => import(p);', /imports "<computed/], ["const c = () => import('node:child_process');", /imports "node:child_process"/],
    ['const send = (o) => fetchLike("/x", { method: "POST", body: o });', /contains "method: "POST""/], ['const NEW_ORDER_REQ = 2106;', /contains "NEW_ORDER"/], ['const placeOrder = () => 1;', /contains "placeOrder"/], ['const u = "https://api-fxtrade.oanda.com/v3/accounts/1/orders";', /sends nothing to a broker/]]) {
    const r = add(line); assert.notEqual(r.status, 0, line); assert.match(r.out, re, line); }
  const mk = guardOn((d, edit) => edit('tracker.mjs', "gc:  { sym: 'GC=F',", "gc:  { account: 'demo-1', sym: 'GC=F',")); assert.notEqual(mk.status, 0); assert.match(mk.out, /market gc has a field "account"/);
  const br = guardOn((d, edit) => edit('tracker.mjs', "label: 'Gold', short: 'GC'", "label: 'Gold on cTrader', short: 'GC'")); assert.notEqual(br.status, 0); assert.match(br.out, /no broker, account or credential in a market/);
});
test('the guard is a file a change to the ICT edge cannot reach, and it runs in the normal suite too', () => {
  assert.ok(!RULES.okPath('tests/desk-ict-guard.test.mjs')); assert.ok(!RULES.TEST_RE.test('tests/desk-ict-guard.test.mjs'));
  assert.match(TESTS, /node --test tests\/\*\.test\.mjs tests\/\*\.test\.js/);
  assert.match(rd('scripts/vercel-ignore.sh'), / ict /, 'a merged ICT change redeploys the functions that bundle ict/*.mjs (the backtest lab, the backup runner)');
});
