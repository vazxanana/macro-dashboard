// Edge research · vb-calendar-days: do the gold and USD/JPY volatility breakouts (T1, k 0.5) differ by calendar position?
// (a) turn of the month (last trading day + first 3) against other days; (b) weekday. Fixed in PREREGISTRATION.md (committed
// alone first). Paper research only: nothing live reads or changes.
//   node research/edge/vb-calendar-days/run.mjs        (reads the shared toolkit's candle cache, EDGE_DATA, out of git)
// Rules imported unchanged: gold = gold-vol-breakout-hourcost (original.mjs via costs.mjs tradesIn, run.mjs charge, route C1
// = measured hourly profile + 0.05 x M); USD/JPY = index-vol-breakout/original.mjs vbTrade + fx-vol-breakout charge.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import * as GO from '../gold-vol-breakout-hourcost/original.mjs';
import { tradesIn } from '../gold-vol-breakout-hourcost/costs.mjs';
import { charge as goldCharge } from '../gold-vol-breakout-hourcost/run.mjs';
import * as IO from '../index-vol-breakout/original.mjs';
import { charge as fxCharge, K as KV } from '../fx-vol-breakout/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const W = { DISC: ['2005-01-01', '2014-12-31'], CONF: ['2015-01-01', '2099-12-31'] };
export const PERMS = 2000, SEED = 20261124, PLACEBOS = 40, SLIP = 0.05, MIN_N = 200;
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const r4 = (v) => (Number.isFinite(v) ? Math.round(v * 10000) / 10000 : null);

// ---- calendar labels, from the built day list only (known before the day opens) ----
// days: [{ day: 'YYYY-MM-DD' }] in time order. TOM = last built day of a complete month + first three of each month.
export function tomSet(days, lastComplete) {
  const byM = new Map();
  for (const d of days) { const m = d.day.slice(0, 7); if (!byM.has(m)) byM.set(m, []); byM.get(m).push(d.day); }
  const s = new Set();
  for (const [m, ds] of byM) {
    ds.slice(0, 3).forEach((x) => s.add(x));
    if (ds.at(-1) <= lastComplete && m < lastComplete.slice(0, 7)) s.add(ds.at(-1));
  }
  return s;
}
export const weekdayOf = (day) => new Date(day + 'T00:00:00Z').getUTCDay() - 1; // 0 Mon .. 4 Fri

// ---- statistics ----
export function monthT(v) { const s = sdv(v); return v.length > 1 && s > 0 ? mean(v) / (s / Math.sqrt(v.length)) : null; }
// per month: mean net of the tagged trades minus mean net of the others (months with both)
export function monthDiff(tr, isTag) {
  const by = new Map();
  for (const x of tr) { const m = x.day.slice(0, 7); if (!by.has(m)) by.set(m, { a: [], b: [] }); by.get(m)[isTag(x) ? 'a' : 'b'].push(x.net); }
  return [...by.values()].filter((g) => g.a.length && g.b.length).map((g) => mean(g.a) - mean(g.b));
}
export function ranks(v) {
  const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), r = new Array(v.length);
  for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const rr = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = rr; i = j + 1; }
  return r;
}
export function kwH(rk, g, G = 5) {
  const n = rk.length, sum = new Array(G).fill(0), cnt = new Array(G).fill(0);
  for (let i = 0; i < n; i++) { sum[g[i]] += rk[i]; cnt[g[i]]++; }
  let h = 0; for (let k = 0; k < G; k++) if (cnt[k]) h += sum[k] ** 2 / cnt[k];
  return 12 / (n * (n + 1)) * h - 3 * (n + 1);
}
export function kwPerm(net, g, perms = PERMS, seed = SEED) {
  const rk = ranks(net), H = kwH(rk, g), rand = K.rng(seed), gg = g.slice(); let ge = 0;
  for (let p = 0; p < perms; p++) {
    for (let i = gg.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [gg[i], gg[j]] = [gg[j], gg[i]]; }
    if (kwH(rk, gg) >= H - 1e-12) ge++;
  }
  return { H, p: (ge + 1) / (perms + 1) };
}
const tP = (t, df) => (t == null ? 1 : K.pFromT(t, df));
const sub = (a) => ({ n: a.length, netR: r3(mean(a.map((x) => x.net))), grossR: r3(mean(a.map((x) => x.R))) });

