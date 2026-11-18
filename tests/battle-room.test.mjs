// ChronosTrade battles (18 Nov 2026): the ticket (api/_battle.js), the door (api/battle.js) and the room (cloudflare/src/battle-room.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Room, Inbox, MAX, TTL_MS, INVITE_MS } from '../cloudflare/src/battle-room.mjs';
const require = createRequire(import.meta.url);
const B = require('../api/_battle.js'), S = require('../api/_session.js'), H = require('../api/battle.js'), G = require('../api/_guard.js');
const ENV = { SESSION_SECRET: 'battle-test-secret-0123456789' };

test('battle ticket: signed with its own key, two minutes, never a session and never from a session', () => {
  const now = 1.8e12, t = B.ticket(ENV, { u: 'fred', n: 'Fred', room: 'ABC234' }, now);
  assert.deepEqual(B.readTicket(ENV, t, now + 1000), { u: 'fred', n: 'Fred', room: 'ABC234' });
  assert.equal(B.readTicket(ENV, t, now + B.TTL + 1), null, 'expired');
  assert.equal(B.readTicket({ SESSION_SECRET: 'another-secret-0123456789' }, t, now), null, 'another key');
  const [body, mac] = t.split('.'), forged = Buffer.from(JSON.stringify({ v: 'bt', u: 'owner', n: 'x', room: 'ABC234', exp: now + 1e5 })).toString('base64url');
  assert.equal(B.readTicket(ENV, `${forged}.${mac}`, now), null, 'a changed body fails');
  assert.equal(S.verify(ENV, t, now), null, 'a ticket is not a session');
  const sess = S.sign(ENV, { v: 1, u: 'fred', f: 'x', iat: now, exp: now + 1e6 });
  assert.equal(B.readTicket(ENV, sess, now), null, 'a session is not a ticket');
  assert.throws(() => B.ticket({}, { u: 'a', room: 'ABC234' }), /not set up/);
  assert.equal(body.length > 10, true);
});

test('battle codes: 6 characters a person can read aloud; typed or pasted forms are cleaned', () => {
  for (let i = 0; i < 200; i++) { const c = B.newCode(); assert.match(c, /^[A-HJ-KM-NP-Z2-9]{6}$/); }
  assert.equal(B.cleanCode(' abc234 '), 'ABC234'); assert.equal(B.cleanCode('https://aureumdesk.co.uk/backtest#battle=XYZ789'), 'XYZ789');
  assert.equal(B.cleanCode('ABC10O'), null, 'no 0 / O / 1'); assert.equal(B.cleanCode('AB'), null);
});

test('/api/battle: GET says whether rooms are open; POST needs the same origin, a session, and gives a ticket for its own room', async () => {
  const call = async (req, d) => { const out = {}; const res = { setHeader(k, v) { (out.h ||= {})[k] = v; }, status(c) { out.code = c; return res; }, json(j) { out.json = j; return res; } }; await H.handle(req, res, { env: ENV, sameOrigin: () => true, ...d }); return out; };
  G._reset();
  assert.deepEqual((await call({ method: 'GET' }, { rooms: true })).json, { open: true, max: MAX });
  assert.equal((await call({ method: 'POST', body: { create: true } }, { rooms: true, who: async () => null })).code, 401);
  assert.equal((await call({ method: 'POST', body: { create: true } }, { rooms: true, sameOrigin: () => false, who: async () => ({ u: 'x' }) })).code, 403);
  assert.equal((await call({ method: 'POST', body: { create: true } }, { rooms: false, who: async () => ({ u: 'x' }) })).code, 503);
  const who = async () => ({ u: 'luxus', name: 'Luxus' });
  const c = await call({ method: 'POST', body: { create: true } }, { rooms: true, who }); assert.equal(c.code, 200); assert.match(c.json.room, /^[A-Z2-9]{6}$/);
  assert.deepEqual(B.readTicket(ENV, c.json.ticket), { u: 'luxus', n: 'Luxus', room: c.json.room });
  const j = await call({ method: 'POST', body: JSON.stringify({ join: c.json.room.toLowerCase() }) }, { rooms: true, who }); assert.equal(j.json.room, c.json.room);
  assert.equal((await call({ method: 'POST', body: { join: 'nope' } }, { rooms: true, who })).code, 400);
  G._reset();
});

