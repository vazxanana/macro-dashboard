// Edge research · gold-comex-orb: the opening-range breakout of the COMEX gold day session (08:20-08:50 New York) on OANDA
// spot gold M5, as fixed in PREREGISTRATION.md. Pure pieces are exported for tests/gold-comex-orb.test.mjs. Only the
// read-only CME calendar of ict/ is imported.
//   node --use-env-proxy research/edge/gold-comex-orb/fetch.mjs <dir>   (candles, out of git)
//   node research/edge/gold-comex-orb/run.mjs <dir>                      (writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { nyParts, dayInfo, cmeShut } from '../../../ict/calendar.mjs';

export const COST = 0.30, SLIP = 0.15;          // $ a round trip per ounce (spot gold spread), half a spread per market order
export const RS = 8 * 60 + 20, RLEN = 30, BREAK_LEN = 160, EXIT_OFF = 190, NEED = 30, MED_N = 20;
export const TESTS = {
  T1: { name: 'Breakout, stop at the opposite side, 2R', mode: 'break', tgt: 2 },
  T2: { name: 'T1 on a range under its 20-day median width', mode: 'break', tgt: 2, narrow: true },
  T3: { name: 'Fade of the first break, stop past its extreme, 1R', mode: 'fade', tgt: 1 },
};
export const WINDOWS = { IS: ['2016-01-01', '2020-12-31'], OOS: ['2021-01-01', '2026-11-13'] };
export const SEEDS = 40, PLACEBO = { from: 3 * 60, to: 13 * 60 };

// ─── candles grouped by New York calendar day (00:00 → 16:55) ───
const wdOf = (s) => new Date(Date.parse(s + 'T00:00:00Z')).getUTCDay();
export const tradingDay = (ymd) => { const w = wdOf(ymd); return w >= 1 && w <= 5 && dayInfo(ymd).kind === 'open'; };
export function groupDays(rows) {
  const cal = new Map();
  for (const r of rows) {
    if (cmeShut(r[0])) continue;
    const p = nyParts(r[0]);
    if (p.min >= 17 * 60) continue;
    if (!cal.has(p.ymd)) cal.set(p.ymd, []);
    cal.get(p.ymd).push({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], min: p.min });
  }
  return cal;
}

// the range of a day (null when a range candle is missing or the range is flat)
export function rangeOf(bars, rs = RS) {
  const r = bars.filter((b) => b.min >= rs && b.min < rs + RLEN);
  if (r.length < RLEN / 5) return null;
  const hi = Math.max(...r.map((b) => b.h)), lo = Math.min(...r.map((b) => b.l));
  return hi > lo ? { hi, lo, width: hi - lo } : null;
}

// ─── one day, one rule ───
// bars: the day's candles in time order ({t,o,h,l,c,min}); opt: { rs, mode 'break' | 'fade', tgt, cost, slip }
export function orbTrade(bars, { rs = RS, mode = 'break', tgt = 2, cost = COST, slip = SLIP } = {}) {
  const re = rs + RLEN, be = re + BREAK_LEN, xe = re + EXIT_OFF;
  const rg = rangeOf(bars, rs);
  if (!rg) return { skip: 'range' };
  const post = bars.filter((b) => b.min >= re && b.min < xe);
  if (post.length < NEED) return { skip: 'missing' };
  let k = -1, s = 0;
  for (let i = 0; i < post.length && post[i].min <= be - 5; i++) {
    if (post[i].c > rg.hi) { s = 1; k = i; break; }
    if (post[i].c < rg.lo) { s = -1; k = i; break; }
  }
  if (k < 0) return { skip: 'nobreak' };
  if (k + 1 >= post.length) return { skip: 'noentry' };
  const side = mode === 'fade' ? -s : s, entry = post[k + 1].o;
  let stop;
  if (mode === 'fade') {
    const seen = bars.filter((b) => b.min >= rs && b.t <= post[k].t);   // 08:20 → the break candle, nothing later
    stop = s > 0 ? Math.max(...seen.map((b) => b.h)) : Math.min(...seen.map((b) => b.l));
  } else stop = side > 0 ? rg.lo : rg.hi;
  const r = side * (entry - stop);
  if (!(r > 0)) return { skip: 'norisk' };
  const target = entry + side * tgt * r;
  let exit = null, how = null;
  for (let i = k + 1; i < post.length; i++) {
    const b = post[i];
    if (side * (b.o - stop) <= 0) { exit = b.o; how = 'stop'; break; }
    const hitS = side > 0 ? b.l <= stop : b.h >= stop, hitT = side > 0 ? b.h >= target : b.l <= target;
    if (hitS) { exit = stop; how = 'stop'; break; }
    if (hitT) { exit = target; how = 'target'; break; }
  }
  if (exit == null) { exit = post.at(-1).c; how = 'time'; }
  const R = side * (exit - entry) / r, usd = cost + slip + (how === 'target' ? 0 : slip);
  return { side, breakAt: post[k].min, entryAt: post[k + 1].min, hi: rg.hi, lo: rg.lo, width: rg.width, entry, stop, target, r, exit, how, R,
    costUsd: usd, net: R - usd / r, net2: R - 2 * usd / r };
}

