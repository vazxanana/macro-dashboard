// Open run breadth: the unchanged NQ New York open run (council/trader.mjs nqOpenSweep + nyflip) on ES, YM and DAX, per
// preregistration.md (pushed before any of these candles were downloaded). Paper research only.
//   node research/edge/open-run-breadth/run.mjs <oandaCacheDir (spx500/us30/de40 from fetch.mjs)> <nq cache dir (#511 nas100-*.json)> [HistData SPXUSD dir]
// Writes result.json next to this file.
import fs from 'node:fs';
import path from 'node:path';
import { MARKETS, loadDays, dayTrade, midnightPrice, stats, corr } from './lib.mjs';
import { loadHistData } from '../nq-open-oos/load.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const [CACHE, NQDIR, SPXHD] = process.argv.slice(2);
const LATE = '2023-01-01', EARLY0 = 2004;
const NEW = ['spx500', 'us30', 'de40'];
const yearOf = (d) => +d.slice(0, 4);
const R = (tr) => tr.map((x) => x.R);
const out = { generated: new Date().toISOString(), preregistration: 'research/edge/open-run-breadth/preregistration.md',
  rule: 'nqOpenSweep(open, 0.08% run, reclaim within 15 min) traded WITH the run, local-midnight price ahead, stop buffer 0.011% of the open, 10R cap, trail 1R from +2R, out at open + 90 min',
  markets: Object.fromEntries(Object.entries(MARKETS).map(([k, v]) => [k, { ...v, openLocal: `${String(Math.floor(v.open / 60)).padStart(2, '0')}:${String(v.open % 60).padStart(2, '0')}` }])),
  excluded: { uk100: 'not served by the site OANDA proxy (api/_oanda.js); excluded before any data was read' } };

function quality(days, o) {
  const Y = new Map();
  for (const [d, a] of days) {
    const y = yearOf(d); let q = Y.get(y); if (!q) { q = { y, days: 0, hasOpen: 0, hasNdo: 0, cover: 0 }; Y.set(y, q); }
    q.days++; if (a.some((b) => b.m === o)) q.hasOpen++; if (midnightPrice(a) != null) q.hasNdo++;
    q.cover += a.filter((b) => b.m >= o && b.m <= o + 90).length / 91;
  }
  return [...Y.values()].map((q) => ({ year: q.y, days: q.days, hasOpen: +(q.hasOpen / q.days).toFixed(3), midnightPrice: +(q.hasNdo / q.days).toFixed(3), cover: +(q.cover / q.days).toFixed(3) }));
}
function run(days, opt) { const tr = []; for (const [d, a] of days) { const x = dayTrade(a, opt); if (x) tr.push({ d, ...x }); } return tr; }
const split = (tr) => ({ early: stats(R(tr.filter((x) => x.d < LATE))), late: stats(R(tr.filter((x) => x.d >= LATE))) });
const byYear = (tr) => { const g = new Map(); for (const x of tr) { const y = yearOf(x.d); if (!g.has(y)) g.set(y, []); g.get(y).push(x.R); } return [...g].sort((a, b) => a[0] - b[0]).map(([y, v]) => ({ year: y, ...stats(v) })); };
const line = (k, s) => `${k.padEnd(26)} n ${String(s.n).padStart(4)}  avg ${String(s.avg).padStart(7)}  t ${String(s.t).padStart(6)}  R ${String(s.R).padStart(7)}  win ${s.win}  dd ${s.dd}`;

function loadClean(dir, sym) {
  const M = MARKETS[sym], all = loadDays(dir, sym), q = quality(all, M.open);
  const clean = new Set(q.filter((r) => r.year >= EARLY0 && r.hasOpen >= 0.93 && r.cover >= 0.93 && r.midnightPrice >= 0.9).map((r) => r.year));
  return { M, days: new Map([...all].filter(([d]) => clean.has(yearOf(d)))), quality: q, clean: [...clean].sort() };
}

