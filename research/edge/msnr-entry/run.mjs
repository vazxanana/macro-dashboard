// Edge research · msnr-entry (11 Nov 2026): the owner's direction call (H4 working, Daily key levels) as a GATE in front of the
// owner's engulfing entry (an M15 body engulf, then an M5 body engulf, entry at the next M5 open, stop past the trigger pair,
// fixed reward-to-risk), as trades net of costs on spot gold. The same candidates are taken three ways: ALL (no gate), WITH
// the call, AGAINST the call. Everything here is fixed in PREREGISTRATION.md (committed before this file simulated a trade).
// The direction detector `calls()` and its calendar are COPIED from research/edge/msnr-direction/run.mjs (the direction
// study, on another branch); nothing is imported from it. Paper research only: nothing here trades or changes a live rule.
//   node run.mjs fetch <dir>            -> <dir>/xau-5m.json.gz (OANDA M5 through the candle proxy; kept out of git)
//   CANDLES=<dir> node run.mjs run      -> result.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const P = { K: 2, ZONE_AGE: 60, WAIT: 10, BODY: 0.4, ARM: 2700, PAD: 0.30, MIN_R0: 1.00, HOLD: 43200, COST: 0.30, MS_N: 3,
  M5: 300, M15: 900, H4: 14400, DATA_FROM: Date.UTC(2006, 5, 1) / 1000, A: ['2007-01-01', '2019-12-31'], B: ['2020-01-01', '2026-10-31'], BOOT: 5000, SEED: 20261111 };
export const TESTS = {
  T1: { name: 'main: trigger 12:00-15:55 UTC, target 1.5R', rr: 1.5, session: [12, 16] },
  T2: { name: 'variant "2R": trigger 12:00-15:55 UTC, target 2R', rr: 2, session: [12, 16] },
  T3: { name: 'variant "all hours": any trigger hour, target 1.5R', rr: 1.5, session: null },
};
export const STREAMS = { ALL: 'every candidate, the call ignored', WITH: 'side equals the call', AGAINST: 'side opposite to the call' };

// ─── calendar and grouping (copied from the direction study) ───
export function dayKey(t) { const d = new Date(t * 1000), w = d.getUTCDay(); let k = Math.floor(t / 86400) * 86400; if (w === 0) k += 86400; else if (w === 6) k += 2 * 86400; return k; }
export function group(bars, keyOf) {
  const out = [];
  for (const b of bars) { const k = keyOf(b.time), g = out.at(-1);
    if (g && g.time === k) { if (b.high > g.high) g.high = b.high; if (b.low < g.low) g.low = b.low; g.close = b.close; g.last = b.time; }
    else out.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close, last: b.time }); }
  return out;
}
export const bucket = (sec) => (t) => Math.floor(t / sec) * sec;

