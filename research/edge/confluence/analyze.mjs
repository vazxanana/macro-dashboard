// Confluence study: joins the Meridian replay (meridian.mjs) and the ICT replay (ict.mjs) and tests
//  (a) Meridian Scalp / Intraday signals with vs without ICT confluence in the same direction
//  (b) ICT iFVG trades aligned vs opposed to the Meridian H1/H4/D1 structure trend and the Malaysian SnR direction.
// In-sample 2018-2023 picks the side of each filter (keep 'yes' or keep 'no'); 2024-2026 is reported untouched. All R net of cost.
// Usage: node analyze.mjs <outDir(with mer_*.json, ict_*.json)> <resultDir>
import fs from 'node:fs';
import path from 'node:path';
import { stats, yearOf } from './lib.mjs';

const [dir, resDir = '.'] = process.argv.slice(2);
const MK = ['xau', 'nas', 'eurusd'];
const IS = (t) => yearOf(t) <= 2023;
const ict = {}, mer = [];
for (const m of MK) {
  const f = path.join(dir, `ict_${m}.json`); if (fs.existsSync(f)) ict[m] = JSON.parse(fs.readFileSync(f));
  for (const g of fs.readdirSync(dir).filter((x) => x.startsWith(`mer_${m}_`))) { const j = JSON.parse(fs.readFileSync(path.join(dir, g)));
    for (const r of j.rows) { const o = Object.fromEntries(j.cols.map((c, i) => [c, r[i]])); o.t = o.opened; o.s = o.side === 'buy' ? 1 : -1; o.net = o.R - o.cost; mer.push(o); } }
}
mer.sort((a, b) => a.t - b.t);

// ── (a) ICT context of each Meridian trade ──
for (const m of MK) {
  const I = ict[m]; if (!I) continue;
  const Z = I.zones.map(([t, side, lo, hi, dead, pd, zone, grade]) => ({ t, side, lo, hi, dead, grade })), D = I.D1;
  const dLast = (t) => { let lo = 0, hi = D.length - 1, r = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (D[mid][0] + 86400 <= t) { r = mid; lo = mid + 1; } else hi = mid - 1; } return r; };
  let zi = 0; const recent = [];
  for (const x of mer.filter((v) => v.m === m)) {
    while (zi < Z.length && Z[zi].t <= x.t) recent.push(Z[zi++]);
    while (recent.length && x.t - recent[0].t > 7 * 86400) recent.shift();
    x.after = recent.some((z) => z.side === x.s && x.t - z.t <= 24 * 3600) ? 'yes' : 'no';
    x.opp = recent.some((z) => z.side === -x.s && x.t - z.t <= 24 * 3600) ? 'yes' : 'no';
    x.inside = recent.some((z) => z.side === x.s && (z.dead == null || z.dead > x.t) && x.entry >= z.lo && x.entry <= z.hi) ? 'yes' : 'no';
    const di = dLast(x.t); let pdz = 'n/a';
    if (di >= 19) { const R = D.slice(di - 19, di + 1), hi = Math.max(...R.map((d) => d[1])), lo = Math.min(...R.map((d) => d[2])), pd = (x.entry - lo) / (hi - lo); pdz = (x.s > 0 ? pd < 0.5 : pd > 0.5) ? 'yes' : 'no'; }
    x.pd = pdz;
    x.ictpd = (x.after === 'yes' || x.inside === 'yes') && pdz === 'yes' ? 'yes' : 'no';
    x.anyIct = x.after === 'yes' || x.inside === 'yes' ? 'yes' : 'no';
  }
}
const split = (arr) => ({ is: arr.filter((x) => IS(x.t)), oos: arr.filter((x) => !IS(x.t)) });
const st = (arr, f = 'net') => stats(arr.map((x) => x[f]));
const years = (arr, f = 'net') => { const y = {}; for (const x of arr) (y[yearOf(x.t)] = y[yearOf(x.t)] || []).push(x[f]); return Object.fromEntries(Object.entries(y).map(([k, v]) => [k, +v.reduce((a, b) => a + b, 0).toFixed(1)])); };
let variantsTried = 0;
const candidates = [], tables = [];
function test(system, label, base, feats) {
  const B = split(base), row = { system, baseline: label, is: st(B.is), oos: st(B.oos), oosGross: stats(B.oos.map((x) => x.R)), years: years(B.oos), filters: [] };
  for (const f of feats) {
    variantsTried++;
    const keep = (v) => base.filter((x) => x[f] === v);
    const yes = split(keep('yes')), no = split(base.filter((x) => x[f] !== 'yes'));
    const sy = st(yes.is), sn = st(no.is);
    // in-sample decides which side to keep: the one with the higher IS expectancy
    const pick = (sy.exp ?? -9) >= (sn.exp ?? -9) ? 'yes' : 'no';
    const P = pick === 'yes' ? yes : no, oosY = years(P.oos), so = st(P.oos), posY = Object.values(oosY).filter((v) => v > 0).length, nY = Object.keys(oosY).length;
    const minN = system === 'ICT' ? 50 : 100;
    const pass = so.n >= minN && so.exp > 0 && so.exp > row.oos.exp && posY >= Math.ceil((2 / 3) * nY);
    // fewer trades are worth it only if the filtered book keeps its total R, or earns more R per R of drawdown (so size can be raised)
    const rdd = (x) => x.maxDD < 0 ? +(x.R / -x.maxDD).toFixed(2) : null, keepsTotal = so.R >= row.oos.R, betterRDD = (rdd(so) ?? 0) > (rdd(row.oos) ?? 0);
    const r = { rule: `${label}: keep ${f}=${pick}`, feature: f, pick, isYes: sy, isNo: sn, oosYes: st(yes.oos), oosNo: st(no.oos), is: st(P.is), oos: so, years: oosY,
      share: +(P.oos.length / Math.max(1, B.oos.length)).toFixed(2), dTotalR: +(so.R - row.oos.R).toFixed(1), rddKept: rdd(so), rddBase: rdd(row.oos), keepsTotal, betterRDD,
      verdict: pass ? (keepsTotal || betterRDD ? 'CANDIDATE' : 'CANDIDATE (R/t only: loses total R and R/DD)') : 'FAIL' };
    row.filters.push(r); candidates.push({ system, ...r });
  }
  tables.push(row);
}
// (a) Meridian
const MF = ['after', 'inside', 'pd', 'anyIct', 'ictpd', 'opp'];
for (const k of ['scalp', 'intraday']) {
  test('Meridian', `${k} all markets`, mer.filter((x) => x.k === k), MF);
  for (const m of MK) test('Meridian', `${k} ${m}`, mer.filter((x) => x.k === k && x.m === m), MF);
}
// the owner's live scalp rule (against D1, not asia/overlap) as a second baseline
test('Meridian', 'scalp live-rule (against D1, no asia/overlap) all markets', mer.filter((x) => x.k === 'scalp' && x.d1 === 'against' && x.session !== 'asia' && x.session !== 'overlap'), MF);
// (b) ICT
const it = [];
for (const m of MK) if (ict[m]) for (const x of ict[m].trades) {
  const o = { ...x, m, net: x.R - x.cost };
  for (const f of ['mH1', 'mH4', 'mD1', 'msnr']) o[f + 'W'] = x[f] === 'with' ? 'yes' : 'no';
  o.h1h4W = x.mH1 === 'with' && x.mH4 === 'with' ? 'yes' : 'no';
  o.allW = x.mH1 === 'with' && x.mH4 === 'with' && x.msnr === 'with' ? 'yes' : 'no';
  it.push(o);
}
it.sort((a, b) => a.t - b.t);
const IF = ['mH1W', 'mH4W', 'h1h4W', 'msnrW', 'mD1W', 'allW'];
for (const m of MK) { test('ICT', `ICT all ${m}`, it.filter((x) => x.m === m), IF); test('ICT', `ICT A-setups ${m}`, it.filter((x) => x.m === m && x.aset), IF); }
test('ICT', 'ICT all gold+nas', it.filter((x) => x.m !== 'eurusd'), IF);
test('ICT', 'ICT A-setups gold+nas', it.filter((x) => x.m !== 'eurusd' && x.aset), IF);

