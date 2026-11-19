// Edge research · gold-london-displacement: one large, decisive M15 candle in gold's first London hour (08:00-08:59 London),
// followed at the next M15 open into New York, as fixed in PREREGISTRATION.md. A stand-alone intraday rule, never a gate, exit,
// entry or size of the live gold book. Pure pieces are exported for tests/gold-london-displacement.test.mjs. The only import from
// the repository is the financing rule of council/fills.mjs (read only).
//   node research/edge/gold-london-displacement/run.mjs <file xau-5m.json.gz>   (writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FIN, nights } from '../../../council/fills.mjs';

export const COST = 0.60;                          // $ a round trip per ounce, spread + slippage together
export const K_ATR = 2.0, BODY = 0.6, ATR_N = 96, EXIT = 17 * 60, NEED = 60, TGT2 = 2;
export const TESTS = {
  T1: { name: 'Displacement followed, out at 17:00 UTC', tgt: 0 },
  T2: { name: 'T1 with a 2R target', tgt: TGT2 },
  T3: { name: 'T1 when the candle closes beyond the Asian range', tgt: 0, asia: true },
};
export const WINDOWS = { IS: ['2007-01-01', '2016-12-31'], OOS: ['2017-01-01', '2026-10-31'] };
export const HALVES = { H1: ['2017-01-01', '2021-12-31'], H2: ['2022-01-01', '2026-10-31'] };
export const SEEDS = 40;

// ─── British Summer Time: last Sunday of March → last Sunday of October (weekdays only are traded) ───
const lastSunday = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - d.getUTCDay(); };
export function bst(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  if (m < 3 || m > 10) return false;
  if (m > 3 && m < 10) return true;
  const ls = lastSunday(y, m - 1);
  return m === 3 ? d >= ls : d < ls;
}
export const londonHour = (ymd) => (bst(ymd) ? 7 : 8);   // the UTC hour of London 08:00-08:59
export const weekday = (ymd) => { const w = new Date(Date.parse(ymd + 'T00:00:00Z')).getUTCDay(); return w >= 1 && w <= 5; };

// ─── M15 series from M5 rows ([unixSec, o, h, l, c]); a candle needs all three M5 candles. atr = mean TR of the ATR_N before ───
export function m15Series(rows) {
  const out = [];
  for (let i = 0; i < rows.length;) {
    const q = Math.floor(rows[i][0] / 900) * 900; let j = i;
    while (j < rows.length && Math.floor(rows[j][0] / 900) * 900 === q) j++;
    if (j - i === 3) {
      let h = -Infinity, l = Infinity; for (let k = i; k < j; k++) { h = Math.max(h, rows[k][2]); l = Math.min(l, rows[k][3]); }
      out.push({ t: q, o: rows[i][1], h, l, c: rows[j - 1][4] });
    }
    i = j;
  }
  let sum = 0; const tr = [];
  for (let i = 0; i < out.length; i++) {
    const b = out[i], pc = i ? out[i - 1].c : b.o;
    tr.push(Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc)));
    b.atr = i >= ATR_N ? sum / ATR_N : null;          // the ATR_N candles BEFORE this one, never itself
    sum += tr[i]; if (i >= ATR_N) sum -= tr[i - ATR_N];
  }
  return out;
}

// the signal of one day: the first London-hour M15 candle with range >= K x ATR and body >= BODY x range
export function displacement(m15day, lh, { k = K_ATR, body = BODY } = {}) {
  for (const b of m15day) {
    const min = (b.t % 86400) / 60;
    if (min < lh * 60 || min >= lh * 60 + 60 || !(b.atr > 0)) continue;
    const rg = b.h - b.l, bd = b.c - b.o;
    if (rg >= k * b.atr && Math.abs(bd) >= body * rg && bd !== 0) return { ...b, side: Math.sign(bd), min };
  }
  return null;
}

