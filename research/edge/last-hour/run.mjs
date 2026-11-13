// Edge research · last-hour: the last hour into the US cash close (15:00-16:00 New York) on a big day, faded and followed,
// on the council's OANDA index feeds (NAS100, SPX500, US30), net of CFD costs. Rules, calendar, costs, windows, placebo and
// pass bar: PREREGISTRATION.md (committed first).
//   node --use-env-proxy research/edge/last-hour/fetch.mjs <dir>   (OANDA M5 candles, kept out of git)
//   node research/edge/last-hour/run.mjs <dir>                     (writes result.json and RESULT.md here)
// Pure pieces are exported for tests/last-hour.test.mjs. Paper research only: nothing live reads this.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { zonedToUtc } from '../../../council/events.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const M5 = 300, US = 'America/New_York';
export const P = Object.freeze({
  K: 1.5, MED: 20, STOP: 0.5, LOOK: 600, MIN_BARS: 50, SEEDS: 40, Q_RANK: 38, ALPHA: 0.05, T_MIN: 2,
  // round trip in index points: spread (as the other index studies) + 0.5 point of slippage a side
  SPREAD: Object.freeze({ nas100: 3, spx500: 1, us30: 4 }), SLIP: 0.5,
  FROM: '2009-10-01', TO: '2026-11-12',
  WIN: Object.freeze({ R: ['2010-01-01', '2015-12-31'], D: ['2016-01-01', '2026-11-12'] }),
});
export const COST = Object.freeze(Object.fromEntries(Object.entries(P.SPREAD).map(([k, v]) => [k, v + 2 * P.SLIP])));
export const MARKETS = ['nas100', 'spx500', 'us30'];
export const VARIANTS = ['fade', 'follow'];
const NAME = { nas100: 'NAS100', spx500: 'SPX500', us30: 'US30' };

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
// eligible days: full trading days (half days skipped) from a to b inclusive
export function eligibleDays(a, b) {
  const out = []; for (let s = a; s <= b; s = addDays(s, 1)) if (nyseDay(s) === 'open') out.push(s);
  return out;
}
export const nyT = (date, hhmm) => zonedToUtc(date, hhmm, US);

// ── candles ──
export function toBars(rows) {
  const n = rows.length, b = { t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n), n };
  rows.forEach((r, i) => { b.t[i] = r[0]; b.o[i] = r[1]; b.h[i] = r[2]; b.l[i] = r[3]; b.c[i] = r[4]; });
  return b;
}
const firstAtOrAfter = (b, t) => { let lo = 0, hi = b.n; while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] < t) lo = m + 1; else hi = m; } return lo; };
// index of the last candle whose END (t + 5 min) is at or before `end` and within LOOK of it; -1 if none
export function lastEnding(b, end, look = P.LOOK) {
  let lo = 0, hi = b.n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] + M5 <= end) lo = m + 1; else hi = m; }
  const i = lo - 1;
  return i >= 0 && b.t[i] + M5 >= end - look ? i : -1;
}
export const pxAt = (b, end) => { const i = lastEnding(b, end); return i < 0 ? null : b.c[i]; };

// the day's signal: reads only candles that END at or before 15:00 New York
export function daySignal(b, date) {
  const t0 = nyT(date, '09:30'), t15 = nyT(date, '15:00'), t16 = nyT(date, '16:00');
  const p0 = pxAt(b, t0), pE = pxAt(b, t15);
  let hi = -Infinity, lo = Infinity, k = 0;
  for (let i = firstAtOrAfter(b, t0); i < b.n && b.t[i] + M5 <= t15; i++) { k++; if (b.h[i] > hi) hi = b.h[i]; if (b.l[i] < lo) lo = b.l[i]; }
  if (p0 == null || pE == null || k < P.MIN_BARS) return null;
  return { date, t0, t15, t16, p0, pE, x: pE / p0 - 1, range: hi - lo, bars: k };
}
export const median = (xs) => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

