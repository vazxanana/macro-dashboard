// Edge research · gold-carry (PREREGISTRATION.md, committed first): what it costs to hold a gold buy the way the live paper
// book holds it, route by route (the demo broker's CFD swap, other CFD brokers' published swaps, CME micro gold futures,
// a spot-gold ETF), and what the supported book's figures are at each. No trading rule is tested or changed.
//   node --use-env-proxy run.mjs fetch   rates.json (council-data FRED cache) and basis.json (GCZ26 prints vs OANDA spot)
//   node run.mjs                         the gate against supported-book/result.json, then result.json
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, FIN_DAY } from '../../../council/fills.mjs';
import { BOOKS, WINDOWS, bookStats, bootstrap, positions, weekdays, dayOf } from '../supported-book/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const rN = (d) => (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(d));
const r1 = rN(1), r2 = rN(2), r3 = rN(3), r4 = rN(4);

// ── constants fixed in the pre-registration ──
export const DEMO = FIN.xau.long * 365;               // the demo broker's long swap as a rate a year (7 rollovers a week)
export const EXPIRY = Date.UTC(2026, 11, 29) / 1000;  // GCZ26 last trading day (third last business day of December 2026)
export const EXPIRY_ALT = Date.UTC(2026, 11, 1) / 1000;   // sensitivity: first delivery day
export const MGC_OZ = 10, TICK = 0.10;
// All-in round trip a public source states for one MGC contract (commission + exchange + clearing + NFA): see SOURCES.mgc
export const MGC_RT = 2.12;
export const GRID = Array.from({ length: 15 }, (_, i) => i * 0.005);
export const SOFR_ASOF = '2026-11-11';                // the day FIN was read

// What the session could read (web search result summaries of publisher pages; the pages themselves could not be opened).
// Each broker figure: US dollars a 100-ounce lot a night, long side, negative = the trader pays.
export const SOURCES = {
  cfd: [
    { key: 'icm', name: 'IC Markets, Raw account', perLot: -57.55, date: '2026-09-03', src: 'Finance Magnates article "The battle for gold traders moves overnight: 32 accounts charge, one offers positive swaps" (ForexBenchmark data), as republished by coinspectator.com on 3 Sep 2026; seen in a web search summary on 12 Nov 2026, page not opened' },
    { key: 'afterprime', name: 'Afterprime', perLot: -70.26, date: '2026-09-03', src: 'the same article' },
    { key: 'pepperstone', name: 'Pepperstone UK', perLot: -95.58, date: '2026-09-03', src: 'the same article' },
    { key: 'dlsm', name: 'DLSM (the lowest in one monthly review)', perLot: -4.33, date: '2026-01-15', dateNote: 'January 2026 review, day not given: mid-month used', src: 'FastBull BrokersView "January 2026 swap rates review" ("lowest among all brokers"); seen in a web search summary on 12 Nov 2026, page not opened' },
  ],
  etf: [
    { key: 'gldm', name: 'GLDM', er: 0.0010 }, { key: 'iau', name: 'IAU', er: 0.0025 }, { key: 'gld', name: 'GLD', er: 0.0040 },
  ],
  etfSrc: 'expense ratios as listed by Snowball Analytics, Nasdaq and 247wallst (July 2026), seen in a web search summary on 12 Nov 2026, pages not opened; the issuers\' own pages were not reached',
  mgc: 'all-in round trip for one E-Micro Gold contract: $2.12, a Tradeify help page (a prop firm, not a broker the desk uses); Interactive Brokers lists $0.10-0.25 a contract a side plus exchange and regulatory fees, and the last CME non-member micro gold fee found was $0.50 a side (AMP notice, February 2021): seen in web search summaries on 12 Nov 2026, pages not opened',
  rates: 'FRED DGS2 (weekly, from the council macro strategist cache, council-data macro/cache.json score.fred) and SOFR / EFFR (daily since Aug 2025, same file, fred); fred.stlouisfed.org itself could not be reached',
  basis: 'COMEX GCZ26 one-minute prints from council-data research/probe/cnbc-gc (CNBC, 1 Jan to 4 Nov 2026) against OANDA XAU_USD one-minute mid candles through the candle proxy',
};

