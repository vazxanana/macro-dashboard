// The Mosha desk's tracker (21 Nov 2026, owner: "do the mosha edge the same as ict with the trades"). Like the ICT desk's
// tracker, it runs inside the council loop and RECORDS what the desk's reading of the Mosha method marks on gold, so the
// desk shows stored trades (and keeps them) instead of working them out in the browser from live candles each visit.
//   node council/mosha-desk.mjs <council-data dir>      -> writes <dir>/mosha/desk.json
// The reading itself is the page's own: assets/mosha-sop.js (the BO, VR, CF sequence and the barrier entry) on the page's own
// msAnalyze / msMosha / msZones / msInternal, lifted from market-structure.html (as the digest lifts the scoreboard).
// PAPER RECORD ONLY: no order, no alert, no broker, no mirror; nothing of the Trader reads this file. Every record has a stop
// on the losing side of its entry (absolute rule 1) or it is not recorded. It is not Luxus's record and not a tested rule.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeAtomic } from './jsonio.mjs';

const require = createRequire(import.meta.url);
const SOP = require(fileURLToPath(new URL('../assets/mosha-sop.js', import.meta.url)));

export const KEEP = 4000;           // records kept
export const LIVE_S = 60 * 60;      // recorded within this of its entry = seen live by the tracker (it runs about every 35 min)
export const NEAR_S = 20 * 60;      // a new record this near an old one of the same kind and side is the same trade re-read
const MD = () => (process.env.MD_BASE || 'https://aureumdesk.co.uk/md/').replace(/\/?$/, '/');

// the page's own analysis functions, as text from the page
export function loadFns(file = new URL('../market-structure.html', import.meta.url)) {
  const html = fs.readFileSync(file, 'utf8');
  const fn = (name) => { const i = html.indexOf(`function ${name}(`); if (i < 0) throw new Error('page function missing: ' + name);
    let d = 0; for (let k = html.indexOf('{', i); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && !--d) return html.slice(i, k + 1); } throw new Error('unclosed: ' + name); };
  return { msAnalyze: new Function(`${fn('msAnalyze')}; return msAnalyze;`)(), msMosha: new Function(`${fn('msMosha')}; return msMosha;`)(),
    msZones: new Function(`${fn('msZones')}; return msZones;`)(), msInternal: new Function(`const MS_IPIV = 6; ${fn('msInternal')}; return msInternal;`)() };
}

// closed candles of one timeframe, oldest first
export async function bars(tf, now, get = fetch, days = SOP.DAYS, sym = 'xau') {
  const sec = SOP.SEC[tf], from = now - (SOP.BACK[tf] + Math.max(0, days - SOP.DAYS)) * 86400, out = new Map();
  for (let to = now; to > from;) { const f = Math.max(from, to - 4000 * sec);
    const r = await get(`${MD()}bars?sym=${sym}&tf=${tf}&from=${f}&to=${to}`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`candles ${tf}: HTTP ${r.status}`);
    const j = await r.json(); for (const b of (j.bars || j || [])) out.set(b.time, b); to = f; }
  return [...out.values()].sort((a, b) => a.time - b.time).filter((b) => b.time + sec <= now);
}

