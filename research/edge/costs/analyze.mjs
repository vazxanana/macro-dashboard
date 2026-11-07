// Summarises the multi-year Scalp runs (scalp.mjs outputs) + the 30-day and ICT re-costings into result.json.
//   node research/edge/costs/analyze.mjs <outDir> <result.json>
import fs from 'node:fs';
import path from 'node:path';
import { stats, model, allIn } from './costs.mjs';

const [DIR, RES] = process.argv.slice(2);
const rows = [];
for (const f of fs.readdirSync(DIR).filter((f) => /^scalp_[A-Z]+_\d{4}\.json$/.test(f))) {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  for (const r of j.rows) if (r.gross != null) rows.push({ ...r, sym: j.sym });
}
const IS = (r) => r.y <= 2023, OOS = (r) => r.y >= 2024;
const liveRule = (r) => r.d1 === 'against' && r.session !== 'asia' && r.session !== 'overlap' && r.sym !== 'AUDUSD';
const SC = { gross: (r) => r.gross, engine: (r) => r.gross - (r.fill ? r.engCost : 0), raw0: (r) => r.raw0, raw2: (r) => r.raw2, raw1: (r) => r.raw1, raw3: (r) => r.raw3, oanda0: (r) => r.oanda0, oanda2: (r) => r.oanda2 };
// expectancy per FILLED trade (unfilled limit orders are 0R and left out of n)
const blk = (a, k) => stats(a.filter((r) => (k === 'gross' || k === 'engine' ? r.fill : r[k] !== 0 || r.fill)).map(SC[k]).filter((v) => v != null));
const table = (a) => Object.fromEntries(Object.keys(SC).map((k) => [k, blk(a, k)]));
const syms = [...new Set(rows.map((r) => r.sym))].sort();
const years = [...new Set(rows.map((r) => r.y))].sort();
const out = { topic: 'costs', system: 'MERIDIAN council Scalp (M15->M1) + 30-day replay + ICT desk', scalp: {}, minStop: {}, variantsTried: 0, notes: [] };

// 1. live rule and all signals, per market, IS / OOS / years
for (const [name, f] of [['live rule', liveRule], ['all signals', () => true]]) {
  const o = (out.scalp[name] = {});
  for (const s of ['ALL', ...syms]) {
    const a = rows.filter((r) => f(r) && (s === 'ALL' || r.sym === s));
    o[s] = { is: table(a.filter(IS)), oos: table(a.filter(OOS)), years: Object.fromEntries(years.map((y) => [y, { gross: blk(a.filter((r) => r.y === y), 'gross'), raw2: blk(a.filter((r) => r.y === y), 'raw2'), oanda2: blk(a.filter((r) => r.y === y), 'oanda2') }])) };
  }
}
// 1b. live rule by session, and the rollover hour (17:00-18:00 New York) the 'late' session contains
out.liveBySession = {};
for (const [n, f] of [['london', (r) => r.session === 'london'], ['newyork', (r) => r.session === 'newyork'], ['late (all)', (r) => r.session === 'late'], ['late: rollover hour 17 NY', (r) => r.session === 'late' && r.ny === 17], ['late: other', (r) => r.session === 'late' && r.ny !== 17]]) {
  const a = rows.filter((r) => liveRule(r) && f(r)); out.liveBySession[n] = { is: table(a.filter(IS)), oos: table(a.filter(OOS)) }; }
