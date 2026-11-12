// Council / ICT data for the site, read from the council-data branch with a server-side token (7 Nov 2026, private-repo move).
// The browser asks /cdata/<path> (vercel.json rewrite to this function); it never sees the token, so the repo can be private.
//   GH_READ_TOKEN  fine-grained GitHub token for this repo with Contents: read (falls back to GH_TOKEN / GH_DISPATCH_TOKEN)
// Sign-in (9 Nov 2026 security fix): every file needs a signed-in session (cookie from /api/login) except GUEST_OK below.
// Protected files are served with private, no-store cache headers and no CORS; guest files stay edge-cached and public.
// Guest cut (11 Nov 2026): a request without a valid session gets the guest JSON files CUT to what the guest page draws
// (api/_guestcut.js: main system rows, drawn fields, prices); a signed-in member gets the whole file, private and uncached.
// mt5/signals.csv is never cut: the broker bridges read it without a session.
// On GitHub Pages / local copies the page reads raw council-data directly (window.MS_CDATA), as before; this function is not
// involved there.
const G = require('./_guestcut');
const REPO = 'vazxanana/macro-dashboard', BRANCH = 'council-data';
// never served, signed in or not: the demo mirror's rotated cTrader tokens (AES-GCM sealed, still a secret at rest) and the
// first-run user list (it carries password hashes; the server reads it directly, see api/_accounts.js blobUsers)
const PRIVATE = new Set(['ctrader/tokens.json', 'users.json']);
// What a guest (not signed in) may read. Exactly what the guest view, the sign-in card and the broker bridges fetch:
//   trades.json              guest gold trade card + Entry/Stop/Target lines, Today/week/month strip, P&L calendar, sign-in proof
//   snapshot.json            sign-in card gold price + timeframe trend + market tape; guest charts' snapshot
//   ict/replay.json          sign-in card "ICT replay record" proof line
//   research/replay-2w.json  the main system's replay trades counted in the guest results and calendar (sysClosed)
//   research.json            NQ forward paper counted in the guest results and calendar (sysClosed)
//   mt5/signals.csv          the MT5 / cTrader CouncilBridge EAs poll it without a browser session (served whole, to everyone)
// The five JSON files leave cut for a guest (G.CUT_FILES); never add a file here without a cut for it in api/_guestcut.js.
const GUEST_OK = new Set(['trades.json', 'snapshot.json', 'ict/replay.json', 'research/replay-2w.json', 'research.json', 'mt5/signals.csv']);

