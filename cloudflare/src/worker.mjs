// Meridian X on Cloudflare Workers.
// - out/ (the committed build) is served as static assets, with vercel.json's rewrites and headers.
// - /api/<name> runs the unchanged handler api/<name>.js through ./adapter.mjs.
// - Scheduled jobs call the same handlers as Vercel's crons did, with the cron secret.
import vercel from '../../vercel.json';
import { EmailMessage } from 'cloudflare:email';
import { run } from './adapter.mjs';
import { rewrite, headersFor } from './routes.mjs';
import { blobBackup } from './backup.mjs';
import { storeMirror } from './store-mirror.mjs';
import './store-blob.mjs';   // first: the @vercel/blob the handlers load (the D1 switch), its fetch for store URLs in place

import academyMcp from '../../api/academy-mcp.js';
import academy from '../../api/academy.js';
import bars from '../../api/bars.js';
import bridge from '../../api/bridge.js';
import chronosCoach from '../../api/chronos-coach.js';
import ctraderLink from '../../api/ctrader-link.js';
import data from '../../api/data.js';
import edgeAnalyst from '../../api/edge-analyst.js';
import login from '../../api/login.js';
import logout from '../../api/logout.js';
import mcp from '../../api/mcp.js';
import me from '../../api/me.js';
import moshaLessons from '../../api/mosha-lessons.js';
import mosha from '../../api/mosha.js';
import notify from '../../api/notify.js';
import passkey from '../../api/passkey.js';
import profile from '../../api/profile.js';
import signup from '../../api/signup.js';
import sounds from '../../api/sounds.js';
import status from '../../api/status.js';
import stream from '../../api/stream.js';
import tradeReview from '../../api/trade-review.js';
import users from '../../api/users.js';
import { connect } from 'cloudflare:sockets';
import './bundled.mjs';   // the files the Academy and the bridge downloads read from disk on Node, bundled

export const HANDLERS = {
  'academy-mcp': academyMcp, academy, bars, bridge, 'chronos-coach': chronosCoach, 'ctrader-link': ctraderLink, data,
  'edge-analyst': edgeAnalyst, login, logout, mcp, me, 'mosha-lessons': moshaLessons, mosha, notify, passkey,
  profile, signup, sounds, status, stream, 'trade-review': tradeReview, users,
};

// Cron expression (wrangler.jsonc triggers) -> the path Vercel's cron called.
// 17 Nov 2026: the every-minute price-alert cron went with the price alerts; the 10-minute one is left.
export const CRONS = { '*/10 * * * *': '/api/edge-analyst?job=scan' };
// Jobs run after a cron's own job, with the same secret (no new trigger: the plan's cron count stays). The trade reviewer
// (17 Nov 2026) asks the language model at most once every 12 hours, and only for a new council-data reading.
// The watchdog kick (18 Nov 2026, items 15 and 31): when the council or the ICT desk is stale, start watchdog.yml, so the
// "council stopped" alert no longer waits for GitHub's own timer. First in the chain: it is quick and it matters most.
export const CHAINED = { '*/10 * * * *': ['/api/status?job=watchdog', '/api/trade-review?job=review'] };

// Sign-up emails (17 Nov 2026): the handler cannot import the Worker's socket module (Node tests load api/), so it is handed in
// here; the Email Service binding (env.EMAIL, a `send_email` binding) lives on the Worker's env, not process.env, and is handed
// in on each request. Without either, or without their settings, sign-ups answer 503.
signup.useSmtp(connect);
signup.useEmailMessage(EmailMessage);

const SECURITY = headersFor(vercel.headers, new URL('https://x/'));

async function api(name, request, url, env, ctx) {
  // The link preview is the static card (17 Nov 2026: api/og.mjs removed); old links to /api/og still get a picture.
  if (name === 'og') return Response.redirect(new URL('/icons/og-card.png', url).href, 302);
  const h = HANDLERS[name];
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

export async function handle(request, env, ctx) {
  signup.useMail(env && env.EMAIL);
  const orig = new URL(request.url);
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
