// Edge research · intraday-momentum: Gao, Han, Li and Zhou (2018) "Market intraday momentum" as a trading rule on the
// council's OANDA index feeds, out of sample, net of CFD costs. Rules, calendar, costs, windows, placebo and pass bar:
// PREREGISTRATION.md (committed first).
//   node --use-env-proxy research/edge/intraday-momentum/fetch.mjs <dir>   (OANDA M5 candles, kept out of git)
//   node research/edge/intraday-momentum/run.mjs <dir>                     (writes result.json and RESULT.md here)
// Pure pieces are exported for tests/intraday-momentum.test.mjs. Paper research only: nothing live reads this.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { zonedToUtc } from '../../../council/events.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const M5 = 300, US = 'America/New_York';
export const P = Object.freeze({
  K: 1.5, AVG: 20, LOOK: 600, SEEDS: 40, Q: 0.95, ALPHA: 0.05,
  COST: Object.freeze({ spx500: 1.0, nas100: 2.0 }),
  FROM: '2008-01-01', TO: '2026-11-13',
  WIN: Object.freeze({ A: ['2008-01-01', '2016-01-01'], B: ['2016-01-01', '2026-11-14'] }),
});
export const MARKETS = ['spx500', 'nas100'];
const NAME = { spx500: 'SPX500', nas100: 'NAS100' };

// ── the NYSE calendar (stated in PREREGISTRATION.md) ──
const iso = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const wdOf = (s) => new Date(s + 'T12:00:00Z').getUTCDay();
const addDays = (s, k) => new Date(Date.parse(s + 'T12:00:00Z') + k * 864e5).toISOString().slice(0, 10);
function nthWd(y, m, wd, n) {   // n-th weekday wd of month m (0-based); n = -1 for the last
  if (n > 0) { const f = new Date(Date.UTC(y, m, 1)).getUTCDay(); return iso(y, m, 1 + ((wd - f + 7) % 7) + 7 * (n - 1)); }
  const last = new Date(Date.UTC(y, m + 1, 0)), l = last.getUTCDay(); return iso(y, m, last.getUTCDate() - ((l - wd + 7) % 7));
}
function easter(y) {   // Gregorian Easter Sunday (anonymous algorithm)
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(y, mo - 1, da);
}
const obsBoth = (s) => { const w = wdOf(s); return w === 6 ? addDays(s, -1) : w === 0 ? addDays(s, 1) : s; };   // Sat → Fri, Sun → Mon
export const SPECIAL_CLOSED = Object.freeze(['2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const CAL = new Map();
export function nyseYear(y) {
  if (CAL.has(y)) return CAL.get(y);
  const closed = new Set(), half = new Set();
  const ny = iso(y, 0, 1), nyw = wdOf(ny);
  if (nyw === 0) closed.add(iso(y, 0, 2)); else if (nyw !== 6) closed.add(ny);
  closed.add(nthWd(y, 0, 1, 3)); closed.add(nthWd(y, 1, 1, 3)); closed.add(addDays(easter(y), -2)); closed.add(nthWd(y, 4, 1, -1));
  if (y >= 2022) closed.add(obsBoth(iso(y, 5, 19)));
  closed.add(obsBoth(iso(y, 6, 4))); closed.add(nthWd(y, 8, 1, 1));
  const tg = nthWd(y, 10, 4, 4); closed.add(tg); closed.add(obsBoth(iso(y, 11, 25)));
  for (const s of SPECIAL_CLOSED) if (+s.slice(0, 4) === y) closed.add(s);
  const isTd = (s) => { const w = wdOf(s); return w >= 1 && w <= 5 && !closed.has(s); };
  const j4 = wdOf(iso(y, 6, 4));
  if (j4 >= 2 && j4 <= 5 && isTd(iso(y, 6, 3))) half.add(iso(y, 6, 3));
  half.add(addDays(tg, 1));
  if (isTd(iso(y, 11, 24))) half.add(iso(y, 11, 24));
  const r = { closed, half }; CAL.set(y, r); return r;
}
export function nyseDay(s) {
  const w = wdOf(s); if (w === 0 || w === 6) return 'weekend';
  const c = nyseYear(+s.slice(0, 4));
  return c.closed.has(s) ? 'closed' : c.half.has(s) ? 'half' : 'open';
}
// trading days (open or half) from a to b inclusive
export function tradingDays(a, b) {
  const out = []; for (let s = a; s <= b; s = addDays(s, 1)) { const k = nyseDay(s); if (k === 'open' || k === 'half') out.push(s); }
  return out;
}
// eligible days: full days whose previous trading day was a full day too; returns [{ date, prev }]
export function eligibleDays(from, to) {
  const all = tradingDays(addDays(from, -14), to), out = [];
  for (let i = 1; i < all.length; i++) {
    const d = all[i], p = all[i - 1];
    if (d < from) continue;
    if (nyseDay(d) === 'open' && nyseDay(p) === 'open') out.push({ date: d, prev: p });
  }
  return out;
}
export const nyT = (date, hhmm) => zonedToUtc(date, hhmm, US);

// ── candles ──
export function toBars(rows) {
  const n = rows.length, b = { t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n), n };
  rows.forEach((r, i) => { b.t[i] = r[0]; b.o[i] = r[1]; b.h[i] = r[2]; b.l[i] = r[3]; b.c[i] = r[4]; });
  return b;
}
// index of the last candle whose END (t + 5 min) is at or before `end` and within LOOK of it; -1 if none
export function lastEnding(b, end, look = P.LOOK) {
  let lo = 0, hi = b.n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] + M5 <= end) lo = m + 1; else hi = m; }
  const i = lo - 1;
  return i >= 0 && b.t[i] + M5 >= end - look ? i : -1;
}
const pxAt = (b, end) => { const i = lastEnding(b, end); return i < 0 ? null : b.c[i]; };

