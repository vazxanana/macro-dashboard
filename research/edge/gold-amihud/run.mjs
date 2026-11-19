// Edge research · gold-amihud: gold's own illiquidity (Amihud ratio |return| / volume over 20 weekdays, ranked against the
// 250 readings before it) and the next week's return, measured against the same side in every eligible week of the same
// calendar month, as fixed in PREREGISTRATION.md. A stand-alone weekly rule, never a gate, exit, entry or size of the live gold
// book. Pure pieces are exported for tests/gold-amihud.test.mjs. The only import from the repository is the financing rule of
// council/fills.mjs (read only).
//   node research/edge/gold-amihud/run.mjs <xau.json>   (council-data research/daily/xau.json; writes result.json, RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FIN, nights } from '../../../council/fills.mjs';

export const COST = 0.60;                       // $ a round trip per ounce, spread + slippage together
export const ILLIQ_N = 20, RANK_N = 250, ATR_N = 20, STOP_K = 2, MIN_DAYS = 3, HI = 2 / 3, LO = 1 / 3;
export const TESTS = {
  T1: { name: 'Illiquid gold, buy (rank >= 2/3)', side: 1, ok: (s) => s.rank >= HI },
  T2: { name: 'Liquid gold, sell (rank <= 1/3)', side: -1, ok: (s) => s.rank <= LO },
  T3: { name: 'Illiquid and falling, buy', side: 1, ok: (s) => s.rank >= HI && s.wkRet < 0 },
};
export const WINDOWS = { IS: ['2007-01-01', '2016-12-31'], OOS: ['2017-01-01', '2026-10-31'] };
export const HALVES = { H1: ['2017-01-01', '2021-12-31'], H2: ['2022-01-01', '2026-10-31'] };
export const SEEDS = 40;
export const inW = (day, [a, b]) => day >= a && day <= b;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
// ISO week key = the UTC date of that week's Monday
export const weekKey = (t) => { const d = new Date(t * 1000), w = (d.getUTCDay() + 6) % 7; return ymd(t - w * 86400 - (t % 86400)); };

// ─── weekdays with ratio, ILLIQ, rank and ATR, each read only from that day and the days before it ───
export function makeDays(rows) {
  const ds = rows.filter((r) => { const w = new Date(r[0] * 1000).getUTCDay(); return w >= 1 && w <= 5; })
    .map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5], day: ymd(r[0]), wk: weekKey(r[0]) }));
  for (let i = 0; i < ds.length; i++) {
    const d = ds[i], p = ds[i - 1];
    d.a = p && d.v > 0 && p.c > 0 && d.c > 0 ? Math.abs(Math.log(d.c / p.c)) / d.v : null;
    d.tr = p ? Math.max(d.h - d.l, Math.abs(d.h - p.c), Math.abs(d.l - p.c)) : null;
    d.illiq = null; d.atr = null; d.rank = null;
    if (i >= ILLIQ_N - 1) { const w = ds.slice(i - ILLIQ_N + 1, i + 1); if (w.every((x) => x.a != null)) d.illiq = w.reduce((s, x) => s + x.a, 0) / ILLIQ_N; }
    if (i >= ATR_N) { const w = ds.slice(i - ATR_N + 1, i + 1); if (w.every((x) => x.tr != null)) d.atr = w.reduce((s, x) => s + x.tr, 0) / ATR_N; }
    if (d.illiq != null && i >= RANK_N) {
      const w = ds.slice(i - RANK_N, i);
      if (w.every((x) => x.illiq != null)) d.rank = w.filter((x) => x.illiq < d.illiq).length / RANK_N;
    }
  }
  return ds;
}
// weeks: the signal at the last weekday of week k, the trade over week k+1
export function makeWeeks(ds) {
  const by = new Map(); ds.forEach((d, i) => { if (!by.has(d.wk)) by.set(d.wk, []); by.get(d.wk).push(i); });
  const keys = [...by.keys()].sort(), out = [];
  for (let k = 1; k < keys.length; k++) {
    const sig = by.get(keys[k - 1]), nxt = by.get(keys[k]), s = ds[sig.at(-1)], before = ds[sig[0] - 1];
    out.push({ wk: keys[k], day: ds[nxt[0]].day, days: nxt.map((i) => ds[i]), sig: { day: s.day, rank: s.rank, atr: s.atr, wkRet: before ? s.c / before.c - 1 : null } });
  }
  return out;
}
export const eligible = (w) => w.days.length >= MIN_DAYS && w.sig.rank != null && w.sig.atr > 0 && w.sig.wkRet != null;

