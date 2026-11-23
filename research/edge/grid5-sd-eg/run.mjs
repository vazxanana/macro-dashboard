// research/edge/grid5-sd-eg/run.mjs - PREREGISTRATION.md (23 Nov 2026): fresh supply / demand zones (the order block at the
// origin of a break leg) on D1 / H4 / H1, a lower-timeframe trigger inside the zone (EG within 1 or 3 candles, EF, a structure
// break), the key timeframe's cycle stage, a market or trade-through limit entry, two stops, five exits; 2010-2014 discovery,
// 2015-2019 confirmation, judged before costs. Research only: reads the edgekit candle cache, writes <dir> and result.json.
//   node --max-old-space-size=6000 research/edge/grid5-sd-eg/run.mjs market <m> <dir>   one market -> <dir>/<m>.json
//   node research/edge/grid5-sd-eg/run.mjs report <dir>                                  every cell, tests -> result.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, egZones } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { findFill, manage, atr14, startIdx } from '../dom-trade-through/run.mjs';
import { engulfAt } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2010), HALF = y(2015), TO = y(2020);
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const CHAINS = [['1d', '1h'], ['4h', '15m'], ['1h', '5m']];
export const VISITS = ['first', 'any'], TRIGS = ['eg1', 'eg3', 'ef', 'bo'], STAGES = ['pull', 'cont', 'any'];
export const ENTRIES = ['mkt', 'lim'], STOPS = ['zone', 'trig'], EXITS = ['1R', '2R', '3R', 'trail', 'opp'];
const SLOT = [0, 1, 2, 6, 5]; // manage() result slots of the five exits
export const NCELL = CHAINS.length * VISITS.length * TRIGS.length * STAGES.length * ENTRIES.length * STOPS.length * EXITS.length; // 1,440
export const cellIndex = (ch, v, tr, st, en, sp, x) => ((((((ch * 2 + v) * 4 + tr) * 3 + st) * 2 + en) * 2 + sp) * 5 + x);
export function cellName(c) { const x = c % 5; c = (c - x) / 5; const sp = c % 2; c = (c - sp) / 2; const en = c % 2; c = (c - en) / 2;
  const st = c % 3; c = (c - st) / 3; const tr = c % 4; c = (c - tr) / 4; const v = c % 2; const ch = (c - v) / 2;
  return { chain: CHAINS[ch].join('>'), visit: VISITS[v], trigger: TRIGS[tr], stage: STAGES[st], entry: ENTRIES[en], stop: STOPS[sp], exit: EXITS[x] }; }
