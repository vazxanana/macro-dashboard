// What the dashboard needs to warn about, in one small cached call: the site notice (Edge Config) and how old each bot's last round is.
const flags = require('./_flags');
const closed = (d) => { const w = d.getUTCDay(), h = d.getUTCHours(); return w === 6 || (w === 5 && h >= 21) || (w === 0 && h < 22); };   // gold/NQ weekend break (UTC)
module.exports = async (req, res) => {
  const f = await flags(), now = new Date(), { readFile } = require('./data.js');   // straight from council-data (/cdata needs a session since 9 Nov)
  const age = async (p) => { try { const r = await readFile(p); if (!r.ok) return null; const at = JSON.parse(r.buf.toString('utf8')).at; return at ? { at, ageMin: Math.round((now - Date.parse(at)) / 6e4) } : null; } catch { return null; } };
  const [council, ict] = await Promise.all([age('snapshot.json'), age('ict/snapshot.json')]);
  // the last round of each job (dry or live), from the runner's Blob reports
  const last = async (job) => { const tok = process.env.BLOB_READ_WRITE_TOKEN; if (!tok) return null; try { const { list } = require('@vercel/blob'); const { blobs } = await list({ prefix: `runs/${job}-`, token: tok });
    blobs.sort((x, y) => new Date(y.uploadedAt) - new Date(x.uploadedAt)); if (!blobs.length) return null; const r = await fetch(blobs[0].url, { headers: { Authorization: `Bearer ${tok}` }, cache: 'no-store', signal: AbortSignal.timeout(5000) }); if (!r.ok) return null;
    // public and edge-cached: the error line and step only (the page shows them); the runner's stack and error cause stay in
    // the private Blob report and the function log
    const j = await r.json(); return { at: j.at, mode: j.mode, why: j.why || null, seconds: j.seconds, failed: j.failed || null, error: j.error ? String(j.error).slice(0, 200) : null, step: j.step || null, changed: (j.changed || []).length, commit: j.commit || null, d1src: j.d1src || null }; } catch (e) { return null; } };
  const [lastC, lastI] = await Promise.all([last('council'), last('ict')]);
  const paused = [].concat(f.paused || []);
  const bot = (name, b, limit, weekend) => ({ ...(b || {}), paused: paused.includes(name) || paused.includes('all'),
    stale: !b ? false : !(paused.includes(name) || paused.includes('all')) && !(weekend && closed(now)) && b.ageMin > limit });
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
  res.status(200).json({ at: now.toISOString(), notice: String(f.notice || ''), noticeLevel: f.noticeLevel === 'warn' ? 'warn' : 'info',
    runMode: String(f.runMode || process.env.RUN_MODE || '') || null,
    bots: { council: { ...bot('council', council, 20, false), lastRun: lastC }, ict: { ...bot('ict', ict, 45, true), lastRun: lastI } } });
};
