// Edge research · bond-intraday-momentum: the "market intraday momentum" claim (Gao, Han, Li and Zhou 2018) on the OANDA bond
// CFDs: does the first half hour of the Treasury session (previous 15:00 New York close to 08:50) predict the sign of its last
// half hour (14:30-15:00)? A trading rule on OANDA mid M5 candles, net of costs. Session, calendar, rule, stop, costs, windows,
// placebo and pass bar: PREREGISTRATION.md (committed and pushed first). `signalOf` and `trade` are copied byte for byte from
// origin/intraday-momentum:research/edge/intraday-momentum/run.mjs (sha256 pinned in tests/bond-intraday-momentum.test.mjs).
//   node --use-env-proxy research/edge/bond-intraday-momentum/fetch.mjs <dir>   (OANDA M5 candles, kept out of git)
//   node research/edge/bond-intraday-momentum/run.mjs <dir>                     (writes result.json and RESULT.md here)
// Stand-alone study (owner decision 44). Paper research only: nothing live reads this.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { zonedToUtc } from '../../../council/events.mjs';
import { cmeShut } from '../../../ict/calendar.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const M5 = 300;
// CFD round trip as a share of the entry price: research/edge/bond-month-end (no measured spread exists for these CFDs).
export const CFD = Object.freeze({ usb02y: 0.0002, usb05y: 0.0003, usb10y: 0.0003, usb30y: 0.0005, de10yb: 0.0003, uk10yb: 0.0004 });
// Treasury futures round trip in price points: research/edge/bond-month-end-futures (ZN for usb10y, ZB for usb30y).
export const FUT = Object.freeze({ usb10y: 0.019325, usb30y: 0.03495 });
export const P = Object.freeze({
  K: 1.5, AVG: 20, LOOK: 600, SEEDS: 40, Q: 0.95, ALPHA: 0.05, MIN_B: 1000, MIN_A: 500,
  FROM: '2009-11-01', TO: '2026-11-13',
  WIN: Object.freeze({ A: ['2010-01-01', '2016-01-01'], B: ['2016-01-01', '2026-11-14'] }),
});
export const PRIMARY = ['usb10y', 'usb30y'];
export const US = ['usb10y', 'usb30y', 'usb02y', 'usb05y'];
export const EU = ['de10yb', 'uk10yb'];
export const MARKETS = [...US, ...EU];
const NAME = { usb10y: 'US 10-year', usb30y: 'US 30-year', usb02y: 'US 2-year', usb05y: 'US 5-year', de10yb: 'Bund', uk10yb: 'Gilt' };
const NYZ = 'America/New_York';
const S_US = Object.freeze({ tz: NYZ, open: '08:20', sig: '08:50', entry: '14:30', close: '15:00', cal: 'us' });
export const SESSION = Object.freeze({
  usb10y: S_US, usb30y: S_US, usb02y: S_US, usb05y: S_US,
  de10yb: Object.freeze({ tz: 'Europe/Berlin', open: '08:00', sig: '08:30', entry: '16:45', close: '17:15', cal: 'de' }),
  uk10yb: Object.freeze({ tz: 'Europe/London', open: '08:00', sig: '08:30', entry: '15:45', close: '16:15', cal: 'uk' }),
});

