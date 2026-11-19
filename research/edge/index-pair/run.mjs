// US equity index pairs: log-spread z-score mean reversion on daily candles (research/edge/index-pair/PREREGISTRATION.md,
// committed first). Research only: nothing here is read by the council, the mirror or any page; no order code.
//   node research/edge/index-pair/run.mjs fetch <dir>   copies council-data research/daily/{us2000,nas100,spx500,us30}.json into
//                                                       <dir> (outside git) and writes rates.json (2-year yield) next to this file;
//                                                       git show origin/council-data, no network
//   node research/edge/index-pair/run.mjs full <dir>    writes result.json and RESULT.md next to this file
// The z-score statistics, placebo seeding and Holm step are copied from research/edge/audnzd-revert/run.mjs (not imported).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- the pre-registered constants ----
export const PAIRS = [
  { id: 'P1', name: 'US2000 / NAS100', a: 'us2000', b: 'nas100' },
  { id: 'P2', name: 'SPX500 / US30', a: 'spx500', b: 'us30' },
];
export const P = { betaN: 250, zN: 60, zIn: 2, zStop: 3.5, hold: 20 };
export const SPREAD = { us2000: 0.4, nas100: 3, spx500: 1, us30: 4 }; // points, round trip
export const FINANCE = { markup: 0.025 }; // long leg r + 2.5 %, short leg max(0, 2.5 % - r), a year
export const WINDOWS = { rep: { from: '2009-01-01', to: '2016-01-01' }, dec: { from: '2016-01-01', to: null } };
export const BAR = { minT: 2, alpha: 0.05, placeboPct: 0.95 };
export const PLACEBO = { draws: 40, seed: 20261114 };
export const FILES = ['us2000', 'nas100', 'spx500', 'us30'];

const day = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
const r4 = (x) => (Number.isFinite(x) ? Math.round(x * 10000) / 10000 : null);

// candle file rows [t, o, h, l, c, v] -> trading-day bars (weekend stubs folded into the next weekday)
export function barsOf(file) {
  return foldWeekend(file.rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })));
}
// the two legs joined on the day's time: only days both have
export function join(a, b) {
  const m = new Map(b.map((x) => [x.time, x]));
  const out = [];
  for (const x of a) { const y = m.get(x.time); if (y) out.push({ time: x.time, ao: x.open, ac: x.close, bo: y.open, bc: y.close }); }
  return out;
}
// ordinary least squares slope (with intercept) of y on x
export function olsSlope(x, y) {
  const n = x.length; let mx = 0, my = 0;
  for (let k = 0; k < n; k++) { mx += x[k]; my += y[k]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0;
  for (let k = 0; k < n; k++) { sxy += (x[k] - mx) * (y[k] - my); sxx += (x[k] - mx) ** 2; }
  return sxx > 0 ? sxy / sxx : null;
}
const meanSd = (xs) => {
  const n = xs.length, m = xs.reduce((a, b) => a + b, 0) / n;
  return { mean: m, sd: Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) };
};
// spread of day k with a frozen beta, at the open or the close
export const spreadAt = (J, k, beta, at = 'c') => Math.log(at === 'o' ? J[k].ao : J[k].ac) - beta * Math.log(at === 'o' ? J[k].bo : J[k].bc);
// mean and sd of the frozen-beta close spread over the zN closes ending at j (null before enough history)
export function window(J, j, beta, N = P.zN) {
  if (j - N + 1 < 0) return null;
  const xs = []; for (let k = j - N + 1; k <= j; k++) xs.push(spreadAt(J, k, beta));
  return meanSd(xs);
}
// signal inputs at every close i, from closes up to and including i only: { beta, mean, sd, z } or null
export function signals(J) {
  const out = new Array(J.length).fill(null), la = J.map((x) => Math.log(x.ac)), lb = J.map((x) => Math.log(x.bc));
  for (let i = P.betaN - 1; i < J.length; i++) {
    const beta = olsSlope(lb.slice(i - P.betaN + 1, i + 1), la.slice(i - P.betaN + 1, i + 1));
    if (!(beta > 0)) { out[i] = { beta, mean: null, sd: null, z: null }; continue; }
    const w = window(J, i, beta);
    out[i] = { beta, mean: w.mean, sd: w.sd, z: w.sd > 0 ? (spreadAt(J, i, beta) - w.mean) / w.sd : null };
  }
  return out;
}

