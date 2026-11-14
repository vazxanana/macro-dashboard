// Multiple testing across the studies of 13-14 Nov 2026 (PREREGISTRATION.md, pushed alone first).
// Reads the checked-in inputs.json (built once by build-inputs.mjs from each study's branch) and writes result.json and
// RESULT.md. Offline, deterministic: `node research/edge/multiple-testing-1314nov/run.mjs`.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- pure statistics ----------
// Standard normal CDF, Cody-style erfc via a continued fraction-free rational approximation (W. J. Cody 1969 coefficients
// are long; this uses the complementary error function series of Numerical Recipes `erfcc`, relative error < 1.2e-7).
export function erfc(x) {
  const z = Math.abs(x); const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806
    + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
export const Phi = (x) => 0.5 * erfc(-x / Math.SQRT2);
export const pOneSided = (t) => 1 - Phi(t); // H1: the edge is positive
// Inverse of Phi by bisection (only used to report the t a threshold needs); exact to 1e-10 in x.
export function PhiInv(p) {
  let lo = -40, hi = 40;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
const tOfP = (p) => (p >= 1 ? -Infinity : p <= 0 ? Infinity : -PhiInv(p)); // t with 1 - Phi(t) = p, via symmetry

// Holm step-down adjusted p (monotone, capped at 1), in the input order.
export function holm(ps) {
  const m = ps.length; const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const adj = new Array(m); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (m - k) * p)); adj[i] = run; });
  return adj;
}
// Benjamini-Hochberg step-up q-values (monotone), in the input order. `c` = 1 for BH, sum 1/i for Benjamini-Yekutieli.
export function bh(ps, c = 1) {
  const m = ps.length; const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const q = new Array(m); let run = 1;
  for (let k = m - 1; k >= 0; k--) { const [p, i] = idx[k]; run = Math.min(run, Math.min(1, (p * m * c) / (k + 1))); q[i] = run; }
  return q;
}
export const by = (ps) => { let c = 0; for (let i = 1; i <= ps.length; i++) c += 1 / i; return bh(ps, c); };
// Chi-square survival function for an EVEN number of degrees of freedom (Fisher's method always has 2k).
export function chi2SfEven(x, df) {
  if (df % 2) throw new Error('even df only');
  let term = 1, sum = 1; for (let k = 1; k < df / 2; k++) { term *= x / 2 / k; sum += term; }
  return Math.exp(-x / 2) * sum;
}
export function fisher(ps) { const x = -2 * ps.reduce((a, p) => a + Math.log(p), 0); const df = 2 * ps.length; return { x, df, p: chi2SfEven(x, df) }; }
// Equal-tailed 95 % range of a Poisson count with mean mu (smallest a with P(X <= a) >= 0.025, b with P(X <= b) >= 0.975).
export function poisson95(mu) {
  let pmf = Math.exp(-mu), cdf = pmf, k = 0, lo = null;
  while (true) { if (lo == null && cdf >= 0.025) lo = k; if (cdf >= 0.975) return [lo, k]; k++; pmf *= mu / k; cdf += pmf; }
}

// One test -> { p, t, src }: p from the stored decisive t (normal, one-sided) or, where only p is stored, that p.
export function testP(x) {
  if (typeof x.t === 'number') return { p: pOneSided(x.t), t: x.t, pFrom: 't (normal, one-sided)' };
  if (typeof x.p === 'number') return { p: x.p, t: tOfP(x.p), pFrom: 'stored one-sided p (t is its normal equivalent)' };
  return null;
}

// The family analysis on a list of { id, p, t }.
export function family(tests, alpha = 0.05) {
  const N = tests.length; const ps = tests.map((x) => x.p);
  const h = holm(ps), q = bh(ps), qy = by(ps);
  const nullT2 = 1 - Phi(2); const expected = N * nullT2;
  const rows = tests.map((x, i) => ({ ...x, holm: h[i], bh: q[i], by: qy[i] }));
  const sorted = [...rows].sort((a, b) => a.p - b.p);
  return {
    N, alpha,
    bonferroni: { p: alpha / N, t: tOfP(alpha / N) },
    t2: { observed: rows.filter((x) => x.t >= 2).length, expected, range95: poisson95(expected), share: nullT2 },
    tNeg2: { observed: rows.filter((x) => x.t <= -2).length, expected },
    pBelow05: { observed: rows.filter((x) => x.p < 0.05).length, expected: N * 0.05 },
    holmPass: rows.filter((x) => x.holm <= alpha).map((x) => x.id),
    bh05: rows.filter((x) => x.bh <= 0.05).map((x) => x.id),
    bh10: rows.filter((x) => x.bh <= 0.10).map((x) => x.id),
    by10: rows.filter((x) => x.by <= 0.10).map((x) => x.id),
    smallest: sorted.slice(0, 12).map((x) => ({ id: x.id, t: r4(x.t), p: r6(x.p), holm: r4(x.holm), bh: r4(x.bh), by: r4(x.by), n: x.n })),
    rows,
  };
}
const r4 = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : v);
const r6 = (v) => Math.round(v * 1e6) / 1e6;

