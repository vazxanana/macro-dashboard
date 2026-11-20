// Edge research · gold-vol-breakout-costs: cost accounting of gold-vol-breakout's T1 (UTC open ± 0.5 × the previous folded
// day's range, stop back at the open, out at 21:00 UTC), unchanged, as fixed in PREREGISTRATION.md. No rule is tested: the
// same trades are charged under four cost routes and four levels of stop-entry slippage, with the break-even cost per window.
// Every trading function comes from original.mjs, a verbatim copy of gold-vol-breakout's run.mjs (sha256 below).
//   node research/edge/gold-vol-breakout-costs/run.mjs <dir>   (<dir>/xau-5m.json.gz, OANDA mid M5 [t,o,h,l,c], out of git)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from './original.mjs';

export const T1 = O.TESTS.T1;
export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
export const WINDOWS = { W1: ['2007-01-01', '2011-12-31'], W2: ['2012-01-01', '2015-12-31'], W3: ['2016-01-01', '2020-12-31'], W4: ['2021-01-01', '2026-12-31'], POOLED: ['2007-01-01', '2026-12-31'] };
export const WLABEL = { W1: '2007-11', W2: '2012-15', W3: '2016-20', W4: '2021-26', POOLED: '2007-26' };
// the replicate study's published figures at $0.60 (its result.json, branch gold-vol-breakout-replicate)
export const GATE = {
  main: { w: ['2007-01-01', '2015-12-31'], want: { n: 1657, netR: 0.111, grossR: 0.203, t: 3.19, grossT: 5.96, net2R: 0.018, total: 183.68 } },
  H1: { w: ['2007-01-01', '2011-12-31'], want: { n: 929, netR: 0.12, grossR: 0.217, t: 2.83, grossT: 5.33, net2R: 0.023, total: 111.22 } },
  H2: { w: ['2012-01-01', '2015-12-31'], want: { n: 728, netR: 0.1, grossR: 0.186, t: 1.7, grossT: 3.2, net2R: 0.013, total: 72.46 } },
  pooled: { w: ['2007-01-01', '2026-12-31'], want: { n: 3713, netR: 0.073, grossR: 0.155, t: 3.35, grossT: 7.24, net2R: -0.009, total: 272.23 } },
};
// measured demo cost: council-data ctrader/symbols.json, XAUUSD, read 14 Nov 2026
export const DEMO = { commit: '4400129e1c405ed82e87715f9dd265751b76be7a', spread: 0.07, quotes: 110, from: '2026-11-12T23:08:51Z', to: '2026-11-13T21:58:59Z', price: 3884.75, commissionRT: 0.000024 };
export const DEMO_FRAC = DEMO.spread / DEMO.price + DEMO.commissionRT;
// pessimistic spread by era (assumptions, not measurements); round trip = spread + half a spread of slippage on entry and exit
export const ERA = [['2012-01-01', 0.50], ['2020-01-01', 0.35], ['9999-12-31', 0.30]];
export const eraSpread = (day) => ERA.find(([until]) => day < until)[1];
export const ROUTES = {
  D: { name: 'demo measured, proportional to price', cost: (x) => DEMO_FRAC * x.entry },
  D$: { name: 'demo measured, today\'s dollars', cost: (x) => DEMO.spread + DEMO.commissionRT * x.entry },
  S: { name: 'studies\' model, $0.30 spread + half-spread slippage each side', cost: () => 0.60 },
  P: { name: 'pessimistic by era (assumption): $1.00 / $0.70 / $0.60', cost: (x) => 2 * eraSpread(x.day) },
};
export const SLIPS = [0, 0.05, 0.10, 0.20];
export const MED_K = 12;
export const SESSIONS = [['Asia', 0, 7], ['London', 7, 12], ['New York', 12, 21]];
const DAY = 86400;
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
export const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// the replicate's loader: sort, drop the forming last day, build folded days
export function daysOf(rows) {
  rows.sort((a, b) => a[0] - b[0]);
  const lastFull = Math.floor(rows.at(-1)[0] / DAY) * DAY;
  return { days: O.buildDays(rows.filter((r) => r[0] < lastFull)), dataEnd: ymdOf(lastFull - DAY) };
}

