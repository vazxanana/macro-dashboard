// Stage 2: play every recorded live-rule Scalp signal forward on M1 under each entry style / exit rule / stop buffer.
//   node research/edge/scalp-exits/exits.mjs <dataDir> <sigDir> <outDir>
// Live rule (config.json 7 Nov): Scalp only against D1, not in asia/overlap, skips AUD/USD (not in this data), reward:risk
// >= 1.2 on the price actually used. Live management = limit at the engine entry (the broken M1 level, the CF), market when
// price is already through; resting order valid 3 h, dropped if the target trades first; stop / engine target, no break-even.
// Fills and exits on M1 OHLC; when one candle touches both the stop and a target the stop counts first (as backtest.mjs).
// A gap through the stop exits at the candle's open. Cost: one spread per trade in R (backtest.mjs spreadOf).
import fs from 'node:fs';
import path from 'node:path';
import { cleanBars } from '../../../council/clean.mjs';
import { MARKETS, loadClean, aggregate, lowerBound, spreadOf } from './lib.mjs';

const [dir, sigDir, outDir] = process.argv.slice(2);
const OOS_T = Date.UTC(2024, 0, 1) / 1000, WAIT15 = 3 * 3600, MAXHOLD = 5 * 86400, MINRR = 1.2;
fs.mkdirSync(outDir, { recursive: true });

// ── signals ──
const sigs = [];
for (const f of fs.readdirSync(sigDir).filter((f) => f.endsWith('.json') && !f.startsWith('test'))) sigs.push(...JSON.parse(fs.readFileSync(path.join(sigDir, f))).sigs);
sigs.sort((a, b) => a.t - b.t);
const uniq = []; const sk = new Set();
for (const s of sigs) { const k = s.m + '|' + s.sig; if (!sk.has(k)) { sk.add(k); uniq.push(s); } }
console.log(`${uniq.length} signals recorded (all conditions)`);

// ── per market price arrays and structure pivots ──
const MK = {};
const lbT = (T, t) => { let lo = 0, hi = T.length; while (lo < hi) { const m = (lo + hi) >> 1; if (T[m] < t) lo = m + 1; else hi = m; } return lo; };
function pivots(bars, tf, w = 2) {   // engine pivL/pivH rule, confirmed when the w-th candle after it closes
  const lo = [], hi = [], n = bars.length;
  for (let j = w; j < n - w; j++) {
    let pl = true, ph = true;
    for (let k = 1; k <= w; k++) {
      if (bars[j - k].low < bars[j].low || bars[j + k].low <= bars[j].low) pl = false;
      if (bars[j - k].high > bars[j].high || bars[j + k].high >= bars[j].high) ph = false;
    }
    const ct = bars[j + w].time + tf;
    if (pl) lo.push({ t: bars[j].time, ct, p: bars[j].low });
    if (ph) hi.push({ t: bars[j].time, ct, p: bars[j].high });
  }
  return { lo, hi };
}
for (const key of [...new Set(uniq.map((s) => s.m))]) {
  const M = MARKETS[key], m1 = loadClean(dir, key, cleanBars);
  const n = m1.length, T = new Float64Array(n), O = new Float64Array(n), H = new Float64Array(n), L = new Float64Array(n), C = new Float64Array(n);
  m1.forEach((b, i) => { T[i] = b.time; O[i] = b.open; H[i] = b.high; L[i] = b.low; C[i] = b.close; });
  MK[key] = { M, T, O, H, L, C, p5: pivots(aggregate(m1, 300), 300), p15: pivots(aggregate(m1, 900), 900) };
  console.log(`${key}: ${n} M1`);
}

// ── entry ──
// style: 'live' (limit at the engine entry, market when through), 'mkt' (market at the signal), 'l50' (limit at 50% of the M1
// Origin, between the broken level and the CF swing; market when through). Returns {i, E} fill index/price or null.
function fill(s, style, stop, t1) {
  const X = MK[s.m], sg = s.side === 'sell' ? -1 : 1, i0 = lbT(X.T, s.t);
  let lim = style === 'mkt' ? null : style === 'live' ? s.entry : (s.llLevel + (sg > 0 ? s.llBot : s.llTop)) / 2;
  if (lim != null && (sg > 0 ? stop >= lim : stop <= lim)) lim = s.entry;   // never a resting order past the stop
  if (lim == null || (sg > 0 ? s.price <= lim : s.price >= lim)) {
    if ((sg > 0 ? s.price <= stop : s.price >= stop) || (t1 - s.price) * sg <= 0) return null;
    return { i: i0, E: s.price, mkt: true };
  }
  for (let i = i0; i < X.T.length; i++) {
    if (sg > 0 ? X.L[i] <= lim : X.H[i] >= lim) return { i, E: lim, mkt: false };
    if (sg > 0 ? X.H[i] >= t1 : X.L[i] <= t1) return { miss: 'missed' };
    if (X.T[i] - s.t > WAIT15) return { miss: 'expired' };
  }
  return { miss: 'end' };
}

