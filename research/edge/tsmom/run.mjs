// Time-series momentum across asset classes (research/edge/tsmom, PREREGISTRATION.md): each month long a market whose 12-1 month
// return is positive, short one whose return is negative, 1R = 2 x ATR(63) (also the stop), equal risk per market, net of
// trading costs and financing, 25 OANDA markets of the council's daily candle cache. Paper research only.
//   node research/edge/tsmom/run.mjs fetch <dir>   copies the 25 daily files out of origin/council-data (git show, no network)
//   node research/edge/tsmom/run.mjs full <dir>    runs the study, writes result.json and RESULT.md next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const P = {
  SKIP: 21, LOOK: 252, ATR: 63, STOP_ATR: 2, STALE_D: 7, MARKUP: 2.5, FX_MARKUP: 1, SEEDS: 40, T_BAR: 2, ALPHA: 0.05,
  DECISIVE: ['2016-01', '2026-10'], REPLICATION: ['2008-01', '2015-12'], LATEST_START: '2008-01-01',
};
export const CLASSES = {
  indices: ['nas100', 'spx500', 'us30', 'de40', 'uk100', 'jp225', 'au200'],
  bonds: ['usb10y', 'de10yb', 'uk10yb'],
  commodities: ['xau', 'xag', 'bco', 'wtico', 'natgas', 'corn', 'wheat', 'soybn'],
  forex: ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad', 'usdchf', 'nzdusd'],
};
export const KEYS = Object.values(CLASSES).flat();
export const classOf = (k) => Object.keys(CLASSES).find((c) => CLASSES[c].includes(k));
export const TESTS = { T1: { name: 'All 25 markets', keys: KEYS }, T2: { name: 'Indices', keys: CLASSES.indices }, T3: { name: 'Bonds', keys: CLASSES.bonds }, T4: { name: 'Commodities', keys: CLASSES.commodities }, T5: { name: 'Forex', keys: CLASSES.forex } };
export const PAIRS = { eurusd: ['eur', 'usd'], gbpusd: ['gbp', 'usd'], usdjpy: ['usd', 'jpy'], audusd: ['aud', 'usd'], usdcad: ['usd', 'cad'], usdchf: ['usd', 'chf'], nzdusd: ['nzd', 'usd'] };
// round trip as a share of price (trend-breadth COST on main: fx, index, mid, wide; bonds an assumption at the mid level); gold $0.30
export const COST = { fx: 0.00015, index: 0.0003, mid: 0.001, wide: 0.002, bond: 0.001 };
const COST_OF = { xag: 'mid', bco: 'mid', wtico: 'mid', natgas: 'mid', corn: 'wide', wheat: 'wide', soybn: 'wide', usb10y: 'bond', de10yb: 'bond', uk10yb: 'bond' };
export const GOLD_COST = 0.30;
export function costOf(k, entry) {
  if (k === 'xau') return GOLD_COST;
  const c = classOf(k), g = COST_OF[k] || (c === 'forex' ? 'fx' : c === 'indices' ? 'index' : null);
  if (!g) throw new Error(`no cost for ${k}`);
  return COST[g] * entry;
}
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const nextYm = (s) => { const [y, m] = s.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };
const r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null);
const r4 = (v) => (Number.isFinite(v) ? +v.toFixed(4) : null);

// ── rates (copied into rates.json; never imported from another study) ──
export function usRate(R, t) {
  const d = new Date(t * 1000).toISOString().slice(0, 10), a = R.DGS2;
  let lo = 0, hi = a.length - 1, v = null;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m][0] <= d) { v = a[m][1]; lo = m + 1; } else hi = m - 1; }
  return v;
}
export function rateOf(R, ccy, t) {
  if (ccy === 'usd') return usRate(R, t);
  const y = new Date(t * 1000).getUTCFullYear(), tab = R[ccy];
  if (!tab) throw new Error(`no rate table for ${ccy}`);
  const v = tab[y] ?? tab[String(y)];
  if (v == null) throw new Error(`no ${ccy} rate for ${y}`);
  return v;
}
// annual financing COST in % for one position (negative = credited), side +1 long / -1 short
export function finRate(R, k, side, t) {
  const pair = PAIRS[k];
  if (pair) {
    const rb = rateOf(R, pair[0], t), rq = rateOf(R, pair[1], t);
    return side > 0 ? rq - rb + P.FX_MARKUP : rb - rq + P.FX_MARKUP;
  }
  const us = usRate(R, t);
  return side > 0 ? P.MARKUP + us : Math.max(0, P.MARKUP - us);
}

