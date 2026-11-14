// Edge research · index-round-numbers: round numbers on four index CFDs (nas100, spx500, us30, de40), T1 stall (fade the
// first touch in the cash session of a round level approached from 0.5 x daily ATR away) and T2 break (follow the first M5
// close 0.05 x ATR beyond a level). Rules, costs and the pass bar: PREREGISTRATION.md (committed before this file read any
// candle). Conventions (touch, side, gap fill, stop-first, stop-only in the fill candle) are fx-round-numbers'.
// Paper research only: nothing here trades or changes a live rule.
//   node --use-env-proxy run.mjs fetch <dir>   -> <dir>/<market>-5m.json.gz (OANDA mid M5 from 2015-12-01, kept out of git)
//   node run.mjs full <dir>                    -> result.json and RESULT.md beside this file
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const MARKETS = ['nas100', 'spx500', 'us30', 'de40'];
export const SPEC = {
  nas100: { G: 500, cost: 2.0, tz: 'us' }, spx500: { G: 100, cost: 1.0, tz: 'us' },
  us30: { G: 1000, cost: 5.5, tz: 'us' }, de40: { G: 1000, cost: 2.0, tz: 'eu' },
};
export const K = { M5: 300, APPROACH: 0.5, T1_STOP: 0.25, T1_TGT: 0.5, T2_BEYOND: 0.05, T2_STOP: 0.1, T2_TGT: 0.5,
  ATR_N: 14, EPS: 1e-9, SEEDS: 40, MIN_N: 100,
  DATA_FROM: Date.UTC(2015, 11, 1) / 1000, IS_FROM: Date.UTC(2016, 0, 1) / 1000, OOS_FROM: Date.UTC(2021, 0, 1) / 1000 };
export const RULES = {
  T1: 'stall: limit at the first in-session touch of a level approached from 0.5 x ATR away, against the approach, stop 0.25 x ATR beyond, target 0.5 x ATR, flat at the session close',
  T2: 'break: first M5 close 0.05 x ATR beyond a level it touched, market at the next open, stop 0.1 x ATR back past the level, target 0.5 x ATR, flat at the session close',
};

// ─── sessions (UTC) ───
const DAY = 86400;
const sundayOf = (y, m, n) => { const d1 = new Date(Date.UTC(y, m, 1)).getUTCDay(); return Date.UTC(y, m, 1 + ((7 - d1) % 7) + 7 * (n - 1)) / 1000; };
const lastSunday = (y, m) => { const end = Date.UTC(y, m + 1, 0) / 1000, wd = new Date(end * 1000).getUTCDay(); return end - wd * DAY; };
export function usDst(day) { const y = new Date(day * 1000).getUTCFullYear(); return day >= sundayOf(y, 2, 2) && day < sundayOf(y, 10, 1); }
export function euDst(day) { const y = new Date(day * 1000).getUTCFullYear(); return day >= lastSunday(y, 2) && day < lastSunday(y, 9); }
// the cash session [open, close) on a UTC date (day = midnight UTC)
export function sessionOn(tz, day) {
  if (tz === 'us') { const off = usDst(day) ? 4 : 5; return [day + (9.5 + off) * 3600, day + (16 + off) * 3600]; }
  const off = euDst(day) ? 2 : 1; return [day + (9 - off) * 3600, day + (17.5 - off) * 3600];
}

