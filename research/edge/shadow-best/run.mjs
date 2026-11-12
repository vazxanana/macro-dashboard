// Edge research · shadow-best: which (setup, market) streams of the engine's shadow family (scalp, intraday, rscalp, rintra)
// are worth keeping, 2020 to Oct 2026, net of costs, IS 2020-23 vs OOS 2024 on, Holm over the 32 cells, with a placebo of
// 40 random partitions. See PREREGISTRATION.md.
// Usage:
//   node research/edge/shadow-best/run.mjs fetch <candleDir>                  candles from origin/council-data (git, no network)
//   node research/edge/shadow-best/run.mjs market <key> <candleDir> <outDir>  the earlier study's replay, unchanged → per-trade file
//   node research/edge/shadow-best/run.mjs report <outDir>                    → result.json next to this file (+ the table on stdout)
// The replay is research/edge/shadow-scalp-filters/run.mjs, run as it is (its files are not edited); its statistics helpers
// (t, one-sided p, Holm, months) are imported from it.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PREV = path.join(HERE, '../shadow-scalp-filters/run.mjs');
// The earlier run.mjs runs its own command line on import (fetch / market / report). Hide ours from it before importing,
// so importing it can never replay or rewrite the earlier study's result.json.
const ARGV = process.argv.slice(2);
process.argv.length = Math.min(process.argv.length, 2);
const S = await import('../shadow-scalp-filters/run.mjs');
export const { MARKETS, WIN, FAMILY, pOneSided, holm, monthKeys, monthOf, tStat } = S;

// ─── the cells (pre-registered: 24 HistData cells + 8 coin cells = 32) ───
export const M1_SETUPS = ['scalp', 'intraday', 'rscalp', 'rintra'];
export const C5_SETUPS = ['intraday', 'rintra'];
export const CELLS = Object.entries(MARKETS).flatMap(([m, mk]) => (mk.base === '1m' ? M1_SETUPS : C5_SETUPS).map((k) => ({ k, m })));
export const IS_MONTHS = monthKeys(WIN.from.m1, WIN.oos);
export const OOS_MONTHS = monthKeys(WIN.oos, WIN.to);
export const RULE = { minOosN: 100, minT: 2, alpha: 0.05 };
export const PLACEBO_N = 40;
const r3 = (v) => v == null || !Number.isFinite(v) ? null : +v.toFixed(3);
const r4 = (v) => v == null || !Number.isFinite(v) ? null : +v.toFixed(4);
export const cellId = (c) => `${c.k}|${c.m}`;
export const windowOf = (t) => t >= WIN.from.m1 && t < WIN.oos ? 'IS' : t >= WIN.oos && t < WIN.to ? 'OOS' : null;

// ─── per-trade rows: [market, setup, opened, side, Rnet, Rgross] from the earlier replay's output (no later field is used to
// place a trade in a cell or a window: the signal time and the setup / market only) ───
export const TCOLS = ['m', 'k', 'opened', 'side', 'net', 'gross'];
export function tradesOf(raw) {
  const ix = Object.fromEntries(raw.cols.map((c, i) => [c, i]));
  return raw.rows.map((r) => [raw.key, r[ix.k], r[ix.opened], r[ix.side], +(r[ix.R] - r[ix.costR]).toFixed(4), r[ix.R]]);
}
export const rowObj = (r) => Object.fromEntries(TCOLS.map((c, i) => [c, r[i]]));

// ─── one cell on one window: n, net / gross a trade, total, monthly t (empty months = 0) ───
export function windowStats(trades, months) {
  const sums = Object.fromEntries(months.map((m) => [m, 0]));
  let n = 0, net = 0, gross = 0;
  for (const x of trades) { const mo = monthOf(x.opened); if (!(mo in sums)) continue; n++; net += x.net; gross += x.gross; sums[mo] += x.net; }
  const t = tStat(Object.values(sums));
  return { n, net: n ? r4(net / n) : null, gross: n ? r4(gross / n) : null, total: r3(net), months: months.length, t: r3(t),
    p: t == null ? null : +pOneSided(t, months.length - 1).toPrecision(4) };
}

// ─── the selection rule over a set of cells (each { IS, OOS }): Holm over all of them ───
export function applyRule(cells) {
  const adj = holm(cells.map((c) => c.OOS.p));
  return cells.map((c, i) => {
    const holmP = adj[i] == null ? null : +adj[i].toPrecision(4);
    const checks = { isPos: c.IS.net != null && c.IS.net > 0, oosPos: c.OOS.net != null && c.OOS.net > 0, oosN: c.OOS.n >= RULE.minOosN,
      oosT: c.OOS.t != null && c.OOS.t >= RULE.minT, holm: holmP != null && holmP <= RULE.alpha };
    const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    return { ...c, holmP, checks, failed, keep: !failed.length };
  });
}
export function cellTable(rows, cells = CELLS) {
  const by = new Map(cells.map((c) => [cellId(c), []]));
  for (const x of rows) { const a = by.get(`${x.k}|${x.m}`); if (a) a.push(x); }
  return applyRule(cells.map((c) => { const a = by.get(cellId(c)); return { k: c.k, m: c.m, IS: windowStats(a, IS_MONTHS), OOS: windowStats(a, OOS_MONTHS) }; }));
}

