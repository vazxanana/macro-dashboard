// Edge research · passing-rules-book: ACCOUNTING, no rule tested (PREREGISTRATION.md). The five rules that passed their own
// pre-registered tests, as daily R series 2016 → 2026-11-19 at 1R a trade each, alone and as one equal-1R book: R a year, month t,
// worst closed drawdown, time under water, worst year, correlations, a seeded month-block bootstrap of 3-year outcomes, and the
// same at 0.25 % risk a trade. In-sample years for at least one rule: a description, not evidence. Nothing live reads it.
// Every rule's trades come from its own study's code or committed trade list (imported, never edited).
//   node research/edge/passing-rules-book/run.mjs            (candles: the shared edgekit cache)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from '../_lib/edgekit.mjs';
import { tradesIn, stats as gStats, daysOf, WINDOWS as GW } from '../gold-vol-breakout-hourcost/costs.mjs';
import { charge as gCharge } from '../gold-vol-breakout-hourcost/run.mjs';
import { frozenCost, checkCopies, SLIP } from '../gold-vol-breakout-forward/run.mjs';
import * as GT from '../gotobi/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), EDGE = path.join(HERE, '..');
export const FROM = '2016-01-01', END = '2026-11-19', SEED = 20261124, DRAWS = 20000, HORIZON = 36, RISK = 0.25;
export const KEYS = ['goldVB', 'jpyVB', 'gotobi', 'preHol', 'turn'];
export const NAMES = { goldVB: 'Gold volatility breakout T1', jpyVB: 'USD/JPY volatility breakout T1', gotobi: 'Gotobi fade T2 (USD/JPY)',
  preHol: 'Gold before a US holiday T1', turn: 'Turnaround Tuesday R2 (NAS100)', book: 'Equal-1R book (all five)', bookExec: 'Book, gotobi at broker quotes from 24 Nov 2023' };
export const COSTS = { goldVB: 'measured hourly spread + 0.05 x M slippage (C1)', jpyVB: 'demo commission + 0.5 pip (pre-set)',
  gotobi: 'assumed ~2 pips a round trip (the study\'s own; measured 0.81 pip)', preHol: 'assumed $0.60 + financing', turn: 'assumed 0.05 % + financing' };
const GOLD_GATE = { W3: { n: 935, netR: 0.094, t: 2.41 }, W4: { n: 1121, netR: 0.105, t: 2.79 } };
const GOTOBI_GATE = { n: 771, netR: 0.1481, t: 2.74, lastDay: '2026-11-11' };

const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const readJ = (p) => JSON.parse(fs.readFileSync(path.join(EDGE, p), 'utf8'));
const addD = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400e3);