// manage from post[0] (the entry candle, entered at its open); stop first, a gap through the stop fills at the open
export function manage(post, side, stop, target) {
  for (let i = 0; i < post.length; i++) {
    const b = post[i];
    if (i > 0 && side * (b.o - stop) <= 0) return { exit: b.o, how: 'stop', t: b.t };
    if (side > 0 ? b.l <= stop : b.h >= stop) return { exit: stop, how: 'stop', t: b.t };
    if (target != null && (side > 0 ? b.h >= target : b.l <= target)) return { exit: target, how: 'target', t: b.t };
  }
  const b = post.at(-1); return { exit: b.c, how: 'time', t: b.t + 300 };
}
// one trade: market at the open of the first M5 candle at or after `entryMin`, stop `dist` away (or at `stop`), out at EXIT
export function trade(bars, { entryMin, side, dist, stop, tgt = 0, cost = COST }) {
  const post = []; for (const b of bars) if (b.min >= entryMin && b.min < EXIT) post.push(b);
  if (post.length < NEED) return null;
  const entry = post[0].o, st = stop != null ? stop : entry - side * dist, r = side * (entry - st);
  if (!(r > 0)) return null;
  const target = tgt ? entry + side * tgt * r : null, x = manage(post, side, st, target);
  const R = side * (x.exit - entry) / r, fin = side > 0 ? nights(post[0].t, x.t) * FIN.xau.long * entry / r : 0;
  return { entry, stop: st, r, exit: x.exit, how: x.how, R, fin, net: R - cost / r - fin, net2: R - 2 * cost / r - fin };
}

export function asiaRange(bars, lh) {
  let h = -Infinity, l = Infinity, n = 0; for (const b of bars) if (b.min < lh * 60) { h = Math.max(h, b.h); l = Math.min(l, b.l); n++; }
  return n >= 12 ? { h, l } : null;
}

