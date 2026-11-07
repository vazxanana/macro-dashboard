import fs from 'node:fs';
import { stats, paired } from './engine.mjs';
const recs = ['nas', 'spx', 'xau'].flatMap((m) => JSON.parse(fs.readFileSync(`h-${m}.json`))).sort((a, b) => a.t - b.t);
const names = Object.keys(recs[0].r);
const periods = [['2018-21', 2018, 2021], ['2022-24', 2022, 2024], ['2025-26', 2025, 2026]];
const yr = (t) => new Date(t * 1000).getUTCFullYear();
console.log('n', recs.length, 'by market', JSON.stringify(recs.reduce((q, r) => ((q[r.mk] = (q[r.mk] || 0) + 1), q), {})));
console.log('variant            | all n  R/tr   totR   DD    t   | ' + periods.map((p) => p[0] + ' R/tr d').join(' | ') + ' | d/tr  t(d) | nq es gc diff');
for (const k of names) {
  const a = recs.map((r) => r.r[k]), L = recs.map((r) => r.r.live), s = stats(a), d = paired(a, L);
  const per = periods.map(([, y0, y1]) => { const ix = recs.map((r, i) => (yr(r.t) >= y0 && yr(r.t) <= y1 ? i : -1)).filter((i) => i >= 0); const ss = stats(ix.map((i) => a[i])); const dd = ix.reduce((q, i) => q + a[i] - L[i], 0); return `${String(ss.exp).padStart(6)} ${dd >= 0 ? '+' : ''}${dd.toFixed(1)}`; });
  const mk = ['nq', 'es', 'gc'].map((m) => recs.reduce((q, r, i) => q + (r.mk === m ? a[i] - L[i] : 0), 0).toFixed(1));
  console.log(`${k.padEnd(18)} | ${s.n} ${String(s.exp).padStart(6)} ${String(s.R).padStart(6)} ${String(s.dd).padStart(5)} ${String(s.t).padStart(5)} | ${per.join(' | ')} | ${String(d.perTrade).padStart(6)} ${String(d.t).padStart(5)} | ${mk.join(' ')}`);
}
