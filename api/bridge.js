// Broker bridge status and downloads (7 Nov 2026).
//   GET  /api/bridge                      -> { lastRead: { at, client } | null }  (when an MT5/cTrader bridge last fetched mt5/signals.csv)
//   POST /api/bridge { ownerPw, file }    -> the EA source (file "mt5" = CouncilBridge.mq5, "ctrader" = CouncilBridge.cs), owner only
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { list } = require('@vercel/blob');
const OWNER_HASH = '49c5624f2625ed8b42b6e1bf2819a3a41ddb9743aeca36ea34ea7eb96c252ca8';
const FILES = { mt5: 'mt5/CouncilBridge.mq5', ctrader: 'ctrader/CouncilBridge.cs' };
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'POST') {
    let b; try { b = typeof req.body === 'string' ? (JSON.parse(req.body || '{}') || {}) : (req.body || {}); } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    if (!b.ownerPw || crypto.createHash('sha256').update(String(b.ownerPw)).digest('hex') !== OWNER_HASH) return res.status(403).json({ error: 'Owner password not accepted' });
    const f = FILES[b.file]; if (!f) return res.status(400).json({ error: 'unknown file' });
    try { const txt = fs.readFileSync(path.join(process.cwd(), f), 'utf8'); res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return res.status(200).send(txt); }
    catch (e) { return res.status(500).json({ error: 'file missing from the deployment' }); }
  }
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(200).json({ lastRead: null });
    const { blobs } = await list({ prefix: 'bridge/ping', token: process.env.BLOB_READ_WRITE_TOKEN });
    blobs.sort((x, y) => new Date(y.uploadedAt) - new Date(x.uploadedAt));
    if (!blobs.length) return res.status(200).json({ lastRead: null });
    const client = (blobs[0].pathname.match(/ping-([a-z0-9]+)/) || [])[1] || 'bridge';
    return res.status(200).json({ lastRead: { at: blobs[0].uploadedAt, client } });
  } catch (e) { return res.status(200).json({ lastRead: null, error: String(e.message || e) }); }
};
