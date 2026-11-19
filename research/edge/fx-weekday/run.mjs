// Day-of-week effects in the US dollar basket (research/edge/fx-weekday, PREREGISTRATION.md). Paper research.
//   node run.mjs fetch <dir>   copies the council's daily candle cache of the six pairs out of the council-data branch (git show,
//                              no network) and freezes the demo broker's swaps into swaps.json beside this file
//   node run.mjs full <dir>    runs the study on <dir>/<key>.json and writes result.json + RESULT.md next to this file
// Rule, costs, tests and pass bar are fixed in PREREGISTRATION.md; nothing here is tuned.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const readJ = (f) => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'));
export const RATES = readJ('rates.json');
export const SWAPS = fs.existsSync(path.join(HERE, 'swaps.json')) ? readJ('swaps.json') : null;

// the six legs; usd = the pair side that is long the US dollar; base / quote currency for the rate gap
export const LEGS = [
  { ccy: 'eur', key: 'eurusd', sym: 'EURUSD', usd: -1, base: 'eur', quote: 'usd' },
  { ccy: 'gbp', key: 'gbpusd', sym: 'GBPUSD', usd: -1, base: 'gbp', quote: 'usd' },
  { ccy: 'aud', key: 'audusd', sym: 'AUDUSD', usd: -1, base: 'aud', quote: 'usd' },
  { ccy: 'nzd', key: 'nzdusd', sym: 'NZDUSD', usd: -1, base: 'nzd', quote: 'usd' },
  { ccy: 'jpy', key: 'usdjpy', sym: 'USDJPY', usd: 1, base: 'usd', quote: 'jpy' },
  { ccy: 'chf', key: 'usdchf', sym: 'USDCHF', usd: 1, base: 'usd', quote: 'chf' },
];
export const P = { ATR_N: 20, STOP_ATR: 2, SPREAD_PIP: 0.3, COMM_RT: 0.000045, MARKUP: 1.0, TRIPLE_WD: 3, SEEDS: 40,
  DEC: ['2016-01-04', '9999-12-31'], REP: ['2005-01-03', '2015-12-31'], HOLM_BAR: 0.05 };
export const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const pipOf = (key) => (key.endsWith('jpy') ? 0.01 : 0.0001);

// --- statistics ----------------------------------------------------------------------------------------------------------
export const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
export const variance = (a) => { const m = mean(a); return a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1); };
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return { t: null, diff: null };
  const diff = mean(a) - mean(b), se = Math.sqrt(variance(a) / a.length + variance(b) / b.length);
  return { t: diff / se, diff };
}
export function tOne(a) { if (a.length < 2) return null; return mean(a) / Math.sqrt(variance(a) / a.length); }
// erfc (Numerical Recipes, 1.2e-7) -> two-sided normal p of a t
function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r; }
export const pTwo = (t) => (t == null ? 1 : erfc(Math.abs(t) / Math.SQRT2));
export function holm(ps) {
  const o = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), out = Array(ps.length); let run = 0;
  o.forEach((x, j) => { run = Math.max(run, Math.min(1, (ps.length - j) * x.p)); out[x.i] = run; });
  return out;
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// --- rates and swaps -----------------------------------------------------------------------------------------------------
export function rateAt(ccy, ymd, rates = RATES) {
  const x = rates.decisions[ccy]; let r = x.from[1];
  for (const [d, v] of x.changes) { if (d <= ymd) r = v; else break; }
  return r;
}
// financing of one night on one leg as a share of the entry price; side +1 long the pair, -1 short it
export function finNight(leg, side, entry, ymd, { markupMult = 1, swaps = SWAPS, rates = RATES } = {}) {
  const sw = swaps && swaps.symbols && swaps.symbols[leg.sym];
  if (sw) { const pips = side > 0 ? sw.long : sw.short; return { frac: pips * 10 ** -sw.pipPosition / entry, src: 'broker' }; }
  const gap = rateAt(leg.base, ymd, rates) - rateAt(leg.quote, ymd, rates);
  return { frac: (side * gap - P.MARKUP * markupMult) / 100 / 365, src: 'rates' };
}
export const nightsOf = (t) => (new Date(t * 1000).getUTCDay() === P.TRIPLE_WD ? 3 : 1);

