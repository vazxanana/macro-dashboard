// Edge research · scalp-filters: filters on the long-history Scalp signals (scalp-long.mjs output).
// Usage: node research/edge/scalp-filters/analyze.mjs <outDir with <SYM>.json> [resultJsonPath]
// Walk-forward: every rule is chosen on 2018-06 → 2023 (in-sample) only; 2024 → Oct 2026 (out-of-sample) is reported untouched.
// Results are net of one round-trip spread per trade (cost column); "stress" charges two spreads (spread + slippage).
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.argv[2], OUT = process.argv[3];
const LIVE_MKTS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'AUDUSD', 'USDCAD', 'USDCHF'];   // markets the live council trades (plus crypto)
const T = [];
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  for (const r of j.rows) {
    const t = Object.fromEntries(j.cols.map((c, i) => [c, r[i]]));
    t.m = j.sym; t.year = new Date(t.opened * 1000).getUTCFullYear(); t.net = t.R - t.cost; t.stress = t.R - 2 * t.cost; t.half = t.R - 0.5 * t.cost;
    t.rrb = t.rr < 1.5 ? '<1.5' : t.rr < 2.5 ? '1.5-2.5' : t.rr < 4 ? '2.5-4' : '4+';
    t.vol = t.atrPct == null ? 'n/a' : t.atrPct < 1 / 3 ? 'low' : t.atrPct < 2 / 3 ? 'mid' : 'high';
    T.push(t);
  }
}
T.sort((a, b) => a.opened - b.opened);
const IS = (t) => t.year <= 2023, OOS = (t) => t.year >= 2024;

function stats(a, key = 'net') {
  const n = a.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, streak: 0, t: 0 };
  let s = 0, w = 0, peak = 0, cum = 0, dd = 0, run = 0, streak = 0;
  for (const x of a) { const v = x[key]; s += v; if (v > 0) w++; cum += v; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); run = x.R < 0 ? run + 1 : 0; streak = Math.max(streak, run); }
  const e = s / n;
  // t-stat clustered by market-day (one move fires several signals; CR1 like the trader's btE)
  const cl = new Map(); for (const x of a) { const c = `${x.m}|${Math.floor(x.opened / 86400)}`; cl.set(c, (cl.get(c) || 0) + (x[key] - e)); }
  const g = cl.size; let ss = 0; for (const u of cl.values()) ss += u * u;
  const se = g > 1 ? Math.sqrt(ss * g / (g - 1)) / n : Infinity;
  return { n, wr: +(w / n).toFixed(3), exp: +e.toFixed(3), R: +s.toFixed(1), maxDD: +dd.toFixed(1), streak, t: +(se > 0 && isFinite(se) ? e / se : 0).toFixed(2) };
}
const fmt = (s) => s.n ? `n ${s.n}, wr ${(s.wr * 100).toFixed(0)}%, ${s.exp >= 0 ? '+' : ''}${s.exp.toFixed(3)}R/t, ${s.R >= 0 ? '+' : ''}${s.R}R, DD ${s.maxDD}, streak ${s.streak}, t ${s.t}` : 'n 0';
const years = (a) => Object.fromEntries([...new Set(a.map((t) => t.year))].sort().map((y) => [y, stats(a.filter((t) => t.year === y))]));
const yrTxt = (a) => Object.entries(years(a)).map(([y, s]) => `${y}: ${s.n ? (s.exp >= 0 ? '+' : '') + s.exp.toFixed(2) : '-'} (${s.n})`).join(' · ');
const block = (a) => ({ is: stats(a.filter(IS)), oos: stats(a.filter(OOS)), isGross: stats(a.filter(IS), 'R'), oosGross: stats(a.filter(OOS), 'R'), oosStress: stats(a.filter(OOS), 'stress'), years: Object.fromEntries(Object.entries(years(a)).map(([y, s]) => [y, { n: s.n, exp: s.exp, R: s.R }])) });

