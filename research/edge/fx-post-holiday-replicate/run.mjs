// The US dollar on the day AFTER a US market holiday, replicated on other dollar pairs (research/edge/fx-post-holiday-replicate,
// PREREGISTRATION.md). Paper research.
//   node run.mjs fetch <dir>   copies the council's daily candle cache of the eight pairs out of the council-data branch
//                              (git show, no network)
//   node run.mjs full <dir>    runs the study on <dir>/<key>.json and writes result.json + RESULT.md next to this file
// The NYSE calendar, the day-after definition, the fold, the ATR, the rollover count and the statistics are imported from
// fx-us-holiday-run.mjs, a byte copy of research/edge/fx-us-holiday/run.mjs on branch fx-us-holiday (sha256 pinned in the test).
// Nothing here is tuned: the side is long USD, fixed by the hypothesis being replicated.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { holidayEvents, isTradingDay, fold, atr, nightsOf, ymdOf, mean, tOne, monthSums, welch, rng, rateAt, RATES } from './fx-us-holiday-run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const EX = JSON.parse(fs.readFileSync(path.join(HERE, 'rates-exotic.json'), 'utf8'));

// every leg is USD/xxx and long the US dollar; spread = assumed round trip as a share of price (PREREGISTRATION.md)
export const LEGS = [
  { ccy: 'mxn', key: 'usdmxn', spread: 0.0005 },
  { ccy: 'zar', key: 'usdzar', spread: 0.0010 },
  { ccy: 'sek', key: 'usdsek', spread: 0.0005 },
  { ccy: 'nok', key: 'usdnok', spread: 0.0005 },
  { ccy: 'sgd', key: 'usdsgd', spread: 0.0003 },
  { ccy: 'pln', key: 'usdpln', spread: 0.0006 },
];
export const EXTRA = [ // reported only, never in the verdict
  { ccy: 'try', key: 'usdtry', spread: 0.0015 },
  { ccy: 'cnh', key: 'usdcnh', spread: 0.0004 },
];
export const DROPPED = { usdhkd: 'pegged inside 7.75-7.85' };
export const P = { STOP_ATR: 1.5, ATR_N: 20, COMM_RT: 0.000045, MARKUP: 1.0, SEEDS: 40, SEEDS_NEED: 38, FROM: '2005-01-03', HALF: '2016-01-01', T_BAR: 2 };

