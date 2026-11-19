// Stress and reaction rules of the macro rule book and gold (pre-registered in PREREGISTRATION.md, 19 Nov 2026).
//   node --use-env-proxy research/edge/rulebook-stress/run.mjs fetch <dir>   → FRED csv + council-data gold into <dir>
//   node research/edge/rulebook-stress/run.mjs run <dir>                     → result.json + summary
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { dailyRows, isoDay } from '../../../council/macroscore.mjs';
import { parseFred, knownAt, nwSlope } from '../rulebook-gauges/run.mjs';

const DAY = 86400, FROM = '2007-01-01', HALF = '2017-01-01', N = 20, GAP = 20;
const FRED = ['DGS2', 'DFII10', 'VIXCLS', 'DTWEXBGS'];
const idxLE = (D, t) => { let lo = 0, hi = D.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (D[m].t <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; };
const at = (S, t) => { const i = idxLE(S, t); return i < 0 || S[i].t < t - 6 * DAY ? null : S[i].v; };
export const fwd = (G, t, n = N) => { const i = idxLE(G, t); if (i < 0 || G[i].t < t - 4 * DAY || i + n >= G.length) return null; return Math.log(G[i + n].v / G[i].v); };
const pN = (t) => { const z = Math.abs(t), k = 1 / (1 + 0.2316419 * z), d = 0.3989423 * Math.exp(-z * z / 2); return 2 * d * k * (0.3193815 + k * (-0.3565638 + k * (1.781478 + k * (-1.821256 + k * 1.330274)))); };
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null), r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));
const chg = (S, i, k) => (i - k >= 0 ? S[i].v - S[i - k].v : null);

// episodes: the first qualifying day after GAP sessions without one
export function episodes(days, hit) { const out = []; let quiet = GAP; for (let i = 0; i < days.length; i++) { if (hit(i)) { if (quiet >= GAP) out.push(days[i]); quiet = 0; } else quiet++; } return out; }
export const rescueHit = (y2) => (i) => { const c = chg(y2, i, 2); return c != null && c < -0.30 - 1e-9; };
export function stressHit(ry, vix, usd) { return (i) => { const c = chg(ry, i, 5); if (c == null || c < 0.25 - 1e-9) return false; const t = ry[i].t, v = at(vix, t), j = idxLE(usd, t);
  return v != null && v > 30 && j >= 5 && usd[j].t >= t - 6 * DAY && usd[j].v < usd[j - 5].v; }; }
export function episodeTest(E, gold, base) {
  const rows = E.filter((e) => e.d >= FROM).map((e) => ({ day: e.d, gold20: r4(fwd(gold, knownAt(e.t))) })).filter((r) => r.gold20 != null);
  const m = mean(rows.map((r) => r.gold20)), above = rows.filter((r) => r.gold20 > base).length;
  return { n: rows.length, mean20: r4(m), above, episodes: rows, pass: rows.length >= 6 && m > base && above >= Math.ceil((2 / 3) * rows.length) };
}
// weekly Friday rows with the C3 / C4 flags
export function weekRows(gold, ry, y2) {
  const out = [];
  for (let i = 0; i < gold.length; i++) { const g = gold[i], d = isoDay(g.t); if (d < FROM || new Date(g.t * 1000).getUTCDay() !== 5) continue;
    const w52 = gold.filter((o) => o.t > g.t - 364 * DAY && o.t <= g.t), hi = Math.max(...w52.map((o) => o.v));
    const ry0 = at(ry, g.t), ry4 = at(ry, g.t - 28 * DAY), ry1 = at(ry, g.t - 7 * DAY), y0 = at(y2, g.t), y1 = at(y2, g.t - 7 * DAY), g1 = at(gold, g.t - 7 * DAY);
    if ([ry0, ry4, ry1, y0, y1, g1].some((v) => v == null)) continue;
    const out20 = fwd(gold, knownAt(g.t)); if (out20 == null) continue;
    out.push({ day: d, gold: +out20.toFixed(5), res: g.v >= 0.97 * hi && ry0 - ry4 >= 0.15 - 1e-9 ? 1 : 0, del: Math.log(g.v / g1) <= Math.log(0.97) && ry0 < ry1 && y0 < y1 ? 1 : 0 }); }
  return out;
}
const dummy = (rows, k) => { const w = nwSlope(rows.map((r) => r.gold), rows.map((r) => r[k])); return { n: rows.length, nX: rows.filter((r) => r[k]).length, slope: r4(w.b), t: w.t == null ? null : +w.t.toFixed(2) }; };
export function reactRows(y2, gold) {
  const out = [];
  for (let i = 1; i < y2.length; i++) { const o = y2[i]; if (o.d < FROM || o.v - y2[i - 1].v < 0.15 - 1e-9) continue;
    const j = idxLE(gold, o.t); if (j < 1 || isoDay(gold[j].t) !== o.d) continue;
    const out20 = fwd(gold, knownAt(o.t)); if (out20 == null) continue;
    out.push({ day: o.d, dy: +(o.v - y2[i - 1].v).toFixed(2), react: gold[j].v > gold[j - 1].v ? 'up' : 'down', gold: +out20.toFixed(5) }); }
  return out;
}
export function welch(a, b) { if (a.length < 2 || b.length < 2) return { diff: null, t: null }; const ma = mean(a), mb = mean(b), va = a.reduce((s, v) => s + (v - ma) ** 2, 0) / (a.length - 1), vb = b.reduce((s, v) => s + (v - mb) ** 2, 0) / (b.length - 1);
  const se = Math.sqrt(va / a.length + vb / b.length); return { diff: r4(ma - mb), t: se ? +((ma - mb) / se).toFixed(2) : null }; }