// ─── daily ATR from the M5 file: UTC weekdays, mean true range of the 14 weekdays before the date ───
export function dailyOf(B) {
  const m = new Map();
  for (const b of B) { const d = Math.floor(b.time / DAY) * DAY, wd = new Date(d * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const x = m.get(d); if (!x) m.set(d, { time: d, high: b.high, low: b.low, close: b.close }); else { x.high = Math.max(x.high, b.high); x.low = Math.min(x.low, b.low); x.close = b.close; } }
  return [...m.values()].sort((a, b) => a.time - b.time);
}
export function atrBefore(D, day) {
  let j = 0; while (j < D.length && D[j].time < day) j++;
  if (j < K.ATR_N + 1) return null;
  let s = 0; for (let i = j - K.ATR_N; i < j; i++) s += Math.max(D[i].high, D[i - 1].close) - Math.min(D[i].low, D[i - 1].close);
  return s / K.ATR_N;
}
// sessions: { day, A, bars } with only the candles opening inside the session
export function sessionsOf(market, B) {
  const D = dailyOf(B), out = [], tz = SPEC[market].tz; let i = 0, j = 0;
  while (i < B.length) {
    const day = Math.floor(B[i].time / DAY) * DAY, [o, c] = sessionOn(tz, day), bars = [];
    while (i < B.length && B[i].time < day + DAY) { if (B[i].time >= o && B[i].time < c) bars.push(B[i]); i++; }
    if (!bars.length) continue;
    while (j < D.length && D[j].time < day) j++;
    let A = null; if (j >= K.ATR_N + 1) { let s = 0; for (let k = j - K.ATR_N; k < j; k++) s += Math.max(D[k].high, D[k - 1].close) - Math.min(D[k].low, D[k - 1].close); A = s / K.ATR_N; }
    if (A && A > 0) out.push({ day, A, bars });
  }
  return out;
}

// ─── the grid ───
export const gridOf = (G, off = 0) => ({ G, off, at: (k) => (k + off) * G });
const kLo = (g, p) => Math.ceil(p / g.G - g.off - 1e-7), kHi = (g, p) => Math.floor(p / g.G - g.off + 1e-7);
export function touched(g, c) { const out = []; for (let k = kLo(g, c.low); k <= kHi(g, c.high); k++) { const L = g.at(k); if (c.low <= L + K.EPS && c.high >= L - K.EPS) out.push(k); } return out; }

// manage inside the session's candles from index i (the fill / entry candle); `stopOnly` = only the stop counts in that
// candle (T1); later candles: gaps at the open, then stop first, then target; time exit at the last session candle's close
export function manage(S, pos) {
  const { side, stop, target } = pos, E = K.EPS;
  for (let j = pos.i; j < S.length; j++) {
    const c = S[j], first = j === pos.i;
    if (!first) {
      if (side > 0 ? c.open <= stop + E : c.open >= stop - E) return { kind: 'stop', px: c.open, at: c.time };
      if (side > 0 ? c.open >= target - E : c.open <= target + E) return { kind: 'target', px: c.open, at: c.time };
    }
    if (side > 0 ? c.low <= stop + E : c.high >= stop - E) return { kind: 'stop', px: stop, at: c.time };
    if (!(first && pos.stopOnly) && (side > 0 ? c.high >= target - E : c.low <= target + E)) return { kind: 'target', px: target, at: c.time };
  }
  const z = S[S.length - 1]; return { kind: 'time', px: z.close, at: z.time };
}
function book(market, rule, k, side, entry, stop, target, at, ex, A) {
  const r0 = Math.abs(entry - stop), gross = side * (ex.px - entry) / r0, cost = SPEC[market].cost;
  return { market, rule, k, at, side, entry, stop, target, r0, A, exit: ex.kind, exitPx: ex.px, exitAt: ex.at, gross, net: gross - cost / r0, net2: gross - 2 * cost / r0 };
}

// T1: fade the first in-session touch (decided from candles at or before the touch candle only)
export function stallSession(market, sess, off = 0) {
  const g = gridOf(SPEC[market].G, off), S = sess.bars, A = sess.A, seen = new Set(), out = [];
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < S.length; i++) {
    const c = S[i], ks = touched(g, c);
    if (i > 0) for (const k of ks) {
      if (seen.has(k)) continue;
      const L = g.at(k), pc = S[i - 1].close, side = pc < L - K.EPS ? -1 : pc > L + K.EPS ? 1 : 0; // -1 sell (from below)
      if (!side) continue;
      const dist = side < 0 ? L - lo : hi - L; if (!(dist >= K.APPROACH * A - K.EPS)) continue;
      const stop = L - side * K.T1_STOP * A, target = L + side * K.T1_TGT * A;
      if (side < 0 ? c.open >= stop - K.EPS : c.open <= stop + K.EPS) continue;
      const entry = side < 0 ? Math.max(L, c.open) : Math.min(L, c.open);
      const ex = manage(S, { side, stop, target, i, stopOnly: true });
      out.push(book(market, 'T1', k, side, entry, stop, target, c.time, ex, A));
    }
    for (const k of ks) seen.add(k);
    lo = Math.min(lo, c.low); hi = Math.max(hi, c.high);
  }
  return out;
}
// T2: the first close 0.05 x ATR beyond a level touched by that candle or the one before; market at the next open
export function breakSession(market, sess, off = 0) {
  const g = gridOf(SPEC[market].G, off), S = sess.bars, A = sess.A, Y = K.T2_BEYOND * A, done = new Set(), out = [], E = K.EPS;
  for (let i = 1; i + 1 < S.length; i++) {
    const c = S[i], pv = S[i - 1], n = S[i + 1], cand = [];
    const ku = kHi(g, c.close - Y), Lu = g.at(ku);
    if (c.close >= Lu + Y - E && pv.close < Lu + Y - E && Math.min(c.low, pv.low) <= Lu + E) cand.push([1, ku, Lu]);
    const kd = kLo(g, c.close + Y), Ld = g.at(kd);
    if (c.close <= Ld - Y + E && pv.close > Ld - Y + E && Math.max(c.high, pv.high) >= Ld - E) cand.push([-1, kd, Ld]);
    for (const [side, k, L] of cand) {
      if (done.has(k)) continue;
      const entry = n.open, stop = L - side * K.T2_STOP * A;
      if (side > 0 ? entry <= stop + E : entry >= stop - E) continue;
      done.add(k);
      const target = entry + side * K.T2_TGT * A, ex = manage(S, { side, stop, target, i: i + 1, stopOnly: false });
      out.push(book(market, 'T2', k, side, entry, stop, target, n.time, ex, A));
    }
  }
  return out;
}
export function tradesOf(market, sessions, rule, off = 0) { const f = rule === 'T1' ? stallSession : breakSession, out = []; for (const s of sessions) out.push(...f(market, s, off)); return out; }

