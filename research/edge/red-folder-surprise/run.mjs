// Red folder surprise (pre-registered in PREREGISTRATION.md, 19 Nov 2026): does gold's first hour after US CPI / payrolls
// follow the miss against the calendar consensus? Reads committed files only, no network:
//   node research/edge/red-folder-surprise/run.mjs        → writes result.json and prints the table
import fs from 'node:fs';
import { loadInputs } from '../../../council/redfolder.mjs';

const J = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
export const COST = 0.03, OOS_FROM = '2022-01-01', RE = { CPI: /^Core CPI m\/m/, NFP: /^Non-Farm Employment Change/ };
const num = (x) => { const v = parseFloat(String(x ?? '').replace(/[^\d.+-]/g, '')); return Number.isFinite(v) ? v : null; };

// first prints from the veteran batch (2022-24): CPI core from the benchmark inputs, payrolls from the jobs ledger
export function firstPrints(I) {
  const m = new Map();
  for (const r of (I.bench && I.bench.records) || []) { const a = r.measure && r.measure.core && r.measure.core.actual; if (a && r.release_date) m.set('CPI|' + r.release_date, a.numeric); }
  for (const j of I.jobs || []) { const v = num(j.payroll_change_jobs_current_first_release); if (j.scheduled_at_utc && v != null) m.set('NFP|' + String(j.scheduled_at_utc).slice(0, 10), Math.round(v / 1000)); }
  return m;
}

export function events(base, hist, fp = new Map()) {
  const out = [];
  for (const r of base.rows || []) {
    if (!RE[r.type] || r.g5 == null || r.g5to60 == null) continue;
    const h = (hist.rows || []).find((x) => RE[r.type].test(x[0]) && Date.parse(x[1]) / 1000 === r.t); if (!h) continue;
    const cons = num(h[2]), act = fp.has(r.type + '|' + r.d) ? fp.get(r.type + '|' + r.d) : num(h[3]); if (cons == null || act == null) continue;
    const s = +(act - cons).toFixed(4), src = fp.has(r.type + '|' + r.d) ? 'first print' : 'calendar'; if (s === 0) continue;
    const d = -Math.sign(s);
    out.push({ type: r.type, d: r.d, t: r.t, cons, act, actSrc: src, surprise: s, dir: d, g5: r.g5, g5to60: r.g5to60, g60: r.g60, R: +(d * r.g5to60 - COST).toFixed(4), oos: r.d >= OOS_FROM });
  }
  return out;
}

export function stat(xs) {
  const n = xs.length; if (!n) return { n: 0 };
  const m = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
  return { n, mean: +m.toFixed(4), t: sd ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null, win: +(xs.filter((x) => x > 0).length / n).toFixed(3) };
}
// two-sided binomial p against 50 %
export function binomP(k, n) {
  const lp = (i) => { let s = 0; for (let j = 1; j <= n; j++) s += Math.log(j); for (let j = 1; j <= i; j++) s -= Math.log(j); for (let j = 1; j <= n - i; j++) s -= Math.log(j); return s + n * Math.log(0.5); };
  const pk = lp(k); let p = 0; for (let i = 0; i <= n; i++) { const q = lp(i); if (q <= pk + 1e-9) p += Math.exp(q); } return Math.min(1, +p.toFixed(4));
}

export function analyse(E) {
  const part = (fn) => E.filter(fn), t1 = (xs) => { const k = xs.filter((e) => Math.sign(e.g5) === e.dir).length; return { n: xs.length, agree: k, share: xs.length ? +(k / xs.length).toFixed(3) : null, p: binomP(k, xs.length) }; };
  const T2 = (xs) => stat(xs.map((e) => e.R)), gross = (xs) => stat(xs.map((e) => e.dir * e.g5to60)), full = (xs) => stat(xs.map((e) => e.dir * e.g60));
  const IS = part((e) => !e.oos), OOS = part((e) => e.oos);
  const big = (xs) => { const ab = xs.map((e) => Math.abs(e.surprise / (e.type === 'NFP' ? 100 : 0.1))).sort((a, b) => a - b), med = ab[Math.floor(ab.length / 2)];
    return { median: med, above: T2(xs.filter((e) => Math.abs(e.surprise / (e.type === 'NFP' ? 100 : 0.1)) > med)), atOrBelow: T2(xs.filter((e) => Math.abs(e.surprise / (e.type === 'NFP' ? 100 : 0.1)) <= med)) }; };
  const T2is = T2(IS), T2oos = T2(OOS);
  const pass = T2is.mean > 0 && T2oos.mean > 0 && T2oos.t >= 2;
  return { n: E.length, T1: { all: t1(E), inSample: t1(IS), outOfSample: t1(OOS) },
    T2: { inSample: T2is, outOfSample: T2oos, all: T2(E), byType: { CPI: { inSample: T2(IS.filter((e) => e.type === 'CPI')), outOfSample: T2(OOS.filter((e) => e.type === 'CPI')) }, NFP: { outOfSample: T2(OOS.filter((e) => e.type === 'NFP')) } } },
    reported: { grossT5toT60: { inSample: gross(IS), outOfSample: gross(OOS) }, releaseToT60NotTradable: { inSample: full(IS), outOfSample: full(OOS) }, bySize: big(E) },
    verdict: pass ? 'PASS' : 'FAIL' };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const I = loadInputs(), base = J('../../../council/event-base.json'), hist = J('../../../council/consensus-history.json');
  const E = events(base, hist, firstPrints(I)), A = analyse(E);
  const res = { study: 'red-folder-surprise', title: 'Red folder surprise: gold\'s first hour after US CPI and payrolls, by the miss against the calendar consensus', built: '2026-11-19', cost: COST, oosFrom: OOS_FROM, ...A, events: E };
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ n: A.n, T1: A.T1, T2: A.T2, reported: A.reported, verdict: A.verdict }, null, 1));
}