// ─── universes ───
const live = (t) => t.minRR === 'pass' && t.reentry === 'no';   // what the live Trader would take before setup filters (min reward:risk 1.2, no re-entry after a loss)
const RAW = T.filter(live);
const BASE_F = (t) => t.d1 === 'against' && t.session !== 'asia' && t.session !== 'overlap' && t.m !== 'AUDUSD' && LIVE_MKTS.includes(t.m);
const BASE = RAW.filter(BASE_F);
const L = [];
const say = (...x) => { const s = x.join(' '); L.push(s); console.log(s); };

say('# Scalp (M15 → M1), 2018-06 → 2026-10, net of spread');
say(`signals closed: ${T.length}; after min RR 1.2 and the re-entry block: ${RAW.length}`);
say('\n## Baseline = owner live rule (against D1, not Asia/overlap, live markets minus AUD/USD)');
const bb = block(BASE);
say(`IS  ${fmt(bb.is)}  | gross ${bb.isGross.exp}`);
say(`OOS ${fmt(bb.oos)} | gross ${bb.oosGross.exp} | stress ${bb.oosStress.exp}`);
say('years: ' + yrTxt(BASE));
say(`OOS at half the spread (raw-spread account): ${fmt(stats(BASE.filter(OOS), 'half'))}`);
{ const rb = T.filter((t) => t.minRR === 'pass' && BASE_F(t)); for (const v of ['no', 'yes']) { const a = rb.filter((t) => t.reentry === v); say(`re-entry within 3 h of a same-side loss = ${v}: IS ${fmt(stats(a.filter(IS)))} | OOS ${fmt(stats(a.filter(OOS)))}`); } }
say('baseline by market (OOS gross | net): ' + [...new Set(BASE.map((t) => t.m))].map((m) => { const a = BASE.filter((t) => t.m === m && OOS(t)); return `${m} ${stats(a, 'R').exp} | ${stats(a).exp}`; }).join(' · '));
{ // the live rule came from one 30-day replay (+0.33R a trade over 500, against D1, outside Asia): how often does a calendar month look that good?
  const U = RAW.filter((t) => t.d1 === 'against' && t.session !== 'asia' && LIVE_MKTS.includes(t.m)), mo = {};
  for (const t of U) { const k = new Date(t.opened * 1000).toISOString().slice(0, 7); (mo[k] = mo[k] || []).push(t); }
  const ms = Object.entries(mo).map(([k, a]) => [k, stats(a)]), good = ms.filter(([, s]) => s.exp >= 0.3), pos = ms.filter(([, s]) => s.exp > 0);
  say(`months of 'against D1, outside Asia, live markets': ${ms.length}; positive ${pos.length}; ≥ +0.30R a trade ${good.length} (${good.map(([k, s]) => `${k} ${s.exp} n${s.n}`).join(', ')}); last 3: ${ms.slice(-3).map(([k, s]) => `${k} ${s.exp} n${s.n}`).join(', ')}`); }
say('\n## Everything on live markets (no setup filters)');
const ALL_LIVE = RAW.filter((t) => LIVE_MKTS.includes(t.m)), ba = block(ALL_LIVE);
say(`IS  ${fmt(ba.is)} | gross ${ba.isGross.exp}`); say(`OOS ${fmt(ba.oos)} | gross ${ba.oosGross.exp}`); say('years: ' + yrTxt(ALL_LIVE));

// ─── Q1: is "against D1" robust? ───
say('\n## Against vs with D1 (all markets, no other filter) and inside the baseline\'s other rules');
for (const [nm, U] of [['all signals, all markets', RAW], ['live markets', ALL_LIVE], ['baseline rules except D1', RAW.filter((t) => t.session !== 'asia' && t.session !== 'overlap' && t.m !== 'AUDUSD' && LIVE_MKTS.includes(t.m))]]) {
  for (const d of ['against', 'with']) { const a = U.filter((t) => t.d1 === d), b = block(a); say(`${nm} · D1 ${d}: IS ${fmt(b.is)} | OOS ${fmt(b.oos)}`); say(`   years: ${yrTxt(a)}`); }
}
say('\nD1 against − with, by market (all sessions), net R/t IS | OOS:');
const MKTS = [...new Set(T.map((t) => t.m))].sort();
for (const m of MKTS) { const a = RAW.filter((t) => t.m === m), f = (d, p) => stats(a.filter((t) => t.d1 === d && p(t))); say(`  ${m}: against ${f('against', IS).exp} (${f('against', IS).n}) | ${f('against', OOS).exp} (${f('against', OOS).n}) · with ${f('with', IS).exp} | ${f('with', OOS).exp}`); }