// ─── placebo: 40 partitions of the same trades into pseudo-cells of the real sizes, per window ───
export function hashJ(j, x, i) { let h = 2166136261; for (const c of `${j}|${x.m}|${x.k}|${x.opened}|${x.side}|${i}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function partition(rows, sizes, j) {
  const cells = sizes.map(() => []);
  for (const w of ['IS', 'OOS']) {
    const pool = [];
    rows.forEach((x, i) => { if (windowOf(x.opened) === w) pool.push([hashJ(j, x, i), i, x]); });
    pool.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let p = 0;
    sizes.forEach((s, c) => { for (let q = 0; q < s[w] && p < pool.length; q++) cells[c].push(pool[p++][2]); });
  }
  return applyRule(cells.map((a) => ({ IS: windowStats(a, IS_MONTHS), OOS: windowStats(a, OOS_MONTHS) })));
}
export function placebo(rows, table, runs = PLACEBO_N) {
  const sizes = table.map((c) => ({ IS: c.IS.n, OOS: c.OOS.n }));
  const per = [];
  for (let j = 1; j <= runs; j++) {
    const res = partition(rows, sizes, j);
    per.push({ j, keeps: res.filter((c) => c.keep).length, maxT: r3(Math.max(...res.map((c) => c.OOS.t ?? -Infinity))),
      bothPos: res.filter((c) => c.checks.isPos && c.checks.oosPos).length });
  }
  return { runs, totalKeeps: per.reduce((s, r) => s + r.keeps, 0), partitionsWithKeep: per.filter((r) => r.keeps > 0).length,
    maxT: r3(Math.max(...per.map((r) => r.maxT))), meanBothPositive: r3(per.reduce((s, r) => s + r.bothPos, 0) / runs), per };
}

export function evaluate(rows) {
  const table = cellTable(rows), keep = table.filter((c) => c.keep).map((c) => ({ setup: c.k, market: c.m }));
  const pl = placebo(rows, table);
  const verdict = keep.length ? `PASS for ${keep.length} of ${table.length} cells` : `FAIL, 0 of ${table.length} cells: no engine shadow stream is worth keeping`;
  const tot = (w, f) => { const a = rows.filter((x) => windowOf(x.opened) === w); return { n: a.length, perTrade: a.length ? r4(a.reduce((s, x) => s + x[f], 0) / a.length) : null }; };
  return { verdict, keep, cells: table, placebo: pl, family: { IS: tot('IS', 'net'), OOS: tot('OOS', 'net'), ISgross: tot('IS', 'gross'), OOSgross: tot('OOS', 'gross') },
    bothWindowsPositive: table.filter((c) => c.checks.isPos && c.checks.oosPos).map((c) => cellId(c)) };
}

// ─── commands ───
function market(key, cdir, odir) {
  if (!MARKETS[key]) throw new Error(`unknown market ${key}`);
  const raw = path.join(odir, 'raw');
  fs.mkdirSync(raw, { recursive: true });
  if (!fs.existsSync(path.join(raw, `${key}.json`)))
    execFileSync(process.execPath, ['--max-old-space-size=3500', PREV, 'market', key, cdir, raw], { stdio: 'inherit' });
  const j = JSON.parse(fs.readFileSync(path.join(raw, `${key}.json`), 'utf8'));
  const trades = tradesOf(j);
  fs.writeFileSync(path.join(odir, `${key}.trades.json`), JSON.stringify({ key, base: j.base, from: j.from, to: j.to, openAtEnd: j.openAtEnd, cols: TCOLS, rows: trades }));
  console.log(`${key}: ${trades.length} trades → ${key}.trades.json`);
}
export function loadTrades(odir) {
  const files = fs.readdirSync(odir).filter((f) => f.endsWith('.trades.json')).sort();
  const meta = {}, rows = [];
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(path.join(odir, f), 'utf8'));
    meta[j.key] = { base: j.base, from: new Date(j.from * 1000).toISOString().slice(0, 10), trades: j.rows.length, openAtEnd: j.openAtEnd };
    for (const r of j.rows) rows.push(rowObj(r));
  }
  return { meta, rows };
}
function report(odir) {
  const { meta, rows } = loadTrades(odir);
  const missing = Object.keys(MARKETS).filter((m) => !meta[m]);
  if (missing.length) throw new Error(`missing markets: ${missing.join(', ')}`);
  const ev = evaluate(rows);
  const res = { study: 'shadow-best', title: 'Which engine shadow streams are worth keeping', built: new Date().toISOString().slice(0, 10),
    preregistration: 'research/edge/shadow-best/PREREGISTRATION.md', system: 'Engine shadow setups (scalp, intraday, rscalp, rintra) per market',
    verdict: ev.verdict, keep: ev.keep, rule: RULE, windows: { IS: [IS_MONTHS[0], IS_MONTHS.at(-1)], OOS: [OOS_MONTHS[0], OOS_MONTHS.at(-1)] },
    markets: meta, trades: rows.length, family: ev.family, bothWindowsPositive: ev.bothWindowsPositive,
    placebo: { ...ev.placebo, per: ev.placebo.per }, cells: ev.cells };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  for (const c of ev.cells) console.log([c.k.padEnd(8), c.m.padEnd(6), 'IS', c.IS.n, c.IS.net, c.IS.gross, c.IS.t, '| OOS', c.OOS.n, c.OOS.net, c.OOS.gross, c.OOS.t, c.holmP, c.keep ? 'KEEP' : c.failed.join(',')].join(' '));
  console.log('family', JSON.stringify(ev.family));
  console.log('placebo', JSON.stringify({ ...ev.placebo, per: undefined }));
  console.log(ev.verdict);
}
function fetch(dir) { execFileSync(process.execPath, [PREV, 'fetch', dir], { stdio: 'inherit' }); }

const [cmd, a1, a2, a3] = ARGV;
if (cmd === 'fetch') fetch(a1);
else if (cmd === 'market') market(a1, a2, a3);
else if (cmd === 'report') report(a1);
