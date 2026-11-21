// The desk slices on 2020 to August 2026 (PREREGISTRATION.md, 21 Nov 2026). The desk's own code, imported and not edited.
//   node --use-env-proxy research/edge/desk-slices/run.mjs fetch <dir>   candles into <dir> (outside git)
//   node research/edge/desk-slices/run.mjs run <dir>                     result.json and RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { egTrades, litTrades, LIT_SETS, DESKS } from '../../../council/edge-desks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MD = (process.env.MD_BASE || 'https://aureumdesk.co.uk/md/').replace(/\/?$/, '/');
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const WARM = T('2019-06-01'), IS = [T('2020-01-01'), T('2024-01-01')], OOS = [T('2024-01-01'), T('2026-08-23')], DESK_LIT_FROM = T('2026-05-25');
const SEC = { '5m': 300, '1h': 3600, '4h': 14400, '1d': 86400 };
export const EG_MARKETS = ['eurusd', 'gbpusd'], LIT_MARKETS = DESKS.lit.markets;
// round-trip cost as a price distance (PREREGISTRATION.md "Costs")
const PIP = { eurusd: 0.0001, gbpusd: 0.0001, audusd: 0.0001, usdcad: 0.0001, usdjpy: 0.01 };
export const cost = (mk, px) => (PIP[mk] ? 0.000045 * px + 0.5 * PIP[mk] : px * ({ xau: 0.00005, xag: 0.0005, nas100: 0.000027, spx500: 0.000047, us30: 0.00005, de40: 0.00005 })[mk]);
const file = (dir, mk, tf) => path.join(dir, `${mk}-${tf}.json.gz`);
const load = (dir, mk, tf) => JSON.parse(zlib.gunzipSync(fs.readFileSync(file(dir, mk, tf)))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));