// ─── the direction call, candle by candle (copied unchanged from the direction study) ───
// work: candles of the working timeframe in time order; keyOf: the higher-timeframe candle a working candle belongs to.
// call[i] (+1 buy, -1 sell, 0 none) is the call as known at the close of work[i]; nothing at i reads a candle after i.
export function calls(work, keyOf, opt = {}) {
  const K = opt.K ?? P.K, ZONE_AGE = opt.ZONE_AGE ?? P.ZONE_AGE, WAIT = opt.WAIT ?? P.WAIT;
  const n = work.length, call = new Int8Array(n), structure = new Int8Array(n), events = [];
  const H = []; let cur = null, zones = [], pend = [], lastA = null, lastV = null, st = 0, dir = 0;
  const addZone = (s, kind, bottom, top) => { if (top >= bottom) zones.push({ s, kind, bottom, top, born: H.length, tapped: false, dead: false }); };
  const onHtfClose = () => {
    const c = H.at(-1), flips = [];
    for (const z of zones) { if (z.dead) continue;
      if (z.s > 0 ? c.close < z.bottom : c.close > z.top) { z.dead = true; if (z.kind === 'eg') flips.push(z); }
      else if (H.length - z.born >= ZONE_AGE) z.dead = true; }
    zones = zones.filter((z) => !z.dead);
    for (const z of flips) addZone(-z.s, 'ef', z.bottom, z.top);
    const m = H.length - 1 - K;
    if (m >= K) { const x = H[m]; let lo = true, hi = true;
      for (let j = 1; j <= K; j++) { if (!(x.low <= H[m - j].low) || !(x.low < H[m + j].low)) lo = false; if (!(x.high >= H[m - j].high) || !(x.high > H[m + j].high)) hi = false; }
      if (lo) addZone(1, 'swing', x.low, Math.min(x.open, x.close));
      if (hi) addZone(-1, 'swing', Math.max(x.open, x.close), x.high); }
    if (H.length >= 2) { const p = H.at(-2), up = (b) => b.close > b.open, dn = (b) => b.close < b.open;
      if (up(c) && dn(p) && c.close > p.high) addZone(1, 'eg', Math.min(c.low, p.low), p.high);
      if (dn(c) && up(p) && c.close < p.low) addZone(-1, 'eg', p.low, Math.max(c.high, p.high));
      if (up(c) && up(p) && c.high > p.high && c.close > p.high) addZone(1, 'dom', p.open, p.close);
      if (dn(c) && dn(p) && c.low < p.low && c.close < p.low) addZone(-1, 'dom', p.close, p.open); }
  };
  for (let i = 0; i < n; i++) {
    const b = work[i], k = keyOf(b.time);
    if (!cur || cur.time !== k) { if (cur) { H.push(cur); onHtfClose(); } cur = { time: k, open: b.open, high: b.high, low: b.low, close: b.close }; }
    else { if (b.high > cur.high) cur.high = b.high; if (b.low < cur.low) cur.low = b.low; cur.close = b.close; }
    if (pend.length) { const keep = [];
      for (const q of pend) {
        if (q.zone.dead || H.length - q.tapH > WAIT) continue;
        if (q.s > 0 ? b.close > q.level : b.close < q.level) { if (dir !== q.s) events.push({ i, t: b.time, type: 'switch', s: q.s, kind: q.zone.kind, level: q.level }); dir = q.s; }
        else keep.push(q); }
      pend = keep; }
    for (const z of zones) { if (z.tapped || b.low > z.top || b.high < z.bottom) continue;
      z.tapped = true; const L = z.s > 0 ? lastA : lastV;
      if (st === -z.s && L && !L.broken) pend.push({ s: z.s, zone: z, level: L.p, tapI: i, tapH: H.length }); }
    if (lastA && !lastA.broken && b.close > lastA.p) { lastA.broken = true; st = 1; }
    if (lastV && !lastV.broken && b.close < lastV.p) { lastV.broken = true; st = -1; }
    const m = i - K;
    if (m >= K) { const x = work[m]; let lo = true, hi = true;
      for (let j = 1; j <= K; j++) { if (!(x.low <= work[m - j].low) || !(x.low < work[m + j].low)) lo = false; if (!(x.high >= work[m - j].high) || !(x.high > work[m + j].high)) hi = false; }
      if (hi) lastA = { p: x.high, at: m, broken: false };
      if (lo) lastV = { p: x.low, at: m, broken: false }; }
    call[i] = dir; structure[i] = st;
  }
  return { call, structure, events };
}

// the research pipeline's own direction filter (reported, not tested): closing-price pivots, N candles a side; +1 when the last
// two pivot highs and the last two pivot lows both rise, -1 when both fall, else 0. ms[i] is known at the close of work[i].
export function closeStructure(work, N = P.MS_N) {
  const n = work.length, ms = new Int8Array(n), hi = [], lo = []; let s = 0;
  for (let i = 0; i < n; i++) { const m = i - N;
    if (m >= N) { const x = work[m].close; let H = true, L = true;
      for (let j = 1; j <= N; j++) { if (!(x >= work[m - j].close) || !(x > work[m + j].close)) H = false; if (!(x <= work[m - j].close) || !(x < work[m + j].close)) L = false; }
      if (H) hi.push(x); if (L) lo.push(x);
      if (hi.length >= 2 && lo.length >= 2) { const u = hi.at(-1) > hi.at(-2), v = lo.at(-1) > lo.at(-2), d = hi.at(-1) < hi.at(-2), e = lo.at(-1) < lo.at(-2); s = u && v ? 1 : d && e ? -1 : 0; } }
    ms[i] = s; }
  return ms;
}

