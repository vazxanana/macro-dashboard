// Edge research · vix-curve: an inverted VIX curve and the next 20 sessions of USD/JPY and gold (PREREGISTRATION.md, pushed alone first)
//   node --use-env-proxy research/edge/vix-curve/run.mjs fetch <dir>
//   node research/edge/vix-curve/run.mjs run <dir>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dailyRows } from '../../../council/macroscore.mjs';
import { parseFred, knownAt, nwSlope } from '../rulebook-gauges/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), FROM = '2008-01-04', HALF = '2017-01-01', N = 20, DAY = 86400;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null), r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));
const pN = (t) => { const z = Math.abs(t), k = 1 / (1 + 0.2316419 * z), d = 0.3989423 * Math.exp(-z * z / 2); return 2 * d * k * (0.3193815 + k * (-0.3565638 + k * (1.781478 + k * (-1.821256 + k * 1.330274)))); };
const firstGE = (S, t) => { let lo = 0, hi = S.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (S[m].t >= t) { r = m; hi = m - 1; } else lo = m + 1; } return r; };
export function signals(vix, v3) {
  const m = new Map(v3.map((o) => [o.d, o.v])), out = [];
  for (const o of vix) { if (o.d < FROM || new Date(o.t * 1000).getUTCDay() !== 5 || !m.has(o.d)) continue; out.push({ day: o.d, t: o.t, inv: o.v > m.get(o.d), vix: o.v, v3: m.get(o.d) }); }
  return out;
}
export function rows(sig, px) {
  const out = [];
  for (const s of sig) { const j = firstGE(px, knownAt(s.t)); if (j < 0 || j + N >= px.length || px[j].t - s.t > 6 * DAY) continue; out.push({ day: s.day, inv: s.inv, fwd: +Math.log(px[j + N].v / px[j].v).toFixed(5) }); }
  return out;
}
export function tests(byMk) {
  const one = (rs) => { const w = nwSlope(rs.map((r) => r.fwd), rs.map((r) => (r.inv ? 1 : 0))); return { n: rs.length, nX: rs.filter((r) => r.inv).length, slope: r4(w.b), t: w.t == null ? null : +w.t.toFixed(2) }; };
  const out = {};
  for (const [k, mk, want] of [['J', 'usdjpy', -1], ['G', 'xau', 1]]) { const R = byMk[mk]; out[k] = { mk, want, all: one(R), first: one(R.filter((r) => r.day < HALF)), second: one(R.filter((r) => r.day >= HALF)) }; }
  const V = Object.values(out), ps = V.map((o) => (o.all.t == null ? 1 : pN(o.all.t))), idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]); let run = 0; const H = [];
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); H[i] = run; });
  V.forEach((o, i) => { o.holm = +H[i].toFixed(4); o.pass = o.all.t != null && Math.sign(o.all.t) === o.want && Math.abs(o.all.t) >= 2 && o.holm < 0.05 && Math.sign(o.first.slope) === o.want && Math.sign(o.second.slope) === o.want; });
  return out;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const id of ['VIXCLS', 'VXVCLS']) { const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`); if (!r.ok) throw new Error(id + ' ' + r.status); fs.writeFileSync(path.join(dir, id + '.csv'), await r.text()); }
    for (const k of ['usdjpy', 'xau', 'spx500']) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    console.log('fetched');
  } else if (cmd === 'run') {
    const F = (id) => parseFred(fs.readFileSync(path.join(dir, id + '.csv'), 'utf8')), L = (k) => dailyRows(JSON.parse(fs.readFileSync(path.join(dir, k + '.json'), 'utf8')));
    const S = signals(F('VIXCLS'), F('VXVCLS')), byMk = Object.fromEntries(['usdjpy', 'xau', 'spx500'].map((k) => [k, rows(S, L(k))])), T = tests(byMk);
    let ep = 0; for (let i = 0; i < S.length; i++) if (S[i].inv && (i === 0 || !S[i - 1].inv)) ep++;
    const pct = (x) => (x == null ? '—' : `${x >= 0 ? '+' : '−'}${Math.abs(100 * (Math.exp(x) - 1)).toFixed(2)} %`);
    const cls = Object.fromEntries(Object.entries(byMk).map(([k, R]) => [k, { inverted: { n: R.filter((r) => r.inv).length, fwd: r4(mean(R.filter((r) => r.inv).map((r) => r.fwd))) }, normal: { n: R.filter((r) => !r.inv).length, fwd: r4(mean(R.filter((r) => !r.inv).map((r) => r.fwd))) } }]));
    const line = (o, lbl) => `${lbl} ${o.pass ? 'PASS' : 'FAIL'} (t ${o.all.t}, Holm ${o.holm}, halves t ${o.first.t} / ${o.second.t})`;
    const verdict = `${line(T.J, 'J inverted VIX curve → USD/JPY lower')}; ${line(T.G, 'G → gold higher')}`;
    const res = { study: 'vix-curve', built: '2026-11-20', verdict, weeks: S.length, invertedWeeks: S.filter((s) => s.inv).length, episodes: ep, tests: T, classes: cls };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    const name = { usdjpy: 'USD/JPY', xau: 'Gold', spx500: 'S&P 500 (reported)' };
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# An inverted VIX curve: what USD/JPY and gold do next (20 Nov 2026)', '',
      'Paper research only. Signal, outcome and bar fixed in `PREREGISTRATION.md` before any return was split by the VIX curve. Nothing live changed.', '',
      `**Verdict: ${verdict}**`, '', `Weekly readings: ${S.length}; inverted on ${res.invertedWeeks} weeks in ${ep} episodes.`, '',
      '| Next 20 sessions | Inverted weeks | Normal weeks |', '|---|---|---|',
      ...Object.entries(cls).map(([k, c]) => `| ${name[k]} | ${pct(c.inverted.fwd)} (${c.inverted.n}) | ${pct(c.normal.fwd)} (${c.normal.n}) |`), ''].join('\n'));
    console.log(verdict); console.log(JSON.stringify(cls), S.filter((s) => s.inv).length, ep);
  }
}