// ── per market, past data only ──
export function fold(rows) { return foldWeekend(rows.map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }))); }
export function atrAt(B, i, n = P.ATR) {
  if (i < n) return null;
  let a = 0;
  for (let j = i - n + 1; j <= i; j++) a += Math.max(B[j].high - B[j].low, Math.abs(B[j].high - B[j - 1].close), Math.abs(B[j].low - B[j - 1].close));
  return a / n;
}
export function signalAt(B, i) {
  if (i < P.LOOK) return null;
  const r = B[i - P.SKIP].close / B[i - P.LOOK].close - 1;
  return r > 0 ? 1 : r < 0 ? -1 : 0;
}
// indices of month-end rebalance candles: the last candle of its UTC month, followed by a candle of a later month, not stale
export function rebalances(B) {
  const out = [];
  for (let i = 0; i + 1 < B.length; i++) {
    const m = ym(B[i].time);
    if (ym(B[i + 1].time) === m) continue;
    const d = new Date(B[i].time * 1000), end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000;
    if (end - (B[i].time + DAY) > P.STALE_D * DAY) continue;
    out.push(i);
  }
  return out;
}
// one position: entry at B[e].open, stop on the losing side, closed at B[j].close unless stopped (gap -> the open)
export function position(B, e, j, side, r0) {
  const entry = B[e].open, stop = entry - side * r0;
  for (let d = e; d <= j; d++) {
    const b = B[d];
    if (d > e && (side > 0 ? b.open <= stop : b.open >= stop)) return { entry, stop, exit: b.open, x: d, stopped: true, gap: true };
    if (side > 0 ? b.low <= stop : b.high >= stop) return { entry, stop, exit: stop, x: d, stopped: true, gap: false };
  }
  return { entry, stop, exit: B[j].close, x: j, stopped: false, gap: false };
}
export function priced(k, B, p, side, r0, R) {
  const g = side * (p.exit - p.entry) / r0, cost = costOf(k, p.entry) / r0;
  const t0 = B[p.e].time, t1 = B[p.x].time + DAY, nn = nights(t0, t1), rate = finRate(R, k, side, t0);
  const fin = nn * rate / 100 / 365 * p.entry / r0;
  return { g, cost, fin, n: g - cost - fin, nights: nn, rate };
}
// every rebalance slot of one market with the long and the short outcome (so the placebo needs no re-simulation)
export function slots(k, B, R) {
  const rb = rebalances(B), out = [];
  for (let q = 0; q + 1 < rb.length; q++) {
    const i = rb[q], j = rb[q + 1], e = i + 1;
    if (i < P.LOOK || i < P.ATR) continue;
    const month = ym(B[e].time);
    if (month < P.REPLICATION[0] || month > P.DECISIVE[1]) continue;   // only the two windows' holding months are priced
    if (month !== nextYm(ym(B[i].time)) || ym(B[j].time) !== month) continue;
    const atr = atrAt(B, i), r0 = P.STOP_ATR * atr;
    if (!(r0 > 0)) continue;
    const s = signalAt(B, i), o = { k, month, i, e, j, s, r0, signalT: B[i].time };
    for (const side of [1, -1]) { const p = { ...position(B, e, j, side, r0), e }; o[side > 0 ? 'long' : 'short'] = { side, ...p, ...priced(k, B, p, side, r0, R) }; }
    out.push(o);
  }
  return out;
}