function harness(t0 = 1.8e12) {
  let now = t0; const out = new Map(), closed = [];
  const room = new Room({ send: (id, m) => { if (!out.has(id)) out.set(id, []); out.get(id).push(m); }, close: (id, code, why) => closed.push([id, code, why]), now: () => now });
  return { room, out, closed, last: (id, t) => (out.get(id) || []).filter((m) => !t || m.t === t).pop(), tick: (ms) => { now += ms; }, msg: (id, m) => room.message(id, JSON.stringify(m)) };
}
const SETUP = { sym: 'xau', tf: '15m', from: 1.79e9, to: 1.79e9 + 86400 * 5, startAt: 1.79e9 + 86400, balance: 100000, name: 'Gold battle' };

test('room: the first account is the host; up to four players; a fifth is refused; one socket per account', () => {
  const h = harness();
  h.room.join(1, { u: 'owner', n: 'Owner', room: 'ABC234' });
  assert.equal(h.last(1, 'welcome').room.host, 'owner');
  for (const [i, u] of [[2, 'fred'], [3, 'luxus'], [4, 'carlos']]) h.room.join(i, { u, n: u, room: 'ABC234' });
  assert.equal(h.last(1, 'room').room.players.length, 4);
  assert.equal(h.room.join(5, { u: 'orlando', n: 'Orlando', room: 'ABC234' }), false); assert.equal(h.last(5, 'error').code, 'full'); assert.deepEqual(h.closed.pop(), [5, 4001, 'full']);
  h.room.join(6, { u: 'fred', n: 'Fred', room: 'ABC234' }); assert.deepEqual(h.closed.pop(), [2, 4000, 'opened in another tab']);
  assert.equal(h.last(6, 'welcome').room.players.length, 4, 'a second tab of a player is not a fifth player');
});

test('room: only the host sets up, starts and runs the clock; the clock never goes back or leaves the window', () => {
  const h = harness();
  h.room.join(1, { u: 'owner', n: 'Owner', room: 'ABC234' }); h.room.join(2, { u: 'fred', n: 'Fred', room: 'ABC234' });
  h.msg(2, { t: 'setup', setup: SETUP }); assert.equal(h.last(2, 'error').code, 'setup', 'a guest cannot set the battle up');
  h.msg(1, { t: 'setup', setup: { ...SETUP, startAt: SETUP.to + 10 } }); assert.equal(h.last(1, 'error').code, 'setup', 'the start lies inside the window');
  h.msg(1, { t: 'setup', setup: { ...SETUP, sym: 'XAU<script>' } }); assert.equal(h.last(1, 'error').code, 'setup');
  h.msg(1, { t: 'setup', setup: SETUP }); assert.equal(h.last(2, 'room').room.setup.sym, 'xau');
  h.msg(1, { t: 'clock', T: SETUP.startAt + 900 }); assert.equal(h.last(2, 'clock'), undefined, 'no clock before the start');
  h.msg(2, { t: 'go' }); assert.equal(h.room.phase, 'lobby', 'a guest cannot start it');
  h.msg(1, { t: 'go', T: SETUP.startAt - 900 }); assert.equal(h.room.phase, 'live'); assert.equal(h.last(2, 'room').room.clock.T, SETUP.startAt - 900, 'the clock starts at the host\'s moment');
  h.msg(1, { t: 'clock', T: SETUP.startAt + 900, playing: true, speed: 200 }); assert.equal(h.last(2, 'clock').clock.T, SETUP.startAt + 900);
  assert.equal(h.last(1, 'clock'), undefined, 'the host is not sent its own clock');
  h.msg(1, { t: 'clock', T: SETUP.startAt }); assert.equal(h.room.clock.T, SETUP.startAt + 900, 'never backwards');
  h.msg(2, { t: 'clock', T: SETUP.startAt + 99999 }); assert.equal(h.room.clock.T, SETUP.startAt + 900, 'a guest cannot move the clock');
  h.msg(1, { t: 'clock', T: SETUP.to + 1e6 }); assert.equal(h.room.clock.T, SETUP.to, 'held inside the window');
  h.msg(1, { t: 'setup', setup: { ...SETUP, sym: 'eurusd' } }); assert.equal(h.room.setup.sym, 'xau', 'the setup is fixed once the battle runs');
});