// one council-data file from GitHub: { ok, status, buf }. With a token: the GitHub API (works on a private repo); without one: the
// public raw file (only while the repo is still public). Also used by other functions instead of fetching /cdata over HTTP.
async function readFile(p, env = process.env, fetchFn = fetch) {
  const tok = env.GH_READ_TOKEN || env.GH_TOKEN || env.GH_DISPATCH_TOKEN, enc = p.split('/').map(encodeURIComponent).join('/');
  const r = tok ? await fetchFn(`https://api.github.com/repos/${REPO}/contents/${enc}?ref=${BRANCH}`, {
    headers: { Authorization: `Bearer ${tok}`, Accept: 'application/vnd.github.raw', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'aurum-desk-data' }, signal: AbortSignal.timeout(10000) })
    : await fetchFn(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/${enc}?t=${Math.floor(Date.now() / 20000)}`, { signal: AbortSignal.timeout(10000) });
  return { ok: r.ok, status: r.status, buf: r.ok ? Buffer.from(await r.arrayBuffer()) : null };
}

// an MT5 / cTrader bridge polling the signals file leaves a tiny "last read" marker in Blob (at most every 2 min per instance)
let lastPing = 0;
async function bridgePing(req) {
  const ua = String(req.headers['user-agent'] || ''); if (/Mozilla/i.test(ua) || !process.env.BLOB_READ_WRITE_TOKEN || Date.now() - lastPing < 120e3) return;
  lastPing = Date.now();
  const { put, list, del } = require('@vercel/blob'), tok = process.env.BLOB_READ_WRITE_TOKEN, client = /MetaTrader|MT5|MQL/i.test(ua) ? 'mt5' : 'ctrader';
  const old = (await list({ prefix: 'bridge/ping', token: tok })).blobs.map((b) => b.url);
  await put(`bridge/ping-${client}.json`, JSON.stringify({ at: new Date().toISOString(), ua: ua.slice(0, 80) }), { access: 'private', addRandomSuffix: true, contentType: 'application/json', token: tok });
  if (old.length) await del(old, { token: tok }).catch(() => {});
}
// Conditional answers (12 Nov 2026): a strong ETag from the exact bytes sent, tagged with the variant ('c' = the guest cut,
// 'f' = the whole file), so a visitor's ETag can never match what a member is sent (or the other way round). If-None-Match equal
// to the ETag of what would be sent NOW gets 304 with no body and the same Cache-Control / Vary / CORS / ETag headers as the 200.
const crypto = require('node:crypto');
function etagOf(body, variant) { return `"${variant}-${crypto.createHash('sha256').update(body).digest('base64url').slice(0, 32)}"`; }
function matches(inm, tag) {
  if (!inm) return false;
  const s = String(inm).trim(); if (s === '*') return true;
  return s.split(',').some((x) => x.trim().replace(/^W\//, '') === tag);   // If-None-Match uses the weak comparison (RFC 9110 13.1.2)
}
async function handle(req, res, d = {}) {
  const env = d.env || process.env;
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).json({ error: 'GET' }); }   // reads only (no GitHub call, no bridge ping)
  const p = String((req.query && req.query.p) || '').replace(/^\/+/, '');
  if (!p || p.length > 200 || !/^[A-Za-z0-9._\/-]+$/.test(p) || p.split('/').some((s) => s === '' || s === '..' || s.startsWith('.'))) return res.status(400).json({ error: 'bad path' });
  if (PRIVATE.has(p.toLowerCase())) return res.status(404).json({ error: 'not found' });   // sealed secrets and hashes stay server-side
  const guest = GUEST_OK.has(p), cutFile = guest && G.CUT_FILES.includes(p);
  const S = require('./_session');
  // Who is asking for a guest file that has a cut version. Only a request with NO session cookie and NO member mark (?m=1, which
  // the page adds for a signed-in member) is a plain guest request and may be cached publicly; everything else is answered
  // private, no-store whatever the outcome, so the shared cache can never hold a member's answer, nor an answer made for a
  // member's address. Vary: Cookie keeps a cached guest copy away from a request that carries a cookie.
  let member = false, marked = false;
  if (cutFile) {
    res.setHeader('Vary', 'Cookie');
    marked = !!S.cookieOf(req) || !!(req.query && req.query.m);
    if (marked) { try { member = !!(await S.fromRequest(req, env, d.deps || S.defaultDeps(env), { cacheMs: 60e3 })); } catch (e) { member = false; } }   // the check failing = not a member: the cut file
  }
  if (!guest) {
    res.setHeader('Cache-Control', 'private, no-store');
    let acct = null; try { acct = await S.fromRequest(req, env, d.deps || S.defaultDeps(env), { cacheMs: 60e3 }); } catch (e) { return res.status(503).json({ error: 'sign-in check unavailable' }); }
    if (!acct) return res.status(401).json({ error: 'sign in to read this' });
  }
  const open = guest && !marked;   // publicly cacheable: a guest file asked for without a cookie or a member mark
  try {
    const r = await readFile(p, env, d.fetch || fetch);
    if (!r.ok) { res.setHeader('Cache-Control', open ? 's-maxage=15' : 'private, no-store'); return res.status(r.status === 404 ? 404 : 502).json({ error: `GitHub ${r.status}` }); }
    let body = r.buf;
    // not signed in: the cut copy (api/_guestcut.js). A file that does not parse, or a cut that throws, is a 503: never the full file.
    if (cutFile && !member) { try { body = G.cut(p, r.buf, S.secret(env)); } catch (e) { res.setHeader('Cache-Control', 'private, no-store'); return res.status(503).json({ error: 'data not available right now' }); } }
    const ext = (p.split('.').pop() || '').toLowerCase();
    res.setHeader('Content-Type', { json: 'application/json; charset=utf-8', md: 'text/markdown; charset=utf-8', csv: 'text/csv; charset=utf-8', js: 'application/javascript; charset=utf-8' }[ext] || 'text/plain; charset=utf-8');
    if (open) {   // public: the edge serves every guest from one copy for 20 s
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=20, stale-while-revalidate=60');
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else res.setHeader('Cache-Control', 'private, no-store');
    if (p === 'mt5/signals.csv' && !d.fetch) await bridgePing(req).catch(() => {});   // awaited: a frozen function would drop it
    const tag = etagOf(body, cutFile && !member ? 'c' : 'f');
    res.setHeader('ETag', tag);
    if (matches(req.headers && req.headers['if-none-match'], tag)) return res.status(304).end();   // unchanged: no body
    return res.status(200).send(body);
  } catch (e) { return res.status(502).json({ error: 'data source unavailable' }); }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.readFile = readFile;
module.exports.GUEST_OK = GUEST_OK;
module.exports.PRIVATE = PRIVATE;
module.exports.etagOf = etagOf;
