// Two gauges of the macro rule book and gold (pre-registered in PREREGISTRATION.md, 19 Nov 2026).
//   node --use-env-proxy research/edge/rulebook-gauges/run.mjs fetch <dir>   → FRED csv + council-data candles into <dir>
//   node research/edge/rulebook-gauges/run.mjs run <dir>                     → result.json + summary
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { dailyRows, isoDay } from '../../../council/macroscore.mjs';

const DAY = 86400, FROM = '2007-01-01', HALF = '2017-01-01', LAGS = 4;
const FRED = ['VIXCLS', 'DGS2', 'DFEDTARU', 'DFEDTAR'];
export function parseFred(text) { return String(text).split(/\r?\n/).slice(1).map((l) => l.split(',')).filter((c) => c.length >= 2 && c[1] !== '.' && c[1] !== '' && Number.isFinite(+c[1])).map(([d, v]) => ({ d, t: Date.parse(d + 'T00:00:00Z') / 1000, v: +v })); }
// a value dated D is known at the close of the next weekday
export function knownAt(t) { let k = t + DAY; while ([0, 6].includes(new Date(k * 1000).getUTCDay())) k += DAY; return k; }
const idxLE = (D, t) => { let lo = 0, hi = D.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (D[m].t <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; };
const fwd = (G, t, n) => { const i = idxLE(G, t); if (i < 0 || G[i].t < t - 4 * DAY || i + n >= G.length) return null; return Math.log(G[i + n].v / G[i].v); };
export function nwSlope(y, x, L = LAGS) {
  const n = y.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); }
  if (!sxx) return { b: null, t: null }; const b = sxy / sxx, a = my - b * mx, u = y.map((v, i) => (v - a - b * x[i]) * (x[i] - mx));
  let S = u.reduce((s, v) => s + v * v, 0); for (let l = 1; l <= L; l++) { let g = 0; for (let i = l; i < n; i++) g += u[i] * u[i - l]; S += 2 * (1 - l / (L + 1)) * g; }
  const se = Math.sqrt(S) / sxx; return { b, t: se ? b / se : null };
}
const pN = (t) => { const z = Math.abs(t), k = 1 / (1 + 0.2316419 * z), d = 0.3989423 * Math.exp(-z * z / 2); return 2 * d * k * (0.3193815 + k * (-0.3565638 + k * (1.781478 + k * (-1.821256 + k * 1.330274)))); };
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null), r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));

