// Edge research (ict-filters): filter study on the driver's simulated iFVG signals. Walk-forward: every rule is judged on
// 2018-2023 (in-sample) only; 2024 - Oct 2026 (out-of-sample) is reported untouched. Usage:
//   node research/edge/ict-filters/analyse.mjs <trades.json> <out dir>
import fs from 'node:fs';
import path from 'node:path';

const IN = process.argv[2], OUTDIR = process.argv[3] || '.';
const T = JSON.parse(fs.readFileSync(IN, 'utf8')).trades;
// costs per round trip in price: 1 tick spread + 1 tick slippage (index futures 0.25, gold 0.10); STRESS doubles it
const COST = { nq: 0.5, es: 0.5, gc: 0.2 }, STRESS = +(process.env.STRESS || 1);
for (const t of T) { t.Rg = t.R; t.Rn = +(t.R - (STRESS * COST[t.market]) / t.r0).toFixed(4); }
const IS = (t) => t.x.year <= 2023, OOS = (t) => t.x.year >= 2024;

// one open trade per market among the selected signals (the tracker's rule, applied after the filter)
function take(sel) {
  const busy = {}, out = [];
  for (const t of T.filter(sel).sort((a, b) => a.signalAt - b.signalAt)) { if (t.signalAt < (busy[t.market] || 0)) continue; out.push(t); busy[t.market] = t.closed; }
  return out;
}
// exact replay rule (A-setups blocked only by A-setups, others by anything), sized R
function replayRule() {
  const out = [], bA = {}, bAll = {};
  for (const t of [...T].sort((a, b) => a.signalAt - b.signalAt)) { const a = t.aset; if (t.signalAt < (a ? bA[t.market] || 0 : bAll[t.market] || 0)) continue; out.push(t); bAll[t.market] = Math.max(bAll[t.market] || 0, t.closed); if (a) bA[t.market] = t.closed; }
  return out;
}
export function stats(A, k = 'Rn') {
  const r = A.map((t) => t[k]), n = r.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, streak: 0, t: null };
  const sum = r.reduce((a, x) => a + x, 0), m = sum / n, sd = Math.sqrt(r.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, pk = 0, dd = 0, st = 0, ws = 0; for (const x of r) { eq += x; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); st = x < 0 ? st + 1 : 0; ws = Math.max(ws, st); }
  return { n, wr: +(r.filter((x) => x > 0).length / n).toFixed(3), exp: +m.toFixed(3), R: +sum.toFixed(1), maxDD: +dd.toFixed(1), streak: ws, t: +(sd ? (m / sd) * Math.sqrt(n) : 0).toFixed(2) };
}
const welch = (a, b) => { const f = (A) => { const r = A.map((t) => t.Rn), m = r.reduce((x, y) => x + y, 0) / r.length; return [m, r.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, r.length - 1), r.length]; };
  if (a.length < 5 || b.length < 5) return null; const [m1, v1, n1] = f(a), [m2, v2, n2] = f(b); return +((m1 - m2) / Math.sqrt(v1 / n1 + v2 / n2)).toFixed(2); };
const years = (A) => { const y = {}; for (const t of A) (y[t.x.year] ||= []).push(t); return Object.fromEntries(Object.entries(y).map(([k, v]) => [k, stats(v)])); };

