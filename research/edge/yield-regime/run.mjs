// The US 10-year regime table and gold (pre-registered in PREREGISTRATION.md, 19 Nov 2026).
//   node research/edge/yield-regime/run.mjs fetch <dir>   → inputs from origin/council-data (git, no network)
//   node research/edge/yield-regime/run.mjs run <dir>     → result.json + summary
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { dailyRows, isoDay } from '../../../council/macroscore.mjs';

const DAY = 86400, N = 20, HALF = '2017-01-01', FROM = '2007-01-01', LAGS = 4;
const FILES = ['research/daily/xau.json', 'research/daily/nas100.json', 'macro/cache.json'];

export function classOf(d2w, d4w, d6w) {
  if (d2w == null || d4w == null || d6w == null) return null;
  if (d2w >= 0.25 || d4w >= 0.5) return 'risingFast';
  if (d2w <= -0.25 || d4w <= -0.5) return 'fallingFast';
  if (d6w >= 0.25) return 'risingSlow';
  if (d6w <= -0.25) return 'fallingSlow';
  return 'flat';
}
export function whyOf(d10_4w, d2_4w) {
  if (d10_4w == null || d2_4w == null || d10_4w < 0.25) return null;
  if (d2_4w >= d10_4w) return 'led2y'; if (d2_4w <= d10_4w - 0.15) return 'termPremium'; return null;
}
export function nwSlope(y, x, L = LAGS) {
  const n = y.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); }
  if (!sxx) return { b: null, t: null }; const b = sxy / sxx, a = my - b * mx, u = y.map((v, i) => (v - a - b * x[i]) * (x[i] - mx));
  let S = u.reduce((s, v) => s + v * v, 0); for (let l = 1; l <= L; l++) { let g = 0; for (let i = l; i < n; i++) g += u[i] * u[i - l]; S += 2 * (1 - l / (L + 1)) * g; }
  const se = Math.sqrt(S) / sxx; return { b, t: se ? b / se : null };
}
const pN = (t) => { const z = Math.abs(t), k = 1 / (1 + 0.2316419 * z), d = 0.3989423 * Math.exp(-z * z / 2); const q = d * k * (0.3193815 + k * (-0.3565638 + k * (1.781478 + k * (-1.821256 + k * 1.330274)))); return 2 * q; };
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0; o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); out[i] = run; }); return out; }
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null), r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));

export function rowsOf(fred, gold, nas) {
  const S = (k) => fred[k].map(([d, v]) => ({ t: Date.parse(d + 'T00:00:00Z') / 1000, v: +v }));
  const y10 = S('DGS10'), y2 = S('DGS2'), m2 = new Map(y2.map((o) => [o.t, o.v]));
  const idx = (D, t) => { let lo = 0, hi = D.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (D[m].t <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; };
  const fwd = (D, t) => { const i = idx(D, t + DAY + DAY - 1); // the next weekday's close after the Friday (known by then)
    let j = i; while (j >= 0 && j < D.length && D[j].t <= t) j++; if (j < 0 || j + N >= D.length) return null; return Math.log(D[j + N].v / D[j].v); };
  const rows = [];
  for (let i = 6; i < y10.length; i++) { const w = y10[i], dd = (k) => +(w.v - y10[i - k].v).toFixed(4), a2 = m2.get(w.t), b2 = m2.get(y10[i - 4].t);
    const cls = classOf(dd(2), dd(4), dd(6)), why = whyOf(dd(4), a2 != null && b2 != null ? +(a2 - b2).toFixed(4) : null), g = fwd(gold, w.t);
    if (!cls || g == null || isoDay(w.t) < FROM) continue;
    rows.push({ day: isoDay(w.t), cls, why, gold: +g.toFixed(5), nas: (() => { const v = fwd(nas, w.t); return v == null ? null : +v.toFixed(5); })() }); }
  return rows;
}

export function analyse(rows) {
  const test = (rs, isX, keep = () => true) => { const R = rs.filter(keep), y = R.map((r) => r.gold), x = R.map((r) => (isX(r) ? 1 : 0)); const w = nwSlope(y, x); return { n: R.length, nX: x.filter(Boolean).length, slope: r4(w.b), t: w.t == null ? null : +w.t.toFixed(2) }; };
  const defs = { T1: { x: (r) => r.cls === 'risingFast', want: -1 }, T2: { x: (r) => r.cls === 'fallingSlow', want: 1 }, T3: { x: (r) => r.why === 'termPremium', keep: (r) => r.why != null, want: 1 } };
  const out = {}; for (const [k, d] of Object.entries(defs)) { const all = test(rows, d.x, d.keep), a = test(rows.filter((r) => r.day < HALF), d.x, d.keep), b = test(rows.filter((r) => r.day >= HALF), d.x, d.keep);
    out[k] = { want: d.want, all, first: a, second: b, p: all.t == null ? 1 : pN(all.t) }; }
  const H = holm(Object.values(out).map((o) => o.p)); Object.values(out).forEach((o, i) => { o.holm = +H[i].toFixed(4);
    o.pass = o.all.t != null && Math.sign(o.all.t) === o.want && Math.abs(o.all.t) >= 2 && o.holm < 0.05 && Math.sign(o.first.slope) === o.want && Math.sign(o.second.slope) === o.want; });
  const classes = {}; for (const c of ['risingFast', 'risingSlow', 'flat', 'fallingSlow', 'fallingFast', 'led2y', 'termPremium']) { const R = rows.filter((r) => r.cls === c || r.why === c);
    classes[c] = { n: R.length, gold: r4(mean(R.map((r) => r.gold))), goldUp: R.length ? +(R.filter((r) => r.gold > 0).length / R.length).toFixed(2) : null, nas: r4(mean(R.map((r) => r.nas).filter((v) => v != null))) }; }
  classes.all = { n: rows.length, gold: r4(mean(rows.map((r) => r.gold))), goldUp: +(rows.filter((r) => r.gold > 0).length / rows.length).toFixed(2), nas: r4(mean(rows.map((r) => r.nas).filter((v) => v != null))) };
  const passed = Object.values(out).filter((o) => o.pass).length;
  return { tests: out, classes, passed, verdict: passed ? `PASS ${passed} of 3` : 'FAIL, 0 of 3' };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') { for (const f of FILES) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), execFileSync('git', ['show', 'origin/council-data:' + f], { maxBuffer: 1 << 28 })); } console.log('fetched'); }
  else if (cmd === 'run') { const J = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const rows = rowsOf(J('macro/cache.json').score.fred, dailyRows(J('research/daily/xau.json')), dailyRows(J('research/daily/nas100.json'))), A = analyse(rows);
    fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify({ study: 'yield-regime', title: 'The US 10-year regime table and gold', built: '2026-11-19', horizon: N, ...A, rows }, null, 1) + '\n');
    console.log(JSON.stringify(A, null, 1)); }
}
