// research/edge/combo-grid-4/run.mjs - combination grid 4 of PREREGISTRATION.md (23 Nov 2026): grid 3's no-trigger entry
// 'zedge' with the 'zatr' stop, filter 'none', for every zone kind x chain x exit, on 2010-2019 (years no grid read).
// node research/edge/combo-grid-4/run.mjs market <market> <outDir>   one market: month sums per rule (before costs + cost)
// node research/edge/combo-grid-4/run.mjs cut <market> <outDir>      the cut test (candles cut at 2015-01-01)
// node research/edge/combo-grid-4/run.mjs report <outDir>            pool, apply the bar, write result.json
// Research only: imports grid 3's engine (never edited); writes only to <outDir> and its own folder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, buildZones, signalsFor, multi, CHAINS, ZONES, EXITS, NONE } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const START = Date.UTC(2010, 0, 1) / 1000, SPLIT = Date.UTC(2015, 0, 1) / 1000, END = Date.UTC(2020, 0, 1) / 1000;
export const MONTHS = (() => { const o = []; for (let y = 2010; y <= 2019; y++) for (let m = 0; m < 12; m++) o.push(Date.UTC(y, m, 1) / 1000); return o; })();
export const NM = MONTHS.length, IS_M = 60;
export const NX = EXITS.length, NZ = ZONES.length, NCH = CHAINS.length, NRULE = NCH * NZ * NX; // 891
export const ruleIndex = (ch, z, x) => (ch * NZ + z) * NX + x;
export const ruleName = (r) => { const x = r % NX, z = ((r - x) / NX) % NZ, ch = Math.floor(r / (NX * NZ)); return { chain: CHAINS[ch].join('>'), zone: ZONES[z], exit: EXITS[x] }; };
// grid 3's private constants, copied unchanged
const SEC = { ...K.TF, '1w': 604800 };
const W = 12, CAP = { '1d': 10 * 86400, '4h': 5 * 86400, '1h': 2 * 86400, '30m': 2 * 86400, '15m': 86400 };
function atr14(B) { const a = new Float64Array(B.length); let s = 0; for (let i = 1; i < B.length; i++) { const tr = Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
    s += tr; if (i > 14) s -= Math.max(B[i - 14].h - B[i - 14].l, Math.abs(B[i - 14].h - B[i - 15].c), Math.abs(B[i - 14].l - B[i - 15].c)); a[i] = i >= 14 ? s / 14 : 0; } return a; }
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const mIdx = (t) => { let lo = 0, hi = NM; while (lo < hi) { const m = (lo + hi) >> 1; if (MONTHS[m] <= t) lo = m + 1; else hi = m; } return lo - 1; };

// every no-trigger zedge / zatr trade of one market's candles: rows [ch, zi, t, cr, R0..R8] (R before costs)
export function tradesOf(M5, market, { start = START, end = END, X = [], log = false, sink = null } = {}) {
  const F = frames(M5), cost = COSTS[market], out = [];
  const atr = {}; for (const tf of ['1d', '4h', '1h', '30m', '15m']) atr[tf] = atr14(F[tf]);
  const efMap = new Map(); for (const z of buildZones('eg', M5)) if (z.fi >= 0) { const a = efMap.get(z.fi) || []; a.push({ d: z.d, top: z.top, bot: z.bot }); efMap.set(z.fi, a); }
  const Zc = {}; const FAR = []; for (const tf of ['4h', '1d']) for (const k of ['eg', 'ef']) FAR.push(...(Zc[tf + k] ||= buildZones(k, F[tf])));
  CHAINS.forEach(([tfL, tfT], ch) => {
    const L = F[tfL], T = F[tfT], cap = CAP[tfL];
    ZONES.forEach((kind, zi) => {
      const S = signalsFor(F, tfL, tfT, kind, Zc, start); const Z = Zc[tfL + kind]; let n = 0;
      for (const sg of S) {
        if (sg.trig !== NONE) continue;
        const z = sg.z, d = z.d, ts = T[sg.k0].t; if (ts >= end) continue;
        const li = K.closedCount(L, ts) - 1; if (li < 0) continue;
        const entry = d > 0 ? z.top : z.bot, buf = cost / 2, atrL = atr[tfL][li] || 0;
        const stop = d > 0 ? z.bot - buf - 0.25 * atrL : z.top + buf + 0.25 * atrL;
        if (!(d * (entry - stop) > 0)) continue;
        const rk0 = d * (entry - stop); if (!(rk0 >= 2 * cost)) continue;
        let opp = null; for (const o of Z) { if (o.at > ts || o.end <= ts || o.d !== -d) continue; const e = -o.d > 0 ? o.bot : o.top; if (d * (e - entry) > 0 && (opp == null || d * (opp - e) > 0)) opp = e; }
        let oppR = opp == null ? 2 : (d * (opp - entry)) / rk0; if (!(oppR >= 1)) oppR = 2;
        let fz = null; for (const o of FAR) { if (o.at > ts || o.end <= ts || o.d !== -d) continue; const e = -o.d > 0 ? o.bot : o.top; if (d * (e - entry) > 0 && (fz == null || d * (fz - e) > 0)) fz = e; }
        const farR = fz != null && (d * (fz - entry)) / rk0 >= 3 ? (d * (fz - entry)) / rk0 : null;
        const r = multi(M5, d, entry, stop, 'lim', ts, ts + W * SEC[tfT], oppR, farR, cap, efMap);
        if (!r || r.risk < cost || r.t < start || r.t >= end) continue;
        if (X.length && inBad(X, r.t)) continue;
        const row = [ch, zi, r.t, cost / r.risk, ...r.R]; if (sink) sink(row); else out.push(row); n++;
      }
      if (log) process.stderr.write(`${market} ${tfL}>${tfT} ${kind}: ${n} trades\n`);
    });
  });
  return out;
}