const react = (rows) => { const U = rows.filter((r) => r.react === 'up').map((r) => r.gold), D = rows.filter((r) => r.react === 'down').map((r) => r.gold); return { nUp: U.length, nDown: D.length, up: r4(mean(U)), down: r4(mean(D)), ...welch(U, D) }; };

export function analyse(F, gold) {
  const days = gold.filter((o) => isoDay(o.t) >= FROM), base = mean(days.map((o) => fwd(gold, o.t)).filter((v) => v != null));
  const C1 = episodeTest(episodes(F.DGS2, rescueHit(F.DGS2)), gold, base), C2 = episodeTest(episodes(F.DFII10, stressHit(F.DFII10, F.VIXCLS, F.DTWEXBGS)), gold, base);
  const W = weekRows(gold, F.DFII10, F.DGS2), R = reactRows(F.DGS2, gold), h1 = (r) => r.day < HALF;
  const T = { C3: { all: dummy(W, 'res'), first: dummy(W.filter(h1), 'res'), second: dummy(W.filter((r) => !h1(r)), 'res') },
    C4: { all: dummy(W, 'del'), first: dummy(W.filter(h1), 'del'), second: dummy(W.filter((r) => !h1(r)), 'del') },
    C5: { all: react(R), first: react(R.filter(h1)), second: react(R.filter((r) => !h1(r))) } };
  const ps = Object.values(T).map((o) => (o.all.t == null ? 1 : pN(o.all.t))), srt = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]); let run = 0; const H = [];
  srt.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); H[i] = run; });
  Object.values(T).forEach((o, i) => { const s = (x) => x.slope ?? x.diff; o.holm = +H[i].toFixed(4); o.pass = o.all.t != null && o.all.t >= 2 && o.holm < 0.05 && s(o.first) > 0 && s(o.second) > 0; });
  const verdict = [['C1', C1.pass], ['C2', C2.pass], ...Object.entries(T).map(([k, o]) => [k, o.pass])].map(([k, p]) => k + (p ? ' PASS' : ' FAIL')).join(', ');
  return { base20: r4(base), C1, C2, ...T, verdict, weeks: W.length, reactDays: R };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') { fs.mkdirSync(dir, { recursive: true });
    for (const id of FRED) { const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`); if (!r.ok) throw new Error(id + ' ' + r.status); fs.writeFileSync(path.join(dir, id + '.csv'), await r.text()); }
    fs.writeFileSync(path.join(dir, 'xau.json'), execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 1 << 28 }));
    console.log('fetched'); }
  else if (cmd === 'run') {
    const F = Object.fromEntries(FRED.map((id) => [id, parseFred(fs.readFileSync(path.join(dir, id + '.csv'), 'utf8'))]));
    const G = dailyRows(JSON.parse(fs.readFileSync(path.join(dir, 'xau.json'), 'utf8'))), A = analyse(F, G);
    const span = Object.fromEntries(FRED.map((id) => [id, [F[id][0].d, F[id][F[id].length - 1].d]]));
    fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify({ study: 'rulebook-stress', title: 'Stress and reaction rules of the macro rule book and gold', built: '2026-11-19', span, ...A }, null, 1) + '\n');
    console.log(JSON.stringify({ ...A, reactDays: A.reactDays.length, C1: { ...A.C1 }, C2: { ...A.C2 } }, null, 1)); }
}