// ── pure pieces (tested) ──
export function weekdays(from, to) { const out = []; for (let d = from; d <= to; d = addD(d, 1)) { const w = new Date(d + 'T00:00:00Z').getUTCDay(); if (w && w !== 6) out.push(d); } return out; }
export function monthsOf(from, to) { const out = []; let [y, m] = from.split('-').map(Number); const [Y, M] = to.split('-').map(Number); while (y < Y || (y === Y && m <= M)) { out.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++; } } return out; }
// rows [[day, R]] -> { daily: Float64 per weekday, monthly: per month, trades }
export function series(rows, days, months) {
  const di = new Map(days.map((d, i) => [d, i])), mi = new Map(months.map((m, i) => [m, i]));
  const daily = new Array(days.length).fill(0), monthly = new Array(months.length).fill(0); let n = 0;
  for (const [d, r] of rows) {
    if (d < days[0] || d > days.at(-1)) continue;
    let i = di.get(d); if (i == null) { let x = d; while (!di.has(x)) x = addD(x, 1); i = di.get(x); } // a weekend booking goes to the next weekday
    daily[i] += r; monthly[mi.get(days[i].slice(0, 7))] += r; n++;
  }
  return { daily, monthly, trades: n };
}
export function drawdown(daily, days) {
  let cum = 0, peak = 0, peakDay = addD(days[0], -1), below = false, dd = 0, ddFrom = null, ddTo = null, uw = 0, uwFrom = null, uwTo = null, uwOpen = false;
  for (let i = 0; i < daily.length; i++) {
    cum += daily[i];
    if (cum >= peak - 1e-9) {
      if (below) { const len = dayDiff(peakDay, days[i]); if (len > uw) { uw = len; uwFrom = peakDay; uwTo = days[i]; } }
      peak = Math.max(peak, cum); peakDay = days[i]; below = false;
    } else { below = true; if (cum - peak < dd) { dd = cum - peak; ddFrom = peakDay; ddTo = days[i]; } }
  }
  if (below) { const len = dayDiff(peakDay, days.at(-1)); if (len > uw) { uw = len; uwFrom = peakDay; uwTo = days.at(-1); uwOpen = true; } }
  return { maxDD: r2(dd), ddFrom, ddTo, underWaterDays: uw, uwFrom, uwTo, uwOpen };
}
export function pathDD(vals) { let c = 0, p = 0, d = 0; for (const v of vals) { c += v; p = Math.max(p, c); d = Math.min(d, c - p); } return d; }
export function corr(a, b) { const ma = mean(a), mb = mean(b); let s = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { s += (a[i] - ma) * (b[i] - mb); x += (a[i] - ma) ** 2; y += (b[i] - mb) ** 2; } return s / Math.sqrt(x * y); }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const q = (s, p) => { const i = p * (s.length - 1), lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };
export function bootstrap(monthly, { seed = SEED, draws = DRAWS, h = HORIZON } = {}) {
  const R = rng(seed), tot = [], dd = []; let neg = 0;
  for (let k = 0; k < draws; k++) { const v = []; for (let j = 0; j < h; j++) v.push(monthly[Math.floor(R() * monthly.length)]); const s = v.reduce((a, b) => a + b, 0); tot.push(s); dd.push(pathDD(v)); if (s < 0) neg++; }
  tot.sort((a, b) => a - b); dd.sort((a, b) => a - b);
  return { months: h, draws, seed, total: { p5: r2(q(tot, 0.05)), p50: r2(q(tot, 0.5)), p95: r2(q(tot, 0.95)) }, worstDD: { p5: r2(q(dd, 0.05)), p50: r2(q(dd, 0.5)), p95: r2(q(dd, 0.95)) }, shareBelowZero: r3(neg / draws) };
}
export function describe(s, days, months) {
  const years = {}; days.forEach((d, i) => { years[d.slice(0, 4)] = (years[d.slice(0, 4)] || 0) + s.daily[i]; });
  const full = Object.entries(years).filter(([y]) => y < END.slice(0, 4)), worst = full.reduce((a, b) => (b[1] < a[1] ? b : a));
  const m = s.monthly, tot = m.reduce((a, b) => a + b, 0);
  const out = { trades: s.trades, totalR: r2(tot), perTrade: s.trades ? r3(tot / s.trades) : null, perYear: r2(mean(m) * 12), monthT: r2(mean(m) / (sd(m) / Math.sqrt(m.length))),
    worstMonth: r2(Math.min(...m)), monthsPositive: m.filter((v) => v > 0).length, months: m.length, ...drawdown(s.daily, days),
    worstYear: { year: worst[0], R: r2(worst[1]) }, losingYears: full.filter(([, v]) => v < 0).map(([y]) => y), ytd2026: r2(years['2026'] || 0),
    years: Object.fromEntries(Object.entries(years).map(([y, v]) => [y, r2(v)])), boot: bootstrap(m) };
  out.pct = { riskPerTrade: RISK, perYear: r2(out.perYear * RISK / 1), maxDD: r2(out.maxDD * RISK), worstYear: r2(out.worstYear.R * RISK),
    boot3y: { p5: r2(out.boot.total.p5 * RISK), p50: r2(out.boot.total.p50 * RISK), p95: r2(out.boot.total.p95 * RISK) }, bootDD: { p5: r2(out.boot.worstDD.p5 * RISK), p50: r2(out.boot.worstDD.p50 * RISK) } };
  return out;
}

