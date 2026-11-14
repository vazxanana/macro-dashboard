// Edge research · fx-weekend-gap: does a forex major's Sunday-open gap fill? The two rules of research/edge/gold-weekend-gap
// (branch gold-weekend-gap, FAIL on gold), copied here (nothing imported across branches), with only the markets (six forex
// pairs) and the costs (the measured raw-spread model + reopen slippage) changed. Decided on 2020 to now; 2016-19 replicates.
// Rules, costs, windows and the bar: PREREGISTRATION.md (committed before this file existed).
// Data: OANDA mid M5 candles per pair (rows [time, open, high, low, close]), kept out of git.
// Paper research only: nothing here trades or changes a live rule.
//   CANDLES=<dir> node run.mjs run               -> result.json   (<dir>/<pair>-5m.json.gz)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nyOffsetH } from '../../../council/histdata.mjs';
import { nights } from '../../../council/fills.mjs';

export const PAIRS = ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdchf', 'eurjpy'];
export const pipOf = (pair) => (/jpy$/.test(pair) ? 0.01 : 0.0001);
export const K = { M5: 300, ATR_N: 20, DAY_MIN: 12, GAP_MIN: 0.25, GAP_MAX: 1.5, R0_MIN: 0.1, N_MIN: 80,
  SPREAD_PIPS: 0.3, COMM_SIDE: 22.5e-6, SLIP_PIPS: 1, SLIP2_PIPS: 2,
  ALPHA: 0.02275, SEEDS: 40, DATA_FROM: Date.UTC(2015, 10, 1) / 1000, REP: [Date.UTC(2016, 0, 1) / 1000, Date.UTC(2020, 0, 1) / 1000], DEC_FROM: Date.UTC(2020, 0, 1) / 1000 };
export const BINS = [[0, 0.25], [0.25, 0.5], [0.5, 1.0], [1.0, 1.5], [1.5, Infinity]];

// ─── costs (the only change besides the markets) ───
// a round trip in price: the quoted spread + slippage on both sides (pips) + the commission on both sides (a fraction of price)
export function costPx(pair, entry, slipPips = K.SLIP_PIPS) { return pipOf(pair) * (K.SPREAD_PIPS + 2 * slipPips) + 2 * K.COMM_SIDE * entry; }

// ─── New York time (copied) ───
export function nyTime(y, mo, d, h, mi = 0) { const u = Date.UTC(y, mo - 1, d, h, mi) / 1000; return u + nyOffsetH(u + 5 * 3600) * 3600; }
export function nyParts(t) { const d = new Date((t - nyOffsetH(t) * 3600) * 1000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), mi: d.getUTCMinutes() }; }
const dayNo = (p) => Date.UTC(p.y, p.mo - 1, p.d) / 86400000;
const ofDayNo = (n) => { const d = new Date(n * 86400000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
export const shut = (p) => p.wd === 6 || (p.wd === 5 && p.h >= 17) || (p.wd === 0 && p.h < 17);
export const lowerT = (B, t) => { let a = 0, b = B.length; while (a < b) { const m = (a + b) >> 1; if (B[m].time < t) a = m + 1; else b = m; } return a; };

export function nyDays(M5) {
  const out = [];
  for (const b of M5) { const p = nyParts(b.time); if (shut(p)) continue; const key = dayNo(nyParts(b.time + 7 * 3600)), c = out.at(-1);
    if (!c || c.key !== key) out.push({ key, o: b.open, h: b.high, l: b.low, c: b.close, n: 1 }); else { if (b.high > c.h) c.h = b.high; if (b.low < c.l) c.l = b.low; c.c = b.close; c.n++; } }
  return out.filter((d) => d.n >= K.DAY_MIN);
}
export function atrAt(days, key) {
  let a = 0, b = days.length; while (a < b) { const m = (a + b) >> 1; if (days[m].key <= key) a = m + 1; else b = m; }
  const j = a - 1; if (j < K.ATR_N) return null;
  let s = 0; for (let i = j - K.ATR_N + 1; i <= j; i++) s += Math.max(days[i].h - days[i].l, Math.abs(days[i].h - days[i - 1].c), Math.abs(days[i].l - days[i - 1].c));
  return s / K.ATR_N;
}

// ─── the weeks (copied) ───
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
    out.push({ ...w, iF, iR, fc, ro, gap: +(ro - fc).toFixed(6), atr: +atr.toFixed(7), gapAtr: Math.abs(ro - fc) / atr });
  }
  return out;
}