// ── rate series: as of the latest value on or before a day ──
export function asOf(series) {             // series: [[YYYY-MM-DD, value %], …] sorted
  const s = series.filter((x) => Number.isFinite(x[1])).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return (day) => { let lo = 0, hi = s.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (s[m][0] <= day) { k = m; lo = m + 1; } else hi = m - 1; } return k < 0 ? null : s[k][1] / 100; };
}

// ── financing of one unit under a rate function (a year, of price) ──
// the nights() rule of council/fills.mjs (Mon-Fri 22:00 UTC strictly inside the hold, Wednesday three), each night at its rate
export function carryR(u, rate) {
  let f = 0;
  if (!Number.isFinite(u.t) || !Number.isFinite(u.c)) return 0;
  for (let d = Math.floor(u.t / FIN_DAY) * FIN_DAY + 22 * 3600; d < u.c; d += FIN_DAY) {
    if (d <= u.t) continue;
    const w = new Date(d * 1000).getUTCDay(); if (w < 1 || w > 5) continue;
    const r = typeof rate === 'function' ? rate(dayOf(d)) : rate;
    f += (w === 3 ? 3 : 1) * Math.max(0, r || 0) / 365;
  }
  return f * u.e / u.r0;
}
// even-month MGC roll dates (council/futures.mjs: 8 days before the 1st of each even month) strictly inside a hold
export function rolls(t, c) {
  let n = 0;
  for (let y = new Date(t * 1000).getUTCFullYear(); y <= new Date(c * 1000).getUTCFullYear(); y++)
    for (let m = 2; m <= 12; m += 2) { const r = Date.UTC(y, m - 1, 1) / 1000 - 8 * 86400; if (r > t && r < c) n++; }
  return n;
}
export const mgcFeesR = (u, rt = MGC_RT) => (rt / MGC_OZ + rolls(u.t, u.c) * (rt / MGC_OZ + TICK)) / u.r0;

// units with a route's cost taken off their gross R (the supported-book functions then run with fin: 0)
export const charge = (legs, rate, fees) => legs.map((u) => ({ ...u, R: u.R - carryR(u, rate) - (fees ? fees(u) : 0) }));

// ── the basis ──
export const ln = Math.log;
export function dayBasis(pairs, t0) {      // pairs: [[F, S], …] matched minutes of one day; t0 a minute of that day
  if (pairs.length < 5) return null;
  const b = pairs.map(([F, S]) => ln(F / S)).sort((a, c) => a - c), m = b.length >> 1, med = b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
  return { b: med, n: pairs.length, tau: (EXPIRY - t0) / 86400 / 365.25, tauAlt: (EXPIRY_ALT - t0) / 86400 / 365.25 };
}
const median = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export function basisSummary(days, sofr) {
  const rows = days.filter((d) => d.tau * 365.25 >= 30).map((d) => ({ ...d, k: d.b / d.tau, kAlt: d.b / d.tauAlt, sofr: sofr(d.day) }));
  const byM = {}; for (const r of rows) (byM[r.day.slice(0, 7)] ||= []).push(r);
  const months = Object.fromEntries(Object.entries(byM).map(([m, L]) => [m, { days: L.length, k: r4(median(L.map((r) => r.k))), sofr: r4(median(L.map((r) => r.sofr))), lease: r4(median(L.filter((r) => r.sofr != null).map((r) => r.sofr - r.k))) }]));
  const last = rows.slice(-20);
  return { days: rows.length, from: rows[0]?.day, to: rows.at(-1)?.day, k: r4(median(rows.map((r) => r.k))), kAlt: r4(median(rows.map((r) => r.kAlt))),
    kNow: r4(median(last.map((r) => r.k))), kNowAlt: r4(median(last.map((r) => r.kAlt))), nowFrom: last[0]?.day, nowTo: last.at(-1)?.day,
    sofrNow: r4(median(last.map((r) => r.sofr))), leaseNow: r4(median(last.filter((r) => r.sofr != null).map((r) => r.sofr - r.k))), months };
}

