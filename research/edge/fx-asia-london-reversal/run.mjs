// Edge research · fx-asia-london-reversal: a large 00:00-07:00 UTC (Asian) move faded at the 07:00 UTC London open, seven
// forex majors. Rule, costs and the pass bar: PREREGISTRATION.md (committed before this file read any candle). Paper research
// only: nothing here trades or changes a live rule.
//   node --use-env-proxy run.mjs fetch <dir>   -> <dir>/<pair>-5m.json.gz (OANDA mid M5 from 2015-11-01, kept out of git)
//   node run.mjs full <dir>                    -> result.json and RESULT.md beside this file
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const PAIRS = ['eurusd', 'gbpusd', 'audusd', 'nzdusd', 'usdjpy', 'usdcad', 'usdchf'];
export const K = { M5: 300, ASIA_MIN: 80, ATR_N: 20, NY_MIN: 100, KATR: 0.3, LATE: 30 * 60,
  EPS: 1e-9, SPREAD_PIP: 0.3, COMM_SIDE: 22.5e-6, SLIP_PIP: 0.5, SEEDS: 40,
  DATA_FROM: Date.UTC(2015, 10, 1) / 1000, IS_FROM: Date.UTC(2016, 0, 1) / 1000, OOS_FROM: Date.UTC(2021, 6, 1) / 1000,
  END: Date.UTC(2026, 10, 13) / 1000 };
export const pipOf = (pair) => (/jpy$/.test(pair) ? 0.01 : 0.0001);

// ─── New York clock (US daylight time: 2nd Sunday of March 07:00 UTC to 1st Sunday of November 06:00 UTC) ───
const nthSunday = (y, m, n) => { const d = new Date(Date.UTC(y, m, 1)); return Date.UTC(y, m, 1 + ((7 - d.getUTCDay()) % 7) + 7 * (n - 1)) / 1000; };
export function nyOffsetH(t) { const y = new Date(t * 1000).getUTCFullYear(); return t >= nthSunday(y, 2, 2) + 7 * 3600 && t < nthSunday(y, 10, 1) + 6 * 3600 ? -4 : -5; }
// start (UTC) of the New York day that contains t: 17:00 New York (21:00 UTC in US daylight time, else 22:00 UTC)
const nyBoundary = (d0) => d0 + (nyOffsetH(d0 + 12 * 3600) === -4 ? 21 : 22) * 3600;
export function nyDayStart(t) { const d0 = Math.floor(t / 86400) * 86400, b = nyBoundary(d0); return t >= b ? b : nyBoundary(d0 - 86400); }

const lowerT = (B, t) => { let a = 0, b = B.length; while (a < b) { const m = (a + b) >> 1; if (B[m].time < t) a = m + 1; else b = m; } return a; };

// daily candles = New York days built from M5 (a day with fewer than NY_MIN candles is not a daily candle)
export function nyDays(B) {
  const out = []; let cur = null;
  for (const c of B) {
    const s = nyDayStart(c.time);
    if (!cur || cur.start !== s) { if (cur) out.push(cur); cur = { start: s, open: c.open, high: c.high, low: c.low, close: c.close, n: 0, last: c.time }; }
    if (c.high > cur.high) cur.high = c.high; if (c.low < cur.low) cur.low = c.low; cur.close = c.close; cur.n++; cur.last = c.time;
  }
  if (cur) out.push(cur);
  return out.filter((d) => d.n >= K.NY_MIN).map((d) => ({ ...d, end: d.last + K.M5 }));
}
// ATR20 known at UTC time t: mean true range of the 20 daily candles that ENDED at or before t (true range needs the previous one)
export function atrAt(D, t) {
  let j = -1; for (let a = 0, b = D.length; a < b;) { const m = (a + b) >> 1; if (D[m].end <= t) { j = m; a = m + 1; } else b = m; }
  if (j < K.ATR_N) return null;
  let s = 0; for (let i = j - K.ATR_N + 1; i <= j; i++) { const p = D[i - 1].close; s += Math.max(D[i].high, p) - Math.min(D[i].low, p); }
  return s / K.ATR_N;
}