// ─── the entry ───
// body engulf of candle c over the candle p just before it: +1 up, -1 down, 0 none
export function engulf(p, c, step) {
  if (!p || !c || c.time - p.time !== step) return 0;
  const bp = Math.abs(p.close - p.open), bc = Math.abs(c.close - c.open);
  if (!(bc > P.BODY * bp)) return 0;
  if (p.open > p.close && c.close > c.open && c.open <= p.close && c.close >= p.open) return 1;
  if (p.open < p.close && c.close < c.open && c.open >= p.close && c.close <= p.open) return -1;
  return 0;
}
// every candidate (before the session rule, the gate and the one-at-a-time rule), in time order.
// Nothing about a candidate reads a candle after its entry candle's OPEN.
export function candidates(M5) {
  const n = M5.length, M15 = group(M5, bucket(P.M15)), H4 = group(M5, bucket(P.H4));
  const dir = calls(H4, dayKey).call, ms = closeStructure(H4);
  const setupT = { '1': [], '-1': [] };     // the times T at which an M15 engulf of each side became known
  for (let j = 1; j < M15.length; j++) { const s = engulf(M15[j - 1], M15[j], P.M15); if (s) setupT[s].push(M15[j].time + P.M15); }
  const out = [], funnel = { setups: setupT[1].length + setupT[-1].length, triggers: 0, armed: 0, gap: 0, small: 0, candidates: 0 };
  const ptr = { '1': -1, '-1': -1 }; let h = -1;
  for (let i = 1; i + 1 < n; i++) {
    const c = M5[i], s = engulf(M5[i - 1], c, P.M5); if (!s) continue; funnel.triggers++;
    const S = setupT[s]; while (ptr[s] + 1 < S.length && S[ptr[s] + 1] <= c.time) ptr[s]++;
    if (ptr[s] < 0 || c.time - S[ptr[s]] >= P.ARM) continue; funnel.armed++;
    const e = M5[i + 1]; if (e.time - c.time !== P.M5) { funnel.gap++; continue; }
    const entry = e.open, stop = s > 0 ? Math.min(c.low, M5[i - 1].low) - P.PAD : Math.max(c.high, M5[i - 1].high) + P.PAD, r0 = s * (entry - stop);
    if (!(r0 >= P.MIN_R0)) { funnel.small++; continue; }
    while (h + 1 < H4.length && H4[h + 1].time + P.H4 <= c.time + P.M5) h++;      // the last H4 candle fully closed at the trigger's close
    funnel.candidates++;
    out.push({ i: i + 1, t: e.time, trig: c.time, hour: new Date(c.time * 1000).getUTCHours(), side: s, entry, stop: +stop.toFixed(3), r0: +r0.toFixed(3), call: h >= 0 ? dir[h] : 0, ms: h >= 0 ? ms[h] : 0, setup: S[ptr[s]] });
  }
  return { cand: out, funnel };
}
// one trade from its entry candle on: a gap through the stop exits at the open, the stop comes before the target in one candle,
// the first candle opening HOLD or more after the entry exits at its open. null = still open at the end of the file.
export function simulate(M5, c, rr) {
  const s = c.side, target = c.entry + s * rr * c.r0;
  const done = (k, px, exit) => { const R = (s * (px - c.entry)) / c.r0, cost = P.COST / c.r0; return { ...c, rr, target: +target.toFixed(3), closed: M5[k].time, exitPx: +px.toFixed(3), exit, R: +R.toFixed(4), net: +(R - cost).toFixed(4), net2: +(R - 2 * cost).toFixed(4) }; };
  for (let k = c.i; k < M5.length; k++) { const b = M5[k];
    if (k > c.i && b.time >= c.t + P.HOLD) return done(k, b.open, 'time');
    if (k > c.i && (s > 0 ? b.open <= c.stop : b.open >= c.stop)) return done(k, b.open, 'stop (gap)');
    if (s > 0 ? b.low <= c.stop : b.high >= c.stop) return done(k, c.stop, 'stop');
    if (s > 0 ? b.high >= target : b.low <= target) return done(k, target, 'target'); }
  return null;
}
// one at a time: a candidate entering at or before the close time of the stream's previous trade is skipped
export function book(M5, cand, rr) {
  const trades = []; let busyUntil = -Infinity, busy = 0, open = 0;
  for (const c of cand) { if (c.t <= busyUntil) { busy++; continue; } const o = simulate(M5, c, rr); if (!o) { open++; break; } trades.push(o); busyUntil = o.closed; }
  return { trades, busy, open };
}
export const inSession = (c, session) => !session || (c.hour >= session[0] && c.hour < session[1]);
export const STREAM_OF = { ALL: () => true, WITH: (c) => c.call !== 0 && c.side === c.call, AGAINST: (c) => c.call !== 0 && c.side === -c.call };

