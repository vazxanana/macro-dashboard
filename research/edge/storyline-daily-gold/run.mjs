// research/edge/storyline-daily-gold/run.mjs - the pre-registered Daily storyline study on gold (PREREGISTRATION.md).
// Research only: nothing live imports this, nothing is placed. Candles: the overnight toolkit cache (outside git).
//   node research/edge/storyline-daily-gold/run.mjs          -> result.json, trades.json in this folder
// Every rule below is the pre-registration's, in code; the readings it had to make where the text is silent are listed in
// READINGS (and in RESULT.md). No parameter was searched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

export const P = { swingK: 3, engulfDays: 3, h4K: 3, h1K: 3, breakDays: 1, biasDays: 10, limitH1: 12, minRR: 1.5,
  holdSec: 240 * 3600, buf: 0.0001, cost: K.COSTS.xau, weekK: 2, fixedRR: 3 };

export const READINGS = [
  'A level is reached by the first 5-minute candle after the level is known whose high (low for a support) touches it; the trading day holding that candle is "the first day that reaches it"; the level is spent there whether it rejects or not.',
  'The external low for a sell is the most recently confirmed H4 swing low (confirmation close at or before the start of the touching 5-minute candle), whether or not price had already traded below it.',
  'The H4 break counts when an H4 candle closing at or after the touch and no later than the close of the next trading day closes beyond the external level.',
  '"10 trading days" ends the bias at the close of the tenth trading day after the rejection day.',
  'A bias gives one candidate only: its first H1 QM in the window. If that QM gives no trade (no target, under 1.5R, a position already open or an order resting), the bias gives none.',
  'Target freshness and level freshness at a moment T use every 5-minute candle closed by T (a level is fresh while its first touching candle closes after T).',
  'The limit is cancelled at the start of the first 5-minute candle after the QM that reaches the target, at the close of the first H1 candle after the QM that closes beyond the head, or 12 H1 candles after the QM close, whichever is first. A fill and a target in the cancelling candle count as no fill.',
  'One position at a time across buys and sells; an order resting counts as a position until it fills, is cancelled or expires.',
  'S1 (market): the 1.5R test uses the QM close as the entry; R is measured from the actual fill (next 5-minute open).',
  'S3 (3R): the target is entry +/- 3 x (entry - stop distance); the next-level and 1.5R checks are not applied.',
  'S2 (weekly): weeks = Monday-Friday trading days of dailyNY; a week is complete at its Friday 17:00 New York close; structure K 2 side at the last complete week before the QM close must equal the trade side.',
];

const lb = (arr, t, f = (x) => x.t) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (f(arr[m]) < t) lo = m + 1; else hi = m; } return lo; };

// ---- Daily key levels ------------------------------------------------------------------------------------------------
// Each level: { side -1 (resistance: swing high / supply zone) or +1 (support), kind 'swing'|'zone', touch (price that
// reaches it: swing price, supply zone low, demand zone high), far (supply zone high / demand zone low; = touch for a
// swing), known (unix s), knownDay (index), reachI (5m index of first reach, -1 none), reachT (close of that candle) }.
export function dailyLevels(D, B5, dayStart) {
  const out = [];
  for (const s of K.swings(D, P.swingK)) {
    const side = s.type === 'H' ? -1 : 1;
    out.push({ side, kind: 'swing', touch: s.price, far: s.price, known: s.ct, knownDay: s.ci });
  }
  for (let i = 0; i < D.length; i++) {
    const d = D[i];
    if (d.c > d.o) { // bullish day -> supply zone when a later day within 3 closes below its low
      for (let j = i + 1; j <= i + P.engulfDays && j < D.length; j++) if (D[j].c < d.l) { out.push({ side: -1, kind: 'zone', touch: d.l, far: d.h, known: D[j].e, knownDay: j }); break; }
    } else if (d.c < d.o) {
      for (let j = i + 1; j <= i + P.engulfDays && j < D.length; j++) if (D[j].c > d.h) { out.push({ side: 1, kind: 'zone', touch: d.h, far: d.l, known: D[j].e, knownDay: j }); break; }
    }
  }
  // first reach: scan days after the known day, then the 5m candles of that day
  for (const L of out) {
    L.reachI = -1; L.reachT = Infinity; L.reachDay = -1;
    for (let k = L.knownDay + 1; k < D.length; k++) {
      const hit = L.side < 0 ? D[k].h >= L.touch : D[k].l <= L.touch;
      if (!hit) continue;
      const a = dayStart[k], b = k + 1 < D.length ? dayStart[k + 1] : B5.length;
      for (let x = a; x < b; x++) if (L.side < 0 ? B5[x].h >= L.touch : B5[x].l <= L.touch) { L.reachI = x; L.reachT = B5[x].e; L.reachDay = k; break; }
      break;
    }
  }
  return out;
}