// ── calibration gate: generic code on the #511 NQ cache, live fixed 2-point buffer, 1 point → must give #511's numbers ──
const NQ = loadClean(NQDIR, 'nas100');
const cal = split(run(NQ.days, { o: 570, buf: 2, cost: 1 }));
out.calibration = { expect: { early: -0.018, late: 0.318 }, got: { early: cal.early, late: cal.late }, ok: cal.early.avg === -0.018 && cal.late.avg === 0.318 };
console.log('calibration (NQ, buf 2 pt, cost 1):', cal.early.avg, cal.late.avg, out.calibration.ok ? 'OK' : 'MISMATCH');
if (!out.calibration.ok) { console.error('calibration failed: not reading new-market results'); process.exit(2); }

// ── per market ──
const data = { nas100: NQ }; for (const s of NEW) data[s] = loadClean(CACHE, s);
out.results = {}; const primary = {};
for (const sym of ['nas100', ...NEW]) {
  const { M, days, quality: q, clean } = data[sym], o = M.open;
  const lateOpens = [...days].filter(([d]) => d >= LATE).map(([, a]) => a.find((b) => b.m === o)?.open).filter(Boolean).sort((a, b) => a - b);
  const medLate = lateOpens[lateOpens.length >> 1], scaledFrac = M.cost / medLate;
  const base = { o, cost: M.cost };
  const tr = run(days, base); primary[sym] = tr;
  const late = tr.filter((x) => x.d >= LATE), h = late.length >> 1;
  const variants = {
    gross: { ...base, cost: 0 }, cost2x: { ...base, cost: 2 * M.cost }, costScaled: { ...base, cost: (px) => px * scaledFrac },
    noMidnightFilter: { ...base, noNdo: true }, midnightBehind: { ...base, ndoBehind: true }, buffer0: { ...base, buf: 0 }, fixed2R: { ...base, trail: null } };
  if (sym === 'nas100') { variants.nqLive2ptBuf1pt = { o, buf: 2, cost: 1 }; variants.nqPctBuf1pt = { o, cost: 1 }; }
  const sens = Object.fromEntries(Object.entries(variants).map(([k, opt]) => [k, split(run(days, opt))]));
  const stops = (a) => { const v = a.map((x) => x.r0).sort((x, y) => x - y); return v.length ? +v[v.length >> 1].toFixed(2) : null; };
  const S = split(tr);
  const L = S.late.n > 0 && S.late.avg > 0 && S.late.t >= 2, E = S.early.n > 0 && S.early.avg >= 0;
  out.results[sym] = { name: M.name, cleanYears: clean, quality: q, costPts: M.cost, medianOpen2023: medLate, scaledCostPct: +(scaledFrac * 100).toFixed(4),
    early: S.early, late: S.late, lateHalves: [stats(R(late.slice(0, h))), stats(R(late.slice(h)))],
    medianStopPts: { early: stops(tr.filter((x) => x.d < LATE)), late: stops(late) },
    pass: { L, E, both: L && E }, byYear: byYear(tr), sensitivity: sens,
    trades: tr.map((x) => ({ d: x.d, m: x.m, side: x.side, entry: x.entry, r0: +x.r0.toFixed(2), gross: x.gross, R: +x.R.toFixed(3), exit: x.exit })) };
  console.log(`\n## ${M.name} (${sym}) clean ${clean[0]}-${clean.at(-1)} (${clean.length} yrs), cost ${M.cost} pt, median stop early ${out.results[sym].medianStopPts.early} late ${out.results[sym].medianStopPts.late}`);
  console.log(line('early 2004-22', S.early)); console.log(line('late 2023-26', S.late)); console.log('PASS L', L, 'E', E);
  for (const [k, v] of Object.entries(sens)) console.log(`  ${k.padEnd(18)} early ${v.early.avg} (t ${v.early.t}, n ${v.early.n}) | late ${v.late.avg} (t ${v.late.t}, n ${v.late.n})`);
  console.log('  byYear', out.results[sym].byYear.map((r) => `${r.year}:${r.avg}(${r.n})`).join(' '));
  const qs = q.filter((r) => !clean.includes(r.year)); if (qs.length) console.log('  dropped', JSON.stringify(qs));
}