// --- financing: (rate USD - rate of the other currency - markup) / 100 / 365 a rollover, long USD -------------------------
export function otherRate(ccy, ymd, ex = EX) {
  const ys = ex.ccy[ccy].years, y = ymd.slice(0, 4);
  if (ys[y] != null) return ys[y];
  const ks = Object.keys(ys).sort(); return y < ks[0] ? ys[ks[0]] : ys[ks.at(-1)];
}
export function finNight(ccy, ymd, markupMult = 1, ex = EX) {
  return (rateAt('usd', ymd, RATES) - otherRate(ccy, ymd, ex) - P.MARKUP * markupMult) / 100 / 365;
}
// one leg, one candle long USD: entry at bars[k-1].close, exit at bars[k].close or its 1.5 x ATR stop (#975's legDay, side +1)
export function legDay(bars, k, leg, costMult = 1, ex = EX) {
  const a = atr(bars, k - 1); if (!a || !(a > 0)) return null;
  const b = bars[k], entry = bars[k - 1].close, r0 = P.STOP_ATR * a, stop = entry - r0;
  let exit = b.close, kind = 'close';
  if (b.open <= stop) { exit = b.open; kind = 'gap'; } else if (b.low <= stop) { exit = stop; kind = 'stop'; }
  const gross = (exit - entry) / entry, cost = costMult * (leg.spread + P.COMM_RT);
  const fin = finNight(leg.ccy, ymdOf(b.time), Math.max(1, costMult), ex) * nightsOf(b.time);
  const net = gross - cost + fin, k2 = entry / r0;
  return { gross, cost, fin, net, grossR: gross * k2, netR: net * k2, finR: fin * k2, costR: cost * k2, kind };
}
// basket days: the dates all legs share, with the same previous candle date and an ATR
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
// one pair alone, on its own candle dates (reported only)
function pairAlone(data, leg, post, last) {
  const bars = data[leg.key], rows = [];
  for (let k = P.ATR_N + 1; k < bars.length; k++) {
    const ymd = ymdOf(bars[k].time); if (ymd < P.FROM || ymd > last || !post.has(ymd)) continue;
    const v = {}; let ok = true; for (const c of [0, 1, 2]) { const x = legDay(bars, k, leg, c); if (!x) { ok = false; break; } v[`c${c}`] = { ...x, stops: x.kind !== 'close' ? 1 : 0 }; }
    if (ok) rows.push({ ymd, ...v });
  }
  const b = block(rows); return { pair: leg.key, ...b };
}
export function study(data) {
  const { days, skipped } = basketDays(data);
  const all = [...days.values()], last = all.at(-1).ymd;
  const rows = new Map(); for (const d of all) { const r = dayRow(data, d); if (r) rows.set(d.ymd, r); }
  const post = postDays(P.FROM, last), pre = new Map(); for (const e of holidayEvents(P.FROM, last)) pre.set(e.pre, e);
  const missing = [], A = [];
  for (const [ymd, e] of post) { const r = rows.get(ymd); if (!r) { missing.push(ymd); continue; } A.push({ ...r, hol: e.hol, name: e.name }); }
  A.sort((a, b) => a.ymd.localeCompare(b.ymd));
  const ordinary = [...rows.values()].filter((r) => r.ymd >= P.FROM && isTradingDay(r.ymd) && !pre.has(r.ymd) && !post.has(r.ymd));
  const whole = block(A), h1 = block(A.filter((r) => r.ymd < P.HALF)), h2 = block(A.filter((r) => r.ymd >= P.HALF));
  const real = mean(A.map((r) => r.c1.netR)), pl = placebo(A, ordinary), beat = pl.filter((x) => real > x).length;
  const W = welch(A.map((r) => r.c1.gross), ordinary.map((r) => r.c1.gross));
  const byType = (() => { const m = new Map(); for (const r of A) { if (!m.has(r.name)) m.set(r.name, []); m.get(r.name).push(r.c1.netR); }
    return [...m].map(([name, v]) => ({ name, n: v.length, netR: r4(mean(v)), t: r4(tOne(v)) })).sort((a, b) => a.name.localeCompare(b.name)); })();
  const perLeg = LEGS.map((l, j) => { const v = A.map((r) => r.c1.legs[j]); return { pair: l.key, n: v.length, grossR: r4(mean(v.map((x) => x.grossR))), finR: r4(mean(v.map((x) => x.finR))), costR: r4(mean(v.map((x) => x.costR))), netR: r4(mean(v.map((x) => x.netR))), t: r4(tOne(v.map((x) => x.netR))), stops: v.filter((x) => x.kind !== 'close').length }; });
  const alone = [...LEGS, ...EXTRA].map((l) => ({ ...pairAlone(data, l, post, last), judged: LEGS.includes(l) }));
  const T1 = whole.netR > 0 && whole.t >= P.T_BAR && whole.monthT >= P.T_BAR, T2 = whole.netR2 > 0, T3 = beat >= P.SEEDS_NEED, T4 = h1.netR > 0 && h2.netR > 0;
  const verdict = T1 && T2 && T3 && T4 ? 'PASS' : 'FAIL';
  return {
    built: '2026-11-14', study: 'fx-post-holiday-replicate', title: 'The US dollar on the day after a US market holiday, replicated on other dollar pairs',
    verdict, system: 'Research only (US dollar against six other currencies)', headline: null,
    replicates: { study: 'fx-us-holiday', branch: 'fx-us-holiday', pr: 975, observation: 'long USD on the first NYSE trading day after a US holiday, seven majors: +0.089R a holiday out of sample 2015-26 (n 110, t 2.65), -0.004R in sample 2005-14 (n 88, t -0.10); reported only there' },
    data: { src: 'OANDA mid daily candles (UTC days, close 00:00 UTC = 19:00 / 20:00 New York), council-data research/daily/<key>.json (git show), weekend folded into Monday (council/fills.mjs foldWeekend)',
      basket: LEGS.map((l) => l.key), reportedOnly: EXTRA.map((l) => l.key), dropped: DROPPED, basketDays: rows.size, skipped, first: all[0].ymd, last, missingPost: missing },
    window: { from: P.FROM, to: last, halves: [[P.FROM, '2015-12-31'], [P.HALF, last]] },
    rule: { side: 'long USD', stopAtr: P.STOP_ATR, atrN: P.ATR_N, hold: 'close of the candle before the first NYSE trading day after a US full holiday to that day\'s UTC close' },
    costs: { spreadRT: Object.fromEntries([...LEGS, ...EXTRA].map((l) => [l.key, l.spread])), commissionRT: P.COMM_RT, note: 'assumed conservative spreads (the demo broker does not quote these pairs, no spread log on file); 2x doubles spread, commission and the financing markup; cost 0 keeps financing' },
    financing: { usd: 'fx-us-holiday rates.json decision path', others: 'rates-exotic.json annual approximate policy rates (from memory, not fetched)', markupPct: P.MARKUP, note: '(USD rate - other rate - markup) / 365 a rollover, three on a Wednesday candle; holiday value-date days not modelled' },
    basket: { whole, firstHalf: h1, secondHalf: h2, welchVsOrdinaryGrossT: r4(W.t), ordinaryGrossPct: pct(mean(ordinary.map((r) => r.c1.gross))), byType, perLeg },
    pairs: alone,
    placebo: { seeds: P.SEEDS, need: P.SEEDS_NEED, ordinaryDays: ordinary.length, realNetR: whole.netR, beaten: beat, seedNetR: pl.map(r4) },
    tests: { T1, T2, T3, T4 },
    trades: A.map((r) => ({ ymd: r.ymd, hol: r.hol, name: r.name, entry: r.entryYmd, grossPct: pct(r.c1.gross), netR: r4(r.c1.netR), stops: r.c1.stops })),
  };
}

