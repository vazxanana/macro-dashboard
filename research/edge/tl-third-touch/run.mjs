// Edge research · tl-third-touch (13 Nov 2026): a trendline through the pullback back into an H4 engulf zone, entered on its
// THIRD touch while price is inside the zone, against a control that takes the same zones on their first touch with no line.
// Spot gold, OANDA H1 (H4 built from it), 2020 to Oct 2026, net of $0.30 a round trip and of overnight financing on buys.
// Every rule and number is fixed in PREREGISTRATION.md (committed before this file simulated a trade). Paper research only:
// nothing here trades or changes a live rule.
//   node --use-env-proxy run.mjs fetch <dir>     -> <dir>/xau-1h.json.gz (kept out of git)
//   CANDLES=<dir> node run.mjs run               -> result.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { FIN, nights } from '../../../council/fills.mjs';
import { stat, welch, normP, holm } from '../msnr-entry/run.mjs';

export const P = { H1: 3600, H4: 14400, K4: 2, K1: 3, N: 6, BREAK2_WITHIN: 30, LIFE: 120, PAD: 0.30, MIN_R0: 1.00, RR: 2, HOLD: 72 * 3600,
  COST: 0.30, FIN_LONG: FIN.xau.long, PLACEBO: 40, SEED: 20261113, NEED_PLACEBO: 38, T_MIN: 2,
  DATA_FROM: Date.UTC(2019, 9, 1) / 1000, A: ['2020-01-01', '2023-12-31'], B: ['2024-01-01', '2026-10-31'] };

const key = (d) => Date.parse(d + 'T00:00:00Z') / 1000;
export const WIN = { a: [key(P.A[0]), key(P.A[1]) + 86400], b: [key(P.B[0]), key(P.B[1]) + 86400] };
export const halfOf = (t) => (t >= WIN.a[0] && t < WIN.a[1] ? 'a' : t >= WIN.b[0] && t < WIN.b[1] ? 'b' : null);

// ─── candles ───
export function h4From(H1) {
  const out = [];
  for (const b of H1) { const k = Math.floor(b.time / P.H4) * P.H4, g = out.at(-1);
    if (g && g.time === k) { if (b.high > g.high) g.high = b.high; if (b.low < g.low) g.low = b.low; g.close = b.close; }
    else out.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close }); }
  return out;
}
// pivot of K a side at index m, side +1 = high, -1 = low; at or beyond the K before, strictly beyond the K after
export function pivot(B, m, K, s) {
  if (m < K || m + K >= B.length) return false;
  const x = s > 0 ? B[m].high : B[m].low;
  for (let j = 1; j <= K; j++) {
    const l = s > 0 ? B[m - j].high : B[m - j].low, r = s > 0 ? B[m + j].high : B[m + j].low;
    if (s > 0 ? !(x >= l && x > r) : !(x <= l && x < r)) return false; }
  return true;
}

// ISL: some H4 close after the zone candle z, up to and including the second break b2, beyond the extreme of the candle before z
export function islBroken(H4, z, b2, s) { const isl = s > 0 ? H4[z - 1].high : H4[z - 1].low; for (let k = z + 1; k <= b2; k++) if (s > 0 ? H4[k].close > isl : H4[k].close < isl) return true; return false; }