// one trade: first weekday's open → last weekday's close, stop STOP_K x ATR; stop first, a gap through fills at the open
export function trade(w, side, cost = COST) {
  const entry = w.days[0].o, r = STOP_K * w.sig.atr, stop = entry - side * r;
  let exit = null, how = 'time', tx = w.days.at(-1).t + 21 * 3600;
  for (const b of w.days) {
    if (side > 0 ? b.l <= stop : b.h >= stop) { exit = side > 0 ? Math.min(b.o, stop) : Math.max(b.o, stop); how = 'stop'; tx = b.t + 21 * 3600; break; }
  }
  if (exit == null) exit = w.days.at(-1).c;
  const R = side * (exit - entry) / r, fin = side > 0 ? nights(w.days[0].t, tx) * FIN.xau.long * entry / r : 0;
  return { day: w.day, side, entry, stop, r, exit, how, R, fin, net: R - cost / r - fin, net2: R - 2 * cost / r - fin };
}

// same-side baseline: mean net R of each side over every eligible week starting in each calendar month
export function baselineByMonth(weeks) {
  const acc = new Map();
  for (const w of weeks) {
    if (!eligible(w)) continue;
    for (const s of [1, -1]) { const x = trade(w, s); const k = w.day.slice(0, 7) + '|' + s; const a = acc.get(k) || [0, 0]; a[0] += x.net; a[1]++; acc.set(k, a); }
  }
  const out = new Map(); for (const [k, [s, n]] of acc) out.set(k, s / n); return out;
}
export function runTest(weeks, test, base) {
  const tr = [];
  for (const w of weeks) {
    if (!eligible(w) || !test.ok(w.sig)) continue;
    const x = trade(w, test.side);
    x.rank = w.sig.rank; x.base = base.get(w.day.slice(0, 7) + '|' + test.side); x.excess = x.net - x.base;
    tr.push(x);
  }
  return tr;
}

