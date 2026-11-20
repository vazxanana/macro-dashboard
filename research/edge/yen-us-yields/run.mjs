// Edge research · yen-us-yields: does a 4-week US 10-year move lead USD/JPY? (PREREGISTRATION.md, pushed alone first)
//   node --use-env-proxy research/edge/yen-us-yields/run.mjs fetch <dir>
//   node research/edge/yen-us-yields/run.mjs run <dir>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dailyRows } from '../../../council/macroscore.mjs';
import { parseFred, knownAt, nwSlope } from '../rulebook-gauges/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), FROM = '2007-01-05', HALF = '2017-01-01', TH = 0.25, N = 20;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null), r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));
const pN = (t) => { const z = Math.abs(t), k = 1 / (1 + 0.2316419 * z), d = 0.3989423 * Math.exp(-z * z / 2); return 2 * d * k * (0.3193815 + k * (-0.3565638 + k * (1.781478 + k * (-1.821256 + k * 1.330274)))); };
const lastLE = (S, t) => { let lo = 0, hi = S.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (S[m].t <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; };
const firstGE = (S, t) => { let lo = 0, hi = S.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (S[m].t >= t) { r = m; hi = m - 1; } else lo = m + 1; } return r; };
export function rows(y10, fx) {
  const out = [];
  for (let i = N; i < y10.length; i++) {
    const o = y10[i]; if (o.d < FROM || new Date(o.t * 1000).getUTCDay() !== 5) continue;
    const d10 = +(o.v - y10[i - N].v).toFixed(3), j = firstGE(fx, knownAt(o.t)); if (j < 0 || j + N >= fx.length || fx[j].t - o.t > 6 * 86400) continue;
    const back = lastLE(fx, o.t); const co = back >= N ? Math.log(fx[back].v / fx[back - N].v) : null;
    out.push({ day: o.d, d10, cls: d10 > TH ? 'up' : d10 < -TH ? 'down' : 'flat', fwd: +Math.log(fx[j + N].v / fx[j].v).toFixed(5), co: co == null ? null : +co.toFixed(5) });
  }
  return out;
}
export function tests(R) {
  const one = (rs, cls) => { const w = nwSlope(rs.map((r) => r.fwd), rs.map((r) => (r.cls === cls ? 1 : 0))); return { n: rs.length, nX: rs.filter((r) => r.cls === cls).length, slope: r4(w.b), t: w.t == null ? null : +w.t.toFixed(2) }; };
  const T = { U: { cls: 'up', want: 1 }, D: { cls: 'down', want: -1 } }, out = {};
  for (const [k, d] of Object.entries(T)) out[k] = { want: d.want, all: one(R, d.cls), first: one(R.filter((r) => r.day < HALF), d.cls), second: one(R.filter((r) => r.day >= HALF), d.cls) };
  const ps = Object.values(out).map((o) => (o.all.t == null ? 1 : pN(o.all.t))), idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]); let run = 0; const H = [];
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); H[i] = run; });
  Object.values(out).forEach((o, i) => { o.holm = +H[i].toFixed(4); o.pass = o.all.t != null && Math.sign(o.all.t) === o.want && Math.abs(o.all.t) >= 2 && o.holm < 0.05 && Math.sign(o.first.slope) === o.want && Math.sign(o.second.slope) === o.want; });
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const r = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10'); if (!r.ok) throw new Error('DGS10 ' + r.status);
    fs.writeFileSync(path.join(dir, 'DGS10.csv'), await r.text());
    fs.writeFileSync(path.join(dir, 'usdjpy.json'), execFileSync('git', ['show', 'origin/council-data:research/daily/usdjpy.json'], { maxBuffer: 1 << 28 }));
    console.log('fetched');
  } else if (cmd === 'run') {
    const y10 = parseFred(fs.readFileSync(path.join(dir, 'DGS10.csv'), 'utf8')), fx = dailyRows(JSON.parse(fs.readFileSync(path.join(dir, 'usdjpy.json'), 'utf8')));
    const R = rows(y10, fx), T = tests(R), pct = (x) => (x == null ? '—' : `${x >= 0 ? '+' : '−'}${Math.abs(100 * (Math.exp(x) - 1)).toFixed(2)} %`);
    const cls = Object.fromEntries(['up', 'flat', 'down'].map((c) => { const xs = R.filter((r) => r.cls === c).map((r) => r.fwd); return [c, { n: xs.length, fwd: r4(mean(xs)), upShare: xs.length ? +(xs.filter((v) => v > 0).length / xs.length).toFixed(3) : null }]; }));
    cls.all = { n: R.length, fwd: r4(mean(R.map((r) => r.fwd))) };
    const C = R.filter((r) => r.co != null), mx = mean(C.map((r) => r.d10)), my = mean(C.map((r) => r.co));
    const corr = C.reduce((s, r) => s + (r.d10 - mx) * (r.co - my), 0) / Math.sqrt(C.reduce((s, r) => s + (r.d10 - mx) ** 2, 0) * C.reduce((s, r) => s + (r.co - my) ** 2, 0));
    const line = (k, lbl, o) => `${k} ${lbl} ${o.pass ? 'PASS' : 'FAIL'} (t ${o.all.t}, Holm ${o.holm}, halves t ${o.first.t} / ${o.second.t})`;
    const verdict = `${line('U', 'US 10-year up > 25 bp in 4 weeks → USD/JPY higher', T.U)}; ${line('D', 'down > 25 bp → USD/JPY lower', T.D)}`;
    const res = { study: 'yen-us-yields', built: '2026-11-20', span: [R[0].day, R.at(-1).day], verdict, tests: T, classes: cls, coincidentCorr: r4(corr), weeks: R.length };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# Do US yields lead USD/JPY? (20 Nov 2026)', '',
      'Paper research only. Signal, outcome and bar fixed in `PREREGISTRATION.md` before any USD/JPY return was split by US yield moves. Nothing live changed.', '',
      `**Verdict: ${verdict}**`, '',
      `Weekly readings ${res.span[0]} → ${res.span[1]} (${R.length}).`, '',
      '| 4-week US 10-year change | Weeks | USD/JPY next 20 sessions | Share up |', '|---|---|---|---|',
      ...['up', 'flat', 'down'].map((c) => `| ${c === 'up' ? 'Up > 25 bp' : c === 'down' ? 'Down > 25 bp' : 'Flat'} | ${cls[c].n} | ${pct(cls[c].fwd)} | ${Math.round(100 * cls[c].upShare)} % |`),
      `| All weeks | ${R.length} | ${pct(cls.all.fwd)} | |`, '',
      `Reported: the same-4-week link the Japan brief describes (US 10-year change against USD/JPY's own change over the same 4 weeks) has a correlation of ${r4(corr)}: they move together; the test asks whether that tells you the next 4 weeks.`, ''].join('\n'));
    console.log(verdict); console.log(JSON.stringify(cls), 'corr', r4(corr));
  }
}
