// Edge-decay monitor: entry price, initial risk and exit time of every position of the research rebuilds (11 Nov 2026), so the
// baselines can carry overnight financing. Paper research only: nothing live changes.
//
//   ROB_DATA=<dir with research/candles/xau-histdata and mosha-events.json> node research/edge/decay-monitor/positions.mjs
//
// The rebuild records (research/edge/robustness/out/*.json) hold t, R, gross and side only. The rule file that makes them
// (research/edge/robustness/systems.mjs) is NOT edited: its bytes are part of the Academy's version of the momentum pullback
// edge. This script loads that file's own functions as they are (the text above its "main" part, with the shared simTrade wrapped
// so each call's entry, risk and exit candle are noted), runs each system with the parameters of its main part, and REFUSES to
// write unless every position it gets equals the committed record (same count, same t, same R to 1e-12). So nothing here can
// drift from the rebuild: it only adds the three fields the record does not print.
//
// Writes positions.json next to this file: per record, rows [t, o, c, e, r0, side] in the record's order
//   t  the record's own time    o  entry time    c  exit time (Gold trend: the start of the exit day)    e  entry price    r0  initial risk
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HERE = path.dirname(new URL(import.meta.url).pathname), ROB = path.resolve(HERE, '../robustness');
const src = fs.readFileSync(path.join(ROB, 'systems.mjs'), 'utf8'), cut = src.indexOf('// ════════ main');
const IMP = "import { loadM1, aggregate, simTrade, stats, rng, yearOf, nyParts, DATA, deflatedSharpe } from './lib.mjs';";
if (cut < 0 || !src.includes(IMP)) throw new Error('research/edge/robustness/systems.mjs changed shape: positions.mjs must be re-checked against it');
const LOG = globalThis.__robSimLog = [];
const body = src.slice(0, cut).replace(IMP, IMP.replace('simTrade,', 'simTrade as simTrade0,')
  + '\nconst simTrade = (A, s) => { const r = simTrade0(A, s); globalThis.__robSimLog.push({ t: A.t[s.i], e: s.px != null ? s.px : A.o[s.i], r0: s.r0, c: A.t[Math.min(r.exitI, A.n - 1)], R: r.R }); return r; };')
  + '\nexport { goldTrend, goldEngulf, goldTrendline, goldMP, moshaBO, atrN, loadM1, aggregate, DATA };\n';
const tmp = path.join(ROB, `.positions-${process.pid}.mjs`);
fs.writeFileSync(tmp, body);
let M; try { M = await import(pathToFileURL(tmp).href); } finally { fs.unlinkSync(tmp); }

const out = (f) => JSON.parse(fs.readFileSync(path.join(ROB, 'out', `${f}.json`), 'utf8'));
// the committed record and this run must be the same positions
function same(name, got, want) {
  if (got.length !== want.length) throw new Error(`${name}: ${got.length} positions here, ${want.length} in the record`);
  got.forEach((x, i) => { if (x.t !== want[i].t || Math.abs(x.R - want[i].R) > 1e-12 || x.side !== want[i].side) throw new Error(`${name}: position ${i} differs from the record`); });
}
// a system that exits through simTrade: the wrapped call of each position, matched by entry time and result
function viaSim(name, run, want) {
  LOG.length = 0; const got = run(); same(name, got, want);
  return got.map((x) => { const k = LOG.findIndex((l) => l.t === x.t && l.R === x.R); if (k < 0) throw new Error(`${name}: no simulated exit for the position of ${x.t}`);
    const l = LOG.splice(k, 1)[0]; return [x.t, x.t, l.c, +l.e.toFixed(3), +l.r0.toFixed(4), x.side]; });
}

const A = M.loadM1('xau-histdata'), D = M.aggregate(A, 86400, 'ny17'), res = {};
// Gold trend: entry at the next daily open, stop 2 ATR(14); the record's `days` gives the exit day
for (const [name, p] of [['gtrend20', { n: 20, k: 2, add: 1 }], ['gtrend5', { n: 5, k: 2, add: 1 }]]) {
  const got = M.goldTrend(D, p), want = out('gtrend').trades[name]; same(name, got, want);
  res[name] = got.map((x) => { const i = D.findIndex((b) => b.time === x.t); if (i < 0 || !D[i + 1] || !D[i + x.days]) throw new Error(`${name}: no daily candle for ${x.t}`);
    return [x.t, D[i + 1].time, D[i + x.days].time, +D[i + 1].open.toFixed(3), +(p.k * M.atrN(D, i, 14)).toFixed(4), x.side]; });
}
res.geg = viaSim('geg', () => M.goldEngulf(A, D, { k: 3, life: 20, hold: 240, sma: 20, pad: 0.3, maxOpen: 3 }), out('geg').trades);
{ const H = M.aggregate(A, 14400, 'ny17'), want = out('gtl').trades;
  res.gtl = viaSim('gtl', () => M.goldTrendline(A, H, D, { n: 3, span: 120, n4: 2, pad: 0.3, hold: 96 }), want);
  res.gtl.forEach((r, i) => { if (Math.abs(r[4] - want[i].r0) > 1e-3) throw new Error('gtl: risk differs from the record'); }); }
{ const H = M.aggregate(A, 3600), M5 = M.aggregate(A, 300);
  res.gmp = viaSim('gmp', () => M.goldMP(A, H, M5, D, { mult: 1.5, top: 0.8, z1: 0.382, z2: 0.618, wait: 6, k: 2, cost: 0.15 }), out('gmp').trades); }
{ const cf = path.join(M.DATA, 'mosha-events.json');
  if (!fs.existsSync(cf)) throw new Error('mosha: no event cache; run research/edge/robustness/systems.mjs mosha with the same ROB_DATA first (slow)');
  const EV = JSON.parse(fs.readFileSync(cf)), H1 = M.aggregate(A, 3600), Dd = M.aggregate(A, 86400), wk = [];
  for (const b of Dd) { const k = Math.floor((b.time - 345600) / 604800) * 604800 + 345600, c = wk.at(-1); if (!c || c.time !== k) wk.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close }); else { c.high = Math.max(c.high, b.high); c.low = Math.min(c.low, b.low); c.close = b.close; } }
  res.mosha = viaSim('mosha', () => M.moshaBO(A, EV.E1, EV.E2, EV.E3, wk, H1, { weekly: true, slow: 12, be: 1.5, add: 1.5, run: true }), out('mosha').trades); }

fs.writeFileSync(path.join(HERE, 'positions.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), method: 'research/edge/decay-monitor/positions.mjs',
  note: 'entry time, exit time, entry price and initial risk of every position of research/edge/robustness/out/{gtrend,geg,gtl,gmp,mosha}.json, in the record\'s order; made by running the rebuild\'s own functions and checked position by position against the record',
  cols: ['t', 'o', 'c', 'e', 'r0', 'side'], systems: res }) + '\n');
for (const [k, v] of Object.entries(res)) console.log(k.padEnd(9), v.length, 'positions');
console.log('wrote research/edge/decay-monitor/positions.json');
