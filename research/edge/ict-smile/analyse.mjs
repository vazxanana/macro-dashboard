// ICT x Dollar Smile, step 2: the out-of-sample test of the #507 lead. Pre-registration: preregistration.md (committed before
// any trade was generated or classified). Runs ONCE, on GitHub Actions (.github/workflows/ict-smile.yml), where FRED and Cboe
// answer; the sandbox blocks both. Paper research only: reads data, changes no rule.
//
//   node research/edge/ict-smile/analyse.mjs [outDir=research/edge/ict-smile] [dataDir=research/edge/ict-smile]
//
// For each A-setup in trades.json (build.mjs: ict-universe code on HistData, 2018-01-01 .. 2025-07-31), the Dollar Smile phase
// of the signal's UTC day from council/macro.mjs features() + drivers(), imported unchanged (LAG and MAX_AGE included), on FRED
// history fetched here and macro.mjs's DXY formula on the HistData FX closes in fx-daily.json. Then the one pre-registered
// hypothesis (drop Smile left/right) against the bar, and the descriptive splits. Writes ict-smile.json and ict-smile.md.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { features, drivers, LAG, FRED, CBOE, parseFredCsv, parseCboeCsv, iso } from '../../../council/macro.mjs';

const DAY = 86400;
const r3 = (x) => (x == null || !isFinite(x) ? null : +(+x).toFixed(3));
export const FRED_FROM = '2017-01-01';
// the inputs of smileRegime(): if any of these has no data at all, the run is incomplete (no verdict). HY OAS is expected to
// cover only FRED's last ~3 years of ICE data (declared in the pre-registration), so it needs data, not full coverage.
export const SMILE_SERIES = ['BAMLH0A0HYM2', 'SWPT', 'VIXCLS', 'SOFR', 'EFFR', 'DFII10', 'DGS2'];
export const BAR = { minN: 30, maxT: -2 };

// ─── statistics (as research/edge/ict-macro/analyse.mjs) ──────────────────────────────────────────────────────────────────
function betacf(a, b, x) {
  let c = 1, d = 1 - (a + b) * x / (a + 1); d = 1 / (Math.abs(d) < 1e-300 ? 1e-300 : d); let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-300 ? 1e-300 : d); c = 1 + aa / c; c = Math.abs(c) < 1e-300 ? 1e-300 : c; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-300 ? 1e-300 : d); c = 1 + aa / c; c = Math.abs(c) < 1e-300 ? 1e-300 : c; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return h;
}
function lgamma(z) { const g = 7, C = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1; let x = C[0]; for (let i = 1; i < g + 2; i++) x += C[i] / (z + i); const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x); }
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
export const tCdf = (t, df) => { const x = df / (df + t * t), p = 0.5 * ibeta(df / 2, 0.5, x); return t > 0 ? 1 - p : p; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
export function stats(rs) {
  const n = rs.length; if (!n) return { n: 0 };
  const m = mean(rs), sd = n > 1 ? Math.sqrt(rs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)) : 0, t = sd > 0 ? m / (sd / Math.sqrt(n)) : 0;
  return { n, R: r3(rs.reduce((s, x) => s + x, 0)), exp: r3(m), wr: r3(rs.filter((x) => x > 0).length / n), t: r3(t), pLow: n > 1 && sd > 0 ? r3(tCdf(t, n - 1)) : null };
}
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const ma = mean(a), mb = mean(b), va = a.reduce((s, x) => s + (x - ma) ** 2, 0) / (a.length - 1), vb = b.reduce((s, x) => s + (x - mb) ** 2, 0) / (b.length - 1);
  const se = Math.sqrt(va / a.length + vb / b.length); if (!(se > 0)) return null;
  const t = (ma - mb) / se, df = (va / a.length + vb / b.length) ** 2 / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1));
  return { diff: r3(ma - mb), t: r3(t), p2: r3(2 * Math.min(tCdf(t, df), 1 - tCdf(t, df))) };
}
// a group: stats and both halves by close time (split by count, as ictVariantVerdicts)
export function cell(rows, key = 'R') {
  const s = rows.slice().sort((x, y) => x.closed - y.closed), h = s.length >> 1;
  return { ...stats(s.map((x) => x[key])), h1: stats(s.slice(0, h).map((x) => x[key])), h2: stats(s.slice(h).map((x) => x[key])) };
}
export const passes = (d) => !!(d && d.n >= BAR.minN && d.t <= BAR.maxT && d.h1.n && d.h2.n && d.h1.exp < 0 && d.h2.exp < 0);

