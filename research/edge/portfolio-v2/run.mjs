// Portfolio v2 (pre-registered in preregistration.md, committed before this ran): monthly net R of every council stream with a
// long history, four walk-forward weighting schemes (EQ, IV, MC, TK), correlations and gold / Nasdaq beta. Paper research only.
//   node research/edge/portfolio-v2/ict-streams.mjs <oanda5mDir> <ict.json>     (step 1, ~10 min)
//   node research/edge/portfolio-v2/run.mjs <ict.json> <oanda5mDir>              (writes result.json next to this file)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), EDGE = path.join(HERE, '..');
const [ICT, DIR] = process.argv.slice(2);
if (!ICT || !DIR) { console.error('usage: run.mjs <ict.json> <oanda5mDir>'); process.exit(1); }
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// ---------- months ----------
const ym = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
const MONTHS = []; for (let y = 2004; y <= 2026; y++) for (let m = 1; m <= 12; m++) { if (y === 2026 && m > 10) break; MONTHS.push(ym(y, m)); }
const END = '2026-10', EVAL0 = '2009-01';
const mOf = (x) => (typeof x === 'number' ? new Date(x * 1000).toISOString() : String(x)).slice(0, 7);
const yearOf = (k) => +k.slice(0, 4);

// ---------- streams: id -> { label, status, from, x1: Map(month -> R), x2 } ----------
const S = {};
const def = (id, label, status, from) => (S[id] = { id, label, status, from, x1: new Map(), x2: new Map() });
const book = (id, month, r1, r2) => { const s = S[id]; if (month < s.from || month > END) return; s.x1.set(month, (s.x1.get(month) || 0) + r1); s.x2.set(month, (s.x2.get(month) || 0) + r2); };

// ICT (step 1 output)
const ICTL = { ict_a: 'ICT A-setups', ict_dip: 'ICT shadow dip', ict_nofri: 'ICT shadow nofri', ict_h1opp: 'ICT shadow h1opp', ict_strail: 'ICT shadow strail' };
for (const [id, l] of Object.entries(ICTL)) def(id, l, id === 'ict_a' ? 'live' : 'shadow', '2007-07');
const ict = J(ICT); const counts = {};
for (const [st, , , , closed, size, R, c] of ict.trades) { counts[st] = (counts[st] || 0) + 1; book(st, mOf(closed), size * (R - c), size * (R - 2 * c)); }
// NQ open run (#511)
def('nq_open', 'NQ NY open run', 'live', '2004-01');
for (const t of J(path.join(EDGE, 'nq-open-oos/result.json')).trades) { counts.nq_open = (counts.nq_open || 0) + 1; book('nq_open', t.d.slice(0, 7), t.R, t.R - (t.gross - t.R)); }
// gold replica (#512): committed positions, entry month; x1 0.30 / x2 0.60 a unit round trip
def('replica', 'Gold replica', 'live', '2017-01');
for (const p of J(path.join(EDGE, 'replica-oos/positions.json'))) { counts.replica = (counts.replica || 0) + 1;
  const net = (c) => p.legs.reduce((a, [R, size, r0]) => a + size * (R - c / r0), 0); book('replica', p.at.slice(0, 7), net(0.30), net(0.60)); }
// gold systems (#530)
const GL = { gtrend: ['Gold trend N20', 'live'], gtrend5: ['Gold trend fast N5', 'shadow'], gtl: ['Gold H4 trendline', 'live'], geg: ['Gold daily engulf', 'live'] };
for (const [id, [l, st]] of Object.entries(GL)) def(id, l, st, '2006-07');
for (const p of J(path.join(EDGE, 'gold-systems-oos/result.json')).positions) { counts[p.sys] = (counts[p.sys] || 0) + 1; book(p.sys, p.c.slice(0, 7), p.n, p.n2); }
// crypto trend (#508)
def('crypto', 'Crypto trend v3', 'shadow', '2017-09');
for (const t of J(path.join(EDGE, 'crypto-trend-decay/result.json')).trades) { counts.crypto = (counts.crypto || 0) + 1; book('crypto', t.exit.slice(0, 7), t.R, t.gross - 2 * t.cost); }

