// Event risk manager, step 1: the trades and the flatten prices (pre-registration: preregistration.md, committed first).
// No event result is computed here; analyse.mjs does that.
//
//   node research/edge/event-risk/build.mjs <council-data checkout> [out dir = this folder]
//
// Needs, in the council-data checkout: research/candles/{xau,nsxusd,spxusd}-histdata (HistData M1), ict/replay.json and
// research/replay-2w.json. Writes:
//   ict-hist.json  ICT A-setups 2022-01-01 .. 2025-07-31 (signal close) on HistData, with entry, r0 and the flatten price
//                  at T-5 min for the first CPI/NFP/FOMC release crossed (same 5m series the simulation used)
//   flat.json      flatten prices for the ICT replay (futures, scaled from cash/spot M1) and the Meridian intraday systems
// The ICT trades are made the way research/edge/ict-universe/universe.mjs and research/edge/ict-smile/build.mjs made them:
// the desk's own signals() / isASetup() / sizeOf() / MIN_GRADE / simulate(), the replay's busy rule, from 2018 so the busy
// state matches, then cut to the window. Paper research only.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { MARKETS, MIN_GRADE, signals, isASetup, sizeOf, inHalt } from '../../../ict/tracker.mjs';
import { simulate } from '../../../ict/replay.mjs';
import { HISTORY, EVENTS } from '../../../council/events.mjs';
import { histStampUtc } from '../../../council/histdata.mjs';   // the shared HistData clock

const CD = process.argv[2];
const OUT = process.argv[3] || path.dirname(fileURLToPath(import.meta.url));
if (!CD) { console.error('usage: build.mjs <council-data checkout> [out dir]'); process.exit(2); }
const CAND = path.join(CD, 'research', 'candles');
export const FROM = Date.UTC(2022, 0, 1) / 1000, TO = Date.UTC(2025, 7, 1) / 1000;
export const TYPES = ['CPI', 'NFP', 'FOMC'];
export const REL = [...HISTORY, ...EVENTS].filter((e) => TYPES.includes(e.type)).sort((a, b) => a.t - b.t);
export const FLAT = 300, STALE = 1800;   // flatten 5 min before the release; the candle used may be at most 30 min old
// first release crossed: e <= T - 5 min < x
export const crossed = (e, x) => REL.find((r) => e <= r.t - FLAT && r.t - FLAT < x) || null;
const lb = (A, t, key = (a) => a) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (key(A[m]) < t) lo = m + 1; else hi = m; } return lo; };

