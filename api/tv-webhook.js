// TradingView alerts in (7 Nov 2026). Point a TradingView alert's Webhook URL at
//   https://meridianx.dev/api/tv-webhook?k=<TV_WEBHOOK_KEY>
// Each alert is stored (private Blob tvalerts/, newest 50 kept) and forwarded as a push notification to every device
// that has price alerts on. The owner reads the URL and the log with the owner password:
//   POST { ownerPw?, list: true } -> { url, alerts: [{ at, text, ticker, price }] }   (owner password or the owner's session cookie)
const crypto = require('node:crypto');
const { put, list, del } = require('@vercel/blob');
const webpush = require('web-push');
const { all, read } = require('./_alerts');
const { OWNER_HASH } = require('./_accounts');
const S = require('./_session');
const G = require('./_guard');
const tok = () => process.env.BLOB_READ_WRITE_TOKEN;
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
async function recent() {
  const { blobs } = await list({ prefix: 'tvalerts/', token: tok() });
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  return blobs;
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const KEY = process.env.TV_WEBHOOK_KEY; if (!KEY || !tok()) return res.status(503).json({ error: 'not set up' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const raw = typeof req.body === 'string' ? req.body : req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : '';
  // owner: read the webhook URL and the log
  if (!(req.query && req.query.k)) {
    let b = {}; try { b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch (e) {}
    if (!(S.sameOrigin(req) && (await S.isOwnerSession(req)))) {   // else the owner password, under the shared password-guess limit
      if (!b || !b.ownerPw) return res.status(403).json({ error: 'Owner password not accepted' });
      const secs = G.wait(req); if (secs) return G.tooMany(res, secs);
      const pwOk = String(b.ownerPw).length <= 200 && eq(crypto.createHash('sha256').update(String(b.ownerPw)).digest('hex'), OWNER_HASH);
      if (!pwOk) { G.failed(req); return res.status(403).json({ error: 'Owner password not accepted' }); }
    }
    let blobs; try { blobs = (await recent()).slice(0, 30); } catch (e) { console.error(`[tv] list ${e.message}`); return res.status(502).json({ error: 'alert log unavailable' }); }
    const alerts = await Promise.all(blobs.map(async (bl) => { try { const r = await fetch(bl.url, { headers: { Authorization: `Bearer ${tok()}` }, signal: AbortSignal.timeout(8000) }); return r.ok ? r.json() : null; } catch (e) { return null; } }));
    return res.status(200).json({ url: `https://${req.headers.host}/api/tv-webhook?k=${KEY}`, alerts: alerts.filter(Boolean) });
  }
  // TradingView: store + forward
  if (!eq(req.query.k, KEY)) return res.status(403).json({ error: 'bad key' });
  const text = String(raw || '').slice(0, 2000); let j = null; try { j = JSON.parse(text); } catch (e) {}
  const rec = { at: new Date().toISOString(), text: j ? (j.msg || j.message || j.text || text) : text, ticker: j && (j.ticker || j.symbol) || null, price: j && isFinite(+j.price) ? +j.price : j && isFinite(+j.close) ? +j.close : null, side: j && (j.side || j.action) || null };
  try {
    await put(`tvalerts/${Date.now()}.json`, JSON.stringify(rec), { access: 'private', addRandomSuffix: true, contentType: 'application/json', token: tok() });
    const old = (await recent()).slice(50).map((b) => b.url); if (old.length) await del(old, { token: tok() }).catch(() => {});
  } catch (e) { console.error(`[tv] store ${e.message}`); }
  let sent = 0;
  if (process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails('https://meridianx.dev', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    try {
      const { by } = await all();
      const title = `TradingView${rec.ticker ? ` · ${rec.ticker}` : ''}${rec.side ? ` · ${String(rec.side).toUpperCase()}` : ''}`;
      const body = `${String(rec.text).slice(0, 160)}${rec.price != null ? ` (${rec.price})` : ''}`;
      await Promise.all([...by.values()].map(async (bl) => { try { const d = await read(bl); if (!d.tv) return; await webpush.sendNotification(d.sub, JSON.stringify({ title, body, url: '/#council', tag: `tv-${Date.now()}` }), { TTL: 600 }); sent++; } catch (e) {} }));
    } catch (e) {}
  }
  console.log(JSON.stringify({ tv: rec.ticker, sent }));
  return res.status(200).json({ ok: true, forwarded: sent });
};
