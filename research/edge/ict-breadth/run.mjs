// ICT breadth test (pre-registered in preregistration.md, committed before this ran): the UNCHANGED desk A-setup rule on markets the
// desk was never tuned on, over 2008-2017 and 2018-2026 separately. The harness is research/edge/ict-oos-2008/run.mjs (#526),
// generalised to more markets; it drives the desk's own code, unchanged: signals() / isASetup() / isAPlus() / sizeOf() / MIN_GRADE /
// MARKETS / SHADOW_MARKETS / inHalt() / cmeShut() / agg() / dailyNY() from ict/tracker.mjs and simulate() from ict/replay.mjs, over
// OANDA 5m mid candles fetched by research/edge/ict-oos-2008/fetch.mjs (same cache). Paper research only: nothing live changes.
//   node research/edge/ict-oos-2008/fetch.mjs <cache> 2007-06-01 2026-11-01 de40,xag,eurusd,gbpusd,usdjpy,audusd,usdcad,usdchf,nzdusd,eurjpy,gbpjpy
//   node research/edge/ict-breadth/run.mjs <cache> [result.json]      (trades -> <cache>/breadth-trades.json)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { MARKETS, SHADOW_MARKETS, MIN_GRADE, signals, isASetup, isAPlus, sizeOf, inHalt, cmeShut, agg, dailyNY } from '../../../ict/tracker.mjs';
import { simulate } from '../../../ict/replay.mjs';

const [DIR, OUT = 'research/edge/ict-breadth/result.json'] = process.argv.slice(2);
if (!DIR) { console.error('usage: run.mjs <cacheDir> [result.json]'); process.exit(1); }

// The desk's two rule sets, unchanged. 'index' = the tracker's default for a market without an aRule (NQ/ES/YM/RTY);
// 'gold' = GC's aRule (also what the tracker's own silver shadow market uses). The desk key only selects the rule set.
const RULE = { index: 'nq', gold: 'gc' };
const fxM = (label, jpy) => ({ label, short: label.replace('/', ''), tick: jpy ? 0.001 : 0.00001, dec: jpy ? 3 : 5 });
// set: H1 = new index/metal markets (primary), H2 = FX (secondary), ref = the desk's own markets (#526, reference only).
// cost = one round trip (spread + slippage) in price units, preregistration.md. m5min = 5m candles a UTC day needs for 5m exits.
const U = {
  de40:   { set: 'H1', sym: 'de40',   rule: 'index', M: { label: 'DAX (DE30_EUR CFD)', short: 'DE40', tick: 0.1, dec: 1 }, cost: (p) => p * 0.0002 + 1.0, m5min: 150 },
  xag:    { set: 'H1', sym: 'xag',    rule: 'gold',  M: SHADOW_MARKETS.xag, cost: () => 0.04, m5min: 200 },
  eurusd: { set: 'H2', sym: 'eurusd', rule: 'index', M: fxM('EUR/USD'), cost: () => 0.00015, m5min: 200 },
  gbpusd: { set: 'H2', sym: 'gbpusd', rule: 'index', M: fxM('GBP/USD'), cost: () => 0.0002, m5min: 200 },
  audusd: { set: 'H2', sym: 'audusd', rule: 'index', M: fxM('AUD/USD'), cost: () => 0.00015, m5min: 200 },
  nzdusd: { set: 'H2', sym: 'nzdusd', rule: 'index', M: fxM('NZD/USD'), cost: () => 0.0002, m5min: 200 },
  usdcad: { set: 'H2', sym: 'usdcad', rule: 'index', M: fxM('USD/CAD'), cost: () => 0.0002, m5min: 200 },
  usdchf: { set: 'H2', sym: 'usdchf', rule: 'index', M: fxM('USD/CHF'), cost: () => 0.0002, m5min: 200 },
  usdjpy: { set: 'H2', sym: 'usdjpy', rule: 'index', M: fxM('USD/JPY', 1), cost: () => 0.015, m5min: 200 },
  eurjpy: { set: 'H2', sym: 'eurjpy', rule: 'index', M: fxM('EUR/JPY', 1), cost: () => 0.02, m5min: 200 },
  gbpjpy: { set: 'H2', sym: 'gbpjpy', rule: 'index', M: fxM('GBP/JPY', 1), cost: () => 0.03, m5min: 200 },
  gc:     { set: 'ref', sym: 'xau',    rule: 'gold',  M: MARKETS.gc, cost: () => 0.5, m5min: 200 },
  nq:     { set: 'ref', sym: 'nas100', rule: 'index', M: MARKETS.nq, cost: (p) => p * 0.0002 + 0.25, m5min: 200 },
  es:     { set: 'ref', sym: 'spx500', rule: 'index', M: MARKETS.es, cost: (p) => p * 0.0002 + 0.25, m5min: 200 },
  ym:     { set: 'ref', sym: 'us30',   rule: 'index', M: MARKETS.ym, cost: (p) => p * 0.0002 + 1, m5min: 200 },
};
// sensitivity (reported only): DE40 with the #526 harness's unchanged 200-candle day test, i.e. H1 exits on its 14-hour days (2008-18)
const SENS = { de40_m5min200: { ...U.de40, set: 'sens', m5min: 200, base: 'de40' } };