// ── statistics ──
export function stat(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null, sharpe: null, total: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null, sharpe: sd > 0 ? mean / sd * Math.sqrt(12) : null, total: mean * n };
}
export function maxDD(xs) { let c = 0, hi = 0, dd = 0; for (const x of xs) { c += x; hi = Math.max(hi, c); dd = Math.min(dd, c - hi); } return dd; }
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const normP = (t) => (Number.isFinite(t) ? 0.5 * (1 - erf(t / Math.SQRT2)) : 1);   // one-sided, P(Z > t)
export function holm(ps) {
  const m = ps.length, ord = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(m);
  let run = 0;
  ord.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (m - r) * p)); adj[i] = run; });
  return adj;
}
export function months([a, b]) { const out = []; for (let m = a; m <= b; m = nextYm(m)) out.push(m); return out; }
export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// positions of a stream: pick(slot) -> +1 / -1 / 0; field = 'n' (net), 'g' (gross), 'noFin'; x = cost multiplier
export function positionsOf(S, keys, pick) {
  const out = [];
  for (const k of keys) for (const o of S[k] || []) { const s = pick(o); if (!s) continue; out.push({ ...(s > 0 ? o.long : o.short), k, month: o.month }); }
  return out;
}
const valueOf = (p, field, x) => (field === 'g' ? p.g : field === 'noFin' ? p.g - x * p.cost : p.g - x * (p.cost + p.fin));
export function monthly(ps, win, field = 'n', x = 1) {
  const ms = months(win), by = Object.fromEntries(ms.map((m) => [m, 0]));
  for (const p of ps) if (p.month in by) by[p.month] += valueOf(p, field, x);
  return ms.map((m) => by[m]);
}
export function summarize(ps, win, field = 'n', x = 1) {
  const inW = ps.filter((p) => p.month >= win[0] && p.month <= win[1]), xs = monthly(ps, win, field, x), s = stat(xs);
  return { months: s.n, positions: inW.length, perMonth: r4(s.mean), sd: r4(s.sd), t: r2(s.t), sharpe: r2(s.sharpe), total: r2(s.total), dd: r2(maxDD(xs)),
    win: inW.length ? r3(inW.filter((p) => valueOf(p, field, x) > 0).length / inW.length) : null, stops: inW.filter((p) => p.stopped).length,
    long: inW.filter((p) => p.side > 0).length, short: inW.filter((p) => p.side < 0).length,
    grossPerPos: r4(stat(inW.map((p) => p.g)).mean), costPerPos: r4(stat(inW.map((p) => p.cost)).mean), finPerPos: r4(stat(inW.map((p) => p.fin)).mean) };
}
const pct = (xs, q) => { const a = [...xs].sort((x, y) => x - y), i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };

export function study(S) {
  const real = (o) => o.s;
  const W = { decisive: P.DECISIVE, replication: P.REPLICATION };
  const tests = {};
  for (const [id, T] of Object.entries(TESTS)) {
    const ps = positionsOf(S, T.keys, real);
    tests[id] = { name: T.name, markets: T.keys.length };
    for (const [w, win] of Object.entries(W)) tests[id][w] = { ...summarize(ps, win), gross: summarize(ps, win, 'g'), noFin: summarize(ps, win, 'noFin'), x2: summarize(ps, win, 'n', 2) };
  }
  // placebo: one random sign per market and slot, KEYS order then time order, seeds 1..40
  const plc = Object.fromEntries(Object.keys(TESTS).map((id) => [id, { decisive: { t: [], mean: [] }, replication: { t: [], mean: [] } }]));
  for (let seed = 1; seed <= P.SEEDS; seed++) {
    const rnd = mulberry32(seed), side = new Map();
    for (const k of KEYS) for (const o of S[k] || []) side.set(o, rnd() < 0.5 ? 1 : -1);
    for (const [id, T] of Object.entries(TESTS)) {
      const ps = positionsOf(S, T.keys, (o) => side.get(o));
      for (const [w, win] of Object.entries(W)) { const s = stat(monthly(ps, win)); plc[id][w].t.push(s.t); plc[id][w].mean.push(s.mean); }
    }
  }
  for (const id of Object.keys(TESTS)) for (const w of Object.keys(W)) {
    const p = plc[id][w];
    tests[id][w].placebo = { p5: r2(pct(p.t, 0.05)), p50: r2(pct(p.t, 0.5)), p95: r2(pct(p.t, 0.95)), max: r2(Math.max(...p.t)), meanP50: r4(pct(p.mean, 0.5)), meanP95: r4(pct(p.mean, 0.95)), above: p.t.filter((x) => x >= tests[id][w].t).length };
  }
  const ids = Object.keys(TESTS), adj = holm(ids.map((id) => normP(tests[id].decisive.t)));
  ids.forEach((id, i) => {
    const T = tests[id], D = T.decisive, Rp = T.replication;
    T.p = r4(normP(D.t)); T.holm = r4(adj[i]);
    T.cond = { c1: D.perMonth > 0 && D.t >= P.T_BAR, c2: Rp.perMonth > 0, c3: adj[i] < P.ALPHA, c4: D.t > D.placebo.p95, c5: D.x2.perMonth > 0 };
    T.pass = Object.values(T.cond).every(Boolean);
  });
  const verdict = tests.T1.pass ? 'PASS' : (!(tests.T1.cond.c1 && tests.T1.cond.c2) && !['T2', 'T3', 'T4', 'T5'].some((id) => tests[id].cond.c1 && tests[id].cond.c2)) ? 'FAIL' : 'INCONCLUSIVE';
  // descriptive: per market and by year (pooled, net)
  const perMarket = {};
  for (const k of KEYS) { const ps = positionsOf(S, [k], real); perMarket[k] = { class: classOf(k), decisive: pick(summarize(ps, P.DECISIVE)), replication: pick(summarize(ps, P.REPLICATION)) }; }
  const all = positionsOf(S, KEYS, real), byYear = {};
  for (const p of all) { const y = p.month.slice(0, 4); if (p.month < P.REPLICATION[0] || p.month > P.DECISIVE[1]) continue; byYear[y] = byYear[y] || { positions: 0, net: 0, gross: 0 }; byYear[y].positions++; byYear[y].net += p.n; byYear[y].gross += p.g; }
  for (const y of Object.keys(byYear)) { byYear[y].net = r2(byYear[y].net); byYear[y].gross = r2(byYear[y].gross); }
  return { tests, verdict, perMarket, byYear };
}
function pick(s) { return { positions: s.positions, total: s.total, perMonth: s.perMonth, t: s.t, grossPerPos: s.grossPerPos, costPerPos: s.costPerPos, finPerPos: s.finPerPos, stops: s.stops }; }

