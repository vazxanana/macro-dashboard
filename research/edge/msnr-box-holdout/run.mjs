// research/edge/msnr-box-holdout/run.mjs - the one rule grid 5 confirmed, asked once on data the grid never read
// (PREREGISTRATION.md, 23 Nov 2026). Research only: reads the edgekit candle cache, places nothing.
//   node --max-old-space-size=6000 research/edge/msnr-box-holdout/run.mjs market <set> <m> <dir>   one market of a set -> <dir>/<set>.<m>.json
//   node research/edge/msnr-box-holdout/run.mjs cut <set> <m> <dir>                                cut test -> <dir>/<set>.<m>.cut.json
//   node research/edge/msnr-box-holdout/run.mjs report <dir>                                        the bar -> result.json
// Sets: gate (the grid's own 2010-19 window, must reproduce the grid's figures), A (five markets 2005-09), B (holdout markets
// 2010-19, costs assumed), C (five markets 2020 on). Imports grid5-msnr-box (signals, trade, constants), combo-grid-3, combo-grid-2,
// dom-trade-through and edgekit; none edited.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import * as G from '../grid5-msnr-box/run.mjs';
import { frames, buildZones, exclusions } from '../combo-grid-3/run.mjs';
import { COSTS } from '../combo-grid-2/run.mjs';
import { atr14 } from '../dom-trade-through/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
// the cell (grid5 indices): key eg, tf 1h, box out, trigger sb, New York hours, market entry, box stop; any call
export const CELL = { key: G.KEYS.indexOf('eg'), tf: G.TFS.indexOf('1h'), mode: G.MODES.indexOf('out'), trig: G.TRIGS.indexOf('sb'), tod: G.TODS.indexOf('ny') };
const X1R = G.EXITS.indexOf('1R'), XTR = G.EXITS.indexOf('trail');
// last complete month in the cache (set C's end): fixed at the run's date, 23 Nov 2026
export const C_END = Date.UTC(2026, 10, 1) / 1000;
export const SETS = {
  gate: { markets: G.MARKETS, warm: y(2009), from: y(2010), to: y(2020) },
  A: { markets: K.MARKETS, warm: y(2004), from: y(2005), to: y(2010) },
  B: { markets: K.HOLDOUT_MARKETS, warm: y(2009), from: y(2010), to: y(2020), assumedCosts: true },
  C: { markets: K.MARKETS, warm: y(2019), from: y(2020), to: C_END },
};
export const isCell = (s) => s.key === CELL.key && s.tf === CELL.tf && s.mode === CELL.mode && s.trig === CELL.trig && s.tod === CELL.tod;

// the grid's per-signal step for this one cell (grid5-msnr-box runMarket, copied line for line for ei 0 = mkt, si 0 = box stop)
export function cellTrades(M5, F, sigs, Z, cost, X, { from, to }) {
  const D = F['1d'], AD = atr14(D);
  const inBad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const all = G.KEYS.flatMap((k) => Z[k]).sort((a, b) => a.at - b.at);
  const near = (list, s, ref) => { let best = null; for (const e of list) if (s * (e - ref) > 0 && (best == null || s * (best - e) > 0)) best = e; return best; };
  const out = [];
  for (const sg of sigs) {
    if (!isCell(sg)) continue;
    const d = sg.d, buf = cost / 2, ts = sg.ts, exp = ts + G.LIFE_CANDLES * 3600;
    const di = K.closedCount(D, ts) - 1; if (di < 15) continue; void AD[di];
    const edges = { 1: [], '-1': [] }; for (const o of all) { if (o.at > ts) break; if (o.end <= ts) continue; edges[-o.d].push(-o.d > 0 ? o.bot : o.top); }
    const stop = d > 0 ? sg.box.lo - buf : sg.box.hi + buf;          // mode out, box stop
    if (!(d * (sg.c0 - stop) >= 2 * cost)) continue;
    for (let pl = 0; pl < 2; pl++) {
      const s = pl ? -d : d, sp = pl ? 2 * sg.c0 - stop : stop, rf = sg.c0;
      const opp = near(edges[s], s, rf); let oppR = opp == null ? 2 : (s * (opp - rf)) / (s * (rf - sp)); if (!(oppR >= 1)) oppR = 2;
      const r = G.trade(M5, s, 'mkt', null, sp, ts, exp, oppR, cost);
      if (!r || r.t < from || r.t >= to) continue;
      if (inBad(r.t)) continue;
      out.push({ pl, t: r.t, ts, s, call: sg.call, risk: r.risk, cr: cost / r.risk, r1: r.R[X1R], tr: r.R[XTR] });
    }
  }
  return out;
}

