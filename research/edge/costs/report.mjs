// Builds research/edge/costs/result.json from the three analyses.
//   node research/edge/costs/report.mjs <scalp_result.json> <bt30.json> <ict.json> <result.json>
import fs from 'node:fs';
const [SR, BT, IC, OUT] = process.argv.slice(2);
const s = JSON.parse(fs.readFileSync(SR, 'utf8')), b = JSON.parse(fs.readFileSync(BT, 'utf8')), ic = JSON.parse(fs.readFileSync(IC, 'utf8'));
const pick = (x) => x && { n: x.n, wr: x.wr, exp: x.exp, R: x.R, maxDD: x.maxDD, t: x.t };
const L = s.scalp['live rule'].ALL;
const yrs = (sel) => Object.fromEntries(Object.entries(sel).map(([y, v]) => [y, pick(v)]));
const cand = (acct) => { const r = s.minStop[acct].rule, oosY = Object.entries(r.picked.years).filter(([y]) => +y >= 2024), pos = oosY.filter(([, v]) => v.exp > 0).length;
  const pass = r.picked.oos.n >= 100 && r.picked.oos.exp > 0 && r.picked.oos.exp > r.baseline.oos.exp && pos >= 2;
  return { rule: `Scalp live rule, only when the stop >= ${r.pickedOnIS} x the all-in round-trip cost at that hour (${acct === 'raw' ? 'ECN raw account' : 'OANDA-style spread-only account'}); multiple picked on 2018-23 from {0,5,8,10,12,15,20,25,30,40}`,
    is: pick(r.picked.is), oos: pick(r.picked.oos), years: yrs(r.picked.years), baseline: { is: pick(r.baseline.is), oos: pick(r.baseline.oos) }, grid: r.grid,
    verdict: pass ? 'PASS' : `FAIL (OOS ${r.picked.oos.exp}R over ${r.picked.oos.n}; ${pos}/3 OOS years positive)` }; };
const out = {
  topic: 'costs',
  system: 'MERIDIAN council (30-day replay backtest.json + the live Scalp rule on HistData 2018-Oct 2026) and the ICT desk (ict/replay.json)',
  baseline: { rule: 'Scalp (M15->M1) live rule: against D1, not asia/overlap, not AUD/USD; ECN raw costs by hour + slippage + 2-minute latency', is: pick(L.is.raw2), oos: pick(L.oos.raw2), gross: { is: pick(L.is.gross), oos: pick(L.oos.gross) }, engineCost: { is: pick(L.is.engine), oos: pick(L.oos.engine) }, oanda: { is: pick(L.is.oanda2), oos: pick(L.oos.oanda2) } },
  candidates: [cand('raw'), cand('oanda')],
  variantsTried: 20,
  scalpByMarket: Object.fromEntries(Object.entries(s.scalp['live rule']).filter(([k, v]) => v.is.gross.n).map(([k, v]) => [k, { is: { gross: pick(v.is.gross), engine: pick(v.is.engine), raw2: pick(v.is.raw2), oanda2: pick(v.is.oanda2) }, oos: { gross: pick(v.oos.gross), engine: pick(v.oos.engine), raw2: pick(v.oos.raw2), oanda2: pick(v.oos.oanda2) } }])),
  scalpAllSignals: Object.fromEntries(Object.entries(s.scalp['all signals']).map(([k, v]) => [k, { is: { gross: v.is.gross.exp, raw2: v.is.raw2.exp, oanda2: v.is.oanda2.exp, n: v.is.gross.n }, oos: { gross: v.oos.gross.exp, raw2: v.oos.raw2.exp, oanda2: v.oos.oanda2.exp, n: v.oos.gross.n } }])),
  scalpLatency: { is: { raw0: L.is.raw0.exp, raw1: L.is.raw1.exp, raw2: L.is.raw2.exp, raw3: L.is.raw3.exp }, oos: { raw0: L.oos.raw0.exp, raw1: L.oos.raw1.exp, raw2: L.oos.raw2.exp, raw3: L.oos.raw3.exp } },
  scalpBySession: Object.fromEntries(Object.entries(s.liveBySession).map(([k, v]) => [k, { is: { gross: pick(v.is.gross), raw2: pick(v.is.raw2), oanda2: pick(v.is.oanda2) }, oos: { gross: pick(v.oos.gross), raw2: pick(v.oos.raw2), oanda2: pick(v.oos.oanda2) } }])),
  scalpYears: Object.fromEntries(Object.entries(L.years).map(([y, v]) => [y, { gross: pick(v.gross), raw2: pick(v.raw2), oanda2: pick(v.oanda2) }])),
  minStopBands: s.minStop,
  costTable: s.costTable,
  replay30d: { source: b.source, engine: b.engine, groups: Object.fromEntries(Object.entries(b.groups).map(([k, v]) => [k, { gross: pick(v.gross), engine: pick(v.engine), raw: pick(v.raw), oanda: pick(v.oanda), costR: v.costR }])), latency: Object.fromEntries(Object.entries(b.latency).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([q, x]) => [q, pick(x)]))])), validation: b.validation },
  ict: ic,
  notes: [
    'No bid/ask history exists in the repo (HistData = bid, OANDA proxy = mid, Duka idx = one side, CNBC = last): spread levels are published broker typicals, the hour shape is the NY-17:00 rollover cycle (costs.mjs). Spreads were not measured.',
    'raw = IC Markets Raw-style (FX 0.15-0.35 pip + $7/lot, gold 0.14 + 0.07); oanda = OANDA standard spread-only (FX 1.2-2.0 pip, gold 0.45); session multipliers 1.0 London/overlap, 1.25 NY pm, 1.45 Asia, 2.2 early Asia, 5.0 in the 17:00 NY hour. Slippage 0.1-0.15 pip / $0.05 on market entries, 0.2-0.3 pip / $0.10 on stops.',
    'Crypto in the 30-day replay: raw column = CFD 0.04% round trip, oanda column = Kraken Pro spot taker 0.40% a side (0.8%); the engine charges 0.02%.',
    'Latency 1-3 min moves expectancy by less than 0.02R in every test (scalp limit + market entries, 30-day market entries, ICT); spreads/commission are what matter.',
    'The multi-year harness runs the live engine on HistData bid M1; only ~20-25% of its Oct-2026 scalp signals coincide with the 30-day replay (Kraken FX / PAXG feeds), so the engine is feed-sensitive: compare distributions, not trades.',
    'Futures: MNQ/MES/MYM/M2K/MGC at 1 tick spread + $1.24 RT + 1 tick entry slip + 1 tick exit slip = 4.0-5.5 ticks a round trip.',
  ],
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('written', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
for (const c of out.candidates) console.log(c.rule, '\n IS', JSON.stringify(c.is), '\n OOS', JSON.stringify(c.oos), '\n', c.verdict);