// ── sources ──
function asArr(bars) { return bars.map((b) => [b.t, b.o, b.h, b.l, b.c]); }
export function goldRows() {
  checkCopies();
  const cost = frozenCost();
  const { days } = daysOf(asArr(load('xau', '5m', { from: '2015-06-01' })));
  const gate = {};
  for (const w of ['W3', 'W4']) { const win = w === 'W4' ? [GW.W4[0], '2026-11-12'] : GW.W3; const st = gStats(gCharge(tradesIn(days, win).tr, cost.profile, 'frac', cost.commission, SLIP)); gate[w] = { got: { n: st.n, netR: st.netR, t: st.t }, want: GOLD_GATE[w], ok: Object.keys(GOLD_GATE[w]).every((k) => st[k] === GOLD_GATE[w][k]) }; }
  const tr = tradesIn(days, [FROM, END]).tr, net = gCharge(tr, cost.profile, 'frac', cost.commission, SLIP);
  return { rows: net.map((x) => [x.day, x.net]), gate };
}
export function gotobiRows() {
  const bars = asArr(load('usdjpy', '5m', { from: '2009-10-01' }));
  const run = (last) => { const { G, all } = GT.runPair(bars, 'fade', last); return [...all.values()].filter((t) => G.has(t.day) && t.day >= FROM); };
  const g = GT.summary(run(GOTOBI_GATE.lastDay));
  const gate = { got: { n: g.n, netR: g.netR, t: g.t }, want: GOTOBI_GATE, ok: g.n === GOTOBI_GATE.n && g.netR === GOTOBI_GATE.netR && g.t === GOTOBI_GATE.t };
  const tr = run(END);
  return { rows: tr.map((t) => [t.day, t.net]), gate };
}
export function committedRows() {
  const jb = readJ('usdjpy-vol-breakout-forward/baseline.json');
  const ph = readJ('gold-pre-holiday/result.json').tests.T1.trades.map((t) => [t.day, t.net]);
  const tt = readJ('turnaround-tuesday/result.json').cells['nas100-r2'].trades.map((t) => [t[1], t[6]]);
  const tf = readJ('turnaround-tuesday-forward/result.json').trades.filter((t) => t.exitD <= END && !tt.some((x) => x[0] === t.exitD)).map((t) => [t.exitD, t.R]);
  const ex = readJ('gotobi-exec/result.json').trades.map((t) => [t.day, t.E]);
  return { jpyVB: jb.rows, jpyGate: jb.gate, preHol: ph, turn: [...tt, ...tf], turnFwd: tf.length, exec: ex };
}

export function build(src) {
  const days = weekdays(FROM, END), months = monthsOf(FROM.slice(0, 7), END.slice(0, 7));
  const S = Object.fromEntries(KEYS.map((k) => [k, series(src[k], days, months)]));
  const sum = (ks, over = {}) => { const d = days.map((_, i) => ks.reduce((a, k) => a + (over[k] || S[k]).daily[i], 0)), mm = months.map((_, i) => ks.reduce((a, k) => a + (over[k] || S[k]).monthly[i], 0)); return { daily: d, monthly: mm, trades: ks.reduce((a, k) => a + (over[k] || S[k]).trades, 0) }; };
  const execDays = new Set(src.exec.map((x) => x[0])), gExec = series([...src.gotobi.filter(([d]) => !execDays.has(d)), ...src.exec], days, months);
  const rules = Object.fromEntries(KEYS.map((k) => [k, { name: NAMES[k], cost: COSTS[k], ...describe(S[k], days, months) }]));
  const book = { name: NAMES.book, ...describe(sum(KEYS), days, months) }, bookExec = { name: NAMES.bookExec, ...describe(sum(KEYS, { gotobi: gExec }), days, months) };
  const mat = (f) => Object.fromEntries(KEYS.map((a) => [a, Object.fromEntries(KEYS.map((b) => [b, r3(corr(S[a][f], S[b][f]))]))]));
  // same-day overlap of the two USD/JPY rules
  const both = days.filter((_, i) => S.jpyVB.daily[i] !== 0 && S.gotobi.daily[i] !== 0).length;
  return { window: [FROM, END], weekdays: days.length, months: months.length, monthKeys: months, monthly: Object.fromEntries(KEYS.map((k) => [k, S[k].monthly.map(r3)])), rules, book, bookExec, corrDaily: mat('daily'), corrMonthly: mat('monthly'), usdjpySameDay: both };
}