// 2. minimum stop in multiples of the all-in round-trip cost at that hour (spread x session + commission + slippage)
const costAt = (r, acct) => { const c = model(r.sym, acct)(r.t); return c.spread + c.comm + c.slipM; };
const BANDS = [0, 5, 8, 12, 16, 20, 30, 50, 1e9];
for (const acct of ['raw', 'oanda']) {
  const key = acct + '2', o = (out.minStop[acct] = { bands: {}, rule: {} });
  for (const s of ['LIVE', 'ALL', ...syms]) {   // LIVE = live-rule trades pooled; ALL / per market = every scalp signal
    const a = rows.filter((r) => r.fill && (s === 'LIVE' ? liveRule(r) : s === 'ALL' || r.sym === s));
    o.bands[s] = BANDS.slice(0, -1).map((lo, i) => { const hi = BANDS[i + 1], b = a.filter((r) => { const m = r.r0 / costAt(r, acct); return m >= lo && m < hi; });
      return { band: `${lo}-${hi === 1e9 ? '' : hi}x`, isN: b.filter(IS).length, isGross: blk(b.filter(IS), 'gross').exp, isNet: blk(b.filter(IS), key).exp, oosN: b.filter(OOS).length, oosGross: blk(b.filter(OOS), 'gross').exp, oosNet: blk(b.filter(OOS), key).exp }; });
  }
  // candidate rule: take the live-rule trade only when stop >= m x all-in cost; m picked on IS (pooled), judged OOS
  const live = rows.filter(liveRule).filter((r) => r.fill);
  const grid = [0, 5, 8, 10, 12, 15, 20, 25, 30, 40];
  out.variantsTried += grid.length;
  const sc = grid.map((m) => { const f = (r) => r.r0 / costAt(r, acct) >= m; return { m, is: blk(live.filter(IS).filter(f), key), oos: blk(live.filter(OOS).filter(f), key) }; });
  o.rule.grid = sc.map((x) => ({ m: x.m, isN: x.is.n, isExp: x.is.exp, isR: x.is.R, oosN: x.oos.n, oosExp: x.oos.exp, oosR: x.oos.R }));
  const best = sc.filter((x) => x.is.n >= Math.min(200, sc[0].is.n / 3)).sort((p, q) => q.is.exp - p.is.exp)[0];
  o.rule.pickedOnIS = best.m;
  const f = (r) => r.r0 / costAt(r, acct) >= best.m;
  o.rule.picked = { is: blk(live.filter(IS).filter(f), key), oos: blk(live.filter(OOS).filter(f), key), years: Object.fromEntries(years.map((y) => [y, blk(live.filter((r) => r.y === y).filter(f), key)])) };
  o.rule.baseline = { is: blk(live.filter(IS), key), oos: blk(live.filter(OOS), key) };
}
// 3. typical all-in costs and engine assumption
out.costTable = Object.fromEntries(syms.map((s) => { const r = model(s, 'raw')(Date.UTC(2025, 0, 15, 10) / 1000), o = model(s, 'oanda')(Date.UTC(2025, 0, 15, 10) / 1000);
  const pip = s === 'XAUUSD' ? 1 : 1e-4;
  return [s, { unit: s === 'XAUUSD' ? 'USD' : 'pip', engine: s === 'XAUUSD' ? 0.3 : 1, rawAllIn: +((r.spread + r.comm + r.slipM) / pip).toFixed(3), oandaAllIn: +((o.spread + o.comm + o.slipM) / pip).toFixed(3),
    medianStopLive: +(rows.filter((x) => x.sym === s && liveRule(x) && x.fill).map((x) => x.r0 / pip).sort((a, b) => a - b)[Math.floor(rows.filter((x) => x.sym === s && liveRule(x) && x.fill).length / 2)] || 0).toFixed(2) }]; }));
fs.writeFileSync(RES, JSON.stringify(out, null, 1));
// console summary
const p = (s) => s ? `${String(s.n).padStart(5)} ${s.exp == null ? '  -  ' : s.exp.toFixed(3).padStart(6)}` : '';
for (const name of Object.keys(out.scalp)) { console.log(`\n== ${name}: n exp  (gross | engine | raw0 | raw2 | oanda2)`);
  for (const [s, v] of Object.entries(out.scalp[name])) console.log(s.padEnd(7), 'IS ', ['gross', 'engine', 'raw0', 'raw2', 'oanda2'].map((k) => p(v.is[k])).join(' |'), '  OOS ', ['gross', 'engine', 'raw0', 'raw2', 'oanda2'].map((k) => p(v.oos[k])).join(' |')); }
for (const [n, v] of Object.entries(out.liveBySession)) console.log('SESSION', n.padEnd(26), 'IS ', ['gross', 'raw2', 'oanda2'].map((k) => p(v.is[k])).join(' |'), '  OOS ', ['gross', 'raw2', 'oanda2'].map((k) => p(v.oos[k])).join(' |'));
console.log('\ncost table', JSON.stringify(out.costTable));
for (const acct of ['raw', 'oanda']) { console.log(`\nminStop ${acct} grid`, JSON.stringify(out.minStop[acct].rule.grid), 'picked', out.minStop[acct].rule.pickedOnIS);
  for (const s of Object.keys(out.minStop[acct].bands)) console.log(acct, s.padEnd(7), out.minStop[acct].bands[s].map((b) => `${b.band}:${b.isN}/${b.isGross}/${b.isNet} ${b.oosN}/${b.oosGross}/${b.oosNet}`).join('  ')); }
