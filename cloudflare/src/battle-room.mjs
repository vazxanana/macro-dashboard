// ChronosTrade battle room (18 Nov 2026, owner: "allow battle with someone so the user can connect with max 4 people and they
// can backtest live same chart and they can see the % profit").
//
// One room = one replay. The HOST picks the market, timeframe, start and balance (`setup`), starts the battle (`go`) and runs
// the replay clock (`clock`: the replay moment T, never backwards); every player's page follows that moment, so everyone sees
// the same candle at the same time and nobody can look ahead. Each player trades on their OWN paper account in their own
// browser and sends its result (`stat`: % profit with floating, trades, wins, open); the room shares the standings. Up to four
// players; the host keeps the clock after a reconnect. Paper only: nothing here touches an order, a broker or a council file.
//
// Pure: no Cloudflare API. `send(peer, msg)` and `close(peer, code, why)` are handed in; the Durable Object (worker.mjs) wires
// them to WebSockets. Tested in tests/battle-room.test.mjs.
export const MAX = 4, TTL_MS = 6 * 3600e3, MSG_MAX = 2048, CHAT_MAX = 140, STAT_GAP_MS = 250, CHAT_GAP_MS = 800;
export const TFS = ['15s', '30s', '1m', '2m', '5m', '10m', '15m', '30m', '1h', '2h', '4h', '1d'];
const num = (v, lo, hi) => { const x = +v; return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null; };
const int = (v, lo, hi) => { const x = num(v, lo, hi); return x == null ? null : Math.round(x); };
const text = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);

export class Room {
  constructor({ send, close, now = () => Date.now() }) {
    this.send = send; this.close = close; this.now = now;
    this.peers = new Map();     // peer id -> account key
    this.players = new Map();   // account key -> player
    this.hostU = null; this.code = null; this.created = 0; this.phase = 'lobby'; this.setup = null; this.clock = null; this.started = 0; this.ended = 0;
    this.chat = [];
  }
  view() {
    const P = [...this.players.values()].map((p) => ({ u: p.u, n: p.n, host: p.u === this.hostU, online: p.peers.size > 0, joined: p.joined, ...p.stat }));
    return { code: this.code, phase: this.phase, host: this.hostU, setup: this.setup, clock: this.clock, started: this.started, ended: this.ended, max: MAX, players: P, chat: this.chat.slice(-20) };
  }
  all(msg, but) { for (const [pid] of this.peers) if (pid !== but) this.send(pid, msg); }
  // who = { u, n, room } from a ticket the Worker has verified
  join(pid, who) {
    const t = this.now();
    if (!this.hostU) { this.hostU = who.u; this.code = who.room; this.created = t; }
    else if (t - this.created > TTL_MS && !this.players.has(who.u)) return this.refuse(pid, 'expired', 'This battle has expired. Start a new one.');
    if (!this.players.has(who.u)) {
      if (this.players.size >= MAX) return this.refuse(pid, 'full', `This battle already has ${MAX} players.`);
      if (this.phase === 'ended') return this.refuse(pid, 'ended', 'This battle has ended.');
      this.players.set(who.u, { u: who.u, n: text(who.n, 24) || who.u, joined: t, peers: new Set(), stat: { pct: 0, eq: null, trades: 0, wins: 0, open: 0, last: '', at: 0 }, lastStat: 0, lastChat: 0 });
    }
    const p = this.players.get(who.u);
    for (const old of [...p.peers]) { p.peers.delete(old); this.peers.delete(old); this.close(old, 4000, 'opened in another tab'); }   // one live socket per account
    p.peers.add(pid); this.peers.set(pid, who.u);
    this.send(pid, { t: 'welcome', you: who.u, room: this.view() });
    this.all({ t: 'room', room: this.view() }, pid);
    return true;
  }
  refuse(pid, code, why) { this.send(pid, { t: 'error', code, why }); this.close(pid, 4001, code); return false; }
  leave(pid) {
    const u = this.peers.get(pid); if (!u) return; this.peers.delete(pid);
    const p = this.players.get(u); if (p) { p.peers.delete(pid); if (this.phase === 'lobby' && !p.peers.size && u !== this.hostU) this.players.delete(u); }
    this.all({ t: 'room', room: this.view() });
  }
  message(pid, raw) {
    const u = this.peers.get(pid); if (!u) return;
    if (typeof raw !== 'string' || raw.length > MSG_MAX) return this.send(pid, { t: 'error', code: 'size', why: 'message too large' });
    let m; try { m = JSON.parse(raw); } catch (e) { return; } if (!m || typeof m !== 'object') return;
    const p = this.players.get(u), host = u === this.hostU, t = this.now();
    switch (m.t) {
      case 'setup': {   // host, before the start: the session every player loads
        if (!host || this.phase !== 'lobby') return this.send(pid, { t: 'error', code: 'setup', why: 'only the host sets the battle up, before it starts' });
        const s = m.setup || {}, sym = /^[a-z0-9]{2,12}$/.test(s.sym) ? s.sym : null, tf = TFS.includes(s.tf) ? s.tf : null;
        const from = int(s.from, 1e9, 4e9), to = int(s.to, 1e9, 4e9), startAt = int(s.startAt, 1e9, 4e9), bal = num(s.balance, 100, 1e9);
        if (!sym || !tf || !from || !to || !startAt || !bal || !(from < startAt && startAt < to)) return this.send(pid, { t: 'error', code: 'setup', why: 'bad battle setup' });
        this.setup = { sym, tf, from, to, startAt, balance: bal, name: text(s.name, 60), comm: num(s.comm, 0, 1000) || 0, spread: num(s.spread, 0, 1e6) || 0, slFirst: s.slFirst !== false, dec: int(s.dec, 0, 8) };
        this.clock = null; return this.all({ t: 'room', room: this.view() });
      }
      case 'go': {   // host: the battle starts at the host's replay moment (the end of the bar before the setup's start)
        if (!host || this.phase !== 'lobby' || !this.setup) return;
        const T0 = int(m.T, this.setup.from, this.setup.to); this.phase = 'live'; this.started = t; this.clock = { T: T0 == null ? this.setup.startAt : T0, playing: false, speed: 1000, at: t };
        return this.all({ t: 'room', room: this.view() });
      }
      case 'clock': {   // host: the replay moment; never backwards, never outside the loaded window
        if (!host || this.phase !== 'live') return;
        const T = int(m.T, this.setup.from, this.setup.to); if (T == null || T < this.clock.T) return;
        this.clock = { T, playing: !!m.playing, speed: int(m.speed, 10, 5000) || this.clock.speed, at: t };
        return this.all({ t: 'clock', clock: this.clock }, pid);
      }
      case 'stat': {   // any player: their own account's standing
        if (this.phase === 'lobby' || t - p.lastStat < STAT_GAP_MS) return; p.lastStat = t;
        const s = m.stat || {};
        p.stat = { pct: num(s.pct, -100, 1e5) ?? 0, eq: num(s.eq, 0, 1e12), trades: int(s.trades, 0, 1e5) ?? 0, wins: int(s.wins, 0, 1e5) ?? 0, open: int(s.open, 0, 100) ?? 0, R: num(s.R, -1e4, 1e4), last: text(s.last, 60), at: t };
        return this.all({ t: 'stat', u, stat: p.stat });
      }
      case 'chat': {
        const msg = text(m.text, CHAT_MAX); if (!msg || t - p.lastChat < CHAT_GAP_MS) return; p.lastChat = t;
        const c = { u, n: p.n, text: msg, at: t }; this.chat.push(c); if (this.chat.length > 50) this.chat.shift();
        return this.all({ t: 'chat', chat: c });
      }
      case 'end': {   // host: final standings
        if (!host || this.phase !== 'live') return;
        this.phase = 'ended'; this.ended = t; return this.all({ t: 'room', room: this.view() });
      }
      case 'ping': return this.send(pid, { t: 'pong', at: t });
      default: return;
    }
  }
}

