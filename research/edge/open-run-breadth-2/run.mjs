// Open run breadth 2: the unchanged NQ New York open run (#543 lib.mjs, imported) at the cash open of seven more index
// markets, per preregistration.md (pushed before any of these candles were downloaded). Paper research only.
//   node research/edge/open-run-breadth-2/run.mjs <cacheDir (fetch.mjs output)> <nq cache dir (#511 nas100-*.json)> [#543 result.json]
// Writes result.json next to this file. With `--need5m` it only lists the market-years that fail the 1-minute coverage test.
import fs from 'node:fs';
import path from 'node:path';
import { MARKETS, partsIn, loadDays, dayTrade, midnightPrice, stats, corr } from '../open-run-breadth/lib.mjs';
import { MARKETS2, NEW } from './markets.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const [CACHE, NQDIR, PREV = path.join(HERE, '..', 'open-run-breadth', 'result.json')] = process.argv.filter((a) => !a.startsWith('--')).slice(2);
const NEED5M = process.argv.includes('--need5m');
const LATE = '2023-01-01', EARLY0 = 2004;
const yearOf = (d) => +d.slice(0, 4);
const R = (tr) => tr.map((x) => x.R);
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Day map from fetch.mjs files: Map<local date, [{time, open, high, low, close, vol, m}]>, m = local minute, -1 before midnight.
function loadDays2(dir, sym, tf) {
  const tz = MARKETS2[sym].tz, days = new Map(), re = new RegExp(`^${sym}${tf === '5m' ? '-5m' : ''}-\\d{4}\\.json$`);
  if (!fs.existsSync(dir)) return days;
  for (const f of fs.readdirSync(dir).filter((f) => re.test(f)).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const [d, rows] of Object.entries(j)) days.set(d, rows.map(([time, open, high, low, close, vol]) => { const p = partsIn(tz, time); return { time, open, high, low, close, vol, m: p.d === d ? p.m : -1 }; }));
  }
  return days;
}
// weekdays with any candle, per year; coverage of the 91 minutes (1m) or 19 candles (5m) o..o+90
function quality(days, o, tf = '1m') {
  const Y = new Map(), denom = tf === '5m' ? 19 : 91;
  for (const [d, a] of days) {
    const y = yearOf(d); let q = Y.get(y); if (!q) { q = { y, days: 0, hasOpen: 0, hasNdo: 0, cover: 0 }; Y.set(y, q); }
    q.days++; if (a.some((b) => b.m === o)) q.hasOpen++; if (midnightPrice(a) != null) q.hasNdo++;
    q.cover += Math.min(1, a.filter((b) => b.m >= o && b.m <= o + 90).length / denom);
  }
  return [...Y.values()].sort((a, b) => a.y - b.y).map((q) => ({ year: q.y, days: q.days, hasOpen: +(q.hasOpen / q.days).toFixed(3), midnightPrice: +(q.hasNdo / q.days).toFixed(3), cover: +(q.cover / q.days).toFixed(3) }));
}
const isClean = (r) => r.year >= EARLY0 && r.hasOpen >= 0.93 && r.cover >= 0.93 && r.midnightPrice >= 0.9;
function run(days, opt) { const tr = []; for (const [d, a] of days) { const x = dayTrade(a, opt); if (x) tr.push({ d, ...x }); } return tr; }
const split = (tr) => ({ early: stats(R(tr.filter((x) => x.d < LATE))), late: stats(R(tr.filter((x) => x.d >= LATE))) });
const byYear = (tr) => { const g = new Map(); for (const x of tr) { const y = yearOf(x.d); if (!g.has(y)) g.set(y, []); g.get(y).push(x.R); } return [...g].sort((a, b) => a[0] - b[0]).map(([y, v]) => ({ year: y, ...stats(v) })); };
const signs = (by) => ({ pos: by.filter((r) => r.avg > 0).length, neg: by.filter((r) => r.avg < 0).length });
const line = (k, s) => `${k.padEnd(22)} n ${String(s.n).padStart(4)}  avg ${String(s.avg).padStart(7)}  t ${String(s.t).padStart(6)}  R ${String(s.R).padStart(7)}  win ${s.win}  dd ${s.dd}`;
const med = (v) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };

// ── calibration gate: #543 code on the #511 NQ cache, live fixed 2-point buffer, 1 point → must give #511's numbers ──
const nqAll = loadDays(NQDIR, 'nas100'), nqQ = quality(nqAll, 570), nqClean = new Set(nqQ.filter(isClean).map((r) => r.year));
const NQdays = new Map([...nqAll].filter(([d]) => nqClean.has(yearOf(d))));
const cal = split(run(NQdays, { o: 570, buf: 2, cost: 1 }));
const calOk = cal.early.avg === -0.018 && cal.late.avg === 0.318;
console.log('calibration (NQ, buf 2 pt, cost 1):', cal.early.avg, `(n ${cal.early.n})`, cal.late.avg, `(n ${cal.late.n})`, calOk ? 'OK' : 'MISMATCH');
if (!calOk) { console.error('calibration failed: not reading new-market results'); process.exit(2); }

// ── data quality and the 5-minute fallback list ──
const data = {};
for (const sym of NEW) {
  const M = MARKETS2[sym], all1 = loadDays2(CACHE, sym, '1m'), q1 = quality(all1, M.open, '1m');
  const clean1 = q1.filter(isClean).map((r) => r.year);
  const all5 = loadDays2(CACHE, sym, '5m'), q5 = quality(all5, M.open, '5m');
  const need5 = q1.filter((r) => r.year >= EARLY0 && !isClean(r)).map((r) => r.year);
  const yearsSeen = new Set(q1.map((r) => r.year));
  for (let y = EARLY0; y <= 2026; y++) if (!yearsSeen.has(y)) need5.push(y);       // no 1m file at all for that year
  const clean5 = q5.filter((r) => isClean(r) && !clean1.includes(r.year)).map((r) => r.year);
  data[sym] = { M, q1, q5, clean1, clean5, need5: need5.sort(),
    days1: new Map([...all1].filter(([d]) => clean1.includes(yearOf(d)))), days5: new Map([...all5].filter(([d]) => clean5.includes(yearOf(d)))) };
  if (NEED5M) console.log(sym, 'need 5m for', need5.join(' ') || 'none', '| 5m clean so far', clean5.join(' ') || 'none');
}
if (NEED5M) process.exit(0);

const out = { generated: new Date().toISOString(), preregistration: 'research/edge/open-run-breadth-2/preregistration.md',
  rule: 'nqOpenSweep(open, 0.08% run, reclaim within 15 min) traded WITH the run, local-midnight price ahead, stop buffer 0.011% of the open, 10R cap, trail 1R from +2R, out at open + 90 min (#543 lib.mjs, imported unchanged)',
  calibration: { expect: { early: -0.018, late: 0.318 }, got: cal, ok: calOk },
  markets: Object.fromEntries(NEW.map((k) => [k, { ...MARKETS2[k], openLocal: hhmm(MARKETS2[k].open), exitLocal: hhmm(MARKETS2[k].open + 90) }])),
  results: {}, fallback5m: {} };