// ── fetch ──
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MD = process.env.MD_BASE || 'https://macro-dashboard-xau.vercel.app/md/bars';
async function bars(q) { for (let k = 0; k < 4; k++) { try { const r = await fetch(`${MD}?${q}`); if (r.ok) return (await r.json()).bars || []; } catch {} await sleep(1500 * (k + 1)); } throw new Error('candle proxy failed: ' + q); }
async function fetchAll() {
  const ref = execFileSync('git', ['rev-parse', 'origin/council-data'], { cwd: HERE }).toString().trim();
  const show = (p) => execFileSync('git', ['show', `${ref}:${p}`], { cwd: HERE, maxBuffer: 1 << 28 });
  const cache = JSON.parse(show('macro/cache.json'));
  const rates = { note: SOURCES.rates, councilData: ref, DGS2: cache.score.fred.DGS2, SOFR: cache.fred.SOFR, EFFR: cache.fred.EFFR };
  // OANDA gold daily closes for the broker figures' dates
  const d1 = await bars(`sym=xau&tf=1d&from=${Date.UTC(2025, 11, 20) / 1000}&to=${Date.UTC(2026, 10, 12) / 1000}`);
  rates.xauClose = d1.map((b) => [dayOf(b.time), b.close]);
  fs.writeFileSync(path.join(HERE, 'rates.json'), JSON.stringify(rates));
  // GCZ26 prints, 14:00-17:00 UTC, volume ≥ 1
  const files = execFileSync('git', ['ls-tree', '--full-tree', '--name-only', ref, 'research/probe/cnbc-gc/'], { cwd: HERE }).toString().split('\n').filter((f) => /\/gc-\d+\.json\.gz$/.test(f));
  const gc = new Map(); let sym = new Set();
  for (const f of files) {
    const j = JSON.parse(zlib.gunzipSync(show(f)).toString()); sym.add(`${(j.barData && j.barData.symbol) || '?'} (asked ${(j.requestDetails && j.requestDetails.symbol) || '?'})`);
    for (const b of (j.barData && j.barData.priceBars) || []) { const t = Math.round(b.tradeTimeinMills / 1000), h = new Date(t * 1000).getUTCHours(); if (h >= 14 && h < 17 && b.volume >= 1 && +b.close > 0) gc.set(t, +b.close); }
  }
  const days = [...new Set([...gc.keys()].map(dayOf))].sort(), out = [];
  for (const day of days) {
    const t0 = Date.parse(day + 'T14:00:00Z') / 1000, S = new Map((await bars(`sym=xau&tf=1m&from=${t0}&to=${t0 + 3 * 3600}`)).map((b) => [b.time, b.close]));
    const pairs = []; for (const [t, F] of gc) if (t >= t0 && t < t0 + 3 * 3600 && S.has(t)) pairs.push([F, S.get(t)]);
    const d = dayBasis(pairs, t0 + 5400); if (d) out.push({ day, b: +d.b.toFixed(6), n: d.n, tau: +d.tau.toFixed(5), tauAlt: +d.tauAlt.toFixed(5) });
    await sleep(250);
  }
  fs.writeFileSync(path.join(HERE, 'basis.json'), JSON.stringify({ note: SOURCES.basis + '; per UTC weekday the median ln(F/S) over matched minutes 14:00-17:00 UTC (at least 5), tau = years to 29 Dec 2026 (tauAlt: to 1 Dec 2026)', councilData: ref, symbols: [...sym], days: out }));
  console.log('rates.json, basis.json', out.length, 'days', [...sym]);
}