// ─── the zones (H4). Side s = +1 demand (buys), -1 supply (sells). Nothing about a zone reads a candle after its Tc. ───
export function zones(H4, s) {
  const n = H4.length, ext = (b) => (s > 0 ? b.high : b.low), opp = (b) => (s > 0 ? b.low : b.high);
  const beyond = (c, lvl) => (s > 0 ? c > lvl : c < lvl), against = (b) => (s > 0 ? b.close < b.open : b.close > b.open);
  const out = [], seen = new Set(), sw = []; const funnel = { firstBreaks: 0, noZoneCandle: 0, dup: 0, noSecond: 0, killed: 0, noIsl: 0, zones: 0 };
  for (let j = 0; j < n; j++) {
    const m = j - P.K4; if (m >= 0 && pivot(H4, m, P.K4, s)) sw.push({ m, lvl: ext(H4[m]), broken: false });   // known at the close of j
    // the most recent known swing that no close has gone beyond yet
    let cur = null; for (let q = sw.length - 1; q >= 0; q--) { if (!sw[q].broken) { cur = sw[q]; break; } }
    for (const w of sw) if (!w.broken && beyond(H4[j].close, w.lvl)) w.broken = true;
    if (!cur || !beyond(H4[j].close, cur.lvl)) continue;
    funnel.firstBreaks++;
    const b1 = j, S = cur;
    let o = S.m; for (let i = S.m; i <= b1; i++) if (s > 0 ? H4[i].low < H4[o].low : H4[i].high > H4[o].high) o = i;
    let z = -1; for (let i = o; i >= S.m; i--) if (against(H4[i])) { z = i; break; }
    if (z < 1) { funnel.noZoneCandle++; continue; }
    if (seen.has(z)) { funnel.dup++; continue; } seen.add(z);
    const top = H4[z].high, bottom = H4[z].low, isl = ext(H4[z - 1]), far = s > 0 ? bottom : top;
    const sw2 = []; let b2 = -1, dead = false;
    for (let k = b1 + 1; k < n && k <= b1 + P.BREAK2_WITHIN; k++) {
      const mm = k - P.K4; if (mm >= b1 && pivot(H4, mm, P.K4, s) && beyond(ext(H4[mm]), S.lvl)) sw2.push(ext(H4[mm]));
      if (s > 0 ? H4[k].close < far : H4[k].close > far) { dead = true; break; }
      if (sw2.length && beyond(H4[k].close, sw2.at(-1))) { b2 = k; break; } }
    if (dead) { funnel.killed++; continue; }
    if (b2 < 0) { funnel.noSecond++; continue; }
    if (!islBroken(H4, z, b2, s) || !beyond(H4[b2].close, s > 0 ? top : bottom)) { funnel.noIsl++; continue; }
    const Tc = H4[b2].time + P.H4; let end = Tc + P.LIFE * P.H4;
    for (let k = b2 + 1; k < n && H4[k].time < end; k++) if (s > 0 ? H4[k].close < far : H4[k].close > far) { end = Math.min(end, H4[k].time + P.H4); break; }
    funnel.zones++;
    out.push({ s, z, zt: H4[z].time, top, bottom, isl, S: S.lvl, b1, b2, b2t: H4[b2].time, Tc, end, stop: +(s > 0 ? bottom - P.PAD : top + P.PAD).toFixed(3) });
  }
  return { zones: out, funnel };
}

// index of the first H1 candle opening at or after t
export function firstAt(H1, t) { let lo = 0, hi = H1.length; while (lo < hi) { const m = (lo + hi) >> 1; if (H1[m].time < t) lo = m + 1; else hi = m; } return lo; }
const inZone = (Z, px) => px >= Z.bottom && px <= Z.top;
const mk = (Z, H1, k, fill, kind) => { const r0 = Z.s * (fill - Z.stop); return r0 >= P.MIN_R0 ? { kind, s: Z.s, i: k, t: H1[k].time, entry: +fill.toFixed(3), stop: Z.stop, r0: +r0.toFixed(3), zt: Z.zt, Tc: Z.Tc } : null; };

// line through (i1, v1) and (i2, v2) by candle index
export const lineAt = (L, k) => L.v1 + ((L.v2 - L.v1) * (k - L.i1)) / (L.i2 - L.i1);

