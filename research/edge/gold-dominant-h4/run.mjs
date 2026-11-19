// The direction of the day's widest H4 candle, followed the next day (PREREGISTRATION.md, pushed first).
//   node --use-env-proxy research/edge/gold-dominant-h4/run.mjs fetch <dir>   OANDA mid H1 gold -> <dir>/xau-h1.json (keep out of git)
//   node research/edge/gold-dominant-h4/run.mjs count <dir>                   signal counts per window only (no returns)
//   node research/edge/gold-dominant-h4/run.mjs full <dir>                    the study -> result.json (+ prints a summary)
// A stand-alone daily rule: never a gate, exit, entry or size of the live gold book. Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { nights, FIN } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

export const H = 3600, DAY = 86400;
export const SPREAD = 0.30, SLIP = SPREAD / 2, RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const ATR_N = 20, STOP_ATR = 1, MIN_BLOCK = 3, MIN_DAY = 20, MIN_NEXT = 15, MAX_GAP = 4;
export const WIN = { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };
export const SEED = 20261114, SEEDS = 40;

// New York day key (days since epoch of the New York calendar day the 17:00 session ends on) and New York start hour
export function nyOf(t) {
  const loc = t - nyOffsetH(t) * H;
  return { key: Math.floor((loc + 7 * H) / DAY), hour: Math.floor((((loc % DAY) + DAY) % DAY) / H) };
}
// H4 block of a New York hour: 0 = 17-20, 1 = 21-00, 2 = 01-04, 3 = 05-08, 4 = 09-12, 5 = 13-16 New York
export const blockOf = (hr) => Math.floor(((hr - 17 + 24) % 24) / 4);
// H1 rows [t,o,h,l,c] -> New York days { key, bars: [{t,o,h,l,c,hr}], high, low, close }
export function toDays(h1) {
  const m = new Map();
  for (const [t, o, h, l, c] of h1) { const { key, hour } = nyOf(t); if (!m.has(key)) m.set(key, []); m.get(key).push({ t, o, h, l, c, hr: hour }); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([key, bars]) => ({
    key, bars, high: Math.max(...bars.map((x) => x.h)), low: Math.min(...bars.map((x) => x.l)), open: bars[0].o, close: bars.at(-1).c }));
}
export const ymdKey = (k) => new Date(k * DAY * 1000).toISOString().slice(0, 10);
const ordered = (bars) => bars.every((b, j) => !j || b.t > bars[j - 1].t);

// the six H4 blocks of a day: { o, h, l, c, n } or null when a block has fewer than MIN_BLOCK H1 candles
export function blocks(day) {
  const B = Array.from({ length: 6 }, () => []);
  for (const b of day.bars) B[blockOf(b.hr)].push(b);
  return B.map((x) => (x.length < MIN_BLOCK ? null : { o: x[0].o, h: Math.max(...x.map((y) => y.h)), l: Math.min(...x.map((y) => y.l)), c: x.at(-1).c, n: x.length }));
}

