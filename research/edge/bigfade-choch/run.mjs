// Edge research · bigfade-choch: the Big-candle fade entered on a 1-minute (or 30-second) ChoCh instead of at once
// (PREREGISTRATION.md, pushed alone first). Paper research only.
//   EDGE_DATA=<cache> node research/edge/bigfade-choch/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { ATRK } from '../grid7-wide-fade/run.mjs';
import { signals } from '../big-candle-fade/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DAY = 86400;
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const WIN = { d: ['2018-01-01', '2022-01-01'], c: ['2022-01-01', '2026-11-01'], s: ['2024-01-01', '2026-11-01'] };
export const WAIT = { '1m': 3600, '30s': 1800 }, PRE = 30;
const sec = (d) => Date.parse(d + 'T00:00:00Z') / 1000;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN), sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
export const firstAt = (L, t) => { let lo = 0, hi = L.length; while (lo < hi) { const m = (lo + hi) >> 1; if (L[m].t < t) lo = m + 1; else hi = m; } return lo; };
export function load30(market, from, to) { const dir = path.join(K.DATA_DIR, market), a = sec(from), b = sec(to), out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.startsWith('30s-')).sort()) for (const r of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString())) if (r[0] >= a && r[0] < b) out.push({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], e: r[0] + 30 });
  return out; }
