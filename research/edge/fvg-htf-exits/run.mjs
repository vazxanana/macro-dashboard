// research/edge/fvg-htf-exits/run.mjs - the FVG return on H4 and D1 with 2R / 3R / time exits of PREREGISTRATION.md
// (24 Nov 2026). The gap, the band, the control and the market entry are grid7-fvg-wide's own code (imported, never edited);
// the exits are dom-trade-through's manage. Ten markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged AFTER costs.
// Research only: nothing live imports it.
//   EDGE_DATA=<cache> node research/edge/fvg-htf-exits/run.mjs market <m> <outDir>   one market's accumulators
//   EDGE_DATA=<cache> node research/edge/fvg-htf-exits/run.mjs cut <m> <outDir>      the cut test of one market
//   node research/edge/fvg-htf-exits/run.mjs report <outDir>                         result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { bandsOf, eventsOf, frames, MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-fvg-wide/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, manage } from '../dom-trade-through/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TFS = ['4h', '1d'], CAP = { '4h': 5 * 86400, '1d': 20 * 86400 }, SUBS = ['all', 'large'];
export const EXITS = ['1R', '2R', '3R', '4R', '6R', 'trail', 'time'], SLOT = [0, 1, 2, 3, 4, 6, 8]; // manage's R slots
export const KINDS = ['real', 'ctl', 'buy', 'sell'];
export const TESTS = [['T1', '4h', '2R'], ['T2', '4h', '3R'], ['T3', '4h', 'time'], ['T4', '1d', '2R'], ['T5', '1d', '3R'], ['T6', '1d', 'time']];
export const GATE = { n: [13897, 16891], mean: [0.069, 0.053] };      // grid7 4h mkt large 2R, before costs

export const gapFrame = (M5, tf) => (tf === '4h' ? frames(M5)['4h'] : K.dailyNY(M5));

// the market entries (grid7 eventsOf kind 0) of every real gap and control band of the two timeframes
export function signals(M5, market, med = null) {
  const M15 = K.resample(M5, 900), atr15 = atr14(M15), cost = COSTS[market], outMed = {}, sigs = [];
  for (const tf of TFS) { const G = gapFrame(M5, tf), bands = bandsOf(G, market, tf);
    let m = med && med[tf];
    if (m == null) { const r = bands.filter((b) => !b.ctl && b.at >= FROM && b.at < SPLIT).map((b) => b.ratio).sort((p, q) => p - q); m = r.length ? r[r.length >> 1] : 0; }
    outMed[tf] = m;
    for (const b of bands) for (const e of eventsOf(b, G, M15, atr15, M5, cost)) if (e.kind === 0)
      sigs.push({ tf, ctl: b.ctl, large: b.ratio > m, bt: b.at, rt: b.rt, ft: M5[e.fi].t, ...e }); }
  return { sigs, med: outMed };
}

const key = (tf, sub, x, kind) => `${tf}|${sub}|${x}|${kind}`;
function cell() { return { n: [0, 0], sum: [0, 0], sumN: [0, 0], sq: [0, 0], sqN: [0, 0], win: [0, 0], ms: new Array(NM).fill(0), msN: new Array(NM).fill(0) }; }
function add(C, w, m, R, cr) { const r = R - cr; C.n[w]++; C.sum[w] += R; C.sumN[w] += r; C.sq[w] += R * R; C.sqN[w] += r * r; if (r > 0) C.win[w]++; C.ms[m] += R; C.msN[m] += r; }
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const q = (lo + hi) >> 1; if (X[q][0] <= t) lo = q + 1; else hi = q; } return lo > 0 && t <= X[lo - 1][1]; };

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const { sigs, med } = signals(M5, market), cost = COSTS[market], X = exclusions(market), A = {};
  const get = (k) => A[k] || (A[k] = cell());
  let dropped = 0, bad = 0, small = 0, nReal = 0, nCtl = 0;
  for (const sg of sigs) { const t = M5[sg.fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const risk = sg.s * (sg.fill - sg.stop); if (!(risk > 0)) { bad++; continue; }
    if (risk < cost) { small++; continue; }
    const r = manage(M5, sg.s, sg.fi, sg.fill, sg.stop, CAP[sg.tf], sg.firstFull); if (!r) continue;
    const m = monthOf(t), w = t < SPLIT ? 0 : 1, cr = cost / risk;
    const kinds = sg.ctl ? ['ctl'] : ['real', sg.s > 0 ? 'buy' : 'sell']; if (sg.ctl) nCtl++; else nReal++;
    for (const sub of sg.large ? SUBS : ['all']) for (let x = 0; x < EXITS.length; x++) for (const kd of kinds) add(get(key(sg.tf, sub, EXITS[x], kd)), w, m, r.R[SLOT[x]], cr);
  }
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    med, signals: sigs.length, nReal, nCtl, dropped, bad, small, A };
}