// the day's prices; reads nothing that ends after 16:00 New York of that day. `upTo` caps what the signal may read.
export function dayPrices(b, d) {
  const t0 = nyT(d.prev, '16:00'), t10 = nyT(d.date, '10:00'), t1530 = nyT(d.date, '15:30'), t16 = nyT(d.date, '16:00');
  const p0 = pxAt(b, t0), p10 = pxAt(b, t10), pE = pxAt(b, t1530), pX = pxAt(b, t16);
  return { t0, t10, t1530, t16, p0, p10, pE, pX };
}
// the signal: only the previous 16:00 and today's 10:00 price
export const signalOf = (p0, p10) => p10 / p0 - 1;

// one trade from 15:30 to 16:00 with a stop; candles that START in [t1530, t16)
export function trade(b, { t1530, t16, pE, pX }, side, A, cost) {
  const dist = P.K * A, stop = pE - side * dist;
  let lo = 0, hi = b.n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] < t1530) lo = m + 1; else hi = m; }
  let exit = pX, how = 'time';
  for (let i = lo; i < b.n && b.t[i] < t16; i++) {
    if (side > 0 ? b.o[i] <= stop : b.o[i] >= stop) { exit = b.o[i]; how = 'gap'; break; }
    if (side > 0 ? b.l[i] <= stop : b.h[i] >= stop) { exit = stop; how = 'stop'; break; }
  }
  const R = side * (exit - pE) / dist;
  return { side, entry: pE, stop, dist, exit, how, R, net: R - cost / dist };
}

