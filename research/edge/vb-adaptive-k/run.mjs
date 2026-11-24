// Edge research · vb-adaptive-k: gold and USD/JPY T1 with k set by the previous day's range against its 20-day median
// (PREREGISTRATION.md, pushed alone first). Paper research only.
//   node research/edge/vb-adaptive-k/run.mjs        (candles: research/edge/_lib/edgekit.mjs DATA_DIR, markets xau and usdjpy)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDays, daySkip, vbTrade } from '../index-vol-breakout/original.mjs';
import { charge as fxCharge } from '../fx-vol-breakout/run.mjs';
import { costFrac, hourOf } from '../gold-vol-breakout-hourcost/run.mjs';
import { medRange } from '../gold-vol-breakout-hourcost/costs.mjs';
import { load, pFromT, holm, rng } from '../_lib/edgekit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const KS = [0.3, 0.5, 0.7], N_MED = 20, LO = 0.7, HI = 1.3, SEEDS = 40;
export const WIN = { disc: ['2005-01-01', '2014-12-31'], conf: ['2015-01-01', '2099-12-31'] };
const HC = JSON.parse(fs.readFileSync(path.join(HERE, '../gold-vol-breakout-hourcost/result.json'), 'utf8'));
const PROF = HC.profile, COMM = HC.commission, SLIP = 0.05;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// the pre-registered mapping
export const kOf = (ratio) => (ratio < LO ? 0.3 : ratio > HI ? 0.7 : 0.5);
// ratio of each day: prevRange / median of its own and the 19 earlier days' prevRange (null with fewer than 20)
export function ratios(days) {
  return days.map((d, i) => {
    if (i < N_MED - 1 || !(d.prevRange > 0)) return null;
    const w = days.slice(i - N_MED + 1, i + 1).map((x) => x.prevRange);
    if (w.some((v) => !(v > 0))) return null;
    return d.prevRange / median(w);
  });
}
// one trade of one day at k, charged (net, net2) or null
export function tradeAt(m, d, k) {
  const x = vbTrade(d.bars, { k, sides: 'both', prevRange: d.prevRange, cost: 0 });
  if (x.skip) return null;
  if (m === 'usdjpy') { const c = fxCharge('usdjpy', x); return { R: x.R, net: c.net, net2: c.net2 }; }
  const i = d.bars.findIndex((b) => b.t === x.fillT), M = medRange(d.bars, i);
  const cost = (costFrac(PROF, hourOf(x), 'frac', COMM) * x.entry + SLIP * M) / x.r;
  return { R: x.R, net: x.R - x.finR - cost, net2: x.R - x.finR - 2 * cost };
}
export function daysOf(m) {
  const rows = load(m, '5m').map((b) => [b.t, b.o, b.h, b.l, b.c]);
  const lastFull = Math.floor(rows.at(-1)[0] / 86400) * 86400;
  return buildDays(rows.filter((r) => r[0] < lastFull));
}
export function monthT(rows, key = 'v') { // rows: [{ day, v }] summed by month
  const mm = new Map(); for (const x of rows) mm.set(x.day.slice(0, 7), (mm.get(x.day.slice(0, 7)) || 0) + x[key]);
  const v = [...mm.values()], a = mean(v), sd = Math.sqrt(v.reduce((s, x) => s + (x - a) ** 2, 0) / (v.length - 1));
  return { t: sd > 0 ? a / (sd / Math.sqrt(v.length)) : null, months: v.length };
}
const oneSided = (t, df) => (t == null ? 1 : t > 0 ? pFromT(t, df) / 2 : 1 - pFromT(t, df) / 2);
const inW = (day, [a, b]) => day >= a && day <= b;
const armStats = (tr) => tr.length ? ({ n: tr.length, gross: r3(mean(tr.map((x) => x.R))), net: r3(mean(tr.map((x) => x.net))), net2: r3(mean(tr.map((x) => x.net2))), monthT: r2(monthT(tr.map((x) => ({ day: x.day, v: x.net }))).t) }) : { n: 0 };