// ─── statistics ───
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const variance = (a) => { const m = mean(a); return a.length > 1 ? a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1) : 0; };
const r3 = (v) => (v == null || !isFinite(v) ? null : +v.toFixed(3));
export function stat(rs) {
  const n = rs.length; if (!n) return { n: 0 };
  const m = mean(rs), v = variance(rs), t = v > 0 ? m / Math.sqrt(v / n) : 0;
  const w = rs.filter((r) => r > 0), gw = w.reduce((a, r) => a + r, 0), gl = -rs.filter((r) => r <= 0).reduce((a, r) => a + r, 0);
  let cum = 0, peak = 0, dd = 0; for (const r of rs) { cum += r; if (cum > peak) peak = cum; if (peak - cum > dd) dd = peak - cum; }
  return { n, exp: r3(m), wr: r3(w.length / n), t: +t.toFixed(2), pf: gl > 0 ? +(gw / gl).toFixed(2) : null, R: +cum.toFixed(2), maxDD: +dd.toFixed(2) };
}
export function welch(a, b) { if (a.length < 2 || b.length < 2) return null; const se = Math.sqrt(variance(a) / a.length + variance(b) / b.length); return se > 0 ? +((mean(a) - mean(b)) / se).toFixed(2) : null; }
export function normP(t) {   // one-sided p of a normal t (mean > 0)
  if (t == null) return 1; const x = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  const up = 0.5 * (1 - erf); return +(t >= 0 ? up : 1 - up).toFixed(4);
}
export function holm(ps) { const s = [...ps].sort((x, y) => x[1] - y[1]), out = {}; let top = 0; s.forEach(([k, p], i) => { top = Math.max(top, Math.min(1, p * (s.length - i))); out[k] = +top.toFixed(4); }); return out; }
const key = (d) => Date.parse(d + 'T00:00:00Z') / 1000;
export const WIN = { a: [key(P.A[0]), key(P.A[1]) + 86400], b: [key(P.B[0]), key(P.B[1]) + 86400] };
export const windowOf = (t) => (t >= WIN.a[0] && t < WIN.a[1] ? 'a' : t >= WIN.b[0] && t < WIN.b[1] ? 'b' : null);
export function summarize(trades) {
  const by = { a: [], b: [] }, years = {}; for (const o of trades) { const w = windowOf(o.t); if (!w) continue; by[w].push(o); (years[new Date(o.t * 1000).getUTCFullYear()] ||= []).push(o.net); }
  const med = (a) => (a.length ? +[...a].sort((x, y) => x - y)[a.length >> 1].toFixed(2) : null), one = (l) => {
    const exits = {}; for (const o of l) { const k = o.exit.replace(' (gap)', ''); exits[k] = (exits[k] || 0) + 1; }
    return { ...stat(l.map((o) => o.net)), gross: stat(l.map((o) => o.R)).exp, x2: stat(l.map((o) => o.net2)).exp, buys: stat(l.filter((o) => o.side > 0).map((o) => o.net)), sells: stat(l.filter((o) => o.side < 0).map((o) => o.net)), exits, medianR0: med(l.map((o) => o.r0)) }; };
  return { a: one(by.a), b: one(by.b), years: Object.fromEntries(Object.entries(years).map(([y, l]) => [y, stat(l)])), nets: { a: by.a.map((o) => o.net), b: by.b.map((o) => o.net) } };
}
// the pre-registered conditions of one test, from its three summarised streams and its Holm p
export function conditions(S, pHolm) {
  const W = S.WITH, A = S.ALL, G = S.AGAINST, pos = (x) => x != null && x > 0;
  return { '1 WITH has 100+ trades in each window': W.a.n >= 100 && W.b.n >= 100, '2 WITH net > 0 with t >= 2 in 2020-26': pos(W.b.exp) && W.b.t >= 2, '3 WITH net > 0 in 2007-19': pos(W.a.exp),
    '4 the gate adds (WITH above ALL in both windows, above AGAINST in 2020-26)': W.a.n > 0 && W.b.n > 0 && W.a.exp > A.a.exp && W.b.exp > A.b.exp && G.b.n > 0 && W.b.exp > G.b.exp,
    '5 WITH net > 0 in 2020-26 at twice the cost': pos(W.b.x2), '6 Holm-adjusted p < 0.05': pHolm != null && pHolm < 0.05 };
}
export function verdictOf(tests) {
  const ks = Object.keys(tests), c = (k) => Object.values(tests[k].conditions), core = (k) => c(k)[1] && c(k)[2];
  for (const k of ks) tests[k].pass = c(k).every(Boolean);
  return tests.T1.pass ? 'PASS' : ks.some(core) ? 'INCONCLUSIVE' : 'FAIL';
}
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function bootstrap(rs, n = P.BOOT, seed = P.SEED) {
  if (rs.length < 10) return null; const R = rng(seed), dds = []; let posN = 0;
  for (let k = 0; k < n; k++) { let cum = 0, peak = 0, dd = 0; for (let i = 0; i < rs.length; i++) { cum += rs[(R() * rs.length) | 0]; if (cum > peak) peak = cum; if (peak - cum > dd) dd = peak - cum; } if (cum > 0) posN++; dds.push(dd); }
  dds.sort((x, y) => x - y); return { resamples: n, n: rs.length, positiveShare: +(posN / n).toFixed(3), dd50: +dds[n >> 1].toFixed(1), dd95: +dds[Math.floor(n * 0.95)].toFixed(1) };
}
export function study(M5) {
  const { cand, funnel } = candidates(M5), tests = {}, books = {};
  for (const [k, T] of Object.entries(TESTS)) { const C = cand.filter((c) => inSession(c, T.session)), streams = {}; books[k] = {};
    for (const s of Object.keys(STREAMS)) { const bk = book(M5, C.filter(STREAM_OF[s]), T.rr); books[k][s] = bk; streams[s] = { candidates: C.filter(STREAM_OF[s]).length, busy: bk.busy, ...summarize(bk.trades) }; }
    const gate = {}; for (const w of ['a', 'b']) gate[w] = { withMinusAll: r3(streams.WITH[w].exp - streams.ALL[w].exp), withMinusAgainst: r3(streams.WITH[w].exp - streams.AGAINST[w].exp), welchWithVsAgainst: welch(streams.WITH.nets[w], streams.AGAINST.nets[w]) };
    tests[k] = { ...T, candidates: C.length, streams, gate, p: normP(streams.WITH.b.t ?? null) }; }
  const adj = holm(Object.keys(tests).map((k) => [k, tests[k].p]));
  for (const k of Object.keys(tests)) { tests[k].pHolm = adj[k]; tests[k].conditions = conditions(tests[k].streams, adj[k]); }
  const verdict = verdictOf(tests);
  // reported, not tested
  const hours = {}; for (const o of books.T3.ALL.trades) { const w = windowOf(o.t); if (w) ((hours[o.hour] ||= { a: [], b: [] })[w]).push(o.net); }
  const hourly = Object.fromEntries(Object.entries(hours).map(([h, v]) => [h, { a: stat(v.a), b: stat(v.b) }]));
  const C1 = cand.filter((c) => inSession(c, TESTS.T1.session)), msGate = {};
  for (const [name, f] of [['WITH', (c) => c.ms !== 0 && c.side === c.ms], ['AGAINST', (c) => c.ms !== 0 && c.side === -c.ms]]) { const S = summarize(book(M5, C1.filter(f), TESTS.T1.rr).trades); msGate[name] = { a: S.a, b: S.b }; }
  const boot = { a: bootstrap(tests.T1.streams.WITH.nets.a), b: bootstrap(tests.T1.streams.WITH.nets.b) };
  const callShare = {}; for (const w of ['a', 'b']) { const l = cand.filter((c) => windowOf(c.t) === w), n = l.length || 1; callShare[w] = { candidates: l.length, buyCall: r3(l.filter((c) => c.call > 0).length / n), sellCall: r3(l.filter((c) => c.call < 0).length / n), none: r3(l.filter((c) => !c.call).length / n) }; }
  for (const k of Object.keys(tests)) for (const s of Object.keys(STREAMS)) delete tests[k].streams[s].nets;
  return { funnel, tests, verdict, hourly, msGate, boot, callShare, books };
}