// ── verdict per pre-registration ──
const passL = NEW.filter((s) => out.results[s].pass.L), passBoth = NEW.filter((s) => out.results[s].pass.both);
out.verdict = { passL: passL.map((s) => MARKETS[s].name), passBoth: passBoth.map((s) => MARKETS[s].name),
  label: passBoth.length >= 2 ? 'BROAD AND DURABLE' : passL.length >= 2 ? 'BROAD BUT REGIME-BOUND' : 'NQ-ONLY' };
console.log('\n## VERDICT', JSON.stringify(out.verdict));

// ── pooled new markets ──
const pooled = NEW.flatMap((s) => primary[s]);
out.pooledNew = split(pooled);
console.log('pooled ES+YM+DAX', JSON.stringify(out.pooledNew));

// ── dependence on NQ's own days ──
const nqMap = new Map(primary.nas100.map((x) => [x.d, x]));
out.dependence = {};
for (const s of NEW) {
  const res = {};
  for (const [w, f] of [['early', (x) => x.d < LATE], ['late', (x) => x.d >= LATE]]) {
    const tr = primary[s].filter(f), shared = tr.filter((x) => nqMap.has(x.d)), same = shared.filter((x) => nqMap.get(x.d).side === x.side), notNq = tr.filter((x) => !nqMap.has(x.d));
    res[w] = { trades: tr.length, alsoNqDay: shared.length, sameSide: same.length, corrRsameSide: corr(same.map((x) => x.R), same.map((x) => nqMap.get(x.d).R)),
      onNqDays: stats(R(shared)), notNqDays: stats(R(notNq)) };
  }
  out.dependence[s] = res;
  console.log(`dependence ${MARKETS[s].name}:`, JSON.stringify(res));
}
// day-level union: average R a day across the four markets on days any of them traded (late), to see the diversification
const dayMean = (syms, f) => { const g = new Map(); for (const s of syms) for (const x of primary[s].filter(f)) { if (!g.has(x.d)) g.set(x.d, []); g.get(x.d).push(x.R); } return stats([...g.entries()].sort().map(([, v]) => v.reduce((a, b) => a + b, 0) / v.length)); };
out.dailyBasket = { note: 'equal-weight R a day over the markets that traded that day (dates as local dates)',
  nqOnly: { early: dayMean(['nas100'], (x) => x.d < LATE), late: dayMean(['nas100'], (x) => x.d >= LATE) },
  all4: { early: dayMean(['nas100', ...NEW], (x) => x.d < LATE), late: dayMean(['nas100', ...NEW], (x) => x.d >= LATE) },
  new3: { early: dayMean(NEW, (x) => x.d < LATE), late: dayMean(NEW, (x) => x.d >= LATE) } };
console.log('daily basket', JSON.stringify(out.dailyBasket));

// ── cross-check: ES on HistData SPXUSD M1 2018-26 (council-data), same code ──
if (SPXHD && fs.existsSync(SPXHD)) {
  const HD = loadHistData(SPXHD), ht = run(HD, { o: 570, cost: MARKETS.spx500.cost });
  const om = new Map(primary.spx500.map((x) => [x.d, x])); let both = 0, same = 0; const dR = [];
  for (const x of ht) { const a = om.get(x.d); if (a) { both++; if (a.side === x.side) { same++; dR.push(a.R - x.R); } } }
  out.histdataES = { ...split(ht), byYear: byYear(ht), oandaTradesSameSpan: primary.spx500.filter((x) => x.d >= ht[0]?.d && x.d <= ht.at(-1)?.d).length, histTrades: ht.length, bothSignal: both, sameSide: same, meanRdiffSameSide: +(dR.reduce((a, b) => a + b, 0) / Math.max(1, dR.length)).toFixed(3) };
  console.log('\nHistData ES 2018-26', JSON.stringify({ ...out.histdataES, byYear: undefined }));
  console.log('  byYear', out.histdataES.byYear.map((r) => `${r.year}:${r.avg}(${r.n})`).join(' '));
}

fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1));
console.log('\nwrote result.json');
