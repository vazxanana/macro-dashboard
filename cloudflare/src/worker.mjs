// Meridian X on Cloudflare Workers.
// - out/ (the committed build) is served as static assets, with vercel.json's rewrites and headers.
// - /api/<name> runs the unchanged handler api/<name>.js through ./adapter.mjs.
// - Scheduled jobs call the same handlers as Vercel's crons did, with the cron secret.
import vercel from '../../vercel.json';
import { EmailMessage } from 'cloudflare:email';
import { DurableObject } from 'cloudflare:workers';
import { run } from './adapter.mjs';
import { rewrite, headersFor } from './routes.mjs';
import { blobBackup } from './backup.mjs';
import { storeMirror } from './store-mirror.mjs';
import './store-blob.mjs';   // first: the @vercel/blob the handlers load (the D1 switch), its fetch for store URLs in place

import academyMcp from '../../api/academy-mcp.js';
import academy from '../../api/academy.js';
import bars from '../../api/bars.js';
import battle from '../../api/battle.js';
import battleTickets from '../../api/_battle.js';
import { Room, Inbox } from './battle-room.mjs';
import bridge from '../../api/bridge.js';
import chronosCoach from '../../api/chronos-coach.js';
import ctraderLink from '../../api/ctrader-link.js';
import data from '../../api/data.js';
import daily from '../../api/daily.js';
import edgeAnalyst from '../../api/edge-analyst.js';
import login from '../../api/login.js';
import lse from '../../api/lse.js';
import logout from '../../api/logout.js';
import mcp from '../../api/mcp.js';
import me from '../../api/me.js';
import moshaLessons from '../../api/mosha-lessons.js';
import mosha from '../../api/mosha.js';
import eqxBridge from '../../api/eqx-bridge.js';
import journal from '../../api/journal.js';
import demoSettings from '../../api/demo-settings.js';
import notify from '../../api/notify.js';
import passkey from '../../api/passkey.js';
import profile from '../../api/profile.js';
import signup from '../../api/signup.js';
import sounds from '../../api/sounds.js';
import status from '../../api/status.js';
import stream from '../../api/stream.js';
import structureAssistant from '../../api/structure-assistant.js';
import tradeReview from '../../api/trade-review.js';
import users from '../../api/users.js';
import { connect } from 'cloudflare:sockets';
import { useAi, installAiFetch } from './ai-binding.mjs';
installAiFetch(globalThis);
import './bundled.mjs';   // the files the Academy and the bridge downloads read from disk on Node, bundled

export const HANDLERS = {
  'academy-mcp': academyMcp, academy, bars, battle, bridge, 'chronos-coach': chronosCoach, 'ctrader-link': ctraderLink, daily, data,
  'demo-settings': demoSettings, 'edge-analyst': edgeAnalyst, 'eqx-bridge': eqxBridge, journal, login, logout, lse, mcp, me, 'mosha-lessons': moshaLessons, mosha, notify, passkey,
  profile, signup, sounds, status, stream, 'structure-assistant': structureAssistant, 'trade-review': tradeReview, users,
};

// Cron expression (wrangler.jsonc triggers) -> the path Vercel's cron called.
// 17 Nov 2026: the every-minute price-alert cron went with the price alerts; the 10-minute one is left.
export const CRONS = { '*/10 * * * *': '/api/edge-analyst?job=scan' };
// Jobs run after a cron's own job, with the same secret (no new trigger: the plan's cron count stays). The trade reviewer
// (17 Nov 2026) asks the language model at most once every 12 hours, and only for a new council-data reading.
// The watchdog kick (18 Nov 2026, items 15 and 31): when the council or the ICT desk is stale, start watchdog.yml, so the
// "council stopped" alert no longer waits for GitHub's own timer. First in the chain: it is quick and it matters most.
// The daily-report notice (19 Nov 2026): posts the day's notice once the 06:30 London reports are in (api/daily.js: the AI summary, the bell notice and the email).
export const CHAINED = { '*/10 * * * *': ['/api/status?job=watchdog', '/api/daily?job=daily', '/api/trade-review?job=review'] };