// Invites (18 Nov 2026, owner: "so the user can invite and the other player can accept and start the online live backtesting").
// One inbox for the whole site (a single Durable Object): a player in a room invites members by account key; each invitee's
// ChronosTrade page reads its open invites every few seconds and can accept (it then joins the room with its own ticket, the room
// still deciding full / ended) or decline (the inviter is told). Invites last INVITE_MS; kept in memory only. Pure, like Room.
export const INVITE_MS = 15 * 60e3, INVITES_PER_10MIN = 20;
const CODE = /^[A-HJ-KM-NP-Z2-9]{6}$/, KEY = /^[A-Za-z0-9_.-]{1,40}$/;
export class Inbox {
  constructor({ now = () => Date.now() } = {}) { this.now = now; this.inv = new Map(); this.replies = new Map(); this.sent = new Map(); }
  sweep() { const t = this.now(); for (const [k, v] of this.inv) if (t - v.at > INVITE_MS) this.inv.delete(k); for (const [u, a] of this.replies) { const b = a.filter((r) => t - r.at < INVITE_MS); if (b.length) this.replies.set(u, b); else this.replies.delete(u); } }
  invite(from, body) {
    this.sweep(); const t = this.now(), room = String(body && body.room || ''), to = Array.isArray(body && body.to) ? body.to.slice(0, 3) : [];
    if (!CODE.test(room)) return { error: 'bad room code' };
    const recent = (this.sent.get(from.u) || []).filter((x) => t - x < 10 * 60e3); if (recent.length + to.length > INVITES_PER_10MIN) return { error: 'Too many invites: wait a few minutes.' };
    const ok = [];
    for (const u of to) { if (typeof u !== 'string' || !KEY.test(u) || u === from.u) continue; this.inv.set(`${u}|${room}`, { to: u, from: from.u, fn: text(from.n, 24) || from.u, room, what: text(body.what, 80), at: t }); ok.push(u); recent.push(t); }
    this.sent.set(from.u, recent); return { sent: ok };
  }
  list(u) { this.sweep(); const invites = [...this.inv.values()].filter((x) => x.to === u).sort((a, b) => b.at - a.at).map(({ to, ...x }) => x); const replies = this.replies.get(u) || []; this.replies.delete(u); return { invites, replies }; }
  answer(who, body) {
    this.sweep(); const room = String(body && body.room || ''), k = `${who.u}|${room}`, iv = this.inv.get(k); if (!iv) return { error: 'That invite has expired.' };
    this.inv.delete(k); const accept = !!(body && body.accept), r = { u: who.u, n: text(who.n, 24) || who.u, room, accept, at: this.now() };
    const a = this.replies.get(iv.from) || []; a.push(r); this.replies.set(iv.from, a.slice(-20)); return { ok: true, room, accept };
  }
  handle(who, body) { const op = body && body.op; if (op === 'invite') return this.invite(who, body); if (op === 'answer') return this.answer(who, body); if (op === 'list') return this.list(who.u); return { error: 'unknown op' }; }
}