// month sums per rule: gross (before costs), cost, and n per window
export function accumulator() {
  const n = new Uint32Array(NRULE * 2), g = new Float64Array(NRULE * NM), c = new Float64Array(NRULE * NM); let count = 0;
  const add = (row) => { const [ch, zi, t, cr] = row, m = mIdx(t); if (m < 0 || m >= NM) return; const w = t >= SPLIT ? 1 : 0; count++;
    for (let x = 0; x < NX; x++) { const R = row[4 + x]; if (!Number.isFinite(R)) continue; const k = ruleIndex(ch, zi, x); n[k * 2 + w]++; g[k * NM + m] += R; c[k * NM + m] += cr; } };
  const done = () => ({ trades: count, n: Array.from(n), g: Array.from(g, (v) => +v.toFixed(5)), c: Array.from(c, (v) => +v.toFixed(5)) });
  return { add, done };
}
export function accumulate(rows) { const A = accumulator(); for (const r of rows) A.add(r); return A.done(); }

export function mstat(ms, a, b) { const n = b - a; let s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[m]; q += ms[m] * ms[m]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return { sum: s, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 }; }
const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };

// the pre-registered bar on one basis ('before' | 'after')
export function bar(P, basis) {
  const scopes = ['pool', ...MARKETS], rows = [], ms = new Float64Array(NM);
  for (const sc of scopes) { const list = sc === 'pool' ? MARKETS : [sc];
    for (let r = 0; r < NRULE; r++) { ms.fill(0); let nI = 0, nO = 0;
      for (const m of list) { const A = P[m]; nI += A.n[r * 2]; nO += A.n[r * 2 + 1]; for (let k = 0; k < NM; k++) ms[k] += A.g[r * NM + k] - (basis === 'after' ? A.c[r * NM + k] : 0); }
      const a = mstat(ms, 0, IS_M), b = mstat(ms, IS_M, NM);
      rows.push({ sc, r, nI, nO, isMean: nI ? a.sum / nI : null, isT: a.t, oosMean: nO ? b.sum / nO : null, oosT: b.t }); } }
  const disc = rows.filter((x) => x.nI >= 100 && x.isMean > 0 && x.isT >= 2);
  const ok = disc.filter((x) => x.nO >= 50), adj = K.holm(ok.map((x) => p1(x.oosT, NM - IS_M - 1)));
  ok.forEach((x, i) => { x.holm = adj[i]; x.raw = x.oosMean > 0 && x.oosT >= 2; x.pass = x.raw && x.holm < 0.05; });
  const fmt = (x) => ({ scope: x.sc, ...ruleName(x.r), isN: x.nI, isMean: +x.isMean.toFixed(4), isT: +x.isT.toFixed(2), oosN: x.nO,
    oosMean: x.oosMean == null ? null : +x.oosMean.toFixed(4), oosT: +x.oosT.toFixed(2), holm: x.holm == null ? null : +x.holm.toPrecision(3) });
  const by = (list, key) => { const o = {}; for (const x of list) { const k = ruleName(x.r)[key]; o[k] = (o[k] || 0) + 1; } return o; };
  const raw = ok.filter((x) => x.raw), pass = ok.filter((x) => x.pass);
  return { basis, tested: rows.length, withN100: rows.filter((x) => x.nI >= 100).length, discovery: disc.length, discoveryWithConf: ok.length,
    rawConfirmed: raw.length, expectedByChance: +(ok.length * 0.0228).toFixed(1), holmConfirmed: pass.length,
    discoveryByZone: by(disc, 'zone'), discoveryByChain: by(disc, 'chain'), rawByZone: by(raw, 'zone'), rawByChain: by(raw, 'chain'),
    holmByZone: by(pass, 'zone'), holmByChain: by(pass, 'chain'), cellsWithN100ByZone: by(rows.filter((x) => x.nI >= 100), 'zone'),
    confirmedList: pass.sort((a, b) => b.oosT - a.oosT).map(fmt), rawList: raw.sort((a, b) => b.oosT - a.oosT).slice(0, 60).map(fmt), rows };
}

