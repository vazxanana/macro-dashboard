// Market candles from OANDA (broker-grade spot gold, forex and index CFDs), proxied so the API token stays on Vercel.
// The page asks /md/bars?sym=xau&tf=5m&n=500, or &from=<unix>&to=<unix> for a past window (trade review).
// Environment: OANDA_TOKEN (personal access token), OANDA_ENV "practice" (default, demo account) or "live".
// Without a token it answers 503 and the page falls back to its exchange feeds.
const { SYM } = require('./_oanda');
const TF = { '1m': ['M1', 60, 2], '5m': ['M5', 300, 5], '15m': ['M15', 900, 10], '1h': ['H1', 3600, 20], '4h': ['H4', 14400, 30], '1d': ['D', 86400, 60] };
module.exports = async (req, res) => {
  const q = req.query || {}, inst = SYM[String(q.sym || '')], tf = TF[String(q.tf || '')];
  if (!inst || !tf) return res.status(400).json({ error: 'unknown sym or tf' });
  const tok = process.env.OANDA_TOKEN; if (!tok) { res.setHeader('Cache-Control', 's-maxage=60'); return res.status(503).json({ error: 'OANDA_TOKEN not set' }); }
  const host = process.env.OANDA_ENV === 'live' ? 'api-fxtrade.oanda.com' : 'api-fxpractice.oanda.com', now = Math.floor(Date.now() / 1000);
  const p = new URLSearchParams({ granularity: tf[0], price: 'M', dailyAlignment: '0', alignmentTimezone: 'Etc/UTC', weeklyAlignment: 'Monday' });
  let hist = false;
  if (q.from) {
    const from = Math.floor(+q.from), to = Math.min(now, Math.ceil(+q.to || now));
    if (!(from > 0) || !(to > from)) return res.status(400).json({ error: 'bad range' });
    const fromC = Math.max(from, to - 4999 * tf[1]);   // OANDA's 5000-candle cap: keep the end of the window
    p.set('from', String(fromC)); p.set('to', String(to)); hist = to < now - 2 * tf[1];
  } else p.set('count', String(Math.max(1, Math.min(5000, Math.floor(+q.n || 500)))));
  try {
    const r = await fetch(`https://${host}/v3/instruments/${inst}/candles?${p}`, { headers: { Authorization: `Bearer ${tok}`, 'Accept-Datetime-Format': 'UNIX' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) { res.setHeader('Cache-Control', 's-maxage=5'); return res.status(502).json({ error: `OANDA ${r.status}: ${(await r.text()).slice(0, 160)}` }); }
    const j = await r.json(), bars = (j.candles || []).filter((c) => c.mid).map((c) => ({ time: Math.floor(+c.time), open: +c.mid.o, high: +c.mid.h, low: +c.mid.l, close: +c.mid.c, volume: c.volume, ...(c.complete ? {} : { live: true }) }));
    res.setHeader('Cache-Control', hist ? 'public, max-age=300, s-maxage=86400' : `public, max-age=0, s-maxage=${tf[2]}, stale-while-revalidate=${tf[2] * 3}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ src: 'OANDA', inst, tf: q.tf, bars });
  } catch (e) { res.setHeader('Cache-Control', 's-maxage=5'); return res.status(502).json({ error: String(e.message || e) }); }
};
