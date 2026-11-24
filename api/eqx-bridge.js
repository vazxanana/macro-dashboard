// The Equinox bridge (24 Nov 2026, owner chose "A. Personal key"): a member's own MetaTrader 5 follows the Equinox desks.
//   POST /api/eqx-bridge { action: 'mykey' }   signed in, same origin -> { url, desks } (the member's own feed address)
//   GET  /api/eqx-bridge?key=<key>[&desks=fade,bigfade]   the feed as CSV for that member's bot (mt5/EquinoxBridge.mq5)
// The key is derived from the session key (api/_eqx-bridge.js `keyOf`): nothing is stored, no broker login or password ever
// reaches the site, and the key opens this feed only. Each read checks the account as it stands (removed, disabled or the desks
// permission switched off = 403; an unreadable user list = 503, fails closed). A wrong key counts as a failed password check.
// EQX_BRIDGE=off stops it. 60 reads a minute a key (memory, per instance). The feed is desk records (paper readings of rules
// that lose after costs in their studies); the bot refuses any account that is not a demo. Nothing here places an order.
const S = require('./_session.js');
const G = require('./_guard.js');
const E = require('./_eqx-bridge.js');
const ORIGIN = 'https://aureumdesk.co.uk', HOSTS = ['aureumdesk.co.uk', 'www.aureumdesk.co.uk'];
const originOf = (req) => { const h = String((req.headers && req.headers.host) || '').toLowerCase(); return HOSTS.includes(h) || /^localhost(:\d+)?$/.test(h) || /\.workers\.dev$/.test(h) ? `${/^localhost/.test(h) ? 'http' : 'https'}://${h}` : ORIGIN; };
async function files(env, d) {
  const read = d.readFile || require('./data.js').readFile, out = {};
  await Promise.all(E.DESKS.map(async (k) => { const r = await read(`${k}/desk.json`, env); if (!r || !r.ok) throw new Error(`${k} desk file could not be read`); out[k] = JSON.parse(r.buf.toString('utf8')); }));
  return out;
}
async function handle(req, res, d = {}) {
  const env = d.env || process.env, now = d.now ? d.now() : Date.now(); res.setHeader('Cache-Control', 'private, no-store');
  if (String(env.EQX_BRIDGE || '').toLowerCase() === 'off') return res.status(503).json({ error: 'The bridge is switched off.' });
  const secret = S.secret(env); if (!secret) return res.status(503).json({ error: 'The bridge is not set up.' });
  const deps = d.deps || S.defaultDeps(env);
  try {
    if (req.method === 'POST') {
      if (!S.sameOrigin(req)) return res.status(403).json({ error: 'Not allowed from another site.' });
      const acct = await (d.who ? d.who(req) : S.fromRequest(req, env, deps));
      if (!acct) return res.status(401).json({ error: 'Sign in first.' });
      if (!E.canUse(acct)) return res.status(403).json({ error: 'Your account does not have the desks.' });
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!b || b.action !== 'mykey') return res.status(400).json({ error: 'unknown action' });
      return res.status(200).json({ url: `${originOf(req)}/api/eqx-bridge?key=${E.keyOf(secret, acct.u)}`, desks: E.DESKS.map((k) => ({ k, name: E.NAMES[k] })) });
    }
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'GET or POST' }); }
    const wait = G.wait(req, now); if (wait) { res.setHeader('Retry-After', String(wait)); return res.status(429).json({ error: 'Too many tries. Wait and try again.' }); }
    const u = E.whoOf(secret, req.query && req.query.key);
    if (!u) { G.failed(req, now); return res.status(401).json({ error: 'Key not accepted.' }); }
    const slow = G.hit('eqx-bridge', u, 60, 60e3, now); if (slow) { res.setHeader('Retry-After', String(slow)); return res.status(429).json({ error: 'Too many reads. One every few seconds is enough.' }); }
    let acct;
    if (u === 'owner') acct = { u: 'owner', role: 'owner' };
    else { const users = d.users ? await d.users() : await S.cachedUsers(deps, 60e3, now); const R = users[u]; acct = R ? S.account(u, R) : null; }
    if (!E.canUse(acct)) return res.status(403).json({ error: 'This key is no longer allowed.' });
    const only = String((req.query && req.query.desks) || '').split(',').map((x) => x.trim()).filter((x) => E.DESKS.includes(x));
    const rows = E.lines(await files(env, d), Math.floor(now / 1000), only);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.status(200).send(E.csv(rows, Math.floor(now / 1000)));
  } catch (e) {
    const st = e && e.status === 503 ? 503 : 502;
    return res.status(st).json({ error: st === 503 ? 'The member list could not be read. Try again.' : 'The desks could not be read. Try again.' });
  }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