// ── run ──
export function routeRate(r, sofrNow, dgs2) {
  if (r.hist) return (day) => { const x = dgs2(day); return x == null ? null : Math.max(0, x + r.add); };
  return r.flat;
}
function main() {
  const legs = J(path.join(HERE, '../supported-book/legs.json')).units, SB = J(path.join(HERE, '../supported-book/result.json'));
  const rates = J(path.join(HERE, 'rates.json')), basis = J(path.join(HERE, 'basis.json'));
  const dgs2 = asOf(rates.DGS2), sofr = asOf(rates.SOFR), px = asOf(rates.xauClose.map(([d, c]) => [d, c * 100]));
  const sofrNow = sofr(SOFR_ASOF), B = basisSummary(basis.days, sofr);
  const closes = new Map(J(path.join(HERE, '../honest-book/gold-1d.json')).bars.map(([t, c]) => [dayOf(t), c]).filter(([d]) => ![0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay())));
  const W1 = WINDOWS.W1, W3 = WINDOWS.W3, S2 = BOOKS.S2;

  // routes
  const cfd = SOURCES.cfd.map((c) => { const p = px(c.date), rate = -c.perLot / (100 * p) * 365, s = sofr(c.date); return { ...c, px: r2(p), rate, sofr: s, markup: s != null ? rate - s : null }; });
  const R = [
    { key: 'none', name: 'No financing (reference)', flat: 0 },
    { key: 'demo', name: 'Demo broker CFD swap, today\'s rate', flat: DEMO },
    { key: 'demo-h', name: 'Demo broker CFD swap, following short rates', hist: true, add: DEMO - sofrNow },
    ...cfd.flatMap((c) => [{ key: `cfd-${c.key}`, name: `${c.name} CFD swap`, flat: c.rate }, ...(c.markup != null ? [{ key: `cfd-${c.key}-h`, name: `${c.name} CFD swap, following short rates`, hist: true, add: c.markup }] : [])]),
    { key: 'mgc', name: 'Micro gold futures (MGC), basis measured in 2026', flat: B.kNow, fees: true },
    { key: 'mgc-alt', name: 'Micro gold futures (MGC), basis with the expiry taken as 1 Dec 2026 (sensitivity, post hoc)', flat: B.kNowAlt, fees: true },
    { key: 'mgc-h', name: 'Micro gold futures (MGC), carry = short rate, lease 0', hist: true, add: 0, fees: true },
    ...SOURCES.etf.flatMap((e) => [{ key: `etf-${e.key}`, name: `${e.name} (statement charge)`, flat: e.er }, { key: `etf-${e.key}-e`, name: `${e.name} (counting the interest the cash would earn)`, flat: e.er + sofrNow }, { key: `etf-${e.key}-eh`, name: `${e.name} (counting interest, following short rates)`, hist: true, add: e.er }]),
  ];
  const book = (rate, fees, W) => bookStats(charge(legs, rate, fees ? mgcFeesR : null), S2, W, { mult: 1, fin: 0 }, closes);
  const pick = (o) => ({ positions: o.positions, total: o.total, perYear: o.perYear, tDaily: o.tDaily, tMonthly: o.tMonthly, perPosition: o.perPosition, maxDD: o.maxDD, markedDD: o.marked.maxDD, halves: o.halves.map((h) => h.total), worstYear: o.worstYear, posYears: o.posYears });
  const routes = {};
  for (const r of R) {
    const rate = routeRate(r, sofrNow, dgs2), cost = (W) => { const L = legs.filter((u) => S2.includes(u.sys)), pos = positions(L, { fin: 0, mult: 0 }).filter((p) => p.day >= W.from && p.day <= W.to), ids = new Set(pos.map((p) => p.id)); const U = L.filter((u) => ids.has(u.of || u.id)); return { fin: U.reduce((s, u) => s + carryR(u, rate), 0), fees: r.fees ? U.reduce((s, u) => s + mgcFeesR(u), 0) : 0 }; };
    const w1 = book(rate, r.fees, W1), w3 = book(rate, r.fees, W3), c1 = cost(W1), c3 = cost(W3);
    const yrs = w1.yrs, bs = bootstrap(w1.days, [w1.v], ([v]) => v.reduce((s, x) => s + x, 0) / yrs);
    const meanRate = r.hist ? (() => { const d = weekdays(W1.from, W1.to).map((x) => rate(x)).filter(Number.isFinite); return d.reduce((s, x) => s + x, 0) / d.length; })() : r.flat;
    routes[r.key] = { name: r.name, kind: r.hist ? 'history' : 'flat', rate: r.hist ? null : r4(r.flat), ...(r.hist ? {} : { perNightPct: r4(r.flat / 365 * 100) }), add: r.hist ? r4(r.add) : null, meanRateW1: r4(meanRate),
      W1: { ...pick(w1.out), financing: r1(c1.fin), financingPerYear: r2(c1.fin / yrs), fees: r1(c1.fees), perYearBand: [r1(bs.lo), r1(bs.hi)] },
      W3: { ...pick(w3.out), financing: r1(c3.fin), fees: r1(c3.fees) } };
  }
  // gate: demo = supported-book x1F1, none = x1F0
  const ref = SB.windows.W1.S2, gate = { demo: ['total', 'tDaily', 'maxDD'].every((k) => routes.demo.W1[k] === ref.x1F1[k]), none: ['total', 'tDaily', 'maxDD'].every((k) => routes.none.W1[k] === ref.x1F0[k]) };
  gate.ok = gate.demo && gate.none; gate.reference = { demo: { total: ref.x1F1.total, tDaily: ref.x1F1.tDaily, maxDD: ref.x1F1.maxDD, financing: ref.x1F1.financing }, none: { total: ref.x1F0.total, tDaily: ref.x1F0.tDaily } };
  if (!gate.ok) { console.error('gate failed', gate, routes.demo.W1, routes.none.W1); process.exit(1); }
  // rate grid and break-even
  const grid = GRID.map((g) => { const o = book(g, false, W1).out; return { rate: r4(g), perYear: o.perYear, total: o.total, tDaily: o.tDaily, maxDD: o.maxDD }; });
  let breakEven = null; for (let i = 1; i < grid.length; i++) { const a = grid[i - 1], b = grid[i]; if (a.tDaily >= 2 && b.tDaily < 2) { breakEven = r4(a.rate + (a.tDaily - 2) / (a.tDaily - b.tDaily) * (b.rate - a.rate)); break; } }
  // holding statistics (S2, W1)
  const L = legs.filter((u) => S2.includes(u.sys)), posW1 = positions(L, { fin: 0, mult: 0 }).filter((p) => p.day >= W1.from && p.day <= W1.to), idW1 = new Set(posW1.map((p) => p.id));
  const UW = L.filter((u) => idW1.has(u.of || u.id)), nn = (u) => carryR(u, 365) / (u.e / u.r0);   // rollover nights of a unit
  const posN = posW1.map((p) => Math.max(...UW.filter((u) => (u.of || u.id) === p.id).map(nn)));
  const hold = { units: UW.length, positions: posW1.length, nightsUnitMedian: r1(median(UW.map(nn))), nightsUnitMean: r1(UW.reduce((s, u) => s + nn(u), 0) / UW.length), nightsPositionMedian: r1(median(posN)), nightsPositionMean: r1(posN.reduce((s, x) => s + x, 0) / posN.length),
    bySystem: Object.fromEntries(S2.map((s) => { const q = UW.filter((u) => u.sys === s && !u.of).map(nn); return [s, { median: r1(median(q)), mean: r1(q.reduce((a, b) => a + b, 0) / q.length) }]; })) };
  // DGS2 against SOFR on the overlap
  const overlap = rates.SOFR.filter(([d]) => d >= '2025-09-01').map(([d, s]) => [d, dgs2(d) * 100 - s]);
  const proxyGap = { from: overlap[0]?.[0], to: overlap.at(-1)?.[0], medianPts: r2(median(overlap.map((x) => x[1]))), min: r2(Math.min(...overlap.map((x) => x[1]))), max: r2(Math.max(...overlap.map((x) => x[1]))) };
  const dgs2Years = Object.fromEntries([...Array(12)].map((_, i) => 2006 + i).map((y) => { const v = rates.DGS2.filter(([d]) => d.startsWith(String(y))).map((x) => x[1]); return [y, r2(v.reduce((a, b) => a + b, 0) / v.length)]; }));
  const out = { built: '2026-11-12', prereg: 'research/edge/gold-carry/PREREGISTRATION.md', rule: 'paper research only: no trading rule tested; no live rule, size, filter, stop, config, cost constant or mirror setting changed',
    sources: SOURCES, councilData: rates.councilData, demoRate: r4(DEMO), sofrNow: r4(sofrNow), sofrAsOf: SOFR_ASOF, cfd: cfd.map((c) => ({ key: c.key, name: c.name, perLot: c.perLot, date: c.date, px: c.px, rate: r4(c.rate), perNightPct: r4(c.rate / 365 * 100), sofr: r4(c.sofr), markup: r4(c.markup), src: c.src, ...(c.dateNote ? { dateNote: c.dateNote } : {}) })),
    basis: { ...B, symbols: basis.symbols }, mgc: { roundTrip: MGC_RT, oz: MGC_OZ, tick: TICK }, proxyGap, dgs2Years, hold, gate, routes, grid, breakEven };
  // the cheapest honest route by true carrying cost (today): CFD swap, futures k, ETF expense ratio + SOFR
  const honest = [{ key: 'demo', rate: DEMO }, ...cfd.map((c) => ({ key: `cfd-${c.key}`, rate: c.rate })), { key: 'mgc', rate: B.kNow }, ...SOURCES.etf.map((e) => ({ key: `etf-${e.key}-e`, rate: e.er + sofrNow }))].sort((a, b) => a.rate - b.rate);
  out.cheapest = honest.map((h) => ({ ...h, rate: r4(h.rate) }));
  out.belowBreakEven = honest.filter((h) => h.rate < breakEven).map((h) => h.key);
  const g = (k) => routes[k].W1, sg = (x) => (x > 0 ? '+' : '') + x;
  out.verdict = `INCONCLUSIVE (cost accounting, no rule tested): holding the book's gold buys costs ${r1(DEMO * 100)} % a year at the demo broker (book ${sg(g('demo').perYear)}R a year, t ${g('demo').tDaily}, ${g('demo').positions} positions, untouched 2006-17); the cheapest route that could be checked, micro gold futures, carried ${r1(B.kNow * 100)} % a year in Oct-Nov 2026 (${r1(B.k * 100)} % over the year) plus commissions and rolls, and leaves the book at ${sg(g('mgc').perYear)}R a year, t ${g('mgc').tDaily}: the route is worth about half an R a year, not the difference between a proven and an unproven book.`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1));
  console.log('gate', JSON.stringify(gate)); console.log('basis', JSON.stringify(B)); console.log('hold', JSON.stringify(hold)); console.log('proxyGap', JSON.stringify(proxyGap), JSON.stringify(dgs2Years));
  console.log('cfd', JSON.stringify(out.cfd.map((c) => [c.key, c.px, c.rate, c.sofr, c.markup])));
  for (const [k, r] of Object.entries(routes)) console.log(k.padEnd(18), 'rate', r.rate ?? `h+${r.add} (mean ${r.meanRateW1})`, '| W1 tot', r.W1.total, '/yr', r.W1.perYear, 't', r.W1.tDaily, 'DD', r.W1.maxDD, 'fin', r.W1.financing, 'fees', r.W1.fees, '| W3 /yr', r.W3.perYear, 't', r.W3.tDaily);
  console.log('grid', grid.map((g) => `${g.rate}:${g.tDaily}`).join(' '), 'breakEven', breakEven); console.log('cheapest', JSON.stringify(out.cheapest), 'below', out.belowBreakEven);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { if (process.argv[2] === 'fetch') fetchAll().catch((e) => { console.error(e); process.exit(1); }); else main(); }
