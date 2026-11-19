// Edge research · fomc-follow: follow or fade the first 30 minutes after the scheduled FOMC statement, NAS100 / SPX500 /
// XAU, OANDA mid M5, net of CFD costs. Rules, costs, windows, placebo and pass bar: PREREGISTRATION.md (committed first).
//   candles: the pre-fomc-drift study's files (node --use-env-proxy research/edge/pre-fomc-drift/fetch.mjs <dir>; that
//   script is on its own branch: the files are <market>-5m.json.gz, rows [t, o, h, l, c], kept out of git)
//   node research/edge/fomc-follow/run.mjs <dir>        (writes result.json and RESULT.md here)
// A NEW stand-alone event rule decided on 2020 → now; not a test of the gold book (owner decision item 44 untouched).
// Pure pieces are exported for tests/fomc-follow.test.mjs. Paper research only: nothing live reads this.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { zonedToUtc } from '../../../council/events.mjs';
import { fomcEvents, ALL_ANNOUNCE, SOURCE, UNSCHEDULED } from './events.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, M5 = 300, US = 'America/New_York';
const T0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const P = Object.freeze({
  WIN: 1800, EXIT: '15:55', TP: 1.5, MINRISK: 0.25, SKIP: 0.5, BASE_N: 20, BASE_DAYS: 45,
  COST: Object.freeze({ nas100: 2.0, spx500: 1.0, xau: 0.3 }),
  W: Object.freeze({ rep: [T0('2010-01-01'), T0('2020-01-01')], dec: [T0('2020-01-01'), T0('2026-11-14')] }),
  SEEDS: 40, HALF: 182, EXCL_DAYS: 3, TRIES: 50, Q: 0.95, N_MIN: 40, T_MIN: 2, ALPHA: 0.05,
});
export const MARKETS = ['nas100', 'spx500', 'xau'];
export const RULES = ['F', 'R'];

// ── candles: typed arrays + a time → index map; t = candle start ──
export function toBars(rows) {
  const n = rows.length, b = { t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n), n, at: new Map() };
  rows.forEach((r, i) => { b.t[i] = r[0]; b.o[i] = r[1]; b.h[i] = r[2]; b.l[i] = r[3]; b.c[i] = r[4]; b.at.set(r[0], i); });
  return b;
}
// index of the last candle whose END is at or before `end` and within `look` of it; -1 if none
export function lastEnding(b, end, look = 3600) {
  let lo = 0, hi = b.n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] + M5 <= end) lo = m + 1; else hi = m; }
  const i = lo - 1;
  return i >= 0 && b.t[i] + M5 >= end - look ? i : -1;
}
const dnum = (s) => Date.parse(s + 'T00:00:00Z') / (DAY * 1000);
const dstr = (n) => new Date(n * DAY * 1000).toISOString().slice(0, 10);
const wday = (s) => new Date(s + 'T00:00:00Z').getUTCDay();

