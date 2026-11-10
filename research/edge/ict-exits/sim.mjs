// ICT iFVG exit study (edge research, topic ict-exits). Paper research only; changes nothing live.
// Entries: the live tracker's own signals() / isASetup() (ict/tracker.mjs, post-#413) on HistData M1 2018 -> Oct 2026
// (NSXUSD = Nasdaq 100 cash for NQ, SPXUSD = S&P 500 cash for ES, XAUUSD spot for GC). H1 and D1 are built from M1
// (HistData via the council/histdata.mjs clock, +5 h before 10 Nov 2026; tracker's halt hour 17 ET dropped from H1; day rolls 22:00 UTC as idxrec.mjs).
// Every signal is its own trade (same entry set for every exit variant). Exits are simulated on M1 candles, stop checked
// before the candle's own extreme moves the stop/MFE (as the tracker and replay do); stop wins a candle that also hits a target.
// Usage: node sim.mjs <dataDir> <market nas|spx|xau> <out.json>
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
import { signals, agg, inHalt, isASetup, sizeOf, P, MIN_GRADE } from '../../../ict/tracker.mjs';
import { histStampUtc } from '../../../council/histdata.mjs';   // the shared HistData clock

const [dir, mk, out] = process.argv.slice(2);
const CFG = {
  nas: { file: 'nsxusd-histdata/NSXUSD', key: 'nq', tick: 0.25, cost: 1.0, be: P.be },
  spx: { file: 'spxusd-histdata/SPXUSD', key: 'es', tick: 0.25, cost: 0.5, be: P.be },
  xau: { file: 'xau-histdata/XAUUSD', key: 'gc', tick: 0.1, cost: 0.30, be: null },   // gold: no BE in the live code
}[mk];

// ---- M1 load into typed arrays
const base = path.join(dir, path.dirname(CFG.file)), pre = path.basename(CFG.file);
const files = fs.readdirSync(base).filter((f) => f.startsWith(pre) && f.endsWith('.csv.gz')).sort();
let T = [], O = [], Hh = [], L = [], C = [];
for (const f of files) {
  for (const ln of zlib.gunzipSync(fs.readFileSync(path.join(base, f))).toString().split('\n')) {
    if (ln.length < 20) continue; const [d, o, h, l, c] = ln.split(';');
    const t = histStampUtc(d);
    T.push(t); O.push(+o); Hh.push(+h); L.push(+l); C.push(+c);
  }
}
{ const ix = T.map((_, i) => i).sort((a, b) => T[a] - T[b]); const k = []; let last = -1; for (const i of ix) { if (T[i] === last) { k[k.length - 1] = i; continue; } k.push(i); last = T[i]; }
  T = Int32Array.from(k.map((i) => T[i])); O = Float64Array.from(k.map((i) => O[i])); Hh = Float64Array.from(k.map((i) => Hh[i])); L = Float64Array.from(k.map((i) => L[i])); C = Float64Array.from(k.map((i) => C[i])); }
const N1 = T.length;
const m1 = []; for (let i = 0; i < N1; i++) m1.push({ time: T[i], open: O[i], high: Hh[i], low: L[i], close: C[i] });
const H = agg(m1, 3600).filter((b) => !inHalt(b.time));
const D = agg(m1.map((b) => ({ ...b, time: b.time + 7200 })), 86400).map((b) => ({ ...b, time: b.time - 7200 }));
m1.length = 0;
const lb = (t) => { let lo = 0, hi = N1; while (lo < hi) { const m = (lo + hi) >> 1; if (T[m] < t) lo = m + 1; else hi = m; } return lo; };

// ---- signals (windowed for speed, as research/ict/idxrec.mjs)
let all = [];
for (let off = 0; off < H.length; off += 2000) { const w = H.slice(Math.max(0, off - 200), off + 2000);
  for (const s of [1, -1]) all = all.concat(signals(w, D, s, CFG.tick).filter((g) => g.t >= H[off].time)); }
{ const seen = new Set(); all = all.filter((g) => !seen.has(g.side + ':' + g.t) && seen.add(g.side + ':' + g.t)).sort((a, b) => a.t - b.t); }
all = all.filter((g) => g.grade.total >= MIN_GRADE);
const hIdx = new Map(H.map((b, i) => [b.time, i]));

// ---- ET session of an H1 candle (tracker's session(): Asia 18-03, London 03-08, NY AM 08-12, NY PM 12-16, Close 16-18)
const etH = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' });
const sessOf = (t) => { const h = +etH.format(new Date(t * 1000)) % 24; return h >= 18 || h < 3 ? 0 : h < 8 ? 1 : h < 12 ? 2 : h < 16 ? 3 : 4; };
const sessId = []; { let id = 0, prev = -1, prevT = 0; for (const b of H) { const s = sessOf(b.time); if (s !== prev || b.time - prevT > 6 * 3600) id++; sessId.push(id); prev = s; prevT = b.time; } }