const fresh = (L, T) => L.known <= T && L.reachT > T;

// ---- biases --------------------------------------------------------------------------------------------------------
export function biases(D, H4, B5, levels) {
  const sw4 = K.swings(H4, P.h4K).sort((a, b) => a.ct - b.ct || a.i - b.i);
  const out = [];
  for (const L of levels) {
    if (L.reachDay < 0) continue;
    const d = L.reachDay, day = D[d];
    const rejected = L.side < 0 ? day.c < L.touch : day.c > L.touch;
    if (!rejected || d + 1 >= D.length) continue;
    const side = -L.side; // rejection of a resistance -> sell
    const touchT = B5[L.reachI].t;
    // the last H4 swing on the external side confirmed at or before the touch
    let ext = null;
    for (let k = lb(sw4, touchT + 1, (s) => s.ct) - 1; k >= 0; k--) { const s = sw4[k]; if (s.type === (side < 0 ? 'L' : 'H')) { ext = s; break; } }
    if (!ext) continue;
    const lim = D[Math.min(d + P.breakDays, D.length - 1)].e;
    let brk = null;
    for (let k = lb(H4, touchT, (b) => b.e); k < H4.length && H4[k].e <= lim; k++) if (side < 0 ? H4[k].c < ext.price : H4[k].c > ext.price) { brk = H4[k]; break; }
    if (!brk) continue;
    const start = Math.max(day.e, brk.e);
    let end = d + P.biasDays < D.length ? D[d + P.biasDays].e : Infinity;
    for (let k = d + 1; k < D.length && D[k].e < end; k++) if (L.side < 0 ? D[k].c > L.far : D[k].c < L.far) { end = D[k].e; break; }
    out.push({ side, start, end, level: L.touch, far: L.far, kind: L.kind, rejDay: day.date, ext: ext.price, brkT: brk.e });
  }
  out.sort((a, b) => a.start - b.start);
  for (const b of out) { const o = out.find((x) => x.side !== b.side && x.start > b.start); if (o && o.start < b.end) b.end = o.start; }
  return out;
}

// ---- weekly structure (S2) -----------------------------------------------------------------------------------------
export function weeks(D) {
  const W = []; let cur = null;
  for (const d of D) {
    const day = Date.parse(d.date + 'T00:00:00Z') / 1000, wd = new Date(day * 1000).getUTCDay();
    const mon = day - ((wd + 6) % 7) * 86400;
    if (!cur || cur.mon !== mon) {
      const fri = mon + 4 * 86400; const e = fri + 17 * 3600 + K.nyOffsetH(fri + 21 * 3600) * 3600;
      cur = { mon, t: d.t, o: d.o, h: d.h, l: d.l, c: d.c, e }; W.push(cur);
    } else { cur.h = Math.max(cur.h, d.h); cur.l = Math.min(cur.l, d.l); cur.c = d.c; }
  }
  return W;
}