// the H1 DOM cell (1h>5m, dom, zedge / zatr) every exit, every scope, both windows, both bases
export function domCell(rows0, rows1) {
  const ch = CHAINS.findIndex((c) => c[0] === '1h' && c[1] === '5m'), zi = ZONES.indexOf('dom'), out = {};
  for (const [basis, rows] of [['before', rows0], ['after', rows1]]) for (const x of rows) { const nm = ruleName(x.r); if (nm.chain !== '1h>5m' || nm.zone !== 'dom') continue;
    ((out[x.sc] ||= {})[nm.exit] ||= {})[basis] = { '2010-14': { n: x.nI, mean: x.isMean == null ? null : +x.isMean.toFixed(4), t: +x.isT.toFixed(2) },
      '2015-19': { n: x.nO, mean: x.oosMean == null ? null : +x.oosMean.toFixed(4), t: +x.oosT.toFixed(2) } }; }
  void ch; void zi; return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const M5 = K.load(a, '5m', { from: '2009-03-01', to: '2020-01-01' });
    const acc = accumulator(); tradesOf(M5, a, { X: exclusions(a), log: true, sink: acc.add }); const res = acc.done(); fs.mkdirSync(b, { recursive: true });
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify({ market: a, bars: M5.length, ...res }));
    console.log(a, res.trades, 'trades', ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { // trades on candles cut at 2015-01-01 must equal the full run's trades whose time limit ends before it
    const cut = SPLIT, X = exclusions(a);
    const full = K.load(a, '5m', { from: '2009-03-01', to: '2016-01-01' }), part = full.filter((x) => x.t < cut);
    const str = (r) => r.map((v) => (Number.isFinite(v) ? +v.toPrecision(10) : String(v))).join(',');
    const safe = (r) => r[2] + 10 * 86400 + 12 * 86400 < cut; // fill + longest time limit + order life before the cut
    const A = tradesOf(full, a, { end: cut, X }).filter(safe).map(str), B = tradesOf(part, a, { end: cut, X }).filter(safe).map(str);
    const cnt = new Map(); for (const x of B) cnt.set(x, (cnt.get(x) || 0) + 1); let same = 0, diff = 0; // compared as multisets of whole rows
    for (const x of A) { const c = cnt.get(x); if (c) { cnt.set(x, c - 1); same++; } else diff++; }
    const res = { market: a, cut: '2015-01-01', fullTrades: A.length, cutTrades: B.length, same, diff, ok: diff === 0 && A.length === B.length };
    fs.mkdirSync(b, { recursive: true }); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(res)); console.log(JSON.stringify(res)); }
  else if (cmd === 'report') {
    const P = {}, meta = {}; for (const m of MARKETS) { const j = JSON.parse(fs.readFileSync(path.join(a, m + '.json'), 'utf8')); P[m] = j; meta[m] = { trades: j.trades, bars: j.bars }; }
    const G = bar(P, 'before'), N = bar(P, 'after');
    const cuts = fs.readdirSync(a).filter((f) => f.startsWith('cut-')).map((f) => JSON.parse(fs.readFileSync(path.join(a, f), 'utf8')));
    const dom = domCell(G.rows, N.rows);
    const strip = ({ rows, ...rest }) => rest;
    const verdict = G.withN100 < 100 ? 'INCONCLUSIVE' : G.holmConfirmed > 0 ? 'PASS' : 'FAIL';
    const d = dom.pool && dom.pool.trail, dz = G.holmByZone.dom || 0;
    const headline = `Before costs ${G.holmConfirmed} of ${G.tested} cells confirmed on 2010-2019 (${dz} of them dominant zones; ${G.rawConfirmed} raw confirmations against about ${G.expectedByChance} by chance); `
      + `the H1 dominant-zone limit pooled with the trailing exit made ${d.before['2015-19'].mean}R a trade in 2015-2019 (n ${d.before['2015-19'].n}, month t ${d.before['2015-19'].t}) before costs and ${d.after['2015-19'].mean}R after; `
      + `after costs ${N.holmConfirmed} cells confirmed. The tilt is about the dominant zone more than the entry, and it does not pay its costs.`;
    const res = { study: 'combo-grid-4', built: '2026-11-23', verdict, headline, basis: 'judged before costs (owner); after costs beside, same bar',
      window: { discovery: '2010-2014', confirmation: '2015-2019' }, rules: NRULE, markets: MARKETS, meta, cuts, before: strip(G), after: strip(N), domCell: dom };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1));
    console.log(JSON.stringify({ verdict, before: { ...strip(G), confirmedList: undefined, rawList: undefined }, after: { tested: N.tested, discovery: N.discovery, raw: N.rawConfirmed, holm: N.holmConfirmed, chance: N.expectedByChance }, cuts }, null, 1));
  } else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