// populations: the live A-setup rule (index rule + gold rule, per-unit R) and every graded signal
const POP = { A: (t) => t.aset, ALL: () => true };
const sideP = (t) => (t.side === 'buy' ? 1 : -1);
const F = {
  'drop NY PM': (t) => t.feat.session !== 'NY PM',
  'drop London': (t) => t.feat.session !== 'London',
  'drop Asia': (t) => t.feat.session !== 'Asia',
  'drop Close (16-18 ET)': (t) => t.feat.session !== 'Close',
  'NY AM only': (t) => t.feat.session === 'NY AM',
  'grade >= 8 (A grades only)': (t) => t.grade.total >= 8,
  'grade >= 5 (A+B)': (t) => t.grade.total >= 5,
  'grade >= 7': (t) => t.grade.total >= 7,
  'gold only': (t) => t.market === 'gc',
  'indices only': (t) => t.market !== 'gc',
  'NQ only': (t) => t.market === 'nq',
  'PD: right half (buy discount / sell premium)': (t) => t.feat.zone === 'discount',
  'PD: deep (side pd < 0.3)': (t) => t.feat.pd != null && (sideP(t) > 0 ? t.feat.pd < 0.3 : t.feat.pd > 0.7),
  'D1 bias with': (t) => t.feat.bias === 'with',
  'D1 bias against': (t) => t.feat.bias === 'against',
  'H4 bias with': (t) => t.x.h4 === 'with',
  'H4 bias against': (t) => t.x.h4 === 'against',
  'D1 candle-closure bias aligned': (t) => t.feat.cc === sideP(t),
  'D1+H4 both with': (t) => t.feat.bias === 'with' && t.x.h4 === 'with',
  'hour 8-11 ET only': (t) => t.feat.etHour >= 8 && t.feat.etHour < 12,
  'drop hours 12-15 ET': (t) => !(t.feat.etHour >= 12 && t.feat.etHour < 16),
  'drop Monday': (t) => t.x.dow !== 1,
  'drop Friday': (t) => t.x.dow !== 5,
  'Tue-Thu only': (t) => t.x.dow >= 2 && t.x.dow <= 4,
  'sweep at NDOG/NWOG': (t) => t.x.ndog || t.x.nwog,
  'not at NDOG/NWOG': (t) => !(t.x.ndog || t.x.nwog),
  'sweep took prior-day extreme': (t) => t.feat.pdSweep === true,
  'sweep into HTF FVG (D1/H4)': (t) => !!t.feat.htfFvg,
  'sweep took >= 2 pivots (pool / EQL)': (t) => t.x.pools >= 2,
  'V-shape (<= 2 candles)': (t) => t.feat.speed <= 2,
  'valid (BE point not taken)': (t) => t.valid,
};
const rows = [], res = { baseline: {}, filters: {}, combos: {}, specific: {} };
const pick = (pop, f) => take((t) => POP[pop](t) && (!f || f(t)));
for (const pop of Object.keys(POP)) {
  const b = pick(pop), bI = b.filter(IS), bO = b.filter(OOS);
  res.baseline[pop] = { is: stats(bI), oos: stats(bO), isGross: stats(bI, 'Rg'), oosGross: stats(bO, 'Rg'), years: years(b) };
  for (const [name, f] of Object.entries(F)) {
    const k = pick(pop, f), kI = k.filter(IS), kO = k.filter(OOS);
    // the dropped part, taken on its own (what removing it gives up)
    const d = pick(pop, (t) => !f(t)), dI = d.filter(IS), dO = d.filter(OOS);
    const isS = stats(kI), oosS = stats(kO), ys = years(kO), posY = Object.values(ys).filter((y) => y.R > 0).length, nY = Object.keys(ys).length;
    const selected = isS.n >= 100 && isS.exp - res.baseline[pop].is.exp >= 0.02 && (welch(kI, dI) ?? 0) >= 1.5;   // chosen in-sample
    const cand = oosS.n >= 100 && oosS.exp > 0 && oosS.exp > res.baseline[pop].oos.exp && posY >= Math.ceil((2 / 3) * nY);
    res.filters[`${pop} | ${name}`] = { pop, rule: name, is: isS, oos: oosS, dropped: { is: stats(dI), oos: stats(dO) }, tKeptVsDroppedIS: welch(kI, dI), tKeptVsDroppedOOS: welch(kO, dO), years: Object.fromEntries(Object.entries(years(k)).map(([y, s]) => [y, { n: s.n, exp: s.exp, R: s.R }])), selectedIS: selected, passesOOS: cand };
  }
}
// greedy combination chosen in-sample: add the IS-selected filter that raises IS expectancy most, while IS n >= 150
for (const pop of Object.keys(POP)) {
  let chosen = [], cur = res.baseline[pop].is.exp;
  for (;;) { let best = null;
    for (const [name, f] of Object.entries(F)) { if (chosen.includes(name) || !res.filters[`${pop} | ${name}`].selectedIS) continue;
      const fs2 = [...chosen, name].map((x) => F[x]), s = stats(pick(pop, (t) => fs2.every((g) => g(t))).filter(IS));
      if (s.n >= 150 && s.exp > cur + 0.02 && (!best || s.exp > best.s.exp)) best = { name, s }; }
    if (!best) break; chosen.push(best.name); cur = best.s.exp; }
  const k = pick(pop, (t) => chosen.every((x) => F[x](t)));
  const ys = years(k.filter(OOS)), posY = Object.values(ys).filter((y) => y.R > 0).length;
  const oo = stats(k.filter(OOS));
  res.combos[pop] = { rules: chosen, is: stats(k.filter(IS)), oos: oo, years: Object.fromEntries(Object.entries(years(k)).map(([y, s]) => [y, { n: s.n, exp: s.exp, R: s.R }])),
    passesOOS: chosen.length > 0 && oo.n >= 100 && oo.exp > 0 && oo.exp > res.baseline[pop].oos.exp && posY >= Math.ceil((2 / 3) * Object.keys(ys).length) };
}
// the two claims from the CNBC replay (Aug 2025 - Nov 2026): "NY PM negative" (all signals) and "A-London negative" (A-setups)
const seg = (pop, f) => { const k = pick(pop, f); return { is: stats(k.filter(IS)), oos: stats(k.filter(OOS)), years: Object.fromEntries(Object.entries(years(k)).map(([y, s]) => [y, { n: s.n, exp: s.exp, R: s.R }])),
  bySession: null }; };