// ── HistData M1 (council/histdata.mjs clock: UTC-5, UTC-4 in Europe's summer; +5 h before 10 Nov 2026) ──
function readM1(dir, pre) {
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(pre) && f.endsWith('.csv.gz')).sort(), rows = [];
  for (const f of files) for (const ln of zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString().split('\n')) {
    if (ln.length < 20) continue; const p = ln.split(';');
    const t = histStampUtc(ln);
    const o = +p[1], h = +p[2], l = +p[3], c = +p[4]; if (!(o > 0 && h > 0 && l > 0 && c > 0)) continue;
    rows.push([t, o, h, l, c]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  return rows;
}
// close of the last M1 candle ending at or before `end` (open <= end - 60), not older than STALE
function m1CloseAt(M1, end) {
  const i = lb(M1, end - 60 + 1, (r) => r[0]) - 1; if (i < 0) return null;
  return M1[i][0] + 60 >= end - STALE ? { px: M1[i][4], at: M1[i][0] + 60 } : null;
}

// ── ICT HistData part (universe.mjs's loader and loop, primary cells only) ──
const to5m = (M1) => { const m5 = []; let cur = null;
  for (const [t, o, h, l, c] of M1) { if (inHalt(t)) continue; const k = t - (t % 300);
    if (cur && cur.time === k) { if (h > cur.high) cur.high = h; if (l < cur.low) cur.low = l; cur.close = c; }
    else if (!cur || k > cur.time) { cur = { time: k, open: o, high: h, low: l, close: c }; m5.push(cur); } }
  return m5; };
const aggH = (bars) => { const out = []; let cur = null; for (const b of bars) { const k = b.time - (b.time % 3600);
  if (cur && cur.time === k) { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; } else { cur = { ...b, time: k }; out.push(cur); } } return out; };
const NYF = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' });
const nyOff = (t) => (NYF.formatToParts(new Date(t * 1000)).find((x) => x.type === 'timeZoneName').value.includes('-4') ? 4 : 5);
function daily(H) {
  const out = []; let cur = null, key = null;
  for (const b of H) { const off = nyOff(b.time), day = Math.floor((b.time - off * 3600 + 7 * 3600) / 86400);
    if (day !== key) { key = day; const closeUtc = (day + 1) * 86400 - 7 * 3600 + off * 3600; cur = { time: closeUtc - 86400, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(cur); }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; } }
  return out;
}
const U = {
  gc:     { dir: 'xau-histdata',    pre: 'XAUUSD', mk: 'gc', cfg: 'gold',  M: { ...MARKETS.gc, aRule: 'gold' }, cost: () => 0.5 },
  nas100: { dir: 'nsxusd-histdata', pre: 'NSXUSD', mk: 'nq', cfg: 'index', M: { label: 'NAS100 cash', short: 'NAS', tick: 0.25, dec: 2 }, cost: (p) => p * 0.0002 + 0.25 },
  spx:    { dir: 'spxusd-histdata', pre: 'SPXUSD', mk: 'es', cfg: 'index', M: { label: 'SPX cash', short: 'SPX', tick: 0.25, dec: 2 }, cost: (p) => p * 0.0002 + 0.25 },
};
const M1s = {};
const hist = [];
for (const [key, u] of Object.entries(U)) {
  const t0 = Date.now(), M1 = (M1s[u.pre] = readM1(path.join(CAND, u.dir), u.pre)), m5 = to5m(M1), H = aggH(m5), D = daily(H);
  const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
  const m5days = new Set([...days.entries()].filter(([, n]) => n >= 200).map(([d]) => d));
  const rule = u.cfg === 'gold' ? 'gc' : 'nq';   // which rule isASetup()/sizeOf() apply (universe.mjs's mk)
  const sig = signals(H, D, 1, u.M.tick).concat(signals(H, D, -1, u.M.tick)).filter((g) => g.grade.total >= MIN_GRADE).sort((a, b) => a.close - b.close);
  let busyAll = 0, busyA = 0;
  for (const g of sig) {
    const a = isASetup(g, rule); if (g.close < (a ? busyA : busyAll)) continue;
    const i = lb(H, g.close, (b) => b.time), j = lb(m5, g.close, (b) => b.time);
    const t = simulate(g, u.M, key, { H: H.slice(i, i + 120), m5: m5.slice(j, j + 12 * 24 * 12), m5days }); if (!t || !t.closed) continue;
    busyAll = Math.max(busyAll, t.closed); if (a) busyA = t.closed;
    if (!a || g.close < FROM || g.close >= TO) continue;
    const size = sizeOf(g, rule), cost = u.cost(g.entry), rec = { id: `${u.mk}-${g.side > 0 ? 'b' : 's'}-${g.close}`, market: u.mk, side: g.side > 0 ? 'buy' : 'sell', e: g.close, x: t.closed,
      entry: g.entry, r0: g.r0, size, Rraw: t.R, costR: +(cost / g.r0).toFixed(4), exit: t.exit, res: t.res };
    const r = crossed(rec.e, rec.x);
    if (r) { const k = lb(m5, r.t - FLAT, (b) => b.time) - 1;   // last 5m candle ending at or before T - 5 min
      const b = k >= 0 && m5[k].time + 300 <= r.t - FLAT && m5[k].time + 300 >= r.t - FLAT - STALE ? m5[k] : null;
      rec.flat = { T: r.t, type: r.type, px: b ? b.close : null, at: b ? b.time + 300 : null }; }
    hist.push(rec);
  }
  console.log(key, 'A-setups in window', hist.filter((x) => x.market === u.mk).length, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
hist.sort((a, b) => a.e - b.e);
fs.writeFileSync(path.join(OUT, 'ict-hist.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10),
  source: 'ict-universe code (signals/isASetup/sizeOf/simulate) on council-data research/candles HistData M1; primary rule set per market',
  window: [new Date(FROM * 1000).toISOString(), new Date(TO * 1000).toISOString()], note: 'Rraw per unit, gross; costR = round-trip cost / r0; flat = first CPI/NFP/FOMC release with e <= T-5min < x and the close of the 5m candle ending at or before T-5min', trades: hist }).replace(/\},\{"id"/g, '},\n{"id"'));

// ── flatten prices for the ICT replay (futures) and the Meridian intraday systems (scaled from cash / spot M1) ──
const rd = (f) => JSON.parse(fs.readFileSync(path.join(CD, f), 'utf8'));
const SRC = { nq: 'NSXUSD', es: 'SPXUSD', gc: 'XAUUSD', xau: 'XAUUSD' };
const flat = {}, miss = {};
const scaled = (pre, e, T) => { const M1 = M1s[pre], a = m1CloseAt(M1, e), b = m1CloseAt(M1, T - FLAT); if (!a || !b) return null;
  return { cashEntry: a.px, cashFlat: b.px, at: b.at }; };
const note = (why) => { miss[why] = (miss[why] || 0) + 1; };
for (const q of rd('ict/replay.json').trades) {
  if (!q.aset || !['win', 'loss', 'be'].includes(q.status) || q.R == null) continue;
  const r = crossed(q.signalAt, q.closed); if (!r) continue;
  const pre = SRC[q.market]; if (!pre) { note(`ict ${q.market}: no M1 file`); flat[q.id] = { T: r.t, type: r.type, px: null, why: 'no M1 file' }; continue; }
  const s = scaled(pre, q.signalAt, r.t); if (!s) { note(`ict ${q.market}: no M1 candle`); flat[q.id] = { T: r.t, type: r.type, px: null, why: 'no M1 candle' }; continue; }
  const k = q.entry / s.cashEntry; flat[q.id] = { T: r.t, type: r.type, px: +(s.cashFlat * k).toFixed(4), k: +k.toFixed(6), at: s.at };
}
const R2W = rd('research/replay-2w.json').trades;
for (const q of R2W) {
  if (!['nq-open', 'replica'].includes(q.k) || q.shadow || !['win', 'loss', 'be'].includes(q.status)) continue;
  const e = q.filled || q.opened; if (e < FROM) continue;
  const r = crossed(e, q.closed); if (!r) continue;
  const s = scaled(SRC[q.market], e, r.t); if (!s) { note(`meridian ${q.k}: no M1 candle`); flat[q.id] = { T: r.t, type: r.type, px: null, why: 'no M1 candle' }; continue; }
  const k = q.entry / s.cashEntry; flat[q.id] = { T: r.t, type: r.type, px: +(s.cashFlat * k).toFixed(4), k: +k.toFixed(6), at: s.at };
}
fs.writeFileSync(path.join(OUT, 'flat.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10),
  note: 'Flatten price at T-5min for trades crossing a CPI/NFP/FOMC release: HistData M1 close of the candle ending at or before T-5min, times k = entry / M1 close at entry (futures or replay level). NQ <- NSXUSD, ES <- SPXUSD, GC and XAU <- XAUUSD. YM / RTY have no M1 file.',
  missing: miss, flat }, null, 0).replace(/\},"/g, '},\n"'));
console.log('ict-hist', hist.length, 'with a crossed release', hist.filter((x) => x.flat).length, '| flat.json', Object.keys(flat).length, 'missing', JSON.stringify(miss));