// ─── data ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' };
async function get(fetchImpl, url, ms = 30000, headers = UA) {
  try { const r = await fetchImpl(url, { headers, signal: AbortSignal.timeout(ms) }); if (!r.ok) return { err: `HTTP ${r.status}` }; return { body: await r.text() }; }
  catch (e) { return { err: String((e && e.message) || e).slice(0, 80) }; }
}
// every FRED series macro.mjs knows, full history from FRED_FROM (gather() takes 5 years only); VIX / VIX3M fall back to Cboe
export async function fetchFred(fetchImpl, ids = [...SMILE_SERIES, ...FRED.filter((id) => !SMILE_SERIES.includes(id))]) {   // the Smile's inputs first
  const fred = {}, src = {};
  const HEAD = [[{ 'User-Agent': 'macro-dashboard-council/1.0 (+https://meridianx.dev)', Accept: 'text/csv,*/*' }, 30000], [UA, 20000]];
  let fails = 0;   // after 3 series in a row fail, FRED counts as down for this run (as gather()); the rest go to Cboe or fail
  for (const id of ids) {   // one at a time: FRED throttles bursts from one runner
    let obs = [], err = 'skipped: FRED down this run';
    for (let k = 0; k < 2 && !obs.length && fails < 3; k++) for (const [h, ms] of HEAD) {
      const r = await get(fetchImpl, `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${FRED_FROM}`, ms, h);
      obs = r.body ? parseFredCsv(r.body) : []; err = r.err || (obs.length ? null : 'empty'); if (obs.length) break;
    }
    fails = obs.length ? 0 : fails + 1;
    if (!obs.length && CBOE[id]) { const r = await get(fetchImpl, CBOE[id]); const co = r.body ? parseCboeCsv(r.body).filter((o) => o.t >= Date.parse(FRED_FROM) / 1000) : [];
      if (co.length) { fred[id] = co; src[id] = `FRED failed (${err}), Cboe ok`; continue; } }
    if (obs.length) { fred[id] = obs; src[id] = 'FRED ok'; } else src[id] = `failed (${err})`;
  }
  return { fred, src };
}
export function fxBars(fx) {
  const bars = {};
  for (const k of ['eurusd', 'usdjpy', 'gbpusd', 'usdcad', 'usdchf']) bars[k] = (fx[k] || []).map(([time, close]) => ({ time, open: close, high: close, low: close, close }));
  return bars;
}

// ─── regime per trade: macro.mjs unchanged; vixLag only for the pre-registered 1-day sensitivity ───────────────────────────
export function classify(data, trades, vixLag = null) {
  const keep = [LAG.VIXCLS, LAG.VXVCLS], memo = new Map();
  if (vixLag != null) LAG.VIXCLS = LAG.VXVCLS = vixLag;
  try {
    return trades.map((t) => {
      const D = Math.floor(t.signalAt / DAY) * DAY;
      if (!memo.has(D)) { const f = features(data, D), { smile } = drivers(f);
        memo.set(D, { day: iso(D), smile: smile ? smile.phase : null, dxy5d: r3(f.dm), hyChg: f.hy && f.hy.chg != null ? r3(f.hy.chg) : null, vix: f.vix,
          sofrBps: f.sofrBps, swapBn: f.swapBn, ryChg: f.ry ? r3(f.ry.chg) : null, d2Chg: f.d2 && f.d2.chg != null ? r3(f.d2.chg) : null }); }
      return { ...t, rg: memo.get(D) };
    });
  } finally { [LAG.VIXCLS, LAG.VXVCLS] = keep; }
}
export const isBid = (p) => p === 'left' || p === 'right';
const yearOf = (t) => new Date(t.signalAt * 1000).getUTCFullYear();

