// ICT dip-buy out-of-sample test (pre-registered in preregistration.md, committed and pushed before the 2008-17 stage ran).
// Question: research/edge/ict-index-longonly (#431, PASS on 2018-26 HistData cash, not pre-registered, 26 variants) proposes for
// NQ/ES: the gold A-rule's BUYS (iFVG buy, grade >= MIN_GRADE, stop 0.3-0.75x the daily ATR, size 1, no break-even, the gold exit:
// trail from +2R, 36 H1 max) taken only when the last completed daily close is below the daily close 20 trading days earlier.
// It has never been tested before 2018. This drives the desk's OWN code, unchanged, over OANDA 5m mid candles 2007-06..2026-10
// (the #526 / #545 / #579 cache): the tracker's isDip() / dipGate() (the paper 'dip' shadow stream the tracker already runs),
// isASetup(g, 'gc') for the ungated gold-rule buys, isASetup / sizeOf for the index A-rule baseline, simulate() from ict/replay.mjs.
// Paper research only: no live rule, config, tracker, replay or site code changes.
//
//   node research/edge/ict-dipbuy-oos/run.mjs <cacheDir> trades            # one pass 2007-26 -> <cacheDir>/dipbuy-trades.json (no statistics)
//   node research/edge/ict-dipbuy-oos/run.mjs <cacheDir> calib             # calibration gate only: 2018-26 dip-buy (#431) + index rule (#526/#579); nothing from 2008-17
//   node research/edge/ict-dipbuy-oos/run.mjs <cacheDir> full [result.json] # the pre-registered 2008-17 test, everything -> result.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { MARKETS, MIN_GRADE, signals, isASetup, sizeOf, isDip, dipGate, inHalt, cmeShut, agg, dailyNY } from '../../../ict/tracker.mjs';
import { simulate } from '../../../ict/replay.mjs';

const [DIR, STAGE = 'full', OUT = 'research/edge/ict-dipbuy-oos/result.json'] = process.argv.slice(2);
if (!DIR) { console.error('usage: run.mjs <cacheDir> trades|calib|full [result.json]'); process.exit(1); }
const TRADES = path.join(DIR, 'dipbuy-trades.json');
// desk key -> OANDA proxy symbol; one round-trip cost in price units (#431 / #526: 0.02% of price + 0.25 point)
const U = { nq: { sym: 'nas100', cost: (p) => p * 0.0002 + 0.25 }, es: { sym: 'spx500', cost: (p) => p * 0.0002 + 0.25 } };
export const COLS = ['market', 'cfg', 'side', 'close', 'aset', 'size', 'Rraw', 'costR', 'gate', 'atrR', 'grade', 'exit', 'closed'];
// windows by the signal H1 candle's close (UTC): A = the untouched test, B = the #431 window; third item = the half split year
export const W = { A: [Date.UTC(2008, 0, 1) / 1000, Date.UTC(2018, 0, 1) / 1000, 2013], B: [Date.UTC(2018, 0, 1) / 1000, Date.UTC(2026, 10, 1) / 1000, 2024] };
// published figures the calibration gate must reproduce (net x1, A-setups): #526 (its code) and #579 (today's calendar module)
const REF = { nq: { A: { n: [541, 538], exp: [-0.073, -0.075] }, B: { n: [424, 423], exp: [0.103, 0.106] } }, es: { A: { n: [534, 534], exp: [-0.068, -0.069] }, B: { n: [422, 425], exp: [0.040, 0.039] } },
  dip431: { all: { n: 370, exp: 0.29 }, is: { n: 256, exp: 0.21 }, oos: { n: 114, exp: 0.48 } } };

const lb = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };

// ---------------- stage 1: trades (the desk's code over the candles) ----------------
function load(sym) {
  const files = fs.readdirSync(DIR).filter((f) => f.startsWith(sym + '-') && f.endsWith('.json.gz')).sort(), m5 = [];
  for (const f of files) for (const [t, o, h, l, c] of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, f))))) {
    if (inHalt(t) || cmeShut(t)) continue;   // the live futures feed's closedBar(), as #526
    if (!(o > 0 && h > 0 && l > 0 && c > 0)) continue;
    m5.push({ time: t, open: o, high: Math.max(h, o, c), low: Math.min(l, o, c), close: c });
  }
  return m5.sort((a, b) => a.time - b.time);
}
function gen() {
  const res = { at: new Date().toISOString(), src: {}, coverage: {}, trades: [] };
  for (const [key, u] of Object.entries(U)) {
    const t0 = Date.now(), M = MARKETS[key], m5 = load(u.sym), H = agg(m5, 3600), D = dailyNY(H);
    const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
    const m5days = new Set([...days.entries()].filter(([, n]) => n >= 200).map(([d]) => d));   // #526: 5m exits on complete UTC days
    const cov = {}; for (const b of H) { const y = new Date(b.time * 1000).getUTCFullYear(); (cov[y] = cov[y] || { h1: 0, m5: 0, days: 0, m5days: 0 }).h1++; }
    for (const [d, n] of days) { const y = new Date(d * 86400000).getUTCFullYear(); if (!cov[y]) continue; cov[y].m5 += n; cov[y].days++; if (n >= 200) cov[y].m5days++; }
    res.coverage[key] = cov;
    const sig = signals(H, D, 1, M.tick).concat(signals(H, D, -1, M.tick)).filter((g) => g.grade.total >= MIN_GRADE).sort((a, b) => a.close - b.close);
    const gateOf = (g) => { const v = dipGate(g, D); return v == null ? null : v ? 1 : 0; };
    const push = (cfg, side, close, aset, size, t, costR, gate, atrR, grade) => res.trades.push([key, cfg, side, close, aset, size, +t.R.toFixed(3), +costR.toFixed(4), gate, atrR == null ? null : +(+atrR).toFixed(3), grade, t.exit, t.closed]);
    const sim = (g, M2, i, j) => simulate(g, M2, key, { H: H.slice(i, i + 120), m5: m5.slice(j, j + 12 * 24 * 12), m5days });
    const gaps = { dip: 0, goldbuy: 0, index: 0 };
    // H1 stream 'dip': the tracker's own isDip() (gold-rule buy + the 20-day gate), the replay's shadow stream: one open trade,
    // size 1, aRule 'dip' => simulate() skips the break-even and uses the gold exit (trail from +2R, 36 H1 max)
    { let busy = 0; for (const g of sig) { if (g.close < busy || !isDip(g, key, D)) continue; const t = sim(g, { ...M, aRule: 'dip' }, lb(H, g.close), lb(m5, g.close)); if (!t) { gaps.dip++; continue; } if (!t.closed) continue;
      push('dip', 1, g.close, 1, 1, t, u.cost(g.entry) / g.r0, 1, g.feat.atrR, g.grade.total); busy = t.closed; } }
    // H2 stream 'goldbuy': the gold A-rule's buys without the gate (isASetup(g, 'gc'), as #431 / ict-universe), tagged with the gate state
    { let busy = 0; for (const g of sig) { if (g.close < busy || !isASetup(g, 'gc')) continue; const t = sim(g, { ...M, aRule: 'gold' }, lb(H, g.close), lb(m5, g.close)); if (!t) { gaps.goldbuy++; continue; } if (!t.closed) continue;
      push('goldbuy', 1, g.close, 1, 1, t, u.cost(g.entry) / g.r0, gateOf(g), g.feat.atrR, g.grade.total); busy = t.closed; } }
    // baseline 'index': the desk's current NQ/ES A-rule as #526 runs it (both sides, DOL sizing, break-even; the replay's busy rule)
    { let busyAll = 0, busyA = 0; for (const g of sig) { const a = isASetup(g, key); if (g.close < (a ? busyA : busyAll)) continue; const t = sim(g, M, lb(H, g.close), lb(m5, g.close)); if (!t) { gaps.index++; continue; } if (!t.closed) continue;
      push('index', g.side, g.close, a ? 1 : 0, a ? sizeOf(g, key) : 1, t, u.cost(g.entry) / g.r0, gateOf(g), g.feat.atrR, g.grade.total); busyAll = Math.max(busyAll, t.closed); if (a) busyA = t.closed; } }
    // random-entry control (not a rule), as #431: 1 in 10 H1 closes (fixed seed), buys, stop 0.3-0.75x the daily ATR14, the gold exit,
    // the same costs; tagged with the same 20-day gate at its own close, so the drift adjustment matches the gate state
    { let seed = 777; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
      for (let i = 60; i < H.length - 40; i++) {
        if (rnd() > 0.1) continue;
        const close = H[i].time + 3600, di = D.findLastIndex((d) => d.time + 86400 <= close); if (di < 20) continue;
        const atrD = D.slice(di - 13, di + 1).reduce((s, d) => s + (d.high - d.low), 0) / 14, k = 0.3 + 0.45 * rnd(), e = H[i].close, r0 = k * atrD;
        const g = { side: 1, entry: e, r0, stop: e - r0, close, t: H[i].time, sweepT: H[i].time, swept: e, fvg: [e, e], ih: null, dol: null, valid: true, feat: {}, grade: { total: 0 } };
        const j = lb(m5, close), t = simulate(g, { ...M, aRule: 'gold' }, key, { H: H.slice(i + 1, i + 121), m5: m5.slice(j, j + 12 * 24 * 12), m5days });
        if (!t || !t.closed) continue;
        push('ctrlbuy', 1, close, 0, 1, t, u.cost(e) / r0, D[di].close < D[di - 20].close ? 1 : 0, k, null);
      } }
    res.src[key] = { sym: u.sym, cost: u.cost.toString(), m5: m5.length, h1: H.length, d1: D.length, from: new Date(m5[0].time * 1000).toISOString().slice(0, 10), to: new Date(m5.at(-1).time * 1000).toISOString().slice(0, 10), signals: sig.length, gaps };
    console.log(key, JSON.stringify(res.src[key]), ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  res.cols = COLS;
  fs.writeFileSync(TRADES, JSON.stringify(res));
  console.log('trades', res.trades.length, '->', TRADES);
}

// ---------------- statistics ----------------
export function stats(a, f = 'net') {
  a = [...a].sort((x, y) => x.closed - y.closed);
  const r = a.map((x) => x[f]), n = r.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, streak: 0, t: null };
  const R = r.reduce((s, x) => s + x, 0), m = R / n, sd = Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, pk = 0, dd = 0, st = 0, ws = 0; for (const x of r) { eq += x; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); st = x < 0 ? st + 1 : 0; ws = Math.max(ws, st); }
  return { n, wr: +(r.filter((x) => x > 0).length / n).toFixed(3), exp: +m.toFixed(3), R: +R.toFixed(1), maxDD: +dd.toFixed(1), streak: ws, t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null };
}
// dependence check: t of the calendar-month sums over every month of the window (months without a trade count 0)
function monthlyT(a, from, to, f = 'net') {
  const s = new Map(); for (const x of a) s.set(x.month, (s.get(x.month) || 0) + x[f]);
  const ms = []; for (let t = from; t < to; ) { const d = new Date(t * 1000); ms.push(s.get(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`) || 0); t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000; }
  const n = ms.length, m = ms.reduce((p, x) => p + x, 0) / n, sd = Math.sqrt(ms.reduce((p, x) => p + (x - m) ** 2, 0) / (n - 1));
  return { months: n, meanR: +m.toFixed(2), t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null };
}
// drift adjustment: each rule trade's net minus the control's mean net in its cell (market | year | gate state for the gated rule;
// market | year for the ungated one); a cell without control trades falls back to the market's control mean, then 0
const cellMeans = (ctrl, keyf) => { const g = new Map(); for (const t of ctrl) { const k = keyf(t), v = g.get(k) || [0, 0]; v[0] += t.net; v[1]++; g.set(k, v); } return new Map([...g].map(([k, v]) => [k, v[0] / v[1]])); };
function adjust(rule, ctrl, keyf) {
  const C = cellMeans(ctrl, keyf), CM = cellMeans(ctrl, (t) => t.market);
  return rule.map((t) => ({ ...t, adj: t.net - (C.get(keyf(t)) ?? CM.get(t.market) ?? 0) }));
}
// block bootstrap of the drift-adjusted mean: calendar-month blocks resampled with replacement, rule AND control trades of a month
// travel together (the control's cell means are recomputed from each resample), 5000 reps, 95% percentile CI
function boot(rule, ctrl, keyf, reps = 5000) {
  if (rule.length < 10) return null;
  const R = new Map(), C = new Map(), months = new Set();
  for (const t of rule) { months.add(t.month); (R.get(t.month) || R.set(t.month, []).get(t.month)).push(t); }
  for (const t of ctrl) { months.add(t.month); (C.get(t.month) || C.set(t.month, []).get(t.month)).push(t); }
  const B = [...months].sort(), nb = B.length; let seed = 4242; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const ms = [];
  for (let r = 0; r < reps; r++) {
    const rs = [], cs = []; for (let i = 0; i < nb; i++) { const m = B[Math.floor(rnd() * nb)]; for (const t of R.get(m) || []) rs.push(t); for (const t of C.get(m) || []) cs.push(t); }
    if (!rs.length) continue;
    const a = adjust(rs, cs, keyf); ms.push(a.reduce((s, t) => s + t.adj, 0) / a.length);
  }
  ms.sort((x, y) => x - y);
  return { lo: +ms[Math.floor(0.025 * ms.length)].toFixed(3), hi: +ms[Math.floor(0.975 * ms.length)].toFixed(3), pPos: +(ms.filter((x) => x > 0).length / ms.length).toFixed(3), months: nb, reps: ms.length };
}

function loadTrades() {
  const res = JSON.parse(fs.readFileSync(TRADES, 'utf8'));
  const T = res.trades.map((r) => Object.fromEntries(COLS.map((c, i) => [c, r[i]])));
  for (const t of T) { const d = new Date(t.close * 1000); t.year = d.getUTCFullYear(); t.month = `${t.year}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    t.gross = t.size * t.Rraw; t.net = t.size * (t.Rraw - t.costR); t.net2 = t.size * (t.Rraw - 2 * t.costR); }
  return { res, T };
}
const sg = (x) => (x == null ? '-' : (x >= 0 ? '+' : '') + x.toFixed(3));
const f = (s) => (s && s.n ? `${s.n} | ${(100 * s.wr).toFixed(0)}% | ${sg(s.exp)} | ${s.R >= 0 ? '+' : ''}${s.R.toFixed(1)} | ${s.maxDD.toFixed(1)} | ${s.streak} | ${s.t}` : '0 | - | - | - | - | - | -');

// one rule stream in one window [from, to): pooled, halves, per market, per year, drift control and the bootstrap CI of the margin
function block(T, cfg, from, to, half, gated) {
  const inW = (t) => t.close >= from && t.close < to;
  const rule = T.filter((t) => t.cfg === cfg && t.aset && inW(t)), ctrlAll = T.filter((t) => t.cfg === 'ctrlbuy' && inW(t)), ctrl = gated ? ctrlAll.filter((t) => t.gate === 1) : ctrlAll;
  const keyf = gated ? (t) => `${t.market}|${t.year}|1` : (t) => `${t.market}|${t.year}`;
  const years = [...new Set(rule.map((t) => t.year))].sort(), adj = adjust(rule, ctrl, keyf), C = cellMeans(ctrl, keyf);
  const per = (a, c) => ({ net: stats(a), net2: stats(a, 'net2'), gross: stats(a, 'gross'), first: stats(a.filter((t) => t.year < half)), second: stats(a.filter((t) => t.year >= half)), monthly: monthlyT(a, from, to),
    years: Object.fromEntries(years.map((y) => [y, stats(a.filter((t) => t.year === y))])), drift: { control: stats(c), adjusted: stats(adjust(a, c, keyf), 'adj'), ci: boot(a, c, keyf) } });
  const o = { ...per(rule, ctrl), halves2: { first: stats(rule.filter((t) => t.year < half), 'net2'), second: stats(rule.filter((t) => t.year >= half), 'net2') }, split: half,
    years: Object.fromEntries(years.map((y) => { const a = rule.filter((t) => t.year === y), c = ctrl.filter((t) => t.year === y); return [y, { ...stats(a), x2: stats(a, 'net2').exp, ctrl: stats(c).exp, adj: stats(adj.filter((t) => t.year === y), 'adj').exp }]; })),
    markets: Object.fromEntries(Object.keys(U).map((m) => [m, per(rule.filter((t) => t.market === m), ctrl.filter((t) => t.market === m))])) };
  o.cells = Object.fromEntries([...C].map(([k, v]) => [k, +v.toFixed(3)]));
  return o;
}
function printBlock(name, o) {
  console.log(`\n=== ${name}\n n | wr | exp | R | DD | streak | t\npooled x1 | ${f(o.net)}\npooled x2 | ${f(o.net2)}\ngross     | ${f(o.gross)}\nmonthly ${JSON.stringify(o.monthly)}`);
  console.log(`halves (${o.split}): ${f(o.first)} || ${f(o.second)}   x2: ${sg(o.halves2.first.exp)} || ${sg(o.halves2.second.exp)}`);
  console.log(`drift: control ${f(o.drift.control)} | adjusted ${f(o.drift.adjusted)} | CI ${o.drift.ci ? `${o.drift.ci.lo}..${o.drift.ci.hi} P(>0) ${o.drift.ci.pPos} (${o.drift.ci.months} months)` : '-'}`);
  for (const [m, x] of Object.entries(o.markets)) console.log(`${m} | ${f(x.net)} || x2 ${sg(x.net2.exp)} | gross ${sg(x.gross.exp)} | 1st ${sg(x.first.exp)} (${x.first.n}, t ${x.first.t}) | 2nd ${sg(x.second.exp)} (${x.second.n}, t ${x.second.t}) | monthly t ${x.monthly.t} | drift adj ${sg(x.drift.adjusted.exp)} (t ${x.drift.adjusted.t}) CI ${x.drift.ci ? `${x.drift.ci.lo}..${x.drift.ci.hi}` : '-'}`);
  console.log('year | n | wr | exp | R | t | x2 | ctrl | adj');
  for (const [y, s] of Object.entries(o.years)) console.log(`${y} | ${s.n} | ${s.wr == null ? '-' : (100 * s.wr).toFixed(0) + '%'} | ${sg(s.exp)} | ${s.R} | ${s.t} | ${sg(s.x2)} | ${sg(s.ctrl)} | ${sg(s.adj)}`);
}
// the pre-registered bar (preregistration.md): PASS = pooled net > 0 with t >= 2, both halves > 0, drift-adjusted margin's CI > 0;
// FAIL = pooled <= 0, or a half <= 0, or the margin over random gated longs <= 0; otherwise INCONCLUSIVE (positive, not significant)
function judge(o) {
  const P1 = o.net.exp > 0 && o.net.t >= 2, P2 = o.first.exp > 0 && o.second.exp > 0, P3 = !!o.drift.ci && o.drift.ci.lo > 0 && o.drift.adjusted.exp > 0;
  const fail = o.net.exp <= 0 || o.first.exp <= 0 || o.second.exp <= 0 || o.drift.adjusted.exp <= 0;
  const reasons = [];
  if (!P1) reasons.push(o.net.exp > 0 ? `t ${o.net.t} < 2` : `pooled net ${sg(o.net.exp)}`);
  if (!P2) reasons.push(`halves ${sg(o.first.exp)} | ${sg(o.second.exp)}`);
  if (!P3) reasons.push(o.drift.ci ? `margin over random gated longs ${sg(o.drift.adjusted.exp)}, CI ${o.drift.ci.lo}..${o.drift.ci.hi}` : 'no CI');
  return { P1, P2, P3, verdict: P1 && P2 && P3 ? 'PASS' : fail ? 'FAIL' : 'INCONCLUSIVE', reasons };
}

// ---------------- stage 2: calibration (nothing from 2008-17 for the dip / gold-rule streams) ----------------
function calib(T) {
  const out = { index: {}, dip431: {} };
  console.log('\n## calibration: index A-rule per market vs #526 (its code) / #579 (today\'s code): n | exp');
  for (const m of Object.keys(U)) for (const w of ['A', 'B']) {
    const s = stats(T.filter((t) => t.cfg === 'index' && t.aset && t.market === m && t.close >= W[w][0] && t.close < W[w][1]));
    const ref = REF[m][w], ok = Math.abs(s.exp - ref.exp[1]) <= 0.02 && Math.abs(s.n - ref.n[1]) / ref.n[1] <= 0.03;
    out.index[`${m}|${w}`] = { n: s.n, exp: s.exp, t: s.t, ref526: { n: ref.n[0], exp: ref.exp[0] }, ref579: { n: ref.n[1], exp: ref.exp[1] }, ok };
    console.log(`${m} ${w} | here ${s.n} ${sg(s.exp)} (t ${s.t}) | #526 ${ref.n[0]} ${sg(ref.exp[0])} | #579 ${ref.n[1]} ${sg(ref.exp[1])} | ${ok ? 'ok' : 'OFF'}`);
  }
  console.log('\n## calibration: dip-buy 2018-26 (OANDA) vs #431 (HistData cash): n | exp');
  const dipB = T.filter((t) => t.cfg === 'dip' && t.close >= W.B[0] && t.close < W.B[1]);
  for (const [k, fl] of [['all', () => true], ['is', (t) => t.year < 2024], ['oos', (t) => t.year >= 2024]]) {
    const s = stats(dipB.filter(fl)), ref = REF.dip431[k];
    out.dip431[k] = { n: s.n, exp: s.exp, t: s.t, ref431: ref, byMarket: Object.fromEntries(Object.keys(U).map((m) => { const x = stats(dipB.filter(fl).filter((t) => t.market === m)); return [m, { n: x.n, exp: x.exp, t: x.t }]; })) };
    console.log(`${k} | here ${s.n} ${sg(s.exp)} (t ${s.t}) | #431 ${ref.n} ${sg(ref.exp)} | ${Object.entries(out.dip431[k].byMarket).map(([m, x]) => `${m} ${x.n} ${sg(x.exp)}`).join(' | ')}`);
  }
  const a = out.dip431.all;
  out.ok = Object.values(out.index).every((x) => x.ok) && a.exp > 0 && Math.abs(a.exp - REF.dip431.all.exp) <= 0.15 && a.n >= 300 && a.n <= 440;
  console.log(`\ncalibration ${out.ok ? 'PASSES' : 'FAILS'}: index rule ${Object.values(out.index).every((x) => x.ok) ? 'reproduced' : 'NOT reproduced'}, dip-buy 2018-26 ${sg(a.exp)} (n ${a.n}) vs #431 +0.29 (n 370)`);
  return out;
}

// ---------------- stage 3: the pre-registered test ----------------
function full(T, res) {
  const cal = calib(T);
  const h1 = block(T, 'dip', W.A[0], W.A[1], W.A[2], true), h2 = block(T, 'goldbuy', W.A[0], W.A[1], W.A[2], false);
  const h1B = block(T, 'dip', W.B[0], W.B[1], W.B[2], true), h2B = block(T, 'goldbuy', W.B[0], W.B[1], W.B[2], false);
  const base = block(T, 'index', W.A[0], W.A[1], W.A[2], false), baseB = block(T, 'index', W.B[0], W.B[1], W.B[2], false);
  for (const b of [base, baseB]) { delete b.drift; for (const m of Object.values(b.markets)) delete m.drift; for (const y of Object.values(b.years)) { delete y.ctrl; delete y.adj; } }   // the index rule trades both sides: the buys-only control does not apply
  // the gated rule's trades in the ungated gold-rule stream (descriptive): gate state split of H2 over 2008-17
  const gb = T.filter((t) => t.cfg === 'goldbuy' && t.close >= W.A[0] && t.close < W.A[1]);
  const gateSplit = { gateOn: stats(gb.filter((t) => t.gate === 1)), gateOff: stats(gb.filter((t) => t.gate === 0)), ctrlOn: stats(T.filter((t) => t.cfg === 'ctrlbuy' && t.gate === 1 && t.close >= W.A[0] && t.close < W.A[1])), ctrlOff: stats(T.filter((t) => t.cfg === 'ctrlbuy' && t.gate === 0 && t.close >= W.A[0] && t.close < W.A[1])) };
  const j1 = judge(h1), j2 = judge(h2);
  const verdict = !cal.ok ? 'INCONCLUSIVE (calibration gate failed: the harness does not reproduce #431 / #526)' : j1.verdict === 'INCONCLUSIVE' ? `INCONCLUSIVE (${j1.reasons.join('; ')})` : j1.verdict;
  const out = { topic: 'ict-dipbuy-oos', built: new Date().toISOString().slice(0, 10), verdict,
    system: 'ICT desk NQ/ES dip-buy candidate (#431 proposal; the tracker\'s paper \'dip\' shadow rule isDip/dipGate), ict/tracker.mjs signals + isASetup, ict/replay.mjs simulate; OANDA NAS100_USD / SPX500_USD 5m mid 2007-06..2026-10 (#526 cache)',
    windows: { A: '2008-01-01..2017-12-31 UTC by signal close (halves 2008-12 / 2013-17), the pre-registered test', B: '2018-01-01..2026-10-31 (#431 window; IS 2018-23 / OOS 2024-26), the confirmation' },
    cost: 'NQ/ES one round trip 0.02% of price + 0.25 point, in R = cost / r0; net = size x (R - cost); x2 reported', control: 'random H1-close buys, 1 in 10 candles (seed 777), stop 0.3-0.75x daily ATR14, gold exit, same costs, tagged with the 20-day gate at its own close',
    src: res.src, coverage: res.coverage, calibration: cal,
    H1: { rule: 'dip-buy: gold-rule buys (grade >= 3, stop 0.3-0.75x D1 ATR, size 1, no BE, gold exit) only when the last completed D1 close < the D1 close 20 trading days earlier; NQ+ES pooled', A: h1, judge: j1, B: h1B },
    H2: { rule: 'ungated gold-rule buys on NQ+ES (as ict-universe / #431)', A: h2, judge: j2, B: h2B },
    baseline: { rule: 'index A-rule (the live NQ/ES rule, both sides, DOL sizing, BE +1.5R), NQ+ES pooled; #526: NQ -0.073 (n 541), ES -0.068 (n 534), indices-only pooled with YM -0.031', A: base, B: baseB },
    gateSplit2008_17: gateSplit,
    notes: 'Pre-registered (preregistration.md). The trades stage ran once over 2007-26; the 2008-17 statistics were computed only after the pre-registration was pushed. Drift-adjusted = net minus the control mean in the same market, year and gate state (H1) or market and year (H2); CI = calendar-month block bootstrap, rule and control trades of a month resampled together, 5000 reps.' };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  printBlock('H1 dip-buy, 2008-17 (THE TEST)', h1); console.log('judge', JSON.stringify(j1));
  printBlock('H2 ungated gold-rule buys, 2008-17', h2); console.log('judge', JSON.stringify(j2));
  console.log('\n2008-17 gold-rule buys by gate state: on', f(gateSplit.gateOn), '| off', f(gateSplit.gateOff), '| control on', f(gateSplit.ctrlOn), '| control off', f(gateSplit.ctrlOff));
  printBlock('baseline index A-rule, 2008-17', base);
  printBlock('H1 dip-buy, 2018-26 (confirmation)', h1B);
  printBlock('H2 ungated gold-rule buys, 2018-26', h2B);
  printBlock('baseline index A-rule, 2018-26', baseB);
  console.log('\nVERDICT', verdict, '\nwrote', OUT);
}

if (STAGE === 'trades') gen();
else { const { res, T } = loadTrades(); if (STAGE === 'calib') calib(T); else full(T, res); }