const IDS = Object.keys(S);
const DISTINCT = ['ict_a', 'nq_open', 'replica', 'gtrend', 'gtrend5', 'gtl', 'geg', 'crypto'];
const covered = (id, k) => k >= S[id].from && k <= END;
const val = (id, k, cost = 'x1') => (covered(id, k) ? S[id][cost].get(k) || 0 : null);

// ---------- gold and Nasdaq monthly % returns (OANDA month-end mid close) ----------
function monthCloses(sym) {
  const last = new Map();
  for (const f of fs.readdirSync(DIR).filter((f) => f.startsWith(sym + '-') && f.endsWith('.json.gz')).sort())
    for (const [t, , , , c] of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, f))))) if (c > 0) last.set(mOf(t), c);
  return last;
}
const RET = {};
for (const [k, sym] of [['gold', 'xau'], ['nq', 'nas100']]) { const c = monthCloses(sym), r = new Map();
  for (let i = 1; i < MONTHS.length; i++) if (c.has(MONTHS[i]) && c.has(MONTHS[i - 1])) r.set(MONTHS[i], 100 * (c.get(MONTHS[i]) / c.get(MONTHS[i - 1]) - 1));
  RET[k] = r; }

// ---------- stats helpers ----------
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const corr = (a, b) => { const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0; };
const r2 = (x, d = 2) => (x == null || !isFinite(x) ? null : +x.toFixed(d));
function maxDD(a) { let c = 0, pk = 0, dd = 0; for (const x of a) { c += x; pk = Math.max(pk, c); dd = Math.max(dd, pk - c); } return dd; }
function stats(keys, vals) {
  if (vals.length < 2) return { months: vals.length };
  const tot = vals.reduce((s, x) => s + x, 0), m = mean(vals), s = sd(vals), dd = maxDD(vals), years = {};
  keys.forEach((k, i) => (years[k.slice(0, 4)] = (years[k.slice(0, 4)] || 0) + vals[i]));
  const yv = Object.values(years);
  return { months: vals.length, R: r2(tot, 1), meanM: r2(m, 3), sdM: r2(s, 3), sharpe: r2((m / s) * Math.sqrt(12)), t: r2(m / (s / Math.sqrt(vals.length))),
    maxDD: r2(dd, 1), retDD: r2(dd > 0 ? tot / dd : null), worstMonth: r2(Math.min(...vals)), posYears: `${yv.filter((x) => x > 0).length}/${yv.length}` };
}
// OLS y = a + b1 g + b2 n, alpha t from the residual SE
function ols(y, g, n) {
  const N = y.length, X = y.map((_, i) => [1, g[i], n[i]]), A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
  for (let i = 0; i < N; i++) for (let p = 0; p < 3; p++) { b[p] += X[i][p] * y[i]; for (let q = 0; q < 3; q++) A[p][q] += X[i][p] * X[i][q]; }
  const inv = inv3(A), beta = [0, 1, 2].map((p) => inv[p].reduce((s, v, q) => s + v * b[q], 0));
  const res = y.map((v, i) => v - X[i].reduce((s, x, p) => s + x * beta[p], 0)), sse = res.reduce((s, x) => s + x * x, 0), my = mean(y), sst = y.reduce((s, x) => s + (x - my) ** 2, 0);
  const s2 = sse / (N - 3);
  return { alpha: r2(beta[0], 3), alphaT: r2(beta[0] / Math.sqrt(s2 * inv[0][0])), bGold: r2(beta[1], 3), bGoldT: r2(beta[1] / Math.sqrt(s2 * inv[1][1])), bNq: r2(beta[2], 3), bNqT: r2(beta[2] / Math.sqrt(s2 * inv[2][2])), R2: r2(1 - sse / sst), res };
}
function inv3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [[A, -(b * i - c * h), b * f - c * e], [B, a * i - c * g, -(a * f - c * d)], [C, -(a * h - b * g), a * e - b * d]].map((r) => r.map((x) => x / det));
}
// beta block for any (keys, vals) series
function beta(keys, vals) {
  const k = keys.filter((x, i) => RET.gold.has(x) && RET.nq.has(x)), y = keys.map((x, i) => [x, vals[i]]).filter(([x]) => RET.gold.has(x) && RET.nq.has(x)).map(([, v]) => v);
  const g = k.map((x) => RET.gold.get(x)), n = k.map((x) => RET.nq.get(x)), o = ols(y, g, n); delete o.res;
  return { months: k.length, corrGold: r2(corr(y, g)), corrNq: r2(corr(y, n)), ...o };
}