fs.mkdirSync(resDir, { recursive: true });
fs.writeFileSync(path.join(resDir, 'tables.json'), JSON.stringify({ variantsTried, tables }, null, 1));
const f3 = (s) => s && s.n ? `n${s.n} wr${s.wr} ${s.exp >= 0 ? '+' : ''}${s.exp}R/t ${s.R}R dd${s.maxDD} t${s.t}` : 'n0';
for (const T of tables) {
  console.log(`\n## ${T.system} | ${T.baseline}\n  base IS ${f3(T.is)}\n  base OOS ${f3(T.oos)} (gross ${T.oosGross.exp}) years ${JSON.stringify(T.years)}`);
  for (const r of T.filters) console.log(`  ${r.feature.padEnd(7)} pick ${r.pick.padEnd(3)} | IS yes ${f3(r.isYes)} | no ${f3(r.isNo)}\n${' '.repeat(22)}OOS kept ${f3(r.oos)} share ${r.share} dTot ${r.dTotalR} R/DD ${r.rddKept} vs ${r.rddBase} ${JSON.stringify(r.years)} ${r.verdict}\n${' '.repeat(22)}OOS yes ${f3(r.oosYes)} | no ${f3(r.oosNo)}`);
}
console.log('\nvariants tried', variantsTried, 'candidates', candidates.filter((c) => c.verdict === 'CANDIDATE').map((c) => c.rule));

// result.json in the edge-study format: one baseline per tested book, every filter variant as a candidate entry
const pickStats = (s) => ({ n: s.n, wr: s.wr, exp: s.exp, R: s.R, maxDD: s.maxDD, t: s.t });
const result = {
  topic: 'confluence',
  system: 'MERIDIAN Scalp/Intraday (council/engine.mjs) x ICT H1 iFVG (ict/tracker.mjs) on spot gold, NAS100 cash, EUR/USD (HistData M1 2018-2026-10)',
  baseline: Object.fromEntries(tables.filter((T) => T.is.n || T.oos.n).map((T) => [`${T.system}: ${T.baseline}`, { is: pickStats(T.is), oos: pickStats(T.oos) }])),
  candidates: candidates.filter((c) => c.is.n || c.oos.n).map((c) => ({ rule: `${c.system}: ${c.rule}`, is: pickStats(c.is), oos: pickStats(c.oos), years: c.years, share: c.share, dTotalR: c.dTotalR, rddKept: c.rddKept, rddBase: c.rddBase, verdict: c.verdict })),
  variantsTried,
  verdict: 'FAIL: no confluence filter is robust (see RESULT.md); per-row CANDIDATE flags are mechanical and mostly have tiny IS separation or a flat/negative IS kept book, 102 variants',
  notes: 'IS 2018-2023 picks which side of each yes/no filter to keep; OOS 2024-2026-10 untouched. R net of cost. Strict preamble test = OOS n>=100 (ICT >=50), OOS R/t>0 and > baseline, >=2/3 OOS years positive. "CANDIDATE (R/t only)" = passes that but loses OOS total R AND R per R of drawdown, i.e. fewer trades not justified.',
};
fs.writeFileSync(path.join(resDir, 'result.json'), JSON.stringify(result, null, 1));
