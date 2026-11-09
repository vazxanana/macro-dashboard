// GET /api/me -> { account } for a valid session cookie, { account: null } otherwise (9 Nov 2026).
// Re-checks the account against the current user list on every call (removed, disabled or password changed -> null and the
// cookie is cleared) and returns the current role and perms, so a change on the Users page reaches the page on its next load.
// A session older than a day is re-issued with a fresh 30-day expiry. 503 when the list cannot be read (the page keeps its view).
const S = require('./_session');
async function handle(req, res, d = {}) {
  const env = d.env || process.env, now = d.now || Date.now(); res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET' });
  const raw = S.cookieOf(req), tok = S.verify(env, raw, now);
  if (!tok) { if (raw) res.setHeader('Set-Cookie', S.clearCookie()); return res.status(200).json({ account: null }); }
  try {
    const acct = await S.current(env, d.deps || S.defaultDeps(env), tok);
    if (!acct) { res.setHeader('Set-Cookie', S.clearCookie()); return res.status(200).json({ account: null }); }
    if (now - tok.iat > 86400e3) res.setHeader('Set-Cookie', S.setCookie(S.sign(env, { ...tok, n: acct.name, r: acct.role, pv: S.pvOf(acct), iat: now, exp: now + S.TTL })));
    return res.status(200).json({ account: acct });
  } catch (e) { return res.status(503).json({ error: 'account check unavailable' }); }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