// ---------- walk-forward weights ----------
const P = { minMonths: 24, window: 36, sdFloor: 0.25, minOverlap: 12, tkMonths: 24 };
function windowOf(id, Y, cost) { const ks = MONTHS.filter((k) => yearOf(k) < Y && covered(id, k)); return ks.slice(-P.window).map((k) => [k, val(id, k, cost)]); }
function weights(scheme, universe, Y, cost, k = 3) {
  const el = universe.filter((id) => MONTHS.filter((m) => yearOf(m) < Y && covered(id, m)).length >= P.minMonths);
  if (!el.length) return {};
  const W = Object.fromEntries(el.map((id) => [id, windowOf(id, Y, cost)])), sig = Object.fromEntries(el.map((id) => [id, Math.max(P.sdFloor, sd(W[id].map((x) => x[1])))]));
  let w = {};
  if (scheme === 'EQ') for (const id of el) w[id] = 1;
  else if (scheme === 'IV') for (const id of el) w[id] = 1 / sig[id];
  else if (scheme === 'MC') for (const id of el) { const rs = el.filter((j) => j !== id).map((j) => { const mj = new Map(W[j]), ov = W[id].filter(([m]) => mj.has(m));
      return ov.length >= P.minOverlap ? corr(ov.map((x) => x[1]), ov.map(([m]) => mj.get(m))) : 0; });
    const rb = rs.length ? mean(rs) : 0; w[id] = Math.max(0, 1 - rb) / sig[id]; }
  else if (scheme === 'TK') { const t = el.map((id) => { const v = MONTHS.filter((m) => yearOf(m) < Y && covered(id, m)).slice(-P.tkMonths).map((m) => val(id, m, cost)); const s = sd(v); return [id, s > 0 ? mean(v) / (s / Math.sqrt(v.length)) : 0]; })
      .filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]).slice(0, k);
    for (const [id] of t) w[id] = 1 / k; return w; }
  const tot = Object.values(w).reduce((s, x) => s + x, 0); for (const id in w) w[id] = tot > 0 ? w[id] / tot : 0;
  return w;
}
// ex-ante diversification ratio of weights w on the trailing window
function divRatio(w, Y, cost) {
  const ids = Object.keys(w).filter((id) => w[id] > 0); if (ids.length < 2) return 1;
  const W = Object.fromEntries(ids.map((id) => [id, new Map(windowOf(id, Y, cost))])), s = Object.fromEntries(ids.map((id) => [id, sd([...W[id].values()])]));
  let v = 0; for (const i of ids) for (const j of ids) { const ov = [...W[i].keys()].filter((m) => W[j].has(m)); const c = i === j ? 1 : ov.length >= P.minOverlap ? corr(ov.map((m) => W[i].get(m)), ov.map((m) => W[j].get(m))) : 0; v += w[i] * w[j] * s[i] * s[j] * c; }
  return ids.reduce((a, id) => a + w[id] * s[id], 0) / Math.sqrt(v);
}
const EVAL = MONTHS.filter((k) => k >= EVAL0);
function portfolio(scheme, universe, cost = 'x1', k = 3) {
  const W = {}, dr = {}, vals = [];
  for (let Y = 2009; Y <= 2026; Y++) { W[Y] = weights(scheme, universe, Y, cost, k); dr[Y] = r2(divRatio(W[Y], Y, cost)); }
  const contrib = {};   // R each stream added to the book, 2009-17 / 2018-26
  for (const m of EVAL) { const w = W[yearOf(m)]; vals.push(Object.entries(w).reduce((s, [id, x]) => s + x * (val(id, m, cost) || 0), 0));
    for (const [id, x] of Object.entries(w)) { const c = (contrib[id] = contrib[id] || [0, 0]); c[yearOf(m) <= 2017 ? 0 : 1] += x * (val(id, m, cost) || 0); } }
  return { W, dr, vals, contrib: Object.fromEntries(Object.entries(contrib).map(([id, [a, b]]) => [id, { h1: r2(a, 1), h2: r2(b, 1) }])) };
}
const half = (keys, vals, a, b) => { const i = keys.map((k, j) => [k, vals[j]]).filter(([k]) => yearOf(k) >= a && yearOf(k) <= b); return stats(i.map((x) => x[0]), i.map((x) => x[1])); };
function report(p, px2) {
  const years = {}; EVAL.forEach((k, i) => (years[k.slice(0, 4)] = r2((years[k.slice(0, 4)] || 0) + p.vals[i], 2)));
  for (const y in years) years[y] = r2(years[y], 1);
  return { all: stats(EVAL, p.vals), h1: half(EVAL, p.vals, 2009, 2017), h2: half(EVAL, p.vals, 2018, 2026), x2: stats(EVAL, px2.vals), x2h1: half(EVAL, px2.vals, 2009, 2017), years,
    beta: beta(EVAL, p.vals), betaH1: beta(EVAL.filter((k) => yearOf(k) <= 2017), p.vals.slice(0, EVAL.filter((k) => yearOf(k) <= 2017).length)),
    divRatioMean: r2(mean(Object.values(p.dr))), contrib: p.contrib, weights: Object.fromEntries(Object.entries(p.W).map(([y, w]) => [y, Object.fromEntries(Object.entries(w).map(([id, x]) => [id, r2(x, 3)]))])) };
}

