// Council / ICT data for the site, read from the council-data branch with a server-side token (7 Nov 2026, private-repo move).
// The browser asks /cdata/<path> (rewritten here); it never sees the token, so the repo can be private.
//   GH_READ_TOKEN  fine-grained GitHub token for this repo with Contents: read (falls back to GH_DISPATCH_TOKEN if that one can read)
const REPO = 'vazxanana/macro-dashboard', BRANCH = 'council-data';

module.exports = async (req, res) => {
  const p = String((req.query && req.query.p) || '').replace(/^\/+/, '');
  if (!p || p.length > 200 || !/^[A-Za-z0-9._\/-]+$/.test(p) || p.split('/').some((s) => s === '..' || s.startsWith('.'))) return res.status(400).json({ error: 'bad path' });
  const tok = process.env.GH_READ_TOKEN || process.env.GH_DISPATCH_TOKEN, enc = p.split('/').map(encodeURIComponent).join('/');
  try {
    // with a token: the GitHub API (works on a private repo); without one: the public raw file (only while the repo is still public)
    const r = tok ? await fetch(`https://api.github.com/repos/${REPO}/contents/${enc}?ref=${BRANCH}`, {
      headers: { Authorization: `Bearer ${tok}`, Accept: 'application/vnd.github.raw', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'aurum-desk-data' } })
      : await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/${enc}?t=${Math.floor(Date.now() / 20000)}`);
    if (!r.ok) { res.setHeader('Cache-Control', 's-maxage=15'); return res.status(r.status === 404 ? 404 : 502).json({ error: `GitHub ${r.status}` }); }
    const buf = Buffer.from(await r.arrayBuffer()), ext = (p.split('.').pop() || '').toLowerCase();
    res.setHeader('Content-Type', { json: 'application/json; charset=utf-8', md: 'text/markdown; charset=utf-8', csv: 'text/csv; charset=utf-8', js: 'application/javascript; charset=utf-8' }[ext] || 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=20, stale-while-revalidate=60');   // the edge serves everyone from one copy for 20 s
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(buf);
  } catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
};