// ── exit management on M1 from the fill candle ──
// p: { tgt: 'eng' | R number | null (no target), be: R, part: {at, frac, be}, trail: {kind:'m5'|'m15'|'atr', start, k}, ts: {n, min} }
function play(s, f, stop0, t1, p) {
  const X = MK[s.m], sg = s.side === 'sell' ? -1 : 1, E = f.E, r = Math.abs(E - stop0);
  const tgt = p.tgt === 'eng' ? t1 : p.tgt == null ? null : E + sg * p.tgt * r;
  let stop = stop0, mfe = 0, mae = 0, booked = 0, left = 1, partDone = false, beMoved = false;
  const piv = p.trail && p.trail.kind !== 'atr' ? (p.trail.kind === 'm5' ? X.p5 : X.p15)[sg > 0 ? 'lo' : 'hi'] : null;
  let pp = 0;   // first pivot whose candle starts at or after the fill
  if (piv) { let lo = 0, hi = piv.length; while (lo < hi) { const m = (lo + hi) >> 1; if (piv[m].t < X.T[f.i]) lo = m + 1; else hi = m; } pp = lo; }
  const spr = spreadOf(X.M, E);
  const R = (px) => (px - E) * sg / r;
  const end = (px, i, why) => ({ R: booked + left * R(px), mfe, mae, bars: i - f.i, why, beMoved, partDone });
  for (let i = f.i; i < X.T.length; i++) {
    const o = X.O[i], h = X.H[i], l = X.L[i], c = X.C[i];
    // stop first (conservative); a gap beyond it fills at the open (not on the fill candle of a limit order)
    if (sg > 0 ? l <= stop : h >= stop) { const px = i > f.i && (sg > 0 ? o < stop : o > stop) ? o : stop; mae = Math.max(mae, -R(sg > 0 ? l : h)); return end(px, i, 'stop'); }
    const fav = R(sg > 0 ? h : l);
    if (p.part && !partDone && fav >= p.part.at) { booked += p.part.frac * p.part.at; left -= p.part.frac; partDone = true; if (p.part.be) { stop = E; beMoved = true; } }
    if (tgt != null && (sg > 0 ? h >= tgt : l <= tgt)) { mfe = Math.max(mfe, fav); return end(tgt, i, 'target'); }
    mfe = Math.max(mfe, fav); mae = Math.max(mae, -R(sg > 0 ? l : h));
    if (X.T[i] - X.T[f.i] >= MAXHOLD) return end(c, i, 'maxhold');
    if (p.ts && i - f.i + 1 >= p.ts.n && mfe < p.ts.min) return end(c, i, 'time');
    if (p.be != null && !beMoved && mfe >= p.be) { stop = E; beMoved = true; }
    if (p.trail && mfe >= p.trail.start) {
      let ns = null;
      if (p.trail.kind === 'atr') ns = E + sg * (mfe * r) - sg * p.trail.k * s.atr15;
      else { const now = X.T[i] + 60; while (pp < piv.length && piv[pp].ct <= now) { ns = piv[pp].p - sg * spr; pp++; } }
      if (ns != null && (sg > 0 ? ns > stop : ns < stop) && (sg > 0 ? ns < c : ns > c)) stop = ns;
    }
  }
  return end(X.C[X.T.length - 1], X.T.length - 1, 'data end');
}