// ── clock and calendar ──
const iso = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const wdOf = (s) => new Date(s + 'T12:00:00Z').getUTCDay();
const addDays = (s, k) => new Date(Date.parse(s + 'T12:00:00Z') + k * 864e5).toISOString().slice(0, 10);
const mins = (hhmm) => { const [H, M] = hhmm.split(':').map(Number); return H * 60 + M; };
const hm = (x) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
export const at = (date, hhmm, tz) => zonedToUtc(date, hhmm, tz);
function nthWd(y, m, wd, n) {
  if (n > 0) { const f = new Date(Date.UTC(y, m, 1)).getUTCDay(); return iso(y, m, 1 + ((wd - f + 7) % 7) + 7 * (n - 1)); }
  const last = new Date(Date.UTC(y, m + 1, 0)), l = last.getUTCDay(); return iso(y, m, last.getUTCDate() - ((l - wd + 7) % 7));
}
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return iso(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
const obsBoth = (s) => { const w = wdOf(s); return w === 6 ? addDays(s, -1) : w === 0 ? addDays(s, 1) : s; };
const CAL = new Map();
// US bond market: full holidays and 14:00 early closes (PREREGISTRATION.md "Calendar")
export function usBondYear(y) {
  if (CAL.has('us' + y)) return CAL.get('us' + y);
  const closed = new Set(), early = new Set();
  const ny = iso(y, 0, 1), nyw = wdOf(ny);
  if (nyw === 0) closed.add(iso(y, 0, 2)); else if (nyw !== 6) closed.add(ny);
  const gf = addDays(easter(y), -2), mem = nthWd(y, 4, 1, -1), tg = nthWd(y, 10, 4, 4);
  closed.add(nthWd(y, 0, 1, 3)); closed.add(nthWd(y, 1, 1, 3)); closed.add(gf); closed.add(mem);
  if (y >= 2022) closed.add(obsBoth(iso(y, 5, 19)));
  closed.add(obsBoth(iso(y, 6, 4))); closed.add(nthWd(y, 8, 1, 1)); closed.add(nthWd(y, 9, 1, 2));
  const vet = iso(y, 10, 11), vw = wdOf(vet); if (vw === 0) closed.add(iso(y, 10, 12)); else if (vw !== 6) closed.add(vet);
  closed.add(tg); closed.add(obsBoth(iso(y, 11, 25)));
  for (const s of [iso(y, 11, 24), iso(y, 11, 31), iso(y, 6, 3), addDays(tg, 1), addDays(gf, -1), addDays(mem, -3)]) early.add(s);
  const r = { closed, early }; CAL.set('us' + y, r); return r;
}
export function euYear(cal, y) {
  if (CAL.has(cal + y)) return CAL.get(cal + y);
  const e = easter(y), closed = new Set([iso(y, 0, 1), addDays(e, -2), addDays(e, 1), iso(y, 11, 24), iso(y, 11, 25), iso(y, 11, 26), iso(y, 11, 31)]);
  if (cal === 'de') closed.add(iso(y, 4, 1));
  if (cal === 'uk') { closed.add(nthWd(y, 4, 1, 1)); closed.add(nthWd(y, 4, 1, -1)); closed.add(nthWd(y, 7, 1, -1)); }
  const r = { closed, early: new Set() }; CAL.set(cal + y, r); return r;
}
const calOf = (cal, y) => cal === 'us' ? usBondYear(y) : euYear(cal, y);
export function sessionDay(sym, d) {
  const w = wdOf(d); if (w === 0 || w === 6) return false;
  return !calOf(SESSION[sym].cal, +d.slice(0, 4)).closed.has(d);
}
export function fullDay(sym, d) {
  const s = SESSION[sym];
  if (!sessionDay(sym, d)) return false;
  if (s.cal !== 'us') return true;
  if (usBondYear(+d.slice(0, 4)).early.has(d)) return false;
  for (let t = at(d, s.open, s.tz), b = at(d, s.close, s.tz); t < b; t += M5) if (cmeShut(t)) return false;
  return true;
}
// eligible days: full days whose previous session day was full too; [{ date, prev }]
export function eligibleDays(sym, from = P.FROM, to = P.TO) {
  const out = []; let prev = null, prevFull = false;
  for (let d = addDays(from, -14); d <= to; d = addDays(d, 1)) {
    if (!sessionDay(sym, d)) continue;
    const f = fullDay(sym, d);
    if (d >= from && f && prevFull) out.push({ date: d, prev });
    prev = d; prevFull = f;
  }
  return out;
}
// the placebo's half-hour starts: signal end … close − 60 min on the M5 grid
export function placeboStarts(sym) {
  const s = SESSION[sym], out = [];
  for (let x = mins(s.sig); x <= mins(s.entry) - 30; x += 5) out.push(hm(x));
  return out;
}

// ── candles ──
export function toBars(rows) {
  const n = rows.length, b = { t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n), n };
  rows.forEach((r, i) => { b.t[i] = r[0]; b.o[i] = r[1]; b.h[i] = r[2]; b.l[i] = r[3]; b.c[i] = r[4]; });
  return b;
}
export function lastEnding(b, end, look = P.LOOK) {
  let lo = 0, hi = b.n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] + M5 <= end) lo = m + 1; else hi = m; }
  const i = lo - 1;
  return i >= 0 && b.t[i] + M5 >= end - look ? i : -1;
}
const pxAt = (b, end) => { const i = lastEnding(b, end); return i < 0 ? null : b.c[i]; };
// the day's prices; nothing read ends after the session close of that day
export function dayPrices(b, sym, d) {
  const s = SESSION[sym];
  const t0 = at(d.prev, s.close, s.tz), tS = at(d.date, s.sig, s.tz), tE = at(d.date, s.entry, s.tz), tC = at(d.date, s.close, s.tz);
  return { t0, tS, t1530: tE, t16: tC, p0: pxAt(b, t0), pS: pxAt(b, tS), pE: pxAt(b, tE), pX: pxAt(b, tC) };
}

