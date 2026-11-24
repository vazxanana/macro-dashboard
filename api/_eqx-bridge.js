// The Equinox bridge feed (24 Nov 2026, owner chose "A. Personal key"): what a member's own MetaTrader 5 reads to follow the
// Equinox desks. Pure: the key, who may use it, and the feed's lines. No order code, no broker, no storage.
// Feed = one CSV line per desk record a bot may act on:
//   id,desk,market,side,entry,stop,target,filled,state
// state: `open`  = the desk filled it within FRESH seconds and it has not run more than MAX_FLOAT R either way: may be opened;
//        `hold`  = open at the desk but not to be opened now (late, or already far from its entry): keep a copy, open nothing;
//        `closed`= ended at the desk within KEEP seconds: close the copy.
// The same choices as the demo mirror's Equinox book (council/ctrader-mirror.mjs `eqxCandidates`; a test compares the two).
// Every line has a stop on the losing side or it is not written (absolute rule 1). Paper readings of rules that lose after
// costs in their studies: a demo feed, not trade advice.
const crypto = require('crypto');
const DESKS = ['fade', 'bigfade', 'fvg', 'goldvb'];
const NAMES = { fade: 'Break fade', bigfade: 'Big-candle fade', fvg: 'FVG return', goldvb: 'Gold breakout' };
const MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
const FRESH = 3600, KEEP = 2 * 86400, MAX_FLOAT = 0.75, MAX_LINES = 400;
const KEY_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

// the member's key: <account>.<HMAC(session key, "eqx-bridge/v1:<account>")>; never a session, and a session is never a key
function keyOf(secret, u) {
  if (!secret || !KEY_RE.test(String(u || ''))) return null;
  return `${u}.${crypto.createHmac('sha256', secret).update(`eqx-bridge/v1:${u}`).digest('base64url').slice(0, 32)}`;
}
function whoOf(secret, key) {
  const s = String(key || ''), dot = s.indexOf('.'); if (dot <= 0 || s.length > 80) return null;
  const u = s.slice(0, dot), want = keyOf(secret, u); if (!want) return null;
  const a = Buffer.from(want), b = Buffer.from(s);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? u : null;
}
// the owner, and a member whose desks permission is on (an explicit perms.desks wins; else reviewers): the Equinox page's rule
function canUse(acct) {
  if (!acct) return false; if (acct.u === 'owner') return true;
  const p = acct.perms || {}; return typeof p.desks === 'boolean' ? p.desks : acct.role === 'reviewer';
}
const num = (x, d) => (Number.isFinite(+x) ? String(+(+x).toFixed(d)) : '');
function lines(files, nowS, only) {
  const out = [], seen = new Set();
  for (const k of DESKS) {
    if (only && only.length && !only.includes(k)) continue;
    const recs = files && files[k] && Array.isArray(files[k].records) ? files[k].records : [];
    for (const r of recs) {
      if (!r || typeof r.id !== 'string' || !/^[a-z0-9:._-]{1,80}$/i.test(r.id)) continue;
      const market = r.market || 'xau', side = +r.side === 1 ? 'buy' : +r.side === -1 ? 'sell' : null, entry = +r.entry, stop = +r.stop, t = +r.t;
      if (!MARKETS.includes(market) || !side || !(entry > 0) || !(stop > 0) || !Number.isFinite(t)) continue;
      const sgn = side === 'sell' ? -1 : 1; if (sgn * (entry - stop) <= 0) continue;   // absolute rule 1
      const open = r.status === 'open', endT = +r.endT;
      if (!open && !(Number.isFinite(endT) && nowS - endT <= KEEP)) continue;
      const dup = `${k}|${market}|${side}|${t}`; if (seen.has(dup)) continue; seen.add(dup);
      const tgt = +r.target, t1 = tgt > 0 && sgn * (tgt - entry) > 0 ? tgt : null, fl = +r.float;
      const late = r.feed === 'Kraken' || !(nowS - (+r.first || 0) <= FRESH && nowS - t <= FRESH) || (Number.isFinite(fl) && Math.abs(fl) > MAX_FLOAT);
      const d = market === 'xau' || market === 'usdjpy' || market === 'eurjpy' ? 3 : market === 'xag' ? 4 : 6;
      out.push({ id: `${k}:${r.id}`, desk: k, market, side, entry: num(entry, d), stop: num(stop, d), target: t1 == null ? '' : num(t1, d), filled: t, state: !open ? 'closed' : late ? 'hold' : 'open' });
    }
  }
  out.sort((a, b) => b.filled - a.filled);
  return out.slice(0, MAX_LINES);
}
const csv = (rows, nowS) => [`# eqx-bridge v1,${nowS}`, 'id,desk,market,side,entry,stop,target,filled,state',
  ...rows.map((x) => [x.id, x.desk, x.market, x.side, x.entry, x.stop, x.target, x.filled, x.state].join(','))].join('\n') + '\n';
module.exports = { DESKS, NAMES, MARKETS, FRESH, KEEP, MAX_FLOAT, MAX_LINES, keyOf, whoOf, canUse, lines, csv };
