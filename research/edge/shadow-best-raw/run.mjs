// Edge research · shadow-best-raw: shadow-best's 32 cells, its rule and its placebo, with ONE change: every trade re-costed on the
// measured raw-spread costs of the demo (council/fills.mjs costModel + tradeCost, imported unchanged, on the broker file rebuilt
// from tests/fixtures/ctrader/symbols-raw-12nov.json). Also judged at 2x that cost. See PREREGISTRATION.md.
// Usage:
//   node research/edge/shadow-best-raw/run.mjs fetch <candleDir>                  hands over to shadow-best (git, no network)
//   node research/edge/shadow-best-raw/run.mjs market <key> <candleDir> <outDir>  hands over to shadow-best (the replay, unchanged)
//   node research/edge/shadow-best-raw/run.mjs report <outDir>                    re-costs <outDir>/raw/*.json → result.json here
// Neither research/edge/shadow-best/run.mjs nor research/edge/shadow-scalp-filters/run.mjs is edited.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { costModel, tradeCost } from '../../../council/fills.mjs';
import { spreadFields, commissionRT } from '../../../council/ctrader-symbols.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '../../..');
const BEST = path.join(HERE, '../shadow-best/run.mjs');
// shadow-best (and the replay it imports) run their own command line on import: hide ours first, so importing them can never
// replay anything or rewrite their result.json.
const ARGV = process.argv.slice(2);
process.argv.length = Math.min(process.argv.length, 2);
const B = await import('../shadow-best/run.mjs');
const S = await import('../shadow-scalp-filters/run.mjs');
export const { CELLS, RULE, PLACEBO_N, cellId, windowOf, cellTable, placebo, IS_MONTHS, OOS_MONTHS } = B;
export const { MARKETS, COLS } = S;

export const FIXTURE = path.join(ROOT, 'tests/fixtures/ctrader/symbols-raw-12nov.json');
// market -> broker symbol names (the subset of council/ctrader-mirror.mjs SYMBOLS for the ten markets; a test compares them)
export const BROKER = { xau: ['XAUUSD'], eurusd: ['EURUSD'], gbpusd: ['GBPUSD'], audusd: ['AUDUSD'], usdcad: ['USDCAD'], usdchf: ['USDCHF'],
  btc: ['BTCUSD'], eth: ['ETHUSD'], sol: ['SOLUSD'], xrp: ['XRPUSD'] };
export const MULTS = { x1: 1, x2: 2 };
const r3 = (v) => v == null || !Number.isFinite(v) ? null : +v.toFixed(3);
const r4 = (v) => v == null || !Number.isFinite(v) ? null : +v.toFixed(4);

// ─── the broker file as the new writer keeps it (tests/forex-spread.test.mjs `rebuilt`): every read of 8-12 Nov through
// spreadFields, the commission record through commissionRT ───
export function brokerFile(raw = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'))) {
  const f = JSON.parse(JSON.stringify({ at: raw.at, account: raw.account, symbols: raw.symbols }));
  for (const [n, e] of Object.entries(f.symbols)) {
    let before = {};
    for (const [sec, bid, ask] of raw.reads[n] || []) before = { ...before, ...spreadFields({ bid, ask, ts: sec * 1000 }, true, before, sec) };
    Object.assign(e, before, { commissionRT: commissionRT({ commissionType: e.commission.type, preciseTradingCommissionRate: e.commission.preciseRate }) });
  }
  return f;
}
// the cost inputs per market (no mirror fills: the replay has none). Crypto has no broker record → the default, as before.
export function model(file = brokerFile()) {
  return costModel(Object.fromEntries(Object.entries(MARKETS).map(([k, m]) => [k, m.M])), { symbols: BROKER, brokerInfo: file });
}

// ─── one raw replay row (shadow-scalp-filters COLS) → the trade tradeCost reads ───
export function tradeOf(key, cols, r) {
  const x = Object.fromEntries(cols.map((c, i) => [c, r[i]]));
  return { x, t: { market: key, side: x.side, entry: x.entry, r0: x.r0, entryMode: x.mode, exitKind: x.exit, opened: x.opened, filled: x.filled, closed: x.closed } };
}
// new cost (R a unit) of one raw row; old = the cost stamped by the replay (tradeCost with no broker record)
export function recost(key, cols, r, mm) {
  const { x, t } = tradeOf(key, cols, r), M = MARKETS[key].M;
  const c = tradeCost(t, M, mm[key]), d = tradeCost(t, M);
  return { m: key, k: x.k, opened: x.opened, side: x.side, gross: x.R, oldCost: x.costR, oldCheck: d.costR, cost: c.costR };
}
export const asRows = (rc, mult) => rc.map((y) => ({ m: y.m, k: y.k, opened: y.opened, side: y.side, gross: y.gross, net: +(y.gross - mult * y.cost).toFixed(4) }));
export const oldRows = (rc) => rc.map((y) => ({ m: y.m, k: y.k, opened: y.opened, side: y.side, gross: y.gross, net: +(y.gross - y.oldCost).toFixed(4) }));