// ---- trades ----
const rowsOf = (mk, from, to) => K.load(mk, '5m', { from, to }).map((b) => [b.t, b.o, b.h, b.l, b.c]);
function lastCompleteDay(days) { return days.at(-2).day; } // the last day on file may be forming
export function goldTrades() {
  const hc = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'gold-vol-breakout-hourcost', 'result.json'), 'utf8'));
  const rows = rowsOf('xau', '2006-01-01'); const lastFull = Math.floor(rows.at(-1)[0] / 86400) * 86400;
  const days = GO.buildDays(rows.filter((r) => r[0] < lastFull));
  const tr = tradesIn(days, ['2005-01-01', '2099-12-31']).tr, net = goldCharge(tr, hc.profile, 'frac', hc.commission, SLIP);
  return { days, lastDay: days.at(-1).day, trades: tr.map((x, i) => ({ day: x.day, side: x.side, R: x.R, net: net[i].net })) };
}
export function jpyTrades() {
  const rows = rowsOf('usdjpy', '2004-11-01'); const lastFull = Math.floor(rows.at(-1)[0] / 86400) * 86400;
  const days = IO.buildDays(rows.filter((r) => r[0] < lastFull)), tr = [];
  for (const d of days) {
    if (IO.daySkip(d)) continue;
    const x = IO.vbTrade(d.bars, { k: KV, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (x.skip) continue;
    const c = fxCharge('usdjpy', x); tr.push({ day: d.day, side: x.side, R: x.R, net: c.net });
  }
  return { days, lastDay: days.at(-1).day, trades: tr };
}

// ---- tests ----
export function tomWindow(tr, tom) {
  const diffs = monthDiff(tr, (x) => tom.has(x.day)), t = monthT(diffs);
  return { tom: sub(tr.filter((x) => tom.has(x.day))), rest: sub(tr.filter((x) => !tom.has(x.day))),
    months: diffs.length, diff: r4(mean(diffs)), t: r2(t), tRaw: t, p: tP(t, diffs.length - 1),
    monthTom: r2(monthT(monthSums(tr.filter((x) => tom.has(x.day))))), monthRest: r2(monthT(monthSums(tr.filter((x) => !tom.has(x.day))))) };
}
function monthSums(tr) { const m = new Map(); for (const x of tr) { const k = x.day.slice(0, 7); m.set(k, (m.get(k) || 0) + x.net); } return [...m.values()]; }
export function placeboTom(tr, days, seed) {
  const rand = K.rng(seed), byM = new Map(); for (const d of days) { const m = d.day.slice(0, 7); if (!byM.has(m)) byM.set(m, []); byM.get(m).push(d.day); }
  const s = new Set(); for (const ds of byM.values()) { const a = ds.slice(); for (let i = 0; i < Math.min(4, a.length); i++) { const j = i + Math.floor(rand() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; s.add(a[i]); } }
  return mean(monthDiff(tr, (x) => s.has(x.day)));
}
export function weekdayWindow(tr) {
  const g = tr.map((x) => weekdayOf(x.day)), net = tr.map((x) => x.net);
  const { H, p } = kwPerm(net, g);
  const per = WD.map((n, k) => ({ day: n, ...sub(tr.filter((_, i) => g[i] === k)) }));
  const best = per.reduce((a, b) => (b.netR > a.netR ? b : a));
  const bk = WD.indexOf(best.day), d = monthDiff(tr, (x) => weekdayOf(x.day) === bk), bt = monthT(d);
  return { H: r2(H), p: r4(p), per, best: best.day, bestMinusRest: { months: d.length, diff: r4(mean(d)), t: r2(bt) } };
}

// harness gate: the published figures of the parent studies, reproduced from the same trades
export const GATE = { xau: { w: ['2021-01-01', '2026-11-12'], want: { n: 1121, netR: 0.105, t: 2.79 }, src: 'gold-vol-breakout-forward baseline (C1)' },
  usdjpy: { w: ['2005-01-04', '2015-12-31'], want: { n: 2089, netR: 0.079, t: 2.95 }, src: 'usdjpy-vol-breakout-early' } };
export function gateOf(mk, trades) {
  const g = GATE[mk], a = trades.filter((x) => inW(x.day, g.w)), got = { n: a.length, netR: r3(mean(a.map((x) => x.net))), t: r2(monthT(monthSums(a))) };
  return { ...g, got, ok: got.n === g.want.n && got.netR === g.want.netR && Math.abs(got.t - g.want.t) <= 0.02 };
}

export function run() {
  const out = { study: 'vb-calendar-days', built: new Date().toISOString().slice(0, 10), windows: W, markets: {} };
  const tests = [];
  for (const [mk, get] of [['xau', goldTrades], ['usdjpy', jpyTrades]]) {
    const { days, lastDay, trades } = get(); const lc = lastCompleteDay(days), tom = tomSet(days, lc);
    const D = trades.filter((x) => inW(x.day, W.DISC)), C = trades.filter((x) => inW(x.day, W.CONF));
    const disc = tomWindow(D, tom), conf = tomWindow(C, tom);
    const pl = []; for (let s = 1; s <= PLACEBOS; s++) pl.push(placeboTom(C, days.filter((d) => inW(d.day, W.CONF)), s));
    const beaten = pl.filter((v) => Math.abs(conf.diff) > Math.abs(v)).length;
    const wd = { disc: weekdayWindow(D), conf: weekdayWindow(C) };
    const side = (a, sd) => sub(a.filter((x) => x.side === sd));
    const sides = { disc: { tomBuy: side(D.filter((x) => tom.has(x.day)), 1), tomSell: side(D.filter((x) => tom.has(x.day)), -1), restBuy: side(D.filter((x) => !tom.has(x.day)), 1), restSell: side(D.filter((x) => !tom.has(x.day)), -1) },
      conf: { tomBuy: side(C.filter((x) => tom.has(x.day)), 1), tomSell: side(C.filter((x) => tom.has(x.day)), -1), restBuy: side(C.filter((x) => !tom.has(x.day)), 1), restSell: side(C.filter((x) => !tom.has(x.day)), -1) } };
    out.markets[mk] = { gate: gateOf(mk, trades), tomSides: sides, firstDay: trades[0].day, lastDay, all: sub(trades), disc: sub(D), conf: sub(C),
      tom: { disc, conf, placeboBeaten: beaten, placeboAbsMean: r4(mean(pl.map(Math.abs))) }, weekday: wd };
    tests.push({ id: mk === 'xau' ? 'T1' : 'T2', mk, kind: 'tom', p: conf.p });
    tests.push({ id: mk === 'xau' ? 'T3' : 'T4', mk, kind: 'weekday', p: wd.conf.p });
  }
  tests.sort((a, b) => a.id.localeCompare(b.id));
  const holm = K.holm(tests.map((t) => t.p));
  out.tests = tests.map((t, i) => {
    const M = out.markets[t.mk];
    if (t.kind === 'tom') {
      const { disc, conf } = M.tom; const better = conf.diff > 0 ? 'tom' : 'rest';
      const checks = { sameSign: Math.sign(disc.diff) === Math.sign(conf.diff), confT: Math.abs(conf.tRaw) >= 2 && holm[i] < 0.05, discP: disc.p < 0.05,
        betterPositive: disc[better].netR > 0 && conf[better].netR > 0 && conf[better].n >= MIN_N, placebo: M.tom.placeboBeaten >= 38 };
      return { id: t.id, mk: t.mk, kind: 'TOM vs rest', p: r4(t.p), pHolm: r4(holm[i]), better, checks, pass: Object.values(checks).every(Boolean) };
    }
    const { disc, conf } = M.weekday, b = conf.per.find((x) => x.day === conf.best), bd = disc.per.find((x) => x.day === conf.best);
    const checks = { sameBest: disc.best === conf.best, confP: holm[i] < 0.05, discP: disc.p < 0.05, bestPositive: bd.netR > 0 && b.netR > 0 && b.n >= MIN_N };
    return { id: t.id, mk: t.mk, kind: 'weekday (Kruskal-Wallis, permutation p)', p: r4(t.p), pHolm: r4(holm[i]), best: conf.best, checks, pass: Object.values(checks).every(Boolean) };
  });
  for (const t of out.tests) delete out.markets[t.mk].tom.conf.tRaw, delete out.markets[t.mk].tom.disc.tRaw;
  const np = out.tests.filter((t) => t.pass).length;
  out.verdict = `${np ? 'PASS' : 'FAIL'}, ${np} of 4: ${out.tests.map((t) => `${t.id} ${t.mk} ${t.kind.split(' ')[0]} Holm p ${t.pHolm}`).join('; ')}`;
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const R = run();
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  console.log(R.verdict);
  console.log(JSON.stringify(R.markets, null, 1).slice(0, 6000));
}
