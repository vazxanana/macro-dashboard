// research/edge/ifvg-daily-eg-zone/run.mjs - the study of PREREGISTRATION.md (24 Nov 2026): the ICT desk's H1 inversion-gap
// reversal (ict/tracker.mjs `signals`, imported) split by whether the sweep happened inside a Daily engulf zone or failed
// engulf zone of the trade's side (council/eg-methods.mjs `zones`, imported). Research only: nothing live imports it,
// nothing is placed, nothing under ict/ or council/ is edited.
//   node research/edge/ifvg-daily-eg-zone/run.mjs run      (reads the candle cache, writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { signals } from '../../../ict/tracker.mjs';
import { zones } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const TICK = { xau: 0.1, usdjpy: 0.01, eurusd: 0.0001, gbpusd: 0.0001, audusd: 0.0001 };
export const CLASSES = ['in', 'eg', 'ef'], TARGETS = [1, 2, 3];
export const EF_DAYS = 60, HOLD = 36 * 3600;
export const FROM = '2005-01-01', SPLIT = '2015-01-01', TO = '2026-11-01';
const sec = (d) => Date.parse(d + 'T00:00:00Z') / 1000;
const tk = (b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c });

// Daily zones with what is needed to judge them at a moment T without reading anything later.
export function dailyZones(D) {
  const C = D.map((d) => ({ time: d.e - 86400, open: d.o, high: d.h, low: d.l, close: d.c })); // time + 86400 = the day's real close
  return { C, Z: zones(C, '1d') };
}
// classes of a trade of side d whose sweep extreme is x, at moment T (only Daily candles closed by T are read)
export function classAt(dz, d, x, T) {
  let eg = false, ef = false;
  for (const z of dz.Z) {
    if (z.at > T) continue;
    if (!(x >= z.bot && x <= z.top)) continue;
    if (z.dir === d) { if (!(z.fail != null && z.fail <= T) && z.end > T) eg = true; }
    else if (z.fail != null && z.fail <= T && T - z.fail <= EF_DAYS * 86400) {
      let back = false;
      for (let j = z.fi + 1; j < dz.C.length && dz.C[j].time + 86400 <= T; j++) { const c = dz.C[j].close; if (z.dir > 0 ? c > z.top : c < z.bot) { back = true; break; } }
      if (!back) ef = true;
    }
    if (eg && ef) break;
  }
  return { eg, ef, in: eg || ef, out: !(eg || ef) };
}
// every signal of one market with its class; no outcome here
export function setups(M5, market) {
  const H = K.resample(M5, 3600).map(tk), D = K.dailyNY(M5), dz = dailyZones(D), tick = TICK[market], out = [];
  for (const side of [1, -1]) for (const g of signals(H, dz.C, side, tick)) {
    const x = g.stop + side * 2 * tick;
    out.push({ market, side, t: g.close, sweepT: g.sweepT, stop: g.stop, x, sigEntry: g.entry, cls: classAt(dz, side, x, g.sweepT) });
  }
  return out.sort((a, b) => a.t - b.t);
}
// the trades of one setup for the three targets
export function trade(s, M5, cost) {
  const out = [];
  for (const rr of TARGETS) {
    // the fill decides the target: read the fill first
    let lo = 0, hi = M5.length; while (lo < hi) { const m = (lo + hi) >> 1; if (M5[m].t < s.t) lo = m + 1; else hi = m; }
    if (lo >= M5.length) { out.push({ rr, status: 'nofill' }); continue; }
    const fill = M5[lo].o, risk = s.side * (fill - s.stop);
    if (!(risk > 0)) { out.push({ rr, status: 'bad' }); continue; }
    const r = K.simulate({ side: s.side, stop: s.stop, target: fill + s.side * rr * risk, t: s.t, type: 'market', maxHold: HOLD }, M5, { cost });
    out.push({ rr, ...r });
  }
  return out;
}

// ---- statistics ---------------------------------------------------------------------------------------------------
const mk = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function mstat(rows, m0, m1) { // rows: [{ t, R, Rnet }]; months m0..m1 inclusive, empty = 0
  const n = rows.length; if (!n) return { n: 0, win: null, gross: null, net: null, tMonth: null, p1: null, months: m1 - m0 + 1 };
  const sums = new Array(m1 - m0 + 1).fill(0); let g = 0, a = 0, w = 0;
  for (const r of rows) { g += r.R; a += r.Rnet; if (r.Rnet > 0) w++; const k = mk(r.t) - m0; if (k >= 0 && k < sums.length) sums[k] += r.Rnet; }
  const M = sums.length, mean = sums.reduce((x, y) => x + y, 0) / M, sd = Math.sqrt(sums.reduce((x, y) => x + (y - mean) ** 2, 0) / (M - 1));
  const t = sd > 0 ? mean / (sd / Math.sqrt(M)) : null, p2 = t == null ? null : K.pFromT(t, M - 1);
  return { n, win: w / n, gross: g / n, net: a / n, tMonth: t, p1: t == null ? 1 : t > 0 ? p2 / 2 : 1 - p2 / 2, months: M };
}
export function welch(a, b, key = 'Rnet') {
  const mo = (x) => { const n = x.length, m = x.reduce((s, r) => s + r[key], 0) / n, v = x.reduce((s, r) => s + (r[key] - m) ** 2, 0) / (n - 1); return { n, m, v }; };
  if (a.length < 2 || b.length < 2) return { diff: null, t: null };
  const A = mo(a), B = mo(b); return { diff: A.m - B.m, t: (A.m - B.m) / Math.sqrt(A.v / A.n + B.v / B.n) };
}