// ── stats ──
function stats(rows) {
  const R = rows.map((x) => x.net), n = R.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, streak: 0, t: null };
  const sum = R.reduce((a, b) => a + b, 0), mean = sum / n, sd = Math.sqrt(R.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, pk = 0, dd = 0, st = 0, ws = 0;
  for (const v of R) { eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); if (v < 0) { st++; ws = Math.max(ws, st); } else if (v > 0) st = 0; }
  return { n, wr: +(R.filter((v) => v > 0).length / n).toFixed(3), exp: +mean.toFixed(3), R: +sum.toFixed(1), maxDD: +dd.toFixed(1), streak: ws, t: +(sd > 0 ? mean / sd * Math.sqrt(n) : 0).toFixed(2) };
}
const yearOf = (t) => new Date(t * 1000).getUTCFullYear();
const byYear = (rows) => { const g = {}; for (const x of rows) (g[yearOf(x.t)] = g[yearOf(x.t)] || []).push(x); return Object.fromEntries(Object.entries(g).map(([y, a]) => [y, stats(a)])); };
function paired(a, b) {   // per-signal difference a - b over signals both filled
  const mb = new Map(b.map((x) => [x.id, x.net])), d = a.filter((x) => mb.has(x.id)).map((x) => x.net - mb.get(x.id)), n = d.length;
  if (n < 3) return null; const m = d.reduce((p, q) => p + q, 0) / n, sd = Math.sqrt(d.reduce((p, q) => p + (q - m) ** 2, 0) / (n - 1));
  return { n, diff: +m.toFixed(3), t: +(sd > 0 ? m / sd * Math.sqrt(n) : 0).toFixed(2) };
}

// ── the live-rule signal set ──
const live = uniq.filter((s) => s.d1 === 'against' && !['asia', 'overlap'].includes(s.session) && s.m !== 'audusd');
console.log(`${live.length} signals pass the live rule (against D1, not asia/overlap)`);

const EXITS = [
  ['engine target (live)', { tgt: 'eng' }],
  ['fixed 1R', { tgt: 1 }], ['fixed 1.5R', { tgt: 1.5 }], ['fixed 2R', { tgt: 2 }], ['fixed 3R', { tgt: 3 }],
  ['engine target, BE +0.5R', { tgt: 'eng', be: 0.5 }], ['engine target, BE +1R', { tgt: 'eng', be: 1 }], ['engine target, BE +1.5R', { tgt: 'eng', be: 1.5 }],
  ['50% at 1R, rest engine target', { tgt: 'eng', part: { at: 1, frac: 0.5, be: false } }],
  ['50% at 1R, rest engine target, BE after', { tgt: 'eng', part: { at: 1, frac: 0.5, be: true } }],
  ['trail M5 structure from +1R, engine target', { tgt: 'eng', trail: { kind: 'm5', start: 1 } }],
  ['trail M15 structure from +1R, engine target', { tgt: 'eng', trail: { kind: 'm15', start: 1 } }],
  ['trail M5 structure from +1R, no target', { tgt: null, trail: { kind: 'm5', start: 1 } }],
  ['trail M15 structure from +1R, no target', { tgt: null, trail: { kind: 'm15', start: 1 } }],
  ['trail 1x M15 ATR from +1R, engine target', { tgt: 'eng', trail: { kind: 'atr', start: 1, k: 1 } }],
  ['trail 2x M15 ATR from +1R, no target', { tgt: null, trail: { kind: 'atr', start: 1, k: 2 } }],
  ['time stop 15 min if < +0.5R, engine target', { tgt: 'eng', ts: { n: 15, min: 0.5 } }],
  ['time stop 30 min if < +0.5R, engine target', { tgt: 'eng', ts: { n: 30, min: 0.5 } }],
  ['time stop 60 min if < +0.5R, engine target', { tgt: 'eng', ts: { n: 60, min: 0.5 } }],
  ['time stop 120 min if < +0.5R, engine target', { tgt: 'eng', ts: { n: 120, min: 0.5 } }],
];
const ENTRIES = [['live: limit at CF level (market if through)', 'live'], ['market at the signal', 'mkt'], ['limit at 50% of the M1 Origin', 'l50']];
const BUFS = ['0.1', '0.15', '0.25'];