// ── data ──
export function loadData(dir) {
  const data = {}, dropped = [], first = {};
  for (const k of KEYS) {
    const f = path.join(dir, `${k}.json`);
    if (!fs.existsSync(f)) { dropped.push({ k, why: 'no file' }); continue; }
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    first[k] = new Date(j.rows[0][0] * 1000).toISOString().slice(0, 10);
    if (first[k] > P.LATEST_START) { dropped.push({ k, why: `starts ${first[k]}` }); continue; }
    data[k] = { B: fold(j.rows), updated: j.updated, last: new Date(j.rows.at(-1)[0] * 1000).toISOString().slice(0, 10) };
  }
  return { data, dropped, first };
}

const sg = (v, d = 2) => (v == null ? 'n/a' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d));
export function render(J) {
  const L = [], T = J.tests, D = (id) => T[id].decisive, Rp = (id) => T[id].replication;
  L.push('# Time-series momentum across asset classes: result', '');
  L.push(`**Verdict: ${J.verdict}.** ${J.headline}`, '');
  L.push('Paper research only. No live rule, size, filter, council member or page was changed. Rule, costs, windows, tests and', `verdict were fixed in \`PREREGISTRATION.md\` (commit ${J.prereg}) before any position was simulated.`, '');
  L.push('## What was tested', '');
  L.push(`Each month, at the last daily close of the month, every one of ${J.markets.used.length} OANDA markets (council-data daily cache, weekend stubs folded into Monday) gets the sign of its 12-1 month return (\`close[t-21] / close[t-252] - 1\`); the position opens at the next daily open, 1R = 2 x ATR(63) of past candles, the stop at 1R on the losing side (a stopped market is flat to the next rebalance), closed at the next month-end close. Equal risk: one R per market. Net of a full round trip every month and financing every night (longs 2.5 % + the US 2-year yield, shorts 2.5 % − it floored at 0; currencies the rate differential less a 1 % markup). Portfolio = the sum of the month's R; statistics on monthly sums. Decisive window ${P.DECISIVE.join(' to ')}, replication ${P.REPLICATION.join(' to ')}. Data to ${J.dataTo}.`, '');
  L.push(`Markets dropped: ${J.markets.dropped.length ? J.markets.dropped.map((d) => `${d.k} (${d.why})`).join(', ') : 'none (every file starts before 2008)'}.`, '');
  L.push('## The five tests', '');
  L.push('| Test | Window | Months | Positions | Net R a month | Month-sum t | Sharpe | Total R | Worst drawdown R | Placebo t p5 / p50 / p95 / max |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const id of Object.keys(T)) for (const [w, lab] of [['decisive', '2016-26'], ['replication', '2008-15']]) {
    const s = T[id][w], p = s.placebo;
    L.push(`| ${id} ${T[id].name} | ${lab} | ${s.months} | ${s.positions} | ${sg(s.perMonth, 3)} | ${sg(s.t)} | ${sg(s.sharpe)} | ${sg(s.total, 1)} | ${sg(s.dd, 1)} | ${sg(p.p5)} / ${sg(p.p50)} / ${sg(p.p95)} / ${sg(p.max)} |`);
  }
  L.push('', '| Test | One-sided p (decisive) | Holm p | 1: decisive t ≥ 2 | 2: replication > 0 | 3: Holm < 0.05 | 4: above placebo p95 | 5: > 0 at x2 costs | Pass |', '|---|---|---|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const id of Object.keys(T)) { const c = T[id].cond; L.push(`| ${id} | ${T[id].p} | ${T[id].holm} | ${yn(c.c1)} | ${yn(c.c2)} | ${yn(c.c3)} | ${yn(c.c4)} | ${yn(c.c5)} | ${yn(T[id].pass)} |`); }
  L.push('', '## Before costs, without financing, at twice the costs (descriptive, never deciding)', '');
  L.push('| Test | Window | Gross R a month (t) | No financing (t) | Net (t) | Net at x2 costs (t) | Gross / cost / financing a position (R) | Long / short | Stops hit |', '|---|---|---|---|---|---|---|---|---|');
  for (const id of Object.keys(T)) for (const [w, lab] of [['decisive', '2016-26'], ['replication', '2008-15']]) {
    const s = T[id][w];
    L.push(`| ${id} | ${lab} | ${sg(s.gross.perMonth, 3)} (${sg(s.gross.t)}) | ${sg(s.noFin.perMonth, 3)} (${sg(s.noFin.t)}) | ${sg(s.perMonth, 3)} (${sg(s.t)}) | ${sg(s.x2.perMonth, 3)} (${sg(s.x2.t)}) | ${sg(s.grossPerPos, 3)} / ${s.costPerPos.toFixed(3)} / ${s.finPerPos.toFixed(3)} | ${s.long} / ${s.short} | ${s.stops} |`);
  }
  L.push('', '## Per market (net, descriptive)', '', '| Market | Class | 2016-26 positions | total R | t | 2008-15 positions | total R | t |', '|---|---|---|---|---|---|---|---|');
  for (const [k, m] of Object.entries(J.perMarket)) L.push(`| ${k} | ${m.class} | ${m.decisive.positions} | ${sg(m.decisive.total, 1)} | ${sg(m.decisive.t)} | ${m.replication.positions} | ${sg(m.replication.total, 1)} | ${sg(m.replication.t)} |`);
  L.push('', '## By year (all 25 markets, R)', '', '| Year | Positions | Gross | Net |', '|---|---|---|---|');
  for (const [y, v] of Object.entries(J.byYear)) L.push(`| ${y} | ${v.positions} | ${sg(v.gross, 1)} | ${sg(v.net, 1)} |`);
  L.push('', '## Reading', '', ...J.reading.map((x) => `- ${x}`), '');
  L.push('## Limits, said', '', '- One full round trip is charged every month even when the sign does not change (conservative); stop exits pay that night\'s financing (conservative).', '- The financing rule is the brief\'s single rule (2.5 % + the US 2-year yield) for every non-currency market whatever its currency, gold included (not the demo broker\'s measured gold swap). CAD, CHF and NZD policy rates are approximate yearly means written from memory; bond CFD costs are an assumption. The AUD policy rate (for AUD/USD) was left out of the pre-registration\'s list by oversight; it is taken from the same \`index-spread-momentum\` table as EUR, GBP and JPY (\`rates.json\` says so).', '- Monthly closed R: drawdown inside a month is not shown. The placebo keeps each slot\'s entry, size and stop and only randomises the side.', '- 2008-15 overlaps the samples of the published papers; 2016 on is mostly after them. Nothing was fitted on either window.', '');
  L.push('To repeat: `node research/edge/tsmom/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `node research/edge/tsmom/run.mjs full <dir>`.', '');
  return L.join('\n');
}
export function reading(R) {
  const T = R.tests, out = [];
  const t1 = T.T1.decisive, t1r = T.T1.replication;
  out.push(`T1 (all markets): ${sg(t1.perMonth, 3)}R a month net in 2016-26 (t ${sg(t1.t)}, ${t1.positions} positions, worst drawdown ${sg(t1.dd, 1)}R) and ${sg(t1r.perMonth, 3)}R in 2008-15 (t ${sg(t1r.t)}); before any cost ${sg(t1.gross.perMonth, 3)}R (t ${sg(t1.gross.t)}) and ${sg(t1r.gross.perMonth, 3)}R (t ${sg(t1r.gross.t)}).`);
  out.push(`The 2 x ATR(63) stop was hit on ${t1.stops} of ${t1.positions} positions in 2016-26 and ${t1r.stops} of ${t1r.positions} in 2008-15: over a month a 2-ATR stop is close to the typical move, so about half the positions are stopped before the month ends (the published rule has no stop; this one is the brief's).`);
  out.push(`Costs a position, 2016-26: trading ${t1.costPerPos.toFixed(3)}R, financing ${t1.finPerPos.toFixed(3)}R, against a gross ${sg(t1.grossPerPos, 3)}R.`);
  out.push(`Placebo (40 random-sign books, same entries, stops and costs): T1 decisive t median ${sg(t1.placebo.p50)}, 95th percentile ${sg(t1.placebo.p95)}; ${t1.placebo.above} of 40 placebos reached the real t.`);
  for (const id of ['T2', 'T3', 'T4', 'T5']) { const d = T[id].decisive, r = T[id].replication; out.push(`${id} ${T[id].name}: ${sg(d.perMonth, 3)}R a month 2016-26 (t ${sg(d.t)}), ${sg(r.perMonth, 3)}R 2008-15 (t ${sg(r.t)}).`); }
  out.push(R.verdict === 'PASS' ? 'The rule meets every pre-registered condition. Even so it is not a live rule: the next step would be a forward paper record, and only the owner decides.' : 'Not an edge on these markets with these costs. Never call it one; nothing live changes, and a variant needs its own pre-registration on other data.');
  return out;
}

function main() {
  const [, , cmd, dir] = process.argv;
  if (!cmd || !dir) { console.error('usage: run.mjs fetch|full <dir>'); process.exit(2); }
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of KEYS) fs.writeFileSync(path.join(dir, `${k}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 2e8 }));
    console.log(`fetched ${KEYS.length} files to ${dir}`); return;
  }
  const rates = JSON.parse(fs.readFileSync(path.join(HERE, 'rates.json'), 'utf8'));
  const { data, dropped, first } = loadData(dir), S = {};
  for (const [k, d] of Object.entries(data)) S[k] = slots(k, d.B, rates);
  const res = study(S);
  const prereg = execFileSync('git', ['log', '--format=%h', '-1', '--', path.join(HERE, 'PREREGISTRATION.md')]).toString().trim();
  const J = {
    study: 'tsmom', title: 'Time-series momentum across asset classes', built: new Date().toISOString().slice(0, 10), prereg, verdict: res.verdict,
    system: 'Time-series momentum (12-1 month sign, 1R = 2 x ATR(63) stop, equal risk, monthly) on 25 OANDA markets: indices, bonds, commodities, forex; net of trading costs and financing',
    window: { decisive: P.DECISIVE, replication: P.REPLICATION }, params: P, costs: { ...COST, xauRoundTrip: GOLD_COST },
    markets: { used: Object.keys(data), dropped, first }, dataTo: Object.values(data).map((d) => d.last).sort()[0],
    tests: res.tests, perMarket: res.perMarket, byYear: res.byYear,
  };
  const T1 = res.tests.T1.decisive;
  J.headline = `All 25 markets pooled: ${sg(T1.perMonth, 3)}R a month net in 2016-26 (t ${sg(T1.t)}, Sharpe ${sg(T1.sharpe)}, worst drawdown ${sg(T1.dd, 1)}R, ${T1.positions} positions) and ${sg(res.tests.T1.replication.perMonth, 3)}R in 2008-15 (t ${sg(res.tests.T1.replication.t)}); ${Object.values(res.tests).filter((t) => t.pass).length} of 5 tests pass.`;
  J.reading = reading(J);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(J, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), render(J));
  console.log(J.verdict, J.headline);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
