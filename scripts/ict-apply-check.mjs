// The verifier of applied ICT changes (owner, 10 Nov 2026: the ICT edge is delegated to Fred; his changes take effect without the
// owner merging each one). The connector (api/mcp.js ict_apply_change) checks a change before it opens the pull request; this
// script checks the pull request itself, so a branch pushed any other way meets the same locks.
//
// ALWAYS run main's copy, never the pull request's: the workflows check main out next to the pull request (or download this file
// from main) and start it from there. Its rules (api/_ictrules.js) and the members list (council/ict-apply.json) are read next to
// this file, so they are main's too. It reads the pull request as data and never runs any of its code.
//
//   git mode (.github/workflows/ict-apply.yml, job verify):
//     node base/scripts/ict-apply-check.mjs --repo pr --base <main sha> --head <head sha> --branch mcp/fred/apply-…
//     Refuses unless: the branch is mcp/<member>/apply-… and the member is in council/ict-apply.json; every path the pull request
//     changes (merge base ... head, renames off) is in the ICT allowlist; plain files only (no symlink, no submodule, no
//     executable bit); at most 12 files, 200 KB each, 400 KB together; every .mjs parses (node --check) and every .json parses;
//     no .mjs adds network / environment / process access, eval or an import from api/ or council/ over its content on main.
//   API mode (.github/workflows/ict-apply-merge.yml, no checkout):
//     node check.mjs --api-files files.json --branch mcp/fred/apply-…
//     files.json = the pull request's file list from the GitHub API. Branch, member, paths and the file count again, on main's
//     rules, right before the merge.
// Exit 0 = every check passed; 1 = refused (each reason on its own line, "REFUSED: …"); 2 = it could not run.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const RULES = require(path.join(HERE, '..', 'api', '_ictrules.js'));
const { okPath, kindOf, MAX, riskyAdded, applyMember, membersOf, ALLOW_TEXT, MEMBERS_FILE } = RULES;
export const readMembers = (file = path.join(HERE, '..', MEMBERS_FILE)) => { try { return membersOf(fs.readFileSync(file, 'utf8')); } catch (e) { return []; } };

// branch and member: mcp/<member>/apply-…, the member on the owner's list
export function checkBranch(branch, members) {
  const who = applyMember(branch);
  if (!who) return { who: null, problems: [`the branch "${String(branch).slice(0, 80)}" is not an apply branch (mcp/<member>/apply-…)`] };
  if (!members.includes(who)) return { who, problems: [`${who} is not in ${MEMBERS_FILE} on main: only the members the owner listed there may apply changes`] };
  return { who, problems: [] };
}
const pathProblem = (p) => (okPath(p) ? null : `${p} is ${kindOf(p)}: an applied change may touch the ICT edge only (${ALLOW_TEXT})`);

// API mode: the pull request's files as GitHub lists them ([{ filename, previous_filename?, status }])
export function checkApiFiles(list, branch, members) {
  const { who, problems } = checkBranch(branch, members);
  if (!Array.isArray(list) || !list.length) return { ok: false, who, files: [], problems: [...problems, 'the pull request lists no files'] };
  const names = [...new Set(list.flatMap((f) => [f && f.filename, f && f.previous_filename].filter((x) => typeof x === 'string')))];
  if (list.length > MAX.files) problems.push(`${list.length} files: at most ${MAX.files} in one applied change`);
  for (const f of list) if (!f || typeof f.filename !== 'string') problems.push('a file entry without a name');
  for (const p of names) { const e = pathProblem(p); if (e) problems.push(e); }
  return { ok: !problems.length, who, files: names, problems };
}