// ─── modes ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const BASE = process.env.MD_BASE || 'https://macro-dashboard-xau.vercel.app/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (MODE === 'fetch') {
  const OUT = process.argv[3], m = new Map(), end = Math.floor(Date.now() / 1000 / 86400) * 86400; fs.mkdirSync(OUT, { recursive: true });
  for (let a = P.DATA_FROM; a < end;) { const b = Math.min(end, a + 4999 * P.M5); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) { try { const r = await fetch(`${BASE}bars?sym=xau&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null; if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); } if (!j) await sleep(2500 * (k + 1)); }
    if (!j) throw new Error(`xau 5m ${iso(a)}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(250); }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(path.join(OUT, 'xau-5m.json.gz'), zlib.gzipSync(JSON.stringify(rows))); console.log(`5m: ${rows.length} candles ${iso(rows[0][0])} → ${iso(rows.at(-1)[0])}`);
}
if (MODE === 'run') {
  const M5 = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.env.CANDLES, 'xau-5m.json.gz')))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  const S = study(M5), sg = (x) => (x == null ? 'n/a' : `${x >= 0 ? '+' : ''}${x}`), books = S.books; delete S.books;
  const line = (k) => { const W = S.tests[k].streams.WITH, A = S.tests[k].streams.ALL; return `${k} with the call ${sg(W.b.exp)}R a trade net in 2020-26 (n ${W.b.n}, t ${W.b.t}; without the gate ${sg(A.b.exp)}R, n ${A.b.n}); 2007-19 ${sg(W.a.exp)}R (n ${W.a.n}, t ${W.a.t}; without ${sg(A.a.exp)}R)`; };
  const lab = (s) => ({ exp: s.exp, R: s.R, n: s.n, wr: s.wr, maxDD: s.maxDD, t: s.t, pf: s.pf });
  const out = { topic: 'msnr-entry', built: '2026-11-11', at: new Date().toISOString(),
    system: 'MSNR direction call (H4 working, Daily key levels) as a gate in front of the engulfing entry (M15 body engulf, then M5 body engulf, entry at the next M5 open, stop past the trigger pair, fixed reward-to-risk), spot gold OANDA M5, net of $0.30 a round trip',
    window: { a: `${P.A[0]} to ${P.A[1]} (replication)`, b: `${P.B[0]} to ${P.B[1]} (confirmation)` }, params: P, streamsMeaning: STREAMS,
    candles: { m5: M5.length, from: iso(M5[0].time), to: iso(M5.at(-1).time) }, unit: 'exp = mean net R a trade after $0.30 a round trip; wr = share of trades with net R > 0; t = plain t of the per-trade net R',
    funnel: S.funnel, callShare: S.callShare, tests: S.tests, hourly: S.hourly, closeStructureGate: S.msGate, bootstrap: S.boot, variantsTried: 3,
    verdict: `${S.verdict}: ${S.verdict === 'FAIL' ? 'no test has the gated stream positive with t >= 2 in 2020-26 and positive in 2007-19' : S.verdict === 'PASS' ? 'the main test passes every condition' : 'a test is positive in both windows with t >= 2 in 2020-26 but the main test does not pass every condition'}; ${line('T1')}`,
    baseline: { is: lab(S.tests.T1.streams.ALL.a), oos: lab(S.tests.T1.streams.ALL.b) },
    candidates: Object.keys(S.tests).map((k) => ({ rule: `${k} with the call (${TESTS[k].name})`, verdict: S.tests[k].pass ? 'PASS' : 'FAIL', is: lab(S.tests[k].streams.WITH.a), oos: lab(S.tests[k].streams.WITH.b), years: S.tests[k].streams.WITH.years })) };
  out.trades = books.T1.WITH.trades.filter((o) => windowOf(o.t)).map((o) => ({ d: new Date(o.closed * 1000).toISOString().slice(0, 10), side: o.side < 0 ? 'sell' : 'buy', R: o.net })); out.tradesOf = 'T1, with the call';
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  if (process.env.OUT_DIR) { fs.mkdirSync(process.env.OUT_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.OUT_DIR, 'trades.json'), JSON.stringify(Object.fromEntries(Object.keys(books).map((k) => [k, Object.fromEntries(Object.keys(books[k]).map((s) => [s, books[k][s].trades]))])))); }
  console.error(JSON.stringify(S.funnel), JSON.stringify(S.callShare));
  for (const k of Object.keys(S.tests)) { for (const s of Object.keys(STREAMS)) { const X = S.tests[k].streams[s]; console.error(k, s, 'A', JSON.stringify(X.a), '\n      B', JSON.stringify(X.b)); } console.error(k, 'gate', JSON.stringify(S.tests[k].gate), 'p', S.tests[k].p, 'holm', S.tests[k].pHolm, JSON.stringify(S.tests[k].conditions)); }
  console.error('hourly', JSON.stringify(S.hourly)); console.error('ms', JSON.stringify(S.msGate)); console.error('boot', JSON.stringify(S.boot)); console.error(out.verdict);
}
