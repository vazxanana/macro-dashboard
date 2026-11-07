// Stats for universe.mjs output: per market x rule set x {all signals, A-setups}, gross and net of costs, IS 2018-23 / OOS
// 2024-26 and per year. Net R of a trade = size x (R per unit - cost in R). Writes result.json and prints tables for RESULT.md.
//   node research/edge/ict-universe/analyze.mjs <trades.json> [result.json]
import fs from 'node:fs';

const IN = process.argv[2], OUT = process.argv[3] || 'research/edge/ict-universe/result.json';
const J = JSON.parse(fs.readFileSync(IN, 'utf8')), C = J.cols, T = J.trades.map((r) => Object.fromEntries(C.map((c, i) => [c, r[i]])));
for (const t of T) { t.year = new Date(t.close * 1000).getUTCFullYear(); t.gross = t.size * t.Rraw; t.net = t.size * (t.Rraw - t.costR); }
// drift adjustment: each rule trade minus the random-entry control's net expectancy for the same market, year and side
// (x size), i.e. what the rule earned beyond being long/short that market that year with the same kind of stop and exit
const CE = new Map(); { const g = new Map(); for (const t of T) if (t.cfg.startsWith('ctrl')) { const k = `${t.market}|${t.year}|${t.side}`, v = g.get(k) || [0, 0]; v[0] += t.net; v[1]++; g.set(k, v); }
  for (const [k, v] of g) CE.set(k, v[0] / v[1]); }