// liquidity targets in mirrored space (x = side * price): nearest untaken level >= entry + 1R
function liqTargets(g, i, s, r0) {
  const e = s * g.entry, mx = (b) => (s > 0 ? b.high : -b.low), need = e + r0;
  // previous day high/low: last D1 closed before the inversion candle closed (as signals())
  const di = D.findLastIndex((d) => d.time + 86400 <= H[i].time + 3600);
  let pdh = null;
  if (di >= 0) { const lvl = s > 0 ? D[di].high : -D[di].low; let taken = false; for (let k = i; k >= 0 && H[k].time >= D[di].time + 86400; k--) if (mx(H[k]) >= lvl) { taken = true; break; }
    if (!taken && lvl >= need) pdh = lvl; }
  // session highs/lows: last 3 completed sessions before the entry's session; nearest untaken one >= 1R
  let sess = null; { const cur = sessId[i]; const hi = new Map(), end = new Map();
    for (let k = i; k >= 0 && sessId[k] >= cur - 3; k--) { if (sessId[k] === cur) continue; const id = sessId[k]; hi.set(id, Math.max(hi.get(id) ?? -Infinity, mx(H[k]))); if (!end.has(id)) end.set(id, k); }
    for (const [id, lvl] of hi) { let taken = false; for (let k = end.get(id) + 1; k <= i; k++) if (mx(H[k]) >= lvl) { taken = true; break; }
      if (!taken && lvl >= need && (sess == null || lvl < sess)) sess = lvl; } }
  const dol = g.dol != null && s * g.dol >= need ? s * g.dol : null;
  return { pdh, sess, dol };
}

// ---- exit engine on M1 (mirrored space). cfg: { stop: swing|mid|tight|fail, be, trail:[start,dist]|null, tgt: R|null|'pdh'|'sess'|'dol', part:{at,frac,runTgt}|null, hold }
function run(g, i, cfg, liq) {
  const s = g.side, e = s * g.entry, swing = s * g.stop, fvgFar = s > 0 ? g.fvg[0] : -g.fvg[1];
  const tight = Math.max(swing, fvgFar - 2 * CFG.tick), stop0 = cfg.stop === 'tight' ? tight : cfg.stop === 'mid' ? (swing + tight) / 2 : swing;
  const r0 = e - stop0; if (!(r0 > 0)) return null;
  const hb = H.slice(i + 1, i + 1 + cfg.hold); if (hb.length < cfg.hold) return null;
  { let p = H[i].time + 3600; for (const b of hb) { if (b.time - p > 4 * 86400) return null; p = b.time + 3600; } }
  const end = hb[hb.length - 1].time + 3600, a = lb(H[i].time + 3600), z = lb(end);
  let tgtPx = null; if (typeof cfg.tgt === 'number') tgtPx = e + cfg.tgt * r0; else if (cfg.tgt) { const lv = liq[cfg.tgt]; if (lv != null) tgtPx = lv; }
  const useTrail = cfg.trail && (tgtPx == null || cfg.trailWithTgt);
  let stop = stop0, mfe = 0, mae = 0, open = 1, R = 0, partDone = false, exit = 'time', last = e;
  const partPx = cfg.part ? e + cfg.part.at * r0 : null, runPx = cfg.part && cfg.part.runTgt ? e + cfg.part.runTgt * r0 : null;
  for (let k = a; k < z; k++) {
    const hi = s > 0 ? Hh[k] : -L[k], lo = s > 0 ? L[k] : -Hh[k], cl = s * C[k];
    if (lo <= stop) { R += open * (stop - e) / r0; open = 0; exit = stop > e + 1e-9 ? 'trail' : Math.abs(stop - e) < 1e-9 ? 'be' : 'stop'; break; }
    if (tgtPx != null && hi >= tgtPx) { R += open * (tgtPx - e) / r0; open = 0; exit = 'target'; break; }
    if (partPx != null && !partDone && hi >= partPx) { R += cfg.part.frac * cfg.part.at; open -= cfg.part.frac; partDone = true; if (stop < e) stop = e; }
    if (runPx != null && partDone && hi >= runPx) { R += open * cfg.part.runTgt; open = 0; exit = 'target'; break; }
    mfe = Math.max(mfe, (hi - e) / r0); mae = Math.min(mae, (lo - e) / r0);
    if (cfg.be != null && mfe >= cfg.be && stop < e) stop = e;
    if (useTrail && mfe >= cfg.trail[0]) { const ns = e + (mfe - cfg.trail[1]) * r0; if (ns > stop) stop = ns; }
    // fail stop: an H1 body closes back through the iFVG (checked on the last M1 candle of each hour)
    if (cfg.stop === 'fail' && (k + 1 >= z || Math.floor(T[k + 1] / 3600) !== Math.floor(T[k] / 3600)) && cl < fvgFar) { R += open * (cl - e) / r0; open = 0; exit = 'fail'; break; }
    last = cl;
  }
  if (open > 0) R += open * (last - e) / r0;
  return { R, cost: CFG.cost / (s > 0 ? r0 : r0), r0, exit, mfe, mae };
}

