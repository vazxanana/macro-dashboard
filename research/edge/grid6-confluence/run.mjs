// research/edge/grid6-confluence/run.mjs - PREREGISTRATION.md (23 Nov 2026): at every H1 trigger (structure break or box
// close-out), count ten context signals that agree with its side; is mean R a rising function of the count?
//   node --max-old-space-size=6000 research/edge/grid6-confluence/run.mjs market <m> <dir>   one market -> <dir>/<m>.json
//   node research/edge/grid6-confluence/run.mjs cut <m> <dir>                                  cut test -> <dir>/<m>.cut.json
//   node research/edge/grid6-confluence/run.mjs report <dir>                                   pool, tests -> result.json
// Research only: reads the edgekit candle cache; imports edgekit, combo-grid-3 (frames, buildZones, exclusions), combo-grid-2
// (COSTS), grid5-msnr-box (h4Calls -> council/eg-methods direction()) and dom-trade-through (manage, atr14, startIdx), none edited.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, buildZones, exclusions } from '../combo-grid-3/run.mjs';
import { COSTS } from '../combo-grid-2/run.mjs';
import { h4Calls } from '../grid5-msnr-box/run.mjs';
import { manage, atr14, startIdx } from '../dom-trade-through/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2010), TO = y(2020), HALF = y(2015), NM = 120, HM = 60;
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const SIGNALS = ['eg', 'dom', 'sd', 'msnr', 'h4', 'd1', 'h4box', 'half', 'ef', 'ny'];
export const EXITS = ['1R', '2R', 'trail'];
const XSLOT = [0, 1, 6];                 // manage() R slots
export const KS = [3, 4, 5, 6, 7, 8];
export const LOOK = 24, CAP = 2 * 86400, ATRF = 0.1;
export const monthIdx = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2010) * 12 + d.getUTCMonth(); };

// ---- triggers and counts (closed candles only) ---------------------------------------------------------------------------
// zones of the side touched by an H1 candle among H1[j-LOOK+1 .. j] that starts after the zone is known and before it dies
function touched(Z, H1, j, d) {
  const a = Math.max(0, j - LOOK + 1), t0 = H1[a].t, t1 = H1[j].e;
  for (const z of Z) { if (z.d !== d || z.at > H1[j].t || z.end <= t0) continue;
    for (let q = a; q <= j; q++) { const b = H1[q]; if (b.t < z.at || b.t >= z.end) continue; if (b.l <= z.top && b.h >= z.bot) return 1; } }
  void t1; return 0;
}
function firstTouches(Z, H1) { // index of the first H1 candle (start >= at, before end) trading into each zone
  return Z.map((z) => { let k = K.closedCount(H1, z.at); while (k < H1.length && H1[k].t < z.at) k++;
    for (; k < H1.length && H1[k].t < z.end; k++) if (H1[k].l <= z.top && H1[k].h >= z.bot) return k; return -1; });
}
// the H4 external range of its last break, read at H4 index n-1 (phase.mjs readTf's definition)
function extRange(H4, ev, n) {
  if (!ev) return null; let hi = -Infinity, lo = Infinity;
  if (ev.dir > 0) { for (let i = ev.from; i <= ev.i; i++) lo = Math.min(lo, H4[i].l); for (let i = ev.from; i < n; i++) hi = Math.max(hi, H4[i].h); }
  else { for (let i = ev.from; i <= ev.i; i++) hi = Math.max(hi, H4[i].h); for (let i = ev.from; i < n; i++) lo = Math.min(lo, H4[i].l); }
  return hi > lo ? { hi, lo } : null;
}