// ─── the day's Asia read and the trade ───
export function asiaOf(B, day0) {
  const i0 = lowerT(B, day0), i1 = lowerT(B, day0 + 7 * 3600);
  if (i1 - i0 < K.ASIA_MIN) return null;
  let hi = -Infinity, lo = Infinity; for (let i = i0; i < i1; i++) { if (B[i].high > hi) hi = B[i].high; if (B[i].low < lo) lo = B[i].low; }
  return { open: B[i0].open, close: B[i1 - 1].close, hi, lo, range: hi - lo, move: B[i1 - 1].close - B[i0].open, iEntry: i1 };
}
export function costPx(pair, entry, mult = 1) { const p = pipOf(pair); return mult * (K.SPREAD_PIP * p + 2 * K.COMM_SIDE * entry + 2 * K.SLIP_PIP * p); }

// from entry candle i (its open is the entry) to the close of the last candle opening before `end`
export function manage(B, i, side, stop, end) {
  for (let k = i; k < B.length && B[k].time < end; k++) {
    const c = B[k];
    if (k > i && (side > 0 ? c.open <= stop : c.open >= stop)) return { kind: 'stop', px: c.open, at: c.time };
    if (side > 0 ? c.low <= stop : c.high >= stop) return { kind: 'stop', px: stop, at: c.time };
  }
  const j = Math.max(i, lowerT(B, end) - 1);
  return { kind: 'time', px: B[j].close, at: B[j].time };
}
export function book(pair, day, side, entry, stop, ex, at, extra = {}) {
  const r0 = Math.abs(entry - stop), gross = side * (ex.px - entry) / r0;
  return { pair, day, at, side, entry, stop, r0, exit: ex.kind, exitPx: ex.px, exitAt: ex.at, gross,
    net: gross - costPx(pair, entry) / r0, net2: gross - costPx(pair, entry, 2) / r0, ...extra };
}
// one day: null when skipped; { skip } explains why, or a trade
export function dayTrade(pair, B, D, day0) {
  const wd = new Date(day0 * 1000).getUTCDay(); if (wd === 0 || wd === 6) return { skip: 'weekend' };
  const a = asiaOf(B, day0); if (!a) return { skip: 'asia-candles' };
  const atr = atrAt(D, day0); if (atr == null) return { skip: 'warm-up' };
  if (!(Math.abs(a.move) > K.KATR * atr)) return { skip: 'small' };
  const i = a.iEntry; if (i >= B.length || B[i].time >= day0 + 7 * 3600 + K.LATE) return { skip: 'no-entry' };
  const side = a.move > 0 ? -1 : 1, entry = B[i].open, stop = side < 0 ? a.hi + a.range : a.lo - a.range;
  if (side < 0 ? entry >= stop - K.EPS : entry <= stop + K.EPS) return { skip: 'past-stop' };
  const ex = manage(B, i, side, stop, day0 + 12 * 3600);
  return { trade: book(pair, day0, side, entry, stop, ex, B[i].time, { i, asiaMove: a.move, asiaRange: a.range, atr, moveAtr: Math.abs(a.move) / atr }) };
}
export function tradesOf(pair, B, from = K.IS_FROM, to = K.END) {
  const D = nyDays(B), out = [], funnel = {};
  for (let d = Math.floor(from / 86400) * 86400; d < to; d += 86400) {
    const r = dayTrade(pair, B, D, d);
    if (r.trade) { out.push(r.trade); funnel.trade = (funnel.trade || 0) + 1; } else funnel[r.skip] = (funnel[r.skip] || 0) + 1;
  }
  return { trades: out, funnel };
}

// placebo: same pair, day, entry candle and stop distance, random direction, same exit and costs
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placeboTrade(B, t, u) {
  const side = u < 0.5 ? 1 : -1, stop = t.entry - side * t.r0;
  return book(t.pair, t.day, side, t.entry, stop, manage(B, t.i, side, stop, t.day + 12 * 3600), t.at);
}