// ─── one trade (copied) ───
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
export function book(pair, M5, w, iE, side, entry, r0, target, stop) {
  const s = simTrade(M5, iE, side, entry, r0, target, stop, w.noon), filled = M5[iE].time + K.M5, pip = pipOf(pair);
  const t = { pair, F: w.F, fri: w.fri, side, entry, r0, r0Pips: +(r0 / pip).toFixed(2), target, stop, filled, ...s, R: +s.R.toFixed(4), nights: nights(filled, s.exitT) };
  t.costR = +(costPx(pair, entry) / r0).toFixed(4); t.cost2R = +(costPx(pair, entry, K.SLIP2_PIPS) / r0).toFixed(4);
  t.net = +(s.R - costPx(pair, entry) / r0).toFixed(4); t.net2 = +(s.R - costPx(pair, entry, K.SLIP2_PIPS) / r0).toFixed(4);
  return t;
}
const touched = (M5, a, b, px) => { for (let k = a; k <= b; k++) if (M5[k].low <= px && M5[k].high >= px) return true; return false; };

export function ruleG(pair, M5, w) {
  const iE = w.iR, entry = M5[iE].close, side = Math.sign(w.fc - entry);
  if (side === 0 || side !== Math.sign(w.fc - w.ro)) return { skip: 'filled' };
  const r0 = Math.abs(w.fc - entry); if (r0 < K.R0_MIN * w.atr) return { skip: 'small' };
  return book(pair, M5, w, iE, side, entry, r0, w.fc, entry - side * r0);
}
export function ruleH(pair, M5, w) {
  const tEnd = M5[w.iR].time + 3600; let iE = w.iR; while (iE < M5.length && M5[iE].time + K.M5 < tEnd) iE++;
  if (iE >= M5.length || M5[iE].time + K.M5 > w.noon) return { skip: 'late' };
  if (touched(M5, w.iR, iE, w.fc)) return { skip: 'filled' };
  const entry = M5[iE].close, side = Math.sign(w.fc - entry); if (side === 0) return { skip: 'filled' };
  const r0 = Math.abs(w.fc - entry); if (r0 < K.R0_MIN * w.atr) return { skip: 'small' };
  return book(pair, M5, w, iE, side, entry, r0, w.fc, entry - side * r0);
}

// ─── statistics (copied; t on calendar-month sums is the bar's t here) ───
export function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
export const tOf = (a) => { const s = sd(a); return s > 0 ? mean(a) / (s / Math.sqrt(a.length)) : 0; };
export const normP = (t) => {
  const z = t / Math.SQRT2, x = Math.abs(z), k = 1 / (1 + 0.3275911 * x), e = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  return 0.5 * (1 - (z >= 0 ? e : -e)); };
export function holm(ps, alpha = K.ALPHA) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), ok = ps.map(() => false);
  for (let r = 0; r < o.length; r++) { if (o[r][0] <= alpha / (o.length - r)) ok[o[r][1]] = true; else break; } return ok; }
const r4 = (x) => +x.toFixed(4);
export function monthSums(T) { const mon = new Map(); for (const t of T) { const k = new Date(t.F * 1000).toISOString().slice(0, 7); mon.set(k, (mon.get(k) || 0) + t.net); } return mon; }
export function stats(T0) {
  const T = T0.slice().sort((a, b) => a.filled - b.filled), net = T.map((t) => t.net), ex = {};
  for (const t of T) ex[t.exit] = (ex[t.exit] || 0) + 1;
  let cum = 0, hi = 0, dd = 0; for (const x of net) { cum += x; if (cum > hi) hi = cum; if (hi - cum > dd) dd = hi - cum; }
  const mon = monthSums(T), med = (a) => (a.length ? r4(a.slice().sort((x, y) => x - y)[a.length >> 1]) : 0);
  return { n: T.length, win: T.length ? r4(T.filter((t) => t.R > 0).length / T.length) : 0, gross: r4(mean(T.map((t) => t.R))), net: r4(mean(net)), net2: r4(mean(T.map((t) => t.net2))),
    t: r4(tOf(net)), total: r4(cum), maxDD: r4(dd), months: mon.size, tMonth: r4(tOf([...mon.values()])), medR0Pips: med(T.map((t) => t.r0Pips)), medCostR: med(T.map((t) => t.costR)),
    nights: T.reduce((s, t) => s + t.nights, 0), exits: ex };
}
const inWin = (t, w) => (w === 'rep' ? t.F >= K.REP[0] && t.F < K.REP[1] : t.F >= K.DEC_FROM);