// ---------- the run ----------
export function analyse(inputs) {
  const all = [], unparsed = [], excluded = [];
  for (const r of inputs.rows) {
    if (r.role === 'excluded') { excluded.push({ pr: r.pr, branch: r.branch, why: r.why }); continue; }
    for (const x of r.tests) {
      const tp = testP(x);
      const id = `#${r.pr} ${r.topic}: ${x.test}`;
      if (!tp) { unparsed.push({ id, why: x.why }); continue; }
      all.push({ id, pr: r.pr, topic: r.topic, role: r.role, test: x.test, n: x.n, ...tp });
    }
  }
  const fam = all.filter((x) => x.role === 'family');
  const withRep = all;
  const F = family(fam), S = family(withRep);
  const GID = '#878 gotobi: T2';
  const g = F.rows.find((x) => x.id === GID);
  const gS = S.rows.find((x) => x.id === GID);
  const rep = (id) => all.find((x) => x.id === id);
  const usdjpy0509 = rep('#889 gotobi-replicate: R2 USD/JPY 2005-09');
  const hist = rep('#894 gotobi-feed: HistData USD/JPY');
  const crosses = rep('#889 gotobi-replicate: R1 crosses pooled');
  const fPrimary = fisher([g.p, usdjpy0509.p, hist.p]);
  const fNew = fisher([g.p, usdjpy0509.p]);
  // Fisher's p, then read against the family: the original decisive p replaced by the combined p (a reading, not the test).
  const rankAt = (p) => F.rows.filter((x) => x.p <= p).length;
  // Post hoc (not pre-registered), shown only: one p per study = its smallest within-study Bonferroni p (= its smallest
  // Holm-adjusted p), so a study with 32 cells counts once; then Holm and BH across the studies.
  const byStudy = new Map();
  for (const x of fam) { const a = byStudy.get(x.pr) || []; a.push(x); byStudy.set(x.pr, a); }
  const per = [...byStudy.entries()].map(([pr, xs]) => { const k = xs.length; const best = xs.reduce((a, b) => (b.p < a.p ? b : a)); return { id: `#${pr} ${best.topic}`, best: best.test, k, p: Math.min(1, k * best.p), t: tOfP(Math.min(1, k * best.p)), n: best.n }; });
  const P = family(per);
  const gp = P.rows.find((x) => x.id === '#878 gotobi');
  return {
    built: inputs.built,
    verdict: `no decisive test of the day survives a correction across all ${F.N} (Holm ${F.holmPass.length}, BH q 0.10 ${F.bh10.length}); gotobi T2: (a) BH q ${r4(g.bh)} ${g.bh <= 0.1 ? "passes" : "fails"} q 0.10, (b) Holm ${r4(g.holm)} ${g.holm <= 0.05 ? "passes" : "fails"}; with its frozen USD/JPY 2005-09 replication, Fisher p ${fisher([g.p, usdjpy0509.p]).p.toExponential(1)} (independence assumed)`,
    studies: inputs.rows.length,
    excluded, unparsed,
    family: strip(F), withReplications: strip(S),
    perStudyPostHoc: { note: 'post hoc, not pre-registered: one p per study (its smallest p x its number of tests)', S: P.N, holmPass: P.holmPass, bh10: P.bh10, gotobi: { p: r6(gp.p), holm: r4(gp.holm), bh: r4(gp.bh) }, smallest: P.smallest.slice(0, 5) },
    gotobi: {
      test: GID, t: g.t, n: g.n, p: r6(g.p), holmWithin4: 0.0123,
      a_bh10: { q: r4(g.bh), pass: g.bh <= 0.10, rank: rankAt(g.p), N: F.N },
      b_holm: { pAdj: r4(g.holm), pass: g.holm <= 0.05, bonferroniP: r6(F.bonferroni.p), bonferroniT: r4(F.bonferroni.t) },
      withReplications: { bh: r4(gS.bh), holm: r4(gS.holm), N: S.N },
      fisher: {
        set: [{ id: GID, t: g.t, p: r6(g.p) }, { id: usdjpy0509.id, t: usdjpy0509.t, n: usdjpy0509.n, p: r6(usdjpy0509.p) }, { id: hist.id, t: hist.t, n: hist.n, p: r6(hist.p) }],
        primary: { x: r4(fPrimary.x), df: fPrimary.df, p: fPrimary.p, z: r4(tOfP(fPrimary.p)) },
        newDaysOnly: { x: r4(fNew.x), df: fNew.df, p: fNew.p, z: r4(tOfP(fNew.p)) },
        leftOut: { id: crosses.id, t: crosses.t, why: 'the crosses correlate 0.5-0.8 with the USD/JPY leg on the same days' },
        caveat: 'The HistData run covers the same 2018-26 days as the OANDA decisive window (per-trade correlation 0.997): it confirms the feed, not new history, so the three-p Fisher overstates the evidence. The two-p version (original + USD/JPY 2005-09) is the one with new days.',
        vsBonferroni: { primaryBelow: fPrimary.p < F.bonferroni.p, newDaysBelow: fNew.p < F.bonferroni.p },
      },
    },
  };
}
const strip = (F) => ({ ...F, rows: F.rows.map((x) => ({ id: x.id, t: r4(x.t), p: r6(x.p), holm: r4(x.holm), bh: r4(x.bh), by: r4(x.by), n: x.n, pFrom: x.pFrom })) });