// ─── Q2: markets ───
say('\n## By market under the baseline rules (against D1, not Asia/overlap), every market');
const marketRows = {};
for (const m of MKTS) { const a = RAW.filter((t) => t.m === m && t.d1 === 'against' && t.session !== 'asia' && t.session !== 'overlap'), b = block(a); marketRows[m] = b;
  say(`${m}: IS ${fmt(b.is)} | OOS ${fmt(b.oos)} | OOS stress ${b.oosStress.exp}`); say(`   years: ${yrTxt(a)}`); }

// ─── Q3: single and pairwise conditions on top of the baseline, chosen on IS only ───
const DIMS = {
  d1: ['with', 'against'], h4: ['with', 'against', 'none'], h1: ['with', 'against', 'none'], struct: ['main', 'internal'], cf: ['choch', 'bo'], choch: ['yes', 'no'],
  m15c: ['yes', 'no'], session: ['london', 'newyork', 'late', 'asia', 'overlap'], m: MKTS, rrb: ['<1.5', '1.5-2.5', '2.5-4', '4+'], vol: ['low', 'mid', 'high'], side: ['buy', 'sell'], mode: ['limit', 'market'],
};
// single conditions are tested on the baseline (d1/session/market levels replace the baseline's own rule for that dimension)
const baseWithout = (dim) => RAW.filter((t) => (dim === 'd1' || t.d1 === 'against') && (dim === 'session' || (t.session !== 'asia' && t.session !== 'overlap')) && (dim === 'm' || (t.m !== 'AUDUSD' && LIVE_MKTS.includes(t.m))));
const conds = []; for (const [d, vs] of Object.entries(DIMS)) for (const v of vs) conds.push([d, v]);
let variants = 0; const singles = [];
say('\n## Single conditions on the baseline (IS | OOS)');
for (const [d, v] of conds) {
  variants++;
  const a = baseWithout(d).filter((t) => t[d] === v), b = block(a);
  singles.push({ rule: `${d}=${v}`, ...b });
  say(`${d}=${v}: IS ${fmt(b.is)} | OOS ${fmt(b.oos)}`);
}
const pairs = [];
for (let i = 0; i < conds.length; i++) for (let j = i + 1; j < conds.length; j++) {
  const [d1, v1] = conds[i], [d2, v2] = conds[j]; if (d1 === d2) continue;
  variants++;
  const U = RAW.filter((t) => (d1 === 'd1' || d2 === 'd1' || t.d1 === 'against') && (d1 === 'session' || d2 === 'session' || (t.session !== 'asia' && t.session !== 'overlap')) && (d1 === 'm' || d2 === 'm' || (t.m !== 'AUDUSD' && LIVE_MKTS.includes(t.m))));
  const a = U.filter((t) => t[d1] === v1 && t[d2] === v2), is = stats(a.filter(IS));
  pairs.push({ rule: `${d1}=${v1} & ${d2}=${v2}`, a, is });
}
// selection on IS only: n ≥ 300 and clustered t ≥ 2.5, best IS expectancy first; then look at OOS
const pick = (arr) => arr.filter((x) => x.is.n >= 300 && x.is.t >= 2.5).sort((p, q) => q.is.exp - p.is.exp);
// strict pick (n ≥ 300, t ≥ 2.5); when nothing passes, the relaxed pick: the 10 best IS expectancies with IS n ≥ 300, whatever their t
const strict = pick(singles).length + pick(pairs).length > 0;
const relax = (arr) => arr.filter((x) => x.is.n >= 300).sort((p, q) => q.is.exp - p.is.exp);
const selS = (strict ? pick(singles) : relax(singles).slice(0, 5)), selP = (strict ? pick(pairs) : relax(pairs)).slice(0, strict ? 15 : 10).map((x) => ({ rule: x.rule, ...block(x.a) }));
const verdict = (c) => { const oy = Object.entries(c.years).filter(([y]) => +y >= 2024); const pos = oy.filter(([, s]) => s.n && s.exp > 0).length;
  return c.oos.n >= 100 && c.oos.exp > 0 && c.oos.exp > bb.oos.exp && pos >= Math.ceil(oy.length * 2 / 3) ? 'CANDIDATE' : 'fail'; };
