// ChronosTrade battles (18 Nov 2026): the door to a room. A signed-in member asks for a ticket here, then opens the room's
// WebSocket at /api/battle-ws?t=<ticket> (answered by the Worker and its Durable Object, cloudflare/src/battle-room.mjs).
//   GET  /api/battle                     -> { open }: whether this host runs battle rooms (the Worker's BATTLE binding)
//   POST /api/battle { create: true }    signed in, same origin -> { room, ticket } for a NEW room code (you are its host)
//   POST /api/battle { join: "<code>" }  signed in, same origin -> { room, ticket } for that room (the room decides host / full)
//   POST /api/battle { box: true }       signed in, same origin -> { ticket, members }: the invite inbox's ticket (POST /api/battle-inbox)
// The ticket carries only the account key, its display name and the room code, lives two minutes and opens nothing else.
const S = require('./_session.js');
const B = require('./_battle.js');
const G = require('./_guard.js');

let ROOMS = false;   // set per request by the Worker (it has the Durable Object binding; Node and the tests do not)
async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'private, no-store');
  const open = d.rooms != null ? !!d.rooms : ROOMS;
  try {
    if (req.method === 'GET') return res.status(200).json({ open, max: B.MAX_PLAYERS });
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    if (!(d.sameOrigin || S.sameOrigin)(req)) return res.status(403).json({ error: 'not allowed' });
    const acct = await (d.who || ((r) => S.fromRequest(r, env, S.defaultDeps(env), { cacheMs: 60e3 })))(req);
    if (!acct) return res.status(401).json({ error: 'Sign in on the desk first.' });
    if (!open) return res.status(503).json({ error: 'Battles are not open on this site yet.' });
    const wait = G.hit('battle', acct.u, 30, 10 * 60e3, d.now); if (wait) { res.setHeader('Retry-After', String(wait)); return res.status(429).json({ error: 'Too many battle requests: try again in a minute.' }); }
    let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    b = b || {};
    // the member's invite inbox (18 Nov 2026, owner: "the user can invite and the other player can accept"): a box ticket, and
    // the members one can invite (key and display name only: every signed-in member may see who else has a seat)
    if (b.box) {
      let members = [];
      try { const L = await (d.users || (() => require('./_accounts.js').userList(S.defaultDeps(env))))(); members = Object.entries(L).filter(([k, r]) => k !== acct.u && r && !r.disabled).map(([k, r]) => ({ u: k, n: String(r.name || k).slice(0, 24) })); } catch (e) { members = []; }
      if (acct.u !== 'owner') members.push({ u: 'owner', n: 'Owner' });
      members.sort((x, y) => x.n.localeCompare(y.n));
      return res.status(200).json({ ticket: B.ticket(env, { u: acct.u, n: acct.name || acct.u, kind: 'box' }, d.now), members });
    }
    const room = b.create ? B.newCode(d.rand) : B.cleanCode(b.join);
    if (!room) return res.status(400).json({ error: 'A room code is 6 letters and digits.' });
    return res.status(200).json({ room, ticket: B.ticket(env, { u: acct.u, n: acct.name || acct.u, room }, d.now), max: B.MAX_PLAYERS });
  } catch (e) { return res.status(e.status === 503 ? 503 : 500).json({ error: e.status === 503 ? 'Battles are not set up on this site.' : 'Battle service unavailable.' }); }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.useRooms = (on) => { ROOMS = !!on; };