// ── per market ──
const primary = {};
function market(sym, days, M, tf) {
  const o = M.open;
  const lateOpens = [...days].filter(([d]) => d >= LATE).map(([, a]) => a.find((b) => b.m === o)?.open).filter(Boolean);
  const medLate = med(lateOpens) ?? med([...days].map(([, a]) => a.find((b) => b.m === o)?.open).filter(Boolean)), scaledFrac = medLate ? M.cost / medLate : 0;
  const base = { o, cost: M.cost }, tr = run(days, base);
  const late = tr.filter((x) => x.d >= LATE), early = tr.filter((x) => x.d < LATE), h = late.length >> 1;
  const variants = { gross: { ...base, cost: 0 }, cost2x: { ...base, cost: 2 * M.cost }, costScaled: { ...base, cost: (px) => px * scaledFrac },
    noMidnightFilter: { ...base, noNdo: true }, midnightBehind: { ...base, ndoBehind: true }, buffer0: { ...base, buf: 0 }, fixed2R: { ...base, trail: null } };
  const sens = Object.fromEntries(Object.entries(variants).map(([k, opt]) => [k, split(run(days, opt))]));
  const S = split(tr), by = byYear(tr);
  const L = S.late.n > 0 && S.late.avg > 0 && S.late.t >= 2, E = S.early.n > 0 && S.early.avg >= 0;
  const medStop = { early: med(early.map((x) => x.r0)), late: med(late.map((x) => x.r0)) };
  return { name: M.name, tf, costPts: M.cost, medianOpen2023: medLate, scaledCostPct: +(scaledFrac * 100).toFixed(4),
    early: S.early, late: S.late, lateHalves: [stats(R(late.slice(0, h))), stats(R(late.slice(h)))],
    medianStopPts: { early: medStop.early && +medStop.early.toFixed(2), late: medStop.late && +medStop.late.toFixed(2) },
    costShareOfStop: { early: medStop.early ? +(M.cost / medStop.early).toFixed(3) : null, late: medStop.late ? +(M.cost / medStop.late).toFixed(3) : null },
    pass: { L, E, both: L && E }, byYear: by, yearSigns: { early: signs(by.filter((r) => r.year < 2023)), late: signs(by.filter((r) => r.year >= 2023)) }, sensitivity: sens,
    tradeCols: ['d', 'm', 'side', 'entry', 'r0', 'gross', 'R', 'exit'],
    trades: tr.map((x) => [x.d, x.m, x.side, x.entry, +x.r0.toFixed(2), x.gross, +x.R.toFixed(3), x.exit]), _tr: tr };
}
function show(sym, r, clean) {
  console.log(`\n## ${r.name} (${sym}, ${r.tf}) clean ${clean[0]}-${clean.at(-1)} (${clean.length} yrs), cost ${r.costPts} pt, median stop early ${r.medianStopPts.early} late ${r.medianStopPts.late} (cost share ${r.costShareOfStop.early} / ${r.costShareOfStop.late})`);
  console.log(line('early 2004-22', r.early)); console.log(line('late 2023-26', r.late)); console.log('PASS L', r.pass.L, 'E', r.pass.E, 'halves', r.lateHalves.map((s) => `${s.avg}(${s.n})`).join(' '));
  for (const [k, v] of Object.entries(r.sensitivity)) console.log(`  ${k.padEnd(18)} early ${v.early.avg} (t ${v.early.t}, n ${v.early.n}) | late ${v.late.avg} (t ${v.late.t}, n ${v.late.n})`);
  console.log('  byYear', r.byYear.map((x) => `${x.year}:${x.avg}(${x.n})`).join(' '), '| signs early', JSON.stringify(r.yearSigns.early), 'late', JSON.stringify(r.yearSigns.late));
}
for (const sym of NEW) {
  const D = data[sym], lateClean1 = D.clean1.filter((y) => y >= 2023);
  const r1 = D.clean1.length ? market(sym, D.days1, D.M, '1m') : null;
  const r5 = D.clean5.length ? market(sym, D.days5, D.M, '5m') : null;
  const barOn = lateClean1.length >= 2 || !r5 ? '1m' : '5m';
  const bar = barOn === '1m' ? r1 : r5;
  out.results[sym] = { ...(bar || { name: D.M.name, pass: { L: false, E: false, both: false }, early: stats([]), late: stats([]) }), barOn, noData: !bar,
    cleanYears1m: D.clean1, clean5mOnly: D.clean5, unclean1m: D.need5, quality1m: D.q1, quality5m: D.q5 };
  delete out.results[sym]._tr;
  primary[sym] = bar ? bar._tr : [];
  if (r1) show(sym, r1, D.clean1); else console.log(`\n## ${D.M.name} (${sym}): no clean 1-minute year`);
  if (r5) { out.fallback5m[sym] = { ...r5, trades: undefined, _tr: undefined, years: D.clean5 }; show(sym, r5, D.clean5); }
  if (D.need5.length) console.log('  1m unclean years:', D.need5.join(' '), '| dropped 1m quality:', JSON.stringify(D.q1.filter((r) => !isClean(r) && r.year >= EARLY0)));
  if (barOn === '5m') console.log('  BAR JUDGED ON 5m (fewer than 2 clean 1m years in 2023-26)');
}

// ── verdict per pre-registration ──
const passL = NEW.filter((s) => out.results[s].pass.L), passBoth = NEW.filter((s) => out.results[s].pass.both);
out.verdict = { passL: passL.map((s) => MARKETS2[s].name), passBoth: passBoth.map((s) => MARKETS2[s].name), barOn: Object.fromEntries(NEW.map((s) => [s, out.results[s].barOn])),
  label: passBoth.length >= 3 ? 'BROAD AND DURABLE' : passL.length >= 3 ? 'BROAD BUT REGIME-BOUND' : 'NQ-ONLY' };
