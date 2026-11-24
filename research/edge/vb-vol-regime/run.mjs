// Edge research · vb-vol-regime: gold and USD/JPY T1 (k 0.5) split by the market's own realised-volatility tercile
// (PREREGISTRATION.md, pushed alone first). Paper research only.
//   node research/edge/vb-vol-regime/run.mjs        (candles: research/edge/_lib/edgekit.mjs DATA_DIR, markets xau and usdjpy)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDays, daySkip, vbTrade } from '../index-vol-breakout/original.mjs';
import { charge as fxCharge } from '../fx-vol-breakout/run.mjs';
import { costFrac, hourOf } from '../gold-vol-breakout-hourcost/run.mjs';
import { medRange } from '../gold-vol-breakout-hourcost/costs.mjs';
import { foldWeekend } from '../../../council/fills.mjs';
import { load, pFromT, holm, rng } from '../_lib/edgekit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const N_RV = 20, N_RANK = 252, SEEDS = 40, K = 0.5;
export const WIN = { disc: ['2005-01-01', '2014-12-31'], conf: ['2015-01-01', '2099-12-31'] };
const HC = JSON.parse(fs.readFileSync(path.join(HERE, '../gold-vol-breakout-hourcost/result.json'), 'utf8'));
const PROF = HC.profile, COMM = HC.commission, SLIP = 0.05, DAY = 86400;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// ─── the regime: closes = folded UTC daily candles (buildDays' grouping); label of day d0 from closes strictly before d0 ───
export function foldedCloses(rows) { // rows [t, o, h, l, c] in time order
  const by = new Map();
  for (const r of rows) { const d0 = Math.floor(r[0] / DAY) * DAY; const b = by.get(d0); if (!b) by.set(d0, { time: d0, open: r[1], high: r[2], low: r[3], close: r[4] }); else { b.high = Math.max(b.high, r[2]); b.low = Math.min(b.low, r[3]); b.close = r[4]; } }
  return foldWeekend([...by.values()].sort((a, b) => a.time - b.time)).map((b) => ({ time: b.time, close: b.close }));
}
// labels: Map d0 -> { rv, rank, tercile } for each folded day i, from closes 0..i-1 only
export function labels(closes) {
  const rv = closes.map((_, i) => {
    if (i < N_RV + 1) return null;
    const lr = []; for (let j = i - N_RV; j < i; j++) lr.push(Math.log(closes[j].close / closes[j - 1].close));
    return sd(lr);
  });
  const out = new Map();
  for (let i = 0; i < closes.length; i++) {
    if (rv[i] == null || i < N_RANK) continue;
    const prior = rv.slice(i - N_RANK, i); if (prior.some((v) => v == null)) continue;
    let below = 0; for (const v of prior) below += v < rv[i] ? 1 : v === rv[i] ? 0.5 : 0;
    const rank = below / N_RANK;
    out.set(closes[i].time, { rv: rv[i], rank, tercile: rank < 1 / 3 ? 'low' : rank > 2 / 3 ? 'high' : 'mid' });
  }
  return out;
}