export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const k = (g) => [g.tf, g.ctl, g.bt, g.s, g.et, g.fill, g.stop.toFixed(8), g.large].join('|');
  const full = signals(M5, market), out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000, C5 = M5.filter((b) => b.e <= T);
    const A = new Set(signals(C5, market, full.med).sigs.filter((g) => g.et <= T && g.ft < T && g.rt <= T).map(k));
    const B = new Set(full.sigs.filter((g) => g.et <= T && g.ft < T && g.rt <= T).map(k));
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((x) => !A.has(x)).length, extra: [...A].filter((x) => !B.has(x)).length }); }
  return out;
}

// ---- pooled statistics ----
export function pool(data, k) { const C = cell(); for (const d of data) { const S = d.A[k]; if (!S) continue;
  for (const f of ['n', 'sum', 'sumN', 'sq', 'sqN', 'win']) for (let w = 0; w < 2; w++) C[f][w] += S[f][w];
  for (let m = 0; m < NM; m++) { C.ms[m] += S.ms[m]; C.msN[m] += S.msN[m]; } } return C; }
export function win(C, w) { const n = C.n[w], a = w ? DM : 0, b = w ? NM : DM;
  return { n, mean: n ? C.sum[w] / n : null, meanNet: n ? C.sumN[w] / n : null, t: mstat(C.ms, a, b).t, tNet: mstat(C.msN, a, b).t,
    win: n ? C.win[w] / n : null, months: b - a }; }
export function welchNet(a, b, w) { const na = a.n[w], nb = b.n[w]; if (na < 2 || nb < 2) return null;
  const ma = a.sumN[w] / na, mb = b.sumN[w] / nb, va = (a.sqN[w] - na * ma * ma) / (na - 1), vb = (b.sqN[w] - nb * mb * mb) / (nb - 1);
  const se = Math.sqrt(va / na + vb / nb); return se > 0 ? (ma - mb) / se : null; }

const r6 = (x) => (x == null ? null : +x.toFixed(6)), r2 = (x) => (x == null ? null : +x.toFixed(2));
const slim = (s) => ({ n: s.n, mean: r6(s.mean), meanNet: r6(s.meanNet), t: r2(s.t), tNet: r2(s.tNet), win: s.win == null ? null : +s.win.toFixed(3) });