export const NM = 120, MID = 60; // months 2010-01 .. 2019-12; discovery 0..59, confirmation 60..119
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2010) * 12 + d.getUTCMonth(); };
const W = 12, LIFE = 120, MAXV = 10, CAP = { '1d': 10 * 86400, '4h': 5 * 86400, '1h': 2 * 86400 }, BELOW = { '1d': '4h', '4h': '1h', '1h': '15m' };
const SEC = { '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };

// ---- the key zones ------------------------------------------------------------------------------------------------
// every fresh supply / demand zone of L: { d, lo, hi, oi (the OB candle), bi (break candle), at (known), dead (close of the L
// candle that closed through the far side, or Infinity), end (life end) }. Causal: a zone's fields at time t use candles
// closed by t only (dead / end are the moments the scan stops at; nothing before them depends on later candles).
export function sdZones(L) {
  const out = [], seen = new Set();
  for (const ev of K.structure(L, 3).events) {
    const up = ev.dir > 0; if (!(ev.from >= 0 && ev.from < ev.i)) continue;
    let oi = ev.from; for (let j = ev.from; j < ev.i; j++) if (up ? L[j].l < L[oi].l : L[j].h > L[oi].h) oi = j;
    let zi = oi; for (let j = oi; j >= ev.from; j--) { const b = L[j]; if (up ? b.c < b.o : b.c > b.o) { zi = j; break; } }
    if (seen.has(zi)) continue; seen.add(zi);
    const lo = up ? Math.min(L[zi].l, L[oi].l) : L[zi].l, hi = up ? L[zi].h : Math.max(L[zi].h, L[oi].h);
    if (!(hi > lo)) continue;
    let dead = Infinity; for (let j = ev.i + 1; j < L.length && j <= ev.i + LIFE; j++) if (up ? L[j].c < lo : L[j].c > hi) { dead = L[j].e; break; }
    const end = Math.min(dead, ev.i + LIFE < L.length ? L[ev.i + LIFE].e : Infinity);
    out.push({ d: ev.dir, lo, hi, oi: zi, bi: ev.i, at: L[ev.i].e, dead, end });
  }
  return out.sort((a, b) => a.at - b.at);
}

// ---- the cycle stage (phase.mjs stageOf on full-history structure) -------------------------------------------------
const upto = (arr, t) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= t) lo = m + 1; else hi = m; } return lo; };
export function stager(L, B) {
  const SL = K.structure(L, 3), EB = K.structure(B, 3).events, tL = SL.events.map((e) => e.t), tB = EB.map((e) => e.t);
  return (t) => { // { side, stage } known at moment t
    const n = upto(tL, t); if (!n) return { side: 0, stage: 'range' };
    const last = SL.events[n - 1], prev = SL.events[n - 2], prev2 = SL.events[n - 3], d = last.dir;
    if (last.kind === 'ChoCh' && prev && prev.kind === 'ChoCh' && !(prev2 && prev2.kind === 'BO' && prev2.dir === d)) return { side: d, stage: 'range' };
    let k = upto(tB, last.t), against = false, back = false;
    for (; k < EB.length && EB[k].t <= t; k++) { if (!against) { if (EB[k].dir === -d) against = true; } else if (EB[k].dir === d) { back = true; break; } }
    return { side: d, stage: !against ? 'move' : back ? 'continuation' : 'pullback' };
  };
}

