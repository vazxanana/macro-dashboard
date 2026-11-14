// Edge research · index-midday-turn: does the US cash-session morning move (09:30-11:30 New York) of NAS100 / SPX500 CFDs
// predict the midday window (11:30-14:00) the other way (fade) or the same way (follow)? Rules, calendar, costs, windows,
// statistics, placebo and pass bar: PREREGISTRATION.md (committed first).
//   node --use-env-proxy research/edge/index-midday-turn/fetch.mjs <dir>   (OANDA M5 candles, kept out of git)
//   node research/edge/index-midday-turn/run.mjs <dir>                     (writes result.json and RESULT.md here)
// The NYSE calendar and the statistics helpers are copied from research/edge/intraday-momentum/run.mjs (another branch; never
// imported across branches). Pure pieces are exported for tests/index-midday-turn.test.mjs. Paper research only: nothing live
// reads this.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { zonedToUtc } from '../../../council/events.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const M5 = 300, US = 'America/New_York';
export const P = Object.freeze({
  ATR: 20, K: 1, MED: 20, FILT: 0.25, COST: 0.0004, COST2: 0.0008, LOOK: 600,
  SEEDS: 40, Q: 0.95, ALPHA: 0.05, NMIN: 200,
  ENTRY: '11:30', EXIT: '14:00', OPEN: '09:30', HOLD: 150,
  FROM: '2007-10-01', TO: '2026-11-13',
  WIN: Object.freeze({ R: ['2007-10-01', '2016-01-01'], D: ['2016-01-01', '2026-11-14'] }),
});
export const MARKETS = ['nas100', 'spx500'];
const NAME = { spx500: 'SPX500', nas100: 'NAS100' };
export const TESTS = Object.freeze([
  { id: 'T1', sym: 'nas100', side: 'fade' }, { id: 'T2', sym: 'nas100', side: 'follow' },
  { id: 'T3', sym: 'spx500', side: 'fade' }, { id: 'T4', sym: 'spx500', side: 'follow' },
]);

// ── the NYSE calendar (copied from intraday-momentum; stated in PREREGISTRATION.md) ──
const iso = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const wdOf = (s) => new Date(s + 'T12:00:00Z').getUTCDay();
export const addDays = (s, k) => new Date(Date.parse(s + 'T12:00:00Z') + k * 864e5).toISOString().slice(0, 10);
function nthWd(y, m, wd, n) {
  if (n > 0) { const f = new Date(Date.UTC(y, m, 1)).getUTCDay(); return iso(y, m, 1 + ((wd - f + 7) % 7) + 7 * (n - 1)); }
  const last = new Date(Date.UTC(y, m + 1, 0)), l = last.getUTCDay(); return iso(y, m, last.getUTCDate() - ((l - wd + 7) % 7));
}
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(y, mo - 1, da);
}
const obsBoth = (s) => { const w = wdOf(s); return w === 6 ? addDays(s, -1) : w === 0 ? addDays(s, 1) : s; };
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
// eligible days = full NYSE trading days from a to b inclusive
export function eligibleDays(a, b) {
  const out = []; for (let s = a; s <= b; s = addDays(s, 1)) if (nyseDay(s) === 'open') out.push(s);
  return out;
}
export const nyT = (date, hhmm) => zonedToUtc(date, hhmm, US);
const hm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// ── candles ──
export function toBars(rows) {
  const n = rows.length, b = { t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n), n };
  rows.forEach((r, i) => { b.t[i] = r[0]; b.o[i] = r[1]; b.h[i] = r[2]; b.l[i] = r[3]; b.c[i] = r[4]; });
  return b;
}
// index of the last candle whose END is at or before `end` and within LOOK of it; -1 if none
export function lastEnding(b, end, look = P.LOOK) {
  let lo = 0, hi = b.n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] + M5 <= end) lo = m + 1; else hi = m; }
  const i = lo - 1;
  return i >= 0 && b.t[i] + M5 >= end - look ? i : -1;
}
export const pxAt = (b, end) => { const i = lastEnding(b, end); return i < 0 ? null : b.c[i]; };
const firstFrom = (b, t) => { let lo = 0, hi = b.n; while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] < t) lo = m + 1; else hi = m; } return lo; };