export function runMarket(set, market, dir) {
  const S = SETS[set]; const M5 = K.load(market, '5m', { from: S.warm, to: S.to });
  if (!M5.length) throw new Error('no candles ' + market);
  const F = frames(M5); const { sigs, Z } = G.signals(F, { from: S.from, to: S.to });
  const tr = cellTrades(M5, F, sigs, Z, COSTS[market], exclusions(market), S);
  const meta = { set, market, bars: M5.length, first: new Date(M5[0].t * 1000).toISOString(), last: new Date(M5[M5.length - 1].t * 1000).toISOString(),
    cellSignals: sigs.filter(isCell).length, trades: tr.filter((x) => !x.pl).length, placebo: tr.filter((x) => x.pl).length, cost: COSTS[market] };
  if (dir) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${set}.${market}.json`), JSON.stringify({ meta, trades: tr })); }
  return { meta, trades: tr };
}

// cut test: the cell's signals before a cut are the same when the candles stop at the cut
const sigKey = (s) => [s.d, s.ts, s.box.hi, s.box.lo, s.z.bot, s.z.top, s.c0].join('|');
export function cutTest(set, market) {
  const S = SETS[set]; const M5 = K.load(market, '5m', { from: S.warm, to: S.to });
  const full = G.signals(frames(M5), { from: S.from, to: S.to }).sigs.filter(isCell);
  const span = S.to - S.from, out = [];
  for (const f of [0.2, 0.45, 0.7, 0.9]) {
    const C = S.from + Math.round(span * f / 86400) * 86400 + 13 * 3600 + 37 * 60;
    const part = G.signals(frames(M5.filter((b) => b.e <= C)), { from: S.from, to: C }).sigs.filter(isCell);
    const A = new Set(full.filter((s) => s.ts <= C).map(sigKey)), B = new Set(part.filter((s) => s.ts <= C).map(sigKey));
    let miss = 0, extra = 0; for (const k of A) if (!B.has(k)) miss++; for (const k of B) if (!A.has(k)) extra++;
    out.push({ cut: new Date(C * 1000).toISOString().slice(0, 16), signals: A.size, missing: miss, extra });
  }
  return out;
}

// ---- statistics -----------------------------------------------------------------------------------------------------
const monthKey = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function statOf(rows, from, to, field, net = false) {
  const m0 = monthKey(from), m1 = monthKey(to - 1), NMo = m1 - m0 + 1, ms = new Float64Array(NMo);
  let s = 0, w = 0; for (const r of rows) { const v = r[field] - (net ? r.cr : 0); s += v; if (v > 0) w++; ms[monthKey(r.t) - m0] += v; }
  const n = rows.length, mm = ms.reduce((a, b) => a + b, 0) / NMo;
  const sd = Math.sqrt(ms.reduce((a, b) => a + (b - mm) ** 2, 0) / (NMo - 1));
  const t = sd > 0 ? mm / (sd / Math.sqrt(NMo)) : 0;
  const p = K.pFromT(t, NMo - 1); const p1 = p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2;
  return { n, mean: n ? +(s / n).toFixed(4) : null, win: n ? +(w / n).toFixed(3) : null, months: NMo, t: +t.toFixed(2), p1: +p1.toPrecision(3) };
}
const passes = (st) => st.n >= 50 && st.mean > 0 && st.t >= 2;

export function report(dir) {
  const sets = {};
  for (const [name, S] of Object.entries(SETS)) {
    const rows = [], meta = {};
    for (const m of S.markets) { const f = path.join(dir, `${name}.${m}.json`); if (!fs.existsSync(f)) continue;
      const j = JSON.parse(fs.readFileSync(f, 'utf8')); meta[m] = j.meta; for (const r of j.trades) rows.push({ ...r, m }); }
    const real = rows.filter((r) => !r.pl), pl = rows.filter((r) => r.pl);
    const blk = (R) => ({ r1: statOf(R, S.from, S.to, 'r1'), r1Net: statOf(R, S.from, S.to, 'r1', true), trail: statOf(R, S.from, S.to, 'tr'), trailNet: statOf(R, S.from, S.to, 'tr', true) });
    const per = {}; for (const m of S.markets) { const R = real.filter((r) => r.m === m); per[m] = { n: R.length, r1: statOf(R, S.from, S.to, 'r1'), trail: statOf(R, S.from, S.to, 'tr') }; }
    const byCall = {}; for (const [k, c] of [['with', 0], ['against', 1]]) byCall[k] = statOf(real.filter((r) => r.call === c), S.from, S.to, 'r1');
    const cut = S.markets.flatMap((m) => { const f = path.join(dir, `${name}.${m}.cut.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).map((c) => ({ market: m, ...c })) : []; });
    sets[name] = { markets: S.markets, from: new Date(S.from * 1000).toISOString().slice(0, 10), to: new Date(S.to * 1000).toISOString().slice(0, 10),
      assumedCosts: !!S.assumedCosts, real: blk(real), placebo: blk(pl), perMarket: per, byCall, meta, cut };
  }
  const g = sets.gate.real.r1; // the grid's figures: 2010-14 n 297 +0.1406, 2015-19 n 317 +0.2330
  const gReal = sets.gate.real; const gRows = []; for (const m of G.MARKETS) { const f = path.join(dir, `gate.${m}.json`); if (fs.existsSync(f)) for (const r of JSON.parse(fs.readFileSync(f, 'utf8')).trades) if (!r.pl) gRows.push(r); }
  const H = y(2015), a = gRows.filter((r) => r.t < H), b = gRows.filter((r) => r.t >= H);
  const mean = (R) => +(R.reduce((s, r) => s + r.r1, 0) / R.length).toFixed(4);
  const gate = { n1014: a.length, mean1014: mean(a), n1519: b.length, mean1519: mean(b), want: { n1014: 297, mean1014: 0.1406, n1519: 317, mean1519: 0.233 } };
  gate.ok = gate.n1014 === 297 && gate.n1519 === 317 && Math.abs(gate.mean1014 - 0.1406) < 1e-3 && Math.abs(gate.mean1519 - 0.233) < 1e-3;
  void g; void gReal;
  const adj = K.holm([sets.A.real.r1.p1, sets.B.real.r1.p1]);
  const passA = passes(sets.A.real.r1) && adj[0] < 0.05, passB = passes(sets.B.real.r1) && adj[1] < 0.05, passC = passes(sets.C.real.r1);
  const few = sets.A.real.r1.n < 50 || sets.B.real.r1.n < 50;
  const verdict = !gate.ok ? 'INCONCLUSIVE' : passA && passB ? 'PASS' : few || passA || passB ? 'INCONCLUSIVE' : 'FAIL';
  return { gate, holm: { A: +adj[0].toPrecision(3), B: +adj[1].toPrecision(3) }, pass: { A: passA, B: passB, C: passC }, verdict, sets };
}

