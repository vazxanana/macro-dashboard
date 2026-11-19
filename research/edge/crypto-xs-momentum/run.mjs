// Cross-sectional momentum among coins, 3-week look-back, weekly rebalance (pre-registered 14 Nov 2026, PREREGISTRATION.md).
// Every Monday 00:00 UTC rank the eligible coins by close(Sunday) / close(Sunday - 21 days) - 1, long the top third and short
// the bottom third at Monday's open, 1R = stop = 2 x ATR(20) daily, out at the week's last close; net of the council's crypto
// CFD round trip and the demo broker's crypto financing. Paper research only: nothing live reads this file.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CFD_CRYPTO } from '../../../council/fills.mjs';

export const COINS = ['btc', 'eth', 'bnb', 'ltc', 'ada', 'xrp', 'trx', 'link', 'doge', 'sol'];
export const P = {
  LOOK_W: 3, MIN_CANDLES: 60, MIN_N: 6, ATR_N: 20, ATR_MULT: 2, COST: CFD_CRYPTO, SEEDS: 40, PLACEBO_BEAT: 38,
  // financing, fraction a year (ctrader/symbols.json swap type 1; coins not offered there: 15 % both sides assumed)
  FIN: { btc: { long: 0.15, short: 0.075 }, eth: { long: 0.15, short: 0.10 }, sol: { long: 0.15, short: 0.15 } },
  FIN_DEFAULT: { long: 0.15, short: 0.15 },
};
export const VARIANTS = { '1w': 1, '4w': 4 };
const DAY = 86400;
export const dayOf = (t) => Math.floor(t / DAY);
export const iso = (d) => new Date(d * DAY * 1000).toISOString().slice(0, 10);
export const finRate = (key, side) => (P.FIN[key] || P.FIN_DEFAULT)[side > 0 ? 'long' : 'short'];

// one coin: bars and day number -> bar index
export function indexCoin(key, bars) {
  const at = new Map();
  bars.forEach((b, i) => at.set(dayOf(b.time), i));
  return { key, bars, at };
}

// ─── the signal (closes up to and including Sunday M - 1 only) ───
export function eligible(c, M, lookW = P.LOOK_W) {
  const iM = c.at.get(M), iS = c.at.get(M - 1), iL = c.at.get(M - 1 - 7 * lookW);
  if (iM == null || iS == null || iL == null) return null;
  if (iM < P.MIN_CANDLES) return null; // candles dated before M (bars are sorted, so the index counts them)
  return { iS, r: c.bars[iS].close / c.bars[iL].close - 1 };
}
export function rankAt(coins, M, lookW = P.LOOK_W) {
  const r = [];
  coins.forEach((c, k) => { const e = eligible(c, M, lookW); if (e && Number.isFinite(e.r)) r.push({ key: c.key, k, r: e.r }); });
  return r.sort((x, y) => y.r - x.r || x.k - y.k).map((x) => x.key);
}
export const topBottom = (ranked) => { const k = Math.floor(ranked.length / 3); return { k, long: ranked.slice(0, k), short: ranked.slice(ranked.length - k) }; };

