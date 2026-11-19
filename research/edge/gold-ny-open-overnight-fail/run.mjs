// Edge research · gold-ny-open-overnight-fail: the H1 candle that holds the US cash open (09:00-09:59 New York) trades through
// one end of gold's overnight range (18:00-09:00 New York) and closes back inside (fade to the middle), or closes beyond it
// (follow), on OANDA spot gold H1, as fixed in PREREGISTRATION.md. A stand-alone intraday rule, never a gate, exit, entry or
// size of the live gold book. Pure pieces are exported for tests/gold-ny-open-overnight-fail.test.mjs.
// Imports only `nights` / `FIN` from council/fills.mjs (financing on buys; zero by construction, checked).
//   node --use-env-proxy research/edge/gold-ny-open-overnight-fail/run.mjs fetch <xau-1h.json.gz>   (candles, keep out of git)
//   node research/edge/gold-ny-open-overnight-fail/run.mjs <xau-1h.json.gz>                         (writes result.json, RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { nights, FIN } from '../../../council/fills.mjs';

export const COST = 0.60, BUF = 0.30, MIN_ON = 10;
export const ON_FROM = 18, RAID_H = 9, ENTRY_H = 10, EXIT_H = 16;   // New York hours
export const TESTS = {
  T1: { name: 'fade the failed raid, target the overnight middle, out 16:00 NY', kind: 'fade', target: true },
  T2: { name: 'fade the failed raid, no target, out 16:00 NY', kind: 'fade', target: false },
  T3: { name: 'follow the accepted break, no target, out 16:00 NY', kind: 'follow', target: false },
};
export const WINDOWS = { IS: ['2007-01-01', '2016-12-31'], OOS: ['2017-01-01', '2026-10-31'] };
export const HALVES = { H1: ['2017-01-01', '2021-12-31'], H2: ['2022-01-01', '2026-10-31'] };
export const SEEDS = 40;

// ─── New York clock ───
const nthSunday = (y, m, n) => { const w = new Date(Date.UTC(y, m, 1)).getUTCDay(); return 1 + ((7 - w) % 7) + 7 * (n - 1); };
export function nyOffsetH(t) {
  const y = new Date(t * 1000).getUTCFullYear();
  const a = Date.UTC(y, 2, nthSunday(y, 2, 2), 7) / 1000, b = Date.UTC(y, 10, nthSunday(y, 10, 1), 6) / 1000;
  return t >= a && t < b ? -4 : -5;
}
// session day of an H1 candle: from 18:00 New York it belongs to the next calendar day
export function sessionOf(t) {
  const d = new Date((t + nyOffsetH(t) * 3600) * 1000), h = d.getUTCHours();
  const day = d.toISOString().slice(0, 10);
  const sd = h >= ON_FROM ? new Date(Date.parse(day) + 86400e3).toISOString().slice(0, 10) : day;
  return { sd, h };
}
export function groupSessions(rows) {
  const by = new Map();
  for (const r of rows) {
    const { sd, h } = sessionOf(r[0]);
    if (!by.has(sd)) by.set(sd, []);
    by.get(sd).push({ t: r[0], h, o: r[1], hi: r[2], lo: r[3], c: r[4] });
  }
  const out = [];
  for (const [day, bars] of by) {
    const wd = new Date(day + 'T00:00:00Z').getUTCDay();
    if (wd >= 1 && wd <= 5) out.push({ day, bars: bars.sort((a, b) => a.t - b.t) });
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : 1));
}

// the overnight range and the 09:00 candle of one session (null when the data is short)
export function setupOf(bars) {
  const on = bars.filter((b) => b.h >= ON_FROM || b.h < RAID_H), c9 = bars.find((b) => b.h === RAID_H);
  if (on.length < MIN_ON || !c9) return null;
  const H = Math.max(...on.map((b) => b.hi)), L = Math.min(...on.map((b) => b.lo));
  return { H, L, M: (H + L) / 2, c9 };
}
// the event of one session: 'fade' or 'follow' with its side, or null
export function eventOf(s) {
  if (!s) return null;
  const { H, L, c9 } = s, up = c9.hi > H, dn = c9.lo < L;
  if (up === dn) return null;                            // neither end, or both
  if (up) return c9.c < H ? { kind: 'fade', side: -1 } : { kind: 'follow', side: 1 };
  return c9.c > L ? { kind: 'fade', side: 1 } : { kind: 'follow', side: -1 };
}
// the 10:00-15:00 New York candles of the session (the window the trade lives in)
export const windowBars = (bars) => bars.filter((b) => b.h >= ENTRY_H && b.h < EXIT_H);

