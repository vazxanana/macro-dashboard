// Edge research · fx-london-orb: the London-open range breakout on six forex majors, follow (two exits) and fade.
// Rule, costs and the pass bar: PREREGISTRATION.md (committed before this file read any test candle). Paper research only:
// nothing here trades or changes a live rule.
//   node --use-env-proxy run.mjs fetch <dir>   -> <dir>/<pair>-5m.json.gz (OANDA mid M5 from 2015-11-01, kept out of git)
//   node run.mjs full <dir>                    -> result.json and RESULT.md beside this file
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const PAIRS = ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdchf', 'eurjpy'];
export const K = { M5: 300, MIN_RANGE_BARS: 11, MED_N: 20, LO: 0.25, HI: 2, TGT: 1.5, FADE_PAD: 0.1,
  EPS: 1e-9, SPREAD_PIP: 0.3, COMM_SIDE: 22.5e-6, SLIP_PIP: 0.5, SEEDS: 40,
  DATA_FROM: Date.UTC(2015, 10, 1) / 1000, REP_FROM: Date.UTC(2016, 0, 1) / 1000, DEC_FROM: Date.UTC(2020, 0, 1) / 1000 };
export const VARIANTS = { F1: 'follow: stop orders at the range, stop the other side, exit 16:00 London',
  F2: 'follow: as F1 with a 1.5R target, else 16:00 London', FADE: 'fade the first close beyond the range, stop past the break candle + 0.1 x range, target the middle, exit 16:00 London' };
export const pipOf = (pair) => (/jpy$/.test(pair) ? 0.01 : 0.0001);

// ─── London clock ───
const lastSunday = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return Date.UTC(y, m, d.getUTCDate() - d.getUTCDay()) / 1000; };
// BST: from 01:00 UTC on the last Sunday of March to 01:00 UTC on the last Sunday of October
export function londonOffsetH(t) { const y = new Date(t * 1000).getUTCFullYear(); return t >= lastSunday(y, 2) + 3600 && t < lastSunday(y, 9) + 3600 ? 1 : 0; }
// UTC time of hh:mm London on the London calendar day that starts at UTC midnight `day0` (a UTC-midnight timestamp of that date)
export function londonAt(day0, hh, mm = 0) { const guess = day0 + hh * 3600 + mm * 60; return guess - londonOffsetH(guess - 3600) * 3600; }

