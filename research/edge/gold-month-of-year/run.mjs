// Gold's month of the year, as the gold terminal's seasonal tile encodes it (PREREGISTRATION.md, pushed first).
//   node research/edge/gold-month-of-year/run.mjs fetch <dir>   copies council-data research/daily/xau.json (git show, no network)
//   node research/edge/gold-month-of-year/run.mjs full <dir>    the study -> result.json (+ prints the tables)
// Pure pieces are exported for the test. Paper only: nothing here is read by the council or the page.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights, FIN, stopFill } from '../../../council/fills.mjs';

export const STRONG = [10, 11, 0, 1];            // the page's seasS: Nov, Dec, Jan, Feb (0 = January)
export const WEAK = [2, 5];                      // March, June
export const OUTSIDE = [0, 7, 8];                // the outside claim's strong months (Jan, Aug, Sep): reported only
export const COST = 0.30, ATR_N = 20, ATR_K = 3, SEED = 20261114, DRAWS = 1000;
export const DECISIVE_FROM = Date.UTC(2016, 0, 1) / 1000;
const H = 3600, NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const monthOf = (k) => k % 12, yearOf = (k) => Math.floor(k / 12);
const startOf = (k) => Date.UTC(yearOf(k), monthOf(k), 1) / 1000;

// folded weekday candles grouped by UTC calendar month; the month holding the last candle is dropped (incomplete)
export function months(rows) {
  const bars = foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
  const out = []; let cur = null;
  for (let i = 0; i < bars.length; i++) { const k = ym(bars[i].time);
    if (!cur || cur.k !== k) { cur = { k, i0: i, i1: i }; out.push(cur); } else cur.i1 = i; }
  if (out.length) out.pop();
  return { bars, months: out };
}
const exitTime = (t) => t + (new Date(t * 1000).getUTCDay() === 5 ? 21 : 23) * H;

// T1: one long per month, entry at the month's first open, stop 3 x ATR(20) below, out at the last close or the stop
export function position(bars, m, { cost = COST, finMult = 1 } = {}) {
  if (m.i0 < ATR_N) return null;
  let tr = 0; for (let j = m.i0 - ATR_N; j < m.i0; j++) { const b = bars[j], pc = bars[j - 1] ? bars[j - 1].close : b.open;
    tr += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  const atr = tr / ATR_N, entry = bars[m.i0].open, risk = ATR_K * atr, stop = entry - risk;
  if (!(risk > 0)) return null;
  let exit = null, t = null, how = 'close';
  for (let j = m.i0; j <= m.i1; j++) { const b = bars[j];
    if (b.low <= stop) { exit = stopFill(b, false, stop, j > m.i0); t = exitTime(b.time); how = 'stop'; break; } }
  if (exit == null) { exit = bars[m.i1].close; t = exitTime(bars[m.i1].time); }
  const R = (exit - entry) / risk, nn = nights(bars[m.i0].time, t), fin = finMult * nn * FIN.xau.long * entry / risk;
  return { k: m.k, mo: monthOf(m.k), entry, stop, risk, exit, how, R, nights: nn, fin, net: R - cost / risk - fin };
}
// T2 / T3: a month's mean daily close-to-close log return, in basis points
export function monthRet(bars, m) {
  if (m.i0 < 1) return null;
  let s = 0; for (let j = m.i0; j <= m.i1; j++) s += Math.log(bars[j].close / bars[j - 1].close);
  return { k: m.k, mo: monthOf(m.k), v: 1e4 * s / (m.i1 - m.i0 + 1) };
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdOf = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
// regularized incomplete beta (Numerical Recipes continued fraction) -> Student t tails
function betacf(a, b, x) {
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-14) break; }
  return h;
}
function lgamma(z) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
export function ibeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
// one-sided p of a Student t at t with df (P(T >= t))
export const pUpper = (t, df) => { const p2 = ibeta(df / (df + t * t), df / 2, 0.5) / 2; return t >= 0 ? p2 : 1 - p2; };
export function welch(a, b) {
  const va = sdOf(a) ** 2 / a.length, vb = sdOf(b) ** 2 / b.length, diff = mean(a) - mean(b), se = Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1)), t = diff / se;
  return { diff, t, df, p: pUpper(t, df) };
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), out = Array(ps.length); let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); out[i] = run; });
  return out;
}
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function randomSet(rng, size) { const a = [...Array(12).keys()]; for (let i = 11; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, size).sort((x, y) => x - y); }