// ─── the trendline entry on one zone: the first third touch whose line value is inside the live zone ───
// Returns { cand, note } with note one of 'trade' | 'no-line' | 'outside' | 'small' | 'through-stop' | 'above-zone'
export function tlEntry(H1, Z) {
  const s = Z.s, ext = (b) => (s > 0 ? b.high : b.low), reach = (b, v) => (s > 0 ? b.high >= v : b.low <= v);
  const k0 = firstAt(H1, Z.b2t); let pv = null, line = null, touches = 0, note = 'no-line';
  for (let k = k0; k < H1.length && H1[k].time < Z.end; k++) {
    const b = H1[k];
    if (line && k > line.known && reach(b, lineAt(line, k))) {        // the third touch (the line was known before this candle)
      touches++; const L = line, v = lineAt(L, k); line = null;
      if (b.time < Z.Tc) note = 'before-live';
      else if (!inZone(Z, v)) note = 'outside';
      else { const fill = s > 0 ? Math.max(b.open, v) : Math.min(b.open, v);
        if (s > 0 ? fill > Z.top : fill < Z.bottom) note = 'beyond-zone';
        else if (s * (fill - Z.stop) <= 0) note = 'through-stop';
        else { const c = mk(Z, H1, k, fill, 'tl');
          if (c) return { cand: { ...c, line: { i1: L.i1, v1: L.v1, i2: L.i2, v2: L.v2, value: +v.toFixed(3) } }, note: 'trade', touches };
          note = 'small'; } }
    }
    // a pivot confirmed at the close of k (its candle m = k - K1), counted only from the second break's H4 candle on
    const m = k - P.K1;
    if (m >= k0 && pivot(H1, m, P.K1, s)) {
      const p = { m, v: ext(H1[m]) };
      if (pv && (s > 0 ? pv.v > p.v : pv.v < p.v) && p.m - pv.m >= P.N) {
        const L = { i1: pv.m, v1: pv.v, i2: p.m, v2: p.v, known: k };
        let early = false; for (let q = m + 1; q <= k; q++) if (reach(H1[q], lineAt(L, q))) early = true;
        line = early ? null : L;
      }
      pv = p;
    }
  }
  return { cand: null, note, touches };
}
// ─── the control: a limit at the zone's near edge, first touch from Tc ───
export function ctlEntry(H1, Z) {
  const edge = Z.s > 0 ? Z.top : Z.bottom;
  for (let k = firstAt(H1, Z.Tc); k < H1.length && H1[k].time < Z.end; k++) { const b = H1[k];
    if (Z.s > 0 ? b.low <= edge : b.high >= edge) { const fill = Z.s > 0 ? Math.min(b.open, edge) : Math.max(b.open, edge);
      if (Z.s * (fill - Z.stop) <= 0) return null; return mk(Z, H1, k, fill, 'control'); } }
  return null;
}
// ─── placebo: a random candle overlapping the live zone, a random fill inside the overlap ───
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placeboEntry(H1, Z, R) {
  const el = []; for (let k = firstAt(H1, Z.Tc); k < H1.length && H1[k].time < Z.end; k++) if (H1[k].low <= Z.top && H1[k].high >= Z.bottom) el.push(k);
  if (!el.length) return null; const k = el[Math.floor(R() * el.length)], lo = Math.max(H1[k].low, Z.bottom), hi = Math.min(H1[k].high, Z.top);
  return mk(Z, H1, k, lo + R() * (hi - lo), 'placebo');
}

// ─── one trade, H1 candle by candle ───
export function simulate(H1, c) {
  const s = c.s, target = c.entry + s * P.RR * c.r0;
  const done = (k, px, exit, tx) => {
    const R = (s * (px - c.entry)) / c.r0, cost = P.COST / c.r0, nn = s > 0 ? nights(c.t, tx) : 0, fin = (nn * P.FIN_LONG * c.entry) / c.r0;
    return { ...c, target: +target.toFixed(3), closed: tx, exitPx: +px.toFixed(3), exit, nights: nn, R: +R.toFixed(4), fin: +fin.toFixed(4), net: +(R - cost - fin).toFixed(4) }; };
  for (let k = c.i; k < H1.length; k++) { const b = H1[k];
    if (k > c.i) {
      if (b.time >= c.t + P.HOLD) return done(k, b.open, 'time', b.time);
      if (s > 0 ? b.open <= c.stop : b.open >= c.stop) return done(k, b.open, 'stop (gap)', b.time); }
    if (s > 0 ? b.low <= c.stop : b.high >= c.stop) return done(k, c.stop, 'stop', b.time + 1800);
    if (k > c.i && (s > 0 ? b.high >= target : b.low <= target)) return done(k, target, 'target', b.time + 1800); }
  return null;
}
export function book(H1, cand) {
  const trades = []; let busyUntil = -Infinity, busy = 0, open = 0;
  for (const c of [...cand].sort((x, y) => x.t - y.t || x.s - y.s)) { if (c.t <= busyUntil) { busy++; continue; } const o = simulate(H1, c); if (!o) { open++; continue; } trades.push(o); busyUntil = o.closed; }
  return { trades, busy, open };
}