// ── statistics ──
export function tstat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: n ? xs[0] : null, sd: null, t: null };
  const m = xs.reduce((s, x) => s + x, 0) / n, v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1), sd = Math.sqrt(v);
  return { n, mean: m, sd, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null };
}
// standard normal upper tail
export function normSf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? p : 1 - p;
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; });
  return out;
}
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// sign hit rate of r1 on r2 over traded days with r2 != 0, and the placebo (random signs, seeds 1..SEEDS)
export function hitRate(rows) {
  const use = rows.filter((r) => r.r2 !== 0);
  const hit = use.filter((r) => Math.sign(r.r1) === Math.sign(r.r2)).length;
  const plac = [];
  for (let s = 1; s <= P.SEEDS; s++) { const rnd = mulberry32(s); let h = 0; for (const r of use) if ((rnd() < 0.5 ? -1 : 1) === Math.sign(r.r2)) h++; plac.push(use.length ? h / use.length : null); }
  const sorted = [...plac].sort((a, b) => a - b), q = sorted[Math.min(sorted.length - 1, Math.ceil(P.Q * sorted.length) - 1)];
  return { n: use.length, hit: use.length ? hit / use.length : null, placeboMean: plac.reduce((s, x) => s + x, 0) / plac.length, placeboQ95: q, placeboMax: sorted.at(-1), beats: plac.filter((x) => hit / use.length > x).length };
}
// OLS y = a + b x with OLS and White (HC0) t of the slope
export function ols(xs, ys) {
  const n = xs.length; if (n < 3) return { n, slope: null };
  const mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
  let sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  const b = sxy / sxx, a = my - b * mx;
  let sse = 0, sst = 0, hc = 0;
  for (let i = 0; i < n; i++) { const e = ys[i] - a - b * xs[i]; sse += e * e; sst += (ys[i] - my) ** 2; hc += (xs[i] - mx) ** 2 * e * e; }
  const seO = Math.sqrt(sse / (n - 2) / sxx), seW = Math.sqrt(hc) / sxx;
  return { n, intercept: a, slope: b, tOls: b / seO, tWhite: b / seW, r2: 1 - sse / sst };
}

// ── one market: every eligible day, its trade where there is one ──
export function runMarket(b, sym, days = eligibleDays(P.FROM, P.TO)) {
  const recs = [], skipped = { noPrice: 0, flat: 0, warmup: 0 }, hist = [];
  for (const d of days) {
    const px = dayPrices(b, d);
    if ([px.p0, px.p10, px.pE, px.pX].some((v) => v == null)) { skipped.noPrice++; continue; }
    const r1 = signalOf(px.p0, px.p10), r2 = px.pX / px.pE - 1, move = Math.abs(px.pX - px.pE);
    const rec = { date: d.date, r1, r2 };
    if (hist.length < P.AVG) skipped.warmup++;
    else if (r1 === 0) skipped.flat++;
    else {
      const A = hist.slice(-P.AVG).reduce((s, x) => s + x, 0) / P.AVG;
      if (A > 0) rec.tr = trade(b, px, Math.sign(r1), A, P.COST[sym]);
    }
    recs.push(rec); hist.push(move);
  }
  return { recs, skipped };
}
const r4 = (v) => v == null ? null : Math.round(v * 1e4) / 1e4;
export function summarize(recs, [a, b]) {
  const w = recs.filter((r) => r.date >= a && r.date < b), tr = w.filter((r) => r.tr);
  const net = tstat(tr.map((r) => r.tr.net)), gross = tstat(tr.map((r) => r.tr.R));
  const hr = hitRate(tr.map((r) => ({ r1: r.r1, r2: r.r2 })));
  const reg = ols(w.map((r) => r.r1 * 100), w.map((r) => r.r2 * 100));
  return {
    days: w.length, n: net.n, net: r4(net.mean), t: r4(net.t), gross: r4(gross.mean), tGross: r4(gross.t),
    totalNet: r4(tr.reduce((s, r) => s + r.tr.net, 0)), win: r4(tr.filter((r) => r.tr.net > 0).length / (tr.length || 1)),
    stops: tr.filter((r) => r.tr.how !== 'time').length, longs: tr.filter((r) => r.tr.side > 0).length,
    costR: r4(tr.reduce((s, r) => s + (r.tr.R - r.tr.net), 0) / (tr.length || 1)),
    hit: r4(hr.hit), hitN: hr.n, placeboMean: r4(hr.placeboMean), placeboQ95: r4(hr.placeboQ95), placeboMax: r4(hr.placeboMax), beats: hr.beats,
    reg: { n: reg.n, slope: r4(reg.slope), tOls: r4(reg.tOls), tWhite: r4(reg.tWhite), r2: r4(reg.r2) },
  };
}
export function byYear(recs) {
  const y = {};
  for (const r of recs) if (r.tr) { const k = r.date.slice(0, 4); (y[k] ||= []).push(r.tr.net); }
  return Object.fromEntries(Object.entries(y).map(([k, xs]) => { const s = tstat(xs); return [k, { n: s.n, net: r4(s.mean), total: r4(xs.reduce((a, x) => a + x, 0)) }]; }));
}