// ---- the whole study on one candle series ----------------------------------------------------------------------------
// variant: 'P' | 'S1' | 'S2' | 'S3'. Returns { orders (candidates), trades (closed and open) }.
export function study(B5, variant = 'P', ctx = null) {
  const c = ctx || prepare(B5);
  const { D, H1, levels, bias, qm, wk } = c;
  const orders = [];
  const seen = new Set();
  for (const b of bias) {
    const q = qm.find((x) => x.side === b.side && x.t > b.start && x.t < b.end);
    if (!q) continue;
    const s = b.side;
    const entry = variant === 'S1' ? H1[q.i].c : q.level;
    const stop = q.head + s * -1 * P.buf * q.level;
    if (!(s * (entry - stop) > 0)) continue;
    const risk = Math.abs(entry - stop);
    let target = null;
    if (variant === 'S3') target = entry + s * P.fixedRR * risk;
    else {
      for (const L of levels) {
        if (L.side !== -s || !fresh(L, q.t)) continue;
        const px = L.touch;
        if (s * (px - entry) <= 0) continue;
        if (target == null || s * (px - target) < 0) target = px;
      }
      if (target == null || Math.abs(target - entry) < P.minRR * risk) { orders.push({ ...meta(b, q), skip: target == null ? 'no target' : 'under 1.5R' }); continue; }
    }
    if (variant === 'S2') {
      const k = lb(wk.W, q.t + 1, (w) => w.e) - 1; const ws = k >= 0 ? wk.side[k] : 0;
      if (ws !== s) { orders.push({ ...meta(b, q), skip: 'weekly disagrees' }); continue; }
    }
    const key = s + ':' + q.i; if (seen.has(key)) continue; seen.add(key);
    // cancel: H1 close beyond the head, target reached, 12 H1 candles
    let expire = q.t + P.limitH1 * 3600;
    if (variant !== 'S1') {
      for (let k = q.i + 1; k < H1.length && H1[k].e <= expire; k++) if (s < 0 ? H1[k].c > q.head : H1[k].c < q.head) { expire = Math.min(expire, H1[k].e); break; }
      for (let x = lb(B5, q.t); x < B5.length && B5[x].t < expire; x++) if (s < 0 ? B5[x].l <= target : B5[x].h >= target) { expire = B5[x].t; break; }
    }
    orders.push({ ...meta(b, q), side: s, entry, stop, target, t: q.t, type: variant === 'S1' ? 'market' : 'limit', expire, head: q.head });
  }
  orders.sort((a, b) => a.t - b.t);
  const trades = []; let busy = -Infinity;
  for (const o of orders) {
    if (o.skip) continue;
    if (o.t < busy) { o.skip = 'position open'; continue; }
    const r = K.simulate({ side: o.side, entry: o.entry, stop: o.stop, target: o.target, t: o.t, type: o.type, expire: o.expire, maxHold: P.holdSec }, B5, {});
    if (r.status === 'nofill' || r.status === 'bad') { busy = o.type === 'limit' ? o.expire : o.t; o.skip = r.status; continue; }
    busy = r.status === 'open' ? Infinity : r.exitT;
    const fin = o.side > 0 && r.status !== 'open' ? nights(r.fillT, r.exitT) * FIN.xau.long * r.fill : 0;
    const costR = (P.cost + fin) / r.risk;
    trades.push({ market: 'xau', side: o.side > 0 ? 'buy' : 'sell', orderT: o.t, fillT: r.fillT, entry: r.fill, stop: o.stop, target: o.target,
      exitT: r.exitT, exit: r.exit, reason: r.reason, status: r.status, R: r.R, Rnet: r.status === 'open' ? null : r.R - costR,
      R2x: r.status === 'open' ? null : r.R - 2 * costR, risk: r.risk, rrPlan: Math.abs(o.target - r.fill) / r.risk, level: o.level, kind: o.kind, rejDay: o.rejDay });
  }
  return { orders, trades };
}
const meta = (b, q) => ({ side: b.side, t: q.t, level: b.level, kind: b.kind, rejDay: b.rejDay, biasStart: b.start });

export function prepare(B5) {
  const D = K.dailyNY(B5);
  const dayStart = D.map((d) => lb(B5, d.t));
  const H4 = K.resample(B5, 14400), H1 = K.resample(B5, 3600);
  const levels = dailyLevels(D, B5, dayStart);
  const bias = biases(D, H4, B5, levels);
  const qm = K.qms(H1, P.h1K).sort((a, b) => a.t - b.t);
  const W = weeks(D); const wk = { W, side: K.structure(W, P.weekK).side };
  return { D, H1, H4, levels, bias, qm, wk };
}

