// The desks' readings after the marking audit, and the methods' own conditions (PREREGISTRATION.md, 21 Nov 2026).
// The desks' own code, imported; nothing here changes a rule.
//   node --use-env-proxy research/edge/desk-rigor/run.mjs fetch <dir>          candles into <dir> (outside git)
//   node research/edge/desk-rigor/run.mjs market <key> <dir>                   that market's trades into <dir>/rigor-<key>.json
//   node research/edge/desk-rigor/run.mjs report <dir>                         result.json and RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadFns } from '../../../council/mosha-desk.mjs';
import { msnrTrades } from '../../../council/edge-desks.mjs';
import { methodTrades, snrTrades } from '../../../council/eg-methods.mjs';
import { foldWeekend } from '../../../council/fills.mjs';

const require = createRequire(import.meta.url), SOP = require('../../../assets/mosha-sop.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MD = (process.env.MD_BASE || 'https://aureumdesk.co.uk/md/').replace(/\/?$/, '/');
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const WARM = T('2019-06-01'), IS = [T('2020-01-01'), T('2024-01-01')], OOS = [T('2024-01-01'), T('2026-01-01')], CUT = T('2026-02-01');
export const MARKETS = ['xau', 'eurusd', 'gbpusd'];
const SEC = { '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400 };
const PIP = { eurusd: 0.0001, gbpusd: 0.0001 };
export const cost = (mk, px) => (PIP[mk] ? 0.000045 * px + 0.5 * PIP[mk] : px * 0.00005);
const file = (dir, mk, tf) => path.join(dir, `${mk}-${tf}.json.gz`);
const load = (dir, mk, tf) => JSON.parse(zlib.gunzipSync(fs.readFileSync(file(dir, mk, tf)))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })).filter((b) => b.time + SEC[tf] <= CUT);
export function group(M5, sec) { const out = []; for (const b of M5) { const t = b.time - (b.time % sec), q = out[out.length - 1]; if (q && q.time === t) { if (b.high > q.high) q.high = b.high; if (b.low < q.low) q.low = b.low; q.close = b.close; } else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close }); } return out; }

async function fetchTf(mk, tf, to) {
  const out = new Map(), sec = SEC[tf];
  for (let f = WARM; f < to; f += 4000 * sec) { const t2 = Math.min(to, f + 4000 * sec); let ok = false;
    for (let tr = 0; tr < 4 && !ok; tr++) { try { const r = await fetch(`${MD}bars?sym=${mk}&tf=${tf}&from=${f}&to=${t2}`, { signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json(); for (const b of (j.bars || j || [])) if (b.time + sec <= to) out.set(b.time, [b.time, b.open, b.high, b.low, b.close]); ok = true; } catch (e) { if (tr === 3) throw new Error(`${mk} ${tf} ${f}: ${e.message}`); await new Promise((s) => setTimeout(s, 1500 * (tr + 1))); } } }
  return [...out.values()].sort((a, b) => a[0] - b[0]);
}
async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true }); const to = Math.floor(Date.now() / 1000);
  for (const mk of MARKETS) for (const tf of ['5m', '1h', '4h', '1d']) { if (fs.existsSync(file(dir, mk, tf))) continue; const rows = await fetchTf(mk, tf, to); fs.writeFileSync(file(dir, mk, tf), zlib.gzipSync(JSON.stringify(rows))); console.log(mk, tf, rows.length); }
}

