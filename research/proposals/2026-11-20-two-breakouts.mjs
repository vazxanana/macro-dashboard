// Accounting, not a study: the two breakout streams that passed (gold T1 at the measured C1 cost, USD/JPY T1 at the demo's
// cost) side by side as one paper book, from the forward studies' committed baselines. No rule is tested, no verdict.
//   node research/proposals/2026-11-20-two-breakouts.mjs   -> 2026-11-20-two-breakouts.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '..', '..');
const load = (s) => JSON.parse(fs.readFileSync(path.join(ROOT, 'research/edge', s, 'baseline.json'), 'utf8'));
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const r3 = (v) => Math.round(v * 1000) / 1000;
export function months(rows, from, to) { const m = new Map(); for (const [d, r] of rows) if (d >= from && d <= to) m.set(d.slice(0, 7), (m.get(d.slice(0, 7)) || 0) + r); return m; }
export function maxDD(series) { let peak = 0, cum = 0, dd = 0; for (const v of series) { cum += v; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); } return dd; }
export function book(G, J, from, to) {
  const g = months(G, from, to), j = months(J, from, to), keys = [...new Set([...g.keys(), ...j.keys()])].sort();
  const a = keys.map((k) => g.get(k) || 0), b = keys.map((k) => j.get(k) || 0), c = a.map((v, i) => v + b[i]);
  const tOf = (x) => mean(x) / (sd(x) / Math.sqrt(x.length)), ma = mean(a), mb = mean(b);
  const corr = a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0) / ((a.length - 1) * sd(a) * sd(b));
  const day = (rows) => rows.filter(([d]) => d >= from && d <= to);
  const one = (x, rows) => ({ trades: day(rows).length, R: r3(x.reduce((s, v) => s + v, 0)), perYear: r3((mean(x) * 12)), monthT: r3(tOf(x)), worstMonth: r3(Math.min(...x)), maxDD: r3(maxDD(day(rows).map((r) => r[1]))) });
  const both = [...day(G), ...day(J)].sort((p, q) => (p[0] < q[0] ? -1 : 1));
  const G2 = new Map(day(G)), J2 = new Map(day(J)), sd2 = [...G2.keys()].filter((d) => J2.has(d)), ga = sd2.map((d) => G2.get(d)), ja = sd2.map((d) => J2.get(d));
  const mg = mean(ga), mj = mean(ja), dCorr = ga.reduce((x, v, i) => x + (v - mg) * (ja[i] - mj), 0) / Math.sqrt(ga.reduce((x, v) => x + (v - mg) ** 2, 0) * ja.reduce((x, v) => x + (v - mj) ** 2, 0));
  const gl = ga.filter((v) => v < 0).length, jl = ja.filter((v) => v < 0).length, bl = sd2.filter((d) => G2.get(d) < 0 && J2.get(d) < 0).length;
  const daily = { sharedDays: sd2.length, corr: r3(dCorr), bothLose: bl, bothLoseIfIndependent: Math.round((gl * jl) / sd2.length) };
  return { from, to, months: keys.length, daily, gold: one(a, G), usdjpy: one(b, J), book: { ...one(c, both), trades: both.length }, monthlyCorr: r3(corr) };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const G = load('gold-vol-breakout-forward').rows, J = load('usdjpy-vol-breakout-forward').rows;
  const out = { built: '2026-11-20', what: 'Gold T1 (C1 cost) and USD/JPY T1 (demo cost) at 1R a trade each, from the forward studies\' baseline rows; in-sample years for both rules.', window: book(G, J, '2021-01-01', '2026-10-31') };
  fs.writeFileSync(path.join(HERE, '2026-11-20-two-breakouts.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out, null, 1));
}