// daily candles: one per weekday, M5 candles starting in [17:00 NY of the day before, 17:00 NY of that day)
export function dailyCandles(b, from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const w = wdOf(d); if (w === 0 || w === 6) continue;
    const a = nyT(addDays(d, -1), '17:00'), z = nyT(d, '17:00');
    let i = firstFrom(b, a); if (i >= b.n || b.t[i] >= z) continue;
    let h = -Infinity, l = Infinity; const o = b.o[i]; let c = o;
    for (; i < b.n && b.t[i] < z; i++) { if (b.h[i] > h) h = b.h[i]; if (b.l[i] < l) l = b.l[i]; c = b.c[i]; }
    out.push({ date: d, end: z, o, h, l, c });
  }
  return out;
}
// ATR20 per trading date: the mean true range of the 20 last daily candles dated before d (they end by 17:00 NY of d - 1)
export function atrMap(daily, n = P.ATR) {
  const tr = []; const m = new Map();
  for (let i = 1; i < daily.length; i++) {
    const p = daily[i - 1].c, x = daily[i];
    tr.push({ date: x.date, v: Math.max(x.h, p) - Math.min(x.l, p) });
  }
  return (date) => {
    if (m.has(date)) return m.get(date);
    let lo = 0, hi = tr.length; while (lo < hi) { const k = (lo + hi) >> 1; if (tr[k].date < date) lo = k + 1; else hi = k; }
    const v = lo >= n ? tr.slice(lo - n, lo).reduce((s, x) => s + x.v, 0) / n : null;
    m.set(date, v); return v;
  };
}

// one trade from tE to tX with a stop `dist` away; candles that START in [tE, tX)
export function trade(b, tE, tX, pE, pX, side, dist, cost = P.COST) {
  const stop = pE - side * dist;
  let exit = pX, how = 'time';
  for (let i = firstFrom(b, tE); i < b.n && b.t[i] < tX; i++) {
    if (side > 0 ? b.o[i] <= stop : b.o[i] >= stop) { exit = b.o[i]; how = 'gap'; break; }
    if (side > 0 ? b.l[i] <= stop : b.h[i] >= stop) { exit = stop; how = 'stop'; break; }
  }
  const R = side * (exit - pE) / dist, cR = cost * pE / dist;
  return { side, entry: pE, stop, dist, exit, how, R, net: R - cR, net2: R - 2 * cR };
}