// one market: every reading's trades as plain rows { test, t, R, entry, r0, flags }
function market(mk, dir) {
  const F = loadFns(), B = {}; for (const tf of ['1d', '4h', '1h', '5m']) B[tf] = load(dir, mk, tf);
  B['15m'] = group(B['5m'], 900); B['30m'] = group(B['5m'], 1800);
  const from = IS[0], rows = [], put = (test, r, x = {}) => { if (r.R == null || !(r.t >= from && r.t < OOS[1])) return; rows.push({ test, t: r.t, R: +r.R.toFixed(4), entry: r.entry, r0: r.r0, ...x }); };
  let t0 = Date.now(); const lap = (w) => { console.log(mk, w, ((Date.now() - t0) / 1000).toFixed(0) + 's', rows.length); t0 = Date.now(); };
  for (const r of SOP.sopTrades(B, F, { from, market: mk })) put('R1', r, { deep: r.deep === true, shallow: r.deep === false, c: r.case === 1 ? 1 : r.case === 2 ? 2 : 0, l: r.l });
  lap('sequence');
  const D1 = foldWeekend(B['1d']); let dn = 0, dA = null;
  const dTrend = (t) => { let n = dn; while (n < D1.length && D1[n].time + 86400 <= t) n++; if (n !== dn || !dA) { dn = n; dA = n > 30 ? F.msAnalyze(D1.slice(Math.max(0, n - 1500), n), 6) : null; } return dA ? dA.trend : 0; };
  for (const r of SOP.barrierTrades(B, F, { from, market: mk }).sort((a, b) => a.t - b.t)) put('R2', r, { bo: /· BO origin$/.test(r.label), h: r.h, withD: dTrend(r.t) === r.side });
  lap('barrier');
  for (const r of methodTrades(B, { from, market: mk })) put(r.kind === 'eg-plan' ? 'R3' : r.kind === 'eg-simple' ? 'R4' : 'R5', r);
  lap('engulf methods');
  for (const r of msnrTrades(B, { from, market: mk })) put('R6', r);
  for (const r of msnrTrades(B, { from, market: mk, against: true })) put('R6x', r);
  lap('msnr');
  if (mk === 'xau') { for (const r of snrTrades(B, { from, market: mk })) put('R7', r); lap('gold plan'); }
  fs.writeFileSync(path.join(dir, `rigor-${mk}.json`), JSON.stringify(rows));
}

// ─── statistics ───
const monthOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function stats(rows, key = 'net') {
  const n = rows.length; if (!n) return { n: 0 };
  const v = rows.map((r) => r[key]), sum = v.reduce((a, b) => a + b, 0), months = new Map(); for (const r of rows) months.set(monthOf(r.t), (months.get(monthOf(r.t)) || 0) + r[key]);
  const ms = [...months.values()], mm = ms.reduce((a, b) => a + b, 0) / ms.length, mv = ms.length > 1 ? ms.reduce((a, b) => a + (b - mm) ** 2, 0) / (ms.length - 1) : 0, t = mv > 0 ? mm / Math.sqrt(mv / ms.length) : null;
  let eq = 0, peak = 0, dd = 0; for (const x of v) { eq += x; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); }
  return { n, win: +(100 * rows.filter((r) => r[key] > 0).length / n).toFixed(1), mean: +(sum / n).toFixed(4), total: +sum.toFixed(2), dd: +dd.toFixed(2), months: ms.length, tMonth: t == null ? null : +t.toFixed(2) };
}
// per month: mean of A minus mean of B (months where both traded); the t of those differences against zero
export function monthDiff(A, B) {
  const m = new Map(); for (const [rows, k] of [[A, 'a'], [B, 'b']]) for (const r of rows) { const x = m.get(monthOf(r.t)) || { a: [], b: [] }; x[k].push(r.net); m.set(monthOf(r.t), x); }
  const d = [...m.values()].filter((x) => x.a.length && x.b.length).map((x) => x.a.reduce((s, v) => s + v, 0) / x.a.length - x.b.reduce((s, v) => s + v, 0) / x.b.length);
  if (d.length < 2) return { months: d.length, diff: null, t: null };
  const mm = d.reduce((a, b) => a + b, 0) / d.length, v = d.reduce((a, b) => a + (b - mm) ** 2, 0) / (d.length - 1);
  return { months: d.length, diff: +mm.toFixed(4), t: v > 0 ? +(mm / Math.sqrt(v / d.length)).toFixed(2) : null };
}
export const pOne = (t) => { if (t == null) return 1; const z = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * z), erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-z * z); const p = 0.5 * (1 - erf); return t > 0 ? p : 1 - p; };
const inWin = (r, w) => r.t >= w[0] && r.t < w[1];

