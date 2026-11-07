// Stats and the pre-registered verdict for run.mjs output (preregistration.md). Index markets only (the gate never touches GC; GC is
// shown for reference). Net R = size x (R per unit - k x cost in R), k = 1 (primary) or 2.
//   U       = the live A-setup stream                F = the filtered stream (gate-passing A-setups, own busy rule)
//   dropped = U trades the gate rejects (index sells with the prior daily close at or above its 200-day average)
//   added   = F trades not in U (A-setups U missed because a since-dropped trade was open)
//   node research/edge/ict-trend-side/analyse.mjs <trades.json> <fromISO> <toISO> <halfSplitYear> [result.json]
import fs from 'node:fs';

const [IN, FROM, TO, SPLIT, OUT] = process.argv.slice(2);
const J = JSON.parse(fs.readFileSync(IN, 'utf8')), w0 = Date.parse(FROM) / 1000, w1 = Date.parse(TO) / 1000, split = +SPLIT;
const T = J.trades.filter((t) => t.close >= w0 && t.close < w1).map((t) => { const d = new Date(t.close * 1000), year = d.getUTCFullYear();
  return { ...t, year, month: `${year}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, net: t.size * (t.Rraw - t.costR), net2: t.size * (t.Rraw - 2 * t.costR), gross: t.size * t.Rraw }; });
const IDX = Object.keys(J.markets).filter((m) => m !== 'gc');

function stats(a, f = 'net') {
  a = [...a].sort((x, y) => x.closed - y.closed);
  const r = a.map((x) => x[f]), n = r.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, t: null };
  const R = r.reduce((s, x) => s + x, 0), m = R / n, sd = Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, pk = 0, dd = 0; for (const x of r) { eq += x; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  return { n, wr: +(r.filter((x) => x > 0).length / n).toFixed(3), exp: +m.toFixed(3), R: +R.toFixed(1), maxDD: +dd.toFixed(1), t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null };
}
const sets = (a) => ({ U: a.filter((t) => t.U), F: a.filter((t) => t.F), dropped: a.filter((t) => t.U && !t.pass), added: a.filter((t) => t.F && !t.U) });
const block = (a) => { const s = sets(a); return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { net: stats(v), net2: stats(v, 'net2'), gross: stats(v, 'gross') }])); };

const idx = T.filter((t) => t.market !== 'gc');
const out = { window: `${FROM}..${TO}`, src: J.src, split, pooled: block(idx),
  halves: { first: block(idx.filter((t) => t.year < split)), second: block(idx.filter((t) => t.year >= split)) },
  markets: Object.fromEntries(IDX.map((m) => [m, block(idx.filter((t) => t.market === m))])),
  years: Object.fromEntries([...new Set(idx.map((t) => t.year))].sort().map((y) => [y, block(idx.filter((t) => t.year === y))])),
  sides: { Ubuys: stats(idx.filter((t) => t.U && t.side > 0)), Usells: stats(idx.filter((t) => t.U && t.side < 0)), Fsells: stats(idx.filter((t) => t.F && t.side < 0)),
    UsellsBelow: stats(idx.filter((t) => t.U && t.side < 0 && t.below === 1)), UsellsNoSma: idx.filter((t) => t.U && t.side < 0 && t.below == null).length },
  gcReference: stats(T.filter((t) => t.market === 'gc' && t.U)) };
// the pre-registered verdict (index markets, net costs x1)
{ const p = out.pooled, h = out.halves;
  const C1 = p.F.net.exp > p.U.net.exp && p.F.net.R >= p.U.net.R;
  const C2 = p.dropped.net.n >= 30 && p.dropped.net.exp <= 0;
  const C3 = h.first.F.net.exp > 0 && h.second.F.net.exp > 0;
  const posM = IDX.filter((m) => out.markets[m].F.net.exp > 0), C4 = posM.length >= Math.min(3, IDX.length);
  out.verdict = { verdict: C1 && C2 && C3 && C4 ? 'PASS' : 'FAIL', C1_beats: C1, C2_dropped: C2, C3_halves: C3, C4_markets: C4, positiveMarkets: posM, indexMarkets: IDX }; }
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

const f = (s) => (s.n ? `${s.n} | ${(100 * s.wr).toFixed(0)}% | ${s.exp >= 0 ? '+' : ''}${s.exp.toFixed(3)} | ${s.R >= 0 ? '+' : ''}${s.R.toFixed(1)} | ${s.maxDD.toFixed(1)} | ${s.t}` : '0 | - | - | - | - | -');
console.log(`=== ${J.src} ${out.window} (index markets ${IDX.join(', ')}), net x1: n | WR | exp | R | maxDD | t`);
console.log('VERDICT', JSON.stringify(out.verdict));
for (const k of ['U', 'F', 'dropped', 'added']) console.log(`${k.padEnd(8)}| ${f(out.pooled[k].net)}   x2 ${out.pooled[k].net2.exp} gross ${out.pooled[k].gross.exp}`);
for (const [hn, hb] of Object.entries(out.halves)) console.log(`${hn} half: U ${f(hb.U.net)} || F ${f(hb.F.net)} || dropped ${f(hb.dropped.net)}`);
for (const m of IDX) { const x = out.markets[m]; console.log(`${m}: U ${f(x.U.net)} || F ${f(x.F.net)} || dropped ${f(x.dropped.net)} || added ${x.added.net.n}/${x.added.net.exp}`); }
console.log('year | U n/exp/R | F n/exp/R | dropped n/exp/R');
for (const [y, x] of Object.entries(out.years)) console.log(`${y} | ${x.U.net.n}/${x.U.net.exp}/${x.U.net.R} | ${x.F.net.n}/${x.F.net.exp}/${x.F.net.R} | ${x.dropped.net.n}/${x.dropped.net.exp}/${x.dropped.net.R}`);
console.log('sides', JSON.stringify(out.sides));
console.log('GC (unchanged, reference)', f(out.gcReference));
