// What a visitor who is NOT signed in gets from /cdata (11 Nov 2026, owner: the public / admin split must not be cosmetic).
// The guest files on council-data hold every book (shadow, research, retired engines) with system names, notes, block reasons,
// reviews and the scanner's setups; the guest page draws the main system's trades and a few prices. This module cuts each
// guest file down to exactly that, on the server, before it leaves. Pure: no imports but node:crypto, no network, no state.
//
// The definitions are the PAGE's own (market-structure.html: SYS_K, NQ_SYS, SYSG, GUEST_F, GUEST_DATA, msGateProof);
// tests/guest-files.test.mjs reads them out of the page and fails when a list here differs.
//   trades.json              rows of the main system (not shadow, k in SYS_K), fields FIELDS
//   research.json            the NQ New York open run's forward paper rows (not shadow), fields FIELDS
//   research/replay-2w.json  { from, to, trades }: the system replay's rows (not shadow, NQ: the open run only), fields FIELDS
//   snapshot.json            { at, nqLast, markets: { <key>: { label, name, price, dec, open, chg / change } } } + gold's trend
//                            arrows (the sign-in card's D1 / H4 / H1) — prices and the timestamp, nothing else
//   ict/replay.json          { from, totals: { n, wins, R } }: the one line the sign-in card writes
// Not here: mt5/signals.csv, which the broker bridges read without a session and which must stay byte for byte.
//
// Three values are rewritten, because they would name the system that took a trade:
//   id / addOf  -> an opaque id (HMAC of the real one, the same in every file, so the page's de-duplication still works)
//   k           -> 'main' for a row of a main system ('other' for a replay row of anything else), 'nq-open' stays (every NQ
//                  row a guest gets is that one system, as is its session 'nyflip'); other rows lose `session`
//   card: true  -> on a gold trade the guest trade card may show (the page's SYSG list), so the card needs no system key
const crypto = require('node:crypto');

const SYS_K = ['replica', 'mosha-bo', 'mcycle', 'trend', 'gtrend', 'gtrend5', 'gtl', 'geg', 'gmp'];   // the page's SYS_K
const NQ_SYS = ['nyflip'];                                                                 // the page's NQ_SYS
const SYSG = ['replica', 'mosha-bo', 'mcycle', 'gtrend', 'gtrend5', 'gtl', 'geg'];                   // the page's SYSG (guest trade card)
// the page's GUEST_F: the fields the guest page reads off a row
const FIELDS = ['id', 'market', 'label', 'dec', 'k', 'session', 'side', 'entry', 'stop', 't1', 'tp1', 'rr', 'r0', 'size', 'opened', 'filled', 'closed', 'checked', 'status', 'R', 'replay', 'paper', 'addOf', 'card'];
const MARKET_F = ['label', 'name', 'price', 'dec', 'open', 'chg', 'change'];               // snapshot.markets.<key>
const TREND_FOR = ['xau'], TREND_TF = ['1d', '4h', '1h'];                                  // the sign-in card's gold arrows
const ICT_TOTALS = ['n', 'wins', 'R'];
const CUT_FILES = ['trades.json', 'snapshot.json', 'ict/replay.json', 'research/replay-2w.json', 'research.json'];

const nqSys = (x) => x.market !== 'nq' || NQ_SYS.includes(x.session);
const plain = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v);   // a row field is never an object

// key: Buffer / string from the server's session secret; without one the ids are still stable but can be guessed from the
// market and the entry time (said in CLAUDE.md)
function idOf(key) {
  const k = key || 'meridian-x/guest-id/v1';
  return (id) => 'g' + crypto.createHmac('sha256', k).update('guest-id|' + String(id)).digest('base64url').slice(0, 14);
}
function row(x, gid, card) {
  const o = {};
  for (const f of FIELDS) {
    if (f === 'card') { if (card && x.market === 'xau' && SYSG.includes(x.k)) o.card = true; continue; }
    const v = x[f]; if (v === undefined || !plain(v)) continue;
    if (f === 'id' || f === 'addOf') o[f] = v === null || v === '' || v === false ? v : gid(v);
    else if (f === 'k') o.k = v === 'nq-open' ? 'nq-open' : SYS_K.includes(v) ? 'main' : 'other';
    else if (f === 'session') { if (x.market === 'nq') o.session = v; }
    else o[f] = v;
  }
  return o;
}
const isRow = (x) => x && typeof x === 'object' && !Array.isArray(x) && !x.shadow;

const CUTS = {
  'trades.json': (v, gid) => { const a = Array.isArray(v) ? v : v && v.trades; if (!Array.isArray(a)) throw new Error('trades.json: no list');
    return a.filter((x) => isRow(x) && SYS_K.includes(x.k)).map((x) => row(x, gid, true)); },
  'research.json': (v, gid) => { if (!Array.isArray(v)) throw new Error('research.json: no list');
    return v.filter((x) => isRow(x) && x.k === 'nq-open' && nqSys(x)).map((x) => row(x, gid)); },
  'research/replay-2w.json': (v, gid) => { if (!v || !Array.isArray(v.trades)) throw new Error('replay: no list');
    const o = {}; for (const f of ['from', 'to']) if (plain(v[f]) && v[f] !== undefined) o[f] = v[f];
    o.trades = v.trades.filter((x) => isRow(x) && nqSys(x)).map((x) => row(x, gid)); return o; },
  'snapshot.json': (v) => { if (!v || typeof v.markets !== 'object' || !v.markets) throw new Error('snapshot: no markets');
    const o = {}; if (typeof v.at === 'string') o.at = v.at;
    if (v.nqLast && typeof v.nqLast === 'object') { o.nqLast = {}; for (const f of ['price', 'at']) if (typeof v.nqLast[f] === 'number') o.nqLast[f] = v.nqLast[f]; }
    o.markets = {};
    for (const [k, m] of Object.entries(v.markets)) { if (!m || typeof m !== 'object' || !/^[a-z0-9]{2,12}$/.test(k)) continue;
      const q = {}; for (const f of MARKET_F) if (m[f] !== undefined && plain(m[f])) q[f] = m[f];
      if (TREND_FOR.includes(k) && m.trend && typeof m.trend === 'object') { q.trend = {}; for (const tf of TREND_TF) if (typeof m.trend[tf] === 'number') q.trend[tf] = m.trend[tf]; }
      o.markets[k] = q; }
    return o; },
  'ict/replay.json': (v) => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('ict replay: not an object');
    const o = {}; if (typeof v.from === 'string') o.from = v.from;
    if (v.totals && typeof v.totals === 'object') { o.totals = {}; for (const f of ICT_TOTALS) if (typeof v.totals[f] === 'number') o.totals[f] = v.totals[f]; }
    return o; },
};

// The guest's copy of one file as a Buffer. Throws when the file does not parse or is not in the shape the cut knows: the
// caller answers 503 then, never the full file.
function cut(p, buf, key) {
  const f = CUTS[p]; if (!f) throw new Error('no guest cut for ' + p);
  return Buffer.from(JSON.stringify(f(JSON.parse(Buffer.from(buf).toString('utf8')), idOf(key))));
}

module.exports = { cut, CUTS, CUT_FILES, SYS_K, NQ_SYS, SYSG, FIELDS, MARKET_F, TREND_FOR, TREND_TF, ICT_TOTALS, idOf };
