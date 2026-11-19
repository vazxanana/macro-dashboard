// Edge research · gold-pdhl-break: an M15 close beyond the previous UTC day's high (low) on spot gold between 07:00 and 17:00
// UTC, held as a continuation, as fixed in PREREGISTRATION.md. Pure pieces are exported for tests/gold-pdhl-break.test.mjs.
// Only council/fills.mjs (foldWeekend, nights, FIN) is imported, read only.
//   node research/edge/gold-pdhl-break/run.mjs <path to xau-5m-vol.json.gz>   (writes result.json and RESULT.md)
// The candle cache (OANDA mid M5 through the keyless candle proxy) is kept out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const COST = 0.60;                                   // $ a round trip per ounce
export const STOP_ATR = 0.25, TARGET_R = 1.5, N = 20;
export const WIN = { from: 7 * 3600, to: 17 * 3600 }, EXIT = 20 * 3600;   // seconds after 00:00 UTC
export const WINDOWS = { IS: ['2016-01-01', '2020-12-31'], OOS: ['2021-01-01', '2026-11-13'] };
export const TESTS = { T1: 'no target, out at 20:00 UTC', T2: 'target 1.5R, else out at 20:00 UTC', T3: 'T1 on the side of the 20-day average' };
export const SEEDS = 40, PLACEBO_NEED = 38, MIN_N = 30;
const DAY = 86400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// ─── candles ───
// rows [t,o,h,l,c,(v)] → { days: Map dayStart → M5 candles {t,o,h,l,c}, d1: folded D1 [{time,open,high,low,close}] }
export function build(rows) {
  const days = new Map();
  for (const r of rows) {
    const d = Math.floor(r[0] / DAY) * DAY;
    if (!days.has(d)) days.set(d, []);
    days.get(d).push({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4] });
  }
  const keys = [...days.keys()].sort((a, b) => a - b);
  for (const k of keys) days.get(k).sort((a, b) => a.t - b.t);
  const raw = keys.map((k) => { const a = days.get(k); return { time: k, open: a[0].o, high: Math.max(...a.map((b) => b.h)), low: Math.min(...a.map((b) => b.l)), close: a.at(-1).c }; });
  return { days, d1: foldWeekend(raw) };
}
// the previous day's levels for day D, from folded D1 candles strictly before D; null without 21 earlier candles
export function levels(d1, D) {
  let i = d1.length - 1; while (i >= 0 && d1[i].time >= D) i--;
  if (i < N) return null;                                    // 20 true ranges need 21 candles
  let tr = 0, cs = 0;
  for (let j = i - N + 1; j <= i; j++) { const p = d1[j - 1].close, x = d1[j]; tr += Math.max(x.high, p) - Math.min(x.low, p); cs += x.close; }
  const prev = d1[i];
  return { pdh: prev.high, pdl: prev.low, close: prev.close, atr: tr / N, sma: cs / N, prevDay: prev.time };
}
// M15 candles of one day's M5 candles whose start lies in [from, to) seconds after D
export function m15(bars, D, from = WIN.from, to = WIN.to) {
  const out = [];
  for (const b of bars) {
    const s = D + Math.floor((b.t - D) / 900) * 900;
    if (s < D + from || s >= D + to) continue;
    const q = out.at(-1);
    if (q && q.t === s) { q.h = Math.max(q.h, b.h); q.l = Math.min(q.l, b.l); q.c = b.c; } else out.push({ t: s, o: b.o, h: b.h, l: b.l, c: b.c });
  }
  return out;
}
// the first close beyond PDH (buy, side 1) and PDL (sell, side -1): [{ side, at (trigger candle start), end }]
export function triggers(q, L) {
  const out = [];
  const b = q.find((x) => x.c > L.pdh), s = q.find((x) => x.c < L.pdl);
  if (b) out.push({ side: 1, at: b.t, end: b.t + 900 });
  if (s) out.push({ side: -1, at: s.t, end: s.t + 900 });
  return out.sort((x, y) => x.end - y.end);
}
// the entry M5 index: the first candle at or after `end`, before 20:00 of D
export function entryIndex(bars, D, end) {
  const k = bars.findIndex((b) => b.t >= end);
  return k >= 0 && bars[k].t < D + EXIT ? k : null;
}
export const stopOf = (side, L) => (side > 0 ? L.pdh - STOP_ATR * L.atr : L.pdl + STOP_ATR * L.atr);

