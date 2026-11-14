// The US dollar on the day AFTER a US market holiday, read on dollar-priced metals (research/edge/post-holiday-metals,
// PREREGISTRATION.md). Paper research; not a gate, exit, entry or size of any gold-book system.
//   node run.mjs fetch <dir>   copies the council's daily candle cache of xau, xag, xpt, xpd out of the council-data branch
//                              (git show, no network)
//   node run.mjs full <dir>    runs the study on <dir>/<key>.json and writes result.json + RESULT.md next to this file
// The NYSE calendar, the day-after definition, the fold, the ATR and the statistics are imported from fx-us-holiday-run.mjs, a
// byte copy of research/edge/fx-us-holiday/run.mjs on branch fx-us-holiday (sha256 pinned in the test). The basket-day rule, the
// A-day map and the placebo are fx-post-holiday-replicate's, for two legs. Nothing here is tuned: the side is short metals
// (= long the US dollar), fixed by the hypothesis being checked.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { holidayEvents, isTradingDay, fold, atr, ymdOf, mean, tOne, monthSums, welch, rng } from './fx-us-holiday-run.mjs';
import { financing, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// cost = round trip in dollars an ounce (usd) or as a share of price (pct); every leg SHORT the metal (long the US dollar)
export const LEGS = [
  { key: 'xau', market: 'xau', costUsd: 0.30 },
  { key: 'xag', market: 'xag', costUsd: 0.03 },
];
export const EXTRA = [ // reported only, never in the verdict; costs assumed, not measured
  { key: 'xpt', market: 'xpt', costPct: 0.0030 },
  { key: 'xpd', market: 'xpd', costPct: 0.0050 },
];
export const SIDE = -1;
export const P = { STOP_ATR: 1.5, ATR_N: 20, SEEDS: 40, SEEDS_NEED: 38, FROM: '2005-01-03', HALF: '2016-01-01', T_BAR: 2 };
const DAY = 86400;

export const costFrac = (leg, entry) => (leg.costUsd != null ? leg.costUsd / entry : leg.costPct);
// one leg, one candle SHORT: entry at bars[k-1].close, exit at bars[k].close or its 1.5 x ATR stop above (#975's legDay, side -1)
export function legDay(bars, k, leg, costMult = 1) {
  const a = atr(bars, k - 1); if (!a || !(a > 0)) return null;
  const b = bars[k], entry = bars[k - 1].close, r0 = P.STOP_ATR * a, stop = entry - SIDE * r0;
  let exit = b.close, kind = 'close';
  if (b.open >= stop) { exit = b.open; kind = 'gap'; } else if (b.high >= stop) { exit = stop; kind = 'stop'; }
  const gross = SIDE * (exit - entry) / entry, cost = costMult * costFrac(leg, entry);
  // council/fills.mjs: a short is credited nothing (FIN.xau.short = 0); no FIN for xag / xpt / xpd = nothing either
  const f = financing({ market: leg.market, side: 'sell', entry, r0, filled: bars[k - 1].time + DAY, closed: b.time + DAY });
  const finR = f.finR ? -f.finR : 0, fin = finR * r0 / entry; // a charge would be negative; 0 here by the repo's rule
  const net = gross - cost + fin, k2 = entry / r0;
  return { gross, cost, fin, net, grossR: gross * k2, netR: net * k2, finR, costR: cost * k2, kind, nights: f.nights };
}
// basket days: the dates both legs share, with the same previous candle date and an ATR (fx-post-holiday-replicate)
export function basketDays(data, legs = LEGS) {
  const idx = legs.map((l) => new Map(data[l.key].map((b, i) => [ymdOf(b.time), i])));
  const ref = data[legs[0].key], out = new Map(); let skipped = 0;
  for (let i = 1; i < ref.length; i++) {
    const ymd = ymdOf(ref[i].time), wd = new Date(ref[i].time * 1000).getUTCDay();
    if (wd < 1 || wd > 5) continue;
    const ks = idx.map((m) => m.get(ymd)); if (ks.some((k) => k == null || k < P.ATR_N + 1)) { skipped++; continue; }
    const prev = ks.map((k, j) => ymdOf(data[legs[j].key][k - 1].time));
    if (prev.some((p) => p !== prev[0])) { skipped++; continue; }
    out.set(ymd, { ymd, ks, entryYmd: prev[0] });
  }
  return { days: out, skipped };
}
export function basket(data, day, costMult = 1, legs = LEGS) {
  const ls = legs.map((l, j) => legDay(data[l.key], day.ks[j], l, costMult));
  if (ls.some((x) => !x)) return null;
  const m = (f) => mean(ls.map(f));
  return { gross: m((x) => x.gross), net: m((x) => x.net), grossR: m((x) => x.grossR), netR: m((x) => x.netR), finR: m((x) => x.finR),
    costR: m((x) => x.costR), stops: ls.filter((x) => x.kind !== 'close').length, legs: ls };
}
export function dayRow(data, day, legs = LEGS) {
  const v = {}; for (const c of [0, 1, 2]) { const b = basket(data, day, c, legs); if (!b) return null; v[`c${c}`] = b; }
  return { ymd: day.ymd, entryYmd: day.entryYmd, ...v };
}
// the A days (first NYSE trading day after each full holiday), each traded once
export function postDays(from, to) {
  const m = new Map(); for (const e of holidayEvents(from, to)) if (!m.has(e.post)) m.set(e.post, e);
  return m;
}
export function placebo(events, ordinary, seeds = P.SEEDS) {
  const byYear = new Map(); for (const r of ordinary) { const y = r.ymd.slice(0, 4); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(r); }
  const need = new Map(); for (const e of events) { const y = e.ymd.slice(0, 4); need.set(y, (need.get(y) || 0) + 1); }
  const out = [];
  for (let k = 1; k <= seeds; k++) {
    const r = rng(k), xs = [];
    for (const [y, n] of [...need].sort()) { const pool = byYear.get(y) || []; for (let i = 0; i < n && pool.length; i++) xs.push(pool[Math.floor(r() * pool.length)].c1.netR); }
    out.push(mean(xs));
  }
  return out;
}

// --- the study -------------------------------------------------------------------------------------------------------------
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4);
const pct = (x) => r4(x * 100);
function block(rows) {
  if (!rows.length) return { n: 0 };
  const net = rows.map((r) => r.c1.netR), ms = monthSums(rows, (r) => r.c1.netR);
  return { n: rows.length, from: rows[0].ymd, to: rows.at(-1).ymd, grossPct: pct(mean(rows.map((r) => r.c1.gross))), grossR: r4(mean(rows.map((r) => r.c1.grossR))),
    finR: r4(mean(rows.map((r) => r.c1.finR))), costR: r4(mean(rows.map((r) => r.c1.costR))),
    netR0: r4(mean(rows.map((r) => r.c0.netR))), netR: r4(mean(net)), netR2: r4(mean(rows.map((r) => r.c2.netR))),
    t: r4(tOne(net)), monthT: r4(ms.t), months: ms.months, t0: r4(tOne(rows.map((r) => r.c0.netR))), t2: r4(tOne(rows.map((r) => r.c2.netR))),
    won: r4(net.filter((x) => x > 0).length / net.length), legStops: rows.reduce((x, r) => x + r.c1.stops, 0), totalR: r4(net.reduce((x, y) => x + y, 0)) };
}
// one metal alone, on its own candle dates (reported only)
function alone(data, leg, post, last) {
  const bars = data[leg.key], rows = [];
  for (let k = P.ATR_N + 1; k < bars.length; k++) {
    const ymd = ymdOf(bars[k].time); if (ymd < P.FROM || ymd > last || !post.has(ymd)) continue;
    const v = {}; let ok = true; for (const c of [0, 1, 2]) { const x = legDay(bars, k, leg, c); if (!x) { ok = false; break; } v[`c${c}`] = { ...x, stops: x.kind !== 'close' ? 1 : 0 }; }
    if (ok) rows.push({ ymd, ...v });
  }
  return { metal: leg.key, ...block(rows), missingPost: [...post.keys()].filter((d) => d >= (rows[0]?.ymd || P.FROM) && d <= last && !rows.some((r) => r.ymd === d)).length };
}
export function study(data) {
  const { days, skipped } = basketDays(data);
  const all = [...days.values()], last = all.at(-1).ymd;
  const rows = new Map(); for (const d of all) { const r = dayRow(data, d); if (r) rows.set(d.ymd, r); }
  const first = [...rows.keys()][0];
  const post = postDays(P.FROM, last), pre = new Map(); for (const e of holidayEvents(P.FROM, last)) pre.set(e.pre, e);
  const missing = [], A = [];
  for (const [ymd, e] of post) { if (ymd < first) continue; const r = rows.get(ymd); if (!r) { missing.push(ymd); continue; } A.push({ ...r, hol: e.hol, name: e.name }); }
  A.sort((a, b) => a.ymd.localeCompare(b.ymd));
  const ordinary = [...rows.values()].filter((r) => isTradingDay(r.ymd) && !pre.has(r.ymd) && !post.has(r.ymd));
  const whole = block(A), h1 = block(A.filter((r) => r.ymd < P.HALF)), h2 = block(A.filter((r) => r.ymd >= P.HALF));
  const real = mean(A.map((r) => r.c1.netR)), pl = placebo(A, ordinary), beat = pl.filter((x) => real > x).length;
  const W = welch(A.map((r) => r.c1.gross), ordinary.map((r) => r.c1.gross));
  const byType = (() => { const m = new Map(); for (const r of A) { if (!m.has(r.name)) m.set(r.name, []); m.get(r.name).push(r.c1.netR); }
    return [...m].map(([name, v]) => ({ name, n: v.length, netR: r4(mean(v)), t: r4(tOne(v)) })).sort((a, b) => a.name.localeCompare(b.name)); })();
  const perLeg = LEGS.map((l, j) => { const v = A.map((r) => r.c1.legs[j]); return { metal: l.key, n: v.length, grossR: r4(mean(v.map((x) => x.grossR))), finR: r4(mean(v.map((x) => x.finR))), costR: r4(mean(v.map((x) => x.costR))), netR: r4(mean(v.map((x) => x.netR))), t: r4(tOne(v.map((x) => x.netR))), stops: v.filter((x) => x.kind !== 'close').length }; });
  const metals = [...LEGS, ...EXTRA].map((l) => ({ ...alone(data, l, post, last), judged: LEGS.includes(l) }));
  const T1 = whole.netR > 0 && whole.t >= P.T_BAR && whole.monthT >= P.T_BAR, T2 = whole.netR2 > 0, T3 = beat >= P.SEEDS_NEED, T4 = h1.netR > 0 && h2.netR > 0;
  const verdict = T1 && T2 && T3 && T4 ? 'PASS' : 'FAIL';
  return {
    built: '2026-11-14', study: 'post-holiday-metals', title: 'The US dollar on the day after a US market holiday, read on dollar-priced metals',
    verdict, system: 'Research only (short gold and silver against the US dollar; not a gold-book system)', headline: null,
    checks: [
      { study: 'fx-us-holiday', branch: 'fx-us-holiday', pr: 975, note: 'seven majors, long USD on the first NYSE trading day after a US holiday: +0.089R out of sample 2015-26 (t 2.65), -0.004R in sample 2005-14; reported only' },
      { study: 'fx-post-holiday-replicate', branch: 'fx-post-holiday-replicate', pr: 980, note: 'six exotic dollar pairs: gross +0.075R (Welch t 2.72), net +0.026R (t 1.00), first half negative: FAIL' },
    ],
    data: { src: 'OANDA mid daily candles (UTC days, close 00:00 UTC = 19:00 / 20:00 New York), council-data research/daily/<key>.json (git show), weekend folded into Monday (council/fills.mjs foldWeekend)',
      basket: LEGS.map((l) => l.key), reportedOnly: EXTRA.map((l) => l.key), basketDays: rows.size, skipped, first, last, missingPost: missing },
    window: { from: first, to: last, halves: [[first, '2015-12-31'], [P.HALF, last]], note: 'pre-registered from 2005; gold and silver candles start 2006-03-20' },
    rule: { side: 'short XAU/USD and XAG/USD (long USD)', stopAtr: P.STOP_ATR, atrN: P.ATR_N, hold: 'close of the candle before the first NYSE trading day after a US full holiday to that day\'s UTC close' },
    costs: { roundTrip: Object.fromEntries([...LEGS, ...EXTRA].map((l) => [l.key, l.costUsd != null ? `$${l.costUsd.toFixed(2)} an ounce` : `${(l.costPct * 100).toFixed(2)} % (assumed)`])), note: '2x doubles the round trip; cost 0 keeps financing' },
    financing: { rule: 'council/fills.mjs financing(): a short is credited nothing (FIN.xau.short = 0); no FIN entry for xag / xpt / xpd', fin: FIN.xau, note: 'financing is 0 on every leg by the repo\'s rule' },
    basket: { whole, firstHalf: h1, secondHalf: h2, welchVsOrdinaryGrossT: r4(W.t), ordinaryGrossPct: pct(mean(ordinary.map((r) => r.c1.gross))), ordinaryNetR: r4(mean(ordinary.map((r) => r.c1.netR))), byType, perLeg },
    metals,
    placebo: { seeds: P.SEEDS, need: P.SEEDS_NEED, ordinaryDays: ordinary.length, realNetR: whole.netR, beaten: beat, seedNetR: pl.map(r4) },
    tests: { T1, T2, T3, T4 },
    trades: A.map((r) => ({ ymd: r.ymd, hol: r.hol, name: r.name, entry: r.entryYmd, grossPct: pct(r.c1.gross), netR: r4(r.c1.netR), stops: r.c1.stops })),
  };
}