// ---- variants
const BASE = { stop: 'swing', be: CFG.be, trail: [2, 1.5], tgt: null, part: null, hold: P.holdH };
const V = { base: BASE };
for (const h of [12, 24, 48]) V[`time${h}`] = { ...BASE, hold: h };
for (const [n, be] of [['0', null], ['1', 1], ['15', 1.5]]) V[`trail_be${n}`] = { ...BASE, be };
for (const tg of [2, 3, 4]) for (const [n, be] of [['0', null], ['1', 1], ['15', 1.5]]) V[`fix${tg}R_be${n}`] = { ...BASE, trail: null, tgt: tg, be };
V.part2_trail = { ...BASE, part: { at: 2, frac: 0.5 } };
V.part2_run4R = { ...BASE, trail: null, part: { at: 2, frac: 0.5, runTgt: 4 } };
V.part2_run36h = { ...BASE, trail: null, part: { at: 2, frac: 0.5 } };
for (const t of ['pdh', 'sess', 'dol']) V[`liq_${t}`] = { ...BASE, tgt: t };   // fallback to the base trail when no level >= 1R
V.stop_mid = { ...BASE, stop: 'mid' }; V.stop_tight = { ...BASE, stop: 'tight' }; V.stop_fail = { ...BASE, stop: 'fail' };

const recs = [];
for (const g of all) {
  const i = hIdx.get(g.t); if (i == null) continue;
  const s = g.side, liq = liqTargets(g, i, s, g.r0), r = {};
  let ok = true;
  for (const [n, cfg] of Object.entries(V)) { const x = run(g, i, cfg, liq); if (!x) { if (n === 'base') { ok = false; break; } r[n] = null; continue; }
    r[n] = [+x.R.toFixed(3), +x.cost.toFixed(4), x.exit]; if (n === 'base') r._b = x; }
  if (!ok) continue;
  // MFE / MAE over the 36 H1 candles after entry, ignoring and respecting the swing stop (M1 extremes, mirrored)
  const e = s * g.entry, r0 = g.r0, a = lb(H[i].time + 3600), z = lb(H[Math.min(i + 36, H.length - 1)].time + 3600);
  let mfeAll = 0, maeAll = 0, mfeStop = null, hitAt = {}; let stopped = false, mfeS = 0;
  for (let k = a; k < z; k++) { const hi = s > 0 ? Hh[k] : -L[k], lo = s > 0 ? L[k] : -Hh[k];
    mfeAll = Math.max(mfeAll, (hi - e) / r0); maeAll = Math.min(maeAll, (lo - e) / r0);
    if (!stopped) { if (lo <= s * g.stop) { stopped = true; mfeStop = mfeS; } else mfeS = Math.max(mfeS, (hi - e) / r0); } }
  if (mfeStop == null) mfeStop = mfeS;
  const b = r._b; delete r._b;
  recs.push({ mk, t: g.close, y: new Date(g.close * 1000).getUTCFullYear(), side: s, aset: isASetup(g, CFG.key), size: sizeOf(g, CFG.key), grade: g.grade.total,
    r0: +r0.toPrecision(5), costR: +(CFG.cost / r0).toFixed(4), liq: { pdh: liq.pdh != null, sess: liq.sess != null, dol: liq.dol != null },
    mfe36: +mfeAll.toFixed(2), mae36: +maeAll.toFixed(2), mfeB4Stop: +mfeStop.toFixed(2), stoppedIn36: stopped, baseMfe: +b.mfe.toFixed(2), baseMae: +b.mae.toFixed(2), R: r });
}
fs.writeFileSync(out, JSON.stringify({ mk, variants: V, n: recs.length, recs }));
console.log(mk, 'M1', N1, 'H1', H.length, 'D1', D.length, 'signals', all.length, 'trades', recs.length, 'A', recs.filter((x) => x.aset).length);