function run() {
  const a = sec(FROM), s = sec(SPLIT), b = sec(TO);
  const rows = {}; for (const c of [...CLASSES, 'out']) for (const rr of TARGETS) rows[c + ' ' + rr + 'R'] = [];
  const counts = { signals: 0, bad: 0, nofill: 0, open: 0, byMarket: {} };
  for (const market of MARKETS) {
    let M5 = K.load(market, '5m', { from: FROM, to: TO });
    const S = setups(M5, market); const cm = { signals: S.length, in: 0, eg: 0, ef: 0, out: 0 };
    for (const st of S) {
      for (const c of [...CLASSES, 'out']) if (st.cls[c]) cm[c]++;
      for (const r of trade(st, M5, K.COSTS[market])) {
        if (r.status === 'bad') { if (r.rr === 1) counts.bad++; continue; }
        if (r.status === 'nofill') { if (r.rr === 1) counts.nofill++; continue; }
        if (r.status === 'open') { if (r.rr === 1) counts.open++; continue; }
        if (r.fillT < a || r.fillT >= b) continue;
        const row = { t: r.fillT, R: r.R, Rnet: r.Rnet, market };
        for (const c of [...CLASSES, 'out']) if (st.cls[c]) rows[c + ' ' + r.rr + 'R'].push(row);
      }
    }
    counts.signals += S.length; counts.byMarket[market] = cm; M5 = null;
    console.error(market, JSON.stringify(cm));
  }
  const all = Object.values(rows).flat(); let first = Infinity; for (const r of all) if (r.t < first) first = r.t;
  const W = { disc: [Math.max(mk(first), mk(a)), mk(s) - 1, (r) => r.t < s], conf: [mk(s), mk(b) - 1, (r) => r.t >= s] };
  const cells = {};
  for (const [name, rs] of Object.entries(rows)) { cells[name] = {}; for (const [w, [m0, m1, f]] of Object.entries(W)) cells[name][w] = mstat(rs.filter(f), m0, m1); }
  const tested = CLASSES.flatMap((c) => TARGETS.map((rr) => c + ' ' + rr + 'R'));
  const hp = K.holm(tested.map((n) => cells[n].conf.p1)); tested.forEach((n, i) => { cells[n].holm = hp[i]; });
  for (const n of tested) { const c = cells[n];
    c.enough = c.disc.n >= 300 && c.conf.n >= 300;
    c.pass = c.enough && c.disc.net > 0 && c.conf.net > 0 && c.disc.tMonth >= 2 && c.conf.tMonth >= 2 && c.holm < 0.05; }
  const diff = {}; for (const rr of TARGETS) { diff[rr + 'R'] = {}; for (const [w, [, , f]] of Object.entries(W)) diff[rr + 'R'][w] = welch(rows['in ' + rr + 'R'].filter(f), rows['out ' + rr + 'R'].filter(f)); }
  const byMarket = {}; for (const m of MARKETS) { byMarket[m] = {}; for (const [w, [m0, m1, f]] of Object.entries(W)) byMarket[m][w] = mstat(rows['in 2R'].filter((r) => r.market === m && f(r)), m0, m1); }
  const passed = tested.filter((n) => cells[n].pass), anyEnough = tested.some((n) => cells[n].enough);
  const verdict = passed.length ? 'PASS' : anyEnough ? 'FAIL' : 'INCONCLUSIVE';
  // best cell: the tested cell with n >= 300 in both windows and the highest confirmation after-cost R (any tested cell if none)
  const pool = tested.filter((n) => cells[n].enough); const best = (pool.length ? pool : tested).slice().sort((x, y) => (cells[y].conf.net ?? -9) - (cells[x].conf.net ?? -9))[0];
  const res = { study: 'ifvg-daily-eg-zone', built: '2026-11-24', windows: { discovery: [FROM, SPLIT], confirmation: [SPLIT, TO] }, markets: MARKETS,
    costs: Object.fromEntries(MARKETS.map((m) => [m, K.COSTS[m]])), counts, tested, cells, diff, byMarket, passed, best, verdict };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
  console.error(verdict, best, JSON.stringify(cells[best]));
}

