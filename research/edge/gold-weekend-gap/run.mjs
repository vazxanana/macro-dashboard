// Edge research · gold-weekend-gap: does gold's Sunday-open gap fill? A NEW stand-alone rule (a weekend gap fade), decided on
// 2020 to now; 2010-19 replicates. Not a test of the live gold book (owner decision 44), not a duplicate of gold-weekend (the
// daily systems' Sunday stub). Rules, costs, windows and the bar: PREREGISTRATION.md (committed before this file existed).
// Data: OANDA spot gold mid M5 through the council's keyless candle proxy (rows [time, open, high, low, close]), kept out of git.
// Paper research only: nothing here trades or changes a live rule.
//   node --use-env-proxy run.mjs fetch <dir>     -> <dir>/xau-5m.json.gz
//   CANDLES=<dir> node run.mjs run               -> result.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nyOffsetH } from '../../../council/histdata.mjs';
import { financing } from '../../../council/fills.mjs';

export const K = { M5: 300, ATR_N: 20, DAY_MIN: 12, GAP_MIN: 0.25, GAP_MAX: 1.5, R0_MIN: 0.1, COST: 0.30, COST2: 0.60, N_MIN: 80,
  ALPHA: 0.02275, SEEDS: 40, DATA_FROM: Date.UTC(2009, 9, 1) / 1000, REP: [Date.UTC(2010, 0, 1) / 1000, Date.UTC(2020, 0, 1) / 1000], DEC_FROM: Date.UTC(2020, 0, 1) / 1000 };
export const BINS = [[0, 0.25], [0.25, 0.5], [0.5, 1.0], [1.0, 1.5], [1.5, Infinity]];

