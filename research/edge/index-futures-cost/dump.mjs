// Edge research · index-futures-cost, step 1: per-trade rows of three index studies, from their OWN unchanged code.
// Each study's run.mjs is taken from its branch with `git archive` into a temporary directory OUTSIDE this repository and
// imported from there (nothing of it is copied into this folder); candles come from each study's own fetch code.
//   git archive origin/index-overnight research/edge/index-overnight | tar -x -C <tmp>     (and index-ibs, turn-of-month;
//   also ict/calendar.mjs from main into <tmp>/ict/, which index-ibs and turn-of-month read)
//   node --use-env-proxy <tmp>/research/edge/index-ibs/fetch.mjs <candles>/ibs
//   node --use-env-proxy <tmp>/research/edge/index-overnight/run.mjs fetch <candles>/io
//   <candles>/tom = the ibs files cut to turn-of-month's own window (2007-10-01 to 2026-11-13, its fetch.mjs FROM / END)
//   node research/edge/index-futures-cost/dump.mjs <tmp> <candles>          -> rows.json.gz beside this file
// The placebo draws are rebuilt here with each study's own functions and seeds, and re-costed with run.mjs's futures model;
// only their per-seed sums are stored. Paper research only.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { futCost, unitOf, CONTRACTS } from './run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const gz = (f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
const rates = JSON.parse(fs.readFileSync(path.join(HERE, 'rates.json'), 'utf8'));
const sumOf = (xs) => xs.reduce((a, b) => a + b, 0);

// placebo trade -> { cfd net, futures F1 net } in the study's unit
function both(study, mk, x) { const u = unitOf(study, x); return { cfd: x.cfdNet, fut: x.gross - futCost(x, mk, rates).total / u }; }

async function overnight(tmp, dir) {
  const M = await import(pathToFileURL(path.join(tmp, 'research/edge/index-overnight/run.mjs')).href);
  const dgs2 = JSON.parse(fs.readFileSync(path.join(tmp, 'research/edge/index-overnight/rates.json'))).DGS2;
  const out = { tests: {}, placebo: {} };
  for (const [test, mk] of [['T1', 'spx500'], ['T2', 'nas100']]) {
    const S = M.makeSeries(gz(path.join(dir, `${mk}-30m.json.gz`)));
    const r = M.runMarket(S, dgs2, 'overnight');
    out.tests[test] = { mk, rows: r.trades.map((t) => [t.date, t.t0, t.t1, t.entry, t.stop, t.exit, t.how, t.R, t.net, t.spreadR, t.finR, t.nights]) };
    // the study's own placebo (its `placebo` function, not exported: the same lines, keeping the trades)
    out.placebo[test] = {};
    for (const w of Object.keys(M.WIN)) {
      const n = r.trades.filter((t) => t.date >= M.WIN[w][0] && t.date <= M.WIN[w][1]).length, seeds = [];
      for (let s = 0; s < M.P.SEEDS; s++) {
        const rnd = M.mulberry32(s + 1), dd = M.cashDays(...M.WIN[w]), got = [];
        let guard = 0;
        while (got.length < n && guard++ < n * 50) {
          const d = dd[Math.floor(rnd() * dd.length)], st = Date.parse(d + 'T00:00:00Z') / 1000 + Math.floor(rnd() * 48) * 1800;
          const x = M.windowTrade(S, r.days, st); if (!x) continue;
          const c = M.costTrade(x, dgs2);
          got.push(both('overnight', mk, { gross: c.R, cfdNet: c.net, entry: c.entry, stop: c.stop, days: (c.t1 - c.t0) / 86400, entryD: ymd(c.t0), exitD: ymd(c.t1) }));
        }
        seeds.push({ n: got.length, cfd: sumOf(got.map((g) => g.cfd)), fut: sumOf(got.map((g) => g.fut)) });
      }
      out.placebo[test][w] = seeds;
    }
  }
  return out;
}

async function ibs(tmp, dir) {
  const M = await import(pathToFileURL(path.join(tmp, 'research/edge/index-ibs/run.mjs')).href);
  const { nyParts } = await import(pathToFileURL(path.join(tmp, 'ict/calendar.mjs')).href);
  const R = JSON.parse(fs.readFileSync(path.join(tmp, 'research/edge/index-ibs/rates.json'), 'utf8'));
  const B = {}; for (const k of Object.keys(M.MARKETS)) B[k] = gz(path.join(dir, `${k}-1h.json.gz`));
  const keys = Object.keys(M.MARKETS);
  const first = keys.map((k) => nyParts(B[k][0][0]).ymd).sort().at(-1), last = keys.map((k) => nyParts(B[k].at(-1)[0]).ymd).sort()[0];
  const days = M.tradingDays(first, last), rate = M.rateOf(R.DGS2, R.before2006), lastDay = days.at(-1);
  const yr = (d) => +d.slice(0, 4);
  const out = { lastDay, tests: {}, placebo: {} };
  for (const k of keys) {
    const L = M.marketRun(k, B[k], days, rate, 1, lastDay);
    out.tests[M.MARKETS[k].test] = { mk: k, rows: L.trades.map((t) => [t.entryD, t.exitD, t.entry, t.stop, t.exit, t.how, t.grossR, t.R, t.costR, t.finR, t.nights]) };
    // the placebo pool and draws exactly as marketRun builds them, keeping the trades
    const opt = { cost: M.MARKETS[k].cost, rate, side: 1 }, D = L.D, entries = new Set();
    for (let e = 0; e + 1 < D.length; e++) { if (yr(D[e].d) < M.FIRST) continue; if (D[e].ibs != null && D[e].ibs < M.LO) entries.add(e); }
    const pool = new Map();
    for (let e = 0; e + 1 < D.length; e++) {
      if (yr(D[e].d) < M.SPLIT || entries.has(e)) continue;
      const t = M.trade(B[k], D, e, e + 1, opt);
      if (t) { if (!pool.has(yr(t.entryD))) pool.set(yr(t.entryD), []); pool.get(yr(t.entryD)).push(t); }
    }
    const counts = new Map(); for (const t of L.dec) counts.set(yr(t.entryD), (counts.get(yr(t.entryD)) || 0) + 1);
    const seeds = [];
    for (let s = 1; s <= M.SEEDS; s++) {
      const Rn = M.rng(s), got = [];
      for (const [y, n] of [...counts].sort((a, b) => a[0] - b[0])) { const P = pool.get(y) || []; for (let j = 0; j < n && P.length; j++) got.push(P[Math.floor(Rn() * P.length)]); }
      const bb = got.map((t) => both('ibs', k, { gross: t.grossR, cfdNet: t.R, entry: t.entry, stop: t.stop, entryD: t.entryD, exitD: t.exitD }));
      seeds.push({ n: got.length, cfd: sumOf(bb.map((g) => g.cfd)), fut: sumOf(bb.map((g) => g.fut)), check: sumOf(L.draws[s - 1]) });
    }
    out.placebo[M.MARKETS[k].test] = seeds;
  }
  return out;
}