// one trade of one day at k 0.5, charged (net, net2) or null
export function tradeOf(m, d) {
  const x = vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 });
  if (x.skip) return null;
  if (m === 'usdjpy') { const c = fxCharge('usdjpy', x); return { R: x.R, net: c.net, net2: c.net2 }; }
  const i = d.bars.findIndex((b) => b.t === x.fillT), M = medRange(d.bars, i);
  const cost = (costFrac(PROF, hourOf(x), 'frac', COMM) * x.entry + SLIP * M) / x.r;
  return { R: x.R, net: x.R - x.finR - cost, net2: x.R - x.finR - 2 * cost };
}
export function monthT(rows, key = 'v') {
  const mm = new Map(); for (const x of rows) mm.set(x.day.slice(0, 7), (mm.get(x.day.slice(0, 7)) || 0) + x[key]);
  const v = [...mm.values()]; if (v.length < 3) return { t: null, months: v.length };
  const s = sd(v); return { t: s > 0 ? mean(v) / (s / Math.sqrt(v.length)) : null, months: v.length };
}
// monthly difference: per month with trades in both groups, mean(high) - mean(low)
export function monthDiff(hi, lo) {
  const g = (tr) => { const m = new Map(); for (const x of tr) { const k = x.day.slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k).push(x.net); } return m; };
  const H = g(hi), L = g(lo), v = [];
  for (const [k, a] of H) if (L.has(k)) v.push(mean(a) - mean(L.get(k)));
  if (v.length < 3) return { t: null, months: v.length, mean: null };
  const s = sd(v); return { t: s > 0 ? mean(v) / (s / Math.sqrt(v.length)) : null, months: v.length, mean: mean(v) };
}
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length; return (mean(a) - mean(b)) / Math.sqrt(va + vb);
}
const inW = (day, [a, b]) => day >= a && day <= b;
const statsOf = (tr) => (tr.length ? { n: tr.length, gross: r3(mean(tr.map((x) => x.R))), net: r3(mean(tr.map((x) => x.net))), net2: r3(mean(tr.map((x) => x.net2))), win: r3(tr.filter((x) => x.R > 0).length / tr.length), monthT: r2(monthT(tr.map((x) => ({ day: x.day, v: x.net }))).t) } : { n: 0 });