console.log('\n## VERDICT', JSON.stringify(out.verdict));

// ── pooled ──
const pooled7 = NEW.flatMap((s) => primary[s]);
out.pooledNew7 = { ...split(pooled7), byYear: byYear(pooled7) };
console.log('pooled 7 new', JSON.stringify({ early: out.pooledNew7.early, late: out.pooledNew7.late }));
if (fs.existsSync(PREV)) {
  const prev = JSON.parse(fs.readFileSync(PREV, 'utf8'));
  const prevTr = ['spx500', 'us30', 'de40'].flatMap((s) => (prev.results?.[s]?.trades || []).map(([d, m, side, entry, r0, gross, Rv]) => ({ d, m, side, entry, r0, gross, R: Rv, sym: s })));
  out.pooledAll10 = { note: 'the seven here plus #543 ES, YM, DAX (its result.json trades)', ...split([...pooled7, ...prevTr]), prev3: split(prevTr) };
  console.log('pooled all 10 non-NQ', JSON.stringify({ early: out.pooledAll10.early, late: out.pooledAll10.late }));
}

// ── NQ reference at the #543 primary (0.011% buffer, 1.37 pt) and dependence on NQ's days ──
const nqTr = run(NQdays, { o: 570, cost: MARKETS.nas100.cost });
out.nqReference = { ...split(nqTr), byYear: byYear(nqTr).filter((r) => r.year >= 2023), cost: MARKETS.nas100.cost };
const nqMap = new Map(nqTr.map((x) => [x.d, x]));
out.dependence = {};
for (const s of NEW) {
  const res = {};
  for (const [w, f] of [['early', (x) => x.d < LATE], ['late', (x) => x.d >= LATE]]) {
    const tr = primary[s].filter(f), shared = tr.filter((x) => nqMap.has(x.d)), same = shared.filter((x) => nqMap.get(x.d).side === x.side), notNq = tr.filter((x) => !nqMap.has(x.d));
    res[w] = { trades: tr.length, alsoNqDay: shared.length, sameSide: same.length, corrRsameSide: corr(same.map((x) => x.R), same.map((x) => nqMap.get(x.d).R)),
      onNqDays: stats(R(shared)), notNqDays: stats(R(notNq)), sameSideDays: stats(R(same)), nqOnSameSideDays: stats(same.map((x) => nqMap.get(x.d).R)) };
  }
  out.dependence[s] = res;
  console.log(`dependence ${MARKETS2[s].name} late:`, JSON.stringify(res.late));
}
// NQ on the days us2000 fired versus the rest (late)
{
  const r2k = new Set(primary.us2000.filter((x) => x.d >= LATE).map((x) => x.d)), lateNq = nqTr.filter((x) => x.d >= LATE);
  out.nqSplitByRussell = { nqOnRussellDays: stats(R(lateNq.filter((x) => r2k.has(x.d)))), nqOnOtherDays: stats(R(lateNq.filter((x) => !r2k.has(x.d)))) };
  console.log('NQ late on Russell days / other days', JSON.stringify(out.nqSplitByRussell));
}
// equal-weight daily basket, late
const dayMean = (series, f) => { const g = new Map(); for (const tr of series) for (const x of tr.filter(f)) { if (!g.has(x.d)) g.set(x.d, []); g.get(x.d).push(x.R); } return stats([...g.entries()].sort().map(([, v]) => v.reduce((a, b) => a + b, 0) / v.length)); };
out.dailyBasket = { note: 'equal-weight R a day over the markets that traded that local date', late: {
  nqOnly: dayMean([nqTr], (x) => x.d >= LATE), new7: dayMean(NEW.map((s) => primary[s]), (x) => x.d >= LATE), nqPlus7: dayMean([nqTr, ...NEW.map((s) => primary[s])], (x) => x.d >= LATE) },
  early: { new7: dayMean(NEW.map((s) => primary[s]), (x) => x.d < LATE) } };
console.log('daily basket', JSON.stringify(out.dailyBasket));

fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1).replace(/\[\n\s*("[^"\n]*"|-?[\d.]+)((?:,\n\s*(?:"[^"\n]*"|-?[\d.e-]+))+)\n\s*\]/g, (m) => m.replace(/\n\s*/g, '')));
console.log('\nwrote result.json');
