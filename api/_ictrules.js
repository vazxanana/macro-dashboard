// The ICT edge's own files, and what a helper's change to them may contain. ONE list for every lock on the path:
//   api/mcp.js                        the connector checks a proposal or an applied change before it writes anything
//   scripts/ict-apply-check.mjs       the apply workflows check the pull request again, from main's copy of this file
// Keep it dependency-free (node built-ins only, no imports from the repo): the merge workflow downloads this single file from
// main and runs it without a checkout. Nothing under these paths may list who is allowed to apply: that list is
// council/ict-apply.json, outside the allowlist on purpose (a change could otherwise add its own author).
// tests/apply-workflow.test.mjs pins that the connector and the verifier use this module and hold no second list.
const ALLOW = [/^ict\/[^/]+\.mjs$/, /^\.claude\/skills\/ICT\/[^/]+\.md$/, /^tests\/ict-[^/]+\.test\.mjs$/, /^tests\/fixtures\/ict\/[^/]+$/, /^research\/ict\/[^/]+\.(md|json|csv)$/, /^research\/edge\/ict-[^/]+\/[^/]+$/];
const ALLOW_TEXT = 'ict/*.mjs, .claude/skills/ICT/*.md, tests/ict-*.test.mjs, tests/fixtures/ict/*, research/ict/*.md|json|csv, research/edge/ict-*/*';
const okPath = (p) => typeof p === 'string' && p.length <= 160 && !p.split('/').some((s) => s === '' || s === '.' || s === '..') && ALLOW.some((re) => re.test(p));
const TEST_RE = /^tests\/ict-[^/]+\.test\.mjs$/, RULE_RE = /^(ict\/[^/]+\.mjs|\.claude\/skills\/ICT\/[^/]+\.md)$/;
// sizes of one change
const MAX = { files: 12, file: 200e3, total: 400e3 };
// new network / environment / process access in an ICT file needs the owner (CI runs the code of the branch). Counted against
// the file's content on main: a change may keep what is there, never add to it.
const RISKY = [['child_process', /child_process|\bspawn\s*\(|\bexecSync\s*\(/g], ['process.env', /process\.env/g], ['eval / new Function', /\beval\s*\(|new\s+Function\s*\(/g],
  ['network access', /\bfetch\s*\(|node:https?\b|node:net\b|node:dgram\b|\bXMLHttpRequest\b|\bWebSocket\b/g], ['an import from api/ or council/', /['"](?:\.\.\/)+(?:api|council)\//g]];
const count = (s, re) => (String(s || '').match(re) || []).length;
// the first kind of risky access a .mjs file adds over its old content, or null
function riskyAdded(path, content, old) {
  if (!/\.mjs$/.test(path)) return null;
  for (const [what, re] of RISKY) if (count(content, re) > count(old, re)) return what;
  return null;
}
// branches of applied changes: mcp/<member>/apply-<time>-<slug>. The member is a desk account key.
const APPLY_BRANCH = /^mcp\/([a-z0-9-]{1,24})\/apply-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const applyMember = (ref) => { const m = typeof ref === 'string' && ref.length <= 120 ? APPLY_BRANCH.exec(ref) : null; return m && m[1] !== 'owner' ? m[1] : null; };
// what a path outside the allowlist is, in words (for the refusal)
function kindOf(p) {
  const s = String(p);
  if (/^\.github\//.test(s)) return 'a workflow or GitHub setting';
  if (/^scripts\//.test(s)) return 'a script';
  if (/^api\//.test(s)) return 'the API';
  if (/^council\//.test(s)) return 'the council';
  if (/^out\//.test(s)) return 'the built site';
  if (/^tests\//.test(s)) return 'a test outside tests/ict-*';
  if (/^(package(-lock)?\.json|vercel\.json)$/.test(s)) return 'the project configuration';
  if (/\.(html|css|webmanifest)$/.test(s) || /^(assets|icons)\//.test(s) || s === 'sw.js') return 'a page or page asset';
  return 'outside the ICT edge';
}
// the members file (council/ict-apply.json on main): { "members": ["fred"] }. Anything else reads as nobody.
function membersOf(json) {
  let j = json; if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) { return []; } }
  const m = j && Array.isArray(j.members) ? j.members : [];
  return m.filter((x) => typeof x === 'string' && /^[a-z0-9-]{1,24}$/.test(x) && x !== 'owner');
}

module.exports = { ALLOW, ALLOW_TEXT, okPath, TEST_RE, RULE_RE, MAX, RISKY, count, riskyAdded, APPLY_BRANCH, applyMember, kindOf, membersOf, MEMBERS_FILE: 'council/ict-apply.json' };