// every trigger of the market: { j, ts, d, trig ('sb' | 'box' | 'both'), stopLvl, c0, sig [10 x 0/1], count }
export function triggers(F, { from = FROM - 3 * 86400, to = TO } = {}) {
  const H1 = F['1h'], H4 = F['4h'], D = F['1d'];
  const st = K.structure(H1, 3), sw = K.swings(H1, 3).sort((a, b) => a.ci - b.ci || a.i - b.i);
  const boxes = K.boxesHL(H1, 3).filter((b) => b.dir && b.bi >= 0);
  const byJ = new Map();
  const put = (j, d, kind, lvl) => { const k = j * 2 + (d > 0 ? 1 : 0); const o = byJ.get(k);
    if (!o) byJ.set(k, { j, d, trig: kind, stopLvl: lvl }); else { o.trig = 'both'; if (kind === 'box') o.stopLvl = lvl; } };
  // structure breaks: stop level = the last swing of the other type confirmed by the trigger candle
  let k = 0, lastH = null, lastL = null; const evs = st.events;
  for (let e = 0; e < evs.length; e++) { const ev = evs[e];
    while (k < sw.length && sw[k].ci <= ev.i) { const s = sw[k++]; if (s.type === 'H') lastH = s; else lastL = s; }
    const opp = ev.dir > 0 ? lastL : lastH; if (opp) put(ev.i, ev.dir, 'sb', opp.price); }
  for (const b of boxes) put(b.bi, b.dir, 'box', b.dir > 0 ? b.lo : b.hi);
  const Zeg = buildZones('eg', D), Zdom = buildZones('dom', D), Zsd = buildZones('bar', D), Zef = buildZones('ef', D);
  const sdFirst = firstTouches(Zsd, H1);
  const calls = h4Calls(F), s4 = K.structure(H4, 3), sD = K.structure(D, 3), b4 = K.boxesHL(H4, 3).filter((b) => b.dir && b.bi >= 0);
  const A1 = atr14(H1), out = [];
  for (const o of [...byJ.values()].sort((a, b) => a.j - b.j || a.d - b.d)) {
    const j = o.j, ts = H1[j].e, d = o.d; if (ts < from || ts >= to) continue;
    const n4 = K.closedCount(H4, ts), nD = K.closedCount(D, ts); if (n4 < 30 || nD < 30) continue;
    const sig = new Array(10).fill(0);
    sig[0] = touched(Zeg, H1, j, d); sig[1] = touched(Zdom, H1, j, d);
    for (let z = 0; z < Zsd.length; z++) if (Zsd[z].d === d && sdFirst[z] >= j - LOOK + 1 && sdFirst[z] <= j) { sig[2] = 1; break; }
    sig[3] = calls[n4 - 1] === d ? 1 : 0;
    sig[4] = s4.side[n4 - 1] === d ? 1 : 0;
    sig[5] = sD.side[nD - 1] === d ? 1 : 0;
    let lb = null; for (const b of b4) { if (b.bi >= n4) break; lb = b; } sig[6] = lb && lb.dir === d ? 1 : 0;
    let le = null; for (const e of s4.events) { if (e.i >= n4) break; le = e; }
    const R = extRange(H4, le, n4), c0 = H1[j].c;
    if (R) { const mid = (R.hi + R.lo) / 2; sig[7] = d > 0 ? (c0 < mid ? 1 : 0) : (c0 > mid ? 1 : 0); }
    sig[8] = touched(Zef, H1, j, d);
    const h = new Date(ts * 1000).getUTCHours(); sig[9] = h >= 12 && h < 17 ? 1 : 0;
    const atr = A1[j]; if (!(atr > 0)) continue;
    out.push({ j, ts, d, trig: o.trig, stopLvl: o.stopLvl, c0, atr, sig, count: sig.reduce((a, b) => a + b, 0) });
  }
  return out;
}