// manage from the first candle: a gap through the stop fills at the open, stop before target in one candle; out at the
// close of the last candle (= the 16:00 New York open)
export function manage(post, side, stop, target) {
  for (const b of post) {
    if (side * (b.o - stop) <= 0) return { exit: b.o, how: 'stop', t: b.t };
    if (side > 0 ? b.lo <= stop : b.hi >= stop) return { exit: stop, how: 'stop', t: b.t };
    if (target != null && (side > 0 ? b.hi >= target : b.lo <= target)) return { exit: target, how: 'target', t: b.t };
  }
  const z = post.at(-1);
  return { exit: z.c, how: 'time', t: z.t + 3600 };
}
const finR = (side, entry, r, t0, t1) => (side > 0 ? nights(t0, t1) * FIN.xau.long * entry / r : 0);
export function costed(side, entry, r, x, t0, cost = COST) {
  const R = side * (x.exit - entry) / r, fin = finR(side, entry, r, t0, x.t);
  return { R, fin, net: R - cost / r - fin, net2: R - 2 * cost / r - fin };
}

// ─── one session, one test ───
export function sessionTrade(bars, test, cost = COST) {
  const s = setupOf(bars);
  if (!s) return { skip: 'data' };
  const ev = eventOf(s);
  if (!ev || ev.kind !== test.kind) return { skip: 'noevent' };
  const post = windowBars(bars);
  if (!post.length || post[0].h !== ENTRY_H) return { skip: 'noentry' };
  const d = ev.side, entry = post[0].o, c9 = s.c9;
  const stop = test.kind === 'fade' ? (d < 0 ? c9.hi + BUF : c9.lo - BUF) : (d > 0 ? c9.lo - BUF : c9.hi + BUF);
  const r = d * (entry - stop);
  if (!(r > 0)) return { skip: 'paststop' };
  const target = test.target ? s.M : null;
  if (target != null && d * (target - entry) <= 0) return { skip: 'pastmid' };
  const x = manage(post, d, stop, target);
  return { side: d, H: s.H, L: s.L, M: s.M, entry, stop, target, r, tdist: target == null ? null : Math.abs(target - entry),
    exit: x.exit, how: x.how, ...costed(d, entry, r, x, post[0].t, cost) };
}
// the same-side trade on another session: 10:00 open, the same stop / target distance, out 16:00 NY
export function sameSideTrade(bars, { side, r, tdist }, cost = COST) {
  const post = windowBars(bars);
  if (!post.length || post[0].h !== ENTRY_H || !(r > 0)) return null;
  const entry = post[0].o, stop = entry - side * r, target = tdist == null ? null : entry + side * tdist;
  return costed(side, entry, r, manage(post, side, stop, target), post[0].t, cost);
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
  const net = tr.map((x) => x.net), mt = monthT(tr), gt = monthT(tr, 'R'), t2 = monthT(tr, 'net2'), lt = monthT(tr, 'lift');
  let eq = 0, pk = 0, dd = 0; for (const v of net) { eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const byYear = {}; for (const x of tr) { const y = x.day.slice(0, 4); (byYear[y] ||= { n: 0, net: 0 }); byYear[y].n++; byYear[y].net += x.net; }
  for (const y in byYear) byYear[y] = { n: byYear[y].n, netR: r3(byYear[y].net / byYear[y].n), total: r2(byYear[y].net) };
  const rs = tr.map((x) => x.r).sort((a, b) => a - b);
  const side = (s) => { const a = tr.filter((x) => x.side === s); return { n: a.length, netR: r3(mean(a.map((x) => x.net))), grossR: r3(mean(a.map((x) => x.R))), t: r2(monthT(a).t) }; };
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), netR: r3(mean(net)), grossR: r3(mean(tr.map((x) => x.R))),
    net2R: r3(mean(tr.map((x) => x.net2))), costR: r3(mean(tr.map((x) => x.R - x.net))), baseR: r3(mean(tr.map((x) => x.base))),
    liftR: r3(mean(tr.map((x) => x.lift))), liftT: r2(lt.t), total: r2(net.reduce((s, v) => s + v, 0)), months: mt.months,
    t: r2(mt.t), grossT: r2(gt.t), t2x: r2(t2.t), stops: tr.filter((x) => x.how === 'stop').length,
    targets: tr.filter((x) => x.how === 'target').length, time: tr.filter((x) => x.how === 'time').length,
    maxDD: r2(dd), medianStop: rs.length ? r2(rs[Math.floor(rs.length / 2)]) : null, buys: side(1), sells: side(-1), byYear };
}