// one trade on M5: market at bars[k].o, stop first, target at its price, out at 20:00 UTC (close of the last candle before it)
export function trade(bars, D, k, side, stop, tgtR = null, cost = COST) {
  const e = bars[k]; if (!e) return { skip: 'entry' };
  const entry = e.o, r = side * (entry - stop);
  if (!(r > 0)) return { skip: 'stopside' };
  const target = tgtR ? entry + side * tgtR * r : null;
  let exit = null, how = null, at = e.t;
  for (let i = k; i < bars.length && bars[i].t < D + EXIT; i++) {
    const b = bars[i]; at = b.t;
    if (i > k && side * (b.o - stop) <= 0) { exit = b.o; how = 'stop'; break; }
    if (side > 0 ? b.l <= stop : b.h >= stop) { exit = stop; how = 'stop'; break; }
    if (target != null && (side > 0 ? b.h >= target : b.l <= target)) { exit = target; how = 'target'; break; }
    exit = b.c;                                                // the close so far; a time exit keeps the last one
  }
  if (how == null) how = 'time';
  const R = side * (exit - entry) / r;
  const fin = side > 0 ? nights(e.t, at + 300) * FIN.xau.long * entry / r : 0;
  return { side, t: e.t, entry, stop, r, target, exit, how, end: at + 300, R, fin, net: R - cost / r - fin, net2: R - 2 * cost / r - 2 * fin };
}

// ─── the run ───
const inW = (day, [a, b]) => day >= a && day <= b;
export function prepare(B) {
  const out = [], skips = {};
  for (const [D, bars] of [...B.days.entries()].sort((a, b) => a[0] - b[0])) {
    const day = ymd(D), wd = new Date(D * 1000).getUTCDay();
    if (day < WINDOWS.IS[0] || day > WINDOWS.OOS[1] || wd === 0 || wd === 6) continue;
    const q = m15(bars, D);
    if (!q.length) { skips.window = (skips.window || 0) + 1; continue; }
    const L = levels(B.d1, D);
    if (!L) { skips.history = (skips.history || 0) + 1; continue; }
    out.push({ D, day, bars, q, L });
  }
  return { days: out, skips };
}
// a test's trades: one position at a time, a trigger whose entry falls while a position is open is dropped
export function runTest(days, test) {
  const tr = [], f = { triggers: 0, busy: 0, late: 0, trend: 0, stopside: 0 };
  let busy = -Infinity;
  for (const d of days) {
    for (const g of triggers(d.q, d.L)) {
      f.triggers++;
      if (test === 'T3' && !(g.side > 0 ? d.L.close > d.L.sma : d.L.close < d.L.sma)) { f.trend++; continue; }
      const k = entryIndex(d.bars, d.D, g.end);
      if (k == null) { f.late++; continue; }
      if (d.bars[k].t < busy) { f.busy++; continue; }
      const x = trade(d.bars, d.D, k, g.side, stopOf(g.side, d.L), test === 'T2' ? TARGET_R : null);
      if (x.skip) { f[x.skip]++; continue; }
      busy = x.end; tr.push({ day: d.day, ...x });
    }
  }
  return { tr, f };
}