// ---- trades -------------------------------------------------------------------------------------------------------------
export function tradeOf(M5, s, stop, ts, cost) {
  const fi = startIdx(M5, ts); if (fi >= M5.length) return null; const fill = M5[fi].o;
  if (!(s * (fill - stop) > 0)) return null;
  const r = manage(M5, s, fi, fill, stop, CAP, true); if (!r || !(r.risk >= cost)) return null;
  return { t: r.t, risk: r.risk, R: XSLOT.map((x) => r.R[x]) };
}
export function runMarket(market, { dir } = {}) {
  const M5 = K.load(market, '5m', { from: y(2009), to: TO }); const F = frames(M5);
  const cost = COSTS[market], X = exclusions(market); const inBad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const trg = triggers(F); const rows = []; let bad = 0, skip = 0;
  for (const g of trg) {
    const stop = g.d > 0 ? g.stopLvl - ATRF * g.atr : g.stopLvl + ATRF * g.atr;
    for (let pl = 0; pl < 2; pl++) {
      const s = pl ? -g.d : g.d, sp = pl ? 2 * g.c0 - stop : stop;
      const r = tradeOf(M5, s, sp, g.ts, cost);
      if (!r) { if (!pl) skip++; continue; } if (r.t < FROM || r.t >= TO) continue; if (inBad(r.t)) { bad++; continue; }
      rows.push([pl, g.count, g.sig.join(''), g.trig, r.t, +(cost / r.risk).toFixed(5), ...r.R.map((x) => +x.toFixed(4))]);
    }
  }
  const meta = { market, triggers: trg.length, trades: rows.filter((r) => !r[0]).length, placebo: rows.filter((r) => r[0]).length, skipped: skip, droppedBad: bad,
    bars: M5.length, last: new Date(M5[M5.length - 1].t * 1000).toISOString() };
  if (dir) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${market}.json`), JSON.stringify({ meta, rows })); }
  return { meta, rows };
}

// ---- cut test -----------------------------------------------------------------------------------------------------------
const tKey = (g) => [g.j, g.ts, g.d, g.trig, g.stopLvl, g.c0, g.atr, g.sig.join('')].join('|');
export function cutTest(market, cuts = ['2011-06-15', '2013-02-20', '2015-09-09', '2017-04-12', '2019-08-21']) {
  const M5 = K.load(market, '5m', { from: y(2009), to: TO }); const full = triggers(frames(M5)); const out = [];
  for (const c of cuts) { const C = Date.parse(c + 'T13:37:00Z') / 1000;
    const part = triggers(frames(M5.filter((b) => b.e <= C)), { to: C });
    // the trigger list counts the H1 candle index; a cut does not move earlier indexes
    const A = new Set(full.filter((g) => g.ts <= C).map(tKey)), B = new Set(part.filter((g) => g.ts <= C).map(tKey));
    let miss = 0, extra = 0; for (const x of A) if (!B.has(x)) miss++; for (const x of B) if (!A.has(x)) extra++;
    out.push({ cut: c, triggers: A.size, missing: miss, extra }); }
  return out;
}

// ---- statistics ---------------------------------------------------------------------------------------------------------
const p1 = (t, df) => { if (t == null || !Number.isFinite(t)) return 1; const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
export function monthT(trs, x, net, a, b) { // trs: { m, R[], cr }; months a..b-1
  const ms = new Float64Array(b - a); let n = 0, s = 0;
  for (const r of trs) { if (r.m < a || r.m >= b) continue; const v = r.R[x] - (net ? r.cr : 0); ms[r.m - a] += v; n++; s += v; }
  const N = b - a, mean = ms.reduce((p, q) => p + q, 0) / N, sd = Math.sqrt(ms.reduce((p, q) => p + (q - mean) ** 2, 0) / (N - 1));
  return { n, mean: n ? s / n : null, t: sd > 0 ? mean / (sd / Math.sqrt(N)) : null };
}
// OLS slope of R on count with month-clustered standard error (CR1)
export function slope(trs, x, net) {
  const n = trs.length; if (n < 10) return { n, b: null, t: null };
  let mx = 0, my = 0; for (const r of trs) { mx += r.count; my += r.R[x] - (net ? r.cr : 0); } mx /= n; my /= n;
  let sxx = 0, sxy = 0; for (const r of trs) { const dx = r.count - mx; sxx += dx * dx; sxy += dx * (r.R[x] - (net ? r.cr : 0) - my); }
  if (!(sxx > 0)) return { n, b: null, t: null };
  const b = sxy / sxx, a0 = my - b * mx; const G = new Map();
  for (const r of trs) { const e = r.R[x] - (net ? r.cr : 0) - a0 - b * r.count; G.set(r.m, (G.get(r.m) || 0) + (r.count - mx) * e); }
  const g = G.size; let v = 0; for (const u of G.values()) v += u * u; v = (v / (sxx * sxx)) * (g / (g - 1)) * ((n - 1) / (n - 2));
  return { n, b, t: v > 0 ? b / Math.sqrt(v) : null, clusters: g };
}
export function welch(a, b) { const m = (z) => z.reduce((p, q) => p + q, 0) / z.length;
  if (a.length < 2 || b.length < 2) return null; const ma = m(a), mb = m(b);
  const va = a.reduce((p, q) => p + (q - ma) ** 2, 0) / (a.length - 1), vb = b.reduce((p, q) => p + (q - mb) ** 2, 0) / (b.length - 1);
  const se = Math.sqrt(va / a.length + vb / b.length); return { with: ma, without: mb, diff: ma - mb, t: se > 0 ? (ma - mb) / se : null, nWith: a.length, nWithout: b.length }; }
function spearman(xs, ys) { const rk = (v) => { const o = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = new Array(v.length);
    for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; for (let q = i; q <= j; q++) r[o[q][1]] = (i + j) / 2; i = j + 1; } return r; };
  if (xs.length < 3) return null; const a = rk(xs), b = rk(ys), n = xs.length, ma = (n - 1) / 2;
  let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - ma); saa += (a[i] - ma) ** 2; sbb += (b[i] - ma) ** 2; }
  return sab / Math.sqrt(saa * sbb); }
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4)), r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));

function load(dir, markets) {
  const T = { 0: [], 1: [] }, meta = {};
  for (const mk of markets) { const j = JSON.parse(fs.readFileSync(path.join(dir, `${mk}.json`), 'utf8')); meta[mk] = j.meta;
    for (const r of j.rows) T[r[0]].push({ mk, count: r[1], sig: r[2], trig: r[3], t: r[4], m: monthIdx(r[4]), cr: r[5], R: r.slice(6) }); }
  return { T, meta };
}
export function analyse(trs, net = false) {
  const halves = [[0, HM], [HM, NM]], H = (r) => (r.m < HM ? 0 : 1);
  const out = { byCount: {}, slope: {}, buckets: {}, spearman: {} };
  for (let x = 0; x < EXITS.length; x++) { const X = EXITS[x];
    out.byCount[X] = []; for (let c = 0; c <= 10; c++) { const sub = trs.filter((r) => r.count === c);
      out.byCount[X].push({ count: c, ...Object.fromEntries(halves.map(([a, b], h) => { const s = monthT(sub, x, net, a, b); return [h ? 'h2' : 'h1', { n: s.n, mean: r4(s.mean), t: r2(s.t) }]; })) }); }
    out.slope[X] = halves.map(([a, b]) => { const s = slope(trs.filter((r) => r.m >= a && r.m < b), x, net); return { n: s.n, b: r4(s.b), t: r2(s.t) }; });
    out.spearman[X] = [0, 1].map((h) => { const c = out.byCount[X].filter((q) => q[h ? 'h2' : 'h1'].n >= 30); return r2(spearman(c.map((q) => q.count), c.map((q) => q[h ? 'h2' : 'h1'].mean))); });
    out.buckets[X] = KS.map((k) => { const sub = trs.filter((r) => r.count >= k); const s = halves.map(([a, b]) => monthT(sub, x, net, a, b));
      return { k, h1: { n: s[0].n, mean: r4(s[0].mean), t: r2(s[0].t) }, h2: { n: s[1].n, mean: r4(s[1].mean), t: r2(s[1].t) } }; });
    void H; }
  return out;
}
function tests(A) { // the 21 pre-registered tests from analyse() output
  const L = [];
  for (const X of EXITS) { const s = A.slope[X]; const pass = s[0].b > 0 && s[1].b > 0 && s[0].t >= 2 && s[1].t >= 2;
    L.push({ test: `slope ${X}`, pass, p: Math.max(p1(s[0].t, 58), p1(s[1].t, 58)), h1: s[0], h2: s[1] });
    for (const b of A.buckets[X]) { const pass2 = b.h1.n >= 100 && b.h2.n >= 100 && b.h1.mean > 0 && b.h2.mean > 0 && b.h1.t >= 2 && b.h2.t >= 2;
      L.push({ test: `score>=${b.k} ${X}`, pass: pass2, p: b.h1.n >= 100 && b.h2.n >= 100 ? Math.max(p1(b.h1.t, 59), p1(b.h2.t, 59)) : 1, h1: b.h1, h2: b.h2 }); } }
  const adj = K.holm(L.map((x) => x.p)); L.forEach((x, i) => { x.holm = +adj[i].toPrecision(3); x.p = +x.p.toPrecision(3); x.passHolm = x.pass && adj[i] < 0.05; });
  return L;
}
function singles(trs, net) {
  const out = {};
  for (let i = 0; i < SIGNALS.length; i++) { out[SIGNALS[i]] = {};
    for (let x = 0; x < EXITS.length; x++) out[SIGNALS[i]][EXITS[x]] = [[0, HM], [HM, NM]].map(([a, b]) => {
      const sub = trs.filter((r) => r.m >= a && r.m < b); const v = (r) => r.R[x] - (net ? r.cr : 0);
      const w = welch(sub.filter((r) => r.sig[i] === '1').map(v), sub.filter((r) => r.sig[i] === '0').map(v));
      return w && { nWith: w.nWith, nWithout: w.nWithout, with: r4(w.with), without: r4(w.without), diff: r4(w.diff), t: r2(w.t) }; }); }
  return out;
}
export function report(dir, markets = MARKETS) {
  const { T, meta } = load(dir, markets);
  const real = analyse(T[0]), pl = analyse(T[1]), realNet = analyse(T[0], true);
  const tr = tests(real), tp = tests(pl);
  const passed = tr.filter((x) => x.passHolm), plPassed = tp.filter((x) => x.passHolm);
  const twin = passed.filter((x) => tp.find((y) => y.test === x.test).passHolm);
  const verdict = passed.length === 0 ? 'FAIL' : passed.length > twin.length ? 'PASS' : 'INCONCLUSIVE';
  const share = Object.fromEntries(SIGNALS.map((s, i) => [s, r4(T[0].filter((r) => r.sig[i] === '1').length / T[0].length)]));
  const dist = Array.from({ length: 11 }, (_, c) => T[0].filter((r) => r.count === c).length);
  const byTrig = {}; for (const g of ['sb', 'box', 'both']) byTrig[g] = analyse(T[0].filter((r) => r.trig === g)).slope;
  const byMarket = {}; for (const mk of markets) { const A = analyse(T[0].filter((r) => r.mk === mk)); byMarket[mk] = { slope: A.slope, buckets2R: A.buckets['2R'] }; }
  return { verdict, tests: tr, placeboTests: tp, passed: passed.length, placeboPassed: plPassed.length, rawPassed: tr.filter((x) => x.pass).length,
    rawPlacebo: tp.filter((x) => x.pass).length, chanceRaw: +(21 * 0.0228 * 0.0228).toFixed(3),
    real, placebo: { slope: pl.slope, buckets: pl.buckets, byCount2R: pl.byCount['2R'] }, realNet: { slope: realNet.slope, buckets: realNet.buckets, byCount2R: realNet.byCount['2R'] },
    singles: singles(T[0], false), singlesNet2R: Object.fromEntries(Object.entries(singles(T[0], true)).map(([k, v]) => [k, v['2R']])),
    share, dist, byTrig, byMarket, meta, nReal: T[0].length, nPlacebo: T[1].length };
}

const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const { meta } = runMarket(a, { dir: b }); console.log(JSON.stringify(meta), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { const r = cutTest(a); fs.mkdirSync(b, { recursive: true }); fs.writeFileSync(path.join(b, `${a}.cut.json`), JSON.stringify(r)); console.log(a, JSON.stringify(r)); }
  else if (cmd === 'report') { const R = report(a);
    const cut = MARKETS.flatMap((m) => { const f = path.join(a, `${m}.cut.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).map((c) => ({ market: m, ...c })) : []; });
    const s2 = R.real.slope['2R'], f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
    const top = R.real.buckets['2R'].find((q) => q.k === 5);
    const headline = `${R.verdict}: ${R.passed} of 21 tests pass after Holm (placebo ${R.placeboPassed}); slope of 2R trades on the count ${f(s2[0].b)} / ${f(s2[1].b)}R a signal (month-cluster t ${s2[0].t} / ${s2[1].t}, 2010-14 / 2015-19), score >= 5 at 2R ${f(top.h2.mean)}R a trade in 2015-19, n ${top.h2.n.toLocaleString('en-US')}, month t ${top.h2.t}`;
    const out = { study: 'grid6-confluence', built: '2026-11-23', verdict: R.verdict, headline, basis: 'judged before costs (pre-registered); after costs beside',
      window: 'fills 2010-01-01 to 2019-12-31; discovery 2010-14, confirmation 2015-19', markets: MARKETS, signals: SIGNALS, exits: EXITS, ...R, cut };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); console.log(headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