// the opening window S → S + 30 min: six candles required; null if any is missing
export function windowOf(b, S) {
  let hi = -Infinity, lo = Infinity;
  for (let k = 0; k < P.WIN / M5; k++) { const i = b.at.get(S + k * M5); if (i == null) return null; if (b.h[i] > hi) hi = b.h[i]; if (b.l[i] < lo) lo = b.l[i]; }
  return { hi, lo, range: hi - lo, i30: b.at.get(S + P.WIN - M5) };
}
// mean range of the same clock window on the 20 previous weekdays with all six candles, announcement days left out
export function baseline(b, date, at, banned) {
  const xs = [];
  for (let d = dnum(date) - 1; d >= dnum(date) - P.BASE_DAYS && xs.length < P.BASE_N; d--) {
    const ds = dstr(d), w = wday(ds);
    if (w === 0 || w === 6 || banned.has(ds)) continue;
    const win = windowOf(b, zonedToUtc(ds, at, US)); if (win) xs.push(win.range);
  }
  return xs.length < P.BASE_N ? null : xs.reduce((a, x) => a + x, 0) / xs.length;
}
// the signal at S + 30 min: direction, window, skip reason. Reads candles that ended by S + 30 min and earlier days only.
export function signal(b, ev, banned) {
  const S = ev.T, iRef = b.at.get(S - M5), win = windowOf(b, S);
  if (iRef == null) return { skip: 'no candle ending at the statement' };
  if (!win) return { skip: 'window incomplete' };
  const ref = b.c[iRef], c30 = b.c[win.i30], d = Math.sign(c30 - ref);
  if (d === 0) return { skip: 'no direction' };
  const base = baseline(b, ev.date, ev.at, banned);
  if (base == null) return { skip: 'no baseline' };
  if (win.range < P.SKIP * base) return { skip: 'quiet window', range: win.range, base };
  return { d, ref, c30, hi: win.hi, lo: win.lo, range: win.range, base, i30: win.i30 };
}
// levels of one rule: side (+1 long / -1 short), entry, stop, risk, target
export function levels(sig, rule) {
  const side = rule === 'F' ? sig.d : -sig.d, entry = sig.c30;
  let stop = side > 0 ? sig.lo : sig.hi, risk = Math.abs(entry - stop);
  const floor = P.MINRISK * sig.range;
  if (risk < floor) { risk = floor; stop = entry - side * risk; }
  return { side, entry, stop, risk, target: entry + side * P.TP * risk };
}
// manage from the candle after i30 to the one ending at the exit time: gap at the open, then stop, then target (stop first)
export function manage(b, lv, i30, exitEnd) {
  const iX = lastEnding(b, exitEnd, exitEnd - (b.t[i30] + M5));   // the last candle ending by the exit time, after the entry
  const { side, entry, stop, target, risk } = lv;
  if (iX <= i30) return { skip: 'no candle after entry' };
  for (let i = i30 + 1; i <= iX; i++) {
    const o = b.o[i], adv = side > 0 ? b.l[i] <= stop : b.h[i] >= stop, fav = side > 0 ? b.h[i] >= target : b.l[i] <= target;
    if (side > 0 ? o <= stop : o >= stop) return { exit: o, why: 'gap', R: side * (o - entry) / risk, exitT: b.t[i] };
    if (side > 0 ? o >= target : o <= target) return { exit: o, why: 'target', R: side * (o - entry) / risk, exitT: b.t[i] };
    if (adv) return { exit: stop, why: 'stop', R: side * (stop - entry) / risk, exitT: b.t[i] + M5 };
    if (fav) return { exit: target, why: 'target', R: P.TP, exitT: b.t[i] + M5 };
  }
  const exit = b.c[iX];
  return { exit, why: 'time', R: side * (exit - entry) / risk, exitT: b.t[iX] + M5 };
}
export function trade(b, ev, rule, sym, banned) {
  const sig = signal(b, ev, banned); if (sig.skip) return sig;
  const lv = levels(sig, rule), m = manage(b, lv, sig.i30, zonedToUtc(ev.date, P.EXIT, US));
  if (m.skip) return m;
  const costR = P.COST[sym] / lv.risk;
  return { date: ev.date, ...lv, ...m, costR, net: m.R - costR };
}

