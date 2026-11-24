// Edge research · fred-gauges: net liquidity, NFCI, jobless claims, double tightening → next 20 sessions (PREREGISTRATION.md, pushed alone first)
//   node --use-env-proxy research/edge/fred-gauges/run.mjs fetch <dir>
//   node research/edge/fred-gauges/run.mjs run <dir>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dailyRows } from '../../../council/macroscore.mjs';
import { parseFred, nwSlope } from '../rulebook-gauges/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), FROM = '2007-01-05', HALF = '2017-01-01', N = 20, DAY = 86400;
export const LAG = { WALCL: 2, WDTGAL: 2, RRPONTSYD: 1, NFCI: 6, ICSA: 6, DFII10: 1, BAA10Y: 1 };
export const SERIES = Object.keys(LAG), MARKETS = ['xau', 'spx500', 'usdjpy'];
export const TESTS = [['L', 'xau', 1], ['L', 'spx500', 1], ['F', 'xau', -1], ['F', 'spx500', -1], ['C', 'xau', 1], ['C', 'usdjpy', -1], ['D', 'xau', -1]];
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null), r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));
const pN = (t) => { const z = Math.abs(t), k = 1 / (1 + 0.2316419 * z), d = 0.3989423 * Math.exp(-z * z / 2); return 2 * d * k * (0.3193815 + k * (-0.3565638 + k * (1.781478 + k * (-1.821256 + k * 1.330274)))); };
const firstGE = (S, t) => { let lo = 0, hi = S.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (S[m].t >= t) { r = m; hi = m - 1; } else lo = m + 1; } return r; };
// index of the last value known by time t (dated at most t - lag days); -1 when none
export function lastKnown(S, t, lag) { let lo = 0, hi = S.length - 1, r = -1; const cut = t - lag * DAY; while (lo <= hi) { const m = (lo + hi) >> 1; if (S[m].t <= cut) { r = m; lo = m + 1; } else hi = m - 1; } return r; }
export function fridays(from, toT) { const out = []; let t = Date.parse(from + 'T00:00:00Z') / 1000; for (; t <= toT; t += 7 * DAY) out.push({ t, day: new Date(t * 1000).toISOString().slice(0, 10) }); return out; }
// one reading per Friday: the four signals (null when a series has no value yet)
export function readings(F, toT) {
  const fr = fridays(FROM, toT), at = (id, t) => { const i = lastKnown(F[id], t, LAG[id]); return i < 0 ? null : F[id][i].v; };
  const raw = fr.map((f) => {
    const w = at('WALCL', f.t), g = at('WDTGAL', f.t), rr = at('RRPONTSYD', f.t), i = lastKnown(F.ICSA, f.t, LAG.ICSA);
    const c4 = i >= 3 ? mean(F.ICSA.slice(i - 3, i + 1).map((o) => o.v)) : null, c26 = i >= 25 ? mean(F.ICSA.slice(i - 25, i + 1).map((o) => o.v)) : null;
    return { ...f, net: w == null || g == null ? null : w / 1000 - g / 1000 - (rr == null ? 0 : rr), nfci: at('NFCI', f.t), c4, c26, ry: at('DFII10', f.t), cs: at('BAA10Y', f.t) };
  });
  return raw.map((r, k) => { const p = k >= 4 ? raw[k - 4] : null, d = (a, b) => (a == null || b == null ? null : a - b);
    const dn = p && d(r.net, p.net), df = p && d(r.nfci, p.nfci), dr = p && d(r.ry, p.ry), dc = p && d(r.cs, p.cs);
    return { day: r.day, t: r.t, L: dn == null ? null : dn > 0, F: df == null ? null : df > 0, C: r.c4 == null || r.c26 == null ? null : r.c4 > 1.05 * r.c26, D: dr == null || dc == null ? null : dr > 0.25 && dc > 0 }; });
}
export function outcome(px, t) { const j = firstGE(px, t); if (j < 0 || j + N >= px.length || px[j].t - t > 4 * DAY) return null; return +Math.log(px[j + N].v / px[j].v).toFixed(5); }
export function tests(R, PX, TT = TESTS) {
  const one = (rs) => { const w = nwSlope(rs.map((r) => r.y), rs.map((r) => (r.x ? 1 : 0))); return { n: rs.length, nX: rs.filter((r) => r.x).length, slope: r4(w.b), t: w.t == null ? null : +w.t.toFixed(2) }; };
  const out = TT.map(([sig, mk, want]) => { const rs = R.map((r) => ({ day: r.day, x: r[sig], y: outcome(PX[mk], r.t) })).filter((r) => r.x != null && r.y != null);
    return { id: sig + ':' + mk, sig, mk, want, all: one(rs), first: one(rs.filter((r) => r.day < HALF)), second: one(rs.filter((r) => r.day >= HALF)) }; });
  const ps = out.map((o) => (o.all.t == null ? 1 : pN(o.all.t))), idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]); let run = 0; const H = [];
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); H[i] = run; });
  out.forEach((o, i) => { o.holm = +H[i].toFixed(4); o.pass = o.all.t != null && Math.sign(o.all.t) === o.want && Math.abs(o.all.t) >= 2 && o.holm < 0.05 && Math.sign(o.first.slope) === o.want && Math.sign(o.second.slope) === o.want; });
  return out;
}
export function classes(R, PX, SIGS = ['L', 'F', 'C', 'D']) {
  const out = {};
  for (const sig of SIGS) { const S = R.filter((r) => r[sig] != null); let ep = 0; S.forEach((r, i) => { if (r[sig] && (i === 0 || !S[i - 1][sig])) ep++; });
    out[sig] = { weeks: S.length, on: S.filter((r) => r[sig]).length, episodes: ep, from: S[0]?.day || null };
    for (const mk of MARKETS) { const rs = S.map((r) => ({ x: r[sig], y: outcome(PX[mk], r.t) })).filter((r) => r.y != null);
      out[sig][mk] = { on: { n: rs.filter((r) => r.x).length, fwd: r4(mean(rs.filter((r) => r.x).map((r) => r.y))) }, off: { n: rs.filter((r) => !r.x).length, fwd: r4(mean(rs.filter((r) => !r.x).map((r) => r.y))) } }; } }
  return out;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const id of SERIES) { const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`); if (!r.ok) throw new Error(id + ' ' + r.status); fs.writeFileSync(path.join(dir, id + '.csv'), await r.text()); }
    for (const k of MARKETS) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    console.log('fetched');
  } else if (cmd === 'run') {
    const F = Object.fromEntries(SERIES.map((id) => [id, parseFred(fs.readFileSync(path.join(dir, id + '.csv'), 'utf8'))]));
    const PX = Object.fromEntries(MARKETS.map((k) => [k, dailyRows(JSON.parse(fs.readFileSync(path.join(dir, k + '.json'), 'utf8')))]));
    const R = readings(F, PX.xau.at(-1).t), T = tests(R, PX), C = classes(R, PX), pass = T.filter((o) => o.pass).length;
    const NAME = { L: 'Net liquidity rising', F: 'Conditions tightening (NFCI)', C: 'Jobless claims rising', D: 'Double tightening' }, MK = { xau: 'gold', spx500: 'S&P 500', usdjpy: 'USD/JPY' };
    const pct = (x) => (x == null ? '—' : `${x >= 0 ? '+' : '−'}${Math.abs(100 * (Math.exp(x) - 1)).toFixed(2)} %`);
    const verdict = `${pass ? 'PASS' : 'FAIL'}, ${pass} of ${T.length}: ` + T.map((o) => `${o.sig} → ${MK[o.mk]} ${o.want > 0 ? 'higher' : 'lower'} ${o.pass ? 'PASS' : 'FAIL'} (t ${o.all.t}, Holm ${o.holm})`).join('; ');
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'fred-gauges', built: '2026-11-24', verdict, tests: T, classes: C }, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# Net liquidity, financial conditions, jobless claims, double tightening: the next 20 sessions (24 Nov 2026)', '',
      'Paper research only. Signals, outcome and bar fixed in `PREREGISTRATION.md` before any return was split. Nothing live changed.', '',
      `**Verdict: ${verdict}**`, '',
      '| Test | Weeks | Signal weeks | Slope (20 sessions) | t | Holm p | 2007-16 t | 2017 on t | |', '|---|---|---|---|---|---|---|---|---|',
      ...T.map((o) => `| ${NAME[o.sig]} → ${MK[o.mk]} ${o.want > 0 ? 'higher' : 'lower'} | ${o.all.n} | ${o.all.nX} | ${pct(o.all.slope)} | ${o.all.t} | ${o.holm} | ${o.first.t} | ${o.second.t} | ${o.pass ? 'PASS' : 'FAIL'} |`), '',
      '## Class means, next 20 sessions (signal on / off)', '', '| Signal | Weeks on (episodes) | Gold | S&P 500 | USD/JPY |', '|---|---|---|---|---|',
      ...Object.entries(C).map(([s, c]) => `| ${NAME[s]} (from ${c.from}) | ${c.on} of ${c.weeks} (${c.episodes}) | ${pct(c.xau.on.fwd)} / ${pct(c.xau.off.fwd)} | ${pct(c.spx500.on.fwd)} / ${pct(c.spx500.off.fwd)} | ${pct(c.usdjpy.on.fwd)} / ${pct(c.usdjpy.off.fwd)} |`), '',
      'Limits: NFCI is re-estimated over its history and FRED values are today\'s revised ones; consecutive 20-session outcomes overlap (see the episode counts).', ''].join('\n'));
    console.log(verdict); console.log(JSON.stringify(C));
  }
}
