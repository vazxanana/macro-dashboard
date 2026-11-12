// Backup of the site's private storage (owner, 12 Nov 2026: "do a backup of the whole website in case I need to change platform").
// The code and the bots' data live on GitHub (main and council-data); what lives ONLY on Vercel is the private Blob store (the
// user list with its password hashes, profiles, notifications, sounds, the Mosha log, lessons and pictures, the Academy store,
// the edge analyst, price-alert devices, cTrader link tokens, TradingView alerts, run reports) and the Edge Config switches.
//   POST /api/backup { from }   owner session only, same origin -> one part of the backup:
//     { v, at, store: { count, size }, from, next, files: [{ pathname, size, uploadedAt, contentType, enc, data }], flags?, env? }
//   The page asks for parts until `next` is null and saves them as one file (a Vercel answer is capped at about 4.5 MB).
//   `enc` is 'utf8' for JSON / text and 'base64' for everything else (pictures, sounds). Every file is read from the Blob ORIGIN
//   (`?cache=0`), as the stores read them, so the backup holds what is stored now, not a CDN copy up to a minute old.
//   The first part also carries the Edge Config switches (no secret in them) and, for the environment variables the code reads,
//   only whether each one is set: NEVER a value. Restore: scripts/backup-restore.mjs; guide: docs/platform-backup.md.
const S = require('./_session.js');
const BUDGET = 3.2e6;                    // characters of file data in one answer (base64 grows a file by a third)
const ENV_NAMES = ['BLOB_READ_WRITE_TOKEN', 'EDGE_CONFIG', 'SESSION_SECRET', 'CRON_SECRET', 'CTRADER_LINK_KEY', 'OANDA_TOKEN', 'OANDA_ENV',
  'GH_TOKEN', 'GH_READ_TOKEN', 'GH_MCP_TOKEN', 'GH_DISPATCH_TOKEN', 'RUN_MODE', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'NTFY_TOPIC',
  'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'FUT_ACCOUNT', 'FUT_RISK', 'TV_WEBHOOK_KEY', 'MCP_KEYS', 'MCP_ORIGINS', 'MX_SW_KILL',
  'MOSHA_READER', 'MOSHA_READER_SALT', 'MOSHA_ASSISTANT_KEY', 'ACADEMY_LLM_KEY', 'ACADEMY_LLM_URL', 'ACADEMY_LLM_MODEL', 'ACADEMY_LLM_FORMAT',
  'ACADEMY_CONNECTOR', 'ACADEMY_CONNECTOR_SALT', 'ACADEMY_CONNECTOR_SECRET', 'EDGE_ANALYST', 'EDGE_LLM_STOP', 'EDGE_LLM_DAILY_USD',
  'EDGE_LLM_MONTHLY_USD', 'EDGE_LLM_HARD_USD', 'EDGE_LLM_MAX_CALLS_DAY', 'CTRADER_ENV', 'CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET',
  'CTRADER_ACCOUNT_ID', 'CTRADER_ACCOUNTS'];
const fresh = (url) => { const u = new URL(url); u.searchParams.set('cache', '0'); return u.toString(); };
const isText = (ct, p) => /^(application\/(json|javascript)|text\/)/i.test(ct || '') || /\.(json|txt|csv|md)$/i.test(p || '');

function blobSource(env, io = {}) {
  const B = () => io.blob || require('@vercel/blob'), F = io.fetch || fetch, token = env.BLOB_READ_WRITE_TOKEN;
  return {
    async list() {
      const out = []; let cursor;
      do { const r = await B().list({ cursor, token, limit: 1000 }); out.push(...r.blobs); cursor = r.hasMore ? r.cursor : null; } while (cursor);
      return out.sort((a, b) => (a.pathname < b.pathname ? -1 : a.pathname > b.pathname ? 1 : 0));
    },
    async read(b) {
      const r = await F(fresh(b.url), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`read ${b.pathname}: ${r.status}`);   // a file that cannot be read fails the part: never a silent gap
      return { ct: r.headers.get('content-type') || b.contentType || '', buf: Buffer.from(await r.arrayBuffer()) };
    },
  };
}

async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!(d.sameOrigin || S.sameOrigin)(req)) return res.status(403).json({ error: 'not allowed' });
  const owner = await (d.isOwner || ((r) => S.isOwnerSession(r, env)))(req).catch(() => false);
  if (!owner) return res.status(401).json({ error: 'only the owner can download a backup' });
  if (!env.BLOB_READ_WRITE_TOKEN && !d.source) return res.status(503).json({ error: 'storage not set up' });
  let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
  const from = Math.max(0, Math.floor(Number((b || {}).from) || 0));
  try {
    const src = d.source || blobSource(env), all = await src.list(), files = []; let used = 0, i = from;
    for (; i < all.length; i++) {
      const x = all[i], { ct, buf } = await src.read(x), enc = isText(ct, x.pathname) ? 'utf8' : 'base64', data = buf.toString(enc);
      if (files.length && used + data.length > (d.budget || BUDGET)) break;     // this file starts the next part
      files.push({ pathname: x.pathname, size: buf.length, uploadedAt: x.uploadedAt instanceof Date ? x.uploadedAt.toISOString() : x.uploadedAt || null, contentType: ct, enc, data });
      used += data.length;
    }
    const out = { v: 1, at: new Date(d.now || Date.now()).toISOString(), store: { count: all.length, size: all.reduce((s, x) => s + (x.size || 0), 0) }, from, next: i < all.length ? i : null, files };
    if (from === 0) {
      out.flags = await (d.flags || (() => require('./_flags.js')()))().catch(() => ({}));
      out.env = Object.fromEntries(ENV_NAMES.map((k) => [k, env[k] != null && env[k] !== '']));   // set or not, never the value
    }
    return res.status(200).json(out);
  } catch (e) { console.warn(`[backup] ${e.message}`); return res.status(502).json({ error: 'a stored file could not be read; nothing was saved, try again' }); }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.blobSource = blobSource;
module.exports.ENV_NAMES = ENV_NAMES;
