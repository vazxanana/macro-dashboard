// Price alerts per device. The page keeps the list; this stores it with the device's Web Push subscription.
//   GET  /api/push?key=1                      -> { key: VAPID public key }
//   POST /api/push { sub, alerts }            -> saves (alerts [] removes the device); returns { alerts }
//   POST /api/push { sub, get: true }         -> { alerts } for this device
const { all, read, save, devId, tok } = require('./_alerts');
const { SYM } = require('./_oanda');
const PUSH_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(push\.services\.mozilla\.com|fcm\.googleapis\.com|android\.googleapis\.com|notify\.windows\.com|push\.apple\.com|web\.push\.apple\.com)\//i;
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ key: process.env.VAPID_PUBLIC_KEY || null });
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
  if (!tok() || !process.env.VAPID_PUBLIC_KEY) return res.status(503).json({ error: 'alerts not set up' });
  let b; try { b = typeof req.body === 'string' ? (JSON.parse(req.body || '{}') || {}) : (req.body || {}); } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
  const sub = b && b.sub;
  // no sign-in here, so what one device may store is capped (real endpoints are < 1 KB, p256dh 87 and auth 22 characters)
  const str = (v, n) => typeof v === 'string' && v.length > 0 && v.length <= n;
  if (!sub || !str(sub.endpoint, 1024) || !PUSH_HOSTS.test(sub.endpoint) || !sub.keys || !str(sub.keys.p256dh, 200) || !str(sub.keys.auth, 100)) return res.status(400).json({ error: 'bad subscription' });
  const id = devId(sub.endpoint);
  try {
    const { by, blobs } = await all();
    if (b.get) { const bl = by.get(id), d = bl ? await read(bl) : null; return res.status(200).json({ alerts: d ? d.alerts || [] : [], tv: !!(d && d.tv) }); }
    if (!Array.isArray(b.alerts) || b.alerts.length > 20) return res.status(400).json({ error: 'up to 20 alerts' });
    if (b.alerts.some((a) => !a || typeof a !== 'object' || Array.isArray(a))) return res.status(400).json({ error: 'bad alert' });
    if (!by.has(id) && by.size >= 300) return res.status(429).json({ error: 'too many devices' });
    const alerts = b.alerts.map((a) => ({ id: String(a.id || '').slice(0, 16), sym: String(a.sym), price: +a.price, dir: a.dir === 'below' ? 'below' : 'above', note: String(a.note || '').slice(0, 60), label: String(a.label || '').slice(0, 20), at: Math.floor(+a.at || Date.now() / 1000) }));
    if (alerts.some((a) => !a.id || !SYM[a.sym] || !(a.price > 0))) return res.status(400).json({ error: 'bad alert' });
    const tv = b.tv === true;   // also forward TradingView alerts (api/tv-webhook) to this device
    await save(id, alerts.length || tv ? { sub: { endpoint: sub.endpoint, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) } }, alerts, tv, at: Date.now() } : null, blobs);
    return res.status(200).json({ alerts });
  } catch (e) { console.error(`[push] ${e.message}`); return res.status(500).json({ error: 'alerts storage unavailable' }); }   // no storage detail to the public
};