// ---- every trade of one market -----------------------------------------------------------------------------------
// onTrade({ t (fill), ch, visit, trig, pull, cont, entry, stop, flip (placebo), R: [5] (NaN = no result), cr (cost / risk) })
export function tradesOf(market, M5, F, onTrade, { from = FROM, to = TO } = {}) {
  const cost = COSTS[market], X = exclusions(market); let made = 0;
  const bad = (t) => X.some(([a, b]) => t >= a && t <= b);
  CHAINS.forEach(([tfL, tfT], ch) => {
    const L = F[tfL], T = F[tfT], AL = atr14(L), AT = atr14(T), Z = sdZones(L), stage = stager(L, F[BELOW[tfL]]);
    const C = T.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
    const ef = new Map(); for (const z of egZones(T, 3)) if (z.fi >= 0) { const a = ef.get(z.fi) || []; a.push(z); ef.set(z.fi, a); }
    const ev = new Map(); for (const e of K.structure(T, 2).events) ev.set(e.i, e);
    const zAt = Z.map((z) => z.at), span = 2.2 * LIFE * SEC[tfL] + 10 * 86400;
    const targetFor = (s, ref, rk, ts) => { // nearest alive opposite-side zone edge at least 1R beyond ref
      let best = null; for (let q = upto(zAt, ts - span); q < Z.length && Z[q].at <= ts; q++) { const o = Z[q]; if (o.d !== -s || o.end <= ts) continue;
        const edge = s > 0 ? o.lo : o.hi; if (s * (edge - ref) >= rk && (best == null || s * (best - edge) > 0)) best = edge; }
      return best == null ? NaN : (s * (best - ref)) / rk; };
    for (const z of Z) {
      if (z.at < from - 30 * 86400 || z.at >= to) continue;
      let k = startIdx(T, z.at), visit = 0;
      while (k < T.length && T[k].t < z.end && visit < MAXV) {
        while (k < T.length && T[k].t < z.end && !(T[k].l <= z.hi && T[k].h >= z.lo)) k++;
        if (k >= T.length || T[k].t >= z.end) break;
        visit++; const k0 = k;
        if (T[k0].t >= from - 2 * 86400 && T[k0].t < to) for (const flip of [0, 1]) {
          const s = flip ? -z.d : z.d; const got = new Set(); let ext = s > 0 ? Infinity : -Infinity;
          for (let j = k0; j < T.length && j < k0 + W && T[j].t < z.end; j++) {
            const b = T[j]; ext = s > 0 ? Math.min(ext, b.l) : Math.max(ext, b.h);
            if (s > 0 ? b.c < z.lo : b.c > z.hi) break; // the zone died on this trigger-timeframe close (for the traded side)
            const fired = [];
            for (const [ti, back] of [[0, 1], [1, 3]]) if (!got.has(ti)) { const e = engulfAt(C, j, back); if (e && e.dir === s) { got.add(ti); fired.push([ti, [T[e.j].l, T[e.j].h]]); } }
            if (!got.has(2)) { const a = ef.get(j); const f = a && a.find((x) => x.d === -s); if (f) { got.add(2); fired.push([2, [f.bot, f.top]]); } }
            if (!got.has(3)) { const e = ev.get(j); if (e && e.dir === s) { got.add(3); fired.push([3, s > 0 ? [ext, e.level] : [e.level, ext]]); } }
            if (!fired.length) continue;
            const ts = b.e, li = K.closedCount(L, ts) - 1; if (li < 15) continue;
            const sg = stage(ts), pull = sg.side === s && sg.stage === 'pullback', cont = sg.side === s && sg.stage === 'continuation';
            const zStop = s > 0 ? z.lo - 0.1 * AL[li] : z.hi + 0.1 * AL[li];
            for (const [ti, [tlo, thi]] of fired) {
              const tStop = s > 0 ? tlo - 0.1 * AT[j] : thi + 0.1 * AT[j];
              for (let en = 0; en < 2; en++) for (let sp = 0; sp < 2; sp++) {
                const stop = sp ? tStop : zStop, entry = en ? (s > 0 ? thi : tlo) : b.c;
                if (!(s * (entry - stop) >= 2 * cost)) continue;
                const rk0 = s * (entry - stop), oppR = targetFor(s, entry, rk0, ts), cap = CAP[tfL];
                let r = null;
                if (en === 0) { const fi = startIdx(M5, ts); if (fi >= M5.length) continue;
                  if (s * (M5[fi].o - stop) <= 0) { const R = (s * (M5[fi].o - b.c)) / rk0; r = { t: M5[fi].t, risk: rk0, R: [R, R, R, 0, 0, R, R, 0, 0] }; }
                  else r = manage(M5, s, fi, b.c, stop, cap, true, Number.isFinite(oppR) ? oppR : NaN); }
                else { const f = findFill(M5, s, entry, stop, ts, ts + W * SEC[tfT], 'through', cost / 2); if (f) r = manage(M5, s, f.i, f.fill, stop, cap, false, Number.isFinite(oppR) ? oppR : NaN); }
                if (!r || !(r.risk >= cost) || r.t < from || r.t >= to || bad(r.t)) continue;
                const R = SLOT.map((q) => r.R[q]); if (!Number.isFinite(oppR)) R[4] = NaN;
                onTrade({ t: r.t, ch, visit, trig: ti, pull, cont, entry: en, stop: sp, flip, R, cr: cost / r.risk }); made++;
              }
            }
          }
        }
        while (k < T.length && T[k].t < z.end && T[k].l <= z.hi && T[k].h >= z.lo) k++;
      }
    }
    process.stderr.write(`${market} ${tfL}>${tfT}: ${Z.length} zones, ${made} trades so far\n`);
  });
  return made;
}