export function judge(data) {
  const rows = TESTS.map(([id, tf, ex]) => { const R = pool(data, key(tf, 'large', ex, 'real')), C = pool(data, key(tf, 'large', ex, 'ctl'));
    const d = win(R, 0), c = win(R, 1);
    return { id, tf, exit: ex, d, c, ctl: { d: win(C, 0), c: win(C, 1) }, vs: { d: welchNet(R, C, 0), c: welchNet(R, C, 1) }, p: p1(c.tNet, c.months - 1) }; });
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = H[i];
    r.checks = { n: r.d.n >= 200 && r.c.n >= 200, positive: r.d.meanNet > 0 && r.c.meanNet > 0, tConf: r.c.tNet >= 2, holm: H[i] < 0.05,
      control: r.vs.c != null && r.vs.c >= 2 };
    r.pass = Object.values(r.checks).every(Boolean); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass);
  const g = win(pool(data, key('4h', 'large', '2R', 'real')), 0), g2 = win(pool(data, key('4h', 'large', '2R', 'real')), 1);
  const gate = { n: [g.n, g2.n], mean: [r6(g.mean), r6(g2.mean)], want: GATE,
    ok: g.n === GATE.n[0] && g2.n === GATE.n[1] && Math.abs(g.mean - GATE.mean[0]) < 0.0006 && Math.abs(g2.mean - GATE.mean[1]) < 0.0006 };
  const best = [...rows].sort((a, b) => b.c.tNet - a.c.tNet)[0];
  const verdict = !gate.ok ? 'INVALID' : pass.length ? 'PASS' : 'FAIL';
  const headline = verdict === 'PASS' ? `${pass.length} of 6 tests pass after costs; ${pass.map((r) => r.id).join(', ')}`
    : `0 of 6 pass after costs; the best, ${best.id} (${best.tf === '4h' ? 'H4' : 'D1'} large ${best.exit}), made ${f3(best.c.meanNet)}R a trade after costs in 2015-26 (n ${N(best.c.n)}, month t ${f2(best.c.tNet)}; ${f3(best.c.mean)}R before costs), ${f3(best.d.meanNet)}R in 2005-14`;
  const grid = [];
  for (const tf of TFS) for (const sub of SUBS) for (const ex of EXITS) { const R = pool(data, key(tf, sub, ex, 'real')), C = pool(data, key(tf, sub, ex, 'ctl'));
    const B = pool(data, key(tf, sub, ex, 'buy')), S = pool(data, key(tf, sub, ex, 'sell'));
    grid.push({ tf, sub, exit: ex, disc: slim(win(R, 0)), conf: slim(win(R, 1)), control: { disc: slim(win(C, 0)), conf: slim(win(C, 1)) },
      vsControlNet: { d: r2(welchNet(R, C, 0)), c: r2(welchNet(R, C, 1)) }, buys: { conf: slim(win(B, 1)) }, sells: { conf: slim(win(S, 1)) } }); }
  const perMarket = {}; for (const [id, tf, ex] of TESTS) perMarket[id] = data.map((d) => { const C = pool([d], key(tf, 'large', ex, 'real')); return { market: d.market, d: slim(win(C, 0)), c: slim(win(C, 1)) }; });
  const out = { study: 'fvg-htf-exits', built: '2026-11-24', verdict, headline, basis: 'judged AFTER costs on calendar-month sums of net R (pre-registered); before costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS, assumedCosts: ASSUMED,
    costs: Object.fromEntries(data.map((d) => [d.market, d.cost])), caps: { '4h': '5 days', '1d': '20 days' }, gate,
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), medians: Object.fromEntries(Object.entries(d.med).map(([k, v]) => [k, +v.toFixed(4)])),
      signals: d.signals, real: d.nReal, control: d.nCtl, dropped: d.dropped, bad: d.bad, small: d.small })),
    cut, tests: rows.map((r) => ({ id: r.id, tf: r.tf, exit: r.exit, disc: slim(r.d), conf: slim(r.c), control: { disc: slim(r.ctl.d), conf: slim(r.ctl.c) },
      vsControlNet: { d: r2(r.vs.d), c: r2(r.vs.c) }, holm: +r.holm.toFixed(4), checks: r.checks, pass: r.pass })), grid, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(runMarket(a))); console.log('done', a); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(r); }
  else if (cmd === 'report') { const r = report(a); console.log(r.verdict, r.headline, JSON.stringify(r.gate)); }
  else console.log('usage: market <m> <dir> | cut <m> <dir> | report <dir>');
}