export const READINGS = { R1: 'Mosha sequence (BO, VR, CF, pullback, EG)', R2: 'Mosha barrier entry (D1, H4, H1 barriers)', R3: 'Engulf plan (with the Daily)', R4: 'Engulf simple (not with the Daily)', R5: 'Engulf direct entry (fresh zones)', R6: 'MSNR: with the direction', R7: 'MSNR gold plan' };
export const CONDITIONS = {
  C1: ['R1: the pullback reached 50% before the CF, against not', (r) => r.test === 'R1' && r.deep, (r) => r.test === 'R1' && r.shallow],
  C2: ['R1: CF clear of the VR (case 1), against inside it (case 2)', (r) => r.test === 'R1' && r.c === 1, (r) => r.test === 'R1' && r.c === 2],
  C3: ['R2: barrier is the origin of a major BO, against an internal BO', (r) => r.test === 'R2' && r.bo, (r) => r.test === 'R2' && !r.bo],
  C4: ['R2: entry with the Daily structure, against not with it', (r) => r.test === 'R2' && r.withD, (r) => r.test === 'R2' && !r.withD],
  C5: ['Engulf plan (R3) against the simple method (R4)', (r) => r.test === 'R3', (r) => r.test === 'R4'],
  C6: ['MSNR with the direction (R6) against the same entry against it', (r) => r.test === 'R6', (r) => r.test === 'R6x'] };

