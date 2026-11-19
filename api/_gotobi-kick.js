// Start the gotobi job on time (19 Nov 2026, docs/owner-decisions.md item 61). .github/workflows/gotobi.yml must be running before
// 00:55 UTC on a gotobi morning (council/gotobi.mjs sells USD/JPY at 00:55:00 on the cTrader demo account, closes at 06:00).
// GitHub's own cron fires late or not at all at times, so the Worker's 10-minute cron also starts it: on a weekday (UTC) between
// 00:25 and 00:49, when no gotobi run is queued or running and none was started in the last 60 minutes. Whether the day is a
// gotobi day is decided by the job itself (council/gotobi.mjs, the study's calendar), which ends at once on any other day.
// Not sure is "no": an unreadable run list or no token starts nothing. This starts one workflow and does nothing else: no file,
// no order, no trade (the job holds the only order code, demo only).
const WORKFLOW = 'gotobi.yml';
const REPO = 'vazxanana/macro-dashboard';
const FROM = 25 * 60, TO = 49 * 60, GAP_MIN = 60;

const inWindow = (ms) => { const d = new Date(ms), w = d.getUTCDay(), s = d.getUTCHours() * 3600 + d.getUTCMinutes() * 60; return w >= 1 && w <= 5 && s >= FROM && s <= TO; };

function decide({ runs, now }) {
  if (!inWindow(now)) return { start: false, why: 'outside 00:25-00:49 UTC on a weekday' };
  if (!Array.isArray(runs)) return { start: false, why: 'the gotobi run list could not be read: not starting anything' };
  const active = runs.find((r) => r && r.status && r.status !== 'completed');
  if (active) return { start: false, why: `a gotobi run is already ${active.status}` };
  const last = Math.max(-Infinity, ...runs.map((r) => Date.parse(r && r.created_at)).filter(Number.isFinite));
  if (now - last < GAP_MIN * 6e4) return { start: false, why: `a gotobi run was started ${Math.round((now - last) / 6e4)} min ago` };
  return { start: true, why: 'starting the gotobi job for this morning' };
}

const hdr = (token) => ({ accept: 'application/vnd.github+json', 'user-agent': 'aureum-gotobi-kick', 'x-github-api-version': '2022-11-28', ...(token ? { authorization: `Bearer ${token}` } : {}) });
async function listRuns({ token, fetchFn = fetch, ms = 10000 }) {
  try { const r = await fetchFn(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=10`, { headers: hdr(token), signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null; const j = await r.json(); return Array.isArray(j.workflow_runs) ? j.workflow_runs.map((x) => ({ status: x.status, created_at: x.created_at })) : null; } catch (e) { return null; }
}
async function dispatch({ token, fetchFn = fetch, ms = 10000 }) {
  try { const r = await fetchFn(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', headers: { ...hdr(token), 'content-type': 'application/json' }, body: JSON.stringify({ ref: 'main' }), signal: AbortSignal.timeout(ms) });
    return r.status === 204 || r.ok; } catch (e) { return false; }
}
async function run({ token, fetchFn = fetch, now = Date.now() }) {
  if (!inWindow(now)) return { started: false, why: 'outside the window' };
  if (!token) return { started: false, why: 'no GitHub dispatch token is set' };
  const d = decide({ runs: await listRuns({ token, fetchFn }), now });
  if (!d.start) return { started: false, why: d.why };
  const ok = await dispatch({ token, fetchFn });
  return { started: ok, why: ok ? d.why : 'GitHub refused the dispatch (the token needs Actions: write)' };
}
module.exports = { WORKFLOW, REPO, FROM, TO, GAP_MIN, inWindow, decide, listRuns, dispatch, run };