// --- report ----------------------------------------------------------------------------------------------------------------
const f = (x, d = 3) => (x == null ? 'n/a' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d));
export function headline(R) {
  const w = R.basket.whole;
  return `${R.verdict === 'PASS' ? 'Passes' : 'Fails'}: long USD on the day after a US holiday against six other currencies makes ${f(w.netR)}R a holiday net 2005-26 (n ${w.n}, t ${f(w.t, 2)}).`;
}
export function report(R) {
  const o = [], B = R.basket, w = B.whole, PL = R.placebo, T = R.tests;
  o.push(`# Result: the US dollar on the day after a US market holiday, replicated on other dollar pairs (${R.built})`, '');
  o.push(`**Verdict: ${R.verdict}**: ${headline(R).replace(/^(Passes|Fails): /, '')}`, '');
  o.push(`Judged on the pre-registered bar (PREREGISTRATION.md, pushed alone before any candle was read). The hypothesis replicated is the side observation of \`research/edge/fx-us-holiday\` (PR #975): ${R.replicates.observation}. ` +
    `Here, on ${R.data.basket.length} dollar pairs that study never read, over ${R.window.from} to ${R.window.to}: ${f(w.netR)}R a holiday after costs and financing (n ${w.n}, event t ${f(w.t, 2)}, month-sum t ${f(w.monthT, 2)}); ` +
    `at 2x cost ${f(w.netR2)}R; first half ${f(B.firstHalf.netR)}R (n ${B.firstHalf.n}), second half ${f(B.secondHalf.netR)}R (n ${B.secondHalf.n}); above ${PL.beaten} of ${PL.seeds} placebo seeds. ` +
    `${R.verdict === 'PASS' ? 'A hypothesis supported on a second set of markets, still paper only; nothing live changed.' : "#975's side observation does not carry to these dollar pairs. Nothing live changed and no proposal follows."}`, '');
  o.push(`Data: ${R.data.src}. Judged basket: ${R.data.basket.map((k) => k.toUpperCase()).join(', ')}, equal weight, every leg long USD; reported only: ${R.data.reportedOnly.map((k) => k.toUpperCase()).join(', ')}; dropped: USDHKD (${R.data.dropped.usdhkd}). ` +
    `Basket days ${R.data.first} to ${R.data.last} (${R.data.basketDays}; ${R.data.skipped} dates skipped where a pair lacked the day or its previous candle differed). Post-holiday days without a basket candle: ${R.data.missingPost.length ? R.data.missingPost.join(', ') : 'none'}. ` +
    `**The close is the UTC daily close (19:00 or 20:00 New York), not 17:00 New York**, as in #975. Costs are **assumed** spreads (the demo broker does not quote these pairs): ${Object.entries(R.costs.spreadRT).map(([k, v]) => `${k.toUpperCase()} ${(v * 100).toFixed(2)} %`).join(', ')} a round trip, plus ${(R.costs.commissionRT * 100).toFixed(4)} % commission. ` +
    `Financing: (USD rate − the other currency's rate − ${R.financing.markupPct} %) / 365 a rollover, three on a Wednesday candle; USD from #975's rate path, the others annual approximate policy rates from memory (\`rates-exotic.json\`); holiday value-date days not modelled.`, '');
  const row = (lab, x) => `| ${lab} | ${x.n} | ${f(x.grossPct, 4)} | ${f(x.grossR)} | ${f(x.finR)} | ${f(x.costR)} | ${f(x.netR0)} | ${f(x.netR)} | ${f(x.netR2)} | ${f(x.t, 2)} | ${f(x.monthT, 2)} (${x.months}) | ${(x.won * 100).toFixed(1)} % | ${x.legStops} |`;
  o.push('## The basket (judged)', '', '| Window | n | gross % | gross R | financing R | cost R | net R cost 0 | net R base | net R 2x | event t | month-sum t (months) | won | leg stops |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  o.push(row(`Whole ${R.window.from} to ${R.window.to}`, w), row('First half to 2015-12-31', B.firstHalf), row('Second half from 2016-01-01', B.secondHalf), '');
  o.push(`Welch t of the gross basket % on post-holiday days against ${PL.ordinaryDays} ordinary days: ${f(B.welchVsOrdinaryGrossT, 2)} (ordinary days ${f(B.ordinaryGrossPct, 4)} % a day long USD).`, '');
  o.push('## Pass bar', '', '| Test | Holds |', '|---|---|',
    `| T1 net R > 0, event t >= 2 and month-sum t >= 2 | ${T.T1 ? 'yes' : 'no'} (${f(w.netR)}R, t ${f(w.t, 2)}, month t ${f(w.monthT, 2)}) |`,
    `| T2 net R > 0 at 2x cost | ${T.T2 ? 'yes' : 'no'} (${f(w.netR2)}R) |`,
    `| T3 above at least ${PL.need} of ${PL.seeds} placebo seeds | ${T.T3 ? 'yes' : 'no'} (${PL.beaten} of ${PL.seeds}) |`,
    `| T4 net R > 0 in both halves | ${T.T4 ? 'yes' : 'no'} (${f(B.firstHalf.netR)}R, ${f(B.secondHalf.netR)}R) |`, '');
  o.push('## Placebo', '', `${PL.seeds} seeds, each drawing as many ordinary days per year as the rule traded (from ${PL.ordinaryDays} ordinary days: NYSE trading days that are neither the day before nor the day after a holiday), traded long USD with the same stop, costs and financing. The rule's ${f(PL.realNetR)}R is above ${PL.beaten} of them; seed means range ${f(Math.min(...PL.seedNetR))}R to ${f(Math.max(...PL.seedNetR))}R.`, '');
  o.push('## Per leg inside the basket (same days)', '', '| Pair | n | gross R | financing R | cost R | net R | t | stops |', '|---|---|---|---|---|---|---|---|');
  for (const x of B.perLeg) o.push(`| ${x.pair.toUpperCase()} | ${x.n} | ${f(x.grossR)} | ${f(x.finR)} | ${f(x.costR)} | ${f(x.netR)} | ${f(x.t, 2)} | ${x.stops} |`);
  o.push('', '## Each pair alone, on its own candles (reported only)', '', '| Pair | in basket | n | from | net R cost 0 | net R base | net R 2x | t | financing R |', '|---|---|---|---|---|---|---|---|---|');
  for (const x of R.pairs) o.push(`| ${x.pair.toUpperCase()} | ${x.judged ? 'yes' : 'no'} | ${x.n} | ${x.from} | ${f(x.netR0)} | ${f(x.netR)} | ${f(x.netR2)} | ${f(x.t, 2)} | ${f(x.finR)} |`);
  o.push('', '## By holiday (reported only)', '', '| Holiday before the day | n | net R | t |', '|---|---|---|---|');
  for (const x of B.byType) o.push(`| ${x.name} | ${x.n} | ${f(x.netR)} | ${f(x.t, 2)} |`);
  o.push('', '## Reading', '');
  o.push('- One observation is one holiday (the six legs of one basket are one bet); about nine holidays a year over 22 years.');
  o.push('- The side, the day, the hold, the stop and the bar were fixed from #975 before these candles were read; nothing was chosen on them.');
  o.push(`- Before costs the day after a US holiday does stand out on these pairs too: ${f(w.netR0)}R a holiday with financing but no spread (t ${f(w.t0, 2)}), a gross Welch t of ${f(B.welchVsOrdinaryGrossT, 2)} against ordinary days, and every leg positive gross. That is the same sign as #975's majors, so the dollar's move may be real; but the spreads of these pairs (assumed, ${f(w.costR)}R a holiday) take most of it, the first half is ${f(B.firstHalf.netR)}R, and the net t is ${f(w.t, 2)}. The placebo pass (${PL.beaten} of ${PL.seeds}) mostly says ordinary days lose the same costs; it is not enough on its own. Not an edge, not a proposal.`);
  o.push('- Long USD against these currencies pays carry on most days (their rates are mostly above the US rate); it is charged on the approximate annual table, and three nights on a Wednesday candle. The spreads are assumptions, not measurements: cost 0 is shown beside base and 2x.');
  o.push('- The UTC close sits two or three hours after the 17:00 New York rollover, as in #975.');
  o.push('- Paper only. Never call this an edge without its n and t.');
  o.push('', 'To repeat: `node research/edge/fx-post-holiday-replicate/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `… full <dir>`. Test: `tests/fx-post-holiday-replicate.test.mjs`.');
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
    console.log(R.verdict, JSON.stringify({ basket: R.basket.whole, h1: R.basket.firstHalf.netR, h2: R.basket.secondHalf.netR, placebo: R.placebo.beaten, tests: R.tests }));
  } else console.log('usage: node run.mjs fetch <dir> | full <dir>');
}
