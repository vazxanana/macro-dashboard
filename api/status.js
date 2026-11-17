// What the dashboard needs to warn about, in one small cached call: how old each bot's last round is.
// (17 Nov 2026: the Edge Config notice / run-mode flags and the backup runner's reports went with the Vercel project.)
const closed = (d) => { const w = d.getUTCDay(), h = d.getUTCHours(); return w === 6 || (w === 5 && h >= 21) || (w === 0 && h < 22); };   // gold/NQ weekend break (UTC)
module.exports = async (req, res) => {
  const now = new Date(), { readFile } = require('./data.js');   // straight from council-data (/cdata needs a session since 9 Nov)
  const age = async (p) => { try { const r = await readFile(p); if (!r.ok) return null; const at = JSON.parse(r.buf.toString('utf8')).at; return at ? { at, ageMin: Math.round((now - Date.parse(at)) / 6e4) } : null; } catch { return null; } };
  const [council, ict] = await Promise.all([age('snapshot.json'), age('ict/snapshot.json')]);
  const bot = (b, limit, weekend) => ({ ...(b || {}), stale: !b ? false : !(weekend && closed(now)) && b.ageMin > limit });
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
  res.status(200).json({ at: now.toISOString(), bots: { council: bot(council, 20, false), ict: bot(ict, 45, true) } });
};