// narrow flag: width under the median of the previous MED_N days that had a range (strictly earlier days)
export function narrowFlags(days) {
  const hist = [], out = new Map();
  for (const d of days) {
    const rg = rangeOf(d.bars);
    if (hist.length >= MED_N && rg) { const w = [...hist.slice(-MED_N)].sort((a, b) => a - b); const med = (w[MED_N / 2 - 1] + w[MED_N / 2]) / 2; out.set(d.day, rg.width < med); }
    if (rg) hist.push(rg.width);
  }
  return out;
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
  const net = tr.map((x) => x.net), mt = monthT(tr), gt = monthT(tr, 'R'), t2 = monthT(tr, 'net2');
  let eq = 0, pk = 0, dd = 0; for (const v of net) { eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const byYear = {}; for (const x of tr) { const y = x.day.slice(0, 4); (byYear[y] ||= { n: 0, net: 0 }); byYear[y].n++; byYear[y].net += x.net; }
  for (const y in byYear) byYear[y] = { n: byYear[y].n, netR: r3(byYear[y].net / byYear[y].n), total: r2(byYear[y].net) };
  const rs = tr.map((x) => x.r).sort((a, b) => a - b), side = (s) => { const a = tr.filter((x) => x.side === s); return { n: a.length, netR: r3(mean(a.map((x) => x.net))) }; };
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), netR: r3(mean(net)), grossR: r3(mean(tr.map((x) => x.R))),
    net2R: r3(mean(tr.map((x) => x.net2))), costR: r3(mean(tr.map((x) => x.R - x.net))), total: r2(net.reduce((s, v) => s + v, 0)),
    months: mt.months, t: r2(mt.t), grossT: r2(gt.t), t2x: r2(t2.t), stops: tr.filter((x) => x.how === 'stop').length,
    targets: tr.filter((x) => x.how === 'target').length, time: tr.filter((x) => x.how === 'time').length, maxDD: r2(dd),
    medianStop: rs.length ? r2(rs[Math.floor(rs.length / 2)]) : null, buys: side(1), sells: side(-1), byYear };
}

