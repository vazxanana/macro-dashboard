// The FX carry trade on the G10 majors, out of sample (research/edge/fx-carry/PREREGISTRATION.md, committed first).
// Paper research only: nothing live reads this file.
//
//   node --use-env-proxy research/edge/fx-carry/run.mjs fetch <dir>          FRED short rates into <dir> (kept out of git)
//   node research/edge/fx-carry/run.mjs full <dir> [<daily dir>]               the study; writes result.json + RESULT.md
//
// <daily dir> holds the council-data daily candle cache files (research/daily/<key>.json), e.g. written with
// `git show origin/council-data:research/daily/eurusd.json > <daily dir>/eurusd.json` (default: <dir>/daily).
// If the rates cannot be read the study writes "not run: data not reachable" and computes nothing (pre-registration, gate 3).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFredCsv } from '../../../council/macro.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400;

// ── universe ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// key: OANDA cache key; inv: the pair quotes USD per... the other way round (USD/xxx), so P = 1 / close
export const PAIRS = {
  EUR: { key: 'eurusd', inv: false, pip: 0.0001 },
  GBP: { key: 'gbpusd', inv: false, pip: 0.0001 },
  JPY: { key: 'usdjpy', inv: true, pip: 0.01 },
  AUD: { key: 'audusd', inv: false, pip: 0.0001 },
  CAD: { key: 'usdcad', inv: true, pip: 0.0001 },
  CHF: { key: 'usdchf', inv: true, pip: 0.0001 },
  NZD: { key: 'nzdusd', inv: false, pip: 0.0001 },
};
export const CCYS = ['USD', ...Object.keys(PAIRS)];
const CC = { USD: 'US', EUR: 'EZ', GBP: 'GB', JPY: 'JP', AUD: 'AU', CAD: 'CA', CHF: 'CH', NZD: 'NZ' };
export const SERIES = Object.fromEntries(CCYS.map((c) => [c, { primary: `IR3TIB01${CC[c]}M156N`, fallback: `IRSTCI01${CC[c]}M156N` }]));

// ── pre-registered constants ─────────────────────────────────────────────────────────────────────────────────────────
export const P = {
  lagMonths: 2,          // an observation dated month m is known from the first day of month m+2
  nLong: 2, nShort: 2,
  minRanked: 6,
  atrN: 20, stopAtr: 3,
  markup: 1.0,           // % a year per leg, charged on the swap whichever side
  commissionRT: 0.000045, // 22.5 USD per million a side, measured on the demo
  spreadPips: 1,         // assumed spread + slippage per round trip
  volPct: 0.8, volMinMonths: 36,
  windows: { replication: ['2008-01', '2015-12'], decisive: ['2016-01', null] },
};

// ── months ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export const ymOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export const ymAdd = (ym, k) => { const [y, m] = ym.split('-').map(Number), d = new Date(Date.UTC(y, m - 1 + k, 1)); return d.toISOString().slice(0, 7); };

// ── candles ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// cache file rows [t, o, h, l, c, v] -> P_c candles { t, o, h, l, c } (USD per one unit of the currency)
export function candlesOf(file, inv) {
  const rows = (file && file.rows) || [];
  return rows.filter((r) => r[4] > 0 && r[2] > 0 && r[3] > 0).map(([t, o, h, l, c]) => inv
    ? { t, o: 1 / o, h: 1 / l, l: 1 / h, c: 1 / c }
    : { t, o, h, l, c }).sort((a, b) => a.t - b.t);
}
// Wilder ATR(n) over candles[0..i] (true range from the second candle); null with fewer than n+1 candles
export function atrAt(cs, i, n = P.atrN) {
  if (i < n) return null;
  const tr = (k) => Math.max(cs[k].h - cs[k].l, Math.abs(cs[k].h - cs[k - 1].c), Math.abs(cs[k].l - cs[k - 1].c));
  let a = 0; for (let k = 1; k <= n; k++) a += tr(k); a /= n;
  for (let k = n + 1; k <= i; k++) a = (a * (n - 1) + tr(k)) / n;
  return a;
}
// index of the last candle of each UTC month: Map ym -> index
export function monthEnds(cs) {
  const m = new Map();
  cs.forEach((c, i) => m.set(ymOf(c.t), i));
  return m;
}

