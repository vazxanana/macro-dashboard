// The playbook's Daily-regime filter (20-day efficiency ratio) on the weekly-bull daily rejection long (PREREGISTRATION.md, first).
//   node research/edge/gold-drd-er/run.mjs full <dir>   <dir> holds xau-h1.json from gold-drd-long's `fetch`
// The rule, the trade and the statistics are gold-drd-long's own, imported unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { nyDay, days, weeks, weekState, signals, simulate, stats, welch } from '../gold-drd-long/run.mjs';

const D = 86400, N = 20;
// ER over the N daily closes up to and including day i; null with fewer than N + 1 days
export function er(ds, i, n = N) {
  if (i < n) return null;
  let path_ = 0; for (let k = i - n + 1; k <= i; k++) path_ += Math.abs(ds[k].close - ds[k - 1].close);
  return path_ > 0 ? Math.abs(ds[i].close - ds[i - n].close) / path_ : 0;
}
export const up = (ds, i, n = N) => i >= n && ds[i].close > ds[i - n].close;
export function dd(T) { let eq = 0, pk = 0, m = 0; for (const x of [...T].sort((a, b) => a.entryT - b.entryT)) { eq += x.net; pk = Math.max(pk, eq); m = Math.min(m, eq - pk); } return +m.toFixed(1); }

function full(dir) {
  const h1 = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const ds = days(h1), wk = weeks(ds), wst = weekState(wk), start = new Map();
  h1.forEach((b, k) => { const d = nyDay(b.time); if (d != null && !start.has(d)) start.set(d, k); });
  const ymd = (d) => new Date(d * D * 1000).toISOString().slice(0, 10);
  const R = [], B = [];
  for (const sg of signals(ds, wk, wst, 0.7, 1)) {
    const tr = simulate(h1, start, ds, sg, 3, 1); if (!tr) continue;
    const e = er(ds, sg.i); if (e == null) continue;
    tr.er = +e.toFixed(3); tr.up = up(ds, sg.i);
    B.push(tr); if (sg.rule) R.push(tr);
  }
  const P = { oos: ['2006-01-01', '2022-10-31'], a: ['2006-01-01', '2019-12-31'], b: ['2020-01-01', '2022-10-31'], skill: ['2022-11-01', '2099-01-01'] };
  const cut = (T, [f, t]) => T.filter((x) => ymd(x.d) >= f && ymd(x.d) <= t);
  const S = (T) => { const s = stats(T); delete s.sd; s.dd = dd(T); return s; };
  const F = { 'er>=0.2': (x) => x.er >= 0.2, 'er<0.2': (x) => x.er < 0.2, 'er>=0.3': (x) => x.er >= 0.3, 'er>=0.2 up': (x) => x.er >= 0.2 && x.up };
  const out = { built: new Date().toISOString().slice(0, 10), data: { from: ymd(ds[0].d), to: ymd(ds.at(-1).d), days: ds.length, src: 'OANDA mid H1 XAU_USD via the site proxy (gold-drd-long cache)' }, rows: {}, baseline: {}, years: {} };
  for (const [k, p] of Object.entries(P)) {
    const r = cut(R, p), b = cut(B, p);
    out.rows[k] = { all: S(r), ...Object.fromEntries(Object.entries(F).map(([n, f]) => [n, S(r.filter(f))])), pass_vs_fail: welch(r.filter(F['er>=0.2']), r.filter(F['er<0.2'])) };
    out.baseline[k] = { all: S(b), 'er>=0.2': S(b.filter(F['er>=0.2'])), 'er<0.2': S(b.filter(F['er<0.2'])), pass_vs_fail: welch(b.filter(F['er>=0.2']), b.filter(F['er<0.2'])) };
  }
  for (let y = 2006; y <= 2026; y++) { const r = cut(R, [`${y}-01-01`, `${y}-12-31`]); if (!r.length) continue;
    const f = r.filter(F['er>=0.2']), s1 = stats(r), s2 = stats(f); out.years[y] = { n: s1.n, total: s1.total, nF: s2.n, totalF: s2.total }; }
  const o = out.rows.oos, c1 = o.pass_vs_fail.lift > 0 && o.pass_vs_fail.t >= 2, c2 = out.rows.a['er>=0.2'].pf > 1 && out.rows.b['er>=0.2'].pf > 1, c3 = o['er>=0.2'].dd > o.all.dd;
  out.checks = { difference: c1, bothHalves: c2, smallerDrawdown: c3 };
  out.verdict = c1 && c2 && c3 ? 'PASS' : 'FAIL';
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  for (const [k, row] of Object.entries(out.rows)) { console.log(`\n${k}`); for (const [n, s] of Object.entries(row)) console.log(`  ${n.padEnd(11)} ${JSON.stringify(s)}`); console.log(`  baseline   ${JSON.stringify(out.baseline[k])}`); }
  console.log('\nyears', JSON.stringify(out.years)); console.log('checks', out.checks, 'verdict', out.verdict);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'full') full(dir); else console.log('usage: run.mjs full <dir>');
}
