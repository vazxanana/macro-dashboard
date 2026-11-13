// Previous-week high / low raid and reversal on gold (PREREGISTRATION.md, committed first).
//   node --use-env-proxy research/edge/gold-week-raid/run.mjs fetch <dir>   OANDA mid H1 gold from Oct 2007 (kept out of git)
//   node research/edge/gold-week-raid/run.mjs full <dir>                   the study -> result.json (+ prints the tables)
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { FIN, nights } from '../../../council/fills.mjs';

export const H = 3600, D = 86400, COST = 0.30, BUF = 0.30, LOOK = 12, MIN_PREV = 48;
const DIR = path.dirname(fileURLToPath(import.meta.url));

const nyOff = (() => { const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' }); const c = new Map();
  return (t) => { const k = Math.floor(t / H); if (c.has(k)) return c.get(k); const p = Object.fromEntries(f.formatToParts(new Date(k * H * 1000)).map((x) => [x.type, x.value]));
    const loc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24) / 1000, o = (loc - k * H) / H; c.set(k, o); return o; }; })();

// Where an H1 candle (start t, UTC) sits in the New York trading week. The clock is shifted 7 hours so that 17:00 New York is
// midnight: the shifted weekday is the New York trading day (Sunday 17:00 opens Monday), Friday 17:00 onward is the weekend.
//   { week: Monday of the trading week (days since 1970), wd: 1-5 trading day, cut: starts at or after Friday 16:00 New York }
export function place(t) {
  const s = t + nyOff(t) * H + 7 * H, day = Math.floor(s / D), wd = new Date(day * D * 1000).getUTCDay();
  if (wd === 0 || wd === 6) return null;
  const hr = Math.floor((s - day * D) / H);
  return { week: day - (wd - 1), wd, cut: wd === 5 && hr >= 23 };
}

// rows [t,o,h,l,c] -> weeks [{ k, bars: [{ t, o, h, l, c, wd, cut }] }] in time order
export function weeksOf(rows) {
  const out = []; let cur = null;
  for (const r of rows) { const p = place(r[0]); if (!p) continue;
    if (!cur || cur.k !== p.week) { cur = { k: p.week, bars: [] }; out.push(cur); }
    cur.bars.push({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], wd: p.wd, cut: p.cut }); }
  return out;
}
export const rangeOf = (bars) => { let hi = -Infinity, lo = Infinity; for (const b of bars) { hi = Math.max(hi, b.h); lo = Math.min(lo, b.l); } return { hi, lo, mid: (hi + lo) / 2 }; };
export const lastTradable = (bars) => { for (let k = bars.length - 1; k >= 0; k--) if (!bars[k].cut) return k; return -1; };

// The signal of one side in one week, from closed candles only. side +1 = buy (raid below last week's low), -1 = sell.
//   opts.monWed: raid only Monday-Wednesday; opts.far: target last week's opposite extreme.
// -> { i, j, e, entry, stop, target, risk } or { skip: reason } or null (no raid / no close back)
export function signal(prev, bars, side, opts = {}) {
  const lvl = side < 0 ? prev.hi : prev.lo;
  let i = -1; for (let k = 0; k < bars.length; k++) if (side < 0 ? bars[k].h > lvl : bars[k].l < lvl) { i = k; break; }
  if (i < 0) return null;
  if (opts.monWed && bars[i].wd > 3) return { skip: 'raid Thu-Fri' };
  let j = -1; for (let k = i + 1; k <= Math.min(bars.length - 1, i + LOOK); k++) if (side < 0 ? bars[k].c < lvl : bars[k].c > lvl) { j = k; break; }
  if (j < 0) return null;
  const e = j + 1; if (e >= bars.length || bars[e].cut) return { skip: 'no entry candle' };
  let ext = side < 0 ? -Infinity : Infinity; for (let k = i; k <= j; k++) ext = side < 0 ? Math.max(ext, bars[k].h) : Math.min(ext, bars[k].l);
  const stop = side < 0 ? ext + BUF : ext - BUF, target = opts.far ? (side < 0 ? prev.lo : prev.hi) : prev.mid, entry = bars[e].o;
  if (side < 0 ? entry >= stop : entry <= stop) return { skip: 'entry past stop' };
  if (side < 0 ? entry <= target : entry >= target) return { skip: 'entry past target' };
  return { i, j, e, entry, stop, target, risk: Math.abs(entry - stop) };
}