// ─── preparation: days with their M5 candles and M15 candles ───
export function prepare(rows) {
  const m15 = m15Series(rows), atrAt = new Map(m15.map((b) => [b.t, b.atr])), cal = new Map();
  for (const r of rows) {
    const d = new Date(r[0] * 1000), ymd = d.toISOString().slice(0, 10);
    if (!cal.has(ymd)) cal.set(ymd, { m5: [], m15: [] });
    cal.get(ymd).m5.push({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], min: d.getUTCHours() * 60 + d.getUTCMinutes() });
  }
  for (const b of m15) { const ymd = new Date(b.t * 1000).toISOString().slice(0, 10); if (cal.has(ymd)) cal.get(ymd).m15.push(b); }
  const days = [];
  for (const D of [...cal.keys()].sort()) if (D >= WINDOWS.IS[0] && D <= WINDOWS.OOS[1] && weekday(D)) days.push({ day: D, lh: londonHour(D), ...cal.get(D), t0: Date.parse(D + 'T00:00:00Z') / 1000 });
  return { days, atrAt };
}
export const inW = (day, [a, b]) => day >= a && day <= b;
export function signalTrade(d, test) {
  const s = displacement(d.m15, d.lh);
  if (!s) return { skip: 'nosignal' };
  if (test.asia) { const a = asiaRange(d.m5, d.lh); if (!a) return { skip: 'noasia' }; if (!(s.side > 0 ? s.c > a.h : s.c < a.l)) return { skip: 'inside' }; }
  const entryMin = s.min + 15, stop = s.side > 0 ? s.l : s.h, x = trade(d.m5, { entryMin, side: s.side, stop, tgt: test.tgt });
  if (!x) return { skip: 'missing' };
  return { day: d.day, side: s.side, entryMin, atr: s.atr, kStop: x.r / s.atr, sigRange: s.h - s.l, ...x };
}
export function runTest(days, test) {
  const tr = [], skips = {};
  for (const d of days) { const x = signalTrade(d, test); if (x.skip) skips[x.skip] = (skips[x.skip] || 0) + 1; else tr.push(x); }
  return { tr, skips };
}
// the same side on another day, at the same UTC minute, stop = the same multiple of that day's ATR (the M15 candle before entry)
export function shifted(d, x, tgt, atrAt) {
  const atr = atrAt.get(d.t0 + (x.entryMin - 15) * 60);
  if (!(atr > 0)) return null;
  return trade(d.m5, { entryMin: x.entryMin, side: x.side, dist: x.kStop * atr, tgt });
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
  const bl = tr.filter((x) => Number.isFinite(x.base));
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), netR: r3(mean(net)), grossR: r3(mean(tr.map((x) => x.R))),
    net2R: r3(mean(tr.map((x) => x.net2))), costR: r3(mean(tr.map((x) => x.R - x.net))), finR: r3(mean(tr.map((x) => x.fin))), total: r2(net.reduce((s, v) => s + v, 0)),
    months: mt.months, t: r2(mt.t), grossT: r2(gt.t), t2x: r2(t2.t), stops: tr.filter((x) => x.how === 'stop').length,
    targets: tr.filter((x) => x.how === 'target').length, time: tr.filter((x) => x.how === 'time').length, maxDD: r2(dd),
    medianStop: rs.length ? r2(rs[Math.floor(rs.length / 2)]) : null, medianK: r2(quantile(tr.map((x) => x.kStop), 0.5)),
    baseR: r3(mean(bl.map((x) => x.base))), lift: r3(mean(bl.map((x) => x.net - x.base))), buys: side(1), sells: side(-1), byYear };
}
// baseline value of each trade: the mean net R of the same trade on every other weekday of its window (memoised per key)
export function baseline(days, trades, tgt, atrAt) {
  const memo = new Map();
  for (const x of trades) {
    const w = inW(x.day, WINDOWS.IS) ? WINDOWS.IS : WINDOWS.OOS, key = [w[0], x.side, x.entryMin, r3(x.kStop)].join('|');
    if (!memo.has(key)) {
      const v = []; for (const d of days) if (inW(d.day, w) && d.day !== x.day) { const y = shifted(d, x, tgt, atrAt); if (y) v.push(y.net); }
      memo.set(key, mean(v));
    }
    x.base = memo.get(key);
  }
}
export function placebo(days, trades, tgt, atrAt, seeds = SEEDS) {
  const oosDays = days.filter((d) => inW(d.day, WINDOWS.OOS)), oos = trades.filter((x) => inW(x.day, WINDOWS.OOS)), out = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = rng(seed), v = [];
    for (const x of oos) {
      let d; do d = oosDays[Math.floor(rand() * oosDays.length)]; while (d.day === x.day);
      const y = shifted(d, x, tgt, atrAt); if (y) v.push(y.net);
    }
    out.push(r3(mean(v)));
  }
  return out;
}
export function decide(res, pl) {
  const ks = Object.keys(TESTS), ps = ks.map((k) => normP(res[k].OOS.t)), adj = holm(ps), d = {};
  ks.forEach((k, i) => {
    const o = res[k].OOS, beaten = pl[k].filter((m) => o.netR > m).length;
    const checks = { netPos: o.netR > 0, t2: o.t >= 2, holm: adj[i] < 0.05, isPos: res[k].IS.netR > 0, cost2x: o.net2R > 0, lift: o.lift > 0, placebo: beaten >= 38, n30: o.n >= 30 };
    d[k] = { p: r3(ps[i]), pHolm: r3(adj[i]), beaten, checks, pass: Object.values(checks).every(Boolean) };
  });
  return d;
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(res, dec) {
  const n = Object.values(dec).filter((x) => x.pass).length, o = res.T1.OOS;
  return `${n ? 'PASS' : 'FAIL'}, ${n} of 3: gold London M15 displacement followed to 17:00 UTC, 2017-26 ${sg(o.netR)}R a trade net (n ${o.n}, month t ${s2(o.t)}, lift ${sg(o.lift)}R); 2007-16 ${sg(res.T1.IS.netR)}R`;
}
const PER = { IS: '2007-2016', OOS: '2017 → 2026-10', H1: '2017-2021', H2: '2022 → 2026-10' };
export function report(R) {
  const L = [], T = R.tests, yn = (b) => (b ? 'yes' : 'no');
  L.push('# Gold: a large M15 candle in the first London hour, followed into New York', '');
  L.push('Paper research only. A new stand-alone intraday rule, **not a gate, exit, entry or size of the live gold book** (owner decision 44: none of the book\'s records read). Nothing live changed, no proposal. The rule, costs, windows, baseline, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## Tests (R of the actual stop distance; t on calendar-month sums of net R)', '');
  L.push('| Test | Rule | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Same-side baseline R | Lift R | Total R | t (months) | Gross t | Stops / targets / time | Max DD R | Median stop $ |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) for (const w of ['IS', 'OOS', 'H1', 'H2']) {
    const x = T[k][w];
    L.push(`| ${k} | ${T[k].name} | ${PER[w]} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.costR)} | ${sg(x.baseR)} | ${sg(x.lift)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${x.stops} / ${x.targets} / ${x.time} | ${s2(x.maxDD)} | ${x.medianStop} |`);
  }
  L.push('', '## Decision (out of sample, Holm over the three tests)', '');
  L.push('| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | 2007-16 > 0 | 2x cost > 0 | lift > 0 | placebos beaten (need 38 of 40) | n ≥ 30 | pass |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, d] of Object.entries(R.decision)) { const c = d.checks; L.push(`| ${k} | ${d.p} | ${d.pHolm} | ${yn(c.netPos)} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.isPos)} | ${yn(c.cost2x)} | ${yn(c.lift)} | ${d.beaten} | ${yn(c.n30)} | **${d.pass ? 'pass' : 'fail'}** |`); }
  L.push('', `**Placebo** (each out-of-sample trade moved to a random other weekday of 2017-26: same side, same UTC entry minute, stop at the same multiple of that day's ATR, the test's exit and costs; ${R.placebo.seeds} seeds):`, '');
  for (const k of Object.keys(T)) { const p = R.placebo[k]; L.push(`- ${k}: seed means ${sg(p.min)} to ${sg(p.max)}R a trade, median ${sg(p.median)}, 95th percentile ${sg(p.p95)}R.`); }
  L.push('', '## Sides and skipped days', '');
  for (const k of Object.keys(T)) { const o = T[k].OOS; L.push(`- ${k}, 2017 → 2026-10: buys n ${o.buys.n} ${sg(o.buys.netR)}R, sells n ${o.sells.n} ${sg(o.sells.netR)}R; median stop ${o.medianK} x ATR; financing ${sg(o.finR)}R a trade; days without a trade, whole period: ${Object.entries(T[k].skips).map(([a, b]) => `${a} ${b}`).join(', ') || 'none'}.`); }
  L.push('', '## By year (net R a trade, n)', '');
  const ys = [...new Set(Object.values(T).flatMap((x) => [...Object.keys(x.IS.byYear), ...Object.keys(x.OOS.byYear)]))].sort();
  L.push('| Year | ' + Object.keys(T).join(' | ') + ' |', '|---|' + Object.keys(T).map(() => '---|').join(''));
  for (const y of ys) L.push(`| ${y} | ` + Object.keys(T).map((k) => { const b = T[k].IS.byYear[y] || T[k].OOS.byYear[y]; return b ? `${sg(b.netR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- ${R.data}`);
  L.push(`- Rule: ${R.rule}`);
  L.push(`- Costs: $${R.cost.toFixed(2)} a round trip per ounce (spread and slippage), 2x reported; financing \`nights\` x \`FIN.xau.long\` on buys from \`council/fills.mjs\` (0 here: every trade is out by 17:00 UTC, before the 22:00 UTC rollover).`);
  L.push('- To repeat: `node research/edge/gold-london-displacement/run.mjs <xau-5m.json.gz>` (OANDA mid M5 XAU/USD as `[unixSec, o, h, l, c]` rows, kept out of git).');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = process.argv[2]; if (!file) throw new Error('usage: node run.mjs <xau-5m.json.gz>');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
  const { days, atrAt } = prepare(rows), res = {}, pl = {};
  for (const [k, t] of Object.entries(TESTS)) {
    const { tr, skips } = runTest(days, t);
    baseline(days, tr, t.tgt, atrAt);
    const f = (w) => summary(tr.filter((x) => inW(x.day, w)));
    res[k] = { name: t.name, skips, IS: f(WINDOWS.IS), OOS: f(WINDOWS.OOS), H1: f(HALVES.H1), H2: f(HALVES.H2) };
    pl[k] = placebo(days, tr, t.tgt, atrAt);
    console.error(k, 'done');
  }
  const dec = decide(res, pl);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const o = res.T1.OOS, fail = (k) => Object.entries(dec[k].checks).filter(([, v]) => !v).map(([c]) => c).join(', ');
  const line = (k) => `${k} ${sg(res[k].OOS.netR)}R (n ${res[k].OOS.n}, t ${s2(res[k].OOS.t)}, gross ${sg(res[k].OOS.grossR)}R, baseline ${sg(res[k].OOS.baseR)}R, lift ${sg(res[k].OOS.lift)}R; 2007-16 ${sg(res[k].IS.netR)}R; ${dec[k].pass ? 'passes' : `failed: ${fail(k)}`})`;
  const any = Object.values(dec).some((d) => d.pass);
  const reading = (any ? 'At least one test passes every pre-registered check. Paper research only; at most a proposal for the owner, with its own forward record. ' : 'No test passes the pre-registered bar. ')
    + `Out of sample: ${line('T1')}; ${line('T2')}; ${line('T3')}. Costs take ${sg(o.costR).replace('+', '')}R a trade on T1 at a median stop of $${o.medianStop} (${o.medianK} x the M15 ATR). `
    + `The same-side baseline (the same trade on every other weekday) is the yardstick: gold's 2017-26 rise lifts buys on any day, so a positive net alone is not evidence. `
    + `Placebo seeds beaten: T1 ${dec.T1.beaten}, T2 ${dec.T2.beaten}, T3 ${dec.T3.beaten} of 40. `
    + (any ? '' : 'Not an edge; nothing live changes and no proposal is written.');
  const result = { study: 'gold-london-displacement', built: '2026-11-14', preregistration: 'research/edge/gold-london-displacement/PREREGISTRATION.md', planSha256: sha,
    system: 'stand-alone gold intraday rule (not the live book)',
    claim: 'one large, decisive M15 candle in gold\'s first London hour is followed by more of the same move into the New York morning',
    rule: 'first M15 candle of 08:00-08:59 London (07:00 UTC in British Summer Time, else 08:00 UTC) with range >= 2.0 x the mean true range of the 96 M15 candles before it and body >= 0.6 x its range; side = its colour; market at the next M15 open; stop at the candle\'s opposite extreme; T1 out at 17:00 UTC; T2 a 2R target else 17:00; T3 = T1 when the candle closes beyond the Asian range (00:00 UTC to the London hour); stop first, a gap through the stop fills at the open; one trade a day',
    data: `OANDA mid XAU/USD M5 (keyless candle proxy), ${days.length} weekdays ${days[0].day} → ${days.at(-1).day}, UTC; M15 built from complete triples of M5`,
    cost: COST, financing: { rate: FIN.xau.long, src: FIN.xau.src }, windows: WINDOWS, halves: HALVES, verdict: verdictLine(res, dec), decision: dec, tests: res,
    placebo: { seeds: SEEDS, how: 'random other OOS weekday, same side, entry minute, ATR-multiple stop and exit', ...Object.fromEntries(Object.keys(TESTS).map((k) => [k, { means: pl[k], min: Math.min(...pl[k]), max: Math.max(...pl[k]), median: r3(quantile(pl[k], 0.5)), p95: r3(quantile(pl[k], 0.95)) }])) },
    reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict);
  for (const k of Object.keys(TESTS)) console.log(k, JSON.stringify({ IS: [res[k].IS.n, res[k].IS.netR, res[k].IS.grossR, res[k].IS.t, res[k].IS.baseR], OOS: [res[k].OOS.n, res[k].OOS.netR, res[k].OOS.grossR, res[k].OOS.t, res[k].OOS.grossT, res[k].OOS.net2R, res[k].OOS.baseR, res[k].OOS.lift], H: [res[k].H1.netR, res[k].H2.netR] }), dec[k].pHolm, dec[k].beaten, res[k].skips);
}
