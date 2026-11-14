// NQ New York open run: the live rule replayed year by year on the longest free history (OANDA NAS100_USD 1m via the site's
// proxy, from 2003), cross-checked on HistData NSXUSD 2018-26 and the council's own replay records. Paper research only.
//   node research/edge/nq-open-oos/run.mjs <oandaDir> <histdataDir> [replay-2w.json] > out.txt   (writes result.json next to this file)
//
// PRE-REGISTERED REGIME SWITCH (fixed before any regime split was computed; see RESULT.md):
//   trend = today's 09:30 ET opening price vs the average of the previous 200 trading days' 09:30 opens (known before the
//   signal, no look-ahead). Two states: above / below. The state to trade is chosen on the early data (clean years before 2023)
//   as the one with the higher R a trade; that choice is then judged, unchanged, on 2023 - Oct 2026. It passes only if, on the
//   late data, the chosen state is positive with t >= 2 AND beats the other state AND does not lower the late R a trade.
import fs from 'node:fs';
import path from 'node:path';
import { dayTrade, stats, welch, nyParts, midnightPrice } from './lib.mjs';
import { loadOanda, loadHistData } from './load.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const [OANDA, HIST, REPLAY] = process.argv.slice(2);
const COST = 1;                                // points, round trip (task: about 1 point)
const LATE = '2023-01-01';                     // the rule was built on 2023-26 data (robustness FIT 'nq-open')
const yearOf = (d) => +d.slice(0, 4);
const out = { generated: new Date().toISOString(), rule: 'council/trader.mjs nqOpenSweep(bars, day, 570, 0, 0.0008) + nyflip (midnight open ahead) + nqRun trail [2, 1], 10R cap, out 11:00 ET', cost: `${COST} point round trip` };

// ── data quality by year ──
function quality(days) {
  const Y = new Map();
  for (const [d, a] of days) {
    const y = yearOf(d); let q = Y.get(y); if (!q) { q = { y, days: 0, has0930: 0, hasMid: 0, hasNdo: 0, cover: 0, vol: [] }; Y.set(y, q); }
    q.days++; if (a.some((b) => b.m === 570)) q.has0930++; if (a.some((b) => b.m === 0)) q.hasMid++; if (midnightPrice(a) != null) q.hasNdo++;
    const w = a.filter((b) => b.m >= 570 && b.m <= 660); q.cover += w.length / 91; for (const b of w) q.vol.push(b.vol);
  }
  return [...Y.values()].map((q) => { q.vol.sort((a, b) => a - b); return { year: q.y, days: q.days, has0930: +(q.has0930 / q.days).toFixed(3), midnight0000: +(q.hasMid / q.days).toFixed(3), midnightPrice: +(q.hasNdo / q.days).toFixed(3), cover: +(q.cover / q.days).toFixed(3), medVol: q.vol[q.vol.length >> 1] || 0 }; });
}
function run(days, opt = {}) { const tr = []; for (const [d, a] of days) { const x = dayTrade(a, opt); if (x) tr.push({ d, ...x }); } return tr; }
const R = (tr) => tr.map((x) => x.R);
function byKey(tr, key) { const g = new Map(); for (const x of tr) { const k = key(x); if (!g.has(k)) g.set(k, []); g.get(k).push(x.R); } return [...g].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => ({ k, ...stats(v) })); }
const fmtRow = (r) => `${String(r.k).padEnd(12)} n ${String(r.n).padStart(4)}  R ${String(r.R).padStart(7)}  avg ${String(r.avg).padStart(6)}  t ${String(r.t).padStart(5)}  win ${r.win}  dd ${r.dd}`;
const show = (title, rows) => { console.log('\n## ' + title); for (const r of rows) console.log(fmtRow(r)); };

// ── load ──
const OD = loadOanda(OANDA);
out.quality = quality(OD); console.log('## OANDA NAS100 quality by year'); for (const q of out.quality) console.log(JSON.stringify(q));
// clean = the 09:30 candle on >= 93% of weekdays, >= 93% of the 09:30-11:00 minutes present (holidays count against both)
// and a midnight price on >= 90% of weekdays
const CLEAN = new Set(out.quality.filter((q) => q.has0930 >= 0.93 && q.cover >= 0.93 && q.midnightPrice >= 0.9).map((q) => q.year));
const firstClean = Math.min(...CLEAN); out.cleanYears = [...CLEAN].sort();
const OC = new Map([...OD].filter(([d]) => CLEAN.has(yearOf(d))));
console.log('clean years', out.cleanYears.join(' '));