// One trade from candle e's open: stop first, a gapped stop at the open, target at the target, else the close of the week's
// last candle that starts before Friday 16:00 New York.
export function simulate(bars, e, side, entry, stop, target) {
  const last = lastTradable(bars); if (e > last) return null;
  const risk = Math.abs(entry - stop); let exit = null, how = 'time', k = e;
  for (; k <= last; k++) { const b = bars[k];
    if (side < 0 ? b.h >= stop : b.l <= stop) { exit = side < 0 ? Math.max(b.o, stop) : Math.min(b.o, stop); how = 'stop'; break; }
    if (side < 0 ? b.l <= target : b.h >= target) { exit = target; how = 'target'; break; }
    if (k === last) exit = b.c; }
  if (k > last) k = last;
  const entryT = bars[e].t, exitT = bars[k].t + H, R = side * (exit - entry) / risk;
  const nts = side > 0 ? nights(entryT, exitT) : 0, finR = side > 0 ? nts * FIN.xau.long * entry / risk : 0;
  return { side, entryT, exitT, entry, stop, target, risk, exit, how, R, nights: nts, finR, net: R - COST / risk - finR };
}

// every trade of a rule over the weeks (the previous week must have >= MIN_PREV candles and be exactly 7 days earlier)
export function trades(weeks, opts = {}) {
  const out = [];
  for (let w = 1; w < weeks.length; w++) {
    const pw = weeks[w - 1], wk = weeks[w]; if (wk.k - pw.k !== 7 || pw.bars.length < MIN_PREV) continue;
    const prev = rangeOf(pw.bars);
    for (const side of [1, -1]) { const s = signal(prev, wk.bars, side, opts); if (!s || s.skip) continue;
      const tr = simulate(wk.bars, s.e, side, s.entry, s.stop, s.target); if (tr) out.push({ ...tr, w, raidT: wk.bars[s.i].t }); }
  }
  return out.sort((a, b) => a.entryT - b.entryT);
}

export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// a random same-week, same-side entry with the trade's own dollar risk, its own target and the same exits
export function placebo(weeks, T, seed) {
  const rnd = mulberry32(seed), out = [];
  for (const x of T) { const bars = weeks[x.w].bars, last = lastTradable(bars);
    for (let n = 0; n < 50; n++) { const r = Math.floor(rnd() * (last + 1)), en = bars[r].o;
      if (x.side < 0 ? en <= x.target : en >= x.target) continue;
      const tr = simulate(bars, r, x.side, en, en - x.side * x.risk, x.target); if (tr) out.push(tr); break; } }
  return out;
}

const phi = (z) => { const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2); return z >= 0 ? (1 + y) / 2 : (1 - y) / 2; };
export const pOne = (t) => (Number.isFinite(t) ? 1 - phi(t) : 1);
export function holm(ps) { const ix = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), m = ps.length, adj = Array(m); let run = 0;
  ix.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (m - k) * p)); adj[i] = run; }); return adj; }
const r3 = (x) => +x.toFixed(3), r2 = (x) => +x.toFixed(2);
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
// t on calendar-month sums (booked by the exit's UTC month), every month from..to counted
export function monthT(T, from, to) {
  const a = ym(from), b = ym(to), s = Array(b - a + 1).fill(0); for (const x of T) { const m = ym(x.exitT) - a; if (m >= 0 && m < s.length) s[m] += x.net; }
  const n = s.length, mu = s.reduce((p, q) => p + q, 0) / n, sd = Math.sqrt(s.reduce((p, q) => p + (q - mu) ** 2, 0) / (n - 1));
  return { months: n, t: sd ? mu / (sd / Math.sqrt(n)) : 0 };
}
export function stats(T, from, to) {
  const n = T.length, s = T.reduce((a, x) => a + x.net, 0), g = T.reduce((a, x) => a + x.R, 0), win = T.filter((x) => x.net > 0).reduce((a, x) => a + x.net, 0), loss = -T.filter((x) => x.net < 0).reduce((a, x) => a + x.net, 0);
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const mo = monthT(T, from, to);
  return { n, avg: n ? r3(s / n) : 0, gross: n ? r3(g / n) : 0, total: r2(s), wr: n ? r2(T.filter((x) => x.net > 0).length / n * 100) : 0, pf: loss ? r2(win / loss) : null, dd: r2(dd), tMonth: r2(mo.t), months: mo.months,
    targets: T.filter((x) => x.how === 'target').length, stops: T.filter((x) => x.how === 'stop').length, medRisk: n ? r2(T.map((x) => x.risk).sort((p, q) => p - q)[Math.floor(n / 2)]) : null };
}

export const RULES = { R1: {}, R2: { monWed: true }, R3: { far: true } };
const T0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const WIN = { dec: [T0('2020-01-01'), null], rep: [T0('2008-01-01'), T0('2020-01-01') - 1] };

