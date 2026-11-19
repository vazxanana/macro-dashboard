// Non-US equity index pairs: log-spread z-score MOMENTUM on daily candles (research/edge/index-spread-momentum/PREREGISTRATION.md,
// committed first). Research only: nothing here is read by the council, the mirror or any page; no order code.
//   node research/edge/index-spread-momentum/run.mjs fetch <dir>   copies council-data research/daily/<key>.json of the six legs
//                                                                  into <dir> (outside git); git show origin/council-data, no network
//   node research/edge/index-spread-momentum/run.mjs full <dir>    writes result.json and RESULT.md next to this file
// The join, hedge ratio, spread, z-score, gap check, stop ordering, cost and statistics code is copied from
// research/edge/index-pair/run.mjs (branch index-pair, not imported across branches); the entry direction is reversed and the
// exits are the pre-registered ones (stop z = 0, target |z| = 4, 20 days). Policy rates: rates.json (copied + AUD added).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- the pre-registered constants ----
export const PAIRS = [
  { id: 'P1', name: 'DE40 / UK100', a: 'de40', b: 'uk100' },
  { id: 'P2', name: 'EU50 / UK100', a: 'eu50', b: 'uk100' },
  { id: 'P3', name: 'JP225 / AU200', a: 'jp225', b: 'au200' },
  { id: 'P4', name: 'DE40 / FR40', a: 'de40', b: 'fr40' },
];
export const P = { betaN: 250, zN: 60, zIn: 2, zStop: 0, zTarget: 4, hold: 20 };
export const SPREAD = { de40: 2, uk100: 2, eu50: 2, fr40: 2, jp225: 10, au200: 2 }; // points, round trip (stated; none in ctrader/symbols.json)
export const CUR = { de40: 'eur', eu50: 'eur', fr40: 'eur', uk100: 'gbp', jp225: 'jpy', au200: 'aud' };
export const FINANCE = { markup: 0.025 }; // long leg max(0, r + 2.5 %), short leg max(0, 2.5 % - r), a year
export const WINDOWS = { rep: { from: '2009-01-01', to: '2016-01-01' }, dec: { from: '2016-01-01', to: null } };
export const BAR = { minT: 2, placeboPct: 0.95, minPairsPositive: 3 };
export const PLACEBO = { draws: 40, seed: 20261114 };
export const FILES = ['de40', 'uk100', 'eu50', 'jp225', 'au200', 'fr40'];

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
// the momentum direction of a signal z: +1 buy the spread (z > 2), -1 sell it (z < -2), 0 none
export const dirOf = (z) => (z > P.zIn ? 1 : z < -P.zIn ? -1 : 0);