// run one (entry, buffer, exit) combination: rows of filled trades (net R) and the signal count
function run(entry, buf, ex) {
  const rows = []; let sigN = 0, unf = 0;
  for (const s of live) {
    const pb = s.per[buf]; if (!pb) continue;
    const sg = s.side === 'sell' ? -1 : 1;
    // live minRR gate on the price the live trader would use (limit entry or market when through), per stop buffer
    const through = sg > 0 ? s.price <= s.entry : s.price >= s.entry, e0 = through ? s.price : s.entry;
    if (!((pb.t1 - e0) * sg / Math.abs(e0 - pb.stop) >= MINRR)) continue;
    sigN++;
    const f = fill(s, entry, pb.stop, pb.t1);
    if (!f || f.miss) { unf++; continue; }
    const o = play(s, f, pb.stop, pb.t1, ex), r = Math.abs(f.E - pb.stop), cost = spreadOf(MK[s.m].M, f.E) / r;
    rows.push({ id: s.m + '|' + s.sig, t: s.t, m: s.m, gross: o.R, net: o.R - cost, cost, ...o, rrEng: (pb.t1 - f.E) * sg / r });
  }
  return { rows, sigN, unf };
}
const split = (rows) => ({ is: rows.filter((x) => x.t < OOS_T), oos: rows.filter((x) => x.t >= OOS_T) });
const summary = (res, base) => { const { is, oos } = split(res.rows), b = base && split(base.rows);
  return { signals: res.sigN, unfilled: res.unf, is: stats(is), oos: stats(oos), isGross: +is.reduce((a, x) => a + x.gross, 0).toFixed(1), oosGross: +oos.reduce((a, x) => a + x.gross, 0).toFixed(1),
    years: byYear(res.rows),
    byMarket: Object.fromEntries([...new Set(res.rows.map((x) => x.m))].map((m) => [m, { is: stats(is.filter((x) => x.m === m)), oos: stats(oos.filter((x) => x.m === m)) }])),
    pairedIS: b ? paired(is, b.is) : null, pairedOOS: b ? paired(oos, b.oos) : null }; };

const results = [];
const base = run('live', '0.15', EXITS[0][1]);
// 1. exits on the live entry and stop
for (const [name, ex] of EXITS) { const r = name === EXITS[0][0] ? base : run('live', '0.15', ex); results.push({ group: 'exit', rule: name, ...summary(r, base) }); }
// 2. entry styles with the live exit
for (const [name, e] of ENTRIES.slice(1)) results.push({ group: 'entry', rule: name, ...summary(run(e, '0.15', EXITS[0][1]), null) });
// 3. stop buffers with the live entry and exit
for (const b of ['0.1', '0.25']) results.push({ group: 'stop', rule: `stop buffer ${b} ATR`, ...summary(run('live', b, EXITS[0][1]), null) });

// ── MAE / MFE on the live trades: run to the stop with no target (5-day cap) to see how far trades go ──
const free = run('live', '0.15', { tgt: null }).rows, bmap = new Map(base.rows.map((x) => [x.id, x]));
const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b.length ? +b[Math.min(b.length - 1, Math.floor(p * b.length))].toFixed(2) : null; };
const reach = (rows, lv) => +(rows.filter((x) => x.mfe >= lv).length / rows.length).toFixed(3);
const mm = (rows) => ({ n: rows.length,
  mfeBeforeStop: { p25: q(rows.map((x) => x.mfe), 0.25), p50: q(rows.map((x) => x.mfe), 0.5), p75: q(rows.map((x) => x.mfe), 0.75), p90: q(rows.map((x) => x.mfe), 0.9) },
  reachBeforeStop: Object.fromEntries([0.5, 1, 1.5, 2, 3, 5].map((v) => [`${v}R`, reach(rows, v)])) });
const winners = base.rows.filter((x) => x.why === 'target'), losers = base.rows.filter((x) => x.why === 'stop');
const mae = {
  engineRR: { p25: q(base.rows.map((x) => x.rrEng), 0.25), p50: q(base.rows.map((x) => x.rrEng), 0.5), p75: q(base.rows.map((x) => x.rrEng), 0.75) },
  winnersMAE: { n: winners.length, p50: q(winners.map((x) => x.mae), 0.5), p75: q(winners.map((x) => x.mae), 0.75), p90: q(winners.map((x) => x.mae), 0.9),
    share_over_0_5R: +(winners.filter((x) => x.mae >= 0.5).length / winners.length).toFixed(3), share_over_0_8R: +(winners.filter((x) => x.mae >= 0.8).length / winners.length).toFixed(3) },
  losersMFE: { n: losers.length, p50: q(losers.map((x) => x.mfe), 0.5), p75: q(losers.map((x) => x.mfe), 0.75),
    reached_0_5R: +(losers.filter((x) => x.mfe >= 0.5).length / losers.length).toFixed(3), reached_1R: +(losers.filter((x) => x.mfe >= 1).length / losers.length).toFixed(3) },
  barsToExit: { winners_p50: q(winners.map((x) => x.bars), 0.5), losers_p50: q(losers.map((x) => x.bars), 0.5) },
  lossesQuick: { stopped_within_15min: +(losers.filter((x) => x.bars < 15).length / losers.length).toFixed(3) },
  free: { is: mm(free.filter((x) => x.t < OOS_T)), oos: mm(free.filter((x) => x.t >= OOS_T)) },
  // of trades not at +0.5R after N minutes, how many later hit the engine target
  timeCheck: Object.fromEntries([15, 30, 60, 120].map((N) => { const a = base.rows.filter((x) => x.bars >= N); return [N + 'min', { stillOpen: a.length }]; })),
};
fs.writeFileSync(path.join(outDir, 'exits-out.json'), JSON.stringify({ n: live.length, results, mae }, null, 1));

