// Edge research · regime: does the market regime at signal time decide when the engine setups work?
// Usage: node research/edge/regime/analyze.mjs <dir with <market>.json from replay.mjs> <outDir>
// Walk-forward: every gate is chosen on 2018-2023 (in-sample) only, then judged untouched on 2024 - Oct 2026 (out-of-sample).
// All R are net of one spread per round trip (backtest.mjs cost model) unless marked gross.
import fs from 'node:fs';
import path from 'node:path';

const [IN, OUTDIR] = process.argv.slice(2);
const MKTS = ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf'];
const T = [];
for (const m of MKTS) {
  const f = path.join(IN, `${m}.json`); if (!fs.existsSync(f)) { console.log('missing', m); continue; }
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const r of j.rows) { const o = Object.fromEntries(j.cols.map((c, i) => [c, r[i]])); o.m = m; o.year = new Date(o.opened * 1000).getUTCFullYear(); o.net = o.R - o.cost; T.push(o); }
}
T.sort((a, b) => a.opened - b.opened);
const SPLIT = Date.UTC(2024, 0, 1) / 1000;
const SYSTEMS = {
  scalp: { label: 'Scalp, live rule (against D1, not Asia/overlap, no AUD/USD, r:r >= 1.2)', f: (x) => x.k === 'scalp' && x.d1 === 'against' && !['asia', 'overlap'].includes(x.session) && x.m !== 'audusd' && x.rr >= 1.2 },
  intraday: { label: 'Intraday, config filters (against D1, not Asia, r:r 1.2-10)', f: (x) => x.k === 'intraday' && x.d1 === 'against' && x.session !== 'asia' && x.rr >= 1.2 && x.rr <= 10 },
  swing: { label: 'Swing, owner rule (against D1, r:r >= 1.2)', f: (x) => x.k === 'swing' && x.d1 === 'against' && x.rr >= 1.2 },
  scalpAll: { label: 'Scalp, every signal (context only)', f: (x) => x.k === 'scalp' && x.rr >= 1.2 },
};
const CONT = ['atrPctD', 'atrPctH4', 'adx', 'dist20', 'dist50', 'adist20', 'wkExp', 'wkSoFar', 'rvPct', 'dayRange'];
const CAT = ['dow', 'wom', 'news', 'h4'];

function stats(a, key = 'net') {
  const n = a.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, streak: 0, t: null, gross: null };
  let s = 0, s2 = 0, w = 0, eq = 0, pk = 0, dd = 0, ls = 0, cur = 0, g = 0;
  for (const x of a) { const v = x[key]; s += v; s2 += v * v; g += x.R; if (v > 0) { w++; cur = 0; } else { cur++; ls = Math.max(ls, cur); } eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const mean = s / n, sd = n > 1 ? Math.sqrt(Math.max(0, (s2 - n * mean * mean) / (n - 1))) : 0;
  return { n, wr: +(w / n).toFixed(3), exp: +mean.toFixed(4), R: +s.toFixed(1), maxDD: +dd.toFixed(1), streak: ls, t: sd ? +(mean / sd * Math.sqrt(n)).toFixed(2) : null, gross: +(g / n).toFixed(4) };
}
const years = (a) => Object.fromEntries([...new Set(a.map((x) => x.year))].sort().map((y) => [y, stats(a.filter((x) => x.year === y))]));
const q = (arr, p) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const fmtE = (s) => s.n ? `${s.exp >= 0 ? '+' : ''}${s.exp.toFixed(3)}` : '–';