// --- candles -------------------------------------------------------------------------------------------------------------
export function fold(rows) { return foldWeekend(rows.map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }))); }
export function atr(bars, i, n = P.ATR_N) {
  if (i < n) return null; let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const b = bars[k], pc = bars[k - 1].close; s += Math.max(b.high, pc) - Math.min(b.low, pc); }
  return s / n;
}
// one leg's one-day position: entry at bars[k-1].close, exit at bars[k] close or its 2 x ATR stop
export function legDay(bars, k, leg, side, { costMult = 1, swaps = SWAPS, rates = RATES } = {}) {
  const a = atr(bars, k - 1); if (!a || !(a > 0)) return null;
  const b = bars[k], entry = bars[k - 1].close, r0 = P.STOP_ATR * a, stop = entry - side * r0;
  let exit = b.close, kind = 'close';
  if (side > 0 ? b.open <= stop : b.open >= stop) { exit = b.open; kind = 'gap'; }
  else if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; kind = 'stop'; }
  const gross = side * (exit - entry) / entry;
  const cost = costMult * (P.SPREAD_PIP * pipOf(leg.key) / entry + P.COMM_RT);
  const f = finNight(leg, side, entry, ymdOf(b.time), { markupMult: costMult, swaps, rates }), n = nightsOf(b.time);
  const fin = f.frac * n, net = gross - cost + fin, k2 = entry / r0;
  return { gross, cost, fin, net, grossR: gross * k2, netR: net * k2, kind, finSrc: f.src };
}

// basket days: the dates all six pairs share, with the same previous candle date and an ATR
export function basketDays(data) {
  const idx = LEGS.map((l) => new Map(data[l.key].map((b, i) => [ymdOf(b.time), i])));
  const out = []; let skipped = 0;
  for (let i = 1; i < data.eurusd.length; i++) {
    const ymd = ymdOf(data.eurusd[i].time), wd = new Date(data.eurusd[i].time * 1000).getUTCDay();
    if (wd < 1 || wd > 5) continue;
    const ks = idx.map((m) => m.get(ymd)); if (ks.some((k) => k == null || k < P.ATR_N + 1)) { skipped++; continue; }
    const prev = ks.map((k, j) => ymdOf(data[LEGS[j].key][k - 1].time));
    if (prev.some((p) => p !== prev[0])) { skipped++; continue; }
    out.push({ ymd, wd, t: data.eurusd[i].time, ks });
  }
  return { days: out, skipped };
}
// the basket on a day, on side s (+1 long USD, -1 short USD)
export function basket(data, day, s, opts = {}) {
  const legs = LEGS.map((l, j) => legDay(data[l.key], day.ks[j], l, l.usd * s, opts));
  if (legs.some((x) => !x)) return null;
  const m = (f) => mean(legs.map(f));
  return { gross: m((x) => x.gross), net: m((x) => x.net), cost: m((x) => x.cost), fin: m((x) => x.fin), grossR: m((x) => x.grossR),
    netR: m((x) => x.netR), stops: legs.filter((x) => x.kind !== 'close').length, legs };
}
export const inWin = (ymd, w) => ymd >= w[0] && ymd <= w[1];

// the five Welch tests on gross long-USD daily % of a set of days ({ wd, g }), labels as given
export function scan(rows) {
  return [1, 2, 3, 4, 5].map((wd) => welch(rows.filter((r) => r.wd === wd).map((r) => r.g), rows.filter((r) => r.wd !== wd).map((r) => r.g)));
}
// month t: per month, mean W gross minus mean of the other weekdays' gross, one-sample t of those differences
export function monthT(rows, wd) {
  const by = new Map();
  for (const r of rows) { const m = r.ymd.slice(0, 7); if (!by.has(m)) by.set(m, { a: [], b: [] }); (r.wd === wd ? by.get(m).a : by.get(m).b).push(r.g); }
  const d = []; for (const v of by.values()) if (v.a.length && v.b.length) d.push(mean(v.a) - mean(v.b));
  return { t: tOne(d), months: d.length };
}
export function placebo(rows, seeds = P.SEEDS) {
  const out = [];
  for (let s = 1; s <= seeds; s++) {
    const r = rng(s), lab = rows.map((x) => x.wd);
    for (let i = lab.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [lab[i], lab[j]] = [lab[j], lab[i]]; }
    const ts = scan(rows.map((x, i) => ({ wd: lab[i], g: x.g }))).map((w) => w.t);
    const hp = holm(ts.map(pTwo));
    out.push({ seed: s, maxAbsT: Math.max(...ts.map(Math.abs)), minHolm: Math.min(...hp) });
  }
  return out;
}

