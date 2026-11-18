// The watchdog's own timer (18 Nov 2026, docs/owner-decisions.md items 15 and 31; owner: "do the alert" / "lets go").
// .github/workflows/watchdog.yml sends the "council stopped" phone alert, but it runs on GitHub's :11 / :41 cron, which fires a few
// times a day, and after a completed council run, which never comes when the loop hangs inside a run. So the alert could be hours
// late. The Worker's 10-minute cron now asks this module whether to START watchdog.yml (a workflow_dispatch on main):
//   - the council's last save (snapshot.json `at`) is older than COUNCIL_MIN, or the ICT desk's (ict/snapshot.json) older than
//     ICT_MIN outside the futures weekend: the same limits api/status.js and council/health.mjs use;
//   - no watchdog run is queued or running, and none was started in the last GAP_MIN (by anyone: its cron, a council run, a
//     person, this): GitHub's own run list is the marker, as council/replay-due.mjs does for the ICT replay.
// Not sure is always "no": an unreadable file or run list never starts anything. The watchdog itself still decides what to send
// and keeps its one-alert-per-change mark in council-data watchdog.json, so starting it more often never sends a second alert for
// the same problem. This module only reads and decides; the endpoint (api/status.js ?job=watchdog) does the one dispatch.
// It starts nothing else, writes no file and touches no trade, rule or record.
const WORKFLOW = 'watchdog.yml';
const REPO = 'vazxanana/macro-dashboard';
const COUNCIL_MIN = 20;   // = council/health.mjs CFG.stoppedMin and api/status.js
const ICT_MIN = 45;       // = council/health.mjs CFG.ictStoppedMin and api/status.js
const GAP_MIN = 30;       // at most one start per this many minutes while something stays stale (the watchdog takes ~40 s)

// the gold / NQ weekend break (UTC), as api/status.js and council/health.mjs count it: Fri 21:00 - Sun 22:00
const weekend = (ms) => { const d = new Date(ms), w = d.getUTCDay(), h = d.getUTCHours(); return w === 6 || (w === 5 && h >= 21) || (w === 0 && h < 22); };
const ageMin = (at, now) => { const t = Date.parse(at); return Number.isFinite(t) ? Math.round((now - t) / 6e4) : null; };

// What is stale now. council / ict: the `at` strings of the two snapshots (null = not readable). Returns [{ id, text }].
function staleNow({ council, ict, now }) {
  const out = [], c = ageMin(council, now), i = ageMin(ict, now);
  if (c == null) return null;   // the council's own file could not be read: not sure, so nothing is started
  if (c > COUNCIL_MIN) out.push({ id: 'council', text: `council last saved ${c} min ago (limit ${COUNCIL_MIN})` });
  else if (i != null && !weekend(now) && i > ICT_MIN) out.push({ id: 'ict', text: `ICT desk last saved ${i} min ago (limit ${ICT_MIN})` });
  return out;
}

// The decision. runs: watchdog.yml's newest runs as the REST API lists them ([{ status, created_at }]), or null when unreadable.
function decide({ council, ict, runs, now }) {
  const s = staleNow({ council, ict, now });
  if (s == null) return { start: false, why: 'snapshot.json could not be read: not starting anything' };
  if (!s.length) return { start: false, why: 'the council and the ICT desk are saving on time' };
  if (!Array.isArray(runs)) return { start: false, stale: s, why: 'the watchdog run list could not be read: not starting anything' };
  const active = runs.find((r) => r && r.status && r.status !== 'completed');
  if (active) return { start: false, stale: s, why: `a watchdog run is already ${active.status}` };
  const last = Math.max(-Infinity, ...runs.map((r) => Date.parse(r && r.created_at)).filter(Number.isFinite));
  if (now - last < GAP_MIN * 6e4) return { start: false, stale: s, why: `a watchdog run was started ${Math.round((now - last) / 6e4)} min ago (one start per ${GAP_MIN} min)` };
  return { start: true, stale: s, why: `${s.map((x) => x.text).join('; ')}: starting the watchdog` };
}

const hdr = (token) => ({ accept: 'application/vnd.github+json', 'user-agent': 'aureum-watchdog-kick', 'x-github-api-version': '2022-11-28', ...(token ? { authorization: `Bearer ${token}` } : {}) });

// newest runs of the watchdog workflow (GET only); null on any failure
async function listRuns({ token, fetchFn = fetch, ms = 10000 }) {
  try {
    const r = await fetchFn(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=10`, { headers: hdr(token), signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j.workflow_runs) ? j.workflow_runs.map((x) => ({ status: x.status, created_at: x.created_at })) : null;
  } catch (e) { return null; }
}

// start watchdog.yml on main (its definition on main, no inputs); true when GitHub took it
async function dispatch({ token, fetchFn = fetch, ms = 10000 }) {
  try {
    const r = await fetchFn(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: 'POST', headers: { ...hdr(token), 'content-type': 'application/json' }, body: JSON.stringify({ ref: 'main' }), signal: AbortSignal.timeout(ms) });
    return r.status === 204 || r.ok;
  } catch (e) { return false; }
}

// One cron pass. readAt(path) -> the file's `at` or null. A fresh desk is answered without asking GitHub anything.
async function run({ readAt, token, fetchFn = fetch, now = Date.now() }) {
  const [council, ict] = await Promise.all([readAt('snapshot.json'), readAt('ict/snapshot.json')]);
  let d = decide({ council, ict, runs: [], now });
  if (!d.start) return { started: false, why: d.why };
  if (!token) return { started: false, why: 'no GitHub dispatch token is set: cannot start the watchdog' };
  d = decide({ council, ict, runs: await listRuns({ token, fetchFn }), now });
  if (!d.start) return { started: false, why: d.why };
  const ok = await dispatch({ token, fetchFn });
  return { started: ok, why: ok ? d.why : 'GitHub refused the dispatch (the token needs Actions: write on this repository)' };
}

module.exports = { WORKFLOW, REPO, COUNCIL_MIN, ICT_MIN, GAP_MIN, weekend, staleNow, decide, listRuns, dispatch, run };