export function atr(bars, d, n = P.ATR_N) {
  if (d - n < 0) return null;
  let s = 0;
  for (let i = d - n + 1; i <= d; i++) { const b = bars[i], pc = bars[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}

// ─── one leg: entry at the first candle's open, stop at 1R (gap fill at the open), else out at the last candle's close ───
// idx = the coin's bar indexes of the holding week, in order; returns the candle position (0 = Monday) of the exit
export function simLeg(bars, idx, side, dist) {
  const entry = bars[idx[0]].open, stop = side > 0 ? entry - dist : entry + dist;
  for (let j = 0; j < idx.length; j++) {
    const b = bars[idx[j]];
    if (side > 0 && b.low <= stop) { const gap = b.open <= stop; return { entry, stop, exit: gap ? b.open : stop, pos: j, how: gap ? 'gap' : 'stop' }; }
    if (side < 0 && b.high >= stop) { const gap = b.open >= stop; return { entry, stop, exit: gap ? b.open : stop, pos: j, how: gap ? 'gap' : 'stop' }; }
  }
  return { entry, stop, exit: bars[idx.at(-1)].close, pos: idx.length - 1, how: 'close' };
}
// nights held: 7 for a full week, i for a leg stopped in the week's (i+1)-th candle (Monday = 0)
export const nightsHeld = (L, full) => (L.how === 'close' ? (full ? 7 : L.pos + 1) : L.pos);

export function leg(c, M, side) {
  const iM = c.at.get(M), iS = c.at.get(M - 1);
  if (iM == null || iS == null) return null;
  const a = atr(c.bars, iS); if (!a) return null;
  const idx = []; for (let d = M; d < M + 7; d++) { const i = c.at.get(d); if (i != null) idx.push(i); }
  const dist = P.ATR_MULT * a, L = simLeg(c.bars, idx, side, dist);
  const gross = (side * (L.exit - L.entry)) / dist;
  const costR = (P.COST * L.entry) / dist;
  const n = nightsHeld(L, idx.length === 7);
  const finR = (n * (finRate(c.key, side) / 365) * L.entry) / dist;
  return { key: c.key, side, gross, costR, finR, nights: n, how: L.how, candles: idx.length };
}

// ─── the book: one row per Monday ───
export function runBook(coins, mondays, { lookW = P.LOOK_W, pick = topBottom } = {}) {
  const byKey = Object.fromEntries(coins.map((c) => [c.key, c])), out = [];
  for (const M of mondays) {
    const ranked = rankAt(coins, M, lookW);
    if (ranked.length < P.MIN_N) continue;
    const pk = pick(ranked), legs = [];
    for (const [ks, side] of [[pk.long, 1], [pk.short, -1]]) for (const k of ks) { const l = leg(byKey[k], M, side); if (l) legs.push(l); }
    if (!legs.length) continue;
    out.push({ M, week: iso(M), month: iso(M).slice(0, 7), n: ranked.length, k: pk.k, long: pk.long, short: pk.short, legs });
  }
  return out;
}
export const legNet = (l, x = 1) => l.gross - x * (l.costR + l.finR);
export function weekR(w, x = 1, f = () => true) { const ls = w.legs.filter(f); return ls.length ? ls.reduce((s, l) => s + legNet(l, x), 0) / ls.length : 0; }

// ─── statistics ───
const r3 = (v, k = 3) => +v.toFixed(k);
export function tOf(v) {
  const n = v.length; if (n < 2) return 0;
  const m = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  return sd ? (m / sd) * Math.sqrt(n) : 0;
}
export function monthSums(weeks, x = 1, f) {
  const m = new Map(); for (const w of weeks) m.set(w.month, (m.get(w.month) || 0) + weekR(w, x, f));
  return [...m.values()];
}
export function summary(weeks, x = 1, f) {
  const v = weeks.map((w) => weekR(w, x, f)), n = v.length; if (!n) return { n: 0 };
  const mean = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  let cum = 0, peak = 0, dd = 0; for (const y of v) { cum += y; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  const ms = monthSums(weeks, x, f);
  return { weeks: n, months: ms.length, meanWeek: r3(mean, 4), total: r3(cum, 2), tMonth: r3(tOf(ms), 2), sharpe: sd ? r3((mean / sd) * Math.sqrt(52), 2) : 0, dd: r3(dd, 2), posWeeksPct: r3((v.filter((y) => y > 0).length / n) * 100, 1) };
}
function legStats(weeks, f = () => true) {
  const legs = weeks.flatMap((w) => w.legs).filter(f), n = legs.length; if (!n) return { n: 0 };
  const s = (g) => legs.reduce((a, l) => a + g(l), 0);
  return {
    n, long: legs.filter((l) => l.side > 0).length, short: legs.filter((l) => l.side < 0).length,
    meanGross: r3(s((l) => l.gross) / n, 4), meanNet: r3(s((l) => legNet(l)) / n, 4), meanNet2x: r3(s((l) => legNet(l, 2)) / n, 4),
    meanCost: r3(s((l) => l.costR) / n, 4), meanFin: r3(s((l) => l.finR) / n, 4), tLegNet: r3(tOf(legs.map((l) => legNet(l))), 2),
    winPct: r3((legs.filter((l) => legNet(l) > 0).length / n) * 100, 1),
    stopped: legs.filter((l) => l.how !== 'close').length, gapFills: legs.filter((l) => l.how === 'gap').length,
    shortWeekLegs: legs.filter((l) => l.candles < 7).length,
  };
}
export function percentile(vals, q) { const s = [...vals].sort((a, b) => a - b), h = (s.length - 1) * q, lo = Math.floor(h); return lo + 1 < s.length ? s[lo] + (h - lo) * (s[lo + 1] - s[lo]) : s[lo]; }
export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function randomPick(rng) { return (ranked) => { const c = [...ranked]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return topBottom(c); }; }

// every Monday (day number) from the first candle to the last Monday whose Sunday is on file for at least one coin
export function mondays(coins) {
  const first = Math.min(...coins.map((c) => dayOf(c.bars[0].time))), last = Math.max(...coins.map((c) => dayOf(c.bars.at(-1).time)));
  const out = []; let d = first; while (new Date(d * DAY * 1000).getUTCDay() !== 1) d++;
  for (; d + 6 <= last; d += 7) out.push(d);
  return out;
}

const window = (weeks) => ({
  from: weeks[0]?.week, to: weeks.at(-1)?.week,
  gross: summary(weeks, 0), net: summary(weeks, 1), net2x: summary(weeks, 2),
  longLegsNet: summary(weeks, 1, (l) => l.side > 0), shortLegsNet: summary(weeks, 1, (l) => l.side < 0),
  legs: legStats(weeks),
});
function perCoin(weeks) {
  const o = Object.fromEntries(COINS.map((k) => [k, { long: 0, short: 0, netR: 0, grossR: 0 }]));
  for (const w of weeks) for (const l of w.legs) { const r = o[l.key]; r[l.side > 0 ? 'long' : 'short']++; r.netR += legNet(l); r.grossR += l.gross; }
  for (const k of COINS) { o[k].netR = r3(o[k].netR, 2); o[k].grossR = r3(o[k].grossR, 2); }
  return o;
}
function perYear(weeks) {
  const o = {};
  for (const w of weeks) { const y = w.week.slice(0, 4); (o[y] ||= { weeks: 0, gross: 0, net: 0 }); o[y].weeks++; o[y].gross += weekR(w, 0); o[y].net += weekR(w, 1); }
  for (const y in o) { o[y].gross = r3(o[y].gross, 2); o[y].net = r3(o[y].net, 2); }
  return o;
}
// context: equal-weight spot buy and hold of the eligible coins, Monday open to Sunday close, no costs (fraction a week)
function buyHold(coins, weeks) {
  const byKey = Object.fromEntries(coins.map((c) => [c.key, c]));
  const v = weeks.map((w) => {
    const ks = [...w.long, ...w.short, ...rankAt(coins, w.M)].filter((k, i, a) => a.indexOf(k) === i);
    const rs = ks.map((k) => { const c = byKey[k], a = c.at.get(w.M), b = c.at.get(w.M + 6) ?? c.at.get(w.M + 5); return a != null && b != null ? c.bars[b].close / c.bars[a].open - 1 : null; }).filter((x) => x != null);
    return rs.reduce((s, x) => s + x, 0) / rs.length;
  });
  const n = v.length, m = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  return { weeks: n, meanWeekPct: r3(m * 100, 3), sharpe: r3((m / sd) * Math.sqrt(52), 2) };
}

// ─── the whole study ───
export function study(coins) {
  const all = runBook(coins, mondays(coins));
  const half = Math.floor(all.length / 2), IS = all.slice(0, half), OOS = all.slice(half);
  const oosMondays = OOS.map((w) => w.M);
  const placebo = [];
  for (let s = 1; s <= P.SEEDS; s++) {
    const ws = runBook(coins, oosMondays, { pick: randomPick(mulberry32(s)) });
    const v = ws.map((w) => weekR(w, 1));
    placebo.push({ seed: s, meanWeek: r3(v.reduce((a, b) => a + b, 0) / v.length, 4), tMonth: r3(tOf(monthSums(ws, 1)), 2) });
  }
  const I = window(IS), O = window(OOS), pm = placebo.map((p) => p.meanWeek);
  const real = O.net.meanWeek, beaten = pm.filter((x) => real > x).length;
  const checks = { oosT2: O.net.tMonth >= 2, isPositive: I.net.meanWeek > 0, oos2xPositive: O.net2x.meanWeek > 0, placebo95: beaten >= P.PLACEBO_BEAT };
  const variants = {};
  for (const [name, lw] of Object.entries(VARIANTS)) {
    const ws = runBook(coins, mondays(coins), { lookW: lw }), h = Math.floor(ws.length / 2);
    variants[name] = { inSample: window(ws.slice(0, h)), outOfSample: window(ws.slice(h)) };
  }
  const verdict = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
  return {
    study: 'crypto-xs-momentum', built: '2026-11-14', verdict,
    system: 'Weekly cross-sectional momentum among ten coins (Binance daily, CFD costs and financing)',
    rule: '3-week return rank, long top third / short bottom third, 1R = stop = 2 x ATR(20) daily, weekly, Monday 00:00 UTC',
    params: { ...P, COST: P.COST }, universe: COINS,
    data: Object.fromEntries(coins.map((c) => [c.key, { first: iso(dayOf(c.bars[0].time)), last: iso(dayOf(c.bars.at(-1).time)), candles: c.bars.length }])),
    weeks: { traded: all.length, from: all[0].week, to: all.at(-1).week, inSample: { from: IS[0].week, to: IS.at(-1).week, n: IS.length }, outOfSample: { from: OOS[0].week, to: OOS.at(-1).week, n: OOS.length } },
    coinsPerWeek: all.reduce((o, w) => ((o[w.n] = (o[w.n] || 0) + 1), o), {}),
    inSample: I, outOfSample: O,
    placebo: { seeds: P.SEEDS, real, beaten, p5: r3(percentile(pm, 0.05), 4), p50: r3(percentile(pm, 0.5), 4), p95: r3(percentile(pm, 0.95), 4), max: r3(Math.max(...pm), 4), runs: placebo },
    checks,
    buyHold: { inSample: buyHold(coins, IS), outOfSample: buyHold(coins, OOS) },
    byYear: perYear(all), byCoin: { inSample: perCoin(IS), outOfSample: perCoin(OOS) },
    variants,
    weekly: all.map((w) => ({ week: w.week, n: w.n, long: w.long, short: w.short, gross: r3(weekR(w, 0), 4), net: r3(weekR(w, 1), 4) })),
  };
}

// ─── data ───
const SYM = (k) => `${k.toUpperCase()}USDT`;
const gitRead = (k) => execFileSync('git', ['show', `origin/council-data:research/candles/crypto1d/${SYM(k)}_1d.json.gz`], { maxBuffer: 1 << 28 });
export const rowsToBars = (rows) => rows.map((x) => ({ time: +x[0], open: +x[1], high: +x[2], low: +x[3], close: +x[4] }));
export function loadCoins(read = gitRead) { return COINS.map((k) => indexCoin(k, rowsToBars(JSON.parse(zlib.gunzipSync(read(k)))))); }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const res = study(loadCoins());
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(res, null, 1) + '\n');
  const { inSample: I, outOfSample: O } = res;
  console.log(res.verdict, res.checks, res.weeks, res.coinsPerWeek);
  for (const [n, w] of [['IS', I], ['OOS', O]]) console.log(n, 'gross', w.gross, '\nnet', w.net, '\nnet2x', w.net2x, '\nlong', w.longLegsNet, '\nshort', w.shortLegsNet, '\nlegs', w.legs);
  console.log('placebo', { ...res.placebo, runs: undefined });
  console.log('buyHold', res.buyHold);
  for (const [n, v] of Object.entries(res.variants)) console.log(n, 'IS', v.inSample.net, 'OOS', v.outOfSample.net);
  console.log(res.byYear); console.log(res.byCoin);
}
