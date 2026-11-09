// POST /api/login { password } -> { account: { u, name, role, ict?, ct?, mcp?, perms? } } + HttpOnly session cookie (9 Nov 2026).
// The password is checked here (owner hash, built-in members, the Blob user list; removed members refused). Every wrong
// password, unknown account or malformed request gets the same 401 "Password not accepted". 503 when the user list cannot be
// read (fails closed) or no session key is configured. The firewall's /api rate limit (30/min per IP) slows guessing, and
// api/_guard.js answers 429 after 10 failed password checks from one IP in 10 minutes (shared with every password check).
const S = require('./_session');
const G = require('./_guard');
async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
  if (!S.sameOrigin(req)) return res.status(401).json({ error: 'Password not accepted' });
  if (!S.secret(env)) return res.status(503).json({ error: 'Sign-in is not available right now' });
  let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') || {} : req.body || {}; } catch (e) { b = {}; }
  const deps = d.deps || S.defaultDeps(env);
  const secs = G.wait(req, d.now); if (secs) return G.tooMany(res, secs);
  try {
    const who = await S.login(deps, b && typeof b.password === 'string' ? b.password : '');
    if (!who) { G.failed(req, d.now); return res.status(401).json({ error: 'Password not accepted' }); }
    res.setHeader('Set-Cookie', S.setCookie(S.issue(env, who.u, who.h, who.account, d.now)));
    return res.status(200).json({ account: who.account });
  } catch (e) { return res.status(503).json({ error: 'Sign-in is not available right now' }); }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