// seeded uniform draws in [0, 1) (mulberry32): seed = the pre-registered seed number 1-40, nothing else mixed in
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const okOff = (u) => (u >= 0.05 && u <= 0.45) || (u >= 0.55 && u <= 0.95);
export function placeboOffs(seed) { const r = rng(seed), out = {}; for (const m of MARKETS) { let u = r(); while (!okOff(u)) u = r(); out[m] = u; } return out; }

// ─── statistics ───
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const r3 = (x) => +x.toFixed(3), r2 = (x) => +x.toFixed(2);
export const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
export function normSf(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? p : 1 - p; }
const monthKey = (t) => { const x = new Date(t * 1000); return x.getUTCFullYear() * 12 + x.getUTCMonth(); };
export function monthT(trades, from, to, key = 'net') {
  const m0 = monthKey(from), m1 = monthKey(to - 1), sums = new Array(m1 - m0 + 1).fill(0);
  for (const t of trades) if (t.at >= from && t.at < to) sums[monthKey(t.at) - m0] += t[key];
  const s = sd(sums); return { months: sums.length, t: s > 0 ? mean(sums) / (s / Math.sqrt(sums.length)) : 0 };
}
export function summ(trades, from, to) {
  const x = trades.filter((t) => t.at >= from && t.at < to), m = monthT(x, from, to);
  return { n: x.length, net: r3(mean(x.map((t) => t.net))), gross: r3(mean(x.map((t) => t.gross))), net2: r3(mean(x.map((t) => t.net2))),
    total: r2(x.reduce((s, t) => s + t.net, 0)), win: x.length ? r3(x.filter((t) => t.net > 0).length / x.length) : 0,
    months: m.months, t: r2(m.t), tGross: r2(monthT(x, from, to, 'gross').t), t2: r2(monthT(x, from, to, 'net2').t) };
}
export function pctl(a, q) { const s = [...a].sort((x, y) => x - y), h = (s.length - 1) * q, lo = Math.floor(h); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (h - lo); }
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let top = 0; o.forEach(([p, i], k) => { top = Math.max(top, Math.min(1, p * (ps.length - k))); out[i] = top; }); return out; }