// one trade from 15:00 to 16:00: side +1 long / −1 short; stop STOP x range from the entry; candles that START in [15:00, 16:00)
export function trade(b, sig, side, cost) {
  const dist = P.STOP * sig.range, stop = sig.pE - side * dist, pX = pxAt(b, sig.t16);
  if (pX == null || !(dist > 0)) return null;
  let exit = pX, how = 'time';
  for (let i = firstAtOrAfter(b, sig.t15); i < b.n && b.t[i] < sig.t16; i++) {
    if (side > 0 ? b.o[i] <= stop : b.o[i] >= stop) { exit = b.o[i]; how = 'gap'; break; }
    if (side > 0 ? b.l[i] <= stop : b.h[i] >= stop) { exit = stop; how = 'stop'; break; }
  }
  const R = side * (exit - sig.pE) / dist;
  return { side, entry: sig.pE, stop, dist, exit, how, R, net: R - cost / dist };
}
export const sideOf = (variant, x) => (variant === 'fade' ? -1 : 1) * Math.sign(x);

// ── one market: every eligible day with a signal; big days traded both ways ──
export function runMarket(b, sym, days = eligibleDays(P.FROM, P.TO)) {
  const pool = [], skipped = { noData: 0, warmup: 0, noExit: 0 }, hist = [];
  let big = 0;
  for (const d of days) {
    const sig = daySignal(b, d);
    if (!sig) { skipped.noData++; continue; }
    if (hist.length < P.MED) { skipped.warmup++; hist.push(Math.abs(sig.x)); continue; }
    const med = median(hist.slice(-P.MED));
    hist.push(Math.abs(sig.x));
    const rec = { date: d, x: sig.x, med, range: sig.range, big: Math.abs(sig.x) > P.K * med && sig.x !== 0 && sig.range > 0 };
    if (sig.x !== 0 && sig.range > 0) {
      rec.fade = trade(b, sig, sideOf('fade', sig.x), COST[sym]);
      rec.follow = trade(b, sig, sideOf('follow', sig.x), COST[sym]);
      if (!rec.fade) { skipped.noExit++; continue; }
    }
    if (rec.big) big++;
    pool.push(rec);
  }
  return { sym, pool, skipped, big };
}

// ── statistics ──
export function tstat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: n ? xs[0] : null, sd: null, t: null };
  const m = xs.reduce((s, x) => s + x, 0) / n, v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1), sd = Math.sqrt(v);
  return { n, mean: m, sd, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null };
}
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
// every calendar month from a to b (YYYY-MM)
export function monthsOf(a, b) {
  const out = []; let y = +a.slice(0, 4), m = +a.slice(5, 7);
  const ye = +b.slice(0, 4), me = +b.slice(5, 7);
  while (y < ye || (y === ye && m <= me)) { out.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++; } }
  return out;
}
// t on calendar-month sums; trades [{date, net}]; a month with no trade counts 0
export function monthlyT(trades, [a, b]) {
  const sums = new Map(monthsOf(a, b).map((k) => [k, 0]));
  for (const tr of trades) { const k = tr.date.slice(0, 7); if (sums.has(k)) sums.set(k, sums.get(k) + tr.net); }
  return tstat([...sums.values()]);
}
const inWin = (d, [a, b]) => d >= a && d <= b;
export const tradesOf = (pool, variant, win) => pool.filter((r) => r.big && inWin(r.date, win)).map((r) => ({ date: r.date, ...r[variant] }));