// git mode
const git = (repo, args, o = {}) => execFileSync('git', ['-C', repo, ...args], { encoding: o.buffer ? null : 'utf8', maxBuffer: 64e6, stdio: ['ignore', 'pipe', 'pipe'] });
const show = (repo, rev, p) => { try { return git(repo, ['show', `${rev}:${p}`], { buffer: true }); } catch (e) { return null; } };
export function checkRepo({ repo, base, head, branch, members }) {
  const { who, problems } = checkBranch(branch, members);
  const sha = (r) => git(repo, ['rev-parse', '--verify', `${r}^{commit}`]).trim();
  const H = sha(head), mb = git(repo, ['merge-base', sha(base), H]).trim();
  // the pull request's own changes: merge base ... head; renames off, so a moved file shows as a delete and an add
  const raw = git(repo, ['diff', '--no-renames', '--name-status', '-z', mb, H]).split('\0').filter((x) => x !== '');
  const changes = []; for (let i = 0; i + 1 < raw.length; i += 2) changes.push({ status: raw[i], path: raw[i + 1] });
  if (!changes.length) problems.push('the pull request changes nothing');
  if (changes.length > MAX.files) problems.push(`${changes.length} files: at most ${MAX.files} in one applied change`);
  let total = 0; const report = [];
  for (const c of changes) {
    const bad = pathProblem(c.path); if (bad) { problems.push(bad); continue; }   // never read a file outside the allowlist
    if (!['A', 'M', 'D'].includes(c.status)) { problems.push(`${c.path}: change type ${c.status} is not allowed`); continue; }
    if (c.status === 'D') { report.push({ path: c.path, status: 'deleted' }); continue; }
    const mode = (git(repo, ['ls-tree', H, '--', c.path]).split(/\s+/)[0]) || '';
    if (mode !== '100644') { problems.push(`${c.path}: only plain files (mode 100644, not ${mode || 'unknown'}): no symlink, submodule or executable`); continue; }
    const buf = show(repo, H, c.path); if (!buf) { problems.push(`${c.path}: could not be read at the head commit`); continue; }
    total += buf.length;
    if (buf.length > MAX.file) { problems.push(`${c.path} is over ${MAX.file / 1e3} KB`); continue; }
    const text = buf.toString('utf8'), old = c.status === 'M' ? (show(repo, mb, c.path) || Buffer.alloc(0)).toString('utf8') : '';
    const risky = riskyAdded(c.path, text, old); if (risky) problems.push(`${c.path} adds ${risky}: that needs the owner (send it as a proposal)`);
    if (/\.json$/.test(c.path)) { try { JSON.parse(text); } catch (e) { problems.push(`${c.path} is not valid JSON`); } }
    if (/\.mjs$/.test(c.path)) {   // syntax only: node --check parses the file and runs nothing
      const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ict-apply-')), 'check.mjs'); fs.writeFileSync(f, buf);
      try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe', timeout: 20000 }); } catch (e) { problems.push(`${c.path} has a syntax error`); }
      finally { try { fs.rmSync(path.dirname(f), { recursive: true, force: true }); } catch (e) {} }
    }
    report.push({ path: c.path, status: c.status === 'A' ? 'new' : 'changed', bytes: buf.length });
  }
  if (total > MAX.total) problems.push(`the change is over ${MAX.total / 1e3} KB in total`);
  return { ok: !problems.length, who, head: H, mergeBase: mb, files: report, problems };
}

function main(argv) {
  const a = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  const members = readMembers();
  let r;
  if (a['api-files']) r = checkApiFiles(JSON.parse(fs.readFileSync(a['api-files'], 'utf8')), a.branch, members);
  else if (a.repo && a.base && a.head) r = checkRepo({ repo: a.repo, base: a.base, head: a.head, branch: a.branch, members });
  else { console.error('usage: ict-apply-check.mjs --repo <dir> --base <rev> --head <rev> --branch <name>  |  --api-files <json> --branch <name>'); return 2; }
  for (const f of r.files || []) console.log(typeof f === 'string' ? `  ${f}` : `  ${f.path} (${f.status}${f.bytes != null ? `, ${f.bytes} bytes` : ''})`);
  for (const p of r.problems) console.log(`REFUSED: ${p}`);
  console.log(r.ok ? `ok: an applied change by ${r.who}, ICT files only (${(r.files || []).length} file${(r.files || []).length === 1 ? '' : 's'})` : `${r.problems.length} problem${r.problems.length === 1 ? '' : 's'}: this change is not applied`);
  return r.ok ? 0 : 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { let code = 2; try { code = main(process.argv.slice(2)); } catch (e) { console.error(`could not run: ${String(e && e.message || e).split('\n')[0]}`); } process.exit(code); }