// one pair: its weeks, eligible weeks, both rules' trades, the plain fill rows
export function pairStudy(pair, M5) {
  const W = weeks(M5), used = W.filter((w) => !w.skip), skipped = {};
  for (const w of W) if (w.skip && w.F >= K.REP[0]) skipped[w.skip] = (skipped[w.skip] || 0) + 1;
  const elig = used.filter((w) => w.gapAtr >= K.GAP_MIN && w.gapAtr <= K.GAP_MAX), trades = {}, noTrade = {};
  for (const [name, fn] of [['G', ruleG], ['H', ruleH]]) { const T = [], no = {};
    for (const w of elig) { if (w.F < K.REP[0]) continue; const r = fn(pair, M5, w); if (r.skip) no[r.skip] = (no[r.skip] || 0) + 1; else T.push(r); }
    trades[name] = T; noTrade[name] = no; }
  const fillW = used.filter((w) => w.F >= K.REP[0]).map((w) => { let e = w.iR; while (e + 1 < M5.length && M5[e + 1].time + K.M5 <= w.noon) e++;
    return { F: w.F, gap: w.gap, gapAtr: w.gapAtr, filled: touched(M5, w.iR, e, w.fc) }; });
  return { pair, weeks: { total: W.filter((w) => w.F >= K.REP[0]).length, used: fillW.length, skipped, eligibleRep: elig.filter((w) => inWin(w, 'rep')).length, eligibleDec: elig.filter((w) => inWin(w, 'dec')).length },
    elig, trades, noTrade, fillW };
}
function fillTable(fw) {
  const row = (a) => { const k = a.filter((w) => w.filled).length; return { n: a.length, filled: k, rate: a.length ? r4(k / a.length) : null }; };
  const out = {}; for (const win of ['rep', 'dec']) out[win] = BINS.map(([a, b]) => { const ws = fw.filter((w) => inWin(w, win) && w.gapAtr >= a && w.gapAtr < b);
    return { bin: `${a}-${b === Infinity ? 'up' : b}`, all: row(ws), up: row(ws.filter((w) => w.gap > 0)), down: row(ws.filter((w) => w.gap < 0)) }; });
  return out;
}

export function study(data) { // data: { pair: M5 }
  const P = Object.entries(data).map(([pair, M5]) => ({ ...pairStudy(pair, M5), M5 }));
  const rules = {};
  for (const k of ['G', 'H']) { const T = P.flatMap((p) => p.trades[k]), no = {};
    for (const p of P) for (const [s, n] of Object.entries(p.noTrade[k])) no[s] = (no[s] || 0) + n;
    rules[k] = { noTrade: no, rep: stats(T.filter((t) => inWin(t, 'rep'))), dec: stats(T.filter((t) => inWin(t, 'dec'))),
      byPair: Object.fromEntries(P.map((p) => [p.pair, { rep: stats(p.trades[k].filter((t) => inWin(t, 'rep'))), dec: stats(p.trades[k].filter((t) => inWin(t, 'dec'))) }])) };
    const by = {}; for (const t of T) (by[t.fri.slice(0, 4)] ||= []).push(t);
    rules[k].byYear = Object.fromEntries(Object.entries(by).sort().map(([y, a]) => [y, { n: a.length, net: r4(mean(a.map((t) => t.net))), total: r4(a.reduce((s, t) => s + t.net, 0)) }]));
  }
  // the pass bar, decisive window, pooled, on the monthly-sum t
  const ps = ['G', 'H'].map((k) => normP(rules[k].dec.tMonth)), hok = holm(ps);
  ['G', 'H'].forEach((k, i) => { const d = rules[k].dec, r = rules[k].rep;
    const c = { netPos: d.net > 0, net2Pos: d.net2 > 0, holm: hok[i], nMin: d.n >= K.N_MIN, repSame: r.net > 0 };
    rules[k].p = r4(ps[i]); rules[k].checks = c; rules[k].pass = Object.values(c).every(Boolean); });
  const fill = { pooled: fillTable(P.flatMap((p) => p.fillW)), byPair: Object.fromEntries(P.map((p) => [p.pair, fillTable(p.fillW)])) };
  // placebo: Rule G's own pooled trades, random direction, 1R either way, same exit time and costs
  const placebo = [];
  for (let seed = 1; seed <= K.SEEDS; seed++) { const rnd = mulberry(seed), out = [];
    for (const p of P) for (const t of p.trades.G) { const w = p.elig.find((x) => x.F === t.F), s = rnd() < 0.5 ? -1 : 1, iE = lowerT(p.M5, t.filled - K.M5);
      out.push(book(p.pair, p.M5, w, iE, s, t.entry, t.r0, t.entry + s * t.r0, t.entry - s * t.r0)); }
    placebo.push({ seed, dec: r4(mean(out.filter((x) => inWin(x, 'dec')).map((x) => x.net))), rep: r4(mean(out.filter((x) => inWin(x, 'rep')).map((x) => x.net))) }); }
  const pd = placebo.map((p) => p.dec).sort((a, b) => a - b), q = (f) => pd[Math.min(pd.length - 1, Math.floor(f * pd.length))];
  const plac = { seeds: K.SEEDS, dec: { min: pd[0], p5: q(0.05), median: q(0.5), p95: q(0.95), max: pd.at(-1) }, ruleG: rules.G.dec.net, aboveG: pd.filter((x) => x >= rules.G.dec.net).length, runs: placebo };
  const pass = rules.G.pass || rules.H.pass, robust = { G: rules.G.dec.net > plac.dec.p95, H: rules.H.dec.net > plac.dec.p95 };
  const wk = Object.fromEntries(P.map((p) => [p.pair, p.weeks]));
  // post hoc (labelled so in RESULT.md, not in the bar): the decisive window without 2026, and t on weekly sums (the six pairs
  // of one weekend are one bet on the dollar more than six)
  const posthoc = {};
  for (const k of ['G', 'H']) { const T = P.flatMap((p) => p.trades[k]).filter((t) => inWin(t, 'dec')), wkS = new Map();
    for (const t of T) wkS.set(t.F, (wkS.get(t.F) || 0) + t.net);
    posthoc[k] = { dec2020to2025: stats(T.filter((t) => t.fri < '2026')), dec2026: stats(T.filter((t) => t.fri >= '2026')), weeks: wkS.size, tWeek: r4(tOf([...wkS.values()])) }; }
  return { posthoc, weeks: { byPair: wk, eligibleRep: P.reduce((s, p) => s + p.weeks.eligibleRep, 0), eligibleDec: P.reduce((s, p) => s + p.weeks.eligibleDec, 0) }, rules, fill, placebo: plac, robust, pass,
    trades: Object.fromEntries(['G', 'H'].map((k) => [k, P.flatMap((p) => p.trades[k]).sort((a, b) => a.filled - b.filled).map((t) => [t.pair, t.fri, t.side, t.entry, t.r0Pips, +t.exitPx.toFixed(5), t.exit, t.R, t.net, t.net2])])) };
}

