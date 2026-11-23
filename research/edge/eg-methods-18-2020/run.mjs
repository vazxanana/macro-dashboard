// research/edge/eg-methods-18-2020/run.mjs - the Engulfing desk's zone readings on 18 markets, 2020 to now (PREREGISTRATION.md).
//   node research/edge/eg-methods-18-2020/run.mjs market <market> <outDir>   one market's trades into <outDir>/eg-<market>.json
//   node research/edge/eg-methods-18-2020/run.mjs cut <market> <outDir>      the look-ahead check (three cuts) into <outDir>/cut-<market>.json
//   node research/edge/eg-methods-18-2020/run.mjs report <outDir>            result.json and RESULT.md
// Research only: imports the desk's code (council/eg-methods.mjs), edgekit and combo-grid-2's costs and exclusions; edits nothing.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { methodTrades, efTrades } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const SOP = require('../../../assets/mosha-sop.js');
// in memory only (PREREGISTRATION.md): the decimals of the eight markets `ALL` does not list, so 30 pips is each market's own
const ADD_DEC = { nzdusd: 5, usdchf: 5, eurgbp: 5, euraud: 5, eurjpy: 3, gbpjpy: 3, audjpy: 3, cadjpy: 3 };
for (const [m, dec] of Object.entries(ADD_DEC)) if (!SOP.ALL[m]) SOP.ALL[m] = { name: m, dec };

export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy', 'xag', 'gbpjpy', 'eurgbp', 'audjpy', 'cadjpy', 'euraud', 'nas100', 'spx500', 'de40'];
export const DESCRIBE = ['xau', 'eurusd', 'gbpusd'];
export const TESTS = { T1: ['eg-plan', 'The plan (with the Daily)'], T2: ['eg-simple', 'The short method (H4 zone, not with the Daily)'], T3: ['eg-direct', 'The direct entry (fresh zones, M5 EF trail)'],
  T4: ['eg-plan-n', 'The plan, next-candle engulf'], T5: ['eg-simple-n', 'The short method, next-candle engulf'], T6: ['eg-ef', 'H4 EF barrier to the next H4 EG'] };
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const START = T('2020-01-01'), SPLIT = T('2024-01-01'), WARM = '2019-03-01';

const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
export function group(M5, sec) { const out = []; for (const b of M5) { const t = b.time - (b.time % sec), q = out[out.length - 1];
  if (q && q.time === t) { if (b.high > q.high) q.high = b.high; if (b.low < q.low) q.low = b.low; q.close = b.close; } else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close }); } return out; }
function candles(mk, cutT = Infinity) {
  const M5 = conv(K.load(mk, '5m', { from: WARM })).filter((b) => b.time + 300 <= cutT);
  const D1 = conv(K.load(mk, '1d', { from: '2018-01-01' })).filter((b) => b.time + 86400 <= cutT);
  return { '5m': M5, '15m': group(M5, 900), '1h': group(M5, 3600), '4h': group(M5, 14400), '1d': D1 };
}
function read(B, mk) {
  return methodTrades(B, { from: START, market: mk }).concat(methodTrades(B, { from: START, market: mk, span: 'next' }), efTrades(B, { from: START, market: mk }));
}
const slim = (r) => ({ id: r.id, kind: r.kind, side: r.side, t: r.t, entry: r.entry, stop: r.stop, target: r.target, status: r.status, R: r.R, endT: r.endT, exit: r.exit });

function market(mk, dir) {
  const t0 = Date.now(), B = candles(mk); const raw = read(B, mk);
  const X = exclusions(mk), bad = (t) => X.some((x) => t >= x[0] && t <= x[1]);
  const rows = []; let open = 0, dropped = 0;
  for (const r of raw) { if (r.R == null || r.status === 'open') { open++; continue; } if (bad(r.t)) { dropped++; continue; } rows.push(slim(r)); }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `eg-${mk}.json`), JSON.stringify({ market: mk, last: B['5m'].length ? B['5m'][B['5m'].length - 1].time + 300 : null, open, dropped, rows }));
  console.log(mk, rows.length, 'trades', open, 'open', dropped, 'excluded', ((Date.now() - t0) / 1000).toFixed(0) + 's');
}