for (const t of T) t.adj = t.cfg.startsWith('ctrl') ? 0 : t.net - t.size * (CE.get(`${t.market}|${t.year}|${t.side}`) ?? 0);
export function stats(a, f = 'net') {
  const r = a.map((x) => x[f]), n = r.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, streak: 0, t: null };
  const R = r.reduce((s, x) => s + x, 0), m = R / n, sd = Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, pk = 0, dd = 0, st = 0, ws = 0; for (const x of r) { eq += x; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); st = x < 0 ? st + 1 : 0; ws = Math.max(ws, st); }
  return { n, wr: +(r.filter((x) => x > 0).length / n).toFixed(3), exp: +m.toFixed(3), R: +R.toFixed(1), maxDD: +dd.toFixed(1), streak: ws, t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null };
}
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], OOSY = [2024, 2025, 2026];
const markets = [...new Set(T.map((t) => t.market))];
const rows = [];
for (const mk of markets) for (const cfg of ['index', 'gold', 'ctrlbuy', 'ctrlsell']) for (const sub of ['all', 'A']) {
  if (cfg.startsWith('ctrl') && sub === 'A') continue;
  const a = T.filter((t) => t.market === mk && t.cfg === cfg && (sub === 'all' || t.aset)).sort((x, y) => x.close - y.close);
  const is = a.filter((t) => t.year < 2024), oos = a.filter((t) => t.year >= 2024);
  const years = Object.fromEntries(YEARS.map((y) => [y, stats(a.filter((t) => t.year === y)).R]));
  const yearsExp = Object.fromEntries(YEARS.map((y) => [y, stats(a.filter((t) => t.year === y)).exp])), yearsAdj = Object.fromEntries(YEARS.map((y) => [y, stats(a.filter((t) => t.year === y), 'adj').exp]));
  const o = stats(oos), posY = OOSY.filter((y) => years[y] > 0).length;
  const pass = !cfg.startsWith('ctrl') && o.n >= 50 && o.exp > 0 && posY >= 2;
  rows.push({ market: mk, cfg, sub, isAdj: stats(is, 'adj'), oosAdj: stats(oos, 'adj'), yearsExp, yearsAdj, buys: +(a.filter((t) => t.side > 0).length / Math.max(1, a.length)).toFixed(2), isGross: stats(is, 'gross'), oosGross: stats(oos, 'gross'), is: stats(is), oos: o, years, posOOSyears: posY, posAllYears: YEARS.filter((y) => years[y] > 0).length, pass });
}
const fmt = (s) => `${s.n} | ${s.wr == null ? '-' : (100 * s.wr).toFixed(0) + '%'} | ${s.exp == null ? '-' : s.exp.toFixed(2)} | ${s.R.toFixed(1)} | ${s.maxDD.toFixed(1)} | ${s.t ?? '-'}`;
console.log('market | rules | set | IS n | wr | exp | R | DD | t || OOS n | wr | exp | R | DD | t | OOS gross exp | pass');
for (const r of rows) console.log(`${r.market} | ${r.cfg} | ${r.sub} | ${fmt(r.is)} || ${fmt(r.oos)} | ${r.oosGross.exp ?? '-'} | ${r.pass ? 'PASS' : ''}`);
console.log('\nper-year net R');
console.log('market | rules | set | ' + YEARS.join(' | '));
for (const r of rows) console.log(`${r.market} | ${r.cfg} | ${r.sub} | ${YEARS.map((y) => r.years[y].toFixed(1)).join(' | ')}`);
// verdicts. PREAMBLE gate: OOS n >= 50, OOS net exp > 0, >= 2 of 3 OOS years positive. ROBUST gate (added after the first look,
// because 40 cells were tested): also IS net exp > 0, >= 6 of 9 years positive, and drift-adjusted OOS exp > 0.
const PRIMARY = { gc: 'gold', nas100: 'index', spx: 'index', xagusd: 'gold' };   // the rule set the desk would use; FX = index default
const ONDESK = { gc: 'GC (live)', nas100: 'already on the desk as NQ', spx: 'already on the desk as ES' };
const cand = rows.filter((r) => !r.cfg.startsWith('ctrl')).map((r) => {
  const robust = r.pass && r.is.exp > 0 && r.posAllYears >= 6 && r.oosAdj.exp > 0;
  return { rule: `${r.market} ${r.cfg}-rules ${r.sub === 'A' ? 'A-setups' : 'all signals'}`, market: r.market, rules: r.cfg, set: r.sub, primary: r.sub === 'A' && (PRIMARY[r.market] || 'index') === r.cfg,
    is: r.is, oos: r.oos, isGross: r.isGross, oosGross: r.oosGross, driftAdj: { is: r.isAdj, oos: r.oosAdj }, years: r.years, yearsExp: r.yearsExp, yearsDriftAdj: r.yearsAdj, posYears: `${r.posAllYears}/9`,
    verdict: robust ? 'PASS' : r.pass ? 'INCONCLUSIVE (preamble gate only)' : 'FAIL', note: ONDESK[r.market] || null };
});
const pick = (st) => ({ n: st.n, wr: st.wr, exp: st.exp, R: st.R, maxDD: st.maxDD, t: st.t, streak: st.streak });
const base = rows.find((r) => r.market === 'gc' && r.cfg === 'gold' && r.sub === 'A');
fs.writeFileSync(OUT, JSON.stringify({ topic: 'ict-universe', system: 'ICT desk H1 iFVG (ict/tracker.mjs signals + ict/replay.mjs simulate, post-#413), HistData M1 2018-01..2026-10',
  baseline: { rule: 'GC live gold rule A-setups (buys, stop 0.3-0.75x D1 ATR)', is: pick(base.is), oos: pick(base.oos), driftAdj: { is: pick(base.isAdj), oos: pick(base.oosAdj) } },
  candidates: cand.map((c) => ({ ...c, is: pick(c.is), oos: pick(c.oos) })), controls: rows.filter((r) => r.cfg.startsWith('ctrl')).map((r) => ({ market: r.market, cfg: r.cfg, is: pick(r.is), oos: pick(r.oos), yearsExp: r.yearsExp })),
  variantsTried: 40, controlsRun: 20,
  notes: 'IS 2018-2023, OOS 2024-2026-10; net = size x (R - (spread + 1 tick)/risk). No rule was tuned: the two existing rule sets (index default, gold aRule) were applied unchanged to every market. 10 markets x 2 rule sets x {all, A} = 40 cells; random-entry buy/sell controls per market give the drift adjustment.' }, null, 1));
console.log('\nverdicts'); for (const c of cand) if (c.verdict !== 'FAIL' || c.primary) console.log(c.rule, c.primary ? '(primary)' : '', c.verdict, c.posYears, 'adjOOS', c.driftAdj.oos.exp);
console.log('\ndrift-adjusted (net minus same-market/year/side random-entry control)');
console.log('market | rules | set | buys | IS adj exp | t | OOS adj exp | t | per-year adj exp');
for (const r of rows.filter((r) => !r.cfg.startsWith('ctrl'))) console.log(`${r.market} | ${r.cfg} | ${r.sub} | ${r.buys} | ${r.isAdj.exp} | ${r.isAdj.t} | ${r.oosAdj.exp} | ${r.oosAdj.t} | ${YEARS.map((y) => r.yearsAdj[y] == null ? '-' : r.yearsAdj[y].toFixed(2)).join(' ')}`);
console.log('\nper-year net exp');
for (const r of rows) console.log(`${r.market} | ${r.cfg} | ${r.sub} | ${YEARS.map((y) => r.yearsExp[y] == null ? '-' : r.yearsExp[y].toFixed(2)).join(' ')}`);
console.log('\ncells', rows.length);
