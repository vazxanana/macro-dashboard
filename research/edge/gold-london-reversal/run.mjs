// Edge research · gold-london-reversal: the London session's move (02:00-08:00 New York) faded during New York on OANDA spot
// gold M5, as fixed in PREREGISTRATION.md. Pure pieces are exported for tests/gold-london-reversal.test.mjs. Only the read-only
// CME calendar of ict/ is imported.
//   node --use-env-proxy research/edge/gold-london-reversal/fetch.mjs <dir>   (candles, out of git)
//   node research/edge/gold-london-reversal/run.mjs <dir>                      (writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { nyParts, dayInfo, cmeShut } from '../../../ict/calendar.mjs';

export const SPREAD = 0.30, SLIP = 0.15, COST = SPREAD + 2 * SLIP;   // $ a round trip per ounce: spread + half a spread per market order
export const BUF = 0.30, MIN_STOP = 0.1, MOVE_MIN = 0.3, ATR_N = 20;
export const LON = { from: 2 * 60, to: 8 * 60, need: 60 }, FLAT = 16 * 60;
export const T1_AT = 9 * 60 + 30, RAID_FROM = 8 * 60, SIG = { from: 9 * 60, to: 10 * 60 + 25 };
export const WINDOWS = { IS: ['2016-01-01', '2020-12-31'], OOS: ['2021-01-01', '2026-11-13'] };
export const TESTS = { T1: 'fade London at 09:30', T2: 'T1 on the midnight open\'s side', T3: 'after a New York raid of the London extreme' };
export const SEEDS = 40;
export const FIRST = Date.parse('2016-01-01T00:00:00Z') / 1000;

// ─── candles grouped by New York day ───
const nextYmd = (s, k = 1) => new Date(Date.parse(s + 'T00:00:00Z') + k * 86400e3).toISOString().slice(0, 10);
const wdOf = (s) => new Date(Date.parse(s + 'T00:00:00Z')).getUTCDay();
// rows [t,o,h,l,c] → { cal: Map ymd → that New York date's candles, sess: Map ymd → candles of its 17:00-New York session }
export function groupDays(rows) {
  const cal = new Map(), sess = new Map();
  for (const r of rows) {
    if (r[0] < FIRST || cmeShut(r[0])) continue;
    const p = nyParts(r[0]), b = { t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], min: p.min };
    if (!cal.has(p.ymd)) cal.set(p.ymd, []); cal.get(p.ymd).push(b);
    if (p.min >= 17 * 60 && p.min < 18 * 60) continue;
    const sd = p.min >= 18 * 60 ? nextYmd(p.ymd) : p.ymd;
    if (!sess.has(sd)) sess.set(sd, []); sess.get(sd).push(b);
  }
  return { cal, sess };
}
export const tradingDay = (ymd) => { const w = wdOf(ymd); return w >= 1 && w <= 5 && dayInfo(ymd).kind === 'open'; };
// ATR20 of day D: mean true range of the 20 most recent sessions dated before D (a session dated D is still running at London)
export function atrMap(sess) {
  const keys = [...sess.keys()].sort(), hl = keys.map((k) => { const a = sess.get(k); return { k, h: Math.max(...a.map((b) => b.h)), l: Math.min(...a.map((b) => b.l)), c: a.at(-1).c }; });
  const tr = hl.map((x, i) => (i ? Math.max(x.h, hl[i - 1].c) - Math.min(x.l, hl[i - 1].c) : null));
  return (D) => {
    let i = keys.length - 1; while (i >= 0 && keys[i] >= D) i--;   // last session before D
    if (i < ATR_N) return null;                                     // needs 20 true ranges (the first session has none)
    let s = 0; for (let j = i - ATR_N + 1; j <= i; j++) s += tr[j];
    return s / ATR_N;
  };
}