const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main) {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const { meta } = runMarket(a, b, c); console.log(JSON.stringify(meta), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { const r = cutTest(a, b); fs.mkdirSync(c, { recursive: true }); fs.writeFileSync(path.join(c, `${a}.${b}.cut.json`), JSON.stringify(r)); console.log(a, b, JSON.stringify(r)); }
  else if (cmd === 'report') {
    const R = report(a); const A = R.sets.A.real.r1, B = R.sets.B.real.r1, C = R.sets.C.real.r1;
    const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
    const headline = `${R.verdict}: 1R exit before costs, set A (five markets 2005-09) ${f(A.mean)}R a trade (n ${A.n}, month t ${A.t.toFixed(2)}), set B (holdout markets 2010-19) ${f(B.mean)}R (n ${B.n}, t ${B.t.toFixed(2)}); 2020 on ${f(C.mean)}R (n ${C.n}, t ${C.t.toFixed(2)}), ${R.pass.C ? 'repeated' : 'not repeated'}`;
    const out = { study: 'msnr-box-holdout', built: '2026-11-23', verdict: R.verdict, headline, basis: 'judged before costs (pre-registered); after costs beside',
      rule: 'Daily engulf zone touched, H1 box (2 a side) closes out with the side, H1 structure break within 6 candles, trigger close 12-17 UTC, market entry, stop past the box; exit 1R (primary), trail (secondary)',
      ...R };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); console.log(headline); console.log(JSON.stringify({ gate: R.gate, holm: R.holm, pass: R.pass }));
  } else console.log('usage: run.mjs market <set> <m> <dir> | cut <set> <m> <dir> | report <dir>');
}