function load(sym) {
  const files = fs.readdirSync(DIR).filter((f) => f.startsWith(sym + '-') && f.endsWith('.json.gz')).sort(), m5 = [];
  for (const f of files) for (const [t, o, h, l, c] of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, f))))) {
    if (inHalt(t) || cmeShut(t)) continue;   // the live futures feed's closedBar(), as #526
    if (!(o > 0 && h > 0 && l > 0 && c > 0)) continue;
    m5.push({ time: t, open: o, high: Math.max(h, o, c), low: Math.min(l, o, c), close: c });
  }
  return m5.sort((a, b) => a.time - b.time);
}
const lb = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };

const COLS = ['market', 'cfg', 'side', 'close', 'aset', 'aplus', 'size', 'Rraw', 'costR', 'session', 'atrR', 'grade', 'exit', 'res', 'closed'];
const res = { at: new Date().toISOString(), src: {}, coverage: {}, trades: [] };
const cache = new Map();
for (const [key, u] of Object.entries({ ...U, ...SENS })) {
  const t0 = Date.now(), M = u.M, rk = RULE[u.rule];
  if (!cache.has(u.sym)) { cache.clear(); const m5 = load(u.sym), H = agg(m5, 3600); cache.set(u.sym, { m5, H, D: dailyNY(H) }); }
  const { m5, H, D } = cache.get(u.sym);
  const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
  const m5days = new Set([...days.entries()].filter(([, n]) => n >= u.m5min).map(([d]) => d));
  const cov = {}; for (const b of H) { const y = new Date(b.time * 1000).getUTCFullYear(); (cov[y] = cov[y] || { h1: 0, m5: 0, days: 0, m5days: 0 }).h1++; }
  for (const [d, n] of days) { const y = new Date(d * 86400000).getUTCFullYear(); if (!cov[y]) continue; cov[y].m5 += n; cov[y].days++; if (n >= u.m5min) cov[y].m5days++; }
  res.coverage[key] = cov;
  const sig = signals(H, D, 1, M.tick).concat(signals(H, D, -1, M.tick)).filter((g) => g.grade.total >= MIN_GRADE).sort((a, b) => a.close - b.close);
  let busyAll = 0, busyA = 0, gaps = 0;
  for (const g of sig) {
    const a = isASetup(g, rk); if (g.close < (a ? busyA : busyAll)) continue;
    const i = lb(H, g.close), j = lb(m5, g.close);
    const t = simulate(g, M, key, { H: H.slice(i, i + 120), m5: m5.slice(j, j + 12 * 24 * 12), m5days }); if (!t) { gaps++; continue; }
    if (!t.closed) continue;
    const size = a ? sizeOf(g, rk) : 1, c = u.cost(g.entry) / g.r0;
    res.trades.push([key, 'rule', g.side, g.close, a ? 1 : 0, a && isAPlus(g, rk) ? 1 : 0, size, +t.R.toFixed(3), +c.toFixed(4), g.feat.session, g.feat.atrR, g.grade.total, t.exit, t.res, t.closed]);
    busyAll = Math.max(busyAll, t.closed); if (a) busyA = t.closed;
  }
  res.src[key] = { set: u.set, sym: u.sym, rule: u.rule, m5min: u.m5min, cost: u.cost.toString(), m5: m5.length, h1: H.length, d1: D.length, from: new Date(m5[0].time * 1000).toISOString().slice(0, 10), to: new Date(m5.at(-1).time * 1000).toISOString().slice(0, 10), signals: sig.length, gaps };
  // drift control for the gold-rule markets (reported only), as #526: random H1-close buys, stop 0.3-0.75x the daily ATR14, gold exit, same costs
  if (u.rule === 'gold' && u.set !== 'sens') {
    let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = 60; i < H.length - 40; i++) {
      if (rnd() > 0.04) continue;
      const close = H[i].time + 3600, di = D.findLastIndex((d) => d.time + 86400 <= close); if (di < 14) continue;
      const atrD = D.slice(di - 13, di + 1).reduce((s, d) => s + (d.high - d.low), 0) / 14, k = 0.3 + 0.45 * rnd(), e = H[i].close, r0 = k * atrD;
      const g = { side: 1, entry: e, r0, stop: e - r0, close, t: H[i].time, sweepT: H[i].time, swept: e, fvg: [e, e], ih: null, dol: null, valid: true, feat: {}, grade: { total: 0 } };
      const j = lb(m5, close), t = simulate(g, M, key, { H: H.slice(i + 1, i + 121), m5: m5.slice(j, j + 12 * 24 * 12), m5days });
      if (!t || !t.closed) continue;
      res.trades.push([key, 'ctrlbuy', 1, close, 0, 0, 1, +t.R.toFixed(3), +(u.cost(e) / r0).toFixed(4), null, +k.toFixed(3), null, t.exit, t.res, t.closed]);
    }
  }
  console.log(key, JSON.stringify(res.src[key]), ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
res.cols = COLS;
fs.writeFileSync(path.join(DIR, 'breadth-trades.json'), JSON.stringify(res));

// ---------- statistics and the pre-registered verdicts ----------
const T = res.trades.map((r) => Object.fromEntries(COLS.map((c, i) => [c, r[i]])));
for (const t of T) { const d = new Date(t.close * 1000); t.year = d.getUTCFullYear(); t.month = `${t.year}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  t.gross = t.size * t.Rraw; t.net = t.size * (t.Rraw - t.costR); t.net2 = t.size * (t.Rraw - 2 * t.costR); }
const W = { A: [Date.UTC(2008, 0, 1) / 1000, Date.UTC(2018, 0, 1) / 1000, 2013], B: [Date.UTC(2018, 0, 1) / 1000, Date.UTC(2026, 10, 1) / 1000, 2022] };
const inW = (t, w) => t.close >= W[w][0] && t.close < W[w][1];
function stats(a, f = 'net') {
  a = [...a].sort((x, y) => x.closed - y.closed);
  const r = a.map((x) => x[f]), n = r.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, streak: 0, t: null };
  const R = r.reduce((s, x) => s + x, 0), m = R / n, sd = Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, pk = 0, dd = 0, st = 0, ws = 0; for (const x of r) { eq += x; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); st = x < 0 ? st + 1 : 0; ws = Math.max(ws, st); }
  return { n, wr: +(r.filter((x) => x > 0).length / n).toFixed(3), exp: +m.toFixed(3), R: +R.toFixed(1), maxDD: +dd.toFixed(1), streak: ws, t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null };
}
function monthlyT(a, w, f = 'net') {
  const s = new Map(); for (const x of a) s.set(x.month, (s.get(x.month) || 0) + x[f]);
  const ms = []; for (let t = W[w][0]; t < W[w][1]; ) { const d = new Date(t * 1000), k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; ms.push(s.get(k) || 0); t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000; }
  const n = ms.length, m = ms.reduce((p, x) => p + x, 0) / n, sd = Math.sqrt(ms.reduce((p, x) => p + (x - m) ** 2, 0) / (n - 1));
  return { months: n, meanR: +m.toFixed(2), t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null };
}
const A = (mk, w) => T.filter((t) => mk.includes(t.market) && t.cfg === 'rule' && t.aset && inW(t, w));
function marketStats(m, w) {
  const b = A([m], w), half = W[w][2], years = [...new Set(b.map((t) => t.year))].sort();
  const ctrl = T.filter((t) => t.market === m && t.cfg === 'ctrlbuy' && inW(t, w));
  const o = { net: stats(b), net2: stats(b, 'net2'), gross: stats(b, 'gross'), first: stats(b.filter((t) => t.year < half)), second: stats(b.filter((t) => t.year >= half)),
    buys: stats(b.filter((t) => t.side > 0)), sells: stats(b.filter((t) => t.side < 0)), allSignals: stats(T.filter((t) => t.market === m && t.cfg === 'rule' && inW(t, w))),
    monthly: monthlyT(b, w), years: Object.fromEntries(years.map((y) => [y, stats(b.filter((t) => t.year === y))])) };
  if (ctrl.length) { const cy = new Map(years.map((y) => { const c = ctrl.filter((t) => t.year === y); return [y, c.length ? c.reduce((s, t) => s + t.net, 0) / c.length : 0]; }));
    const adj = b.map((t) => ({ ...t, adj: t.net - t.size * cy.get(t.year) }));
    o.drift = { control: stats(ctrl), adjusted: stats(adj, 'adj'), years: Object.fromEntries(years.map((y) => [y, { ctrl: +cy.get(y).toFixed(3), a: stats(b.filter((t) => t.year === y)).exp, adj: stats(adj.filter((t) => t.year === y), 'adj').exp }])) }; }
  return o;
}
function setStats(mk, w) {
  const a = A(mk, w), half = W[w][2], years = [...new Set(a.map((t) => t.year))].sort();
  return { pooled: { net: stats(a), net2: stats(a, 'net2'), gross: stats(a, 'gross'), monthly: monthlyT(a, w), monthly2: monthlyT(a, w, 'net2') },
    halves: { split: half, first: stats(a.filter((t) => t.year < half)), second: stats(a.filter((t) => t.year >= half)) },
    sides: { buys: stats(a.filter((t) => t.side > 0)), sells: stats(a.filter((t) => t.side < 0)) },
    years: Object.fromEntries(years.map((y) => [y, { net: stats(a.filter((t) => t.year === y)), net2: stats(a.filter((t) => t.year === y), 'net2') }])),
    markets: Object.fromEntries(mk.map((m) => [m, marketStats(m, w)])) };
}
// verdict for a market set: P_w = pooled net (costs x1) > 0 with t >= 2; M_w = at least ceil(0.6 x K) markets with net > 0
function verdict(s, K) {
  const need = Math.ceil(0.6 * K - 1e-9), v = {};
  for (const w of ['A', 'B']) { const p = s[w].pooled.net, pos = Object.values(s[w].markets).filter((x) => x.net.exp > 0).length;
    v[w] = { P: p.n > 0 && p.exp > 0 && p.t >= 2, M: pos >= need, positiveMarkets: pos, need, of: K, exp: p.exp, t: p.t, x2: s[w].pooled.net2.exp }; }
  const okA = v.A.P && v.A.M, okB = v.B.P && v.B.M;
  v.verdict = okA && okB ? (v.A.x2 > 0 && v.B.x2 > 0 ? 'PASS' : 'PASS (cost-fragile)') : okB ? '2018+-ONLY' : okA ? '2008-17-ONLY' : 'FAIL';
  v.note = !okA && !okB && ((v.A.exp > 0 && v.A.t < 2) || (v.B.exp > 0 && v.B.t < 2)) ? 'positive but not significant in a window' : null;
  return v;
}
const SETS = { H1: ['de40', 'xag'], H2: ['eurusd', 'gbpusd', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'usdjpy', 'eurjpy', 'gbpjpy'], ref: ['gc', 'nq', 'es', 'ym'] };
SETS.allNew = [...SETS.H1, ...SETS.H2];
const out = { built: new Date().toISOString().slice(0, 10), windows: { A: '2008-01-01..2017-12-31 (halves 2008-12 / 2013-17)', B: '2018-01-01..2026-10-31 (halves 2018-21 / 2022-26)' },
  src: res.src, coverage: res.coverage, sets: {}, verdicts: {} };
for (const [k, mk] of Object.entries(SETS)) { out.sets[k] = { markets: mk, A: setStats(mk, 'A'), B: setStats(mk, 'B') }; out.verdicts[k] = verdict(out.sets[k], mk.length); }
out.sensitivity = { de40_m5min200: { A: marketStats('de40_m5min200', 'A'), B: marketStats('de40_m5min200', 'B') } };
out.primary = { set: 'H1', verdict: out.verdicts.H1.verdict };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

// ---------- tables for RESULT.md ----------
const sg = (x) => (x == null ? '-' : (x >= 0 ? '+' : '') + x.toFixed(3));
const f = (s) => (s.n ? `${s.n} | ${(100 * s.wr).toFixed(0)}% | ${sg(s.exp)} | ${s.R >= 0 ? '+' : ''}${s.R.toFixed(1)} | ${s.maxDD.toFixed(1)} | ${s.t}` : '0 | - | - | - | - | -');
for (const [k, v] of Object.entries(out.verdicts)) console.log('VERDICT', k, JSON.stringify(v));
for (const k of Object.keys(SETS)) for (const w of ['A', 'B']) { const s = out.sets[k][w];
  console.log(`\n=== ${k} ${w} ${out.windows[w]}\npooled x1 | ${f(s.pooled.net)}\npooled x2 | ${f(s.pooled.net2)}\ngross | ${f(s.pooled.gross)}\nmonthly ${JSON.stringify(s.pooled.monthly)}`);
  console.log(`halves: ${f(s.halves.first)} || ${f(s.halves.second)} | buys ${f(s.sides.buys)} | sells ${f(s.sides.sells)}`);
  console.log('market | n | wr | exp | R | DD | t || x2 | gross | 1st (t) | 2nd (t) | buys n/exp | sells n/exp | all n/exp | monthly t');
  for (const m of SETS[k]) { const x = s.markets[m]; console.log(`${m} | ${f(x.net)} || ${sg(x.net2.exp)} | ${sg(x.gross.exp)} | ${sg(x.first.exp)} (${x.first.t}) | ${sg(x.second.exp)} (${x.second.t}) | ${x.buys.n}/${sg(x.buys.exp)} | ${x.sells.n}/${sg(x.sells.exp)} | ${x.allSignals.n}/${sg(x.allSignals.exp)} | ${x.monthly.t}`);
    if (x.drift) console.log(`   drift: control ${f(x.drift.control)} | adjusted ${f(x.drift.adjusted)} | years ${Object.entries(x.drift.years).map(([y, d]) => `${y}:${d.ctrl}/${d.a}/${d.adj}`).join(' ')}`); }
  console.log('year | n | exp | R | t | ' + SETS[k].join(' R | ') + ' R');
  for (const y of Object.keys(s.years)) console.log(`${y} | ${s.years[y].net.n} | ${sg(s.years[y].net.exp)} | ${s.years[y].net.R} | ${s.years[y].net.t} | ${SETS[k].map((m) => (s.markets[m].years[y] ? s.markets[m].years[y].R : 0)).join(' | ')}`);
}
for (const w of ['A', 'B']) console.log(`sens de40 m5min200 ${w}: ${f(out.sensitivity.de40_m5min200[w].net)}`);