export function build(markets) {
  const out = { study: 'intraday-momentum', built: '2026-11-13', preregistration: 'research/edge/intraday-momentum/PREREGISTRATION.md',
    paper: 'Gao, Han, Li and Zhou (2018), Journal of Financial Economics, "Market intraday momentum"; SPY data 1993-2013',
    rule: 'signal = previous 16:00 New York price to 10:00; at 15:30 long if > 0, short if < 0; exit 16:00; stop 1.5 x the 20-day mean |16:00 - 15:30| move',
    costs: { ...P.COST }, windows: { A: '2008-2015 (descriptive)', B: '2016 → 2026-11-13 (decides)' }, markets: {} };
  for (const [sym, { recs, skipped }] of Object.entries(markets)) {
    out.markets[sym] = { name: NAME[sym], skipped, A: summarize(recs, P.WIN.A), B: summarize(recs, P.WIN.B), byYear: byYear(recs) };
  }
  const syms = Object.keys(out.markets), ps = syms.map((s) => { const t = out.markets[s].B.t; return t == null ? 1 : normSf(t); }), hp = holm(ps);
  syms.forEach((s, i) => { const m = out.markets[s], B = m.B;
    m.pass = { p: r4(ps[i]), holm: r4(hp[i]), netOk: B.net > 0 && B.t >= 2, hitOk: B.hit > B.placeboQ95, holmOk: hp[i] < P.ALPHA };
    m.pass.ok = m.pass.netOk && m.pass.hitOk && m.pass.holmOk; });
  out.verdict = syms.some((s) => out.markets[s].pass.ok) ? 'PASS' : 'FAIL';
  return out;
}