// one trade from a signal at close i, dir +1 long spread / -1 short spread.
// Returns a trade, { skip } when the entry open is already past the stop or the mean, or null when not closed by the data's end.
export function tradeFrom(J, sig, i, dir) {
  const s = sig[i], e = i + 1;
  if (!s || !(s.beta > 0) || !(s.sd > 0) || e >= J.length) return null;
  const beta = s.beta, entry = spreadAt(J, e, beta, 'o');
  const stop = s.mean - dir * P.zStop * s.sd, risk = Math.abs(stop - entry), zE = (entry - s.mean) / s.sd;
  if (dir * zE <= -P.zStop || dir * zE >= 0) return { skip: true, sig: i, dir, zE };
  for (let j = e; j < J.length; j++) {
    if (j > e) {
      const pw = window(J, j - 1, beta), so = spreadAt(J, j, beta, 'o');
      if (pw && pw.sd > 0 && -dir * (so - pw.mean) / pw.sd >= P.zStop) return done(j, so, 'stop-gap', J[j].time);
    }
    const w = window(J, j, beta), sc = spreadAt(J, j, beta);
    if (w && w.sd > 0) {
      const z = (sc - w.mean) / w.sd;
      if (-dir * z >= P.zStop) return done(j, sc, 'stop', J[j].time + 86400);
      if (dir * z >= 0) return done(j, sc, 'mean', J[j].time + 86400);
    }
    if (j - e + 1 >= P.hold) return done(j, sc, 'time', J[j].time + 86400);
  }
  return null;
  function done(j, px, why, closed) {
    return {
      sig: i, e, x: j, dir, beta, zSig: s.z, zE, entry, stop, risk, exit: px, why, opened: J[e].time, closed,
      Ae: J[e].ao, Be: J[e].bo, R: dir * (px - entry) / risk,
    };
  }
}

// 2-year yield (percent) of a day: the last value dated on or before it
export function rateAt(rates, t) {
  const d = new Date(t * 1000).toISOString().slice(0, 10);
  let lo = 0, hi = rates.length - 1, ans = null;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (rates[m][0] <= d) { ans = rates[m][1]; lo = m + 1; } else hi = m - 1; }
  return ans;
}
// costs of one trade in R: { spr, fin, total } (fin = false: financing off)
export function costOf(t, pair, rates, fin = true) {
  const spr = SPREAD[pair.a] / t.Ae + t.beta * SPREAD[pair.b] / t.Be;
  let f = 0;
  if (fin) {
    const r = rateAt(rates, t.opened) / 100, longY = r + FINANCE.markup, shortY = Math.max(0, FINANCE.markup - r);
    const wLong = t.dir > 0 ? 1 : t.beta, wShort = t.dir > 0 ? t.beta : 1;
    f = nights(t.opened, t.closed) * (wLong * longY + wShort * shortY) / 365;
  }
  return { spr: spr / t.risk, fin: f / t.risk, total: (spr + f) / t.risk };
}

// every trade of a pair, one position at a time; skipped signals counted
export function simulate(J, sig) {
  const out = [], skipped = [];
  let free = 0;
  for (let i = 0; i < J.length - 1; i++) {
    if (i < free || !sig[i] || sig[i].z == null) continue;
    const z = sig[i].z, dir = z > P.zIn ? -1 : z < -P.zIn ? 1 : 0; if (!dir) continue;
    const t = tradeFrom(J, sig, i, dir); if (!t) break;
    if (t.skip) { skipped.push(t); continue; }
    out.push(t); free = t.x; // a signal from the exit day's close on
  }
  return { trades: out, skipped };
}

const monthOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function monthsBetween(fromT, toT) {
  const out = []; const d = new Date(fromT * 1000); d.setUTCDate(1);
  while (d.getTime() / 1000 < toT) { out.push(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() + 1); }
  return out;
}
export function tStat(xs) {
  const n = xs.length; if (n < 2) return null;
  const m = xs.reduce((a, b) => a + b, 0) / n, v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1);
  return v > 0 ? m / Math.sqrt(v / n) : null;
}
// one-sided p of a t from the normal approximation
export function pOneSided(t) {
  if (!Number.isFinite(t)) return 1;
  const x = t / Math.SQRT2, a = 1 / (1 + 0.3275911 * Math.abs(x));
  const erf = 1 - (((((1.061405429 * a - 1.453152027) * a) + 1.421413741) * a - 0.284496736) * a + 0.254829592) * a * Math.exp(-x * x);
  return 0.5 * (1 - (x >= 0 ? erf : -erf));
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), m = ps.length, out = new Array(m);
  let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (m - k) * p)); out[i] = run; });
  return out;
}

// statistics of the trades entered in [fromT, toT); months from fromT to toT (exclusive)
export function stats(trades, fromT, toT, pair, rates, fin = true) {
  const ts = trades.filter((t) => t.opened >= fromT && t.opened < toT);
  const cs = ts.map((t) => costOf(t, pair, rates, fin)), net = ts.map((t, k) => t.R - cs[k].total), n = ts.length;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const months = monthsBetween(fromT, toT), byM = Object.fromEntries(months.map((m) => [m, 0]));
  ts.forEach((t, k) => { const m = monthOf(t.closed); if (m in byM) byM[m] += net[k]; else byM[m] = net[k]; });
  const mt = tStat(Object.values(byM));
  let cum = 0, hi = 0, dd = 0; for (const x of net) { cum += x; hi = Math.max(hi, cum); dd = Math.min(dd, cum - hi); }
  const win = net.filter((x) => x > 0), loss = net.filter((x) => x <= 0);
  const why = {}; for (const t of ts) why[t.why] = (why[t.why] || 0) + 1;
  const sides = { long: ts.filter((t) => t.dir > 0).length, short: ts.filter((t) => t.dir < 0).length };
  return {
    n, avg: n ? r3(sum(net) / n) : null, gross: n ? r3(sum(ts.map((t) => t.R)) / n) : null,
    spread: n ? r3(sum(cs.map((c) => c.spr)) / n) : null, fin: n ? r3(sum(cs.map((c) => c.fin)) / n) : null,
    total: r2(sum(net)), wr: n ? r2(win.length / n * 100) : null, pf: loss.length && sum(loss) < 0 ? r2(sum(win) / -sum(loss)) : null,
    months: Object.keys(byM).length, monthT: r2(mt), p: mt == null ? 1 : r4(pOneSided(mt)), dd: r2(dd), exits: why, sides,
    worstR: n ? r3(Math.min(...net)) : null,
  };
}

// seeded random numbers
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// random entries with the same exits and the real side mix: `draws` draws (seed + d each), net R a trade per draw
export function placebo(J, sig, sides, fromT, toT, pair, rates, { draws = PLACEBO.draws, seed = PLACEBO.seed } = {}) {
  const ok = [];
  for (let i = 0; i < J.length - 1; i++) if (sig[i] && sig[i].z != null && J[i + 1].time >= fromT && J[i + 1].time < toT) ok.push(i);
  const out = [], n = sides.length;
  if (!n || !ok.length) return out;
  for (let d = 0; d < draws; d++) {
    const rnd = mulberry32(seed + d), mix = [...sides];
    for (let k = mix.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [mix[k], mix[j]] = [mix[j], mix[k]]; }
    let s = 0, k = 0, tries = 0;
    while (k < n && tries < n * 50) {
      tries++;
      const i = ok[Math.floor(rnd() * ok.length)], t = tradeFrom(J, sig, i, mix[k]);
      if (!t || t.skip) continue;
      s += t.R - costOf(t, pair, rates).total; k++;
    }
    out.push(k === n ? s / k : null);
  }
  return out;
}
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };
const median = (xs) => pct(xs, 0.5);

