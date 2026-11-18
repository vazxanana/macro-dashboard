// ChronosTrade battles (18 Nov 2026, owner: "allow battle with someone so the user can connect with max 4 people and they can
// backtest live same chart and they can see the % profit"). This module only signs and reads the short-lived TICKET that lets a
// signed-in member open the room's WebSocket; the room itself lives in a Durable Object (cloudflare/src/battle-room.mjs).
//
// Ticket: base64url(JSON { v: 'bt', u, n, room, exp }) + "." + HMAC-SHA256 with a key DERIVED from the session key and its own
// label, so a ticket can never be read as a session cookie and a session cookie never opens a room. Two minutes to live: the
// page asks /api/battle for a fresh one on every (re)connect. Paper only: a battle moves no money and places no order anywhere.
const crypto = require('node:crypto');
const S = require('./_session');

const LABEL = 'aureum/battle/v1', TTL = 120e3, MAX_PLAYERS = 4;
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0 / O / 1 / I / L: read aloud without mistakes
const b64u = (b) => Buffer.from(b).toString('base64url');

function key(env = process.env) { const base = S.secret(env); return base ? crypto.createHmac('sha256', base).update(LABEL).digest() : null; }
const mac = (k, body) => b64u(crypto.createHmac('sha256', k).update(body).digest());

// a room code: 6 letters / digits from ALPHA
function newCode(rand = crypto.randomBytes) { const b = rand(6); let s = ''; for (let i = 0; i < 6; i++) s += ALPHA[b[i] % ALPHA.length]; return s; }
// the code as typed (spaces, lower case, a pasted invite link) -> 6 characters of ALPHA, or null
function cleanCode(v) { const m = /(?:battle=)?([A-Za-z0-9]{6})\s*$/.exec(String(v || '').trim()); if (!m) return null; const c = m[1].toUpperCase(); return [...c].every((x) => ALPHA.includes(x)) ? c : null; }

// kind: none = a room's socket (room = its code); 'box' = the member's own invite inbox (no room): send invites, read the
// invites sent to you, accept or decline them. A box ticket never opens a room and a room ticket never opens a box.
function ticket(env, { u, n, room, kind }, now = Date.now()) {
  const k = key(env); if (!k) throw Object.assign(new Error('battles are not set up'), { status: 503 });
  if (typeof u !== 'string' || !u || (kind !== 'box' && !cleanCode(room))) throw Object.assign(new Error('bad ticket'), { status: 400 });
  const body = b64u(JSON.stringify({ v: 'bt', u, n: String(n || u).slice(0, 24), ...(kind === 'box' ? { k: 'box' } : { room }), exp: now + TTL }));
  return `${body}.${mac(k, body)}`;
}
// the payload of a well-formed, untampered, unexpired ticket; null otherwise
function readTicket(env, tok, now = Date.now()) {
  const k = key(env); if (!k || typeof tok !== 'string' || tok.length > 600) return null;
  const [body, m, extra] = tok.split('.'); if (!body || !m || extra !== undefined) return null;
  const want = mac(k, body); if (want.length !== m.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(m))) return null;
  let o; try { o = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch (e) { return null; }
  if (!o || o.v !== 'bt' || typeof o.u !== 'string' || !o.u || !(o.exp > now) || o.exp > now + TTL + 60e3) return null;
  if (o.k === 'box') return { u: o.u, n: String(o.n || o.u).slice(0, 24), kind: 'box' };
  if (o.k !== undefined || !cleanCode(o.room)) return null;
  return { u: o.u, n: String(o.n || o.u).slice(0, 24), room: o.room };
}

module.exports = { LABEL, TTL, MAX_PLAYERS, ALPHA, newCode, cleanCode, ticket, readTicket, key };
