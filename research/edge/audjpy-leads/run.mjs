// Edge research · audjpy-leads: does AUD/JPY turn before equities? (PREREGISTRATION.md, pushed alone first)
//   node research/edge/audjpy-leads/run.mjs fetch <dir>   (git show from origin/council-data, no network)
//   node research/edge/audjpy-leads/run.mjs run <dir>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dailyRows } from '../../../council/macroscore.mjs';
import { nwSlope } from '../rulebook-gauges/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), FROM = '2007-01-05', HALF = '2017-01-01', N = 20, DAY = 86400;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null), r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));
const pN = (t) => { const z = Math.abs(t), k = 1 / (1 + 0.2316419 * z), d = 0.3989423 * Math.exp(-z * z / 2); return 2 * d * k * (0.3193815 + k * (-0.3565638 + k * (1.781478 + k * (-1.821256 + k * 1.330274)))); };
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export function rows(aj, ix) {
  const xi = new Map(ix.map((o, i) => [o.t, i])), out = [];
  for (let i = N; i < aj.length; i++) {
    const o = aj[i], d = iso(o.t); if (d < FROM || new Date(o.t * 1000).getUTCDay() !== 5) continue;
    const j = xi.get(o.t); if (j == null || j < N || j + 1 + N >= ix.length || ix[j + 1].t - o.t > 4 * DAY) continue;
    const a4 = Math.log(o.v / aj[i - N].v), e4 = Math.log(ix[j].v / ix[j - N].v), fwd = Math.log(ix[j + 1 + N].v / ix[j + 1].v);
    out.push({ day: d, a4: +a4.toFixed(5), e4: +e4.toFixed(5), cls: a4 > 0 && e4 < 0 ? 'divUp' : a4 < 0 && e4 > 0 ? 'divDown' : 'same', fwd: +fwd.toFixed(5) });
  }
  return out;
}
export function tests(byIx) {
  const one = (rs, cls) => { const w = nwSlope(rs.map((r) => r.fwd), rs.map((r) => (r.cls === cls ? 1 : 0))); return { n: rs.length, nX: rs.filter((r) => r.cls === cls).length, slope: r4(w.b), t: w.t == null ? null : +w.t.toFixed(2) }; };
  const out = {};
  for (const [ix, R] of Object.entries(byIx)) for (const [k, cls, want] of [['Up', 'divUp', 1], ['Down', 'divDown', -1]])
    out[`${ix} ${k}`] = { want, all: one(R, cls), first: one(R.filter((r) => r.day < HALF), cls), second: one(R.filter((r) => r.day >= HALF), cls) };
  const V = Object.values(out), ps = V.map((o) => (o.all.t == null ? 1 : pN(o.all.t))), idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]); let run = 0; const H = [];
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); H[i] = run; });
  V.forEach((o, i) => { o.holm = +H[i].toFixed(4); o.pass = o.all.t != null && Math.sign(o.all.t) === o.want && Math.abs(o.all.t) >= 2 && o.holm < 0.05 && Math.sign(o.first.slope) === o.want && Math.sign(o.second.slope) === o.want; });
  return out;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') { fs.mkdirSync(dir, { recursive: true }); for (const k of ['audjpy', 'spx500', 'nas100']) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 })); console.log('fetched'); }
  else if (cmd === 'run') {
    const L = (k) => dailyRows(JSON.parse(fs.readFileSync(path.join(dir, k + '.json'), 'utf8'))), A = L('audjpy');
    const byIx = { SPX500: rows(A, L('spx500')), NAS100: rows(A, L('nas100')) }, T = tests(byIx);
    const pct = (x) => (x == null ? '—' : `${x >= 0 ? '+' : '−'}${Math.abs(100 * (Math.exp(x) - 1)).toFixed(2)} %`);
    const cls = Object.fromEntries(Object.entries(byIx).map(([ix, R]) => [ix, Object.fromEntries(['divUp', 'same', 'divDown'].map((c) => { const xs = R.filter((r) => r.cls === c).map((r) => r.fwd); return [c, { n: xs.length, fwd: r4(mean(xs)) }]; }).concat([['all', { n: R.length, fwd: r4(mean(R.map((r) => r.fwd))) }]]))]));
    const passes = Object.values(T).filter((o) => o.pass).length;
    const verdict = `${passes ? 'PASS' : 'FAIL'}, ${passes} of 4: ` + Object.entries(T).map(([k, o]) => `${k} t ${o.all.t} (Holm ${o.holm}, halves ${o.first.t} / ${o.second.t})${o.pass ? ' pass' : ''}`).join('; ');
    const res = { study: 'audjpy-leads', built: '2026-11-20', verdict, tests: T, classes: cls, weeks: Object.fromEntries(Object.entries(byIx).map(([k, R]) => [k, R.length])) };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# Does AUD/JPY turn before equities? (20 Nov 2026)', '',
      'Paper research only. Signal, outcome and bar fixed in `PREREGISTRATION.md` before any equity return was split by AUD/JPY moves. Nothing live changed.', '',
      `**Verdict: ${verdict}**`, '',
      '| Index | AUD/JPY up, index down (4 weeks) | Both the same way | AUD/JPY down, index up | All weeks |', '|---|---|---|---|---|',
      ...Object.entries(cls).map(([ix, c]) => `| ${ix} next 20 sessions | ${pct(c.divUp.fwd)} (${c.divUp.n}) | ${pct(c.same.fwd)} (${c.same.n}) | ${pct(c.divDown.fwd)} (${c.divDown.n}) | ${pct(c.all.fwd)} (${c.all.n}) |`), '',
      'Each test needs |t| >= 2 the claimed way, Holm p < 0.05 over the four, and the same sign in 2007-16 and 2017 on.', ''].join('\n'));
    console.log(verdict); console.log(JSON.stringify(cls));
  }
}
