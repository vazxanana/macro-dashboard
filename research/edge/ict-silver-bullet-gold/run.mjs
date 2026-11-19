// Edge research · ict-silver-bullet-gold: ICT's "silver bullet" time-window entry on OANDA spot gold M5, as fixed in
// PREREGISTRATION.md. Pure pieces are exported for tests/desk-ict-silver-bullet-gold.test.mjs. ICT stays a separate edge:
// only the read-only CME calendar of ict/ is imported, nothing of the tracker or the replay.
//   node --use-env-proxy research/edge/ict-silver-bullet-gold/fetch.mjs <dir>   (candles, out of git)
//   node research/edge/ict-silver-bullet-gold/run.mjs <dir>                      (writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { nyParts, dayInfo, cmeShut } from '../../../ict/calendar.mjs';

export const COST = 0.30;                       // $ a round trip per ounce (gold-systems, spreadOf for spot)
export const TARGET_R = 2, ROOM_R = 1, FLAT = 16 * 60;
export const WIN = { T1: { name: 'AM 10:00-11:00', start: 10 * 60, end: 11 * 60 }, T2: { name: 'PM 14:00-15:00', start: 14 * 60, end: 15 * 60 }, T3: { name: 'London 03:00-04:00', start: 3 * 60, end: 4 * 60 } };
export const WINDOWS = { IS: ['2016-01-01', '2020-12-31'], OOS: ['2021-01-01', '2026-11-13'] };
export const SEEDS = 40, PLACEBO = { from: 30, to: 14 * 60 + 55 };
const M5 = 300;

// ─── candles grouped by New York day ───
const nextYmd = (s, k = 1) => { const d = new Date(Date.parse(s + 'T00:00:00Z') + k * 86400e3); return d.toISOString().slice(0, 10); };
const wdOf = (s) => new Date(Date.parse(s + 'T00:00:00Z')).getUTCDay();
// rows [t,o,h,l,c] → { cal: Map ymd → candles of that calendar day, sess: Map ymd → candles of its 17:00-New York session }
export function groupDays(rows) {
  const cal = new Map(), sess = new Map();
  for (const r of rows) {
    if (cmeShut(r[0])) continue;
    const p = nyParts(r[0]), b = { t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], min: p.min, ymd: p.ymd };
    if (!cal.has(p.ymd)) cal.set(p.ymd, []); cal.get(p.ymd).push(b);
    if (p.min >= 17 * 60 && p.min < 18 * 60) continue;           // the daily halt hour belongs to no session
    const sd = p.min >= 18 * 60 ? nextYmd(p.ymd) : p.ymd;
    if (!sess.has(sd)) sess.set(sd, []); sess.get(sd).push(b);
  }
  return { cal, sess };
}
export const tradingDay = (ymd) => { const w = wdOf(ymd); return w >= 1 && w <= 5 && dayInfo(ymd).kind === 'open'; };
// previous Monday-to-Friday that is not a CME full holiday
export function priorDay(ymd) { let d = nextYmd(ymd, -1); for (;;) { const w = wdOf(d); if (w >= 1 && w <= 5 && dayInfo(d).kind !== 'full') return d; d = nextYmd(d, -1); } }
// BSL / SSL of day D: prior 17:00 day's high / low and the Asian range (18:00 the evening before D to 00:00 D)
export function levels(G, D) {
  const pd = G.sess.get(priorDay(D)), asia = (G.sess.get(D) || []).filter((b) => b.min >= 18 * 60);
  if (!pd || !pd.length || !asia.length) return null;
  const mx = (a) => Math.max(...a.map((b) => b.h)), mn = (a) => Math.min(...a.map((b) => b.l));
  return { bsl: Math.max(mx(pd), mx(asia)), ssl: Math.min(mn(pd), mn(asia)), pdh: mx(pd), pdl: mn(pd), ah: mx(asia), al: mn(asia) };
}