// ─── day plans: the range and its filter, no candle after 08:00 London read ───
const lowerT = (B, t) => { let a = 0, b = B.length; while (a < b) { const m = (a + b) >> 1; if (B[m].time < t) a = m + 1; else b = m; } return a; };
export function days(B) {
  const out = [], hist = [];
  if (!B.length) return out;
  const d0 = Math.floor(B[0].time / 86400) * 86400, d1 = Math.floor(B.at(-1).time / 86400) * 86400;
  for (let d = d0; d <= d1; d += 86400) {
    const wd = new Date(d * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const a = londonAt(d, 7), b = londonAt(d, 8), i0 = lowerT(B, a), i1 = lowerT(B, b);
    if (i1 - i0 < K.MIN_RANGE_BARS) continue;
    let hi = -Infinity, lo = Infinity; for (let i = i0; i < i1; i++) { if (B[i].high > hi) hi = B[i].high; if (B[i].low < lo) lo = B[i].low; }
    const range = hi - lo, prev = hist.slice(-K.MED_N), med = prev.length === K.MED_N ? median(prev) : null;
    hist.push(range);
    const skip = med == null ? 'warm-up' : range < K.LO * med ? 'narrow' : range > K.HI * med ? 'wide' : null;
    out.push({ day: d, hi, lo, range, mid: (hi + lo) / 2, med, skip, start: b, until: londonAt(d, 12), end: londonAt(d, 16), iStart: i1 });
  }
  return out;
}
export const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

// ─── costs (price) and R ───
export function costPx(pair, entry, nMkt, mult = 1) { const p = pipOf(pair); return mult * (K.SPREAD_PIP * p + 2 * K.COMM_SIDE * entry + K.SLIP_PIP * p * nMkt); }

// manage an open position from candle i (the fill candle when `fillBar`) to the 16:00 London close
// pos: { side, entry, stop, target|null, i, fillBar } -> { exit, px, at, kind }
export function manage(B, pos, end) {
  const { side, stop, target } = pos;
  for (let i = pos.i; i < B.length && B[i].time < end; i++) {
    const c = B[i], first = i === pos.i && pos.fillBar;
    if (!first || pos.checkOpen) {
      if (side > 0 ? c.open <= stop : c.open >= stop) return { kind: 'stop', px: c.open, at: c.time, mkt: true };
      if (target != null && (side > 0 ? c.open >= target : c.open <= target)) return { kind: 'target', px: c.open, at: c.time, mkt: false };
    }
    if (side > 0 ? c.low <= stop : c.high >= stop) return { kind: 'stop', px: stop, at: c.time, mkt: true };
    if (target != null && !(first && pos.noTargetOnFill) && (side > 0 ? c.high >= target : c.low <= target)) return { kind: 'target', px: target, at: c.time, mkt: false };
  }
  let j = lowerT(B, end) - 1;
  if (j < pos.i) j = pos.i;
  return { kind: 'time', px: B[j].close, at: B[j].time, mkt: true };
}
function book(pair, d, side, entry, stop, target, ex, nEntryMkt, extra = {}) {
  const r0 = Math.abs(entry - stop), gross = side * (ex.px - entry) / r0, nM = nEntryMkt + (ex.mkt ? 1 : 0);
  return { pair, day: d.day, side, entry, stop, target, r0, exit: ex.kind, exitPx: ex.px, exitAt: ex.at, gross,
    net: gross - costPx(pair, entry, nM) / r0, net2: gross - costPx(pair, entry, nM, 2) / r0, ...extra };
}

// follow: one-cancels-other stop orders at the range, stop the other side
export function follow(pair, B, d, withTarget) {
  for (let i = d.iStart; i < B.length && B[i].time < d.until; i++) {
    const c = B[i], up = c.high >= d.hi, dn = c.low <= d.lo;
    if (!up && !dn) continue;
    let side;
    if (up && dn) side = Math.abs(d.hi - c.open) <= Math.abs(c.open - d.lo) ? 1 : -1;
    else side = up ? 1 : -1;
    const lvl = side > 0 ? d.hi : d.lo, entry = side > 0 ? Math.max(lvl, c.open) : Math.min(lvl, c.open), stop = side > 0 ? d.lo : d.hi;
    const r0 = Math.abs(entry - stop), target = withTarget ? entry + side * K.TGT * r0 : null;
    let ex;
    if (up && dn) ex = { kind: 'stop', px: stop, at: c.time, mkt: true };
    else ex = manage(B, { side, entry, stop, target, i, fillBar: true, noTargetOnFill: true }, d.end);
    return book(pair, d, side, entry, stop, target, ex, 1, { at: c.time });
  }
  return null;
}
// fade: the first close beyond the range, enter against it at the next open
export function fade(pair, B, d) {
  for (let i = d.iStart; i < B.length && B[i].time < d.until; i++) {
    const c = B[i], side = c.close > d.hi ? -1 : c.close < d.lo ? 1 : 0;
    if (!side) continue;
    const n = B[i + 1]; if (!n || n.time >= d.end) return null;
    const stop = side < 0 ? c.high + K.FADE_PAD * d.range : c.low - K.FADE_PAD * d.range, target = d.mid, entry = n.open;
    // "at" the stop or target includes float noise (prices compared within EPS 1e-9: the stop is computed, the open is quoted)
    if (side < 0 ? entry >= stop - K.EPS || entry <= target + K.EPS : entry <= stop + K.EPS || entry >= target - K.EPS) return null;
    const ex = manage(B, { side, entry, stop, target, i: i + 1, fillBar: true, checkOpen: false }, d.end);
    return book(pair, d, side, entry, stop, target, ex, 1, { at: n.time, breakAt: c.time, range: d.range });
  }
  return null;
}
export function tradesOf(pair, B, variant) {
  const out = [];
  for (const d of days(B)) { if (d.skip) continue; const t = variant === 'FADE' ? fade(pair, B, d) : follow(pair, B, d, variant === 'F2'); if (t) out.push(t); }
  return out;
}

// placebo: the real trade's pair, day, side, stop distance and target distance, entered at market at a random 08:00-11:55 open
// seeded uniform draws in [0, 1) (mulberry32): seed = the pre-registered seed number 1-40, nothing else mixed in
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// same fill rules as the variant: F2 checks only the stop in the entry candle, F1 has no target, FADE checks both
export function placeboTrade(pair, B, t, u, variant) {
  const d0 = t.day, start = londonAt(d0, 8), at = start + Math.floor(u * 48) * K.M5, i = lowerT(B, at);
  if (i >= B.length || B[i].time >= londonAt(d0, 12)) return null;
  const entry = B[i].open, stop = entry - t.side * t.r0, target = t.target == null ? null : entry + t.side * Math.abs(t.target - t.entry);
  const ex = manage(B, { side: t.side, entry, stop, target, i, fillBar: true, checkOpen: false, noTargetOnFill: variant === 'F2' }, londonAt(d0, 16));
  return book(pair, { day: d0 }, t.side, entry, stop, target, ex, 1);
}

// ─── statistics ───
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const r3 = (x) => +x.toFixed(3), r2 = (x) => +x.toFixed(2);
export function normSf(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? p : 1 - p; }
const monthKey = (t) => { const x = new Date(t * 1000); return x.getUTCFullYear() * 12 + x.getUTCMonth(); };
export function monthT(trades, from, to, key = 'net') {
  const m0 = monthKey(from), m1 = monthKey(to - 1), sums = new Array(m1 - m0 + 1).fill(0);
  for (const t of trades) if (t.at >= from && t.at < to) sums[monthKey(t.at) - m0] += t[key];
  const s = sd(sums); return { months: sums.length, t: s > 0 ? mean(sums) / (s / Math.sqrt(sums.length)) : 0 };
}
export function summ(trades, from, to) {
  const x = trades.filter((t) => t.at >= from && t.at < to), m = monthT(x, from, to);
  const wins = x.filter((t) => t.net > 0).length, nets = x.map((t) => t.net);
  return { n: x.length, median: x.length ? r3(median(nets)) : 0, tGross: r2(monthT(x, from, to, 'gross').t), net: r3(mean(x.map((t) => t.net))), gross: r3(mean(x.map((t) => t.gross))), net2: r3(mean(x.map((t) => t.net2))),
    total: r2(x.reduce((s, t) => s + t.net, 0)), win: x.length ? r3(wins / x.length) : 0, months: m.months, t: r2(m.t) };
}
export function pctl(a, q) { const s = [...a].sort((x, y) => x - y), h = (s.length - 1) * q, lo = Math.floor(h); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (h - lo); }
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let top = 0; o.forEach(([p, i], k) => { top = Math.max(top, Math.min(1, p * (ps.length - k))); out[i] = top; }); return out; }