export const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3));
const f2 = (x) => (x == null ? 'n/a' : x.toFixed(2));
export function headline(res) {
  const c = res.cells[res.best], n = c.conf.n.toLocaleString('en-US');
  const tail = `the best cell, ${res.best}, made ${f3(c.conf.net)}R a trade after costs in 2015-26 (n ${n}, month t ${f2(c.conf.tMonth)}; discovery ${f3(c.disc.net)}R, n ${c.disc.n.toLocaleString('en-US')}, t ${f2(c.disc.tMonth)})`;
  return `**Verdict: ${res.verdict}. ${res.passed.length} of ${res.tested.length} cells pass; ${tail}.**`;
}
export function report(res) {
  const L = [];
  L.push('# H1 inversion-gap reversal inside a Daily engulf zone: result (24 Nov 2026)', '', headline(res), '');
  L.push('Pre-registered in PREREGISTRATION.md (committed alone before this run). The ICT desk\'s H1 signal function, every signal, split by',
    'whether the sweep\'s extreme lay inside a Daily engulf zone (`eg`), a failed and turned Daily engulf zone (`ef`), either (`in`) or',
    'neither (`out`, the control) of the trade\'s side. Five markets pooled (xau, eurusd, gbpusd, usdjpy, audusd), OANDA mid 5-minute',
    'candles, market entry after the H1 close, the signal\'s stop, a 1R / 2R / 3R target, out after 36 hours. Research only.', '');
  L.push(`Signals: ${res.counts.signals.toLocaleString('en-US')} (fills already past the stop, no trade: ${res.counts.bad}; still open at the end of the data: ${res.counts.open}).`, '');
  L.push('## Every cell', '', 'R a trade before costs / after costs; month t = t of calendar-month sums after costs; Holm over the 9 tested cells (confirmation, one-sided).', '');
  L.push('| cell | disc n | disc win | disc before | disc after | disc month t | conf n | conf win | conf before | conf after | conf month t | Holm p | pass |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [name, c] of Object.entries(res.cells)) { const pc = (x) => (x == null ? 'n/a' : Math.round(x * 100) + '%');
    L.push(`| ${name}${res.tested.includes(name) ? '' : ' (control)'} | ${c.disc.n} | ${pc(c.disc.win)} | ${f3(c.disc.gross)} | ${f3(c.disc.net)} | ${f2(c.disc.tMonth)} | ${c.conf.n} | ${pc(c.conf.win)} | ${f3(c.conf.gross)} | ${f3(c.conf.net)} | ${f2(c.conf.tMonth)} | ${c.holm == null ? '' : c.holm.toFixed(3)} | ${c.pass == null ? '' : c.pass ? 'yes' : 'no'} |`); }
  L.push('', '## Inside a zone against outside (after costs, Welch t on trades; reported, not part of the bar)', '', '| target | discovery in - out | t | confirmation in - out | t |', '|---|---|---|---|---|');
  for (const [k, d] of Object.entries(res.diff)) L.push(`| ${k} | ${f3(d.disc.diff)} | ${f2(d.disc.t)} | ${f3(d.conf.diff)} | ${f2(d.conf.t)} |`);
  L.push('', '## By market, the `in 2R` cell (after costs)', '', '| market | signals | in a zone | disc n | disc after | conf n | conf after |', '|---|---|---|---|---|---|---|');
  for (const m of res.markets) { const b = res.byMarket[m], c = res.counts.byMarket[m]; L.push(`| ${m} | ${c.signals} | ${c.in} | ${b.disc.n} | ${f3(b.disc.net)} | ${b.conf.n} | ${f3(b.conf.net)} |`); }
  L.push('', '## Reading', '');
  L.push(res.verdict === 'PASS'
    ? 'A cell cleared the pre-registered bar. That is one study on OANDA mid candles with flat costs: a hypothesis for a holdout, not a rule.'
    : res.verdict === 'INCONCLUSIVE' ? 'No cell reached 300 trades in both windows: too few to judge.'
    : 'No cell cleared the bar. The Daily engulf zone does not turn the H1 inversion-gap reversal into a rule that makes money after costs on these five markets; see the in-minus-out table for whether the zone picks better trades at all.');
  { const tot = res.counts.signals, inn = res.markets.reduce((a, m) => a + res.counts.byMarket[m].in, 0);
    L.push('', `Note: ${Math.round((inn / tot) * 100)}% of all signals fall inside such a zone (a Daily zone lives up to 120 days, so several usually stand near price): the condition is loose, and it does not separate better trades from worse ones in the confirmation window.`); }
  L.push('', 'Limits: OANDA mid candles, no spread widening, a flat round-trip cost per market for every year; H1 candles are UTC hours of',
    'spot candles (the desk itself trades futures hours); gold starts in March 2006; no data-quality exclusion list; `eg` and `ef` overlap',
    'with `in`, so the nine cells are not independent. One run, no variant tested after the result. Nothing live changed.', '');
  return L.join('\n');
}

if (process.argv[1] && process.argv[1].endsWith('ifvg-daily-eg-zone/run.mjs') && process.argv[2] === 'run') run();