// ── rates ────────────────────────────────────────────────────────────────────────────────────────────────────────────
// fred: { <series id>: [{ t, v }] } -> per currency Map ym -> { v, src }  (primary, else fallback for that month)
export function monthlyRates(fred) {
  const out = {};
  for (const c of CCYS) {
    const m = new Map();
    for (const o of (fred[SERIES[c].fallback] || [])) m.set(ymOf(o.t), { v: o.v, src: 'fallback' });
    for (const o of (fred[SERIES[c].primary] || [])) m.set(ymOf(o.t), { v: o.v, src: 'primary' });
    out[c] = m;
  }
  return out;
}
// the latest observation KNOWN at the rebalance at the end of month ym: dated ym - lag or earlier (never later)
export function knownRate(byMonth, ym, lag = P.lagMonths, maxBack = 6) {
  for (let k = lag; k < lag + maxBack; k++) { const o = byMonth.get(ymAdd(ym, -k)); if (o) return { ym: ymAdd(ym, -k), ...o }; }
  return null;
}
// what a swap pays while held in month ym: that month's value, else the latest earlier one (accounting, not a signal)
export function accrualRate(byMonth, ym, maxBack = 6) {
  for (let k = 0; k < maxBack; k++) { const o = byMonth.get(ymAdd(ym, -k)); if (o) return o.v; }
  return null;
}
// ranking at the end of month ym: { long: [...], short: [...], rates } or null when fewer than minRanked are known
export function rankMonth(rates, ym, opt = P) {
  const known = CCYS.map((c) => ({ c, r: knownRate(rates[c], ym, opt.lagMonths) })).filter((x) => x.r);
  if (known.length < opt.minRanked) return null;
  known.sort((a, b) => b.r.v - a.r.v || (a.c < b.c ? -1 : 1));
  return { long: known.slice(0, opt.nLong).map((x) => x.c), short: known.slice(-opt.nShort).map((x) => x.c),
    rates: Object.fromEntries(known.map((x) => [x.c, x.r.v])) };
}

// ── one leg ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// cs: P_c candles; i0: entry candle (rebalance close); i1: the next rebalance candle; s: +1 long c, -1 short c;
// rc / ru: accrual rates (% a year) of c and USD for the month held; pip: the pair's pip in its own quote; inv: pair inverted.
export function legResult(cs, i0, i1, s, { rc, ru, pip, inv, costMult = 1, opt = P } = {}) {
  const atr = atrAt(cs, i0, opt.atrN);
  if (!(atr > 0)) return null;
  const e = cs[i0].c, risk = opt.stopAtr * atr, stop = e - s * risk;
  let exit = cs[i1].c, exitT = cs[i1].t, stopped = false;
  for (let k = i0 + 1; k <= i1; k++) {
    const b = cs[k];
    if (s > 0 ? b.o <= stop : b.o >= stop) { exit = b.o; exitT = b.t; stopped = true; break; }
    if (s > 0 ? b.l <= stop : b.h >= stop) { exit = stop; exitT = b.t; stopped = true; break; }
  }
  const days = Math.max(0, (exitT - cs[i0].t) / DAY);
  const priceR = s * (exit - e) / risk;
  const carryR = (rc != null && ru != null) ? ((s * (rc - ru) - opt.markup * costMult) / 100) * (days / 365) * e / risk : 0;
  // spread in P_c terms: one pip of the pair, as a fraction of the pair's price (the same fraction for P_c)
  const pairPx = inv ? 1 / e : e, spreadFrac = opt.spreadPips * pip / pairPx;
  const costR = (spreadFrac + opt.commissionRT) * costMult * e / risk;
  return { s, entry: e, stop, exit, stopped, days, priceR, carryR, costR, R: priceR + carryR - costR };
}