// ─── one day, one window ───
// bars: D's candles 00:00 → 15:55 New York in time order ({t,o,h,l,c,min}); lv: { bsl, ssl }; win: { start, end } in NY minutes
export function dayTrade(bars, lv, win, cost = COST) {
  if (!lv) return { skip: 'levels' };
  const inWin = bars.filter((b) => b.min >= win.start && b.min < win.end).length;
  if (inWin < 10) return { skip: 'missing' };
  // 1. the first side swept from 00:00
  let si = -1, s = 0;
  for (let i = 0; i < bars.length; i++) {
    const hi = bars[i].h > lv.bsl, lo = bars[i].l < lv.ssl;
    if (hi && lo) return { skip: 'both' };
    if (hi || lo) { si = i; s = hi ? -1 : 1; break; }
  }
  if (si < 0) return { skip: 'nosweep' };
  if (bars[si].min >= win.end - 5) return { skip: 'latesweep' };
  // 2. the first gap in the direction whose third candle opens in [start, end-10] and is at or after the sweep candle
  let k = -1;
  for (let i = Math.max(2, si); i < bars.length; i++) {
    const c3 = bars[i], c2 = bars[i - 1], c1 = bars[i - 2];
    if (c3.min > win.end - 10) break;
    if (c3.min < win.start) continue;
    if (c3.t - c2.t !== M5 || c2.t - c1.t !== M5) continue;
    const gap = s < 0 ? c3.h < c1.l && c2.c < c2.o : c3.l > c1.h && c2.c > c2.o;
    if (gap) { k = i; break; }
  }
  if (k < 0) return { skip: 'nogap', side: s };
  const c1 = bars[k - 2], c3 = bars[k], limit = s < 0 ? c3.h : c3.l, stop = s < 0 ? c1.h : c1.l;
  const opp = (b) => (s < 0 ? b.l < lv.ssl : b.h > lv.bsl);
  for (let i = si + 1; i <= k; i++) if (opp(bars[i])) return { skip: 'opposite', side: s };
  // 3. the limit, valid on candles opening before the window's end
  let j = -1, entry = null;
  for (let i = k + 1; i < bars.length && bars[i].min < win.end; i++) {
    const b = bars[i];
    if (opp(b)) return { skip: 'opposite', side: s };
    if (s < 0 ? b.o >= limit : b.o <= limit) { j = i; entry = b.o; break; }
    if (s < 0 ? b.h >= limit : b.l <= limit) { j = i; entry = limit; break; }
  }
  if (j < 0) return { skip: 'nofill', side: s };
  const r = s < 0 ? stop - entry : entry - stop;
  if (!(r > 0)) return { skip: 'norisk', side: s };
  const draw = s < 0 ? lv.ssl : lv.bsl;
  if (s * (draw - entry) < ROOM_R * r) return { skip: 'room', side: s };
  const target = s < 0 ? Math.max(draw, entry - TARGET_R * r) : Math.min(draw, entry + TARGET_R * r);
  // 4. manage: stop only in the fill candle; then stop first; flat at 16:00
  let exit = null, how = null, last = bars[j];
  const fb = bars[j];
  if (s < 0 ? fb.h >= stop : fb.l <= stop) { exit = stop; how = 'stop'; }
  for (let i = j + 1; exit == null && i < bars.length && bars[i].min < FLAT; i++) {
    const b = bars[i]; last = b;
    if (s * (b.o - stop) <= 0) { exit = b.o; how = 'stop'; break; }
    const hitS = s > 0 ? b.l <= stop : b.h >= stop, hitT = s > 0 ? b.h >= target : b.l <= target;
    if (hitS) { exit = stop; how = 'stop'; break; }
    if (hitT) { exit = target; how = 'target'; break; }
  }
  if (exit == null) { exit = last.c; how = 'time'; }
  const R = s * (exit - entry) / r;
  return { side: s, sweepAt: bars[si].min, gapAt: c3.min, fillAt: bars[j].min, entry, stop, target, r, exit, how, R, net: R - cost / r, net2: R - 2 * cost / r };
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
  const G = groupDays(rows), days = [];
  for (const D of [...G.cal.keys()].sort()) {
    if (D < WINDOWS.IS[0] || D > WINDOWS.OOS[1] || !tradingDay(D)) continue;
    days.push({ day: D, lv: levels(G, D), bars: G.cal.get(D).filter((b) => b.min < FLAT) });
  }
  return days;
}
export function runWindow(days, win) {
  const tr = [], skips = {};
  for (const d of days) { const x = dayTrade(d.bars, d.lv, win); if (x.skip) skips[x.skip] = (skips[x.skip] || 0) + 1; else tr.push({ day: d.day, ...x }); }
  return { tr, skips };
}
export function placebo(days, seeds = SEEDS) {
  const grid = (PLACEBO.to - PLACEBO.from) / 5 + 1, out = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = rng(seed), tr = [];
    for (const d of days) {
      const st = PLACEBO.from + 5 * Math.floor(rand() * grid);
      if (!inW(d.day, WINDOWS.OOS)) continue;
      const x = dayTrade(d.bars, d.lv, { start: st, end: st + 60 }); if (!x.skip) tr.push(x);
    }
    out.push(r3(mean(tr.map((x) => x.net))));
  }
  return out;
}
export function decide(res, p95) {
  const ps = Object.keys(WIN).map((k) => normP(res[k].OOS.t)), adj = holm(ps), d = {};
  Object.keys(WIN).forEach((k, i) => {
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
  return `${dec.T1.pass ? 'PASS' : 'FAIL'}, ${n} of 3: AM silver bullet on gold 2021 → now ${sg(o.netR)}R a trade net (n ${o.n}, month t ${s2(o.t)}, gross ${sg(o.grossR)}R); 2016-20 ${sg(res.T1.IS.netR)}R`;
}
export function report(R) {
  const L = [];
  L.push('# ICT silver bullet on spot gold: the one-hour window entry, AM / PM / London', '');
  L.push('Paper research only. ICT is a separate edge; nothing under `ict/` changed (only its CME calendar is read), nothing live changed, no proposal. The rule, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  const T = R.tests;
  L.push('## Tests', '');
  L.push('| Test | Window | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | Stops / targets / time | Max DD R | Median stop $ |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) for (const w of ['IS', 'OOS']) {
    const x = T[k][w];
    L.push(`| ${k} | ${T[k].name} | ${w === 'IS' ? '2016-2020' : '2021 → 2026-11-13'} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.costR)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${x.stops} / ${x.targets} / ${x.time} | ${s2(x.maxDD)} | ${x.medianStop} |`);
  }
  L.push('', '## Decision (out of sample, Holm over the three tests)', '');
  L.push('| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | in sample > 0 | 2x cost > 0 | above placebo 95th | pass |', '|---|---|---|---|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const [k, d] of Object.entries(R.decision)) { const c = d.checks; L.push(`| ${k} | ${d.p} | ${d.pHolm} | ${yn(c.netPos)} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.isPos)} | ${yn(c.cost2x)} | ${yn(c.placebo)} | **${d.pass ? 'pass' : 'fail'}** |`); }
  L.push('', `**Placebo** (the same rule in a random one-hour window starting 00:30-14:55 New York, one draw a day, ${R.placebo.seeds} seeds, 2021 → now): seed means from ${sg(R.placebo.min)} to ${sg(R.placebo.max)}R a trade, median ${sg(R.placebo.median)}, 95th percentile ${sg(R.placebo.p95)}R.`, '');
  L.push('## Sides and skipped days', '');
  for (const k of Object.keys(T)) L.push(`- ${k} (${T[k].name}), 2021 → now: buys n ${T[k].OOS.buys.n} ${sg(T[k].OOS.buys.netR)}R, sells n ${T[k].OOS.sells.n} ${sg(T[k].OOS.sells.netR)}R; days without a trade, whole period: ${Object.entries(T[k].skips).map(([a, b]) => `${a} ${b}`).join(', ')}.`);
  L.push('', '## By year (net R a trade, n)', '');
  const ys = [...new Set(Object.values(T).flatMap((x) => [...Object.keys(x.IS.byYear), ...Object.keys(x.OOS.byYear)]))].sort();
  L.push('| Year | ' + Object.keys(T).join(' | ') + ' |', '|---|' + Object.keys(T).map(() => '---|').join(''));
  for (const y of ys) L.push(`| ${y} | ` + Object.keys(T).map((k) => { const b = T[k].IS.byYear[y] || T[k].OOS.byYear[y]; return b ? `${sg(b.netR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- ${R.data}`);
  L.push(`- Rule: ${R.rule}`);
  L.push(`- Costs: $${R.cost.toFixed(2)} a round trip per ounce (\`research/edge/gold-systems\`, \`spreadOf\` for spot), 2x reported; no financing (flat at 16:00).`);
  L.push('- Item 44: a new standalone intraday rule; not a gate, exit, entry or size of the live gold book; no candle before 2016 read, none of the book\'s 2006-17 records opened.');
  L.push('- To repeat: `node --use-env-proxy research/edge/ict-silver-bullet-gold/fetch.mjs <dir>`, then `node research/edge/ict-silver-bullet-gold/run.mjs <dir>`.');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-5m.json.gz')))).filter((r) => r[0] >= Date.parse('2015-12-20T00:00:00Z') / 1000);
  const days = prepare(rows), res = {};
  for (const [k, w] of Object.entries(WIN)) {
    const { tr, skips } = runWindow(days, w);
    res[k] = { name: w.name, skips, IS: summary(tr.filter((x) => inW(x.day, WINDOWS.IS))), OOS: summary(tr.filter((x) => inW(x.day, WINDOWS.OOS))) };
  }
  const pl = placebo(days), p95 = quantile(pl, 0.95), dec = decide(res, p95);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const o = res.T1.OOS;
  const reading = dec.T1.pass ? 'T1 passes every pre-registered check. Paper research only; any use on the ICT desk is the desk owner\'s decision with its own forward record.'
    : `The primary AM window does not pass the pre-registered bar (failed: ${Object.entries(dec.T1.checks).filter(([, v]) => !v).map(([c]) => c).join(', ')}). Out of sample it makes ${sg(o.netR)}R a trade after $0.30 a round trip (n ${o.n}, month t ${s2(o.t)}; before costs ${sg(o.grossR)}R, t ${s2(o.grossT)}); costs take ${sg(o.costR).replace('+', '')}R a trade at a median stop of $${o.medianStop}. Not an edge; nothing on the ICT desk or the council changes and no proposal is written.`;
  const result = { study: 'ict-silver-bullet-gold', built: '2026-11-14', preregistration: 'research/edge/ict-silver-bullet-gold/PREREGISTRATION.md', planSha256: sha,
    claim: 'ICT "silver bullet": after a liquidity sweep, the first M5 fair value gap in a one-hour New York window, in the direction of the draw',
    rule: 'draw = prior 17:00-NY day high/low and the Asian range (18:00-00:00 NY); the first side swept from 00:00 sets the side (buy side swept → sell); first M5 FVG (middle candle in the trade direction) whose third candle opens in the window up to 10 min before its end; limit at the near edge until the window ends; stop at the first candle\'s extreme; target the nearer of the opposite draw and 2R (skip under 1R of room); stop first; flat 16:00; one trade a day',
    data: `OANDA mid XAU/USD M5 through the keyless candle proxy, ${days.length} trading days ${days[0].day} → ${days.at(-1).day}; CME calendar from ict/calendar.mjs (full holidays and early closes skipped)`,
    cost: COST, windows: WINDOWS, verdict: verdictLine(res, dec), decision: dec, tests: res,
    placebo: { seeds: SEEDS, start: '00:30-14:55 NY', means: pl, min: Math.min(...pl), max: Math.max(...pl), median: r3(quantile(pl, 0.5)), p95: r3(p95) }, reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict); for (const k of Object.keys(WIN)) console.log(k, JSON.stringify({ IS: { n: res[k].IS.n, net: res[k].IS.netR, gross: res[k].IS.grossR, t: res[k].IS.t }, OOS: { n: res[k].OOS.n, net: res[k].OOS.netR, gross: res[k].OOS.grossR, t: res[k].OOS.t, gt: res[k].OOS.grossT } }), dec[k].pHolm);
  console.log('placebo p95', r3(p95), 'median', r3(quantile(pl, 0.5)));
}