// placebo: per seed and market, draw n days without replacement from the window's candidates (x != 0), same side rule
export function placebo(markets, variant, win, seeds = P.SEEDS) {
  const out = [];
  for (let s = 1; s <= seeds; s++) {
    const rnd = mulberry32(s); let sum = 0, n = 0;
    for (const m of markets) {
      const cand = m.pool.filter((r) => inWin(r.date, win) && r.fade), need = cand.filter((r) => r.big).length;
      const idx = cand.map((_, i) => i);
      for (let k = 0; k < need && k < idx.length; k++) {   // partial Fisher-Yates
        const j = k + Math.floor(rnd() * (idx.length - k)); [idx[k], idx[j]] = [idx[j], idx[k]];
        sum += cand[idx[k]][variant].net; n++;
      }
    }
    out.push(n ? sum / n : null);
  }
  const sorted = [...out].sort((a, b) => a - b);
  return { seeds: out, mean: out.reduce((a, x) => a + x, 0) / out.length, q95: sorted[P.Q_RANK - 1], max: sorted.at(-1) };
}

const r4 = (v) => v == null ? null : Math.round(v * 1e4) / 1e4;
export function summarize(trades, win) {
  const net = tstat(trades.map((t) => t.net)), gross = tstat(trades.map((t) => t.R)), mt = monthlyT(trades, win);
  return { n: trades.length, net: r4(net.mean), tTrades: r4(net.t), tMonths: r4(mt.t), months: mt.n, gross: r4(gross.mean), tGross: r4(gross.t),
    total: r4(trades.reduce((s, t) => s + t.net, 0)), win: r4(trades.filter((t) => t.net > 0).length / (trades.length || 1)),
    stops: trades.filter((t) => t.how !== 'time').length, costR: r4(trades.reduce((s, t) => s + (t.R - t.net), 0) / (trades.length || 1)) };
}
export function byYear(trades) {
  const y = {};
  for (const t of trades) (y[t.date.slice(0, 4)] ||= []).push(t.net);
  return Object.fromEntries(Object.entries(y).sort().map(([k, xs]) => [k, { n: xs.length, net: r4(xs.reduce((a, x) => a + x, 0) / xs.length), total: r4(xs.reduce((a, x) => a + x, 0)) }]));
}

export function build(markets) {
  const out = { study: 'last-hour', built: '2026-11-13', preregistration: 'research/edge/last-hour/PREREGISTRATION.md',
    rule: 'big day = |09:30→15:00 move| > 1.5 x the 20-day median |move|; at 15:00 fade (against) or follow (with) it; stop 0.5 x the day\'s 09:30-15:00 range; exit 16:00 New York',
    costs: { ...COST }, windows: { R: '2010-2015 (replication)', D: '2016 → 2026-11-12 (decides)' },
    data: {}, markets: {}, variants: {} };
  for (const m of markets) {
    out.data[m.sym] = { name: NAME[m.sym], days: m.pool.length, big: m.big, skipped: m.skipped };
    out.markets[m.sym] = {};
    for (const v of VARIANTS) out.markets[m.sym][v] = { R: summarize(tradesOf(m.pool, v, P.WIN.R), P.WIN.R), D: summarize(tradesOf(m.pool, v, P.WIN.D), P.WIN.D) };
  }
  for (const v of VARIANTS) {
    const pooled = (win) => markets.flatMap((m) => tradesOf(m.pool, v, win));
    const R = summarize(pooled(P.WIN.R), P.WIN.R), D = summarize(pooled(P.WIN.D), P.WIN.D), pl = placebo(markets, v, P.WIN.D);
    out.variants[v] = { R, D, byYear: byYear(pooled([P.WIN.R[0], P.WIN.D[1]])),
      placebo: { mean: r4(pl.mean), q95: r4(pl.q95), max: r4(pl.max), beats: pl.seeds.filter((x) => D.net > x).length, seeds: pl.seeds.map(r4) } };
  }
  const ps = VARIANTS.map((v) => { const t = out.variants[v].D.tMonths; return t == null ? 1 : normSf(t); }), hp = holm(ps);
  VARIANTS.forEach((v, i) => { const x = out.variants[v];
    x.pass = { p: r4(ps[i]), holm: r4(hp[i]), netOk: x.D.net > 0, tOk: x.D.tMonths >= P.T_MIN, repOk: x.R.net > 0, holmOk: hp[i] < P.ALPHA, placeboOk: x.D.net > x.placebo.q95 };
    x.pass.ok = x.pass.netOk && x.pass.tOk && x.pass.repOk && x.pass.holmOk && x.pass.placeboOk; });
  out.verdict = VARIANTS.some((v) => out.variants[v].pass.ok) ? 'PASS' : 'FAIL';
  return out;
}

