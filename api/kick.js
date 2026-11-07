// Vercel cron → GitHub Actions (7 Nov 2026, stage 1 of the move to Vercel). GitHub's own schedules can start minutes to hours
// late; Vercel Pro crons fire on the minute and start the workflows here through the GitHub API.
//   job=ict      → dispatch the ICT desk tracker (ict.yml); GitHub queues it if one is already running.
//   job=council  → start the council loop (council.yml) only when no loop is running (the same check as its watchdog).
// Environment (Vercel → Project → Settings → Environment Variables):
//   GH_DISPATCH_TOKEN  a fine-grained GitHub token for this repo with Actions: read and write (never commit it)
//   CRON_SECRET        any long random string; Vercel sends it with each cron call, other callers are refused
const REPO = 'vazxanana/macro-dashboard';
const WF = { ict: 'ict.yml', council: 'council.yml' };

module.exports = async (req, res) => {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'unauthorised' });
  const job = String((req.query && req.query.job) || ''), wf = WF[job];
  if (!wf) return res.status(400).json({ error: 'unknown job' });
  const tok = process.env.GH_DISPATCH_TOKEN; if (!tok) return res.status(500).json({ error: 'GH_DISPATCH_TOKEN not set' });
  const gh = (u, o = {}) => fetch(`https://api.github.com/repos/${REPO}${u}`, { ...o, headers: { Authorization: `Bearer ${tok}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'aurum-desk-cron', ...(o.headers || {}) } });
  try {
    if (job === 'council') {
      const r = await gh(`/actions/workflows/${wf}/runs?per_page=20`), j = await r.json();
      const live = (j.workflow_runs || []).filter((x) => x.event !== 'schedule' && ['in_progress', 'queued', 'waiting', 'pending', 'requested'].includes(x.status)).length;
      if (live) return res.status(200).json({ job, started: false, running: live });
    }
    const d = await gh(`/actions/workflows/${wf}/dispatches`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: 'main' }) });
    if (d.status !== 204) return res.status(502).json({ job, error: `GitHub ${d.status}`, body: (await d.text()).slice(0, 300) });
    return res.status(200).json({ job, started: true });
  } catch (e) { return res.status(500).json({ job, error: String(e.message || e) }); }
};
