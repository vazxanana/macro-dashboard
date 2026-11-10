// Edge research (ict-filters): drive the ICT desk's own iFVG model (ict/tracker.mjs signals() + ict/replay.mjs simulate(),
// post-#413) over HistData M1 history 2018 -> Oct 2026 instead of CNBC: NSXUSD (Nasdaq 100 cash) as NQ, SPXUSD (S&P 500 cash)
// as ES, XAUUSD (spot gold) as GC. No model code is reimplemented: signals, grades, A-setup rule, sizing and exits are imported.
// The driver only builds the candles the replay would get from CNBC (5m without the 17:00 ET halt hour, H1 from 5m, D1 per
// 18:00-ET trading day) and adds research-only features (H4 bias, day of week, NDOG/NWOG proximity, swept-pivot count).
// Every signal (grade >= MIN_GRADE) is simulated on its own; the one-trade-per-market rule is applied later in analyse.mjs.
// Usage: node research/edge/ict-filters/driver.mjs <histdata dir (holds xau-histdata/ nsxusd-histdata/ spxusd-histdata/)> <out.json>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { MARKETS, P, MIN_GRADE, agg, signals, inHalt, isASetup, isAPlus, sizeOf } from '../../../ict/tracker.mjs';
import { simulate } from '../../../ict/replay.mjs';
import { histStampUtc } from '../../../council/histdata.mjs';   // HistData clock: UTC-5, UTC-4 in Europe's summer (2018: New York time)

const DIR = process.argv[2], OUT = process.argv[3] || 'ict-filters-trades.json';
const SRC = { nq: 'nsxusd-histdata', es: 'spxusd-histdata', gc: 'xau-histdata' };

function loadM1(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.csv.gz')).sort(), out = [];
  for (const f of files) for (const ln of zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString().split('\n')) {
    if (!ln) continue; const [d, o, h, l, c] = ln.split(';');
    const t = histStampUtc(d);
    out.push({ time: t, open: +o, high: +h, low: +l, close: +c });
  }
  return out.sort((a, b) => a.time - b.time);
}
// D1 per CME trading day: 18:00 New York -> 17:00 New York, stamped at its 18:00 start, so "time + 86400 <= t" means closed
const nyH = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
const nyParts = (t) => Object.fromEntries(nyH.formatToParts(new Date(t * 1000)).map((p) => [p.type, p.value]));
function daily(m5) {
  const m = new Map();
  for (const b of m5) { const p = nyParts(b.time); let day = Date.UTC(+p.year, +p.month - 1, +p.day) / 86400000; if (+p.hour >= 18) day += 1;
    const c = m.get(day); if (!c) m.set(day, { day, first: b.time, open: b.open, high: b.high, low: b.low, close: b.close, n: 1 });
    else { c.high = Math.max(c.high, b.high); c.low = Math.min(c.low, b.low); c.close = b.close; c.n++; } }
  return [...m.values()].filter((d) => d.n >= 24).sort((a, b) => a.day - b.day)
    .map((d) => { const s = nyParts(d.first); const start = d.first - ((+s.hour - 18 + 24) % 24) * 3600 - (d.first % 3600); return { time: start, open: d.open, high: d.high, low: d.low, close: d.close }; });
}
const lb = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const nyDow = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' });

const out = { at: new Date().toISOString(), src: {}, trades: [] };
for (const key of Object.keys(SRC)) {
  const M = MARKETS[key];
  const m1 = loadM1(path.join(DIR, SRC[key]));
  const m5 = agg(m1, 300).filter((b) => !inHalt(b.time));
  const H = agg(m5, 3600), D = daily(m5);
  const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
  const m5days = new Set([...days.entries()].filter(([, n]) => n >= 200).map(([d]) => d));
  out.src[key] = { file: SRC[key], m1: m1.length, m5: m5.length, h1: H.length, d1: D.length, from: new Date(H[0].time * 1000).toISOString().slice(0, 10), to: new Date(H.at(-1).time * 1000).toISOString().slice(0, 10) };
  console.log(key, JSON.stringify(out.src[key]));
  // research features
  const H4 = agg(H, 14400);
  const gaps = []; for (let i = 1; i < H.length; i++) { const dt = H[i].time - H[i - 1].time; if (dt >= 7200) gaps.push({ time: H[i].time, lo: Math.min(H[i - 1].close, H[i].open), hi: Math.max(H[i - 1].close, H[i].open), week: dt > 86400 }); }
  const lastGap = (t, week) => { for (let i = lb(gaps, t + 1) - 1; i >= 0; i--) if (gaps[i].time <= t && (!week || gaps[i].week)) return gaps[i]; return null; };
  const sig = signals(H, D, 1, M.tick).concat(signals(H, D, -1, M.tick)).filter((g) => g.grade.total >= MIN_GRADE).sort((a, b) => a.close - b.close);
  let gaps0 = 0;
  for (const g of sig) {
    const i0 = lb(H, g.close), j0 = lb(m5, g.close);
    const sub = { H: H.slice(i0, i0 + 200), m5: m5.slice(j0, j0 + 3000), m5days, cnbcFrom: null };
    const t = simulate(g, M, key, sub, Infinity); if (!t) { gaps0++; continue; }
    if (!t.closed) continue;
    const s = g.side, ext = g.stop + s * 2 * M.tick, atrD = g.feat.atrR ? g.r0 / g.feat.atrR : null;
    // H4 bias: last closed H4 close vs its 20-candle average, in the trade's direction
    const k4 = lb(H4, g.close - 14400 + 1) - 1; let h4 = null;
    if (k4 >= 20) { const sma = H4.slice(k4 - 19, k4 + 1).reduce((a, b) => a + b.close, 0) / 20; h4 = s * (H4[k4].close - sma) > 0 ? 'with' : 'against'; }
    // NDOG / NWOG: the sweep extreme inside the latest daily / weekly opening gap (+-0.1 daily ATR)
    const near = (z) => z && atrD ? ext >= z.lo - 0.1 * atrD && ext <= z.hi + 0.1 * atrD : false;
    const nd = lastGap(g.sweepT, false), nw = lastGap(g.sweepT, true);
    // swept pool size: confirmed 3-bar pivots (side-adjusted lows) in the 96 H1 bars before the sweep that the sweep candle took
    const is = lb(H, g.sweepT); let pools = 0;
    for (let j = Math.max(3, is - P.look); j <= is - 4; j++) { const v = (b) => (s > 0 ? b.low : -b.high), x = v(H[j]); let piv = true; for (let q = j - 3; q <= j + 3; q++) if (v(H[q]) < x) { piv = false; break; } if (piv && s * (ext - (s > 0 ? H[j].low : H[j].high)) < 0 && (s > 0 ? H[is].low < H[j].low : H[is].high > H[j].high)) pools++; }
    t.x = { year: new Date(g.close * 1000).getUTCFullYear(), dow: DOW.indexOf(nyDow.format(new Date(g.close * 1000))), h4, ndog: near(nd), nwog: near(nw), pools, atrD };
    t.aset = isASetup(g, key); t.aplus = isAPlus(g, key); t.size = t.aset ? sizeOf(g, key) : 1;
    delete t.path; delete t.label; delete t.model; delete t.replay;
    out.trades.push(t);
  }
  console.log(key, 'signals', sig.length, 'simulated', out.trades.filter((x) => x.market === key).length, 'gap-dropped', gaps0);
}
fs.writeFileSync(OUT, JSON.stringify(out));
