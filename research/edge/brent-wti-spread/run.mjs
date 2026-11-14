// Brent - WTI crude spread: log-spread z-score mean reversion on daily candles
// (research/edge/brent-wti-spread/PREREGISTRATION.md, committed first). Research only: nothing here is read by the council, the
// mirror or any page; no order code.
//   node research/edge/brent-wti-spread/run.mjs fetch <dir>   copies council-data research/daily/{bco,wtico}.json into <dir>
//                                                             (outside git); git show origin/council-data, no network
//   node research/edge/brent-wti-spread/run.mjs full <dir>    writes result.json and RESULT.md next to this file
// The month-sum t, the placebo seeding and the report layout are copied from research/edge/index-pair/run.mjs (another branch,
// not imported).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- the pre-registered constants ----
export const P = { zN: 60, zIn: 2, zOut: 0.5, stopSd: 1.5, hold: 20, gapMax: 0.05 };
export const VARIANT = { id: 'V1', zIn: 1.5 };
export const COST = { sprPerLeg: 0.0006, finYear: 0.03, legs: 2 }; // round trip 0.06 % a leg; 3 % a year on each leg, a cost
export const WINDOWS = { rep: { from: null, to: '2016-01-01' }, dec: { from: '2016-01-01', to: null }, glut: { from: '2011-01-01', to: '2014-01-01' } };
export const BAR = { minT: 2, minN: 40, placeboPct: 0.95 };
export const PLACEBO = { draws: 40, seed: 20261114 };
export const FILES = ['bco', 'wtico'];

const day = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
const r4 = (x) => (Number.isFinite(x) ? Math.round(x * 10000) / 10000 : null);

// candle file rows [t, o, h, l, c, v] -> trading-day bars (weekend stubs folded into the next weekday)
export function barsOf(file) {
  return foldWeekend(file.rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })));
}
// Brent and WTI joined on the day's time: only days both have. b* = Brent, w* = WTI
export function join(brent, wti) {
  const m = new Map(wti.map((x) => [x.time, x]));
  const out = [];
  for (const x of brent) { const y = m.get(x.time); if (y) out.push({ time: x.time, bo: x.open, bc: x.close, wo: y.open, wc: y.close }); }
  return out;
}
export const spreadC = (J, k) => Math.log(J[k].bc) - Math.log(J[k].wc);
export const spreadO = (J, k) => Math.log(J[k].bo) - Math.log(J[k].wo);
// z at every close i from the zN closes i-zN+1 .. i only: { mean, sd, z } or null
export function zScores(J, N = P.zN) {
  const s = J.map((_, k) => spreadC(J, k)), out = new Array(J.length).fill(null);
  for (let i = N - 1; i < J.length; i++) {
    let m = 0; for (let k = i - N + 1; k <= i; k++) m += s[k]; m /= N;
    let v = 0; for (let k = i - N + 1; k <= i; k++) v += (s[k] - m) ** 2;
    const sd = Math.sqrt(v / (N - 1));
    out[i] = { mean: m, sd, z: sd > 0 ? (s[i] - m) / sd : null };
  }
  return out;
}
// one-leg gap on joined day j: one leg's overnight log gap over gapMax, the other's at most gapMax
export function oneLegGap(J, j, max = P.gapMax) {
  if (j < 1) return false;
  const gb = Math.abs(Math.log(J[j].bo / J[j - 1].bc)), gw = Math.abs(Math.log(J[j].wo / J[j - 1].wc));
  return (gb > max) !== (gw > max);
}

// one trade from a signal at close i, dir +1 long spread (buy Brent, sell WTI) / -1 short spread.
// null when the data ends first. A trade with a one-leg gap in its hold carries dropped: true.
export function tradeFrom(J, Z, i, dir) {
  const s = Z[i], e = i + 1;
  if (!s || !(s.sd > 0) || e >= J.length) return null;
  const entry = spreadO(J, e), risk = P.stopSd * s.sd, stop = entry - dir * risk;
  for (let j = e; j < J.length; j++) {
    const sc = spreadC(J, j);
    let why = null;
    if (dir * (sc - entry) <= -risk) why = 'stop';
    else if (Z[j] && Z[j].z != null && Math.abs(Z[j].z) < P.zOut) why = 'mean';
    else if (j - e + 1 >= P.hold) why = 'time';
    if (why) {
      const gaps = []; for (let k = e + 1; k <= j; k++) if (oneLegGap(J, k)) gaps.push(iso(J[k].time));
      return {
        sig: i, e, x: j, dir, zSig: s.z, sd: s.sd, entry, stop, risk, exit: sc, why, opened: J[e].time, closed: J[j].time + 86400,
        R: dir * (sc - entry) / risk, dropped: gaps.length > 0, gaps,
      };
    }
  }
  return null;
}