// ─── the whole run ───
export const inW = (day, [a, b]) => day >= a && day <= b;
export function prepare(rows) {
  return groupSessions(rows).filter((s) => s.day >= WINDOWS.IS[0] && s.day <= WINDOWS.OOS[1]);
}
// eligible baseline sessions by year: a 10:00 NY candle exists
export function byYear(days) {
  const m = new Map();
  for (const d of days) { const w = windowBars(d.bars); if (!w.length || w[0].h !== ENTRY_H) continue; const y = d.day.slice(0, 4); if (!m.has(y)) m.set(y, []); m.get(y).push(d); }
  return m;
}
export function runTest(days, test, years) {
  const tr = [], skips = {};
  for (const d of days) {
    const x = sessionTrade(d.bars, test);
    if (x.skip) { skips[x.skip] = (skips[x.skip] || 0) + 1; continue; }
    const v = (years.get(d.day.slice(0, 4)) || []).map((o) => sameSideTrade(o.bars, x)).filter(Boolean).map((p) => p.net);
    const base = mean(v);
    tr.push({ day: d.day, ...x, base, lift: x.net - base });
  }
  return { tr, skips };
}
export function placebo(trades, years, seeds = SEEDS) {
  const oos = trades.filter((x) => inW(x.day, WINDOWS.OOS)), out = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = rng(seed), v = [];
    for (const x of oos) {
      const pool = years.get(x.day.slice(0, 4)) || [];
      if (!pool.length) continue;
      const p = sameSideTrade(pool[Math.floor(rand() * pool.length)].bars, x);
      if (p) v.push(p.net);
    }
    out.push(r3(mean(v)));
  }
  return out;
}
export function decide(res, pl) {
  const ks = Object.keys(TESTS), ps = ks.map((k) => normP(res[k].OOS.t)), adj = holm(ps), d = {};
  ks.forEach((k, i) => {
    const o = res[k].OOS, beaten = pl[k].filter((m) => o.netR > m).length;
    const checks = { netPos: o.netR > 0, t2: o.t >= 2, holm: adj[i] < 0.05, isPos: res[k].IS.netR > 0, cost2x: o.net2R > 0,
      lift: o.liftR > 0, placebo: beaten >= 38, n100: o.n >= 100 && res[k].IS.n >= 100 };
    d[k] = { p: r3(ps[i]), pHolm: r3(adj[i]), beaten, checks, pass: Object.values(checks).every(Boolean) };
  });
  return d;
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(res, dec) {
  const o = res.T1.OOS, pass = dec.T1.pass, n = Object.values(dec).filter((x) => x.pass).length;
  return `${pass ? 'PASS' : 'FAIL'}, ${n} of 3: fading gold's failed 09:00 NY raid of the overnight range to its middle, 2017-26 ${sg(o.netR)}R a trade net (n ${o.n}, month t ${s2(o.t)}, lift ${sg(o.liftR)}R); 2007-16 ${sg(res.T1.IS.netR)}R`;
}
const PER = { IS: '2007-2016', OOS: '2017 → 2026-10', H1: '2017-2021', H2: '2022 → 2026-10' };
export function report(R) {
  const L = [], T = R.tests, yn = (b) => (b ? 'yes' : 'no');
  L.push('# Gold: the US cash-open hour that raids the overnight range and fails back inside', '');
  L.push('Paper research only. A new stand-alone intraday rule, **not a gate, exit, entry or size of the live gold book** (owner decision 44: none of the book\'s records read). Nothing live changed, no proposal. The rule, costs, windows, baseline, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## Tests (R of the entry-to-stop distance; t on calendar-month sums of net R)', '');
  L.push('| Test | Rule | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Same-year baseline R | Lift R (t) | Total R | t (months) | Gross t | Stops / targets / time | Max DD R | Median stop $ |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) for (const w of ['IS', 'OOS', 'H1', 'H2']) {
    const x = T[k][w];
    L.push(`| ${k} | ${T[k].name} | ${PER[w]} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.costR)} | ${sg(x.baseR)} | ${sg(x.liftR)} (${s2(x.liftT)}) | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${x.stops} / ${x.targets} / ${x.time} | ${s2(x.maxDD)} | ${x.medianStop} |`);
  }
  L.push('', '## Decision (out of sample, Holm over the three tests; T1 is the primary test)', '');
  L.push('| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | 2007-16 > 0 | 2x cost > 0 | lift > 0 | placebos beaten (need 38 of 40) | n ≥ 100 both windows | pass |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, d] of Object.entries(R.decision)) { const c = d.checks; L.push(`| ${k} | ${d.p} | ${d.pHolm} | ${yn(c.netPos)} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.isPos)} | ${yn(c.cost2x)} | ${yn(c.lift)} | ${d.beaten} | ${yn(c.n100)} | **${d.pass ? 'pass' : 'fail'}** |`); }
  L.push('', `**Placebo** (each out-of-sample trade moved to a random eligible weekday of the same year: same side, stop and target distance, 10:00-16:00 New York, same cost; ${R.placebo.seeds} seeds):`, '');
  for (const k of Object.keys(T)) { const p = R.placebo[k]; L.push(`- ${k}: seed means ${sg(p.min)} to ${sg(p.max)}R a trade, median ${sg(p.median)}, 95th percentile ${sg(p.p95)}R.`); }
  L.push('', '## Buys and sells (net R a trade, n, month t)', '');
  L.push('| Test | Period | Buys | Sells |', '|---|---|---|---|');
  for (const k of Object.keys(T)) for (const w of ['IS', 'OOS']) { const x = T[k][w]; L.push(`| ${k} | ${PER[w]} | ${sg(x.buys.netR)} (n ${x.buys.n}, t ${s2(x.buys.t)}; gross ${sg(x.buys.grossR)}) | ${sg(x.sells.netR)} (n ${x.sells.n}, t ${s2(x.sells.t)}; gross ${sg(x.sells.grossR)}) |`); }
  L.push('', 'Sessions without a trade, whole period: ' + Object.keys(T).map((k) => `${k} ${Object.entries(T[k].skips).map(([a, b]) => `${a} ${b}`).join(', ')}`).join('; ') + '.', '');
  L.push('## By year (net R a trade, n)', '');
  const ys = [...new Set(Object.values(T).flatMap((x) => [...Object.keys(x.IS.byYear), ...Object.keys(x.OOS.byYear)]))].sort();
  L.push('| Year | ' + Object.keys(T).join(' | ') + ' |', '|---|' + Object.keys(T).map(() => '---|').join(''));
  for (const y of ys) L.push(`| ${y} | ` + Object.keys(T).map((k) => { const b = T[k].IS.byYear[y] || T[k].OOS.byYear[y]; return b ? `${sg(b.netR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- ${R.data}`);
  L.push(`- Rule: ${R.rule}`);
  L.push(`- Costs: $${R.cost.toFixed(2)} a round trip per ounce (spread and slippage), 2x reported; financing on buys by \`council/fills.mjs\` \`nights\` x \`FIN.xau.long\` (${R.fin.rate} of price a rollover): ${R.fin.note}`);
  L.push('- To repeat: `node --use-env-proxy research/edge/gold-ny-open-overnight-fail/run.mjs fetch <xau-1h.json.gz>` (OANDA mid H1, kept out of git), then `node research/edge/gold-ny-open-overnight-fail/run.mjs <xau-1h.json.gz>`.');
  return L.join('\n') + '\n';
}

// ─── fetch (OANDA mid H1 through the keyless candle proxy) ───
async function fetchH1(file) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
  const FROM = T('2006-06-01'), END = T('2026-11-01'), sec = 3600, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), m = new Map();
  for (let a = FROM; a < END;) {
    const b = Math.min(END, a + 4999 * sec); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=xau&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150);
  }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(rows)));
  console.log(`${rows.length} H1 candles`);
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv[2] === 'fetch') { await fetchH1(process.argv[3]); process.exit(0); }
  const file = process.argv[2]; if (!file) throw new Error('usage: node run.mjs <xau-1h.json.gz>');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
  const days = prepare(rows), years = byYear(days), res = {}, pl = {};
  let finSum = 0, finN = 0;
  for (const [k, t] of Object.entries(TESTS)) {
    const { tr, skips } = runTest(days, t, years), f = (w) => summary(tr.filter((x) => inW(x.day, w)));
    for (const x of tr) { finSum += x.fin; finN++; }
    res[k] = { name: t.name, skips, IS: f(WINDOWS.IS), OOS: f(WINDOWS.OOS), H1: f(HALVES.H1), H2: f(HALVES.H2) };
    pl[k] = placebo(tr, years);
  }
  if (finSum !== 0) throw new Error('a trade was charged financing: the 16:00 New York exit should be before every rollover');
  const dec = decide(res, pl);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const o = res.T1.OOS, fail = (k) => Object.entries(dec[k].checks).filter(([, v]) => !v).map(([c]) => c).join(', ');
  const line = (k) => `${k} ${sg(res[k].OOS.netR)}R (n ${res[k].OOS.n}, t ${s2(res[k].OOS.t)}, gross ${sg(res[k].OOS.grossR)}R, lift ${sg(res[k].OOS.liftR)}R; 2007-16 ${sg(res[k].IS.netR)}R; ${dec[k].pass ? 'passes' : `failed: ${fail(k)}`})`;
  const any = Object.values(dec).some((d) => d.pass);
  const reading = (dec.T1.pass ? 'The primary test passes every pre-registered check. Paper research only; at most a lead for the owner, to be replicated before anything else. '
    : any ? 'The primary test fails; a secondary test passes and is a lead to replicate only, not a pass of the study. ' : 'No test passes the pre-registered bar. ')
    + `Out of sample: ${line('T1')}; ${line('T2')}; ${line('T3')}. Costs take ${sg(o.costR).replace('+', '')}R a trade on T1 at a median stop of $${o.medianStop}. `
    + `Buys ${sg(o.buys.netR)}R (n ${o.buys.n}) and sells ${sg(o.sells.netR)}R (n ${o.sells.n}) out of sample on T1. `
    + `Placebo seeds beaten: T1 ${dec.T1.beaten}, T2 ${dec.T2.beaten}, T3 ${dec.T3.beaten} of 40. `
    + (any ? '' : 'Not an edge; nothing live changes and no proposal is written.');
  const result = { study: 'gold-ny-open-overnight-fail', built: '2026-11-14', preregistration: 'research/edge/gold-ny-open-overnight-fail/PREREGISTRATION.md', planSha256: sha,
    claim: 'when the H1 candle of the US cash open raids one end of gold\'s 18:00-09:00 New York overnight range and closes back inside, gold returns toward the range\'s middle by 16:00 New York',
    rule: 'New York weekdays; overnight = H1 candles 18:00 NY the evening before to the 08:00 NY candle (10+); raid candle = 09:00 NY; T1: it trades through exactly one end and closes back inside: fade at the 10:00 NY open, stop $0.30 beyond its extreme, target the overnight middle (no trade if the entry is already past it), out 16:00 NY; T2: the same with no target; T3: it closes beyond the end: follow at the 10:00 open, stop $0.30 beyond its other extreme, out 16:00 NY; stop first, a gap through the stop fills at the open; one trade a day',
    data: `OANDA mid XAU/USD H1 (keyless candle proxy), ${days.length} New York weekday sessions ${days[0].day} → ${days.at(-1).day}, New York time by the US daylight rule since 2007`,
    cost: COST, fin: { rate: FIN.xau.long, src: FIN.xau.src, charged: finSum, trades: finN, note: `charged on ${finN} test trades, total ${finSum}R: every exit is at or before 16:00 New York, before the rollover.` },
    windows: WINDOWS, halves: HALVES, verdict: verdictLine(res, dec), decision: dec, tests: res,
    placebo: { seeds: SEEDS, how: 'each out-of-sample trade on a random eligible weekday of the same year, same side and distances', ...Object.fromEntries(Object.keys(TESTS).map((k) => [k, { means: pl[k], min: Math.min(...pl[k]), max: Math.max(...pl[k]), median: r3(quantile(pl[k], 0.5)), p95: r3(quantile(pl[k], 0.95)) }])) },
    reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict);
  for (const k of Object.keys(TESTS)) console.log(k, JSON.stringify({ IS: [res[k].IS.n, res[k].IS.netR, res[k].IS.grossR, res[k].IS.t, res[k].IS.liftR], OOS: [res[k].OOS.n, res[k].OOS.netR, res[k].OOS.grossR, res[k].OOS.t, res[k].OOS.grossT, res[k].OOS.net2R, res[k].OOS.liftR, res[k].OOS.liftT] }), dec[k].pHolm, dec[k].beaten, res[k].skips);
}