// ── main: live rule, 1 point ──
const live = run(OC, { cost: COST });
out.byYear = byKey(live, (x) => yearOf(x.d)); show('Live rule by year (OANDA, 1 pt)', out.byYear);
out.r0ByYear = Object.fromEntries([...new Set(live.map((x) => yearOf(x.d)))].map((y) => { const v = live.filter((x) => yearOf(x.d) === y).map((x) => x.r0).sort((a, b) => a - b), md = v[v.length >> 1];
  return [y, { medianStopPts: +md.toFixed(1), costShareR: +(COST / md).toFixed(3), grossAvg: stats(live.filter((x) => yearOf(x.d) === y).map((x) => x.gross)).avg }]; }));
console.log('stop size / gross by year', JSON.stringify(out.r0ByYear));
out.all = stats(R(live)); console.log('ALL', JSON.stringify(out.all));
const early = live.filter((x) => x.d < LATE), late = live.filter((x) => x.d >= LATE);
out.periods = { untouched: { from: early[0]?.d, to: early.at(-1)?.d, ...stats(R(early)) }, built: { from: late[0]?.d, to: late.at(-1)?.d, ...stats(R(late)) }, welch: welch(R(late), R(early)) };
const h = live.length >> 1;
out.halves = { first: { from: live[0].d, to: live[h - 1].d, ...stats(R(live.slice(0, h))) }, second: { from: live[h].d, to: live.at(-1).d, ...stats(R(live.slice(h))) } };
console.log('\nperiods', JSON.stringify(out.periods)); console.log('halves', JSON.stringify(out.halves));
// cost sensitivity: gross, 1 pt scaled to the price level (1 pt at 25,000 = 0.004%), 2 pt
const sens = {
  gross: run(OC, { cost: 0 }), cost05: run(OC, { cost: 0.5 }), scaled: run(OC, { cost: (px) => px * 0.00004 }), cost2: run(OC, { cost: 2 }),
  strict: run(OC, { cost: COST, strict: true }), bufPct: run(OC, { cost: COST, bufPct: true }), fixed2R: run(OC, { cost: COST, trail: null }),
  ndoExact: run(OC, { cost: COST, ndoExact: true }), noNdo: run(OC, { cost: COST, noNdo: true }), ndoBehind: run(OC, { cost: COST, ndoBehind: true }) };
out.sensitivity = {};
for (const [k, tr] of Object.entries(sens)) {
  const e = tr.filter((x) => x.d < LATE), l = tr.filter((x) => x.d >= LATE);
  out.sensitivity[k] = { all: stats(R(tr)), early: stats(R(e)), late: stats(R(l)), byYear: Object.fromEntries(byKey(tr, (x) => yearOf(x.d)).map((r) => [r.k, r.avg])) };
  console.log('sens', k.padEnd(10), 'all', JSON.stringify(out.sensitivity[k].all), '| early', out.sensitivity[k].early.avg, out.sensitivity[k].early.t, '| late', out.sensitivity[k].late.avg, out.sensitivity[k].late.t);
}

// eras: OANDA's thin-quote years (stops of 5-8 points, so 1 point is 0.13-0.2R), the mature-data years before the rule, the rule's years
const ERAS = [['2004-2013', 2004, 2013], ['2014-2022', 2014, 2022], ['2023-2026', 2023, 2026]];
out.eras = ERAS.map(([k, a, b]) => { const f = (tr) => R(tr.filter((x) => yearOf(x.d) >= a && yearOf(x.d) <= b));
  return { era: k, net1pt: stats(f(live)), net05pt: stats(f(sens.cost05)), gross: stats(f(sens.gross)), netScaled: stats(f(sens.scaled)) }; });
console.log('\n## Eras'); for (const e of out.eras) console.log(e.era, 'net1', JSON.stringify(e.net1pt), '| net0.5', e.net05pt.avg, e.net05pt.t, '| gross', e.gross.avg, e.gross.t, '| scaled', e.netScaled.avg, e.netScaled.t);