// the day's morning move and the midday prices; nothing that ends after 14:00 New York
export function dayPrices(b, d) {
  const t0 = nyT(d, P.OPEN), tE = nyT(d, P.ENTRY), tX = nyT(d, P.EXIT);
  return { t0, tE, tX, p0: pxAt(b, t0), pE: pxAt(b, tE), pX: pxAt(b, tX) };
}
export const morningOf = (p0, pE) => pE / p0 - 1;
export const median = (xs) => { const s = [...xs].sort((a, c) => a - c), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

// ── one market: every eligible day; the morning move, the filter and both sides ──
export function runMarket(b, days = eligibleDays(P.FROM, P.TO)) {
  const atr = atrMap(dailyCandles(b, addDays(days[0], -60), days.at(-1)));
  const recs = [], skipped = { noPrice: 0, warmup: 0, noAtr: 0, flat: 0, small: 0 }, hist = [];
  for (const d of days) {
    const px = dayPrices(b, d);
    if ([px.p0, px.pE, px.pX].some((v) => v == null)) { skipped.noPrice++; continue; }
    const m = morningOf(px.p0, px.pE), A = atr(d), rec = { date: d, m, mid: px.pX / px.pE - 1, A };
    if (hist.length < P.MED) skipped.warmup++;
    else if (A == null || !(A > 0)) skipped.noAtr++;
    else {
      rec.ready = true;
      const M = median(hist.slice(-P.MED));
      if (m === 0) skipped.flat++;
      else if (Math.abs(m) < P.FILT * M) skipped.small++;
      else {
        const s = Math.sign(m);
        rec.follow = trade(b, px.tE, px.tX, px.pE, px.pX, s, P.K * A);
        rec.fade = trade(b, px.tE, px.tX, px.pE, px.pX, -s, P.K * A);
      }
    }
    recs.push(rec); hist.push(Math.abs(m));
  }
  return { recs, skipped };
}

// ── statistics (copied helpers) ──
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
export function ols(xs, ys) {
  const n = xs.length; if (n < 3) return { n, slope: null };
  const mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
  let sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  const b = sxy / sxx, a = my - b * mx;
  let sse = 0, sst = 0, hc = 0;
  for (let i = 0; i < n; i++) { const e = ys[i] - a - b * xs[i]; sse += e * e; sst += (ys[i] - my) ** 2; hc += (xs[i] - mx) ** 2 * e * e; }
  return { n, intercept: a, slope: b, tOls: b / Math.sqrt(sse / (n - 2) / sxx), tWhite: b / (Math.sqrt(hc) / sxx), r2: 1 - sse / sst };
}
// t on calendar-month sums of [{ date, v }]
export function monthT(rows) {
  const by = new Map(); for (const r of rows) { const k = r.date.slice(0, 7); by.set(k, (by.get(k) || 0) + r.v); }
  const s = tstat([...by.values()]); return { months: s.n, t: s.t };
}

// ── the placebo: random other 2.5-hour cash-session windows with a random sign, on the days the tests trade ──
export const PLACEBO_STARTS = Object.freeze(Array.from({ length: (13 * 60 + 30 - (9 * 60 + 30)) / 5 + 1 }, (_, k) => 9 * 60 + 30 + 5 * k).filter((x) => x !== 11 * 60 + 30));
export function placebo(b, recs, [a, z], seeds = P.SEEDS) {
  const days = recs.filter((r) => r.follow && r.date >= a && r.date < z), out = [];
  for (let s = 1; s <= seeds; s++) {
    const rnd = mulberry32(s), rows = [];
    for (const r of days) {
      const st = PLACEBO_STARTS[Math.floor(rnd() * PLACEBO_STARTS.length)], side = rnd() < 0.5 ? -1 : 1;
      const tE = nyT(r.date, hm(st)), tX = nyT(r.date, hm(st + P.HOLD)), pE = pxAt(b, tE), pX = pxAt(b, tX);
      if (pE == null || pX == null) continue;
      rows.push({ date: r.date, v: trade(b, tE, tX, pE, pX, side, P.K * r.A).net });
    }
    const st = tstat(rows.map((x) => x.v));
    out.push({ seed: s, n: rows.length, net: st.mean, t: monthT(rows).t });
  }
  return out;
}

const r4 = (v) => v == null || !Number.isFinite(v) ? null : Math.round(v * 1e4) / 1e4;
export function summarize(recs, side, [a, z]) {
  const tr = recs.filter((r) => r[side] && r.date >= a && r.date < z), x = tr.map((r) => r[side]);
  const net = tstat(x.map((q) => q.net)), gross = tstat(x.map((q) => q.R)), net2 = tstat(x.map((q) => q.net2));
  const mt = monthT(tr.map((r) => ({ date: r.date, v: r[side].net }))), mg = monthT(tr.map((r) => ({ date: r.date, v: r[side].R })));
  const mt2 = monthT(tr.map((r) => ({ date: r.date, v: r[side].net2 })));
  return {
    from: tr[0]?.date ?? null, to: tr.at(-1)?.date ?? null, n: net.n, months: mt.months,
    gross: r4(gross.mean), net: r4(net.mean), net2: r4(net2.mean), t: r4(mt.t), tGross: r4(mg.t), t2: r4(mt2.t),
    totalNet: r4(x.reduce((s, q) => s + q.net, 0)), costR: r4(x.reduce((s, q) => s + (q.R - q.net), 0) / (x.length || 1)),
    win: r4(x.filter((q) => q.net > 0).length / (x.length || 1)), stops: x.filter((q) => q.how !== 'time').length,
  };
}
export function byYear(recs, side) {
  const y = {};
  for (const r of recs) if (r[side]) (y[r.date.slice(0, 4)] ||= []).push(r[side].net);
  return Object.fromEntries(Object.entries(y).map(([k, xs]) => [k, { n: xs.length, net: r4(xs.reduce((a, q) => a + q, 0) / xs.length), total: r4(xs.reduce((a, q) => a + q, 0)) }]));
}
function regOf(recs, [a, z]) {
  const w = recs.filter((r) => r.ready && r.date >= a && r.date < z), g = ols(w.map((r) => r.m * 100), w.map((r) => r.mid * 100));
  return { n: g.n, slope: r4(g.slope), tOls: r4(g.tOls), tWhite: r4(g.tWhite), r2: r4(g.r2) };
}
const q95 = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(P.Q * s.length) - 1)]; };