// ─── the report, written from result.json ───
export function report(R) {
  const f = (x, d = 3) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}`, ts = Object.keys(R.tests), L = [], W = { is: 'IS 2016-20', oos: 'OOS 2021 on' };
  L.push('# Round numbers on four index CFDs (stall and break): result', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push(`Pre-registered in PREREGISTRATION.md (committed and pushed before any candle was read). Markets ${R.markets.join(', ')}, OANDA mid M5,`,
    `cash sessions only (US 09:30-16:00 New York, DAX 09:00-17:30 Frankfurt), in sample ${R.window.is}, out of sample ${R.window.oos}.`,
    `Levels: multiples of ${R.markets.map((m) => `${SPEC[m].G} (${m})`).join(', ')}; the half grid is the secondary; the placebo shifts the grid`,
    `by a random fraction of a step per market (40 seeds). Distances scale with the daily ATR(14). Costs: ${R.costs}. No financing (intraday).`,
    't on calendar-month sums; Holm over the four tests. The comparable forex study is `fx-round-numbers` (FAIL, 0 of 2). Paper research only: nothing live changed.', '');
  L.push('## The four tests, pooled', '', '| Test | Window | n | Gross R a trade | Net R a trade | t (months, net) | t (months, gross) | Total net R | Win rate | Net at 2x costs | t at 2x |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ts) for (const w of ['is', 'oos']) { const s = R.tests[k][w]; L.push(`| ${k} | ${W[w]} | ${s.n} | ${f(s.gross)} | ${f(s.net)} | ${s.t.toFixed(2)} | ${s.tGross.toFixed(2)} | ${f(s.total, 1)} | ${(s.win * 100).toFixed(1)} % | ${f(s.net2)} | ${s.t2.toFixed(2)} |`); }
  L.push('', `T1: ${RULES.T1}. T2: ${RULES.T2}. "half" = the same rule on the grid shifted by half a step.`);
  L.push('', '## The pass bar', '', '| Test | Role | Verdict | ' + Object.keys(R.tests[ts[0]].bar).join(' | ') + ' | p (one-sided, OOS) | Holm p |', '|---|---|---|' + Object.keys(R.tests[ts[0]].bar).map(() => '---').join('|') + '|---|---|');
  for (const k of ts) { const V = R.tests[k]; L.push(`| ${k} | ${V.role} | ${V.verdict} | ` + Object.values(V.bar).map((x) => (x ? 'yes' : 'no')).join(' | ') + ` | ${V.p} | ${V.pHolm} |`); }
  L.push('', '## Placebo: the grid shifted by a random fraction of a step (OOS, 40 seeds)', '', '| Test | Real net R a trade | Placebo mean | Placebo 95th pct | Placebo range | Real gross | Placebo gross mean | Placebo gross 95th pct | Real rank among 41 |', '|---|---|---|---|---|---|---|---|---|');
  for (const k of ts) { const V = R.tests[k], P = V.placebo; L.push(`| ${k} | ${f(V.oos.net)} | ${f(P.mean)} | ${f(P.p95)} | ${f(P.min)} to ${f(P.max)} | ${f(V.oos.gross)} | ${f(P.grossMean)} | ${f(P.grossP95)} | ${P.rank} |`); }
  L.push('', '## Per market (net R a trade, n, gross, t on months)', '', '| Test | Market | OOS net | n | gross | t | IS net | n | gross | t |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ts) for (const m of R.markets) { const a = R.tests[k].byMarket[m].oos, b = R.tests[k].byMarket[m].is; L.push(`| ${k} | ${m} | ${f(a.net)} | ${a.n} | ${f(a.gross)} | ${a.t.toFixed(2)} | ${f(b.net)} | ${b.n} | ${f(b.gross)} | ${b.t.toFixed(2)} |`); }
  L.push('', '## By year (net R a trade / total, n)', '', '| Year | ' + ts.join(' | ') + ' |', '|---|' + ts.map(() => '---').join('|') + '|');
  for (const y of Object.keys(R.tests[ts[0]].years)) L.push(`| ${y} | ` + ts.map((k) => { const s = R.tests[k].years[y]; return `${f(s.net)} / ${f(s.total, 1)} (n ${s.n})`; }).join(' | ') + ' |');
  L.push('', '## Exits and risk, OOS', '', ...ts.map((k) => `- ${k}: ` + Object.entries(R.tests[k].exits).map(([e, n]) => `${e} ${n}`).join(', ') + `; median cost ${R.tests[k].costR} R a trade`));
  L.push('', '## Data', '', '| Market | M5 candles | First | Last | Sessions with an ATR |', '|---|---|---|---|---|');
  for (const m of R.markets) { const q = R.funnel[m]; L.push(`| ${m} | ${q.candles} | ${q.from} | ${q.to} | ${q.sessions} |`); }
  L.push('', 'To repeat: `node --use-env-proxy research/edge/index-round-numbers/run.mjs fetch <dir>` (candles outside git), then `node research/edge/index-round-numbers/run.mjs full <dir>`. Tests: `tests/index-round-numbers.test.mjs`.', '');
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
const load = (dir, m) => toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${m}-5m.json.gz`)))));