// ---- report --------------------------------------------------------------------------------------------------------
const Y = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 1000;
export const WIN = { REP: ['2010-01-01', '2020-01-01'], IS: ['2020-01-01', '2024-01-01'], OOS: ['2024-01-01', '2026-10-15'], LATE: ['2026-10-15', '2099-01-01'] };
const inW = (x, w) => x.fillT >= Y(WIN[w][0]) && x.fillT < Y(WIN[w][1]);
function summ(tr, key = 'Rnet') {
  const xs = tr.filter((x) => Number.isFinite(x[key]));
  if (!xs.length) return { n: 0, meanR: null, total: 0, tMonth: null, pMonth: null, months: 0, wins: 0, winRate: null, maxDD: 0 };
  const s = K.stats(xs, { key, time: 'fillT' });
  return { n: s.n, wins: s.wins, winRate: s.wins / s.n, meanR: s.meanR, total: s.total, tTrade: s.tTrade, tMonth: s.tMonth, pMonth: s.pMonth, months: s.months, maxDD: s.maxDD };
}
function block(tr) {
  const o = {};
  for (const w of Object.keys(WIN)) { const t = tr.filter((x) => inW(x, w)); o[w] = { net: summ(t), before: summ(t, 'R'), x2: summ(t, 'R2x') }; }
  return o;
}

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const B5 = K.load('xau', '5m');
  const ctx = prepare(B5);
  const res = { study: 'storyline-daily-gold', built: new Date().toISOString(), data: { market: 'xau', from: new Date(B5[0].t * 1000).toISOString(), to: new Date(B5[B5.length - 1].e * 1000).toISOString(), n5m: B5.length },
    params: P, readings: READINGS, windows: WIN, counts: { levels: ctx.levels.length, biases: ctx.bias.length, qmsH1: ctx.qm.length }, variants: {} };
  const all = {};
  for (const v of ['P', 'S1', 'S2', 'S3']) {
    const { orders, trades } = study(B5, v, ctx);
    all[v] = trades;
    const skips = {}; for (const o of orders) if (o.skip) skips[o.skip] = (skips[o.skip] || 0) + 1;
    const closed = trades.filter((x) => Number.isFinite(x.Rnet));
    const byYear = {}; for (const x of closed) { const y = new Date(x.fillT * 1000).getUTCFullYear(); (byYear[y] ||= []).push(x); }
    const oos = closed.filter((x) => inW(x, 'OOS'));
    const best10 = [...oos].sort((a, b) => b.Rnet - a.Rnet).slice(0, 10).reduce((a, x) => a + x.Rnet, 0);
    const oosTot = oos.reduce((a, x) => a + x.Rnet, 0);
    const med = (a) => { const s = [...a].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : null; };
    res.variants[v] = { candidates: orders.length, trades: trades.length, open: trades.length - closed.length, skips, windows: block(closed),
      bySide: { buy: block(closed.filter((x) => x.side === 'buy')), sell: block(closed.filter((x) => x.side === 'sell')) },
      byYear: Object.fromEntries(Object.entries(byYear).map(([y, t]) => [y, summ(t)])),
      medianStop: med(closed.map((x) => x.risk)), medianTargetR: med(closed.map((x) => x.rrPlan)),
      oosBest10Share: oosTot ? best10 / oosTot : null, oosBest10R: best10 };
  }
  const ps = ['P', 'S1', 'S2', 'S3'].map((v) => res.variants[v].windows.OOS.net.pMonth);
  const h = K.holm(ps); ['P', 'S1', 'S2', 'S3'].forEach((v, i) => { res.variants[v].holmP = h[i]; res.variants[v].verdict = verdict(res.variants[v], h[i]); });
  res.verdict = res.variants.P.verdict;
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1));
  const slim = (x) => ({ v: x.v, market: x.market, side: x.side, orderT: x.orderT, fillT: x.fillT, entry: +x.entry.toFixed(3), stop: +x.stop.toFixed(3), target: +x.target.toFixed(3),
    exitT: x.exitT, exit: +x.exit.toFixed(3), reason: x.reason, R: x.R == null ? null : +x.R.toFixed(4), Rnet: x.Rnet == null ? null : +x.Rnet.toFixed(4), kind: x.kind, rejDay: x.rejDay });
  const rows = []; for (const v of Object.keys(all)) for (const x of all[v]) rows.push(slim({ ...x, v }));
  fs.writeFileSync(path.join(here, 'trades.json'), JSON.stringify(rows));
  console.log(JSON.stringify({ verdict: res.verdict, P: res.variants.P.windows, holm: h }, null, 1).slice(0, 4000));
}

export function verdict(v, holmP) {
  const w = v.windows, oos = w.OOS.net, is = w.IS.net;
  if (!(oos.n > 0) || !(oos.meanR > 0) || !(oos.tMonth >= 1) || !(is.meanR >= 0)) return 'FAIL';
  const pass = oos.tMonth >= 2 && holmP < 0.05 && is.meanR > 0 && w.OOS.x2.meanR > 0 && oos.n >= 30 && w.REP.net.meanR > 0;
  return pass ? 'PASS' : 'INCONCLUSIVE';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