// Sign-up emails (17 Nov 2026): the handler cannot import the Worker's socket module (Node tests load api/), so it is handed in
// here; the Email Service binding (env.EMAIL, a `send_email` binding) lives on the Worker's env, not process.env, and is handed
// in on each request. Without either, or without their settings, sign-ups answer 503.
signup.useSmtp(connect);
signup.useEmailMessage(EmailMessage);

const SECURITY = headersFor(vercel.headers, new URL('https://x/'));

async function api(name, request, url, env, ctx) {
  // The link preview is the static card (17 Nov 2026: api/og.mjs removed); old links to /api/og still get a picture.
  if (name === 'og') return Response.redirect(new URL('/icons/og-card.png', url).href, 302);
  const h = Object.hasOwn(HANDLERS, name) ? HANDLERS[name] : null;   // its own list only: /api/constructor is a 404, not Object()
  if (!h) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  return run(h, request, url, ctx);
}

async function asset(request, url, env) {
  const get = (p) => env.ASSETS.fetch(new Request(new URL(p + url.search, url.origin), { method: request.method === 'HEAD' ? 'HEAD' : 'GET', headers: request.headers }));
  let p = url.pathname;
  if (p.endsWith('/')) p += 'index.html';
  let r = await get(p);
  if (r.status === 404 && !/\.[a-z0-9]+$/i.test(p)) { const r2 = await get(p + '/index.html'); if (r2.status !== 404) r = r2; }
  return r;
}

// ChronosTrade battles (18 Nov 2026): one Durable Object per room code holds the room (./battle-room.mjs) and its WebSockets.
// /api/battle-ws?t=<ticket>: the ticket (api/_battle.js, two minutes, its own key) is checked HERE; the room only ever sees the
// verified { u, n, room }. Same-origin browsers only. Nothing in a room places or changes a trade outside the players' own
// paper accounts in their browsers.
export class BattleRoom extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.socks = new Map(); this.n = 0;
    this.room = new Room({ send: (id, m) => { const ws = this.socks.get(id); if (ws) try { ws.send(JSON.stringify(m)); } catch (e) {} },
      close: (id, code, why) => { const ws = this.socks.get(id); this.socks.delete(id); if (ws) try { ws.close(code, why); } catch (e) {} } }); }
  async fetch(request) {
    let who; try { who = JSON.parse(request.headers.get('x-battle-who') || 'null'); } catch (e) { who = null; }
    if (who && who.kind === 'box' && new URL(request.url).pathname === '/inbox') {   // the site's one invite inbox (idFromName('__inbox__'))
      this.inbox ||= new Inbox(); let body = null; try { body = await request.json(); } catch (e) {}
      const out = this.inbox.handle(who, body); return Response.json(out, { status: out.error ? 400 : 200, headers: { 'cache-control': 'private, no-store' } });
    }
    if (!who || !who.u || !who.room || who.kind) return new Response('bad request', { status: 400 });
    const [client, server] = Object.values(new WebSocketPair()); server.accept();
    const id = ++this.n; this.socks.set(id, server);
    server.addEventListener('message', (e) => this.room.message(id, typeof e.data === 'string' ? e.data : ''));
    const gone = () => { if (this.socks.delete(id)) this.room.leave(id); };
    server.addEventListener('close', gone); server.addEventListener('error', gone);
    this.room.join(id, who);
    return new Response(null, { status: 101, webSocket: client });
  }
}
async function battleWs(request, env, url) {
  if (!env.BATTLE) return new Response('Battles are not open on this site yet.', { status: 503 });
  if ((request.headers.get('upgrade') || '').toLowerCase() !== 'websocket') return new Response('WebSocket only', { status: 426 });
  const o = request.headers.get('origin'); if (o) { let h = ''; try { h = new URL(o).host; } catch (e) {} if (h !== url.host) return new Response('not allowed', { status: 403 }); }
  const who = battleTickets.readTicket(process.env, url.searchParams.get('t'));
  if (!who || who.kind) return new Response('ticket expired: ask for a new one', { status: 401 });
  const stub = env.BATTLE.get(env.BATTLE.idFromName(who.room));
  return stub.fetch(new Request('https://battle.internal/ws', { headers: { upgrade: 'websocket', 'x-battle-who': JSON.stringify(who) } }));
}