// ─── statistics ───
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
export const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
const r3 = (x) => +x.toFixed(3), r2 = (x) => +x.toFixed(2);
export function normSf(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? p : 1 - p; }
const monthKey = (t) => { const x = new Date(t * 1000); return x.getUTCFullYear() * 12 + x.getUTCMonth(); };
export function monthT(trades, from, to, key = 'net') {
  const m0 = monthKey(from), m1 = monthKey(to - 1), sums = new Array(m1 - m0 + 1).fill(0);
  for (const t of trades) if (t.at >= from && t.at < to) sums[monthKey(t.at) - m0] += t[key];
  const s = sd(sums); return { months: sums.length, t: s > 0 ? mean(sums) / (s / Math.sqrt(sums.length)) : 0 };
}
export function summ(trades, from, to) {
  const x = trades.filter((t) => t.at >= from && t.at < to), nets = x.map((t) => t.net);
  return { n: x.length, net: r3(mean(nets)), gross: r3(mean(x.map((t) => t.gross))), net2: r3(mean(x.map((t) => t.net2))), median: r3(median(nets)),
    total: r2(nets.reduce((s, v) => s + v, 0)), win: x.length ? r3(x.filter((t) => t.net > 0).length / x.length) : 0,
    months: monthT(x, from, to).months, t: r2(monthT(x, from, to).t), tGross: r2(monthT(x, from, to, 'gross').t), t2: r2(monthT(x, from, to, 'net2').t),
    stops: x.filter((t) => t.exit === 'stop').length, medR0pip: x.length ? r2(median(x.map((t) => t.r0 / pipOf(t.pair)))) : 0 };
}
export function pctl(a, q) { const s = [...a].sort((x, y) => x - y), h = (s.length - 1) * q, lo = Math.floor(h); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (h - lo); }
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let top = 0; o.forEach(([p, i], k) => { top = Math.max(top, Math.min(1, p * (ps.length - k))); out[i] = top; }); return out; }
export function judge(s) { return { 'OOS month-sum t >= 2 (net)': s.oos.t >= 2, 'IS net R a trade > 0': s.is.net > 0, 'OOS net R a trade > 0 at 2x costs': s.oos.net2 > 0, 'beats the placebo 95th percentile': s.placebo.beats }; }