// ---- accumulate one market --------------------------------------------------------------------------------------------
export function accumulate(market, M5, F) {
  const A = [0, 1].map(() => ({ n: new Uint32Array(NCELL * 2), g: new Float64Array(NCELL * NM), c: new Float64Array(NCELL * NM) }));
  const made = tradesOf(market, M5, F, (x) => {
    const a = A[x.flip], m = monthOf(x.t), h = m >= MID ? 1 : 0;
    for (let v = 0; v < 2; v++) { if (v === 0 && x.visit !== 1) continue;
      for (let st = 0; st < 3; st++) { if ((st === 0 && !x.pull) || (st === 1 && !x.cont)) continue;
        for (let e = 0; e < 5; e++) { const R = x.R[e]; if (!Number.isFinite(R)) continue; const c = cellIndex(x.ch, v, x.trig, st, x.entry, x.stop, e);
          a.n[c * 2 + h]++; a.g[c * NM + m] += R; a.c[c * NM + m] += x.cr; } } } });
  return { made, A };
}

// ---- statistics --------------------------------------------------------------------------------------------------------
export function mstat(ms, a, b) { const n = b - a; let s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[m]; q += ms[m] * ms[m]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return { sum: s, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 }; }
export const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
const r4 = (x) => (x == null ? null : +x.toFixed(4)), r2 = (x) => (x == null ? null : +x.toFixed(2));

export function evaluate(data, flip) { // data: { market: { n, g, c } (plain arrays) } -> rows of every scope x cell
  const rows = []; const g = new Float64Array(NM), nt = new Float64Array(NM);
  for (const sc of ['pool', ...MARKETS]) { const list = sc === 'pool' ? MARKETS : [sc];
    for (let c = 0; c < NCELL; c++) { g.fill(0); nt.fill(0); let n1 = 0, n2 = 0;
      for (const m of list) { const A = data[m][flip]; n1 += A.n[c * 2]; n2 += A.n[c * 2 + 1]; for (let k = 0; k < NM; k++) { g[k] += A.g[c * NM + k]; nt[k] += A.g[c * NM + k] - A.c[c * NM + k]; } }
      const a = mstat(g, 0, MID), b = mstat(g, MID, NM), an = mstat(nt, 0, MID), bn = mstat(nt, MID, NM);
      rows.push({ sc, c, n1, n2, m1: n1 ? a.sum / n1 : null, t1: a.t, m1net: n1 ? an.sum / n1 : null, t1net: an.t,
        m2: n2 ? b.sum / n2 : null, t2: b.t, m2net: n2 ? bn.sum / n2 : null, t2net: bn.t }); } }
  return rows;
}
export function judge(rows) {
  const tested = rows.filter((r) => r.n1 >= 100);
  const disc = tested.filter((r) => r.m1 > 0 && r.t1 >= 2);
  const chk = disc.filter((r) => r.n2 >= 50); const adj = K.holm(chk.map((r) => p1(r.t2, MID - 1)));
  chk.forEach((r, i) => { r.holm = adj[i]; r.raw = r.m2 > 0 && r.t2 >= 2; r.pass = r.raw && r.holm < 0.05; });
  return { tested: tested.length, discovery: disc.length, discChance: +(tested.length * 0.0228).toFixed(1), checked: chk.length,
    raw: chk.filter((r) => r.raw).length, rawChance: +(chk.length * 0.0228).toFixed(1), confirmed: chk.filter((r) => r.pass).length, chk, disc, tested_: tested };
}
export const nameRow = (r) => ({ scope: r.sc, ...cellName(r.c), n1: r.n1, m1: r4(r.m1), t1: r2(r.t1), m1net: r4(r.m1net), t1net: r2(r.t1net),
  n2: r.n2, m2: r4(r.m2), t2: r2(r.t2), m2net: r4(r.m2net), t2net: r2(r.t2net), holm: r.holm == null ? null : +r.holm.toPrecision(3) });