test('room: stats are clamped and shared; chat is short, plain and paced; the host ends it and no one new joins', () => {
  const h = harness();
  h.room.join(1, { u: 'owner', n: 'Owner', room: 'ABC234' }); h.room.join(2, { u: 'fred', n: 'Fred', room: 'ABC234' });
  h.msg(2, { t: 'stat', stat: { pct: 5 } }); assert.equal(h.last(1, 'stat'), undefined, 'no standings in the lobby');
  h.msg(1, { t: 'setup', setup: SETUP }); h.msg(1, { t: 'go' });
  h.msg(2, { t: 'stat', stat: { pct: 1e9, trades: 3.4, wins: 2, open: 1, eq: 101250, last: '<b>Closed</b> +2R' } });
  const s = h.last(1, 'stat'); assert.equal(s.u, 'fred'); assert.equal(s.stat.pct, 1e5); assert.equal(s.stat.trades, 3); assert.equal(s.stat.last, 'bClosed/b +2R');
  h.msg(2, { t: 'stat', stat: { pct: 2 } }); assert.equal(h.room.players.get('fred').stat.pct, 1e5, 'paced: at most one every 250 ms');
  h.tick(300); h.msg(2, { t: 'stat', stat: { pct: 'x' } }); assert.equal(h.room.players.get('fred').stat.pct, 0);
  h.msg(2, { t: 'chat', text: 'gl hf\u0007' }); assert.equal(h.last(1, 'chat').chat.text, 'gl hf');
  h.msg(2, { t: 'chat', text: 'spam' }); assert.equal(h.room.chat.length, 1, 'paced');
  h.tick(1000); h.msg(2, { t: 'chat', text: 'x'.repeat(500) }); assert.equal(h.room.chat[1].text.length, 140);
  h.room.message(2, 'y'.repeat(5000)); assert.equal(h.last(2, 'error').code, 'size');
  h.msg(2, { t: 'end' }); assert.equal(h.room.phase, 'live');
  h.msg(1, { t: 'end' }); assert.equal(h.room.phase, 'ended'); assert.equal(h.last(2, 'room').room.phase, 'ended');
  assert.equal(h.room.join(3, { u: 'luxus', n: 'Luxus', room: 'ABC234' }), false); assert.equal(h.last(3, 'error').code, 'ended');
  h.room.join(4, { u: 'fred', n: 'Fred', room: 'ABC234' }); assert.equal(h.last(4, 'welcome').room.phase, 'ended', 'a player can still see the final standings');
});

test('room: a guest who leaves the lobby frees the seat; the host keeps the clock across a reconnect; old rooms take no one new', () => {
  const h = harness();
  h.room.join(1, { u: 'owner', n: 'Owner', room: 'ABC234' }); h.room.join(2, { u: 'fred', n: 'Fred', room: 'ABC234' });
  h.room.leave(2); assert.equal(h.room.players.has('fred'), false);
  h.room.leave(1); h.room.join(3, { u: 'owner', n: 'Owner', room: 'ABC234' }); assert.equal(h.last(3, 'welcome').room.host, 'owner');
  h.msg(3, { t: 'setup', setup: SETUP }); assert.ok(h.room.setup, 'the returning host still runs it');
  h.tick(TTL_MS + 1); assert.equal(h.room.join(4, { u: 'carlos', n: 'Carlos', room: 'ABC234' }), false); assert.equal(h.last(4, 'error').code, 'expired');
});