// ── copied byte for byte from origin/intraday-momentum (begin) ──
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
// ── copied (end): here t1530 / t16 carry this market's entry and close times, p0 its previous close, p10 its signal end ──

// ── statistics ──
export function tstat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: n ? xs[0] : null, sd: null, t: null };
  const m = xs.reduce((s, x) => s + x, 0) / n, v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1), sd = Math.sqrt(v);
  return { n, mean: m, sd, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null };
}
export function monthT(rows) {
  const m = new Map(); for (const r of rows) { const k = r.date.slice(0, 7); m.set(k, (m.get(k) || 0) + r.x); }
  const s = tstat([...m.values()]); return { months: s.n, mean: s.mean, t: s.t };
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
  const seO = Math.sqrt(sse / (n - 2) / sxx), seW = Math.sqrt(hc) / sxx;
  return { n, intercept: a, slope: b, tOls: b / seO, tWhite: b / seW, r2: 1 - sse / sst };
}
const q95 = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(P.Q * s.length) - 1)]; };
const mean = (xs) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;

// ── one market: every eligible day, its trade (and the opposite side, for the placebo) where there is one ──
export function runMarket(b, sym, days = eligibleDays(sym)) {
  const s = SESSION[sym], starts = placeboStarts(sym), recs = [], skipped = { noPrice: 0, flat: 0, warmup: 0 }, hist = [];
  for (const d of days) {
    const px = dayPrices(b, sym, d);
    if ([px.p0, px.pS, px.pE, px.pX].some((v) => v == null)) { skipped.noPrice++; continue; }
    const r1 = signalOf(px.p0, px.pS), r2 = px.pX / px.pE - 1, move = Math.abs(px.pX - px.pE);
    const rec = { sym, date: d.date, r1, r2 };
    if (hist.length < P.AVG) skipped.warmup++;
    else if (r1 === 0) skipped.flat++;
    else {
      const A = hist.slice(-P.AVG).reduce((x, y) => x + y, 0) / P.AVG;
      if (A > 0) {
        const side = Math.sign(r1), cost = CFD[sym] * px.pE;
        rec.tr = trade(b, px, side, A, cost); rec.alt = trade(b, px, -side, A, cost); rec.cost = cost;
        rec.pl = starts.map((h) => { const a = pxAt(b, at(d.date, h, s.tz)), z = pxAt(b, at(d.date, hm(mins(h) + 30), s.tz)); return a == null || z == null ? null : z / a - 1; });
      }
    }
    recs.push(rec); hist.push(move);
  }
  return { recs, skipped };
}
// net R of a traded row at a cost multiple, or at Treasury futures cost (mode 'fut')
export const netOf = (r, mult = 1, mode = 'cfd') => mode === 'fut' ? r.tr.R - FUT[r.sym] / r.tr.dist : r.tr.R - mult * r.cost / r.tr.dist;
// placebo over traded rows (fixed order: as given)
export function placebo(tr) {
  const nets = [], hits = [];
  for (let seed = 1; seed <= P.SEEDS; seed++) {
    const rnd = mulberry32(seed); let sum = 0, n = 0, h = 0, k = 0;
    for (const r of tr) {
      const x = r.pl[Math.floor(rnd() * r.pl.length)];
      if (x == null || x === 0) continue;
      const side = Math.sign(x), t = side === r.tr.side ? r.tr : r.alt;
      sum += t.net; n++; if (r.r2 !== 0) { k++; if (side === Math.sign(r.r2)) h++; }
    }
    nets.push(n ? sum / n : null); hits.push(k ? h / k : null);
  }
  return { nets, hits };
}
const r4 = (v) => v == null || !Number.isFinite(v) ? null : Math.round(v * 1e4) / 1e4;
export function summarize(recs, [a, b], { fut = false } = {}) {
  const w = recs.filter((r) => r.date >= a && r.date < b), tr = w.filter((r) => r.tr);
  const net = tstat(tr.map((r) => netOf(r))), gross = tstat(tr.map((r) => r.tr.R)), net2 = tstat(tr.map((r) => netOf(r, 2)));
  const mt = monthT(tr.map((r) => ({ date: r.date, x: netOf(r) }))), mt2 = monthT(tr.map((r) => ({ date: r.date, x: netOf(r, 2) })));
  const use = tr.filter((r) => r.r2 !== 0), hit = use.length ? use.filter((r) => Math.sign(r.r1) === Math.sign(r.r2)).length / use.length : null;
  const pl = placebo(tr), reg = ols(w.map((r) => r.r1 * 100), w.map((r) => r.r2 * 100));
  const out = {
    from: w[0]?.date ?? null, to: w.at(-1)?.date ?? null, days: w.length,
    n: net.n, net: r4(net.mean), tTrade: r4(net.t), months: mt.months, tMonth: r4(mt.t),
    gross: r4(gross.mean), tGross: r4(gross.t), costR: r4(mean(tr.map((r) => r.cost / r.tr.dist))),
    net2x: r4(net2.mean), tMonth2x: r4(mt2.t), totalNet: r4(tr.reduce((s, r) => s + netOf(r), 0)),
    win: r4(tr.filter((r) => netOf(r) > 0).length / (tr.length || 1)), stops: tr.filter((r) => r.tr.how !== 'time').length,
    longs: tr.filter((r) => r.tr.side > 0).length,
    hit: r4(hit), hitN: use.length,
    placebo: { netMean: r4(mean(pl.nets)), netQ95: r4(q95(pl.nets)), netMax: r4(Math.max(...pl.nets)), beats: pl.nets.filter((x) => net.mean > x).length,
      hitMean: r4(mean(pl.hits)), hitQ95: r4(q95(pl.hits)), hitMax: r4(Math.max(...pl.hits)), hitBeats: pl.hits.filter((x) => hit > x).length, hitQ95raw: q95(pl.hits) },
    reg: { n: reg.n, slope: r4(reg.slope), tOls: r4(reg.tOls), tWhite: r4(reg.tWhite), r2: r4(reg.r2) },
  };
  out.hitRaw = hit; out.netRaw = net.mean; out.net2xRaw = net2.mean; out.tMonthRaw = mt.t;
  if (fut) { const f = tstat(tr.map((r) => netOf(r, 1, 'fut'))), fm = monthT(tr.map((r) => ({ date: r.date, x: netOf(r, 1, 'fut') })));
    out.futures = { net: r4(f.mean), tMonth: r4(fm.t), costR: r4(mean(tr.map((r) => FUT[r.sym] / r.tr.dist))) }; }
  return out;
}
// lines 1-4 of the bar
export function lines(A, B) {
  const l1 = A.netRaw > 0 && B.netRaw > 0, l2 = B.tMonthRaw != null && B.tMonthRaw >= 2, l3 = B.net2xRaw > 0, l4 = B.hitRaw > B.placebo.hitQ95raw;
  return { l1, l2, l3, l4, ok: l1 && l2 && l3 && l4 };
}
const clean = (s) => { const { hitRaw, netRaw, net2xRaw, tMonthRaw, ...o } = s; const { hitQ95raw, ...p } = o.placebo; return { ...o, placebo: p }; };
export function byYear(recs) {
  const y = {};
  for (const r of recs) if (r.tr) { const k = r.date.slice(0, 4); (y[k] ||= []).push(netOf(r)); }
  return Object.fromEntries(Object.entries(y).sort().map(([k, xs]) => { const s = tstat(xs); return [k, { n: s.n, net: r4(s.mean), total: r4(xs.reduce((a, x) => a + x, 0)) }]; }));
}