// ─── one day ───
// bars: D's candles 00:00 → 15:55 New York ({t,o,h,l,c,min}); returns the levels and the fade side, or { skip }
export function dayPlan(bars, atr) {
  if (!(atr > 0)) return { skip: 'atr' };
  const m0 = bars[0];
  if (!m0 || m0.min >= 30) return { skip: 'midnight' };
  const lon = bars.filter((b) => b.min >= LON.from && b.min < LON.to);
  if (lon.length < LON.need) return { skip: 'london' };
  const lo = lon[0].o, lc = lon.at(-1).c, move = lc - lo;
  if (Math.abs(move) <= MOVE_MIN * atr) return { skip: 'small' };
  return { mo: m0.o, lo, lc, lh: Math.max(...lon.map((b) => b.h)), ll: Math.min(...lon.map((b) => b.l)), move, side: move > 0 ? -1 : 1, atr };
}
// a market trade on side s entered at the open of bars[k]: stop beyond the extreme since 02:00 (+ $0.30, at least 0.1 x ATR20),
// stop first, flat at 16:00 (the close of the last candle before 16:00)
export function trade(bars, k, s, atr, cost = COST) {
  const e = bars[k]; if (!e) return { skip: 'entry' };
  const pre = bars.slice(0, k).filter((b) => b.min >= LON.from);
  if (!pre.length) return { skip: 'entry' };
  const entry = e.o;
  let stop = s < 0 ? Math.max(...pre.map((b) => b.h)) + BUF : Math.min(...pre.map((b) => b.l)) - BUF;
  if (s * (entry - stop) < MIN_STOP * atr) stop = entry - s * MIN_STOP * atr;
  const r = s * (entry - stop);
  let exit = null, how = null, last = e;
  if (s < 0 ? e.h >= stop : e.l <= stop) { exit = stop; how = 'stop'; }
  for (let i = k + 1; exit == null && i < bars.length && bars[i].min < FLAT; i++) {
    const b = bars[i]; last = b;
    if (s * (b.o - stop) <= 0) { exit = b.o; how = 'stop'; break; }
    if (s < 0 ? b.h >= stop : b.l <= stop) { exit = stop; how = 'stop'; break; }
  }
  if (exit == null) { exit = last.c; how = 'time'; }
  const R = s * (exit - entry) / r;
  return { side: s, at: e.min, entry, stop, r, exit, how, R, net: R - cost / r, net2: R - 2 * cost / r };
}
// the entry candle index of each test for one day, or null
export function entryT1(bars) { const k = bars.findIndex((b) => b.min === T1_AT); return k > 0 ? k : null; }
export function okT2(bars, k, p) { const e = bars[k].o; return p.side < 0 ? p.lh > p.mo && e > p.mo : p.ll < p.mo && e < p.mo; }
export function entryT3(bars, p) {
  const s = p.side, beyond = (b) => (s < 0 ? b.h > p.lh : b.l < p.ll), backIn = (b) => (s < 0 ? b.c < p.lh : b.c > p.ll), outC = (b) => (s < 0 ? b.c > p.lh : b.c < p.ll);
  let raided = false;
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i]; if (b.min > SIG.to) break;
    if (b.min >= RAID_FROM && beyond(b)) raided = true;
    if (b.min < SIG.from || !raided) continue;
    if (backIn(b) && (beyond(b) || outC(bars[i - 1]))) return i + 1 < bars.length && bars[i + 1].min <= SIG.to + 5 ? i + 1 : null;
  }
  return null;
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
    time: tr.filter((x) => x.how === 'time').length, maxDD: r2(dd), medianStop: rs.length ? r2(rs[Math.floor(rs.length / 2)]) : null, buys: side(1), sells: side(-1), byYear };
}