// ─── run ───
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
export const toBars = (rows) => rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
if (MODE === 'run') {
  const data = {}, candles = {};
  for (const p of PAIRS) { const M5 = toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.env.CANDLES, `${p}-5m.json.gz`))))).filter((b) => b.time >= K.DATA_FROM);
    data[p] = M5; candles[p] = { m5: M5.length, from: iso(M5[0].time), to: iso(M5.at(-1).time) }; }
  const r = study(data), dec = r.rules, last = Math.min(...Object.values(data).map((M) => M.at(-1).time));
  const out = { topic: 'fx-weekend-gap', built: '2026-11-14', at: new Date().toISOString(),
    system: 'Forex majors Sunday-open gap fade: enter toward Friday\'s close after the reopen, target Friday\'s close, 1R stop, out Monday 12:00 New York (six pairs, OANDA mid M5)',
    prereg: 'research/edge/fx-weekend-gap/PREREGISTRATION.md', copiedFrom: 'research/edge/gold-weekend-gap (branch gold-weekend-gap)', pairs: PAIRS, candles,
    window: { replication: '2016-01-01 to 2019-12-31', decisive: `2020-01-01 to ${iso(last).slice(0, 10)}` }, params: K,
    verdict: r.pass ? `PASS${r.robust.G || r.robust.H ? '' : ' (not robust: inside the placebo band)'}` : 'FAIL', ...r };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const k of ['G', 'H']) console.log(k, JSON.stringify({ rep: dec[k].rep, dec: dec[k].dec, p: dec[k].p, checks: dec[k].checks, pass: dec[k].pass, noTrade: dec[k].noTrade }));
  for (const k of ['G', 'H']) for (const p of PAIRS) console.log(k, p, JSON.stringify({ rep: [dec[k].byPair[p].rep.n, dec[k].byPair[p].rep.net, dec[k].byPair[p].rep.t], dec: [dec[k].byPair[p].dec.n, dec[k].byPair[p].dec.net, dec[k].byPair[p].dec.t] }));
  console.log('fill', JSON.stringify(r.fill.pooled)); console.log('placebo', JSON.stringify({ ...r.placebo, runs: undefined })); console.log('weeks', JSON.stringify(r.weeks), 'verdict', out.verdict);
  console.log('posthoc', JSON.stringify(r.posthoc)); console.log('byYear G', JSON.stringify(dec.G.byYear)); console.log('byYear H', JSON.stringify(dec.H.byYear));
}
