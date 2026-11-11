// Every minute (Vercel cron): checks each device's price alerts against OANDA 5-second candles since the alert was set,
// sends a Web Push notification for each one hit, and removes it. Devices whose subscription expired are dropped.
const webpush = require('web-push');
const { all, read, save } = require('./_alerts');
const { SYM } = require('./_oanda');
const DEC = { xau: 2, xag: 3, eurusd: 5, gbpusd: 5, audusd: 5, usdcad: 5, usdchf: 5, usdjpy: 3, nas100: 1, spx500: 1 };
module.exports = async (req, res) => {
  if (!require('./_guard').bearerOk(req.headers && req.headers.authorization, process.env.CRON_SECRET)) return res.status(401).json({ error: 'unauthorised' });   // constant time
  const tok = process.env.OANDA_TOKEN; if (!tok || !process.env.VAPID_PRIVATE_KEY) return res.status(200).json({ skipped: 'not set up' });
  webpush.setVapidDetails('https://meridianx.dev', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const host = process.env.OANDA_ENV === 'live' ? 'api-fxtrade.oanda.com' : 'api-fxpractice.oanda.com', now = Math.floor(Date.now() / 1000);
  try {
    const { by, blobs } = await all(); if (!by.size) return res.status(200).json({ devices: 0 });
    // an unreadable or malformed record is skipped (and kept: never deleted on a read error); it must not stop the other devices
    // An alert that is not whole (no known market, a price or time that is not a finite number) is left out: it can never fire,
    // and it used to throw below and end the round for every device after it (11 Nov 2026).
    const whole = (a) => !!a && typeof a === 'object' && typeof a.sym === 'string' && !!SYM[a.sym] && Number.isFinite(a.price) && a.price > 0 && Number.isFinite(a.at);
    const devs = []; for (const [id, bl] of by) { try { const d = await read(bl); if (d && typeof d === 'object' && d.sub && Array.isArray(d.alerts || [])) devs.push({ id, d: { ...d, alerts: (d.alerts || []).filter(whole) } }); } catch (e) {} }
    const need = {}; devs.forEach(({ d }) => (d.alerts || []).forEach((a) => { need[a.sym] = Math.min(need[a.sym] || now, Math.max(a.at, now - 900)); }));
    const bars = {};
    await Promise.all(Object.entries(need).map(async ([sym, from]) => {
      try { const r = await fetch(`https://${host}/v3/instruments/${SYM[sym]}/candles?granularity=S5&price=M&from=${Math.max(from - 5, now - 900)}`, { headers: { Authorization: `Bearer ${tok}`, 'Accept-Datetime-Format': 'UNIX' }, signal: AbortSignal.timeout(8000) });
        if (r.ok) bars[sym] = ((await r.json()).candles || []).map((c) => ({ t: Math.floor(+c.time), h: +c.mid.h, l: +c.mid.l, c: +c.mid.c })); } catch (e) {}
    }));
    let sent = 0, gone = 0;
    for (const { id, d } of devs) { try {   // one device's failure (its record, its save) never stops the others
      const hit = [], keep = [];
      for (const a of d.alerts || []) {
        const b = (bars[a.sym] || []).filter((x) => x.t + 5 > a.at);
        const x = b.find((k) => a.dir === 'above' ? k.h >= a.price : k.l <= a.price);
        (x ? hit : keep).push(x ? { a, last: b[b.length - 1].c } : a);
      }
      if (!hit.length) continue;
      let dead = false;
      for (const { a, last } of hit) {
        const f = (v) => v.toLocaleString('en-US', { minimumFractionDigits: DEC[a.sym] ?? 2, maximumFractionDigits: DEC[a.sym] ?? 2 });
        const payload = JSON.stringify({ title: `${a.label || a.sym.toUpperCase()} ${a.dir === 'above' ? 'rose to' : 'fell to'} ${f(a.price)}`, body: `${a.note ? a.note + ' · ' : ''}Now ${f(last)}. Tap to open the chart.`, url: `/?s=${a.sym}#charts`, tag: `pa-${a.id}` });
        try { await webpush.sendNotification(d.sub, payload, { TTL: 3600, urgency: 'high' }); sent++; }
        catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { dead = true; break; } console.warn(`[alerts] push ${e.statusCode || e.message}`); }
      }
      if (dead) { gone++; await save(id, null, blobs); } else await save(id, keep.length || d.tv ? { ...d, alerts: keep, at: Date.now() } : null, blobs);
    } catch (e) { console.warn(`[alerts] device skipped: ${e.message}`); } }
    console.log(JSON.stringify({ devices: devs.length, sent, gone }));
    return res.status(200).json({ devices: devs.length, sent, gone });
  } catch (e) { console.error(`[alerts] ${e.message}`); return res.status(500).json({ error: String(e.message || e) }); }
};
