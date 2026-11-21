// desk-partial: half closed at +1R, the rest trailed (PT) or sent to 3R (P3). Pre-registered in PREREGISTRATION.md (first).
// Paper research: nothing live reads it.
//   node research/edge/desk-partial/run.mjs stageA <desk-exits dir>                      the desks' own 2026 trades (descriptive)
//   node research/edge/desk-partial/run.mjs market <key> <desk-rigor dir> <out dir>      2020-2025 trades of one market + their exits
//   node research/edge/desk-partial/run.mjs report <desk-exits dir> <out dir>            result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { exitR, firstAt, loadTrades, loadBars, cost, stats, monthDiff, pOne, NAME, GROUPS, DESKS, CAP_S } from '../desk-exits/run.mjs';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const IS = [T('2020-01-01'), T('2024-01-01')], OOS = [T('2024-01-01'), T('2026-01-01')];
export const TESTED = ['PT', 'P3'], SHOWN = ['booked', 'X1', 'XT', 'PT', 'P3'];
export const EXIT_NAME = { booked: 'The desk\'s own exit', X1: 'All at +1R', XT: 'Trailing stop (no partial)', PT: 'Half at +1R, the rest trailed', P3: 'Half at +1R, the rest to 3R' };
export const B_MARKETS = ['xau', 'eurusd', 'gbpusd'];

// ─── the partial exits on one trade: { R, how, end } or null when the candles end first ───
export function partialR(tr, bars, mode, i0) {
  const d = tr.side > 0 ? 1 : -1, e = +tr.entry, r0 = Math.abs(e - +tr.stop);
  if (!(r0 > 0)) return null;
  let i = i0 == null ? firstAt(bars, tr.t) : i0; if (i < 0) return null;
  let stop = +tr.stop, half = false, best = e;
  const R = (px) => d * (px - e) / r0, one = e + d * r0, three = e + d * 3 * r0;
  const done = (px, how, end) => ({ R: half ? 0.5 + 0.5 * R(px) : R(px), how, end });
  for (; i < bars.length; i++) {
    const b = bars[i], first = b.time <= tr.t, hi = b.high, lo = b.low;
    if (b.time - tr.t > CAP_S) return done(bars[i - 1].close, 'time', bars[i - 1].time);
    if (!first && (d > 0 ? b.open <= stop : b.open >= stop)) return done(b.open, 'gap', b.time);
    if (d > 0 ? lo <= stop : hi >= stop) return done(stop, half ? 'rest stopped' : 'stop', b.time);
    if (first) continue;                                             // the fill candle can only stop the trade
    if (!half && (d > 0 ? hi >= one : lo <= one)) half = true;       // half closed at +1R; the stop moves after this candle
    if (half && mode === 'P3' && (d > 0 ? hi >= three : lo <= three)) return { R: 0.5 + 0.5 * 3, how: 'target', end: b.time };
    if (half) { best = d > 0 ? Math.max(best, hi) : Math.min(best, lo);
      const s = mode === 'PT' ? best - d * r0 : e; if (d * (s - stop) > 0) stop = s; if (d * (e - stop) > 0) stop = e; }
  }
  return null;
}
export function exitsOf(tr, bars) {
  const i0 = bars ? firstAt(bars, tr.t) : -1; if (i0 < 0) return null;
  const ex = {}; for (const x of ['X1', 'XT']) { const o = exitR(tr, bars, x, i0); if (!o) return null; ex[x] = { R: o.R, how: o.how }; }
  for (const x of TESTED) { const o = partialR(tr, bars, x, i0); if (!o) return null; ex[x] = { R: o.R, how: o.how }; }
  return ex;
}

// ─── stage B: the desks' code on 2020-2025 ───
function marketRun(mk, rdir, out) {
  return import('../../../council/mosha-desk.mjs').then(async (MD) => {
    const SOP = require('../../../assets/mosha-sop.js'), { msnrTrades, egTrades, litTrades } = await import('../../../council/edge-desks.mjs'), { methodTrades, snrTrades } = await import('../../../council/eg-methods.mjs');
    const ld = (tf) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(rdir, `${mk}-${tf}.json.gz`)))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
    const grp = (M5, sec) => { const o = []; for (const b of M5) { const t = b.time - (b.time % sec), q = o[o.length - 1]; if (q && q.time === t) { if (b.high > q.high) q.high = b.high; if (b.low < q.low) q.low = b.low; q.close = b.close; } else o.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close }); } return o; };
    const B = {}; for (const tf of ['1d', '4h', '1h', '5m']) B[tf] = ld(tf); B['15m'] = grp(B['5m'], 900); B['30m'] = grp(B['5m'], 1800);
    const F = MD.loadFns(), from = IS[0], trades = []; let t0 = Date.now();
    const lap = (w) => { console.log(mk, w, ((Date.now() - t0) / 1000).toFixed(0) + 's', trades.length); t0 = Date.now(); };
    const put = (r) => { if (r.R == null || !(r.t >= IS[0] && r.t < OOS[1])) return; trades.push({ kind: r.kind, market: mk, side: r.side, t: r.t, entry: +r.entry, stop: +r.stop, booked: +r.R }); };
    const cfz = []; for (const r of SOP.sopTrades(B, F, { from, market: mk, cfOut: cfz })) put(r); lap('sequence');
    for (const r of SOP.barrierTrades(B, F, { from, market: mk, extra: cfz })) put(r); lap('barrier');
    for (const r of egTrades(B, { from, market: mk })) put(r); for (const r of methodTrades(B, { from, market: mk })) put(r); lap('engulf');
    for (const r of msnrTrades(B, { from, market: mk })) put(r); if (mk === 'xau') for (const r of snrTrades(B, { from, market: mk })) put(r); lap('msnr');
    for (const r of litTrades(B, { from, market: mk })) put(r); lap('lit');
    const rows = []; let left = 0;
    for (const tr of trades) { const ex = exitsOf(tr, B['5m']); if (!ex) { left++; continue; } rows.push({ ...tr, costR: cost(mk, tr.entry) / Math.abs(tr.entry - tr.stop), ex }); }
    fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, `partial-${mk}.json`), JSON.stringify({ left, rows }));
    console.log(mk, 'done', rows.length, 'left', left);
  });
}