// ── the book ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// candles: { EUR: [...], ... } P_c candles; rates: monthlyRates(...). Returns one row per holding month:
// { ym (held), R, legs, ranked, vol (realised in that month) }
export function runBook(candles, rates, { costMult = 1, opt = P } = {}) {
  const ends = Object.fromEntries(Object.entries(candles).map(([c, cs]) => [c, monthEnds(cs)]));
  const all = [...new Set(Object.values(ends).flatMap((m) => [...m.keys()]))].sort();
  const rows = [];
  for (let j = 0; j + 1 < all.length; j++) {
    const ymE = all[j], ymH = all[j + 1], rk = rankMonth(rates, ymE, opt);
    const row = { ym: ymH, R: 0, legs: [], ranked: !!rk };
    if (rk) {
      const ru = accrualRate(rates.USD, ymH), legs = [...rk.long.map((c) => [c, 1]), ...rk.short.map((c) => [c, -1])];
      let sum = 0;
      for (const [c, s] of legs) {
        if (c === 'USD') { row.legs.push({ c, s, R: 0 }); continue; }
        const cs = candles[c], i0 = ends[c].get(ymE), i1 = ends[c].get(ymH);
        const res = cs && i0 != null && i1 != null && i1 > i0
          ? legResult(cs, i0, i1, s, { rc: accrualRate(rates[c], ymH), ru, pip: PAIRS[c].pip, inv: PAIRS[c].inv, costMult, opt }) : null;
        if (!res) { row.legs.push({ c, s, R: 0, missing: true }); continue; }
        row.legs.push({ c, ...res }); sum += res.R;
      }
      row.R = sum / legs.length;
    }
    rows.push(row);
  }
  return rows;
}
// mean over pairs of the sd of daily log returns of the close inside month ym (null when no pair has 5 returns)
export function monthVol(candles, ym) {
  const sds = [];
  for (const cs of Object.values(candles)) {
    const r = [];
    for (let i = 1; i < cs.length; i++) if (ymOf(cs[i].t) === ym && ymOf(cs[i - 1].t) <= ym) r.push(Math.log(cs[i].c / cs[i - 1].c));
    if (r.length < 5) continue;
    const m = r.reduce((a, b) => a + b, 0) / r.length;
    sds.push(Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1)));
  }
  return sds.length ? sds.reduce((a, b) => a + b, 0) / sds.length : null;
}
// skip month ym (held) when the previous month's vol ranks in the top (1 - volPct) of every month of data through it
// (expanding window from the first month on file, at least volMinMonths months; rank = share of those months strictly below)
export function volSkipSet(candles, months, opt = P) {
  const all = [...new Set(Object.values(candles).flatMap((cs) => cs.map((c) => ymOf(c.t))))].sort();
  const vol = new Map(all.map((ym) => [ym, monthVol(candles, ym)])), skip = new Set();
  for (const ym of months) {
    const prev = ymAdd(ym, -1), v = vol.get(prev);
    if (v == null) continue;
    const known = all.filter((m) => m <= prev).map((m) => vol.get(m)).filter((x) => x != null);
    if (known.length < opt.volMinMonths) continue;
    if (known.filter((x) => x < v).length / known.length >= opt.volPct) skip.add(ym);
  }
  return skip;
}

// ── statistics ───────────────────────────────────────────────────────────────────────────────────────────────────────
const nPhi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
export function stats(xs) {
  const n = xs.length; if (!n) return { n: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  let cum = 0, peak = 0, dd = 0; for (const x of xs) { cum += x; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : 0;
  const r = (v, d = 3) => +v.toFixed(d);
  return { n, mean: r(mean, 4), sd: r(sd, 4), sharpe: sd > 0 ? r(mean / sd * Math.sqrt(12)) : 0, t: r(t, 2), p1: r(1 - nPhi(t), 4),
    total: r(cum, 2), maxDD: r(dd, 2), pos: r(xs.filter((x) => x > 0).length / n, 3) };
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = +run.toFixed(4); });
  return out;
}
const inWin = (ym, [a, b]) => ym >= a && (b == null || ym <= b);

// ── the study ────────────────────────────────────────────────────────────────────────────────────────────────────────
export function study(candles, fred, { lastComplete } = {}) {
  const rates = monthlyRates(fred);
  const win = { replication: P.windows.replication, decisive: [P.windows.decisive[0], lastComplete] };
  // gate 2: every currency has a usable rate for 95 % of rebalance months
  const gateMonths = []; for (let ym = '2007-11'; ym <= ymAdd(lastComplete, -1); ym = ymAdd(ym, 1)) gateMonths.push(ym);
  const cover = Object.fromEntries(CCYS.map((c) => [c, +(gateMonths.filter((ym) => knownRate(rates[c], ym)).length / gateMonths.length).toFixed(3)]));
  if (Object.values(cover).some((v) => v < 0.95)) return { verdict: 'not run: rates incomplete', cover };
  const base = runBook(candles, rates).filter((r) => r.ym <= lastComplete), base2 = runBook(candles, rates, { costMult: 2 }).filter((r) => r.ym <= lastComplete);
  const skip = volSkipSet(candles, base.map((r) => r.ym));
  const vol = base.map((r) => (skip.has(r.ym) ? { ...r, R: 0, skipped: true } : r)), vol2 = base2.map((r) => (skip.has(r.ym) ? { ...r, R: 0 } : r));
  const block = (rows) => Object.fromEntries(Object.entries(win).map(([k, w]) => [k, stats(rows.filter((r) => inWin(r.ym, w)).map((r) => r.R))]));
  const streams = { base: { x1: block(base), x2: block(base2) }, volSkip: { x1: block(vol), x2: block(vol2) } };
  const ps = ['base', 'volSkip'].map((k) => streams[k].x1.decisive.p1), adj = holm(ps);
  ['base', 'volSkip'].forEach((k, i) => { const s = streams[k].x1; streams[k].holmP = adj[i];
    streams[k].pass = s.decisive.sharpe > 0.3 && s.decisive.t >= 2 && adj[i] < 0.05 && s.replication.mean > 0; });
  const verdict = streams.base.pass || streams.volSkip.pass ? 'PASS' : 'FAIL';
  return { verdict, cover, windows: win, streams, skipped: [...skip].filter((ym) => ym <= lastComplete),
    months: base.map((r) => ({ ym: r.ym, R: +r.R.toFixed(4), long: r.legs.filter((l) => l.s > 0).map((l) => l.c), short: r.legs.filter((l) => l.s < 0).map((l) => l.c),
      stops: r.legs.filter((l) => l.stopped).length })) };
}