export function study(rows) {
  let weeks = weeksOf(rows);
  const lw = weeks.at(-1); if (lw && !lw.bars.some((b) => b.cut)) weeks = weeks.slice(0, -1);   // the last week, unless it reached Friday 16:00 New York
  const end = weeks.at(-1).bars.at(-1).t + H, out = { rules: {} };
  const winOf = (T, [a, b]) => T.filter((x) => x.entryT >= a && x.entryT <= (b ?? end));
  for (const [name, opts] of Object.entries(RULES)) {
    const T = trades(weeks, opts), dec = winOf(T, WIN.dec), rep = winOf(T, WIN.rep), sd = stats(dec, WIN.dec[0], end), sr = stats(rep, ...WIN.rep);
    const years = {}; for (const x of T) { const y = new Date(x.entryT * 1000).getUTCFullYear(); if (y < 2008) continue; (years[y] ||= []).push(x); }
    const yr = Object.fromEntries(Object.entries(years).map(([y, a]) => { const s = a.reduce((p, q) => p + q.net, 0); return [y, { n: a.length, avg: r3(s / a.length), total: r2(s) }]; }));
    const sides = Object.fromEntries([['buy', 1], ['sell', -1]].map(([k, v]) => [k, { dec: stats(dec.filter((x) => x.side === v), WIN.dec[0], end), rep: stats(rep.filter((x) => x.side === v), ...WIN.rep) }]));
    const pl = []; for (let s = 1; s <= 40; s++) { const P = winOf(placebo(weeks, dec, s), WIN.dec); pl.push(P.length ? P.reduce((a, x) => a + x.net, 0) / P.length : 0); }
    const beat = pl.filter((v) => sd.avg > v).length;
    out.rules[name] = { opts, dec: sd, rep: sr, years: yr, sides, placebo: { seeds: 40, beat, median: r3([...pl].sort((a, b) => a - b)[20]), min: r3(Math.min(...pl)), max: r3(Math.max(...pl)) }, p: pOne(sd.tMonth) };
  }
  const names = Object.keys(out.rules), adj = holm(names.map((k) => out.rules[k].p));
  names.forEach((k, i) => { const r = out.rules[k]; r.p = +r.p.toFixed(4); r.holmP = +adj[i].toFixed(4);
    r.checks = { avg: r.dec.avg > 0, t: r.dec.tMonth >= 2 && r.holmP <= 0.05, n: r.dec.n >= 80, rep: r.rep.avg > 0, placebo: r.placebo.beat >= 38 };
    r.pass = Object.values(r.checks).every(Boolean); });
  out.verdict = names.some((k) => out.rules[k].pass) ? 'PASS' : 'FAIL';
  out.data = { src: 'OANDA mid H1 XAU/USD via /md/bars', from: new Date(rows[0][0] * 1000).toISOString().slice(0, 10), to: new Date(end * 1000).toISOString().slice(0, 16), candles: rows.length, weeks: weeks.length };
  out.costs = { roundTrip: COST, financing: { rate: FIN.xau.long, asOf: FIN.xau.asOf, longsOnly: true } };
  return out;
}

async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', m = new Map(), END = Math.floor(Date.now() / 1000);
  for (let a = T0('2007-10-01'); a < END;) { const b = Math.min(END, a + 4999 * H); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) { try { const r = await fetch(`${BASE}bars?sym=xau&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
      if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); }
      if (!j) await new Promise((s) => setTimeout(s, 2000 * (k + 1))); }
    if (!j) throw new Error(`${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    process.stderr.write(`${new Date(a * 1000).toISOString().slice(0, 10)} ${m.size}\n`); a = b; await new Promise((s) => setTimeout(s, 300)); }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(path.join(dir, 'xau-1h.json.gz'), zlib.gzipSync(JSON.stringify(rows)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchAll(dir);
  else if (cmd === 'full') {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-1h.json.gz'))));
    const r = study(rows); r.built = new Date().toISOString().slice(0, 10);
    const res = { built: r.built, verdict: r.verdict, data: r.data, costs: r.costs, windows: { decisive: '2020-01-01 to the end of the data', replication: '2008-01-01 to 2019-12-31' }, rules: r.rules };
    fs.writeFileSync(path.join(DIR, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    for (const [k, v] of Object.entries(r.rules)) console.log(k, JSON.stringify({ dec: v.dec, rep: v.rep, placebo: v.placebo, holmP: v.holmP, checks: v.checks, sides: { b: v.sides.buy.dec.avg, s: v.sides.sell.dec.avg } }));
    console.log('verdict', r.verdict, r.data);
  } else console.log('usage: run.mjs fetch|full <dir>');
}