export function episodes(vix, from = FROM) {   // first VIX close >= 40 after 20 sessions below it
  const out = []; let below = 0;
  for (const o of vix) { if (o.v >= 40) { if (below >= 20 && o.d >= from) out.push(o); below = 0; } else below++; }
  return out;
}
export function testA(vix, gold, nas) {
  const E = episodes(vix), endT = gold[gold.length - 1].t;
  const days = gold.filter((o) => isoDay(o.t) >= FROM), base60 = mean(days.map((o) => fwd(gold, o.t, 60)).filter((v) => v != null));
  const rows = E.map((e) => { const k = knownAt(e.t), g60 = fwd(gold, k, 60), g20 = fwd(gold, k, 20), i = idxLE(gold, k);
    const dip = i >= 0 && i + 60 < gold.length ? Math.log(Math.min(...gold.slice(i, i + 61).map((o) => o.v)) / gold[i].v) : null;
    return { day: e.d, vix: e.v, gold60: r4(g60), gold20: r4(g20), dip60: r4(dip), nas60: r4(fwd(nas, k, 60)) }; }).filter((r) => r.gold60 != null);
  const above = rows.filter((r) => r.gold60 > base60).length;
  return { episodes: rows, n: rows.length, base60: r4(base60), mean60: r4(mean(rows.map((r) => r.gold60))), above, pass: rows.length >= 6 && mean(rows.map((r) => r.gold60)) > base60 && above >= Math.ceil((2 / 3) * rows.length), endT };
}
export function gapRows(y2, upper, old, gold, nas) {
  const pol = [...old.filter((o) => o.d < '2008-12-16'), ...upper].sort((a, b) => a.t - b.t);
  const rows = [];
  for (const o of y2) { if (o.d < FROM || new Date(o.t * 1000).getUTCDay() !== 5) continue; const j = idxLE(pol, o.t); if (j < 0) continue;
    const gap = +(o.v - pol[j].v).toFixed(3), k = knownAt(o.t), g = fwd(gold, k, 20); if (g == null) continue;
    rows.push({ day: o.d, gap, cls: gap > 0.25 ? 'hikes' : gap < -0.25 ? 'cuts' : 'flat', gold: +g.toFixed(5), nas: (() => { const v = fwd(nas, k, 20); return v == null ? null : +v.toFixed(5); })() }); }
  return rows;
}
export function testB(rows) {
  const one = (rs, cls) => { const w = nwSlope(rs.map((r) => r.gold), rs.map((r) => (r.cls === cls ? 1 : 0))); return { n: rs.length, nX: rs.filter((r) => r.cls === cls).length, slope: r4(w.b), t: w.t == null ? null : +w.t.toFixed(2) }; };
  const T = { B1: { cls: 'hikes', want: -1 }, B2: { cls: 'cuts', want: 1 } }, out = {};
  for (const [k, d] of Object.entries(T)) out[k] = { want: d.want, all: one(rows, d.cls), first: one(rows.filter((r) => r.day < HALF), d.cls), second: one(rows.filter((r) => r.day >= HALF), d.cls) };
  const ps = Object.values(out).map((o) => (o.all.t == null ? 1 : pN(o.all.t))), srt = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]); let run = 0; const H = [];
  srt.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); H[i] = run; });
  Object.values(out).forEach((o, i) => { o.holm = +H[i].toFixed(4); o.pass = o.all.t != null && Math.sign(o.all.t) === o.want && Math.abs(o.all.t) >= 2 && o.holm < 0.05 && Math.sign(o.first.slope) === o.want && Math.sign(o.second.slope) === o.want; });
  const cls = {}; for (const c of ['hikes', 'flat', 'cuts']) { const R = rows.filter((r) => r.cls === c); cls[c] = { n: R.length, gold: r4(mean(R.map((r) => r.gold))), up: R.length ? +(R.filter((r) => r.gold > 0).length / R.length).toFixed(2) : null, nas: r4(mean(R.map((r) => r.nas).filter((v) => v != null))) }; }
  cls.all = { n: rows.length, gold: r4(mean(rows.map((r) => r.gold))) };
  return { tests: out, classes: cls };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') { fs.mkdirSync(dir, { recursive: true });
    for (const id of FRED) { const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`); if (!r.ok) throw new Error(id + ' ' + r.status); fs.writeFileSync(path.join(dir, id + '.csv'), await r.text()); }
    for (const k of ['xau', 'nas100']) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    console.log('fetched'); }
  else if (cmd === 'run') {
    const F = Object.fromEntries(FRED.map((id) => [id, parseFred(fs.readFileSync(path.join(dir, id + '.csv'), 'utf8'))]));
    const G = dailyRows(JSON.parse(fs.readFileSync(path.join(dir, 'xau.json'), 'utf8'))), N = dailyRows(JSON.parse(fs.readFileSync(path.join(dir, 'nas100.json'), 'utf8')));
    const A = testA(F.VIXCLS, G, N), rows = gapRows(F.DGS2, F.DFEDTARU, F.DFEDTAR, G, N), B = testB(rows);
    const verdict = [A.pass ? 'A PASS' : 'A FAIL', ...Object.entries(B.tests).map(([k, o]) => k + (o.pass ? ' PASS' : ' FAIL'))].join(', ');
    const span = Object.fromEntries(FRED.map((id) => [id, [F[id][0].d, F[id][F[id].length - 1].d]]));
    fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify({ study: 'rulebook-gauges', title: 'Two gauges of the macro rule book and gold', built: '2026-11-19', span, verdict, A: { ...A, endT: undefined }, B, rows }, null, 1) + '\n');
    console.log(JSON.stringify({ verdict, A: { ...A, endT: undefined }, B }, null, 1)); }
}