// ---------- run ----------
const out = { at: new Date().toISOString(), prereg: 'preregistration.md', params: P, evalWindow: [EVAL0, END], halves: [[2009, 2017], [2018, 2026]], streams: {}, corr: {}, corrResid: {}, avgCorr: {}, portfolios: {}, sensitivity: {}, verdict: {} };
// per stream: coverage, eval-window stats (its own months), beta on its full coverage
for (const id of IDS) {
  const ks = MONTHS.filter((k) => covered(id, k)), v = ks.map((k) => val(id, k)), ev = ks.filter((k) => k >= EVAL0), evv = ev.map((k) => val(id, k));
  out.streams[id] = { label: S[id].label, status: S[id].status, from: S[id].from, positions: counts[id] || 0, full: stats(ks, v), eval: stats(ev, evv),
    h1: half(ev, evv, 2009, 2017), h2: half(ev, evv, 2018, 2026), x2: stats(ks, ks.map((k) => val(id, k, 'x2'))), beta: beta(ks, v),
    years: Object.fromEntries([...new Set(ks.map((k) => k.slice(0, 4)))].map((y) => [y, r2(ks.filter((k) => k.startsWith(y)).reduce((s, k) => s + val(id, k), 0), 1)])) };
}
// correlation matrix (overlapping months), raw and after removing gold/NQ beta
const resid = {};
for (const id of IDS) { const ks = MONTHS.filter((k) => covered(id, k) && RET.gold.has(k) && RET.nq.has(k)); const o = ols(ks.map((k) => val(id, k)), ks.map((k) => RET.gold.get(k)), ks.map((k) => RET.nq.get(k))); resid[id] = new Map(ks.map((k, i) => [k, o.res[i]])); }
for (const a of IDS) { out.corr[a] = {}; out.corrResid[a] = {}; for (const b of IDS) {
  const ov = MONTHS.filter((k) => covered(a, k) && covered(b, k)); out.corr[a][b] = r2(corr(ov.map((k) => val(a, k)), ov.map((k) => val(b, k))));
  const ovr = [...resid[a].keys()].filter((k) => resid[b].has(k)); out.corrResid[a][b] = r2(corr(ovr.map((k) => resid[a].get(k)), ovr.map((k) => resid[b].get(k)))); } }
out.corr.goldNq = r2(corr([...RET.gold.keys()].filter((k) => RET.nq.has(k)).map((k) => RET.gold.get(k)), [...RET.gold.keys()].filter((k) => RET.nq.has(k)).map((k) => RET.nq.get(k))));
for (const [u, ids] of [['all', IDS], ['distinct', DISTINCT]]) { const pr = (m) => { const v = []; for (const a of ids) for (const b of ids) if (a < b) v.push(m[a][b]); return r2(mean(v)); }; out.avgCorr[u] = { raw: pr(out.corr), resid: pr(out.corrResid) }; }
// portfolios
for (const [u, ids] of [['all', IDS], ['distinct', DISTINCT]]) for (const sc of ['EQ', 'IV', 'MC', 'TK']) out.portfolios[`${sc}-${u}`] = report(portfolio(sc, ids), portfolio(sc, ids, 'x2'));
for (const [u, ids] of [['all', IDS], ['distinct', DISTINCT]]) for (const k of [2, 5]) out.sensitivity[`TK${k}-${u}`] = report(portfolio('TK', ids, 'x1', k), portfolio('TK', ids, 'x2', k));
// single-stream references over the eval window, 1R, only while covered (0 before)
for (const id of ['ict_a', 'gtrend', 'nq_open']) { const v = EVAL.map((k) => val(id, k) || 0), v2 = EVAL.map((k) => val(id, k, 'x2') || 0); out.sensitivity[`alone-${id}`] = report({ vals: v, W: {}, dr: { 0: 1 } }, { vals: v2 }); }