const out = { topic: 'regime', system: 'MERIDIAN council engine (scalp / intraday / swing)', split: '2018-2023 IS | 2024-Oct 2026 OOS', systems: {}, variantsTried: 0, notes: [] };
const md = [];
for (const [sk, S] of Object.entries(SYSTEMS)) {
  const all = T.filter(S.f), IS = all.filter((x) => x.opened < SPLIT), OOS = all.filter((x) => x.opened >= SPLIT);
  const base = { is: stats(IS), oos: stats(OOS), years: years(all) };
  const R = { label: S.label, baseline: base, buckets: {}, picks: [] };
  let tried = 0;
  // descriptive: quintile buckets (cut on IS), IS vs OOS expectancy, and whether the ranking repeats
  for (const f of CONT) {
    const v = IS.map((x) => x[f]).filter((z) => z != null); if (v.length < 100) continue;
    const cuts = [0.2, 0.4, 0.6, 0.8].map((p) => q(v, p));
    const bk = (z) => z == null ? null : cuts.filter((c) => z >= c).length;
    const rows = [0, 1, 2, 3, 4].map((b) => ({ b, lo: b ? cuts[b - 1] : null, hi: b < 4 ? cuts[b] : null, is: stats(IS.filter((x) => bk(x[f]) === b)), oos: stats(OOS.filter((x) => bk(x[f]) === b)) }));
    const rk = (k) => { const e = rows.map((r) => r[k].exp ?? 0); return e.map((x) => e.filter((y) => y < x).length); };
    const a = rk('is'), b = rk('oos'), rho = 1 - 6 * a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0) / (5 * 24);
    R.buckets[f] = { cuts: cuts.map((c) => +c.toFixed(3)), rows, rho: +rho.toFixed(2) };
    // gate search on IS: keep x in [cut_i, cut_j) (14 non-trivial intervals), at least 30% of IS trades kept
    let best = null;
    for (let i = 0; i <= 4; i++) for (let j = i + 1; j <= 5; j++) {
      if (i === 0 && j === 5) continue;
      tried++;
      const lo = i ? cuts[i - 1] : -Infinity, hi = j < 5 ? cuts[j - 1] : Infinity;
      const keep = (x) => x[f] != null && x[f] >= lo && x[f] < hi;
      const s = stats(IS.filter(keep)); if (s.n < 0.3 * IS.length) continue;
      if (!best || s.exp > best.isS.exp) best = { f, lo, hi, keep, isS: s };
    }
    if (best) R.picks.push(best);
  }
  for (const f of CAT) {
    const cats = [...new Set(IS.map((x) => x[f]))].sort();
    R.buckets[f] = { rows: cats.map((c) => ({ c, is: stats(IS.filter((x) => x[f] === c)), oos: stats(OOS.filter((x) => x[f] === c)) })) };
    let best = null;
    for (const c of cats) for (const mode of ['only', 'not']) {
      tried++;
      const keep = mode === 'only' ? (x) => x[f] === c : (x) => x[f] !== c;
      const s = stats(IS.filter(keep)); if (s.n < 0.3 * IS.length) continue;
      if (!best || s.exp > best.isS.exp) best = { f, cat: c, mode, keep, isS: s };
    }
    if (best) R.picks.push(best);
  }
  out.variantsTried += tried;
  R.variantsTried = tried;
  R.candidates = R.picks.map((p) => {
    const o = OOS.filter(p.keep), ys = years(o), oy = Object.values(ys);
    const rule = p.cat !== undefined ? `${p.f} ${p.mode === 'only' ? '=' : '!='} ${p.cat}` : `${p.lo === -Infinity ? '' : `${p.f} >= ${+p.lo.toFixed(3)}`}${p.lo !== -Infinity && p.hi !== Infinity ? ' and ' : ''}${p.hi === Infinity ? '' : `${p.f} < ${+p.hi.toFixed(3)}`}`;
    const os = stats(o), pass = os.n >= (sk === 'swing' ? 50 : 100) && os.exp > 0 && os.exp > base.oos.exp && oy.filter((y) => y.exp > 0).length >= Math.ceil(2 / 3 * oy.length);
    return { rule, is: p.isS, oos: os, years: ys, verdict: pass ? 'PASS' : 'FAIL', isGain: +(p.isS.exp - base.is.exp).toFixed(4), oosGain: os.n ? +(os.exp - base.oos.exp).toFixed(4) : null };
  }).sort((a, b) => b.isGain - a.isGain);
  out.systems[sk] = R;

  // markdown
  md.push(`\n## ${S.label}\n`);
  md.push(`Baseline: IS n ${base.is.n}, ${fmtE(base.is)} R/trade (gross ${base.is.gross}), total ${base.is.R}R, maxDD ${base.is.maxDD}R, t ${base.is.t} | OOS n ${base.oos.n}, ${fmtE(base.oos)} R/trade (gross ${base.oos.gross}), total ${base.oos.R}R, maxDD ${base.oos.maxDD}R, worst streak ${base.oos.streak}, t ${base.oos.t}\n`);
  md.push('By year: ' + Object.entries(base.years).map(([y, s]) => `${y} ${fmtE(s)} (n${s.n}, ${s.R}R)`).join(' · ') + '\n');
  md.push('\n| feature | quintile cuts (IS) | Q1 IS / OOS | Q2 | Q3 | Q4 | Q5 | rank corr IS→OOS |\n|---|---|---|---|---|---|---|---|');
  for (const f of CONT) { const b = R.buckets[f]; if (!b) continue; md.push(`| ${f} | ${b.cuts.join(' / ')} | ${b.rows.map((r) => `${fmtE(r.is)} / ${fmtE(r.oos)}`).join(' | ')} | ${b.rho} |`); }
  md.push('\n| feature | category: IS exp (n) / OOS exp (n) |\n|---|---|');
  for (const f of CAT) { const b = R.buckets[f]; md.push(`| ${f} | ${b.rows.map((r) => `${r.c}: ${fmtE(r.is)} (${r.is.n}) / ${fmtE(r.oos)} (${r.oos.n})`).join(' · ')} |`); }
  md.push(`\nBest IS gate per feature (chosen on 2018-2023, ≥30% of IS trades kept; ${tried} variants searched), judged on 2024-26:\n`);
  const rhos = Object.values(R.buckets).map((b) => b.rho).filter((v) => v != null);
  R.meanRho = rhos.length ? +(rhos.reduce((a, b) => a + b, 0) / rhos.length).toFixed(2) : null;
  md.push(`Mean quintile rank correlation IS→OOS over the ${rhos.length} continuous features: ${R.meanRho} (0 = the regime ranking does not repeat; 1 = it repeats exactly).\n`);
  md.push('| rule | IS n | IS exp | OOS n | OOS exp | OOS R | OOS maxDD | OOS t | OOS years | verdict |\n|---|---|---|---|---|---|---|---|---|---|');
  for (const c of R.candidates) md.push(`| ${c.rule} | ${c.is.n} | ${fmtE(c.is)} | ${c.oos.n} | ${fmtE(c.oos)} | ${c.oos.R} | ${c.oos.maxDD} | ${c.oos.t} | ${Object.entries(c.years).map(([y, s]) => `${y} ${fmtE(s)}`).join(', ')} | ${c.verdict} |`);
}
fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(path.join(OUTDIR, 'tables.md'), md.join('\n') + '\n');
// slim result.json in the shared format
const slim = (s) => ({ n: s.n, wr: s.wr, exp: s.exp, R: s.R, maxDD: s.maxDD, t: s.t });
const res = { topic: 'regime', system: out.system, split: out.split, perSystem: {}, variantsTried: out.variantsTried };
for (const [sk, R] of Object.entries(out.systems)) res.perSystem[sk] = { label: R.label, baseline: { is: slim(R.baseline.is), oos: slim(R.baseline.oos) }, baselineYears: Object.fromEntries(Object.entries(R.baseline.years).map(([y, s]) => [y, slim(s)])),
  meanRankCorr: R.meanRho, variantsTried: R.variantsTried, rankCorrIStoOOS: Object.fromEntries(Object.entries(R.buckets).filter(([, b]) => b.rho != null).map(([f, b]) => [f, b.rho])),
  candidates: R.candidates.map((c) => ({ rule: c.rule, is: slim(c.is), oos: slim(c.oos), years: Object.fromEntries(Object.entries(c.years).map(([y, s]) => [y, slim(s)])), verdict: c.verdict })) };
fs.writeFileSync(path.join(OUTDIR, 'analysis.json'), JSON.stringify(res, null, 1));
console.log(md.join('\n'));