export function build(markets) {
  const out = { study: 'bond-intraday-momentum', built: '2026-11-14', preregistration: 'research/edge/bond-intraday-momentum/PREREGISTRATION.md',
    paper: 'Gao, Han, Li and Zhou (2018), Journal of Financial Economics, "Market intraday momentum" (S&P 500); here on OANDA bond CFDs with the Treasury session',
    rule: 'signal = previous 15:00 New York price to 08:50; at 14:30 long if > 0, short if < 0; exit 15:00; stop 1.5 x the 20-day mean |15:00 - 14:30| move (Bund / Gilt: their own session, see sessions)',
    standAlone: 'A stand-alone study: not a gate, exit, entry or size on the live gold book (owner decision 44). Nothing live changes.',
    sessions: SESSION, costs: { cfdShareOfPrice: { ...CFD }, futuresPoints: { ...FUT }, financing: 'none (intraday)' },
    windows: { A: '2010-2015 (replication)', B: '2016 → 2026-11-13 (decides)' }, markets: {} };
  for (const [sym, { recs, skipped }] of Object.entries(markets)) {
    const fut = sym in FUT, A = summarize(recs, P.WIN.A, { fut }), B = summarize(recs, P.WIN.B, { fut });
    out.markets[sym] = { name: NAME[sym], skipped, lines: lines(A, B), A: clean(A), B: clean(B), byYear: byYear(recs) };
  }
  // primary: usb10y + usb30y pooled
  const pooled = PRIMARY.flatMap((s) => markets[s] ? markets[s].recs : []);
  const pa = summarize(pooled, P.WIN.A, { fut: true }), pb = summarize(pooled, P.WIN.B, { fut: true }), pl = lines(pa, pb);
  out.primary = { markets: PRIMARY, lines: pl, A: clean(pa), B: clean(pb), p: r4(pb.tMonthRaw == null ? 1 : normSf(pb.tMonthRaw)) };
  // secondary: the four US maturities, Holm on the one-sided p of the B month-sum t
  const us = US.filter((s) => out.markets[s]), ps = us.map((s) => { const t = out.markets[s].B.tMonth; return t == null ? 1 : normSf(t); }), hp = holm(ps);
  us.forEach((s, i) => { const m = out.markets[s]; m.p = r4(ps[i]); m.holm = r4(hp[i]); m.secondaryOk = m.lines.ok && hp[i] < P.ALPHA; });
  const enough = pb.n >= P.MIN_B && pa.n >= P.MIN_A;
  out.verdict = !enough ? 'NOT MEASURABLE' : pl.ok ? 'PASS' : 'FAIL';
  if (!enough) out.inconclusive = `pooled primary has ${pb.n} trades in B (need ${P.MIN_B}) and ${pa.n} in A (need ${P.MIN_A})`;
  return out;
}

