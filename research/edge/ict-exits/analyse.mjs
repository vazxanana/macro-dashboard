// Aggregates sim.mjs output: per variant IS (2018-2023) / OOS (2024-Oct 2026) / per-year stats, net of costs, plus MFE/MAE.
// Usage: node analyse.mjs <dir with nas.json spx.json xau.json> <out result.json> [> table.txt]
import fs from 'node:fs'; import path from 'node:path';
const [dir, outFile] = process.argv.slice(2);
const data = ['nas', 'spx', 'xau'].map((m) => JSON.parse(fs.readFileSync(path.join(dir, `${m}.json`))));
const VN = Object.keys(data[0].variants);
let recs = data.flatMap((d) => d.recs).filter((r) => VN.every((v) => r.R[v] != null)).sort((a, b) => a.t - b.t);
const IS = (r) => r.y <= 2023, OOS = (r) => r.y >= 2024;
const net = (r, v, sized) => (r.R[v][0] - r.R[v][1]) * (sized ? r.size : 1);
function stats(rs, v, { gross = false, sized = false } = {}) {
  const x = rs.map((r) => (gross ? r.R[v][0] : net(r, v, sized)) );
  const n = x.length; if (!n) return { n: 0 };
  const sum = x.reduce((a, b) => a + b, 0), m = sum / n, sd = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, pk = 0, dd = 0, ls = 0, cur = 0; for (const y of x) { eq += y; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); if (y < 0) { cur += 1; ls = Math.max(ls, cur); } else cur = 0; }
  return { n, wr: +(x.filter((y) => y > 0).length / n).toFixed(3), exp: +m.toFixed(3), R: +sum.toFixed(1), maxDD: +dd.toFixed(1), streak: ls, t: +(m / (sd / Math.sqrt(n))).toFixed(2), rdd: +(sum / Math.max(dd, 1e-9)).toFixed(2) };
}
const years = [...new Set(recs.map((r) => r.y))].sort();
const groups = {
  A_all: (r) => r.aset, A_index: (r) => r.aset && r.mk !== 'xau', A_gold: (r) => r.aset && r.mk === 'xau', all_signals: () => true,
};
const res = { groups: {} };
const fmt = (s) => s.n ? `${String(s.n).padStart(4)} ${(s.wr * 100).toFixed(0).padStart(3)}% ${s.exp.toFixed(3).padStart(7)} ${s.R.toFixed(1).padStart(7)} ${s.maxDD.toFixed(1).padStart(6)} ${String(s.streak).padStart(3)} ${s.t.toFixed(2).padStart(6)}` : '   -';
for (const [g, f] of Object.entries(groups)) {
  const rs = recs.filter(f), G = (res.groups[g] = { variants: {} });
  console.log(`\n=== ${g} (n ${rs.length}) — net R per trade, 1R each; IS 2018-23 | OOS 2024-26`);
  console.log('variant'.padEnd(14), '   n  wr     exp       R     DD  ls      t |    n  wr     exp       R     DD  ls      t | OOS years +', '| years');
  for (const v of VN) {
    const is = stats(rs.filter(IS), v), oos = stats(rs.filter(OOS), v), yr = Object.fromEntries(years.map((y) => [y, stats(rs.filter((r) => r.y === y), v).R]));
    const isG = stats(rs.filter(IS), v, { gross: true }), oosG = stats(rs.filter(OOS), v, { gross: true });
    const oosPos = [2024, 2025, 2026].filter((y) => yr[y] > 0).length;
    // paired difference vs the live exit, per trade (same entries): mean and t
    const pd = (sub) => { const d = sub.map((r) => net(r, v) - net(r, 'base')), n = d.length, m = d.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, n - 1));
      return { d: +m.toFixed(3), t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : 0 }; };
    const pIS = pd(rs.filter(IS)), pOOS = pd(rs.filter(OOS));
    G.variants[v] = { is, oos, isGross: isG, oosGross: oosG, years: yr, oosYearsPos: oosPos, vsBase: { is: pIS, oos: pOOS } };
    console.log(v.padEnd(14), fmt(is), '|', fmt(oos), '|', `${oosPos}/3`, '|', years.map((y) => `${y % 100}:${yr[y].toFixed(0)}`).join(' '), `| dBase IS ${pIS.d}(t${pIS.t}) OOS ${pOOS.d}(t${pOOS.t})`);
  }
  // walk-forward pick on IS only
  const byExp = VN.slice().sort((a, b) => G.variants[b].is.exp - G.variants[a].is.exp)[0];
  const byRdd = VN.slice().sort((a, b) => G.variants[b].is.rdd - G.variants[a].is.rdd)[0];
  G.isPickExp = byExp; G.isPickRdd = byRdd;
  console.log(`IS pick by expectancy: ${byExp} -> OOS ${JSON.stringify(G.variants[byExp].oos)}`);
  console.log(`IS pick by R/maxDD:   ${byRdd} -> OOS ${JSON.stringify(G.variants[byRdd].oos)}`);
  // MFE / MAE (swing stop, 36 H1 candles)
  const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[Math.floor(p * (s.length - 1))].toFixed(2) : null; };
  const reach = (k) => +(rs.filter((r) => r.mfeB4Stop >= k).length / rs.length).toFixed(3);
  const win = rs.filter((r) => net(r, 'base') > 0), loss = rs.filter((r) => net(r, 'base') <= 0);
  G.mfemae = { n: rs.length, stoppedIn36: +(rs.filter((r) => r.stoppedIn36).length / rs.length).toFixed(3),
    mfeBeforeStop: { p25: q(rs.map((r) => r.mfeB4Stop), 0.25), p50: q(rs.map((r) => r.mfeB4Stop), 0.5), p75: q(rs.map((r) => r.mfeB4Stop), 0.75), p90: q(rs.map((r) => r.mfeB4Stop), 0.9) },
    reachBeforeStop: { '1R': reach(1), '1.5R': reach(1.5), '2R': reach(2), '3R': reach(3), '4R': reach(4) },
    mae36: { p25: q(rs.map((r) => r.mae36), 0.25), p50: q(rs.map((r) => r.mae36), 0.5), p75: q(rs.map((r) => r.mae36), 0.75) },
    baseWinners: { n: win.length, maeP50: q(win.map((r) => r.baseMae), 0.5), maeP10: q(win.map((r) => r.baseMae), 0.1), mfeP50: q(win.map((r) => r.baseMfe), 0.5) },
    baseLosers: { n: loss.length, mfeP50: q(loss.map((r) => r.baseMfe), 0.5), mfeP75: q(loss.map((r) => r.baseMfe), 0.75), share_reached1R: +(loss.filter((r) => r.baseMfe >= 1).length / Math.max(1, loss.length)).toFixed(3) },
    costR_p50: q(rs.map((r) => r.costR), 0.5),
    liqAvail: { pdh: +(rs.filter((r) => r.liq.pdh).length / rs.length).toFixed(3), sess: +(rs.filter((r) => r.liq.sess).length / rs.length).toFixed(3), dol: +(rs.filter((r) => r.liq.dol).length / rs.length).toFixed(3) } };
  console.log('MFE/MAE', JSON.stringify(G.mfemae));
  // live sizing (§25/§27) for base vs IS picks, A-setups only
  if (g.startsWith('A')) for (const v of new Set(['base', byExp, byRdd])) G.variants[v].sized = { is: stats(rs.filter(IS), v, { sized: true }), oos: stats(rs.filter(OOS), v, { sized: true }) };
  // exit mix of base
  const mix = {}; for (const r of rs) mix[r.R.base[2]] = (mix[r.R.base[2]] || 0) + 1; G.baseExitMix = mix;
}
res.variantsTried = VN.length; res.variantNames = VN; res.nRecs = recs.length;
fs.writeFileSync(outFile, JSON.stringify(res, null, 1));
