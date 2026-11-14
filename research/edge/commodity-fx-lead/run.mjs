// Edge research · commodity-fx-lead (14 Nov 2026): does a big commodity day lead its commodity currency the next day?
// T1: WTI (OANDA `wtico`) up > 1.5 sigma on New York day d -> sell USD/CAD at day d+1's open (down -> buy), out at d+1's
// close; T2: copper (`xcu`) up -> buy AUD/USD (down -> sell). Stop 1 x ATR(20) of the pair, checked on H1 (gap at the open).
// Net of the raw-spread forex model and one night of financing when held over the 17:00 New York rollover. Everything is
// fixed in PREREGISTRATION.md (committed alone before this file computed anything). Paper research only.
//   node --use-env-proxy run.mjs fetch <dir>   -> <dir>/<sym>-1h.json.gz  (OANDA mid H1 through the candle proxy; out of git)
//   CANDLES=<dir> node run.mjs run             -> result.json (RESULT.md is written by hand from it)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nights } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = {
  K: 1.5, SD_N: 60, ATR_N: 20, STOP_ATR: 1, MIN_H1: 6, MAX_GAP_DAYS: 4,
  SPREAD_PIP: 0.3, SLIP_PIP: 0.15, PIP: 0.0001, COMM_RT: 0.000045, MARKUP: 1.0,
  FROM: '2005-01-01', DEC: ['2016-01-01', '2099-12-31'], REP: ['2006-01-01', '2015-12-31'],
  MIN_N: 30, ALPHA: 0.05, T_MIN: 2, SEEDS: 40,
};
export const TESTS = {
  T1: { name: 'oil -> USD/CAD', com: 'wtico', fx: 'usdcad', upSide: -1, base: 'usd', quote: 'cad' },
  T2: { name: 'copper -> AUD/USD', com: 'xcu', fx: 'audusd', upSide: 1, base: 'aud', quote: 'usd' },
};
export const SYMS = ['wtico', 'xcu', 'usdcad', 'audusd'];

// ─── the 17:00 New York day ───
const NYF = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' });
const OFF = new Map();
// hours New York is behind UTC at instant t (4 or 5), from the time-zone database (pre-2007 rule included)
export function nyOff(t) {
  const k = Math.floor(t / 3600);
  if (OFF.has(k)) return OFF.get(k);
  const p = Object.fromEntries(NYF.formatToParts(new Date(k * 3600e3)).map((x) => [x.type, x.value]));
  const loc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour) / 1000, o = Math.round((k * 3600 - loc) / 3600);
  OFF.set(k, o); return o;
}
// trading date (UTC midnight, seconds) of an H1 candle starting at t: New York local time + 7 h, so 17:00 NY opens the next date
export const tradeDate = (t) => Math.floor((t - nyOff(t) * 3600 + 7 * 3600) / 86400) * 86400;
export const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// H1 rows [t,o,h,l,c] in time order -> counted days { date, open, high, low, close, h1: [rows] } (>= MIN_H1 candles, Mon-Fri)
export function days(h1, minH1 = P.MIN_H1) {
  const out = []; let cur = null;
  for (const r of h1) {
    const d = tradeDate(r[0]);
    if (!cur || cur.date !== d) { cur = { date: d, open: r[1], high: r[2], low: r[3], close: r[4], h1: [r] }; out.push(cur); }
    else { if (r[2] > cur.high) cur.high = r[2]; if (r[3] < cur.low) cur.low = r[3]; cur.close = r[4]; cur.h1.push(r); }
  }
  return out.filter((d) => { const w = new Date(d.date * 1000).getUTCDay(); return d.h1.length >= minH1 && w >= 1 && w <= 5; });
}

// ─── signals: day d's commodity move against sigma of the 60 returns before it (day d excluded) ───
export function signals(cdays, k = P.K, n = P.SD_N) {
  const r = cdays.map((d, i) => (i ? Math.log(d.close / cdays[i - 1].close) : NaN)), out = [];
  for (let i = n + 1; i < cdays.length; i++) {
    const w = r.slice(i - n, i), m = w.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
    if (!(sd > 0)) continue;
    if (r[i] > k * sd) out.push({ date: cdays[i].date, dir: 1, r: r[i], sd });
    else if (r[i] < -k * sd) out.push({ date: cdays[i].date, dir: -1, r: r[i], sd });
  }
  return out;
}
// ATR(20) of the pair from its last 20 counted days up to and including index i (21 days needed)
export function atrAt(fdays, i, n = P.ATR_N) {
  if (i < n) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) { const d = fdays[j], pc = fdays[j - 1].close; s += Math.max(d.high - d.low, Math.abs(d.high - pc), Math.abs(d.low - pc)); }
  return s / n;
}