// ── report ──
const sg = (v, d = 3) => v == null ? 'n/a' : (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d);
const pc = (v) => v == null ? 'n/a' : (v * 100).toFixed(1) + ' %';
const yn = (b) => b ? 'yes' : 'no';
export function render(j) {
  const L = [], F = j.variants.fade, W = j.variants.follow;
  L.push('# Last hour into the US cash close on a big day: result', '');
  const line = (lab, x) => `${lab}, pooled 2016 → 2026-11-12: n ${x.D.n}, ${sg(x.D.net)}R a trade net of costs, t ${sg(x.D.tMonths, 2)} on ${x.D.months} calendar-month sums (before costs ${sg(x.D.gross)}R); 2010-15 ${sg(x.R.net)}R (n ${x.R.n}); placebo 95th percentile ${sg(x.placebo.q95)}R, beaten by ${x.placebo.beats} of 40 seeds; Holm p ${x.pass.holm.toFixed(3)}`;
  const lead = j.verdict === 'PASS' ? 'at least one variant met every pre-registered line' : `neither fading nor following a big day into the cash close pays after costs (2016 → now, pooled: fade ${sg(F.D.net)}R, follow ${sg(W.D.net)}R a trade)`;
  L.push(`**Verdict: ${j.verdict}: ${lead}.** ${line('Fade', F)}. ${line('Follow', W)}.`, '');
  L.push(`Pre-registered in \`PREREGISTRATION.md\` (committed before any figure was computed). Rule: ${j.rule}. Costs, round trip in points (spread + 0.5 slippage a side): NAS100 ${j.costs.nas100}, SPX500 ${j.costs.spx500}, US30 ${j.costs.us30}; no financing (intraday). Data: OANDA mid M5 candles through the candle proxy; NYSE calendar stated in the pre-registration (half days skipped). Not the intraday-momentum study (that one: previous close to 10:00 on every day, traded 15:30-16:00 with it).`, '');
  L.push('## Pass bar, per variant', '', '| variant | net R > 0 (2016 →) | t ≥ 2 (months) | 2010-15 net R > 0 | p (one-sided) | Holm p | Holm < 0.05 | beats placebo 95th pct | pass |', '|---|---|---|---|---|---|---|---|---|');
  for (const [lab, x] of [['Fade', F], ['Follow', W]]) L.push(`| ${lab} | ${yn(x.pass.netOk)} (${sg(x.D.net)}) | ${yn(x.pass.tOk)} (${sg(x.D.tMonths, 2)}) | ${yn(x.pass.repOk)} (${sg(x.R.net)}) | ${x.pass.p.toFixed(3)} | ${x.pass.holm.toFixed(3)} | ${yn(x.pass.holmOk)} | ${yn(x.pass.placeboOk)} (${sg(x.placebo.q95)}) | ${yn(x.pass.ok)} |`);
  L.push('', '## Per variant, market and window', '', '| variant | market | window | n | net R a trade | t (months) | t (trades) | gross R | cost R | win | stopped | total net R |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const v of ['fade', 'follow']) {
    const rows = [...Object.keys(j.markets).map((s) => [j.data[s].name, j.markets[s][v]]), ['pooled', j.variants[v]]];
    for (const [nm, x] of rows) for (const [k, lab] of [['R', '2010-2015'], ['D', '2016 → now']]) { const w = x[k];
      L.push(`| ${v === 'fade' ? 'Fade' : 'Follow'} | ${nm} | ${lab} | ${w.n} | ${sg(w.net)} | ${sg(w.tMonths, 2)} | ${sg(w.tTrades, 2)} | ${sg(w.gross)} | ${w.costR.toFixed(3)} | ${pc(w.win)} | ${w.stops} | ${sg(w.total, 1)} |`); }
  }
  L.push('', '## Placebo (decisive window)', '', 'Per seed and market, as many random eligible days of 2016 → now as the variant has trades there (big or not), same side rule, entry, stop, exit and costs; the statistic is the pooled net R a trade.', '');
  L.push('| variant | actual | placebo mean | 95th pct (38th of 40) | max | seeds beaten |', '|---|---|---|---|---|---|');
  for (const [lab, x] of [['Fade', F], ['Follow', W]]) L.push(`| ${lab} | ${sg(x.D.net)} | ${sg(x.placebo.mean)} | ${sg(x.placebo.q95)} | ${sg(x.placebo.max)} | ${x.placebo.beats} / 40 |`);
  L.push('', '## Pooled net R by year (descriptive)', '', '| year | Fade n | Fade net R a trade | Fade total | Follow n | Follow net R a trade | Follow total |', '|---|---|---|---|---|---|---|');
  for (const y of Object.keys(F.byYear)) { const a = F.byYear[y], b = W.byYear[y] || {};
    L.push(`| ${y} | ${a.n} | ${sg(a.net)} | ${sg(a.total, 1)} | ${b.n ?? 0} | ${sg(b.net)} | ${sg(b.total, 1)} |`); }
  L.push('', '## Days', '');
  for (const s of Object.keys(j.data)) { const d = j.data[s];
    L.push(`- ${d.name}: ${d.days} eligible days with a signal after the warm-up (from 1 Oct 2009), ${d.big} of them big days; ${d.skipped.noData} days without a 09:30 / 15:00 price or with fewer than 50 of 66 candles, ${d.skipped.warmup} warm-up days, ${d.skipped.noExit} days without a 16:00 price.`); }
  L.push('', '## Reading', '');
  L.push(j.verdict === 'PASS'
    ? 'At least one variant met every pre-registered line. This is a hypothesis for a forward paper shadow, never a live rule; see the proposal.'
    : 'No variant met the pre-registered bar. Neither fading nor following a big day into the cash close is an edge on these feeds after costs; no proposal is written and nothing live changes. Never call it an edge.');
  L.push('', `Post hoc, decides nothing: before costs both variants are within 0.03R of zero (fade ${sg(F.R.gross)}R, t ${sg(F.R.tGross, 2)} / ${sg(F.D.gross)}R, t ${sg(F.D.tGross, 2)}; follow ${sg(W.R.gross)}R, t ${sg(W.R.tGross, 2)} / ${sg(W.D.gross)}R, t ${sg(W.D.tGross, 2)}, in 2010-15 / 2016 → now, t over trades). The small continuation before costs in 2010-15 did not hold after 2015 and is a fraction of the cost; the net loss is the cost. Both variants beat 39 of 40 placebo seeds only because a big day has a wider 09:30-15:00 range, so a wider stop and a smaller cost in R, than a random day: the placebo's lead is the cost share, not a drift.`);
  L.push('', 'To repeat: `node --use-env-proxy research/edge/last-hour/fetch.mjs <dir>`, then `node research/edge/last-hour/run.mjs <dir>`. Test: `tests/last-hour.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candle dir>');
  const markets = MARKETS.map((sym) => {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${sym}-5m.json.gz`))).toString());
    return runMarket(toBars(rows), sym);
  });
  const j = build(markets);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(j, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), render(j));
  console.log(j.verdict, JSON.stringify(Object.fromEntries(VARIANTS.map((v) => [v, { D: j.variants[v].D, R: j.variants[v].R.net, pl: j.variants[v].placebo.q95 }]))));
}