if (MODE === 'fetch') {
  const OUT = process.argv[3]; fs.mkdirSync(OUT, { recursive: true });
  const end = Math.floor(Date.now() / 1000 / DAY) * DAY, list = process.argv[4] ? process.argv[4].split(',') : MARKETS;
  await Promise.all([0, 1].map(async (w) => { for (let k = w; k < list.length; k += 2) { const p = list[k], f = path.join(OUT, `${p}-5m.json.gz`); if (fs.existsSync(f)) continue;
    const rows = await range(p, K.DATA_FROM, end); fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(rows))); console.log(`${p}: ${rows.length} candles ${iso(rows[0][0])} → ${iso(rows.at(-1)[0])}`); } }));
}
if (MODE === 'full') {
  const DIR = process.argv[3], sess = {}, funnel = {};
  let END = Infinity;
  for (const m of MARKETS) { const B = load(DIR, m); sess[m] = sessionsOf(m, B); END = Math.min(END, B.at(-1).time);
    funnel[m] = { candles: B.length, from: iso(B[0].time), to: iso(B.at(-1).time), sessions: sess[m].length }; }
  const endDay = Math.floor(END / DAY) * DAY; // trades of the last (possibly incomplete) UTC day are left out
  const run = (rule, offs) => { const x = []; for (const m of MARKETS) x.push(...tradesOf(m, sess[m], rule, typeof offs === 'number' ? offs : offs[m])); return x.filter((t) => t.at >= K.IS_FROM && t.at < endDay).sort((a, b) => a.at - b.at); };
  const out = { topic: 'index-round-numbers', built: '2026-11-14', at: new Date().toISOString(),
    system: 'Round-number stall (fade the first touch) and break (follow the close beyond), four index CFDs, OANDA mid M5, cash sessions',
    window: { is: '2016-01-01 to 2020-12-31', oos: `2021-01-01 to ${iso(endDay - DAY).slice(0, 10)}` }, params: K, spec: SPEC, markets: MARKETS, funnel,
    costs: 'round trip nas100 2.0, spx500 1.0, us30 5.5, de40 2.0 index points (orb-nas100 / pre-fomc-drift, open-run-breadth)', tests: {} };
  const TESTS = { 'T1 round': ['T1', 0, 'primary'], 'T2 round': ['T2', 0, 'primary'], 'T1 half': ['T1', 0.5, 'secondary'], 'T2 half': ['T2', 0.5, 'secondary'] };
  const plOffs = Array.from({ length: K.SEEDS }, (_, s) => placeboOffs(s + 1));
  for (const [name, [rule, off, role]] of Object.entries(TESTS)) {
    const x = run(rule, off), is = summ(x, K.IS_FROM, K.OOS_FROM), oos = summ(x, K.OOS_FROM, endDay);
    const byMarket = Object.fromEntries(MARKETS.map((m) => [m, { is: summ(x.filter((t) => t.market === m), K.IS_FROM, K.OOS_FROM), oos: summ(x.filter((t) => t.market === m), K.OOS_FROM, endDay) }]));
    const years = {}; for (let y = 2016; y <= new Date(endDay * 1000).getUTCFullYear(); y++) { const s = summ(x, Date.UTC(y, 0, 1) / 1000, Math.min(Date.UTC(y + 1, 0, 1) / 1000, endDay)); years[y] = { n: s.n, net: s.net, total: s.total }; }
    const oT = x.filter((t) => t.at >= K.OOS_FROM), exits = {}; for (const t of oT) exits[t.exit] = (exits[t.exit] || 0) + 1;
    const pl = [], plG = [];
    for (const o of plOffs) { const y = run(rule, o).filter((t) => t.at >= K.OOS_FROM); pl.push(mean(y.map((t) => t.net))); plG.push(mean(y.map((t) => t.gross))); }
    const realNet = mean(oT.map((t) => t.net)), p95 = pctl(pl, 0.95);
    out.tests[name] = { rule, half: off === 0.5, role, is, oos, byMarket, years, exits, costR: r3(median(oT.map((t) => t.gross - t.net))), p: +normSf(oos.t).toFixed(5),
      placebo: { seeds: K.SEEDS, offsets: plOffs.map((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(4)]))), means: pl.map(r3), mean: r3(mean(pl)), p95: r3(p95),
        min: r3(Math.min(...pl)), max: r3(Math.max(...pl)), grossMean: r3(mean(plG)), grossP95: r3(pctl(plG, 0.95)), rank: 1 + pl.filter((v) => v > realNet).length, beats: realNet > p95 } };
  }
  const ts = Object.keys(out.tests), ph = holm(ts.map((k) => out.tests[k].p));
  for (const [i, k] of ts.entries()) { const V = out.tests[k]; V.pHolm = +ph[i].toFixed(5);
    V.bar = { 'OOS n >= 100': V.oos.n >= K.MIN_N, 'OOS month-sum t >= 2': V.oos.t >= 2, 'Holm p < 0.05': V.pHolm < 0.05, 'IS net R a trade > 0': V.is.net > 0,
      'OOS net at 2x costs > 0': V.oos.net2 > 0, 'beats the placebo 95th percentile': V.placebo.beats };
    V.verdict = Object.values(V.bar).every(Boolean) ? 'PASS' : 'FAIL'; }
  const prim = ts.filter((k) => out.tests[k].role === 'primary'), nPass = prim.filter((k) => out.tests[k].verdict === 'PASS').length;
  const sg = (z) => `${z >= 0 ? '+' : ''}${z}`;
  out.verdict = `${nPass ? 'PASS' : 'FAIL'}: ${nPass} of 2 rules pass. ` + prim.map((k) => { const V = out.tests[k]; return `${k.split(' ')[0]} OOS ${sg(V.oos.net)}R net (n ${V.oos.n}, t ${V.oos.t}), IS ${sg(V.is.net)}R`; }).join('; ');
  out.secondary = ts.filter((k) => out.tests[k].role === 'secondary').map((k) => ({ test: k, verdict: out.tests[k].verdict }));
  out.candidates = ts.map((k) => ({ rule: `${k}: ${RULES[out.tests[k].rule]}${out.tests[k].half ? ' (half levels)' : ''}`, verdict: out.tests[k].verdict, is: out.tests[k].is, oos: out.tests[k].oos }));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out));
  for (const k of ts) console.log(k, JSON.stringify(out.tests[k].is), JSON.stringify(out.tests[k].oos), JSON.stringify({ ...out.tests[k].placebo, offsets: undefined, means: undefined }), out.tests[k].pHolm, out.tests[k].verdict);
  console.log(out.verdict, out.verdict.length);
}