// ── statistics ──
export function stat(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const mean = xs.reduce((a, x) => a + x, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)) : null;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}
export function quantile(xs, q) {
  const s = xs.filter(Number.isFinite).slice().sort((a, b) => a - b); if (!s.length) return null;
  const x = (s.length - 1) * q, lo = Math.floor(x), hi = Math.ceil(x);
  return s[lo] + (s[hi] - s[lo]) * (x - lo);
}
export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pOne = (t) => (t == null ? 1 : 0.5 * (1 - erf(t / Math.SQRT2)));   // one-sided, normal approximation
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), m = ps.length, out = new Array(m);
  let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (m - k) * p)); out[i] = run; });
  return out;
}
// placebo pool of one event: Wednesdays within ±HALF days, inside the window, not within EXCL_DAYS of any announcement
export function standIns(ev, win, all = ALL_ANNOUNCE()) {
  const d0 = dnum(ev.date), ban = all.map(dnum), out = [];
  for (let d = d0 - P.HALF; d <= d0 + P.HALF; d++) {
    const ds = dstr(d); if (wday(ds) !== 3) continue;
    if (ban.some((x) => Math.abs(x - d) <= P.EXCL_DAYS)) continue;
    const T = zonedToUtc(ds, ev.at, US); if (T < win[0] || T >= win[1]) continue;
    out.push({ date: ds, at: ev.at, T });
  }
  return out;
}
export function placeboMeans(b, evs, win, rule, sym, banned, seeds = P.SEEDS) {
  const pools = evs.map((e) => standIns(e, win)), cache = new Map(), means = [];
  const tr = (c) => { if (!cache.has(c.date)) cache.set(c.date, trade(b, c, rule, sym, banned)); return cache.get(c.date); };
  for (let s = 1; s <= seeds; s++) {
    const r = rng(s * 7919 + (rule === 'F' ? 1 : 2)), xs = [];
    for (const pool of pools) for (let k = 0; k < P.TRIES && pool.length; k++) { const x = tr(pool[Math.floor(r() * pool.length)]); if (!x.skip) { xs.push(x.net); break; } }
    means.push(stat(xs).mean);
  }
  return means;
}
export function judge(dec, rep, holmP, p95) {
  const c = { nOk: dec.n >= P.N_MIN, positive: dec.mean > 0, t2: dec.t != null && dec.t >= P.T_MIN, holm: holmP < P.ALPHA,
    sameSign: rep.mean != null && rep.mean > 0, beatsPlacebo: p95 != null && dec.mean > p95 };
  return { ...c, pass: Object.values(c).every(Boolean) };
}

const r2 = (x, d = 3) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
function summarize(trs) {
  const net = stat(trs.map((x) => x.net)), gross = stat(trs.map((x) => x.R)), why = {};
  for (const x of trs) why[x.why] = (why[x.why] || 0) + 1;
  return { n: net.n, netR: r2(net.mean), t: r2(net.t, 2), sd: r2(net.sd), grossR: r2(gross.mean), grossT: r2(gross.t, 2),
    costR: r2(stat(trs.map((x) => x.costR)).mean), win: r2(trs.filter((x) => x.net > 0).length / (trs.length || 1)), exits: why };
}