// --- the study -----------------------------------------------------------------------------------------------------------
const r4 = (x) => (x == null ? null : Math.round(x * 1e4) / 1e4), r6 = (x) => (x == null ? null : Math.round(x * 1e6) / 1e6);
const pct = (x) => r4(x * 100);   // a share as % (4 dp)
export function study(data) {
  const { days, skipped } = basketDays(data);
  const rows = [];
  for (const d of days) {
    const L = basket(data, d, 1), S = basket(data, d, -1), L2 = basket(data, d, 1, { costMult: 2 }), S2 = basket(data, d, -1, { costMult: 2 });
    if (!L || !S) continue;
    rows.push({ ymd: d.ymd, wd: d.wd, g: L.gross, L, S, L2, S2 });
  }
  const win = (w) => rows.filter((r) => inWin(r.ymd, w));
  const dec = win(P.DEC), rep = win(P.REP);
  const decT = scan(dec), repT = scan(rep), hp = holm(decT.map((x) => pTwo(x.t)));
  const finSrc = Object.fromEntries(LEGS.map((l) => [l.ccy, finNight(l, 1, 1, '2020-01-01').src]));
  const wdays = [1, 2, 3, 4, 5].map((wd, i) => {
    const s = decT[i].diff >= 0 ? 1 : -1, side = s > 0 ? 'long USD' : 'short USD';
    const stats = (set, T) => {
      const w = set.filter((r) => r.wd === wd), B = (r) => (s > 0 ? r.L : r.S), B2 = (r) => (s > 0 ? r.L2 : r.S2), mt = monthT(set, wd);
      return { n: w.length, grossPctLongUsd: pct(mean(w.map((r) => r.g))), restGrossPctLongUsd: pct(mean(set.filter((r) => r.wd !== wd).map((r) => r.g))),
        welchT: r4(T.t), p: r4(pTwo(T.t)), monthT: r4(mt.t), months: mt.months,
        side, grossPctSide: pct(mean(w.map((r) => B(r).gross))), netPctSide: pct(mean(w.map((r) => B(r).net))), grossRSide: r4(mean(w.map((r) => B(r).grossR))),
        netRSide: r4(mean(w.map((r) => B(r).netR))), netPctLongUsd: pct(mean(w.map((r) => r.L.net))), costPct: pct(mean(w.map((r) => B(r).cost))),
        finPct: pct(mean(w.map((r) => B(r).fin))), won: r4(w.filter((r) => B(r).net > 0).length / w.length), legStops: w.reduce((x, r) => x + B(r).stops, 0),
        x2: { netPctSide: pct(mean(w.map((r) => B2(r).net))), netRSide: r4(mean(w.map((r) => B2(r).netR))) } };
    };
    const D = stats(dec, decT[i]), R = stats(rep, repT[i]);
    D.holmP = r4(hp[i]);
    const p1 = D.netPctSide > 0 && R.netPctSide > 0, p2 = hp[i] < P.HOLM_BAR, p3 = D.netRSide > 0;
    const x2 = { p1: D.x2.netPctSide > 0 && R.x2.netPctSide > 0, p3: D.x2.netRSide > 0 };
    return { wd, day: DAYS[wd], side, decisive: D, replication: R, checks: { p1, p2, p3 }, pass: p1 && p2 && p3, x2 };
  });
  const pl = placebo(dec.map((r) => ({ wd: r.wd, g: r.g })));
  const realMax = Math.max(...decT.map((x) => Math.abs(x.t)));
  const passed = wdays.filter((w) => w.pass).map((w) => w.day);
  return {
    built: '2026-11-14', study: 'fx-weekday', title: 'Day-of-week effects in the US dollar basket',
    verdict: passed.length ? 'PASS' : 'FAIL', passed,
    data: { src: 'OANDA mid daily candles, council-data research/daily/<key>.json (git show), weekend folded into Monday (council/fills.mjs foldWeekend)',
      first: rows[0]?.ymd, last: rows.at(-1)?.ymd, days: rows.length, decisiveDays: dec.length, replicationDays: rep.length, skipped },
    windows: { decisive: [P.DEC[0], dec.at(-1)?.ymd], replication: [rep[0]?.ymd, rep.at(-1)?.ymd] },
    costs: { spreadPip: P.SPREAD_PIP, commissionRT: P.COMM_RT, note: 'one raw-spread round trip a day per leg; 2x check doubles spread, commission and the rate markup' },
    financing: { source: finSrc, swapsAt: SWAPS?.at || null, ratesFrom: 'origin/fx-carry research/edge/fx-carry/rates.json (approximate, from memory; see its about line)', markupPct: P.MARKUP,
      note: 'broker swaps of today applied to every year (EUR, GBP, AUD, CHF); NZD and JPY from the rate gap less the markup; Wednesday-labelled day pays three nights' },
    weekdays: wdays,
    placebo: { seeds: P.SEEDS, realMaxAbsT: r4(realMax), seedsWithHolmUnder05: pl.filter((x) => x.minHolm < P.HOLM_BAR).length,
      seedsMaxAbsTAtLeastReal: pl.filter((x) => x.maxAbsT >= realMax).length, seedMaxAbsT: pl.map((x) => r4(x.maxAbsT)) },
  };
}