// ─── statistics ───
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
export function monthT(trades) {
  const months = []; for (let y = 2020; y <= 2026; y++) for (let mo = 1; mo <= 12; mo++) if (y < 2026 || mo <= 10) months.push(`${y}-${String(mo).padStart(2, '0')}`);
  const sum = Object.fromEntries(months.map((m) => [m, 0])); for (const o of trades) { const m = new Date(o.t * 1000).toISOString().slice(0, 7); if (m in sum) sum[m] += o.net; }
  const v = Object.values(sum), mu = mean(v), sd = Math.sqrt(v.reduce((a, x) => a + (x - mu) ** 2, 0) / (v.length - 1));
  return { months: v.length, meanMonth: +mu.toFixed(3), t: sd > 0 ? +(mu / (sd / Math.sqrt(v.length))).toFixed(2) : 0 };
}
export function summarize(trades) {
  const by = { a: [], b: [] }, years = {}; for (const o of trades) { const h = halfOf(o.t); if (!h) continue; by[h].push(o); (years[new Date(o.t * 1000).getUTCFullYear()] ||= []).push(o.net); }
  const all = [...by.a, ...by.b], one = (l) => { const ex = {}; for (const o of l) { const e = o.exit.replace(' (gap)', ''); ex[e] = (ex[e] || 0) + 1; }
    return { ...stat(l.map((o) => o.net)), gross: stat(l.map((o) => o.R)).exp ?? null, buys: stat(l.filter((o) => o.s > 0).map((o) => o.net)).n, sells: stat(l.filter((o) => o.s < 0).map((o) => o.net)).n, exits: ex }; };
  return { a: one(by.a), b: one(by.b), all: one(all), month: monthT(all), years: Object.fromEntries(Object.entries(years).map(([y, l]) => [y, stat(l)])), nets: all.map((o) => o.net) };
}

export function study(H1) {
  const H4 = h4From(H1), zb = zones(H4, 1), zs = zones(H4, -1), Z = [...zb.zones, ...zs.zones].sort((x, y) => x.Tc - y.Tc);
  const notes = {}, tlC = [], ctlC = []; let touches = 0;
  for (const z of Z) { const r = tlEntry(H1, z); notes[r.note] = (notes[r.note] || 0) + 1; touches += r.touches; if (r.cand) tlC.push(r.cand); const c = ctlEntry(H1, z); if (c) ctlC.push(c); }
  const tl = book(H1, tlC), ctl = book(H1, ctlC), TL = summarize(tl.trades), CT = summarize(ctl.trades);
  const t1 = TL.month.t, t2 = welch(TL.nets, CT.nets), p = { T1: normP(t1), T2: normP(t2) }, ph = holm(Object.entries(p));
  const placebo = []; for (let k = 0; k < P.PLACEBO; k++) { const R = rng(P.SEED + k), C = []; for (const z of Z) { const c = placeboEntry(H1, z, R); if (c) C.push(c); } const S = summarize(book(H1, C).trades); placebo.push({ seed: P.SEED + k, n: S.all.n, exp: S.all.exp }); }
  const beat = placebo.filter((x) => TL.all.exp != null && TL.all.exp > (x.exp ?? -Infinity)).length;
  const cond = {
    'T1a TL net R a trade > 0 in 2020-23': TL.a.exp != null && TL.a.exp > 0, 'T1b TL net R a trade > 0 in 2024-26': TL.b.exp != null && TL.b.exp > 0,
    'T1c TL month-sum t >= 2': t1 >= P.T_MIN, 'T2 TL beats the control, Welch t >= 2': t2 != null && t2 >= P.T_MIN,
    'Holm p < 0.05 for T1 and T2': ph.T1 < 0.05 && ph.T2 < 0.05, [`placebo: TL above the placebo in >= ${P.NEED_PLACEBO} of ${P.PLACEBO} seeds`]: beat >= P.NEED_PLACEBO };
  const verdict = Object.values(cond).every(Boolean) ? 'PASS' : 'FAIL';
  delete TL.nets; delete CT.nets;
  const pm = placebo.map((x) => x.exp).filter((x) => x != null).sort((a, b) => a - b);
  return { H4n: H4.length, funnel: { buy: zb.funnel, sell: zs.funnel, zones: Z.length, tlNotes: notes, thirdTouches: touches, tlCandidates: tlC.length, controlCandidates: ctlC.length, tlBusy: tl.busy, controlBusy: ctl.busy },
    TL, CT, tests: { T1: { t: t1, p: p.T1, pHolm: ph.T1 }, T2: { welch: t2, p: p.T2, pHolm: ph.T2 } }, placebo: { seeds: P.PLACEBO, beat, median: pm.length ? +pm[pm.length >> 1].toFixed(3) : null, p5: pm.length ? +pm[Math.floor(pm.length * 0.05)].toFixed(3) : null, p95: pm.length ? +pm[Math.floor(pm.length * 0.95)].toFixed(3) : null, runs: placebo },
    conditions: cond, verdict, trades: { tl: tl.trades, control: ctl.trades } };
}