// costs of one trade in R at a cost multiple: { spr, fin, total }
export function costOf(t, mult = 1) {
  const spr = COST.sprPerLeg * COST.legs * mult, fin = nights(t.opened, t.closed) * COST.legs * COST.finYear / 365 * mult;
  return { spr: spr / t.risk, fin: fin / t.risk, total: (spr + fin) / t.risk };
}

// every trade, one position at a time (a new signal only from a close after the exit close); dropped trades kept, flagged
export function simulate(J, Z, zIn = P.zIn) {
  const out = [];
  for (let i = 0; i < J.length - 1; i++) {
    if (!Z[i] || Z[i].z == null) continue;
    const z = Z[i].z, dir = z > zIn ? -1 : z < -zIn ? 1 : 0; if (!dir) continue;
    const t = tradeFrom(J, Z, i, dir); if (!t) break;
    out.push(t); i = t.x; // the loop's i++ moves to the close after the exit close
  }
  return out;
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

// statistics of the kept trades entered in [fromT, toT); months from fromT to toT (exclusive)
export function stats(trades, fromT, toT, mult = 1) {
  const ts = trades.filter((t) => !t.dropped && t.opened >= fromT && t.opened < toT);
  const cs = ts.map((t) => costOf(t, mult)), net = ts.map((t, k) => t.R - cs[k].total), n = ts.length;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const months = monthsBetween(fromT, toT), byM = Object.fromEntries(months.map((m) => [m, 0]));
  ts.forEach((t, k) => { const m = monthOf(t.closed); byM[m] = (byM[m] || 0) + net[k]; });
  const mt = tStat(Object.values(byM));
  let cum = 0, hi = 0, dd = 0; for (const x of net) { cum += x; hi = Math.max(hi, cum); dd = Math.min(dd, cum - hi); }
  const win = net.filter((x) => x > 0), loss = net.filter((x) => x <= 0);
  const why = {}; for (const t of ts) why[t.why] = (why[t.why] || 0) + 1;
  return {
    n, avg: n ? r3(sum(net) / n) : null, gross: n ? r3(sum(ts.map((t) => t.R)) / n) : null,
    spread: n ? r3(sum(cs.map((c) => c.spr)) / n) : null, fin: n ? r3(sum(cs.map((c) => c.fin)) / n) : null,
    total: r2(sum(net)), wr: n ? r2(win.length / n * 100) : null, pf: loss.length && sum(loss) < 0 ? r2(sum(win) / -sum(loss)) : null,
    months: Object.keys(byM).length, monthT: r2(mt), dd: r2(dd), exits: why,
    sides: { long: ts.filter((t) => t.dir > 0).length, short: ts.filter((t) => t.dir < 0).length },
    worstR: n ? r3(Math.min(...net)) : null, riskPct: n ? r3([...ts.map((t) => t.risk)].sort((a, b) => a - b)[Math.floor(n / 2)] * 100) : null,
  };
}
export function perYear(trades, fromT, toT) {
  const out = [];
  for (let y = new Date(fromT * 1000).getUTCFullYear(); y <= new Date((toT - 1) * 1000).getUTCFullYear(); y++) {
    const a = Math.max(fromT, day(`${y}-01-01`)), b = Math.min(toT, day(`${y + 1}-01-01`)), s = stats(trades, a, b);
    out.push({ year: y, n: s.n, gross: s.gross, avg: s.avg, total: s.total });
  }
  return out;
}

// seeded random numbers
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// random entries: per calendar year as many as the real kept trades entered that year, random side, the same exits and costs
export function placebo(J, Z, real, fromT, toT, { draws = PLACEBO.draws, seed = PLACEBO.seed } = {}) {
  const perY = {}; for (const t of real) { const y = new Date(t.opened * 1000).getUTCFullYear(); perY[y] = (perY[y] || 0) + 1; }
  const pool = {};
  for (let i = 0; i < J.length - 1; i++) {
    if (!Z[i] || Z[i].z == null || J[i + 1].time < fromT || J[i + 1].time >= toT) continue;
    const y = new Date(J[i].time * 1000).getUTCFullYear(); (pool[y] ||= []).push(i);
  }
  const out = [];
  for (let d = 0; d < draws; d++) {
    const rnd = mulberry32(seed + d);
    let s = 0, k = 0, need = 0;
    for (const [y, n] of Object.entries(perY)) {
      const ok = pool[y] || []; need += n; let got = 0, tries = 0;
      while (got < n && ok.length && tries < n * 50) {
        tries++;
        const i = ok[Math.floor(rnd() * ok.length)], dir = rnd() < 0.5 ? 1 : -1, t = tradeFrom(J, Z, i, dir);
        if (!t || t.dropped) continue;
        s += t.R - costOf(t).total; got++; k++;
      }
    }
    out.push(k === need && k ? s / k : null);
  }
  return out;
}
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };

function block(J, Z, zIn, withPlacebo) {
  const end = J.at(-1).time + 86400, start = J[P.zN].time;
  const rep = [start, day(WINDOWS.rep.to)], dec = [day(WINDOWS.dec.from), end], glut = [day(WINDOWS.glut.from), day(WINDOWS.glut.to)];
  const trades = simulate(J, Z, zIn);
  const dec1 = stats(trades, ...dec), rep1 = stats(trades, ...rep);
  const out = {
    zIn, dec: dec1, rep: rep1, glut: stats(trades, ...glut),
    repExGlut: (() => { // replication without 2011-13 (reported only)
      const ts = trades.filter((t) => !(t.opened >= glut[0] && t.opened < glut[1])); return stats(ts, ...rep);
    })(),
    costs: Object.fromEntries([0, 1, 2].map((m) => [`x${m}`, { dec: stats(trades, ...dec, m), rep: stats(trades, ...rep, m) }])),
    years: perYear(trades, rep[0], end),
    dropped: trades.filter((t) => t.dropped).map((t) => ({ opened: iso(t.opened), closed: iso(t.closed - 86400), dir: t.dir, grossR: r3(t.R), gaps: t.gaps })),
  };
  if (withPlacebo) {
    const realDec = trades.filter((t) => !t.dropped && t.opened >= dec[0] && t.opened < dec[1]);
    const pl = placebo(J, Z, realDec, ...dec).filter((x) => x != null);
    out.placebo = { draws: pl.length, median: r3(pct(pl, 0.5)), p5: r3(pct(pl, 0.05)), p95: r3(pct(pl, BAR.placeboPct)), atLeastReal: pl.filter((x) => x >= dec1.avg).length };
  }
  return out;
}