say(strict ? `\n## Selected on IS (n ≥ 300, t ≥ 2.5) — singles ${selS.length}, pairs top ${selP.length} of ${pick(pairs).length}` : `\n## Nothing passes IS n ≥ 300 & t ≥ 2.5. Relaxed IS-only pick: best 5 singles and 10 pairs by IS expectancy (n ≥ 300)`);
const cands = [];
for (const c of selS.concat(selP)) { const v = verdict(c); cands.push({ rule: c.rule, is: c.is, oos: c.oos, oosStress: c.oosStress, years: c.years, verdict: v });
  say(`${c.rule}: IS ${fmt(c.is)} | OOS ${fmt(c.oos)} | stress ${c.oosStress.exp} → ${v}`); say(`   years: ${Object.entries(c.years).map(([y, s]) => `${y} ${s.exp} (${s.n})`).join(' · ')}`); }
// also: best pairs by OOS for information (NOT a selection: hindsight)
say('\n## For information only (hindsight): best 8 pairs by OOS expectancy with OOS n ≥ 150');
for (const x of pairs.map((p) => ({ rule: p.rule, is: p.is, oos: stats(p.a.filter(OOS)) })).filter((x) => x.oos.n >= 150).sort((p, q) => q.oos.exp - p.oos.exp).slice(0, 8)) say(`${x.rule}: IS ${fmt(x.is)} | OOS ${fmt(x.oos)}`);
say(`\nvariants tried: ${variants} (${singles.length} single + ${pairs.length} pairs)`);

if (OUT) {
  const S = (s) => ({ n: s.n, wr: s.wr, exp: s.exp, R: s.R, maxDD: s.maxDD, t: s.t });
  fs.writeFileSync(OUT, JSON.stringify({
    topic: 'scalp-filters', system: 'MERIDIAN council Scalp (M15 → M1), council/engine.mjs buildSetup, 2018-06 → 2026-10 M1 HistData',
    baseline: { rule: 'against D1, not asia/overlap, live markets minus AUD/USD, min RR 1.2, re-entry block', is: S(bb.is), oos: S(bb.oos), oosGross: S(bb.oosGross), oosStress: S(bb.oosStress), years: bb.years },
    allLiveMarkets: { is: S(ba.is), oos: S(ba.oos), years: ba.years },
    d1: Object.fromEntries(['against', 'with'].map((d) => [d, (() => { const b = block(ALL_LIVE.filter((t) => t.d1 === d)); return { is: S(b.is), oos: S(b.oos), years: b.years }; })()])),
    markets: Object.fromEntries(Object.entries(marketRows).map(([m, b]) => [m, { is: S(b.is), oos: S(b.oos), oosStress: S(b.oosStress), years: b.years }])),
    singles: singles.map((c) => ({ rule: c.rule, is: S(c.is), oos: S(c.oos) })),
    candidates: cands.map((c) => ({ rule: c.rule, is: S(c.is), oos: S(c.oos), oosStress: S(c.oosStress), years: c.years, verdict: c.verdict })),
    variantsTried: variants,
    notes: 'IS = 2018-06..2023, OOS = 2024..2026-10. Net = R minus one round-trip spread (forex 1 pip, JPY 1 pip, gold $0.30, silver $0.025, NAS100 1.5, SPX 0.5); stress = two spreads. Selection on IS only (n>=300, clustered t>=2.5).',
  }, null, 1));
}
fs.writeFileSync(path.join(DIR, 'analysis.txt'), L.join('\n'));
