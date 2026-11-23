// research/edge/fade-hour-check/run.mjs - is the 20-23 UTC fade a quote effect? (PREREGISTRATION.md, 23 Nov 2026)
// grid7-wide-fade's cell `m15 none atr 2R all` (fade-conditions R1), by its own code (imported, never edited), split by hour of
// the break candle on OANDA mid and on HistData; the rollover hours excluded; spike candles; indices; the move to target
// against the demo's measured hourly spread. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/fade-hour-check/run.mjs oanda <m> <outDir>     OANDA 2005-2026 (also the indices)
//   EDGE_DATA=<cache> node research/edge/fade-hour-check/run.mjs hist <m> <outDir>      HistData M1 -> 5m, 2018-02 .. 2026-10
//   node research/edge/fade-hour-check/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-wide-core/run.mjs';
import { signals, exits, CAP } from '../grid7-wide-fade/run.mjs';
import { histM5, B_FROM, BM0 } from '../fade-new-markets/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');
export const HIST_MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad', 'usdchf'];
export const INDICES = ['nas100', 'spx500', 'de40'];
export const SPREAD_FILES = { xau: ['0459ec37e', 'research/probe/ticks-XAUUSD.json'], xag: [null, 'research/probe/ticks-XAGUSD.json'],
  nas100: [null, 'research/probe/ticks-NAS100.json'], spx500: [null, 'research/probe/ticks-US500.json'] };
export const GOLD_COMM = 0.000024;            // gold commission, round trip, share of price (CLAUDE.md, tick probe)
export const P5_FROM = Date.UTC(2025, 0, 1) / 1000;
export const ROLL = [21, 22];                 // the rollover hours 21:00-22:59 UTC
const HOUR = (t) => new Date(t * 1000).getUTCHours();

// ---- spike ratio: range of each M15 candle / median range of the 20 previous candles of the same time of day (closed only)
export function spikeRatios(T) {
  const slots = new Map(), out = new Float64Array(T.length).fill(NaN);
  for (let j = 0; j < T.length; j++) {
    const b = T[j], s = Math.floor((b.t % 86400) / 900); let buf = slots.get(s); if (!buf) slots.set(s, (buf = []));
    if (buf.length >= 20) { const v = [...buf].sort((x, y) => x - y); const med = (v[9] + v[10]) / 2; if (med > 0) out[j] = (b.h - b.l) / med; }
    buf.push(b.h - b.l); if (buf.length > 20) buf.shift();
  }
  return out;
}
export const spikeBucket = (r) => (!Number.isFinite(r) ? -1 : r < 1 ? 0 : r < 2 ? 1 : 2);

// the exit time of the 2R target trade, scanning exactly as grid7-wide-fade `exits` (checked against its R)
export function exitOf(M5, s, fi, stop, tgt, cap) {
  const fill = M5[fi].o, risk = s * (fill - stop), dl = M5[fi].t + cap;
  for (let j = fi; j < M5.length; j++) { const b = M5[j];
    if (j > fi) { if (s * (b.o - stop) <= 0) return { R: (s * (b.o - fill)) / risk, e: b.t }; if (s * (b.o - tgt) >= 0) return { R: (s * (b.o - fill)) / risk, e: b.t }; }
    const low = s > 0 ? b.l : b.h, high = s > 0 ? b.h : b.l;
    if (s * (low - stop) <= 0) return { R: (s * (stop - fill)) / risk, e: b.e };
    if (s * (high - tgt) >= 0) return { R: (s * (tgt - fill)) / risk, e: b.e };
    if (b.e >= dl) return { R: (s * (b.c - fill)) / risk, e: b.e };
  }
  return null;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

// one 5-minute series -> trades [fillT, hour, R, costR, exitT, spikeRatio, risk, fill]; fade-conditions' R1 loop
export function runSeries(M5, { market, cost = COSTS[market], X = [], from = FROM, to = TO }) {
  const F = frames(M5), T = F['15m'], sp = spikeRatios(T), out = [];
  let dropped = 0, bad = 0, small = 0, open = 0, mism = 0;
  for (const g of signals(F)) {
    if (g.cx !== 0 || g.tf !== 1) continue;
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < from || t >= to) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const fill = M5[fi].o, s = -g.d, cap = CAP['15m'], stop = fill + g.d * g.a, risk = s * (fill - stop);
    if (!(risk > 0)) { bad++; continue; }
    if (risk < cost) { small++; continue; }
    if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
    const sr = g.opp == null ? NaN : (s * (g.opp - fill)) / risk; const ks = [1, 2, sr > 0 ? sr : NaN];
    const r = exits(M5, s, fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), cap);
    const p = exits(M5, -s, fi, fill + s * risk, ks.map((k) => (Number.isFinite(k) ? fill - s * k * risk : NaN)), cap);
    if (!r || !p) { open++; continue; }
    const x = exitOf(M5, s, fi, stop, fill + s * 2 * risk, cap);
    if (!x || Math.abs(x.R - r.R[1]) > 1e-9) mism++;
    out.push([t, HOUR(T[g.j].t), +r.R[1].toFixed(6), +(cost / risk).toPrecision(6), x ? x.e : t, +sp[g.j].toFixed(4), +risk.toPrecision(6), fill]);
  }
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    candles: M5.length, dropped, bad, small, open, mism, trades: out };
}