export function build(markets, plac) {
  const out = { study: 'index-midday-turn', built: '2026-11-14', preregistration: 'research/edge/index-midday-turn/PREREGISTRATION.md',
    rule: 'morning move = 09:30 to 11:30 New York; skip when |move| < 0.25 x the 20-day median |move|; enter 11:30, exit 14:00 New York; fade = against the move, follow = with it; stop 1 x the 20-day ATR of daily candles',
    costs: { roundTrip: P.COST, check: P.COST2, financing: 'none (intraday)' },
    windows: { replication: 'data start → 2015-12-31', decisive: '2016-01-01 → 2026-11-13' }, markets: {}, tests: {} };
  for (const [sym, { recs, skipped }] of Object.entries(markets)) {
    const pl = plac[sym];
    out.markets[sym] = { name: NAME[sym], skipped,
      reg: { replication: regOf(recs, P.WIN.R), decisive: regOf(recs, P.WIN.D) },
      placebo: { seeds: pl.length, n: pl[0]?.n ?? 0, mean: r4(pl.reduce((s, x) => s + x.net, 0) / (pl.length || 1)), q95: r4(q95(pl.map((x) => x.net))),
        max: r4(Math.max(...pl.map((x) => x.net))), tQ95: r4(q95(pl.map((x) => x.t))), bySeed: pl.map((x) => ({ seed: x.seed, n: x.n, net: r4(x.net), t: r4(x.t) })) } };
  }
  const ps = TESTS.map((T) => { const s = summarize(markets[T.sym].recs, T.side, P.WIN.D); return s.t == null ? 1 : normSf(s.t); }), hp = holm(ps);
  TESTS.forEach((T, i) => {
    const recs = markets[T.sym].recs, rep = summarize(recs, T.side, P.WIN.R), dec = summarize(recs, T.side, P.WIN.D), pl = out.markets[T.sym].placebo;
    const pass = { p: r4(ps[i]), holm: r4(hp[i]), bothPositive: dec.net > 0 && rep.net > 0, holmOk: hp[i] < P.ALPHA, nOk: dec.n >= P.NMIN };
    pass.ok = pass.bothPositive && pass.holmOk && pass.nOk;
    out.tests[T.id] = { market: T.sym, name: NAME[T.sym], side: T.side, replication: rep, decisive: dec, byYear: byYear(recs, T.side), pass,
      placebo: { beats: pl.bySeed.filter((x) => dec.net > x.net).length, q95: pl.q95, mean: pl.mean } };
  });
  out.verdict = TESTS.some((T) => out.tests[T.id].pass.ok) ? 'PASS' : 'FAIL';
  return out;
}