// the full report for one classification
export function analyse(rows, key = 'R') {
  const OK = rows.filter((t) => t.rg.smile), NO = rows.filter((t) => !t.rg.smile);
  const bid = OK.filter((t) => isBid(t.rg.smile)), rest = OK.filter((t) => !isBid(t.rg.smile)), R = (a) => a.map((x) => x[key]);
  const split = (fn) => { const g = {}; for (const t of OK) (g[fn(t)] = g[fn(t)] || []).push(t);
    return Object.fromEntries(Object.keys(g).sort().map((k) => { const b = g[k].filter((t) => isBid(t.rg.smile)), r = g[k].filter((t) => !isBid(t.rg.smile));
      return [k, { bid: cell(b, key), rest: cell(r, key), diff: welch(R(b), R(r)) }]; })); };
  const dropped = cell(bid, key);
  return {
    all: stats(R(rows)), withRegime: stats(R(OK)), noRegime: stats(R(NO)),
    phases: Object.fromEntries(['left', 'right', 'trough', 'mid'].map((p) => [p, cell(OK.filter((t) => t.rg.smile === p), key)])),
    H: { rule: 'nosmilex: drop A-setups when the Dollar Smile is left or right (dollar bid)', dropped, kept: cell(rest, key), diff: welch(R(bid), R(rest)), pass: passes(dropped) },
    byMarket: split((t) => t.market), byYear: split((t) => String(yearOf(t))),
  };
}

const f = (s) => (s && s.n ? `${s.n} | ${s.exp >= 0 ? '+' : ''}${s.exp} | ${s.t}` : '0 | – | –');
const h = (c) => (c && c.n ? `${c.h1.exp ?? '–'} / ${c.h2.exp ?? '–'}` : '–');
export function markdown(res) {
  if (res.status !== 'ok') return `# ICT x Dollar Smile (out-of-sample)\n\nRun ${res.at}: **incomplete**, no verdict. ${res.why}\n\nSources: ${JSON.stringify(res.sources)}\n`;
  const P = res.primary, L = [`# ICT x Dollar Smile: out-of-sample test of the #507 lead`, '', `Run ${res.at}. Pre-registration: research/edge/ict-smile/preregistration.md.`,
    `Trades: ${res.trades.n} A-setups (GC gold rule, NQ/ES = NAS100/SPX cash, index rule), ${res.trades.window.join(' to ')}; ${P.noRegime.n || 0} without a Smile phase.`, '',
    `**Verdict: ${res.verdict.toUpperCase()}.** Dropped (left + right): ${f(P.H.dropped)} (n | R/trade | t), halves ${h(P.H.dropped)}. Bar: n ≥ 30, t ≤ −2, both halves < 0.`,
    `Kept (mid + trough): ${f(P.H.kept)}, halves ${h(P.H.kept)}. Difference ${P.H.diff ? `${P.H.diff.diff} (Welch t ${P.H.diff.t})` : '–'}.`, '',
    '## By Smile phase (gross R x size)', '', '| phase | n | R/trade | t | halves |', '|---|---|---|---|---|',
    ...Object.entries(P.phases).map(([k, c]) => `| ${k} | ${f(c)} | ${h(c)} |`), '',
    '## Dollar bid (left + right) vs mid + trough, by market', '', '| market | bid n | bid R/t | bid t | rest n | rest R/t | rest t | diff (Welch t) |', '|---|---|---|---|---|---|---|---|',
    ...Object.entries(P.byMarket).map(([k, v]) => `| ${k} | ${f(v.bid)} | ${f(v.rest)} | ${v.diff ? `${v.diff.diff} (${v.diff.t})` : '–'} |`), '',
    '## By year', '', '| year | bid n | bid R/t | bid t | rest n | rest R/t | rest t | diff (Welch t) |', '|---|---|---|---|---|---|---|---|',
    ...Object.entries(P.byYear).map(([k, v]) => `| ${k} | ${f(v.bid)} | ${f(v.rest)} | ${v.diff ? `${v.diff.diff} (${v.diff.t})` : '–'} |`), '',
    '## Sensitivities (descriptive, not pass routes)', '', '| version | dropped n | R/trade | t | halves | kept n | kept R/trade | kept t | meets the bar? |', '|---|---|---|---|---|---|---|---|---|',
    ...Object.entries(res.sensitivity).map(([k, s]) => `| ${k} | ${f(s.H.dropped)} | ${h(s.H.dropped)} | ${f(s.H.kept)} | ${s.H.pass ? 'yes' : 'no'} |`), '',
    `HY OAS covers ${res.coverage.hyDays} of ${res.coverage.days} trade days (from ${res.coverage.hyFrom}). Phase counts by HY coverage: ${JSON.stringify(res.coverage.phaseByHy)}.`, ''];
  return L.join('\n');
}

