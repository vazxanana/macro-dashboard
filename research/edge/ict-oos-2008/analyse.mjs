// Stats and the pre-registered verdict for run.mjs output (preregistration.md). Net R = size x (R per unit - k x cost in R),
// k = 1 (primary) or 2. TEST = signals closing 2008-01-01 .. 2017-12-31 UTC; REF = 2018-01-01 .. 2026-10-31 (same code, same
// OANDA data, a reference only). Prints the tables for RESULT.md and writes result.json.
//   node research/edge/ict-oos-2008/analyse.mjs <trades.json> [result.json]
import fs from 'node:fs';

const IN = process.argv[2], OUT = process.argv[3] || 'research/edge/ict-oos-2008/result.json';
const J = JSON.parse(fs.readFileSync(IN, 'utf8')), T = J.trades.map((r) => Object.fromEntries(J.cols.map((c, i) => [c, r[i]])));
const MK = ['gc', 'nq', 'es', 'ym'];
const W = { test: [Date.UTC(2008, 0, 1) / 1000, Date.UTC(2018, 0, 1) / 1000], ref: [Date.UTC(2018, 0, 1) / 1000, Date.UTC(2026, 10, 1) / 1000] };
for (const t of T) { const d = new Date(t.close * 1000); t.year = d.getUTCFullYear(); t.month = `${t.year}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  t.gross = t.size * t.Rraw; t.net = t.size * (t.Rraw - t.costR); t.net2 = t.size * (t.Rraw - 2 * t.costR); }
const inW = (t, w) => t.close >= W[w][0] && t.close < W[w][1];

function stats(a, f = 'net') {
  a = [...a].sort((x, y) => x.closed - y.closed);
  const r = a.map((x) => x[f]), n = r.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, streak: 0, t: null };
  const R = r.reduce((s, x) => s + x, 0), m = R / n, sd = Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, pk = 0, dd = 0, st = 0, ws = 0; for (const x of r) { eq += x; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); st = x < 0 ? st + 1 : 0; ws = Math.max(ws, st); }
  return { n, wr: +(r.filter((x) => x > 0).length / n).toFixed(3), exp: +m.toFixed(3), R: +R.toFixed(1), maxDD: +dd.toFixed(1), streak: ws, t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null };
}
// t of the monthly sums (every calendar month of the window counts, months without a trade as 0)
function monthlyT(a, w, f = 'net') {
  const s = new Map(); for (const x of a) s.set(x.month, (s.get(x.month) || 0) + x[f]);
  const ms = []; for (let t = W[w][0]; t < W[w][1]; ) { const d = new Date(t * 1000), k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; ms.push(s.get(k) || 0); t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000; }
  const n = ms.length, m = ms.reduce((p, x) => p + x, 0) / n, sd = Math.sqrt(ms.reduce((p, x) => p + (x - m) ** 2, 0) / (n - 1));
  return { months: n, meanR: +m.toFixed(2), t: +(m / (sd / Math.sqrt(n))).toFixed(2) };
}

const A = (w) => T.filter((t) => t.cfg === 'rule' && t.aset && inW(t, w));
const ALL = (w) => T.filter((t) => t.cfg === 'rule' && inW(t, w));
const out = { built: new Date().toISOString().slice(0, 10), src: J.src, coverage: J.coverage, cost: J.cost, windows: { test: '2008-01-01..2017-12-31', ref: '2018-01-01..2026-10-31' } };
for (const w of ['test', 'ref']) {
  const a = A(w), years = [...new Set(a.map((t) => t.year))].sort(), half = w === 'test' ? 2013 : 2022;
  const o = out[w] = {};
  o.pooled = { net: stats(a), net2: stats(a, 'net2'), gross: stats(a, 'gross'), monthly: monthlyT(a, w), monthly2: monthlyT(a, w, 'net2') };
  o.halves = { first: stats(a.filter((t) => t.year < half)), second: stats(a.filter((t) => t.year >= half)), first2: stats(a.filter((t) => t.year < half), 'net2'), second2: stats(a.filter((t) => t.year >= half), 'net2'), split: half };
  o.markets = Object.fromEntries(MK.map((m) => { const b = a.filter((t) => t.market === m), h1 = b.filter((t) => t.year < half), h2 = b.filter((t) => t.year >= half);
    return [m, { net: stats(b), net2: stats(b, 'net2'), gross: stats(b, 'gross'), first: stats(h1), second: stats(h2), buys: stats(b.filter((t) => t.side > 0)), sells: stats(b.filter((t) => t.side < 0)), allSignals: stats(ALL(w).filter((t) => t.market === m)),
      years: Object.fromEntries(years.map((y) => [y, stats(b.filter((t) => t.year === y))])) }]; }));
  o.years = Object.fromEntries(years.map((y) => [y, { net: stats(a.filter((t) => t.year === y)), net2: stats(a.filter((t) => t.year === y), 'net2') }]));
  const idx = a.filter((t) => t.market !== 'gc');
  o.grade = { indexAplus: stats(idx.filter((t) => t.aplus)), indexA: stats(idx.filter((t) => !t.aplus)), indexTight: stats(idx.filter((t) => t.size === 0.25 || t.size === 0.75)), gc: stats(a.filter((t) => t.market === 'gc')),
    byTotal: Object.fromEntries([3, 4, 5, 6, 7, 8, 9, 10].map((g) => [g, stats(a.filter((t) => t.grade === g))]).filter(([, s]) => s.n)) };
  o.sides = { buys: stats(a.filter((t) => t.side > 0)), sells: stats(a.filter((t) => t.side < 0)) };
  o.sessions = Object.fromEntries(['Asia', 'London', 'NY AM', 'NY PM', 'Close'].map((s) => [s, stats(a.filter((t) => t.session === s))]));
  o.indicesOnly = { net: stats(idx), net2: stats(idx, 'net2'), monthly: monthlyT(idx, w) };
  // GC drift control (reported only): GC A-setups minus the random-buy control's mean net R for the same year
  const ctrl = T.filter((t) => t.cfg === 'ctrlbuy' && inW(t, w)), cy = new Map();
  for (const y of years) { const c = ctrl.filter((t) => t.year === y); cy.set(y, c.length ? c.reduce((s, t) => s + t.net, 0) / c.length : 0); }
  const gcA = a.filter((t) => t.market === 'gc').map((t) => ({ ...t, adj: t.net - t.size * cy.get(t.year) }));
  o.gcDrift = { control: stats(ctrl), adjusted: stats(gcA, 'adj'), adjFirst: stats(gcA.filter((t) => t.year < half), 'adj'), adjSecond: stats(gcA.filter((t) => t.year >= half), 'adj'),
    years: Object.fromEntries(years.map((y) => [y, { ctrl: +cy.get(y).toFixed(3), gcA: stats(gcA.filter((t) => t.year === y)).exp, adj: stats(gcA.filter((t) => t.year === y), 'adj').exp }])) };
}
// the pre-registered verdict (TEST window, costs x1)
{ const o = out.test, p = o.pooled.net, h1 = o.halves.first, h2 = o.halves.second;
  const P1 = p.exp > 0 && p.t >= 2, P2 = h1.exp > 0 && h2.exp > 0, posM = MK.filter((m) => o.markets[m].net.exp > 0).length, P3 = posM >= 3;
  const oneHalf = (h1.exp > 0 && h1.t >= 2 && h2.exp <= 0) || (h2.exp > 0 && h2.t >= 2 && h1.exp <= 0);
  const verdict = P1 && P2 && P3 ? 'ROBUST' : oneHalf || (P1 && (!P2 || !P3)) ? 'REGIME-BOUND' : 'FAILS';
  out.verdict = { verdict, P1, P2, P3, positiveMarkets: posM, note: verdict === 'FAILS' && p.exp > 0 ? 'positive but not significant' : null }; }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

// tables
const f = (s) => (s.n ? `${s.n} | ${(100 * s.wr).toFixed(0)}% | ${s.exp >= 0 ? '+' : ''}${s.exp.toFixed(3)} | ${s.R >= 0 ? '+' : ''}${s.R.toFixed(1)} | ${s.maxDD.toFixed(1)} | ${s.t}` : '0 | - | - | - | - | -');
console.log('VERDICT', JSON.stringify(out.verdict));
for (const w of ['test', 'ref']) { const o = out[w];
  console.log(`\n=== ${w} ${out.windows[w]}\npooled net x1 | ${f(o.pooled.net)}\npooled net x2 | ${f(o.pooled.net2)}\npooled gross | ${f(o.pooled.gross)}\nmonthly t x1 ${JSON.stringify(o.pooled.monthly)} x2 ${JSON.stringify(o.pooled.monthly2)}`);
  console.log(`halves (split ${o.halves.split}) x1: ${f(o.halves.first)} || ${f(o.halves.second)}\nhalves x2: ${f(o.halves.first2)} || ${f(o.halves.second2)}`);
  console.log('market | n | wr | exp | R | DD | t || x2 exp | gross exp | 1st half exp (t) | 2nd half exp (t) | buys n/exp | sells n/exp | all signals n/exp');
  for (const m of MK) { const x = o.markets[m]; console.log(`${m} | ${f(x.net)} || ${x.net2.exp} | ${x.gross.exp} | ${x.first.exp} (${x.first.t}) | ${x.second.exp} (${x.second.t}) | ${x.buys.n}/${x.buys.exp} | ${x.sells.n}/${x.sells.exp} | ${x.allSignals.n}/${x.allSignals.exp}`); }
  console.log('year | pooled n | exp | R | t | x2 exp | ' + MK.map((m) => m + ' R').join(' | '));
  for (const y of Object.keys(o.years)) console.log(`${y} | ${o.years[y].net.n} | ${o.years[y].net.exp} | ${o.years[y].net.R} | ${o.years[y].net.t} | ${o.years[y].net2.exp} | ${MK.map((m) => `${o.markets[m].years[y].R} (${o.markets[m].years[y].n})`).join(' | ')}`);
  console.log(`grade: index A+ ${f(o.grade.indexAplus)} | index plain A ${f(o.grade.indexA)} | index tight ${f(o.grade.indexTight)}`);
  console.log('by grade total', Object.entries(o.grade.byTotal).map(([g, s]) => `${g}: ${s.n}/${s.exp}/t${s.t}`).join('  '));
  console.log(`sides: buys ${f(o.sides.buys)} | sells ${f(o.sides.sells)}`);
  console.log('sessions', Object.entries(o.sessions).map(([s, x]) => `${s}: ${x.n}/${x.exp}/t${x.t}`).join('  '));
  console.log(`indices only: ${f(o.indicesOnly.net)} | x2 ${o.indicesOnly.net2.exp} | monthly ${JSON.stringify(o.indicesOnly.monthly)}`);
  console.log(`GC drift: control ${f(o.gcDrift.control)} | adjusted ${f(o.gcDrift.adjusted)} | adj halves ${o.gcDrift.adjFirst.exp} (${o.gcDrift.adjFirst.t}) / ${o.gcDrift.adjSecond.exp} (${o.gcDrift.adjSecond.t})`);
  console.log('GC years ctrl/gcA/adj', Object.entries(o.gcDrift.years).map(([y, v]) => `${y}: ${v.ctrl}/${v.gcA}/${v.adj}`).join('  '));
}
