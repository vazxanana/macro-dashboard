// POST /api/logout -> clears the session cookie (9 Nov 2026). The page also forgets its cached account info.
const S = require('./_session');
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
  if (!S.sameOrigin(req)) return res.status(403).json({ error: 'not allowed' });   // no forced sign-out from another site
  res.setHeader('Set-Cookie', S.clearCookie());
  return res.status(200).json({ ok: true });
};