// ─── New York time ───
// the UTC instant of a New York wall-clock time (y, mo 1-12, d, h, mi); away from the 02:00 Sunday switch, which no time here uses
export function nyTime(y, mo, d, h, mi = 0) { const u = Date.UTC(y, mo - 1, d, h, mi) / 1000; return u + nyOffsetH(u + 5 * 3600) * 3600; }
// New York wall-clock parts of a UTC instant
export function nyParts(t) { const d = new Date((t - nyOffsetH(t) * 3600) * 1000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), mi: d.getUTCMinutes() }; }
const dayNo = (p) => Date.UTC(p.y, p.mo - 1, p.d) / 86400000;
const ofDayNo = (n) => { const d = new Date(n * 86400000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
// the spot-shut weekend: Friday 17:00 to Sunday 17:00 New York
export const shut = (p) => p.wd === 6 || (p.wd === 5 && p.h >= 17) || (p.wd === 0 && p.h < 17);
export const lowerT = (B, t) => { let a = 0, b = B.length; while (a < b) { const m = (a + b) >> 1; if (B[m].time < t) a = m + 1; else b = m; } return a; };

// 17:00-New-York trading days (Sunday evening belongs to Monday), weekend prints dropped: [{ key (day number of the NY date), o, h, l, c, n }]
export function nyDays(M5) {
  const out = [];
  for (const b of M5) { const p = nyParts(b.time); if (shut(p)) continue; const key = dayNo(nyParts(b.time + 7 * 3600)), c = out.at(-1);
    if (!c || c.key !== key) out.push({ key, o: b.open, h: b.high, l: b.low, c: b.close, n: 1 }); else { if (b.high > c.h) c.h = b.high; if (b.low < c.l) c.l = b.low; c.c = b.close; c.n++; } }
  return out.filter((d) => d.n >= K.DAY_MIN);
}
// ATR = mean true range of the last N complete days whose key is at or before `key` (null without N + 1 days)
export function atrAt(days, key) {
  let a = 0, b = days.length; while (a < b) { const m = (a + b) >> 1; if (days[m].key <= key) a = m + 1; else b = m; }
  const j = a - 1; if (j < K.ATR_N) return null;
  let s = 0; for (let i = j - K.ATR_N + 1; i <= j; i++) s += Math.max(days[i].h - days[i].l, Math.abs(days[i].h - days[i - 1].c), Math.abs(days[i].l - days[i - 1].c));
  return s / K.ATR_N;
}

// ─── the weeks ───
// one record per Friday of the data: F, fc (Friday's last close), the reopen candle, the gap, ATR, Monday noon; or a skip reason
export function weeks(M5, days = nyDays(M5)) {
  const out = [], first = nyParts(M5[0].time), last = M5.at(-1).time;
  let n = dayNo(first); while (new Date(n * 86400000).getUTCDay() !== 5) n++;
  for (; ; n += 7) {
    const fr = ofDayNo(n), su = ofDayNo(n + 2), mo = ofDayNo(n + 3);
    const F = nyTime(fr.y, fr.mo, fr.d, 17), sun17 = nyTime(su.y, su.mo, su.d, 17), sun21 = nyTime(su.y, su.mo, su.d, 21), noon = nyTime(mo.y, mo.mo, mo.d, 12);
    if (noon > last + K.M5) break;
    const w = { F, fri: `${fr.y}-${String(fr.mo).padStart(2, '0')}-${String(fr.d).padStart(2, '0')}`, sun17, noon };
    const iF = lowerT(M5, F) - 1, pf = iF >= 0 ? nyParts(M5[iF].time) : null;
    if (!pf || dayNo(pf) !== n || pf.h < 12) { out.push({ ...w, skip: 'friday' }); continue; }
    const iR = lowerT(M5, sun17);
    if (iR >= M5.length || M5[iR].time >= sun21) { out.push({ ...w, skip: 'reopen' }); continue; }
    const atr = atrAt(days, n); if (atr == null) { out.push({ ...w, skip: 'atr' }); continue; }
    const fc = M5[iF].close, ro = M5[iR].open;
    out.push({ ...w, iF, iR, fc, ro, gap: +(ro - fc).toFixed(3), atr: +atr.toFixed(4), gapAtr: Math.abs(ro - fc) / atr });
  }
  return out;
}

// ─── one trade ───
// enters at the close of candle iE; candles after it in order: open beyond the stop -> its open; range reaches the stop -> the
// stop (checked first); range reaches the target -> the target; else the close of the last candle ending at or before endT
export function simTrade(M5, iE, side, entry, r0, target, stop, endT) {
  let k = iE + 1, lastK = iE;
  const done = (t, px, exit) => ({ exitT: t, exitPx: px, exit, R: (side * (px - entry)) / r0 });
  for (; k < M5.length && M5[k].time + K.M5 <= endT; k++) { const b = M5[k];
    if (side > 0 ? b.open <= stop : b.open >= stop) return done(b.time, b.open, 'stop (gap)');
    if (side > 0 ? b.low <= stop : b.high >= stop) return done(b.time, stop, 'stop');
    if (side > 0 ? b.high >= target : b.low <= target) return done(b.time, target, 'target');
    lastK = k; }
  return done(M5[lastK].time + K.M5, M5[lastK].close, 'time');
}
const cost = (t, c) => c / t.r0;
function book(M5, w, iE, side, entry, r0, target, stop) {
  const s = simTrade(M5, iE, side, entry, r0, target, stop, w.noon), filled = M5[iE].time + K.M5;
  const fin = financing({ market: 'xau', side: side > 0 ? 'buy' : 'sell', entry, r0, filled, closed: s.exitT }).finR;
  const t = { F: w.F, fri: w.fri, side, entry, r0: +r0.toFixed(3), target, stop: +stop.toFixed(3), filled, ...s, R: +s.R.toFixed(4), fin };
  t.net = +(t.R - cost(t, K.COST) - fin).toFixed(4); t.net2 = +(t.R - cost(t, K.COST2) - fin).toFixed(4);
  return t;
}
const touched = (M5, a, b, px) => { for (let k = a; k <= b; k++) if (M5[k].low <= px && M5[k].high >= px) return true; return false; };

// Rule G: at the reopen candle's close, toward Friday's close; Rule H: at the first close one hour after the reopen, if not filled yet
export function ruleG(M5, w) {
  const iE = w.iR, entry = M5[iE].close, side = Math.sign(w.fc - entry);
  if (side === 0 || side !== Math.sign(w.fc - w.ro)) return { skip: 'filled' };
  const r0 = Math.abs(w.fc - entry); if (r0 < K.R0_MIN * w.atr) return { skip: 'small' };
  return book(M5, w, iE, side, entry, r0, w.fc, entry - side * r0);
}
export function ruleH(M5, w) {
  const tEnd = M5[w.iR].time + 3600; let iE = w.iR; while (iE < M5.length && M5[iE].time + K.M5 < tEnd) iE++;
  if (iE >= M5.length || M5[iE].time + K.M5 > w.noon) return { skip: 'late' };
  if (touched(M5, w.iR, iE, w.fc)) return { skip: 'filled' };
  const entry = M5[iE].close, side = Math.sign(w.fc - entry); if (side === 0) return { skip: 'filled' };
  const r0 = Math.abs(w.fc - entry); if (r0 < K.R0_MIN * w.atr) return { skip: 'small' };
  return book(M5, w, iE, side, entry, r0, w.fc, entry - side * r0);
}

// ─── statistics ───
export function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
export const tOf = (a) => { const s = sd(a); return s > 0 ? mean(a) / (s / Math.sqrt(a.length)) : 0; };
export const normP = (t) => { // one-sided upper p of a standard normal
  const z = t / Math.SQRT2, x = Math.abs(z), k = 1 / (1 + 0.3275911 * x), e = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  return 0.5 * (1 - (z >= 0 ? e : -e)); };
export function holm(ps, alpha = K.ALPHA) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), ok = ps.map(() => false);
  for (let r = 0; r < o.length; r++) { if (o[r][0] <= alpha / (o.length - r)) ok[o[r][1]] = true; else break; } return ok; }