// The second source (21 Nov 2026, owner: "if mosha cannot use oanda use something different"): Kraken's gold token (PAXG/USD),
// the council Trader's own fallback for gold. It trades at the weekend and a few dollars from spot, and Kraken serves only its
// last 720 candles a timeframe, so: weekend candles are dropped, a fallback run never touches a record read on OANDA, and it
// adds only entries of the last FALLBACK_NEW_S (what is happening now), never a replay of history on another price basis.
export const OTHER = Object.keys(SOP.MARKETS).filter((k) => k !== 'xau');
export const FALLBACK_NEW_S = 2 * 3600;
const KR = { '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240, '1d': 1440 };
export const spotShut = (t) => { const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours(); return wd === 6 || (wd === 0 && h < 23) || (wd === 5 && h >= 21); };
export async function krakenBars(tf, now, get = fetch) {
  const r = await get(`https://api.kraken.com/0/public/OHLC?pair=PAXGUSD&interval=${KR[tf]}`, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Kraken ${tf}: HTTP ${r.status}`);
  const j = await r.json(); if (j.error && j.error.length) throw new Error(`Kraken ${tf}: ${j.error[0]}`);
  const key = Object.keys(j.result || {}).find((k) => k !== 'last'); if (!key) throw new Error(`Kraken ${tf}: no candles`);
  const sec = SOP.SEC[tf];
  return j.result[key].map((k) => ({ time: +k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[6] || 0 }))
    .filter((b) => b.time + sec <= now && (tf === '1d' || !spotShut(b.time))).sort((a, b) => a.time - b.time);
}
// every timeframe from OANDA, or (any one missing) every timeframe from Kraken: never a mix
export async function candles(now, get = fetch, wait = (ms) => new Promise((r) => setTimeout(r, ms)), days = SOP.DAYS) {
  const B = {};
  try { for (const tf of Object.keys(SOP.BACK)) B[tf] = await bars(tf, now, get, days); if (B['5m'].length) return { feed: 'OANDA', B }; throw new Error('no candles'); }
  catch (e) { const why = String(e && e.message || e);
    try { const K = {}; for (const tf of Object.keys(SOP.BACK)) { K[tf] = await krakenBars(tf, now, get); await wait(1200); } return { feed: 'Kraken', B: K, why }; }
    catch (e2) { throw new Error(`${why}; second source: ${e2 && e2.message || e2}`); } }
}
const feedOf = (r) => r.feed || 'OANDA';
const KR_NOTE = 'Read on Kraken gold-token candles while the main price source was down: its prices sit a few dollars from spot gold.';

const num = (v, d = 3) => (Number.isFinite(+v) ? +(+v).toFixed(d) : null);
// a mark the desk's chart draws for a trade: a level line or a box, from the time it was known
const mark = (m, d = 3) => { const k = ['level', 'vr', 'bvr', 'zone'].includes(m.kind) ? m.kind : null, o = { kind: k, a: +m.a, at: +m.at || +m.a, label: String(m.label || '').slice(0, 24) };
  if (!k || !Number.isFinite(o.a)) return null; if (k === 'level') { o.p = num(m.p, d); if (o.p == null) return null; if (m.under) o.under = true; } else { o.top = num(m.top, d); o.bot = num(m.bot, d); if (o.top == null || o.bot == null) return null; } return o; };
// one record as stored: plain values only, and never without a stop on the losing side
export function clean(r) {
  const side = r.side > 0 ? 1 : -1, entry = +r.entry, stop = +r.stop, mk = SOP.ALL[r.market] ? r.market : 'xau', d = mk === 'xau' ? 3 : 6;
  if (!(Number.isFinite(entry) && Number.isFinite(stop)) || !(side > 0 ? stop < entry : stop > entry)) return null;
  return { id: String(r.id), ...(mk === 'xau' ? {} : { market: mk }), kind: r.kind === 'sop' ? 'sop' : /^(eg|lit)-[a-z0-9-]{1,20}$/.test(r.kind) ? r.kind : 'barrier', ...(r.label ? { label: String(r.label).slice(0, 40) } : {}), h: r.h, l: r.l, case: r.case || null, side, t: r.t, entry: num(entry, d), stop: num(stop, d), target: num(r.target, d), r0: num(Math.abs(entry - stop), d),
    status: r.status || 'open', R: r.R == null ? null : num(r.R), endT: r.endT || null, exit: r.exit == null ? null : num(r.exit, d), mfe: num(r.mfe), float: r.float == null ? null : num(r.float),
    log: (r.log || []).slice(0, 12).map((x) => ({ t: x.t || null, text: String(x.text || '').slice(0, 240) })),
    marks: (r.marks || []).slice(0, 6).map((m) => mark(m, d)).filter(Boolean) };
}

// join this run's reading onto the stored record. A closed record is never changed; an open one is updated; a new one is
// stamped with when the tracker first saw it (`first`) and whether that was while it was live (`src`).
export function merge(prev, fresh, now, feed = 'OANDA') {
  const old = new Map((prev || []).map((r) => [r.id, r])), out = [];
  const near = (r) => (prev || []).some((p) => p.id !== r.id && (p.market || 'xau') === (r.market || 'xau') && p.kind === r.kind && p.side === r.side && Math.abs(p.t - r.t) <= NEAR_S);
  const seen = new Set();
  for (const f of fresh) { const c = clean(f); if (!c || seen.has(c.id)) continue; seen.add(c.id);
    const p = old.get(c.id);
    if (p && (p.R != null || feedOf(p) !== feed)) { out.push(p); continue; }           // closed: frozen as booked; another feed's record: only its own feed follows it
    if (p) { out.push({ ...c, first: p.first, src: p.src, ...(p.feed ? { feed: p.feed } : {}) }); continue; }   // open: follow it
    if (near(c)) continue;
    if (feed !== 'OANDA') { if (now - c.t > FALLBACK_NEW_S) continue;                   // the second source adds only what is happening now
      out.push({ ...c, log: c.log.concat({ t: null, text: KR_NOTE }), first: now, src: now - c.t <= LIVE_S ? 'live' : 'replay', feed }); continue; }
    out.push({ ...c, first: now, src: now - c.t <= LIVE_S ? 'live' : 'replay' }); }
  for (const p of prev || []) if (!seen.has(p.id)) out.push(p);                         // out of this run's window: kept as it was
  return out.sort((a, b) => b.t - a.t).slice(0, KEEP);
}

export function build(B, F, prev, now, feed = 'OANDA', days = SOP.DAYS, market = 'xau') {
  if (!B['5m'] || !B['5m'].length) throw new Error('no candles');
  const from = B['5m'][B['5m'].length - 1].time - days * 86400;
  const fresh = SOP.sopTrades(B, F, { from, market }).concat(SOP.barrierTrades(B, F, { from, market }));
  const records = merge(prev && prev.records, fresh, now, feed), s = SOP.summary(records);
  return { v: 1, at: new Date(now * 1000).toISOString(), market: 'xau', markets: [...new Set(records.map((r) => r.market || 'xau'))], feed: market === 'xau' ? feed : (prev && prev.feed) || feed, through: market === 'xau' || !(prev && prev.through) ? B['5m'][B['5m'].length - 1].time + 300 : prev.through, days,
    since: records.length ? records[records.length - 1].t : null, counts: { n: s.n, closed: s.closed, open: s.open, live: records.filter((r) => r.src === 'live').length },
    note: 'A paper record of the desk\'s reading of the Mosha method on gold and four more markets: nothing is traded, results are before costs, and it is not a tested rule.', records };
}

// `--days N` (or MOSHA_DAYS) reads N days back once, to fill the record's history; the loop's own runs read the last 14
export async function main(dir, now = Math.floor(Date.now() / 1000), days = SOP.DAYS) {
  const file = path.join(dir, 'mosha', 'desk.json'); let prev = null;
  if (fs.existsSync(file)) { try { prev = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error('mosha/desk.json does not parse: left as it is'); } }
  const F = loadFns(), { feed, B, why } = await candles(now, fetch, undefined, days);
  if (why) console.log(`Mosha desk: main price source failed (${why}); reading Kraken's gold token instead`);
  let out = build(B, F, prev, now, feed, feed === 'OANDA' ? days : SOP.DAYS);
  // the other markets (21 Nov 2026, owner: "more trades"): the same reading, main price source only; one failing leaves the rest
  for (const m of OTHER) { try { const Bm = {}; for (const tf of Object.keys(SOP.BACK)) Bm[tf] = await bars(tf, now, fetch, days, m);
      if (Bm['5m'].length) out = build(Bm, F, out, now, 'OANDA', days, m); } catch (e) { console.log(`Mosha desk: ${m} skipped (${e && e.message || e})`); } }
  fs.mkdirSync(path.dirname(file), { recursive: true }); writeAtomic(file, JSON.stringify(out));
  console.log(`Mosha desk [${feed}]: ${out.counts.n} records (${out.counts.open} open, ${out.counts.live} seen live), through ${new Date(out.through * 1000).toISOString()}`);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main(process.argv[2] || 'data', undefined, Math.min(365, Math.max(SOP.DAYS, +(process.argv[process.argv.indexOf('--days') + 1] && process.argv.includes('--days') ? process.argv[process.argv.indexOf('--days') + 1] : process.env.MOSHA_DAYS) || SOP.DAYS))).catch((e) => { console.error('Mosha desk failed: ' + (e && e.message || e)); process.exit(1); });