async function tom(tmp, dir) {
  const M = await import(pathToFileURL(path.join(tmp, 'research/edge/turn-of-month/run.mjs')).href);
  const { nyParts } = await import(pathToFileURL(path.join(tmp, 'ict/calendar.mjs')).href);
  const dgs2 = JSON.parse(fs.readFileSync(path.join(tmp, 'research/edge/turn-of-month/rates.json'), 'utf8')).DGS2;
  const yr = (d) => +d.slice(0, 4);
  const out = { tests: {}, placebo: {} };
  for (const k of Object.keys(M.MARKETS)) {
    const bars = gz(path.join(dir, `${k}-1h.json.gz`));
    // runMarket's own first lines
    const first = nyParts(bars[0][0]).ymd, lst = nyParts(bars.at(-1)[0]).ymd;
    const days = M.tradingDays(first, lst), L = M.labels(M.tradingDays(first.slice(0, 7) + '-01', lst.slice(0, 8) + '31'));
    const D = M.buildDays(bars, days), opt = { cost: M.MARKETS[k].cost, rate: M.rateOf(dgs2) };
    const { trades } = M.ruleTrades(bars, D, L, opt);
    out.tests[k] = { mk: k, rows: trades.filter((t) => yr(t.entryD) >= M.FIRST).map((t) => [t.entryD, t.exitD, t.entry, t.stop, t.exit, t.how, t.gross, t.net, t.fin]) };
    // its placebo (exported one returns nets only: the same lines, keeping the trades)
    const OOS = trades.filter((t) => yr(t.entryD) >= M.SPLIT), counts = new Map(); for (const t of OOS) counts.set(yr(t.entryD), (counts.get(yr(t.entryD)) || 0) + 1);
    const D2 = D.filter((x) => yr(x.d) >= M.SPLIT - 1), seeds = [];
    for (let s = 1; s <= M.SEEDS; s++) {
      const Rr = M.rng(s), byYear = new Map(), got = [];
      D2.forEach((x, kk) => { if (kk + M.HOLD < D2.length) { const y = yr(x.d); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(kk); } });
      for (const [y, n] of counts) {
        const K = byYear.get(y) || []; let g = 0, tries = 0;
        while (g < n && tries < n * 50) { tries++; const kk = K[Math.floor(Rr() * K.length)]; const t = M.trade(bars, D2, kk, kk + M.HOLD, opt); if (t) { got.push(t); g++; } }
      }
      const bb = got.map((t) => both('tom', k, { gross: t.gross, cfdNet: t.net, entry: t.entry, stop: t.stop, entryD: t.entryD, exitD: t.exitD }));
      seeds.push({ n: got.length, cfd: sumOf(bb.map((g) => g.cfd)), fut: sumOf(bb.map((g) => g.fut)) });
    }
    out.placebo[k] = seeds;
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [tmp, cdir] = process.argv.slice(2);
  if (!tmp || !cdir) throw new Error('usage: node dump.mjs <tmp checkout of the three branches> <candle dir with io/ ibs/ tom/>');
  const out = { note: 'Per-trade rows of index-overnight, index-ibs and turn-of-month, from their own unchanged run.mjs (see dump.mjs). Placebo: per seed n and the sums of CFD net and futures F1 net.',
    contracts: CONTRACTS,
    cols: { overnight: ['date', 't0', 't1', 'entry', 'stop', 'exit', 'how', 'grossR', 'cfdNetR', 'spreadR', 'finR', 'nights'],
      ibs: ['entryD', 'exitD', 'entry', 'stop', 'exit', 'how', 'grossR', 'cfdNetR', 'costR', 'finR', 'nights'],
      tom: ['entryD', 'exitD', 'entry', 'stop', 'exit', 'how', 'grossPct', 'cfdNetPct', 'finPct'] },
    overnight: await overnight(tmp, path.join(cdir, 'io')), ibs: await ibs(tmp, path.join(cdir, 'ibs')), tom: await tom(tmp, path.join(cdir, 'tom')) };
  // numbers kept to 10 significant digits (far below every figure's published rounding)
  const q = (k, x) => (typeof x === 'number' && !Number.isInteger(x) ? +x.toPrecision(10) : x);
  fs.writeFileSync(path.join(HERE, 'rows.json.gz'), zlib.gzipSync(JSON.stringify(out, q), { level: 9 }));
  console.log('rows.json.gz', fs.statSync(path.join(HERE, 'rows.json.gz')).size);
}