const r4 = (x) => +x.toFixed(4);
export function stats(T) {
  const net = T.map((t) => t.net), net2 = T.map((t) => t.net2), gross = T.map((t) => t.R), ex = {};
  for (const t of T) ex[t.exit] = (ex[t.exit] || 0) + 1;
  let cum = 0, hi = 0, dd = 0; for (const x of net) { cum += x; if (cum > hi) hi = cum; if (hi - cum > dd) dd = hi - cum; }
  const mon = new Map(); for (const t of T) { const k = new Date(t.F * 1000).toISOString().slice(0, 7); mon.set(k, (mon.get(k) || 0) + t.net); }
  return { n: T.length, win: T.length ? r4(T.filter((t) => t.R > 0).length / T.length) : 0, gross: r4(mean(gross)), net: r4(mean(net)), net2: r4(mean(net2)), t: r4(tOf(net)),
    total: r4(cum), maxDD: r4(dd), months: mon.size, tMonth: r4(tOf([...mon.values()])), fin: r4(T.reduce((s, t) => s + t.fin, 0)), medR0: T.length ? r4(T.map((t) => t.r0).sort((a, b) => a - b)[T.length >> 1]) : 0, exits: ex };
}
const inWin = (t, w) => (w === 'rep' ? t.F >= K.REP[0] && t.F < K.REP[1] : t.F >= K.DEC_FROM);

export function study(M5) {
  const W = weeks(M5), used = W.filter((w) => !w.skip), skipped = {};
  for (const w of W) if (w.skip) skipped[w.skip] = (skipped[w.skip] || 0) + 1;
  const elig = used.filter((w) => w.gapAtr >= K.GAP_MIN && w.gapAtr <= K.GAP_MAX);
  const rules = {}, trades = {};
  for (const [name, fn] of [['G', ruleG], ['H', ruleH]]) {
    const T = [], no = {}; for (const w of elig) { const r = fn(M5, w); if (r.skip) { if (w.F >= K.REP[0]) no[r.skip] = (no[r.skip] || 0) + 1; } else T.push(r); }
    trades[name] = T;
    rules[name] = { noTrade: no, rep: stats(T.filter((t) => inWin(t, 'rep'))), dec: stats(T.filter((t) => inWin(t, 'dec'))) };
    const by = {}; for (const t of T.filter((x) => x.F >= K.REP[0])) { const y = t.fri.slice(0, 4); (by[y] ||= []).push(t); }
    rules[name].byYear = Object.fromEntries(Object.entries(by).map(([y, a]) => [y, { n: a.length, net: r4(mean(a.map((t) => t.net))), total: r4(a.reduce((s, t) => s + t.net, 0)) }]));
  }
  // the pass bar, on the decisive window
  const ps = ['G', 'H'].map((k) => normP(rules[k].dec.t)), hok = holm(ps);
  ['G', 'H'].forEach((k, i) => { const d = rules[k].dec, r = rules[k].rep;
    const c = { netPos: d.net > 0, net2Pos: d.net2 > 0, holm: hok[i], nMin: d.n >= K.N_MIN, repSame: r.net > 0 };
    rules[k].p = r4(ps[i]); rules[k].checks = c; rules[k].pass = Object.values(c).every(Boolean); });
  // the plain fill rate, every week with an ATR, by |gap| / ATR, split up / down
  const fill = {};
  for (const win of ['rep', 'dec']) { fill[win] = BINS.map(([a, b]) => { const ws = used.filter((w) => inWin(w, win) && w.gapAtr >= a && w.gapAtr < b);
    const row = (arr) => { let k = 0; for (const w of arr) { let e = w.iR; while (e + 1 < M5.length && M5[e + 1].time + K.M5 <= w.noon) e++; if (touched(M5, w.iR, e, w.fc)) k++; } return { n: arr.length, filled: k, rate: arr.length ? r4(k / arr.length) : null }; };
    return { bin: `${a}-${b === Infinity ? 'up' : b}`, all: row(ws), up: row(ws.filter((w) => w.gap > 0)), down: row(ws.filter((w) => w.gap < 0)) }; }); }
  // placebo: Rule G's own trades, random direction, 1R either way, same exit time and costs
  const G = trades.G, placebo = [];
  for (let seed = 1; seed <= K.SEEDS; seed++) { const rnd = mulberry(seed), P = [];
    for (const t of G) { const w = elig.find((x) => x.F === t.F), s = rnd() < 0.5 ? -1 : 1, iE = lowerT(M5, t.filled - K.M5);
      P.push(book(M5, w, iE, s, t.entry, t.r0, t.entry + s * t.r0, t.entry - s * t.r0)); }
    placebo.push({ seed, dec: r4(mean(P.filter((x) => inWin(x, 'dec')).map((x) => x.net))), rep: r4(mean(P.filter((x) => inWin(x, 'rep')).map((x) => x.net))) }); }
  const pd = placebo.map((p) => p.dec).sort((a, b) => a - b), q = (f) => pd[Math.min(pd.length - 1, Math.floor(f * pd.length))];
  const plac = { seeds: K.SEEDS, dec: { min: pd[0], p5: q(0.05), median: q(0.5), p95: q(0.95), max: pd.at(-1) }, ruleG: rules.G.dec.net, aboveG: pd.filter((x) => x >= rules.G.dec.net).length, runs: placebo };
  const pass = rules.G.pass || rules.H.pass, robust = { G: rules.G.dec.net > plac.dec.p95, H: rules.H.dec.net > plac.dec.p95 };
  return { weeks: { total: W.length, used: used.length, eligible: elig.filter((w) => w.F >= K.REP[0]).length, eligibleDec: elig.filter((w) => w.F >= K.DEC_FROM).length, skipped }, rules, fill, placebo: plac, robust, pass,
    trades: Object.fromEntries(Object.entries(trades).map(([k, T]) => [k, T.filter((t) => t.F >= K.REP[0]).map((t) => [t.fri, t.side, t.entry, t.r0, +t.exitPx.toFixed(3), t.exit, t.R, t.net])])) };
}