// ---------- pre-registered verdicts ----------
const pf = out.portfolios;
for (const u of ['all', 'distinct']) for (const sc of ['IV', 'MC', 'TK']) { const a = pf[`${sc}-${u}`], e = pf[`EQ-${u}`];
  const better = (x, y) => x.retDD > y.retDD && x.sharpe > y.sharpe;
  out.verdict[`Q1 ${sc} vs EQ (${u})`] = { all: better(a.all, e.all), h1: better(a.h1, e.h1), h2: better(a.h2, e.h2), beats: better(a.all, e.all) && better(a.h1, e.h1) && better(a.h2, e.h2) }; }
for (const name of Object.keys(pf)) { const p = pf[name]; const edge = p.all.t >= 2 && p.h1.R > 0 && p.h2.R > 0 && p.x2.R > 0;
  out.verdict[`Q2 ${name}`] = { t: p.all.t, h1R: p.h1.R, h2R: p.h2.R, x2R: p.x2.R, edge };
  out.verdict[`Q3 ${name}`] = { alphaT: p.beta.alphaT, R2: p.beta.R2, mostlyBeta: p.all.t >= 2 && p.beta.alphaT < 2, betaHeavy: p.beta.R2 >= 0.25 }; }
// Q4 inputs: Sharpe of each eligible stream over the eval months it was eligible
out.verdict.Q4 = Object.fromEntries(IDS.map((id) => [id, out.streams[id].eval.sharpe]));
out.series = { months: EVAL, streams: Object.fromEntries(IDS.map((id) => [id, EVAL.map((k) => r2(val(id, k), 3))])), gold: EVAL.map((k) => r2(RET.gold.get(k), 2)), nq: EVAL.map((k) => r2(RET.nq.get(k), 2)),
  portfolios: Object.fromEntries(Object.keys(pf).map((n) => [n, portfolio(n.split('-')[0], n.endsWith('all') ? IDS : DISTINCT).vals.map((x) => r2(x, 3))])) };
out.ictSrc = ict.src;
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1));

// ---------- console summary ----------
const row = (n, p) => `${n.padEnd(16)} R ${String(p.all.R).padStart(6)} t ${String(p.all.t).padStart(5)} Sh ${String(p.all.sharpe).padStart(5)} DD ${String(p.all.maxDD).padStart(5)} R/DD ${String(p.all.retDD).padStart(5)} | 09-17 R ${String(p.h1.R).padStart(6)} Sh ${p.h1.sharpe} R/DD ${p.h1.retDD} | 18-26 R ${String(p.h2.R).padStart(6)} Sh ${p.h2.sharpe} R/DD ${p.h2.retDD} | x2 R ${p.x2.R} | cG ${p.beta.corrGold} cN ${p.beta.corrNq} R2 ${p.beta.R2} aT ${p.beta.alphaT} DR ${p.divRatioMean}`;
for (const id of IDS) { const s = out.streams[id]; console.log(id.padEnd(11), s.status.padEnd(6), 'n', String(s.positions).padStart(5), 'full', JSON.stringify(s.full), '| cG', s.beta.corrGold, 'cN', s.beta.corrNq, 'aT', s.beta.alphaT, 'R2', s.beta.R2); }
for (const [n, p] of Object.entries(pf)) console.log(row(n, p));
for (const [n, p] of Object.entries(out.sensitivity)) console.log(row(n, p));
console.log('avgCorr', JSON.stringify(out.avgCorr), 'gold-NQ', out.corr.goldNq);
for (const [k, v] of Object.entries(out.verdict)) if (!k.startsWith('Q4')) console.log(k, JSON.stringify(v));