// the whole study on loaded files { bco, wtico }
export function evaluate(files) {
  const J = join(barsOf(files.bco), barsOf(files.wtico)), Z = zScores(J);
  const base = block(J, Z, P.zIn, true), v1 = block(J, Z, VARIANT.zIn, false);
  const checks = {
    netPositiveDec: base.dec.avg != null && base.dec.avg > 0,
    netPositiveRep: base.rep.avg != null && base.rep.avg > 0,
    tAtLeast2: base.dec.monthT != null && base.dec.monthT >= BAR.minT,
    nAtLeast40: base.dec.n >= BAR.minN,
    aboveRandom: base.placebo.p95 != null && base.dec.avg > base.placebo.p95,
  };
  const pass = Object.values(checks).every(Boolean);
  return {
    study: 'brent-wti-spread', title: 'Brent - WTI crude spread: log-spread z-score mean reversion', built: '2026-11-14', preregistration: 'PREREGISTRATION.md',
    system: 'Brent / WTI spread reversion (not a council system)',
    verdict: pass ? 'PASS: fading a 2-sd stretch of the Brent - WTI spread cleared the pre-registered bar'
      : 'FAIL: fading a 2-sd stretch of the Brent - WTI spread is not an edge after costs',
    data: { src: 'OANDA mid daily BCO_USD (Brent) and WTICO_USD (WTI), council-data research/daily/bco.json, wtico.json', days: J.length, from: iso(J[0].time), to: iso(J.at(-1).time), oneLegGapDays: J.reduce((a, _, j) => a + (oneLegGap(J, j) ? 1 : 0), 0) },
    params: P, variant: VARIANT, costs: COST, windows: WINDOWS, bar: BAR, placeboSpec: PLACEBO,
    base, v1, checks, pass,
  };
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '') + x.toFixed(3));
const f2 = (x) => (x == null ? 'n/a' : x.toFixed(2));
const row = (name, s) => `| ${name} | ${s.n} | ${f3(s.gross)} | ${f3(s.spread)} | ${f3(s.fin)} | ${f3(s.avg)} | ${f2(s.total)} | ${f2(s.wr)} | ${f2(s.pf)} | ${f2(s.monthT)} | ${f2(s.dd)}R |`;
const HEAD = ['| Window | n | Gross R a trade | Spread cost | Financing | Net R a trade | Net total | Win % | PF | Month-sum t | Worst drawdown |', '|---|---|---|---|---|---|---|---|---|---|---|'];
export function report(res) {
  const B = res.base, V = res.v1, c = res.checks, L = [];
  L.push('# Result: Brent - WTI crude spread, log-spread z-score mean reversion (14 Nov 2026)', '');
  L.push(`**Verdict: ${res.verdict}.** Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed alone and pushed first). Entry |z| > 2: ${f3(B.dec.avg)}R a trade net on 2016-now (n ${B.dec.n}, month-sum t ${f2(B.dec.monthT)}), ${f3(B.rep.avg)}R on ${res.data.from.slice(0, 4)}-2015 (n ${B.rep.n}). Nothing live changed.`, '');
  L.push(`Data: ${res.data.src}; weekend stubs folded with \`foldWeekend\`, legs joined on common days (${res.data.days} days, ${res.data.from} to ${res.data.to}). Rule: s = ln(Brent) - ln(WTI) on daily closes, z over the last 60 closes; z > 2 shorts the spread (sell Brent, buy WTI), z < -2 buys it, equal notional, at the next open; stop when the spread moves a further 1.5 x the signal's 60-day sd against the entry (1R; checked on closes), exit at |z| < 0.5 or at the close of the 20th day; one position at a time. Costs (assumed, not measured): a round trip of 0.06 % of price on each leg and financing of 3 % a year on each leg as a cost, per rollover night.`, '');
  L.push('## The pre-registered rule (entry |z| > 2), base costs', '', ...HEAD);
  L.push(row('2016-now (decisive)', B.dec), row(`${res.data.from.slice(0, 4)}-2015 (replication)`, B.rep), row('of which 2011-13 (Cushing glut, a known break)', B.glut), row('replication without 2011-13 (reported only)', B.repExGlut));
  L.push('', '## Against the bar', '');
  L.push(`- Net R a trade > 0 on 2016-now: ${c.netPositiveDec ? 'yes' : 'no'} (${f3(B.dec.avg)}).`);
  L.push(`- Net R a trade > 0 on the replication window: ${c.netPositiveRep ? 'yes' : 'no'} (${f3(B.rep.avg)}).`);
  L.push(`- Month-sum t >= 2 on 2016-now: ${c.tAtLeast2 ? 'yes' : 'no'} (${f2(B.dec.monthT)}).`);
  L.push(`- n >= 40 on 2016-now: ${c.nAtLeast40 ? 'yes' : 'no'} (${B.dec.n}).`);
  L.push(`- Above the placebo's 95th percentile: ${c.aboveRandom ? 'yes' : 'no'} (${f3(B.placebo.p95)}).`);
  L.push('', '## Placebo: random entry days (same count per year), random side, the same exits and costs (2016-now, 40 seeded draws)', '');
  L.push('| Real net R a trade | Draws median | 5th pct | 95th pct | Draws >= real |', '|---|---|---|---|---|');
  L.push(`| ${f3(B.dec.avg)} | ${f3(B.placebo.median)} | ${f3(B.placebo.p5)} | ${f3(B.placebo.p95)} | ${B.placebo.atLeastReal} of ${B.placebo.draws} |`);
  L.push('', '## Cost sensitivity (net R a trade, month-sum t)', '', '| Costs | 2016-now n | Net R | t | Replication n | Net R | t |', '|---|---|---|---|---|---|---|');
  for (const [k, lab] of [['x0', '0 x (gross)'], ['x1', '1 x (base)'], ['x2', '2 x']]) {
    const s = B.costs[k]; L.push(`| ${lab} | ${s.dec.n} | ${f3(s.dec.avg)} | ${f2(s.dec.monthT)} | ${s.rep.n} | ${f3(s.rep.avg)} | ${f2(s.rep.monthT)} |`);
  }
  L.push('', '## Per year (entry year, base costs)', '', '| Year | n | Gross R a trade | Net R a trade | Net total |', '|---|---|---|---|---|');
  for (const y of B.years) L.push(`| ${y.year} | ${y.n} | ${f3(y.gross)} | ${f3(y.avg)} | ${f2(y.total)} |`);
  L.push('', '## Contract rolls and one-leg gaps', '');
  L.push(`The candles are used as quoted, not back-adjusted (the cache carries no roll dates or adjustments). A one-leg gap = one leg's overnight log gap over 5 % while the other's is at most 5 %: ${res.data.oneLegGapDays} such days in the whole joined history. A trade whose hold (the day after entry to the exit day) contains one is dropped from every statistic and still holds the position until its exit. Dropped, entry |z| > 2: ${B.dropped.length}${B.dropped.length ? ' (' + B.dropped.map((d) => `${d.opened} to ${d.closed}, ${d.dir > 0 ? 'long' : 'short'} spread, gross ${f3(d.grossR)}R, gap on ${d.gaps.join(', ')}`).join('; ') + ')' : ''}. Variant V1: ${V.dropped.length}. Smaller roll steps stay in the data unadjusted (a stated limit).`);
  L.push('', '## Variant V1, entry |z| > 1.5 (reported only, never judged)', '', ...HEAD);
  L.push(row('2016-now', V.dec), row('replication', V.rep), row('of which 2011-13', V.glut));
  L.push(`Cost sensitivity, 2016-now net R a trade: 0 x ${f3(V.costs.x0.dec.avg)}, 1 x ${f3(V.costs.x1.dec.avg)}, 2 x ${f3(V.costs.x2.dec.avg)}.`);
  L.push('', '## Also reported, not judged', '');
  for (const [lab, s] of [['2016-now', B.dec], ['replication', B.rep]]) {
    L.push(`- **${lab}**: exits ${Object.entries(s.exits).map(([k, n]) => `${k} ${n}`).join(', ')}; sides ${s.sides.short} short spread / ${s.sides.long} long spread; worst single trade ${f3(s.worstR)}R; 1R median ${f2(s.riskPct)} % of a leg's notional.`);
  }
  L.push('', '## What it means', '');
  L.push(res.pass
    ? 'The rule cleared the pre-registered bar on this data at the assumed costs. At most a proposal for a paper shadow, with the broker\'s real spread and financing measured first, for the owner to decide (`research/proposals/`); never a live change without the owner. A CFD backtest on two assumed cost figures is not a forward record.'
    : 'The rule does not clear the pre-registered bar: fading a 2-sd stretch of the Brent - WTI spread back toward its 60-day mean is not a tradeable edge on this data at the assumed costs. It is not a council rule, no proposal is written and nothing live changed. Never call it an edge; another threshold, window, hedge ratio, stop or exit would need its own pre-registration on other data (the |z| > 1.5 variant above is reported only and is not a candidate). It does not say the two crudes are not linked: it says this daily z-score fade, with these exits and costs, does not pay.');
  L.push('', `Before any cost the decisive window makes ${f3(B.costs.x0.dec.avg)}R a trade (month-sum t ${f2(B.costs.x0.dec.monthT)}) and the replication window ${f3(B.costs.x0.rep.avg)}R (t ${f2(B.costs.x0.rep.monthT)}); the assumed costs take ${f3(B.dec.spread + B.dec.fin)}R a trade on 2016-now, because 1R (1.5 x the 60-day sd of the spread, median ${f2(B.dec.riskPct)} % of a leg) is small next to two legs' spread and financing. The real figure is near the placebo's middle (${B.placebo.atLeastReal} of ${B.placebo.draws} random draws match or beat it): the z-score entry adds little over a random entry with the same exits. The 2011-13 Cushing glut is the worst stretch (${f3(B.glut.avg)}R a trade, n ${B.glut.n}), as the pre-registration expected of a break; without it the replication window is still negative after costs (${f3(B.repExGlut.avg)}R).`);
  L.push('', 'Stated limits: the stop is checked on daily closes only (two prices of the spread a day), so a stop exit fills beyond its level and can lose more than 1R; the spread (0.06 % a leg) and the financing (3 % a year a leg) are assumptions, not measurements; the candles are not back-adjusted for contract rolls and only gaps over 5 % on one leg are caught; R uses log returns of the legs at equal notional.', '');
  L.push('To repeat: `node research/edge/brent-wti-spread/run.mjs fetch <dir>` (git show from origin/council-data, no network; candles kept out of git), then `node research/edge/brent-wti-spread/run.mjs full <dir>`. Tests: `tests/brent-wti-spread.test.mjs`.', '');
  return L.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir || !['fetch', 'full'].includes(cmd)) { console.error('usage: run.mjs fetch|full <dir>'); process.exit(2); }
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of FILES) {
      fs.writeFileSync(path.join(dir, `${k}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { cwd: path.join(HERE, '../../..'), maxBuffer: 64 << 20 }));
      console.log('saved', k);
    }
  } else {
    const files = {};
    for (const k of FILES) files[k] = JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8'));
    const res = evaluate(files);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
    console.log(res.verdict, JSON.stringify(res.checks));
    console.log('dec', JSON.stringify(res.base.dec)); console.log('rep', JSON.stringify(res.base.rep)); console.log('pl', JSON.stringify(res.base.placebo));
  }
}