// ── IO ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const FRED_HEADERS = [{ 'User-Agent': 'macro-dashboard-council/1.0 (+https://meridianx.dev)', Accept: 'text/csv,*/*' },
  { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' }];
export async function fetchRates(dir, fetchImpl = fetch) {
  fs.mkdirSync(dir, { recursive: true });
  const log = {};
  let fails = 0;
  for (const id of CCYS.flatMap((c) => [SERIES[c].primary, SERIES[c].fallback])) {
    if (fails >= 4) { log[id] = 'skipped: FRED unreachable this run'; continue; }
    let ok = false, err = '';
    for (const h of FRED_HEADERS) {
      try {
        const r = await fetchImpl(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=2002-01-01`, { headers: h, signal: AbortSignal.timeout(20000) });
        if (!r.ok) { err = `HTTP ${r.status}`; continue; }
        const body = await r.text();
        if (parseFredCsv(body).length) { fs.writeFileSync(path.join(dir, `${id}.csv`), body); ok = true; break; }
        err = 'empty';
      } catch (e) { err = String((e && e.cause && e.cause.message) || (e && e.message) || e).slice(0, 120); }
    }
    log[id] = ok ? 'ok' : err; fails = ok ? 0 : fails + 1;
  }
  fs.writeFileSync(path.join(dir, 'fetch-log.json'), JSON.stringify({ at: new Date().toISOString(), log }, null, 1));
  return log;
}
export function readFred(dir) {
  const out = {};
  for (const c of CCYS) for (const id of [SERIES[c].primary, SERIES[c].fallback]) {
    const f = path.join(dir, `${id}.csv`); if (fs.existsSync(f)) out[id] = parseFredCsv(fs.readFileSync(f, 'utf8'));
  }
  return out;
}

const notRun = (why, log) => ({ built: new Date().toISOString().slice(0, 10), prereg: 'research/edge/fx-carry/PREREGISTRATION.md',
  verdict: 'inconclusive: not run, data not reachable', why, series: SERIES, fetchLog: log || null,
  rule: 'paper research only; no live rule, size, filter, stop, config or mirror setting changed' });

async function main() {
  const [cmd, dir, dailyDir] = process.argv.slice(2);
  if (!cmd || !dir) { console.log('usage: run.mjs fetch <dir> | full <dir> [<daily dir>]'); process.exit(2); }
  if (cmd === 'fetch') { const log = await fetchRates(dir); console.log(JSON.stringify(log, null, 1)); return; }
  if (cmd !== 'full') process.exit(2);
  const fred = readFred(dir);
  const primaries = CCYS.filter((c) => fred[SERIES[c].primary] || fred[SERIES[c].fallback]);
  if (primaries.length < CCYS.length) {
    let log = null; try { log = JSON.parse(fs.readFileSync(path.join(dir, 'fetch-log.json'), 'utf8')); } catch {}
    const out = notRun(`FRED short-rate series missing for ${CCYS.filter((c) => !primaries.includes(c)).join(', ')} (no fetched file): fred.stlouisfed.org could not be read from this environment`, log);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(out.verdict, '-', out.why); return;
  }
  const dd = dailyDir || path.join(dir, 'daily'), candles = {};
  for (const [c, p] of Object.entries(PAIRS)) candles[c] = candlesOf(JSON.parse(fs.readFileSync(path.join(dd, `${p.key}.json`), 'utf8')), p.inv);
  const lastT = Math.min(...Object.values(candles).map((cs) => cs[cs.length - 1].t)), lastComplete = ymAdd(ymOf(lastT), -1);
  const res = study(candles, fred, { lastComplete });
  const out = { built: new Date().toISOString().slice(0, 10), prereg: 'research/edge/fx-carry/PREREGISTRATION.md', series: SERIES, params: P,
    rule: 'paper research only; no live rule, size, filter, stop, config or mirror setting changed', ...res };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(out.verdict, JSON.stringify(out.streams || out.cover, null, 1));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.error(e); process.exit(1); });