test('battle wiring: the Worker checks the ticket before the room, routes the door, and binds the Durable Object', () => {
  const w = fs.readFileSync('cloudflare/src/worker.mjs', 'utf8'), wr = fs.readFileSync('cloudflare/wrangler.jsonc', 'utf8');
  assert.match(w, /if \(orig\.pathname === '\/api\/battle-ws'\) return battleWs\(request, env, orig\);/);
  assert.match(w, /const who = battleTickets\.readTicket\(process\.env, url\.searchParams\.get\('t'\)\);\n\s*if \(!who \|\| who\.kind\) return new Response/);
  assert.match(w, /if \(h !== url\.host\) return new Response\('not allowed', \{ status: 403 \}\)/, 'a foreign page cannot open a room socket');
  assert.match(w, /export class BattleRoom extends DurableObject/);
  assert.match(wr, /"durable_objects": \{ "bindings": \[\{ "name": "BATTLE", "class_name": "BattleRoom" \}\] \}/);
  assert.match(wr, /"new_sqlite_classes": \["BattleRoom"\]/);
  const room = fs.readFileSync('cloudflare/src/battle-room.mjs', 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.doesNotMatch(room, /\bimport\b|fetch\(|order|ctrader|council/i, 'the room imports nothing and touches no order, broker or council file');
});

test('invites: a box ticket is its own kind; it never opens a room and a room ticket never opens a box', () => {
  const now = 1.8e12, box = B.ticket(ENV, { u: 'owner', n: 'Owner', kind: 'box' }, now), room = B.ticket(ENV, { u: 'owner', n: 'Owner', room: 'ABC234' }, now);
  assert.deepEqual(B.readTicket(ENV, box, now), { u: 'owner', n: 'Owner', kind: 'box' });
  assert.equal(B.readTicket(ENV, room, now).kind, undefined);
  const w = fs.readFileSync('cloudflare/src/worker.mjs', 'utf8');
  assert.match(w, /if \(!who \|\| who\.kind !== 'box'\) return Response\.json\(\{ error: 'ticket expired/, 'the inbox wants a box ticket');
  assert.match(w, /if \(!who \|\| !who\.u \|\| !who\.room \|\| who\.kind\) return new Response\('bad request'/, 'the room refuses a box ticket');
});

test('invites: sent to members by key, seen only by them, accepted or declined once, the inviter told; they expire and are paced', () => {
  let now = 1.8e12; const ib = new Inbox({ now: () => now }), owner = { u: 'owner', n: 'Owner' }, fred = { u: 'fred', n: 'Fred' }, lux = { u: 'luxus', n: 'Luxus' };
  assert.deepEqual(ib.handle(owner, { op: 'invite', room: 'ABC234', to: ['fred', 'luxus', 'owner', '../x', 'carlos', 'orlando'], what: 'XAU 15s <b>' }), { sent: ['fred', 'luxus'] }, 'at most three, never yourself, plain keys only');
  assert.equal(ib.handle(owner, { op: 'invite', room: 'abc', to: ['fred'] }).error, 'bad room code');
  const l = ib.handle(fred, { op: 'list' }); assert.equal(l.invites.length, 1); assert.deepEqual([l.invites[0].from, l.invites[0].fn, l.invites[0].room, l.invites[0].what], ['owner', 'Owner', 'ABC234', 'XAU 15s b']);
  assert.equal(ib.handle({ u: 'carlos', n: 'C' }, { op: 'list' }).invites.length, 0, 'nobody else sees it');
  assert.deepEqual(ib.handle(fred, { op: 'answer', room: 'ABC234', accept: true }), { ok: true, room: 'ABC234', accept: true });
  assert.equal(ib.handle(fred, { op: 'answer', room: 'ABC234', accept: true }).error, 'That invite has expired.', 'once');
  ib.handle(lux, { op: 'answer', room: 'ABC234', accept: false });
  const r = ib.handle(owner, { op: 'list' }).replies; assert.deepEqual(r.map((x) => [x.u, x.accept]), [['fred', true], ['luxus', false]]);
  assert.equal(ib.handle(owner, { op: 'list' }).replies.length, 0, 'replies are delivered once');
  ib.handle(owner, { op: 'invite', room: 'XYZ789', to: ['fred'] }); now += INVITE_MS + 1; assert.equal(ib.handle(fred, { op: 'list' }).invites.length, 0, 'expired');
  for (let i = 0; i < 8; i++) ib.handle(owner, { op: 'invite', room: 'XYZ789', to: ['a1', 'a2', 'a3'] });
  assert.match(ib.handle(owner, { op: 'invite', room: 'XYZ789', to: ['a4', 'a5', 'a6'] }).error, /Too many invites/);
});

test('/api/battle { box }: a box ticket and the other members, never your own key, never a hash', async () => {
  G._reset(); const out = {}; const res = { setHeader() {}, status(c) { out.code = c; return res; }, json(j) { out.json = j; return res; } };
  await H.handle({ method: 'POST', body: { box: true } }, res, { env: ENV, rooms: true, sameOrigin: () => true, who: async () => ({ u: 'fred', name: 'Fred' }), users: async () => ({ fred: { name: 'Fred', hash: 'h1' }, luxus: { name: 'Luxus', hash: 'h2' } }) });
  assert.equal(out.code, 200); assert.deepEqual(out.json.members, [{ u: 'luxus', n: 'Luxus' }, { u: 'owner', n: 'Owner' }]);
  assert.doesNotMatch(JSON.stringify(out.json.members), /h1|h2|hash/); assert.equal(B.readTicket(ENV, out.json.ticket).kind, 'box'); G._reset();
});