// ─── modes ───
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
export const toBars = (rows) => rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (MODE === 'fetch') {
  const OUT = process.argv[3], f = path.join(OUT, 'xau-5m.json.gz'), m = new Map(), end = Math.floor(Date.now() / 1000 / 86400) * 86400; fs.mkdirSync(OUT, { recursive: true });
  for (let a = K.DATA_FROM; a < end;) { const b = Math.min(end, a + 4999 * K.M5); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) { try { const r = await fetch(`${BASE}bars?sym=xau&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null; if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); } if (!j) await sleep(2000 * (k + 1)); }
    if (!j) throw new Error(`xau 5m ${iso(a)}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(80); }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]); fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(rows))); console.log(`5m: ${rows.length} candles ${iso(rows[0][0])} → ${iso(rows.at(-1)[0])}`);
}
if (MODE === 'run') {
  const M5 = toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.env.CANDLES, 'xau-5m.json.gz'))))).filter((b) => b.time >= K.DATA_FROM);
  const r = study(M5), dec = r.rules;
  const out = { topic: 'gold-weekend-gap', built: '2026-11-13', at: new Date().toISOString(),
    system: 'Gold Sunday-open gap fade: enter toward Friday\'s close after the reopen, target Friday\'s close, 1R stop, out Monday 12:00 New York (spot gold, OANDA M5)',
    prereg: 'research/edge/gold-weekend-gap/PREREGISTRATION.md', candles: { m5: M5.length, from: iso(M5[0].time), to: iso(M5.at(-1).time) },
    window: { replication: '2010-01-01 to 2019-12-31', decisive: `2020-01-01 to ${iso(M5.at(-1).time).slice(0, 10)}` }, params: K,
    verdict: r.pass ? `PASS${r.robust.G || r.robust.H ? '' : ' (not robust: inside the placebo band)'}` : 'FAIL', ...r };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const k of ['G', 'H']) console.log(k, JSON.stringify({ rep: dec[k].rep, dec: dec[k].dec, p: dec[k].p, checks: dec[k].checks, pass: dec[k].pass }));
  console.log('fill', JSON.stringify(r.fill)); console.log('placebo', JSON.stringify({ ...r.placebo, runs: undefined })); console.log('weeks', JSON.stringify(r.weeks), 'verdict', out.verdict);
}