// ---- statistics on trade lists --------------------------------------------------------------------------------------
// window [ma, mb) in month indices (grid7-wide-core monthOf: 2005-01 = 0); month sums with empty months counted as 0
export function stats(trades, ma, mb) {
  const ms = new Float64Array(NM), mn = new Float64Array(NM); let n = 0, s = 0, q = 0, net = 0, cr = 0, win = 0;
  for (const x of trades) { const m = monthOf(x[0]); if (m < ma || m >= mb) continue; n++; s += x[2]; q += x[2] * x[2]; net += x[2] - x[3]; cr += x[3]; if (x[2] > 0) win++;
    ms[m] += x[2]; mn[m] += x[2] - x[3]; }
  const t = n ? mstat(ms, ma, mb).t : null, tNet = n ? mstat(mn, ma, mb).t : null;
  return { n, sum: s, sq: q, mean: n ? s / n : null, t, meanNet: n ? net / n : null, tNet, costR: n ? cr / n : null, win: n ? win / n : null, months: mb - ma };
}
export function welchDf(a, b) {
  if (a.n < 2 || b.n < 2) return { t: null, df: null }; const ma = a.sum / a.n, mb = b.sum / b.n;
  const va = (a.sq - a.n * ma * ma) / (a.n - 1), vb = (b.sq - b.n * mb * mb) / (b.n - 1), qa = va / a.n, qb = vb / b.n, se = Math.sqrt(qa + qb);
  return se > 0 ? { t: (ma - mb) / se, df: (qa + qb) ** 2 / (qa * qa / (a.n - 1) + qb * qb / (b.n - 1)) } : { t: null, df: null };
}
export const inRoll = (t) => ROLL.includes(HOUR(t));
// the block without the rollover: break hour 20 or 23 and fill outside 21:00-22:59
export const blockNoRoll = (x) => (x[1] === 20 || x[1] === 23) && !inRoll(x[0]);
export const block2023 = (x) => x[1] >= 20;
export const block0811 = (x) => x[1] >= 8 && x[1] <= 11;
// open at any moment between 21:00 and 22:59 UTC (fill to exit crosses or touches a rollover window)
export function overRoll(x) {
  const a = x[0], b = x[4]; if (inRoll(a) || inRoll(b)) return true;
  const d0 = Math.floor(a / 86400) * 86400; for (let d = d0; d <= b; d += 86400) { const w0 = d + 21 * 3600, w1 = d + 23 * 3600; if (a < w1 && b >= w0) return true; }
  return false;
}

// ---- report ---------------------------------------------------------------------------------------------------------
const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2));
const N = (x) => Math.round(x).toLocaleString('en-US'), day = (t) => (t == null ? 'n/a' : new Date(t * 1000).toISOString().slice(0, 10));
const r6 = (x) => (x == null ? null : +x.toFixed(6));
const slim = (w) => ({ n: w.n, mean: r6(w.mean), t: w.t == null ? null : +w.t.toFixed(3), meanNet: r6(w.meanNet), tNet: w.tNet == null ? null : +w.tNet.toFixed(2),
  win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });
const read = (dir, f) => (fs.existsSync(path.join(dir, f)) ? JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) : null);
const W = { d: [0, DM], c: [DM, NM], h: [BM0, NM] };
const all = (list, f = () => true) => list.flatMap((d) => d.trades.filter(f));

export function hourProfile(market) {
  const [ver, file] = SPREAD_FILES[market];
  try { const j = JSON.parse(execFileSync('git', ['show', `${ver || 'origin/council-data'}:${file}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }));
    const hp = (j.hourProfile || []).filter((h) => h.n > 0); return hp.length ? { at: j.at, rows: hp.map((h) => ({ hour: h.hour, n: h.n, median: h.median })) } : null; }
  catch { return null; }
}
const median = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

export function report(dir) {
  const O = MARKETS.map((m) => read(dir, `O-${m}.json`)).filter((d) => d && d.candles > 0);
  const H = HIST_MARKETS.map((m) => read(dir, `H-${m}.json`)).filter((d) => d && d.candles > 0);
  const I = INDICES.map((m) => read(dir, `O-${m}.json`)).filter((d) => d && d.candles > 0);
  // gate
  const g7 = JSON.parse(fs.readFileSync(path.join(HERE, '../grid7-wide-fade/result.json'), 'utf8')).cells.find((x) => x.cell === 'm15 none atr 2R all');
  const fc = JSON.parse(fs.readFileSync(path.join(HERE, '../fade-conditions/result.json'), 'utf8')).levels.find((x) => x.rule.startsWith('m15') && x.split === 'hour').levels.find((l) => l.level === '20-23');
  const gD = stats(all(O), ...W.d), gC = stats(all(O), ...W.c), gB = stats(all(O, block2023), ...W.c);
  const gate = [
    { what: 'grid7-wide-fade m15 none atr 2R all, 2005-14', want: { n: g7.disc.n, mean: g7.disc.mean }, got: { n: gD.n, mean: r6(gD.mean) } },
    { what: 'grid7-wide-fade m15 none atr 2R all, 2015-26', want: { n: g7.conf.n, mean: g7.conf.mean }, got: { n: gC.n, mean: r6(gC.mean) } },
    { what: 'fade-conditions 20-23 block, 2015-26', want: { n: fc.conf.n, mean: fc.conf.mean }, got: { n: gB.n, mean: r6(gB.mean) } },
  ].map((x) => ({ ...x, ok: x.want.n === x.got.n && Math.abs(x.want.mean - x.got.mean) < 0.0005 }));
  const gateOk = gate.every((x) => x.ok), mism = [...O, ...H, ...I].reduce((a, d) => a + d.mism, 0);

  // primary tests
  const P = [];
  const s1 = stats(all(O, blockNoRoll), ...W.d), s2 = stats(all(O, blockNoRoll), ...W.c), s3 = stats(all(H, blockNoRoll), ...W.h);
  for (const [key, what, s] of [['P1', 'OANDA 2005-14: 20 and 23 UTC, rollover fills excluded', s1], ['P2', 'OANDA 2015-26: the same', s2], ['P3', 'HistData 2018-02..2026-10: the same', s3]])
    P.push({ key, what, n: s.n, mean: r6(s.mean), t: s.t == null ? null : +s.t.toFixed(3), meanNet: r6(s.meanNet), tNet: s.tNet == null ? null : +s.tNet.toFixed(2), p: s.t == null ? 1 : p1(s.t, s.months - 1), cond: s.mean > 0 && s.t >= 2 });
  const hb = stats(all(H, block2023), ...W.h), hw = stats(all(H, block0811), ...W.h), wd = welchDf(hb, hw);
  P.push({ key: 'P4', what: 'HistData: 20-23 block minus 08-11 block (Welch, per trade)', n: hb.n, n2: hw.n, mean: r6(hb.mean - hw.mean), t: wd.t == null ? null : +wd.t.toFixed(3),
    meanNet: r6(hb.meanNet - hw.meanNet), p: wd.t == null ? 1 : p1(wd.t, wd.df), cond: hb.mean - hw.mean > 0 && wd.t >= 2 });
  const holm = K.holm(P.map((x) => x.p)); P.forEach((x, i) => { x.holm = +holm[i].toPrecision(4); x.p = +x.p.toPrecision(4); x.pass = x.cond && holm[i] < 0.05; });
  const verdict = !gateOk || O.length < 8 || H.length < 6 ? 'INCONCLUSIVE' : P.every((x) => x.pass) ? 'PASS' : 'FAIL';

  // (1) every hour, OANDA; (2) HistData and OANDA same markets / window
  const hourRows = (list, wins) => Array.from({ length: 24 }, (_, h) => ({ hour: h, ...Object.fromEntries(wins.map(([k, a, b]) => [k, slim(stats(all(list, (x) => x[1] === h), a, b))])) }));
  const hoursO = hourRows(O, [['d', ...W.d], ['c', ...W.c]]);
  const Osame = O.filter((d) => HIST_MARKETS.includes(d.market));
  const hoursH = hourRows(H, [['h', ...W.h]]).map((r, h) => ({ ...r, o: slim(stats(all(Osame, (x) => x[1] === h), ...W.h)) }));
  const cuts = [['whole fade', () => true], ['whole fade, rollover fills excluded', (x) => !inRoll(x[0])], ['whole fade, never open 21:00-22:59', (x) => !overRoll(x)],
    ['20-23 block', block2023], ['20-23 block, rollover fills excluded', (x) => block2023(x) && !inRoll(x[0])], ['20 and 23 only, rollover fills excluded (P1-P3)', blockNoRoll],
    ['20-23 block, never open 21:00-22:59', (x) => block2023(x) && !overRoll(x)], ['08-11 block', block0811]];
  const cutRows = cuts.map(([name, f]) => ({ name, d: slim(stats(all(O, f), ...W.d)), c: slim(stats(all(O, f), ...W.c)), h: slim(stats(all(H, f), ...W.h)) }));
  // (3) spike buckets
  const blocks = [['20-23', block2023], ['08-11', block0811], ['other', (x) => !block2023(x) && !block0811(x)]];
  const spike = blocks.flatMap(([bn, bf]) => ['< 1', '1-2', '>= 2'].map((ln, l) => ({ block: bn, bucket: ln,
    d: slim(stats(all(O, (x) => bf(x) && spikeBucket(x[5]) === l), ...W.d)), c: slim(stats(all(O, (x) => bf(x) && spikeBucket(x[5]) === l), ...W.c)),
    h: slim(stats(all(H, (x) => bf(x) && spikeBucket(x[5]) === l), ...W.h)) })));
  const spikeShare = blocks.map(([bn, bf]) => { const v = all(O, (x) => bf(x) && x[0] >= FROM); const k = v.filter((x) => spikeBucket(x[5]) === 2).length; return { block: bn, n: v.length, spikes: k, share: v.length ? +(k / v.length).toFixed(4) : null }; });
  // (4) indices by hour, from where the cache starts
  const idx = I.map((d) => ({ market: d.market, first: day(d.first), hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, d: slim(stats(d.trades.filter((x) => x[1] === h), ...W.d)), c: slim(stats(d.trades.filter((x) => x[1] === h), ...W.c)) })),
    block2023: slim(stats(d.trades.filter(block2023), ...W.c)), block0811: slim(stats(d.trades.filter(block0811), ...W.c)), all: slim(stats(d.trades, ...W.c)),
    block2023d: slim(stats(d.trades.filter(block2023), ...W.d)), block0811d: slim(stats(d.trades.filter(block0811), ...W.d)), alld: slim(stats(d.trades, ...W.d)) }));
  const idxPool = { block2023: slim(stats(all(I, block2023), ...W.c)), block0811: slim(stats(all(I, block0811), ...W.c)), all: slim(stats(all(I), ...W.c)),
    block2023d: slim(stats(all(I, block2023), ...W.d)), block0811d: slim(stats(all(I, block0811), ...W.d)), alld: slim(stats(all(I), ...W.d)) };
  // (5) move to target against the measured hourly spread (fill hour), trades filled 2025-01 .. 2026-10
  const spreads = {};
  for (const m of Object.keys(SPREAD_FILES)) {
    const hp = hourProfile(m), d = [...O, ...I].find((x) => x.market === m); if (!hp || !d) { spreads[m] = { measured: false }; continue; }
    const rows = hp.rows.map((r) => { const v = d.trades.filter((x) => x[0] >= P5_FROM && x[0] < TO && HOUR(x[0]) === r.hour); if (!v.length) return { hour: r.hour, n: 0, spread: r.median };
      const tg = median(v.map((x) => 2 * x[6])), comm = m === 'xau' ? GOLD_COMM : 0;
      const net = v.reduce((a, x) => a + x[2] - (r.median + comm * x[7]) / x[6], 0) / v.length, gross = v.reduce((a, x) => a + x[2], 0) / v.length;
      return { hour: r.hour, n: v.length, spreadDays: r.n, spread: r.median, target: +tg.toPrecision(5), ratio: +(tg / r.median).toFixed(1), costR: +(median(v.map((x) => (r.median + comm * x[7]) / x[6]))).toFixed(4),
        mean: r6(gross), meanAfterSpread: r6(net) }; });
    const sub = (f) => { const v = d.trades.filter((x) => x[0] >= P5_FROM && x[0] < TO && f(HOUR(x[0]))); const byH = new Map(hp.rows.map((r) => [r.hour, r.median]));
      const comm = m === 'xau' ? GOLD_COMM : 0; return { n: v.length, mean: r6(v.reduce((a, x) => a + x[2], 0) / (v.length || 1)),
        meanAfterSpread: r6(v.reduce((a, x) => a + x[2] - ((byH.get(HOUR(x[0])) ?? NaN) + comm * x[7]) / x[6], 0) / (v.length || 1)) }; };
    spreads[m] = { measured: true, at: hp.at, rows, fill2023: sub((h) => h >= 20), fill0811: sub((h) => h >= 8 && h <= 11) };
  }

  const nm = (x) => `${x.key} ${f3(x.mean)}R (n ${N(x.n)}${x.n2 ? ' vs ' + N(x.n2) : ''}, t ${f2(x.t)})`;
  const fail = P.filter((x) => !x.pass);
  const headline = verdict === 'INCONCLUSIVE' ? (gateOk ? 'too few markets loaded' : 'the gate did not reproduce grid7-wide-fade / fade-conditions; nothing judged')
    : verdict === 'PASS' ? `the 20-23 UTC fade holds without the rollover hours on both feeds: 20 and 23 UTC with rollover fills excluded ${f3(s2.mean)}R a trade in 2015-26 (n ${N(s2.n)}, month t ${f2(s2.t)}) and ${f3(s3.mean)}R on HistData (n ${N(s3.n)}, t ${f2(s3.t)}); before costs, ${f3(s2.meanNet)}R after costs in 2015-26`
      : `${fail.length} of 4 primary tests fail (${fail.map(nm).join('; ')})`;
  const out = { study: 'fade-hour-check', built: '2026-11-23', verdict, headline,
    basis: 'judged before costs (pre-registered); month-sum t for P1-P3, Welch t for P4, Holm over 4; after costs beside',
    rule: 'm15 none atr 2R all (grid7-wide-fade, imported)', windows: { d: '2005-01 .. 2014-12', c: '2015-01 .. 2026-10', h: 'HistData 2018-02 .. 2026-10' },
    markets: O.map((d) => d.market), histMarkets: H.map((d) => d.market), indices: I.map((d) => d.market), assumedCosts: ASSUMED,
    gate, exitCheckMismatches: mism, primary: P, cuts: cutRows, hoursOanda: hoursO, hoursHist: hoursH, spike, spikeShare, indices: idx, indicesPool: idxPool, spreads,
    meta: [...O.map((d) => ({ feed: 'oanda', ...metaOf(d) })), ...H.map((d) => ({ feed: 'hist', ...metaOf(d) })), ...I.map((d) => ({ feed: 'oanda', ...metaOf(d) }))] };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out));
  return out;
}
const metaOf = (d) => ({ market: d.market, first: day(d.first), last: day(d.last), trades: d.trades.length, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open, mism: d.mism });

function resultMd(o) {
  const L = [];
  const row = (w) => `${N(w.n)} | ${f3(w.mean)} (${f2(w.t)}) | ${f3(w.meanNet)}`;
  L.push('# Is the 20-23 UTC fade a quote effect? (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants. Not an edge: a before-cost reading of where a fade tilt sits.', '',
    '## What was run', '',
    '`grid7-wide-fade` cell `m15 none atr 2R all` by its own code (imported): fade the first M15 structure break at the next',
    '5-minute open, stop 1 x ATR(14) of M15 on the losing side, target 2R, out after a day. Hour = the UTC hour the break candle',
    `starts. OANDA mid on ${o.markets.join(', ')} (2005-26, data-quality exclusions); HistData M1 grouped to 5 minutes on`,
    `${o.histMarkets.join(', ')} (Feb 2018 to Oct 2026, its own clock and rollover handling). Costs beside: the demo figures;`,
    `**ASSUMED** for ${o.assumedCosts.join(', ')}. R before costs; "net" = after one flat round trip a market.`, '', '## Gate', '');
  for (const g of o.gate) L.push(`- ${g.what}: n ${N(g.got.n)} mean ${f3(g.got.mean)} (want n ${N(g.want.n)}, ${f3(g.want.mean)}): ${g.ok ? 'equal' : 'DIFFERS'}.`);
  L.push(`- Exit time scan against the grid's \`exits\`: ${o.exitCheckMismatches} trades differ in R.`, '', '## Primary tests', '',
    '| Test | What | n | R a trade (t) | after costs | Holm p | Pass |', '|---|---|---:|---:|---:|---:|---|');
  for (const x of o.primary) L.push(`| ${x.key} | ${x.what} | ${N(x.n)}${x.n2 ? ' vs ' + N(x.n2) : ''} | ${f3(x.mean)} (${f2(x.t)}) | ${f3(x.meanNet)} | ${x.holm < 0.001 ? x.holm.toExponential(1) : x.holm.toFixed(3)} | ${x.pass ? 'yes' : 'no'} |`);
  L.push('', 'P1-P3: month-sum t (empty months 0). P4: per-trade Welch t (trades overlap, so it can overstate).', '',
    '## The rollover cut', '', 'R a trade before costs (month t) and after costs, each window.', '',
    '| Cut | n 05-14 | R 05-14 (t) | net | n 15-26 | R 15-26 (t) | net | n HistData | R HistData (t) | net |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const c of o.cuts) L.push(`| ${c.name} | ${row(c.d)} | ${row(c.c)} | ${row(c.h)} |`);
  L.push('', '## By hour, OANDA (break candle start, UTC)', '', '| Hour | n 05-14 | R 05-14 (t) | net | n 15-26 | R 15-26 (t) | net | win 15-26 |', '|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of o.hoursOanda) { const b = [19, 20, 21, 22, 23, 0].includes(r.hour) ? '**' : ''; L.push(`| ${b}${String(r.hour).padStart(2, '0')}${b} | ${row(r.d)} | ${row(r.c)} | ${r.c.win == null ? 'n/a' : (r.c.win * 100).toFixed(1) + '%'} |`); }
  L.push('', '## By hour, HistData against OANDA (same eight markets, Feb 2018 to Oct 2026)', '', '| Hour | n HistData | R HistData (t) | net | n OANDA | R OANDA (t) | net |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const r of o.hoursHist) L.push(`| ${String(r.hour).padStart(2, '0')} | ${row(r.h)} | ${row(r.o)} |`);
  L.push('', '## Spike or normal break candle', '', 'Break candle range / median range of the 20 previous M15 candles of the same time of day.', '');
  for (const s of o.spikeShare) L.push(`- ${s.block}: ${(s.share * 100).toFixed(1)}% of ${N(s.n)} OANDA trades broke on a candle of 2x its usual range or more.`);
  L.push('', '| Block | Range ratio | n 05-14 | R 05-14 (t) | net | n 15-26 | R 15-26 (t) | net | n HistData | R HistData (t) | net |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const s of o.spike) L.push(`| ${s.block} | ${s.bucket} | ${row(s.d)} | ${row(s.c)} | ${row(s.h)} |`);
  L.push('', '## Indices (OANDA, from where the cache starts; their daily break is at other hours)', '');
  L.push('| Market | window | all n | all R (t) | net | 20-23 n | 20-23 R (t) | net | 08-11 n | 08-11 R (t) | net |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const d of [...o.indices, { market: 'pooled', ...o.indicesPool }]) {
    L.push(`| ${d.market} | 2005-14 | ${row(d.alld)} | ${row(d.block2023d)} | ${row(d.block0811d)} |`);
    L.push(`| ${d.market} | 2015-26 | ${row(d.all)} | ${row(d.block2023)} | ${row(d.block0811)} |`); }
  L.push('', 'By hour, 2015-26 (2005-14 in result.json):', '');
  if (o.indices.length) {
    L.push('| Hour | ' + o.indices.map((d) => `${d.market} n | R (t)`).join(' | ') + ' |', '|---|' + o.indices.map(() => '---:|---:').join('|') + '|');
    for (let h = 0; h < 24; h++) L.push(`| ${String(h).padStart(2, '0')} | ` + o.indices.map((d) => { const c = d.hours[h].c; return `${N(c.n)} | ${f3(c.mean)} (${f2(c.t)})`; }).join(' | ') + ' |');
    L.push('');
  }
  L.push('## Move to target against the measured spread (trades filled Jan 2025 to Oct 2026, by fill hour)', '',
    'Spread = the demo\'s median quoted spread in the first two minutes of that UTC hour (tick probe, 60 weekdays). Ratio = 2R',
    'target distance / spread. After the spread = R less (spread + gold commission) / risk, one round trip. The forex majors',
    'have no hourly spread profile on file: not measured here.', '');
  for (const [m, s] of Object.entries(o.spreads)) {
    if (!s.measured) { L.push(`- ${m}: no hourly spread profile or no trades.`, ''); continue; }
    L.push(`### ${m} (probe ${s.at.slice(0, 10)})`, '', `Fills at 20-23 UTC: n ${N(s.fill2023.n)}, ${f3(s.fill2023.mean)}R before, ${f3(s.fill2023.meanAfterSpread)}R after the hour's spread; at 08-11 UTC: n ${N(s.fill0811.n)}, ${f3(s.fill0811.mean)}R before, ${f3(s.fill0811.meanAfterSpread)}R after.`, '',
      '| Fill hour | n | spread | days | median target | ratio | median cost R | R before | R after spread |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const r of s.rows) L.push(`| ${String(r.hour).padStart(2, '0')} | ${N(r.n)} | ${r.spread} | ${r.spreadDays ?? ''} | ${r.target ?? 'n/a'} | ${r.ratio ?? 'n/a'} | ${r.costR ?? 'n/a'} | ${f3(r.mean)} | ${f3(r.meanAfterSpread)} |`);
    L.push('');
  }
  L.push('## Checks', '', '- Every trade has its stop on the losing side of the fill (the run throws otherwise); closed candles only (the signal code is',
    '  `grid7-wide-fade`\'s, whose cut test passed); the spike ratio uses only candles before the break candle and the break candle itself.', '',
    '| Feed | Market | from | to | trades | dropped (bad data) | past the stop | risk under cost | unresolved |', '|---|---|---|---|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.feed} | ${m.market} | ${m.first} | ${m.last} | ${N(m.trades)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} |`);
  L.push('', '## What it means', '', MEANING(o), '');
  return L.join('\n');
}
// the reading, written after the run from the figures above (kept in the code so RESULT.md is reproducible)
export const MEANING = (o) => o.meaning || '(see the tables)';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2); const t0 = Date.now();
  if (cmd === 'oanda') { fs.mkdirSync(b, { recursive: true }); const M5 = K.load(a, '5m', { from: '2004-01-01', to: '2026-11-01' });
    const r = runSeries(M5, { market: a, X: exclusions(a) }); fs.writeFileSync(path.join(b, `O-${a}.json`), JSON.stringify(r));
    console.log('O', a, 'trades', r.trades.length, 'mism', r.mism, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'hist') { fs.mkdirSync(b, { recursive: true });
    const Hm = histM5(a, path.join(K.DATA_DIR, 'hist')).filter((x) => x.t >= Date.UTC(2018, 0, 1) / 1000 && x.t < Date.UTC(2026, 10, 1) / 1000);
    const r = runSeries(Hm, { market: a, from: B_FROM }); fs.writeFileSync(path.join(b, `H-${a}.json`), JSON.stringify(r));
    console.log('H', a, 'trades', r.trades.length, 'mism', r.mism, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs oanda <m> <dir> | hist <m> <dir> | report <dir>');
}