// median high − low of the MED_K M5 candles ending with candle i (i included; fewer at the start of the day)
export function medRange(bars, i, k = MED_K) {
  const rs = bars.slice(Math.max(0, i - k + 1), i + 1).map((b) => b.h - b.l);
  return rs.length ? O.quantile(rs, 0.5) : 0;
}

// T1 trades on the days inside w, with no cost (gross R; fin is 0) and the slippage base M of the fill candle
export function tradesIn(days, w) {
  const tr = [], pool = [];
  for (const d of days) {
    if (!inW(d.day, w) || O.daySkip(d)) continue;
    pool.push(d);
    const x = O.vbTrade(d.bars, { ...T1, prevRange: d.prevRange, cost: 0 });
    if (x.skip) continue;
    const i = d.bars.findIndex((b) => b.t === x.fillT);
    tr.push({ day: d.day, entry: x.entry, r: x.r, R: x.R, finR: x.finR, side: x.side, how: x.how, fillMin: x.fillMin, M: medRange(d.bars, i) });
  }
  return { tr, pool };
}

// net R of one trade under a route and a slippage level
export const netOf = (x, route, s) => x.R - x.finR - (ROUTES[route].cost(x) + s * x.M) / x.r;
export function charge(tr, route, s) { return tr.map((x) => ({ day: x.day, R: x.R, net: netOf(x, route, s), r: x.r })); }
export function stats(c) {
  const mt = O.monthT(c), gt = O.monthT(c, 'R');
  return { n: c.length, netR: r3(mean(c.map((x) => x.net))), grossR: r3(mean(c.map((x) => x.R))), total: r2(c.reduce((s, x) => s + x.net, 0)), t: r2(mt.t), grossT: r2(gt.t), tRaw: mt.t };
}

// break-even: constant $ cost (net = R − c / r) or cost proportional to the entry (net = R − f × entry / r)
const withCost = (tr, unit, c) => tr.map((x) => ({ day: x.day, R: x.R, net: x.R - x.finR - c * unit(x) / x.r }));
export function breakEven(tr, unit) {
  const be = mean(tr.map((x) => x.R - x.finR)) / mean(tr.map((x) => unit(x) / x.r));
  const t0 = O.monthT(withCost(tr, unit, 0)).t;
  let t2 = null;
  if (t0 >= 2 && be > 0) {
    let lo = 0, hi = be;
    for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (O.monthT(withCost(tr, unit, m)).t >= 2) lo = m; else hi = m; }
    t2 = lo;
  }
  return { be, t2, grossT: t0 };
}
const DOLLAR = () => 1, PRICE = (x) => x.entry;

// placebo under a route and slippage: the original placebo's trades (seeded identically), charged like T1
export function placeboUnder(pool, route, s, seeds = O.SEEDS) {
  const grid = (O.PLACEBO.to - O.PLACEBO.from) / 300 + 1, res = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = O.rng(seed), tr = [];
    for (const d of pool) {
      const startT = d.d0 + O.PLACEBO.from + 300 * Math.floor(rand() * grid), coin = rand();
      const side = coin < 0.5 ? 1 : -1;
      const x = O.placeboTrade(d.bars, { startT, side, dist: T1.k * d.prevRange, cost: 0 }); if (!x) continue;
      const i = d.bars.findIndex((b) => b.t >= startT);
      tr.push(netOf({ ...x, day: d.day, M: medRange(d.bars, i) }, route, s));
    }
    res.push(mean(tr));
  }
  return res;
}