// ─── statistics ───
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
export function monthsOf([a, b]) { const out = []; let y = +a.slice(0, 4), m = +a.slice(5, 7); const end = b.slice(0, 7); for (;;) { const k = `${y}-${String(m).padStart(2, '0')}`; out.push(k); if (k >= end) break; if (++m > 12) { m = 1; y++; } } return out; }
// t on calendar-month sums, every month of the window counted (0 when no trade)
export function monthT(trades, win, key = 'net') {
  const by = new Map(monthsOf(win).map((k) => [k, 0]));
  for (const x of trades) { const k = x.day.slice(0, 7); if (by.has(k)) by.set(k, by.get(k) + x[key]); }
  const v = [...by.values()], s = sdv(v);
  return { months: v.length, t: v.length > 1 && s > 0 ? mean(v) / (s / Math.sqrt(v.length)) : 0 };
}
export function normP(t) {
  const z = t / Math.SQRT2, a = Math.abs(z), k = 1 / (1 + 0.3275911 * a);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-a * a);
  return 0.5 * (1 - (z >= 0 ? erf : -erf));
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; });
  return out;
}
export function quantile(v, q) { const s = [...v].sort((a, b) => a - b), i = q * (s.length - 1), lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); }
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
export function summary(tr, win) {
  const net = tr.map((x) => x.net), mt = monthT(tr, win), gt = monthT(tr, win, 'R'), t2 = monthT(tr, win, 'net2');
  let eq = 0, pk = 0, dd = 0; for (const v of net) { eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const byYear = {}; for (const x of tr) { const y = x.day.slice(0, 4); (byYear[y] ||= { n: 0, net: 0 }); byYear[y].n++; byYear[y].net += x.net; }
  for (const y in byYear) byYear[y] = { n: byYear[y].n, netR: r3(byYear[y].net / byYear[y].n), total: r2(byYear[y].net) };
  const rs = tr.map((x) => x.r).sort((a, b) => a - b), side = (s) => { const a = tr.filter((x) => x.side === s); return { n: a.length, netR: r3(mean(a.map((x) => x.net))) }; };
  const cnt = (h) => tr.filter((x) => x.how === h).length;
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), netR: r3(mean(net)), grossR: r3(mean(tr.map((x) => x.R))),
    net2R: r3(mean(tr.map((x) => x.net2))), costR: r3(mean(tr.map((x) => x.R - x.net))), finR: r3(mean(tr.map((x) => x.fin))), total: r2(net.reduce((s, v) => s + v, 0)),
    months: mt.months, t: r2(mt.t), tRaw: mt.t, grossT: r2(gt.t), t2x: r2(t2.t), stops: cnt('stop'), targets: cnt('target'), time: cnt('time'),
    maxDD: r2(dd), medianStop: rs.length ? r2(rs[Math.floor(rs.length / 2)]) : null, buys: side(1), sells: side(-1), byYear };
}
// placebo: per real OOS trade a random OOS day, a random M15 start 07:00-16:45 that day, a random side, the real stop distance
export function placebo(oosDays, real, test, seeds = SEEDS) {
  const out = [];
  if (!real.length || !oosDays.length) return out;
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = rng(seed * 7919 + test.charCodeAt(1)), nets = [];
    for (const x of real) {
      let y = null;
      for (let tries = 0; tries < 50 && !y; tries++) {
        const d = oosDays[Math.floor(rand() * oosDays.length)], q = d.q[Math.floor(rand() * d.q.length)], s = rand() < 0.5 ? -1 : 1;
        const k = entryIndex(d.bars, d.D, q.t + 900);
        if (k == null) continue;
        const z = trade(d.bars, d.D, k, s, d.bars[k].o - s * x.r, test === 'T2' ? TARGET_R : null);
        if (!z.skip) y = z;
      }
      if (y) nets.push(y.net);
    }
    out.push(r3(mean(nets)));
  }
  return out;
}
export function decide(res) {
  const ks = Object.keys(TESTS), ps = ks.map((k) => normP(res[k].OOS.tRaw)), adj = holm(ps), d = {};
  ks.forEach((k, i) => {
    const o = res[k].OOS, is = res[k].IS, beat = res[k].placebo.means.filter((m) => o.netR > m).length;
    const checks = { netPos: o.netR > 0, t2: o.tRaw >= 2, holm: adj[i] < 0.05, isPos: is.netR > 0, cost2x: o.net2R > 0, placebo: beat >= PLACEBO_NEED, n30: o.n >= MIN_N };
    d[k] = { p: r3(ps[i]), pHolm: r3(adj[i]), beat, checks, pass: Object.values(checks).every(Boolean) };
  });
  return d;
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(res, dec) {
  const pass = Object.keys(dec).filter((k) => dec[k].pass), o = res.T1.OOS, i = res.T1.IS;
  return `${pass.length ? 'PASS' : 'FAIL'}, ${pass.length} of 3: buying / selling an M15 close beyond the previous day's high / low, 2021 → now ${sg(o.netR)}R a trade net (n ${o.n}, month t ${s2(o.t)}); 2016-20 ${sg(i.netR)}R (n ${i.n})`;
}
export function report(R) {
  const L = [], T = R.tests, yn = (b) => (b ? 'yes' : 'no');
  L.push('# Gold: an M15 close beyond the previous day\'s high or low, held as a continuation', '');
  L.push('Paper research only. A new stand-alone intraday rule on spot gold, **not a gate, exit, entry or size of the live gold book** (item 44; none of the book\'s records opened). Nothing live changed, no proposal. The rule, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). The opposite question to `mmxm-pdhl-raid-gold` (a fade of the raid). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## Tests (R of the stop distance; t on calendar-month sums of net R, every month of the window counted)', '');
  L.push('| Test | Rule | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | Stops / targets / time | Max DD R | Median stop $ |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) for (const w of ['IS', 'OOS']) {
    const x = T[k][w];
    L.push(`| ${k} | ${T[k].name} | ${w === 'IS' ? '2016-2020' : '2021 → 2026-11-13'} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.costR)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${x.stops} / ${x.targets} / ${x.time} | ${s2(x.maxDD)} | ${x.medianStop} |`);
  }
  L.push('', '## Decision (out of sample, Holm over the three tests)', '');
  L.push('| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | in sample > 0 | 2x cost > 0 | beats ≥ 38 of 40 placebos | n ≥ 30 | pass |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, d] of Object.entries(R.decision)) { const c = d.checks; L.push(`| ${k} | ${d.p} | ${d.pHolm} | ${yn(c.netPos)} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.isPos)} | ${yn(c.cost2x)} | ${yn(c.placebo)} (${d.beat}) | ${yn(c.n30)} | **${d.pass ? 'pass' : 'fail'}** |`); }
  L.push('', `**Placebo** (${SEEDS} seeds; per real out-of-sample trade a random out-of-sample day, a random M15 entry 07:00-16:45 UTC, a random side, the real stop distance, the test's own exit and costs):`, '');
  for (const k of Object.keys(T)) { const p = T[k].placebo; L.push(`- ${k}: seed means ${sg(p.min)} to ${sg(p.max)}R a trade, median ${sg(p.median)}; the rule ${sg(T[k].OOS.netR)}R beats ${R.decision[k].beat} of ${SEEDS}.`); }
  L.push('', '## Sides', '');
  for (const k of Object.keys(T)) L.push(`- ${k}, 2021 → now: buys n ${T[k].OOS.buys.n} ${sg(T[k].OOS.buys.netR)}R, sells n ${T[k].OOS.sells.n} ${sg(T[k].OOS.sells.netR)}R; 2016-20: buys n ${T[k].IS.buys.n} ${sg(T[k].IS.buys.netR)}R, sells n ${T[k].IS.sells.n} ${sg(T[k].IS.sells.netR)}R.`);
  L.push('', '## By year (net R a trade, n)', '');
  const ys = [...new Set(Object.values(T).flatMap((x) => [...Object.keys(x.IS.byYear), ...Object.keys(x.OOS.byYear)]))].sort();
  L.push('| Year | ' + Object.keys(T).join(' | ') + ' |', '|---|' + Object.keys(T).map(() => '---|').join(''));
  for (const y of ys) L.push(`| ${y} | ` + Object.keys(T).map((k) => { const b = T[k].IS.byYear[y] || T[k].OOS.byYear[y]; return b ? `${sg(b.netR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- ${R.data}`);
  L.push(`- Days: ${R.days.used} UTC weekdays with candles 07:00-17:00 and 21 earlier folded daily candles; skipped ${Object.entries(R.days.skips).map(([a, b]) => `${a} ${b}`).join(', ') || 'none'}.`);
  L.push(`- Funnel: ${Object.entries(R.funnel).map(([k, f]) => `${k} ${f.triggers} triggers, ${f.trend} against the 20-day average, ${f.late} with no entry before 20:00, ${f.busy} while a position was open, ${f.stopside} with the entry past the stop`).join('; ')}.`);
  L.push(`- Rule: ${R.rule}`);
  L.push(`- Costs: $${COST.toFixed(2)} a round trip per ounce on every trade; financing \`council/fills.mjs\` \`FIN.xau.long\` x \`nights\` on buys (mean ${sg(T.T1.OOS.finR)}R a trade: the 20:00 UTC exit is before the rollover); 2x reported.`);
  L.push('- To repeat: `node research/edge/gold-pdhl-break/run.mjs <path to xau-5m-vol.json.gz>` (OANDA mid M5 XAU/USD through the keyless candle proxy, kept out of git). Tests: `tests/gold-pdhl-break.test.mjs`.');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = process.argv[2]; if (!file) throw new Error('usage: node run.mjs <xau-5m-vol.json.gz>');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
  const B = build(rows), { days, skips } = prepare(B), oosDays = days.filter((d) => inW(d.day, WINDOWS.OOS)), res = {}, funnel = {};
  for (const [k, name] of Object.entries(TESTS)) {
    const { tr, f } = runTest(days, k), oos = tr.filter((x) => inW(x.day, WINDOWS.OOS)), pl = placebo(oosDays, oos, k);
    funnel[k] = f;
    res[k] = { name, IS: summary(tr.filter((x) => inW(x.day, WINDOWS.IS)), WINDOWS.IS), OOS: summary(oos, WINDOWS.OOS),
      placebo: { means: pl, min: Math.min(...pl), max: Math.max(...pl), median: r3(quantile(pl, 0.5)), p95: r3(quantile(pl, 0.95)) } };
  }
  const dec = decide(res), o = res.T1.OOS;
  for (const k of Object.keys(res)) for (const w of ['IS', 'OOS']) delete res[k][w].tRaw;
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const passed = Object.keys(dec).filter((k) => dec[k].pass);
  const failed = (k) => Object.entries(dec[k].checks).filter(([, v]) => !v).map(([c]) => c).join(', ');
  const reading = passed.length ? `${passed.join(', ')} passes every pre-registered check. A stand-alone rule, never a gate on the gold book; paper research only, any use is the owner's decision after a forward record.`
    : `No test passes the pre-registered bar (T1 failed: ${failed('T1')}; T2: ${failed('T2')}; T3: ${failed('T3')}). Out of sample the plain continuation makes ${sg(o.netR)}R a trade after $${COST.toFixed(2)} a round trip (n ${o.n}, month t ${s2(o.t)}; before costs ${sg(o.grossR)}R, t ${s2(o.grossT)}); with a 1.5R target ${sg(res.T2.OOS.netR)}R (n ${res.T2.OOS.n}, t ${s2(res.T2.OOS.t)}); on the side of the 20-day average ${sg(res.T3.OOS.netR)}R (n ${res.T3.OOS.n}, t ${s2(res.T3.OOS.t)}). Not an edge; nothing live changes and no proposal is written. A variant (another stop, window or target) would be a different rule and needs its own pre-registration.`;
  const result = { study: 'gold-pdhl-break', built: '2026-11-14', preregistration: 'research/edge/gold-pdhl-break/PREREGISTRATION.md', planSha256: sha,
    claim: 'when gold closes an M15 candle beyond the previous UTC day\'s high (low) in London or New York, the move continues for the rest of the day',
    rule: 'previous day = the last complete UTC daily candle, weekends folded (foldWeekend); first M15 close above PDH (buy) / below PDL (sell) of a candle starting 07:00-16:45 UTC, one per side per day; market at the next M15 open; stop PDH − 0.25 x ATR20(D1) (sell: PDL + 0.25 x ATR20); T1 out at 20:00 UTC; T2 target 1.5R else 20:00; T3 = T1 when the previous D1 close is on the trade\'s side of its 20-day average; one position at a time per test; walked on M5, stop first, a gap through the stop at the open',
    data: `OANDA mid XAU/USD M5 through the keyless candle proxy, ${new Date(rows[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10)} (${rows.length} candles); trade days ${days[0].day} → ${days.at(-1).day}; M15 and D1 built from M5`,
    cost: COST, windows: WINDOWS, days: { used: days.length, skips }, funnel, verdict: verdictLine(res, dec), decision: dec, tests: res, reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict, result.verdict.length);
  for (const k of Object.keys(TESTS)) console.log(k, JSON.stringify({ IS: { n: res[k].IS.n, net: res[k].IS.netR, gross: res[k].IS.grossR, t: res[k].IS.t }, OOS: { n: res[k].OOS.n, net: res[k].OOS.netR, gross: res[k].OOS.grossR, t: res[k].OOS.t, gt: res[k].OOS.grossT, n2: res[k].OOS.net2R } }), dec[k].pHolm, 'beat', dec[k].beat, JSON.stringify(funnel[k]));
}