async function fetchTf(mk, tf, to) {
  const out = new Map(), sec = SEC[tf];
  for (let f = WARM; f < to; f += 4000 * sec) { const t2 = Math.min(to, f + 4000 * sec); let ok = false;
    for (let tr = 0; tr < 4 && !ok; tr++) { try { const r = await fetch(`${MD}bars?sym=${mk}&tf=${tf}&from=${f}&to=${t2}`, { signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json(); for (const b of (j.bars || j || [])) if (b.time + sec <= to) out.set(b.time, [b.time, b.open, b.high, b.low, b.close]); ok = true; } catch (e) { if (tr === 3) throw new Error(`${mk} ${tf} ${f}: ${e.message}`); await new Promise((s) => setTimeout(s, 1500 * (tr + 1))); } } }
  return [...out.values()].sort((a, b) => a[0] - b[0]);
}
async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true }); const to = Math.floor(Date.now() / 1000), jobs = [];
  for (const mk of LIT_MARKETS) jobs.push([mk, '5m']); for (const mk of EG_MARKETS) for (const tf of ['1h', '4h', '1d']) jobs.push([mk, tf]);
  let i = 0; const work = async () => { while (i < jobs.length) { const [mk, tf] = jobs[i++]; if (fs.existsSync(file(dir, mk, tf))) continue; const rows = await fetchTf(mk, tf, to); fs.writeFileSync(file(dir, mk, tf), zlib.gzipSync(JSON.stringify(rows))); console.log(mk, tf, rows.length); } };
  await Promise.all([work(), work(), work()]);
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
const pOne = (t) => { if (t == null) return 1; const z = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * z), erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-z * z); const p = 0.5 * (1 - erf); return t > 0 ? p : 1 - p; };
const inWin = (r, w) => r.t >= w[0] && r.t < w[1];
const prep = (trs, mk) => trs.filter((r) => r.R != null).map((r) => { const c = cost(mk, r.entry) / r.r0; return { t: r.t, kind: r.kind, market: mk, gross: r.R, net: r.R - c, net2: r.R - 2 * c, costR: c }; });
function block(rows, extra = {}) {
  const w = (win) => rows.filter((r) => inWin(r, win)), is = w(IS), oos = w(OOS), byYear = {};
  for (const r of rows.filter((r) => inWin(r, [IS[0], OOS[1]]))) { const y = new Date(r.t * 1000).getUTCFullYear(); (byYear[y] ||= []).push(r); }
  return { is: { gross: stats(is, 'gross'), net: stats(is), net2: stats(is, 'net2') }, oos: { gross: stats(oos, 'gross'), net: stats(oos), net2: stats(oos, 'net2'), costR: oos.length ? +(oos.reduce((a, r) => a + r.costR, 0) / oos.length).toFixed(4) : null },
    byYear: Object.fromEntries(Object.entries(byYear).map(([y, a]) => [y, { n: a.length, net: +a.reduce((s, r) => s + r.net, 0).toFixed(2) }])), ...extra };
}
function run(dir) {
  const tests = {};
  for (const [id, mk] of [['T1', 'eurusd'], ['T2', 'gbpusd']]) { const B = {}; for (const tf of ['1d', '4h', '1h', '5m']) B[tf] = load(dir, mk, tf);
    const rows = prep(egTrades(B, { from: IS[0], market: mk }), mk), byTf = {}; for (const tf of ['1d', '4h', '1h']) { const a = rows.filter((r) => r.kind === 'eg-' + tf && inWin(r, OOS)); byTf[tf] = { n: a.length, net: stats(a).mean ?? null, total: stats(a).total ?? null }; }
    tests[id] = { what: `Engulf reading on ${mk === 'eurusd' ? 'EUR/USD' : 'GBP/USD'} (D1, H4, H1; buys and sells)`, ...block(rows, { oosByTimeframe: byTf }) }; console.log(id, JSON.stringify(tests[id].oos.net)); }
  { let rows = [], all = 0; const byMk = {};
    for (const mk of LIT_MARKETS) { const lit = litTrades({ '5m': load(dir, mk, '5m') }, { from: IS[0], market: mk }); all += lit.length; const a = prep(lit.filter((r) => r.kind === 'lit-break'), mk); rows = rows.concat(a); const o = a.filter((r) => inWin(r, OOS)); byMk[mk] = { n: o.length, total: +o.reduce((s, r) => s + r.net, 0).toFixed(2) }; console.log('lit', mk, lit.length, a.length); }
    rows.sort((a, b) => a.t - b.t); const pre = rows.filter((r) => r.t >= OOS[0] && r.t < DESK_LIT_FROM), seen = rows.filter((r) => r.t >= DESK_LIT_FROM && r.t < OOS[1]);
    tests.T3 = { what: 'LIT reading, the "market on the break" execution, eleven markets pooled', litTradesAllExecutions: all, ...block(rows, { oosByMarket: byMk, oosBeforeTheDeskFile: stats(pre), oosInsideTheDeskFile: stats(seen) }) }; console.log('T3', JSON.stringify(tests.T3.oos.net)); }
  // AFTER THE RESULT, not pre-registered (see RESULT.md): the desk tries the two limit executions first and records a
  // "market on the break" trade only when neither limit filled, which is known only LATER than the market entry. The same
  // market entry on EVERY candidate (no limit tried first, one position at a time) is the stream a trader could have taken.
  let every = null; { let rows = []; const only = LIT_SETS.filter((x) => x.id === 'break');
    for (const mk of LIT_MARKETS) rows = rows.concat(prep(litTrades({ '5m': load(dir, mk, '5m') }, { from: IS[0], market: mk, sets: only }), mk));
    rows.sort((a, b) => a.t - b.t); every = block(rows); console.log('T3 every candidate', JSON.stringify(every.oos.net)); }
  const ids = Object.keys(tests), ps = ids.map((id) => [id, pOne(tests[id].oos.net.tMonth)]).sort((a, b) => a[1] - b[1]); let run = 0;
  ps.forEach(([id, p], i) => { run = Math.max(run, Math.min(1, p * (ps.length - i))); tests[id].p = +p.toFixed(4); tests[id].holm = +run.toFixed(4); });
  for (const id of ids) { const t = tests[id], o = t.oos, checks = { n100: (o.net.n || 0) >= 100, oosPositive: (o.net.mean || 0) > 0, tAfterHolm: (o.net.tMonth || 0) >= 2 && t.holm < 0.05, inSamplePositive: (t.is.net.mean || 0) > 0, positiveAt2xCosts: (o.net2.mean || 0) > 0 };
    t.checks = checks; t.verdict = !checks.n100 ? 'FAIL (too few to judge)' : Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL'; }
  tests.T3.onPreRegisteredChecks = tests.T3.verdict; tests.T3.afterTheResult = { what: 'Market on the break on EVERY candidate (no limit tried first): the stream that could be traded', ...every };
  tests.T3.verdict = 'INVALID'; tests.T3.why = 'The desk records a "market on the break" trade only when neither limit order filled, which is known after the market entry: the stream is chosen with knowledge of the future.';
  const passed = ids.filter((id) => tests[id].verdict === 'PASS').length;
  const out = { study: 'desk-slices', built: new Date().toISOString().slice(0, 10), verdict: passed ? `PASS (${passed} of ${ids.length})` : 'FAIL (0 of 3: two fail, one invalid)', windows: { inSample: '2020-01-01 to 2023-12-31', outOfSample: '2024-01-01 to 2026-08-22' }, tests };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); return out;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) { const [, , cmd, dir] = process.argv;
  if (cmd === 'fetch') fetchAll(dir).catch((e) => { console.error(e.message); process.exit(1); }); else if (cmd === 'run') console.log(JSON.stringify(run(dir).verdict)); else console.log('usage: run.mjs fetch|run <dir>'); }