// per market: every eligible day with the three nets precomputed
export function table(m, days) {
  const rs = ratios(days), out = [];
  days.forEach((d, i) => {
    if (daySkip(d) || rs[i] == null) return;
    const t = {}; for (const k of KS) t[k] = tradeAt(m, d, k);
    out.push({ day: d.day, ratio: rs[i], ka: kOf(rs[i]), t });
  });
  return out;
}
const dOf = (row, ka) => (row.t[ka] ? row.t[ka].net : 0) - (row.t[0.5] ? row.t[0.5].net : 0);
function shuffle(a, r) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const D = { xau: daysOf('xau'), usdjpy: daysOf('usdjpy') };
  // gate: fixed k 0.5 on all days
  const gateRun = (m, w) => { const tr = []; for (const d of D[m]) { if (!inW(d.day, w) || daySkip(d)) continue; const x = tradeAt(m, d, 0.5); if (x) tr.push(x); } return { n: tr.length, net: r3(mean(tr.map((x) => x.net))) }; };
  const gj = gateRun('usdjpy', ['2005-01-04', '2015-12-31']), gg = gateRun('xau', ['2007-01-01', '2026-11-12']);
  const near = (g, n, net) => Math.abs(g.n - n) <= 0.01 * n && Math.abs(g.net - net) <= 0.005;
  const gate = { usdjpy: { got: gj, want: { n: 2089, net: 0.079 }, ok: near(gj, 2089, 0.079), exact: gj.n === 2089 && gj.net === 0.079 }, xau: { got: gg, want: { n: 3713, net: 0.139 }, ok: near(gg, 3713, 0.139), exact: gg.n === 3713 && gg.net === 0.139 } };
  console.log('gate', JSON.stringify(gate));
  if (!gate.usdjpy.ok || !gate.xau.ok) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'vb-adaptive-k', gate, verdict: 'STOPPED: the harness gate failed' }, null, 1) + '\n'); process.exit(2); }

  const T = { xau: table('xau', D.xau), usdjpy: table('usdjpy', D.usdjpy) };
  const lastDay = { xau: D.xau.at(-1).day, usdjpy: D.usdjpy.at(-1).day };
  const rowsIn = (m, w) => T[m].filter((x) => inW(x.day, WIN[w]));
  const res = { markets: {}, buckets: {}, tests: [] };
  for (const m of ['xau', 'usdjpy']) {
    res.markets[m] = {}; res.buckets[m] = {};
    for (const w of ['disc', 'conf']) {
      const R = rowsIn(m, w), ad = [], fx = [];
      for (const x of R) { if (x.t[x.ka]) ad.push({ day: x.day, ...x.t[x.ka] }); if (x.t[0.5]) fx.push({ day: x.day, ...x.t[0.5] }); }
      const dd = R.map((x) => ({ day: x.day, v: dOf(x, x.ka) })), mt = monthT(dd);
      res.markets[m][w] = { days: R.length, kShare: Object.fromEntries(KS.map((k) => [k, r3(R.filter((x) => x.ka === k).length / R.length)])), adaptive: armStats(ad), fixed: armStats(fx), diff: { meanDay: r3(mean(dd.map((x) => x.v))), sum: r2(dd.reduce((s, x) => s + x.v, 0)), monthT: r2(mt.t), months: mt.months } };
      res.buckets[m][w] = Object.fromEntries(KS.map((k) => { const b = R.filter((x) => x.ka === k && x.t[0.5]).map((x) => ({ day: x.day, ...x.t[0.5] })); return [k === 0.3 ? 'narrow' : k === 0.7 ? 'wide' : 'normal', armStats(b)]; }));
    }
  }
  // placebo: shuffle labels within market and window; statistic = mean d per day of the confirmation window
  const confRows = { xau: rowsIn('xau', 'conf'), usdjpy: rowsIn('usdjpy', 'conf') };
  const plac = { xau: [], usdjpy: [], pooled: [] };
  for (let s = 1; s <= SEEDS; s++) {
    const r = rng(1000 + s), tot = { v: 0, n: 0 };
    for (const m of ['xau', 'usdjpy']) {
      const R = confRows[m], lab = shuffle(R.map((x) => x.ka), r), v = R.map((x, i) => dOf(x, lab[i]));
      plac[m].push(mean(v)); tot.v += v.reduce((a, b) => a + b, 0); tot.n += v.length;
    }
    plac.pooled.push(tot.v / tot.n);
  }
  const p95 = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(0.95 * (s.length - 1))]; };
  // tests
  const testOf = (name, ms) => {
    const W = {};
    for (const w of ['disc', 'conf']) {
      const dd = ms.flatMap((m) => rowsIn(m, w).map((x) => ({ day: x.day, v: dOf(x, x.ka) })));
      const ad = ms.flatMap((m) => rowsIn(m, w).filter((x) => x.t[x.ka]).map((x) => ({ day: x.day, ...x.t[x.ka] })));
      const mt = monthT(dd);
      W[w] = { meanDay: r3(mean(dd.map((x) => x.v))), monthT: r2(mt.t), tRaw: mt.t, months: mt.months, adaptive: armStats(ad) };
    }
    const key = ms.length > 1 ? 'pooled' : ms[0];
    return { test: name, markets: ms, disc: W.disc, conf: W.conf, p: oneSided(W.conf.tRaw, W.conf.months - 1), placeboP95: r3(p95(plac[key])), placeboMedian: r3(median(plac[key])) };
  };
  res.tests = [testOf('A1 gold', ['xau']), testOf('A2 USD/JPY', ['usdjpy']), testOf('A3 pooled', ['xau', 'usdjpy'])];
  const adj = holm(res.tests.map((x) => x.p));
  res.tests.forEach((x, i) => {
    x.pHolm = r3(adj[i]); x.p = r3(x.p);
    const checks = { posBoth: x.disc.meanDay > 0 && x.conf.meanDay > 0, t2Holm: x.conf.monthT >= 2 && x.pHolm < 0.05, adaptivePos: x.disc.adaptive.net > 0 && x.conf.adaptive.net > 0, n200: x.disc.adaptive.n >= 200 && x.conf.adaptive.n >= 200, placebo: x.conf.meanDay > x.placeboP95 };
    x.checks = checks; x.pass = Object.values(checks).every(Boolean); delete x.disc.tRaw; delete x.conf.tRaw;
  });
  const A3 = res.tests[2], sg = (v, d = 3) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
  const verdict = `${A3.pass ? 'PASS' : 'FAIL'}: ${res.tests.filter((x) => x.pass).length} of 3; adaptive k minus fixed k 0.5, pooled, ${sg(A3.disc.meanDay)}R a day in 2005-14 and ${sg(A3.conf.meanDay)}R a day in 2015 → now (month t ${sg(A3.conf.monthT, 2)}, Holm p ${A3.pHolm}); gold ${sg(res.tests[0].conf.meanDay)} (t ${sg(res.tests[0].conf.monthT, 2)}), USD/JPY ${sg(res.tests[1].conf.meanDay)} (t ${sg(res.tests[1].conf.monthT, 2)}); k stays 0.5`;
  const out = { study: 'vb-adaptive-k', built: '2026-11-24', mapping: { nMed: N_MED, lo: LO, hi: HI, k: { narrow: 0.3, normal: 0.5, wide: 0.7 } }, windows: WIN, dataEnd: lastDay, gate, costs: { xau: 'gold-vol-breakout-hourcost C1 (hourly median spread + commission 0.000024 + 0.05 x M) and long financing', usdjpy: 'fx-vol-breakout charge (0.000045 x price + 0.5 pip)' }, ...res, placebo: Object.fromEntries(Object.entries(plac).map(([k, v]) => [k, v.map(r3)])), verdict };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(verdict); console.log(JSON.stringify(res, null, 1));
}
