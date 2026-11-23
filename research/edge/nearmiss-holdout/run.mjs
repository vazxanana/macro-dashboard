// research/edge/nearmiss-holdout/run.mjs - the best near-miss cells of four of today's grids, each exactly as its grid
// defined it, asked once on data the grids never read (PREREGISTRATION.md, 23 Nov 2026). Research only: reads the edgekit
// candle cache, places nothing. Imports the four grids (never edited), combo-grid-2 / combo-grid-3 and edgekit.
//   node --max-old-space-size=6000 research/edge/nearmiss-holdout/run.mjs market <set> <m> <dir>   all four cells, one market
//   node --max-old-space-size=6000 research/edge/nearmiss-holdout/run.mjs cut <set> <m> <dir>      cut test, one market
//   node research/edge/nearmiss-holdout/run.mjs report <dir>                                         the bar -> result.json
// Sets: gate (each grid's own 2010-19 window: must reproduce the grid's figures), A (five markets 2005-09), B (holdout
// markets 2010-19, costs assumed), C (five markets 2020 to Oct 2026).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import * as S6 from '../grid6-session-range/run.mjs';
import * as MC from '../grid5-mosha-cycle/run.mjs';
import * as SD from '../grid5-sd-eg/run.mjs';
import * as CB from '../grid5-cycle-box/run.mjs';
import { frames, buildZones } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14 } from '../dom-trade-through/run.mjs';
import { loadFns } from '../../../council/mosha-desk.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
const DAY = 86400;
export const CELLS = ['S6', 'MC', 'SD', 'CB'];
export const C_END = Date.UTC(2026, 10, 1) / 1000; // set C ends at the last complete month (fixed at the run's date)
export const SETS = {
  gate: { markets: K.MARKETS, warm: y(2009), from: y(2010), to: y(2020) },
  A: { markets: K.MARKETS, warm: y(2004), from: y(2005), to: y(2010) },
  B: { markets: K.HOLDOUT_MARKETS, warm: y(2009), from: y(2010), to: y(2020), assumedCosts: true },
  C: { markets: K.MARKETS, warm: y(2019), from: y(2020), to: C_END },
};
// each grid's own figures for its cell on 2010-14 / 2015-19 (the gate); SD's best was EUR/USD alone
export const GATE = {
  S6: { scope: 'pool', n1: 253, m1: 0.1571, n2: 265, m2: 0.2254 },
  MC: { scope: 'pool', n1: 162, m1: 0.2189, n2: 131, m2: 0.1971 },
  SD: { scope: 'eurusd', n1: 310, m1: 0.3495, n2: 288, m2: 0.1781 },
  CB: { scope: 'pool', n1: 3345, m1: 0.0594, n2: 3234, m2: 0.0189 },
};
const inBad = (X, t) => X.some(([a, b]) => t >= a && t <= b);
const stopSide = (s, fill, stop) => { if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side'); };

// ---- S6: grid6-session-range, pool nypm sweep ny key yes call with box outAgainst, no conf, mkt, ext stop, trail ----------
export const S6_CELL = { rg: S6.RANGES.indexOf('nypm'), ev: S6.EVENTS.indexOf('sweep'), win: S6.WINDOWS.indexOf('ny'), conf: S6.CONFS.indexOf('none'),
  call: 0 /* with */, box: 2 /* outAgainst */, ei: 0 /* mkt */, si: 1 /* ext */, x: S6.EXITS.indexOf('trail') };
export function s6Trades(M5, F, market, { from, to }) {
  const cost = COSTS[market], X = exclusions(market), D = F['1d'], AD = atr14(D);
  const Z = S6.ZKINDS.flatMap((k) => buildZones(k, D));
  const sigs = S6.signals(F, { from: from - 3 * DAY, to });
  const out = [], C = S6_CELL;
  for (const sg of sigs) {
    if (sg.rg !== C.rg || sg.ev !== C.ev || sg.win !== C.win || sg.conf !== C.conf || sg.call !== C.call || sg.box !== C.box) continue;
    // the grid's runMarket step, copied for ei 0, si 1
    const d = sg.d, buf = cost / 2, ts = sg.ts; void buf;
    const di = K.closedCount(D, ts) - 1; if (di < 15) continue; const atrD = AD[di];
    if (!S6.touchedToday(M5, Z, d, sg.day, ts)) continue; // key yes
    const stop = sg.ext - d * 0.1 * atrD;
    const tgt = sg.ev === 0 ? sg.edge + d * sg.height : sg.other;
    if (!(d * (sg.c0 - stop) >= 2 * cost)) continue;
    for (let pl = 0; pl < 2; pl++) {
      const s = pl ? -d : d, mir = (x) => (pl ? 2 * sg.c0 - x : x);
      const r = S6.trade(M5, s, 'mkt', null, mir(stop), mir(tgt), ts, cost);
      if (!r || r.t < from || r.t >= to) continue; if (inBad(X, r.t)) continue;
      if (!Number.isFinite(r.R[C.x])) continue;
      out.push({ pl, t: r.t, s, cr: cost / r.risk, R: r.R[C.x] });
    }
  }
  return out;
}

// ---- MC: grid5-mosha-cycle, pooled 4h>1h, cftf same, stage / barrier / back any, CF clear of the VR, MKT-cfz, 2R ------------
export function mcTrades(M5, market, { from, to }, Fn = loadFns()) {
  const F = MC.frames(M5), cost = COSTS[market], bad = exclusions(market);
  const badHit = (a, b) => bad.some(([p, q]) => p <= b && q >= a);
  const atr1h = MC.atr14(F['1h']), cache = {}, out = [], X2 = MC.EXITS.indexOf('2R');
  for (const s of MC.storylines(F, Fn, '4h', '1h', '1h', cache)) {
    if (s.inVR) continue;                                         // clear of the VR
    for (const o of MC.entries(s, F, atr1h, cost)) {
      if (o.es !== 0) continue;                                   // MKT-cfz
      const r = MC.simulate(M5, o, s.d, s.x, MC.CAP['4h']); if (!r) continue;
      if (r.instant || !(r.risk > 0) || !(s.d * (r.fill - o.stop) > 0)) continue;
      if (r.fillT < from || r.fillT >= to) continue;
      if (badHit(r.fillT, r.exitT)) continue;
      stopSide(s.d, r.fill, o.stop);
      out.push({ pl: 0, t: r.fillT, s: s.d, cr: cost / r.risk, R: r.R[X2] });
      const p = MC.placebo(M5, o, s, r);
      if (p && Number.isFinite(p.R[X2])) out.push({ pl: 1, t: r.fillT, s: -s.d, cr: cost / p.risk, R: p.R[X2] });
    }
  }
  return out;
}

// ---- SD: grid5-sd-eg, 4h>15m, visit any, trigger ef, stage pull, mkt, zone stop, trail ---------------------------------------
export function sdTrades(M5, F, market, { from, to }) {
  const out = [], ch = 1, ti = SD.TRIGS.indexOf('ef'), XT = SD.EXITS.indexOf('trail');
  SD.tradesOf(market, M5, F, (x) => {
    if (x.ch !== ch || x.trig !== ti || !x.pull || x.entry !== 0 || x.stop !== 0) return;
    const R = x.R[XT]; if (!Number.isFinite(R)) return;
    out.push({ pl: x.flip, t: x.t, cr: x.cr, R });
  }, { from, to });
  return out;
}

// ---- CB: grid5-cycle-box, pooled 1h>15m, stage move, side none, event false, mkt, ATR stop, 1R -------------------------------
export function cbTrades(M5, F, market, { from, to }) {
  const rows = CB.tradesOf(M5, F, COSTS[market], { from, to, X: exclusions(market) });
  const out = [], X1 = CB.EXITS.indexOf('1R');
  for (const r of rows) {
    if (r.ch !== 2 || r.sg !== CB.STAGES.indexOf('move') || r.ev !== CB.EVENTS.indexOf('false') || r.e !== 0 || r.st !== CB.STOPS.indexOf('atr')) continue;
    if (r.o) out.push({ pl: 0, t: r.o.t, s: r.d, cr: r.o.cr, R: r.o.R[X1] });
    if (r.p) out.push({ pl: 1, t: r.p.t, s: -r.d, cr: r.p.cr, R: r.p.R[X1] });
  }
  return out;
}

export function allCells(M5, market, win) {
  const F = frames(M5);
  return { S6: s6Trades(M5, F, market, win), MC: mcTrades(M5, market, win), SD: sdTrades(M5, F, market, win), CB: cbTrades(M5, F, market, win) };
}

export function runMarket(set, market, dir) {
  const S = SETS[set]; const M5 = K.load(market, '5m', { from: S.warm, to: S.to });
  if (!M5.length) throw new Error('no candles ' + market);
  const cells = allCells(M5, market, S);
  const meta = { set, market, bars: M5.length, first: new Date(M5[0].t * 1000).toISOString(), last: new Date(M5[M5.length - 1].t * 1000).toISOString(),
    cost: COSTS[market], trades: Object.fromEntries(CELLS.map((c) => [c, cells[c].filter((r) => !r.pl).length])) };
  if (dir) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${set}.${market}.json`), JSON.stringify({ meta, cells })); }
  return { meta, cells };
}

// cut test: every cell trade filled more than 6 days before a cut is the same when the candles stop at the cut
const key = (r) => [r.pl, r.t, r.R.toFixed(6)].join('|');
export function cutTest(set, market, full) {
  const S = SETS[set]; const span = S.to - S.from, out = [];
  for (const f of [0.4, 0.8]) {
    const C = S.from + Math.round(span * f / DAY) * DAY + 13 * 3600 + 37 * 60;
    const M5 = K.load(market, '5m', { from: S.warm, to: C }).filter((b) => b.e <= C);
    const part = allCells(M5, market, { from: S.from, to: C });
    for (const c of CELLS) {
      const lim = C - 6 * DAY;
      const A = new Set(full[c].filter((r) => r.t <= lim).map(key)), B = new Set(part[c].filter((r) => r.t <= lim).map(key));
      let miss = 0, extra = 0; for (const k of A) if (!B.has(k)) miss++; for (const k of B) if (!A.has(k)) extra++;
      out.push({ cell: c, cut: new Date(C * 1000).toISOString().slice(0, 16), trades: A.size, missing: miss, extra });
    }
  }
  return out;
}

// ---- statistics -----------------------------------------------------------------------------------------------------
const monthKey = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function statOf(rows, from, to, net = false) {
  const m0 = monthKey(from), m1 = monthKey(to - 1), NMo = m1 - m0 + 1, ms = new Float64Array(NMo);
  let s = 0, w = 0; for (const r of rows) { const v = r.R - (net ? r.cr : 0); s += v; if (v > 0) w++; ms[monthKey(r.t) - m0] += v; }
  const n = rows.length, mm = ms.reduce((a, b) => a + b, 0) / NMo;
  const sd = Math.sqrt(ms.reduce((a, b) => a + (b - mm) ** 2, 0) / (NMo - 1));
  const t = sd > 0 ? mm / (sd / Math.sqrt(NMo)) : 0;
  const p = K.pFromT(t, NMo - 1); const p1 = p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2;
  return { n, mean: n ? +(s / n).toFixed(4) : null, win: n ? +(w / n).toFixed(3) : null, months: NMo, t: +t.toFixed(2), p1: +p1.toPrecision(3) };
}
const plain = (st, minN) => st.n >= minN && st.mean > 0 && st.t >= 2;

function readSet(dir, name) {
  const S = SETS[name], rows = {}, meta = {}, cut = [];
  for (const c of CELLS) rows[c] = [];
  for (const m of S.markets) {
    const f = path.join(dir, `${name}.${m}.json`); if (!fs.existsSync(f)) continue;
    const j = JSON.parse(fs.readFileSync(f, 'utf8')); meta[m] = j.meta;
    for (const c of CELLS) for (const r of j.cells[c]) rows[c].push({ ...r, m });
    const fc = path.join(dir, `${name}.${m}.cut.json`); if (fs.existsSync(fc)) for (const x of JSON.parse(fs.readFileSync(fc, 'utf8'))) cut.push({ market: m, ...x });
  }
  return { S, rows, meta, cut };
}

export function report(dir) {
  const sets = Object.fromEntries(Object.keys(SETS).map((k) => [k, readSet(dir, k)]));
  // gate: each grid's halves on 2010-14 / 2015-19
  const H = y(2015), gate = {};
  for (const c of CELLS) {
    const g = GATE[c]; let R = sets.gate.rows[c].filter((r) => !r.pl); if (g.scope !== 'pool') R = R.filter((r) => r.m === g.scope);
    const a = R.filter((r) => r.t < H), b = R.filter((r) => r.t >= H), mean = (X) => (X.length ? +(X.reduce((s, r) => s + r.R, 0) / X.length).toFixed(4) : null);
    gate[c] = { scope: g.scope, n1: a.length, m1: mean(a), n2: b.length, m2: mean(b), want: g };
    gate[c].ok = a.length === g.n1 && b.length === g.n2 && Math.abs(mean(a) - g.m1) < 1e-3 && Math.abs(mean(b) - g.m2) < 1e-3;
  }
  const AB = { from: y(2005), to: y(2020) };
  const blk = (R, w) => ({ before: statOf(R, w.from, w.to), after: statOf(R, w.from, w.to, true) });
  const cells = {};
  for (const c of CELLS) {
    const real = (n) => sets[n].rows[c].filter((r) => !r.pl), plac = (n) => sets[n].rows[c].filter((r) => r.pl);
    const ab = [...real('A'), ...real('B')], abP = [...plac('A'), ...plac('B')];
    const per = {}; for (const n of ['A', 'B', 'C']) { const S = sets[n].S;
      per[n] = { ...blk(real(n), S), placebo: statOf(plac(n), S.from, S.to),
        markets: Object.fromEntries(S.markets.map((m) => [m, statOf(real(n).filter((r) => r.m === m), S.from, S.to)])) };
      per[n].plain = plain(per[n].before, 50); }
    cells[c] = { primary: { ...blk(ab, AB), placebo: statOf(abP, AB.from, AB.to) }, sets: per };
    if (c === 'SD') { const eu = (n) => real(n).filter((r) => r.m === 'eurusd');
      cells[c].eurusd = { A: blk(eu('A'), sets.A.S), C: blk(eu('C'), sets.C.S) }; }
  }
  const adj = K.holm(CELLS.map((c) => cells[c].primary.before.p1));
  CELLS.forEach((c, i) => { const P = cells[c].primary; P.holm = +adj[i].toPrecision(3);
    P.pass = gate[c].ok && plain(P.before, 100) && adj[i] < 0.05; P.few = P.before.n < 100; });
  const any = CELLS.some((c) => cells[c].primary.pass), gatesOk = CELLS.every((c) => gate[c].ok), few = CELLS.some((c) => cells[c].primary.few);
  const verdict = any ? 'PASS' : !gatesOk || few ? 'INCONCLUSIVE' : 'FAIL';
  const cut = Object.fromEntries(['A', 'B', 'C'].map((n) => [n, sets[n].cut]));
  const meta = Object.fromEntries(Object.keys(SETS).map((n) => [n, sets[n].meta]));
  return { gate, cells, verdict, cut, meta };
}

const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main) {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const { meta } = runMarket(a, b, c); console.log(JSON.stringify(meta), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') {
    const full = JSON.parse(fs.readFileSync(path.join(c, `${a}.${b}.json`), 'utf8')).cells;
    const r = cutTest(a, b, full); fs.writeFileSync(path.join(c, `${a}.${b}.cut.json`), JSON.stringify(r)); console.log(a, b, JSON.stringify(r));
  } else if (cmd === 'report') {
    const R = report(a); const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
    const one = (k) => { const P = R.cells[k].primary.before; return `${k} ${f(P.mean)}R (n ${P.n}, t ${P.t.toFixed(2)})`; };
    const headline = `${R.verdict}: pooled 2005-09 + holdout markets 2010-19, before costs: ${CELLS.map(one).join('; ')}; ${CELLS.filter((k) => R.cells[k].primary.pass).length} of 4 pass after Holm`;
    const out = { study: 'nearmiss-holdout', built: '2026-11-23', verdict: R.verdict, headline, basis: 'judged before costs (pre-registered); after costs beside',
      cellsDefined: {
        S6: 'grid6-session-range: pool, previous NY-afternoon range, sweep in New York, key level yes, MSNR call with, H1 box out against, no confirmation, market entry, event-extreme stop, trail',
        MC: 'grid5-mosha-cycle: pooled, H4>H1, CF same timeframe, stage/barrier/back any, CF clear of the VR, MKT-cfz, 2R',
        SD: 'grid5-sd-eg: H4 zone > M15 EF, visit any, pullback stage, market entry, zone stop, trail (grid best EUR/USD; tested pooled)',
        CB: 'grid5-cycle-box: pooled, H1>M15, stage move, side none, false box break, market entry, ATR stop, 1R' },
      cutNote: 'One difference in 120 cuts (44,180 trades): an SD trade on eurjpy filled 25 Dec 2017 22:15 UTC whose 5-day time exit falls in the New Year closure, so the first candle after its deadline is after the 1 Jan 2018 cut; it is missing on the cut candles because it had not ended, not because of look-ahead. The 6-day margin of the pre-registration did not cover a holiday closure.',
      ...R };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); console.log(headline);
    console.log(JSON.stringify({ gate: R.gate, primary: Object.fromEntries(CELLS.map((k) => [k, R.cells[k].primary])) }, null, 1));
  } else console.log('usage: run.mjs market <set> <m> <dir> | cut <set> <m> <dir> | report <dir>');
}