// look-ahead check: trades filled and closed before each cut must equal the full run's
function cut(mk, dir) {
  const full = read(candles(mk), mk).map(slim), cuts = [T('2021-07-01'), T('2023-03-15'), T('2025-05-20')], out = [];
  for (const c of cuts) { const part = read(candles(mk, c), mk).map(slim), key = (r) => JSON.stringify(r);
    const a = full.filter((r) => r.endT != null && r.endT + 300 <= c && r.status !== 'open').map(key), b = part.filter((r) => r.endT != null && r.endT + 300 <= c && r.status !== 'open').map(key);
    const sa = new Set(a), sb = new Set(b); const onlyFull = a.filter((x) => !sb.has(x)).length, onlyCut = b.filter((x) => !sa.has(x)).length;
    out.push({ cut: new Date(c * 1000).toISOString().slice(0, 10), full: a.length, cutRun: b.length, onlyFull, onlyCut, same: onlyFull === 0 && onlyCut === 0 });
    console.log(mk, out[out.length - 1]); }
  fs.writeFileSync(path.join(dir, `cut-${mk}.json`), JSON.stringify(out));
}

// ─── statistics ───
const mkey = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function stat(rows, key = 'net') {
  const n = rows.length; if (!n) return { n: 0, mean: null, total: 0, win: null, months: 0, tMonth: null };
  const sum = rows.reduce((a, r) => a + r[key], 0), m = new Map(); for (const r of rows) m.set(mkey(r.t), (m.get(mkey(r.t)) || 0) + r[key]);
  const ks = [...m.keys()].sort(), ms = []; let [y, mo] = ks[0].split('-').map(Number); const [y1, m1] = ks[ks.length - 1].split('-').map(Number);
  while (y < y1 || (y === y1 && mo <= m1)) { ms.push(m.get(`${y}-${String(mo).padStart(2, '0')}`) || 0); if (mo === 12) { y++; mo = 1; } else mo++; }
  const mm = ms.reduce((a, b) => a + b, 0) / ms.length, v = ms.length > 1 ? ms.reduce((a, b) => a + (b - mm) ** 2, 0) / (ms.length - 1) : 0;
  const t = v > 0 ? mm / Math.sqrt(v / ms.length) : null;
  return { n, mean: +(sum / n).toFixed(4), total: +sum.toFixed(2), win: +(100 * rows.filter((r) => r[key] > 0).length / n).toFixed(1), months: ms.length, tMonth: t == null ? null : +t.toFixed(2) };
}
export const pOne = (t, df) => { if (t == null || !(df > 0)) return 1; const p2 = K.pFromT(t, df); return t > 0 ? p2 / 2 : 1 - p2 / 2; };