// ─── statistics ───
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
export function monthT(trades, key = 'net') {
  const by = new Map(); for (const x of trades) { const k = x.day.slice(0, 7); by.set(k, (by.get(k) || 0) + x[key]); }
  const v = [...by.values()], s = sdv(v);
  return { months: v.length, t: v.length > 1 && s > 0 ? mean(v) / (s / Math.sqrt(v.length)) : 0 };
}
export function normP(t) {
  const z = t / Math.SQRT2, a = Math.abs(z), k = 1 / (1 + 0.3275911 * a);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-a * a);
  return 0.5 * (1 - (z >= 0 ? erf : -erf));
}
export function quantile(v, q) { const s = [...v].sort((a, b) => a - b), i = q * (s.length - 1), lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); }
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; });
  return out;
}
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
export function summary(tr) {
  const net = tr.map((x) => x.net);
  let eq = 0, pk = 0, dd = 0; for (const v of net) { eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const byYear = {}; for (const x of tr) { const y = x.day.slice(0, 4); (byYear[y] ||= { n: 0, net: 0, ex: 0 }); byYear[y].n++; byYear[y].net += x.net; byYear[y].ex += x.excess; }
  for (const y in byYear) byYear[y] = { n: byYear[y].n, netR: r3(byYear[y].net / byYear[y].n), excessR: r3(byYear[y].ex / byYear[y].n) };
  const rs = tr.map((x) => x.r);
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), grossR: r3(mean(tr.map((x) => x.R))), netR: r3(mean(net)),
    net2R: r3(mean(tr.map((x) => x.net2))), costR: r3(mean(tr.map((x) => x.R - x.net))), finR: r3(mean(tr.map((x) => x.fin))),
    baseR: r3(mean(tr.map((x) => x.base))), excessR: r3(mean(tr.map((x) => x.excess))), total: r2(net.reduce((s, v) => s + v, 0)),
    months: monthT(tr).months, t: r2(monthT(tr).t), grossT: r2(monthT(tr, 'R').t), t2x: r2(monthT(tr, 'net2').t), excessT: r2(monthT(tr, 'excess').t),
    stops: tr.filter((x) => x.how === 'stop').length, maxDD: r2(dd), medianStop: rs.length ? r2(quantile(rs, 0.5)) : null, byYear };
}
export function placebo(weeks, trades, seeds = SEEDS) {
  const pool = weeks.filter((w) => inW(w.day, WINDOWS.OOS) && eligible(w)), oos = trades.filter((x) => inW(x.day, WINDOWS.OOS)), out = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = rng(seed), v = [];
    for (const x of oos) { let w; do w = pool[Math.floor(rand() * pool.length)]; while (w.day === x.day); v.push(trade(w, x.side).net); }
    out.push(r3(mean(v)));
  }
  return out;
}
export function decide(res, pl) {
  const ks = Object.keys(TESTS), ps = ks.map((k) => normP(res[k].OOS.excessT)), adj = holm(ps), d = {};
  ks.forEach((k, i) => {
    const o = res[k].OOS, beaten = pl[k].filter((m) => o.netR > m).length;
    const checks = { excessPos: o.excessR > 0, t2: o.excessT >= 2, holm: adj[i] < 0.05, isExcessPos: res[k].IS.excessR > 0, netPos: o.netR > 0, cost2x: o.net2R > 0, placebo: beaten >= 38, n30: o.n >= 30 };
    d[k] = { p: r3(ps[i]), pHolm: r3(adj[i]), beaten, checks, pass: Object.values(checks).every(Boolean) };
  });
  return d;
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(res, dec) {
  const o = res.T1.OOS, pass = dec.T1.pass, n = Object.values(dec).filter((x) => x.pass).length;
  return `${pass ? 'PASS' : 'FAIL'}, ${n} of 3: buying the week after illiquid gold made ${sg(o.netR)}R a trade net 2017-26 (n ${o.n}), ${sg(o.excessR)}R over buying every week (month t ${s2(o.excessT)}); 2007-16 ${sg(res.T1.IS.excessR)}R.`;
}
const PER = { IS: '2007-2016', OOS: '2017 → 2026-10', H1: '2017-2021', H2: '2022 → 2026-10' };
export function report(R) {
  const L = [], T = R.tests, yn = (b) => (b ? 'yes' : 'no');
  L.push('# Gold: its own illiquidity (Amihud ratio) and the next week', '');
  L.push('Paper research only. A new stand-alone weekly rule, **not a gate, exit, entry or size of the live gold book** (owner decision 44: none of the book\'s records read). Nothing live changed, no proposal. The rule, costs, windows, baseline, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## Tests (R of the 2 x ATR(20) stop; t on calendar-month sums)', '');
  L.push('| Test | Period | n | Win | Gross R | Net R | Net at 2x | Same-side baseline R | Excess R | t net | t gross | t excess | t 2x | Stops | Max DD R | Median stop $ |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) for (const w of ['IS', 'OOS', 'H1', 'H2']) {
    const x = T[k][w];
    L.push(`| ${k} ${T[k].name} | ${PER[w]} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.grossR)} | ${sg(x.netR)} | ${sg(x.net2R)} | ${sg(x.baseR)} | ${sg(x.excessR)} | ${s2(x.t)} | ${s2(x.grossT)} | ${s2(x.excessT)} | ${s2(x.t2x)} | ${x.stops} | ${s2(x.maxDD)} | ${x.medianStop} |`);
  }
  L.push('', '## Decision (out of sample, Holm over the three tests on the excess t)', '');
  L.push('| Test | p | Holm p | excess > 0 | excess t ≥ 2 | Holm < 0.05 | 2007-16 excess > 0 | net > 0 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 | pass |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, d] of Object.entries(R.decision)) { const c = d.checks; L.push(`| ${k} | ${d.p} | ${d.pHolm} | ${yn(c.excessPos)} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.isExcessPos)} | ${yn(c.netPos)} | ${yn(c.cost2x)} | ${d.beaten} | ${yn(c.n30)} | **${d.pass ? 'pass' : 'fail'}** |`); }
  L.push('', `**Placebo** (each out-of-sample trade moved to a random other eligible week of 2017-26, same side and mechanics; ${R.placebo.seeds} seeds):`, '');
  for (const k of Object.keys(T)) { const p = R.placebo[k]; L.push(`- ${k}: seed means ${sg(p.min)} to ${sg(p.max)}R a trade, median ${sg(p.median)}, 95th percentile ${sg(p.p95)}R; the test's own ${sg(T[k].OOS.netR)}R beats ${R.decision[k].beaten}.`); }
  L.push('', '## Baseline (the same trade in every eligible week)', '');
  for (const w of ['IS', 'OOS']) for (const s of ['buy', 'sell']) { const b = R.baseline[w][s]; L.push(`- ${PER[w]}, ${s}: n ${b.n}, gross ${sg(b.grossR)}R, net ${sg(b.netR)}R a trade, month t ${s2(b.t)}.`); }
  for (const k of Object.keys(T)) { const o = T[k].OOS; L.push(`- ${k}, 2017 → 2026-10: cost ${sg(o.costR)}R a trade, of which financing ${sg(o.finR)}R.`); }
  L.push('', '## By year (net R / excess R a trade, n)', '');
  const ys = [...new Set(Object.values(T).flatMap((x) => [...Object.keys(x.IS.byYear), ...Object.keys(x.OOS.byYear)]))].sort();
  L.push('| Year | ' + Object.keys(T).join(' | ') + ' |', '|---|' + Object.keys(T).map(() => '---|').join(''));
  for (const y of ys) L.push(`| ${y} | ` + Object.keys(T).map((k) => { const b = T[k].IS.byYear[y] || T[k].OOS.byYear[y]; return b ? `${sg(b.netR)} / ${sg(b.excessR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- ${R.data}`);
  L.push(`- Rule: ${R.rule}`);
  L.push(`- Costs: $${R.cost.toFixed(2)} a round trip per ounce (spread and slippage), 2x reported; financing \`nights\` x \`FIN.xau.long\` on buys from \`council/fills.mjs\` (first weekday 00:00 UTC to last weekday 21:00 UTC).`);
  L.push('- Volume is OANDA\'s count of price updates a day, a proxy for activity, not traded volume; it grows by two orders of magnitude over the sample, so only a rank against gold\'s own previous 250 readings is used.');
  L.push('- To repeat: `git show origin/council-data:research/daily/xau.json > <scratch>/xau.json`, then `node research/edge/gold-amihud/run.mjs <scratch>/xau.json` (the file stays out of git).');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = process.argv[2]; if (!file) throw new Error('usage: node run.mjs <xau.json>');
  const src = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ds = makeDays(src.rows), weeks = makeWeeks(ds), base = baselineByMonth(weeks), res = {}, pl = {};
  const sw = weeks.filter((w) => w.day >= WINDOWS.IS[0] && w.day <= WINDOWS.OOS[1]);
  for (const [k, t] of Object.entries(TESTS)) {
    const tr = runTest(sw, t, base);
    const f = (w) => summary(tr.filter((x) => inW(x.day, w)));
    res[k] = { name: t.name, IS: f(WINDOWS.IS), OOS: f(WINDOWS.OOS), H1: f(HALVES.H1), H2: f(HALVES.H2) };
    pl[k] = placebo(sw, tr);
  }
  const bl = { IS: {}, OOS: {} };
  for (const w of ['IS', 'OOS']) for (const s of [1, -1]) {
    const v = sw.filter((x) => inW(x.day, WINDOWS[w]) && eligible(x)).map((x) => trade(x, s));
    bl[w][s > 0 ? 'buy' : 'sell'] = { n: v.length, grossR: r3(mean(v.map((x) => x.R))), netR: r3(mean(v.map((x) => x.net))), t: r2(monthT(v).t) };
  }
  const dec = decide(res, pl);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const fail = (k) => Object.entries(dec[k].checks).filter(([, v]) => !v).map(([c]) => c).join(', ');
  const line = (k) => { const o = res[k].OOS; return `${k} net ${sg(o.netR)}R, gross ${sg(o.grossR)}R, excess ${sg(o.excessR)}R (n ${o.n}, excess t ${s2(o.excessT)}; 2007-16 excess ${sg(res[k].IS.excessR)}R, t ${s2(res[k].IS.excessT)}; ${dec[k].pass ? 'passes' : `failed: ${fail(k)}`})`; };
  const any = dec.T1.pass;
  const reading = (any ? 'The primary test passes every pre-registered check: a lead to replicate on years or markets it did not use, never an edge on its own and never a council rule without the owner. ' : 'The primary test does not pass the pre-registered bar. ')
    + `Out of sample: ${line('T1')}; ${line('T2')}; ${line('T3')}. `
    + `The same-side baseline (the next week in every eligible week) made 2017-26 buys ${sg(bl.OOS.buy.netR)}R and sells ${sg(bl.OOS.sell.netR)}R a trade net (2007-16 ${sg(bl.IS.buy.netR)}R / ${sg(bl.IS.sell.netR)}R). `
    + `Placebo seeds beaten: T1 ${dec.T1.beaten}, T2 ${dec.T2.beaten}, T3 ${dec.T3.beaten} of 40. `
    + (any ? '' : 'Not an edge; nothing live changes and no proposal is written.');
  const result = { study: 'gold-amihud', built: '2026-11-14', preregistration: 'research/edge/gold-amihud/PREREGISTRATION.md', planSha256: sha,
    system: 'stand-alone gold weekly rule (not the live book)',
    claim: 'when gold has recently been illiquid (a high Amihud ratio against its own past), the next week\'s return is higher than gold\'s drift',
    rule: 'a_t = |ln(c_t / c_t-1)| / tick volume; ILLIQ = mean a over 20 weekdays; rank = share of the 250 previous ILLIQ readings below it, read at the last weekday of a week; T1 rank >= 2/3 buy the next week; T2 rank <= 1/3 sell it; T3 rank >= 2/3 and that week closed down, buy; market at the next week\'s first open, stop 2 x ATR(20), out at its last close; stop first, a gap through fills at the open; excess = net R minus the mean net R of the same side in every eligible week starting in the same calendar month',
    data: `council-data research/daily/xau.json (OANDA mid, UTC days, weekdays only), ${sw.length} trade weeks ${sw[0].day} → ${sw.at(-1).day}`,
    cost: COST, financing: { rate: FIN.xau.long, src: FIN.xau.src }, windows: WINDOWS, halves: HALVES, baseline: bl, verdict: verdictLine(res, dec), decision: dec, tests: res,
    placebo: { seeds: SEEDS, how: 'random other eligible OOS week, same side and mechanics', ...Object.fromEntries(Object.keys(TESTS).map((k) => [k, { means: pl[k], min: Math.min(...pl[k]), max: Math.max(...pl[k]), median: r3(quantile(pl[k], 0.5)), p95: r3(quantile(pl[k], 0.95)) }])) },
    reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict, result.verdict.length);
  for (const k of Object.keys(TESTS)) console.log(k, JSON.stringify({ IS: [res[k].IS.n, res[k].IS.grossR, res[k].IS.netR, res[k].IS.excessR, res[k].IS.t, res[k].IS.excessT], OOS: [res[k].OOS.n, res[k].OOS.grossR, res[k].OOS.netR, res[k].OOS.excessR, res[k].OOS.t, res[k].OOS.excessT, res[k].OOS.net2R] }), dec[k].pHolm, dec[k].beaten);
  console.log(JSON.stringify(bl));
}