function report(dir) {
  let rows = []; for (const mk of MARKETS) rows = rows.concat(JSON.parse(fs.readFileSync(path.join(dir, `rigor-${mk}.json`), 'utf8')).map((r) => { const c = cost(mk, r.entry) / r.r0; return { ...r, market: mk, gross: r.R, net: r.R - c, net2: r.R - 2 * c, costR: c }; }));
  rows.sort((a, b) => a.t - b.t);
  const tests = {};
  for (const [id, what] of Object.entries(READINGS)) { const a = rows.filter((r) => r.test === id), is = a.filter((r) => inWin(r, IS)), oos = a.filter((r) => inWin(r, OOS)), byYear = {}, byMarket = {};
    for (const r of a) { const y = new Date(r.t * 1000).getUTCFullYear(); (byYear[y] ||= []).push(r); } for (const mk of MARKETS) { const o = oos.filter((r) => r.market === mk); if (o.length) byMarket[mk] = { n: o.length, mean: stats(o).mean, total: stats(o).total }; }
    tests[id] = { kind: 'reading', what, is: { gross: stats(is, 'gross'), net: stats(is) }, oos: { gross: stats(oos, 'gross'), net: stats(oos), net2: stats(oos, 'net2'), costR: oos.length ? +(oos.reduce((s, r) => s + r.costR, 0) / oos.length).toFixed(4) : null },
      byYear: Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, { n: v.length, net: +v.reduce((s, r) => s + r.net, 0).toFixed(2) }])), oosByMarket: byMarket, t: stats(oos).tMonth ?? null }; }
  for (const [id, [what, fa, fb]] of Object.entries(CONDITIONS)) { const A = rows.filter(fa), Bq = rows.filter(fb), w = (x, win) => x.filter((r) => inWin(r, win));
    const is = monthDiff(w(A, IS), w(Bq, IS)), oos = monthDiff(w(A, OOS), w(Bq, OOS));
    tests[id] = { kind: 'condition', what, is: { preferred: stats(w(A, IS)), rest: stats(w(Bq, IS)), ...is }, oos: { preferred: stats(w(A, OOS)), rest: stats(w(Bq, OOS)), ...oos }, t: oos.t }; }
  const ids = Object.keys(tests), ps = ids.map((id) => [id, pOne(tests[id].t)]).sort((a, b) => a[1] - b[1]); let run = 0;
  ps.forEach(([id, p], i) => { run = Math.max(run, Math.min(1, p * (ps.length - i))); tests[id].p = +p.toFixed(4); tests[id].holm = +run.toFixed(4); });
  for (const id of ids) { const t = tests[id]; let checks, few;
    if (t.kind === 'reading') { const o = t.oos; few = (o.net.n || 0) < 100; checks = { n100: !few, oosPositive: (o.net.mean || 0) > 0, tAfterHolm: (t.t || 0) >= 2 && t.holm < 0.05, inSamplePositive: (t.is.net.mean || 0) > 0, positiveAt2xCosts: (o.net2.mean || 0) > 0 }; }
    else { few = (t.oos.preferred.n || 0) < 50 || (t.oos.rest.n || 0) < 50; checks = { n50EachSide: !few, oosDifferencePositive: (t.oos.diff || 0) > 0, tAfterHolm: (t.t || 0) >= 2 && t.holm < 0.05, inSampleDifferencePositive: (t.is.diff || 0) > 0 }; }
    t.checks = checks; t.verdict = few ? 'FAIL (too few to judge)' : Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL'; }
  const passed = ids.filter((id) => tests[id].verdict === 'PASS');
  const out = { study: 'desk-rigor', built: new Date().toISOString().slice(0, 10), verdict: passed.length ? `${passed.length} of ${ids.length} pass (${passed.join(', ')})` : `FAIL (0 of ${ids.length})`,
    system: 'The Mosha, Engulfing and MSNR desks\' readings after the marking audit of 21 Nov 2026, and six conditions the methods themselves name; gold, EUR/USD, GBP/USD; OANDA mid M5; in sample 2020-2023, out of sample 2024-2025; net of costs.',
    markets: MARKETS, windows: { is: ['2020-01-01', '2023-12-31'], oos: ['2024-01-01', '2025-12-31'] }, trades: rows.length, tests };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  const f = (v, d = 3) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d)), L = [];
  L.push('# The desks\' readings after the marking audit, and the methods\' own conditions', '', `Built ${out.built}. Pre-registered (PREREGISTRATION.md, committed before any trade was computed). Paper research only.`, '',
    `**Verdict: ${out.verdict}.**`, '', '## Readings: does each make money after costs?', '', '| | Reading | IS n | IS net R | OOS n | OOS before costs | OOS net R | month t | Holm p | Verdict |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const id of Object.keys(READINGS)) { const t = tests[id]; L.push(`| ${id} | ${t.what} | ${t.is.net.n} | ${f(t.is.net.mean)} | ${t.oos.net.n} | ${f(t.oos.gross.mean)} | ${f(t.oos.net.mean)} | ${t.t ?? 'n/a'} | ${t.holm} | ${t.verdict} |`); }
  L.push('', 'R a trade; in sample 2020-2023, out of sample 2024-2025; t on calendar-month sums of net R.', '', '## Conditions: does the subset the method prefers do better?', '', '| | Condition | OOS preferred n | net R | OOS rest n | net R | monthly difference | t | Holm p | IS difference | Verdict |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const id of Object.keys(CONDITIONS)) { const t = tests[id]; L.push(`| ${id} | ${t.what} | ${t.oos.preferred.n} | ${f(t.oos.preferred.mean)} | ${t.oos.rest.n} | ${f(t.oos.rest.mean)} | ${f(t.oos.diff)} | ${t.t ?? 'n/a'} | ${t.holm} | ${f(t.is.diff)} | ${t.verdict} |`); }
  L.push('', '## By market, out of sample (net R a trade, n)', '', '| Reading | ' + MARKETS.join(' | ') + ' |', '|---|' + MARKETS.map(() => '---').join('|') + '|');
  for (const id of Object.keys(READINGS)) L.push(`| ${id} | ` + MARKETS.map((mk) => { const x = tests[id].oosByMarket[mk]; return x ? `${f(x.mean)} (${x.n})` : 'n/a'; }).join(' | ') + ' |');
  L.push('', '## By year (net R, trades)', '', '| Reading | ' + [2020, 2021, 2022, 2023, 2024, 2025].join(' | ') + ' |', '|---|---|---|---|---|---|---|');
  for (const id of Object.keys(READINGS)) L.push(`| ${id} | ` + [2020, 2021, 2022, 2023, 2024, 2025].map((y) => { const x = tests[id].byYear[y]; return x ? `${f(x.net, 1)} (${x.n})` : 'n/a'; }).join(' | ') + ' |');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), L.join('\n') + '\n'); console.log(out.verdict);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'fetch') await fetchAll(a); else if (cmd === 'market') market(a, b); else if (cmd === 'report') report(a);
