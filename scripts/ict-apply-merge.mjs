// Merges applied ICT changes that passed every lock. Run by .github/workflows/ict-apply-merge.yml only, from main's copy,
// downloaded through the API: that job has no checkout and never holds or runs pull request code. Everything it knows about a pull
// request comes from the GitHub API. Only members listed in council/ict-apply.json on main (owner, 10 Nov 2026: fred); an empty list refuses every branch.
//
// For each open pull request main <- mcp/<member>/apply-… in this repository, oldest first:
//   1. already answered for this head commit (our marker comment)?        -> leave it for the owner
//   2. the "ICT apply" checks (ict-apply.yml) for exactly this head commit: not finished -> wait for their own run;
//      failed -> comment once and leave it open; passed -> go on
//   3. a draft, a fork, another base                                      -> refuse (never merged)
//   4. branch, member (council/ict-apply.json on main) and every file path, on main's rules (ict-apply-check.mjs, API mode)
//   5. ICT files changed on main since the pull request's base            -> refuse (it was tested against the older files)
//   6. squash-merge with the pull request title, bound to the checked head commit (GitHub refuses if the branch moved)
//   7. dispatch ict-replay.yml when ICT code changed: a merge made with the workflow token starts no push workflows
// A refusal is ONE comment on the pull request with the reason; it stays open for the owner and nothing changes on the desk.
// The token is read from the environment and never printed.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { checkApiFiles, readMembers } from './ict-apply-check.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { okPath, applyMember } = createRequire(import.meta.url)(path.join(HERE, '..', 'api', '_ictrules.js'));
export const VERIFY = 'ict-apply.yml', REPLAY = 'ict-replay.yml', MAIN = 'main';
export const mark = (sha) => `<!-- ict-apply ${sha} -->`;
const scrub = (e) => String(e && e.message || e).replace(/gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+/g, '***').replace(/Bearer\s+\S+/g, 'Bearer ***').slice(0, 300);

export function makeGh({ repo, token, fetchFn = fetch }) {
  return async (u, o = {}) => {
    const r = await fetchFn(`https://api.github.com/repos/${repo}${u}`, { method: o.method || 'GET', body: o.body ? JSON.stringify(o.body) : undefined,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'meridian-ict-apply', ...(o.body ? { 'Content-Type': 'application/json' } : {}) } });
    let json = null; try { json = await r.json(); } catch (e) {}
    if (!r.ok && !(o.ok || []).includes(r.status)) throw new Error(`GitHub ${r.status} ${u.split('?')[0]}: ${scrub(json && json.message)}`);
    return { status: r.status, ok: r.ok, json };
  };
}
// the failed step of a checks run, in words
async function failedStep(gh, run) {
  try { const jobs = (await gh(`/actions/runs/${run.id}/jobs?per_page=30`)).json.jobs || [], j = jobs.find((x) => x.conclusion === 'failure' || x.conclusion === 'timed_out');
    const s = j && (j.steps || []).find((x) => x.conclusion === 'failure' || x.conclusion === 'timed_out'); return s ? ` at the step "${String(s.name).slice(0, 120)}"` : ''; } catch (e) { return ''; }
}