export function load2(m) {
  const rows = load(m, '5m').map((b) => [b.t, b.o, b.h, b.l, b.c]);
  const lastFull = Math.floor(rows.at(-1)[0] / DAY) * DAY, full = rows.filter((r) => r[0] < lastFull);
  return { days: buildDays(full), lab: labels(foldedCloses(full)) };
}
function shuffle(a, r) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
const p95 = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(0.95 * (s.length - 1))]; };

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const D = { xau: load2('xau'), usdjpy: load2('usdjpy') };
  // gate: unlabelled T1
  const gateRun = (m, w) => { const tr = []; for (const d of D[m].days) { if (!inW(d.day, w) || daySkip(d)) continue; const x = tradeOf(m, d); if (x) tr.push(x); } return { n: tr.length, net: r3(mean(tr.map((x) => x.net))) }; };
  const gj = gateRun('usdjpy', ['2005-01-04', '2015-12-31']), gg = gateRun('xau', ['2007-01-01', '2026-11-12']);
  const near = (g, n, net) => Math.abs(g.n - n) <= 0.01 * n && Math.abs(g.net - net) <= 0.005;
  const gate = { usdjpy: { got: gj, want: { n: 2089, net: 0.079 }, ok: near(gj, 2089, 0.079) }, xau: { got: gg, want: { n: 3713, net: 0.139 }, ok: near(gg, 3713, 0.139) } };
  console.log('gate', JSON.stringify(gate));
  if (!gate.usdjpy.ok || !gate.xau.ok) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'vb-vol-regime', gate, verdict: 'STOPPED: the harness gate failed' }, null, 1) + '\n'); process.exit(2); }

  // labelled days with their trade (null = no trade that day)
  const rows = {};
  for (const m of ['xau', 'usdjpy']) {
    rows[m] = [];
    for (const d of D[m].days) { if (daySkip(d)) continue; const L = D[m].lab.get(d.d0); if (!L) continue; rows[m].push({ day: d.day, ...L, tr: tradeOf(m, d) }); }
  }
  const res = { terciles: {}, tests: [] };
  const trOf = (R, ter) => R.filter((x) => x.tercile === ter && x.tr).map((x) => ({ day: x.day, ...x.tr }));
  for (const m of ['xau', 'usdjpy']) {
    res.terciles[m] = {};
    for (const w of ['disc', 'conf']) {
      const R = rows[m].filter((x) => inW(x.day, WIN[w]));
      res.terciles[m][w] = { days: R.length, from: R[0]?.day, to: R.at(-1)?.day, all: statsOf(R.filter((x) => x.tr).map((x) => ({ day: x.day, ...x.tr }))) };
      for (const ter of ['low', 'mid', 'high']) res.terciles[m][w][ter] = { days: R.filter((x) => x.tercile === ter).length, ...statsOf(trOf(R, ter)) };
    }
  }
  const pl = {};
  for (const m of ['xau', 'usdjpy']) {
    const R = rows[m].filter((x) => inW(x.day, WIN.conf)); pl[m] = [];
    for (let s = 1; s <= SEEDS; s++) {
      const r = rng(2000 + s), lab = shuffle(R.map((x) => x.tercile), r), hi = [], lo = [];
      R.forEach((x, i) => { if (!x.tr) return; if (lab[i] === 'high') hi.push(x.tr.net); else if (lab[i] === 'low') lo.push(x.tr.net); });
      pl[m].push(Math.abs(mean(hi) - mean(lo)));
    }
  }
  for (const [name, m] of [['H1 gold', 'xau'], ['H2 USD/JPY', 'usdjpy']]) {
    const W = {};
    for (const w of ['disc', 'conf']) {
      const R = rows[m].filter((x) => inW(x.day, WIN[w])), hi = trOf(R, 'high'), lo = trOf(R, 'low'), md = monthDiff(hi, lo);
      W[w] = { diff: r3(mean(hi.map((x) => x.net)) - mean(lo.map((x) => x.net))), welchT: r2(welch(hi.map((x) => x.net), lo.map((x) => x.net))), monthDiffMean: r3(md.mean), monthT: r2(md.t), tRaw: md.t, months: md.months, nHigh: hi.length, nLow: lo.length, netHigh: r3(mean(hi.map((x) => x.net))), netLow: r3(mean(lo.map((x) => x.net))) };
    }
    res.tests.push({ test: name, market: m, disc: W.disc, conf: W.conf, p: W.conf.tRaw == null ? 1 : pFromT(Math.abs(W.conf.tRaw), W.conf.months - 1), placeboP95: r3(p95(pl[m])) });
  }
  const adj = holm(res.tests.map((x) => x.p));
  res.tests.forEach((x, i) => {
    x.pHolm = r3(adj[i]); x.p = r3(x.p);
    const better = x.conf.diff > 0 ? 'high' : 'low', bn = (w) => (better === 'high' ? x[w].netHigh : x[w].netLow);
    x.better = better;
    x.checks = { sameSign: Math.sign(x.disc.diff) === Math.sign(x.conf.diff), t2Holm: Math.abs(x.conf.monthT) >= 2 && x.pHolm < 0.05, betterPos: bn('disc') > 0 && bn('conf') > 0, n200: Math.min(x.disc.nHigh, x.disc.nLow, x.conf.nHigh, x.conf.nLow) >= 200, placebo: Math.abs(x.conf.diff) > x.placeboP95 };
    x.pass = Object.values(x.checks).every(Boolean); delete x.disc.tRaw; delete x.conf.tRaw;
  });
  const sg = (v, d = 3) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
  const pass = res.tests.filter((x) => x.pass);
  const tl = (x) => `${x.test.split(' ').slice(1).join(' ')} high − low tercile ${sg(x.disc.diff)}R a trade in 2005-14 and ${sg(x.conf.diff)}R in 2015 → (Welch t ${sg(x.conf.welchT, 2)}; monthly-difference t ${sg(x.conf.monthT, 2)}, Holm p ${x.pHolm}; placebo 95th pct ${x.placeboP95}R)`;
  const verdict = `${pass.length ? 'PASS' : 'FAIL'}: ${pass.length} of 2; ${res.tests.map(tl).join('; ')}`;
  const out = { study: 'vb-vol-regime', built: '2026-11-24', regime: { nRv: N_RV, nRank: N_RANK, terciles: 'rank < 1/3 low, > 2/3 high' }, windows: WIN, dataEnd: { xau: D.xau.days.at(-1).day, usdjpy: D.usdjpy.days.at(-1).day }, gate, costs: { xau: 'gold-vol-breakout-hourcost C1 (hourly median spread + commission + 0.05 x M) and long financing', usdjpy: 'fx-vol-breakout charge (0.000045 x price + 0.5 pip)' }, ...res, placebo: Object.fromEntries(Object.entries(pl).map(([k, v]) => [k, v.map(r3)])), verdict };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(verdict); console.log(JSON.stringify(res, null, 1));
}