// ── by weekday, entry time, side ──
const wd = (x) => ({ Mon: '1 Mon', Tue: '2 Tue', Wed: '3 Wed', Thu: '4 Thu', Fri: '5 Fri' })[nyParts(x.t).wd];
const tb = (x) => (x.m < 585 ? '09:31-09:44' : x.m < 600 ? '09:45-09:59' : x.m < 630 ? '10:00-10:29' : '10:30-10:59');
const sd = (x) => (x.side > 0 ? 'buy' : 'sell');
out.cuts = {};
for (const [nm, f] of [['weekday', wd], ['entryTime', tb], ['side', sd]]) {
  out.cuts[nm] = { early: byKey(early, f), late: byKey(late, f) };
  show(`${nm}: before 2023 (untouched)`, out.cuts[nm].early); show(`${nm}: 2023-26 (built)`, out.cuts[nm].late);
}

// ── walk-forward 1: parameters re-chosen every year on the previous 3 years (20-cell grid), traded the next year ──
const GRID = []; for (const minPen of [0.0004, 0.0006, 0.0008, 0.0010, 0.0014]) for (const noNdo of [false, true]) for (const trail of [[2, 1], null]) GRID.push({ minPen, noNdo, trail, cost: COST });
const gridTr = GRID.map((o) => run(OC, o));
const years = [...CLEAN].sort(), wf = [];
for (const y of years) {
  const tr3 = years.filter((z) => z >= y - 3 && z < y); if (tr3.length < 3) continue;
  let best = -1, bv = -Infinity; GRID.forEach((o, i) => { const v = gridTr[i].filter((x) => tr3.includes(yearOf(x.d))); if (v.length < 30) return; const s = v.reduce((a, x) => a + x.R, 0); if (s > bv) { bv = s; best = i; } });
  if (best < 0) continue; const test = gridTr[best].filter((x) => yearOf(x.d) === y);
  wf.push({ year: y, pick: GRID[best], trainR: +bv.toFixed(1), ...stats(R(test)), trades: test });
}
const wfAll = wf.flatMap((w) => w.trades);
out.walkForward = { method: 'each year: pick the best of 20 cells (run 0.04-0.14% x midnight filter on/off x runner/2R) by total R over the previous 3 clean years, trade it the next year', years: wf.map(({ trades, ...w }) => w), all: stats(R(wfAll)), early: stats(R(wfAll.filter((x) => x.d < LATE))), late: stats(R(wfAll.filter((x) => x.d >= LATE))) };
console.log('\n## Walk-forward (3y train -> 1y test)'); for (const w of out.walkForward.years) console.log(w.year, JSON.stringify(w.pick), 'train', w.trainR, '| test n', w.n, 'avg', w.avg, 't', w.t, 'R', w.R);
console.log('WF all', JSON.stringify(out.walkForward.all), 'early', JSON.stringify(out.walkForward.early), 'late', JSON.stringify(out.walkForward.late));
// walk-forward 2: the fixed live rule, traded in year y only when its previous 2 years were positive (a "keep it while it works" switch)
const wf2 = []; for (const y of years) { const prev = live.filter((x) => yearOf(x.d) >= y - 2 && yearOf(x.d) < y); if (years.filter((z) => z >= y - 2 && z < y).length < 2) continue; const on = prev.reduce((a, x) => a + x.R, 0) > 0; wf2.push({ year: y, on, prevR: +prev.reduce((a, x) => a + x.R, 0).toFixed(1), ...stats(R(live.filter((x) => yearOf(x.d) === y))) }); }
const wf2on = live.filter((x) => wf2.some((w) => w.on && w.year === yearOf(x.d)));
out.walkForwardSwitch = { method: 'live rule, traded in a year only if the previous 2 years summed > 0', years: wf2, on: stats(R(wf2on)), onLate: stats(R(wf2on.filter((x) => x.d >= LATE))), onEarly: stats(R(wf2on.filter((x) => x.d < LATE))) };
console.log('WF switch', JSON.stringify(out.walkForwardSwitch.on), 'early', JSON.stringify(out.walkForwardSwitch.onEarly));