for (const pop of Object.keys(POP)) for (const s of ['Asia', 'London', 'NY AM', 'NY PM', 'Close']) res.specific[`${pop} ${s}`] = seg(pop, (t) => t.feat.session === s);
for (const s of ['Asia', 'London', 'NY AM', 'NY PM', 'Close']) for (const mk of ['nq', 'es', 'gc']) res.specific[`A ${mk} ${s}`] = seg('A', (t) => t.market === mk && t.feat.session === s);
// last 15 months only (the replay's window) as a sanity check of the replay's claims on this data
const recent = (t) => t.signalAt >= Date.UTC(2025, 7, 1) / 1000;
for (const [nm, pop, f] of [['A London', 'A', (t) => t.feat.session === 'London'], ['ALL NY PM', 'ALL', (t) => t.feat.session === 'NY PM'], ['A NY PM', 'A', (t) => t.feat.session === 'NY PM'], ['A all', 'A', null], ['ALL all', 'ALL', null]])
  res.specific[`since 2025-08: ${nm}`] = stats(pick(pop, f).filter(recent));
// replay-rule reproduction (sized R, A-priority), for comparison with council-data ict/replay.json
const rr = replayRule(); for (const t of rr) { t.Rs = t.Rn * t.size; }
res.replayRule = { all: stats(rr, 'Rs'), A: stats(rr.filter((t) => t.aset), 'Rs'), Aunit: stats(rr.filter((t) => t.aset)), recentA: stats(rr.filter((t) => t.aset && recent(t)), 'Rs') };
res.variantsTried = Object.keys(F).length * Object.keys(POP).length + Object.keys(POP).length;
fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(path.join(OUTDIR, `analysis${STRESS !== 1 ? '-stress' + STRESS : ''}.json`), JSON.stringify(res, null, 1));
// console table
const fmt = (s) => `${String(s.n).padStart(4)} ${s.wr == null ? '  -  ' : (100 * s.wr).toFixed(0).padStart(3) + '%'} ${s.exp == null ? '   -  ' : (s.exp >= 0 ? '+' : '') + s.exp.toFixed(3)} ${String(s.R).padStart(7)} dd${String(s.maxDD).padStart(5)} t${String(s.t).padStart(6)}`;
for (const pop of Object.keys(POP)) { const b = res.baseline[pop]; console.log(`\n== ${pop} baseline  IS ${fmt(b.is)} | OOS ${fmt(b.oos)}   (gross IS ${b.isGross.exp} OOS ${b.oosGross.exp})`);
  for (const [k, v] of Object.entries(res.filters).filter(([, v]) => v.pop === pop)) console.log(`${v.rule.padEnd(46)} IS ${fmt(v.is)} | OOS ${fmt(v.oos)} | drop IS ${v.dropped.is.exp} OOS ${v.dropped.oos.exp} ${v.selectedIS ? 'SEL' : '   '} ${v.passesOOS ? 'PASS' : ''}`);
  const c = res.combos[pop]; console.log(`combo [${c.rules.join(' + ')}] IS ${fmt(c.is)} | OOS ${fmt(c.oos)} ${c.passesOOS ? 'PASS' : ''}`, JSON.stringify(c.years)); }
console.log('\n== sessions'); for (const [k, v] of Object.entries(res.specific)) console.log(k.padEnd(28), v.is ? `IS ${fmt(v.is)} | OOS ${fmt(v.oos)} ${JSON.stringify(Object.fromEntries(Object.entries(v.years).filter(([y]) => y >= 2024).map(([y, s]) => [y, s.R])))}` : fmt(v));
console.log('\nreplay rule', JSON.stringify(res.replayRule), 'variants', res.variantsTried);