// ── walk-forward verdicts: a variant is chosen on IS only; the candidate test is on OOS (PREAMBLE rule 4) ──
const B = results[0], oosYears = (r) => Object.entries(r.years).filter(([y]) => +y >= 2024);
const verdict = (r) => {
  if (r === B) return 'baseline';
  const ys = oosYears(r), pos = ys.filter(([, s]) => s.exp > 0).length;
  const ok = r.oos.n >= 100 && r.oos.exp > 0 && r.oos.exp > B.oos.exp && pos >= Math.ceil(ys.length * 2 / 3);
  const isBetter = r.is.exp > B.is.exp, oosBetter = r.oos.exp > B.oos.exp;
  if (ok) return isBetter ? 'PASS' : 'OOS-only improvement (worse in-sample): not a candidate';
  const why = [r.oos.n < 100 ? 'OOS n < 100' : null, r.oos.exp <= 0 ? 'OOS expectancy negative' : null, !oosBetter ? 'no better than baseline OOS' : null,
    pos < Math.ceil(ys.length * 2 / 3) ? `positive in ${pos}/${ys.length} OOS years` : null].filter(Boolean).join('; ');
  return `FAIL (${why}${isBetter && oosBetter ? '; improves on the baseline IS and OOS but stays below zero' : ''})`;
};
const pick = (s) => ({ n: s.n, wr: s.wr, exp: s.exp, R: s.R, maxDD: s.maxDD, t: s.t });
const isBest = results.filter((r) => r.group === 'exit').slice().sort((a, b) => b.is.exp - a.is.exp)[0];
fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify({
  topic: 'scalp-exits', system: 'MERIDIAN council Scalp (M15 -> M1), live rule: against D1, not asia/overlap, skips AUD/USD',
  baseline: { rule: B.rule, is: pick(B.is), oos: pick(B.oos), signals: B.signals, unfilled: B.unfilled, byMarket: Object.fromEntries(Object.entries(B.byMarket).map(([m, v]) => [m, { is: pick(v.is), oos: pick(v.oos) }])), years: Object.fromEntries(Object.entries(B.years).map(([y, s]) => [y, pick(s)])) },
  chosenInSample: isBest.rule,
  candidates: results.filter((r) => r !== B).map((r) => ({ group: r.group, rule: r.rule, is: pick(r.is), oos: pick(r.oos), signals: r.signals, unfilled: r.unfilled,
    pairedVsBaseline: { is: r.pairedIS, oos: r.pairedOOS }, byMarket: Object.fromEntries(Object.entries(r.byMarket).map(([m, v]) => [m, { is: pick(v.is), oos: pick(v.oos) }])), years: Object.fromEntries(Object.entries(r.years).map(([y, s]) => [y, pick(s)])), verdict: verdict(r) })),
  maeMfe: mae, variantsTried: results.length - 1,
  notes: 'IS = Jun 2018-2023, OOS = 2024-Oct 2026. Markets: XAU/USD, EUR/USD, GBP/USD, USD/CAD, USD/CHF (histdata M1, council/histdata.mjs clock). Net = gross minus one spread in R. Per-signal evaluation (no exposure / USD-cap / re-entry / news-guard portfolio rules, which depend on the exit itself). Stop-first when a candle touches both stop and target.',
}, null, 1));
for (const r of results) console.log(`${r.rule.padEnd(46)} ${verdict(r)}`);
console.log('chosen in-sample:', isBest.rule);
const fmt = (s) => `n${s.n} wr${s.wr} exp${s.exp} R${s.R} DD${s.maxDD} t${s.t}`;
for (const r of results) console.log(`${r.group.padEnd(5)} ${r.rule.padEnd(46)} IS ${fmt(r.is)} | OOS ${fmt(r.oos)}${r.pairedOOS ? ` | dOOS ${r.pairedOOS.diff} t${r.pairedOOS.t}` : ''}`);
console.log(JSON.stringify(mae, null, 1));
