// Edge research · fx-ny-cut: the 10:00 New York option cut on seven forex majors. At 09:00 New York, when price is within
// 1-10 pips of a 50-pip round level, trade toward the level, out at 10:00 New York or the stop. Rule, costs and the pass bar:
// PREREGISTRATION.md (committed before this file read any candle). Round numbers are a proxy for option strikes (no strike
// data). Paper research only: nothing here trades or changes a live rule.
//   node --use-env-proxy run.mjs fetch <dir>   -> <dir>/<pair>-5m.json.gz (OANDA mid M5 from 2015-11-01, kept out of git)
//   node run.mjs full <dir>                    -> result.json and RESULT.md beside this file
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const PAIRS = ['eurusd', 'gbpusd', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'usdjpy'];
export const K = { M5: 300, GRID: 50, DMIN: 1, DMAX: 10, HOUR_MIN: 10, H_N: 20, STOP_MULT: 1.5, CONTROL: 25,
  OFF_LO: 5, OFF_SPAN: 40, EPS: 1e-9, SPREAD_PIP: 0.3, COMM_SIDE: 22.5e-6, SLIP_PIP: 0.5, SEEDS: 40,
  DATA_FROM: Date.UTC(2015, 10, 1) / 1000, IS_FROM: Date.UTC(2016, 0, 1) / 1000, OOS_FROM: Date.UTC(2021, 6, 1) / 1000,
  END: Date.UTC(2026, 10, 13) / 1000 };
export const pipOf = (pair) => (/jpy$/.test(pair) ? 0.01 : 0.0001);

// ─── New York clock (US daylight time: 2nd Sunday of March 07:00 UTC to 1st Sunday of November 06:00 UTC) ───
const nthSunday = (y, m, n) => { const d = new Date(Date.UTC(y, m, 1)); return Date.UTC(y, m, 1 + ((7 - d.getUTCDay()) % 7) + 7 * (n - 1)) / 1000; };
export function nyOffsetH(t) { const y = new Date(t * 1000).getUTCFullYear(); return t >= nthSunday(y, 2, 2) + 7 * 3600 && t < nthSunday(y, 10, 1) + 6 * 3600 ? -4 : -5; }
// UTC time of hh:00 New York on the calendar day that starts (UTC) at day0
export const nyAt = (day0, hh) => day0 + (hh - nyOffsetH(day0 + 12 * 3600)) * 3600;

// ─── levels (in pips): the multiple of GRID pips, shifted by `off` pips, nearest to the price ───
export function levelOf(px, pip, off = 0) { const x = px / pip; return (off + Math.round((x - off) / K.GRID) * K.GRID) * pip; }

const lowerT = (B, t) => { let a = 0, b = B.length; while (a < b) { const m = (a + b) >> 1; if (B[m].time < t) a = m + 1; else b = m; } return a; };