function fmt(v, d = 2) { return v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d); }
export function report(R) {
  const all = [...KEYS.map((k) => [k, R.rules[k]]), ['book', R.book], ['bookExec', R.bookExec]];
  const L = ['# The passing rules as one paper book, 2016 → 19 Nov 2026', '',
    `**${R.verdict}**`, '',
    'Pre-registered in `PREREGISTRATION.md` (committed alone before any figure). **Every year here is in sample for at least one of the five rules**, so this is a description of how the record looked, not evidence that it will continue. Costs: gold breakout measured (hourly spread), USD/JPY breakout pre-set demo cost, gotobi the study\'s own assumed ~2 pips (the broker quotes measured 0.81; second book line), pre-holiday and Turnaround assumed. 1R a trade each, nothing compounded. Paper research only; nothing live changed. Written by `run.mjs`.', '',
    `Gates: gold breakout W3 ${R.gates.gold.W3.ok ? 'ok' : 'MISSED'} (${JSON.stringify(R.gates.gold.W3.got)}), W4 ${R.gates.gold.W4.ok ? 'ok' : 'MISSED'} (${JSON.stringify(R.gates.gold.W4.got)}); gotobi T2 ${R.gates.gotobi.ok ? 'ok' : 'MISSED'} (${JSON.stringify(R.gates.gotobi.got)}); USD/JPY baseline ${JSON.stringify(R.gates.jpyVB)}.`, '',
    `## Per rule and the book (${R.months} months, ${R.weekdays} weekdays)`, '',
    '| | Trades | Total R | R a trade | R a year | Month t | Months up | Worst month | Worst closed DD (R) | DD from → to | Longest under water (days) | Worst full year | Losing years | 2026 to date |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...all.map(([, x]) => `| ${x.name} | ${x.trades} | ${fmt(x.totalR, 1)} | ${fmt(x.perTrade, 3)} | ${fmt(x.perYear, 1)} | ${x.monthT.toFixed(2)} | ${x.monthsPositive} of ${x.months} | ${fmt(x.worstMonth, 1)} | ${fmt(x.maxDD, 1)} | ${x.ddFrom} → ${x.ddTo} | ${x.underWaterDays}${x.uwOpen ? ' (still open)' : ''} (${x.uwFrom} →) | ${x.worstYear.year} ${fmt(x.worstYear.R, 1)} | ${x.losingYears.join(', ') || 'none'} | ${fmt(x.ytd2026, 1)} |`), '',
    '## Correlations', '', 'Daily (every weekday, 0 on days a rule did not trade):', '', `| | ${KEYS.join(' | ')} |`, `|---|${KEYS.map(() => '---').join('|')}|`,
    ...KEYS.map((a) => `| ${a} | ${KEYS.map((b) => R.corrDaily[a][b].toFixed(2)).join(' | ')} |`), '', 'Monthly sums:', '', `| | ${KEYS.join(' | ')} |`, `|---|${KEYS.map(() => '---').join('|')}|`,
    ...KEYS.map((a) => `| ${a} | ${KEYS.map((b) => R.corrMonthly[a][b].toFixed(2)).join(' | ')} |`), '',
    `The USD/JPY breakout and gotobi both traded on ${R.usdjpySameDay} weekdays (two USD/JPY positions on those mornings).`, '',
    `## Month-block bootstrap of 3 years (${R.book.boot.draws} draws of 36 months from the ${R.months}, seed ${R.book.boot.seed})`, '',
    '| | 3-year total R p5 | p50 | p95 | Share below 0 | Worst DD in the 3 years p50 | p5 (bad case) |', '|---|---|---|---|---|---|---|',
    ...all.map(([, x]) => `| ${x.name} | ${fmt(x.boot.total.p5, 1)} | ${fmt(x.boot.total.p50, 1)} | ${fmt(x.boot.total.p95, 1)} | ${(100 * x.boot.shareBelowZero).toFixed(1)} % | ${fmt(x.boot.worstDD.p50, 1)} | ${fmt(x.boot.worstDD.p5, 1)} |`), '',
    'Months are drawn as whole blocks, so a month\'s trades stay together; months are drawn independently, so a run of bad months (like 2023 for both breakouts) is likely under-represented. Built from in-sample years: the bands show the spread of the record, not a forecast.', '',
    `## At ${RISK} % risk a trade (simple %, not compounded)`, '',
    '| | % a year | Worst closed DD % | Worst full year % | 3-year p5 % | p50 % | p95 % | 3-year worst DD p5 % |', '|---|---|---|---|---|---|---|---|',
    ...all.map(([, x]) => `| ${x.name} | ${fmt(x.pct.perYear, 1)} | ${fmt(x.pct.maxDD, 1)} | ${fmt(x.pct.worstYear, 1)} | ${fmt(x.pct.boot3y.p5, 1)} | ${fmt(x.pct.boot3y.p50, 1)} | ${fmt(x.pct.boot3y.p95, 1)} | ${fmt(x.pct.bootDD.p5, 1)} |`), '',
    '## By year (R)', '', `| Year | ${all.map(([k]) => k).join(' | ')} |`, `|---|${all.map(() => '---').join('|')}|`,
    ...Object.keys(R.book.years).map((y) => `| ${y} | ${all.map(([, x]) => fmt(x.years[y], 1)).join(' | ')} |`), '',
    '## Notes', '', ...R.notes.map((n) => `- ${n}`), ''];
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const g = goldRows(); console.log('gold gate', JSON.stringify(g.gate));
  const t = gotobiRows(); console.log('gotobi gate', JSON.stringify(t.gate));
  if (!g.gate.W3.ok || !g.gate.W4.ok || !t.gate.ok) { console.error('gate missed: stopped'); process.exit(2); }
  const c = committedRows();
  const R = build({ goldVB: g.rows, jpyVB: c.jpyVB, gotobi: t.rows, preHol: c.preHol, turn: c.turn, exec: c.exec });
  R.study = 'passing-rules-book'; R.built = '2026-11-24';
  R.verdict = `ACCOUNTING (no rule tested): the equal-1R book of the five passing rules made ${fmt(R.book.totalR, 1)}R over ${R.months} months (${fmt(R.book.perYear, 1)}R a year, month t ${R.book.monthT.toFixed(2)}), worst closed drawdown ${fmt(R.book.maxDD, 1)}R, worst full year ${R.book.worstYear.year} ${fmt(R.book.worstYear.R, 1)}R; in-sample years for at least one rule, a description, not evidence`;
  R.gates = { gold: g.gate, gotobi: t.gate, jpyVB: c.jpyGate }; R.sources = { turnaroundForwardTrades: c.turnFwd, gotobiExecDays: c.exec.length };
  R.notes = [
    'In sample: the gold breakout was found on 2016-20 and judged on 2021-26; the USD/JPY breakout was found on 2016-26; gotobi judged on 2016-26; the pre-holiday long judged on 2017-26; Turnaround Tuesday judged on 2016-26. No year here is untouched for every rule.',
    'The forward records (gold breakout from 13 Nov, USD/JPY breakout from 20 Nov, pre-holiday from Thanksgiving, Turnaround from 12 Nov) are the judges; gotobi has only the demo job.',
    'Turnaround Tuesday and the pre-holiday long had their replications fail or not independent (research/proposals/2026-11-23-edge-book.md); they are in the book because the task named them.',
    'The 0.25 % figures add R x 0.25 % to the starting account; slippage beyond what each study charged is not counted.'];
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
  console.log(R.verdict);
}