// the setup of day i (the signal day), read from day i and the days before only; the path is days i+1 .. i+hold
export function setup(D, i, hold = 3) {
  if (i < ATR_N + 1 || i + hold >= D.length) return null;
  const d = D[i];
  if (d.bars.length < MIN_DAY || !ordered(d.bars)) return null;
  const B = blocks(d);
  if (B.some((x) => !x)) return null;
  let dom = 0; for (let k = 1; k < 6; k++) if (B[k].h - B[k].l > B[dom].h - B[dom].l) dom = k;   // ties: the earliest block
  let s = 0;
  for (let j = i - ATR_N + 1; j <= i; j++) s += Math.max(D[j].high, D[j - 1].close) - Math.min(D[j].low, D[j - 1].close);
  const next = [];
  for (let k = 1; k <= hold; k++) {
    const x = D[i + k];
    if (x.key - D[i + k - 1].key > MAX_GAP || x.bars.length < MIN_NEXT || !ordered(x.bars)) break;
    next.push(x);
  }
  if (!next.length) return null;
  return { i, day: ymdKey(d.key), atr: s / ATR_N, dom, domDir: Math.sign(B[dom].c - B[dom].o), dayDir: Math.sign(d.close - d.open),
    domRange: B[dom].h - B[dom].l, next };
}
export const TESTS = {
  T1: { name: 'T1 follow the widest H4 of the day, next day', hold: 1, side: (s) => s.domDir },
  T2: { name: 'T2 follow the widest H4 when the day closed against it, next day', hold: 1, side: (s) => (s.domDir && s.dayDir === -s.domDir ? s.domDir : 0) },
  T3: { name: 'T3 as T2, held three days', hold: 3, side: (s) => (s.domDir && s.dayDir === -s.domDir ? s.domDir : 0) },
};
// one trade: entry at the first open of day i+1, stop 1 ATR, out at the close of day i+hold; stop first, gaps at the open
export function simulate(s, side, hold) {
  if (s.next.length < hold) return null;
  const r = s.next.slice(0, hold).flatMap((d) => d.bars), entry = r[0].o, risk = STOP_ATR * s.atr, stop = entry - side * risk;
  let exit = null, how = 'time', j = 0;
  for (; j < r.length; j++) {
    const x = r[j];
    if (side > 0 ? x.l <= stop : x.h >= stop) { exit = side > 0 ? Math.min(x.o, stop) : Math.max(x.o, stop); how = 'stop'; break; }
  }
  if (exit == null) { j = r.length - 1; exit = r[j].c; }
  const entryT = r[0].t, exitT = r[j].t + H, gross = side * (exit - entry) / risk, nn = side > 0 ? nights(entryT, exitT) : 0;
  const cost = RT / risk, fin = side > 0 ? nn * FIN.xau.long * entry / risk : 0;
  return { day: s.day, side, entryT, exitT, entry, stop, risk, exit, how, nights: nn, gross, cost, fin,
    net: gross - (cost + fin), net2: gross - 2 * (cost + fin) };
}
export function allSetups(D) { const out = []; for (let i = 0; i < D.length; i++) { const s = setup(D, i); if (s) out.push(s); } return out; }
export function runTest(S, test, sideOf = test.side) { const out = []; for (const s of S) { const side = sideOf(s); if (!side) continue; const t = simulate(s, side, test.hold); if (t) out.push(t); } return out; }