export function evaluate(rc, runs = PLACEBO_N) {
  const out = {};
  for (const [name, mult] of Object.entries(MULTS)) {
    const rows = asRows(rc, mult), table = cellTable(rows), pl = placebo(rows, table, runs);
    const keep = table.filter((c) => c.keep).map((c) => ({ setup: c.k, market: c.m }));
    out[name] = { mult, keep, verdict: keep.length ? `PASS for ${keep.length} of ${table.length} cells` : `FAIL, 0 of ${table.length} cells`,
      bothWindowsPositive: table.filter((c) => c.checks.isPos && c.checks.oosPos).map(cellId),
      placebo: { runs: pl.runs, totalKeeps: pl.totalKeeps, partitionsWithKeep: pl.partitionsWithKeep, maxT: pl.maxT, meanBothPositive: pl.meanBothPositive },
      cells: table };
  }
  out.old = cellTable(oldRows(rc));
  return out;
}
// cost a trade per market and window: shadow-best's (old) vs the measured model (new)
export function costTable(rc) {
  const out = {};
  for (const m of Object.keys(MARKETS)) {
    const a = rc.filter((y) => y.m === m);
    out[m] = { n: a.length, oldPerTrade: r4(a.reduce((s, y) => s + y.oldCost, 0) / a.length), newPerTrade: r4(a.reduce((s, y) => s + y.cost, 0) / a.length) };
  }
  return out;
}

export function loadRaw(odir) {
  const dir = path.join(odir, 'raw'), rc = [], meta = {};
  for (const key of Object.keys(MARKETS)) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, `${key}.json`), 'utf8'));
    meta[key] = { base: j.base, trades: j.rows.length, openAtEnd: j.openAtEnd };
    rc.push({ key, cols: j.cols, rows: j.rows });
  }
  return { meta, raws: rc };
}

function report(odir) {
  const { meta, raws } = loadRaw(odir), file = brokerFile(), mm = model(file);
  const rc = raws.flatMap(({ key, cols, rows }) => rows.map((r) => recost(key, cols, r, mm)));
  // gate: the replay's stamped cost is tradeCost with no broker record (4 decimals), and the old table is shadow-best's own
  const worst = rc.reduce((w, y) => Math.max(w, Math.abs(y.oldCheck - y.oldCost)), 0);
  if (worst > 6e-5) throw new Error(`stamped cost differs from tradeCost by ${worst}`);
  const ev = evaluate(rc);
  const best = JSON.parse(fs.readFileSync(path.join(HERE, '../shadow-best/result.json'), 'utf8'));
  const sameOld = best.cells.every((c) => { const o = ev.old.find((x) => x.k === c.k && x.m === c.m); return o && o.IS.n === c.IS.n && o.OOS.n === c.OOS.n && o.IS.net === c.IS.net && o.OOS.net === c.OOS.net && o.OOS.t === c.OOS.t; });
  if (!sameOld || rc.length !== best.trades) throw new Error('the re-read trades do not reproduce shadow-best');
  const mmOut = Object.fromEntries(Object.entries(mm).map(([k, v]) => [k, { spread: v.spread, quotes: v.quotes, commissionRT: v.commissionRT, src: v.src }]));
  const x1 = ev.x1, x2 = ev.x2;
  const verdict = x1.keep.length
    ? `PASS for ${x1.keep.length} of 32 cells at the measured costs (${x2.keep.length} at 2x): proposal written`
    : `FAIL, 0 of 32 cells at the measured costs (${x2.keep.length} of 32 at 2x): the cut was not decided on wrong costs`;
  const res = { study: 'shadow-best-raw', title: 'The shadow cut on the measured raw-spread costs', built: new Date().toISOString().slice(0, 10),
    preregistration: 'research/edge/shadow-best-raw/PREREGISTRATION.md', system: 'Engine shadow setups (scalp, intraday, rscalp, rintra) per market, re-costed',
    verdict, verdict2x: x2.verdict, keep: x1.keep, keep2x: x2.keep, rule: RULE, windows: { IS: [IS_MONTHS[0], IS_MONTHS.at(-1)], OOS: [OOS_MONTHS[0], OOS_MONTHS.at(-1)] },
    trades: rc.length, markets: meta, reproduces: { shadowBest: sameOld, stampedCostMaxDiff: +worst.toExponential(2) },
    costModel: mmOut, costPerTrade: costTable(rc),
    grossBothWindowsPositive: x1.cells.filter((c) => c.IS.gross > 0 && c.OOS.gross > 0).map(cellId),
    x1: { bothWindowsPositive: x1.bothWindowsPositive, placebo: x1.placebo }, x2: { bothWindowsPositive: x2.bothWindowsPositive, placebo: x2.placebo },
    cells: x1.cells.map((c) => {
      const d = x2.cells.find((y) => y.k === c.k && y.m === c.m), o = ev.old.find((y) => y.k === c.k && y.m === c.m);
      return { k: c.k, m: c.m, IS: c.IS, OOS: c.OOS, holmP: c.holmP, failed: c.failed, keep: c.keep,
        x2: { IS: { net: d.IS.net, t: d.IS.t }, OOS: { net: d.OOS.net, t: d.OOS.t }, holmP: d.holmP, keep: d.keep },
        old: { IS: { net: o.IS.net }, OOS: { net: o.OOS.net, t: o.OOS.t } } };
    }) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  for (const c of res.cells) console.log([c.k.padEnd(8), c.m.padEnd(6), 'IS', c.IS.n, c.IS.net, c.IS.gross, '| OOS', c.OOS.n, c.OOS.net, c.OOS.gross, c.OOS.t, '| old', c.old.OOS.net, '| x2', c.x2.OOS.net, c.keep ? 'KEEP' : c.failed.join(',')].join(' '));
  console.log('costs', JSON.stringify(res.costPerTrade)); console.log('placebo x1', JSON.stringify(res.x1.placebo), 'x2', JSON.stringify(res.x2.placebo));
  console.log(verdict);
}

const [cmd, a1, a2, a3] = ARGV;
if (cmd === 'fetch' || cmd === 'market') execFileSync(process.execPath, ['--max-old-space-size=3500', BEST, cmd, a1, a2, a3].filter((v) => v != null), { stdio: 'inherit' });
else if (cmd === 'report') report(a1);