export const sessionOf = (fillMin) => SESSIONS.find(([, a, b]) => fillMin >= a * 60 && fillMin < b * 60)[0];

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
const usd = (v) => (v == null ? 'none' : '$' + v.toFixed(2));
const bp = (v) => (v == null ? 'none' : (v * 1e4).toFixed(2) + ' bp');
export const COND = { C1: ['D', 0], C2: ['P', 0.10] };
const holds = (x) => x.netR > 0 && x.t >= 2;
export function verdictLine(R) {
  const a = R.grid.D['0'].POOLED, b = R.grid.P['0.1'].POOLED;
  return `ACCOUNTING (no rule tested): T1 pooled 2007-26 ${holds(a) ? 'stays' : 'is not'} positive with month t ≥ 2 at measured demo costs (${sg(a.netR)}R, t ${s2(a.t)}) and ${holds(b) ? 'stays so' : 'does not'} at pessimistic costs + 0.10 slippage (${sg(b.netR)}R, t ${s2(b.t)})`;
}
export function report(R) {
  const L = [], ws = Object.keys(WINDOWS);
  L.push('# Gold volatility breakout (T1): what it earns at realistic costs', '');
  L.push('Paper research, cost accounting only: no rule is tested and no pass / fail is given on a rule. T1 of `gold-vol-breakout` is imported unchanged from `original.mjs`, a verbatim copy of that study\'s `run.mjs` (sha256 in `result.json`). A stand-alone intraday rule, not a gate, exit, entry or size of the live gold book (owner decision 44: none of its records read). Nothing live changed, no proposal: a forward paper record is the owner\'s decision. The plan was pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## Harness gate (the replicate\'s figures at $0.60, exact)', '');
  L.push('| Window | n | Net R | Gross R | Month t | Gross t | Net 2x | Total R | Exact |', '|---|---|---|---|---|---|---|---|---|');
  for (const [k, g] of Object.entries(R.gate.rows)) L.push(`| ${k} ${g.w.join(' → ')} | ${g.got.n} | ${sg(g.got.netR)} | ${sg(g.got.grossR)} | ${s2(g.got.t)} | ${s2(g.got.grossT)} | ${sg(g.got.net2R)} | ${s2(g.got.total)} | ${g.ok ? 'yes' : 'NO'} |`);
  L.push('', `Route S with no slippage equals \`vbTrade\`'s own $0.60 net on every pooled trade: ${R.gate.sameNet ? 'yes' : 'NO'} (largest difference ${R.gate.maxDiff}).`, '');
  L.push('## 1. Break-even cost (no extra slippage)', '');
  L.push('Round-trip cost a trade per ounce at which the mean net R is 0, and at which the month t of net R falls to 2 ("none": the gross t is already under 2). The same as a cost proportional to price, in basis points.', '');
  L.push('| Window | n | Gross R | Gross t | Median stop $ | Break-even $ | t-2 $ | Break-even bp of price | t-2 bp |', '|---|---|---|---|---|---|---|---|---|');
  for (const w of ws) { const b = R.breakEven[w]; L.push(`| ${WLABEL[w]} | ${b.n} | ${sg(b.grossR)} | ${s2(b.grossT)} | ${b.medianStop} | ${usd(b.usd.be)} | ${usd(b.usd.t2)} | ${bp(b.frac.be)} | ${bp(b.frac.t2)} |`); }
  L.push('', 'For scale: route D charges ' + bp(R.demo.frac) + ' of price (about $' + (R.demo.frac * 4000).toFixed(2) + ' at $4,000 gold, $' + (R.demo.frac * 700).toFixed(2) + ' at $700); route S $0.60; route P $1.00 / $0.70 / $0.60 by era.', '');
  L.push('## 2-3. Net R a trade by route and stop-entry slippage (month t)', '');
  L.push('Slippage s × M on the entry, M = median high − low of the 12 M5 candles ending with the fill candle (median M ' + R.medianM + ' $ pooled).', '');
  L.push('| Route | Slippage | ' + ws.map((w) => WLABEL[w]).join(' | ') + ' |', '|---|---|' + ws.map(() => '---|').join(''));
  for (const [rk, rt] of Object.entries(ROUTES)) for (const s of SLIPS) {
    const g = R.grid[rk][String(s)];
    L.push(`| ${rk}: ${rt.name} | ${s.toFixed(2)} × M | ` + ws.map((w) => `${sg(g[w].netR)} (t ${s2(g[w].t)})`).join(' | ') + ' |');
  }
  L.push('', '## The two pre-registered conditions', '');
  L.push('| Condition | Window | n | Net R | Total R | Month t | p | Holm p (10) | Placebos beaten (of 40) | Positive with t ≥ 2 |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const [ck, [rk, s]] of Object.entries(COND)) for (const w of ws) {
    const g = R.grid[rk][String(s)][w], c = R.conditions[ck][w];
    L.push(`| ${ck === 'C1' ? 'D, measured demo' : 'P + 0.10 × M'} | ${WLABEL[w]} | ${g.n} | ${sg(g.netR)} | ${s2(g.total)} | ${s2(g.t)} | ${c.p} | ${c.pHolm} | ${c.placeboBeaten} | ${holds(g) ? 'yes' : 'no'} |`);
  }
  L.push('', '## 4. Time of fill (descriptive)', '');
  L.push('| Window | Session (UTC) | n | Share | Gross R | Net R, D | Net R, P + 0.10 | Mean stop $ | Median M $ |', '|---|---|---|---|---|---|---|---|---|');
  for (const w of ['POOLED', 'W1', 'W4']) for (const [name] of SESSIONS) { const x = R.sessions[w][name]; L.push(`| ${WLABEL[w]} | ${name} | ${x.n} | ${(x.share * 100).toFixed(1)} % | ${sg(x.grossR)} | ${sg(x.netD)} | ${sg(x.netP)} | ${x.meanStop} | ${x.medM} |`); }
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '', `- ${R.data}`, `- Rule: ${R.rule}`);
  L.push(`- Demo cost: council-data \`ctrader/symbols.json\` at ${R.demo.commit.slice(0, 8)}, XAUUSD median quoted spread $${R.demo.spread} over ${R.demo.quotes} quotes ${R.demo.from} → ${R.demo.to} at $${R.demo.price}, plus commission ${R.demo.commissionRT} of price a round trip: ${bp(R.demo.frac)} of price. One day of quotes on one demo account; no slippage measured for gold.`);
  L.push('- Route S: `council/fills.mjs` `spreadOf` spot $0.30 + `SLIP_SPREADS` 0.5 spread on each market order (stop entry, stop / time exit) = $0.60. Route P: spread $0.50 before 2012, $0.35 2012-19, $0.30 from 2020 (assumptions, not measured; no historical gold spread is in this repository) with the same slippage = $1.00 / $0.70 / $0.60.');
  L.push('- Financing: `FIN.xau.long` × `nights` on buys; every trade exits before the 22:00 UTC rollover, so 0.');
  L.push('- To repeat: `node research/edge/gold-vol-breakout-costs/run.mjs <dir>` with `<dir>/xau-5m.json.gz` (OANDA mid M5 XAU/USD from 2006-11, from the candle proxy, out of git).');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const osha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'original.mjs'))).digest('hex');
  if (osha !== ORIG_SHA) throw new Error('original.mjs is not the verbatim copy');
  const { days, dataEnd } = daysOf(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-5m.json.gz')))));
  // harness gate with vbTrade's own cost
  const rows = {}; let gateOk = true;
  for (const [k, g] of Object.entries(GATE)) {
    const tr = days.filter((d) => inW(d.day, g.w) && !O.daySkip(d)).map((d) => ({ day: d.day, ...O.vbTrade(d.bars, { ...T1, prevRange: d.prevRange }) })).filter((x) => !x.skip);
    const s = O.summary(tr), got = Object.fromEntries(Object.keys(g.want).map((q) => [q, s[q]]));
    const ok = Object.keys(g.want).every((q) => got[q] === g.want[q]); gateOk &&= ok;
    rows[k] = { w: [g.w[0], k === 'pooled' ? dataEnd : g.w[1]], got, want: g.want, ok, orig: k === 'pooled' ? tr : null };
  }
  const pooled = tradesIn(days, WINDOWS.POOLED).tr, orig = rows.pooled.orig;
  let maxDiff = 0; pooled.forEach((x, i) => { maxDiff = Math.max(maxDiff, Math.abs(netOf(x, 'S', 0) - orig[i].net)); });
  const sameNet = pooled.length === orig.length && maxDiff < 1e-9; delete rows.pooled.orig;
  console.log('gate', gateOk, 'sameNet', sameNet, maxDiff);
  if (!gateOk || !sameNet) { console.log('harness gate failed: stop'); process.exit(2); }
  for (const k in rows) delete rows[k].orig;

  const T = {}, P = {};
  for (const [w, win] of Object.entries(WINDOWS)) { const x = tradesIn(days, win); T[w] = x.tr; P[w] = x.pool; }
  const breakEvenOut = {};
  for (const w of Object.keys(WINDOWS)) {
    const tr = T[w], u = breakEven(tr, DOLLAR), f = breakEven(tr, PRICE), rs = tr.map((x) => x.r).sort((a, b) => a - b);
    breakEvenOut[w] = { n: tr.length, grossR: r3(mean(tr.map((x) => x.R))), grossT: r2(u.grossT), medianStop: r2(rs[Math.floor(rs.length / 2)]),
      usd: { be: r3(u.be), t2: u.t2 == null ? null : r3(u.t2) }, frac: { be: f.be, t2: f.t2 } };
  }
  const grid = {};
  for (const rk of Object.keys(ROUTES)) { grid[rk] = {}; for (const s of SLIPS) { grid[rk][String(s)] = {}; for (const w of Object.keys(WINDOWS)) { const st = stats(charge(T[w], rk, s)); delete st.tRaw; grid[rk][String(s)][w] = st; } } }
  // conditions: p, Holm over 10, placebo
  const keys = [], ps = [];
  for (const [ck, [rk, s]] of Object.entries(COND)) for (const w of Object.keys(WINDOWS)) { keys.push([ck, w]); ps.push(O.normP(stats(charge(T[w], rk, s)).tRaw)); }
  const adj = O.holm(ps), conditions = { C1: {}, C2: {} };
  keys.forEach(([ck, w], i) => {
    const [rk, s] = COND[ck], pl = placeboUnder(P[w], rk, s), real = mean(charge(T[w], rk, s).map((x) => x.net));
    conditions[ck][w] = { route: rk, slip: s, p: r3(ps[i]), pHolm: r3(adj[i]), placeboBeaten: pl.filter((v) => real > v).length, placeboMedian: r3(O.quantile(pl, 0.5)), placeboP95: r3(O.quantile(pl, 0.95)) };
  });
  const sessions = {};
  for (const w of Object.keys(WINDOWS)) {
    sessions[w] = {};
    for (const [name] of SESSIONS) {
      const a = T[w].filter((x) => sessionOf(x.fillMin) === name);
      sessions[w][name] = { n: a.length, share: r3(a.length / T[w].length), grossR: r3(mean(a.map((x) => x.R))), netD: r3(mean(a.map((x) => netOf(x, 'D', 0)))),
        netP: r3(mean(a.map((x) => netOf(x, 'P', 0.1)))), meanStop: r2(mean(a.map((x) => x.r))), medM: r2(a.length ? O.quantile(a.map((x) => x.M), 0.5) : NaN) };
    }
  }
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const R = { study: 'gold-vol-breakout-costs', built: '2026-11-14', preregistration: 'research/edge/gold-vol-breakout-costs/PREREGISTRATION.md', planSha256: sha,
    original: { study: 'gold-vol-breakout', runSha256: ORIG_SHA, how: 'run.mjs copied verbatim as original.mjs (as gold-vol-breakout-replicate did); its functions imported, none changed' },
    claim: 'cost accounting: what T1 earns under measured and assumed round-trip costs and stop-entry slippage, and its break-even cost; no rule tested',
    rule: 'O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins (a gap fills at the open; both in one candle: the level nearer its open); stop back at O (worst case in the fill candle); out at the 20:55 candle close',
    data: `OANDA mid XAU/USD M5 through the keyless candle proxy; ${days.length} weekdays built ${days[0].day} → ${days.at(-1).day}; D1 = complete UTC days folded with council/fills.mjs foldWeekend`,
    dataEnd, windows: Object.fromEntries(Object.entries(WINDOWS).map(([k, w]) => [k, [w[0], w[1] > dataEnd ? dataEnd : w[1]]])),
    demo: { ...DEMO, frac: DEMO_FRAC }, era: ERA, routes: Object.fromEntries(Object.entries(ROUTES).map(([k, r]) => [k, r.name])), slips: SLIPS, medK: MED_K,
    medianM: r2(O.quantile(T.POOLED.map((x) => x.M), 0.5)),
    gate: { rows, sameNet, maxDiff: Number(maxDiff.toExponential(2)) }, breakEven: breakEvenOut, grid, conditions, sessions };
  R.verdict = verdictLine(R);
  const g = (rk, s, w) => R.grid[rk][String(s)][w], b = R.breakEven;
  R.reading = `No rule was tested; the same ${g('S', 0, 'POOLED').n} pooled trades were charged under each cost assumption. `
    + `Before costs T1 makes ${sg(b.POOLED.grossR)}R a trade pooled 2007-26 (gross month t ${s2(b.POOLED.grossT)}); it breaks even at ${usd(b.POOLED.usd.be)} a round trip and keeps month t 2 up to ${usd(b.POOLED.usd.t2)} (${bp(b.POOLED.frac.be)} / ${bp(b.POOLED.frac.t2)} of price). `
    + `By window, t-2 cost: ${Object.keys(WINDOWS).filter((w) => w !== 'POOLED').map((w) => `${WLABEL[w]} ${usd(b[w].usd.t2)}`).join(', ')}. `
    + `At the measured demo cost (${bp(DEMO_FRAC)} of price, no slippage) pooled ${sg(g('D', 0, 'POOLED').netR)}R (t ${s2(g('D', 0, 'POOLED').t)}); with 0.10 × M slippage ${sg(g('D', 0.1, 'POOLED').netR)}R (t ${s2(g('D', 0.1, 'POOLED').t)}). `
    + `At the studies' $0.60 ${sg(g('S', 0, 'POOLED').netR)}R (t ${s2(g('S', 0, 'POOLED').t)}). Pessimistic by era with 0.10 × M ${sg(g('P', 0.1, 'POOLED').netR)}R (t ${s2(g('P', 0.1, 'POOLED').t)}); 2007-11 ${sg(g('P', 0.1, 'W1').netR)}R, 2016-20 ${sg(g('P', 0.1, 'W3').netR)}R. `
    + `Cautions, said plainly: the demo figure is one day of quotes on one demo account in November 2026 and carries no gold slippage measurement; it is applied to 2007-26 as a share of price, which assumes today's relative spread held then. At 2007 prices that share is about $0.03 a round trip, far under any retail gold spread of the time; the same figure in today's dollars (route D$) gives ${sg(g('D$', 0, 'POOLED').netR)}R (t ${s2(g('D$', 0, 'POOLED').t)}). The era spreads are assumptions, not measurements. The thinnest window is 2016-20 (gross t ${s2(b.W3.grossT)}, month t 2 only up to ${usd(b.W3.usd.t2)} a round trip): it is flat or negative at $0.60 and under P. `
    + `Fills in Asia hours (${R.sessions.POOLED.Asia.n} of ${T.POOLED.length}) carry most of the gross (${sg(R.sessions.POOLED.Asia.grossR)}R a trade against ${sg(R.sessions.POOLED['New York'].grossR)}R for New York fills), and Asia is where spreads are widest, which no route here charges separately. `
    + `Whether T1 is worth anything therefore turns on the cost actually paid: an all-in round trip (slippage included) under $0.81 keeps the pooled month t over 2, under $0.48-0.54 keeps it in 2012-15 and 2021-26, and 2016-20 needs under $0.19. Nothing live changes; a forward paper record is the owner's decision.`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
  console.log(R.verdict); console.log(R.reading);
}