export function run(dir) {
  const evs = fomcEvents(Infinity).filter((e) => e.T >= P.W.rep[0]), banned = new Set(ALL_ANNOUNCE());
  const out = { study: 'fomc-follow', built: '2026-11-13', preregistration: 'research/edge/fomc-follow/PREREGISTRATION.md', source: SOURCE,
    unscheduledExcluded: UNSCHEDULED, scope: 'A new stand-alone event rule decided on 2020 → now; not a test of the gold book (owner decision item 44 untouched).',
    rule: 'direction of the first 30 minutes after the scheduled FOMC statement (close of the candle ending at S + 30 min against the one ending at S); F follows it, R fades it; entry at S + 30 min, stop beyond the window\'s extreme on the losing side (at least 0.25 x the window range), target 1.5R, out at 15:55 New York; skipped when the window range is under 0.5 x the mean of the same window on the 20 previous weekdays',
    costs: { points: P.COST }, windows: { rep: '2010-2019', dec: '2020 → now' }, tests: [], markets: {} };
  const holmIn = [];
  for (const sym of MARKETS) {
    const b = toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${sym}-5m.json.gz`)))));
    const m = { candles: b.n, from: new Date(b.t[0] * 1000).toISOString().slice(0, 10), to: new Date(b.t[b.n - 1] * 1000).toISOString().slice(0, 10), rules: {} };
    for (const rule of RULES) {
      const R = {};
      for (const [w, win] of Object.entries(P.W)) {
        const we = evs.filter((e) => e.T >= win[0] && e.T < win[1]), trs = [], skipped = {};
        for (const e of we) { const x = trade(b, e, rule, sym, banned); if (x.skip) skipped[x.skip] = (skipped[x.skip] || 0) + 1; else trs.push(x); }
        R[w] = { events: we.length, skipped, ...summarize(trs), raw: stat(trs.map((x) => x.net)) };
        if (w === 'dec') {
          const pm = placeboMeans(b, we, win, rule, sym, banned), p95 = quantile(pm, P.Q);
          R[w].placebo = { seeds: pm.length, mean: r2(stat(pm).mean), p95: r2(p95), max: r2(Math.max(...pm)), beaten: pm.filter((x) => R[w].raw.mean > x).length, p95raw: p95 };
          const byYear = {};
          for (const x of trs) (byYear[x.date.slice(0, 4)] ||= []).push(x.net);
          R[w].byYear = Object.fromEntries(Object.entries(byYear).map(([y, xs]) => [y, { n: xs.length, netR: r2(stat(xs).mean) }]));
          R[w].trades = trs.map((x) => ({ date: x.date, side: x.side > 0 ? 'buy' : 'sell', entry: r2(x.entry, 2), stop: r2(x.stop, 2), target: r2(x.target, 2), exit: r2(x.exit, 2), why: x.why, R: r2(x.R), net: r2(x.net) }));
        }
      }
      m.rules[rule] = R;
      holmIn.push({ sym, rule, p: pOne(R.dec.raw.t) });
    }
    out.markets[sym] = m;
  }
  const adj = holm(holmIn.map((x) => x.p));
  holmIn.forEach((x, k) => {
    const R = out.markets[x.sym].rules[x.rule], j = judge(R.dec.raw, R.rep.raw, adj[k], R.dec.placebo.p95raw);
    out.tests.push({ market: x.sym, rule: x.rule, n: R.dec.n, netR: R.dec.netR, t: R.dec.t, p: r2(x.p, 4), holmP: r2(adj[k], 4), repNetR: R.rep.netR, repN: R.rep.n,
      placeboP95: R.dec.placebo.p95, ...j });
  });
  for (const sym of MARKETS) for (const rule of RULES) for (const w of Object.keys(P.W)) { delete out.markets[sym].rules[rule][w].raw; if (w === 'dec') delete out.markets[sym].rules[rule][w].placebo.p95raw; }
  out.passed = out.tests.filter((x) => x.pass).map((x) => `${x.rule}-${x.market}`);
  out.verdict = out.passed.length ? 'PASS' : 'FAIL';
  return out;
}

const f = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
export const NAME = { nas100: 'NAS100', spx500: 'SPX500', xau: 'XAU/USD' };
export const RNAME = { F: 'F (follow)', R: 'R (fade)' };
export function headline(r) {
  const best = r.tests.slice().sort((a, b) => (b.t ?? -9) - (a.t ?? -9))[0];
  return `**Verdict: ${r.verdict}, ${r.passed.length} of ${r.tests.length} tests.** ` +
    `Best in 2020 → now: ${RNAME[best.rule]} on ${NAME[best.market]}, n ${best.n}, ${f(best.netR)}R a trade net of costs, t ${f(best.t, 2)}, Holm p ${best.holmP}; ` +
    `2010-19 ${f(best.repNetR)}R; placebo 95th percentile ${f(best.placeboP95)}R.`;
}
export function report(r) {
  const L = [];
  L.push('# Follow or fade the first 30 minutes after the FOMC statement: result', '');
  L.push(headline(r), '');
  L.push(`Pre-registered in \`PREREGISTRATION.md\` (committed before any trade of the rule was computed). ${r.scope} Events: scheduled FOMC statements 2010 → October 2026 (${r.source}); unscheduled ${r.unscheduledExcluded.join(', ')} excluded. Rule: ${r.rule}. Costs, round trip: NAS100 2.0 points, SPX500 1.0 point, gold $0.30. Data: OANDA mid M5 candles through the candle proxy (the pre-fomc-drift study's files).`, '');
  L.push('## The six tests (2020 → now decides)', '', '| rule | market | n | net R a trade | t | Holm p | 2010-19 net R (n) | placebo 95th pct | beats seeds | pass |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const x of r.tests) {
    const d = r.markets[x.market].rules[x.rule].dec;
    L.push(`| ${RNAME[x.rule]} | ${NAME[x.market]} | ${x.n} | ${f(x.netR)} | ${f(x.t, 2)} | ${x.holmP} | ${f(x.repNetR)} (${x.repN}) | ${f(x.placeboP95)} | ${d.placebo.beaten} / ${d.placebo.seeds} | ${x.pass ? 'yes' : 'no'} |`);
  }
  L.push('', '"pass" = n ≥ 40, mean net R > 0, t ≥ 2, Holm p < 0.05 over the six tests, positive in 2010-19 and above the placebo\'s 95th percentile (the same rule on non-FOMC Wednesdays at the same clock time, 40 seeds).', '');
  L.push('## Detail per window', '', '| rule | market | window | events | trades | net R | t | gross R | cost R | win | exits | skipped |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const sym of MARKETS) for (const rule of RULES) for (const w of ['rep', 'dec']) {
    const x = r.markets[sym].rules[rule][w];
    L.push(`| ${RNAME[rule]} | ${NAME[sym]} | ${r.windows[w]} | ${x.events} | ${x.n} | ${f(x.netR)} | ${f(x.t, 2)} | ${f(x.grossR)} | ${f(x.costR)} | ${(x.win * 100).toFixed(0)} % | ${Object.entries(x.exits).map(([k, v]) => `${k} ${v}`).join(', ')} | ${Object.entries(x.skipped).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'} |`);
  }
  L.push('', 'F and R take the same signals in opposite directions. Their stops differ (F beyond the far extreme of the window, R beyond the near one, at least 0.25 x the window range), so their results are not mirror images; both pay the cost, and a near stop makes the cost larger in R.', '');
  L.push('## By year, 2020 → now (net R a trade, n)', '');
  for (const sym of MARKETS) for (const rule of RULES) L.push(`- ${RNAME[rule]}, ${NAME[sym]}: ` + Object.entries(r.markets[sym].rules[rule].dec.byYear).map(([y, x]) => `${y} ${f(x.netR, 2)} (${x.n})`).join(' · '));
  L.push('', '## What this means', '');
  if (r.verdict === 'PASS') L.push(`Passing: ${r.passed.join(', ')}. A hypothesis for a forward paper shadow only (see \`research/proposals/2026-11-13-fomc-follow.md\`); never call it an edge before a forward record. Nothing live changed.`);
  else L.push('No test meets the pre-registered bar, so neither following nor fading the first 30 minutes after the FOMC statement is an edge on the council\'s feeds after costs. No proposal is written and nothing live changed. This was a new stand-alone event rule, not a test of the gold book (item 44). Any other version (another window length, target, exit time, market or filter) would need its own pre-registration on data not used here.');
  L.push('', 'To repeat: the candle files of `research/edge/pre-fomc-drift/fetch.mjs`, then `node research/edge/fomc-follow/run.mjs <dir>`. Tests: `tests/fomc-follow.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candle dir>');
  const r = run(dir);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(r, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(r));
  for (const x of r.tests) console.log(x.rule, x.market, x.n, x.netR, x.t, x.holmP, x.repNetR, x.placeboP95, x.pass);
  console.log('verdict', r.verdict);
}