// walk a position on L from candle index i (entry at its open): stop first, a gap fills at the open, out at the close after `cap` seconds
export function walk(L, i, s, stop, target, cap = DAY) {
  const fill = L[i].o, risk = s * (fill - stop); if (!(risk > 0)) return null; const dl = L[i].t + cap, R = (px) => (s * (px - fill)) / risk;
  for (let j = i; j < L.length; j++) { const b = L[j];
    if (j > i) { if (s * (b.o - stop) <= 0) return { R: R(b.o), how: 'stop', fill, risk }; if (s * (b.o - target) >= 0) return { R: R(b.o), how: 'target', fill, risk }; }
    const adv = s > 0 ? b.l : b.h, fav = s > 0 ? b.h : b.l;
    if (s * (adv - stop) <= 0) return { R: -1, how: 'stop', fill, risk };
    if (s * (fav - target) >= 0) return { R: R(target), how: 'target', fill, risk };
    if (b.e >= dl) return { R: R(b.c), how: 'time', fill, risk }; }
  return null;
}
// BASE: at the first L candle at or after the big candle's close; the desk's rule (50 % at least 1R away)
export function base(L, g) {
  const i = firstAt(L, g.ts); if (i >= L.length || L[i].t - g.ts > 3600) return { skip: 'nodata' };
  const s = -g.d, stop = g.ext + g.d * ATRK * g.a, fill = L[i].o, risk = s * (fill - stop); if (!(risk > 0)) return { skip: 'bad' };
  const plan = (s * (g.mid - fill)) / risk; if (!(plan >= 1)) return { skip: 'near' };
  const r = walk(L, i, s, stop, g.mid); return r ? { t: L[i].t, plan, ...r } : { skip: 'open' };
}
// CHOCH: the first L close beyond the last confirmed L swing against the candle, within `wait` seconds of its close
export function choch(L, g, wait) {
  const i0 = firstAt(L, g.ts); if (i0 >= L.length || L[i0].t - g.ts > 3600) return { skip: 'nodata' };
  const s = -g.d, up = g.d > 0; let ext = g.ext, lvl = null;
  // a swing against the candle: for a bullish candle the lowest low of five L candles (two each side), mirrored for a bearish one
  const lo = Math.max(2, i0 - PRE), val = (q) => (up ? L[q].l : -L[q].h);
  const piv = (p) => p >= lo && p + 2 < L.length && val(p - 2) > val(p) && val(p - 1) > val(p) && val(p + 1) >= val(p) && val(p + 2) >= val(p);
  for (let p = lo; p + 2 < i0; p++) if (piv(p)) lvl = up ? L[p].l : L[p].h;   // confirmed by candles closed before the big candle closed
  for (let j = i0; j < L.length && L[j].t < g.ts + wait; j++) { const b = L[j];
    if (up ? b.h > ext : b.l < ext) ext = up ? b.h : b.l;
    if (up ? b.h >= g.ext + ATRK * g.a : b.l <= g.ext - ATRK * g.a) return { skip: 'stopFirst' };
    if (up ? b.l <= g.mid : b.h >= g.mid) return { skip: 'targetFirst' };
    if (lvl != null && (up ? b.c < lvl : b.c > lvl)) { if (j + 1 >= L.length) return { skip: 'open' };
      const stop = ext + g.d * ATRK * g.a, fill = L[j + 1].o, risk = s * (fill - stop); if (!(risk > 0)) return { skip: 'bad' };
      const plan = (s * (g.mid - fill)) / risk; if (!(plan > 0)) return { skip: 'past' };
      const r = walk(L, j + 1, s, stop, g.mid); return r ? { t: L[j + 1].t, plan, wait: L[j + 1].t - g.ts, lvl, ...r } : { skip: 'open' }; }
    if (piv(j - 2)) lvl = up ? L[j - 2].l : L[j - 2].h;   // its second right-hand candle (j) has now closed: it counts from the next candle
  }
  return { skip: 'noChoch' };
}
const monthT = (rows) => { const m = new Map(); for (const x of rows) m.set(x.mo, (m.get(x.mo) || 0) + x.v); const v = [...m.values()]; return v.length > 2 && sd(v) > 0 ? mean(v) / (sd(v) / Math.sqrt(v.length)) : NaN; };
export function summary(T) { // T: [{ mo, R, net, plan }]
  const n = T.length; if (!n) return { n: 0 };
  return { n, win: r3(T.filter((x) => x.R > 0).length / n), plan: r2([...T.map((x) => x.plan)].sort((a, b) => a - b)[Math.floor(n / 2)]), gross: r3(mean(T.map((x) => x.R))), net: r3(mean(T.map((x) => x.net))), tNet: r2(monthT(T.map((x) => ({ mo: x.mo, v: x.net })))), cost: r3(mean(T.map((x) => x.R - x.net))) };
}
export function compare(B, C) { // win-rate z, Welch t and monthly-difference t of net R, CHOCH minus BASE
  if (B.length < 30 || C.length < 30) return { z: null, welch: null, monthT: null };
  const pb = B.filter((x) => x.R > 0).length / B.length, pc = C.filter((x) => x.R > 0).length / C.length, p = (pb * B.length + pc * C.length) / (B.length + C.length), z = (pc - pb) / Math.sqrt(p * (1 - p) * (1 / B.length + 1 / C.length));
  const nb = B.map((x) => x.net), nc = C.map((x) => x.net), w = (mean(nc) - mean(nb)) / Math.sqrt(sd(nc) ** 2 / nc.length + sd(nb) ** 2 / nb.length);
  const g = (T) => { const m = new Map(); for (const x of T) { if (!m.has(x.mo)) m.set(x.mo, []); m.get(x.mo).push(x.net); } return m; }, mb = g(B), mc = g(C), d = []; for (const [k, a] of mc) if (mb.has(k)) d.push(mean(a) - mean(mb.get(k)));
  return { z: r2(z), welch: r2(w), monthT: r2(d.length > 2 ? mean(d) / (sd(d) / Math.sqrt(d.length)) : NaN), diff: r3(mean(nc) - mean(nb)) };
}
export function runMarket(market, tf) {
  const [from, to] = tf === '30s' ? WIN.s : [WIN.d[0], WIN.c[1]];
  const M5 = K.load(market, '5m', { from: '2016-01-01', to: '2026-11-01' }), L = tf === '30s' ? load30(market, from, to) : K.load(market, '1m', { from, to });
  const big = signals(frames(M5)).big.filter((g) => g.tf === 0 && !g.brk && g.ts >= sec(from) && g.ts < sec(to)), cost = COSTS[market], X = exclusions(market), rows = [], skips = {};
  for (const g of big) { if (X.length && inBad(X, g.ts)) continue; const b = base(L, g); if (b.skip) continue;
    const mo = new Date(b.t * 1000).toISOString().slice(0, 7), w = b.t < sec(WIN.c[0]) ? 'd' : 'c', c = choch(L, g, WAIT[tf]);
    if (c.skip) skips[c.skip] = (skips[c.skip] || 0) + 1;
    rows.push({ market, w, mo, base: { mo, R: b.R, net: b.R - cost / b.risk, plan: b.plan }, choch: c.skip ? null : { mo, R: c.R, net: c.R - cost / c.risk, plan: c.plan, wait: c.wait }, skip: c.skip || null }); }
  return { rows, skips };
}
export function block(rows) { const B = rows.map((x) => x.base), C = rows.filter((x) => x.choch).map((x) => x.choch), sk = {}; for (const x of rows) if (x.skip) sk[x.skip] = (sk[x.skip] || 0) + 1;
  return { signals: rows.length, base: summary(B), choch: summary(C), perSignal: { base: r3(mean(B.map((x) => x.net))), choch: r3(mean(rows.map((x) => (x.choch ? x.choch.net : 0)))) }, skips: sk, cmp: compare(B, C) }; }
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const res = { study: 'bigfade-choch', built: '2026-11-24', m1: {}, s30: {} }; let all = [];
  for (const m of MARKETS) { const r = runMarket(m, '1m'); all = all.concat(r.rows); res.m1[m] = { d: block(r.rows.filter((x) => x.w === 'd')), c: block(r.rows.filter((x) => x.w === 'c')) }; console.log(m, r.rows.length, JSON.stringify(r.skips)); }
  const D = block(all.filter((x) => x.w === 'd')), C = block(all.filter((x) => x.w === 'c')); res.pooled = { d: D, c: C };
  let s30 = []; for (const m of ['xau', 'eurusd']) { try { const r = runMarket(m, '30s'); s30 = s30.concat(r.rows); res.s30[m] = block(r.rows); } catch (e) { res.s30[m] = { error: String(e.message || e) }; } }
  res.s30.pooled = s30.length ? block(s30) : null;
  const t1 = C.cmp.z >= 2 && D.choch.win > D.base.win, t2 = C.cmp.welch >= 2 && C.cmp.monthT >= 2 && D.cmp.diff > 0, t3 = C.choch.net > 0 && C.choch.tNet >= 2 && D.choch.net > 0, pass = t1 && t2 && t3;
  const sg = (v) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3)}R`), pc = (v) => (v == null ? '—' : (100 * v).toFixed(1) + ' %'), S = res.s30.pooled;
  res.tests = { winRate: t1, better: t2, worth: t3 };
  res.verdict = `${pass ? 'PASS' : 'FAIL'}. Waiting for a 1-minute ChoCh ${t1 ? 'raises' : 'does not raise'} the win rate (${pc(C.choch.win)} against ${pc(C.base.win)} at once, 2022-26, z ${C.cmp.z}). After costs it makes ${sg(C.choch.net)} a trade (n ${C.choch.n}, month t ${C.choch.tNet}) against ${sg(C.base.net)} at once (n ${C.base.n}); the difference is ${sg(C.cmp.diff)} (Welch t ${C.cmp.welch}, month t ${C.cmp.monthT})${t3 ? '' : ': still a loss after costs'}. In 2018-21: ${pc(D.choch.win)} against ${pc(D.base.win)}, ${sg(D.choch.net)} against ${sg(D.base.net)}.` + (S ? ` The 30-second ChoCh (gold and EUR/USD, 2024-26, context only): ${pc(S.choch.win)} winners, ${sg(S.choch.net)} a trade after costs (n ${S.choch.n}) against ${pc(S.base.win)} and ${sg(S.base.net)} at once.` : '');
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  const row = (name, b) => `| ${name} | ${b.signals} | ${b.base.n} | ${pc(b.base.win)} | ${b.base.plan} | ${sg(b.base.gross)} | ${sg(b.base.net)} | ${b.choch.n} | ${pc(b.choch.win)} | ${b.choch.plan} | ${sg(b.choch.gross)} | ${sg(b.choch.net)} (${b.choch.tNet}) |`;
  const skl = (b) => Object.entries(b.skips).map(([k, v]) => `${{ targetFirst: 'the 50 % came first', stopFirst: 'the stop level came first', noChoch: 'no ChoCh in time', past: 'already past the target', open: 'still open', bad: 'no risk' }[k] || k} ${v}`).join(', ');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# Big-candle fade entered on a 1-minute or 30-second ChoCh (result, 24 Nov 2026)', '', `**Verdict: ${res.verdict}**`, '',
    'Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first). Nothing live changed.', '',
    '| | Signals | At once: trades | winners | planned R (median) | before costs | after costs | ChoCh: trades | winners | planned R (median) | before costs | after costs (month t) |', '|---|---|---|---|---|---|---|---|---|---|---|---|',
    row('1-minute ChoCh, 2018-21, five markets', D), row('1-minute ChoCh, 2022-26, five markets', C), ...MARKETS.map((m) => row(`  ${m}, 2022-26`, res.m1[m].c)),
    ...(S ? [row('30-second ChoCh, 2024-26, gold + EUR/USD (context)', S)] : []), '',
    `Signals with no ChoCh trade, 2022-26: ${skl(C)}. R a signal after costs (no trade = 0): at once ${sg(C.perSignal.base)}, ChoCh ${sg(C.perSignal.choch)}.`, '',
    'The ChoCh entry sells lower (buys higher) with its stop past everything since the candle, so its planned reward is smaller; cost in R is the round trip over each trade\'s own risk.', ''].join('\n'));
  console.log(res.verdict);
}
