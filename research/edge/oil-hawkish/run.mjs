// Edge research · oil-hawkish: a slow, persistent WTI rise and the next 20 sessions of USD/JPY and gold (PREREGISTRATION.md, pushed alone first)
//   node research/edge/oil-hawkish/run.mjs fetch <dir>   (git show from origin/council-data, no network)
//   node research/edge/oil-hawkish/run.mjs run <dir>
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
const firstGT = (S, t) => { let lo = 0, hi = S.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (S[m].t > t) { r = m; hi = m - 1; } else lo = m + 1; } return r; };
// slow persistent rise at index i of the WTI closes
export function slowRise(w, i) { if (i < 63) return false; const c = (a, b) => w[b].v / w[a].v - 1; return c(i - 63, i) > 0.15 && c(i - 63, i - 42) > 0 && c(i - 42, i - 21) > 0 && c(i - 21, i) > 0; }
export function signals(w) { const out = []; for (let i = 63; i < w.length; i++) { const d = iso(w[i].t); if (d < FROM || new Date(w[i].t * 1000).getUTCDay() !== 5) continue; out.push({ day: d, t: w[i].t, on: slowRise(w, i) }); } return out; }
export function rows(sig, px) {
  const out = [];
  for (const s of sig) { const j = firstGT(px, s.t); if (j < 0 || j + N >= px.length || px[j].t - s.t > 4 * DAY) continue; out.push({ day: s.day, on: s.on, fwd: +Math.log(px[j + N].v / px[j].v).toFixed(5) }); }
  return out;
}
export function tests(byMk) {
  const one = (rs) => { const w = nwSlope(rs.map((r) => r.fwd), rs.map((r) => (r.on ? 1 : 0))); return { n: rs.length, nX: rs.filter((r) => r.on).length, slope: r4(w.b), t: w.t == null ? null : +w.t.toFixed(2) }; };
  const out = {};
  for (const [k, mk, want] of [['D', 'usdjpy', 1], ['G', 'xau', -1]]) { const R = byMk[mk]; out[k] = { mk, want, all: one(R), first: one(R.filter((r) => r.day < HALF)), second: one(R.filter((r) => r.day >= HALF)) }; }
  const V = Object.values(out), ps = V.map((o) => (o.all.t == null ? 1 : pN(o.all.t))), idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]); let run = 0; const H = [];
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); H[i] = run; });
  V.forEach((o, i) => { o.holm = +H[i].toFixed(4); o.pass = o.all.t != null && Math.sign(o.all.t) === o.want && Math.abs(o.all.t) >= 2 && o.holm < 0.05 && Math.sign(o.first.slope) === o.want && Math.sign(o.second.slope) === o.want; });
  return out;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') { fs.mkdirSync(dir, { recursive: true }); for (const k of ['wtico', 'usdjpy', 'xau']) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 })); console.log('fetched'); }
  else if (cmd === 'run') {
    const L = (k) => dailyRows(JSON.parse(fs.readFileSync(path.join(dir, k + '.json'), 'utf8'))).filter((o) => ![0, 6].includes(new Date(o.t * 1000).getUTCDay()));
    const S = signals(L('wtico')), byMk = { usdjpy: rows(S, L('usdjpy')), xau: rows(S, L('xau')) }, T = tests(byMk);
    let ep = 0; for (let i = 0; i < S.length; i++) if (S[i].on && (i === 0 || !S[i - 1].on)) ep++;
    const pct = (x) => (x == null ? '—' : `${x >= 0 ? '+' : '−'}${Math.abs(100 * (Math.exp(x) - 1)).toFixed(2)} %`);
    const cls = Object.fromEntries(Object.entries(byMk).map(([k, R]) => [k, { rise: { n: R.filter((r) => r.on).length, fwd: r4(mean(R.filter((r) => r.on).map((r) => r.fwd))) }, rest: { n: R.filter((r) => !r.on).length, fwd: r4(mean(R.filter((r) => !r.on).map((r) => r.fwd))) } }]));
    const line = (o, lbl) => `${lbl} ${o.pass ? 'PASS' : 'FAIL'} (t ${o.all.t}, Holm ${o.holm}, halves t ${o.first.t} / ${o.second.t})`;
    const verdict = `${line(T.D, 'D slow oil rise → USD/JPY higher')}; ${line(T.G, 'G → gold lower')}`;
    const res = { study: 'oil-hawkish', built: '2026-11-20', verdict, weeks: S.length, riseWeeks: S.filter((s) => s.on).length, episodes: ep, tests: T, classes: cls };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# A slow, persistent oil rise: hawkish for the dollar and gold? (20 Nov 2026)', '',
      'Paper research only. Signal, outcome and bar fixed in `PREREGISTRATION.md` before any return was split by oil moves. Nothing live changed.', '',
      `**Verdict: ${verdict}**`, '', `Weekly readings: ${S.length}; a slow persistent rise on ${res.riseWeeks} weeks in ${ep} episodes.`, '',
      '| Next 20 sessions | Slow-rise weeks | Other weeks |', '|---|---|---|',
      `| USD/JPY | ${pct(cls.usdjpy.rise.fwd)} (${cls.usdjpy.rise.n}) | ${pct(cls.usdjpy.rest.fwd)} (${cls.usdjpy.rest.n}) |`,
      `| Gold | ${pct(cls.xau.rise.fwd)} (${cls.xau.rise.n}) | ${pct(cls.xau.rest.fwd)} (${cls.xau.rest.n}) |`, ''].join('\n'));
    console.log(verdict); console.log(JSON.stringify(cls), res.riseWeeks, ep);
  }
}