// every New York weekday of the file: the 09:00 candle, the hour's candles and range, H20 from the 20 earlier valid hours
export function daysOf(B, from = K.DATA_FROM, to = K.END) {
  const out = [], hist = [];
  for (let d0 = Math.floor(from / 86400) * 86400; d0 < to; d0 += 86400) {
    const wd = new Date(d0 * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const t9 = nyAt(d0, 9), i0 = lowerT(B, t9), i1 = lowerT(B, t9 + 3600);
    let hi = -Infinity, lo = Infinity; for (let i = i0; i < i1; i++) { if (B[i].high > hi) hi = B[i].high; if (B[i].low < lo) lo = B[i].low; }
    const n = i1 - i0, H20 = hist.length >= K.H_N ? hist.slice(-K.H_N).reduce((s, v) => s + v, 0) / K.H_N : null;
    const has9 = i0 < B.length && B[i0].time === t9, has10 = i1 < B.length && B[i1].time === t9 + 3600;
    out.push({ day: d0, t9, i9: has9 ? i0 : -1, i10: has10 ? i1 : -1, n, hi, lo, H20 });
    if (n >= K.HOUR_MIN) hist.push(hi - lo);
  }
  return out;
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
const touches = (B, i0, i1, L) => { for (let i = i0; i < i1; i++) if (B[i].low <= L + K.EPS && B[i].high >= L - K.EPS) return true; return false; };

// one day under the rule with the grid shifted by `off` pips: { skip } or { trade, release }
export function dayTrade(pair, B, d, off = 0) {
  if (d.i9 < 0) return { skip: 'no-09-candle' };
  if (d.n < K.HOUR_MIN) return { skip: 'hour-candles' };
  if (d.H20 == null) return { skip: 'warm-up' };
  const pip = pipOf(pair), p9 = B[d.i9].open, L = levelOf(p9, pip, off), dist = Math.abs(p9 - L) / pip;
  if (dist < K.DMIN - K.EPS) return { skip: 'at-level' };
  if (dist > K.DMAX + K.EPS) return { skip: 'far' };
  const side = L > p9 ? 1 : -1, S = K.STOP_MULT * d.H20, stop = p9 - side * S;
  const ex = manage(B, d.i9, side, stop, d.t9 + 3600);
  const trade = book(pair, d.day, side, p9, stop, ex, B[d.i9].time, { level: L, distPip: dist, touched: touches(B, d.i9, d.i9 + d.n, L) });
  let release = null;
  if (d.i10 >= 0) {
    const p10 = B[d.i10].open, s2 = p10 > L + K.EPS ? 1 : p10 < L - K.EPS ? -1 : 0;
    if (s2) release = book(pair, d.day, s2, p10, p10 - s2 * S, manage(B, d.i10, s2, p10 - s2 * S, d.t9 + 7200), B[d.i10].time, { level: L });
  }
  return { trade, release };
}
export function tradesOf(pair, B, D, off = 0, from = K.IS_FROM, to = K.END) {
  const trades = [], release = [], funnel = {};
  for (const d of D) {
    if (d.day < from || d.day >= to) continue;
    const r = dayTrade(pair, B, d, off);
    if (r.trade) { trades.push(r.trade); if (r.release) release.push(r.release); funnel.trade = (funnel.trade || 0) + 1; } else funnel[r.skip] = (funnel[r.skip] || 0) + 1;
  }
  return { trades, release, funnel };
}

export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const placeboOffset = (seed) => K.OFF_LO + K.OFF_SPAN * rng(seed)();

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
  L.push('# The 10:00 New York option cut, forex majors: result', '', `**Verdict: ${R.verdict.slice(0, vv)}.** ${R.verdict.slice(vv + 2, vv + 3).toUpperCase()}${R.verdict.slice(vv + 3)}`, '');
  L.push(`Pre-registered in PREREGISTRATION.md (committed before any candle was read). Seven pairs (${R.pairs.join(', ')}), OANDA mid M5,`,
    `in sample ${R.window.is}, out of sample ${R.window.oos}. At 09:00 New York (daylight time handled), when price is ${R.params.DMIN}-${R.params.DMAX} pips`,
    `from a ${R.params.GRID}-pip round level, trade toward it at market; stop ${R.params.STOP_MULT} x the 20-day mean 09:00-10:00 range; out at 10:00 New York or the stop.`,
    `Round numbers stand in for option strikes: no strike or open-interest data was available (a known limitation).`,
    `Costs: ${R.costs}. t on calendar-month sums. Paper research only: nothing live changed.`, '');
  L.push('## Pool and pairs', '', '| Stream | Window | n | Net R a trade | Gross R a trade | Net at 2x | t net (months) | t gross | Total net R | Win rate | Stops | Median stop (pips) |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  const row = (name, s) => { for (const w of ['is', 'oos']) { const x = s[w]; L.push(`| ${name} | ${w === 'is' ? 'IS 2016-21H1' : 'OOS 2021H2-26'} | ${x.n} | ${f(x.net)} | ${f(x.gross)} | ${f(x.net2)} | ${x.t.toFixed(2)} | ${x.tGross.toFixed(2)} | ${f(x.total, 1)} | ${(x.win * 100).toFixed(1)} % | ${x.stops} | ${x.medR0pip} |`); } };
  row('Pool', P); for (const p of R.pairs) row(p, R.byPair[p]);
  L.push('', '## The pass bar (pool decides)', '', '| Stream | ' + Object.keys(P.tests).join(' | ') + ' | Holm p (OOS) | Verdict |', '|---|' + Object.keys(P.tests).map(() => '---').join('|') + '|---|---|');
  L.push(`| Pool | ${Object.values(P.tests).map((x) => (x ? 'yes' : 'no')).join(' | ')} | ${P.pHolm} | ${P.verdict} |`);
  for (const p of R.pairs) { const S = R.byPair[p]; L.push(`| ${p} | ${Object.values(S.tests).map((x) => (x ? 'yes' : 'no')).join(' | ')} | ${S.pHolm} | ${S.verdict} |`); }
  L.push('', '## Placebo (out of sample, 40 seeds: the same rule at levels shifted 5-45 pips off the round grid) and the 25-pip control', '', '| Stream | Real net R a trade | Placebo mean | Placebo 95th pct | Placebo range | Real ranks above | 25-pip control (n, net R) |', '|---|---|---|---|---|---|---|');
  for (const [k, S] of [['Pool', P], ...R.pairs.map((p) => [p, R.byPair[p]])]) L.push(`| ${k} | ${f(S.oos.net)} | ${f(S.placebo.mean)} | ${f(S.placebo.p95)} | ${f(S.placebo.min)} to ${f(S.placebo.max)} | ${S.placebo.rank} of ${R.params.SEEDS} | ${S.control.oos.n}, ${f(S.control.oos.net)} |`);
  L.push('', '## Reported only: the release after the cut (10:00-11:00 New York, away from the same level, same stop)', '', '| Stream | Window | n | Net R a trade | Gross R a trade | t net (months) | t gross |', '|---|---|---|---|---|---|---|');
  for (const [k, S] of [['Pool', R.release.pool], ...R.pairs.map((p) => [p, R.release.byPair[p]])]) for (const w of ['is', 'oos']) { const x = S[w]; L.push(`| ${k} | ${w === 'is' ? 'IS' : 'OOS'} | ${x.n} | ${f(x.net)} | ${f(x.gross)} | ${x.t.toFixed(2)} | ${x.tGross.toFixed(2)} |`); }
  L.push('', `Touch rate in the hour (descriptive, whole sample): the round level was touched before 10:00 on ${(R.touch.real * 100).toFixed(1)} % of the primary trades (n ${R.touch.nReal}); the 25-pip level on ${(R.touch.control * 100).toFixed(1)} % of the control's trades (n ${R.touch.nControl}).`);
  L.push('', '## By year, pool (net R a trade / total net R / n)', '', '| Year | Net R a trade | Gross R a trade | Total net R | n |', '|---|---|---|---|---|');
  for (const [y, s] of Object.entries(R.years)) L.push(`| ${y} | ${f(s.net)} | ${f(s.gross)} | ${f(s.total, 1)} | ${s.n} |`);
  L.push('', '## Days (2016-01-01 to 2026-11-12, New York weekdays)', '', '| Pair | Candles | First | Last | Traded | Far from a level | At the level | No 09:00 candle | Hour candles missing | Warm-up |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const p of R.pairs) { const q = R.funnel[p]; L.push(`| ${p} | ${q.candles} | ${q.from} | ${q.to} | ${q.trade || 0} | ${q.far || 0} | ${q['at-level'] || 0} | ${q['no-09-candle'] || 0} | ${q['hour-candles'] || 0} | ${q['warm-up'] || 0} |`); }
  L.push('', '## Reading', '', ...R.reading.map((x) => `- ${x}`));
  L.push('', 'To repeat: `node --use-env-proxy research/edge/fx-ny-cut/run.mjs fetch <dir>` (candles outside git), then `node research/edge/fx-ny-cut/run.mjs full <dir>`. Tests: `tests/fx-ny-cut.test.mjs`.', '');
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
  const DIR = process.argv[3], data = {}, days = {}, funnel = {}, real = {}, rel = {}, ctl = {};
  const out = { topic: 'fx-ny-cut', built: '2026-11-14', at: new Date().toISOString(),
    system: 'At 09:00 New York, price 1-10 pips from a 50-pip round level: trade toward it, stop 1.5 x the 20-day mean 09:00-10:00 range, exit at the 10:00 New York option cut; seven forex majors, OANDA mid M5',
    window: { is: '2016-01-01 to 2021-06-30', oos: '2021-07-01 to 2026-11-12' }, params: K, pairs: PAIRS,
    costs: 'spread 0.3 pip + commission 22.5 USD per million a side (2 x 22.5e-6 x price a round trip) + 0.5 pip slippage on the entry and on the exit',
    limitation: 'No option strike or open-interest data: round numbers are a proxy for strikes.' };
  for (const p of PAIRS) {
    data[p] = load(DIR, p); days[p] = daysOf(data[p]);
    const r = tradesOf(p, data[p], days[p]); real[p] = r.trades; rel[p] = r.release; ctl[p] = tradesOf(p, data[p], days[p], K.CONTROL).trades;
    funnel[p] = { candles: data[p].length, from: iso(data[p][0].time), to: iso(data[p].at(-1).time), ...r.funnel };
  }
  out.funnel = funnel;
  const offs = Array.from({ length: K.SEEDS }, (_, i) => placeboOffset(i + 1));
  out.placeboOffsets = offs.map(r3);
  const plc = offs.map((o) => Object.fromEntries(PAIRS.map((p) => [p, tradesOf(p, data[p], days[p], o).trades])));
  const oosMean = (x) => mean(x.filter((t) => t.at >= K.OOS_FROM).map((t) => t.net));
  const sides = (x) => ({ is: summ(x, K.IS_FROM, K.OOS_FROM), oos: summ(x, K.OOS_FROM, K.END) });
  const stream = (ps) => {
    const x = ps.flatMap((p) => real[p]).sort((a, b) => a.at - b.at), s = sides(x);
    const pl = plc.map((m) => oosMean(ps.flatMap((p) => m[p]))), p95 = pctl(pl, 0.95);
    s.placebo = { seeds: K.SEEDS, mean: r3(mean(pl)), p95: r3(p95), min: r3(Math.min(...pl)), max: r3(Math.max(...pl)), rank: pl.filter((v) => s.oos.net > v).length, beats: s.oos.net > p95 };
    s.control = sides(ps.flatMap((p) => ctl[p]).sort((a, b) => a.at - b.at));
    s.p = +normSf(s.oos.t).toFixed(5); s.tests = judge(s); return s;
  };
  out.pool = stream(PAIRS); out.byPair = Object.fromEntries(PAIRS.map((p) => [p, stream([p])]));
  const ph = holm([out.pool.p, ...PAIRS.map((p) => out.byPair[p].p)]);
  out.pool.pHolm = +ph[0].toFixed(5); out.pool.verdict = Object.values(out.pool.tests).every(Boolean) ? 'PASS' : 'FAIL';
  PAIRS.forEach((p, i) => { const S = out.byPair[p]; S.pHolm = +ph[i + 1].toFixed(5); S.verdict = Object.values(S.tests).every(Boolean) && S.pHolm < 0.05 ? 'PASS' : 'FAIL'; });
  out.release = { pool: sides(PAIRS.flatMap((p) => rel[p]).sort((a, b) => a.at - b.at)), byPair: Object.fromEntries(PAIRS.map((p) => [p, sides(rel[p])])) };
  const allR = PAIRS.flatMap((p) => real[p]), allC = PAIRS.flatMap((p) => ctl[p]);
  out.touch = { real: r3(allR.filter((t) => t.touched).length / allR.length), nReal: allR.length, control: r3(allC.filter((t) => t.touched).length / allC.length), nControl: allC.length };
  const all = allR.sort((a, b) => a.at - b.at);
  out.years = {}; for (let y = 2016; y <= 2026; y++) { const s = summ(all, Math.max(K.IS_FROM, Date.UTC(y, 0, 1) / 1000), Math.min(K.END, Date.UTC(y + 1, 0, 1) / 1000)); out.years[y] = { n: s.n, net: s.net, gross: s.gross, total: s.total }; }
  const P = out.pool, sg = (z) => `${z >= 0 ? '+' : ''}${z}`;
  const bestPair = PAIRS.slice().sort((a, b) => out.byPair[b].oos.net - out.byPair[a].oos.net)[0], B1 = out.byPair[bestPair];
  out.verdict = `${P.verdict}: trading toward a round level from 09:00 to the 10:00 New York cut made ${sg(P.oos.net)}R a trade net out of sample (n ${P.oos.n}, t ${P.oos.t}). In sample ${sg(P.is.net)}R (n ${P.is.n}, t ${P.is.t}); gross out of sample ${sg(P.oos.gross)}R, at 2x costs ${sg(P.oos.net2)}R; placebo 95th percentile ${sg(P.placebo.p95)}R (real above ${P.placebo.rank} of 40). Best pair out of sample ${bestPair} ${sg(B1.oos.net)}R (n ${B1.oos.n}, t ${B1.oos.t}, Holm p ${B1.pHolm}); ${PAIRS.filter((p) => out.byPair[p].verdict === 'PASS').length} of ${PAIRS.length} pairs pass on their own.`;
  out.candidates = [{ rule: 'At 09:00 New York, 1-10 pips from a 50-pip round level: trade toward it, out at the 10:00 cut or the stop (pool of seven majors)', verdict: P.verdict, is: P.is, oos: P.oos },
    ...PAIRS.map((p) => ({ rule: `same rule, ${p} alone`, verdict: out.byPair[p].verdict, is: out.byPair[p].is, oos: out.byPair[p].oos }))];
  const rp = path.join(HERE, 'READING.json'); out.reading = fs.existsSync(rp) ? JSON.parse(fs.readFileSync(rp, 'utf8')) : [];
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out));
  console.log(JSON.stringify(funnel)); console.log('pool', JSON.stringify(P.is), JSON.stringify(P.oos), JSON.stringify(P.placebo), JSON.stringify(P.control.oos));
  for (const p of PAIRS) console.log(p, JSON.stringify(out.byPair[p].oos), out.byPair[p].pHolm, out.byPair[p].is.net, out.byPair[p].placebo.rank);
  console.log('release', JSON.stringify(out.release.pool)); console.log('touch', JSON.stringify(out.touch)); console.log(out.verdict);
}