// ── report ──
const sg = (v, d = 3) => v == null ? 'n/a' : (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d);
const pc = (v) => v == null ? 'n/a' : (v * 100).toFixed(1) + ' %';
export function render(j) {
  const S = j.markets.spx500, N = j.markets.nas100, L = [];
  L.push('# Market intraday momentum, out of sample: result', '');
  const line = (m) => `${m.name}, 2016 → now: n ${m.B.n}, ${sg(m.B.net)}R a trade net of costs, t ${sg(m.B.t, 2)} (before costs ${sg(m.B.gross)}R, t ${sg(m.B.tGross, 2)}); sign hit rate ${pc(m.B.hit)} against a placebo 95th percentile of ${pc(m.B.placeboQ95)}; Holm p ${m.pass.holm.toFixed(3)}`;
  L.push(`**Verdict: ${j.verdict}.** ${line(S)}. ${line(N)}.`, '');
  L.push(`Pre-registered in \`PREREGISTRATION.md\` (committed before any figure was computed). Paper: ${j.paper}. Rule: ${j.rule}. Costs, round trip: SPX500 ${j.costs.spx500} point, NAS100 ${j.costs.nas100} points. Data: OANDA mid M5 candles through the candle proxy; NYSE calendar stated in the pre-registration (half days and the day after one skipped).`, '');
  L.push('The paper\'s data end in 2013: window A (2008-2015) overlaps its sample for 2008-2013 and is descriptive; window B (2016 → now) is wholly after it and decides.', '');
  L.push('## Per market and window', '');
  L.push('| market | window | days | trades | net R a trade | t | gross R | t gross | cost R | win | stops | hit rate | placebo 95th pct | beats seeds | pass |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const m of [S, N]) for (const [k, lab] of [['A', '2008-2015'], ['B', '2016 → now']]) { const w = m[k];
    L.push(`| ${m.name} | ${lab} | ${w.days} | ${w.n} | ${sg(w.net)} | ${sg(w.t, 2)} | ${sg(w.gross)} | ${sg(w.tGross, 2)} | ${w.costR.toFixed(3)} | ${pc(w.win)} | ${w.stops} | ${pc(w.hit)} | ${pc(w.placeboQ95)} | ${w.beats} / 40 | ${k === 'A' ? 'not judged' : m.pass.ok ? 'yes' : 'no'} |`); }
  L.push('', '"pass" = window B net R > 0 and t ≥ 2, hit rate above the placebo 95th percentile, and Holm p < 0.05 over the two markets.', '');
  L.push('| market | p (one-sided) | Holm p | net > 0 and t ≥ 2 | hit > placebo | Holm < 0.05 |', '|---|---|---|---|---|---|');
  for (const m of [S, N]) L.push(`| ${m.name} | ${m.pass.p.toFixed(3)} | ${m.pass.holm.toFixed(3)} | ${m.pass.netOk ? 'yes' : 'no'} | ${m.pass.hitOk ? 'yes' : 'no'} | ${m.pass.holmOk ? 'yes' : 'no'} |`);
  L.push('', '## The paper\'s regression (descriptive)', '', 'OLS of the last half-hour return (15:30-16:00) on the first (previous 16:00 to 10:00), both in %, on every eligible day with prices.', '');
  L.push('| market | window | n | slope | t (OLS) | t (White) | R² |', '|---|---|---|---|---|---|---|');
  for (const m of [S, N]) for (const [k, lab] of [['A', '2008-2015'], ['B', '2016 → now']]) { const r = m[k].reg;
    L.push(`| ${m.name} | ${lab} | ${r.n} | ${sg(r.slope, 4)} | ${sg(r.tOls, 2)} | ${sg(r.tWhite, 2)} | ${(r.r2 * 100).toFixed(2)} % |`); }
  L.push('', '## Net R by year (descriptive)', '', '| year | SPX500 n | SPX500 net R a trade | SPX500 total | NAS100 n | NAS100 net R a trade | NAS100 total |', '|---|---|---|---|---|---|---|');
  const yrs = [...new Set([...Object.keys(S.byYear), ...Object.keys(N.byYear)])].sort();
  for (const y of yrs) { const a = S.byYear[y] || {}, b = N.byYear[y] || {};
    L.push(`| ${y} | ${a.n ?? 0} | ${sg(a.net)} | ${sg(a.total, 1)} | ${b.n ?? 0} | ${sg(b.net)} | ${sg(b.total, 1)} |`); }
  L.push('', '## Days left out', '');
  for (const m of [S, N]) L.push(`- ${m.name}: ${m.skipped.noPrice} eligible days without a price at one of the four times, ${m.skipped.warmup} days of the 20-day warm-up, ${m.skipped.flat} days with a zero signal.`);
  L.push('', '## Reading', '');
  L.push(j.verdict === 'PASS'
    ? 'At least one market met every pre-registered line. This is a hypothesis for a forward paper shadow, never a live rule; see the proposal.'
    : 'No market met the pre-registered bar. The rule is not an edge on these feeds after costs; no proposal is written and nothing live changes. Never call it an edge.');
  L.push('', `Descriptive, decides nothing: in 2008-2015 (mostly the paper's own years) the sign still predicted (SPX500 hit rate ${pc(S.A.hit)}, beating ${S.A.beats} of 40 seeds; slope White t ${sg(S.A.reg.tWhite, 2)}), but a half-hour move is small against a CFD round trip, so the cost (${S.A.costR.toFixed(3)}R a trade) dwarfed the gross ${sg(S.A.gross)}R. After 2015 the sign no longer predicts on SPX500 (hit ${pc(S.B.hit)}, White t ${sg(S.B.reg.tWhite, 2)}) or NAS100 (hit ${pc(N.B.hit)}, White t ${sg(N.B.reg.tWhite, 2)}); gross R is about zero on both.`);
  L.push('', 'To repeat: `node --use-env-proxy research/edge/intraday-momentum/fetch.mjs <dir>`, then `node research/edge/intraday-momentum/run.mjs <dir>`. Test: `tests/intraday-momentum.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candle dir>');
  const mk = {};
  for (const sym of MARKETS) mk[sym] = runMarket(toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${sym}-5m.json.gz`))))), sym);
  const j = build(mk);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(j, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), render(j));
  console.log(render(j).split('\n').slice(0, 3).join('\n'));
}