// ─── statistics ───
const view = (rows, x) => rows.map((r) => { const g = x === 'booked' ? r.booked : r.ex[x].R; return { t: r.t, gross: g, net: g - r.costR }; });
const kinds = () => DESKS.flatMap((d) => GROUPS[d].map((k) => [d, k]));
function table(rows) {
  const out = {};
  for (const [d, k] of kinds()) { const g = rows.filter((r) => r.kind === k); if (!g.length) continue;
    const o = { desk: d, kind: k, name: NAME[k], n: g.length, exits: {} };
    for (const x of SHOWN) { const v = view(g, x); o.exits[x] = { gross: stats(v, 'gross'), net: stats(v, 'net') };
      if (TESTED.includes(x)) o.exits[x].vsBooked = monthDiff(view(g, x), view(g, 'booked')); }
    out[k] = o; }
  return out;
}
const holm = (tests, key) => { const ord = tests.map((t, i) => [Math.min(1, t[key]), i]).sort((a, b) => a[0] - b[0]); let run = 0; ord.forEach(([p, i], j) => { run = Math.max(run, Math.min(1, p * (ord.length - j))); tests[i][key + 'Holm'] = +run.toFixed(4); }); };
export function verdicts(rowsB) {
  const is = rowsB.filter((r) => r.t < IS[1]), oos = rowsB.filter((r) => r.t >= OOS[0]), tIS = table(is), tOOS = table(oos), tests = [];
  for (const k of Object.keys(tOOS)) for (const x of TESTED) { const o = tOOS[k].exits[x], i = tIS[k] && tIS[k].exits[x];
    tests.push({ group: k, exit: x, oos: { n: tOOS[k].n, net: o.net.mean, tProfit: o.net.tMonth, diff: o.vsBooked.diff, tBetter: o.vsBooked.t },
      is: i ? { n: tIS[k].n, net: i.net.mean, diff: i.vsBooked.diff } : null,
      pBetter: 2 * pOne(o.vsBooked.t == null ? null : Math.abs(o.vsBooked.t)),
      pProfit: 2 * pOne(o.net.tMonth == null ? null : Math.abs(o.net.tMonth)) }); }
  for (const t of tests) { t.pBetter = Math.min(1, t.pBetter); t.pProfit = Math.min(1, t.pProfit); }
  holm(tests, 'pBetter'); holm(tests, 'pProfit');
  for (const t of tests) {
    t.better = t.oos.diff > 0 && t.oos.tBetter >= 2 && t.pBetterHolm < 0.05 && !!t.is && t.is.diff > 0;
    t.profitable = t.oos.net > 0 && t.oos.tProfit >= 2 && t.pProfitHolm < 0.05 && !!t.is && t.is.net > 0;
    t.verdict = t.better && t.profitable ? 'PASS' : 'FAIL'; }
  return { is: tIS, oos: tOOS, tests };
}