// --- report --------------------------------------------------------------------------------------------------------------
const f = (x, d = 4) => (x == null ? 'n/a' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d));
export function report(R) {
  const o = [], W = R.weekdays, PL = R.placebo;
  const best = [...W].sort((a, b) => a.decisive.holmP - b.decisive.holmP)[0];
  o.push(`# Result: day-of-week effects in the US dollar basket (${R.built})`, '');
  o.push(`**Verdict: ${R.verdict}** on the pre-registered bar (PREREGISTRATION.md, pushed before any candle was read). ` +
    (R.verdict === 'PASS' ? `Passing: ${R.passed.join(', ')}.` : `No weekday of the long-USD basket (EUR, GBP, AUD, NZD, JPY, CHF, equal weight) is reliably different from the other four in 2016 to now: the smallest Holm-adjusted p is ${best.decisive.holmP} (${best.day}, Welch t ${f(best.decisive.welchT, 2)}).`) +
    ` Nothing live changed and no proposal follows.`, '');
  o.push(`Data: ${R.data.src}; basket days ${R.data.first} to ${R.data.last} (${R.data.days}; decisive ${R.data.decisiveDays}, replication ${R.data.replicationDays}; ${R.data.skipped} dates skipped where a pair lacked the day or its previous candle differed). Costs: ${R.costs.spreadPip} pip spread + ${(R.costs.commissionRT * 100).toFixed(4)} % commission a round trip per leg a day. Financing: broker swaps from council-data ctrader/symbols.json (frozen ${R.financing.swapsAt}) for EUR, GBP, AUD, CHF, today's swap for every year; the fx-carry study's approximate policy-rate table less a ${R.financing.markupPct} % markup for NZD and JPY; three nights on the Wednesday-labelled day.`, '');
  const tbl = (key, title) => {
    o.push(`### ${title}`, '', '| Weekday | n | gross % long USD | rest gross % | Welch t | p | month t | side | gross % side | net % side | net R side | won |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const w of W) { const x = w[key]; o.push(`| ${w.day} | ${x.n} | ${f(x.grossPctLongUsd)} | ${f(x.restGrossPctLongUsd)} | ${f(x.welchT, 2)} | ${x.p.toFixed(3)} | ${f(x.monthT, 2)} | ${x.side} | ${f(x.grossPctSide)} | ${f(x.netPctSide)} | ${f(x.netRSide, 3)} | ${(x.won * 100).toFixed(1)} % |`); }
    o.push('');
  };
  o.push('## Per weekday', '', 'Side = the direction of the decisive effect (weekday mean above the rest: long USD, below: short USD), used in both windows. % are per day, basket mean of the six legs.', '');
  tbl('decisive', `Decisive window ${R.windows.decisive[0]} to ${R.windows.decisive[1]}`);
  tbl('replication', `Replication window ${R.windows.replication[0]} to ${R.windows.replication[1]}`);
  o.push('## Pass bar', '', '| Weekday | P1 net same sign both windows | P2 decisive Holm p < 0.05 (Holm p) | P3 decisive net R > 0 | pass | at 2x cost: P1 / P3 (net R) |', '|---|---|---|---|---|---|');
  for (const w of W) o.push(`| ${w.day} | ${w.checks.p1 ? 'yes' : 'no'} | ${w.checks.p2 ? 'yes' : 'no'} (${w.decisive.holmP.toFixed(3)}) | ${w.checks.p3 ? 'yes' : 'no'} | ${w.pass ? 'PASS' : 'fail'} | ${w.x2.p1 ? 'yes' : 'no'} / ${w.x2.p3 ? 'yes' : 'no'} (${f(w.decisive.x2.netRSide, 3)}) |`);
  o.push('');
  o.push('## Placebo', '', `${PL.seeds} seeds of shuffled weekday labels on the decisive days: ${PL.seedsWithHolmUnder05} of ${PL.seeds} give a Holm p under 0.05 on some label; ${PL.seedsMaxAbsTAtLeastReal} of ${PL.seeds} have a largest |t| at least the real one (${PL.realMaxAbsT.toFixed(2)}).`, '');
  o.push('## Reading', '');
  o.push('- The costs are small next to a day\'s move but the day-of-week differences are smaller still: a few thousandths of a percent of price a day.');
  o.push(`- The 2 x ATR stop bound on ${W.map((w) => `${w.decisive.legStops}`).join(' / ')} leg-days (Monday to Friday, decisive, of about ${W[0].decisive.n * 6} each), on the side traded; a stop cuts a tail, so the gross % of the long and the short side are not exact mirrors.`);
  o.push('- Financing differs by weekday by construction (the Wednesday-labelled day pays three nights), which is why the Welch test is on gross returns and the tradeable checks on net.');
  o.push('- Today\'s broker swaps are charged on every past year; past swap rates are not on file. The NZD / JPY rate table is approximate (its own about line).');
  o.push('- Paper only. Never call a weekday an edge without its n and t; this scan gives none that passes.');
  o.push('', 'To repeat: `node research/edge/fx-weekday/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `… full <dir>`. Test: `tests/fx-weekday.test.mjs`.');
  return o.join('\n') + '\n';
}

// --- CLI -----------------------------------------------------------------------------------------------------------------
export function loadData(dir) { return Object.fromEntries(LEGS.map((l) => [l.key, fold(JSON.parse(fs.readFileSync(path.join(dir, `${l.key}.json`), 'utf8')).rows)])); }
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const l of LEGS) fs.writeFileSync(path.join(dir, `${l.key}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${l.key}.json`], { maxBuffer: 1 << 28 }));
    const s = JSON.parse(execFileSync('git', ['show', 'origin/council-data:ctrader/symbols.json'], { maxBuffer: 1 << 28 }));
    const symbols = {};
    for (const l of LEGS) { const x = s.symbols?.[l.sym]; if (x?.swap && x.swap.type === 0) symbols[l.sym] = { long: x.swap.long, short: x.swap.short, rollover3Days: x.swap.rollover3Days, pipPosition: x.pipPosition, commissionRT: x.commissionRT }; }
    fs.writeFileSync(path.join(HERE, 'swaps.json'), JSON.stringify({ about: 'Demo broker swaps (pips a lot a night, type 0) copied from council-data ctrader/symbols.json by run.mjs fetch; pairs absent there use rates.json', at: s.at, broker: s.broker, symbols }, null, 1) + '\n');
    console.log('fetched into', dir, 'swaps for', Object.keys(symbols).join(' '));
  } else if (cmd === 'full') {
    const R = study(loadData(dir));
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(R.verdict, JSON.stringify(R.weekdays.map((w) => [w.day, w.decisive.welchT, w.decisive.holmP, w.checks])));
  } else console.log('usage: node run.mjs fetch <dir> | full <dir>');
}