// baseline: mean net R of the same trade (same hold) on every usable day, per calendar year and side
export function baseline(S, hold) {
  const acc = new Map();
  for (const s of S) for (const side of [1, -1]) { const tr = simulate(s, side, hold); if (!tr) continue; const k = `${s.day.slice(0, 4)}:${side}`;
    const a = acc.get(k) || { n: 0, sum: 0 }; a.n++; a.sum += tr.net; acc.set(k, a); }
  return new Map([...acc].map(([k, a]) => [k, a.sum / a.n]));
}
export const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const inWin = (T, [f, t]) => T.filter((x) => x.day >= f && x.day <= t);
export function monthT(T, [f, t], key = 'net') {
  const sums = new Map();
  for (let y = +f.slice(0, 4), m = +f.slice(5, 7); `${y}-${String(m).padStart(2, '0')}` <= t.slice(0, 7); m === 12 ? (y++, m = 1) : m++) sums.set(`${y}-${String(m).padStart(2, '0')}`, 0);
  for (const x of T) { const k = x.day.slice(0, 7); if (sums.has(k)) sums.set(k, sums.get(k) + x[key]); }
  const v = [...sums.values()], n = v.length, m = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  return { months: n, t: sd ? m / (sd / Math.sqrt(n)) : 0 };
}
export const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
export function holm(ps) { const o = ps.map((p, k) => [p, k]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let run = 0;
  o.forEach(([p, k], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); adj[k] = run; }); return adj; }
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(3)), r2 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(2));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export function summary(T, w) {
  const n = T.length, avg = (k) => (n ? T.reduce((a, x) => a + x[k], 0) / n : null);
  const mt = monthT(T, w), mg = monthT(T, w, 'gross'), m2 = monthT(T, w, 'net2'), ml = monthT(T, w, 'lift');
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, gross: r3(avg('gross')), net: r3(avg('net')), net2x: r3(avg('net2')), cost: r3(avg('cost')), fin: r3(avg('fin')),
    lift: r3(avg('lift')), tLift: r2(ml.t), total: r2(T.reduce((a, x) => a + x.net, 0)), win: n ? r2(T.filter((x) => x.net > 0).length / n * 100) : null,
    stops: T.filter((x) => x.how === 'stop').length, longs: T.filter((x) => x.side > 0).length,
    months: mt.months, t: r2(mt.t), tGross: r2(mg.t), t2x: r2(m2.t), dd: r2(dd) };
}
const withLift = (T, base) => { for (const x of T) x.lift = x.net - (base.get(`${x.day.slice(0, 4)}:${x.side}`) ?? 0); return T; };
// placebo: the same signal days, each side drawn by a seeded coin; returns the OOS mean lift of each draw
export function placebo(S, test, base, seeds = SEEDS) {
  const out = [];
  for (let k = 1; k <= seeds; k++) { const r = rng(SEED + k);
    const T = withLift(inWin(runTest(S, test, (s) => (test.side(s) ? (r() < 0.5 ? 1 : -1) : 0)), WIN.oos), base);
    out.push(mean(T.map((x) => x.lift))); }
  return out;
}
// control: each real OOS trade moved to a random usable day of the same calendar year, same side and hold (keeps the year's
// drift and volatility, removes the day's information); returns the OOS mean net of each draw
export function control(S, real, hold, seeds = SEEDS) {
  const pool = new Map(); for (const s of S) { const y = s.day.slice(0, 4); if (s.next.length < hold) continue; if (!pool.has(y)) pool.set(y, []); pool.get(y).push(s); }
  const out = [];
  for (let k = 1; k <= seeds; k++) { const r = rng(SEED + 1000 + k); let sum = 0, n = 0;
    for (const x of real) { const P = pool.get(x.day.slice(0, 4)); if (!P) continue; sum += simulate(P[Math.floor(r() * P.length)], x.side, hold).net; n++; }
    out.push(n ? sum / n : 0); }
  return out;
}
const band = (pl) => { const s = [...pl].sort((a, b) => a - b); return { p5: r3(s[1]), median: r3(s[19]), p95: r3(s[37]), mean: r3(mean(pl)) }; };