// one pull request. io: { gh, repo, members, log, sleep, waitTries, runUrl }
export async function handle(n, io) {
  const { gh, repo, members } = io, log = io.log || (() => {});
  const skip = (reason) => { log(`#${n}: left alone (${reason})`); return { number: n, result: 'skipped', reason }; };
  const pr = (await gh(`/pulls/${n}`)).json, sha = pr.head && pr.head.sha, ref = pr.head && pr.head.ref;
  if (pr.state !== 'open' || pr.merged) return skip('not open');
  if (!pr.head.repo || pr.head.repo.full_name !== repo) return skip('from a fork');
  if (!pr.base || pr.base.ref !== MAIN || !applyMember(ref)) return skip('not an applied change onto main');
  const comments = (await gh(`/issues/${n}/comments?per_page=100`)).json || [];
  if (comments.some((c) => String(c.body || '').includes(mark(sha)))) return skip('already answered for this commit');
  const refuse = async (reason) => {
    await gh(`/issues/${n}/comments`, { method: 'POST', body: { body: `${mark(sha)}\n**Not applied.** ${reason}\n\nNothing changed on the desk. This pull request stays open for the owner.${io.runUrl ? ` [Workflow run](${io.runUrl})` : ''}` } });
    log(`#${n}: refused (${reason})`); return { number: n, result: 'refused', reason };
  };
  // the checks for exactly this head commit, from the workflow file itself (never matched by name)
  const runs = ((await gh(`/actions/workflows/${VERIFY}/runs?head_sha=${sha}&event=pull_request&per_page=30`)).json.workflow_runs || [])
    .filter((r) => r.head_sha === sha && (!r.path || String(r.path).startsWith(`.github/workflows/${VERIFY}`))).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const run = runs[0];
  if (!run) return pr.mergeable === false ? refuse('It conflicts with main, so the checks cannot run. Read the files again and send the change on top of main.') : skip('no checks for this commit yet');
  if (run.status !== 'completed') return skip('the checks have not finished');
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out') return refuse(`The apply checks failed${await failedStep(gh, run)}. See the run for the reason: ${run.html_url || ''}`);
  if (run.conclusion !== 'success') return skip(`the checks ended ${run.conclusion}`);
  if (pr.draft) return refuse('It is a draft. Applied changes are opened ready for merging; a draft waits for the owner.');
  const files = (await gh(`/pulls/${n}/files?per_page=100`)).json;
  if (!Array.isArray(files) || files.length !== pr.changed_files) return refuse('Its file list could not be read in full.');
  const chk = checkApiFiles(files, ref, members);
  if (!chk.ok) return refuse(chk.problems.join('; ') + '.');
  // tested against the ICT files of its base: if main's ICT files moved since, the combination was never tested
  const cmp = await gh(`/compare/${pr.base.sha}...${MAIN}`, { ok: [404] }), moved = cmp.ok && cmp.json && Array.isArray(cmp.json.files) ? cmp.json.files.flatMap((f) => [f.filename, f.previous_filename].filter(Boolean)) : null;
  if (!moved || moved.length >= 300) return refuse('Main moved too far since this change was made to tell whether the ICT files are the same. Read them again and send the change on top of main.');
  const ict = moved.filter(okPath);
  if (ict.length) return refuse(`The ICT files on main changed after this change was made (${ict.slice(0, 5).join(', ')}). Read them again and send the change on top of main.`);
  for (let i = 0; ; i++) {
    const m = await gh(`/pulls/${n}/merge`, { method: 'PUT', ok: [403, 404, 405, 409, 422], body: { merge_method: 'squash', sha, commit_title: `${String(pr.title).slice(0, 180)} (#${n})`,
      commit_message: `Applied by ${chk.who} through the ICT connector under the owner's delegation of the ICT edge.\nChecked by .github/workflows/ict-apply.yml and merged by ict-apply-merge.yml.` } });
    if (m.ok) break;
    const msg = String((m.json && m.json.message) || '').slice(0, 300);
    if (m.status === 409) return skip('the branch moved during the merge; its new commit gets its own checks');
    // branch protection may still wait for the repository's other checks on this commit: try again for a few minutes
    if (m.status === 405 && /status check|required|pending|in progress|expected/i.test(msg) && i < (io.waitTries ?? 16)) { await (io.sleep || ((ms) => new Promise((r) => setTimeout(r, ms))))(30e3); continue; }
    return refuse(`GitHub did not merge it (${m.status}): ${msg || 'no reason given'}`);
  }
  let replay = 'not needed';
  if (chk.files.some((p) => /^ict\/[^/]+\.mjs$/.test(p))) { const d = await gh(`/actions/workflows/${REPLAY}/dispatches`, { method: 'POST', ok: [403, 404, 422], body: { ref: MAIN } }); replay = d.ok ? 'dispatched' : `not dispatched (GitHub ${d.status})`; }
  log(`#${n}: merged for ${chk.who}; ICT replay ${replay}`);
  return { number: n, result: 'merged', who: chk.who, replay };
}

// every open applied change, oldest first; one failing never stops the others
export async function sweep(io) {
  const list = ((await io.gh(`/pulls?state=open&base=${MAIN}&sort=created&direction=asc&per_page=100`)).json || []).filter((p) => p.head && p.head.repo && p.head.repo.full_name === io.repo && applyMember(p.head.ref));
  const out = [];
  for (const p of list) { try { out.push(await handle(p.number, io)); } catch (e) { (io.log || (() => {}))(`#${p.number}: error (${scrub(e)})`); out.push({ number: p.number, result: 'error', reason: scrub(e) }); } }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = process.env.REPO, token = process.env.GH_TOKEN;
  if (!repo || !token) { console.error('REPO and GH_TOKEN are required'); process.exit(2); }
  const members = readMembers();
  console.log(members.length ? `members allowed to apply: ${members.join(', ')}` : 'council/ict-apply.json lists nobody: applying is switched off, every branch is refused');
  try { const out = await sweep({ gh: makeGh({ repo, token }), repo, members, log: (s) => console.log(s), runUrl: process.env.RUN_URL });
    if (!out.length) console.log('no open applied changes'); process.exit(out.some((x) => x.result === 'error') ? 1 : 0); }
  catch (e) { console.error(`could not run: ${scrub(e)}`); process.exit(1); }
}