// the claimed set's statistic: in-set minus out-of-set (sign = +1) or out-of-set minus in-set (sign = -1, the short claim)
export function compare(rows, set, sign = 1, key = 'net') {
  const a = rows.filter((r) => set.includes(r.mo)).map((r) => r[key]), b = rows.filter((r) => !set.includes(r.mo)).map((r) => r[key]);
  const w = sign > 0 ? welch(a, b) : welch(b, a);
  return { nIn: a.length, nOut: b.length, meanIn: mean(a), meanOut: mean(b), diff: w.diff, t: w.t, df: w.df, p: w.p };
}
export function placebo(rows, set, sign, key, draws = DRAWS, seed = SEED) {
  const rng = mulberry32(seed), want = compare(rows, set, sign, key).diff; let ge = 0;
  for (let i = 0; i < draws; i++) if (compare(rows, randomSet(rng, set.length), sign, key).diff >= want - 1e-12) ge++;
  return ge / draws;
}
export function book(P) {
  const n = P.length, a = P.map((x) => x.net), m = mean(a), sd = n > 1 ? sdOf(a) : 0; let eq = 0, pk = 0, dd = 0;
  for (const x of a) { eq += x; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, gross: +mean(P.map((x) => x.R)).toFixed(3), net: +m.toFixed(3), t: sd ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null, total: +a.reduce((x, y) => x + y, 0).toFixed(1), dd: +dd.toFixed(1), stops: P.filter((x) => x.how === 'stop').length };
}

const r3 = (x) => +x.toFixed(3), r2 = (x) => +x.toFixed(2), r4 = (x) => +x.toFixed(4);
const pack = (c) => ({ nIn: c.nIn, nOut: c.nOut, meanIn: r3(c.meanIn), meanOut: r3(c.meanOut), diff: r3(c.diff), t: r2(c.t), df: +c.df.toFixed(1), p: r4(c.p) });
const label = (k) => `${yearOf(k)}-${String(monthOf(k) + 1).padStart(2, '0')}`;