async function fetchH1(dir) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  fs.mkdirSync(dir, { recursive: true });
  const now = Math.floor(Date.now() / 1000), m = new Map();
  for (let a = Math.floor(Date.parse('2006-01-01T00:00:00Z') / 1000); a < now;) {
    const b = Math.min(now, a + 4990 * H); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=xau&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2500 * (k + 1));
    }
    if (!j) throw new Error(`${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(2200);
  }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(path.join(dir, 'xau-h1.json'), JSON.stringify(rows));
  console.log(`xau 1h: ${rows.length} candles`);
}

function count(dir) {
  const h1 = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8')), S = allSetups(toDays(h1));
  for (const [k, test] of Object.entries(TESTS)) for (const [w, win] of Object.entries(WIN)) {
    const n = inWin(S, win).filter((s) => test.side(s) && s.next.length >= test.hold).length;
    console.log(k, w, 'signals', n);
  }
  console.log('usable', Object.fromEntries(Object.entries(WIN).map(([w, win]) => [w, inWin(S, win).length])));
}

function full(dir) {
  const h1 = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8'));
  const D = toDays(h1), S = allSetups(D), bases = { 1: baseline(S, 1), 3: baseline(S, 3) };
  const usable = (w) => S.filter((s) => s.day >= w[0] && s.day <= w[1]).length;
  const domShare = {}; for (const s of inWin(S, ['2007-01-01', WIN.oos[1]])) domShare[s.dom] = (domShare[s.dom] || 0) + 1;
  const out = { built: '2026-11-14',
    data: { src: 'OANDA mid H1 XAU_USD via the site proxy, grouped into New York days (17:00 to 17:00 New York, council/histdata.mjs nyOffsetH)',
      from: ymd(h1[0][0]), to: ymd(h1.at(-1)[0]), h1: h1.length, days: D.length, usableIS: usable(WIN.is), usableOOS: usable(WIN.oos),
      widestBlock: Object.fromEntries(Object.entries(domShare).map(([k, v]) => [['17-21', '21-01', '01-05', '05-09', '09-13', '13-17'][k], v])) },
    costs: { spread: SPREAD, slippagePerOrder: SLIP, roundTrip: RT, financing: { rate: FIN.xau.long, src: FIN.xau.src, side: 'longs only' } },
    rule: { atrN: ATR_N, stopAtr: STOP_ATR, blocks: '17-21, 21-01, 01-05, 05-09, 09-13, 13-17 New York', minBlock: MIN_BLOCK, minDay: MIN_DAY,
      entry: 'first open of the next New York day (17:00 New York)', exit: 'close of the last held New York day, or the stop' },
    windows: WIN, seed: SEED,
    baseline: Object.fromEntries(Object.entries(bases).map(([h, b]) => [`hold${h}`, Object.fromEntries([...b].map(([k, v]) => [k, r3(v)]))])), tests: {} };
  const ps = [];
  for (const [k, test] of Object.entries(TESTS)) {
    const base = bases[test.hold], all = withLift(runTest(S, test), base);
    const oos = inWin(all, WIN.oos), is = inWin(all, WIN.is);
    const so = summary(oos, WIN.oos), si = summary(is, WIN.is);
    const pl = placebo(S, test, base), ct = control(S, oos, test.hold);
    const p = 1 - phi(so.tLift || 0); ps.push(p);
    const years = {}; for (const x of all) { const y = x.day.slice(0, 4); if (y < '2007' || x.day > WIN.oos[1]) continue; (years[y] ||= []).push(x); }
    const side = (T, s, w) => summary(T.filter((x) => x.side === s), w);
    out.tests[k] = { name: test.name, hold: test.hold, oos: so, is: si, p: +p.toFixed(4),
      bySide: { oosLong: side(oos, 1, WIN.oos), oosShort: side(oos, -1, WIN.oos), isLong: side(is, 1, WIN.is), isShort: side(is, -1, WIN.is) },
      placebo: { what: 'random side on the same signal days; OOS mean lift', beaten: pl.filter((m) => so.lift > m).length, of: pl.length, ...band(pl) },
      control: { what: 'same side on random usable days of the same year; OOS mean net', beaten: ct.filter((m) => so.net > m).length, of: ct.length, ...band(ct) },
      years: Object.fromEntries(Object.entries(years).map(([y, T]) => [y, { n: T.length, net: r3(mean(T.map((x) => x.net))), lift: r3(mean(T.map((x) => x.lift))) }])) };
  }
  holm(ps).forEach((h, j) => { const x = Object.values(out.tests)[j]; x.holm = +h.toFixed(4);
    x.checks = { oosLift: x.oos.lift > 0, oosTLift: x.oos.tLift >= 2 && x.holm < 0.05, oosNet: x.oos.net > 0, oosT: x.oos.t >= 2, isLift: x.is.lift > 0,
      cost2x: x.oos.net2x > 0, placebo: x.placebo.beaten >= 38, control: x.control.beaten >= 38, n: x.oos.n >= 100 && x.is.n >= 100 };
    x.pass = Object.values(x.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passAlone = ['T2', 'T3'].filter((k) => out.tests[k].pass);
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out.data));
  for (const [k, x] of Object.entries(out.tests)) console.log(k, JSON.stringify({ oos: x.oos, is: x.is, holm: x.holm, placebo: x.placebo, control: x.control, checks: x.checks }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) throw new Error('usage: run.mjs fetch|count|full <dir>');
  if (cmd === 'fetch') await fetchH1(dir); else if (cmd === 'count') count(dir); else full(dir);
}
