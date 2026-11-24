// research/edge/fade-box-edge/analyze.mjs - DISCOVERY analysis (before the pre-registration): every variant (chain x stop x exit)
// crossed with a fixed list of conditions and their pairs, AFTER costs, in five windows of data the fade was already read on:
// 2010-14 and 2015-19 (five markets), set A (five markets 2005-09), set B (holdout markets 2010-19), set C (five markets 2020-26).
//   node analyze.mjs <dir>  -> discovery.json (every cell's figures, how many were tried) + the top cells on stdout
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SETS } from './discover.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const WINDOWS = { w1014: ['gate', y(2010), y(2015)], w1519: ['gate', y(2015), y(2020)], A: ['A', SETS.A.from, SETS.A.to], B: ['B', SETS.B.from, SETS.B.to], C: ['C', SETS.C.from, SETS.C.to] };
export const VARIANTS = []; for (const ch of [1, 2]) for (const k of [1, 1.5, 2]) for (const x of ['r1', 'r2', 'tr', 'mid']) VARIANTS.push({ ch, k, x });
// conditions on the decision-time features (fixed before reading the output)
export const CONDS = {
  all: () => true,
  london: (r) => r.hour >= 7 && r.hour < 12, ny: (r) => r.hour >= 12 && r.hour < 17, other: (r) => r.hour < 7 || r.hour >= 17,
  rc3: (r) => r.rc >= 3, rc5: (r) => r.rc >= 5, rc8: (r) => r.rc >= 8,
  h1with: (r) => r.st1h === 1, h1against: (r) => r.st1h === -1, h4with: (r) => r.st4h === 1, h4against: (r) => r.st4h === -1,
  d1with: (r) => r.st1d === 1, d1against: (r) => r.st1d === -1,
  sweepPD: (r) => r.pd === 1, insidePD: (r) => r.pd === 0,
  er20: (r) => r.er != null && r.er < 0.2, er30: (r) => r.er != null && r.er < 0.3,
  box2: (r) => r.boxAtr >= 2, box3: (r) => r.boxAtr >= 3,
  topIn: (r) => r.topPos === 0, topOut: (r) => r.topPos === 1, small: (r) => r.size === 0, big: (r) => r.size === 1,
};
const tM = (s) => { const n = s.length, m = s.reduce((a, b) => a + b, 0) / n; const sd = Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)); return sd > 0 ? m / (sd / Math.sqrt(n)) : 0; };
const mIdx = (t, f) => { const a = new Date(f * 1000), d = new Date(t * 1000); return (d.getUTCFullYear() - a.getUTCFullYear()) * 12 + d.getUTCMonth() - a.getUTCMonth(); };
export function stat(rows, v, from, to) {
  const NM = mIdx(to - 1, from) + 1, g = new Array(NM).fill(0), net = new Array(NM).fill(0); let n = 0, sg = 0, sn = 0;
  for (const r of rows) { if (r.t < from || r.t >= to) continue; const q = r.R['k' + v.k]; if (!q || q[v.x] == null) continue;
    const m = mIdx(r.t, from); n++; sg += q[v.x]; sn += q[v.x] - q.cr; g[m] += q[v.x]; net[m] += q[v.x] - q.cr; }
  return { n, gross: n ? sg / n : null, net: n ? sn / n : null, tG: tM(g), tN: tM(net) };
}
export function loadAll(dir) {
  const out = {}; for (const set of ['gate', 'A', 'B', 'C']) out[set] = SETS[set].markets.flatMap((m) => { const f = path.join(dir, `${set}.${m}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).map((r) => ({ ...r, m })) : []; });
  return out;
}
export function cells(D) {
  const names = Object.keys(CONDS), pairs = [];
  for (let i = 0; i < names.length; i++) pairs.push([names[i]]);
  for (let i = 1; i < names.length; i++) for (let j = i + 1; j < names.length; j++) pairs.push([names[i], names[j]]);
  const res = [];
  for (const v of VARIANTS) for (const cs of pairs) {
    const ok = (r) => r.ch === v.ch && cs.every((c) => CONDS[c](r));
    const w = {}; let good = true, minT = Infinity, nAll = 0;
    for (const [k, [set, a, b]] of Object.entries(WINDOWS)) { const s = stat(D[set].filter(ok), v, a, b); w[k] = s; nAll += s.n;
      if (!(s.n >= 100 && s.net > 0)) good = false; minT = Math.min(minT, s.tN); }
    res.push({ v, cs, w, good, minT, nAll });
  }
  return res;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const D = loadAll(process.argv[2]), R = cells(D);
  const good = R.filter((r) => r.good).sort((a, b) => b.minT - a.minT);
  const f = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '') + x.toFixed(3));
  const line = (r) => `ch${r.v.ch} k${r.v.k} ${r.v.x} [${r.cs.join('+')}] minT ${r.minT.toFixed(2)} | ` + Object.entries(r.w).map(([k, s]) => `${k} n${s.n} g${f(s.gross)} net${f(s.net)} t${s.tN.toFixed(2)}`).join(' | ');
  console.log('cells tried', R.length, 'positive after costs in all five windows (n>=100 each):', good.length);
  for (const r of good.slice(0, 40)) console.log(line(r));
  console.log('--- baselines'); for (const r of R.filter((x) => x.cs.length === 1 && x.cs[0] === 'all')) console.log(line(r));
  fs.writeFileSync(path.join(HERE, 'discovery.json'), JSON.stringify({ built: '2026-11-24', windows: Object.keys(WINDOWS), tried: R.length, positiveAllWindows: good.length,
    top: good.slice(0, 40).map((r) => ({ ch: r.v.ch, k: r.v.k, exit: r.v.x, conds: r.cs, minTNet: +r.minT.toFixed(2), windows: Object.fromEntries(Object.entries(r.w).map(([k, s]) => [k, { n: s.n, gross: +(s.gross ?? 0).toFixed(4), net: +(s.net ?? 0).toFixed(4), tNet: +s.tN.toFixed(2) }])) })),
    baselines: R.filter((x) => x.cs.length === 1 && x.cs[0] === 'all').map((r) => ({ ch: r.v.ch, k: r.v.k, exit: r.v.x, windows: Object.fromEntries(Object.entries(r.w).map(([k, s]) => [k, { n: s.n, gross: +(s.gross ?? 0).toFixed(4), net: +(s.net ?? 0).toFixed(4), tNet: +s.tN.toFixed(2) }])) })) }, null, 1) + '\n');
}