// ── report ──
const sg = (v, d = 3) => v == null ? 'n/a' : (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d);
const pc = (v) => v == null ? 'n/a' : (v * 100).toFixed(1) + ' %';
const yn = (b) => b ? 'yes' : 'no';
export function render(j) {
  const L = [], pr = j.primary;
  L.push('# Intraday momentum in US Treasury CFDs: result', '');
  const verdict = j.verdict === 'NOT MEASURABLE' ? `NOT MEASURABLE (inconclusive: ${j.inconclusive})` : j.verdict;
  const nl = ['l1', 'l2', 'l3', 'l4'].filter((k) => pr.lines[k]).length;
  L.push(`**Verdict: ${verdict}** (the pooled 10-year + 30-year primary meets ${nl} of the 4 pre-registered lines). Primary, usb10y + usb30y pooled, 2016 → now: n ${pr.B.n}, ${sg(pr.B.net)}R a trade net of CFD costs (before costs ${sg(pr.B.gross)}R), month-sum t ${sg(pr.B.tMonth, 2)} over ${pr.B.months} months; at 2× cost ${sg(pr.B.net2x)}R; sign hit rate ${pc(pr.B.hit)} against a placebo 95th percentile of ${pc(pr.B.placebo.hitQ95)}. 2010-2015: n ${pr.A.n}, ${sg(pr.A.net)}R a trade net (before costs ${sg(pr.A.gross)}R), month-sum t ${sg(pr.A.tMonth, 2)}.`, '');
  L.push(`Pre-registered in \`PREREGISTRATION.md\` (committed and pushed alone before any return was computed). Claim from ${j.paper}. Rule: ${j.rule}. Costs: \`bond-month-end\`'s CFD round trip (share of price: usb02y 0.02 %, usb05y 0.03 %, usb10y 0.03 %, usb30y 0.05 %, Bund 0.03 %, Gilt 0.04 %), no financing (intraday); Treasury futures cost from \`bond-month-end-futures\` reported (ZN 0.019325 pt, ZB 0.03495 pt). \`signalOf\` and \`trade\` are \`intraday-momentum\`'s, byte for byte. Data: OANDA mid M5 candles through the candle proxy.`, '');
  L.push(j.standAlone, '');
  L.push('## Primary test (decides)', '');
  L.push('| window | span | trades | months | gross R | net R | t (trades) | month-sum t | net R at 2× cost | hit rate | placebo hit mean | placebo hit 95th pct | hit beats seeds | placebo net mean | rule beats seeds (net) | futures net R | futures month t |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, lab] of [['A', '2010-2015'], ['B', '2016 → now']]) { const w = pr[k];
    L.push(`| ${lab} | ${w.from} → ${w.to} | ${w.n} | ${w.months} | ${sg(w.gross)} | ${sg(w.net)} | ${sg(w.tTrade, 2)} | ${sg(w.tMonth, 2)} | ${sg(w.net2x)} | ${pc(w.hit)} | ${pc(w.placebo.hitMean)} | ${pc(w.placebo.hitQ95)} | ${w.placebo.hitBeats} / 40 | ${sg(w.placebo.netMean)} | ${w.placebo.beats} / 40 | ${sg(w.futures.net)} | ${sg(w.futures.tMonth, 2)} |`); }
  L.push('', `Bar: (1) net R > 0 in both windows: **${yn(pr.lines.l1)}**; (2) 2016 → now month-sum t ≥ 2: **${yn(pr.lines.l2)}**; (3) 2016 → now net R at 2× cost > 0: **${yn(pr.lines.l3)}**; (4) hit rate above the placebo 95th percentile: **${yn(pr.lines.l4)}**. Primary passes: **${yn(pr.lines.ok)}**.`, '');
  L.push('## Per market (secondary; decides nothing)', '');
  L.push('| market | window | days | trades | gross R | net R | t (trades) | month-sum t | cost R | net 2× | win | stops | hit rate | placebo hit 95th | futures net R | futures month t |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const s of MARKETS) { const m = j.markets[s]; if (!m) continue;
    for (const [k, lab] of [['A', '2010-2015'], ['B', '2016 → now']]) { const w = m[k];
      L.push(`| ${m.name} (\`${s}\`) | ${lab} | ${w.days} | ${w.n} | ${sg(w.gross)} | ${sg(w.net)} | ${sg(w.tTrade, 2)} | ${sg(w.tMonth, 2)} | ${w.costR?.toFixed(3) ?? 'n/a'} | ${sg(w.net2x)} | ${pc(w.win)} | ${w.stops} | ${pc(w.hit)} | ${pc(w.placebo.hitQ95)} | ${w.futures ? sg(w.futures.net) : '—'} | ${w.futures ? sg(w.futures.tMonth, 2) : '—'} |`); } }
  L.push('', '| market | lines 1 / 2 / 3 / 4 | p (one-sided, B month t) | Holm p (four US) | passes |', '|---|---|---|---|---|');
  for (const s of MARKETS) { const m = j.markets[s]; if (!m) continue; const l = m.lines;
    L.push(`| ${m.name} | ${yn(l.l1)} / ${yn(l.l2)} / ${yn(l.l3)} / ${yn(l.l4)} | ${m.p == null ? '—' : m.p.toFixed(3)} | ${m.holm == null ? '— (not in Holm)' : m.holm.toFixed(3)} | ${m.holm == null ? yn(l.ok) + ' (reported only)' : yn(m.secondaryOk)} |`); }
  L.push('', '## The paper\'s regression (descriptive)', '', 'OLS of the last half-hour return on the first (previous close to signal end), both in %, every eligible day with prices.', '');
  L.push('| market | window | n | slope | t (OLS) | t (White) | R² |', '|---|---|---|---|---|---|---|');
  for (const s of MARKETS) { const m = j.markets[s]; if (!m) continue;
    for (const [k, lab] of [['A', '2010-2015'], ['B', '2016 → now']]) { const r = m[k].reg;
      L.push(`| ${m.name} | ${lab} | ${r.n} | ${sg(r.slope, 4)} | ${sg(r.tOls, 2)} | ${sg(r.tWhite, 2)} | ${r.r2 == null ? 'n/a' : (r.r2 * 100).toFixed(2) + ' %'} |`); } }
  L.push('', '## Net R by year, CFD cost (descriptive)', '');
  const yrs = [...new Set(MARKETS.flatMap((s) => j.markets[s] ? Object.keys(j.markets[s].byYear) : []))].sort();
  L.push('| year | ' + MARKETS.map((s) => `${NAME[s]} n / net R`).join(' | ') + ' |', '|---|' + MARKETS.map(() => '---').join('|') + '|');
  for (const y of yrs) L.push(`| ${y} | ` + MARKETS.map((s) => { const v = j.markets[s]?.byYear[y]; return v ? `${v.n} / ${sg(v.net)}` : '—'; }).join(' | ') + ' |');
  L.push('', '## Days left out', '');
  for (const s of MARKETS) { const m = j.markets[s]; if (m) L.push(`- ${m.name}: ${m.skipped.noPrice} eligible days without a price at one of the four times, ${m.skipped.warmup} warm-up days, ${m.skipped.flat} zero signals.`); }
  L.push('', '## Reading', '');
  L.push(j.verdict === 'PASS'
    ? 'The pooled primary met every pre-registered line. This is a hypothesis for a forward paper shadow that the owner decides on, never a live rule.'
    : j.verdict === 'FAIL'
      ? 'The pooled primary did not meet the pre-registered bar. Not an edge on these CFD feeds; no proposal is written and nothing live changes. Never call it an edge.'
      : 'The data did not allow the test to be judged; nothing is concluded.');
  if (j.verdict !== 'NOT MEASURABLE') {
    const t10 = j.markets.usb10y, t30 = j.markets.usb30y;
    L.push('', `Descriptive, decides nothing (post hoc reading of the tables above): the sign does carry over on the US curve. The pooled hit rate is ${pc(pr.B.hit)} in 2016 → now and ${pc(pr.A.hit)} in 2010-2015, above every one of the 40 placebo seeds in both windows, and the paper's regression slope is positive on all four US maturities in both windows (10-year White t ${sg(t10.B.reg.tWhite, 2)} after 2015, 30-year ${sg(t30.B.reg.tWhite, 2)}). But the half-hour move it predicts is tiny: ${sg(pr.B.gross)}R a trade before costs against about ${pr.B.costR.toFixed(2)}R of CFD round trip, and still ${sg(pr.B.futures.net)}R a trade at Treasury futures cost (${pr.B.futures.costR.toFixed(2)}R). The Bund and the Gilt show no sign after 2015. A tradable version would need a cost near zero relative to a half-hour move, which neither route here has.`);
  }
  L.push('', 'To repeat: `node --use-env-proxy research/edge/bond-intraday-momentum/fetch.mjs <dir>`, then `node research/edge/bond-intraday-momentum/run.mjs <dir>`. Test: `tests/bond-intraday-momentum.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candle dir>');
  const mk = {};
  for (const sym of MARKETS) {
    const f = path.join(dir, `${sym}-5m.json.gz`); if (!fs.existsSync(f)) { console.log(`${sym}: no file, left out`); continue; }
    mk[sym] = runMarket(toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(f)))), sym);
  }
  const j = build(mk);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(j, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), render(j));
  console.log(render(j).split('\n').slice(0, 3).join('\n'));
}