// ─── one trade on day `day` (side +1 buy / -1 sell), stop distance r0 ───
export function trade(day, side, r0) {
  const entry = day.h1[0][1], stop = entry - side * r0;
  for (let j = 0; j < day.h1.length; j++) {
    const [, o, h, l] = day.h1[j];
    if (j > 0 && (side > 0 ? o <= stop : o >= stop)) return { entry, stop, exit: o, how: 'gap', exitT: day.h1[j][0] };
    if (side > 0 ? l <= stop : h >= stop) return { entry, stop, exit: stop, how: 'stop', exitT: day.h1[j][0] };
  }
  return { entry, stop, exit: day.close, how: 'close', exitT: day.h1.at(-1)[0] + 3600 };
}

// ─── rates and costs ───
export function rateAt(rates, ccy, date) {
  const d = rates.decisions[ccy]; let v = d.from[1];
  for (const [t, x] of d.changes) { if (iso(date) >= t) v = x; else break; }
  return v;
}
// rollovers held by a trade still open at its day's close: nights() over that trading date's 22:00 UTC (Wednesday three)
export const rollNights = (date) => nights(date + 21 * 3600, date + 23 * 3600);
export function costs(t, test, rates, mult = 1) {
  const r0 = Math.abs(t.entry - t.stop);
  const cost = ((P.SPREAD_PIP + 2 * P.SLIP_PIP) * P.PIP + P.COMM_RT * t.entry) * mult / r0;
  const nn = t.how === 'close' ? rollNights(t.date) : 0;
  const rb = rateAt(rates, test.base, t.date), rq = rateAt(rates, test.quote, t.date);
  const carry = nn ? nn * (t.side * (rb - rq) - P.MARKUP * mult) / 100 / 365 * t.entry / r0 : 0;
  return { cost, carry, nights: nn };
}

// ─── the test: signals -> trades ───
export function build(test, cdays, fdays, rates) {
  const out = [];
  for (const s of signals(cdays)) {
    let j = fdays.findIndex((d) => d.date > s.date);
    if (j < 0 || fdays[j].date - s.date > P.MAX_GAP_DAYS * 86400) continue;
    const i = j - 1;                                    // last FX day at or before d
    if (i < 0 || fdays[i].date > s.date) continue;
    const a = atrAt(fdays, i); if (!a) continue;
    const side = s.dir * test.upSide, day = fdays[j], x = trade(day, side, P.STOP_ATR * a);
    const t = { date: day.date, signal: s.date, side, dir: s.dir, r: s.r, sd: s.sd, atr: a, ...x };
    t.R = side * (t.exit - t.entry) / (P.STOP_ATR * a);
    const c = costs(t, test, rates), c2 = costs(t, test, rates, 2);
    Object.assign(t, { cost: c.cost, carry: c.carry, nights: c.nights, net: t.R - c.cost + c.carry, net2: t.R - c2.cost + c2.carry });
    out.push(t);
  }
  return out;
}

// ─── statistics ───
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)) : NaN; };
export const normP = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? p : 1 - p; };   // one-sided P(Z >= z)
const ym = (t) => iso(t).slice(0, 7);
export function monthT(trades, from, to, key = 'net') {
  const sums = new Map();
  for (let y = +from.slice(0, 4), m = +from.slice(5, 7); `${y}-${String(m).padStart(2, '0')}` <= to.slice(0, 7); m === 12 ? (y++, m = 1) : m++) sums.set(`${y}-${String(m).padStart(2, '0')}`, 0);
  for (const t of trades) { const k = ym(t.date); if (sums.has(k)) sums.set(k, sums.get(k) + t[key]); }
  const v = [...sums.values()], m = mean(v), s = sdv(v);
  return { months: v.length, t: s > 0 ? m / (s / Math.sqrt(v.length)) : 0 };
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); adj[i] = run; });
  return adj;
}
export function summarize(trades, from, to) {
  const net = trades.map((t) => t.net); let cum = 0, peak = 0, dd = 0;
  for (const x of net) { cum += x; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  const mt = monthT(trades, from, to);
  return { n: trades.length, win: trades.length ? trades.filter((t) => t.net > 0).length / trades.length : null,
    gross: mean(trades.map((t) => t.R)), net: mean(net), net2: mean(trades.map((t) => t.net2)), total: net.reduce((a, b) => a + b, 0),
    dd, months: mt.months, t: mt.t, p: normP(mt.t), stops: trades.filter((t) => t.how !== 'close').length, gaps: trades.filter((t) => t.how === 'gap').length,
    nights: trades.reduce((a, t) => a + t.nights, 0), carry: trades.reduce((a, t) => a + t.carry, 0), cost: trades.reduce((a, t) => a + t.cost, 0) };
}
export const inWin = (t, w) => iso(t.signal) >= w[0] && iso(t.signal) <= w[1];

// seeded random (mulberry32)
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// placebo: n trades on random FX days of the window (an ATR on file, drawn without replacement), random sides
export function placebo(test, fdays, rates, n, win, seed) {
  const R = rng(seed), pool = [];
  for (let j = 1; j < fdays.length; j++) { const a = atrAt(fdays, j - 1); if (a && iso(fdays[j - 1].date) >= win[0] && iso(fdays[j - 1].date) <= win[1]) pool.push([j, a]); }
  const out = [];
  for (let k = 0; k < n && pool.length; k++) {
    const [j, a] = pool.splice(Math.floor(R() * pool.length), 1)[0], side = R() < 0.5 ? 1 : -1, day = fdays[j], x = trade(day, side, P.STOP_ATR * a);
    const t = { date: day.date, signal: fdays[j - 1].date, side, ...x }; t.R = side * (t.exit - t.entry) / (P.STOP_ATR * a);
    const c = costs(t, test, rates); t.net = t.R - c.cost + c.carry; out.push(t);
  }
  return out;
}
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };

// descriptive: correlation of the commodity's day-d return with the pair's day-d and day-(d+1) return
export function corr(cdays, fdays, win) {
  const cr = new Map(); cdays.forEach((d, i) => { if (i) cr.set(d.date, Math.log(d.close / cdays[i - 1].close)); });
  const same = [], next = [];
  for (let j = 1; j < fdays.length; j++) {
    const d = fdays[j].date; if (iso(d) < win[0] || iso(d) > win[1]) continue;
    const fr = Math.log(fdays[j].close / fdays[j - 1].close);
    if (cr.has(d)) same.push([cr.get(d), fr]);
    if (j + 1 < fdays.length && cr.has(d) && fdays[j + 1].date - d <= P.MAX_GAP_DAYS * 86400) next.push([cr.get(d), Math.log(fdays[j + 1].close / fdays[j].close)]);
  }
  const pr = (xy) => { const mx = mean(xy.map((p) => p[0])), my = mean(xy.map((p) => p[1])); let a = 0, b = 0, c = 0;
    for (const [x, y] of xy) { a += (x - mx) * (y - my); b += (x - mx) ** 2; c += (y - my) ** 2; } return a / Math.sqrt(b * c); };
  return { sameDay: +pr(same).toFixed(4), nSame: same.length, nextDay: +pr(next).toFixed(4), nNext: next.length };
}

export function verdictOf(s, rep, adjP, pooled = false) {
  const c = { n: s.n >= P.MIN_N, net: s.net > 0, t: s.t >= P.T_MIN && (pooled || adjP < P.ALPHA), cost2: s.net2 > 0, rep: rep.net > 0 };
  return { pass: Object.values(c).every(Boolean), checks: c };
}