export async function run({ fetchImpl = globalThis.fetch, dataDir = 'research/edge/ict-smile', now = Date.now() } = {}) {
  const T = JSON.parse(fs.readFileSync(path.join(dataDir, 'trades.json'), 'utf8')), fx = JSON.parse(fs.readFileSync(path.join(dataDir, 'fx-daily.json'), 'utf8'));
  const { fred, src } = await fetchFred(fetchImpl);
  const coverage = Object.fromEntries(Object.entries(fred).map(([k, a]) => [k, `${iso(a[0].t)} → ${iso(a[a.length - 1].t)} (${a.length})`]));
  const base = { topic: 'ict-smile', at: new Date(now).toISOString(), preregistration: 'research/edge/ict-smile/preregistration.md', sources: src, fredCoverage: coverage,
    trades: { n: T.trades.length, window: T.window, source: T.source } };
  const missing = SMILE_SERIES.filter((id) => !fred[id] || !fred[id].length);
  if (missing.length) return { ...base, status: 'incomplete', why: `no data for ${missing.join(', ')}; re-run the same code (pre-registration: no re-choosing)`, verdict: null };
  const data = { fred, bars: fxBars(fx), cot: [], cal: [] };
  const rows = classify(data, T.trades), rows1 = classify(data, T.trades, 1);
  const primary = analyse(rows), hyRows = rows.filter((t) => t.rg.hyChg != null);
  const days = new Map(rows.map((t) => [t.rg.day, t.rg])), phaseByHy = {};
  for (const g of days.values()) { const k = g.hyChg != null ? 'hy' : 'noHy'; phaseByHy[k] = phaseByHy[k] || {}; phaseByHy[k][g.smile] = (phaseByHy[k][g.smile] || 0) + 1; }
  return { ...base, status: 'ok', verdict: primary.H.pass ? 'pass' : 'fail',
    bar: 'dropped trades (Smile left or right): n >= 30, t <= -2, mean R < 0 in both halves (by close time, split by count)', primary,
    sensitivity: { 'net of costs': analyse(rows, 'net'), 'VIX lag 1 day (#507)': analyse(rows1), 'HY-covered days only': analyse(hyRows) },
    coverage: { days: days.size, hyDays: [...days.values()].filter((g) => g.hyChg != null).length, hyFrom: fred.BAMLH0A0HYM2 ? iso(fred.BAMLH0A0HYM2[0].t) : null, phaseByHy },
    perTrade: rows.map((t) => [t.id, t.rg.smile, t.R]) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [outDir = 'research/edge/ict-smile', dataDir = 'research/edge/ict-smile'] = process.argv.slice(2);
  const res = await run({ dataDir });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'ict-smile.json'), JSON.stringify(res, null, 1));
  fs.writeFileSync(path.join(outDir, 'ict-smile.md'), markdown(res));
  console.log(markdown(res));
}