export function study(rows) {
  const { bars, months: M } = months(rows);
  const P1 = M.map((m) => position(bars, m)).filter(Boolean), P2x = M.map((m) => position(bars, m, { cost: 2 * COST, finMult: 2 })).filter(Boolean);
  const RT = M.map((m) => monthRet(bars, m)).filter(Boolean);
  const dec = (r) => startOf(r.k) >= DECISIVE_FROM, rep = (r) => !dec(r);
  const W = { decisive: dec, replication: rep };
  const span = (a) => a.length ? `${label(a[0].k)} to ${label(a.at(-1).k)}` : null;
  const out = { windows: {}, tests: {}, placebo: {}, costCheck: {}, perMonth: {}, outside: {}, years: [] };
  for (const [w, f] of Object.entries(W)) out.windows[w] = { T1: span(P1.filter(f)), T2: span(RT.filter(f)) };
  for (const [w, f] of Object.entries(W)) {
    const p = P1.filter(f), r = RT.filter(f);
    out.tests[w] = {
      T1: { ...pack(compare(p, STRONG, 1, 'net')), gross: pack(compare(p, STRONG, 1, 'R')), strongBook: book(p.filter((x) => STRONG.includes(x.mo))), otherBook: book(p.filter((x) => !STRONG.includes(x.mo))), everyBook: book(p) },
      T2: pack(compare(r, STRONG, 1, 'v')),
      T3: pack(compare(r, WEAK, -1, 'v')),
    };
    out.perMonth[w] = NAMES.map((name, mo) => { const rr = r.filter((x) => x.mo === mo).map((x) => x.v), pp = p.filter((x) => x.mo === mo);
      return { month: name, n: rr.length, bpDay: r3(mean(rr)), book: book(pp) }; });
    out.outside[w] = { T1: pack(compare(p, OUTSIDE, 1, 'net')), T2: pack(compare(r, OUTSIDE, 1, 'v')) };
    const p2 = P2x.filter(f), c2 = compare(p2, STRONG, 1, 'net');
    out.costCheck[w] = { diff: r3(c2.diff), t: r2(c2.t), strongNet: book(p2.filter((x) => STRONG.includes(x.mo))).net };
  }
  const pd = P1.filter(dec), rd = RT.filter(dec);
  out.placebo = { T1: placebo(pd, STRONG, 1, 'net'), T2: placebo(rd, STRONG, 1, 'v'), T3: placebo(rd, WEAK, -1, 'v'), outsideT1: placebo(pd, OUTSIDE, 1, 'net'), outsideT2: placebo(rd, OUTSIDE, 1, 'v') };
  const D = out.tests.decisive, Rp = out.tests.replication, adj = holm([D.T1.p, D.T2.p, D.T3.p]);
  out.holm = { T1: r4(adj[0]), T2: r4(adj[1]), T3: r4(adj[2]) };
  const pass = {
    T1: { bothWindows: D.T1.diff > 0 && Rp.T1.diff > 0 && D.T1.strongBook.net > 0 && Rp.T1.strongBook.net > 0, holm: adj[0] < 0.05, placebo: out.placebo.T1 < 0.05, cost2x: out.costCheck.decisive.diff > 0 && out.costCheck.decisive.strongNet > 0 },
    T2: { bothWindows: D.T2.diff > 0 && Rp.T2.diff > 0, holm: adj[1] < 0.05, placebo: out.placebo.T2 < 0.05 },
    T3: { bothWindows: D.T3.diff > 0 && Rp.T3.diff > 0, holm: adj[2] < 0.05, placebo: out.placebo.T3 < 0.05 },
  };
  for (const k of Object.keys(pass)) pass[k].pass = Object.values(pass[k]).every(Boolean);
  out.pass = pass;
  const n = Object.values(pass).filter((x) => x.pass).length;
  out.verdict = n === 3 ? 'PASS' : n ? 'PARTIAL' : 'FAIL';
  const ys = [...new Set(P1.map((x) => yearOf(x.k)))];
  out.years = ys.map((y) => { const s = P1.filter((x) => yearOf(x.k) === y && STRONG.includes(x.mo)); return { year: y, n: s.length, net: r2(s.reduce((a, x) => a + x.net, 0)) }; });
  out.positions = P1.length; out.monthsN = RT.length;
  return out;
}

async function main() {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: run.mjs fetch|full <dir>'); process.exit(2); }
  const file = path.join(dir, 'xau.json');
  if (cmd === 'fetch') { fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 1 << 28 })); console.log('wrote', file); return; }
  const raw = fs.readFileSync(file), j = JSON.parse(raw);
  const res = study(j.rows);
  const doc = { study: 'gold-month-of-year', built: '2026-11-14', verdict: res.verdict,
    claim: { strong: STRONG.map((m) => NAMES[m]), weak: WEAK.map((m) => NAMES[m]), outsideReportedOnly: OUTSIDE.map((m) => NAMES[m]), source: 'gold-trading.html computeMacroScore seasS' },
    data: { file: 'council-data research/daily/xau.json', src: j.src, sha256: crypto.createHash('sha256').update(raw).digest('hex'), first: new Date(j.rows[0][0] * 1000).toISOString().slice(0, 10), last: new Date(j.rows.at(-1)[0] * 1000).toISOString().slice(0, 10) },
    costs: { roundTrip: COST, financing: FIN.xau.long, financingSrc: FIN.xau.src }, ...res,
    note: 'Gold only. Not a gate on the live gold book (owner item 44). A pass would only change the gold terminal wording, by the owner.' };
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(doc, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, windows: res.windows, tests: res.tests, holm: res.holm, placebo: res.placebo, costCheck: res.costCheck, pass: res.pass, outside: res.outside }, null, 1));
  for (const w of ['decisive', 'replication']) console.table(res.perMonth[w].map((x) => ({ m: x.month, n: x.n, bp: x.bpDay, bookN: x.book.n, net: x.book.net, t: x.book.t })));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