// ── report ──
const sg = (v, d = 3) => v == null ? 'n/a' : (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d);
const pc = (v) => v == null ? 'n/a' : (v * 100).toFixed(1) + ' %';
const sideTxt = (s) => s === 'fade' ? 'fade' : 'follow';
export function render(j) {
  const L = [], T = j.tests;
  L.push('# The US cash-session midday turn on index CFDs: result', '');
  const line = (id) => { const x = T[id], d = x.decisive; return `${id} ${x.name} ${sideTxt(x.side)}: n ${d.n}, ${sg(d.net)}R a trade net (month-sum t ${sg(d.t, 2)}), before costs ${sg(d.gross)}R; Holm p ${x.pass.holm.toFixed(3)}`; };
  L.push(`**Verdict: ${j.verdict}.** Decisive window 2016 → now: ${['T1', 'T2', 'T3', 'T4'].map(line).join('. ')}.`, '');
  L.push('Pre-registered in `PREREGISTRATION.md` (committed before any figure was computed). Rule: ' + j.rule + '. Costs: 0.04 % of notional round trip (a check at 0.08 %), no financing. Data: OANDA mid M5 candles through the candle proxy; the NYSE calendar stated in the pre-registration (half days skipped). Paper research only: nothing live changed.', '');
  L.push('This is not the `intraday-momentum` study: that one traded the last half hour (15:30-16:00) on the sign of the previous close to 10:00 and followed only; this one reads the cash-session morning (09:30-11:30, no overnight gap) and trades 11:30-14:00 both ways.', '');
  L.push('## Per test and window', '');
  L.push('| test | market | side | window | trades | months | gross R | net R | net R at 2x | t (month sums) | t gross | t at 2x | cost R | win | stops | total net R |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const id of ['T1', 'T2', 'T3', 'T4']) for (const [k, lab] of [['replication', 'to 2015'], ['decisive', '2016 → now']]) { const x = T[id], w = x[k];
    L.push(`| ${id} | ${x.name} | ${sideTxt(x.side)} | ${lab} | ${w.n} | ${w.months} | ${sg(w.gross)} | ${sg(w.net)} | ${sg(w.net2)} | ${sg(w.t, 2)} | ${sg(w.tGross, 2)} | ${sg(w.t2, 2)} | ${w.costR.toFixed(3)} | ${pc(w.win)} | ${w.stops} | ${sg(w.totalNet, 1)} |`); }
  L.push('', 'Replication window: first trade ' + T.T1.replication.from + ' (NAS100) / ' + T.T3.replication.from + ' (SPX500) to 2015-12-31.', '');
  L.push('## Pass bar', '', 'Per test: net R a trade > 0 in both windows, decisive Holm p < 0.05 over the four tests, decisive n ≥ 200.', '');
  L.push('| test | p (one-sided) | Holm p | net > 0 both windows | Holm < 0.05 | n ≥ 200 | pass |', '|---|---|---|---|---|---|---|');
  for (const id of ['T1', 'T2', 'T3', 'T4']) { const p = T[id].pass;
    L.push(`| ${id} | ${p.p.toFixed(3)} | ${p.holm.toFixed(3)} | ${p.bothPositive ? 'yes' : 'no'} | ${p.holmOk ? 'yes' : 'no'} | ${p.nOk ? 'yes' : 'no'} | ${p.ok ? 'yes' : 'no'} |`); }
  L.push('', '## Placebo (decides nothing)', '', 'Per market, 40 seeds: on the same decisive days, a random 2.5-hour cash-session window (start 09:30 to 13:30 on the 5-minute grid, not 11:30) with a random side, the same ATR stop and cost.', '');
  L.push('| market | trades a seed | placebo mean net R | 95th pct | max | 95th pct of t | fade beats seeds | follow beats seeds |', '|---|---|---|---|---|---|---|---|');
  for (const [sym, f, w] of [['nas100', 'T1', 'T2'], ['spx500', 'T3', 'T4']]) { const p = j.markets[sym].placebo;
    L.push(`| ${j.markets[sym].name} | ${p.n} | ${sg(p.mean)} | ${sg(p.q95)} | ${sg(p.max)} | ${sg(p.tQ95, 2)} | ${T[f].placebo.beats} / 40 | ${T[w].placebo.beats} / 40 |`); }
  L.push('', '## Midday return on the morning move (descriptive)', '', 'OLS of P(14:00) / P(11:30) − 1 on the morning move, both in %, every eligible day with prices after the warm-ups (filtered or not). A negative slope leans to a reversal, a positive one to continuation.', '');
  L.push('| market | window | n | slope | t (OLS) | t (White) | R² |', '|---|---|---|---|---|---|---|');
  for (const sym of ['nas100', 'spx500']) for (const [k, lab] of [['replication', 'to 2015'], ['decisive', '2016 → now']]) { const r = j.markets[sym].reg[k];
    L.push(`| ${j.markets[sym].name} | ${lab} | ${r.n} | ${sg(r.slope, 4)} | ${sg(r.tOls, 2)} | ${sg(r.tWhite, 2)} | ${(r.r2 * 100).toFixed(2)} % |`); }
  L.push('', '## Net R a trade by year (descriptive)', '', '| year | T1 n | T1 NAS100 fade | T2 NAS100 follow | T3 n | T3 SPX500 fade | T4 SPX500 follow |', '|---|---|---|---|---|---|---|');
  const yrs = [...new Set(['T1', 'T3'].flatMap((id) => Object.keys(T[id].byYear)))].sort();
  for (const y of yrs) { const a = T.T1.byYear[y] || {}, b = T.T2.byYear[y] || {}, c = T.T3.byYear[y] || {}, e = T.T4.byYear[y] || {};
    L.push(`| ${y} | ${a.n ?? 0} | ${sg(a.net)} | ${sg(b.net)} | ${c.n ?? 0} | ${sg(c.net)} | ${sg(e.net)} |`); }
  L.push('', '## Days left out', '');
  for (const sym of ['nas100', 'spx500']) { const s = j.markets[sym].skipped;
    L.push(`- ${j.markets[sym].name}: ${s.noPrice} eligible days without a price at 09:30, 11:30 or 14:00; ${s.warmup} days of the 20-day median warm-up; ${s.noAtr} without a 20-day ATR; ${s.flat} with a zero morning move; ${s.small} with a morning move under 0.25 x the 20-day median.`); }
  L.push('', '## Reading', '');
  L.push(j.verdict === 'PASS'
    ? 'At least one test met every pre-registered line. This is a hypothesis for a forward paper shadow that the owner decides on, never a live rule; read the placebo and the by-year table before anything else.'
    : 'No test met the pre-registered bar. Neither fading nor following the morning move over the midday window is an edge on these feeds after costs; no proposal is written and nothing live changes. Never call it an edge.');
  const N = j.markets.nas100, S = j.markets.spx500;
  L.push('', `Descriptive, decides nothing: there is no midday turn. Fading the morning loses before costs in 2016 → now on both markets (NAS100 ${sg(T.T1.decisive.gross)}R, t ${sg(T.T1.decisive.tGross, 2)}; SPX500 ${sg(T.T3.decisive.gross)}R, t ${sg(T.T3.decisive.tGross, 2)}), and the midday return leans the other way, a little: the slope on the morning move is positive in every market and window (2016 → now NAS100 ${sg(N.reg.decisive.slope, 4)}, White t ${sg(N.reg.decisive.tWhite, 2)}; SPX500 ${sg(S.reg.decisive.slope, 4)}, White t ${sg(S.reg.decisive.tWhite, 2)}). Following it makes ${sg(T.T2.decisive.gross)}R (NAS100) and ${sg(T.T4.decisive.gross)}R (SPX500) a trade before costs, under the round trip of ${T.T2.decisive.costR.toFixed(3)}R and ${T.T4.decisive.costR.toFixed(3)}R, and near zero before costs to 2015. Every random cash-session window with a random side loses about its cost (placebo means ${sg(N.placebo.mean)}R and ${sg(S.placebo.mean)}R), so "follow beats most seeds" only says it loses less than paying the spread for nothing; it is not a reason to trade it.`);
  L.push('', 'To repeat: `node --use-env-proxy research/edge/index-midday-turn/fetch.mjs <dir>`, then `node research/edge/index-midday-turn/run.mjs <dir>`. Test: `tests/index-midday-turn.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candle dir>');
  const mk = {}, pl = {};
  for (const sym of MARKETS) {
    const b = toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${sym}-5m.json.gz`)))));
    mk[sym] = runMarket(b); pl[sym] = placebo(b, mk[sym].recs, P.WIN.D);
  }
  const j = build(mk, pl);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(j, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), render(j));
  console.log(render(j).split('\n').slice(0, 3).join('\n'));
}