// one trade from a signal at close i, dir +1 long spread / -1 short spread.
// Stop: the trade's z back at 0 (1R = entry to the signal close's mean); target: z at +-4 the trade's way; time: 20 days.
// Returns a trade, { skip } when the entry open is already at or past the stop or the target, or null when not closed by the end.
export function tradeFrom(J, sig, i, dir) {
  const s = sig[i], e = i + 1;
  if (!s || !(s.beta > 0) || !(s.sd > 0) || e >= J.length) return null;
  const beta = s.beta, entry = spreadAt(J, e, beta, 'o');
  const stop = s.mean + dir * P.zStop * s.sd, risk = Math.abs(stop - entry), zE = (entry - s.mean) / s.sd;
  if (dir * zE <= P.zStop || dir * zE >= P.zTarget) return { skip: true, sig: i, dir, zE };
  for (let j = e; j < J.length; j++) {
    if (j > e) {
      const pw = window(J, j - 1, beta), so = spreadAt(J, j, beta, 'o');
      if (pw && pw.sd > 0 && dir * (so - pw.mean) / pw.sd <= P.zStop) return done(j, so, 'stop-gap', J[j].time);
    }
    const w = window(J, j, beta), sc = spreadAt(J, j, beta);
    if (w && w.sd > 0) {
      const z = (sc - w.mean) / w.sd;
      if (dir * z <= P.zStop) return done(j, sc, 'stop', J[j].time + 86400);
      if (dir * z >= P.zTarget) return done(j, sc, 'target', J[j].time + 86400);
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

// local policy rate (percent) of a currency on a day: that calendar year's figure; a year before the table takes its first year
export function rateAt(rates, cur, t) {
  const T = rates[cur]; if (!T) return null;
  const years = Object.keys(T).map(Number).sort((a, b) => a - b);
  let y = new Date(t * 1000).getUTCFullYear();
  if (y < years[0]) y = years[0];
  while (T[y] == null && y > years[0]) y--;
  return T[y] ?? null;
}
// costs of one trade in R: { spr, fin, total } (fin = false: financing off)
export function costOf(t, pair, rates, fin = true) {
  const spr = SPREAD[pair.a] / t.Ae + t.beta * SPREAD[pair.b] / t.Be;
  let f = 0;
  if (fin) {
    const rA = rateAt(rates, CUR[pair.a], t.opened) / 100, rB = rateAt(rates, CUR[pair.b], t.opened) / 100;
    const longY = (r) => Math.max(0, r + FINANCE.markup), shortY = (r) => Math.max(0, FINANCE.markup - r);
    // long spread: long A (weight 1), short B (weight beta); short spread: short A, long B
    const yA = t.dir > 0 ? longY(rA) : shortY(rA), yB = t.dir > 0 ? shortY(rB) : longY(rB);
    f = nights(t.opened, t.closed) * (yA + t.beta * yB) / 365;
  }
  return { spr: spr / t.risk, fin: f / t.risk, total: (spr + f) / t.risk };
}

// every trade of a pair, one position at a time; skipped signals counted
export function simulate(J, sig) {
  const out = [], skipped = [];
  let free = 0;
  for (let i = 0; i < J.length - 1; i++) {
    if (i < free || !sig[i] || sig[i].z == null) continue;
    const dir = dirOf(sig[i].z); if (!dir) continue;
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

// statistics of a list of { t: trade, net, c: cost } entered in [fromT, toT); months from fromT to toT (exclusive)
export function statsOf(rows, fromT, toT) {
  const ts = rows.filter((x) => x.t.opened >= fromT && x.t.opened < toT), n = ts.length, net = ts.map((x) => x.net);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const months = monthsBetween(fromT, toT), byM = Object.fromEntries(months.map((m) => [m, 0]));
  ts.forEach((x) => { const m = monthOf(x.t.closed); byM[m] = (byM[m] || 0) + x.net; });
  const mt = tStat(Object.values(byM));
  const ord = [...ts].sort((a, b) => a.t.closed - b.t.closed);
  let cum = 0, hi = 0, dd = 0; for (const x of ord) { cum += x.net; hi = Math.max(hi, cum); dd = Math.min(dd, cum - hi); }
  const win = net.filter((x) => x > 0), loss = net.filter((x) => x <= 0);
  const why = {}; for (const x of ts) why[x.t.why] = (why[x.t.why] || 0) + 1;
  const sides = { long: ts.filter((x) => x.t.dir > 0).length, short: ts.filter((x) => x.t.dir < 0).length };
  return {
    n, avg: n ? r3(sum(net) / n) : null, gross: n ? r3(sum(ts.map((x) => x.t.R)) / n) : null,
    spread: n ? r3(sum(ts.map((x) => x.c.spr)) / n) : null, fin: n ? r3(sum(ts.map((x) => x.c.fin)) / n) : null,
    total: r2(sum(net)), wr: n ? r2(win.length / n * 100) : null, pf: loss.length && sum(loss) < 0 ? r2(sum(win) / -sum(loss)) : null,
    months: Object.keys(byM).length, monthT: r2(mt), p: mt == null ? 1 : r4(pOneSided(mt)), dd: r2(dd), exits: why, sides,
    worstR: n ? r3(Math.min(...net)) : null,
  };
}
export const withCost = (trades, pair, rates, fin = true) => trades.map((t) => { const c = costOf(t, pair, rates, fin); return { t, c, net: t.R - c.total }; });

// seeded random numbers
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// one draw of random entries for one pair: the real side mix shuffled, the same exits and costs; returns [net R] (or null)
export function placeboDraw(J, sig, sides, fromT, toT, pair, rates, rnd) {
  const ok = [];
  for (let i = 0; i < J.length - 1; i++) if (sig[i] && sig[i].z != null && sig[i].sd > 0 && J[i + 1].time >= fromT && J[i + 1].time < toT) ok.push(i);
  const n = sides.length; if (!n) return []; if (!ok.length) return null;
  const mix = [...sides];
  for (let k = mix.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [mix[k], mix[j]] = [mix[j], mix[k]]; }
  const out = []; let tries = 0;
  while (out.length < n && tries < n * 50) {
    tries++;
    const i = ok[Math.floor(rnd() * ok.length)], t = tradeFrom(J, sig, i, mix[out.length]);
    if (!t || t.skip) continue;
    out.push(t.R - costOf(t, pair, rates).total);
  }
  return out.length === n ? out : null;
}
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };
const median = (xs) => pct(xs, 0.5);
const avgOf = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// the whole study on loaded files { de40, uk100, ... } and the rates table { eur: {year: pct}, ... }
export function evaluate(files, rates, { draws = PLACEBO.draws } = {}) {
  const runs = PAIRS.map((pair) => {
    const J = join(barsOf(files[pair.a]), barsOf(files[pair.b])), sig = signals(J), end = J.at(-1).time + 86400;
    const rep = [day(WINDOWS.rep.from), day(WINDOWS.rep.to)], dec = [day(WINDOWS.dec.from), end];
    const { trades, skipped } = simulate(J, sig);
    return { pair, J, sig, end, rep, dec, trades, skipped, rows: withCost(trades, pair, rates), rows0: withCost(trades, pair, rates, false) };
  });
  const decEnd = Math.max(...runs.map((x) => x.end)), decAll = [day(WINDOWS.dec.from), decEnd], repAll = [day(WINDOWS.rep.from), day(WINDOWS.rep.to)];
  // placebo: per draw, every pair's random entries; the pooled and per-pair net R a trade
  const pool = [], per = runs.map(() => []);
  for (let d = 0; d < draws; d++) {
    const rnd = mulberry32(PLACEBO.seed + d); let all = [], ok = true;
    runs.forEach((r, k) => {
      const sides = r.rows.filter((x) => x.t.opened >= r.dec[0] && x.t.opened < r.dec[1]).map((x) => x.t.dir);
      const xs = placeboDraw(r.J, r.sig, sides, ...r.dec, r.pair, rates, rnd);
      if (xs == null) { ok = false; per[k].push(null); return; }
      per[k].push(avgOf(xs)); all = all.concat(xs);
    });
    pool.push(ok ? avgOf(all) : null);
  }
  const plOf = (xs, real) => { const v = xs.filter((x) => x != null); return { draws: v.length, median: r3(pct(v, 0.5)), p5: r3(pct(v, 0.05)), p95: r3(pct(v, BAR.placeboPct)), atLeastReal: v.filter((x) => x >= real).length }; };
  const pairs = runs.map((r, k) => {
    const d = statsOf(r.rows, ...r.dec), rp = statsOf(r.rows, ...r.rep);
    const decT = r.trades.filter((t) => t.opened >= r.dec[0] && t.opened < r.dec[1]);
    const inW = (t, w) => r.J[t.sig + 1].time >= w[0] && r.J[t.sig + 1].time < w[1];
    return {
      id: r.pair.id, name: r.pair.name, legs: [r.pair.a, r.pair.b], dec: d, rep: rp,
      fin0: { dec: statsOf(r.rows0, ...r.dec).avg, rep: statsOf(r.rows0, ...r.rep).avg },
      skipped: { dec: r.skipped.filter((t) => inW(t, r.dec)).length, rep: r.skipped.filter((t) => inW(t, r.rep)).length },
      zSig: { median: r2(median(decT.map((t) => Math.abs(t.zSig)))) },
      risk: { median: r4(median(decT.map((t) => t.risk))) },
      beta: { median: r3(median(decT.map((t) => t.beta))), min: r3(Math.min(...decT.map((t) => t.beta))), max: r3(Math.max(...decT.map((t) => t.beta))) },
      data: { days: r.J.length, from: new Date(r.J[0].time * 1000).toISOString().slice(0, 10), to: new Date(r.J.at(-1).time * 1000).toISOString().slice(0, 10) },
      placebo: plOf(per[k], d.avg),
    };
  });
  const allRows = runs.flatMap((r) => r.rows), allRows0 = runs.flatMap((r) => r.rows0);
  const pooled = { dec: statsOf(allRows, ...decAll), rep: statsOf(allRows, ...repAll), fin0: { dec: statsOf(allRows0, ...decAll).avg, rep: statsOf(allRows0, ...repAll).avg } };
  pooled.placebo = plOf(pool, pooled.dec.avg);
  const positive = pairs.filter((x) => x.dec.avg > 0).length;
  const checks = {
    netPositive: pooled.dec.avg > 0,
    tAtLeast2: pooled.dec.monthT != null && pooled.dec.monthT >= BAR.minT,
    sameSignRep: pooled.rep.avg > 0,
    pairsPositive: positive >= BAR.minPairsPositive,
    aboveRandom: pooled.dec.avg != null && pooled.placebo.p95 != null && pooled.dec.avg > pooled.placebo.p95,
  };
  const pass = Object.values(checks).every(Boolean), nOk = Object.values(checks).filter(Boolean).length;
  return {
    study: 'index-spread-momentum', title: 'Non-US equity index pairs: log-spread z-score momentum', built: '2026-11-14', preregistration: 'PREREGISTRATION.md',
    system: 'DE40 / UK100, EU50 / UK100, JP225 / AU200, DE40 / FR40 spread momentum (not a council system)',
    verdict: pass ? 'PASS, all 5 pre-registered checks' : `FAIL, ${nOk} of 5 pre-registered checks: following a 2-sd stretch of these non-US index spreads is not an edge after costs`,
    pass, checks, pairsPositive: positive,
    data: { src: 'OANDA mid daily DE30_EUR, UK100_GBP, EU50_EUR, JP225_USD, AU200_AUD, FR40_EUR, council-data research/daily/*.json', rates: rates.src },
    params: P, spreads: SPREAD, currencies: CUR, financing: FINANCE, windows: WINDOWS, bar: BAR, placeboSpec: PLACEBO,
    pooled, pairs,
  };
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '') + x.toFixed(3));
const f2 = (x) => (x == null ? 'n/a' : x.toFixed(2));
const yn = (b) => (b ? 'yes' : 'no');
export function report(res) {
  const V = res.pairs, Q = res.pooled, c = res.checks, L = [];
  L.push('# Result: non-US equity index pairs, log-spread z-score momentum (14 Nov 2026)', '');
  L.push(`**Verdict: ${res.verdict}.** Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed alone and pushed first). Pooled over the four pairs: ${f3(Q.dec.avg)}R a trade net on 2016-now (n ${Q.dec.n}, month-sum t ${f2(Q.dec.monthT)}), ${f3(Q.rep.avg)}R on 2009-15 (n ${Q.rep.n}); ${res.pairsPositive} of 4 pairs positive on 2016-now; placebo 95th percentile ${f3(Q.placebo.p95)}. Nothing live changed.`, '');
  L.push('The hypothesis (following a 2-sd stretch of an index spread pays) was formed from the result of `index-pair` (draft PR #881), where fading such stretches on US2000 / NAS100 and SPX500 / US30 lost before costs. Those US pairs are excluded here on purpose: testing the idea on them would fit it on the data that suggested it.', '');
  L.push(`Data: ${res.data.src}; weekend stubs folded with \`foldWeekend\`, legs joined on common days (${V.map((x) => `${x.name} ${x.data.days} days, ${x.data.from} to ${x.data.to}`).join('; ')}). Rule: beta = OLS slope of ln(A) on ln(B) over the last 250 closes, z of the spread over 60 closes with that beta; z > 2 buys the spread (long A, short beta of B), z < -2 sells it, at the next open; stop when the trade's z returns to 0 (checked at the open and the close; 1R = entry to the signal close's 60-day mean), target at z ±4 the trade's way (at the close), out after 20 days; one position at a time per pair. Costs: both legs' spreads (DE40 2, UK100 2, EU50 2, FR40 2, JP225 10, AU200 2 points a round trip; none of them is in ctrader/symbols.json) and financing on both legs (long leg local policy rate + 2.5 %, short leg max(0, 2.5 % - rate), a year, per rollover night; rates.json).`, '');
  L.push('| Pair | Window | n | Net R a trade | Gross | Spread cost | Financing | Win % | PF | Month-sum t | Worst drawdown |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  const row = (name, w, s) => L.push(`| ${name} | ${w} | ${s.n} | ${f3(s.avg)} | ${f3(s.gross)} | ${f3(s.spread)} | ${f3(s.fin)} | ${f2(s.wr)} | ${f2(s.pf)} | ${f2(s.monthT)} | ${f2(s.dd)}R |`);
  for (const [w, k] of [['2016-now (decisive)', 'dec'], ['2009-15', 'rep']]) row('**Pooled**', w, Q[k]);
  for (const x of V) for (const [w, k] of [['2016-now (decisive)', 'dec'], ['2009-15', 'rep']]) row(`${x.id} ${x.name}`, w, x[k]);
  L.push('', '## Against the bar', '');
  L.push(`- Pooled 2016-now net R a trade > 0: ${yn(c.netPositive)} (${f3(Q.dec.avg)}).`);
  L.push(`- Pooled 2016-now month-sum t >= 2: ${yn(c.tAtLeast2)} (${f2(Q.dec.monthT)}, ${Q.dec.months} months).`);
  L.push(`- Pooled 2009-15 net R a trade > 0 (same sign): ${yn(c.sameSignRep)} (${f3(Q.rep.avg)}).`);
  L.push(`- At least 3 of 4 pairs positive on 2016-now: ${yn(c.pairsPositive)} (${res.pairsPositive}: ${V.map((x) => `${x.id} ${f3(x.dec.avg)}`).join(', ')}).`);
  L.push(`- Pooled net R a trade above the placebo's 95th percentile: ${yn(c.aboveRandom)} (${f3(Q.dec.avg)} against ${f3(Q.placebo.p95)}).`);
  L.push('', '## Placebo: random entry days, each pair\'s real count and side mix, the same exits and costs (2016-now, 40 seeded draws)', '');
  L.push('| Stream | Real net R a trade | Draws median | 5th pct | 95th pct | Draws >= real |', '|---|---|---|---|---|---|');
  L.push(`| **Pooled** | ${f3(Q.dec.avg)} | ${f3(Q.placebo.median)} | ${f3(Q.placebo.p5)} | ${f3(Q.placebo.p95)} | ${Q.placebo.atLeastReal} of ${Q.placebo.draws} |`);
  for (const x of V) L.push(`| ${x.id} ${x.name} | ${f3(x.dec.avg)} | ${f3(x.placebo.median)} | ${f3(x.placebo.p5)} | ${f3(x.placebo.p95)} | ${x.placebo.atLeastReal} of ${x.placebo.draws} |`);
  L.push('', 'A random entry day usually has its spread near the 60-day mean, so its 1R (the distance to the z = 0 stop) is small and the same costs weigh many R: that is why the draws\' median is far below zero and their spread is wide. The bar compares with the 95th percentile, as pre-registered.');
  L.push('', '## Also reported, not judged', '');
  L.push(`- **Pooled**: exits on 2016-now ${Object.entries(Q.dec.exits).map(([k, n]) => `${k} ${n}`).join(', ')}; sides ${Q.dec.sides.long} long spread / ${Q.dec.sides.short} short spread; with financing off, net R a trade ${f3(Q.fin0.dec)} on 2016-now and ${f3(Q.fin0.rep)} on 2009-15.`);
  for (const x of V) {
    L.push(`- **${x.id} ${x.name}**: exits on 2016-now ${Object.entries(x.dec.exits).map(([k, n]) => `${k} ${n}`).join(', ')}; sides ${x.dec.sides.long} long spread / ${x.dec.sides.short} short spread; worst single trade ${f3(x.dec.worstR)}R; signals skipped (entry open already past the stop or the target) ${x.skipped.dec} on 2016-now, ${x.skipped.rep} on 2009-15; |z| at the signal median ${f2(x.zSig.median)}; 1R median ${f2(x.risk.median * 100)} % of leg A's notional; beta at the decisive trades median ${f2(x.beta.median)} (${f2(x.beta.min)} to ${f2(x.beta.max)}); with financing off, net R a trade ${f3(x.fin0.dec)} on 2016-now and ${f3(x.fin0.rep)} on 2009-15.`);
  }
  L.push('', '## What it means', '');
  L.push(res.pass
    ? 'The pooled stream cleared every pre-registered check. At most a proposal for a paper shadow, for the owner to decide (`research/proposals/`); no live change. It says nothing about the US pairs, which were kept out.'
    : `Before any cost the pooled stream is near zero (gross ${f3(Q.dec.gross)}R a trade on 2016-now, ${f3(Q.rep.gross)}R on 2009-15); financing on the two legs takes ${f3(Q.dec.fin)}R and the spreads ${f3(Q.dec.spread)}R a trade. ` + 'The rule does not clear the pre-registered bar: following a 2-sd stretch of these non-US index spreads, with a stop at the 60-day mean, a target at 4 sd and 20 days at most, is not an edge after both legs\' spreads and financing on this data. It is not a council rule, no proposal is written and nothing live changed. Never call it an edge; another threshold, window, hedge ratio, stop or exit would need its own pre-registration on other data. The US pairs of `index-pair` stay untested for this direction on purpose.');
  L.push('', 'Stated limits: the stop is checked at the open and the close only (two prices of the spread a day), so a stop exit fills beyond the z = 0 level and can lose more than 1R, and the target is checked at the close only; the stop level moves with the trade\'s rolling 60-day mean while 1R is fixed at the signal; spreads are stated, not measured, and no slippage or commission is added; policy rates are approximate yearly means (the euro, sterling and yen figures copied from `turnaround-replicate`, the Australian ones added here), JP225 is financed at the yen rate although OANDA quotes the CFD in US dollars; currency moves on each leg\'s open profit are ignored; financing uses the repository\'s `nights` count (Wednesday three).', '');
  L.push('To repeat: `node research/edge/index-spread-momentum/run.mjs fetch <dir>` (git show from origin/council-data, no network; candles kept out of git), then `node research/edge/index-spread-momentum/run.mjs full <dir>`. Tests: `tests/index-spread-momentum.test.mjs`.', '');
  return L.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir || !['fetch', 'full'].includes(cmd)) { console.error('usage: run.mjs fetch|full <dir>'); process.exit(2); }
  const show = (p) => execFileSync('git', ['show', `origin/council-data:${p}`], { cwd: path.join(HERE, '../../..'), maxBuffer: 64 << 20 });
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of FILES) { fs.writeFileSync(path.join(dir, `${k}.json`), show(`research/daily/${k}.json`)); console.log('saved', k); }
  } else {
    const files = {};
    for (const k of FILES) files[k] = JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8'));
    const rates = JSON.parse(fs.readFileSync(path.join(HERE, 'rates.json'), 'utf8'));
    const res = evaluate(files, rates);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
    console.log(res.verdict); console.log('pooled', JSON.stringify(res.pooled));
    for (const x of res.pairs) console.log(x.id, JSON.stringify(x.dec), 'rep', JSON.stringify(x.rep), 'pl', JSON.stringify(x.placebo));
  }
}