// ─── modes ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (MODE === 'fetch') {
  const OUT = process.argv[3], m = new Map(), end = Math.floor(Date.now() / 1000 / 3600) * 3600; fs.mkdirSync(OUT, { recursive: true });
  for (let a = P.DATA_FROM; a < end;) { const b = Math.min(end, a + 4999 * P.H1); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) { try { const r = await fetch(`${BASE}bars?sym=xau&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null; if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); } if (!j) await sleep(2500 * (k + 1)); }
    if (!j) throw new Error(`xau 1h ${iso(a)}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(400); }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(path.join(OUT, 'xau-1h.json.gz'), zlib.gzipSync(JSON.stringify(rows))); console.log(`1h: ${rows.length} candles ${iso(rows[0][0])} → ${iso(rows.at(-1)[0])}`);
}
if (MODE === 'run') {
  const H1 = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.env.CANDLES, 'xau-1h.json.gz')))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  const S = study(H1), lab = (s) => ({ exp: s.exp, R: s.R, n: s.n, wr: s.wr, maxDD: s.maxDD, t: s.t, pf: s.pf }), sg = (x) => (x == null ? 'n/a' : `${x >= 0 ? '+' : ''}${x}`);
  const trades = S.trades; delete S.trades;
  const out = { topic: 'tl-third-touch', built: '2026-11-13', at: new Date().toISOString(),
    system: 'Trendline third touch inside an H4 engulf zone (zone = last opposite H4 candle before a two-break move that also broke the ISL; H1 line through two pullback pivots, 3 a side, 6+ candles apart; entry at the line on its third touch while the line is inside the zone; stop $0.30 past the zone, 2R, 72 h), spot gold OANDA H1, net of $0.30 a round trip and financing on buys',
    window: { a: `${P.A[0]} to ${P.A[1]}`, b: `${P.B[0]} to ${P.B[1]}` }, params: P,
    candles: { h1: H1.length, h4: S.H4n, from: iso(H1[0].time), to: iso(H1.at(-1).time) },
    unit: 'exp = mean net R a trade after $0.30 a round trip and financing on buys; t = plain t of per-trade net R; month t = t of calendar-month sums Jan 2020-Oct 2026',
    funnel: S.funnel, trendline: S.TL, control: S.CT, tests: S.tests, placebo: S.placebo, conditions: S.conditions,
    verdict: `${S.verdict}: trendline ${sg(S.TL.all.exp)}R a trade net 2020-26 (n ${S.TL.all.n}, month t ${S.TL.month.t}; 2020-23 ${sg(S.TL.a.exp)}R n ${S.TL.a.n}, 2024-26 ${sg(S.TL.b.exp)}R n ${S.TL.b.n}); control ${sg(S.CT.all.exp)}R (n ${S.CT.all.n}); Welch ${S.tests.T2.welch}; placebo beaten in ${S.placebo.beat} of ${P.PLACEBO} seeds`,
    baseline: { is: lab(S.CT.a), oos: lab(S.CT.b) },
    candidates: [{ rule: 'trendline third touch inside the zone', verdict: S.verdict, is: lab(S.TL.a), oos: lab(S.TL.b), years: S.TL.years }],
    trades: trades.tl.filter((o) => halfOf(o.t)).map((o) => ({ d: new Date(o.closed * 1000).toISOString().slice(0, 10), side: o.s < 0 ? 'sell' : 'buy', R: o.net })), tradesOf: 'trendline stream' };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  if (process.env.OUT_DIR) fs.writeFileSync(path.join(process.env.OUT_DIR, 'trades.json'), JSON.stringify(trades));
  console.error(JSON.stringify(S.funnel)); console.error('TL', JSON.stringify(S.TL)); console.error('CT', JSON.stringify(S.CT)); console.error(JSON.stringify(S.tests), JSON.stringify(S.conditions)); console.error(out.verdict);
}
