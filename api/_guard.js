// Shared request guards (9 Nov 2026 API hardening). Files starting with "_" under api/ are modules, not endpoints.
//
// Password guessing: every endpoint that checks a password (/api/login, ctrader-link "session", mcp "mykey", and the owner-password
// fallbacks of /api/users, /api/sounds, /api/bridge, /api/tv-webhook) counts the failures per client IP in one shared table.
// After MAX failures inside WINDOW the next password check from that IP answers 429 (Retry-After) until the oldest failure ages out:
// a sliding window, never a long lock-out (owner: a shared mobile IP must not lose the site for an hour). A right password does
// not clear the count (knowing one member's password must not reset the budget for guessing the owner's). In memory per function
// instance, so a cold start resets it: a second layer under the firewall's /api limit (30/min per IP), not a replacement.
const crypto = require('node:crypto');

const MAX = 10, WINDOW = 10 * 60e3, KEEP = 5000;
const FAILS = new Map();   // ip -> [time of each failure inside the window]
// the client IP as Vercel reports it (Vercel sets x-real-ip / x-forwarded-for itself; a client cannot spoof them there)
function ipOf(req) {
  const h = (req && req.headers) || {};
  const v = h['x-real-ip'] || h['x-vercel-forwarded-for'] || String(h['x-forwarded-for'] || '').split(',')[0];
  return String(v || '').trim().slice(0, 64) || 'unknown';
}
const recent = (k, now) => (FAILS.get(k) || []).filter((t) => now - t < WINDOW);
// seconds to wait before this IP may try a password again; 0 = go ahead
function wait(req, now = Date.now()) {
  const k = ipOf(req), a = recent(k, now); if (a.length) FAILS.set(k, a); else FAILS.delete(k);
  return a.length >= MAX ? Math.max(1, Math.ceil((WINDOW - (now - a[0])) / 1000)) : 0;
}
function failed(req, now = Date.now()) {
  const k = ipOf(req), a = recent(k, now); a.push(now); FAILS.delete(k); FAILS.set(k, a.slice(-MAX));
  if (FAILS.size > KEEP) {   // bounded: drop expired entries, then the oldest
    for (const [ip, t] of FAILS) if (!t.length || now - t[t.length - 1] >= WINDOW) FAILS.delete(ip);
    while (FAILS.size > KEEP) FAILS.delete(FAILS.keys().next().value);
  }
}
// the 429 answer (same words everywhere; nothing about which account or whether the password was right)
function tooMany(res, secs) {
  res.setHeader('Retry-After', String(secs));
  return res.status(429).json({ error: `Too many password attempts. Try again in ${Math.max(1, Math.ceil(secs / 60))} min.` });
}

// "Authorization: Bearer <secret>" in constant time (both sides hashed first, so neither the content nor the length leaks)
function bearerOk(header, secret) {
  if (!secret || typeof secret !== 'string') return false;
  const d = (s) => crypto.createHash('sha256').update(String(s)).digest();
  return crypto.timingSafeEqual(d(header == null ? '' : header), d(`Bearer ${secret}`));
}

module.exports = { MAX, WINDOW, KEEP, ipOf, wait, failed, tooMany, bearerOk, _reset: () => FAILS.clear(), _size: () => FAILS.size };