// ─── the report, written from result.json (a reading written by hand is appended from READING.md) ───
export function report(R, reading = '') {
  const f = (x, d = 3) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}`, vs = Object.keys(R.variants), L = [];
  L.push('# London-open range breakout on forex majors: result', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push(`Pre-registered in PREREGISTRATION.md (committed before any trade was computed). Six pairs (${R.pairs.join(', ')}), OANDA mid M5,`,
    `decisive window ${R.window.decisive}, replication ${R.window.replication}. Range = 07:00-08:00 London (UTC+1 in UK summer time),`,
    `days with a range under 0.25x or over 2x its 20-day median skipped. Costs: ${R.costs}. t on calendar-month sums. Paper research only:`,
    'nothing live changed.', '');
  L.push('## Pooled, net of costs', '', '| Variant | Window | n | Net R a trade | Gross R a trade | t (months) | Total net R | Win rate | Net at 2x costs |', '|---|---|---|---|---|---|---|---|---|');
  for (const v of vs) for (const w of ['decisive', 'replication']) { const s = R.variants[v][w]; L.push(`| ${v} | ${w === 'decisive' ? '2020 on' : '2016-19'} | ${s.n} | ${f(s.net)} | ${f(s.gross)} | ${s.t.toFixed(2)} | ${f(s.total, 1)} | ${(s.win * 100).toFixed(1)} % | ${f(s.net2)} |`); }
  L.push('', 'Median net R a trade, 2020 on: ' + vs.map((v) => `${v} ${f(R.variants[v].decisive.median)}`).join(', ') + '. t of the gross (before costs) month sums, 2020 on: ' + vs.map((v) => `${v} ${R.variants[v].decisive.tGross.toFixed(2)}`).join(', ') + '; 2016-19: ' + vs.map((v) => `${v} ${R.variants[v].replication.tGross.toFixed(2)}`).join(', ') + '.');
  for (const v of vs) if (R.variants[v].postHoc) { L.push('', `Post-hoc, not judged (${v}: no minimum stop distance was pre-registered, so a few trades with a stop a fraction of a pip away divide the costs by almost nothing):`, '', '| Rows kept | Window | n | Net R a trade | Gross R a trade | t (months) |', '|---|---|---|---|---|---|');
    for (const [k, P] of Object.entries(R.variants[v].postHoc)) for (const w of ['decisive', 'replication']) { const s = P[w]; L.push(`| ${k} | ${w === 'decisive' ? '2020 on' : '2016-19'} | ${s.n} | ${f(s.net)} | ${f(s.gross)} | ${s.t.toFixed(2)} |`); } }
  L.push('', '## The pass bar', '', '| Variant | Verdict | ' + Object.keys(R.variants[vs[0]].tests).join(' | ') + ' | Holm p |', '|---|---|' + Object.keys(R.variants[vs[0]].tests).map(() => '---').join('|') + '|---|');
  for (const v of vs) { const V = R.variants[v]; L.push(`| ${v} | ${V.verdict} | ` + Object.values(V.tests).map((x) => (x ? 'yes' : 'no')).join(' | ') + ` | ${V.pHolm} |`); }
  L.push('', '## Placebo (decisive window, 40 seeds: same pair, day, side and stop / target distance, random entry 08:00-11:55 London)', '', '| Variant | Real net R a trade | Placebo mean | Placebo 95th pct | Placebo range |', '|---|---|---|---|---|');
  for (const v of vs) { const V = R.variants[v]; L.push(`| ${v} | ${f(V.decisive.net)} | ${f(V.placebo.mean)} | ${f(V.placebo.p95)} | ${f(V.placebo.min)} to ${f(V.placebo.max)} |`); }
  L.push('', '## Per pair (net R a trade, n, t on months)', '', '| Variant | Pair | 2020 on | n | t | 2016-19 | n | t |', '|---|---|---|---|---|---|---|---|');
  for (const v of vs) for (const p of R.pairs) { const a = R.variants[v].byPair[p].decisive, b = R.variants[v].byPair[p].replication; L.push(`| ${v} | ${p} | ${f(a.net)} | ${a.n} | ${a.t.toFixed(2)} | ${f(b.net)} | ${b.n} | ${b.t.toFixed(2)} |`); }
  L.push('', '## By year (net R a trade / total)', '', '| Year | ' + vs.join(' | ') + ' |', '|---|' + vs.map(() => '---').join('|') + '|');
  for (const y of Object.keys(R.variants[vs[0]].years)) L.push(`| ${y} | ` + vs.map((v) => { const s = R.variants[v].years[y]; return `${f(s.net)} / ${f(s.total, 1)} (n ${s.n})`; }).join(' | ') + ' |');
  L.push('', '## Exits, decisive window', '', ...vs.map((v) => `- ${v}: ` + Object.entries(R.variants[v].exits).map(([k, n]) => `${k} ${n}`).join(', ')));
  L.push('', '## Days', '', '| Pair | Candles | First | Last | Days with a range | Warm-up | Narrow | Wide | Kept |', '|---|---|---|---|---|---|---|---|---|');
  for (const p of R.pairs) { const q = R.funnel[p]; L.push(`| ${p} | ${q.candles} | ${q.from} | ${q.to} | ${q.days} | ${q.warmup} | ${q.narrow} | ${q.wide} | ${q.kept} |`); }
  if (reading) L.push('', reading.trim());
  L.push('', 'To repeat: `node --use-env-proxy research/edge/fx-london-orb/run.mjs fetch <dir>` (candles outside git), then `node research/edge/fx-london-orb/run.mjs full <dir>`. Tests: `tests/fx-london-orb.test.mjs`.', '');
  return L.join('\n');
}

// ─── modes ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function range(sym, a0, b0) {
  const m = new Map();
  for (let a = a0; a < b0;) { const b = Math.min(b0, a + 4999 * K.M5); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) { try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null; if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); } if (!j) await sleep(2000 * (k + 1)); }
    if (!j) throw new Error(`${sym} 5m ${iso(a)}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150); }
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}
export const toBars = (rows) => rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const load = (dir, p) => toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${p}-5m.json.gz`)))));

if (MODE === 'fetch') {
  const OUT = process.argv[3]; fs.mkdirSync(OUT, { recursive: true });
  const end = Math.floor(Date.now() / 1000 / 86400) * 86400, list = process.argv[4] ? process.argv[4].split(',') : PAIRS;
  await Promise.all([0, 1, 2].map(async (w) => { for (let k = w; k < list.length; k += 3) { const p = list[k], f = path.join(OUT, `${p}-5m.json.gz`); if (fs.existsSync(f)) continue;
    const rows = await range(p, K.DATA_FROM, end); fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(rows))); console.log(`${p}: ${rows.length} candles ${iso(rows[0][0])} → ${iso(rows.at(-1)[0])}`); } }));
}
if (MODE === 'full') {
  const DIR = process.argv[3], data = {}, T = {}, funnel = {};
  for (const p of PAIRS) { data[p] = load(DIR, p); const ds = days(data[p]); funnel[p] = { candles: data[p].length, from: iso(data[p][0].time), to: iso(data[p].at(-1).time), days: ds.length, warmup: ds.filter((d) => d.skip === 'warm-up').length, narrow: ds.filter((d) => d.skip === 'narrow').length, wide: ds.filter((d) => d.skip === 'wide').length, kept: ds.filter((d) => !d.skip).length }; }
  const END = Math.min(...PAIRS.map((p) => data[p].at(-1).time)) + K.M5, endDay = Math.floor(END / 86400) * 86400;
  for (const v of Object.keys(VARIANTS)) { T[v] = []; for (const p of PAIRS) T[v].push(...tradesOf(p, data[p], v)); T[v] = T[v].filter((t) => t.at >= K.REP_FROM && t.at < endDay).sort((a, b) => a.at - b.at); }
  const out = { topic: 'fx-london-orb', built: '2026-11-13', at: new Date().toISOString(), system: 'London-open range breakout (07:00-08:00 London range, follow and fade), six forex majors, OANDA mid M5',
    window: { replication: '2016-01-01 to 2019-12-31', decisive: `2020-01-01 to ${iso(endDay - 86400).slice(0, 10)}` }, params: K, pairs: PAIRS, funnel,
    costs: 'spread 0.3 pip + commission 22.5 USD per million a side (2 x 22.5e-6 x price a round trip) + 0.5 pip slippage per market or stop fill', variants: {} };
  for (const v of Object.keys(VARIANTS)) {
    const x = T[v], dec = summ(x, K.DEC_FROM, endDay), rep = summ(x, K.REP_FROM, K.DEC_FROM);
    const byPair = Object.fromEntries(PAIRS.map((p) => [p, { decisive: summ(x.filter((t) => t.pair === p), K.DEC_FROM, endDay), replication: summ(x.filter((t) => t.pair === p), K.REP_FROM, K.DEC_FROM) }]));
    const years = {}; for (let y = 2016; y <= new Date(endDay * 1000).getUTCFullYear(); y++) { const a = Date.UTC(y, 0, 1) / 1000, b = Math.min(Date.UTC(y + 1, 0, 1) / 1000, endDay); const s = summ(x, a, b); years[y] = { n: s.n, net: s.net, total: s.total }; }
    const exits = {}; for (const t of x.filter((t) => t.at >= K.DEC_FROM)) exits[t.exit] = (exits[t.exit] || 0) + 1;
    // placebo, decisive window
    const real = x.filter((t) => t.at >= K.DEC_FROM), pl = [];
    for (let s = 1; s <= K.SEEDS; s++) { const u = rng(s), nets = []; for (const t of real) { const q = placeboTrade(t.pair, data[t.pair], t, u(), v); if (q) nets.push(q.net); } pl.push(mean(nets)); }
    const p95 = pctl(pl, 0.95);
    // post-hoc, reported and never judged: the fade's stop can sit a fraction of a pip from its entry (no minimum distance was
    // pre-registered), so a few trades divide the costs by almost nothing; the same rows without them
    const postHoc = v !== 'FADE' ? undefined : Object.fromEntries([0.1, 0.25].map((c) => { const y = x.filter((t) => t.r0 >= c * t.range); return [`r0 >= ${c} x range`, { decisive: summ(y, K.DEC_FROM, endDay), replication: summ(y, K.REP_FROM, K.DEC_FROM) }]; }));
    out.variants[v] = { rule: VARIANTS[v], decisive: dec, ...(postHoc ? { postHoc } : {}), replication: rep, byPair, years, exits, p: +normSf(dec.t).toFixed(5),
      placebo: { seeds: K.SEEDS, mean: r3(mean(pl)), p95: r3(p95), min: r3(Math.min(...pl)), max: r3(Math.max(...pl)), beats: dec.net > p95 } };
  }
  const vs = Object.keys(out.variants), ph = holm(vs.map((v) => out.variants[v].p));
  for (const [i, v] of vs.entries()) { const V = out.variants[v]; V.pHolm = +ph[i].toFixed(5);
    V.tests = { 'decisive net R a trade > 0': V.decisive.net > 0, 'decisive month-sum t >= 2': V.decisive.t >= 2, '2016-19 net R a trade > 0': V.replication.net > 0, 'Holm-adjusted p < 0.05': V.pHolm < 0.05, 'beats the placebo 95th percentile': V.placebo.beats };
    V.verdict = Object.values(V.tests).every(Boolean) ? 'PASS' : 'FAIL'; }
  const sg = (z) => `${z >= 0 ? '+' : ''}${z}`;
  const any = vs.some((v) => out.variants[v].verdict === 'PASS') ? 'PASS' : 'FAIL';
  out.verdict = `${any}: ${vs.filter((v) => out.variants[v].verdict === 'PASS').length} of ${vs.length} variants pass. ` + vs.map((v) => { const V = out.variants[v]; return `${v} ${V.verdict} (2020 on ${sg(V.decisive.net)}R a trade net, n ${V.decisive.n}, t ${V.decisive.t}; 2016-19 ${sg(V.replication.net)}R, n ${V.replication.n})`; }).join('; ');
  out.candidates = vs.map((v) => ({ rule: `${v}: ${VARIANTS[v]}`, verdict: out.variants[v].verdict, is: out.variants[v].replication, oos: out.variants[v].decisive }));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out, fs.existsSync(path.join(HERE, 'READING.md')) ? fs.readFileSync(path.join(HERE, 'READING.md'), 'utf8') : ''));
  console.log(JSON.stringify(funnel)); for (const v of vs) console.log(v, JSON.stringify(out.variants[v].decisive), JSON.stringify(out.variants[v].replication), JSON.stringify(out.variants[v].placebo), out.variants[v].pHolm, out.variants[v].verdict);
  console.log(out.verdict);
}