// /api/battle-inbox (POST { t: <box ticket>, op: 'list' | 'invite' | 'answer', … }): same origin, a box ticket checked here
async function battleInbox(request, env, url) {
  if (!env.BATTLE) return Response.json({ error: 'Battles are not open on this site yet.' }, { status: 503 });
  if (request.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });
  const o = request.headers.get('origin'); if (o) { let h = ''; try { h = new URL(o).host; } catch (e) {} if (h !== url.host) return Response.json({ error: 'not allowed' }, { status: 403 }); }
  const raw = await request.text(); if (raw.length > 4096) return Response.json({ error: 'too large' }, { status: 413 });
  let b; try { b = JSON.parse(raw); } catch (e) { return Response.json({ error: 'bad JSON' }, { status: 400 }); }
  const who = battleTickets.readTicket(process.env, b && b.t);
  if (!who || who.kind !== 'box') return Response.json({ error: 'ticket expired: ask for a new one' }, { status: 401 });
  delete b.t; const stub = env.BATTLE.get(env.BATTLE.idFromName('__inbox__'));
  return stub.fetch(new Request('https://battle.internal/inbox', { method: 'POST', headers: { 'x-battle-who': JSON.stringify(who), 'content-type': 'application/json' }, body: JSON.stringify(b) }));
}

export async function handle(request, env, ctx) {
  signup.useMail(env && env.EMAIL);
  useAi(env && env.AI);
  battle.useRooms(!!(env && env.BATTLE));
  const orig = new URL(request.url);
  if (orig.pathname === '/api/battle-ws') return battleWs(request, env, orig);
  if (orig.pathname === '/api/battle-inbox') return battleInbox(request, env, orig);
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS' && !orig.pathname.startsWith('/api/'))
    return new Response('Method not allowed', { status: 405 });
  const url = rewrite(vercel.rewrites, orig);
  const m = /^\/api\/([a-z-]+)(?:\.m?js)?$/.exec(url.pathname);
  let res = m ? await api(m[1], request, url, env, ctx) : await asset(request, url, env);
  // Static files take vercel.json's headers on the address asked for; functions keep their own and
  // get the site-wide security headers, as on Vercel.
  const extra = m ? SECURITY : headersFor(vercel.headers, orig);
  if (res.status === 101 || res.webSocket) return res;
  res = new Response(res.body, res);
  for (const [k, v] of Object.entries(extra)) if (!m || !res.headers.has(k)) res.headers.set(k, v);
  return res;
}

export default {
  fetch: handle,
  async scheduled(event, env, ctx) {
    const path = CRONS[event.cron];
    if (!path) return;
    const req = new Request('https://cron.internal' + path, { headers: { authorization: `Bearer ${env.CRON_SECRET || ''}`, 'user-agent': 'cloudflare-cron' } });
    const r = await handle(req, env, ctx);
    console.log('cron', path, r.status);
    for (const p of CHAINED[event.cron] || []) {
      const rq = new Request('https://cron.internal' + p, { headers: { authorization: `Bearer ${env.CRON_SECRET || ''}`, 'user-agent': 'cloudflare-cron' } });
      const rr = await handle(rq, env, ctx).catch((e) => ({ status: 'error ' + String(e && e.message || e) }));
      console.log('cron', p, rr.status);
    }
    if (event.cron === '*/10 * * * *') console.log('blob backup', JSON.stringify(await blobBackup(env).catch((e) => ({ error: String(e && e.message || e) }))));
    const sm = await storeMirror(env, { cron: event.cron }).catch((e) => ({ error: String(e && e.message || e) }));
    if (!sm.quiet) console.log('store mirror', JSON.stringify(sm));
  },
};
