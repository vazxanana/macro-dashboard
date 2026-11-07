// What the dashboard needs to warn about, in one small cached call: the site notice (Edge Config) and how old each bot's last round is.
const flags = require('./_flags');
const closed = (d) => { const w = d.getUTCDay(), h = d.getUTCHours(); return w === 6 || (w === 5 && h >= 21) || (w === 0 && h < 22); };   // gold/NQ weekend break (UTC)
module.exports = async (req, res) => {
  const f = await flags(), base = `https://${req.headers.host}/cdata/`, now = new Date();
  const age = async (p) => { try { const r = await fetch(base + p, { signal: AbortSignal.timeout(6000) }); if (!r.ok) return null; const at = (await r.json()).at; return at ? { at, ageMin: Math.round((now - Date.parse(at)) / 6e4) } : null; } catch { return null; } };
  const [council, ict] = await Promise.all([age('snapshot.json'), age('ict/snapshot.json')]);
  const paused = [].concat(f.paused || []);
  const bot = (name, b, limit, weekend) => ({ ...(b || {}), paused: paused.includes(name) || paused.includes('all'),
    stale: !b ? false : !(paused.includes(name) || paused.includes('all')) && !(weekend && closed(now)) && b.ageMin > limit });
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
  res.status(200).json({ at: now.toISOString(), notice: String(f.notice || ''), noticeLevel: f.noticeLevel === 'warn' ? 'warn' : 'info',
    bots: { council: bot('council', council, 20, false), ict: bot('ict', ict, 45, true) } });
};