export function report(data) {
  const real = judge(evaluate(data, 0)), plac = judge(evaluate(data, 1));
  const verdict = real.confirmed > 0 ? 'PASS' : real.raw > 2 * real.rawChance && real.raw > plac.raw ? 'INCONCLUSIVE' : 'FAIL';
  const byT2 = (a) => [...a].sort((x, y) => y.t2 - x.t2);
  const best = byT2(real.chk)[0] || null;
  const poolRows = real.tested_.filter((r) => r.sc === 'pool');
  // factor margins: pooled cells, mean of the cells' 2010-14 and 2015-19 means by level
  const margins = {};
  const all = evaluate(data, 0).filter((r) => r.sc === 'pool' && r.n1 >= 100 && r.n2 >= 50);
  for (const [f, levels] of Object.entries({ chain: CHAINS.map((c) => c.join('>')), visit: VISITS, trigger: TRIGS, stage: STAGES, entry: ENTRIES, stop: STOPS, exit: EXITS })) {
    margins[f] = {}; for (const l of levels) { const xs = all.filter((r) => cellName(r.c)[f] === l);
      const avg = (k) => (xs.length ? r4(xs.reduce((a, r) => a + r[k], 0) / xs.length) : null);
      margins[f][l] = { cells: xs.length, m1: avg('m1'), m2: avg('m2'), m2net: avg('m2net'), up2: xs.filter((r) => r.m2 > 0).length }; } }
  const strip = (j) => ({ tested: j.tested, discovery: j.discovery, discChance: j.discChance, checked: j.checked, raw: j.raw, rawChance: j.rawChance, confirmed: j.confirmed });
  return { study: 'grid5-sd-eg', built: '2026-11-23', basis: 'judged before costs (pre-registered); after costs beside',
    windows: { discovery: '2010-01-01 .. 2014-12-31', confirmation: '2015-01-01 .. 2019-12-31' }, markets: MARKETS, cells: NCELL * 6,
    verdict, real: strip(real), placebo: strip(plac),
    best: best ? nameRow(best) : null,
    confirmedList: real.chk.filter((r) => r.pass).map(nameRow),
    rawList: byT2(real.chk.filter((r) => r.raw)).slice(0, 40).map(nameRow),
    topDiscovery: [...real.disc].sort((a, b) => b.t1 - a.t1).slice(0, 30).map(nameRow),
    placeboRaw: byT2(plac.chk.filter((r) => r.raw)).slice(0, 20).map(nameRow),
    pooledShare: { cells: poolRows.length, up1: poolRows.filter((r) => r.m1 > 0).length, up2: poolRows.filter((r) => r.n2 >= 50 && r.m2 > 0).length,
      net2up: poolRows.filter((r) => r.n2 >= 50 && r.m2net > 0).length }, margins };
}

const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main && process.argv[2] === 'market') {
  const m = process.argv[3], dir = process.argv[4]; fs.mkdirSync(dir, { recursive: true }); const t0 = Date.now();
  const M5 = K.load(m, '5m', { from: '2009-01-01', to: '2020-01-01' }), F = frames(M5);
  const o = accumulate(m, M5, F);
  fs.writeFileSync(path.join(dir, m + '.json'), JSON.stringify({ market: m, made: o.made, bars: M5.length, A: o.A.map((a) => ({ n: [...a.n], g: [...a.g].map(r4), c: [...a.c].map(r4) })) }));
  console.log(m, o.made, 'trades', ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
if (main && process.argv[2] === 'report') {
  const dir = process.argv[3], data = {}, made = {};
  for (const m of MARKETS) { const j = JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')); data[m] = j.A; made[m] = j.made; }
  const res = report(data); res.trades = made; const b = res.best, f = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
  res.headline = `${res.real.confirmed} of ${res.real.checked} discovery winners confirmed (${res.real.discovery} of ${res.real.tested} cells passed 2010-14, chance about ${res.real.discChance}; ${res.real.raw} reached month t 2 in 2015-19, chance about ${res.real.rawChance}; placebo ${res.placebo.raw})` +
    (b ? `; best 2015-19 cell ${b.scope} ${b.chain} ${b.visit} ${b.trigger} ${b.stage} ${b.entry} ${b.stop} ${b.exit}: n ${b.n2}, ${f(b.m2)}R a trade before costs, month t ${b.t2} (after costs ${f(b.m2net)}R)` : '') + '.';
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, real: res.real, placebo: res.placebo, best: res.best, pooledShare: res.pooledShare, headline: res.headline }, null, 1));
}