// ─── the whole run ───
const inW = (day, [a, b]) => day >= a && day <= b;
export function prepare(rows) {
  const G = groupDays(rows), atr = atrMap(G.sess), days = [], skips = {};
  for (const D of [...G.cal.keys()].sort()) {
    if (D < WINDOWS.IS[0] || D > WINDOWS.OOS[1] || !tradingDay(D)) continue;
    const bars = G.cal.get(D).filter((b) => b.min < FLAT), p = dayPlan(bars, atr(D));
    if (p.skip) { skips[p.skip] = (skips[p.skip] || 0) + 1; continue; }
    days.push({ day: D, bars, p });
  }
  return { days, skips };
}
// each test's entries: [{ d, k }] (day record and entry candle index)
export function entries(days) {
  const E = { T1: [], T2: [], T3: [] }, miss = { T1: 0, T2: 0, T3: 0 };
  for (const d of days) {
    const k1 = entryT1(d.bars);
    if (k1 == null) miss.T1++; else { E.T1.push({ d, k: k1 }); if (okT2(d.bars, k1, d.p)) E.T2.push({ d, k: k1 }); else miss.T2++; }
    const k3 = entryT3(d.bars, d.p); if (k3 == null) miss.T3++; else E.T3.push({ d, k: k3 });
  }
  return { E, miss };
}
export const run = (list, side = (x) => x.d.p.side) => list.map((x) => ({ day: x.d.day, ...trade(x.d.bars, x.k, side(x), x.d.p.atr) })).filter((x) => !x.skip);
export function placebo(list, seeds = SEEDS) {
  const oos = list.filter((x) => inW(x.d.day, WINDOWS.OOS)), out = [];
  for (let seed = 1; seed <= seeds; seed++) { const rand = rng(seed); out.push(r3(mean(run(oos, () => (rand() < 0.5 ? -1 : 1)).map((x) => x.net)))); }
  return out;
}
export function decide(res) {
  const ks = Object.keys(TESTS), ps = ks.map((k) => normP(res[k].OOS.t)), adj = holm(ps), d = {};
  ks.forEach((k, i) => {
    const o = res[k].OOS, is = res[k].IS;
    const checks = { netPos: o.netR > 0, t2: o.t >= 2, holm: adj[i] < 0.05, isPos: is.netR > 0, cost2x: o.net2R > 0, placebo: o.netR > res[k].placebo.p95 };
    d[k] = { p: r3(ps[i]), pHolm: r3(adj[i]), checks, pass: Object.values(checks).every(Boolean) };
  });
  return d;
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(res, dec) {
  const pass = Object.keys(dec).filter((k) => dec[k].pass), o = res.T1.OOS, o3 = res.T3.OOS;
  return `${pass.length ? 'PASS' : 'FAIL'}, ${pass.length} of 3: fading gold's London move at 09:30 NY, 2021 → now ${sg(o.netR)}R a trade net (n ${o.n}, month t ${s2(o.t)}, gross ${sg(o.grossR)}R); after a NY raid ${sg(o3.netR)}R (n ${o3.n}, t ${s2(o3.t)})`;
}
export function report(R) {
  const L = [];
  L.push('# Gold: the London move faded in New York (the "Judas swing")', '');
  L.push('Paper research only. A new stand-alone intraday rule on spot gold, **not a gate, exit, entry or size of the live gold book** (item 44: no candle before 2016 read, none of the book\'s records opened). Nothing live changed, no proposal. The rule, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  const T = R.tests;
  L.push('## Tests (R of the stop distance; t on calendar-month sums of net R)', '');
  L.push('| Test | Rule | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | Stops / time | Max DD R | Median stop $ |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) for (const w of ['IS', 'OOS']) {
    const x = T[k][w];
    L.push(`| ${k} | ${T[k].name} | ${w === 'IS' ? '2016-2020' : '2021 → 2026-11-13'} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.costR)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${x.stops} / ${x.time} | ${s2(x.maxDD)} | ${x.medianStop} |`);
  }
  L.push('', '## Decision (out of sample, Holm over the three tests)', '');
  L.push('| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | in sample > 0 | 2x cost > 0 | above placebo 95th | pass |', '|---|---|---|---|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const [k, d] of Object.entries(R.decision)) { const c = d.checks; L.push(`| ${k} | ${d.p} | ${d.pHolm} | ${yn(c.netPos)} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.isPos)} | ${yn(c.cost2x)} | ${yn(c.placebo)} | **${d.pass ? 'pass' : 'fail'}** |`); }
  L.push('', `**Placebo** (each test's own trade days with a random side, same entry, stop rule and exit; ${SEEDS} seeds, 2021 → now):`, '');
  for (const k of Object.keys(T)) { const p = T[k].placebo; L.push(`- ${k}: seed means ${sg(p.min)} to ${sg(p.max)}R a trade, median ${sg(p.median)}, 95th percentile ${sg(p.p95)}R; the rule ${sg(T[k].OOS.netR)}R.`); }
  L.push('', '## Sides', '');
  for (const k of Object.keys(T)) L.push(`- ${k}, 2021 → now: buys (London down) n ${T[k].OOS.buys.n} ${sg(T[k].OOS.buys.netR)}R, sells (London up) n ${T[k].OOS.sells.n} ${sg(T[k].OOS.sells.netR)}R; 2016-20: buys n ${T[k].IS.buys.n} ${sg(T[k].IS.buys.netR)}R, sells n ${T[k].IS.sells.n} ${sg(T[k].IS.sells.netR)}R.`);
  L.push('', '## By year (net R a trade, n)', '');
  const ys = [...new Set(Object.values(T).flatMap((x) => [...Object.keys(x.IS.byYear), ...Object.keys(x.OOS.byYear)]))].sort();
  L.push('| Year | ' + Object.keys(T).join(' | ') + ' |', '|---|' + Object.keys(T).map(() => '---|').join(''));
  for (const y of ys) L.push(`| ${y} | ` + Object.keys(T).map((k) => { const b = T[k].IS.byYear[y] || T[k].OOS.byYear[y]; return b ? `${sg(b.netR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- ${R.data}`);
  L.push(`- Days: ${R.days.used} trade days (London move over 0.3 x ATR20); skipped ${Object.entries(R.days.skips).map(([a, b]) => `${a} ${b}`).join(', ')}; no entry candle / condition: ${Object.entries(R.days.miss).map(([a, b]) => `${a} ${b}`).join(', ')}.`);
  L.push(`- Rule: ${R.rule}`);
  L.push(`- Costs: $${SPREAD.toFixed(2)} spread a round trip per ounce (\`research/edge/gold-systems\`, \`spreadOf\` for spot) + $${SLIP.toFixed(2)} slippage on each market order = $${R.cost.toFixed(2)} a round trip; 2x reported; no financing (flat at 16:00).`);
  L.push('- To repeat: `node --use-env-proxy research/edge/gold-london-reversal/fetch.mjs <dir>`, then `node research/edge/gold-london-reversal/run.mjs <dir>`.');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-5m.json.gz')))).filter((r) => r[0] >= FIRST);
  const { days, skips } = prepare(rows), { E, miss } = entries(days), res = {};
  for (const [k, name] of Object.entries(TESTS)) {
    const tr = run(E[k]), pl = placebo(E[k]);
    res[k] = { name, IS: summary(tr.filter((x) => inW(x.day, WINDOWS.IS))), OOS: summary(tr.filter((x) => inW(x.day, WINDOWS.OOS))),
      placebo: { means: pl, min: Math.min(...pl), max: Math.max(...pl), median: r3(quantile(pl, 0.5)), p95: r3(quantile(pl, 0.95)) } };
  }
  const dec = decide(res), o = res.T1.OOS;
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const passed = Object.keys(dec).filter((k) => dec[k].pass);
  const reading = passed.length ? `${passed.join(', ')} passes every pre-registered check. Paper research only; any use is the owner's decision, after a forward record.`
    : `No test passes the pre-registered bar (T1 failed: ${Object.entries(dec.T1.checks).filter(([, v]) => !v).map(([c]) => c).join(', ')}). Out of sample the plain fade makes ${sg(o.netR)}R a trade after $${COST.toFixed(2)} a round trip (n ${o.n}, month t ${s2(o.t)}; before costs ${sg(o.grossR)}R, t ${s2(o.grossT)}); the midnight-open condition gives ${sg(res.T2.OOS.netR)}R (n ${res.T2.OOS.n}, t ${s2(res.T2.OOS.t)}) and waiting for a New York raid of the London extreme ${sg(res.T3.OOS.netR)}R (n ${res.T3.OOS.n}, t ${s2(res.T3.OOS.t)}). Not an edge; nothing live changes and no proposal is written.`;
  const result = { study: 'gold-london-reversal', built: '2026-11-14', preregistration: 'research/edge/gold-london-reversal/PREREGISTRATION.md', planSha256: sha,
    claim: 'London (02:00-08:00 New York) often makes the day\'s high or low and New York reverses it (the "Judas swing"); fading the London move during New York pays on spot gold',
    rule: 'trade day when the London move (07:55 close − 02:00 open) exceeds 0.3 x ATR20 of 17:00-NY sessions; side against it; T1 market at the 09:30 open; T2 = T1 when London\'s extreme and the entry are beyond the midnight open; T3 = after a candle from 08:00 trades beyond the London extreme, the first candle opening 09:00-10:25 that closes back inside, entry at the next open; stop $0.30 beyond the extreme since 02:00 (at least 0.1 x ATR20); stop first; flat 16:00; one trade a day',
    data: `OANDA mid XAU/USD M5 through the keyless candle proxy, read from ${new Date(rows[0][0] * 1000).toISOString().slice(0, 10)}; trade days ${days[0].day} → ${days.at(-1).day}; CME calendar from ict/calendar.mjs (full holidays and early closes skipped)`,
    cost: COST, windows: WINDOWS, days: { used: days.length, skips, miss }, verdict: verdictLine(res, dec), decision: dec, tests: res, reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict, result.verdict.length);
  for (const k of Object.keys(TESTS)) console.log(k, JSON.stringify({ IS: { n: res[k].IS.n, net: res[k].IS.netR, gross: res[k].IS.grossR, t: res[k].IS.t }, OOS: { n: res[k].OOS.n, net: res[k].OOS.netR, gross: res[k].OOS.grossR, t: res[k].OOS.t, gt: res[k].OOS.grossT, n2: res[k].OOS.net2R } }), dec[k].pHolm, 'pl95', res[k].placebo.p95);
}