const r4 = (x) => (Number.isFinite(x) ? +x.toFixed(4) : null);
const clean = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'number' ? r4(v) : v]));
export function study(data, rates) {
  const D = Object.fromEntries(SYMS.map((s) => [s, days(data[s])]));
  const last = iso(Math.min(...SYMS.map((s) => D[s].at(-1).date))), DEC = [P.DEC[0], last], res = { tests: {} }, all = {};
  for (const [k, T] of Object.entries(TESTS)) {
    const tr = build(T, D[T.com], D[T.fx], rates); all[k] = tr;
    const dec = tr.filter((t) => inWin(t, DEC)), rep = tr.filter((t) => inWin(t, P.REP));
    res.tests[k] = { name: T.name, decisive: clean(summarize(dec, DEC[0], DEC[1])), replication: clean(summarize(rep, P.REP[0], P.REP[1])),
      corr: { decisive: corr(D[T.com], D[T.fx], DEC), replication: corr(D[T.com], D[T.fx], P.REP) } };
    const pl = []; for (let s = 1; s <= P.SEEDS; s++) { const p = placebo(T, D[T.fx], rates, dec.length, DEC, s); pl.push({ net: mean(p.map((t) => t.net)), t: monthT(p, DEC[0], DEC[1]).t }); }
    const real = res.tests[k].decisive;
    res.tests[k].placebo = { seeds: P.SEEDS, net: [0.05, 0.5, 0.95].map((q) => r4(pct(pl.map((x) => x.net), q))), t: [0.05, 0.5, 0.95].map((q) => r4(pct(pl.map((x) => x.t), q))),
      atOrAboveNet: pl.filter((x) => x.net >= real.net).length, atOrAboveT: pl.filter((x) => x.t >= real.t).length };
    res.tests[k].trades = tr.map((t) => [iso(t.signal), iso(t.date), t.side, r4(t.entry), r4(t.stop), r4(t.exit), t.how, t.nights, r4(t.R), r4(t.net)]);
  }
  const adj = holm(Object.keys(TESTS).map((k) => res.tests[k].decisive.p));
  Object.keys(TESTS).forEach((k, i) => { res.tests[k].holmP = r4(adj[i]); Object.assign(res.tests[k], verdictOf(res.tests[k].decisive, res.tests[k].replication, adj[i])); });
  const pd = [...all.T1, ...all.T2].filter((t) => inWin(t, DEC)).sort((a, b) => a.date - b.date), pr = [...all.T1, ...all.T2].filter((t) => inWin(t, P.REP)).sort((a, b) => a.date - b.date);
  const pooled = { decisive: clean(summarize(pd, DEC[0], DEC[1])), replication: clean(summarize(pr, P.REP[0], P.REP[1])) };
  const ppl = []; for (let s = 1; s <= P.SEEDS; s++) { const a = placebo(TESTS.T1, D.usdcad, rates, all.T1.filter((t) => inWin(t, DEC)).length, DEC, s), b = placebo(TESTS.T2, D.audusd, rates, all.T2.filter((t) => inWin(t, DEC)).length, DEC, 1000 + s);
    const c = [...a, ...b].sort((x, y) => x.date - y.date); ppl.push({ net: mean(c.map((t) => t.net)), t: monthT(c, DEC[0], DEC[1]).t }); }
  pooled.placebo = { seeds: P.SEEDS, net: [0.05, 0.5, 0.95].map((q) => r4(pct(ppl.map((x) => x.net), q))), t: [0.05, 0.5, 0.95].map((q) => r4(pct(ppl.map((x) => x.t), q))),
    atOrAboveNet: ppl.filter((x) => x.net >= pooled.decisive.net).length, atOrAboveT: ppl.filter((x) => x.t >= pooled.decisive.t).length };
  Object.assign(pooled, verdictOf(pooled.decisive, pooled.replication, 0, true));
  res.pooled = pooled;
  res.data = Object.fromEntries(SYMS.map((s) => [s, { h1: data[s].length, days: D[s].length, first: iso(D[s][0].date), last: iso(D[s].at(-1).date) }]));
  res.windows = { decisive: DEC, replication: P.REP };
  res.verdict = Object.values(res.tests).some((t) => t.pass) ? 'PASS' : 'FAIL';
  return res;
}

// ─── fetch ───
async function fetchAll(out) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const FROM = Date.parse(P.FROM + 'T00:00:00Z') / 1000, END = Math.floor(Date.now() / 1000 / 3600) * 3600;
  fs.mkdirSync(out, { recursive: true });
  for (const sym of SYMS) {
    const f = path.join(out, `${sym}-1h.json.gz`); if (fs.existsSync(f)) { console.log(sym, 'exists'); continue; }
    const m = new Map();
    for (let a = FROM; a < END;) {
      const b = Math.min(END, a + 4999 * 3600); let j = null, err = null;
      for (let k = 0; k < 6 && !j; k++) {
        try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
          if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
        catch (e) { err = String(e.message || e); }
        if (!j) await sleep(2000 * (k + 1));
      }
      if (!j) throw new Error(`${sym} ${new Date(a * 1000).toISOString()}: ${err}`);
      for (const x of j.bars) if (!x.live && x.time >= a && x.time < b && x.time + 3600 <= END) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
      a = b; await sleep(150);
    }
    const bars = [...m.values()].sort((p, q) => p[0] - q[0]);
    fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
    console.log(sym, bars.length, iso(bars[0][0]), iso(bars.at(-1)[0]));
  }
}
export const load = (dir) => Object.fromEntries(SYMS.map((s) => [s, JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${s}-1h.json.gz`))))]));

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchAll(dir);
  else if (cmd === 'run') {
    const rates = JSON.parse(fs.readFileSync(path.join(HERE, 'rates.json'), 'utf8'));
    const res = study(load(process.env.CANDLES || dir), rates);
    const out = { study: 'commodity-fx-lead', title: 'Does a big commodity day lead its commodity currency the next day?', built: '2026-11-14', verdict: res.verdict, params: P, ...res };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const [k, t] of Object.entries(res.tests)) console.log(k, t.name, JSON.stringify(t.decisive), JSON.stringify(t.replication), 'holm', t.holmP, t.pass, JSON.stringify(t.placebo), JSON.stringify(t.corr));
    console.log('pooled', JSON.stringify(res.pooled)); console.log('verdict', res.verdict);
  } else console.log('usage: node --use-env-proxy run.mjs fetch <dir> | CANDLES=<dir> node run.mjs run');
}