function report(dir) {
  let rows = [], meta = {}; const cuts = {};
  for (const mk of MARKETS) { const j = JSON.parse(fs.readFileSync(path.join(dir, `eg-${mk}.json`), 'utf8')); meta[mk] = { last: j.last, open: j.open, excluded: j.dropped };
    for (const r of j.rows) { const risk = Math.abs(r.entry - r.stop), c = COSTS[mk] / risk; rows.push({ ...r, market: mk, gross: r.R, net: r.R - c, net2: r.R - 2 * c, costR: c }); }
    const cf = path.join(dir, `cut-${mk}.json`); if (fs.existsSync(cf)) cuts[mk] = JSON.parse(fs.readFileSync(cf, 'utf8')); }
  rows.sort((a, b) => a.t - b.t);
  const last = Math.max(...Object.values(meta).map((x) => x.last || 0));
  const tests = {};
  for (const [id, [kind, what]] of Object.entries(TESTS)) {
    const a = rows.filter((r) => r.kind === kind), dis = a.filter((r) => r.t < SPLIT), con = a.filter((r) => r.t >= SPLIT);
    const byMarket = {}, byYear = {}, describe = {};
    for (const mk of MARKETS) { const o = con.filter((r) => r.market === mk); if (o.length) byMarket[mk] = { n: o.length, mean: stat(o).mean, total: stat(o).total }; }
    for (const r of a) { const y = new Date(r.t * 1000).getUTCFullYear(); (byYear[y] ||= { n: 0, net: 0 }); byYear[y].n++; byYear[y].net += r.net; }
    for (const y of Object.keys(byYear)) byYear[y].net = +byYear[y].net.toFixed(2);
    for (const mk of DESCRIBE) describe[mk] = { discovery: stat(dis.filter((r) => r.market === mk)), confirmation: stat(con.filter((r) => r.market === mk)) };
    const cm = stat(con);
    tests[id] = { kind, what, discovery: { gross: stat(dis, 'gross'), net: stat(dis), net2: stat(dis, 'net2') },
      confirmation: { gross: stat(con, 'gross'), net: cm, net2: stat(con, 'net2'), costR: con.length ? +(con.reduce((s, r) => s + r.costR, 0) / con.length).toFixed(4) : null },
      p: +pOne(cm.tMonth, cm.months - 1).toFixed(5), byMarket, byYear, describe };
  }
  const ids = Object.keys(tests), H = K.holm(ids.map((id) => tests[id].p)); ids.forEach((id, i) => { tests[id].holm = +H[i].toFixed(5); });
  const cutOk = Object.values(cuts).flat().every((c) => c.same);
  for (const id of ids) { const t = tests[id], d = t.discovery, c = t.confirmation;
    const checks = { discN100: d.net.n >= 100, discMeanPos: (d.net.mean || 0) > 0, discT2: (d.net.tMonth || 0) >= 2, confN50: c.net.n >= 50, confMeanPos: (c.net.mean || 0) > 0,
      confT2: (c.net.tMonth || 0) >= 2, confHolm: t.holm < 0.05, twiceCostPos: (d.net2.mean || 0) > 0 && (c.net2.mean || 0) > 0 };
    const few = !checks.discN100 || !checks.confN50; t.checks = checks; t.verdict = !cutOk ? 'INVALID' : few ? 'FAIL (too few to judge)' : Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL'; }
  // BEFORE COSTS (owner, through the main session, 23 Nov 2026, after the run: "forget the costs, I only want to know before costs"):
  // the same bar on R before costs (n, mean > 0, month t >= 2 in both windows, Holm over the six), no twice-cost check. Not pre-registered.
  const HG = K.holm(ids.map((id) => pOne(tests[id].confirmation.gross.tMonth, tests[id].confirmation.gross.months - 1)));
  ids.forEach((id, i) => { const t = tests[id], d = t.discovery.gross, c = t.confirmation.gross;
    const ck = { discN100: d.n >= 100, discMeanPos: (d.mean || 0) > 0, discT2: (d.tMonth || 0) >= 2, confN50: c.n >= 50, confMeanPos: (c.mean || 0) > 0, confT2: (c.tMonth || 0) >= 2, confHolm: HG[i] < 0.05 };
    t.beforeCosts = { holm: +HG[i].toFixed(5), checks: ck, verdict: !cutOk ? 'INVALID' : !ck.discN100 || !ck.confN50 ? 'FAIL (too few to judge)' : Object.values(ck).every(Boolean) ? 'PASS' : 'FAIL' }; });
  const passedG = ids.filter((id) => tests[id].beforeCosts.verdict === 'PASS');
  const passed = ids.filter((id) => tests[id].verdict === 'PASS');
  const all = rows.filter((r) => r.t >= SPLIT), allS = stat(all);
  const verdict = !cutOk ? 'INVALID' : passed.length ? 'PASS' : 'FAIL';
  const best = ids.map((id) => tests[id]).sort((a, b) => (b.confirmation.net.tMonth ?? -99) - (a.confirmation.net.tMonth ?? -99))[0];
  const f = (v, d = 3) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
  const allG = stat(rows.filter((r) => r.t >= SPLIT), 'gross');
  const headline = `${passedG.length} of 6 readings pass before costs and ${passed.length} of 6 after costs: from 2024 on the six made ${f(allG.mean)}R a trade before costs on ${allG.n} trades (month t ${allG.tMonth}) and ${f(allS.mean)}R after costs (month t ${allS.tMonth}).`;
  const out = { study: 'eg-methods-18-2020', built: new Date().toISOString().slice(0, 10), verdict, headline,
    system: 'The Engulfing desk\'s zone readings (council/eg-methods.mjs methodTrades span any / next, efTrades) as the code stands on 23 Nov 2026; 18 markets; OANDA mid 5m; discovery 2020-2023, confirmation 2024 to the last candle; net of costs.',
    markets: MARKETS, lastCandle: new Date(last * 1000).toISOString().slice(0, 16), windows: { discovery: ['2020-01-01', '2023-12-31'], confirmation: ['2024-01-01', new Date(last * 1000).toISOString().slice(0, 10)] },
    trades: rows.length, pooledConfirmation: allS, pooledConfirmationBeforeCosts: allG, verdictBeforeCosts: !cutOk ? 'INVALID' : passedG.length ? 'PASS' : 'FAIL', cutCheck: { ok: cutOk, markets: cuts }, meta, tests };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  const L = ['# The Engulfing desk\'s zone readings on 18 markets, 2020 to now', '', `**Verdict: ${verdict}. ${headline}**`, '',
    `Built ${out.built}. Pre-registered (PREREGISTRATION.md, committed alone before any trade was computed). Paper research only: nothing live changed.`,
    `The desk's own code (\`council/eg-methods.mjs\`, imported, not edited) on 18 markets, OANDA mid 5-minute candles to ${out.lastCandle} UTC; discovery 2020-2023, confirmation 2024 on; R a trade after the round-trip costs of \`combo-grid-2\`; t on calendar-month sums. ${rows.length} closed trades.`, '',
    '## Before costs (asked by the owner after the run; not pre-registered)', '', 'The same bar on R before costs: n, mean > 0 and month-sum t ≥ 2 in both windows, Holm over the six; no twice-cost check.', '',
    '| | Reading | Disc. n | Disc. R | Disc. t | Conf. n | Conf. R | Conf. t | Holm p | Verdict before costs |', '|---|---|---|---|---|---|---|---|---|---|',
    ...ids.map((id) => { const t = tests[id], d = t.discovery.gross, c = t.confirmation.gross; return `| ${id} | ${t.what} | ${d.n} | ${f(d.mean)} | ${d.tMonth ?? 'n/a'} | ${c.n} | ${f(c.mean)} | ${c.tMonth ?? 'n/a'} | ${t.beforeCosts.holm} | ${t.beforeCosts.verdict} |`; }), '',
    '## After costs (the pre-registered verdict)', '', '| | Reading | Disc. n | Disc. net R | Disc. t | Conf. n | Conf. before costs | Conf. net R | Conf. t | Holm p | Conf. at 2x cost | Verdict |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const id of ids) { const t = tests[id], d = t.discovery, c = t.confirmation;
    L.push(`| ${id} | ${t.what} | ${d.net.n} | ${f(d.net.mean)} | ${d.net.tMonth ?? 'n/a'} | ${c.net.n} | ${f(c.gross.mean)} | ${f(c.net.mean)} | ${c.net.tMonth ?? 'n/a'} | ${t.holm} | ${f(c.net2.mean)} | ${t.verdict} |`); }
  L.push('', `Look-ahead check (three cuts on ${Object.keys(cuts).join(', ') || 'none'}): ${cutOk ? 'every trade closed before a cut is the same in the cut run and the full run' : 'DIFFERENCES FOUND'}.`, '',
    '## Gold, EUR/USD, GBP/USD alone (descriptive, no verdict)', '', '| | ' + DESCRIBE.map((m) => `${m} disc. n / net R / t | ${m} conf. n / net R / t`).join(' | ') + ' |', '|---|' + DESCRIBE.map(() => '---|---').join('|') + '|');
  for (const id of ids) L.push(`| ${id} | ` + DESCRIBE.map((m) => { const x = tests[id].describe[m]; return `${x.discovery.n} / ${f(x.discovery.mean)} / ${x.discovery.tMonth ?? 'n/a'} | ${x.confirmation.n} / ${f(x.confirmation.mean)} / ${x.confirmation.tMonth ?? 'n/a'}`; }).join(' | ') + ' |');
  L.push('', '## Confirmation by market (net R a trade, n)', '', '| Market | ' + ids.join(' | ') + ' |', '|---|' + ids.map(() => '---').join('|') + '|');
  for (const mk of MARKETS) L.push(`| ${mk} | ` + ids.map((id) => { const x = tests[id].byMarket[mk]; return x ? `${f(x.mean)} (${x.n})` : 'n/a'; }).join(' | ') + ' |');
  const years = [...new Set(ids.flatMap((id) => Object.keys(tests[id].byYear)))].sort();
  L.push('', '## By year (net R summed, trades)', '', '| Reading | ' + years.join(' | ') + ' |', '|---|' + years.map(() => '---').join('|') + '|');
  for (const id of ids) L.push(`| ${id} | ` + years.map((y) => { const x = tests[id].byYear[y]; return x ? `${f(x.net, 1)} (${x.n})` : 'n/a'; }).join(' | ') + ' |');
  L.push('', '## Notes', '', '- Eight markets (nzdusd, usdchf, eurgbp, euraud, eurjpy, gbpjpy, audjpy, cadjpy) are not listed in `assets/mosha-sop.js` `ALL`, so the code would take gold\'s 0.10 as their pip; the study added their quoted decimals in memory, as pre-registered, so each stop is 30 of the market\'s own pips. The desk itself runs only five markets.',
    '- Costs for the 13 markets outside the demo-measured five are assumed (combo-grid-2), not measured.',
    '- 15-minute, 1-hour and 4-hour candles are grouped from the 5-minute cache in UTC buckets; the desk reads OANDA\'s own candles, which can differ in a bucket with a missing 5-minute candle.',
    '- A paper reading of one desk\'s code before any owner change; no variant of these readings is tried on these years after this.');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), L.join('\n') + '\n');
  console.log(verdict, headline);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') market(a, b); else if (cmd === 'cut') cut(a, b); else if (cmd === 'report') report(a); else console.log('market <m> <dir> | cut <m> <dir> | report <dir>');
}