// ─── report from result.json ───
export function report(R) {
  const f = (x, d = 3) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}`, L = [], P = R.pool;
  const vv = R.verdict.indexOf(': ');
  L.push('# Asian-session move reversed in London, forex majors: result', '', `**Verdict: ${R.verdict.slice(0, vv)}.** ${R.verdict.slice(vv + 2, vv + 3).toUpperCase()}${R.verdict.slice(vv + 3)}`, '');
  L.push(`Pre-registered in PREREGISTRATION.md (committed before any candle was read). Seven pairs (${R.pairs.join(', ')}), OANDA mid M5,`,
    `in sample ${R.window.is}, out of sample ${R.window.oos}. Asia = 00:00-07:00 UTC; a trade when |Asia move| > ${R.params.KATR} x ATR20 (New York days),`,
    'against the move at the 07:00 UTC open, stop one Asia range beyond the Asia extreme, out at 12:00 UTC or the stop.',
    `Costs: ${R.costs}. t on calendar-month sums. Paper research only: nothing live changed.`, '');
  L.push('## Pool and pairs', '', '| Stream | Window | n | Net R a trade | Gross R a trade | Net at 2x | t net (months) | t gross | Total net R | Win rate | Stops | Median stop (pips) |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  const row = (name, s) => { for (const w of ['is', 'oos']) { const x = s[w]; L.push(`| ${name} | ${w === 'is' ? 'IS 2016-21H1' : 'OOS 2021H2-26'} | ${x.n} | ${f(x.net)} | ${f(x.gross)} | ${f(x.net2)} | ${x.t.toFixed(2)} | ${x.tGross.toFixed(2)} | ${f(x.total, 1)} | ${(x.win * 100).toFixed(1)} % | ${x.stops} | ${x.medR0pip} |`); } };
  row('Pool', P); for (const p of R.pairs) row(p, R.byPair[p]);
  L.push('', '## The pass bar (pool decides)', '', '| Stream | ' + Object.keys(P.tests).join(' | ') + ' | Holm p (OOS) | Verdict |', '|---|' + Object.keys(P.tests).map(() => '---').join('|') + '|---|---|');
  L.push(`| Pool | ${Object.values(P.tests).map((x) => (x ? 'yes' : 'no')).join(' | ')} | ${P.pHolm} | ${P.verdict} |`);
  for (const p of R.pairs) { const S = R.byPair[p]; L.push(`| ${p} | ${Object.values(S.tests).map((x) => (x ? 'yes' : 'no')).join(' | ')} | ${S.pHolm} | ${S.verdict} |`); }
  L.push('', '## Placebo (out of sample, 40 seeds: same pair, day, entry candle and stop distance, random direction)', '', '| Stream | Real net R a trade | Placebo mean | Placebo 95th pct | Placebo range | Real ranks above |', '|---|---|---|---|---|---|');
  for (const [k, S] of [['Pool', P], ...R.pairs.map((p) => [p, R.byPair[p]])]) L.push(`| ${k} | ${f(S.oos.net)} | ${f(S.placebo.mean)} | ${f(S.placebo.p95)} | ${f(S.placebo.min)} to ${f(S.placebo.max)} | ${S.placebo.rank} of ${R.params.SEEDS} |`);
  L.push('', '## By year, pool (net R a trade / total net R / n)', '', '| Year | Net R a trade | Gross R a trade | Total net R | n |', '|---|---|---|---|---|');
  for (const [y, s] of Object.entries(R.years)) L.push(`| ${y} | ${f(s.net)} | ${f(s.gross)} | ${f(s.total, 1)} | ${s.n} |`);
  L.push('', '## Days', '', '| Pair | Candles | First | Last | Traded | Small move | Asia candles missing | Warm-up | Entry late | Past stop |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const p of R.pairs) { const q = R.funnel[p]; L.push(`| ${p} | ${q.candles} | ${q.from} | ${q.to} | ${q.trade || 0} | ${q.small || 0} | ${q['asia-candles'] || 0} | ${q['warm-up'] || 0} | ${q['no-entry'] || 0} | ${q['past-stop'] || 0} |`); }
  L.push('', '## Reading', '', ...R.reading.map((x) => `- ${x}`));
  L.push('', 'To repeat: `node --use-env-proxy research/edge/fx-asia-london-reversal/run.mjs fetch <dir>` (candles outside git), then `node research/edge/fx-asia-london-reversal/run.mjs full <dir>`. Tests: `tests/fx-asia-london-reversal.test.mjs`.', '');
  return L.join('\n');
}

// ─── modes ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchRange(sym, a0, b0) {
  const m = new Map();
  for (let a = a0; a < b0;) { const b = Math.min(b0, a + 4999 * K.M5); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) { try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null; if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); } if (!j) await sleep(2000 * (k + 1)); }
    if (!j) throw new Error(`${sym} 5m ${iso(a)}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150); }
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}
export const toBars = (rows) => rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const load = (dir, p) => toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${p}-5m.json.gz`)))).filter((r) => r[0] >= K.DATA_FROM && r[0] < K.END));

if (MODE === 'fetch') {
  const OUT = process.argv[3]; fs.mkdirSync(OUT, { recursive: true });
  for (const p of PAIRS) { const f = path.join(OUT, `${p}-5m.json.gz`); if (fs.existsSync(f)) continue;
    const rows = await fetchRange(p, K.DATA_FROM, K.END); fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(rows))); console.log(`${p}: ${rows.length} candles ${iso(rows[0][0])} → ${iso(rows.at(-1)[0])}`); }
}
if (MODE === 'full') {
  const DIR = process.argv[3], data = {}, all = [], funnel = {}, byPair = {};
  const out = { topic: 'fx-asia-london-reversal', built: '2026-11-14', at: new Date().toISOString(),
    system: 'Asian-session (00:00-07:00 UTC) move over 0.3 x ATR20 faded at the 07:00 UTC open, stop one Asia range past the Asia extreme, exit 12:00 UTC; seven forex majors, OANDA mid M5',
    window: { is: '2016-01-01 to 2021-06-30', oos: '2021-07-01 to 2026-11-12' }, params: K, pairs: PAIRS,
    costs: 'spread 0.3 pip + commission 22.5 USD per million a side (2 x 22.5e-6 x price a round trip) + 0.5 pip slippage on the entry and on the exit', funnel: {} };
  for (const p of PAIRS) { data[p] = load(DIR, p); const { trades, funnel: q } = tradesOf(p, data[p]); all.push(...trades); byPair[p] = trades;
    funnel[p] = { candles: data[p].length, from: iso(data[p][0].time), to: iso(data[p].at(-1).time), ...q }; }
  out.funnel = funnel; all.sort((a, b) => a.at - b.at);
  const stream = (x) => {
    const s = { is: summ(x, K.IS_FROM, K.OOS_FROM), oos: summ(x, K.OOS_FROM, K.END) }, real = x.filter((t) => t.at >= K.OOS_FROM), pl = [];
    for (let seed = 1; seed <= K.SEEDS; seed++) { const u = rng(seed); pl.push(mean(real.map((t) => placeboTrade(data[t.pair], t, u()).net))); }
    const p95 = pctl(pl, 0.95);
    s.placebo = { seeds: K.SEEDS, mean: r3(mean(pl)), p95: r3(p95), min: r3(Math.min(...pl)), max: r3(Math.max(...pl)), rank: pl.filter((v) => s.oos.net > v).length, beats: s.oos.net > p95 };
    s.p = +normSf(s.oos.t).toFixed(5); s.tests = judge(s); return s;
  };
  out.pool = stream(all); out.byPair = Object.fromEntries(PAIRS.map((p) => [p, stream(byPair[p])]));
  const ph = holm([out.pool.p, ...PAIRS.map((p) => out.byPair[p].p)]);
  out.pool.pHolm = +ph[0].toFixed(5); out.pool.verdict = Object.values(out.pool.tests).every(Boolean) ? 'PASS' : 'FAIL';
  PAIRS.forEach((p, i) => { const S = out.byPair[p]; S.pHolm = +ph[i + 1].toFixed(5); S.verdict = Object.values(S.tests).every(Boolean) && S.pHolm < 0.05 ? 'PASS' : 'FAIL'; });
  out.years = {}; for (let y = 2016; y <= 2026; y++) { const s = summ(all, Math.max(K.IS_FROM, Date.UTC(y, 0, 1) / 1000), Math.min(K.END, Date.UTC(y + 1, 0, 1) / 1000)); out.years[y] = { n: s.n, net: s.net, gross: s.gross, total: s.total }; }
  const P = out.pool, sg = (z) => `${z >= 0 ? '+' : ''}${z}`;
  const bestPair = PAIRS.slice().sort((a, b) => out.byPair[b].oos.net - out.byPair[a].oos.net)[0], B1 = out.byPair[bestPair];
  out.verdict = `${P.verdict}: the pool made ${sg(P.oos.net)}R a trade net out of sample (n ${P.oos.n}, month-sum t ${P.oos.t}; gross ${sg(P.oos.gross)}R, at 2x costs ${sg(P.oos.net2)}R), in sample ${sg(P.is.net)}R (n ${P.is.n}, t ${P.is.t}); placebo 95th percentile ${sg(P.placebo.p95)}R (real above ${P.placebo.rank} of 40). Best pair out of sample ${bestPair} ${sg(B1.oos.net)}R (n ${B1.oos.n}, t ${B1.oos.t}, Holm p ${B1.pHolm}); ${PAIRS.filter((p) => out.byPair[p].verdict === 'PASS').length} of ${PAIRS.length} pairs pass on their own.`;
  out.candidates = [{ rule: 'Fade a 00:00-07:00 UTC move over 0.3 x ATR20 at the 07:00 UTC open, stop one Asia range past the Asia extreme, exit 12:00 UTC (pool of seven majors)', verdict: P.verdict, is: P.is, oos: P.oos },
    ...PAIRS.map((p) => ({ rule: `same rule, ${p} alone`, verdict: out.byPair[p].verdict, is: out.byPair[p].is, oos: out.byPair[p].oos }))];
  const rp = path.join(HERE, 'READING.json'); out.reading = fs.existsSync(rp) ? JSON.parse(fs.readFileSync(rp, 'utf8')) : [];
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out));
  console.log(JSON.stringify(funnel)); console.log('pool', JSON.stringify(P.is), JSON.stringify(P.oos), JSON.stringify(P.placebo));
  for (const p of PAIRS) console.log(p, JSON.stringify(out.byPair[p].oos), out.byPair[p].pHolm, JSON.stringify(out.byPair[p].is.net));
  console.log(out.verdict);
}