// --- report ----------------------------------------------------------------------------------------------------------------
const f = (x, d = 3) => (x == null ? 'n/a' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d));
export function headline(R) {
  const w = R.basket.whole;
  return `${R.verdict === 'PASS' ? 'Passes' : 'Fails'}: short gold and silver on the day after a US holiday makes ${f(w.netR)}R a holiday net ${R.window.from.slice(0, 4)}-${R.window.to.slice(2, 4)} (n ${w.n}, t ${f(w.t, 2)}).`;
}
export function report(R) {
  const o = [], B = R.basket, w = B.whole, PL = R.placebo, T = R.tests;
  const failed = Object.entries(T).filter(([, v]) => !v).map(([k]) => k);
  o.push(`# Result: the US dollar on the day after a US market holiday, read on dollar-priced metals (${R.built})`, '');
  o.push(`**Verdict: ${R.verdict}${failed.length ? ` (${failed.join(', ')} not met)` : ''}**: ${headline(R).replace(/^(Passes|Fails): /, '')}`, '');
  o.push(`Judged on the pre-registered bar (PREREGISTRATION.md, pushed alone before any candle was read). A second out-of-sample check of #975's side observation (long USD on the first NYSE trading day after a US holiday; seven majors, reported only) after #980 failed it on six exotic dollar pairs. ` +
    `Here, short gold and silver (a dollar rise = metals down in dollars), ${R.window.from} to ${R.window.to}: ${f(w.netR)}R a holiday after costs (n ${w.n}, event t ${f(w.t, 2)}, month-sum t ${f(w.monthT, 2)}); gross ${f(w.grossR)}R; ` +
    `at 2x cost ${f(w.netR2)}R; first half ${f(B.firstHalf.netR)}R (n ${B.firstHalf.n}), second half ${f(B.secondHalf.netR)}R (n ${B.secondHalf.n}); above ${PL.beaten} of ${PL.seeds} placebo seeds. ` +
    `${R.verdict === 'PASS' ? 'A hypothesis supported on a second set of markets, still paper only; nothing live changed, and it is never a gate on a gold-book system (owner item 44).' : "#975's side observation does not carry to the metals. Nothing live changed and no proposal follows. This is a standalone calendar study, not a test of any gold-book system (owner item 44)."}`, '');
  o.push(`Data: ${R.data.src}. Judged basket: short ${R.data.basket.map((k) => k.toUpperCase()).join(' and ')}, equal weight in R; reported only: ${R.data.reportedOnly.map((k) => k.toUpperCase()).join(', ')}. ` +
    `Basket days ${R.data.first} to ${R.data.last} (${R.data.basketDays}; ${R.data.skipped} dates skipped where a metal lacked the day or its previous candle differed). Post-holiday days without a basket candle: ${R.data.missingPost.length ? R.data.missingPost.join(', ') : 'none'}. ` +
    `Pre-registered from 2005; gold and silver candles start 2006-03-20. **The close is the UTC daily close (19:00 or 20:00 New York), not 17:00 New York**, as in #975 and #980. ` +
    `Costs a round trip: ${Object.entries(R.costs.roundTrip).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(', ')}. Financing: ${R.financing.rule}, so it is 0 on every leg.`, '');
  const row = (lab, x) => `| ${lab} | ${x.n} | ${f(x.grossPct, 4)} | ${f(x.grossR)} | ${f(x.finR)} | ${f(x.costR)} | ${f(x.netR0)} | ${f(x.netR)} | ${f(x.netR2)} | ${f(x.t, 2)} | ${f(x.monthT, 2)} (${x.months}) | ${(x.won * 100).toFixed(1)} % | ${x.legStops} |`;
  o.push('## The basket (judged)', '', '| Window | n | gross % (short) | gross R | financing R | cost R | net R cost 0 | net R base | net R 2x | event t | month-sum t (months) | won | leg stops |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  o.push(row(`Whole ${R.window.from} to ${R.window.to}`, w), row('First half to 2015-12-31', B.firstHalf), row('Second half from 2016-01-01', B.secondHalf), '');
  o.push(`Welch t of the gross basket % (short) on post-holiday days against ${PL.ordinaryDays} ordinary days: ${f(B.welchVsOrdinaryGrossT, 2)} (ordinary days ${f(B.ordinaryGrossPct, 4)} % a day short, ${f(B.ordinaryNetR)}R net).`, '');
  o.push('## Pass bar', '', '| Test | Holds |', '|---|---|',
    `| T1 net R > 0, event t >= 2 and month-sum t >= 2 | ${T.T1 ? 'yes' : 'no'} (${f(w.netR)}R, t ${f(w.t, 2)}, month t ${f(w.monthT, 2)}) |`,
    `| T2 net R > 0 at 2x cost | ${T.T2 ? 'yes' : 'no'} (${f(w.netR2)}R) |`,
    `| T3 above at least ${PL.need} of ${PL.seeds} placebo seeds | ${T.T3 ? 'yes' : 'no'} (${PL.beaten} of ${PL.seeds}) |`,
    `| T4 net R > 0 in both halves | ${T.T4 ? 'yes' : 'no'} (${f(B.firstHalf.netR)}R, ${f(B.secondHalf.netR)}R) |`, '');
  o.push('## Placebo', '', `${PL.seeds} seeds, each drawing as many ordinary days per year as the rule traded (from ${PL.ordinaryDays} ordinary days: NYSE trading days that are neither the day before nor the day after a holiday), traded short with the same stop and costs. The rule's ${f(PL.realNetR)}R is above ${PL.beaten} of them; seed means range ${f(Math.min(...PL.seedNetR))}R to ${f(Math.max(...PL.seedNetR))}R.`, '');
  o.push('## Per leg inside the basket (same days)', '', '| Metal | n | gross R | financing R | cost R | net R | t | stops |', '|---|---|---|---|---|---|---|---|');
  for (const x of B.perLeg) o.push(`| ${x.metal.toUpperCase()} | ${x.n} | ${f(x.grossR)} | ${f(x.finR)} | ${f(x.costR)} | ${f(x.netR)} | ${f(x.t, 2)} | ${x.stops} |`);
  o.push('', '## Each metal alone, on its own candles (reported only)', '', '| Metal | in basket | n | from | gross R | net R cost 0 | net R base | net R 2x | t | stops |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const x of R.metals) o.push(`| ${x.metal.toUpperCase()} | ${x.judged ? 'yes' : 'no'} | ${x.n} | ${x.from} | ${f(x.grossR)} | ${f(x.netR0)} | ${f(x.netR)} | ${f(x.netR2)} | ${f(x.t, 2)} | ${x.legStops} |`);
  o.push('', 'XPT and XPD costs are assumed (0.30 % and 0.50 % of price a round trip), not measured.', '');
  o.push('## By holiday (reported only)', '', '| Holiday before the day | n | net R | t |', '|---|---|---|---|');
  for (const x of B.byType) o.push(`| ${x.name} | ${x.n} | ${f(x.netR)} | ${f(x.t, 2)} |`);
  o.push('', '## Reading', '');
  o.push('- One observation is one holiday (the two legs of one basket are one bet); about nine holidays a year over 20 years.');
  o.push('- The side (short metals = long USD), the day, the hold, the stop and the bar were fixed from #975 / #980 before these candles were read; nothing was chosen on them.');
  o.push(`- Gross ${f(w.grossR)}R a holiday (t before costs ${f(w.t0, 2)}); the costs of gold and silver are small (${f(w.costR)}R a holiday), so on these markets the question is the move itself, not the spread. Gross Welch t against ordinary days ${f(B.welchVsOrdinaryGrossT, 2)}.`);
  if (w.netR < 0) {
    const neg = B.byType.filter((x) => x.netR < 0).sort((a, b) => a.netR - b.netR).slice(0, 3).map((x) => `${x.name} ${f(x.netR)}R (n ${x.n})`).join(', ');
    o.push(`- The sign is the OPPOSITE of the hypothesis on every metal and in both halves: gold and silver rose more than on an ordinary day on the day after a US holiday (gross Welch t ${f(B.welchVsOrdinaryGrossT, 2)}, below the ±2 line). That is a second look, not a pre-registered test, and must not be read as "long metals after a holiday": it sits mostly in a few holidays (${neg}), where spot metals themselves are shut or thin over the holiday and around the turn of the year, and any such rule would need its own pre-registration on other data (and could never be a gate on a gold-book system, owner item 44).`);
    o.push('- With #980, two out-of-sample checks of #975\'s dollar observation now fail; the dollar\'s day after a US holiday is not a rule to carry further.');
  }
  o.push('- Short metals are credited no financing in the repo\'s paper model (a broker would credit some), so the net figures are conservative on that side by a night or three of carry.');
  o.push('- The UTC close sits two or three hours after the 17:00 New York rollover, as in #975 and #980.');
  o.push('- Paper only. Not a gold-book test and never a gate on one. Never call this an edge without its n and t.');
  o.push('', 'To repeat: `node research/edge/post-holiday-metals/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `… full <dir>`. Test: `tests/post-holiday-metals.test.mjs`.');
  return o.join('\n') + '\n';
}

// --- CLI -------------------------------------------------------------------------------------------------------------------
export const KEYS = [...LEGS, ...EXTRA].map((l) => l.key);
export function loadData(dir) { return Object.fromEntries(KEYS.map((k) => [k, fold(JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8')).rows)])); }
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of KEYS) fs.writeFileSync(path.join(dir, `${k}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    console.log('fetched into', dir);
  } else if (cmd === 'full') {
    const R = study(loadData(dir));
    R.headline = headline(R);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(R.verdict, JSON.stringify({ basket: R.basket.whole, h1: R.basket.firstHalf.netR, h2: R.basket.secondHalf.netR, placebo: R.placebo.beaten, tests: R.tests, metals: R.metals.map((m) => [m.metal, m.n, m.grossR, m.netR, m.t]) }));
  } else console.log('usage: node run.mjs fetch <dir> | full <dir>');
}