// ─── the report ───
const f3 = (v) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
function report(A, Bv, meta) {
  const pass = Bv.tests.filter((t) => t.verdict === 'PASS'), better = Bv.tests.filter((t) => t.better), prof = Bv.tests.filter((t) => t.profitable);
  const L = ['# Desk partial exits: half closed at +1R, the rest left to run', '',
    'Pre-registered (PREREGISTRATION.md, committed first). Half the position closes at +1R; the other half then either trails 1R behind the best price from the entry (PT) or goes to 3R with its stop at the entry (P3). Every trade run alone on OANDA mid 5-minute candles; R of the whole position; after the desk-rigor cost model unless said.', '',
    `**Verdict: ${pass.length ? 'PASS' : 'FAIL'}.** Stage B (2020-2025, out of sample 2024-2025): ${pass.length} of ${Bv.tests.length} group-exit pairs pass both bars; ${better.length} better than the desk's own exit, ${prof.length} profitable after costs.` + (pass.length ? ' Passing: ' + pass.map((t) => NAME[t.group] + ', ' + EXIT_NAME[t.exit]).join('; ') + '.' : ''), '',
    '## Stage B: 2020-2025 on gold, EUR/USD and GBP/USD (the verdict)', '',
    `Trades: ${meta.nB} (${meta.leftB} left out). Out of sample 2024-2025, R a trade after costs.`, '',
    '| Group | OOS n | Own exit | All at +1R | Trailing | Half + trail | Half + 3R | Half + trail vs own (t) | Half + 3R vs own (t) | Verdicts |', '|---|---|---|---|---|---|---|---|---|---|'];
  for (const [k, g] of Object.entries(Bv.oos)) { const e = g.exits, tt = Bv.tests.filter((t) => t.group === k);
    L.push(`| ${g.name} | ${g.n} | ${f3(e.booked.net.mean)} | ${f3(e.X1.net.mean)} | ${f3(e.XT.net.mean)} | ${f3(e.PT.net.mean)} | ${f3(e.P3.net.mean)} | ${f3(e.PT.vsBooked.diff)} (${e.PT.vsBooked.t ?? 'n/a'}) | ${f3(e.P3.vsBooked.diff)} (${e.P3.vsBooked.t ?? 'n/a'}) | ${tt.map((t) => t.exit + ' ' + t.verdict + (t.better ? ', better' : '') + (t.profitable ? ', profitable' : '')).join('; ')} |`); }
  L.push('', 'In sample 2020-2023, R a trade after costs:', '', '| Group | IS n | Own exit | All at +1R | Trailing | Half + trail | Half + 3R |', '|---|---|---|---|---|---|---|');
  for (const [k, g] of Object.entries(Bv.is)) { const e = g.exits; L.push(`| ${g.name} | ${g.n} | ${f3(e.booked.net.mean)} | ${f3(e.X1.net.mean)} | ${f3(e.XT.net.mean)} | ${f3(e.PT.net.mean)} | ${f3(e.P3.net.mean)} |`); }
  L.push('', '## Stage A: the desks\' own 2026 trades (in sample, descriptive)', '', `Trades: ${meta.nA}. R a trade before costs / after costs.`, '',
    '| Group | n | Own exit | All at +1R | Trailing | Half + trail | Half + 3R | Win % own / half + trail |', '|---|---|---|---|---|---|---|---|');
  for (const g of Object.values(A)) { const e = g.exits, c = (x) => f3(e[x].gross.mean) + ' / ' + f3(e[x].net.mean);
    L.push(`| ${g.name} | ${g.n} | ${c('booked')} | ${c('X1')} | ${c('XT')} | ${c('PT')} | ${c('P3')} | ${e.booked.net.win} / ${e.PT.net.win} |`); }
  L.push('', '## What this is not', '', '- Each trade was run alone: a desk holding one position at a time would have taken other later trades.',
    '- Stage B covers three markets; stage A is in sample.', '- A pass is a candidate for its own forward paper record, never a live rule without the owner. Nothing live changed.', '');
  return L.join('\n');
}

async function main() {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === 'market') return marketRun(a, b, c);
  if (cmd !== 'report') throw new Error('usage: run.mjs market <key> <rigor dir> <out> | report <desk-exits dir> <out>');
  const trades = loadTrades(a), cache = {}, barsOf = (mk) => (mk in cache ? cache[mk] : (cache[mk] = fs.existsSync(path.join(a, `${mk}-5m.json.gz`)) ? loadBars(a, mk) : null));
  const rowsA = []; for (const tr of trades) { const ex = exitsOf(tr, barsOf(tr.market)); if (ex) rowsA.push({ ...tr, costR: cost(tr.market, tr.entry) / Math.abs(tr.entry - tr.stop), ex }); }
  let rowsB = [], leftB = 0; for (const mk of B_MARKETS) { const j = JSON.parse(fs.readFileSync(path.join(b, `partial-${mk}.json`), 'utf8')); rowsB = rowsB.concat(j.rows); leftB += j.left; }
  const A = table(rowsA), Bv = verdicts(rowsB), pass = Bv.tests.filter((t) => t.verdict === 'PASS');
  const res = { study: 'desk-partial', built: '2026-11-21', system: 'Half of every desk trade closed at +1R, the rest trailed or sent to 3R; the desks\' own 2026 trades (in sample) and the desks\' code on gold, EUR/USD, GBP/USD 2020-2025 (out of sample 2024-2025); OANDA mid 5m; after the desk-rigor costs.',
    verdict: pass.length ? 'PASS' : 'FAIL', headline: `${pass.length} of ${Bv.tests.length} group-exit pairs both better than the desk's own exit and profitable after costs out of sample (2024-2025).`,
    stageA: { n: rowsA.length, groups: A }, stageB: { n: rowsB.length, left: leftB, is: Bv.is, oos: Bv.oos, tests: Bv.tests } };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(A, Bv, { nA: rowsA.length, nB: rowsB.length, leftB }));
  console.log(res.verdict, res.headline);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.error(e); process.exit(1); });