const f2 = (v, d = 2) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
const fp = (p) => (p < 1e-4 ? p.toExponential(2) : p.toFixed(4));
export function report(R) {
  const F = R.family, S = R.withReplications, G = R.gotobi;
  const L = [];
  L.push('# Result: multiple testing across the studies of 13-14 Nov 2026 (14 Nov 2026)', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push(`Across all **N = ${F.N}** decisive tests of the original studies (one-sided p, edge positive), **${F.t2.observed}** had t ≥ 2 against **${F.t2.expected.toFixed(1)}** expected under the null (Poisson 95 % range ${F.t2.range95[0]}-${F.t2.range95[1]}). ` +
    `Bonferroni needs p < ${fp(F.bonferroni.p)} (t ≥ ${F.bonferroni.t.toFixed(2)}). ` +
    `**Holm across all: ${F.holmPass.length} survive${F.holmPass.length ? ' (' + F.holmPass.join(', ') + ')' : ''}. BH at q 0.05: ${F.bh05.length}; at q 0.10: ${F.bh10.length}${F.bh10.length ? ' (' + F.bh10.join(', ') + ')' : ''}.**`, '');
  L.push(`**Gotobi T2** (#878, t ${G.t}, one-sided p ${fp(G.p)}): (a) BH q across all ${G.a_bh10.N} = **${G.a_bh10.q.toFixed(4)}**: ${G.a_bh10.pass ? '**survives** q 0.10' : '**does not survive** q 0.10'}; ` +
    `(b) Holm across all = **${G.b_holm.pAdj.toFixed(4)}**: ${G.b_holm.pass ? '**survives**' : '**does not survive**'} at 0.05. ` +
    `(c) Fisher on the original + USD/JPY 2005-09 + HistData feed: χ² ${G.fisher.primary.x.toFixed(2)} on ${G.fisher.primary.df} df, p **${fp(G.fisher.primary.p)}** (z ${G.fisher.primary.z.toFixed(2)}); ` +
    `on the original + USD/JPY 2005-09 only (the one confirmation on new days): χ² ${G.fisher.newDaysOnly.x.toFixed(2)} on ${G.fisher.newDaysOnly.df} df, p **${fp(G.fisher.newDaysOnly.p)}** (z ${G.fisher.newDaysOnly.z.toFixed(2)}). ` +
    `Both are under the family's Bonferroni line (${fp(F.bonferroni.p)}): ${G.fisher.vsBonferroni.primaryBelow && G.fisher.vsBonferroni.newDaysBelow ? 'yes' : 'not both'}.`, '');
  L.push('Paper research only: nothing live, no study, rule or stored figure changed. Pre-registration: `PREREGISTRATION.md` (pushed alone first). Inputs: `inputs.json` (built by `build-inputs.mjs` from each study\'s own branch); numbers: `result.json`.', '');
  L.push('## Reading', '');
  L.push(`- On their own decisive windows the day's tests look like chance. ${F.t2.observed} results at t ≥ 2 against ${F.t2.expected.toFixed(1)} expected is ${F.t2.observed > F.t2.range95[1] ? 'above' : 'inside'} the chance range; ${F.tNeg2.observed} tests sat at t ≤ −2 (costs push most rules below zero, so the null "no edge after costs" is generous to the rules and the count of t ≥ 2 is if anything optimistic for them). ${F.pBelow05.observed} of ${F.N} p's are under 0.05 against ${F.pBelow05.expected.toFixed(1)} expected.`);
  L.push(`- ${G.a_bh10.pass ? 'The gotobi T2 test is the only family member that keeps a false-discovery q under 0.10' : 'Even the gotobi T2 test does not keep a false-discovery q under 0.10'} and ${G.b_holm.pass ? 'it survives' : 'it does not survive'} Holm over all ${F.N}: on the 2016-26 window alone it cannot be told apart from the best of ${F.N} draws. What separates it is the frozen replication on days the original never saw (USD/JPY 2005-09, t ${G.fisher.set[1].t}), which no other study of the day has.`);
  L.push(`- Fisher's combined p assumes independent p's. USD/JPY 2005-09 is new history; the HistData run is the same 2018-26 days on another feed (per-trade correlation 0.997), so it mostly re-counts the original: read the two-p figure (${fp(G.fisher.newDaysOnly.p)}) as the honest one. The crosses (t ${G.fisher.leftOut.t}) are left out (${G.fisher.leftOut.why}).`);
  L.push('- What this does not settle: the cost. At twice the assumed spread the gotobi edge is about zero on every feed (#878, #893, #894); the measured broker spread at 00:55 / 06:00 UTC (the yen spread log, #897) decides whether it is tradable. Combined evidence for a gross effect is not a net edge.', '');
  L.push('## The twelve smallest p in the family', '', '| Test | n | t | one-sided p | Holm over all | BH q | BY q |', '|---|---|---|---|---|---|---|');
  for (const x of F.smallest) L.push(`| ${x.id} | ${x.n ?? '—'} | ${f2(x.t)} | ${fp(x.p)} | ${x.holm.toFixed(4)} | ${x.bh.toFixed(4)} | ${x.by.toFixed(4)} |`);
  L.push('', '## Sensitivity: the frozen replications included', '');
  L.push(`N = ${S.N} (the family plus ${S.N - F.N} replication tests: #844, #862, #873, #889 x2, #894). t ≥ 2: ${S.t2.observed} (expected ${S.t2.expected.toFixed(1)}). Holm across all: ${S.holmPass.length ? S.holmPass.join(', ') : 'none'}. BH q 0.05: ${S.bh05.length ? S.bh05.join(', ') : 'none'}; q 0.10: ${S.bh10.length ? S.bh10.join(', ') : 'none'}. Gotobi T2 in this set: BH q ${G.withReplications.bh.toFixed(4)}, Holm ${G.withReplications.holm.toFixed(4)}. (Replications of a passed rule are not exchangeable with new hypotheses; this is shown, not judged.)`, '');
  const PS = R.perStudyPostHoc;
  L.push('## Post hoc, not pre-registered: one p per study', '');
  L.push(`Two studies carry 63 of the ${F.N} tests (#815 cycle-gate 31, #821 shadow-best-raw 32). Counting each study once (its smallest p times its number of tests), S = ${PS.S} studies: gotobi p ${fp(PS.gotobi.p)}, Holm across studies ${PS.gotobi.holm.toFixed(4)}, BH q ${PS.gotobi.bh.toFixed(4)}. Holm passes: ${PS.holmPass.length ? PS.holmPass.join(', ') : 'none'}; BH q 0.10: ${PS.bh10.length ? PS.bh10.join(', ') : 'none'}. Shown only; it does not change the pre-registered answer.`, '');
  L.push('## What went in', '');
  L.push(`- ${R.studies} rows of the research-day table (PR #815-#899). Left out: ${R.excluded.map((e) => `#${e.pr} ${e.branch} (${e.why})`).join('; ')}. gold-carry, index-futures-cost and the audit fixes are not rows of the table.`);
  L.push(`- Not parsed (no t or p stored): ${R.unparsed.length ? R.unparsed.map((u) => `${u.id} (${u.why})`).join('; ') : 'none'}.`);
  L.push('- Each study\'s decisive tests as its pre-registration judged them (its Holm family, or its single primary test); variants, descriptive splits, replication windows and placebos are not in. p = 1 − Φ(t) from the stored decisive t; where a study stored only a one-sided p or a bootstrap P (#824, #825 T2-T3, #838, #839, #841, #855, #856, #860) that p, or 1 − P. Four studies\' figures come from RESULT.md or the verdict line (#839, #874, #879, #886); each row of `inputs.json` names its source path.');
  L.push('- Tests within a study are correlated (follow / fade pairs negatively, overlapping markets positively). BH is valid under positive dependence only, so Benjamini-Yekutieli is shown beside it; the Poisson range for the count of t ≥ 2 assumes independence and is an approximation.', '');
  L.push('Tests: `tests/multiple-testing-1314nov.test.mjs`.', '');
  return L.join('\n');
}

const HERE = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const inputs = JSON.parse(readFileSync(join(HERE, 'inputs.json'), 'utf8'));
  const R = analyse(inputs);
  writeFileSync(join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  writeFileSync(join(HERE, 'RESULT.md'), report(R));
  console.log(report(R).split('\n').slice(0, 6).join('\n'));
}