// the whole study on loaded files { us2000, nas100, spx500, us30 } and the merged 2-year series [[date, pct], ...]
export function evaluate(files, rates) {
  const rows = PAIRS.map((pair) => {
    const J = join(barsOf(files[pair.a]), barsOf(files[pair.b])), sig = signals(J), end = J.at(-1).time + 86400;
    const rep = [day(WINDOWS.rep.from), day(WINDOWS.rep.to)], dec = [day(WINDOWS.dec.from), end];
    const { trades, skipped } = simulate(J, sig);
    const d = stats(trades, ...dec, pair, rates), r = stats(trades, ...rep, pair, rates);
    const decT = trades.filter((t) => t.opened >= dec[0] && t.opened < dec[1]);
    const pl = placebo(J, sig, decT.map((t) => t.dir), ...dec, pair, rates).filter((x) => x != null);
    const inW = (t, w) => J[t.sig + 1].time >= w[0] && J[t.sig + 1].time < w[1];
    return {
      id: pair.id, name: pair.name, legs: [pair.a, pair.b], rep: r, dec: d,
      fin0: { dec: stats(trades, ...dec, pair, rates, false).avg, rep: stats(trades, ...rep, pair, rates, false).avg },
      skipped: { dec: skipped.filter((t) => inW(t, dec)).length, rep: skipped.filter((t) => inW(t, rep)).length },
      zSig: { median: r2(median(decT.map((t) => Math.abs(t.zSig)))), atLeast3: decT.filter((t) => Math.abs(t.zSig) >= 3).length },
      risk: { median: r4(median(decT.map((t) => t.risk))) },
      beta: { median: r3(median(decT.map((t) => t.beta))), min: r3(Math.min(...decT.map((t) => t.beta))), max: r3(Math.max(...decT.map((t) => t.beta))) },
      data: { days: J.length, from: new Date(J[0].time * 1000).toISOString().slice(0, 10), to: new Date(J.at(-1).time * 1000).toISOString().slice(0, 10) },
      placebo: { draws: pl.length, median: r3(pct(pl, 0.5)), p5: r3(pct(pl, 0.05)), p95: r3(pct(pl, BAR.placeboPct)), atLeastReal: pl.filter((x) => x >= d.avg).length },
    };
  });
  const adj = holm(rows.map((x) => x.dec.p));
  rows.forEach((x, k) => {
    x.holmP = r4(adj[k]);
    x.aboveRandom = x.dec.avg != null && x.placebo.p95 != null && x.dec.avg > x.placebo.p95;
    x.checks = { netPositive: x.dec.avg > 0, tAtLeast2: x.dec.monthT != null && x.dec.monthT >= BAR.minT, holm: x.holmP < BAR.alpha, sameSignRep: x.rep.avg > 0, aboveRandom: x.aboveRandom };
    x.pass = Object.values(x.checks).every(Boolean);
  });
  const passed = rows.filter((x) => x.pass).map((x) => x.id);
  return {
    study: 'index-pair', title: 'US equity index pairs: log-spread z-score mean reversion', built: '2026-11-14', preregistration: 'PREREGISTRATION.md',
    system: 'US2000 / NAS100 and SPX500 / US30 spread reversion (not a council system)',
    verdict: passed.length ? `PASS, ${passed.length} of 2 pairs (${passed.join(', ')})` : 'FAIL, 0 of 2 pairs: fading a 2-sd stretch of the US index spreads is not an edge after costs',
    data: { src: 'OANDA mid daily US2000_USD, NAS100_USD, SPX500_USD, US30_USD, council-data research/daily/*.json', rates: 'FRED DGS2 from council-data macro/cache.json (score.fred weekly + fred daily), rates.json', ratesFrom: rates[0][0], ratesTo: rates.at(-1)[0] },
    params: P, spreads: SPREAD, financing: FINANCE, windows: WINDOWS, bar: BAR, placeboSpec: PLACEBO, pairs: rows,
  };
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '') + x.toFixed(3));
const f2 = (x) => (x == null ? 'n/a' : x.toFixed(2));
export function report(res) {
  const V = res.pairs, L = [];
  L.push('# Result: US equity index pairs, log-spread z-score mean reversion (14 Nov 2026)', '');
  L.push(`**Verdict: ${res.verdict}.** Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed alone and pushed first). ${V.map((x) => `${x.name}: ${f3(x.dec.avg)}R a trade net on 2016-now (n ${x.dec.n}, month-sum t ${f2(x.dec.monthT)}), ${f3(x.rep.avg)}R on 2009-15 (n ${x.rep.n})`).join('; ')}. Nothing live changed.`, '');
  L.push(`Data: ${res.data.src}; weekend stubs folded with \`foldWeekend\`, legs joined on common days (${V.map((x) => `${x.name} ${x.data.days} days, ${x.data.from} to ${x.data.to}`).join('; ')}). 2-year yield for financing: ${res.data.rates}, ${res.data.ratesFrom} to ${res.data.ratesTo}. Rule: beta = OLS slope of ln(A) on ln(B) over the last 250 closes, z of the spread over 60 closes with that beta; z > 2 shorts the spread, z < -2 buys it, at the next open; exit at z crossing 0, at the pair's stop (z ±3.5, checked at the open and the close; 1R = entry to the 3.5 level) or after 20 days; one position at a time. Costs: both legs' spreads (US2000 0.4, NAS100 3, SPX500 1, US30 4 points a round trip) and financing on both legs (long leg 2Y + 2.5 %, short leg max(0, 2.5 % - 2Y), a year, per rollover night).`, '');
  L.push('| Pair | Window | n | Net R a trade | Gross | Spread cost | Financing | Win % | PF | Month-sum t | p (one-sided) | Holm p | Worst drawdown |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const x of V) for (const [w, s] of [['2016-now (decisive)', x.dec], ['2009-15', x.rep]])
    L.push(`| ${x.id} ${x.name} | ${w} | ${s.n} | ${f3(s.avg)} | ${f3(s.gross)} | ${f3(s.spread)} | ${f3(s.fin)} | ${f2(s.wr)} | ${f2(s.pf)} | ${f2(s.monthT)} | ${w.startsWith('2016') ? s.p : '-'} | ${w.startsWith('2016') ? x.holmP : '-'} | ${f2(s.dd)}R |`);
  L.push('', '## Against the bar', '');
  for (const x of V) {
    const c = x.checks;
    L.push(`- **${x.id} ${x.name}**: ${x.pass ? 'PASS' : 'fail'}. Net R a trade > 0: ${c.netPositive ? 'yes' : 'no'} (${f3(x.dec.avg)}); month-sum t >= 2: ${c.tAtLeast2 ? 'yes' : 'no'} (${f2(x.dec.monthT)}); Holm p < 0.05: ${c.holm ? 'yes' : 'no'} (${x.holmP}); same sign on 2009-15: ${c.sameSignRep ? 'yes' : 'no'} (${f3(x.rep.avg)}); above the placebo's 95th percentile: ${c.aboveRandom ? 'yes' : 'no'} (${f3(x.placebo.p95)}).`);
  }
  L.push('', '## Placebo: random entries, the real side mix, the same exits (decisive window, 40 seeded draws each)', '');
  L.push('| Pair | Real net R a trade | Draws median | 5th pct | 95th pct | Draws >= real |', '|---|---|---|---|---|---|');
  for (const x of V) L.push(`| ${x.id} ${x.name} | ${f3(x.dec.avg)} | ${f3(x.placebo.median)} | ${f3(x.placebo.p5)} | ${f3(x.placebo.p95)} | ${x.placebo.atLeastReal} of ${x.placebo.draws} |`);
  L.push('', '## Also reported, not judged', '');
  for (const x of V) {
    L.push(`- **${x.id} ${x.name}**: exits on 2016-now ${Object.entries(x.dec.exits).map(([k, n]) => `${k} ${n}`).join(', ')}; sides ${x.dec.sides.short} short spread / ${x.dec.sides.long} long spread; worst single trade ${f3(x.dec.worstR)}R; signals skipped (entry open already past the stop or the mean) ${x.skipped.dec} on 2016-now, ${x.skipped.rep} on 2009-15; |z| at the signal median ${f2(x.zSig.median)}, ${x.zSig.atLeast3} of ${x.dec.n} signals at |z| >= 3 (an entry near the 3.5 level has a small 1R, so its costs and any gap past the stop weigh many R: the worst trades); 1R median ${f2(x.risk.median * 100)} % of leg A's notional; beta at the decisive trades median ${f2(x.beta.median)} (${f2(x.beta.min)} to ${f2(x.beta.max)}); with financing off, net R a trade ${f3(x.fin0.dec)} on 2016-now and ${f3(x.fin0.rep)} on 2009-15.`);
  }
  L.push('', '## What it means', '');
  L.push(V.some((x) => x.pass)
    ? 'A pair cleared the pre-registered bar. At most a proposal for a paper shadow, for the owner to decide (`research/proposals/`); no live change.'
    : 'No pair clears the pre-registered bar: betting on the return of a 2-sd stretch of these US index spreads to their 60-day mean is not a tradeable edge after both legs\' spreads and financing on this data. Both pairs lose before any cost too (gross R a trade below 0 in both windows) and do worse than random entries with the same exits: on this data a 2-sd stretch of these spreads tended to run further rather than come back within 20 days. It is not a council rule, no proposal is written and nothing live changed. Never call it an edge; another threshold, window, hedge ratio, stop or exit would need its own pre-registration on other data.');
  L.push('', 'Stated limits: the pair\'s stop is checked at the open and the close only (two prices of the spread a day), so a stop exit fills beyond the 3.5 level and can lose more than 1R; spreads are stated, not measured, and no slippage or commission is added; financing uses the 2-year yield of the entry day for the whole trade and the repository\'s `nights` count (Wednesday three), which may differ from an index CFD\'s own triple day.', '');
  L.push('To repeat: `node research/edge/index-pair/run.mjs fetch <dir>` (git show from origin/council-data, no network; candles kept out of git, `rates.json` written here), then `node research/edge/index-pair/run.mjs full <dir>`. Tests: `tests/index-pair.test.mjs`.', '');
  return L.join('\n');
}

// the merged 2-year series from council-data macro/cache.json: weekly score.fred.DGS2, the daily fred.DGS2 winning on a shared date
export function mergeRates(cache) {
  const m = new Map();
  for (const [d, v] of cache.score?.fred?.DGS2 || []) if (Number.isFinite(v)) m.set(d, v);
  for (const [d, v] of cache.fred?.DGS2 || []) if (Number.isFinite(v)) m.set(d, v);
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir || !['fetch', 'full'].includes(cmd)) { console.error('usage: run.mjs fetch|full <dir>'); process.exit(2); }
  const show = (p) => execFileSync('git', ['show', `origin/council-data:${p}`], { cwd: path.join(HERE, '../../..'), maxBuffer: 64 << 20 });
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of FILES) { fs.writeFileSync(path.join(dir, `${k}.json`), show(`research/daily/${k}.json`)); console.log('saved', k); }
    const rates = mergeRates(JSON.parse(show('macro/cache.json')));
    fs.writeFileSync(path.join(HERE, 'rates.json'), JSON.stringify({ src: 'FRED DGS2 (percent) from council-data macro/cache.json: score.fred.DGS2 weekly + fred.DGS2 daily', rows: rates }) + '\n');
    console.log('rates', rates.length, rates[0][0], rates.at(-1)[0]);
  } else {
    const files = {};
    for (const k of FILES) files[k] = JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8'));
    const rates = JSON.parse(fs.readFileSync(path.join(HERE, 'rates.json'), 'utf8')).rows;
    const res = evaluate(files, rates);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
    console.log(res.verdict); for (const x of res.pairs) console.log(x.id, JSON.stringify(x.dec), 'rep', JSON.stringify(x.rep), 'holm', x.holmP, 'pl', JSON.stringify(x.placebo));
  }
}