// ─── the whole run ───
const inW = (day, [a, b]) => day >= a && day <= b;
export function prepare(rows) {
  const cal = groupDays(rows), days = [];
  for (const D of [...cal.keys()].sort()) if (D >= WINDOWS.IS[0] && D <= WINDOWS.OOS[1] && tradingDay(D)) days.push({ day: D, bars: cal.get(D) });
  return days;
}
export function runTest(days, test, narrow) {
  const tr = [], skips = {};
  for (const d of days) {
    if (test.narrow) { const f = narrow.get(d.day); if (f === undefined) { skips.warmup = (skips.warmup || 0) + 1; continue; } if (!f) { skips.wide = (skips.wide || 0) + 1; continue; } }
    const x = orbTrade(d.bars, test);
    if (x.skip) skips[x.skip] = (skips[x.skip] || 0) + 1; else tr.push({ day: d.day, ...x });
  }
  return { tr, skips };
}
export function placebo(days, seeds = SEEDS) {
  const grid = (PLACEBO.to - PLACEBO.from) / 5 + 1, out = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = rng(seed), tr = [];
    for (const d of days) {
      const rs = PLACEBO.from + 5 * Math.floor(rand() * grid);
      if (!inW(d.day, WINDOWS.OOS)) continue;
      const x = orbTrade(d.bars, { ...TESTS.T1, rs }); if (!x.skip) tr.push(x);
    }
    out.push(r3(mean(tr.map((x) => x.net))));
  }
  return out;
}
export function decide(res, p95) {
  const ks = Object.keys(TESTS), ps = ks.map((k) => normP(res[k].OOS.t)), adj = holm(ps), d = {};
  ks.forEach((k, i) => {
    const o = res[k].OOS, is = res[k].IS;
    const checks = { netPos: o.netR > 0, t2: o.t >= 2, holm: adj[i] < 0.05, isPos: is.netR > 0, cost2x: o.net2R > 0, placebo: o.netR > p95 };
    d[k] = { p: r3(ps[i]), pHolm: r3(adj[i]), checks, pass: Object.values(checks).every(Boolean) };
  });
  return d;
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(res, dec) {
  const n = Object.values(dec).filter((x) => x.pass).length, o = res.T1.OOS;
  return `${dec.T1.pass ? 'PASS' : 'FAIL'}, ${n} of 3: gold 08:20-08:50 NY breakout 2021 → now ${sg(o.netR)}R a trade net (n ${o.n}, month t ${s2(o.t)}, gross ${sg(o.grossR)}R); 2016-20 ${sg(res.T1.IS.netR)}R`;
}
export function report(R) {
  const L = [], T = R.tests, yn = (b) => (b ? 'yes' : 'no');
  L.push('# Gold: the opening-range breakout of the COMEX day session (08:20-08:50 New York)', '');
  L.push('Paper research only. A new stand-alone intraday rule, not a gate, exit, entry or size of the live gold book (item 44: no candle before 2016, none of the book\'s records read). Nothing live changed, no proposal. The rule, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## Tests', '');
  L.push('| Test | Rule | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | Stops / targets / time | Max DD R | Median stop $ |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) for (const w of ['IS', 'OOS']) {
    const x = T[k][w];
    L.push(`| ${k} | ${T[k].name} | ${w === 'IS' ? '2016-2020' : '2021 → 2026-11-13'} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.costR)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${x.stops} / ${x.targets} / ${x.time} | ${s2(x.maxDD)} | ${x.medianStop} |`);
  }
  L.push('', '## Decision (out of sample, Holm over the three tests)', '');
  L.push('| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | in sample > 0 | 2x cost > 0 | above placebo 95th | pass |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, d] of Object.entries(R.decision)) { const c = d.checks; L.push(`| ${k} | ${d.p} | ${d.pHolm} | ${yn(c.netPos)} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.isPos)} | ${yn(c.cost2x)} | ${yn(c.placebo)} | **${d.pass ? 'pass' : 'fail'}** |`); }
  L.push('', `**Placebo** (the T1 rule on a 30-minute range starting at a random 5-minute mark 03:00-13:00 New York, one draw a day, ${R.placebo.seeds} seeds, 2021 → now): seed means from ${sg(R.placebo.min)} to ${sg(R.placebo.max)}R a trade, median ${sg(R.placebo.median)}, 95th percentile ${sg(R.placebo.p95)}R.`, '');
  L.push('## Sides and skipped days', '');
  for (const k of Object.keys(T)) L.push(`- ${k}, 2021 → now: buys n ${T[k].OOS.buys.n} ${sg(T[k].OOS.buys.netR)}R, sells n ${T[k].OOS.sells.n} ${sg(T[k].OOS.sells.netR)}R; days without a trade, whole period: ${Object.entries(T[k].skips).map(([a, b]) => `${a} ${b}`).join(', ') || 'none'}.`);
  L.push('', '## By year (net R a trade, n)', '');
  const ys = [...new Set(Object.values(T).flatMap((x) => [...Object.keys(x.IS.byYear), ...Object.keys(x.OOS.byYear)]))].sort();
  L.push('| Year | ' + Object.keys(T).join(' | ') + ' |', '|---|' + Object.keys(T).map(() => '---|').join(''));
  for (const y of ys) L.push(`| ${y} | ` + Object.keys(T).map((k) => { const b = T[k].IS.byYear[y] || T[k].OOS.byYear[y]; return b ? `${sg(b.netR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- ${R.data}`);
  L.push(`- Rule: ${R.rule}`);
  L.push(`- Costs: $${R.cost.toFixed(2)} a round trip per ounce plus $${R.slip.toFixed(2)} slippage per market order (entry always; a stop or 12:00 exit; a target is a limit), 2x reported; no financing (flat by 12:00 New York).`);
  L.push('- To repeat: `node --use-env-proxy research/edge/gold-comex-orb/fetch.mjs <dir>`, then `node research/edge/gold-comex-orb/run.mjs <dir>`.');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-5m.json.gz')))).filter((r) => r[0] >= Date.parse('2015-12-20T00:00:00Z') / 1000);
  const days = prepare(rows), narrow = narrowFlags(days), res = {};
  for (const [k, t] of Object.entries(TESTS)) {
    const { tr, skips } = runTest(days, t, narrow);
    res[k] = { name: t.name, skips, IS: summary(tr.filter((x) => inW(x.day, WINDOWS.IS))), OOS: summary(tr.filter((x) => inW(x.day, WINDOWS.OOS))) };
  }
  const pl = placebo(days), p95 = quantile(pl, 0.95), dec = decide(res, p95);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const o = res.T1.OOS, fail = (k) => Object.entries(dec[k].checks).filter(([, v]) => !v).map(([c]) => c).join(', ');
  const reading = dec.T1.pass ? 'T1 passes every pre-registered check. Paper research only; at most a proposal for the owner, with its own forward record.'
    : `The primary breakout (T1) does not pass the pre-registered bar (failed: ${fail('T1')}). Out of sample it makes ${sg(o.netR)}R a trade after costs (n ${o.n}, month t ${s2(o.t)}; before costs ${sg(o.grossR)}R, t ${s2(o.grossT)}); costs take ${sg(o.costR).replace('+', '')}R a trade at a median stop of $${o.medianStop}. `
      + `T2 (narrow range) ${sg(res.T2.OOS.netR)}R (n ${res.T2.OOS.n}, t ${s2(res.T2.OOS.t)}${dec.T2.pass ? ', passes' : `; failed: ${fail('T2')}`}); T3 (fade) ${sg(res.T3.OOS.netR)}R (n ${res.T3.OOS.n}, t ${s2(res.T3.OOS.t)}${dec.T3.pass ? ', passes' : `; failed: ${fail('T3')}`}). `
      + `Before costs the breakout does lean the right way out of sample (T1 gross t ${s2(o.grossT)}, T2 gross t ${s2(res.T2.OOS.grossT)}), but not in 2016-20 (T1 gross ${sg(res.T1.IS.grossR)}R), and the spread and slippage take what there is. `
      + `T3's per-trade figures are large because its stop sits a median $${res.T3.OOS.medianStop} from the entry (the break candle often closes near its extreme), so $0.60 of cost is several R; it loses before costs too (gross ${sg(res.T3.OOS.grossR)}R, t ${s2(res.T3.OOS.grossT)}). `
      + 'Not an edge; nothing live changes and no proposal is written.';
  const result = { study: 'gold-comex-orb', built: '2026-11-14', preregistration: 'research/edge/gold-comex-orb/PREREGISTRATION.md', planSha256: sha,
    claim: 'the first M5 close outside the 08:20-08:50 New York range of the COMEX gold day session points the morning on spot gold',
    rule: 'range = high/low of the six M5 candles 08:20-08:45 NY; break = first M5 close outside it on a candle starting 08:50-11:25; entry at the next open (market); T1 with the break, stop at the opposite side, 2R; T2 = T1 on days whose range is under the median of the previous 20; T3 against the break, stop at the 08:20 → break-candle extreme, 1R; stop first, a gap through the stop fills at the open; flat at 12:00 NY; one trade a day',
    data: `OANDA mid XAU/USD M5 through the keyless candle proxy, ${days.length} trading days ${days[0].day} → ${days.at(-1).day}; New York time and the CME calendar from ict/calendar.mjs (full holidays and early closes skipped)`,
    cost: COST, slip: SLIP, windows: WINDOWS, verdict: verdictLine(res, dec), decision: dec, tests: res,
    placebo: { seeds: SEEDS, start: '03:00-13:00 NY', means: pl, min: Math.min(...pl), max: Math.max(...pl), median: r3(quantile(pl, 0.5)), p95: r3(p95) }, reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict); for (const k of Object.keys(TESTS)) console.log(k, JSON.stringify({ IS: { n: res[k].IS.n, net: res[k].IS.netR, gross: res[k].IS.grossR, t: res[k].IS.t }, OOS: { n: res[k].OOS.n, net: res[k].OOS.netR, gross: res[k].OOS.grossR, t: res[k].OOS.t, gt: res[k].OOS.grossT, n2: res[k].OOS.net2R } }), dec[k].pHolm);
  console.log('placebo p95', r3(p95), 'median', r3(quantile(pl, 0.5)));
}
