// ICT replay trigger (reliability, 11 Nov 2026): should the council loop start ict-replay.yml now?
// The replay workflow has a daily cron, but GitHub fires this repository's schedules late or not at all (the weekly cron of
// 8 Nov started 7 h late; the watchdog's :11/:41 cron fires a few times a day), so an unresolved replay record could say
// "update pending" for days. The loop, which runs all day, asks this file once a round and dispatches the workflow when the
// answer is yes. This file only DECIDES and only READS (one local file, one GET of the workflow's run list): it starts
// nothing, writes nothing and touches no trade, rule or record. The cron stays as the second path.
//   node council/replay-due.mjs <council-data dir>     exit 0 = due (the caller dispatches), exit 1 = not due or not sure
// Not sure is always "no": a run list that cannot be read never leads to a dispatch.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const WORKFLOW = 'ict-replay.yml';
export const STALE_H = 20;   // ict/replay.json `at` older than this = today's replay has not run
export const GAP_H = 6;      // at most one start per this many hours, whoever started the last run (cron, push, a person, this loop)
const HOUR = 3600e3;

// replayAt: the `at` of ict/replay.json (null when the file is missing or does not parse); runs: the workflow's newest runs as
// the REST API lists them ([{ status, created_at }]), or null when the list could not be read; now: ms.
export function decide({ replayAt, runs, now }) {
  const at = replayAt == null ? NaN : Date.parse(replayAt);
  if (Number.isFinite(at) && now - at < STALE_H * HOUR) return { due: false, why: `replay is ${((now - at) / HOUR).toFixed(1)} h old (under ${STALE_H} h)` };
  if (!Array.isArray(runs)) return { due: false, why: 'the run list could not be read: not starting anything' };
  const active = runs.find((r) => r && r.status !== 'completed');
  if (active) return { due: false, why: `a replay run is already ${active.status || 'active'}` };
  const last = Math.max(-Infinity, ...runs.map((r) => Date.parse(r && r.created_at)).filter(Number.isFinite));
  if (now - last < GAP_H * HOUR) return { due: false, why: `a replay run was started ${((now - last) / HOUR).toFixed(1)} h ago (one start per ${GAP_H} h)` };
  return { due: true, why: Number.isFinite(at) ? `replay is ${((now - at) / HOUR).toFixed(1)} h old and no run was started in the last ${GAP_H} h` : `ict/replay.json has no readable update time and no run was started in the last ${GAP_H} h` };
}

// the file's `at` (null on any problem)
export function replayAtOf(dir) {
  try { const j = JSON.parse(fs.readFileSync(path.join(dir, 'ict', 'replay.json'), 'utf8')); return typeof j.at === 'string' ? j.at : null; } catch (e) { return null; }
}

// newest runs of the workflow (GET only); null on any failure
export async function listRuns({ repo, token, fetchFn = fetch, ms = 15000 }) {
  try {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) return null;
    const r = await fetchFn(`https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/runs?per_page=20`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'council-loop', ...(token ? { authorization: `Bearer ${token}` } : {}) }, signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j.workflow_runs) ? j.workflow_runs.map((x) => ({ status: x.status, created_at: x.created_at })) : null;
  } catch (e) { return null; }
}

export async function main(dir, { env = process.env, now = Date.now(), fetchFn = fetch } = {}) {
  const replayAt = replayAtOf(dir);
  let d = decide({ replayAt, runs: [], now });   // fresh file: answered without the network
  if (d.due) d = decide({ replayAt, runs: await listRuns({ repo: env.GITHUB_REPOSITORY, token: env.GH_TOKEN || env.GITHUB_TOKEN, fetchFn }), now });
  return d;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2] || 'data').then((d) => { console.log(`ICT replay trigger: ${d.due ? 'DUE' : 'not due'} (${d.why})`); process.exit(d.due ? 0 : 1); },
    () => process.exit(1));
}