// ── pre-registered regime switch: trend = 09:30 open vs the 200-day average of 09:30 opens ──
const opens = [...OD].map(([d, a]) => [d, a.find((b) => b.m === 570)?.open]).filter((x) => x[1] != null);
const trend = new Map(); for (let i = 200; i < opens.length; i++) { let s = 0; for (let j = i - 200; j < i; j++) s += opens[j][1]; trend.set(opens[i][0], opens[i][1] > s / 200 ? 'above' : 'below'); }
const tag = live.filter((x) => trend.has(x.d)).map((x) => ({ ...x, reg: trend.get(x.d) }));
const E = tag.filter((x) => x.d < LATE), L = tag.filter((x) => x.d >= LATE);
const pick = (stats(R(E.filter((x) => x.reg === 'above'))).avg >= stats(R(E.filter((x) => x.reg === 'below'))).avg) ? 'above' : 'below', other = pick === 'above' ? 'below' : 'above';
const lOn = L.filter((x) => x.reg === pick), lOff = L.filter((x) => x.reg === other);
const sOn = stats(R(lOn)), sOff = stats(R(lOff)), sAll = stats(R(L));
out.regime = { switch: 'trade only when the 09:30 open is on the chosen side of the prior 200-day average of 09:30 opens', chosenOnEarly: pick,
  early: { above: stats(R(E.filter((x) => x.reg === 'above'))), below: stats(R(E.filter((x) => x.reg === 'below'))), welch: welch(R(E.filter((x) => x.reg === pick)), R(E.filter((x) => x.reg === other))) },
  late: { on: sOn, off: sOff, all: sAll, welch: welch(R(lOn), R(lOff)) },
  byYear: byKey(tag, (x) => `${yearOf(x.d)} ${x.reg}`),
  pass: !!(sOn.t >= 2 && sOn.avg > (sOff.avg ?? -Infinity) && sOn.avg >= sAll.avg) };
console.log('\n## Regime switch (pre-registered: trend200)'); console.log(JSON.stringify(out.regime.early)); console.log('chosen', pick, 'late', JSON.stringify(out.regime.late), 'PASS', out.regime.pass);

// ── cross-checks: HistData NSXUSD (council-data) and the council's own replay records ──
if (HIST) {
  const HD = loadHistData(HIST), ht = run(HD, { cost: COST });
  out.histdata = { byYear: byKey(ht, (x) => yearOf(x.d)), all: stats(R(ht)), early: stats(R(ht.filter((x) => x.d < LATE))), late: stats(R(ht.filter((x) => x.d >= LATE))) };
  show('HistData NSXUSD, same code, 1 pt', out.histdata.byYear);
  // day-level agreement with OANDA on overlapping days
  const om = new Map(live.map((x) => [x.d, x])), hm = new Map(ht.map((x) => [x.d, x])); let both = 0, sameSide = 0, onlyO = 0, onlyH = 0; const dR = [];
  for (const d of new Set([...om.keys(), ...hm.keys()])) { if (!OC.has(d) || !HD.has(d)) continue; const a = om.get(d), b = hm.get(d);
    if (a && b) { both++; if (a.side === b.side) { sameSide++; dR.push(a.R - b.R); } } else if (a) onlyO++; else if (b) onlyH++; }
  out.agreeHistData = { bothSignal: both, sameSide, onlyOanda: onlyO, onlyHistData: onlyH, meanRdiffSameSide: +(dR.reduce((a, x) => a + x, 0) / Math.max(1, dR.length)).toFixed(3) };
  console.log('agreement OANDA vs HistData', JSON.stringify(out.agreeHistData));
}
if (REPLAY && fs.existsSync(REPLAY)) {
  const rp = JSON.parse(fs.readFileSync(REPLAY, 'utf8')).trades.filter((x) => x.k === 'nq-open' && x.session === 'nyflip');
  const rm = new Map(rp.map((x) => [x.id.replace('replay-nq-nyflip-', ''), x])), om = new Map(live.map((x) => [x.d, x]));
  let both = 0, same = 0, onlyR = 0, onlyO = 0; const ra = [], oa = [];
  for (const [d, x] of rm) { if (!OC.has(d)) continue; const o = om.get(d); if (o) { both++; if ((x.side === 'buy' ? 1 : -1) === o.side) { same++; ra.push(x.R); oa.push(o.R); } } else onlyR++; }
  const span = [...rm.keys()].sort(); for (const [d] of om) if (d >= span[0] && d <= span.at(-1) && !rm.has(d)) onlyO++;
  out.agreeCouncilReplay = { councilTrades: rp.length, bothSignal: both, sameSide: same, onlyCouncil: onlyR, onlyOanda: onlyO, councilRonShared: stats(ra), oandaRonShared: stats(oa) };
  console.log('agreement with council replay', JSON.stringify(out.agreeCouncilReplay));
}
// trade list (compact) for audit
out.trades = live.map((x) => ({ d: x.d, m: x.m, side: x.side, entry: x.entry, r0: +x.r0.toFixed(2), gross: x.gross, R: +x.R.toFixed(3), exit: x.exit }));
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1));
console.log('\nwrote result.json');
